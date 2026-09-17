"""
GPU Cluster Efficiency analysis engine.

Loads the two raw MIT HPCA'22 CSVs (data/scheduler_data.csv, data/dcgm.csv),
derives a jobs table and a per-GPU table, and computes every number the
dashboard shows: the allocated->computed->completed waterfall, the outcome
breakdown, the eight SRE recommendations, node/array/user triage, and a
deduped "recoverable" estimate with a fact/judgment confidence split.

Everything is computed once at startup and cached in memory (see app.py).
"""
from __future__ import annotations

import ast
import os
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent / "data" / "raw"))

PRICE_BOOK = {
    "gpu_hour_usd": 2.50,
    "kwh_usd": 0.15,
    "engineer_hour_usd": 95.0,
}

STATE_MAP = {1: "RUNNING", 3: "COMPLETED", 4: "CANCELLED", 5: "FAILED", 6: "TIMEOUT", 7: "NODE_FAIL", 11: "OOM"}

# id_array_job value used by the anonymization pipeline as the "not part of
# an array" placeholder -- it collides tens of thousands of unrelated single
# jobs into one fake "array" (verified: this is the only id_array_job value
# whose id_array_task never varies).
NON_ARRAY_SENTINEL = 41161693674

WEEK_SEC = 7 * 24 * 3600
BURST_WINDOW_SEC = 48 * 3600


def _parse_gpu_count(row) -> float:
    for col in ("gres_alloc", "gres_req"):
        v = row.get(col)
        if isinstance(v, str) and v.startswith("gpu"):
            try:
                return float(v.split(":")[-1])
            except ValueError:
                pass
    return np.nan


def _first_node(nodelist: str):
    try:
        lst = ast.literal_eval(nodelist)
        return lst[0] if lst else None
    except (ValueError, SyntaxError):
        return None


def load_raw() -> tuple[pd.DataFrame, pd.DataFrame]:
    sched = pd.read_csv(DATA_DIR / "scheduler_data.csv")
    dcgm = pd.read_csv(DATA_DIR / "dcgm.csv")
    return sched, dcgm


def build_jobs_and_gpus(sched: pd.DataFrame, dcgm: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Derive the jobs table (one row per id_job) and the gpus table
    (one row per physical GPU per job), following Project-overview.md's
    column contract as closely as the raw columns allow."""

    gpu_job_ids = set(dcgm["id_job"].unique())
    sched = sched[sched["id_job"].isin(gpu_job_ids)].copy()

    # id_job is only a primary key after collapsing Slurm requeue chains
    # (the same id_job can appear multiple times: NODE_FAIL, requeue-marker,
    # then a final terminal state). Canonical row = the one with the latest
    # time_end; hit_node_failure is True if ANY attempt in the chain failed
    # on a node, even if a later retry succeeded.
    sched = sched.sort_values("time_end")
    hit_nf = sched.groupby("id_job")["state"].apply(lambda s: bool((s == 7).any()))
    jobs = sched.groupby("id_job", as_index=False).last()
    jobs["hit_node_failure"] = jobs["id_job"].map(hit_nf)

    jobs["state_name"] = jobs["state"].map(STATE_MAP).fillna("UNKNOWN")
    jobs["is_success"] = jobs["state_name"] == "COMPLETED"
    jobs["gpu_count"] = jobs.apply(_parse_gpu_count, axis=1)
    jobs["primary_node"] = jobs["nodelist"].apply(_first_node)
    jobs["exit_status"] = jobs["exit_code"] // 256

    jobs["wait_sec"] = np.where(jobs["time_start"] > 0, jobs["time_start"] - jobs["time_eligible"], np.nan)
    jobs["walltime_sec"] = np.where(jobs["time_start"] > 0, jobs["time_end"] - jobs["time_start"], 0)
    jobs["walltime_sec"] = jobs["walltime_sec"].clip(lower=0)

    mem_flag = 2**63
    jobs["mem_req_mb"] = np.where(jobs["mem_req"] >= mem_flag, jobs["mem_req"] - mem_flag, jobs["mem_req"])

    min_submit = jobs["time_submit"].min()
    jobs["week"] = ((jobs["time_submit"] - min_submit) // WEEK_SEC).astype(int)

    # --- gpus table: join dcgm rows to their job's walltime and clip
    # totalexecutiontime_sec to it (66+ rows in the source report more
    # runtime than their job had) ---
    gpus = dcgm.merge(jobs[["id_job", "walltime_sec"]], on="id_job", how="inner")
    gpus["clipped_exec_sec"] = np.minimum(gpus["totalexecutiontime_sec"], gpus["walltime_sec"])
    gpus = gpus.rename(columns={
        "smutilization_pct_avg": "sm_util_avg",
        "memoryutilization_pct_avg": "mem_util_pct_avg",
        "powerusage_watts_avg": "watts_avg",
        "energyconsumed_joules": "energy_joules",
    })

    agg = gpus.groupby("id_job").agg(
        gpu_hours=("clipped_exec_sec", lambda s: s.sum() / 3600),
        sm_util_avg=("sm_util_avg", "mean"),
        sm_util_max=("smutilization_pct_max", "max"),
        mem_used_frac=("mem_util_pct_avg", lambda s: s.mean() / 100.0),
        watts_avg=("watts_avg", "mean"),
        energy_wh=("energy_joules", lambda s: s.sum() / 3600.0),
        n_gpus_seen=("gpu_id", "count"),
    ).reset_index()

    jobs = jobs.merge(agg, on="id_job", how="left")
    jobs["gpu_hours_alloc"] = jobs["gpu_count"] * jobs["walltime_sec"] / 3600.0

    return jobs, gpus


# ---------------------------------------------------------------------------
# Node / array / user triage
# ---------------------------------------------------------------------------

def node_failure_stats(jobs: pd.DataFrame, gpus: pd.DataFrame) -> pd.DataFrame:
    gj = gpus.merge(jobs[["id_job", "state_name", "id_user", "exit_status", "time_end"]], on="id_job", how="left")
    gj = gj.drop_duplicates("id_job")  # one row per job per node for failure attribution
    stats = gj.groupby("Node").agg(
        n_jobs=("id_job", "count"),
        n_users=("id_user", "nunique"),
        n_failed=("state_name", lambda s: s.isin(["FAILED", "NODE_FAIL", "OOM"]).sum()),
    ).reset_index()
    stats["fail_rate"] = stats["n_failed"] / stats["n_jobs"]
    return stats, gj


def find_bad_nodes(jobs: pd.DataFrame, gpus: pd.DataFrame, min_jobs=20, min_users=3, rate_multiple=2.0):
    stats, gj = node_failure_stats(jobs, gpus)
    fleet_rate = stats["n_failed"].sum() / stats["n_jobs"].sum()
    candidates = stats[(stats["n_jobs"] >= min_jobs) & (stats["n_users"] >= min_users) & (stats["fail_rate"] > fleet_rate * rate_multiple)]
    candidates = candidates.sort_values("fail_rate", ascending=False)

    results = []
    for _, row in candidates.head(10).iterrows():
        node = row["Node"]
        sub = gj[gj["Node"] == node].dropna(subset=["time_end"]).sort_values("time_end")
        fails = sub[sub["state_name"].isin(["FAILED", "NODE_FAIL", "OOM"])]
        if len(fails) < 5:
            continue
        times = fails["time_end"].to_numpy()
        best_count, best_start = 0, None
        for t0 in times:
            cnt = int(((times >= t0) & (times < t0 + BURST_WINDOW_SEC)).sum())
            if cnt > best_count:
                best_count, best_start = cnt, t0
        window_all = sub[(sub["time_end"] >= best_start) & (sub["time_end"] < best_start + BURST_WINDOW_SEC)]
        window_fails = fails[(fails["time_end"] >= best_start) & (fails["time_end"] < best_start + BURST_WINDOW_SEC)]
        touched = set(sub["id_job"])
        affected_users = window_fails["id_user"].unique().tolist()
        elsewhere = jobs[jobs["id_user"].isin(affected_users) & (~jobs["id_job"].isin(touched))]
        elsewhere_fail_rate = elsewhere["state_name"].isin(["FAILED", "NODE_FAIL", "OOM"]).mean() if len(elsewhere) else None
        top_exit = window_fails["exit_status"].value_counts()
        burst_fail_rate = best_count / max(len(window_all), 1)
        # How much sharper the burst is than these same users' normal
        # failure rate elsewhere -- the strongest signal that this is a
        # hardware fault rather than a chronically misused node.
        baseline_ratio = (burst_fail_rate / elsewhere_fail_rate) if elsewhere_fail_rate else None
        results.append({
            "node": node,
            "overall_fail_rate": round(float(row["fail_rate"]), 4),
            "fleet_baseline_fail_rate": round(float(fleet_rate), 4),
            "burst_window_jobs": int(len(window_all)),
            "burst_window_failed": int(best_count),
            "burst_fail_rate": round(burst_fail_rate, 4),
            "burst_distinct_users": int(window_fails["id_user"].nunique()),
            "top_exit_status": int(top_exit.index[0]) if len(top_exit) else None,
            "top_exit_status_share": round(float(top_exit.iloc[0] / len(window_fails)), 4) if len(window_fails) else None,
            "affected_users_elsewhere_fail_rate": round(float(elsewhere_fail_rate), 4) if elsewhere_fail_rate is not None else None,
            "baseline_ratio": round(float(baseline_ratio), 2) if baseline_ratio is not None else None,
            "window_start_epoch": float(best_start),
            "window_end_epoch": float(best_start + BURST_WINDOW_SEC),
            "affected_job_ids": window_fails["id_job"].tolist(),
        })
    results.sort(key=lambda r: (r["baseline_ratio"] or 0), reverse=True)
    return results


def find_bad_arrays(jobs: pd.DataFrame, min_tasks=3, fail_threshold=0.9):
    real = jobs[jobs["id_array_job"] != NON_ARRAY_SENTINEL]
    arr = real.groupby("id_array_job").agg(
        n_tasks=("id_job", "count"),
        n_failed=("state_name", lambda s: s.isin(["FAILED", "NODE_FAIL", "OOM"]).sum()),
        gpu_hours=("gpu_hours", "sum"),
    ).reset_index()
    arr["fail_rate"] = arr["n_failed"] / arr["n_tasks"]
    bad = arr[(arr["n_tasks"] >= min_tasks) & (arr["fail_rate"] > fail_threshold)]
    job_ids = real[real["id_array_job"].isin(bad["id_array_job"])]["id_job"].tolist()
    return bad.sort_values("n_tasks", ascending=False), job_ids


def find_repeat_failure_users(jobs: pd.DataFrame, min_fail_rate=0.3, min_weeks=8, min_jobs=5):
    u = jobs.groupby("id_user").agg(
        total_jobs=("id_job", "count"),
        failed=("state_name", lambda s: s.isin(["FAILED", "OOM"]).sum()),
        weeks_active=("week", "nunique"),
        gpu_hours=("gpu_hours", "sum"),
    ).reset_index()
    u["fail_rate"] = u["failed"] / u["total_jobs"]
    cand = u[(u["fail_rate"] > min_fail_rate) & (u["weeks_active"] >= min_weeks) & (u["total_jobs"] >= min_jobs)]
    return cand.sort_values("failed", ascending=False)


# ---------------------------------------------------------------------------
# Waste category assignment (dedup by id_job — a job gets exactly ONE
# category, chosen in priority order, so the "recoverable" total never
# double counts a job the way naively summing all 8 recommendations would).
# ---------------------------------------------------------------------------

CATEGORY_ORDER = [
    "node_hardware_fault",
    "never_computed_failure",
    "wallclock_kill",
    "slow_cancellation",
    "gpu_not_needed",
    "idle_interactive",
]

CATEGORY_CONFIDENCE = {
    "node_hardware_fault": ("fact", 0.9),
    "never_computed_failure": ("fact", 0.85),
    "wallclock_kill": ("fact", 0.8),
    "slow_cancellation": ("judgment", 0.6),
    "gpu_not_needed": ("judgment", 0.65),
    "idle_interactive": ("judgment", 0.55),
}


@dataclass
class Analysis:
    jobs: pd.DataFrame
    gpus: pd.DataFrame
    bad_nodes: list
    bad_arrays: pd.DataFrame
    bad_array_job_ids: list
    repeat_failure_users: pd.DataFrame
    computed_at: float


def run_analysis() -> Analysis:
    sched, dcgm = load_raw()
    jobs, gpus = build_jobs_and_gpus(sched, dcgm)

    bad_nodes = find_bad_nodes(jobs, gpus)
    bad_node_job_ids = set()
    for n in bad_nodes:
        bad_node_job_ids.update(n["affected_job_ids"])

    bad_arrays, bad_array_job_ids = find_bad_arrays(jobs)
    bad_array_job_ids = set(bad_array_job_ids)

    repeat_users = find_repeat_failure_users(jobs)

    jobs["is_bad_node_job"] = jobs["id_job"].isin(bad_node_job_ids)
    jobs["is_bad_array_job"] = jobs["id_job"].isin(bad_array_job_ids)
    jobs["is_interactive"] = jobs["job_type"] == "LLSUB:INTERACTIVE"
    jobs["is_repeat_failure_user"] = jobs["id_user"].isin(repeat_users["id_user"])

    def assign_category(r):
        if r["is_bad_node_job"]:
            return "node_hardware_fault"
        if r["state_name"] in ("FAILED", "OOM") and r["gpu_hours"] == 0:
            return "never_computed_failure"
        if r["state_name"] == "TIMEOUT":
            return "wallclock_kill"
        if r["state_name"] == "CANCELLED" and r["walltime_sec"] > 4 * 3600:
            return "slow_cancellation"
        if r["is_success"] and r["sm_util_avg"] == 0 and r["sm_util_max"] == 0:
            return "gpu_not_needed"
        if r["is_interactive"] and r["sm_util_avg"] == 0:
            return "idle_interactive"
        return None

    jobs["waste_category"] = jobs.apply(assign_category, axis=1)

    # wasted_gpu_hours is priced in DOLLARS against MEASURED gpu_hours (the
    # "money column" per the data contract), never gpu_hours_alloc -- a job
    # that never touched the GPU cost $0 in real spend, however long it sat
    # in a broken state. never_computed_failure is therefore a queue/
    # engineering-hygiene issue, not a GPU-dollar one, and is priced
    # separately in engineer-hours (see wasted_engineer_hours below).
    def wasted_hours(r):
        cat = r["waste_category"]
        if cat == "node_hardware_fault":
            return r["gpu_hours"]
        if cat == "never_computed_failure":
            return 0.0
        if cat == "wallclock_kill":
            return r["gpu_hours"]
        if cat == "slow_cancellation":
            excess_hours = max(r["gpu_hours"] - 4.0 * (r["gpu_count"] if not np.isnan(r["gpu_count"]) else 1.0), 0.0)
            return excess_hours
        if cat == "gpu_not_needed":
            return r["gpu_hours"]
        if cat == "idle_interactive":
            return r["gpu_hours"]
        return 0.0

    jobs["wasted_gpu_hours"] = jobs.apply(wasted_hours, axis=1)

    def wasted_engineer_hours(r):
        # Proxy for debugging/triage burden: crash-loop investigations and
        # array-wide script fixes cost engineer time even at $0 GPU spend.
        if r["waste_category"] == "never_computed_failure":
            return 0.25
        if r["is_bad_array_job"] and r["waste_category"] is None:
            return 0.0
        return 0.0

    jobs["wasted_engineer_hours"] = jobs.apply(wasted_engineer_hours, axis=1)

    return Analysis(
        jobs=jobs,
        gpus=gpus,
        bad_nodes=bad_nodes,
        bad_arrays=bad_arrays,
        bad_array_job_ids=list(bad_array_job_ids),
        repeat_failure_users=repeat_users,
        computed_at=time.time(),
    )


if __name__ == "__main__":
    a = run_analysis()
    print("jobs:", len(a.jobs))
    print("total gpu_hours:", a.jobs["gpu_hours"].sum())
    print(a.jobs["waste_category"].value_counts(dropna=False))
    print("deduped wasted_gpu_hours total:", a.jobs["wasted_gpu_hours"].sum())
    print("bad nodes:", [n["node"] for n in a.bad_nodes][:5])
    print("bad arrays:", len(a.bad_arrays))
    print("repeat failure users:", len(a.repeat_failure_users))

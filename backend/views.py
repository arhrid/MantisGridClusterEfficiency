"""Shapes the Analysis object into the JSON views the dashboard consumes.

Kept separate from analysis.py so the "what does the data mean" derivation
logic stays isolated from "how do we present it" formatting.
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

from analysis import CATEGORY_CONFIDENCE, PRICE_BOOK, Analysis

FACT_CATEGORIES = {"node_hardware_fault", "wallclock_kill"}
JUDGMENT_CATEGORIES = {"slow_cancellation", "gpu_not_needed", "idle_interactive"}


def _usd(gpu_hours: float) -> float:
    return round(gpu_hours * PRICE_BOOK["gpu_hour_usd"], 2)


def _clean(v):
    """Make a value JSON-safe (no NaN/inf, native python types)."""
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating, float)):
        v = float(v)
        return None if (math.isnan(v) or math.isinf(v)) else round(v, 4)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    return v


def _records(df: pd.DataFrame) -> list[dict]:
    return [{k: _clean(v) for k, v in row.items()} for row in df.to_dict(orient="records")]


def recoverable_estimate(jobs: pd.DataFrame) -> dict:
    by_cat = jobs.groupby("waste_category")["wasted_gpu_hours"].sum()
    fact_hours = sum(by_cat.get(c, 0.0) for c in FACT_CATEGORIES)
    judgment_hours_by_cat = {c: by_cat.get(c, 0.0) for c in JUDGMENT_CATEGORIES}
    point = fact_hours + sum(h * CATEGORY_CONFIDENCE[c][1] for c, h in judgment_hours_by_cat.items())
    low = fact_hours
    high = fact_hours + sum(judgment_hours_by_cat.values())
    return {
        "gpu_hours": {"low": round(low, 1), "point": round(point, 1), "high": round(high, 1)},
        "usd": {"low": _usd(low), "point": _usd(point), "high": _usd(high)},
        "basis": (
            "Deduplicated by job: each job is assigned exactly one waste category "
            "(node hardware fault > never-computed failure > wallclock kill > slow "
            "cancellation > GPU-not-needed > idle interactive), so no GPU-hour is "
            "counted twice. Dollars are priced against measured DCGM execution "
            "time, never allocated/held time. 'Fact' categories (hardware faults, "
            "scheduler wallclock kills) form the low bound; 'judgment' categories "
            "(slow cancellations, zero-utilization completions, idle interactive "
            "sessions) are confidence-weighted into the point estimate and taken "
            "at face value for the high bound."
        ),
    }


def summary(a: Analysis) -> dict:
    j = a.jobs
    total_gpu_hours = j["gpu_hours"].sum()
    completed = j[j.is_success]
    completed_useful = (completed["gpu_hours"] * completed["sm_util_avg"] / 100.0).sum()
    rec = recoverable_estimate(j)
    active_findings = int((j["waste_category"].notna()).sum())
    return {
        "total_gpu_hours": _clean(total_gpu_hours),
        "total_usd": _usd(total_gpu_hours),
        "completed_useful_gpu_hours": _clean(completed_useful),
        "completed_useful_pct": _clean(completed_useful / total_gpu_hours * 100),
        "recoverable": rec,
        "active_findings": active_findings,
        "total_jobs": int(len(j)),
        "total_users": int(j["id_user"].nunique()),
        "bad_nodes_count": len(a.bad_nodes),
        "price_book": PRICE_BOOK,
    }


def waterfall(a: Analysis) -> dict:
    j = a.jobs
    allocated = j["gpu_hours_alloc"].sum()
    computed = j["gpu_hours"].sum()
    completed = j[j.is_success]
    completed_useful = (completed["gpu_hours"] * completed["sm_util_avg"] / 100.0).sum()
    completed_measured = completed["gpu_hours"].sum()

    by_state = j.groupby("state_name")["gpu_hours"].sum()
    failed_hours = by_state.get("FAILED", 0) + by_state.get("OOM", 0)
    cancelled_hours = by_state.get("CANCELLED", 0)
    timeout_hours = by_state.get("TIMEOUT", 0)
    nodefail_hours = by_state.get("NODE_FAIL", 0)
    low_util_within_completed = max(completed_measured - completed_useful, 0)

    return {
        "stages": [
            {"name": "Allocated", "gpu_hours": _clean(allocated), "usd": _usd(allocated)},
            {"name": "Computed", "gpu_hours": _clean(computed), "usd": _usd(computed)},
            {"name": "Completed (useful)", "gpu_hours": _clean(completed_useful), "usd": _usd(completed_useful)},
        ],
        "dropoffs": [
            {"label": "Cancelled", "gpu_hours": _clean(cancelled_hours), "usd": _usd(cancelled_hours)},
            {"label": "Timeout (wallclock kill)", "gpu_hours": _clean(timeout_hours), "usd": _usd(timeout_hours)},
            {"label": "Failed", "gpu_hours": _clean(failed_hours), "usd": _usd(failed_hours)},
            {"label": "Node failure", "gpu_hours": _clean(nodefail_hours), "usd": _usd(nodefail_hours)},
            {"label": "Low utilization (within completed jobs)", "gpu_hours": _clean(low_util_within_completed), "usd": _usd(low_util_within_completed)},
        ],
        "note": (
            "'Allocated' ≈ 'Computed' in this cluster: Slurm/DCGM count a GPU as "
            "executing from the moment a job's context is active, whether or not it "
            "is doing useful work, so the real drop-off happens between Computed and "
            "Completed — split out below by outcome, plus the utilization gap "
            "inside jobs that did complete."
        ),
    }


def waste_breakdown(a: Analysis) -> dict:
    j = a.jobs.copy()
    j["state_name_grouped"] = j["state_name"].replace({"OOM": "FAILED"})
    g = j.groupby("state_name_grouped").agg(gpu_hours=("gpu_hours", "sum"), jobs=("id_job", "count")).reset_index()
    g = g.rename(columns={"state_name_grouped": "outcome"})
    total = g["gpu_hours"].sum()
    g["usd"] = (g["gpu_hours"] * PRICE_BOOK["gpu_hour_usd"]).round(2)
    g["share_pct"] = (g["gpu_hours"] / total * 100).round(1)
    g = g.sort_values("gpu_hours", ascending=False)
    return {
        "rows": _records(g),
        "cancelled_is_waste": False,
        "cancelled_rationale": (
            "CANCELLED is not treated as pure waste: many cancellations are a "
            "researcher course-correcting quickly (kill a bad run, resubmit with "
            "fixed args), which is healthy iteration, not waste. The actionable "
            "subset is jobs held 4+ hours before being cancelled — see the "
            "'Slow cancellation of idle jobs' recommendation — which IS counted "
            "in the recoverable estimate."
        ),
    }


RECOMMENDATION_DEFS = [
    {
        "id": "idle_interactive",
        "title": "Idle interactive sessions",
        "action": "Auto-kill interactive sessions after 4 hours of 0% SM utilization; warn the user first.",
        "if_right": "Frees GPU slots held by sessions nobody is watching, without touching jobs that are actually working.",
        "risk_if_wrong": "A researcher mid-thought loses an unsaved interactive session (mitigate: 15-minute warning + easy re-launch).",
    },
    {
        "id": "gpu_not_needed",
        "title": "GPU not needed",
        "action": "Jobs that completed successfully at 0% GPU utilization the entire run — move this workload to a CPU queue.",
        "if_right": "Frees GPU slots for GPU-bound work and cuts spend on jobs that were never using the accelerator.",
        "risk_if_wrong": "If the job needs the GPU only for a brief init/teardown step, it breaks on a CPU-only queue.",
    },
    {
        "id": "never_computed_failure",
        "title": "Never-computed failures",
        "action": "Jobs that crashed before touching the GPU (0 measured GPU-hours). $0 in direct GPU spend, but each one occupies a scheduler slot and an engineer's triage time — fix the launch scripts, add a pre-flight check.",
        "if_right": "Fewer broken-script resubmissions clogging the queue; faster feedback loop for researchers.",
        "risk_if_wrong": "None on the GPU-cost side; low risk to fix, mostly an engineering-hygiene item.",
    },
    {
        "id": "slow_cancellation",
        "title": "Slow cancellation of idle jobs",
        "action": "Jobs held for 4+ hours before the user cancelled them. Add a Slack/email nudge at 1h and 4h of near-zero utilization.",
        "if_right": "Recovers GPU-hours currently held idle for hours before anyone notices and cancels.",
        "risk_if_wrong": "If the job was intentionally left running for a slow burn-in test, a nudge is just noise — low risk, easy to snooze.",
    },
    {
        "id": "repeat_failure_user",
        "title": "Repeat-failure users",
        "action": "Users failing >30% of jobs across 8+ weeks — pair with a support/office-hours intervention rather than a policy change.",
        "if_right": "Prevents months of recurring failures per user going forward; framed as capacity recovered, not blame.",
        "risk_if_wrong": "Framing this as a blame list rather than a support offer damages trust; keep it opt-in and coaching-oriented.",
    },
    {
        "id": "node_hardware_fault",
        "title": "Bad node(s): hardware fault",
        "action": "Node(s) showing a failure-rate burst far above the same users' baseline elsewhere, concentrated on one exit code — drain and RMA.",
        "if_right": "Stops burning jobs on broken hardware and saves the affected users' work going forward.",
        "risk_if_wrong": "Draining a healthy node loses its capacity for nothing; the same-user-baseline comparison is the safeguard against a false positive.",
    },
    {
        "id": "array_mass_failure",
        "title": "Array mass failures",
        "action": "Job arrays where >90% of tasks failed — one script fix prevents the whole array from re-failing, instead of debugging tasks one at a time.",
        "if_right": "One fix per array instead of one per task — collapses hundreds of failures into a handful of root causes.",
        "risk_if_wrong": "Low: these arrays already failed, so pausing/fixing them costs nothing beyond the fix itself.",
    },
    {
        "id": "wallclock_kill",
        "title": "Wallclock kills",
        "action": "Jobs killed by the scheduler at their time limit — the runtime estimate was wrong. Add checkpointing and/or raise the default time limit for this job class.",
        "if_right": "Recovers GPU-hours currently spent computing work that gets thrown away at the time-limit kill.",
        "risk_if_wrong": "Raising time limits fleet-wide can worsen queue starvation for other jobs; prefer checkpointing over blanket limit increases.",
    },
]


def recommendations(a: Analysis) -> list[dict]:
    j = a.jobs
    out = []
    for d in RECOMMENDATION_DEFS:
        rid = d["id"]
        if rid == "repeat_failure_user":
            users = a.repeat_failure_users
            sub = j[j["id_user"].isin(users["id_user"])]
            failed_sub = sub[sub["state_name"].isin(["FAILED", "OOM"])]
            gpu_hours = failed_sub["gpu_hours"].sum()
            findings = len(users)
            usd = {"low": _usd(gpu_hours * 0.5), "point": _usd(gpu_hours), "high": _usd(gpu_hours * 1.5)}
            confidence = "judgment"
        elif rid == "node_hardware_fault":
            job_ids = set()
            for n in a.bad_nodes:
                job_ids.update(n["affected_job_ids"])
            sub = j[j["id_job"].isin(job_ids)]
            gpu_hours = sub["gpu_hours"].sum()
            findings = len(a.bad_nodes)
            usd = {"low": _usd(gpu_hours), "point": _usd(gpu_hours), "high": _usd(gpu_hours)}
            confidence = "fact"
        elif rid == "array_mass_failure":
            sub = j[j["is_bad_array_job"]]
            gpu_hours = sub["gpu_hours"].sum()
            findings = len(a.bad_arrays)
            usd = {"low": _usd(gpu_hours), "point": _usd(gpu_hours), "high": _usd(gpu_hours)}
            confidence = "fact"
        else:
            sub = j[j["waste_category"] == rid]
            gpu_hours = sub["wasted_gpu_hours"].sum()
            findings = len(sub)
            conf_kind, conf_val = CATEGORY_CONFIDENCE.get(rid, ("judgment", 0.5))
            confidence = conf_kind
            if conf_kind == "fact":
                usd = {"low": _usd(gpu_hours), "point": _usd(gpu_hours), "high": _usd(gpu_hours)}
            else:
                usd = {"low": _usd(gpu_hours * (conf_val - 0.2)), "point": _usd(gpu_hours * conf_val), "high": _usd(gpu_hours)}

        out.append({
            "id": rid,
            "title": d["title"],
            "action": d["action"],
            "if_right": d["if_right"],
            "risk_if_wrong": d["risk_if_wrong"],
            "confidence": confidence,
            "findings": int(findings),
            "affected_jobs": int(len(sub)),
            "gpu_hours": _clean(gpu_hours),
            "savings_usd": usd,
        })
    out.sort(key=lambda r: r["savings_usd"]["point"], reverse=True)
    return out


JOB_COLUMNS = [
    "id_job", "id_user", "state_name", "is_success", "gpu_count", "gpu_hours",
    "gpu_hours_alloc", "sm_util_avg", "mem_used_frac", "watts_avg", "energy_wh",
    "wait_sec", "walltime_sec", "primary_node", "exit_status", "job_type",
    "hit_node_failure", "waste_category", "wasted_gpu_hours",
]


def jobs_table(jobs: pd.DataFrame, limit: int = 200, offset: int = 0) -> dict:
    total = len(jobs)
    page = jobs.iloc[offset: offset + limit][JOB_COLUMNS]
    return {"total": int(total), "limit": limit, "offset": offset, "rows": _records(page)}


def node_triage(a: Analysis) -> list[dict]:
    return a.bad_nodes


def array_triage(a: Analysis) -> dict:
    arr = a.bad_arrays.head(200)
    return {"total_bad_arrays": int(len(a.bad_arrays)), "total_bad_tasks": int(a.bad_arrays["n_tasks"].sum()), "rows": _records(arr)}


def users_view(a: Analysis) -> dict:
    j = a.jobs
    u = j.groupby("id_user").agg(
        total_jobs=("id_job", "count"),
        success_rate=("is_success", "mean"),
        avg_util=("sm_util_avg", "mean"),
        gpu_hours=("gpu_hours", "sum"),
        wasted_gpu_hours=("wasted_gpu_hours", "sum"),
    ).reset_index()
    repeat_ids = set(a.repeat_failure_users["id_user"])

    def profile(r):
        if r["id_user"] in repeat_ids:
            return "repeat-failer"
        if r["wasted_gpu_hours"] > r["gpu_hours"] * 0.5 and r["gpu_hours"] > 10:
            return "over-provisioner"
        return "healthy power user"

    u["profile"] = u.apply(profile, axis=1)
    u = u.sort_values("gpu_hours", ascending=False)
    return {"rows": _records(u)}

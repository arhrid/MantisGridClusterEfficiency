from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import views
from analysis import run_analysis

STATE = {}

MANTISGRID_URL = os.environ.get("MANTISGRID_URL", "http://mantisgrid-api:8000")


def _fetch_mantisgrid_check() -> dict:
    """Cross-check our independently-computed completed-work % against the
    real MantisGrid API's /v1/efficiency/summary, once at startup. Never
    blocks or breaks the app -- the API is a bonus cross-check, not a
    dependency, so any failure just reports itself as unavailable."""
    url = f"{MANTISGRID_URL}/v1/efficiency/summary"
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=3) as resp:
                data = json.loads(resp.read())
            rows = {r["label"]: r for r in data.get("rows", [])}
            their_pct = rows.get("computed_completed", {}).get("share")
            return {
                "available": True,
                "source": url,
                "their_completed_pct": round(their_pct * 100, 2) if their_pct is not None else None,
                "price_book_version": data.get("monetized", {}).get("price_book_version"),
            }
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError):
            if attempt < 2:
                time.sleep(1.5)
    return {"available": False, "source": url}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cache at startup, serve static: load + compute everything once so the
    # dashboard never blocks on a live recompute.
    STATE["analysis"] = run_analysis()
    STATE["mantisgrid_check"] = _fetch_mantisgrid_check()
    yield
    STATE.clear()


app = FastAPI(title="GPU Cluster Efficiency API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_analysis():
    a = STATE.get("analysis")
    if a is None:
        raise HTTPException(503, "Analysis not ready")
    return a


@app.get("/api/summary")
def summary():
    data = views.summary(get_analysis())
    data["mantisgrid_check"] = STATE.get("mantisgrid_check", {"available": False})
    return data


@app.get("/api/waterfall")
def waterfall():
    return views.waterfall(get_analysis())


@app.get("/api/waste-breakdown")
def waste_breakdown():
    return views.waste_breakdown(get_analysis())


@app.get("/api/recommendations")
def recommendations():
    return views.recommendations(get_analysis())


@app.get("/api/recommendations/{rec_id}/jobs")
def recommendation_jobs(rec_id: str, limit: int = Query(200, le=2000), offset: int = 0):
    a = get_analysis()
    j = a.jobs
    if rec_id == "repeat_failure_user":
        sub = j[j["id_user"].isin(a.repeat_failure_users["id_user"]) & j["state_name"].isin(["FAILED", "OOM"])]
    elif rec_id == "node_hardware_fault":
        job_ids = set()
        for n in a.bad_nodes:
            job_ids.update(n["affected_job_ids"])
        sub = j[j["id_job"].isin(job_ids)]
    elif rec_id == "array_mass_failure":
        sub = j[j["is_bad_array_job"]]
    else:
        sub = j[j["waste_category"] == rec_id]
    return views.jobs_table(sub, limit, offset)


@app.get("/api/jobs")
def jobs_by_state(state: str = Query(...), limit: int = Query(200, le=2000), offset: int = 0):
    a = get_analysis()
    j = a.jobs
    state_grouped = j["state_name"].replace({"OOM": "FAILED"})
    sub = j[state_grouped == state]
    return views.jobs_table(sub, limit, offset)


@app.get("/api/jobs/{id_job}")
def job_detail(id_job: int):
    a = get_analysis()
    row = a.jobs[a.jobs["id_job"] == id_job]
    if row.empty:
        raise HTTPException(404, "job not found")
    job = views._records(row[views.JOB_COLUMNS])[0]
    gpus = a.gpus[a.gpus["id_job"] == id_job]
    job["gpu_rows"] = views._records(gpus[["Node", "gpu_id", "sm_util_avg", "smutilization_pct_max", "mem_util_pct_avg", "watts_avg", "energy_joules", "clipped_exec_sec"]])
    return job


@app.get("/api/nodes")
def nodes():
    return views.node_triage(get_analysis())


@app.get("/api/arrays")
def arrays():
    return views.array_triage(get_analysis())


@app.get("/api/users")
def users():
    return views.users_view(get_analysis())


@app.get("/api/users/{id_user}/jobs")
def user_jobs(id_user: int, limit: int = Query(200, le=2000), offset: int = 0):
    a = get_analysis()
    sub = a.jobs[a.jobs["id_user"] == id_user]
    if sub.empty:
        raise HTTPException(404, "user not found")
    return views.jobs_table(sub, limit, offset)

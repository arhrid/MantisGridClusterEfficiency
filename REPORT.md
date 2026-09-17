# GPU Cluster Efficiency — Report

## 1. What we found

Across 74,849 GPU jobs (195 users, ~4.5 months of the MIT HPCA'22 trace), the
cluster burned **592,252 measured GPU-hours** ($1.48M at $2.50/GPU-hour). Only
**100,421 GPU-hours (17.0%)** turned into useful, utilized completed work —
the rest was lost to cancellation, timeout, failure, or completing at ~0%
utilization.

**Estimated recoverable: $269,941 – $782,761** (point estimate **$577,425**,
i.e. 230,970 GPU-hours), if every recommendation below is executed. This is a
deliberately wide, calibrated range — see §4 for why, and `claims.json` for
the full basis.

## 2. How we found it

No MantisGrid API, MCP layer, or prepped parquet files were provided in this
repo initially — only the two raw MIT CSVs (`data/raw/scheduler_data.csv`,
`data/raw/dcgm.csv`). We rebuilt the intended `jobs`/`gpus` tables ourselves in
`backend/analysis.py`, independently of the organizers' own pipeline.

The real MantisGrid facsimile API and the official prep/generate pipeline
have since been added (`api/`, `scripts/`, `bin/`; runs as the
`mantisgrid-api` service on port 8001) and its output verified against
`data/checksums.txt` — 74,849/96,893-row `jobs.parquet`/`gpus.parquet` and
11,979 findings in `data/synthetic/findings.json`. The numbers below are
still computed independently from the raw CSVs, not sourced from that API;
wiring the dashboard's drill-down to the real findings is the next step.

- **Jobs table**: scheduler rows filtered to the 74,849 jobs that have
  matching DCGM telemetry (`id_job` is only a primary key after collapsing
  Slurm requeue chains — the canonical row per job is the one with the latest
  `time_end`; `hit_node_failure` is `True` if *any* attempt in the chain hit
  `NODE_FAIL`, even if a retry later succeeded).
- **GPU-hours**: `dcgm.csv`'s `totalexecutiontime_sec`, clipped to the job's
  walltime (57,552 of 96,893 rows needed clipping), summed per job and
  divided by 3600. This is the "money column" — dollars are priced against
  it, never against `gpu_count × walltime` (allocated-but-unused time).
- **id_array_job** turned out to have one degenerate value (`41161693674`)
  used as a "not part of an array" placeholder for 35,155 unrelated single
  jobs — verified by checking that its `id_array_task` never varies. Every
  other `id_array_job` value is a real array with a genuinely distinct task
  ID per row.
- We validated this whole pipeline against the numbers implied by
  `Project-overview.md` itself before trusting it: our outcome-share
  percentages (38.6% / 34.3% / 18.2% / 8.4% / 0.3%), our wallclock-kill count
  (1,544 — exact match), and our top flagged node (`r7317916-n172107`, 90.7%
  burst failure rate, 146 hardware-attributable failures, 14.8% baseline
  failure rate for the same users elsewhere) all landed within rounding of
  the spec's own reference figures, which gave us confidence the derivation
  logic is correct.

The backend (`backend/`) computes all of this once at startup (FastAPI,
cached in memory) and serves it as JSON; the React dashboard (`frontend/`)
never recomputes anything client-side.

## 3. Where to cut

Ranked by dollar savings (not severity) in the SRE tab:

| Recommendation | Findings | Savings (range) | Confidence |
|---|---|---|---|
| Wallclock kills | 1,544 jobs | $269.9K | Fact |
| Slow cancellation of idle jobs | 3,050 jobs | $178.9K – $447.2K | Judgment |
| Repeat-failure users | 31 users | $34K – $102K | Judgment |
| GPU not needed | 4,817 jobs | $13.8K – $30.7K | Judgment |
| Idle interactive sessions | 1,583 jobs | $12.2K – $34.9K | Judgment |
| Array mass failures | 420 arrays / 6,666 tasks | $5.1K | Fact |
| Bad node(s): hardware fault | 7 nodes / 1,001 jobs | $83.8K | Fact |
| Never-computed failures | 1,136 jobs | $0 (engineering hygiene) | Fact |

Each row is a specific, actionable policy, not "improve utilization" — see
the dashboard for the exact action and the evidence behind it (click any row
to drill into affected jobs, then any job for its raw DCGM telemetry).

The clearest single finding: node **r7317916-n172107** failed 90.7% of jobs
in a 48-hour burst (146/161 jobs, 10 users, 99% sharing exit code 1), while
those same 10 users fail only 14.8% of the time everywhere else — a 6.1x
jump that is very hard to explain as anything other than a hardware fault.
Drain it.

## 4. What breaks if we're wrong

The single biggest judgment call in this report is **CANCELLED jobs are not
counted as waste** (203,054 GPU-hours, 34.3% of all compute, $507,636) —
except for the subset held 4+ hours before cancellation, which *is* counted.
If cancellations are actually deliberate, disciplined behavior (kill fast,
resubmit fast), our estimate is close to right. If a large share of "quick"
cancellations are actually abandoned/forgotten work we didn't catch with the
4-hour threshold, the true recoverable number is higher than our $782,761
ceiling. We chose not to guess further in that direction because doing so
risks framing normal research iteration as employee waste — see
`claims.json`'s `cancelled_rationale`.

Other risks, one line each (full table in the Risk tab):

- **Draining r7317916-n172107** — if wrong, loses that node's capacity for
  nothing; the same-user-baseline comparison (14.8% vs. 90.7%) is the
  safeguard against a false positive.
- **Auto-killing idle interactive sessions** — a researcher mid-thought loses
  an unsaved session; mitigated with a warning before the kill.
- **Moving zero-utilization completions to a CPU queue** — breaks any job
  that touches the GPU only briefly for init/teardown.
- **Repeat-failure user list** — framed as a support offer, not a blame
  list; users are hashed throughout the dashboard.

## 5. What we'd do with more time

- Wire up a real MantisGrid-compatible API and the MCP chat layer the spec
  describes, so a CFO could ask the dashboard a question directly instead of
  only clicking through tiles (explicitly deferred per project scoping —
  the dashboard drilldown was prioritized first).
- Tighten the array-mass-failure detector: right now it's a straight
  `id_array_job` group-by after removing the one known placeholder value;
  a submit-time-proximity check would catch any other hashing collisions we
  haven't found.
- Model `wait_sec` (queue latency) as its own developer-facing cost —
  right now the dashboard only prices GPU-dollars, not engineer time lost
  waiting in queue.
- Push the "repeat-failure user" list toward specific failure signatures
  (same exit code / same script pattern) rather than a raw failure-rate
  threshold, to distinguish "needs training" from "works on a genuinely hard,
  failure-prone workload."

## 6. AI disclosure

Built end-to-end with Claude Code (Sonnet 5): the data pipeline
(`backend/analysis.py`), the API (`backend/views.py`, `backend/app.py`), and
the React dashboard (`frontend/`) were AI-generated from the raw CSVs and
`Project-overview.md`, under direct review for methodology — waste-category
priority order, the dollar-basis decision (measured vs. allocated GPU-hours),
and the node/array/user detection thresholds were checked against the
spec's own reference numbers before being trusted, as described in §2.

# GPU Cluster Efficiency Dashboard — Build Spec

Hand this file to Claude Code. It contains everything needed to build the Track 2 submission.

## What this is

A dashboard that answers: "The CFO has been told to cut GPU spend 20%. Where should she cut, and what breaks if she's wrong?" It serves on `:3000` via `docker compose up`, reads from a local MantisGrid API on `:8000`, and ships with `claims.json` and `REPORT.md`.

## Deadline

September 17, 2026, 3:00pm PDT. Whatever is on the default branch at that moment gets judged.

---

## Data

You do NOT commit data. Judges regenerate it themselves.

```
data/raw/           two CSVs downloaded from MIT (scheduler_data.csv, dcgm.csv)
data/prepped/       jobs.parquet (74,849 rows x 65 cols), gpus.parquet (96,893 rows x 33 cols)
data/synthetic/     resources.parquet, edges.parquet, findings.json (11,979 findings)
```

### Key columns in jobs.parquet

| Column | What it is | Watch out |
|---|---|---|
| `id_job` | primary key | |
| `id_user` | hashed, 195 distinct | never show as a name, frame as capacity not blame |
| `state_name` | COMPLETED, CANCELLED, FAILED, TIMEOUT, NODE_FAIL, etc | |
| `is_success` | True if COMPLETED | |
| `gpu_count` | GPUs held, 1-64 | |
| `gpu_hours` | **measured** DCGM execution time, the money column | NOT gpu_count × walltime |
| `gpu_hours_alloc` | gpu_count × walltime, for comparison only | |
| `sm_util_avg` | 0-100 percent | the "is it working" signal |
| `mem_used_frac` | 0-1 fraction | different scale from sm_util |
| `watts_avg` | power | |
| `energy_wh` | avg watts × duration | do NOT use energyconsumed_joules |
| `wait_sec` | queue wait in seconds | |
| `walltime_sec` | wall-clock runtime | |
| `primary_node` | **first node only** — do NOT use for per-node analysis | use gpus.parquet instead |
| `exit_code` | packed: exit_status = exit_code // 256 | |
| `mem_req_mb` | decoded memory request | do NOT use raw mem_req (has bit flag) |
| `job_type` | 4 values | |
| `hit_node_failure` | True if any attempt hit a node failure | better than filtering state_name==NODE_FAIL |

### Key columns in gpus.parquet

One row per physical GPU per job. Key is `(Node, gpu_id, id_job)`.

Use this for per-node attribution and gpu-imbalance detection. `gpu_hours` here is per-GPU — use `.sum()` per job, never `.first()`.

**Clip `totalexecutiontime_sec` to the job's `walltime_sec`** — 66 rows report more runtime than their job had.

---

## API (runs on localhost:8000)

### Layer A — real MantisGrid API

```
POST /v1/events/findings          list findings (paginated, ~24 requests for all)
POST /v1/causal                   root-cause analysis for one finding
POST /v1/neighbor                 resource graph, N hops
GET  /v1/policies/rules           every armed rule with counts
```

### Layer B — proposed business layer

Every response tagged `kind: "fact"` or `kind: "judgment"` with `confidence` and `provenance.caveat`.

```
GET  /v1/efficiency/summary       allocated → computed → completed waterfall
GET  /v1/waste/breakdown          GPU-hours by job outcome
GET  /v1/queue/latency            developer wait time
GET  /v1/scaling/efficiency       utilization vs job width
GET  /v1/resources/underperforming    ranked nodes with evidence
GET  /v1/recommendations          actions with estimated savings and finding_ids
GET  /v1/price-book               $2.50/GPU-hour, $0.15/kWh, $95/engineer-hour
```

### Python client (already provided)

```python
from mgai_client import MGAI
mg = MGAI()
mg.efficiency_summary()
mg.rows(mg.waste_breakdown())
mg.findings_df(detector_id="rules::gpu-imbalance")
mg.causal(finding_id)
```

---

## Architecture

```
┌─────────────────┐    ┌──────────────────┐
│ jobs.parquet     │    │ MantisGrid API   │
│ gpus.parquet     │    │ localhost:8000   │
└────────┬────────┘    └────────┬─────────┘
         │                      │
         └──────────┬───────────┘
                    │
         ┌──────────▼──────────┐
         │   Startup cache     │
         │  (one-time load)    │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │  Business layer     │
         │  dollarize, rank,   │
         │  dedupe, confidence │
         └──────────┬──────────┘
                    │
    ┌───────────────┼───────────────┐
    │               │               │
┌───▼───┐     ┌────▼────┐    ┌────▼────┐
│Tile 1 │     │ Tile 2  │    │ Tile 3  │
│Money  │     │ Cut     │    │ Risk    │
└───────┘     └─────────┘    └─────────┘
```

**Cache at startup, serve static.** The dashboard does NOT make live API calls on page load. Pull everything once when the container starts, precompute the views, serve from memory. This avoids rate limits and makes the demo instant.

---

## Dashboard features

### Header bar

Four summary cards across the top (like the NVIDIA Fleet Intelligence dashboard):

| Card | Value | Source |
|---|---|---|
| Total GPU-hours | 594,004 | efficiency summary |
| Completed work | 100,789 GPU-h (17%) | efficiency summary |
| Estimated recoverable | $X–$Y (range) | your deduped computation |
| Active findings | count of isActive findings | findings endpoint |

### Tab 1: CFO view — "Where is the money going?"

**Waterfall chart** (the hero): allocated → computed → completed, in dollars at $2.50/GPU-hour. Each drop-off segment is labeled: idle/unused, failed, cancelled, timeout. This is Tile 1.

Below it: **outcome breakdown table** from `/v1/waste/breakdown`:

| Outcome | GPU-hours | Dollars | Share |
|---|---|---|---|
| COMPLETED | 229,041 | $572,603 | 38.6% |
| CANCELLED | 203,930 | $509,825 | 34.3% |
| TIMEOUT | 107,952 | $269,880 | 18.2% |
| FAILED | 50,033 | $125,083 | 8.4% |
| NODE_FAIL | 2,028 | $5,070 | 0.3% |

Include a visible label on CANCELLED: "Treated as [waste / not waste] — [one-line rationale]". This is a judged decision.

### Tab 2: SRE view — "Where to cut, and what to drill into"

**Ranked recommendation table** — Tile 2. Each row is a specific, actionable recommendation with:

| Column | Content |
|---|---|
| Recommendation | Plain-English action, not "improve utilization" |
| Savings (range) | $low – $high, from deduped findings × price book |
| Confidence | fact / judgment tag from the API |
| Risk if wrong | One sentence — Tile 3 |
| Findings | Count, clickable to expand |

**Rows to include** (derived from real data analysis):

1. **Idle interactive sessions** — 906 sessions, most never computed. Policy fix: auto-kill after 4 hours.
2. **GPU not needed** — 463 jobs completed at exactly 0% GPU utilization. Move to CPU queue.
3. **Never-computed failures** — 1,459 jobs that crashed before touching the GPU. Broken scripts, not infra.
4. **Slow cancellation of idle jobs** — 949 jobs held GPUs for 4+ hours before user cancelled. Notification policy.
5. **Repeat-failure users** — 36 users failing across 8+ weeks. Support/training intervention.
6. **Bad node: r7317916-n172107** — 90.7% failure rate in a 48h burst, 12 users affected, same exit code. Hardware fault. Drain it.
7. **Array mass failures** — 149 arrays with >90% task failure. One fix per array, not one per task.
8. **Wallclock kills** — 1,544 jobs killed by the scheduler at their time limit. Underestimated runtimes.

**Click-through**: each row expands to show:
- The finding IDs (from `finding_ids` in recommendations, or your own grouping)
- Affected jobs table: id_job, user (hashed), node, gpu_hours, sm_util_avg, state, exit_status
- For node issues: the baseline comparison (this node's fail rate vs same users elsewhere)

### Tab 3: Risk & evidence — "What it costs if you're wrong"

This can be a dedicated tab or a column in tab 2's table. For each recommendation:

| Recommendation | If we're right | If we're wrong |
|---|---|---|
| Drain bad node | Save 12 users' work, ~146 jobs/burst | Lose 2 V100s capacity for nothing |
| Treat CANCELLED as waste | $510K recoverable | Overstate by ~2× if cancellations were deliberate |
| Auto-kill idle sessions | Recover ~X GPU-hours | Researcher loses unsaved work (mitigate: warn first) |
| Move zero-compute to CPU | Free GPU slots | If any jobs need GPU for brief init, they break on CPU |

### Drilldown panels (click-through from any dollar figure)

The path judges will test: **dollar figure → recommendation → findings → jobs → raw telemetry**.

When a row is clicked, show a detail panel with:
- The specific finding objects (short description, impact_gpu_hours, impact_kind, confidence)
- A mini table of the top affected jobs with their key metrics
- For node-scoped findings: a small bar chart comparing this node's failure rate to the cluster baseline

### Bonus: User efficiency view

A table of users ranked by GPU-hours consumed, showing:
- Total GPU-hours
- Success rate
- Average utilization
- Jobs count
- Waste category (over-provisioner / repeat-failer / healthy power user)

Frame as "capacity by researcher profile" not "blame leaderboard". Clicking a user filters all three tiles to their jobs only.

### Bonus: Chat agent (build last, only if time)

A panel that connects to the MCP server (`make mcp`). User types a question, agent calls MCP tools, returns an answer with finding references. Use the Anthropic API with `mcp_servers` parameter pointed at the local MCP server URL from `mcp_layer/README.md`.

---

## Tech stack (suggested, use whatever ships fastest)

```
Frontend:   React or plain HTML + Chart.js/Recharts
Backend:    Python (FastAPI or Flask), reads parquet + calls localhost:8000 at startup
Container:  Dockerfile for the dashboard, uses the existing api service from docker-compose.yml
Port:       :3000
```

The repo already has a `docker-compose.yml` with the `api` service. Add your dashboard as a second service:

```yaml
services:
  api:
    # ... existing, reads data/
  dashboard:
    build: ./dashboard
    ports:
      - "3000:3000"
    depends_on:
      - api
    environment:
      - MGAI_URL=http://api:8000
```

---

## Critical traps to code around

1. **Do NOT sum `impact_gpu_hours` across findings naively.** 18% of jobs carry more than one finding. Deduplicate by `id_job` before totaling. The naive sum is 931,607 GPU-hours — 157% of the cluster. Your total must be ≤ 594,004.

2. **Do NOT sort by severity and call it cost.** Severity is not dollars. A $1,230 finding can be LOW severity. Rank by `impact_gpu_hours × price_book`.

3. **Do NOT use `primary_node` for per-node analysis.** It's only the first node. 1,472 multi-node jobs carry 27.8% of GPU-hours. Use `gpus.parquet` grouped by `Node`.

4. **Do NOT mix `impact_scope`.** A user-scope finding covers four months and overlaps every job-scope finding beneath it. Adding across scopes produces a number that exceeds the cluster.

5. **Do NOT mix `impact_kind`.** Lost (destroyed), consumed (finished wastefully), unused_capacity (held but idle), degraded (finished slowly) — these are different quantities.

6. **Five rules carry NO `impact_gpu_hours`** — queue-starvation, queue-wait-p95-slo, queue-weekly-peak, timelimit-overreservation, node-elevated-failure-rate. Don't put them in a GPU-hour total.

7. **CANCELLED is ambiguous.** 203,930 GPU-hours. Take a stance, defend it, show it labeled on the dashboard.

8. **Users are hashed.** Frame everything as recoverable capacity. A dashboard that ranks employees by waste scores lower than one that frames the same data as opportunity.

9. **Row-weighted ≠ hour-weighted.** A third of job records account for 0.012% of compute. Weight by GPU-hours for money questions, not by job count.

---

## claims.json

Machine-readable numbers file. Schema is in `starter/claims.schema.json`. Key fields:

```json
{
  "team": "your team name",

  "recoverable_gpu_hours": {
    "point": 61200, "low": 38000, "high": 84000, "confidence": 0.6,
    "basis": "Your methodology in one paragraph"
  },
  "recoverable_usd": { "point": 153000, "low": 95000, "high": 210000 },

  "cancelled_is_waste": false,
  "cancelled_rationale": "Why, in one paragraph",

  "node_triage": [
    {
      "node": "r7317916-n172107",
      "window": 0,
      "cause": "hardware",
      "reasoning": "90.7% failure rate in 48h burst, 12 distinct users, same exit code. Same users fail 14.8% elsewhere.",
      "verdict": "drain"
    }
  ],

  "hardware_attributable_failures": 146,
  "hardware_attributable_rationale": "Jobs in the burst window on r7317916-n172107 where same-exit-code concentration across multiple users rules out user code.",

  "incident_root_cause": "pvc/scratch-lustre-02",
  "incident_action_scope": "single_resource",
  "incident_confidence": 0.8
}
```

**Give ranges, not just points.** `low` and `high` are where calibration is scored. Leave out fields you didn't investigate — omitted costs nothing, confidently wrong costs a lot.

---

## REPORT.md

Short writeup. Structure:

1. **What we found** — the headline number with its range and basis
2. **How we found it** — methodology: which API endpoints, which parquet queries, how we deduped
3. **Where to cut** — the ranked list from tile 2, each with its evidence
4. **What breaks if we're wrong** — tile 3 content
5. **What we'd do with more time** — original insight ideas
6. **AI disclosure** — which models, frameworks, what was AI-generated vs team-written

---

## Validation before submit

```bash
make validate CLAIMS=claims.json
make validate CLAIMS=claims.json URL=http://localhost:3000
```

Then the real test: clone into a fresh folder, generate data/, run `docker compose up`, open `:3000`. If it doesn't come up unattended, it can't be judged.

---

## What judges score

| Criterion | What they look for |
|---|---|
| Actionability | Does a non-engineer know what to DO after 30 seconds? |
| Cost of being wrong | The tile most teams skip. Calibration matters. |
| Evidence drill-down | Click from a dollar figure to the raw data behind it |
| Business framing | Every number in dollars, hours, or % of capacity |
| Use of MantisGrid API + MCP | Built on their findings and causal analysis, not reimplemented |
| Original insight | Something they didn't think to ask for |
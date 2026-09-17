# Fleet Intelligence — GPU Cluster Efficiency Dashboard

Answers: *"The CFO has been told to cut GPU spend 20%. Where should she cut,
and what breaks if she's wrong?"*

See `Project-overview.md` for the original build spec and `REPORT.md` for the
findings writeup. `claims.json` has the machine-readable numbers. Earlier
team planning docs are preserved in `docs/` (`original-planning-README.md`,
`mantisgrid-hackathon-implementation-plan.md`,
`mantisgrid-track2-cluster-efficiency-por.md`,
`mantisgrid-codex-hackathon-guidelines.md`).

## AI disclosure

Built with **Claude Code** (Sonnet 5), used as a coding agent for the full
stack: the data pipeline and waste-category analysis (`backend/analysis.py`),
the FastAPI backend (`backend/views.py`, `backend/app.py`), the React
dashboard (`frontend/`), and integrating the organizers' MantisGrid facsimile
API (`api/`, from `github.com/MantisGridAI/hackathon-2026-official`) as a
running service, including the cross-check between our independently-derived
numbers and its `/v1/efficiency/summary` endpoint. No other AI models or
agent frameworks were used. All methodology decisions (waste-category
priority order, dollar-basis choices, node/array/user detection thresholds,
the `CANCELLED`-is-not-waste stance) were directed and reviewed by the team,
not left to the model's default judgment — see `claims.json`'s `*_rationale`
fields and `REPORT.md` for the reasoning behind each one.

## Run it

### Docker (recommended)

```bash
docker compose up --build
```

Then open http://localhost:3000. The `api` service (FastAPI, port 8000)
loads `data/raw/scheduler_data.csv` and `data/raw/dcgm.csv` once at startup
and serves everything from memory; the `dashboard` service (React, built and
served via nginx on port 3000) proxies `/api/*` to it. A third service,
`mantisgrid-api` (port 8001), runs the real MantisGrid facsimile API (Layer A
findings/causal/neighbor/rules, Layer B efficiency/waste/recommendations)
against the checksummed `data/prepped/` and `data/synthetic/` tables — see
`data/README.md`. It runs alongside the dashboard's own backend rather than
replacing it; the dashboard's numbers are computed independently from the raw
CSVs, not sourced from it yet.

Verified end-to-end with `docker compose up --build` — all three services
come up clean (`:3000` → 200, `:8000/api/summary` → real numbers,
`:8001/health` → `{"status":"ok","findings":11979,"resources":77399}`).

To regenerate the checksummed data yourself: `docker compose run --rm prep`
then `docker compose run --rm generate` (see `data/README.md`).

### Manual dev mode

```bash
# backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000

# frontend (separate terminal)
cd frontend
npm install
npm run dev   # http://localhost:3000, proxies /api to :8000
```

## Layout

```
data/raw/           raw MIT HPCA'22 CSVs (scheduler_data.csv, dcgm.csv)
data/prepped/       jobs.parquet, gpus.parquet (from `prep`, checksummed)
data/synthetic/     findings.json, resources.parquet, edges.parquet (from
                    `generate`, checksummed)
backend/
  analysis.py       loads the CSVs, derives the jobs/gpus tables, runs
                    node/array/user/waste-category detection
  views.py          shapes Analysis -> JSON (summary, waterfall, waste
                    breakdown, recommendations, node/array/user triage)
  app.py            FastAPI routes, computed once at startup and cached
frontend/
  src/views/        CFOView, SREView, RiskView, UsersView (one per tab)
  src/components/   StatCard, DrilldownPanel, JobsTable, JobDetail, charts/
api/                the real MantisGrid facsimile API (port 8001 here)
scripts/            prep_data.py, checksum_data.py
bin/                the `generate` binaries (Linux amd64/arm64)
starter/            organizers' notebook + mgai_client.py
mcp_layer/          MCP server over the MantisGrid API (not wired up yet)
claims.json         machine-readable numbers (recoverable range, node
                    triage, cancelled-is-waste stance)
REPORT.md           findings writeup
```

## What's not built (out of scope for this pass)

The real MantisGrid API (`api/`, port 8001) and its verified data
(`data/prepped/`, `data/synthetic/findings.json`) are now present and
checksummed against `data/checksums.txt`, but the dashboard itself still
computes its numbers independently from the raw CSVs rather than sourcing
them from that API or from `findings.json`. Wiring the dashboard's
recommendations/drill-down to the real findings, and the MCP layer
(`mcp_layer/`), were out of scope for this pass (dashboard drilldown first,
chatbot/API-sourced findings later, per project decision).

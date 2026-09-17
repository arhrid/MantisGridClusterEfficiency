# MantisGrid Cluster Efficiency

Barebones project repository for the MantisGrid Hackathon Track 2: Cluster Efficiency.

## Goal

Build an interactive cluster-efficiency dashboard that helps operators understand cluster behavior, identify inefficiencies, and connect telemetry signals to operational and business impact.

The project is currently in planning mode because the hackathon dataset, API details, and final access instructions are not available yet.

## Expected Inputs

- Cluster telemetry from one large cluster
- MantisGrid insights for performance, uptime, and cost
- Metrics, events, workload metadata, node metadata, and accelerator metadata where available
- Cost data or cost estimates where available

## Planned Shape

- Python analytics backend
- Direct MantisGrid API client as the default data path
- Optional MCP adapter if final instructions require or favor it
- DuckDB or Polars for local caching and derived analytics
- Streamlit dashboard for local interactive exploration
- Docker-based local runtime

## Initial Dashboard Areas

- Overview
- Utilization
- Performance
- Reliability and uptime
- Cost
- Findings and recommendations

## Current Status

- Repository initialized
- Planning documents are in `docs/`
- Dataset and API access are pending
- Implementation has not started

## Next Steps

1. Confirm final hackathon instructions, dataset format, API access, credentials, and judging criteria.
2. Add a minimal Dockerized Python project skeleton.
3. Implement a file-backed or API-backed data ingestion stub.
4. Build the first deterministic dashboard views.
5. Add named efficiency findings and recommendations.

## Docs

- `docs/mantisgrid-track2-cluster-efficiency-por.md`
- `docs/mantisgrid-hackathon-implementation-plan.md`
- `docs/mantisgrid-codex-hackathon-guidelines.md`

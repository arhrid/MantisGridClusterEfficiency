# MantisGrid Cluster Efficiency

Barebones project repository for the MantisGrid Hackathon Track 2: GPU Cluster Efficiency.

## Goal

Build an interactive GPU cluster-efficiency dashboard that helps operators understand cluster behavior, identify inefficiencies, and connect telemetry signals to operational and business impact.

The project is currently in planning mode. The challenge slide describes the dataset and MCP/API surface, but the dataset, credentials, and final access instructions are not present in this checkout yet.

## Expected Inputs

- Four months of real GPU cluster data
- 74,849 jobs, 195 users, and 594,000 GPU-hours
- Per-job GPUs, utilization, memory, power, queue, and outcome data
- MantisGrid AI API output with 24 rules, 11,979 findings, and root-cause analysis
- MantisGrid AI MCP server exposing the API as agent tools
- Metrics, events, workload metadata, node metadata, and accelerator metadata where available
- Cost data or cost estimates where available
- Business-layer records labeled as fact or judgment

## Planned Shape

- Python analytics backend
- One-command local dashboard startup
- MCP-backed chatbot or agent for exploratory analysis
- Direct MantisGrid API client if final instructions allow it
- DuckDB or Polars for local caching and derived analytics
- Streamlit dashboard for local interactive exploration
- Local Python runtime, with Docker packaging only if final instructions require it

## Initial Dashboard Areas

- Overview
- Utilization
- Performance
- Reliability and uptime
- Cost
- Business layer
- Findings and recommendations

## Deliverables

- Dashboard that comes up with one command
- Fixed-format headline numbers with ranges, not single-point guesses
- Short report explaining what was found and how
- Drilldown from dollar figures to supporting data
- Confidence labels for claims and recommendations

## Current Status

- Repository initialized
- Planning documents are in `docs/`
- Dataset, credentials, MCP server access, and API access are pending in this checkout
- Implementation has not started

## Next Steps

1. Confirm final hackathon instructions, dataset format, MCP/API access, credentials, and judging criteria.
2. Add a minimal local Python project skeleton.
3. Implement a file-backed, MCP-backed, or API-backed data ingestion stub.
4. Build the first deterministic dashboard views.
5. Add fixed-format headline numbers, confidence ranges, and business-layer labels.
6. Add named efficiency findings and recommendations.

## Docs

- `docs/mantisgrid-track2-cluster-efficiency-por.md`
- `docs/mantisgrid-hackathon-implementation-plan.md`
- `docs/mantisgrid-codex-hackathon-guidelines.md`

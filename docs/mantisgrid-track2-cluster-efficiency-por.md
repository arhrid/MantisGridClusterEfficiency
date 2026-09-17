# MantisGrid Hackathon Track 2: Cluster Efficiency POR

## Purpose

This document captures the current Plan of Record (POR) for MantisGrid Hackathon Track 2: Cluster Efficiency. It separates confirmed hackathon facts from proposed implementation choices and gives a practical build/tuning plan for the hackathon.

Track 2 should be treated as a cluster-behavior and business-impact problem: use telemetry and MantisGrid insights to help users understand cluster performance, uptime, utilization, and cost inefficiencies.

## Confirmed Hackathon Facts

Based on the event materials and discussion so far:

- Track 2 is GPU Cluster Efficiency.
- Participants receive four months of telemetry from a real GPU cluster.
- The dataset covers 74,849 jobs, 195 users, and 594,000 GPU-hours.
- Participants receive per-job data covering GPUs, utilization, memory, power, queue, and outcome.
- Participants receive MantisGrid AI API access with 24 rules, 11,979 findings, and root-cause analysis.
- Participants receive a business layer whose entries should be labeled as fact or judgment.
- The MantisGrid AI MCP server exposes the whole API as agent tools.
- The challenge is to find the 20% of waste or inefficiency the CFO has been asked to cut.
- The challenge is to build an interactive dashboard that shows cluster behavior and identifies inefficiencies.
- The expected deliverables are a dashboard that comes up with one command, a chatbot or agent using MCP tools, headline numbers in a fixed format with ranges rather than single guesses, and a short report explaining what was found and how.
- This track is more oriented toward data analysis, visualization, and translating infrastructure signals into business outcomes.
- The track emphasis is data storytelling.

## Additional Working Information

Based on discussion so far:

- MantisGrid APIs are expected to be available for accessing hackathon data or insights.
- MCP support is expected for agent/chatbot access, but the current plan is to run the project locally without Docker.
- Direct MantisGrid API calls may also be possible.
- The challenge slide explicitly asks teams to build a chatbot or agent using MCP tools, so MCP should be treated as a first-class integration path for Track 2.
- Direct API access can remain useful for deterministic ingestion and caching if final instructions allow it.

These details should be confirmed against final event instructions, especially the API surface, authentication model, rate limits, and whether MCP is required, optional, or mainly provided as a convenience layer.

## Slide-Captured Requirements

The Track 2 challenge slide adds the following concrete deliverables and success signals:

- Create a dashboard that comes up with one command.
- Build a chatbot or agent using the MCP tools.
- Report headline numbers in a fixed format.
- Give ranges rather than single-point guesses.
- Produce a short report explaining what was found and how.
- Make the result actionable in 30 seconds for someone who is not an engineer.
- Support drilldown from a dollar figure to the data behind it.
- Say how sure the system is about each claim.
- Be creative while staying evidence-backed.
- Focus on data storytelling.

## Product Signals From MantisGrid

MantisGrid publicly frames its platform around autonomous reliability for AI infrastructure and workloads across cloud, edge, GPUs, and accelerators.

Useful public signals for Track 2:

- The product emphasizes uptime, performance, utilization, and cost efficiency.
- MantisGrid describes a unified view of AI fleets and infrastructure.
- The platform collects logs, telemetry, and configuration data to build a real-time graph of infrastructure.
- The website frames business intent around uptime, performance, and cost.
- Public materials discuss GPU utilization, over-provisioning, latency spikes, noisy alerts, training/inference reliability, node degradation, and cost control.
- The dashboard should avoid being a generic chart wall. It should surface where the cluster is inefficient, why it matters, and what action could improve it.

Useful public references:

- https://mantisgrid.ai/
- https://mantisgrid.ai/blog/k8s-reliability-for-ai
- https://www.mantisgrid.ai/blog/DesignpartnershipRockfishdata
- https://mantisgrid.ai/blog/ai-sre-sunglasses

## Core Thesis

Track 2 is the "top layer" counterpart to Track 1:

- Track 1 asks: "What caused this incident?"
- Track 2 asks: "How is this cluster behaving, where is it inefficient, and what should the operator care about?"

The strongest solution shape is:

**GPU job telemetry -> derived analytics -> business-layer claims -> named efficiency findings -> evidence-backed recommendations -> one-command dashboard -> MCP-powered insight workspace**

The infrastructure should stay simple and local:

**Mac laptop -> local Python analytics backend -> direct MantisGrid APIs and/or local cache -> Streamlit dashboard**

The dashboard should help a user quickly understand:

- Current or historical cluster health.
- Utilization patterns.
- Performance bottlenecks.
- Uptime or reliability risks.
- Cost inefficiencies.
- Which cuts plausibly contribute to the target 20% reduction.
- The estimated 20% savings opportunity, expressed as a range with confidence.
- Which workloads, nodes, jobs, GPUs, or resources deserve attention.
- What business impact the inefficiency creates, with facts and judgments clearly labeled.
- What action should be taken next.
- Which claims are facts, which are judgments, and how confident the system is.
- How to drill down from a dollar figure to the underlying data.

## Architecture Summary

```text
Mac laptop host
  |
  +-- Local Python runtime
        |
        +-- Python analytics backend
        |     |
        |     +-- MantisGrid MCP tool adapter
        |     +-- Direct MantisGrid API client if allowed
        |     +-- Derived analytics layer
        |     +-- Finding and recommendation engine
        |     +-- Dynamic dashboard spec validator
        |     +-- Optional LLM interface
        |
        +-- Local analytics store
        |     |
        |     +-- DuckDB or Polars
        |     +-- Cached metrics, events, costs, workloads, nodes
        |
        +-- Streamlit dashboard on localhost
              |
              +-- Overview
              +-- Utilization
              +-- Performance
              +-- Reliability
              +-- Cost
              +-- Findings
```

The Python backend should own data retrieval, caching, derived tables, finding generation, scoring, and dashboard-ready summaries. The dashboard should be a thin interactive surface over this analysis layer.

Dynamic dashboarding should use structured specs rather than free-form generated UI code. The LLM can propose a dashboard or view spec, but the backend validates the spec, executes approved data operations, and the GUI renders only supported view types.

Track 2 has three distinct intelligence layers:

1. Deterministic baseline dashboard:
   - Prebuilt views, derived metrics, rules, findings, and recommendations.
   - Useful even without an LLM.

2. LLM-guided dynamic dashboarding:
   - User asks a natural-language question.
   - LLM maps the question into a structured dashboard or view spec.
   - Backend validates, executes through MCP or direct API/local cache, and renders the result.

3. LLM-assisted inefficiency discovery:
   - System proactively asks what inefficiencies exist in the cluster data.
   - LLM reviews bounded summaries or slices.
   - LLM proposes candidate inefficiencies.
   - Backend validates candidates with data queries.
   - Validated findings are ranked and shown in the dashboard.

Dynamic dashboarding is about custom views from human intent. Inefficiency discovery is about proactively finding issues in the data. They are orthogonal and should use separate structured contracts.

## Runtime Environment

Use the same basic runtime shape as Track 1:

- Mac laptop as host.
- Local Python runtime.
- Python implementation.
- MCP tool access as a first-class data and agent-tool path.
- Direct MantisGrid API client as a useful secondary path if allowed by final instructions.
- DuckDB or Polars for local data shaping and repeated analysis.
- Streamlit for the interactive dashboard.

Rationale:

- Keeps both tracks on a shared local stack.
- Reduces setup overhead during the hackathon.
- Lets the team reuse data access, caching, schemas, and UI patterns.
- Avoids cloud deployment or Kubernetes setup as first-order work.

## Data and API Layer

Expected inputs:

- Metrics.
- Logs or events.
- Workload/job metadata.
- Node and cluster metadata.
- GPU or accelerator metadata, if available.
- Per-job GPUs, utilization, memory, power, queue, and outcome fields.
- Cost data or cost estimates.
- MantisGrid AI API output covering 24 rules, 11,979 findings, and root-cause analysis.
- Business-layer records labeled as fact or judgment.
- Topology, ownership, namespace, team, service, node pool, or region dimensions if available.

Implementation approach:

- Build an MCP adapter for MantisGrid API-backed agent tools.
- Build a direct Python client for the MantisGrid APIs if final instructions allow it.
- Cache API responses into DuckDB or Polars where useful.
- Keep raw data access behind typed helper functions.
- Build derived tables for dashboard views.
- Keep MCP and direct API access behind shared data/query interfaces where practical.

Potential derived tables:

- `cluster_summary`
- `node_utilization`
- `workload_utilization`
- `gpu_utilization`
- `cost_by_workload`
- `cost_by_node_pool`
- `anomaly_timeline`
- `job_efficiency`
- `capacity_waste`
- `performance_bottlenecks`
- `reliability_risks`
- `efficiency_findings`
- `recommendations`

## Insight and Finding Model

Track 2 should produce named findings, not just charts.

Suggested finding schema:

```text
finding_id:
title:
category:
affected_entities:
time_window:
evidence:
business_impact:
technical_impact:
estimated_severity:
estimated_savings_or_risk_reduction:
recommended_action:
confidence:
confidence_range:
status:
fact_or_judgment:
```

Core finding categories:

- Underutilization.
- Overutilization.
- Resource imbalance.
- Performance bottleneck.
- Reliability risk.
- Cost inefficiency.
- Failed or wasteful workload.
- Capacity planning issue.
- Noisy or unstable node.
- GPU or accelerator inefficiency.

The dashboard should rank findings by a combined view of severity, confidence, and business impact.

## Core Dashboard Views

### Overview

Purpose: give a one-screen answer to "what is happening in this cluster?"

Possible elements:

- Cluster health score.
- Efficiency score.
- Uptime or availability score.
- Performance risk score.
- Estimated wasted spend or avoidable cost.
- Estimated contribution toward the 20% CFO cut target.
- Top 3 inefficiencies.
- Top 3 recommended actions.
- Recent anomaly or incident timeline.
- Confidence ranges for headline numbers.

### Utilization

Purpose: identify underused, overused, or imbalanced resources.

Possible views:

- GPU utilization by node, workload, job, or time window.
- CPU, memory, storage, and network utilization.
- Idle or stranded capacity.
- Hotspot nodes.
- Imbalanced workloads.
- Resource request vs actual usage if available.
- Node pool or namespace-level utilization.

### Performance

Purpose: identify bottlenecks affecting workload throughput or latency.

Possible views:

- Latency trends.
- Throughput trends.
- Queueing or scheduling delay.
- Job duration and restart patterns.
- Network bottlenecks.
- Storage or I/O bottlenecks.
- Performance regressions by time window.

### Reliability and Uptime

Purpose: show cluster stability and risk.

Possible views:

- Incident or anomaly timeline.
- Node health.
- Workload restarts.
- Failed jobs or pods.
- Error-rate trends.
- Degraded components.
- Risky dependency paths if available.

### Cost

Purpose: translate telemetry into business impact.

Possible views:

- Estimated cost by workload, namespace, team, node pool, or time window.
- Cost of idle capacity.
- Cost of failed or restarted jobs.
- Over-provisioning estimate.
- Potential savings from right-sizing.
- Cost per successful job or unit of throughput if derivable.
- Ranged savings estimates rather than single-point guesses.
- Drilldown from each dollar figure to jobs, users, rules, findings, and assumptions.

### Business Layer

Purpose: make business-impact claims explicit and reviewable.

Possible views:

- Headline savings range.
- CFO-cut progress against the 20% target.
- Business-impact claims labeled as fact or judgment.
- Confidence level for each claim.
- Supporting data path for each claim.
- Assumptions used for savings, efficiency, or risk estimates.

### Findings

Purpose: turn analysis into action.

Each finding card should show:

- Finding title.
- Category.
- Affected entities.
- Severity.
- Confidence.
- Business impact.
- Evidence.
- Recommended action.

Possible recommendation types:

- Right-size workload requests.
- Shift workloads away from degraded or overloaded nodes.
- Investigate nodes with repeated anomalies.
- Reduce idle GPU capacity.
- Improve scheduling or placement.
- Address performance bottlenecks.
- Prioritize reliability risks with high cost impact.

## User Experience

The dashboard should be operational and scannable rather than a marketing page.

UX principles:

- Lead with the most important cluster findings.
- Make every chart answer a concrete operator question.
- Link metrics to affected entities.
- Show business impact next to technical evidence.
- Prefer a small number of high-signal views over many generic charts.
- Preserve drill-down from cluster -> node -> workload/job -> evidence.
- Make recommendations visible without forcing the user to interpret every chart manually.

Suggested navigation:

- Overview.
- Utilization.
- Performance.
- Reliability.
- Cost.
- Business Layer.
- Findings.

## LLM-Guided Dynamic Dashboarding

Track 2 should include a deterministic baseline dashboard and, if time allows, an LLM-guided dynamic insight workspace.

The LLM should not merely summarize a static dashboard. Its higher-value role is dynamic dashboarding: allowing a user to ask new operational questions and having the system assemble the right view, query, explanation, or finding without pre-building every possible chart.

The two-layer experience:

1. Baseline dashboard:
   - Overview.
   - Utilization.
   - Performance.
   - Reliability.
   - Cost.
   - Findings.

2. Dynamic insight workspace:
   - User asks an operational question.
   - LLM maps the question to an allowed analysis intent.
   - Backend validates the intent and data request.
   - Backend queries MantisGrid APIs or local cache.
   - Backend returns bounded data results.
   - GUI renders charts, tables, cards, or comparisons.
   - LLM optionally explains the returned results using only bounded data.

Example user questions:

- Which workloads are wasting the most GPU?
- What is the safest path to the CFO's 20% cut?
- Show me nodes with high cost and low utilization.
- Compare performance before and after 10am.
- Where are we over-provisioned?
- What changed in the last hour?
- Which recommendations would save the most cost without hurting uptime?
- Explain why this node pool is ranked as inefficient.
- Build a view of GPU idle cost by namespace.
- Show the data behind this dollar figure.

Allowed analysis intents:

- `rank_entities`
- `compare_entities`
- `trend_metric`
- `detect_outliers`
- `breakdown_cost`
- `explain_finding`
- `generate_recommendation`
- `summarize_time_window`
- `create_view`

As with Track 1, any cloud LLM should not directly access MantisGrid APIs. The local backend should retrieve and summarize data, then send bounded context to the model.

The backend must own:

- Allowed intents.
- Metric catalog.
- Entity catalog.
- Query validation.
- Data retrieval.
- Chart rendering.
- Numeric outputs.
- Fixed-format headline outputs.
- Ranged estimates and confidence labels.
- Evidence IDs.
- Trace logs.

Avoid:

- Arbitrary SQL from the LLM.
- Arbitrary API calls.
- Raw telemetry dumps into prompts.
- Hallucinated numbers.
- Charts not backed by validated data.

## Dynamic Dashboard Spec

The LLM should not "make a dashboard" in free text. It should emit a strict structured spec. The Python/UI layer validates the spec, executes the data requests, and renders the dashboard.

High-level flow:

```text
User question
  |
  +-- LLM produces structured DashboardSpec / ViewSpec
        |
        +-- Python backend validates spec
              |
              +-- Python backend executes approved data operations
                    |
                    +-- Python backend returns DataResult
                          |
                          +-- Streamlit renders chart/table/card from spec + data
                                |
                                +-- LLM optionally explains the bounded result
```

Core structs:

### AnalysisIntent

Captures what the user is asking operationally.

```json
{
  "intent": "rank_entities",
  "question": "Which workloads are wasting the most GPU?",
  "entity_type": "workload",
  "metric": "gpu_idle_cost",
  "time_window": "last_6h",
  "group_by": ["namespace", "workload"],
  "filters": {},
  "limit": 10,
  "sort": {
    "field": "gpu_idle_cost",
    "direction": "desc"
  }
}
```

### DataRequest

Captures the backend data operation to run.

```json
{
  "request_id": "req_001",
  "data_source": "local_cache",
  "operation": "aggregate_metric",
  "table": "workload_utilization",
  "metrics": [
    {
      "name": "gpu_idle_cost",
      "aggregation": "sum"
    },
    {
      "name": "avg_gpu_utilization",
      "aggregation": "avg"
    }
  ],
  "dimensions": ["namespace", "workload"],
  "filters": [
    {
      "field": "time",
      "operator": ">=",
      "value": "now-6h"
    }
  ],
  "order_by": [
    {
      "field": "gpu_idle_cost",
      "direction": "desc"
    }
  ],
  "limit": 10
}
```

### ViewSpec

Captures what the UI should render.

```json
{
  "view_id": "gpu_idle_cost_by_workload",
  "title": "Top GPU Idle Cost by Workload",
  "view_type": "bar_chart",
  "data_request_id": "req_001",
  "encoding": {
    "x": {
      "field": "workload",
      "type": "nominal"
    },
    "y": {
      "field": "gpu_idle_cost",
      "type": "quantitative"
    },
    "color": {
      "field": "namespace",
      "type": "nominal"
    }
  },
  "columns": [
    {
      "field": "workload",
      "label": "Workload"
    },
    {
      "field": "namespace",
      "label": "Namespace"
    },
    {
      "field": "gpu_idle_cost",
      "label": "Idle GPU Cost"
    },
    {
      "field": "avg_gpu_utilization",
      "label": "Avg GPU Utilization"
    }
  ],
  "insight_template": "Rank workloads by estimated idle GPU cost.",
  "evidence_fields": ["gpu_idle_cost", "avg_gpu_utilization", "time_window"]
}
```

### DashboardSpec

Captures a composite dynamic dashboard.

```json
{
  "dashboard_id": "gpu_waste_analysis",
  "title": "GPU Waste Analysis",
  "question": "Which workloads are wasting the most GPU?",
  "layout": "two_column",
  "data_requests": [
    {
      "request_id": "req_001",
      "operation": "aggregate_metric",
      "table": "workload_utilization",
      "metrics": [
        {
          "name": "gpu_idle_cost",
          "aggregation": "sum"
        },
        {
          "name": "avg_gpu_utilization",
          "aggregation": "avg"
        }
      ],
      "dimensions": ["namespace", "workload"],
      "filters": [
        {
          "field": "time",
          "operator": ">=",
          "value": "now-6h"
        }
      ],
      "order_by": [
        {
          "field": "gpu_idle_cost",
          "direction": "desc"
        }
      ],
      "limit": 10
    }
  ],
  "views": [
    {
      "view_id": "top_idle_cost",
      "view_type": "bar_chart",
      "data_request_id": "req_001"
    },
    {
      "view_id": "utilization_table",
      "view_type": "table",
      "data_request_id": "req_001"
    },
    {
      "view_id": "recommendation",
      "view_type": "finding_card",
      "data_request_id": "req_001"
    }
  ],
  "narrative_prompt": "Explain the largest sources of idle GPU cost and recommend the top action."
}
```

Supported `view_type` values should be explicit:

- `metric_card`
- `bar_chart`
- `line_chart`
- `scatter_plot`
- `heatmap`
- `table`
- `finding_card`
- `comparison_panel`
- `timeline`

Validation rules:

- Intent must be allowed.
- Tables must be allowed.
- Metrics must exist in the metric catalog.
- Dimensions must exist in the entity/dimension catalog.
- Time ranges must be bounded.
- Filters must use allowed fields and operators.
- View type must be supported.
- Chart encoding must match returned data fields.
- Data requests must stay within API and runtime budgets.

Invalid specs should be rejected with a structured error and a safe fallback suggestion.

Useful LLM roles:

- Summarize findings in plain language.
- Generate an operator-facing report.
- Explain why a recommendation matters.
- Convert a selected finding into a recommended action plan.
- Answer natural-language questions over cached telemetry summaries.

## LLM-Assisted Inefficiency Discovery

Track 2 should not rely only on the human eyeballing dashboards to find inefficiencies. The system should also be able to proactively search for likely inefficiencies and surface them as candidate findings.

The LLM-assisted discovery process is separate from dynamic dashboarding:

- Dynamic dashboarding turns user intent into a custom view.
- Inefficiency discovery turns cluster data into proposed findings.

High-level discovery loop:

```text
Python backend selects scope
  |
  +-- Backend gathers cluster summaries / candidate slices
        |
        +-- LLM reviews bounded summaries
              |
              +-- LLM proposes candidate inefficiencies
                    |
                    +-- Backend validates each candidate with data queries
                          |
                          +-- Backend accepts, rejects, or scores candidates
                                |
                                +-- Validated findings appear in dashboard
```

The backend should own:

- Discovery scope.
- Data slices and summaries shown to the LLM.
- Candidate validation.
- Evidence extraction.
- Scoring and ranking.
- Finding persistence.

The LLM should contribute:

- Candidate inefficiency hypotheses.
- Suggested evidence needed to validate each hypothesis.
- Suggested validation requests using the allowed DataRequest schema.
- Plain-language explanation once a finding is validated.

Example discovery prompt:

```text
Given these utilization, cost, reliability, and performance summaries, propose up to 5 possible inefficiencies.
For each, include category, affected entities, evidence needed, likely business impact, and validation requests.
Do not invent metrics or entities. Use only the provided metric and entity catalogs.
```

### CandidateFindingSpec

The LLM should emit candidate inefficiencies as structured proposals, not final findings.

```json
{
  "candidate_id": "candidate_001",
  "category": "underutilization",
  "title": "Low GPU utilization in training-dev",
  "affected_entities": ["namespace:training-dev"],
  "hypothesis": "Allocated GPUs appear to be idle for most of the observed window.",
  "evidence_needed": [
    "avg GPU utilization",
    "allocated GPU-hours",
    "estimated idle cost"
  ],
  "validation_requests": [
    {
      "request_id": "req_001",
      "operation": "aggregate_metric",
      "table": "gpu_utilization",
      "metrics": [
        {
          "name": "avg_gpu_utilization",
          "aggregation": "avg"
        },
        {
          "name": "allocated_gpu_hours",
          "aggregation": "sum"
        },
        {
          "name": "gpu_idle_cost",
          "aggregation": "sum"
        }
      ],
      "dimensions": ["namespace"],
      "filters": [
        {
          "field": "namespace",
          "operator": "=",
          "value": "training-dev"
        }
      ]
    }
  ],
  "expected_business_impact": "Potential idle GPU spend reduction.",
  "confidence_before_validation": 0.55
}
```

The backend validates the candidate by running the requested data operations or equivalent deterministic checks. Only validated candidates should become findings.

Example validated finding:

```json
{
  "finding_id": "finding_001",
  "source_candidate_id": "candidate_001",
  "category": "underutilization",
  "title": "training-dev accounts for high idle GPU cost",
  "affected_entities": ["namespace:training-dev"],
  "evidence": [
    "Average GPU utilization was 18%.",
    "Allocated GPU-hours were high during the selected window.",
    "Estimated idle GPU cost was $420."
  ],
  "recommended_action": "Right-size or reschedule training-dev workloads.",
  "confidence": 0.82
}
```

Finding engine architecture:

```text
Finding engine
  |
  +-- Deterministic rules
  +-- LLM-assisted discovery
  +-- Validation queries
  +-- Ranking / scoring
  +-- Evidence extraction
  +-- Recommendation generation
```

Dynamic dashboard engine:

```text
Dynamic dashboard engine
  |
  +-- Natural-language question
  +-- DashboardSpec
  +-- Validated data requests
  +-- Rendered view
```

The two engines can share:

- Metric catalog.
- Entity catalog.
- DataRequest schema.
- Spec validator.
- Local cache.
- MantisGrid API client.
- Evidence IDs.
- Trace logging.

The best product shape is:

> Here are the inefficiencies we found, here is the evidence, and here is a dynamic workspace to ask follow-up questions.

## Evaluation and Tuning

Track 2 evaluation may be less exact than Track 1 if there are no labeled expected findings. The tuning process should still be explicit.

Possible judging dimensions:

- Insight quality.
- Correctness of identified inefficiencies.
- Dashboard usability.
- Evidence quality.
- Business impact framing.
- Performance and responsiveness.
- Novelty or usefulness of recommendations.

If labeled or expected findings are provided, use them like eval data:

- Run the analytics pipeline.
- Compare produced findings to expected findings.
- Score category match, affected entity match, evidence quality, and recommendation usefulness.
- Inspect misses.
- Tune derived metrics, thresholds, ranking rules, and finding templates.

If no labels are provided, tune against internal quality checks:

- Does each finding have evidence?
- Does each finding map to a concrete entity?
- Does each recommendation follow from the evidence?
- Does the dashboard avoid duplicate or low-value findings?
- Are top findings actually more important than lower-ranked findings?
- Are cost/performance/reliability claims traceable to data?

Tuning knobs:

- Utilization thresholds.
- Time windows and aggregation levels.
- Ranking weights for severity, confidence, and business impact.
- Cost estimation assumptions.
- Anomaly thresholds.
- Deduplication rules.
- Finding templates.
- Recommendation templates.
- Chart and table defaults.
- Dynamic dashboard spec validation strictness.
- Allowed intents, metrics, dimensions, and view types.
- Prompting for AnalysisIntent, DataRequest, ViewSpec, and DashboardSpec generation.
- LLM-assisted discovery scope and cadence.
- CandidateFindingSpec prompt and validation strictness.
- Candidate-to-finding promotion thresholds.

Failure modes to track:

- `chart_wall`: many charts but no clear findings.
- `weak_evidence`: finding lacks supporting data.
- `wrong_entity`: finding points to the wrong workload, node, job, or resource.
- `duplicate_findings`: same issue appears multiple times.
- `low_value_finding`: technically true but not operationally useful.
- `bad_cost_assumption`: savings estimate is unsupported or misleading.
- `missing_dimension`: analysis cannot group by a needed field such as workload, team, namespace, node pool, or GPU.
- `slow_dashboard`: data loading or rendering is too slow for interactive use.
- `invalid_dynamic_spec`: LLM-generated spec fails validation too often.
- `unsupported_view`: LLM requests charts or encodings the UI cannot render.
- `hallucinated_metric`: LLM requests a metric, table, or dimension that does not exist.
- `invalid_candidate_finding`: LLM proposes an inefficiency that cannot be validated.
- `missed_inefficiency`: obvious inefficiency is absent from top findings.
- `overzealous_discovery`: LLM proposes too many low-value candidates.

Practical tuning loop:

```text
Run analytics pipeline
  |
  +-- Generate findings and dashboard data
  |
  +-- Review top findings for evidence and actionability
  |
  +-- Adjust thresholds, ranking, derived metrics, or templates
  |
  +-- Re-run on same data
  |
  +-- Keep changes that improve usefulness without adding noise
```

## Detailed Logging and Traceability

Track 2 should log enough detail to explain every dashboard finding.

Each generated finding should be traceable to:

- Source API calls or cached tables.
- Time window.
- Affected entities.
- Derived metrics.
- Thresholds or ranking rules applied.
- Evidence rows, aggregate values, or chart data.
- Recommendation rule or template used.
- Confidence or severity calculation.

Each dynamic dashboard request should be traceable to:

- User question.
- LLM-produced AnalysisIntent, DataRequest, ViewSpec, or DashboardSpec.
- Spec validation result.
- Rejected fields or validation errors, if any.
- Data requests executed.
- Result row counts and latency.
- Rendered view IDs.
- Optional LLM explanation inputs and outputs.

Each LLM-assisted discovery run should be traceable to:

- Discovery scope.
- Summaries or slices shown to the LLM.
- Metric and entity catalogs provided.
- CandidateFindingSpecs returned by the LLM.
- Validation requests executed.
- Validation results.
- Candidates accepted, rejected, or merged.
- Final finding IDs.
- Ranking and scoring decisions.

Suggested finding trace shape:

```json
{
  "finding_id": "finding_001",
  "category": "underutilization",
  "affected_entities": ["nodepool-gpu-a"],
  "time_window": "2026-09-16T00:00:00Z/2026-09-16T12:00:00Z",
  "source_tables": ["gpu_utilization", "cost_by_node_pool"],
  "metrics": {
    "avg_gpu_utilization": 0.18,
    "estimated_idle_cost": 420.0
  },
  "thresholds": {
    "underutilized_below": 0.30
  },
  "evidence_ids": ["gpu_utilization:nodepool-gpu-a:12h"],
  "recommendation_rule": "right_size_idle_gpu_capacity_v1",
  "confidence": 0.82
}
```

Do not log secrets, credentials, or unrestricted raw telemetry dumps. Store compact excerpts, aggregate values, and evidence IDs where possible.

## Explicit Non-Goals for the Initial Build

Do not start with:

- A native Mac application.
- A production cloud deployment.
- Kubernetes deployment.
- A full observability clone.
- Dozens of undifferentiated charts.
- Automated remediation.
- Fine-tuning or model training.

The initial value should come from crisp insights, useful drill-downs, clear evidence, and business impact.

## Shared Foundation With Track 1

Track 2 should reuse as much of the Track 1 foundation as practical:

- Local Python runtime.
- MantisGrid MCP adapter for agent/chatbot work.
- Direct MantisGrid API client if allowed and useful for deterministic ingestion.
- DuckDB or Polars cache.
- Shared schemas for clusters, nodes, workloads, metrics, logs, traces, incidents, and findings.
- Streamlit UI shell.
- Evidence and recommendation components.
- Trace logging patterns.

Track 1 and Track 2 can share the same telemetry layer while presenting different user experiences:

- Track 1: incident investigation and root cause evidence.
- Track 2: cluster-wide behavior, inefficiency detection, and business impact.

## Suggested Repository Shape

```text
mantisgrid-efficiency/
  README.md
  data/
    raw/
    processed/
  src/
    app.py
    efficiency/
      mantisgrid_client.py
      telemetry_store.py
      derived_tables.py
      findings.py
      discovery.py
      recommendations.py
      dynamic_specs.py
      spec_validator.py
      view_renderer.py
      scoring.py
      traces.py
      schemas.py
    pages/
      overview.py
      utilization.py
      performance.py
      reliability.py
      cost.py
      findings.py
  notebooks/
  tests/
```

This is a proposed shape only. The actual structure should adapt once the provided API surface and data objects are known. If both tracks are built in one repo, Track 1 and Track 2 should share the API client, telemetry store, schemas, and evidence components.

## Open Questions

- What exact API endpoints and data objects are provided for Track 2?
- What is the exact access path for the four-month GPU cluster dataset?
- Are cost values provided directly, estimated, or expected to be calculated?
- What fixed format is expected for headline numbers?
- What confidence language or uncertainty ranges do judges expect?
- Which MCP tools are available, and is MCP required for the chatbot or agent deliverable?
- What one-command dashboard startup command should be supported?
- What dimensions are available: namespace, team, workload, service, job, node, GPU, cluster, region, node pool?
- Are uptime and performance insights precomputed by MantisGrid or derived from raw telemetry?
- How should headline-number ranges be formatted for judging?
- What confidence labels or uncertainty format should be used?
- What is the expected short-report format?
- Are there known labels or expected findings for evaluation?
- How will judges score the dashboard: insight quality, UX, accuracy, performance, business impact, or novelty?
- Are LLM APIs allowed or useful for Track 2 judging?
- Are API rate limits relevant for dashboard refresh and batch analysis?
- Is MCP required for all interactive/agent access, or can direct API access be used for deterministic ingestion and caching?
- How fresh should the dashboard be: static snapshot, manual refresh, or live polling?

## Near-Term Build Sequence

1. Confirm Track 2 API surface, MCP tools, data objects, dimensions, judging criteria, and required fixed format for headline numbers.
2. Create or reuse the local Python project skeleton with a one-command dashboard startup path.
3. Build the MantisGrid MCP adapter for agent/chatbot access.
4. Build direct API access only if final instructions allow it and it helps deterministic ingestion.
5. Cache representative MCP/API responses in DuckDB or Polars.
6. Define derived analytics tables and the finding schema around job, user, GPU, utilization, memory, power, queue, outcome, cost, and confidence.
7. Implement first-pass headline numbers as ranges: total opportunity, likely savings band, top waste categories, and confidence level.
8. Implement the first finding engine for utilization, queueing, memory, power, and cost.
9. Build the Streamlit dashboard shell.
10. Implement the overview page around 30-second executive actionability, top findings, scores, and CFO-cut progress.
11. Add drilldown from headline dollar figures to evidence tables and source jobs.
12. Add utilization, performance, reliability, cost, and business-layer views.
13. Add finding cards with facts, judgments, evidence, impact, confidence, and recommendations.
14. Add a short report generator explaining what was found and how.
15. Add trace logging for each finding.
16. Define the dynamic dashboard spec schema, metric catalog, entity catalog, and supported view types.
17. Implement spec validation and safe rejection/fallback behavior.
18. Add an MCP-assisted chatbot or agent for data questions and drilldowns.
19. Define CandidateFindingSpec and implement LLM-assisted inefficiency discovery over bounded summaries.
20. Add validation and promotion logic from candidate findings to dashboard findings.
21. Tune thresholds, ranking, templates, dynamic spec prompts, and discovery prompts based on data quality and judge-facing usefulness.
22. Add optional LLM summarization only after the deterministic dashboard, spec rendering path, and discovery validation path are solid.

## Current Decision

The Plan of Record for Track 2 is to build a local Python analytics dashboard and MCP-assisted data agent using MantisGrid API access, optional local caching, and Streamlit. The dashboard should identify a credible 20% savings opportunity as ranged headline numbers, label facts versus judgments, support drilldown from business impact to source data, and translate cluster inefficiencies into operational and CFO-readable recommendations.

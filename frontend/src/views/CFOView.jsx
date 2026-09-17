import { useEffect, useState } from "react";
import { api, fmtNum, fmtUsd } from "../api";
import WaterfallChart from "../components/charts/WaterfallChart";
import InlineBar from "../components/InlineBar";
import DrilldownPanel from "../components/DrilldownPanel";

const OUTCOME_COLOR = {
  COMPLETED: "var(--series-1)",
  CANCELLED: "var(--series-8)",
  TIMEOUT: "var(--series-2)",
  FAILED: "var(--series-4)",
  NODE_FAIL: "var(--series-7)",
  UNKNOWN: "var(--text-muted)",
};

export default function CFOView() {
  const [waterfall, setWaterfall] = useState(null);
  const [waste, setWaste] = useState(null);
  const [drill, setDrill] = useState(null);

  useEffect(() => {
    api.waterfall().then(setWaterfall);
    api.wasteBreakdown().then(setWaste);
  }, []);

  if (!waterfall || !waste) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;

  const maxHours = Math.max(...waste.rows.map((r) => r.gpu_hours));

  return (
    <div>
      <section style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>Where is the money going?</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 8px" }}>{waterfall.note}</p>
        <WaterfallChart stages={waterfall.stages} dropoffs={waterfall.dropoffs} />
      </section>

      <section style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Outcome breakdown</h2>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 16px" }}>
          Click a row to see the jobs behind it.
        </p>

        <div
          style={{
            marginBottom: 18,
            padding: "12px 16px",
            background: "var(--surface-2)",
            border: `1px solid ${waste.cancelled_is_waste ? "var(--status-critical)" : "var(--status-warning)"}55`,
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <strong style={{ color: waste.cancelled_is_waste ? "var(--status-critical)" : "var(--status-warning)" }}>
            CANCELLED treated as {waste.cancelled_is_waste ? "waste" : "not waste"}.
          </strong>{" "}
          <span style={{ color: "var(--text-secondary)" }}>{waste.cancelled_rationale}</span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", fontSize: 12 }}>
              <th style={{ textAlign: "left", padding: "6px 10px" }}>Outcome</th>
              <th style={{ textAlign: "left", padding: "6px 10px", width: "30%" }}>GPU-hours</th>
              <th style={{ textAlign: "right", padding: "6px 10px" }}>Dollars</th>
              <th style={{ textAlign: "right", padding: "6px 10px" }}>Jobs</th>
              <th style={{ textAlign: "right", padding: "6px 10px" }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {waste.rows.filter((r) => r.jobs > 0).map((r) => (
              <tr
                key={r.outcome}
                onClick={() => setDrill(r.outcome)}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: "10px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: OUTCOME_COLOR[r.outcome] }} />
                    {r.outcome}
                  </span>
                </td>
                <td style={{ padding: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 90, flexShrink: 0 }} className="tabular">{fmtNum(r.gpu_hours, { digits: 0 })}</div>
                    <InlineBar pct={(r.gpu_hours / maxHours) * 100} color={OUTCOME_COLOR[r.outcome]} />
                  </div>
                </td>
                <td className="tabular" style={{ padding: "10px", textAlign: "right" }}>{fmtUsd(r.usd, { compact: false })}</td>
                <td className="tabular" style={{ padding: "10px", textAlign: "right", color: "var(--text-secondary)" }}>{fmtNum(r.jobs, { digits: 0 })}</td>
                <td className="tabular" style={{ padding: "10px", textAlign: "right", color: "var(--text-secondary)" }}>{r.share_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <DrilldownPanel
        open={!!drill}
        onClose={() => setDrill(null)}
        fetchKey={drill}
        title={`${drill} jobs`}
        subtitle="Raw scheduler + DCGM data behind this outcome"
        fetchJobs={drill ? () => api.jobsByState(drill, 200, 0) : null}
      />
    </div>
  );
}

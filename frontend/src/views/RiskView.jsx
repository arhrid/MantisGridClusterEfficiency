import { useEffect, useState } from "react";
import { api, fmtUsd } from "../api";
import ConfidenceTag from "../components/ConfidenceTag";

export default function RiskView() {
  const [recs, setRecs] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.recommendations().then(setRecs);
    api.summary().then(setSummary);
  }, []);

  if (!recs || !summary) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;

  return (
    <div>
      <section style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>What it costs if you're wrong</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 16px", maxWidth: 720 }}>
          {summary.recoverable.basis}
        </p>
        <div style={{ display: "flex", gap: 32 }}>
          <RangeStat label="Fact-only (low)" value={fmtUsd(summary.recoverable.usd.low, { compact: false })} color="var(--status-good)" />
          <RangeStat label="Calibrated point estimate" value={fmtUsd(summary.recoverable.usd.point, { compact: false })} color="var(--series-1)" big />
          <RangeStat label="All judgment calls (high)" value={fmtUsd(summary.recoverable.usd.high, { compact: false })} color="var(--status-warning)" />
        </div>
      </section>

      <section style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", fontSize: 12 }}>
              <th style={{ textAlign: "left", padding: "6px 10px" }}>Recommendation</th>
              <th style={{ textAlign: "center", padding: "6px 10px" }}>Confidence</th>
              <th style={{ textAlign: "left", padding: "6px 10px" }}>If we're right</th>
              <th style={{ textAlign: "left", padding: "6px 10px" }}>If we're wrong</th>
            </tr>
          </thead>
          <tbody>
            {recs.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 10px", fontWeight: 600, maxWidth: 200 }}>{r.title}</td>
                <td style={{ padding: "12px 10px", textAlign: "center" }}>
                  <ConfidenceTag confidence={r.confidence} />
                </td>
                <td style={{ padding: "12px 10px", color: "var(--status-good)", fontSize: 12.5, maxWidth: 280 }}>{r.if_right}</td>
                <td style={{ padding: "12px 10px", color: "var(--status-warning)", fontSize: 12.5, maxWidth: 280 }}>{r.risk_if_wrong}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function RangeStat({ label, value, color, big }) {
  return (
    <div>
      <div className="tabular" style={{ fontSize: big ? 32 : 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { api, fmtNum, fmtUsd } from "../api";
import ConfidenceTag from "../components/ConfidenceTag";
import DrilldownPanel from "../components/DrilldownPanel";

function EvidenceForNode({ node }) {
  return (
    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
      <strong style={{ color: "var(--text-primary)" }}>{node.node}</strong> failed{" "}
      <strong>{(node.burst_fail_rate * 100).toFixed(1)}%</strong> of jobs in a 48h window
      ({node.burst_window_failed}/{node.burst_window_jobs}), {node.burst_distinct_users} distinct users,{" "}
      {(node.top_exit_status_share * 100).toFixed(0)}% sharing exit code {node.top_exit_status}. The same
      users fail only <strong>{(node.affected_users_elsewhere_fail_rate * 100).toFixed(1)}%</strong> of the
      time on other nodes ({node.baseline_ratio}× baseline) — consistent with a hardware fault, not user error.
    </div>
  );
}

export default function SREView() {
  const [recs, setRecs] = useState(null);
  const [nodes, setNodes] = useState(null);
  const [arrays, setArrays] = useState(null);
  const [users, setUsers] = useState(null);
  const [drill, setDrill] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.recommendations().then(setRecs);
    api.nodes().then(setNodes);
    api.arrays().then(setArrays);
    api.users().then(setUsers);
  }, []);

  if (!recs) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;

  const topNode = nodes?.[0];
  const repeatUsers = users?.rows?.filter((u) => u.profile === "repeat-failer") ?? [];

  return (
    <div>
      <section style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>Where to cut, and what to drill into</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 16px" }}>
          Ranked by dollar savings, not severity. Click a row to open the affected jobs and evidence.
        </p>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", fontSize: 12 }}>
              <th style={{ textAlign: "left", padding: "6px 10px" }}>Recommendation</th>
              <th style={{ textAlign: "right", padding: "6px 10px" }}>Savings (range)</th>
              <th style={{ textAlign: "center", padding: "6px 10px" }}>Confidence</th>
              <th style={{ textAlign: "left", padding: "6px 10px" }}>Risk if wrong</th>
              <th style={{ textAlign: "right", padding: "6px 10px" }}>Findings</th>
            </tr>
          </thead>
          <tbody>
            {recs.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)", verticalAlign: "top" }}>
                <td style={{ padding: "12px 10px", maxWidth: 260 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.title}</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 12.5 }}>{r.action}</div>
                </td>
                <td className="tabular" style={{ padding: "12px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                  {fmtUsd(r.savings_usd.low)} – {fmtUsd(r.savings_usd.high)}
                </td>
                <td style={{ padding: "12px 10px", textAlign: "center" }}>
                  <ConfidenceTag confidence={r.confidence} />
                </td>
                <td style={{ padding: "12px 10px", color: "var(--text-secondary)", fontSize: 12.5, maxWidth: 260 }}>
                  {r.risk_if_wrong}
                </td>
                <td style={{ padding: "12px 10px", textAlign: "right" }}>
                  <button
                    onClick={() => setDrill(r)}
                    style={{
                      background: "var(--surface-3)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                      borderRadius: 6,
                      padding: "5px 10px",
                      fontSize: 12,
                    }}
                  >
                    {fmtNum(r.findings, { digits: 0 })} →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {topNode && (
        <section style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24, marginTop: 24 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Node baseline comparison — {topNode.node}</h3>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-end", marginBottom: 12 }}>
            <BarStat label="This node, in-burst" pct={topNode.burst_fail_rate * 100} color="var(--status-critical)" />
            <BarStat label="Fleet baseline" pct={topNode.fleet_baseline_fail_rate * 100} color="var(--text-muted)" />
            <BarStat label="Same users, elsewhere" pct={topNode.affected_users_elsewhere_fail_rate * 100} color="var(--status-good)" />
          </div>
          <EvidenceForNode node={topNode} />
        </section>
      )}

      {repeatUsers.length > 0 && (
        <section style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24, marginTop: 24 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Repeat-failure users ({repeatUsers.length})</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 12px" }}>
            Framed as capacity by researcher profile, not a blame list — these are candidates for office-hours support.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                <th style={{ textAlign: "left", padding: 6 }}>User</th>
                <th style={{ textAlign: "right", padding: 6 }}>Jobs</th>
                <th style={{ textAlign: "right", padding: 6 }}>Success rate</th>
                <th style={{ textAlign: "right", padding: 6 }}>Avg util</th>
                <th style={{ textAlign: "right", padding: 6 }}>GPU-h</th>
              </tr>
            </thead>
            <tbody>
              {repeatUsers.slice(0, 10).map((u) => (
                <tr key={u.id_user} className="tabular" style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: 6, color: "var(--text-secondary)" }}>{u.id_user}</td>
                  <td style={{ padding: 6, textAlign: "right" }}>{u.total_jobs}</td>
                  <td style={{ padding: 6, textAlign: "right" }}>{(u.success_rate * 100).toFixed(0)}%</td>
                  <td style={{ padding: 6, textAlign: "right" }}>{u.avg_util.toFixed(0)}%</td>
                  <td style={{ padding: 6, textAlign: "right" }}>{fmtNum(u.gpu_hours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <DrilldownPanel
        open={!!drill}
        onClose={() => setDrill(null)}
        fetchKey={drill?.id}
        title={drill?.title}
        subtitle={drill?.action}
        evidence={
          drill?.id === "node_hardware_fault" && topNode ? <EvidenceForNode node={topNode} /> :
          drill?.id === "array_mass_failure" && arrays ? (
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {arrays.total_bad_arrays} arrays with &gt;90% task failure, {arrays.total_bad_tasks} tasks total. One
              script fix per array avoids re-failing every task individually.
            </div>
          ) : null
        }
        fetchJobs={drill ? () => api.recommendationJobs(drill.id, 200, 0) : null}
      />
    </div>
  );
}

function BarStat({ label, pct, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        className="tabular"
        style={{ width: 64, height: 64, borderRadius: "50%", border: `4px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600, margin: "0 auto 8px" }}
      >
        {pct.toFixed(0)}%
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 110 }}>{label}</div>
    </div>
  );
}

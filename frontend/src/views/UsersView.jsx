import { useEffect, useState } from "react";
import { api, fmtNum } from "../api";
import DrilldownPanel from "../components/DrilldownPanel";

const PROFILE_COLOR = {
  "over-provisioner": "var(--status-warning)",
  "repeat-failer": "var(--status-critical)",
  "healthy power user": "var(--status-good)",
};

export default function UsersView() {
  const [users, setUsers] = useState(null);
  const [drill, setDrill] = useState(null);

  useEffect(() => {
    api.users().then(setUsers);
  }, []);

  if (!users) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;

  return (
    <div>
      <section style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>Capacity by researcher profile</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 16px" }}>
          Users are hashed and framed as recoverable capacity, not a ranking of people. Click a row to see that
          user's jobs.
        </p>
        <div style={{ maxHeight: 560, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", fontSize: 12 }}>
                <th style={{ textAlign: "left", padding: "6px 10px", position: "sticky", top: 0, background: "var(--surface-1)" }}>User (hashed)</th>
                <th style={{ textAlign: "right", padding: "6px 10px", position: "sticky", top: 0, background: "var(--surface-1)" }}>GPU-h</th>
                <th style={{ textAlign: "right", padding: "6px 10px", position: "sticky", top: 0, background: "var(--surface-1)" }}>Success rate</th>
                <th style={{ textAlign: "right", padding: "6px 10px", position: "sticky", top: 0, background: "var(--surface-1)" }}>Avg util</th>
                <th style={{ textAlign: "right", padding: "6px 10px", position: "sticky", top: 0, background: "var(--surface-1)" }}>Jobs</th>
                <th style={{ textAlign: "left", padding: "6px 10px", position: "sticky", top: 0, background: "var(--surface-1)" }}>Profile</th>
              </tr>
            </thead>
            <tbody>
              {users.rows.map((u) => (
                <tr
                  key={u.id_user}
                  className="tabular"
                  onClick={() => setDrill(u)}
                  style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "8px 10px", color: "var(--text-secondary)" }}>{u.id_user}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>{fmtNum(u.gpu_hours)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>{(u.success_rate * 100).toFixed(0)}%</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>{(u.avg_util ?? 0).toFixed(0)}%</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>{u.total_jobs}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{ color: PROFILE_COLOR[u.profile] ?? "var(--text-secondary)", fontSize: 12.5 }}>
                      {u.profile}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <DrilldownPanel
        open={!!drill}
        onClose={() => setDrill(null)}
        fetchKey={drill?.id_user}
        title={`User ${drill?.id_user}`}
        subtitle={`${drill?.total_jobs} jobs · ${fmtNum(drill?.gpu_hours)} GPU-h · ${drill?.profile}`}
        fetchJobs={drill ? () => api.userJobs(drill.id_user, 200, 0) : null}
      />
    </div>
  );
}

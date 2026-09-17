import { fmtNum } from "../api";

const COLS = [
  { key: "id_job", label: "Job" },
  { key: "id_user", label: "User (hashed)" },
  { key: "state_name", label: "State" },
  { key: "primary_node", label: "Node" },
  { key: "gpu_hours", label: "GPU-h", fmt: (v) => fmtNum(v, { digits: 2 }) },
  { key: "sm_util_avg", label: "SM Util", fmt: (v) => (v == null ? "—" : `${v.toFixed(0)}%`) },
  { key: "exit_status", label: "Exit" },
];

export default function JobsTable({ rows, onSelect }) {
  if (!rows?.length) {
    return <div style={{ color: "var(--text-muted)", padding: 20 }}>No jobs to show.</div>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {COLS.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: "left",
                  color: "var(--text-muted)",
                  fontWeight: 500,
                  padding: "8px 10px",
                  borderBottom: "1px solid var(--border)",
                  position: "sticky",
                  top: 0,
                  background: "var(--surface-1)",
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id_job}
              onClick={() => onSelect?.(r.id_job)}
              style={{ cursor: onSelect ? "pointer" : "default" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {COLS.map((c) => (
                <td
                  key={c.key}
                  className="tabular"
                  style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  {c.fmt ? c.fmt(r[c.key]) : String(r[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

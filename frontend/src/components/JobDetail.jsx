import { useEffect, useState } from "react";
import { api, fmtNum } from "../api";

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{label}</span>
      <span className="tabular" style={{ fontSize: 13, color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

export default function JobDetail({ idJob, onClose }) {
  const [job, setJob] = useState(null);

  useEffect(() => {
    api.jobDetail(idJob).then(setJob);
  }, [idJob]);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(560px, 92vw)", maxHeight: "85vh", overflowY: "auto", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Job {idJob} — raw telemetry</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 18 }}>✕</button>
        </div>
        {!job ? (
          <div style={{ color: "var(--text-muted)" }}>Loading…</div>
        ) : (
          <>
            <Row label="User (hashed)" value={job.id_user} />
            <Row label="State" value={job.state_name} />
            <Row label="Waste category" value={job.waste_category ?? "none"} />
            <Row label="Job type" value={job.job_type} />
            <Row label="Primary node" value={job.primary_node} />
            <Row label="GPU count" value={job.gpu_count} />
            <Row label="GPU-hours (measured)" value={fmtNum(job.gpu_hours, { digits: 3 })} />
            <Row label="GPU-hours (allocated)" value={fmtNum(job.gpu_hours_alloc, { digits: 3 })} />
            <Row label="Wasted GPU-hours" value={fmtNum(job.wasted_gpu_hours, { digits: 3 })} />
            <Row label="SM utilization avg" value={`${(job.sm_util_avg ?? 0).toFixed(1)}%`} />
            <Row label="Memory used (frac)" value={(job.mem_used_frac ?? 0).toFixed(3)} />
            <Row label="Avg watts" value={fmtNum(job.watts_avg, { digits: 1 })} />
            <Row label="Energy (Wh)" value={fmtNum(job.energy_wh, { digits: 1 })} />
            <Row label="Wait (sec)" value={fmtNum(job.wait_sec, { digits: 0 })} />
            <Row label="Walltime (sec)" value={fmtNum(job.walltime_sec, { digits: 0 })} />
            <Row label="Exit status" value={job.exit_status} />
            <Row label="Hit node failure" value={String(job.hit_node_failure)} />

            {job.gpu_rows?.length > 0 && (
              <>
                <div style={{ marginTop: 16, marginBottom: 8, fontSize: 13, color: "var(--text-muted)" }}>
                  Per-GPU DCGM rows ({job.gpu_rows.length})
                </div>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "var(--text-muted)" }}>
                      <th style={{ textAlign: "left", padding: 4 }}>Node</th>
                      <th style={{ textAlign: "left", padding: 4 }}>GPU</th>
                      <th style={{ textAlign: "left", padding: 4 }}>SM avg</th>
                      <th style={{ textAlign: "left", padding: 4 }}>Watts</th>
                      <th style={{ textAlign: "left", padding: 4 }}>Exec (s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.gpu_rows.map((g, i) => (
                      <tr key={i} className="tabular" style={{ color: "var(--text-secondary)" }}>
                        <td style={{ padding: 4 }}>{g.Node}</td>
                        <td style={{ padding: 4 }}>{g.gpu_id}</td>
                        <td style={{ padding: 4 }}>{g.sm_util_avg?.toFixed(0)}%</td>
                        <td style={{ padding: 4 }}>{g.watts_avg?.toFixed(1)}</td>
                        <td style={{ padding: 4 }}>{g.clipped_exec_sec?.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { api, fmtNum } from "../api";
import JobsTable from "./JobsTable";
import JobDetail from "./JobDetail";

export default function DrilldownPanel({ open, onClose, title, subtitle, evidence, fetchJobs, fetchKey }) {
  const [jobs, setJobs] = useState(null);
  const [total, setTotal] = useState(0);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(false);

  // fetchJobs is a fresh closure every render, so key the effect off a
  // stable primitive (fetchKey) rather than the function reference —
  // otherwise this refetches in a loop while the panel is open.
  useEffect(() => {
    if (!open || !fetchJobs) return;
    setLoading(true);
    setJobs(null);
    fetchJobs()
      .then((d) => {
        setJobs(d.rows);
        setTotal(d.total);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fetchKey]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(880px, 100%)",
          height: "100%",
          background: "var(--surface-1)",
          borderLeft: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
            {subtitle && <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 20 }}
          >
            ✕
          </button>
        </div>

        {evidence && (
          <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
            {evidence}
          </div>
        )}

        <div style={{ padding: "10px 24px", color: "var(--text-muted)", fontSize: 12 }}>
          {loading ? "Loading…" : `Showing ${jobs?.length ?? 0} of ${fmtNum(total, { digits: 0 })} affected jobs — click a row for raw telemetry`}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>
          <JobsTable rows={jobs} onSelect={setSelectedJob} />
        </div>
      </div>

      {selectedJob != null && (
        <JobDetail idJob={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import "./theme.css";
import { api, fmtNum, fmtUsd } from "./api";
import StatCard from "./components/StatCard";
import CFOView from "./views/CFOView";
import SREView from "./views/SREView";
import RiskView from "./views/RiskView";
import UsersView from "./views/UsersView";

const TABS = [
  { id: "cfo", label: "CFO view" },
  { id: "sre", label: "SRE view" },
  { id: "risk", label: "Risk & evidence" },
  { id: "users", label: "Researchers" },
];

export default function App() {
  const [summary, setSummary] = useState(null);
  const [tab, setTab] = useState("cfo");

  useEffect(() => {
    api.summary().then(setSummary);
  }, []);

  return (
    <div style={{ minHeight: "100%", background: "var(--surface-0)" }}>
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: "var(--surface-0)",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: 0.2 }}>
          Fleet Intelligence <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>· GPU Cluster Efficiency</span>
        </div>
        {summary?.mantisgrid_check?.available && (
          <span
            title={`MantisGrid API /v1/efficiency/summary reports ${summary.mantisgrid_check.their_completed_pct}% completed vs our ${summary.completed_useful_pct.toFixed(2)}%`}
            style={{
              marginLeft: "auto",
              fontSize: 12,
              color: "var(--status-good)",
              border: "1px solid var(--status-good)55",
              borderRadius: 999,
              padding: "4px 10px",
              whiteSpace: "nowrap",
            }}
          >
            ✓ cross-checked against MantisGrid API ({summary.mantisgrid_check.their_completed_pct}% completed)
          </span>
        )}
      </header>

      <div style={{ padding: "24px 32px 0" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <StatCard label="Total GPU-hours" value={summary ? fmtNum(summary.total_gpu_hours) : "…"} sub={summary ? fmtUsd(summary.total_usd) : ""} />
          <StatCard
            label="Completed useful work"
            value={summary ? `${fmtNum(summary.completed_useful_gpu_hours)} GPU-h` : "…"}
            sub={summary ? `${summary.completed_useful_pct.toFixed(1)}% of total` : ""}
            accent="var(--status-good)"
          />
          <StatCard
            label="Estimated recoverable"
            value={summary ? `${fmtUsd(summary.recoverable.usd.low)} – ${fmtUsd(summary.recoverable.usd.high)}` : "…"}
            sub={summary ? `point estimate ${fmtUsd(summary.recoverable.usd.point)}` : ""}
            accent="var(--status-warning)"
          />
          <StatCard
            label="Active findings"
            value={summary ? fmtNum(summary.active_findings, { digits: 0 }) : "…"}
            sub={summary ? `${summary.bad_nodes_count} nodes flagged` : ""}
            accent="var(--status-critical)"
          />
        </div>

        <nav style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: tab === t.id ? "2px solid var(--series-1)" : "2px solid transparent",
                color: tab === t.id ? "var(--text-primary)" : "var(--text-muted)",
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: tab === t.id ? 600 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <main style={{ padding: "0 32px 48px" }}>
        {tab === "cfo" && <CFOView />}
        {tab === "sre" && <SREView />}
        {tab === "risk" && <RiskView />}
        {tab === "users" && <UsersView />}
      </main>
    </div>
  );
}

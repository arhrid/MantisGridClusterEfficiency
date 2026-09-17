export default function StatCard({ label, value, sub, accent }) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "18px 20px",
        flex: "1 1 200px",
        minWidth: 0,
      }}
    >
      <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 8 }}>{label}</div>
      <div
        className="tabular"
        style={{ fontSize: 30, fontWeight: 600, color: accent || "var(--text-primary)", lineHeight: 1.1 }}
      >
        {value}
      </div>
      {sub && <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

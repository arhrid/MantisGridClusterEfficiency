export default function InlineBar({ pct, color = "var(--series-1)" }) {
  return (
    <div style={{ background: "var(--surface-3)", borderRadius: 4, height: 6, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(Math.min(pct, 100), 0)}%`, height: "100%", background: color, borderRadius: 4 }} />
    </div>
  );
}

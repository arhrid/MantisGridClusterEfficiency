export default function ConfidenceTag({ confidence }) {
  const isFact = confidence === "fact";
  const color = isFact ? "var(--status-good)" : "var(--status-warning)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        color,
        border: `1px solid ${color}55`,
        background: `${color}1a`,
        borderRadius: 999,
        padding: "3px 10px",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
      {isFact ? "Fact" : "Judgment"}
    </span>
  );
}

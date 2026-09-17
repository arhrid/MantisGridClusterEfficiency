import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtNum, fmtUsd } from "../../api";

// Classic waterfall-via-stacked-bar: a transparent "base" bar lifts the
// visible "value" bar to the right height. Stages step down (allocated ->
// computed -> completed); drop-offs render as their own negative-looking
// segments hanging from the running total.
export default function WaterfallChart({ stages, dropoffs, unit = "gpu_hours" }) {
  const stageColor = "var(--series-1)";
  const dropoffColors = ["var(--series-8)", "var(--series-2)", "var(--series-4)", "var(--series-7)", "var(--series-5)"];

  // Order: Allocated -> Computed -> [drop-offs, stepping the running total
  // down from Computed] -> Completed (useful). Drop-offs are computed
  // relative to the Computed stage since they're outcomes of computed time.
  const [allocated, computed, completed] = stages;
  const rows = [
    { name: allocated.name, base: 0, value: allocated[unit], kind: "stage", raw: allocated },
    { name: computed.name, base: 0, value: computed[unit], kind: "stage", raw: computed },
  ];

  let running = computed[unit];
  dropoffs.forEach((d, i) => {
    const top = running;
    running = Math.max(running - d[unit], 0);
    rows.push({
      name: d.label,
      base: running,
      value: top - running,
      kind: "dropoff",
      color: dropoffColors[i % dropoffColors.length],
      raw: d,
    });
  });

  rows.push({ name: completed.name, base: 0, value: completed[unit], kind: "stage", raw: completed });

  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={rows} margin={{ top: 16, right: 16, left: 8, bottom: 48 }} barCategoryGap="20%">
        <CartesianGrid stroke="var(--gridline)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={70}
        />
        <YAxis
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => fmtNum(v)}
          width={56}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload;
            return (
              <div
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                }}
              >
                <div style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}>{row.name}</div>
                <div style={{ color: "var(--text-secondary)" }}>{fmtNum(row.value, { digits: 0 })} GPU-h</div>
                <div style={{ color: "var(--text-muted)" }}>{fmtUsd(row.raw.usd)}</div>
              </div>
            );
          }}
        />
        <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="value" stackId="wf" radius={[4, 4, 4, 4]} isAnimationActive={false}>
          {rows.map((r, i) => (
            <Cell key={i} fill={r.kind === "stage" ? stageColor : r.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

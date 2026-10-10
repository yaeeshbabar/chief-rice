// Shared look for the Recharts charts so they match the rest of the app.

// Short axis labels: 40000 -> "40k", 250000 -> "2.5L"
export const compactNumber = (n) => {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1e5) return `${+(n / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `${+(n / 1e3).toFixed(1)}k`;
  return String(n);
};

export const axisTick = { fontSize: 12, fill: "var(--ink-muted)" };

export const tooltipStyle = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--ink)",
    boxShadow: "var(--shadow-pop)",
  },
  labelStyle: { color: "var(--ink-muted)", marginBottom: 2 },
  itemStyle: { color: "var(--ink)" },
};

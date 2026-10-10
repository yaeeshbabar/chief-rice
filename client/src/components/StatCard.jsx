const dotColor = {
  wheat: "var(--accent)",
  sage: "var(--pos)",
  terracotta: "var(--neg)",
  coffee: "var(--ink-faint)",
};

const StatCard = ({ label, value, sub, accent = "wheat" }) => (
  <div className="grain-card px-4 py-4 sm:px-5 flex flex-col gap-1 min-w-0">
    <span className="flex items-center gap-2 text-[0.8125rem] text-[var(--ink-muted)]">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dotColor[accent] || dotColor.wheat }} />
      <span className="truncate">{label}</span>
    </span>
    <span className="text-2xl font-semibold tracking-tight text-[var(--ink)] truncate">{value}</span>
    {sub && <span className="text-xs text-[var(--ink-muted)] truncate">{sub}</span>}
  </div>
);

export default StatCard;

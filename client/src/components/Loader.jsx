const Loader = ({ label = "Loading..." }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--ink-muted)]" role="status">
    <div className="h-6 w-6 rounded-full border-2 border-[var(--line-strong)] border-t-[var(--accent)] animate-spin" />
    <p className="text-sm">{label}</p>
  </div>
);

export default Loader;

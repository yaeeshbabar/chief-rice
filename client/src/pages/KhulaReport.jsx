import { useEffect, useState } from "react";
import api from "../api/axios.js";
import Loader from "../components/Loader.jsx";
import StatCard from "../components/StatCard.jsx";
import { formatGrams, formatDateTime, formatShort, monthBounds, khulaSourceLabel } from "../utils/format.js";

const statusBadge = (b) => {
  if (b.status === "OVER") return <span className="badge badge-over">Ended early</span>;
  if (b.status === "FINISHED") return <span className="badge badge-finished">Finished</span>;
  return <span className="badge badge-active">Open</span>;
};

const shortCell = (grams, extraWord = "extra") => {
  if (grams > 0) return <span className="font-semibold text-[var(--warn-ink)]">{formatShort(grams)}</span>;
  if (grams < 0) return <span className="text-[var(--ink-muted)]">{`${formatShort(grams)} ${extraWord}`}</span>;
  return <span className="text-[var(--ink-faint)]">—</span>;
};

const quickRanges = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];

const rangeToDates = (key) => {
  const now = new Date();
  if (key === "today") {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString() };
  }
  if (key === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const from = new Date(y);
    from.setHours(0, 0, 0, 0);
    const to = new Date(y);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (key === "week") {
    const day = now.getDay();
    const diff = (day + 6) % 7;
    const from = new Date(now);
    from.setDate(from.getDate() - diff);
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString() };
  }
  if (key === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: from.toISOString() };
  }
  return {};
};

const KhulaReport = () => {
  const [batches, setBatches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [riceTypes, setRiceTypes] = useState([]);
  const [range, setRange] = useState("all");
  const [riceType, setRiceType] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectMonth = (value) => {
    setMonth(value);
    const bounds = monthBounds(value);
    setCustomFrom(bounds.from);
    setCustomTo(bounds.to);
  };

  const load = () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    const dates = customFrom || customTo ? { from: customFrom, to: customTo } : rangeToDates(range);
    if (dates.from) params.set("from", dates.from);
    if (dates.to) params.set("to", dates.to);
    if (riceType) params.set("riceType", riceType);
    api
      .get(`/khula/shortage-report?${params.toString()}`)
      .then((res) => {
        setBatches(res.data.batches);
        setSummary(res.data.summary);
      })
      .catch((err) => setError(err?.response?.data?.message || "Could not load the Khula record"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [range, riceType]);
  useEffect(() => {
    api.get("/rice-types").then((res) => setRiceTypes(res.data));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="page-title">Khula record</h2>

      <div className="filter-bar">
        <div className="segmented">
          {quickRanges.map((r) => (
            <button
              key={r.key}
              onClick={() => {
                setCustomFrom("");
                setCustomTo("");
                setMonth("");
                setRange(r.key);
              }}
              className={`segmented-item ${
                range === r.key && !customFrom && !customTo ? "is-active" : ""
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div>
          <label className="field-label">Month</label>
          <input type="month" className="field-input" value={month} onChange={(e) => selectMonth(e.target.value)} />
        </div>
        <div>
          <label className="field-label">From</label>
          <input type="date" className="field-input" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setMonth(""); }} />
        </div>
        <div>
          <label className="field-label">To</label>
          <input type="date" className="field-input" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setMonth(""); }} />
        </div>
        <div>
          <label className="field-label">Rice type</label>
          <select className="field-input" value={riceType} onChange={(e) => setRiceType(e.target.value)}>
            <option value="">All</option>
            {riceTypes.map((rt) => (
              <option key={rt._id} value={rt._id}>
                {rt.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={load}>
          Apply
        </button>
      </div>

      {loading ? (
        <Loader />
      ) : error ? (
        <p className="grain-card p-6 text-center text-sm text-[var(--color-terracotta-deep)]">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total shortfall"
              value={formatShort(summary.totalShortGrams)}
              sub="when weighed + when ended"
              accent="terracotta"
            />
            <StatCard
              label="Short when weighed"
              value={formatShort(summary.openingShortGrams)}
              sub={`${summary.boriOpenedCount} bori opened`}
              accent="wheat"
            />
            <StatCard
              label="Short when batch ended"
              value={formatShort(summary.endingShortGrams)}
              sub={`${summary.overCount} ended early`}
              accent="wheat"
            />
            <StatCard
              label="Lots closed"
              value={summary.closedCount}
              sub={`${summary.finishedCount} finished, ${summary.overCount} ended early`}
              accent="coffee"
            />
          </div>
          {summary.openingShortGrams < 0 && (
            <p className="text-xs text-[var(--ink-muted)] -mt-3">Some bori weighed more than their size; that extra is taken off the total.</p>
          )}

          <div className="grain-card overflow-x-auto">
            <table className="w-full text-sm min-w-[980px]">
              <thead>
                <tr className="text-left border-b border-[var(--line)]">
                  <th className="py-3 px-4">Rice type</th>
                  <th className="py-3 px-4">Lot</th>
                  <th className="py-3 px-4">Opened</th>
                  <th className="py-3 px-4 text-right">Short when weighed</th>
                  <th className="py-3 px-4">Closed</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Short at end</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {batches.map((b) => {
                  const isBori = !b.source || b.source === "BORI";
                  return (
                    <tr key={b._id} className="align-top">
                      <td className="py-2.5 px-4">{b.riceType?.name}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {khulaSourceLabel(b)}
                        <span className="block text-xs text-[var(--ink-faint)]">
                          {isBori ? `weighed ${formatGrams(b.totalGrams)}` : formatGrams(b.totalGrams)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {formatDateTime(b.createdAt)}
                        <span className="block text-xs text-[var(--ink-faint)]">{b.openedBy?.name || "—"}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right">{isBori ? shortCell(b.openingShortGrams || 0) : shortCell(0)}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {b.closedAt ? formatDateTime(b.closedAt) : <span className="text-[var(--ink-faint)]">Still open</span>}
                        {b.closedBy?.name && <span className="block text-xs text-[var(--ink-faint)]">{b.closedBy.name}</span>}
                      </td>
                      <td className="py-2.5 px-4">
                        {statusBadge(b)}
                        {b.note && <span className="block text-xs text-[var(--ink-muted)] mt-1 max-w-[220px]">{b.note}</span>}
                      </td>
                      <td className="py-2.5 px-4 text-right">{b.status === "ACTIVE" ? shortCell(0) : shortCell(b.shortfallGrams || 0)}</td>
                    </tr>
                  );
                })}
                {!batches.length && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[var(--ink-muted)]">
                      No khula lots opened or closed in these dates
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--ink-faint)] -mt-3">Shortfall counts when a bori is weighed and when a batch ends.</p>
        </>
      )}
    </div>
  );
};

export default KhulaReport;

import { useEffect, useState } from "react";
import api from "../api/axios.js";
import Loader from "../components/Loader.jsx";
import StatCard from "../components/StatCard.jsx";
import { formatGrams, formatDateTime, monthBounds } from "../utils/format.js";

const quickRanges = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
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
      <h2 className="font-display text-xl font-semibold text-[var(--color-coffee)]">
        Khula Batch Record — Opened, Closed &amp; Shortage
      </h2>

      <div className="grain-card p-4 flex flex-wrap items-end gap-3">
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
          <label className="field-label">Rice Type</label>
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
            <StatCard label="Batches Closed" value={summary.totalBatches} accent="coffee" />
            <StatCard label="Marked Over (short)" value={summary.overCount} accent="terracotta" />
            <StatCard label="Finished Exactly" value={summary.finishedCount} accent="sage" />
            <StatCard label="Total Shortfall" value={formatGrams(summary.totalShortfallGrams)} accent="wheat" />
          </div>

          <div className="grain-card overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
                  <th className="py-3 px-4 font-medium">Rice Type</th>
                  <th className="py-3 px-4 font-medium">Bori</th>
                  <th className="py-3 px-4 font-medium">Opened</th>
                  <th className="py-3 px-4 font-medium">Opened By</th>
                  <th className="py-3 px-4 font-medium">Closed</th>
                  <th className="py-3 px-4 font-medium">Closed By</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Shortfall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-husk)]">
                {batches.map((b) => (
                  <tr key={b._id}>
                    <td className="py-2.5 px-4">{b.riceType?.name}</td>
                    <td className="py-2.5 px-4">{b.boriSize} KG</td>
                    <td className="py-2.5 px-4 whitespace-nowrap">{formatDateTime(b.createdAt)}</td>
                    <td className="py-2.5 px-4">{b.openedBy?.name || "—"}</td>
                    <td className="py-2.5 px-4 whitespace-nowrap">{b.closedAt ? formatDateTime(b.closedAt) : "—"}</td>
                    <td className="py-2.5 px-4">{b.closedBy?.name || "—"}</td>
                    <td className="py-2.5 px-4">
                      <span className={`badge ${b.status === "OVER" ? "badge-over" : "badge-finished"}`}>{b.status}</span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold">
                      {b.shortfallGrams > 0 ? formatGrams(b.shortfallGrams) : "—"}
                    </td>
                  </tr>
                ))}
                {!batches.length && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[var(--color-coffee-soft)]">
                      No closed Khula batches in this range
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default KhulaReport;

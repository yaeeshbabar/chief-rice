import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios.js";
import Loader from "../components/Loader.jsx";
import StatCard from "../components/StatCard.jsx";
import { formatMoney, formatDateTime, monthBounds, accountLabel } from "../utils/format.js";

const quickRanges = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "", label: "Custom / All" },
];

const Payments = ({ role }) => {
  const [quick, setQuick] = useState("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (quick) params.set("quick", quick);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    api
      .get(`/payments?${params.toString()}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.message || "Could not load payments"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [quick, from, to]);

  const customerBase = role === "admin" ? "/admin/khata" : "/salesman/creditors";

  const selectMonth = (value) => {
    setMonth(value);
    setQuick("");
    const bounds = monthBounds(value);
    setFrom(bounds.from);
    setTo(bounds.to);
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-xl font-semibold text-[var(--color-coffee)]">Credit Collections (Payments)</h2>

      <div className="grain-card p-4 flex flex-wrap items-end gap-3">
        <div className="segmented">
          {quickRanges.map((r) => (
            <button
              key={r.label}
              onClick={() => {
                setQuick(r.key);
                setMonth("");
                if (r.key) {
                  setFrom("");
                  setTo("");
                }
              }}
              className={`segmented-item ${
                quick === r.key && !month && (r.key || from || to) ? "is-active" : ""
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
          <input type="date" className="field-input" value={from} onChange={(e) => { setFrom(e.target.value); setQuick(""); setMonth(""); }} />
        </div>
        <div>
          <label className="field-label">To</label>
          <input type="date" className="field-input" value={to} onChange={(e) => { setTo(e.target.value); setQuick(""); setMonth(""); }} />
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : error ? (
        <p className="grain-card p-6 text-center text-sm text-[var(--color-terracotta-deep)]">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Total Collected" value={formatMoney(data.total)} sub={`${data.count} payment(s)`} accent="sage" />
            <StatCard label="Unique Creditors Who Paid" value={new Set(data.payments.map((p) => p.customer?._id)).size} accent="wheat" />
          </div>

          <div className="grain-card overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Creditor</th>
                  <th className="py-3 px-4 font-medium">Method</th>
                  <th className="py-3 px-4 font-medium">Collected By</th>
                  <th className="py-3 px-4 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-husk)]">
                {data.payments.map((p) => (
                  <tr key={p._id} className="hover:bg-[var(--color-cream-deep)]">
                    <td className="py-2.5 px-4 whitespace-nowrap">{formatDateTime(p.createdAt)}</td>
                    <td className="py-2.5 px-4">
                      {p.customer ? (
                        <Link to={`${customerBase}/${p.customer._id}`} className="font-semibold text-[var(--color-wheat-dark)]">
                          {p.customer.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {p.paymentMethod === "online" ? accountLabel(p.account) : "Cash"}
                      {p.directToAsim && <span className="badge badge-over ml-1">Direct to Asim</span>}
                    </td>
                    <td className="py-2.5 px-4">{p.createdBy?.name}</td>
                    <td className="py-2.5 px-4 text-right font-semibold">{formatMoney(p.amount)}</td>
                  </tr>
                ))}
                {!data.payments.length && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[var(--color-coffee-soft)]">
                      No payments in this range
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

export default Payments;

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios.js";
import Loader from "../components/Loader.jsx";
import StatCard from "../components/StatCard.jsx";
import { formatMoney, formatDateTime, paymentLabel, paymentBadgeClass, monthBounds } from "../utils/format.js";

const quickRanges = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "", label: "Custom" },
];

const SalesReport = ({ role }) => {
  const [quick, setQuick] = useState("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState("");
  const [paymentType, setPaymentType] = useState("");
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
    if (paymentType) params.set("paymentType", paymentType);
    api
      .get(`/reports/sales-report?${params.toString()}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.message || "Could not load the sales report"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [quick, from, to, paymentType]);

  const invoiceBase = role === "admin" ? "/admin/invoices" : "/salesman/invoices";

  const selectMonth = (value) => {
    setMonth(value);
    setQuick("");
    const bounds = monthBounds(value);
    setFrom(bounds.from);
    setTo(bounds.to);
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="page-title">Sales report</h2>

      <div className="filter-bar">
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
          <input
            type="date"
            className="field-input"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setQuick("");
              setMonth("");
            }}
          />
        </div>
        <div>
          <label className="field-label">To</label>
          <input
            type="date"
            className="field-input"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setQuick("");
              setMonth("");
            }}
          />
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : error ? (
        <p className="grain-card p-6 text-center text-sm text-[var(--color-terracotta-deep)]">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <button onClick={() => setPaymentType("")} aria-pressed={paymentType === ""} className={`stat-pick ${paymentType === "" ? "is-on" : ""}`}>
              <StatCard label="All bills" value={formatMoney(data.totals.combinedTotal)} sub={`${data.totals.combinedCount} bills`} accent="wheat" />
            </button>
            <button onClick={() => setPaymentType("cash")} aria-pressed={paymentType === "cash"} className={`stat-pick ${paymentType === "cash" ? "is-on" : ""}`}>
              <StatCard label="Cash" value={formatMoney(data.totals.cashTotal)} sub={`${data.totals.cashCount} bills`} accent="sage" />
            </button>
            <button onClick={() => setPaymentType("credit")} aria-pressed={paymentType === "credit"} className={`stat-pick ${paymentType === "credit" ? "is-on" : ""}`}>
              <StatCard label="Credit" value={formatMoney(data.totals.creditTotal)} sub={`${data.totals.creditCount} bills`} accent="terracotta" />
            </button>
          </div>

          <div className="grain-card overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
                  <th className="py-3 px-4 font-medium">Bill #</th>
                  <th className="py-3 px-4 font-medium">Invoice #</th>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Customer</th>
                  <th className="py-3 px-4 font-medium">Payment</th>
                  <th className="py-3 px-4 font-medium">Sold by</th>
                  <th className="py-3 px-4 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-husk)]">
                {data.sales.map((s) => (
                  <tr key={s._id} className="hover:bg-[var(--color-cream-deep)]">
                    <td className="py-2.5 px-4">{s.dailyBillNumber}</td>
                    <td className="py-2.5 px-4">
                      <Link to={`${invoiceBase}/${s._id}`} className="font-semibold text-[var(--color-wheat-dark)]">
                        #{s.invoiceNumber}
                      </Link>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">{formatDateTime(s.createdAt)}</td>
                    <td className="py-2.5 px-4">{s.customer?.name || "Walk-in"}</td>
                    <td className="py-2.5 px-4">
                      <span className={`badge ${paymentBadgeClass(s)}`}>{paymentLabel(s)}</span>
                    </td>
                    <td className="py-2.5 px-4">{s.createdBy?.name}</td>
                    <td className="py-2.5 px-4 text-right font-semibold">{formatMoney(s.total)}</td>
                  </tr>
                ))}
                {!data.sales.length && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[var(--color-coffee-soft)]">
                      No bills in this range
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

export default SalesReport;

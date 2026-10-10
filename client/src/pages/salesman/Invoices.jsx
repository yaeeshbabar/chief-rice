import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios.js";
import Loader from "../../components/Loader.jsx";
import { formatMoney, formatDateTime, paymentLabel, paymentBadgeClass } from "../../utils/format.js";

const Invoices = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from: "", to: "" });

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    api
      .get(`/sales?${params.toString()}`)
      .then((res) => setSales(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-xl font-semibold text-[var(--color-coffee)]">My Bills</h2>

      <div className="grain-card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="field-label">From</label>
          <input type="date" className="field-input" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </div>
        <div>
          <label className="field-label">To</label>
          <input type="date" className="field-input" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
        <button className="btn-primary" onClick={load}>
          Apply
        </button>
      </div>

      {loading ? (
        <Loader />
      ) : (
        <div className="grain-card overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
                <th className="py-3 px-4 font-medium">Bill #</th>
                <th className="py-3 px-4 font-medium">Invoice #</th>
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">Customer</th>
                <th className="py-3 px-4 font-medium">Payment</th>
                <th className="py-3 px-4 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-husk)]">
              {sales.map((s) => (
                <tr key={s._id} className="hover:bg-[var(--color-cream-deep)]">
                  <td className="py-2.5 px-4 font-medium">{s.dailyBillNumber ?? "—"}</td>
                  <td className="py-2.5 px-4">
                    <Link to={`/salesman/invoices/${s._id}`} className="font-semibold text-[var(--color-wheat-dark)]">
                      #{s.invoiceNumber}
                    </Link>
                    {s.edited && <span className="badge badge-over ml-2">Edited</span>}
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">{formatDateTime(s.createdAt)}</td>
                  <td className="py-2.5 px-4">
                    {s.customer?.name || "Walk-in"}
                    {s.commissionAgent && (
                      <span className="block text-xs text-[var(--color-wheat-dark)]">Comm: {s.commissionAgent.name}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={`badge ${paymentBadgeClass(s)}`}>{paymentLabel(s)}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-semibold">{formatMoney(s.total)}</td>
                </tr>
              ))}
              {!sales.length && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--color-coffee-soft)]">
                    No bills yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Invoices;

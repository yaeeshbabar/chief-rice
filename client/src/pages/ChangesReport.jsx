import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios.js";
import Loader from "../components/Loader.jsx";
import Modal from "../components/Modal.jsx";
import { formatMoney, formatDateTime } from "../utils/format.js";

const ChangesReport = ({ role }) => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    api
      .get("/sales/changes")
      .then((res) => setSales(res.data))
      .catch((err) => setError(err?.response?.data?.message || "Could not load the changes report"))
      .finally(() => setLoading(false));
  }, []);

  const invoiceBase = role === "admin" ? "/admin/invoices" : "/salesman/invoices";

  if (loading) return <Loader />;
  if (error) return <p className="grain-card p-6 text-center text-sm text-[var(--color-terracotta-deep)]">{error}</p>;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-xl font-semibold text-[var(--color-coffee)]">Changes Report — Edited &amp; Deleted Bills</h2>

      <div className="grain-card overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
              <th className="py-3 px-4 font-medium">Invoice #</th>
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium">Changes</th>
              <th className="py-3 px-4 font-medium">Last Updated</th>
              <th className="py-3 px-4 font-medium text-right">Current Total</th>
              <th className="py-3 px-4 font-medium text-right">History</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-husk)]">
            {sales.map((s) => (
              <tr key={s._id}>
                <td className="py-2.5 px-4">
                  <Link to={`${invoiceBase}/${s._id}`} className="font-semibold text-[var(--color-wheat-dark)]">
                    #{s.invoiceNumber}
                  </Link>
                </td>
                <td className="py-2.5 px-4">
                  {s.cancelled ? <span className="badge badge-over">Deleted</span> : <span className="badge badge-active">Edited</span>}
                </td>
                <td className="py-2.5 px-4">{s.previousVersions?.length || 0} version(s)</td>
                <td className="py-2.5 px-4 whitespace-nowrap">{formatDateTime(s.updatedAt)}</td>
                <td className="py-2.5 px-4 text-right font-semibold">{formatMoney(s.total)}</td>
                <td className="py-2.5 px-4 text-right">
                  <button className="text-xs font-semibold text-[var(--color-wheat-dark)]" onClick={() => setViewing(s)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
            {!sales.length && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[var(--color-coffee-soft)]">
                  No bills have been edited or deleted yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`History — Invoice #${viewing?.invoiceNumber}`} wide>
        {viewing?.cancelled && (
          <div className="grain-card p-3 mb-3 border-2 border-[var(--color-terracotta-deep)] bg-[var(--surface-soft-danger)]">
            <p className="font-semibold text-[var(--color-terracotta-deep)]">Deleted by {viewing.cancelledBy?.name}</p>
            <p className="text-sm">{formatDateTime(viewing.cancelledAt)} — Reason: {viewing.cancelReason}</p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {viewing?.previousVersions?.map((v, idx) => (
            <div key={idx} className="grain-card p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[var(--ink-muted)] capitalize">
                  Version {idx + 1}: {v.action}
                </span>
                <span className="text-xs text-[var(--color-coffee-soft)]">{formatDateTime(v.changedAt)}</span>
              </div>
              <p className="text-sm">
                By {v.changedBy?.name} {v.note && `— "${v.note}"`}
              </p>
              <p className="text-sm text-[var(--color-coffee-soft)]">
                Was: {v.paymentType} · {v.customerName || "Walk-in"} · Total {formatMoney(v.total)}
              </p>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default ChangesReport;

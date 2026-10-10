import { useEffect, useState } from "react";
import api from "../../api/axios.js";
import Loader from "../../components/Loader.jsx";
import { formatMoney, formatDateTime, formatGrams } from "../../utils/format.js";

const Wapsi = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/wapsi")
      .then((res) => setRecords(res.data))
      .finally(() => setLoading(false));
  }, []);

  const totalCash = records.reduce((sum, r) => sum + (r.cashReturned || 0), 0);

  if (loading) return <Loader />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-[var(--color-coffee)]">Wapsi — Returns</h2>
        <div className="grain-card px-4 py-2">
          <p className="text-xs text-[var(--color-coffee-soft)]">Total Cash Returned</p>
          <p className="font-display font-semibold text-[var(--color-terracotta-deep)]">{formatMoney(totalCash)}</p>
        </div>
      </div>

      <div className="grain-card overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
              <th className="py-3 px-4 font-medium">Date</th>
              <th className="py-3 px-4 font-medium">Rice Type</th>
              <th className="py-3 px-4 font-medium">Type</th>
              <th className="py-3 px-4 font-medium">Quantity</th>
              <th className="py-3 px-4 font-medium">Linked Invoice</th>
              <th className="py-3 px-4 font-medium">Reason</th>
              <th className="py-3 px-4 font-medium">By</th>
              <th className="py-3 px-4 font-medium text-right">Cash Returned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-husk)]">
            {records.map((r) => (
              <tr key={r._id}>
                <td className="py-2.5 px-4 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                <td className="py-2.5 px-4">{r.riceTypeName}</td>
                <td className="py-2.5 px-4 capitalize">{r.itemType}</td>
                <td className="py-2.5 px-4">
                  {r.itemType === "khula" ? formatGrams(r.quantityGrams) : `${r.quantityBori} bori (${r.boriSize}KG)`}
                </td>
                <td className="py-2.5 px-4">{r.originalSale ? `#${r.originalSale.invoiceNumber}` : "—"}</td>
                <td className="py-2.5 px-4">{r.reason || "—"}</td>
                <td className="py-2.5 px-4">{r.createdBy?.name}</td>
                <td className="py-2.5 px-4 text-right font-semibold">{formatMoney(r.cashReturned)}</td>
              </tr>
            ))}
            {!records.length && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--color-coffee-soft)]">
                  No returns recorded yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Wapsi;

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Undo2 } from "lucide-react";
import api from "../../api/axios.js";
import Loader from "../../components/Loader.jsx";
import StatCard from "../../components/StatCard.jsx";
import UndoWapsiModal from "../../components/UndoWapsiModal.jsx";
import { PhoneList, PhoneRow } from "../../components/PhoneList.jsx";
import { useIsPhone } from "../../utils/useIsPhone.js";
import { formatMoney, formatDateTime } from "../../utils/format.js";
import { returnCash, returnItemsText, returnMoneyText } from "../../utils/wapsi.js";

const Wapsi = () => {
  const isPhone = useIsPhone();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [undoTarget, setUndoTarget] = useState(null);

  const load = () => {
    api
      .get("/wapsi")
      .then((res) => setRecords(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const totalCash = records.reduce((sum, r) => sum + returnCash(r), 0);
  const totalKhata = records.reduce((sum, r) => sum + (r.balanceAdjustment || 0), 0);

  if (loading) return <Loader />;

  const undoButton = (r) => (
    <button className="icon-btn h-8 w-8" onClick={() => setUndoTarget(r)} title="Undo this return" aria-label="Undo this return">
      <Undo2 size={15} />
    </button>
  );
  const invoiceLink = (r) =>
    r.originalSale ? (
      <Link to={`/admin/invoices/${r.originalSale._id}`} className="font-medium text-[var(--accent-ink)] hover:underline">
        #{r.originalSale.invoiceNumber}
      </Link>
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="page-title">Wapsi (returns)</h2>
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Cash given back" value={formatMoney(totalCash)} accent="terracotta" />
        <StatCard label="Cut from khata" value={formatMoney(totalKhata)} accent="wheat" />
      </div>

      <div className="grain-card overflow-x-auto">
        {isPhone ? (
          <PhoneList empty="No returns recorded yet">
            {records.map((r) => (
              <PhoneRow
                key={r._id}
                title={returnItemsText(r)}
                sub={
                  <>
                    {returnMoneyText(r)}
                    {r.originalSale && <>, invoice {invoiceLink(r)}</>}
                  </>
                }
                meta={[formatDateTime(r.createdAt), r.createdBy?.name, r.reason].filter(Boolean).join(", ")}
                actions={undoButton(r)}
              />
            ))}
          </PhoneList>
        ) : (
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">Returned</th>
                <th className="py-3 px-4 font-medium">Money back</th>
                <th className="py-3 px-4 font-medium">Invoice</th>
                <th className="py-3 px-4 font-medium">Reason</th>
                <th className="py-3 px-4 font-medium">By</th>
                <th className="relative py-3 px-2 w-12">
                  <span className="sr-only">Undo</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-husk)]">
              {records.map((r) => (
                <tr key={r._id} className="align-top">
                  <td className="py-2.5 px-4 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                  <td className="py-2.5 px-4">{returnItemsText(r)}</td>
                  <td className="py-2.5 px-4">{returnMoneyText(r)}</td>
                  <td className="py-2.5 px-4">{invoiceLink(r) || "—"}</td>
                  <td className="py-2.5 px-4">{r.reason || "—"}</td>
                  <td className="py-2.5 px-4">{r.createdBy?.name}</td>
                  <td className="py-1 px-2">{undoButton(r)}</td>
                </tr>
              ))}
              {!records.length && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--color-coffee-soft)]">
                    No returns recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <UndoWapsiModal target={undoTarget} onClose={() => setUndoTarget(null)} onDone={load} />
    </div>
  );
};

export default Wapsi;

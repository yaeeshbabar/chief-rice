import { useEffect, useState } from "react";
import { Undo2 } from "lucide-react";
import api from "../../api/axios.js";
import Loader from "../../components/Loader.jsx";
import UndoWapsiModal from "../../components/UndoWapsiModal.jsx";
import { formatMoney, formatDateTime, formatGrams } from "../../utils/format.js";

const Wapsi = () => {
  const [riceTypes, setRiceTypes] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [itemType, setItemType] = useState("khula");
  const [riceTypeId, setRiceTypeId] = useState("");
  const [boriSize, setBoriSize] = useState(25);
  const [quantityBori, setQuantityBori] = useState("");
  const [quantityGrams, setQuantityGrams] = useState("");
  const [cashReturned, setCashReturned] = useState("");
  const [reason, setReason] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [matchedInvoice, setMatchedInvoice] = useState(null);
  const [adjustCustomerBalance, setAdjustCustomerBalance] = useState(false);
  const [undoTarget, setUndoTarget] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .get("/wapsi")
      .then((res) => setRecords(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get("/rice-types").then((res) => setRiceTypes(res.data));
  }, []);

  const searchInvoice = async () => {
    if (!invoiceSearch.trim()) return;
    setError("");
    try {
      const { data } = await api.get(`/sales?invoiceNumber=${encodeURIComponent(invoiceSearch.trim())}`);
      setMatchedInvoice(data[0] || null);
      if (!data.length) setError(`No invoice found with number ${invoiceSearch.trim()}`);
    } catch {
      setError("Could not search for that invoice");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!riceTypeId) {
      setError("Select a rice type");
      return;
    }
    setSaving(true);
    try {
      await api.post("/wapsi", {
        originalSaleId: matchedInvoice?._id,
        itemType,
        riceTypeId,
        boriSize: itemType === "bori" ? boriSize : undefined,
        quantityBori: itemType === "bori" ? Number(quantityBori) : undefined,
        quantityGrams: itemType === "khula" ? Number(quantityGrams) : undefined,
        cashReturned: Number(cashReturned || 0),
        reason,
        adjustCustomerBalance,
      });
      setSuccess("Return recorded successfully");
      setQuantityBori("");
      setQuantityGrams("");
      setCashReturned("");
      setReason("");
      setInvoiceSearch("");
      setMatchedInvoice(null);
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not record the return");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <h2 className="lg:col-span-3 page-title">Wapsi (return)</h2>
      <div className="grain-card p-4 flex flex-col gap-3 h-fit">
        <h3 className="section-title">Record a return (wapsi)</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="field-label">Return type</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setItemType("khula")} className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${itemType === "khula" ? "border-[var(--color-wheat)] bg-[var(--color-cream-deep)]" : "border-[var(--color-husk)]"}`}>
                Khula
              </button>
              <button type="button" onClick={() => setItemType("bori")} className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${itemType === "bori" ? "border-[var(--color-wheat)] bg-[var(--color-cream-deep)]" : "border-[var(--color-husk)]"}`}>
                Bori
              </button>
            </div>
          </div>
          <div>
            <label className="field-label">Rice type</label>
            <select className="field-input" value={riceTypeId} onChange={(e) => setRiceTypeId(e.target.value)} required>
              <option value="">Select</option>
              {riceTypes.map((rt) => (
                <option key={rt._id} value={rt._id}>
                  {rt.name}
                </option>
              ))}
            </select>
          </div>
          {itemType === "bori" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Bori size</label>
                <select className="field-input" value={boriSize} onChange={(e) => setBoriSize(Number(e.target.value))}>
                  <option value={25}>25 KG</option>
                  <option value={50}>50 KG</option>
                </select>
              </div>
              <div>
                <label className="field-label">Quantity (bori)</label>
                <input type="number" min="1" className="field-input" value={quantityBori} onChange={(e) => setQuantityBori(e.target.value)} required />
              </div>
            </div>
          ) : (
            <div>
              <label className="field-label">Quantity (grams)</label>
              <input type="number" min="1" className="field-input" value={quantityGrams} onChange={(e) => setQuantityGrams(e.target.value)} required />
              <p className="text-xs text-[var(--ink-muted)] mt-1.5">It is added to this rice type&apos;s khula.</p>
            </div>
          )}

          <div>
            <label className="field-label">Invoice # (optional)</label>
            <div className="flex gap-2">
              <input className="field-input" value={invoiceSearch} onChange={(e) => setInvoiceSearch(e.target.value)} placeholder="e.g. 105" />
              <button type="button" className="btn-outline" onClick={searchInvoice}>
                Find
              </button>
            </div>
            {invoiceSearch && (
              <p className="text-xs mt-1 text-[var(--color-coffee-soft)]">
                {matchedInvoice ? `Matched invoice #${matchedInvoice.invoiceNumber} (${matchedInvoice.paymentType})` : "No matching invoice found"}
              </p>
            )}
          </div>

          {matchedInvoice?.paymentType === "credit" && (
            <label className="flex items-center gap-2 text-sm text-[var(--color-coffee-soft)]">
              <input type="checkbox" checked={adjustCustomerBalance} onChange={(e) => setAdjustCustomerBalance(e.target.checked)} />
              Reduce this customer's khata balance instead of cash
            </label>
          )}

          <div>
            <label className="field-label">Cash returned (Rs)</label>
            <input type="number" min="0" className="field-input" value={cashReturned} onChange={(e) => setCashReturned(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Reason</label>
            <input className="field-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. quality complaint" />
          </div>
          {error && <p className="text-sm text-[var(--color-terracotta-deep)]">{error}</p>}
          {success && <p className="text-sm text-[var(--color-sage-deep)]">{success}</p>}
          <button className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Record return"}
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 grain-card overflow-x-auto">
        {loading ? (
          <Loader />
        ) : (
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">Rice</th>
                <th className="py-3 px-4 font-medium">Qty</th>
                <th className="py-3 px-4 font-medium text-right">Cash</th>
                <th className="relative py-3 px-2 w-12">
                  <span className="sr-only">Undo</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-husk)]">
              {records.map((r) => (
                <tr key={r._id}>
                  <td className="py-2.5 px-4 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                  <td className="py-2.5 px-4">{r.riceTypeName}</td>
                  <td className="py-2.5 px-4">{r.itemType === "khula" ? formatGrams(r.quantityGrams) : `${r.quantityBori} bori`}</td>
                  <td className="py-2.5 px-4 text-right font-semibold">{formatMoney(r.cashReturned)}</td>
                  <td className="py-1 px-2">
                    <button className="icon-btn h-8 w-8" onClick={() => setUndoTarget(r)} title="Undo this return" aria-label="Undo this return">
                      <Undo2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {!records.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[var(--color-coffee-soft)]">
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

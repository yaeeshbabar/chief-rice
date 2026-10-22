import { useEffect, useState } from "react";
import { Plus, Undo2, X } from "lucide-react";
import api from "../../api/axios.js";
import Loader from "../../components/Loader.jsx";
import CustomerPicker from "../../components/CustomerPicker.jsx";
import UndoWapsiModal from "../../components/UndoWapsiModal.jsx";
import { PhoneList, PhoneRow } from "../../components/PhoneList.jsx";
import { useIsPhone } from "../../utils/useIsPhone.js";
import { formatMoney, formatDateTime } from "../../utils/format.js";
import { returnItemText, returnItemsText, returnMoneyText } from "../../utils/wapsi.js";

const blankDraft = { itemType: "khula", riceTypeId: "", boriSize: 25, quantityBori: "", quantityGrams: "" };

const Wapsi = () => {
  const isPhone = useIsPhone();
  const [riceTypes, setRiceTypes] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [who, setWho] = useState("cash"); // "cash" = walk-in, money back in cash; "khata" = creditor
  const [customerId, setCustomerId] = useState("");
  const [balanceInfo, setBalanceInfo] = useState({ id: "", balance: null });
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState(blankDraft);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [matchedInvoice, setMatchedInvoice] = useState(null);
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

  // The creditor's current balance, so the amount can't be more than they owe
  useEffect(() => {
    if (!customerId) return undefined;
    let active = true;
    api.get(`/customers/${customerId}`).then((res) => active && setBalanceInfo({ id: customerId, balance: res.data.customer.balance }));
    return () => {
      active = false;
    };
  }, [customerId]);
  const customerBalance = customerId && balanceInfo.id === customerId ? balanceInfo.balance : null;

  const riceName = (id) => riceTypes.find((rt) => rt._id === id)?.name || "";

  // A filled-in item line, or an error message
  const readDraft = () => {
    if (!draft.riceTypeId) return { error: "Pick the rice type" };
    if (draft.itemType === "bori") {
      const qty = Number(draft.quantityBori);
      if (!Number.isInteger(qty) || qty < 1) return { error: "Enter how many bori came back" };
      return { item: { itemType: "bori", riceTypeId: draft.riceTypeId, riceTypeName: riceName(draft.riceTypeId), boriSize: Number(draft.boriSize), quantityBori: qty } };
    }
    const grams = Math.round(Number(draft.quantityGrams));
    if (!Number.isFinite(grams) || grams <= 0) return { error: "Enter the khula weight in grams" };
    return { item: { itemType: "khula", riceTypeId: draft.riceTypeId, riceTypeName: riceName(draft.riceTypeId), quantityGrams: grams } };
  };
  const draftStarted = Boolean(draft.riceTypeId || draft.quantityBori || draft.quantityGrams);

  const addItem = () => {
    setError("");
    const { item, error: problem } = readDraft();
    if (problem) return setError(problem);
    setItems((list) => [...list, item]);
    setDraft((d) => ({ ...d, quantityBori: "", quantityGrams: "" }));
  };

  const searchInvoice = async () => {
    if (!invoiceSearch.trim()) return;
    setError("");
    try {
      const { data } = await api.get(`/sales?invoiceNumber=${encodeURIComponent(invoiceSearch.trim())}`);
      const found = data[0] || null;
      setMatchedInvoice(found);
      if (!found) setError(`No invoice found with number ${invoiceSearch.trim()}`);
      // A credit bill: the return comes off that creditor's khata
      if (found?.paymentType === "credit" && found.customer) {
        setWho("khata");
        setCustomerId(found.customer._id || found.customer);
      }
    } catch {
      setError("Could not search for that invoice");
    }
  };

  const resetForm = () => {
    setItems([]);
    setDraft(blankDraft);
    setAmount("");
    setReason("");
    setInvoiceSearch("");
    setMatchedInvoice(null);
    setWho("cash");
    setCustomerId("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const all = [...items];
    if (draftStarted) {
      const { item, error: problem } = readDraft();
      if (problem) return setError(problem);
      all.push(item);
    }
    if (!all.length) return setError("Add at least one bori or khula item");
    const money = Number(amount || 0);
    if (!Number.isFinite(money) || money < 0) return setError("Enter a valid amount");
    if (who === "khata") {
      if (!customerId) return setError("Pick the creditor");
      if (customerBalance !== null && money > customerBalance) {
        return setError(`This creditor owes only ${formatMoney(customerBalance)}`);
      }
    }
    setSaving(true);
    try {
      await api.post("/wapsi", {
        items: all.map((i) => ({
          itemType: i.itemType,
          riceTypeId: i.riceTypeId,
          boriSize: i.itemType === "bori" ? i.boriSize : undefined,
          quantityBori: i.itemType === "bori" ? i.quantityBori : undefined,
          quantityGrams: i.itemType === "khula" ? i.quantityGrams : undefined,
        })),
        refundTo: who,
        customerId: who === "khata" ? customerId : undefined,
        amount: money,
        originalSaleId: matchedInvoice?._id,
        reason,
      });
      setSuccess("Return recorded");
      resetForm();
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not record the return");
    } finally {
      setSaving(false);
    }
  };

  const undoButton = (r) => (
    <button className="icon-btn h-8 w-8" onClick={() => setUndoTarget(r)} title="Undo this return" aria-label="Undo this return">
      <Undo2 size={15} />
    </button>
  );

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <h2 className="lg:col-span-3 page-title">Wapsi (return)</h2>
      <div className="grain-card p-4 flex flex-col gap-3 h-fit">
        <h3 className="section-title">Record a return</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <p className="field-label">Who is returning</p>
            <div className="segmented w-full">
              {[
                { key: "cash", label: "Walk-in (cash back)" },
                { key: "khata", label: "Creditor (khata)" },
              ].map((o) => (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={who === o.key}
                  onClick={() => setWho(o.key)}
                  className={`segmented-item flex-1 ${who === o.key ? "is-active" : ""}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {who === "khata" && (
            <CustomerPicker existingOnly selectedId={customerId} onSelect={setCustomerId} />
          )}

          <div className="rounded-lg border border-[var(--line)] p-3 flex flex-col gap-3">
            <p className="text-sm font-medium">Items coming back</p>
            {items.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {items.map((i, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-2 rounded-md bg-[var(--bg-subtle)] px-2.5 py-1.5 text-sm">
                    <span>{returnItemText(i)}</span>
                    <button
                      type="button"
                      className="icon-btn h-7 w-7"
                      aria-label={`Remove ${returnItemText(i)}`}
                      onClick={() => setItems((list) => list.filter((_, n) => n !== idx))}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="segmented w-full">
              {[
                { key: "khula", label: "Khula" },
                { key: "bori", label: "Bori" },
              ].map((o) => (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={draft.itemType === o.key}
                  onClick={() => setDraft((d) => ({ ...d, itemType: o.key }))}
                  className={`segmented-item flex-1 ${draft.itemType === o.key ? "is-active" : ""}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div>
              <label className="field-label" htmlFor="return-rice">
                Rice type
              </label>
              <select
                id="return-rice"
                className="field-input"
                value={draft.riceTypeId}
                onChange={(e) => setDraft((d) => ({ ...d, riceTypeId: e.target.value }))}
              >
                <option value="">Select</option>
                {riceTypes.map((rt) => (
                  <option key={rt._id} value={rt._id}>
                    {rt.name}
                  </option>
                ))}
              </select>
            </div>
            {draft.itemType === "bori" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label" htmlFor="return-size">
                    Bori size
                  </label>
                  <select
                    id="return-size"
                    className="field-input"
                    value={draft.boriSize}
                    onChange={(e) => setDraft((d) => ({ ...d, boriSize: Number(e.target.value) }))}
                  >
                    <option value={25}>25 KG</option>
                    <option value={50}>50 KG</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="return-bori">
                    How many bori
                  </label>
                  <input
                    id="return-bori"
                    type="number"
                    min="1"
                    className="field-input"
                    value={draft.quantityBori}
                    onChange={(e) => setDraft((d) => ({ ...d, quantityBori: e.target.value }))}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="field-label" htmlFor="return-grams">
                  Weight (grams)
                </label>
                <input
                  id="return-grams"
                  type="number"
                  min="1"
                  className="field-input"
                  value={draft.quantityGrams}
                  onChange={(e) => setDraft((d) => ({ ...d, quantityGrams: e.target.value }))}
                  placeholder="e.g. 3500"
                />
              </div>
            )}
            <button type="button" className="btn-outline" onClick={addItem}>
              <Plus size={15} />
              Add item
            </button>
          </div>

          <div>
            <label className="field-label" htmlFor="return-amount">
              {who === "khata" ? "Cut from khata (Rs)" : "Cash given back (Rs)"}
            </label>
            <input
              id="return-amount"
              type="number"
              min="0"
              className="field-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {who === "khata" && customerBalance !== null && (
              <p className="text-xs text-[var(--ink-muted)] mt-1.5">Owes {formatMoney(customerBalance)} now</p>
            )}
          </div>

          <div>
            <label className="field-label" htmlFor="return-invoice">
              Invoice # (optional)
            </label>
            <div className="flex gap-2">
              <input
                id="return-invoice"
                className="field-input"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                placeholder="e.g. 105"
              />
              <button type="button" className="btn-outline" onClick={searchInvoice}>
                Find
              </button>
            </div>
            {matchedInvoice && (
              <p className="text-xs mt-1 text-[var(--ink-muted)]">
                Invoice #{matchedInvoice.invoiceNumber}, {matchedInvoice.paymentType === "credit" ? matchedInvoice.customer?.name || "credit" : "cash"}
              </p>
            )}
          </div>
          <div>
            <label className="field-label" htmlFor="return-reason">
              Reason
            </label>
            <input
              id="return-reason"
              className="field-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. quality complaint"
            />
          </div>
          {error && <p className="text-sm text-[var(--neg-ink)] bg-[var(--neg-tint)] rounded-lg px-3 py-2">{error}</p>}
          {success && <p className="text-sm text-[var(--pos-ink)]">{success}</p>}
          <button className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Record return"}
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 grain-card overflow-x-auto h-fit">
        {loading ? (
          <Loader />
        ) : isPhone ? (
          <PhoneList empty="No returns recorded yet">
            {records.map((r) => (
              <PhoneRow
                key={r._id}
                title={returnItemsText(r)}
                sub={returnMoneyText(r)}
                meta={formatDateTime(r.createdAt)}
                actions={undoButton(r)}
              />
            ))}
          </PhoneList>
        ) : (
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">Returned</th>
                <th className="py-3 px-4 font-medium">Money back</th>
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
                  <td className="py-1 px-2">{undoButton(r)}</td>
                </tr>
              ))}
              {!records.length && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[var(--color-coffee-soft)]">
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

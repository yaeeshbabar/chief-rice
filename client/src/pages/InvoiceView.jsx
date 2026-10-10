import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, History, Pencil, Printer, Trash2 } from "lucide-react";
import api from "../api/axios.js";
import Loader from "../components/Loader.jsx";
import Modal from "../components/Modal.jsx";
import CustomerPicker from "../components/CustomerPicker.jsx";
import ThermalReceipt from "../components/ThermalReceipt.jsx";
import BrandMark from "../components/BrandMark.jsx";
import { printInvoice } from "../utils/printReceipt.js";
import { formatMoney, formatGrams, formatDateTime, paymentLabel, paymentBadgeClass } from "../utils/format.js";
import { useAuth } from "../context/AuthContext.jsx";

const InvoiceView = ({ role }) => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sale, setSale] = useState(null);
  const [riceTypes, setRiceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [asimAccounts, setAsimAccounts] = useState([]);
  useEffect(() => {
    api.get("/bank-accounts?ownerType=asim").then((r) => setAsimAccounts(r.data)).catch(() => {});
  }, []);

  const printAs = printInvoice;

  const load = () => {
    setLoading(true);
    api
      .get(`/sales/${id}`)
      .then((res) => setSale(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);
  useEffect(() => {
    api.get("/rice-types").then((res) => setRiceTypes(res.data));
  }, []);

  const openEdit = () => {
    setError("");
    setForm({
      paymentType: sale.paymentType,
      addingNewCustomer: false,
      selectedCustomerId: sale.customer?._id || "",
      newCustomer: { name: "", shopName: "", phone: "", address: "" },
      items: sale.items.map((i) => ({ ...i, riceTypeId: i.riceType?._id || i.riceType })),
      editNote: "",
    });
    setShowEdit(true);
  };

  const updateItem = (idx, field, value) => {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: field === "riceTypeId" ? value : Number(value) };
      if (field === "riceTypeId") {
        const rt = riceTypes.find((r) => r._id === value);
        items[idx].riceTypeName = rt?.name || items[idx].riceTypeName;
      }
      items[idx].total =
        items[idx].itemType === "khula"
          ? (items[idx].quantityGrams / 1000) * items[idx].pricePerUnit
          : items[idx].quantityBori * items[idx].pricePerUnit;
      return { ...f, items };
    });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        paymentType: form.paymentType,
        editNote: form.editNote,
        items: form.items.map((i) => ({
          itemType: i.itemType,
          riceTypeId: i.riceTypeId,
          boriSize: i.boriSize,
          khulaBatchId: i.khulaBatch,
          quantityGrams: i.quantityGrams,
          quantityBori: i.quantityBori,
          pricePerUnit: i.pricePerUnit,
        })),
      };
      if (form.paymentType === "credit") {
        if (form.addingNewCustomer) payload.newCustomer = form.newCustomer;
        else payload.customerId = form.selectedCustomerId;
      }
      await api.patch(`/sales/${id}`, payload);
      setShowEdit(false);
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not update invoice");
    } finally {
      setSaving(false);
    }
  };

  const submitCancel = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      setError("A reason is required to delete/cancel a bill");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post(`/sales/${id}/cancel`, { reason: cancelReason });
      navigate(role === "admin" ? "/admin/invoices" : "/salesman/invoices");
    } catch (err) {
      setError(err?.response?.data?.message || "Could not cancel this invoice");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;
  if (!sale) return <p>Invoice not found.</p>;

  const backTo = role === "admin" ? "/admin/invoices" : "/salesman/invoices";
  const canEdit = !sale.cancelled;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          <ArrowLeft size={16} />
          Back
        </Link>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <>
              <button className="btn-outline" onClick={openEdit}>
                <Pencil size={15} />
                Edit invoice
              </button>
              <button className="btn-danger-quiet" onClick={() => setShowCancel(true)}>
                <Trash2 size={15} />
                Delete / cancel
              </button>
            </>
          )}
          <button className="btn-outline" onClick={() => printAs("a4")} title="Print on a normal A4 page">
            <FileText size={15} />
            Print A4
          </button>
          <button className="btn-primary" onClick={() => printAs("thermal")} title="Print on an 80mm thermal receipt roll">
            <Printer size={15} />
            Print 80mm receipt
          </button>
        </div>
      </div>

      {sale.cancelled && (
        <div className="rounded-xl border border-[var(--neg)] bg-[var(--neg-tint)] p-4">
          <p className="font-semibold text-[var(--neg-ink)]">This invoice was cancelled/deleted.</p>
          <p className="text-sm text-[var(--color-coffee-soft)]">
            By {sale.cancelledBy?.name} on {formatDateTime(sale.cancelledAt)} — Reason: {sale.cancelReason}
          </p>
        </div>
      )}

      <div id="invoice-print" className="grain-card p-6 sm:p-8 max-w-2xl mx-auto w-full">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-5 mb-5">
          <div className="flex items-center gap-3">
            <BrandMark className="h-10 w-10 shrink-0" />
            <div className="leading-snug">
              <p className="text-lg font-semibold tracking-tight text-[var(--ink)]">Chief Rice Trader</p>
              <p className="text-xs text-[var(--ink-muted)]">Asim Siddique, rice wholesale &amp; retail</p>
            </div>
          </div>
          <div className="text-right leading-snug">
            <p className="text-xs text-[var(--ink-muted)]">Invoice</p>
            <p className="text-xl font-semibold tracking-tight text-[var(--ink)]">#{sale.invoiceNumber}</p>
            <p className="text-xs text-[var(--ink-muted)]">Bill #{sale.dailyBillNumber} today</p>
            <p className="text-xs text-[var(--ink-muted)]">{formatDateTime(sale.createdAt)}</p>
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-4 mb-5 text-sm">
          <div>
            <p className="text-[var(--ink-muted)] text-xs mb-1">Customer</p>
            {sale.customer ? (
              <>
                <p className="font-semibold">{sale.customer.name}</p>
                {sale.customer.shopName && <p className="text-[var(--color-coffee-soft)]">{sale.customer.shopName}</p>}
                {sale.customer.phone && <p className="text-[var(--color-coffee-soft)]">{sale.customer.phone}</p>}
              </>
            ) : (
              <p className="font-semibold">Walk-in Customer (Cash)</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[var(--ink-muted)] text-xs mb-1">Payment</p>
            <span className={`badge ${paymentBadgeClass(sale)}`}>{paymentLabel(sale)}</span>
            <p className="text-[var(--color-coffee-soft)] mt-1">Sold by {sale.createdBy?.name}</p>
          </div>
        </div>

        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 font-medium">Qty</th>
              <th className="py-2 font-medium text-right">Rate</th>
              <th className="py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-husk)]">
            {sale.items.map((item, idx) => (
              <tr key={idx}>
                <td className="py-2">
                  {item.riceTypeName || item.riceType?.name}
                  <span className="text-[var(--color-coffee-soft)]"> · {item.itemType === "khula" ? "Khula" : `${item.boriSize}KG Bori`}</span>
                </td>
                <td className="py-2">{item.itemType === "khula" ? formatGrams(item.quantityGrams) : `${item.quantityBori} bori`}</td>
                <td className="py-2 text-right">
                  {formatMoney(item.pricePerUnit)} / {item.itemType === "khula" ? "KG" : "bori"}
                </td>
                <td className="py-2 text-right font-medium">{formatMoney(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-col items-end gap-1 text-sm">
          <div className="flex justify-between w-48 font-display text-lg font-semibold pt-1 border-t border-[var(--color-husk)] mt-1">
            <span>Total</span>
            <span>{formatMoney(sale.total)}</span>
          </div>
        </div>

        {sale.edited && (
          <button
            onClick={() => setShowHistory(true)}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--warn-ink)] hover:underline"
          >
            <History size={14} />
            Edited {sale.previousVersions?.length} time(s). View history
          </button>
        )}
        <p className="mt-6 text-center text-xs text-[var(--color-coffee-soft)]">Thank you for your business.</p>
      </div>

      {(sale.commissionAgent || user?.role === "admin") && (
        <div className="grain-card p-5 max-w-2xl mx-auto w-full">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h3 className="font-semibold tracking-tight text-[var(--ink)]">Commission &amp; profit</h3>
            <span className="text-xs text-[var(--ink-muted)]">Internal only, never printed</span>
          </div>
          <div className="flex flex-col divide-y divide-[var(--color-husk)] text-sm">
            {user?.role === "admin" && (
              <div className="flex justify-between py-2">
                <span className="text-[var(--color-coffee-soft)]">Cost of goods</span>
                <span>{formatMoney(sale.costOfGoods)}</span>
              </div>
            )}
            {sale.rideCost > 0 && (
              <div className="flex justify-between py-2">
                <span className="text-[var(--color-coffee-soft)]">Ride / delivery cost (store expense)</span>
                <span>{formatMoney(sale.rideCost)}</span>
              </div>
            )}
            {sale.commissionAgent ? (
              <div className="flex justify-between py-2">
                <span className="text-[var(--color-coffee-soft)]">
                  Commission — {sale.commissionAgent.name} ({sale.commissionPercent}% of profit)
                </span>
                <span className="font-semibold text-[var(--color-wheat-dark)]">{formatMoney(sale.commissionAmount)}</span>
              </div>
            ) : (
              <div className="flex justify-between py-2">
                <span className="text-[var(--color-coffee-soft)]">Commission agent</span>
                <span>None selected on this bill</span>
              </div>
            )}
            {user?.role === "admin" && (
              <div className="flex justify-between py-2 font-semibold">
                <span>Asim's profit on this bill</span>
                <span className={sale.profit < 0 ? "text-[var(--color-terracotta-deep)]" : "text-[var(--color-sage-deep)]"}>
                  {formatMoney(sale.profit)}
                </span>
              </div>
            )}
          </div>
          {sale.commissionAgent && sale.commissionAmount === 0 && (
            <p className="text-xs text-[var(--color-terracotta-deep)] mt-2">
              An agent was selected but this bill's profit was zero or negative (sale price didn't clear the cost + ride
              cost), so no commission was earned on it.
            </p>
          )}
        </div>
      )}

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={`Edit Invoice #${sale.invoiceNumber}`} wide>
        {form && (
          <form onSubmit={submitEdit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="bg-[var(--color-cream-deep)] rounded-lg p-3 text-sm flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-coffee-soft)]">
                      Item {idx + 1} — {item.itemType === "khula" ? "Khula" : `${item.boriSize}KG Bori`}
                    </span>
                    <span className="font-semibold">{formatMoney(item.total)}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="field-label">Rice Type</label>
                      <select
                        className="field-input"
                        value={item.riceTypeId}
                        onChange={(e) => updateItem(idx, "riceTypeId", e.target.value)}
                      >
                        {riceTypes.map((rt) => (
                          <option key={rt._id} value={rt._id}>
                            {rt.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {item.itemType === "khula" ? (
                      <div>
                        <label className="field-label">Quantity (grams)</label>
                        <input
                          type="number"
                          className="field-input"
                          value={item.quantityGrams}
                          onChange={(e) => updateItem(idx, "quantityGrams", e.target.value)}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="field-label">Quantity (bori)</label>
                        <input
                          type="number"
                          className="field-input"
                          value={item.quantityBori}
                          onChange={(e) => updateItem(idx, "quantityBori", e.target.value)}
                        />
                      </div>
                    )}
                    <div>
                      <label className="field-label">Price / Unit (Rs)</label>
                      <input
                        type="number"
                        className="field-input"
                        value={item.pricePerUnit}
                        onChange={(e) => updateItem(idx, "pricePerUnit", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-xs text-[var(--color-coffee-soft)]">
                Note: changing rice type on a Khula item keeps it linked to the same batch — only change type between
                rice types that share that batch, or delete and re-bill instead for a clean switch.
              </p>
            </div>

            <div>
              <label className="field-label">Payment Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, paymentType: "cash" })}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${form.paymentType === "cash" ? "border-[var(--color-sage-deep)] bg-[var(--surface-soft)]" : "border-[var(--color-husk)]"}`}
                >
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, paymentType: "credit" })}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${form.paymentType === "credit" ? "border-[var(--color-terracotta-deep)] bg-[var(--surface-soft-danger)]" : "border-[var(--color-husk)]"}`}
                >
                  Credit (Khata)
                </button>
              </div>
            </div>

            {form.paymentType === "credit" && (
              <CustomerPicker
                addingNew={form.addingNewCustomer}
                onModeChange={(v) => setForm({ ...form, addingNewCustomer: v })}
                selectedId={form.selectedCustomerId}
                onSelect={(idVal) => setForm({ ...form, selectedCustomerId: idVal })}
                newCustomer={form.newCustomer}
                onNewCustomerChange={(nc) => setForm({ ...form, newCustomer: nc })}
              />
            )}

            <div>
              <label className="field-label">Reason for edit (kept in the invoice's history)</label>
              <input
                className="field-input"
                value={form.editNote}
                onChange={(e) => setForm({ ...form, editNote: e.target.value })}
                placeholder="e.g. wrong price entered, changed customer"
                required
              />
            </div>
            {error && <p className="text-sm text-[var(--color-terracotta-deep)]">{error}</p>}
            <button className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        )}
      </Modal>

      <Modal open={showCancel} onClose={() => setShowCancel(false)} title="Delete / Cancel Invoice">
        <form onSubmit={submitCancel} className="flex flex-col gap-3">
          <p className="text-sm text-[var(--color-coffee-soft)]">
            This reverts all stock/khata effects of this bill but keeps a permanent record for the Changes Report -
            it's never truly erased.
          </p>
          <div>
            <label className="field-label">Reason (required)</label>
            <input className="field-input" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} required autoFocus />
          </div>
          {error && <p className="text-sm text-[var(--color-terracotta-deep)]">{error}</p>}
          <button className="btn-danger" disabled={saving}>
            {saving ? "Cancelling..." : "Confirm Delete / Cancel"}
          </button>
        </form>
      </Modal>

      <Modal open={showHistory} onClose={() => setShowHistory(false)} title="Version History" wide>
        <div className="flex flex-col gap-3">
          {sale.previousVersions?.map((v, idx) => (
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
          {!sale.previousVersions?.length && <p className="text-sm text-[var(--color-coffee-soft)]">No changes recorded.</p>}
        </div>
      </Modal>

      <ThermalReceipt sale={sale} asimAccounts={asimAccounts} />
    </div>
  );
};

export default InvoiceView;

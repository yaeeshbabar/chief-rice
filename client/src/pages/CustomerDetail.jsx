import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "../api/axios.js";
import Loader from "../components/Loader.jsx";
import Modal from "../components/Modal.jsx";
import AccountSelect from "../components/AccountSelect.jsx";
import { formatMoney, formatDateTime, accountLabel } from "../utils/format.js";

const CustomerDetail = ({ role }) => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPay, setShowPay] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payAccountId, setPayAccountId] = useState("");
  const [payNote, setPayNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const backTo = role === "admin" ? "/admin/khata" : "/salesman/creditors";
  const invoiceBase = role === "admin" ? "/admin/invoices" : "/salesman/invoices";

  const load = () => {
    setLoading(true);
    Promise.all([api.get(`/customers/${id}`), api.get(`/customers/${id}/payments`)])
      .then(([c, p]) => {
        setData(c.data);
        setPayments(p.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const openPay = (full) => {
    setError("");
    setPayNote("");
    setPayMethod("cash");
    setPayAccountId("");
    setPayAmount(full ? String(data.customer.balance) : "");
    setShowPay(true);
  };

  const submitPay = async (e) => {
    e.preventDefault();
    setError("");
    if (!payAmount || Number(payAmount) <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (payMethod === "online" && !payAccountId) {
      setError("Select which account the payment went into");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/customers/${id}/payments`, {
        amount: payAmount,
        note: payNote,
        paymentMethod: payMethod,
        accountId: payMethod === "online" ? payAccountId : undefined,
      });
      setShowPay(false);
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not record payment");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;
  if (!data) return <p>Customer not found.</p>;

  const { customer, sales } = data;

  return (
    <div className="flex flex-col gap-6">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-muted)] hover:text-[var(--ink)] w-fit"
      >
        <ArrowLeft size={16} />
        Back
      </Link>

      <div className="grain-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-coffee)]">{customer.name}</h2>
          <p className="text-sm text-[var(--color-coffee-soft)]">
            {customer.shopName ? `${customer.shopName} · ` : ""}
            {customer.phone || "No phone"}
          </p>
          {customer.address && <p className="text-sm text-[var(--color-coffee-soft)]">{customer.address}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--ink-muted)]">Outstanding balance</p>
          <p className="font-display text-2xl font-semibold text-[var(--color-terracotta-deep)] mb-2">{formatMoney(customer.balance)}</p>
          {customer.balance > 0 && (
            <div className="flex gap-2 justify-end">
              <button className="btn-outline text-xs px-3 py-1.5" onClick={() => openPay(false)}>
                Pay Partial
              </button>
              <button className="btn-primary text-xs px-3 py-1.5" onClick={() => openPay(true)}>
                Pay Full
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grain-card overflow-x-auto">
          <div className="px-4 pt-4">
            <h3 className="font-display font-semibold text-[var(--color-coffee)] mb-1">Bills</h3>
          </div>
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
                <th className="py-3 px-4 font-medium">Invoice #</th>
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">Items</th>
                <th className="py-3 px-4 font-medium text-right">Total</th>
                <th className="py-3 px-4 font-medium text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-husk)]">
              {sales.map((s) => (
                <tr key={s._id} className="hover:bg-[var(--color-cream-deep)]">
                  <td className="py-2.5 px-4">
                    <Link to={`${invoiceBase}/${s._id}`} className="font-semibold text-[var(--color-wheat-dark)]">
                      #{s.invoiceNumber}
                    </Link>
                    {s.edited && <span className="badge badge-over ml-2">Edited</span>}
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">{formatDateTime(s.createdAt)}</td>
                  <td className="py-2.5 px-4">{s.items.length} item(s)</td>
                  <td className="py-2.5 px-4 text-right font-semibold">{formatMoney(s.total)}</td>
                  <td className="py-2.5 px-4 text-right">
                    <Link to={`${invoiceBase}/${s._id}`} className="text-xs font-semibold text-[var(--color-wheat-dark)]">
                      View / Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {!sales.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[var(--color-coffee-soft)]">
                    No bills for this customer yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grain-card p-4">
          <h3 className="font-display font-semibold text-[var(--color-coffee)] mb-3">Payment History</h3>
          <div className="flex flex-col divide-y divide-[var(--color-husk)]">
            {payments.map((p) => (
              <div key={p._id} className="py-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold text-[var(--color-sage-deep)]">{formatMoney(p.amount)}</span>
                  <span className="text-xs text-[var(--color-coffee-soft)]">{formatDateTime(p.createdAt)}</span>
                </div>
                <p className="text-xs text-[var(--color-coffee-soft)]">
                  {p.createdBy?.name} {p.note ? `· ${p.note}` : ""}
                  {p.paymentMethod === "online" && ` · ${accountLabel(p.account)}`}
                </p>
              </div>
            ))}
            {!payments.length && <p className="text-sm text-[var(--color-coffee-soft)] py-6 text-center">No payments recorded yet</p>}
          </div>
        </div>
      </div>

      <Modal open={showPay} onClose={() => setShowPay(false)} title={`Record Payment — ${customer.name}`}>
        <form onSubmit={submitPay} className="flex flex-col gap-3">
          <p className="text-sm text-[var(--color-coffee-soft)]">Outstanding balance: {formatMoney(customer.balance)}</p>
          <div>
            <label className="field-label">Amount Received (Rs)</label>
            <input type="number" min="1" className="field-input" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} required />
          </div>
          <div>
            <label className="field-label">Received As</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPayMethod("cash")}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${payMethod === "cash" ? "border-[var(--color-wheat)] bg-[var(--color-cream-deep)]" : "border-[var(--color-husk)]"}`}
              >
                Cash
              </button>
              <button
                type="button"
                onClick={() => setPayMethod("online")}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${payMethod === "online" ? "border-[var(--color-wheat)] bg-[var(--color-cream-deep)]" : "border-[var(--color-husk)]"}`}
              >
                Online Transfer
              </button>
            </div>
          </div>
          {payMethod === "online" && <AccountSelect value={payAccountId} onChange={setPayAccountId} />}
          <div>
            <label className="field-label">Note (optional)</label>
            <input className="field-input" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="e.g. paid at shop visit" />
          </div>
          {error && <p className="text-sm text-[var(--color-terracotta-deep)]">{error}</p>}
          <button className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Record Payment"}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default CustomerDetail;

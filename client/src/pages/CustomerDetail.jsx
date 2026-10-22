import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import api from "../api/axios.js";
import Loader from "../components/Loader.jsx";
import Modal from "../components/Modal.jsx";
import AccountSelect from "../components/AccountSelect.jsx";
import ReasonModal from "../components/ReasonModal.jsx";
import { EditPaymentModal, DeletePaymentModal } from "../components/PaymentFixModals.jsx";
import { PhoneList, PhoneRow } from "../components/PhoneList.jsx";
import { useIsPhone } from "../utils/useIsPhone.js";
import { formatMoney, formatDate, formatDateTime, accountLabel } from "../utils/format.js";
import { returnItemsText } from "../utils/wapsi.js";

const CustomerDetail = ({ role }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isPhone = useIsPhone();
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
  const [editPayment, setEditPayment] = useState(null);
  const [deletePayment, setDeletePayment] = useState(null);
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: "", shopName: "", phone: "", address: "", openingBalance: "", reason: "" });
  const [showDeleteCustomer, setShowDeleteCustomer] = useState(false);

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

  const openEditCustomer = () => {
    setError("");
    const c = data.customer;
    setCustomerForm({
      name: c.name || "",
      shopName: c.shopName || "",
      phone: c.phone || "",
      address: c.address || "",
      openingBalance: String(c.openingBalance || 0),
      reason: "",
    });
    setShowEditCustomer(true);
  };

  const submitCustomer = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const openingChanged = Number(customerForm.openingBalance || 0) !== Number(data.customer.openingBalance || 0);
    if (openingChanged && !customerForm.reason.trim()) {
      setError("Write a reason for changing the old balance");
      setSaving(false);
      return;
    }
    try {
      await api.patch(`/customers/${id}`, {
        ...customerForm,
        openingBalance: customerForm.openingBalance === "" ? 0 : Number(customerForm.openingBalance),
      });
      setShowEditCustomer(false);
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not save the details");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <Loader />;
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
          <h2 className="page-title">{customer.name}</h2>
          <p className="text-sm text-[var(--color-coffee-soft)]">
            {customer.shopName ? `${customer.shopName} · ` : ""}
            {customer.phone || "No phone"}
          </p>
          {customer.address && <p className="text-sm text-[var(--color-coffee-soft)]">{customer.address}</p>}
          <button className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-ink)] hover:underline" onClick={openEditCustomer}>
            <Pencil size={12} />
            Edit details
          </button>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--ink-muted)]">Outstanding balance</p>
          <p className="font-display text-2xl font-semibold text-[var(--color-terracotta-deep)] mb-2">{formatMoney(customer.balance)}</p>
          {customer.openingBalance > 0 && (
            <p className="text-xs text-[var(--ink-muted)] -mt-1.5 mb-2">Includes {formatMoney(customer.openingBalance)} old balance</p>
          )}
          {customer.balance > 0 && (
            <div className="flex gap-2 justify-end">
              <button className="btn-outline text-xs px-3 py-1.5" onClick={() => openPay(false)}>
                Pay part
              </button>
              <button className="btn-primary text-xs px-3 py-1.5" onClick={() => openPay(true)}>
                Pay full
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grain-card overflow-x-auto h-fit">
          <div className="px-4 pt-4">
            <h3 className="section-title mb-1">Bills</h3>
          </div>
          {isPhone ? (
            <PhoneList empty="No bills for this customer yet">
              {sales.map((s) => (
                <PhoneRow
                  key={s._id}
                  title={
                    <>
                      <Link to={`${invoiceBase}/${s._id}`} className="font-semibold text-[var(--accent-ink)]">
                        #{s.invoiceNumber}
                      </Link>
                      {s.edited && <span className="badge badge-over ml-2">Edited</span>}
                    </>
                  }
                  sub={`${s.items.length} item(s)`}
                  meta={formatDateTime(s.createdAt)}
                  amount={formatMoney(s.total)}
                />
              ))}
              {customer.openingBalance > 0 && (
                <PhoneRow
                  title="Old balance"
                  sub={`From before the app, added ${formatDate(customer.createdAt)}`}
                  amount={formatMoney(customer.openingBalance)}
                />
              )}
            </PhoneList>
          ) : (
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
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {customer.openingBalance > 0 && (
                <tr className="bg-[var(--bg-subtle)]/60">
                  <td className="py-2.5 px-4 font-medium" colSpan={2}>
                    Old balance
                    <span className="block text-xs font-normal text-[var(--ink-muted)]">
                      From before the app, added {formatDate(customer.createdAt)}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-[var(--ink-muted)]">Not a sale</td>
                  <td className="py-2.5 px-4 text-right font-semibold">{formatMoney(customer.openingBalance)}</td>
                  <td />
                </tr>
              )}
              {!sales.length && !(customer.openingBalance > 0) && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[var(--color-coffee-soft)]">
                    No bills for this customer yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        </div>

        <div className="flex flex-col gap-4">
        <div className="grain-card p-4">
          <h3 className="section-title mb-3">Payment history</h3>
          <div className="flex flex-col divide-y divide-[var(--color-husk)]">
            {payments.map((p) => (
              <div key={p._id} className="py-2 text-sm flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p>
                    <span className="font-semibold text-[var(--color-sage-deep)]">{formatMoney(p.amount)}</span>
                    {p.edited && <span className="badge badge-account ml-2">Edited</span>}
                  </p>
                  <p className="text-xs text-[var(--color-coffee-soft)]">{formatDateTime(p.createdAt)}</p>
                  <p className="text-xs text-[var(--color-coffee-soft)]">
                    {p.createdBy?.name} {p.note ? `· ${p.note}` : ""}
                    {p.paymentMethod === "online" && ` · ${accountLabel(p.account)}`}
                  </p>
                </div>
                <div className="flex shrink-0 -mr-1.5">
                  <button className="icon-btn h-8 w-8" onClick={() => setEditPayment(p)} title="Correct this payment" aria-label="Correct this payment">
                    <Pencil size={14} />
                  </button>
                  <button
                    className="icon-btn h-8 w-8 hover:text-[var(--neg-ink)]"
                    onClick={() => setDeletePayment(p)}
                    title="Delete this payment"
                    aria-label="Delete this payment"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {!payments.length && <p className="text-sm text-[var(--color-coffee-soft)] py-6 text-center">No payments recorded yet</p>}
          </div>
        </div>

        {data.returns?.length > 0 && (
          <div className="grain-card p-4">
            <h3 className="section-title mb-3">Returns (cut from khata)</h3>
            <div className="flex flex-col divide-y divide-[var(--color-husk)]">
              {data.returns.map((r) => (
                <div key={r._id} className="py-2 text-sm flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p>{returnItemsText(r)}</p>
                    <p className="text-xs text-[var(--ink-muted)]">
                      {formatDateTime(r.createdAt)}
                      {r.createdBy?.name ? `, ${r.createdBy.name}` : ""}
                    </p>
                  </div>
                  <span className="font-semibold shrink-0">− {formatMoney(r.balanceAdjustment)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>

      <Modal open={showPay} onClose={() => setShowPay(false)} title={`Payment from ${customer.name}`}>
        <form onSubmit={submitPay} className="flex flex-col gap-3">
          <p className="text-sm text-[var(--color-coffee-soft)]">Outstanding balance: {formatMoney(customer.balance)}</p>
          <div>
            <label className="field-label">Amount received (Rs)</label>
            <input type="number" min="1" className="field-input" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} required />
          </div>
          <div>
            <label className="field-label">Received as</label>
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
                Online transfer
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
            {saving ? "Saving..." : "Record payment"}
          </button>
        </form>
      </Modal>

      <Modal open={showEditCustomer} onClose={() => setShowEditCustomer(false)} title="Edit customer details">
        <form onSubmit={submitCustomer} className="flex flex-col gap-3">
          <div>
            <label className="field-label" htmlFor="edit-name">Name</label>
            <input id="edit-name" className="field-input" value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} required />
          </div>
          <div>
            <label className="field-label" htmlFor="edit-shop">Shop name</label>
            <input id="edit-shop" className="field-input" value={customerForm.shopName} onChange={(e) => setCustomerForm({ ...customerForm, shopName: e.target.value })} />
          </div>
          <div>
            <label className="field-label" htmlFor="edit-phone">Phone</label>
            <input id="edit-phone" className="field-input" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} />
          </div>
          <div>
            <label className="field-label" htmlFor="edit-address">Address</label>
            <input id="edit-address" className="field-input" value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} />
          </div>
          <div>
            <label className="field-label" htmlFor="edit-old-balance">
              Old balance from before the app (Rs)
            </label>
            <input
              id="edit-old-balance"
              type="number"
              min="0"
              className="field-input"
              value={customerForm.openingBalance}
              onChange={(e) => setCustomerForm({ ...customerForm, openingBalance: e.target.value })}
            />
            <p className="text-xs text-[var(--ink-faint)] mt-1.5">Only if it was typed wrong. The balance moves by the same amount.</p>
          </div>
          {Number(customerForm.openingBalance || 0) !== Number(customer.openingBalance || 0) && (
            <div>
              <label className="field-label" htmlFor="edit-old-reason">
                Reason for changing the old balance
              </label>
              <input
                id="edit-old-reason"
                className="field-input"
                value={customerForm.reason}
                onChange={(e) => setCustomerForm({ ...customerForm, reason: e.target.value })}
                placeholder="e.g. paper khata says 12,500"
                required
              />
            </div>
          )}
          {error && <p className="text-sm text-[var(--neg-ink)] bg-[var(--neg-tint)] rounded-lg px-3 py-2">{error}</p>}
          <div className="flex flex-wrap justify-between gap-2">
            {role === "admin" ? (
              <button
                type="button"
                className="btn-danger-quiet"
                onClick={() => {
                  setShowEditCustomer(false);
                  setShowDeleteCustomer(true);
                }}
              >
                Delete customer
              </button>
            ) : (
              <span />
            )}
            <button className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save details"}
            </button>
          </div>
        </form>
      </Modal>

      <ReasonModal
        open={showDeleteCustomer}
        onClose={() => setShowDeleteCustomer(false)}
        title={`Delete ${customer.name}?`}
        confirmLabel="Delete customer"
        danger
        placeholder="e.g. added twice by mistake"
        onConfirm={async (reason) => {
          await api.delete(`/customers/${id}`, { data: { reason } });
          setShowDeleteCustomer(false);
          navigate(backTo);
        }}
      >
        <p>Only for a customer with no bills, payments or returns.</p>
        {customer.openingBalance > 0 && <p>Their old balance of {formatMoney(customer.openingBalance)} will be removed too.</p>}
      </ReasonModal>

      <EditPaymentModal payment={editPayment} customerName={customer.name} onClose={() => setEditPayment(null)} onDone={load} />
      <DeletePaymentModal payment={deletePayment} customerName={customer.name} onClose={() => setDeletePayment(null)} onDone={load} />
    </div>
  );
};

export default CustomerDetail;

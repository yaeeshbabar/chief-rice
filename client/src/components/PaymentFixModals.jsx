import { useState } from "react";
import api from "../api/axios.js";
import Modal from "./Modal.jsx";
import ReasonModal from "./ReasonModal.jsx";
import AccountSelect from "./AccountSelect.jsx";
import { accountLabel, formatDateTime, formatMoney } from "../utils/format.js";

const paymentText = (p) => `${formatMoney(p.amount)} ${p.paymentMethod === "online" ? accountLabel(p.account) : "cash"}`;

// Correct a khata payment that was entered wrong. The customer's balance moves by the difference.
const EditPaymentForm = ({ payment, customerName, onClose, onDone }) => {
  const [form, setForm] = useState({
    amount: String(payment.amount),
    paymentMethod: payment.paymentMethod || "cash",
    accountId: payment.account?._id || payment.account || "",
    note: payment.note || "",
    reason: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.amount || Number(form.amount) <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (form.paymentMethod === "online" && !form.accountId) {
      setError("Select which account the payment went into");
      return;
    }
    if (!form.reason.trim()) {
      setError("Please write a reason");
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/payments/${payment._id}`, {
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        accountId: form.paymentMethod === "online" ? form.accountId : undefined,
        note: form.note,
        reason: form.reason,
      });
      onDone();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not save the correction");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm text-[var(--ink-muted)]">
        {customerName ? `${customerName} · ` : ""}
        {paymentText(payment)} on {formatDateTime(payment.createdAt)}
      </p>
      <div>
        <label className="field-label">Amount received (Rs)</label>
        <input
          type="number"
          min="1"
          className="field-input"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          required
          autoFocus
        />
      </div>
      <div>
        <label className="field-label">Received as</label>
        <div className="segmented w-full">
          {[
            { key: "cash", label: "Cash" },
            { key: "online", label: "Online transfer" },
          ].map((m) => (
            <button
              type="button"
              key={m.key}
              className={`segmented-item flex-1 ${form.paymentMethod === m.key ? "is-active" : ""}`}
              onClick={() => setForm({ ...form, paymentMethod: m.key })}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {form.paymentMethod === "online" && (
        <AccountSelect value={form.accountId} onChange={(accountId) => setForm({ ...form, accountId })} />
      )}
      <div>
        <label className="field-label">Note (optional)</label>
        <input className="field-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </div>
      <div>
        <label className="field-label">Reason for the change</label>
        <input
          className="field-input"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          placeholder="e.g. typed 5000 instead of 500"
          required
        />
        <p className="text-xs text-[var(--ink-faint)] mt-1.5">Saved in the Changes report with your name.</p>
      </div>
      {error && <p className="text-sm text-[var(--neg-ink)] bg-[var(--neg-tint)] rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" disabled={saving}>
          {saving ? "Saving..." : "Save correction"}
        </button>
      </div>
    </form>
  );
};

export const EditPaymentModal = ({ payment, customerName, onClose, onDone }) => (
  <Modal open={!!payment} onClose={onClose} title="Correct payment">
    {payment && (
      <EditPaymentForm
        key={payment._id}
        payment={payment}
        customerName={customerName || payment.customer?.name}
        onClose={onClose}
        onDone={() => {
          onClose();
          onDone();
        }}
      />
    )}
  </Modal>
);

// Delete a payment entered by mistake: the amount goes back onto the customer's khata.
export const DeletePaymentModal = ({ payment, customerName, onClose, onDone }) => (
  <ReasonModal
    open={!!payment}
    onClose={onClose}
    title="Delete payment?"
    confirmLabel="Delete payment"
    danger
    placeholder="e.g. recorded twice"
    onConfirm={async (reason) => {
      await api.delete(`/payments/${payment._id}`, { data: { reason } });
      onClose();
      onDone();
    }}
  >
    {payment && (
      <p>
        {paymentText(payment)} from {customerName || payment.customer?.name || "this customer"} on {formatDateTime(payment.createdAt)}.{" "}
        {formatMoney(payment.amount)} will be added back to their khata balance.
      </p>
    )}
  </ReasonModal>
);

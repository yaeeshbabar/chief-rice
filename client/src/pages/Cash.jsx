import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Trash2, Undo2 } from "lucide-react";
import api from "../api/axios.js";
import Loader from "../components/Loader.jsx";
import ReasonModal from "../components/ReasonModal.jsx";
import CashInStoreCard from "../components/CashInStoreCard.jsx";
import { EditPaymentModal, DeletePaymentModal } from "../components/PaymentFixModals.jsx";
import { PhoneList, PhoneRow } from "../components/PhoneList.jsx";
import { useIsPhone } from "../utils/useIsPhone.js";
import { formatMoney, formatMoneyUrdu, formatDateTime, monthBounds, inputDate, accountLabel } from "../utils/format.js";
import { useAuth } from "../context/AuthContext.jsx";

const last4 = (account) => (account?.accountNumber ? ` ••${String(account.accountNumber).slice(-4)}` : "");
const fromText = (h) => {
  if (h.source !== "account") return "Cash counter";
  const bank = (h.account?.bankName || "").trim();
  return bank && bank.toLowerCase() !== "salesman account" ? `Salesman account (${bank})` : "Salesman account";
};
const toText = (h) => {
  if (h.toAccount) return `${h.toAccount.bankName || "Bank"}${last4(h.toAccount)}`;
  return h.source === "account" ? "Asim's bank" : "In hand";
};
// "Rs 1,500 from the cash counter, into UBL ••2048"
const handoverLine = (h) => {
  const from = h.source === "account" ? "the salesman account" : "the cash counter";
  const to = h.toAccount || h.source === "account" ? `into ${toText(h)}` : "given in hand";
  return `${formatMoney(h.amount)} from ${from}, ${to}`;
};

const quickRanges = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];
const kinds = [
  { key: "all", label: "Everything" },
  { key: "handover", label: "Handovers" },
  { key: "payment", label: "Creditor payments" },
];
const methodText = (p) => (p.paymentMethod === "online" ? accountLabel(p.account) : "Cash");

const Cash = () => {
  const { user } = useAuth();
  const isPhone = useIsPhone();
  const [handovers, setHandovers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [kind, setKind] = useState("all");
  const [editPayment, setEditPayment] = useState(null);
  const [deletePayment, setDeletePayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("cash");
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [asimAccounts, setAsimAccounts] = useState([]);
  const [toBank, setToBank] = useState(false);
  const [toAccountId, setToAccountId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [range, setRange] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [month, setMonth] = useState("");
  const [undoTarget, setUndoTarget] = useState(null);
  // Bumped after a handover is added or undone so the money card reloads
  const [poolsVersion, setPoolsVersion] = useState(0);

  const selectMonth = (value) => {
    setMonth(value);
    const bounds = monthBounds(value);
    setCustomFrom(bounds.from);
    setCustomTo(bounds.to);
  };

  const rangeParams = () => {
    if (customFrom || customTo) return { from: customFrom, to: customTo };
    // Dates in the phone's own time (Pakistan), so "Today" starts at midnight here
    const now = new Date();
    if (range === "today") return { from: inputDate(now) };
    if (range === "week") {
      const from = new Date(now);
      from.setDate(from.getDate() - ((now.getDay() + 6) % 7));
      return { from: inputDate(from) };
    }
    if (range === "month") return { from: inputDate(new Date(now.getFullYear(), now.getMonth(), 1)) };
    return {};
  };

  const load = () => {
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams(rangeParams());
    Promise.all([api.get(`/cash-handovers?${params.toString()}`), api.get(`/payments?${params.toString()}`)])
      .then(([h, p]) => {
        setHandovers(h.data);
        setPayments(p.data.payments);
      })
      .catch((err) => setLoadError(err?.response?.data?.message || "Could not load the history"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [range, customFrom, customTo]);
  useEffect(() => {
    api.get("/bank-accounts?ownerType=salesman").then((res) => setAccounts(res.data));
    api.get("/bank-accounts?ownerType=asim").then((res) => setAsimAccounts(res.data));
  }, []);

  // Money from the salesman's account always lands in one of Asim's bank accounts.
  const intoBank = source === "account" || toBank;

  const totalHandedOver = handovers.reduce((sum, h) => sum + h.amount, 0);
  const totalRecovered = payments.reduce((sum, p) => sum + p.amount, 0);
  const customerBase = user?.role === "admin" ? "/admin/khata" : "/salesman/creditors";
  // Handovers and creditor payments in one list, newest first
  const history = [
    ...(kind === "payment" ? [] : handovers.map((h) => ({ kind: "handover", date: h.createdAt, record: h }))),
    ...(kind === "handover" ? [] : payments.map((p) => ({ kind: "payment", date: p.createdAt, record: p }))),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const undoButton = (h) => (
    <button className="icon-btn h-8 w-8" onClick={() => setUndoTarget(h)} title="Undo this handover" aria-label="Undo this handover">
      <Undo2 size={15} />
    </button>
  );
  const paymentButtons = (p) => (
    <div className="flex justify-end">
      <button className="icon-btn h-8 w-8" onClick={() => setEditPayment(p)} title="Correct this payment" aria-label="Correct this payment">
        <Pencil size={15} />
      </button>
      <button
        className="icon-btn h-8 w-8 hover:text-[var(--neg-ink)]"
        onClick={() => setDeletePayment(p)}
        title="Delete this payment"
        aria-label="Delete this payment"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
  const creditorLink = (p) =>
    p.customer ? (
      <Link to={`${customerBase}/${p.customer._id}`} className="font-semibold text-[var(--accent-ink)]">
        {p.customer.name}
      </Link>
    ) : (
      "—"
    );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!amount || Number(amount) <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (source === "account" && !accountId) {
      setError("Select which salesman account this came from");
      return;
    }
    if (intoBank && !toAccountId) {
      setError("Pick which of Asim's accounts the money went into");
      return;
    }
    setSaving(true);
    try {
      await api.post("/cash-handovers", {
        amount,
        source,
        accountId: source === "account" ? accountId : undefined,
        toAccountId: intoBank ? toAccountId : undefined,
        note,
      });
      setSuccess("Recorded");
      setAmount("");
      setNote("");
      setPoolsVersion((v) => v + 1);
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not record this handover");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="page-title">Cash</h2>

      <div className="grid lg:grid-cols-3 gap-6">
        <CashInStoreCard key={poolsVersion} />

        <div className="grain-card p-4 flex flex-col gap-3 h-fit">
          <h3 className="section-title">
            {user?.role === "admin" ? "Log money collected" : "Hand over to Asim"}
          </h3>
          <p className="text-xs text-[var(--color-coffee-soft)] -mt-2">
            {user?.role === "admin" ? "What reached you from the salesman." : "Cash in hand, a bank deposit, or a transfer."}
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <p className="field-label">From</p>
              <div className="segmented w-full">
                {[
                  { key: "cash", label: "Cash counter" },
                  { key: "account", label: "Salesman account" },
                ].map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={source === o.key}
                    onClick={() => setSource(o.key)}
                    className={`segmented-item flex-1 ${source === o.key ? "is-active" : ""}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {source === "account" && (
              <select className="field-input" value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Salesman account">
                <option value="">Select salesman account</option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.ownerName}, {a.bankName}
                  </option>
                ))}
              </select>
            )}
            {source === "cash" && (
              <div>
                <p className="field-label">Given to Asim</p>
                <div className="segmented w-full">
                  {[
                    { key: false, label: "In hand" },
                    { key: true, label: "Bank deposit" },
                  ].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      aria-pressed={toBank === o.key}
                      onClick={() => setToBank(o.key)}
                      className={`segmented-item flex-1 ${toBank === o.key ? "is-active" : ""}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {intoBank && (
              <div>
                <label className="field-label" htmlFor="to-account">
                  Into Asim's account
                </label>
                <select id="to-account" className="field-input" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                  <option value="">Select account</option>
                  {asimAccounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.bankName}
                      {a.accountNumber ? ` ••${String(a.accountNumber).slice(-4)}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="field-label">Amount (Rs)</label>
              <input type="number" min="1" className="field-input" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div>
              <label className="field-label">Note (optional)</label>
              <input className="field-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. weekly collection" />
            </div>
            {error && <p className="text-sm text-[var(--color-terracotta-deep)]">{error}</p>}
            {success && <p className="text-sm text-[var(--color-sage-deep)]">{success}</p>}
            <button className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Record handover"}
            </button>
          </form>
        </div>

        <div className="grain-card p-4 h-fit flex flex-col gap-4">
          <div>
            <p className="text-xs text-[var(--color-coffee-soft)]">Handed over to Asim</p>
            <p className="font-display text-2xl font-semibold text-[var(--color-wheat-dark)]">{formatMoney(totalHandedOver)}</p>
            <p className="text-xs text-[var(--color-coffee-soft)]">≈ {formatMoneyUrdu(totalHandedOver)}</p>
          </div>
          <div className="border-t border-[var(--line)] pt-4">
            <p className="text-xs text-[var(--color-coffee-soft)]">Recovered from creditors</p>
            <p className="font-display text-2xl font-semibold text-[var(--pos-ink)]">{formatMoney(totalRecovered)}</p>
            <p className="text-xs text-[var(--color-coffee-soft)]">
              {payments.length} {payments.length === 1 ? "payment" : "payments"}, cash and online
            </p>
          </div>
        </div>
      </div>

      <div className="grain-card">
        <div className="px-4 pt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="section-title">History</h3>
            <div className="segmented">
              {kinds.map((k) => (
                <button
                  key={k.key}
                  aria-pressed={kind === k.key}
                  onClick={() => setKind(k.key)}
                  className={`segmented-item ${kind === k.key ? "is-active" : ""}`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-bar">
            <div className="segmented">
              {quickRanges.map((r) => (
                <button
                  key={r.key}
                  onClick={() => {
                    setCustomFrom("");
                    setCustomTo("");
                    setMonth("");
                    setRange(r.key);
                  }}
                  className={`segmented-item ${range === r.key && !customFrom && !customTo ? "is-active" : ""}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div>
              <label className="field-label" htmlFor="handover-month">
                Month
              </label>
              <input id="handover-month" type="month" className="field-input" value={month} onChange={(e) => selectMonth(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="handover-from">
                From
              </label>
              <input
                id="handover-from"
                type="date"
                className="field-input"
                value={customFrom}
                onChange={(e) => {
                  setCustomFrom(e.target.value);
                  setMonth("");
                }}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="handover-to">
                To
              </label>
              <input
                id="handover-to"
                type="date"
                className="field-input"
                value={customTo}
                onChange={(e) => {
                  setCustomTo(e.target.value);
                  setMonth("");
                }}
              />
            </div>
          </div>
        </div>
        {loading ? (
          <Loader />
        ) : loadError ? (
          <p className="p-6 text-center text-sm text-[var(--color-terracotta-deep)]">{loadError}</p>
        ) : !history.length ? (
          <p className="py-10 text-center text-sm text-[var(--color-coffee-soft)]">Nothing recorded in these dates</p>
        ) : isPhone ? (
          <PhoneList className="mt-3 border-t border-[var(--line)]">
            {history.map(({ kind: k, record }) =>
              k === "handover" ? (
                <PhoneRow
                  key={`h-${record._id}`}
                  title={`${fromText(record)} → ${toText(record)}`}
                  sub={
                    <>
                      <span className="badge badge-account mr-1.5">Handover</span>
                      {[record.createdBy?.name, record.note].filter(Boolean).join(", ")}
                    </>
                  }
                  meta={formatDateTime(record.createdAt)}
                  amount={formatMoney(record.amount)}
                  actions={undoButton(record)}
                />
              ) : (
                <PhoneRow
                  key={`p-${record._id}`}
                  title={creditorLink(record)}
                  sub={
                    <>
                      <span className="badge badge-cash mr-1.5">Khata payment</span>
                      {methodText(record)}
                      {record.directToAsim && <span className="badge badge-over ml-1.5">Direct to Asim</span>}
                      {record.edited && <span className="badge badge-account ml-1.5">Edited</span>}
                    </>
                  }
                  meta={[formatDateTime(record.createdAt), record.createdBy?.name, record.note].filter(Boolean).join(", ")}
                  amount={formatMoney(record.amount)}
                  actions={paymentButtons(record)}
                />
              )
            )}
          </PhoneList>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm mt-3">
              <thead>
                <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">What</th>
                  <th className="py-3 px-4 font-medium">Details</th>
                  <th className="py-3 px-4 font-medium">By</th>
                  <th className="py-3 px-4 font-medium">Note</th>
                  <th className="py-3 px-4 font-medium text-right">Amount</th>
                  <th className="relative py-3 px-2 w-[76px]">
                    <span className="sr-only">Fix</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-husk)]">
                {history.map(({ kind: k, record }) =>
                  k === "handover" ? (
                    <tr key={`h-${record._id}`}>
                      <td className="py-2.5 px-4 whitespace-nowrap">{formatDateTime(record.createdAt)}</td>
                      <td className="py-2.5 px-4">
                        <span className="badge badge-account">Handover</span>
                      </td>
                      <td className="py-2.5 px-4">
                        {fromText(record)} → {toText(record)}
                      </td>
                      <td className="py-2.5 px-4">
                        {record.createdBy?.name}{" "}
                        <span className="text-xs text-[var(--color-coffee-soft)] capitalize">({record.createdBy?.role})</span>
                      </td>
                      <td className="py-2.5 px-4">{record.note || "—"}</td>
                      <td className="py-2.5 px-4 text-right font-semibold">{formatMoney(record.amount)}</td>
                      <td className="py-1 px-2">
                        <div className="flex justify-end">{undoButton(record)}</div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={`p-${record._id}`}>
                      <td className="py-2.5 px-4 whitespace-nowrap">{formatDateTime(record.createdAt)}</td>
                      <td className="py-2.5 px-4">
                        <span className="badge badge-cash">Khata payment</span>
                      </td>
                      <td className="py-2.5 px-4">
                        {creditorLink(record)}
                        <span className="block text-xs text-[var(--ink-muted)]">
                          {methodText(record)}
                          {record.directToAsim && <span className="badge badge-over ml-1.5">Direct to Asim</span>}
                          {record.edited && <span className="badge badge-account ml-1.5">Edited</span>}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        {record.createdBy?.name}{" "}
                        <span className="text-xs text-[var(--color-coffee-soft)] capitalize">({record.createdBy?.role})</span>
                      </td>
                      <td className="py-2.5 px-4">{record.note || "—"}</td>
                      <td className="py-2.5 px-4 text-right font-semibold">{formatMoney(record.amount)}</td>
                      <td className="py-1 px-2">{paymentButtons(record)}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EditPaymentModal
        payment={editPayment}
        customerName={editPayment?.customer?.name}
        onClose={() => setEditPayment(null)}
        onDone={() => {
          setPoolsVersion((v) => v + 1);
          load();
        }}
      />
      <DeletePaymentModal
        payment={deletePayment}
        customerName={deletePayment?.customer?.name}
        onClose={() => setDeletePayment(null)}
        onDone={() => {
          setPoolsVersion((v) => v + 1);
          load();
        }}
      />

      <ReasonModal
        open={!!undoTarget}
        onClose={() => setUndoTarget(null)}
        title="Undo this handover?"
        confirmLabel="Undo handover"
        danger
        placeholder="e.g. wrong amount, will enter again"
        onConfirm={async (reason) => {
          await api.delete(`/cash-handovers/${undoTarget._id}`, { data: { reason } });
          setUndoTarget(null);
          setPoolsVersion((v) => v + 1);
          load();
        }}
      >
        {undoTarget && (
          <p>
            {handoverLine(undoTarget)}, on {formatDateTime(undoTarget.createdAt)}. It counts as back in the{" "}
            {undoTarget.source === "account" ? "salesman account" : "counter"}.
          </p>
        )}
      </ReasonModal>
    </div>
  );
};

export default Cash;

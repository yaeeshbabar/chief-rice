import { useEffect, useState } from "react";
import { Undo2 } from "lucide-react";
import api from "../api/axios.js";
import Loader from "../components/Loader.jsx";
import ReasonModal from "../components/ReasonModal.jsx";
import CashInStoreCard from "../components/CashInStoreCard.jsx";
import { formatMoney, formatMoneyUrdu, formatDateTime, monthBounds } from "../utils/format.js";
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

const Cash = () => {
  const { user } = useAuth();
  const [handovers, setHandovers] = useState([]);
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
    const now = new Date();
    if (range === "today") {
      const from = new Date(now);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString().slice(0, 10) };
    }
    if (range === "week") {
      const day = now.getDay();
      const diff = (day + 6) % 7;
      const from = new Date(now);
      from.setDate(from.getDate() - diff);
      return { from: from.toISOString().slice(0, 10) };
    }
    if (range === "month") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: from.toISOString().slice(0, 10) };
    }
    return {};
  };

  const load = () => {
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams(rangeParams());
    api
      .get(`/cash-handovers?${params.toString()}`)
      .then((res) => setHandovers(res.data))
      .catch((err) => setLoadError(err?.response?.data?.message || "Could not load handover history"))
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

        <div className="grain-card p-4 h-fit">
          <p className="text-xs text-[var(--color-coffee-soft)]">Total handed over</p>
          <p className="font-display text-2xl font-semibold text-[var(--color-wheat-dark)]">{formatMoney(totalHandedOver)}</p>
          <p className="text-xs text-[var(--color-coffee-soft)]">≈ {formatMoneyUrdu(totalHandedOver)}</p>
        </div>
      </div>

      <div className="grain-card">
        <div className="px-4 pt-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="section-title">Handover history</h3>
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
                className={`segmented-item ${
                  range === r.key && !customFrom && !customTo ? "is-active" : ""
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="field-label" htmlFor="handover-month">Month</label>
              <input id="handover-month" type="month" className="field-input" value={month} onChange={(e) => selectMonth(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="handover-from">From</label>
              <input id="handover-from" type="date" className="field-input" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setMonth(""); }} />
            </div>
            <div>
              <label className="field-label" htmlFor="handover-to">To</label>
              <input id="handover-to" type="date" className="field-input" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setMonth(""); }} />
            </div>
          </div>
        </div>
        {loading ? (
          <Loader />
        ) : loadError ? (
          <p className="p-6 text-center text-sm text-[var(--color-terracotta-deep)]">{loadError}</p>
        ) : !handovers.length ? (
          <p className="py-10 text-center text-sm text-[var(--color-coffee-soft)]">No cash handovers recorded yet</p>
        ) : (
          <>
            {/* Phone: one line per handover */}
            <ul className="md:hidden mt-3 divide-y divide-[var(--line)] border-t border-[var(--line)]">
              {handovers.map((h) => (
                <li key={h._id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {fromText(h)} → {toText(h)}
                    </p>
                    <p className="text-xs text-[var(--ink-muted)] truncate">
                      {h.createdBy?.name}
                      {h.note ? `, ${h.note}` : ""}
                    </p>
                    <p className="text-xs text-[var(--ink-faint)]">{formatDateTime(h.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-semibold">{formatMoney(h.amount)}</span>
                    <button className="icon-btn h-8 w-8" onClick={() => setUndoTarget(h)} title="Undo this handover" aria-label="Undo this handover">
                      <Undo2 size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {/* Bigger screens: a table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm mt-3">
                <thead>
                  <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">From</th>
                    <th className="py-3 px-4 font-medium">To Asim</th>
                    <th className="py-3 px-4 font-medium">Recorded by</th>
                    <th className="py-3 px-4 font-medium">Note</th>
                    <th className="py-3 px-4 font-medium text-right">Amount</th>
                    <th className="relative py-3 px-2 w-12">
                      <span className="sr-only">Undo</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-husk)]">
                  {handovers.map((h) => (
                    <tr key={h._id}>
                      <td className="py-2.5 px-4 whitespace-nowrap">{formatDateTime(h.createdAt)}</td>
                      <td className="py-2.5 px-4">{fromText(h)}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap">{toText(h)}</td>
                      <td className="py-2.5 px-4">
                        {h.createdBy?.name} <span className="text-xs text-[var(--color-coffee-soft)] capitalize">({h.createdBy?.role})</span>
                      </td>
                      <td className="py-2.5 px-4">{h.note || "—"}</td>
                      <td className="py-2.5 px-4 text-right font-semibold">{formatMoney(h.amount)}</td>
                      <td className="py-1 px-2">
                        <button className="icon-btn h-8 w-8" onClick={() => setUndoTarget(h)} title="Undo this handover" aria-label="Undo this handover">
                          <Undo2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

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

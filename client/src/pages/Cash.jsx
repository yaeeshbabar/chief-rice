import { useEffect, useState } from "react";
import api from "../api/axios.js";
import Loader from "../components/Loader.jsx";
import CashInStoreCard from "../components/CashInStoreCard.jsx";
import { formatMoney, formatMoneyUrdu, formatDateTime, monthBounds } from "../utils/format.js";
import { useAuth } from "../context/AuthContext.jsx";

const quickRanges = [
  { key: "all", label: "All Time" },
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

const Cash = () => {
  const { user } = useAuth();
  const [handovers, setHandovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("cash");
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [range, setRange] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [month, setMonth] = useState("");

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

  useEffect(load, [range, customFrom, customTo]);  useEffect(() => {
    api.get("/bank-accounts?ownerType=salesman").then((res) => setAccounts(res.data));
  }, []);

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
    setSaving(true);
    try {
      const { data: created } = await api.post("/cash-handovers", {
        amount,
        source,
        accountId: source === "account" ? accountId : undefined,
        note,
      });
      setSuccess(created.warning || "Recorded successfully");
      setAmount("");
      setNote("");
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not record this handover");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-xl font-semibold text-[var(--color-coffee)]">Cash Handling</h2>

      <div className="grid lg:grid-cols-3 gap-6">
        <CashInStoreCard />

        <div className="grain-card p-4 flex flex-col gap-3 h-fit">
          <h3 className="font-display font-semibold text-[var(--color-coffee)]">
            {user?.role === "admin" ? "Log Cash/Transfer Collected" : "Hand Over to Asim"}
          </h3>
          <p className="text-xs text-[var(--color-coffee-soft)] -mt-2">
            {user?.role === "admin"
              ? "Record what you collected from the salesman during your store visit."
              : "Record what you're handing to Asim - from the cash counter, or from your own account."}
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="field-label">From</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSource("cash")}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${source === "cash" ? "border-[var(--color-wheat)] bg-[var(--color-cream-deep)]" : "border-[var(--color-husk)]"}`}
                >
                  Cash Counter
                </button>
                <button
                  type="button"
                  onClick={() => setSource("account")}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${source === "account" ? "border-[var(--color-wheat)] bg-[var(--color-cream-deep)]" : "border-[var(--color-husk)]"}`}
                >
                  Salesman Account
                </button>
              </div>
            </div>
            {source === "account" && (
              <select className="field-input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Select salesman account</option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.ownerName} — {a.bankName}
                  </option>
                ))}
              </select>
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
              {saving ? "Saving..." : "Record Handover"}
            </button>
          </form>
        </div>

        <div className="grain-card p-4">
          <p className="text-xs text-[var(--color-coffee-soft)]">Total Handed Over (this filter)</p>
          <p className="font-display text-2xl font-semibold text-[var(--color-wheat-dark)]">{formatMoney(totalHandedOver)}</p>
          <p className="text-xs text-[var(--color-coffee-soft)]">≈ {formatMoneyUrdu(totalHandedOver)}</p>
        </div>
      </div>

      <div className="grain-card overflow-x-auto">
        <div className="px-4 pt-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display font-semibold text-[var(--color-coffee)]">Handover History</h3>
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
          <div className="flex gap-2 items-end">
            <div>
              <label className="field-label">Month</label>
              <input type="month" className="field-input" value={month} onChange={(e) => selectMonth(e.target.value)} />
            </div>
            <div>
              <label className="field-label">From</label>
              <input type="date" className="field-input" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setMonth(""); }} />
            </div>
            <div>
              <label className="field-label">To</label>
              <input type="date" className="field-input" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setMonth(""); }} />
            </div>
          </div>
        </div>
        {loading ? (
          <Loader />
        ) : loadError ? (
          <p className="p-6 text-center text-sm text-[var(--color-terracotta-deep)]">{loadError}</p>
        ) : (
          <table className="w-full text-sm min-w-[560px] mt-3">
            <thead>
              <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">From</th>
                <th className="py-3 px-4 font-medium">Recorded By</th>
                <th className="py-3 px-4 font-medium">Note</th>
                <th className="py-3 px-4 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-husk)]">
              {handovers.map((h) => (
                <tr key={h._id}>
                  <td className="py-2.5 px-4 whitespace-nowrap">{formatDateTime(h.createdAt)}</td>
                  <td className="py-2.5 px-4 capitalize">{h.source === "account" ? `Account (${h.account?.bankName || ""})` : "Cash"}</td>
                  <td className="py-2.5 px-4">
                    {h.createdBy?.name} <span className="text-xs text-[var(--color-coffee-soft)] capitalize">({h.createdBy?.role})</span>
                  </td>
                  <td className="py-2.5 px-4">{h.note || "—"}</td>
                  <td className="py-2.5 px-4 text-right font-semibold">{formatMoney(h.amount)}</td>
                </tr>
              ))}
              {!handovers.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[var(--color-coffee-soft)]">
                    No cash handovers recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Cash;

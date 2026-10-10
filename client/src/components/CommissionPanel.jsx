import { useEffect, useState } from "react";
import api from "../api/axios.js";
import Modal from "./Modal.jsx";
import Loader from "./Loader.jsx";
import { formatMoney, formatDateTime } from "../utils/format.js";

// Commission owed to each salesman, collected in one place. Cash is handed over from here
// when needed, and every handover is kept as a record.
const CommissionPanel = () => {
  const [summary, setSummary] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [target, setTarget] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterAgent, setFilterAgent] = useState("");

  const load = () => {
    setLoading(true);
    setLoadError("");
    Promise.all([api.get("/commission-payouts/summary"), api.get("/commission-payouts")])
      .then(([s, p]) => {
        setSummary(s.data);
        setPayouts(p.data.payouts);
      })
      .catch((err) => setLoadError(err?.response?.data?.message || "Could not load commission"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openPay = (row) => {
    setTarget(row);
    setAmount(row.due > 0 ? String(Math.round(row.due)) : "");
    setNote("");
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!amount || Number(amount) <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await api.post("/commission-payouts", { agentId: target.agentId, amount: Number(amount), note });
      setTarget(null);
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not record this handover");
    } finally {
      setSaving(false);
    }
  };

  const shownPayouts = filterAgent ? payouts.filter((p) => String(p.agent) === filterAgent) : payouts;

  return (
    <div className="grain-card p-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display font-semibold text-[var(--color-coffee)]">Salesman Commission</h3>
          <p className="text-xs text-[var(--color-coffee-soft)]">
            Commission is collected here as bills are made. Hand it over from the cash counter when it's needed.
          </p>
        </div>
        {summary && (
          <div className="text-right">
            <p className="text-xs text-[var(--color-coffee-soft)]">Reserved for commission</p>
            <p className="font-display text-lg font-semibold text-[var(--color-wheat-dark)]">{formatMoney(summary.totalReserved)}</p>
          </div>
        )}
      </div>

      {loading ? (
        <Loader />
      ) : loadError ? (
        <p className="text-sm text-center text-[var(--color-terracotta-deep)]">{loadError}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
                  <th className="py-2 font-medium">Salesman</th>
                  <th className="py-2 font-medium text-right">Earned</th>
                  <th className="py-2 font-medium text-right">Handed Over</th>
                  <th className="py-2 font-medium text-right">Still Owed</th>
                  <th className="py-2 font-medium text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-husk)]">
                {summary.agents.map((a) => (
                  <tr key={a.agentId}>
                    <td className="py-2.5 font-medium">
                      {a.name} <span className="text-xs text-[var(--color-coffee-soft)]">({a.percentage}%)</span>
                    </td>
                    <td className="py-2.5 text-right">{formatMoney(a.earned)}</td>
                    <td className="py-2.5 text-right">{formatMoney(a.paid)}</td>
                    <td className={`py-2.5 text-right font-semibold ${a.due > 0 ? "text-[var(--color-wheat-dark)]" : ""}`}>
                      {a.due < 0 ? `${formatMoney(Math.abs(a.due))} overpaid` : formatMoney(a.due)}
                    </td>
                    <td className="py-2.5 text-right">
                      <button className="btn-outline text-xs px-3 py-1.5" disabled={a.due <= 0} onClick={() => openPay(a)}>
                        Hand over
                      </button>
                    </td>
                  </tr>
                ))}
                {!summary.agents.length && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[var(--color-coffee-soft)]">
                      No commission salesmen yet — Asim adds them in Settings
                    </td>
                  </tr>
                )}
              </tbody>
              {summary.agents.length > 0 && (
                <tfoot>
                  <tr className="border-t border-[var(--color-husk)] font-semibold">
                    <td className="py-2.5">Total</td>
                    <td className="py-2.5 text-right">{formatMoney(summary.totalEarned)}</td>
                    <td className="py-2.5 text-right">{formatMoney(summary.totalPaid)}</td>
                    <td className="py-2.5 text-right">{formatMoney(summary.totalReserved)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Handover Record</h4>
              <select className="field-input max-w-[180px] py-1" value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}>
                <option value="">All salesmen</option>
                {summary.agents.map((a) => (
                  <option key={a.agentId} value={a.agentId}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col divide-y divide-[var(--color-husk)] text-sm max-h-64 overflow-y-auto">
              {shownPayouts.map((p) => (
                <div key={p._id} className="flex items-center justify-between py-2 gap-3">
                  <div>
                    <p className="font-medium">
                      {p.agentName} <span className="text-xs text-[var(--color-coffee-soft)]">· by {p.createdBy?.name}</span>
                    </p>
                    <p className="text-xs text-[var(--color-coffee-soft)]">
                      {formatDateTime(p.createdAt)}
                      {p.note ? ` · ${p.note}` : ""}
                    </p>
                  </div>
                  <span className="font-semibold">{formatMoney(p.amount)}</span>
                </div>
              ))}
              {!shownPayouts.length && <p className="py-4 text-center text-[var(--color-coffee-soft)]">No commission handed over yet</p>}
            </div>
          </div>
        </>
      )}

      <Modal open={!!target} onClose={() => setTarget(null)} title={`Hand over commission — ${target?.name}`}>
        {target && (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <p className="text-sm text-[var(--color-coffee-soft)]">
              {target.name} is owed <strong>{formatMoney(target.due)}</strong>. This is paid out of the cash counter.
            </p>
            <div>
              <label className="field-label">Amount (Rs)</label>
              <input type="number" min="1" className="field-input" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div>
              <label className="field-label">Note (optional)</label>
              <input className="field-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. part payment for this week" />
            </div>
            {error && <p className="text-sm text-[var(--color-terracotta-deep)]">{error}</p>}
            <button className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Confirm Handover"}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default CommissionPanel;

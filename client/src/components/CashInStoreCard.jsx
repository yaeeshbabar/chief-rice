import { useState } from "react";
import { EyeOff, LockKeyhole } from "lucide-react";
import api from "../api/axios.js";
import { formatMoney, formatMoneyUrdu } from "../utils/format.js";

const CashInStoreCard = () => {
  const [revealed, setRevealed] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reveal = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/reports/cash-in-store");
      setData(data);
      setRevealed(true);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load cash in store");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grain-card p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-display font-semibold text-[var(--color-coffee)]">Cash in Store</h3>
        {revealed && (
          <button
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
            onClick={() => setRevealed(false)}
          >
            <EyeOff size={14} />
            Hide
          </button>
        )}
      </div>

      {!revealed ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <LockKeyhole size={24} strokeWidth={1.75} className="text-[var(--ink-faint)]" />
          <p className="text-sm text-[var(--color-coffee-soft)] text-center">
            Hidden by default. Only reveal this when you need to check it.
          </p>
          <button className="btn-outline text-sm" onClick={reveal} disabled={loading}>
            {loading ? "Checking..." : "Show Cash in Store"}
          </button>
          {error && <p className="text-xs text-[var(--color-terracotta-deep)]">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="font-display text-2xl font-semibold text-[var(--color-sage-deep)]">
            {formatMoney(data.totalInStore)}
          </p>
          <p className="text-xs text-[var(--color-coffee-soft)] -mt-2">≈ {formatMoneyUrdu(data.totalInStore)} combined</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--color-cream-deep)] rounded-lg p-3">
              <p className="text-xs text-[var(--color-coffee-soft)]">Physical Cash (counter)</p>
              <p className="font-display font-semibold">{formatMoney(data.cashInCounter)}</p>
            </div>
            <div className="bg-[var(--color-cream-deep)] rounded-lg p-3">
              <p className="text-xs text-[var(--color-coffee-soft)]">Salesman's Account</p>
              <p className="font-display font-semibold">{formatMoney(data.cashInSalesmanAccount)}</p>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--color-wheat)] bg-[var(--surface-soft-brand)] p-3 flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-[var(--color-wheat-dark)]">Reserved for salesman commission</span>
              <span className="font-display font-semibold text-[var(--color-wheat-dark)]">{formatMoney(data.commissionReserved)}</span>
            </div>
            {data.commissionByAgent?.map((a) => (
              <div key={a.name} className="flex justify-between text-xs text-[var(--color-coffee-soft)]">
                <span>{a.name}</span>
                <span>{a.due < 0 ? `${formatMoney(Math.abs(a.due))} overpaid` : formatMoney(a.due)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm pt-1.5 border-t border-[var(--color-husk)]">
              <span className="font-semibold">Cash that is the owner's (counter − reserved)</span>
              <span className="font-display font-semibold">{formatMoney(data.freeCashInCounter)}</span>
            </div>
            <p className="text-[0.7rem] text-[var(--color-coffee-soft)]">
              The reserved part is not the owner's money — it is waiting to be handed to the salesmen above.
            </p>
          </div>

          <div className="mt-1 flex flex-col divide-y divide-[var(--color-husk)] text-sm">
            <div className="flex justify-between py-1.5">
              <span className="text-[var(--color-coffee-soft)]">+ Cash sales</span>
              <span>{formatMoney(data.breakdown.totalCashSales)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[var(--color-coffee-soft)]">+ Credit payments (cash)</span>
              <span>{formatMoney(data.breakdown.totalCashPaymentsCollected)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[var(--color-coffee-soft)]">+ Online sales (salesman account)</span>
              <span>{formatMoney(data.breakdown.totalAccountSales)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[var(--color-coffee-soft)]">+ Credit payments (salesman account)</span>
              <span>{formatMoney(data.breakdown.totalAccountPaymentsCollected)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[var(--color-coffee-soft)]">− Expenses paid (from cash)</span>
              <span>{formatMoney(data.breakdown.totalExpenses)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[var(--color-coffee-soft)]">− Cash returned (Wapsi)</span>
              <span>{formatMoney(data.breakdown.totalWapsiCash)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[var(--color-coffee-soft)]">− Commission handed to salesmen</span>
              <span>{formatMoney(data.breakdown.totalCommissionPaid)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[var(--color-coffee-soft)]">− Handed over from cash</span>
              <span>{formatMoney(data.breakdown.cashHandedOver)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[var(--color-coffee-soft)]">− Handed over from account</span>
              <span>{formatMoney(data.breakdown.accountHandedOver)}</span>
            </div>
          </div>
          <p className="text-xs text-[var(--color-coffee-soft)] italic">
            Money creditors pay directly into one of Asim's accounts is recorded for their balance and profit, but
            never counted here since it never passes through the salesman.
          </p>
        </div>
      )}
    </div>
  );
};

export default CashInStoreCard;

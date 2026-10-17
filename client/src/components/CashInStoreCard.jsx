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
        <h3 className="section-title">Cash in store</h3>
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
            Hidden until you tap Show.
          </p>
          <button className="btn-outline text-sm" onClick={reveal} disabled={loading}>
            {loading ? "Checking..." : "Show cash in store"}
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
              <p className="text-xs text-[var(--color-coffee-soft)]">Cash in counter</p>
              <p className="font-display font-semibold">{formatMoney(data.cashInCounter)}</p>
            </div>
            <div className="bg-[var(--color-cream-deep)] rounded-lg p-3">
              <p className="text-xs text-[var(--color-coffee-soft)]">Salesman's account</p>
              <p className="font-display font-semibold">{formatMoney(data.cashInSalesmanAccount)}</p>
            </div>
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
            {data.breakdown.totalCommissionPaid > 0 && (
              <div className="flex justify-between py-1.5">
                <span className="text-[var(--color-coffee-soft)]">− Commission handed over</span>
                <span>{formatMoney(data.breakdown.totalCommissionPaid)}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5">
              <span className="text-[var(--color-coffee-soft)]">− Handed over from cash</span>
              <span>{formatMoney(data.breakdown.cashHandedOver)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[var(--color-coffee-soft)]">− Handed over from account</span>
              <span>{formatMoney(data.breakdown.accountHandedOver)}</span>
            </div>
          </div>
          <p className="text-xs text-[var(--color-coffee-soft)]">Online payments into Asim's accounts are not counted here.</p>
        </div>
      )}
    </div>
  );
};

export default CashInStoreCard;

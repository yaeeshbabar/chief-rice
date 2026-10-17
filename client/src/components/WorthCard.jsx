import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import api from "../api/axios.js";
import { formatMoney, formatMoneyUrdu } from "../utils/format.js";

const signed = (value) => (value < 0 ? `− ${formatMoney(Math.abs(value))}` : formatMoney(value));

// What the shop has right now: stock at the shop (bori + khula) + money creditors owe + cash in
// store, added together. Hidden until asked, like Cash in store, because it shows the cash.
const WorthCard = () => {
  const [data, setData] = useState(null);
  const [shown, setShown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const show = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/reports/worth");
      setData(res.data);
      setShown(true);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load the total");
    } finally {
      setLoading(false);
    }
  };

  if (!shown) {
    return (
      <section className="grain-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="money-tile-icon">
            <LockKeyhole size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="section-title">Total value</h3>
            <p className="text-xs text-[var(--ink-muted)]">Stock + khata + cash in store, right now</p>
          </div>
        </div>
        <button className="btn-outline text-sm" onClick={show} disabled={loading}>
          <Eye size={15} />
          {loading ? "Checking..." : "Show total"}
        </button>
        {error && <p className="w-full text-xs text-[var(--neg-ink)]">{error}</p>}
      </section>
    );
  }

  const parts = [
    {
      key: "stock",
      label: "Stock at the shop",
      value: data.stockValue,
      sub: `Bori ${formatMoney(data.boriValue)} + khula ${formatMoney(data.khulaValue)}`,
    },
    {
      key: "khata",
      label: "Khata (creditors owe)",
      value: data.khataTotal,
      sub: `${data.creditors} ${data.creditors === 1 ? "creditor" : "creditors"}`,
    },
    {
      key: "cash",
      label: "Cash in store",
      value: data.cashInStore,
      sub: `Counter ${signed(data.cashInCounter)} + salesman account ${signed(data.cashInSalesmanAccount)}`,
    },
  ];
  const whole = parts.reduce((sum, p) => sum + Math.max(0, p.value), 0);

  return (
    <section className="grain-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="section-title">Total value</h3>
          <p className="text-xs text-[var(--ink-muted)]">Stock + khata + cash in store, right now</p>
        </div>
        <button
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
          onClick={() => setShown(false)}
        >
          <EyeOff size={14} />
          Hide
        </button>
      </div>
      <p className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight">{signed(data.total)}</p>
      <p className="text-sm text-[var(--ink-muted)] mt-1">≈ {formatMoneyUrdu(data.total)}</p>

      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        {parts.map((p) => (
          <div key={p.key} className="min-w-0">
            <p className="text-sm text-[var(--ink-muted)]">{p.label}</p>
            <p className={`text-xl font-semibold ${p.value < 0 ? "text-[var(--neg-ink)]" : ""}`}>{signed(p.value)}</p>
            <div className="rice-track mt-2" aria-hidden="true">
              <span
                className={p.value < 0 ? "is-loss" : ""}
                style={{ width: `${whole > 0 ? Math.min(100, Math.max(p.value === 0 ? 0 : 2, (Math.abs(p.value) / whole) * 100)) : 0}%` }}
              />
            </div>
            <p className="text-xs text-[var(--ink-muted)] mt-1.5">{p.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default WorthCard;

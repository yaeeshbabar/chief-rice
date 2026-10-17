import { useEffect, useState } from "react";
import api from "../../api/axios.js";
import StatCard from "../../components/StatCard.jsx";
import Loader from "../../components/Loader.jsx";
import KhulaContainers from "../../components/KhulaContainers.jsx";
import WorthCard from "../../components/WorthCard.jsx";
import { formatMoney, formatMoneyUrdu, formatGrams } from "../../utils/format.js";

const ranges = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "This week" },
  { key: "monthly", label: "This month" },
  { key: "yearly", label: "This year" },
];

const Reports = () => {
  const [range, setRange] = useState("daily");
  const [summary, setSummary] = useState(null);
  const [stockOverview, setStockOverview] = useState(null);
  const [riceTypes, setRiceTypes] = useState([]);
  const [filterType, setFilterType] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get(`/reports/summary?range=${range}`), api.get("/reports/stock-overview"), api.get("/rice-types")])
      .then(([s, so, rt]) => {
        setSummary(s.data);
        setStockOverview(so.data);
        setRiceTypes(rt.data);
      })
      .finally(() => setLoading(false));
  }, [range]);

  if (loading && !summary) return <Loader />;

  const valueOf = (s) => s.quantity * (s.lastPricePerBori || 0);
  const visibleStock = filterType ? stockOverview?.stock?.filter((s) => s.riceType?._id === filterType) : stockOverview?.stock;
  const visibleValue = (visibleStock || []).reduce((sum, s) => sum + valueOf(s), 0);
  const visibleBags = (visibleStock || []).reduce((sum, s) => sum + s.quantity, 0);
  const visiblePools = (stockOverview?.khulaPools || []).filter((p) => !filterType || p.riceType?._id === filterType);
  const khulaValue = visiblePools.reduce((sum, p) => sum + (p.costValue || 0), 0);
  const khulaGrams = visiblePools.reduce((sum, p) => sum + p.remainingGrams, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="page-title">Reports</h2>
        <div className="segmented">
          {ranges.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`segmented-item ${
                range === r.key ? "is-active" : ""
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total sales" value={formatMoney(summary.totalSales)} sub={`${summary.invoiceCount} invoices`} accent="wheat" />
        <StatCard label="Cash sales" value={formatMoney(summary.cashSales)} accent="sage" />
        <StatCard label="Credit sales" value={formatMoney(summary.creditSales)} accent="terracotta" />
        <StatCard label="Expenses" value={formatMoney(summary.totalExpense)} accent="coffee" />
      </div>

      <WorthCard />

      <div className="grain-card p-4">
        <h3 className="section-title mb-3">Expenses by type</h3>
        <div className="flex flex-col divide-y divide-[var(--color-husk)]">
          {Object.entries(summary.expenseByCategory).map(([cat, amt]) => (
            <div key={cat} className="flex justify-between py-2 text-sm">
              <span>{cat}</span>
              <span className="font-semibold">{formatMoney(amt)}</span>
            </div>
          ))}
          {!Object.keys(summary.expenseByCategory).length && (
            <p className="text-sm text-[var(--color-coffee-soft)] text-center py-6">No expenses in this range</p>
          )}
        </div>
      </div>

      <div className="grain-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="section-title">Bori stock</h3>
          <select className="field-input max-w-[200px]" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">All rice types</option>
            {riceTypes.map((rt) => (
              <option key={rt._id} value={rt._id}>
                {rt.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-[var(--color-cream-deep)] rounded-lg p-3">
            <p className="text-xs text-[var(--color-coffee-soft)]">Bori in stock</p>
            <p className="font-display font-semibold">{visibleBags} bags</p>
          </div>
          <div className="bg-[var(--color-cream-deep)] rounded-lg p-3">
            <p className="text-xs text-[var(--color-coffee-soft)]">Bori value</p>
            <p className="font-display font-semibold">{formatMoney(visibleValue)}</p>
            <p className="text-xs text-[var(--color-coffee-soft)]">≈ {formatMoneyUrdu(visibleValue)}</p>
          </div>
          <div className="bg-[var(--color-cream-deep)] rounded-lg p-3">
            <p className="text-xs text-[var(--color-coffee-soft)]">Khula value</p>
            <p className="font-display font-semibold">{formatMoney(khulaValue)}</p>
            <p className="text-xs text-[var(--color-coffee-soft)]">{formatGrams(khulaGrams)} at cost</p>
          </div>
          <div className="bg-[var(--color-cream-deep)] rounded-lg p-3">
            <p className="text-xs text-[var(--color-coffee-soft)]">Bori + khula</p>
            <p className="font-display font-semibold">{formatMoney(visibleValue + khulaValue)}</p>
            <p className="text-xs text-[var(--color-coffee-soft)]">≈ {formatMoneyUrdu(visibleValue + khulaValue)}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[460px]">
            <thead>
              <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
                <th className="py-2 font-medium">Rice type</th>
                <th className="py-2 font-medium">Bori size</th>
                <th className="py-2 font-medium">Qty</th>
                <th className="py-2 font-medium text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-husk)]">
              {visibleStock?.map((s) => (
                <tr key={s._id}>
                  <td className="py-2">{s.riceType?.name}</td>
                  <td className="py-2">{s.boriSize} KG</td>
                  <td className="py-2 font-semibold">{s.quantity} bags</td>
                  <td className="py-2 text-right">{formatMoney(valueOf(s))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grain-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h3 className="section-title">Khula (loose rice)</h3>
          {stockOverview?.khulaPools?.length > 0 && (
            <span className="text-sm text-[var(--ink-muted)]">{formatGrams(stockOverview.totalKhulaGrams)} in total</span>
          )}
        </div>
        <KhulaContainers compact pools={visiblePools} emptyText="No khula open right now" />
      </div>
    </div>
  );
};

export default Reports;

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend } from "recharts";
import api from "../../api/axios.js";
import StatCard from "../../components/StatCard.jsx";
import Loader from "../../components/Loader.jsx";
import KhulaContainers from "../../components/KhulaContainers.jsx";
import { formatMoney, formatMoneyUrdu, formatGrams } from "../../utils/format.js";
import { axisTick, compactNumber, tooltipStyle } from "../../utils/chart.js";


const ranges = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "This week" },
  { key: "monthly", label: "This month" },
  { key: "yearly", label: "This year" },
];

const Dashboard = () => {
  const [range, setRange] = useState("daily");
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [stockOverview, setStockOverview] = useState(null);
  const [khata, setKhata] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.get(`/reports/summary?range=${range}`),
      api.get(`/reports/sales-trend?range=${range}`),
      api.get("/reports/stock-overview"),
      api.get("/reports/khata-overview"),
    ])
      .then(([s, t, so, k]) => {
        if (!active) return;
        setSummary(s.data);
        setTrend(t.data);
        setStockOverview(so.data);
        setKhata(k.data);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [range]);

  if (loading && !summary) return <Loader label="Loading dashboard..." />;

  const expenseData = summary
    ? Object.entries(summary.expenseByCategory).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="page-title">Overview</h2>
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
        <StatCard label="Total sales" value={formatMoney(summary.totalSales)} sub={`${summary.invoiceCount} invoices · ≈ ${formatMoneyUrdu(summary.totalSales)}`} accent="wheat" />
        <StatCard label="Cash sales" value={formatMoney(summary.cashSales)} accent="sage" />
        <StatCard label="Credit sales" value={formatMoney(summary.creditSales)} accent="terracotta" />
        <StatCard label="Expenses" value={formatMoney(summary.totalExpense)} sub={`Net cash ${formatMoney(summary.netCash)}`} accent="coffee" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="grain-card p-4 lg:col-span-2">
          <h3 className="section-title mb-3">Sales trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compactNumber} width={48} />
                <Tooltip formatter={(v) => formatMoney(v)} {...tooltipStyle} cursor={{ stroke: "var(--line-strong)" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--ink-muted)" }} />
                <Line type="monotone" dataKey="cash" stroke="var(--pos)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Cash" />
                <Line type="monotone" dataKey="credit" stroke="var(--neg)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Credit" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grain-card p-4">
          <h3 className="section-title mb-3">Expenses by type</h3>
          {expenseData.length === 0 ? (
            <p className="text-sm text-[var(--color-coffee-soft)] py-10 text-center">No expenses recorded yet</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} tickFormatter={compactNumber} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "var(--ink)" }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip formatter={(v) => formatMoney(v)} {...tooltipStyle} cursor={{ fill: "var(--bg-subtle)" }} />
                  <Bar dataKey="value" name="Spent" fill="var(--accent)" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="grain-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title">Bori stock</h3>
            <Link to="/admin/stock" className="text-xs font-semibold text-[var(--color-wheat-dark)]">
              Manage stock
            </Link>
          </div>
          <div className="flex items-center justify-between bg-[var(--color-cream-deep)] rounded-lg px-3 py-2 mb-3 text-sm">
            <span className="text-[var(--color-coffee-soft)]">Total stock value</span>
            <span className="font-display font-semibold">
              {formatMoney(stockOverview?.totalStockValue)}{" "}
              <span className="text-xs font-normal text-[var(--color-coffee-soft)]">
                (≈ {formatMoneyUrdu(stockOverview?.totalStockValue)})
              </span>
            </span>
          </div>
          <div className="flex flex-col divide-y divide-[var(--color-husk)]">
            {stockOverview?.stock?.length ? (
              stockOverview.stock.map((s) => (
                <div key={s._id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium text-[var(--color-coffee)]">
                    {s.riceType?.name} — {s.boriSize}KG Bori
                  </span>
                  <span className="font-semibold">{s.quantity} bags</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--color-coffee-soft)] py-6 text-center">No stock added yet</p>
            )}
          </div>
        </div>

        <div className="grain-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title">Khata (credit owed)</h3>
            <Link to="/admin/khata" className="text-xs font-semibold text-[var(--color-wheat-dark)]">
              View all
            </Link>
          </div>
          <p className="font-display text-2xl font-semibold text-[var(--color-terracotta-deep)] mb-3">
            {formatMoney(khata?.totalOutstanding)}
          </p>
          <div className="flex flex-col divide-y divide-[var(--color-husk)]">
            {khata?.customers?.slice(0, 5).map((c) => (
              <Link
                to={`/admin/khata/${c._id}`}
                key={c._id}
                className="flex items-center justify-between py-2 text-sm hover:text-[var(--color-wheat-dark)]"
              >
                <span className="font-medium">{c.name}</span>
                <span className="font-semibold">{formatMoney(c.balance)}</span>
              </Link>
            ))}
            {!khata?.customers?.length && (
              <p className="text-sm text-[var(--color-coffee-soft)] py-6 text-center">No outstanding credit</p>
            )}
          </div>
        </div>
      </div>

      <div className="grain-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-title">Khula (loose rice)</h3>
            {stockOverview?.khulaPools?.length > 0 && (
              <p className="text-xs text-[var(--ink-muted)]">
                {formatGrams(stockOverview.totalKhulaGrams)} in total · about {formatMoney(stockOverview.totalKhulaValue)} at cost
              </p>
            )}
          </div>
          <Link to="/admin/stock" className="text-xs font-semibold text-[var(--accent-ink)]">
            Details
          </Link>
        </div>
        <KhulaContainers compact pools={stockOverview?.khulaPools || []} emptyText="No khula open right now" />
      </div>
    </div>
  );
};

export default Dashboard;

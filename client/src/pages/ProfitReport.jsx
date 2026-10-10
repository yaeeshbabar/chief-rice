import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from "recharts";
import api from "../api/axios.js";
import Loader from "../components/Loader.jsx";
import StatCard from "../components/StatCard.jsx";
import { formatMoney, formatMoneyUrdu, monthBounds } from "../utils/format.js";
import { axisTick, compactNumber, tooltipStyle } from "../utils/chart.js";

const quickRanges = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "", label: "All Time / Custom" },
];

// One row of the statement. kind: "plus" | "minus" | "total"
const Line = ({ label, value, kind = "plus", strong, hint }) => (
  <div className={`flex items-start justify-between gap-3 py-2 text-sm ${strong ? "font-semibold" : ""}`}>
    <span className={kind === "minus" ? "text-[var(--color-coffee-soft)] pl-3" : ""}>
      {kind === "minus" ? "− " : ""}
      {label}
      {hint && <span className="block text-xs font-normal text-[var(--color-coffee-soft)]">{hint}</span>}
    </span>
    <span
      className={
        kind === "total"
          ? value < 0
            ? "text-[var(--color-terracotta-deep)]"
            : "text-[var(--color-sage-deep)]"
          : ""
      }
    >
      {kind === "minus" ? `− ${formatMoney(Math.abs(value))}` : formatMoney(value)}
    </span>
  </div>
);

const Breakdown = ({ items }) =>
  items.length ? (
    <div className="pl-6 pb-1 text-xs text-[var(--color-coffee-soft)] flex flex-col gap-0.5">
      {items.map((i) => (
        <div key={i.name} className="flex justify-between">
          <span>{i.name}</span>
          <span>{formatMoney(i.amount)}</span>
        </div>
      ))}
    </div>
  ) : null;

const ProfitReport = () => {
  const [quick, setQuick] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (quick) params.set("quick", quick);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    api
      .get(`/reports/profit-report?${params.toString()}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.message || "Could not load the profit report"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [quick, from, to]);

  const selectMonth = (value) => {
    setMonth(value);
    setQuick("");
    const b = monthBounds(value);
    setFrom(b.from);
    setTo(b.to);
  };

  if (loading) return <Loader />;
  if (error) return <p className="grain-card p-6 text-center text-sm text-[var(--color-terracotta-deep)]">{error}</p>;
  if (!data) return null;

  // Plain-language observations for the owner
  const insights = [];
  const best = data.profitByRice[0];
  if (best && best.grossProfit > 0) insights.push({ tone: "good", text: `${best.name} earns you the most: ${formatMoney(best.grossProfit)} profit (${best.margin.toFixed(1)}% margin).` });
  const losers = data.profitByRice.filter((r) => r.grossProfit < 0);
  if (losers.length) insights.push({ tone: "bad", text: `Sold below cost: ${losers.map((r) => `${r.name} (${formatMoney(r.grossProfit)})`).join(", ")}. Check those prices.` });
  const thin = data.profitByRice.filter((r) => r.grossProfit >= 0 && r.revenue > 0 && r.margin < 3);
  if (thin.length) insights.push({ tone: "warn", text: `Very thin margin (under 3%): ${thin.map((r) => r.name).join(", ")}.` });
  const fixedCosts = data.shopExpensesTotal + data.salaryTotal;
  if (fixedCosts > data.salesProfit && data.invoiceCount > 0)
    insights.push({ tone: "bad", text: `Shop expenses + salaries (${formatMoney(fixedCosts)}) are more than the profit from sales (${formatMoney(data.salesProfit)}) in this period.` });
  if (data.totalRevenue > 0 && data.salesProfit > 0 && fixedCosts > 0) {
    const ratio = data.salesProfit / data.totalRevenue;
    insights.push({ tone: "info", text: `At your current margin you need about ${formatMoney(fixedCosts / ratio)} of sales to cover shop expenses and salaries.` });
  }
  if (data.returnsNetLoss > 0) insights.push({ tone: "warn", text: `Returns cost you ${formatMoney(data.returnsNetLoss)} in this period.` });
  const toneClass = {
    good: "bg-[var(--surface-soft)] text-[var(--color-sage-deep)]",
    bad: "bg-[var(--surface-soft-danger)] text-[var(--color-terracotta-deep)]",
    warn: "bg-[var(--surface-soft-danger)] text-[var(--color-terracotta-deep)]",
    info: "bg-[var(--surface-soft-brand)] text-[var(--color-wheat-dark)]",
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-[var(--color-coffee)]">Profit &amp; Loss</h2>
        <p className="text-sm text-[var(--color-coffee-soft)]">
          Everything from the sale price down to what is actually left for Asim after all costs.
        </p>
      </div>

      <div className="grain-card p-4 flex flex-wrap items-end gap-3">
        <div className="segmented">
          {quickRanges.map((r) => (
            <button
              key={r.label}
              onClick={() => {
                setQuick(r.key);
                setMonth("");
                if (r.key) {
                  setFrom("");
                  setTo("");
                }
              }}
              className={`segmented-item ${
                quick === r.key && !month && !from && !to ? "is-active" : ""
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div>
          <label className="field-label">Month</label>
          <input type="month" className="field-input" value={month} onChange={(e) => selectMonth(e.target.value)} />
        </div>
        <div>
          <label className="field-label">From</label>
          <input type="date" className="field-input" value={from} onChange={(e) => { setFrom(e.target.value); setQuick(""); setMonth(""); }} />
        </div>
        <div>
          <label className="field-label">To</label>
          <input type="date" className="field-input" value={to} onChange={(e) => { setTo(e.target.value); setQuick(""); setMonth(""); }} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Sales" value={formatMoney(data.totalRevenue)} sub={`${data.invoiceCount} bills`} accent="wheat" />
        <StatCard label="Gross Profit" value={formatMoney(data.grossProfit)} sub={`${data.grossMarginPercent.toFixed(1)}% of sales`} accent="sage" />
        <StatCard label="Business Net Profit" value={formatMoney(data.businessNetProfit)} sub={`${data.netMarginPercent.toFixed(1)}% of sales`} accent={data.businessNetProfit < 0 ? "terracotta" : "sage"} />
        <StatCard label="Owner Take-Home" value={formatMoney(data.ownerTakeHome)} sub={`≈ ${formatMoneyUrdu(data.ownerTakeHome)}`} accent={data.ownerTakeHome < 0 ? "terracotta" : "coffee"} />
      </div>

      {insights.length > 0 && (
        <div className="grain-card p-4 flex flex-col gap-2">
          <h3 className="font-display font-semibold text-[var(--color-coffee)]">What this tells you</h3>
          {insights.map((i, idx) => (
            <p key={idx} className={`text-sm rounded-lg px-3 py-2 ${toneClass[i.tone]}`}>
              {i.text}
            </p>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="grain-card p-4">
          <h3 className="font-display font-semibold text-[var(--color-coffee)] mb-1">Profit &amp; Loss Statement</h3>
          <div className="flex flex-col divide-y divide-[var(--color-husk)]">
            <Line label="Sales (what customers paid)" value={data.totalRevenue} />
            <Line label="Cost of the rice sold" value={data.totalCostOfGoods} kind="minus" />
            <Line label="Gross profit" value={data.grossProfit} kind="total" strong />
            <Line label="Ride / delivery on those sales" value={data.totalRideCost} kind="minus" />
            <Line label="Salesman commission" value={data.totalCommission} kind="minus" />
            <Line label="Profit from sales" value={data.salesProfit} kind="total" strong />
            <div>
              <Line label="Shop expenses" value={data.shopExpensesTotal} kind="minus" hint="Wifi, rent, electricity, petrol, etc." />
              <Breakdown items={data.shopExpenses} />
            </div>
            <div>
              <Line label="Salaries" value={data.salaryTotal} kind="minus" />
              <Breakdown items={data.salaries} />
            </div>
            <Line label="Net loss on returns" value={data.returnsNetLoss} kind="minus" hint={`Refunded ${formatMoney(data.returnsRefund)}, rice returned to stock worth ${formatMoney(data.returnsCostRecovered)}`} />
            <Line label="Business net profit" value={data.businessNetProfit} kind="total" strong />
            <div>
              <Line label="Asim's personal expenses" value={data.personalExpensesTotal} kind="minus" />
              <Breakdown items={data.personalExpenses} />
            </div>
            <Line label="Owner take-home" value={data.ownerTakeHome} kind="total" strong />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grain-card p-4">
            <h3 className="font-display font-semibold text-[var(--color-coffee)] mb-3">Profit by Day</h3>
            {data.dailyProfit.length ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.dailyProfit} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(d) => d.slice(5)} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compactNumber} width={48} />
                    <Tooltip
                      formatter={(v) => formatMoney(v)}
                      labelFormatter={(l) => `Date ${l}`}
                      {...tooltipStyle}
                      cursor={{ fill: "var(--bg-subtle)" }}
                    />
                    <ReferenceLine y={0} stroke="var(--line-strong)" />
                    <Bar dataKey="profit" name="Profit from sales" radius={[4, 4, 0, 0]} maxBarSize={36}>
                      {data.dailyProfit.map((d) => (
                        <Cell key={d.date} fill={d.profit < 0 ? "var(--neg)" : "var(--pos)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-center text-[var(--color-coffee-soft)] py-10">No sales in this period</p>
            )}
          </div>

          <div className="grain-card p-4">
            <h3 className="font-display font-semibold text-[var(--color-coffee)] mb-3">Commission Earned by Salesman</h3>
            <div className="flex flex-col divide-y divide-[var(--color-husk)]">
              {Object.entries(data.commissionByAgent).map(([name, amt]) => (
                <div key={name} className="flex justify-between py-2 text-sm">
                  <span className="font-medium">{name}</span>
                  <span className="font-semibold">{formatMoney(amt)}</span>
                </div>
              ))}
              {!Object.keys(data.commissionByAgent).length && (
                <p className="text-sm text-[var(--color-coffee-soft)] text-center py-4">No commission earned in this range</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grain-card p-4 overflow-x-auto">
        <h3 className="font-display font-semibold text-[var(--color-coffee)] mb-3">Profit by Rice Type</h3>
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
              <th className="py-2 font-medium">Rice</th>
              <th className="py-2 font-medium text-right">KG sold</th>
              <th className="py-2 font-medium text-right">Sales</th>
              <th className="py-2 font-medium text-right">Cost</th>
              <th className="py-2 font-medium text-right">Gross profit</th>
              <th className="py-2 font-medium text-right">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-husk)]">
            {data.profitByRice.map((r) => (
              <tr key={r.name}>
                <td className="py-2 font-medium">{r.name}</td>
                <td className="py-2 text-right">{Math.round(r.kgSold * 100) / 100}</td>
                <td className="py-2 text-right">{formatMoney(r.revenue)}</td>
                <td className="py-2 text-right">{formatMoney(r.cost)}</td>
                <td className={`py-2 text-right font-semibold ${r.grossProfit < 0 ? "text-[var(--color-terracotta-deep)]" : "text-[var(--color-sage-deep)]"}`}>{formatMoney(r.grossProfit)}</td>
                <td className="py-2 text-right">{r.margin.toFixed(1)}%</td>
              </tr>
            ))}
            {!data.profitByRice.length && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-[var(--color-coffee-soft)]">No sales in this period</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProfitReport;

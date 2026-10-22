import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from "recharts";
import { ChevronDown, TrendingDown, TrendingUp } from "lucide-react";
import api from "../api/axios.js";
import Loader from "../components/Loader.jsx";
import PeriodPicker from "../components/PeriodPicker.jsx";
import { periodPhrase, periodQuery } from "../utils/period.js";
import { formatMoney, formatMoneyUrdu } from "../utils/format.js";
import { axisTick, compactNumber, tooltipStyle } from "../utils/chart.js";

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// "2026-10-02" -> "2 Oct"
const dayLabel = (iso) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : iso;
};

// Where the sales money went: grey for every cost, green for what is left as profit.
const MoneyBar = ({ data }) => {
  const [hover, setHover] = useState(null);
  const profit = data.businessNetProfit;
  const costs = [
    { key: "rice", label: "Rice cost", value: data.totalCostOfGoods },
    { key: "delivery", label: "Delivery", value: data.totalRideCost },
    { key: "commission", label: "Commission", value: data.totalCommission },
    { key: "shop", label: "Shop expenses", value: data.shopExpensesTotal },
    { key: "salary", label: "Salaries", value: data.salaryTotal },
    { key: "returns", label: "Returns loss", value: Math.max(0, data.returnsNetLoss) },
  ].filter((c) => c.value > 0);
  const costTotal = costs.reduce((sum, c) => sum + c.value, 0);
  const scale = profit > 0 ? costTotal + profit : costTotal;
  if (scale <= 0) return null;

  const segments = [
    ...costs.map((c) => ({ ...c, kind: "cost" })),
    ...(profit > 0 ? [{ key: "profit", label: "Profit", value: profit, kind: "profit" }] : []),
  ];
  const salesMark = profit < 0 && costTotal > 0 ? (data.totalRevenue / costTotal) * 100 : null;
  const active = segments.find((s) => s.key === hover);

  return (
    <div className="mt-6">
      <div className="money-bar" role="img" aria-label={`Costs ${formatMoney(costTotal)}, ${profit >= 0 ? "profit" : "loss"} ${formatMoney(Math.abs(profit))}`}>
        <div className="money-bar-track">
        {segments.map((s) => (
          <span
            key={s.key}
            tabIndex={0}
            className={`money-bar-part is-${s.kind} ${hover && hover !== s.key ? "is-dim" : ""}`}
            style={{ width: `${(s.value / scale) * 100}%` }}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(s.key)}
            onBlur={() => setHover(null)}
          />
        ))}
        </div>
        {salesMark !== null && <span className="money-bar-mark" style={{ left: `${Math.min(100, salesMark)}%` }} />}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm min-h-[1.5rem]">
        {active ? (
          <span>
            <span className={`swatch is-${active.kind}`} />
            {active.label}: <strong>{formatMoney(active.value)}</strong>
            <span className="text-[var(--ink-muted)]"> ({pct(active.value, data.totalRevenue)}% of sales)</span>
          </span>
        ) : (
          <>
            <span>
              <span className="swatch is-cost" />
              Costs <strong>{formatMoney(costTotal)}</strong>
            </span>
            {profit > 0 && (
              <span>
                <span className="swatch is-profit" />
                Profit <strong>{formatMoney(profit)}</strong>
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// One line of the step-by-step working; tap a line with a list to open it.
const Step = ({ label, value, minus = false, total = false, items }) => {
  const [open, setOpen] = useState(false);
  const canOpen = Boolean(items && items.length);
  const tone = total ? (value < 0 ? "text-[var(--neg-ink)]" : "text-[var(--pos-ink)]") : minus ? "text-[var(--ink-muted)]" : "";
  return (
    <li className={total ? "step is-total" : "step"}>
      <button
        type="button"
        className="step-row"
        onClick={() => canOpen && setOpen((o) => !o)}
        aria-expanded={canOpen ? open : undefined}
        disabled={!canOpen}
      >
        <span className="flex items-center gap-1.5">
          {total ? "= " : minus ? "− " : ""}
          {label}
          {canOpen && <ChevronDown size={14} className={`text-[var(--ink-faint)] transition-transform ${open ? "rotate-180" : ""}`} />}
        </span>
        <span className={`tabular-nums ${tone}`}>{formatMoney(value)}</span>
      </button>
      {open && (
        <ul className="pb-2 pl-5 pr-1 text-xs text-[var(--ink-muted)] flex flex-col gap-1">
          {items.map((i) => (
            <li key={i.name} className="flex justify-between gap-3">
              <span>{i.name}</span>
              <span className="tabular-nums">{formatMoney(i.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

const ProfitReport = () => {
  const [period, setPeriod] = useState({ key: "month", from: "", to: "" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get(`/reports/profit-report?${periodQuery(period)}`)
      .then((res) => {
        if (!active) return;
        setData(res.data);
        setError("");
      })
      .catch((err) => active && setError(err?.response?.data?.message || "Could not load profit"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [period]);

  const changePeriod = (next) => {
    setLoading(true);
    setPeriod(next);
  };

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h2 className="page-title">Profit</h2>
      <PeriodPicker value={period} onChange={changePeriod} />
    </div>
  );

  if (loading && !data) return <div className="flex flex-col gap-6">{header}<Loader /></div>;
  if (error && !data) return <div className="flex flex-col gap-6">{header}<p className="grain-card p-6 text-center text-sm text-[var(--neg-ink)]">{error}</p></div>;

  const profit = data.businessNetProfit;
  const isLoss = profit < 0;
  const hasSales = data.totalRevenue > 0;

  // A few short signals, most important first
  const signals = [];
  const best = data.profitByRice[0];
  if (best && best.grossProfit > 0) signals.push({ tone: "good", text: `${best.name} earns most` });
  const losers = data.profitByRice.filter((r) => r.grossProfit < 0);
  if (losers.length) signals.push({ tone: "bad", text: `Sold below cost: ${losers.map((r) => r.name).join(", ")}` });
  if (data.shopExpensesTotal + data.salaryTotal > data.salesProfit && data.invoiceCount > 0)
    signals.push({ tone: "bad", text: "Expenses more than sales profit" });
  if (data.returnsNetLoss > 0) signals.push({ tone: "warn", text: `Returns cost ${formatMoney(data.returnsNetLoss)}` });
  if (data.totalDiscount > 0) signals.push({ tone: "warn", text: `Discounts given ${formatMoney(data.totalDiscount)}` });
  if (data.totalExtra > 0) signals.push({ tone: "good", text: `Extra received ${formatMoney(data.totalExtra)}` });

  const maxRice = Math.max(1, ...data.profitByRice.map((r) => Math.abs(r.grossProfit)));
  const commission = Object.entries(data.commissionByAgent || {});

  return (
    <div className={`flex flex-col gap-6 ${loading ? "opacity-60 transition-opacity" : ""}`}>
      {header}

      <section className="grain-card p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-grid place-items-center h-8 w-8 rounded-full ${isLoss ? "bg-[var(--neg-tint)] text-[var(--neg-ink)]" : "bg-[var(--pos-tint)] text-[var(--pos-ink)]"}`}>
                {isLoss ? <TrendingDown size={17} /> : <TrendingUp size={17} />}
              </span>
              <span className="text-base font-semibold">{isLoss ? "Shop loss" : "Shop profit"}</span>
              <span className="text-sm text-[var(--ink-muted)]">({isLoss ? "nuqsan" : "munafa"})</span>
            </div>
            <p className={`hero-figure mt-3 ${isLoss ? "text-[var(--neg-ink)]" : ""}`}>{formatMoney(Math.abs(profit))}</p>
            <p className="text-sm text-[var(--ink-muted)] mt-1">≈ {formatMoneyUrdu(Math.abs(profit))}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-[var(--ink-muted)]">Sales</dt>
              <dd className="text-lg font-semibold">{formatMoney(data.totalRevenue)}</dd>
            </div>
            <div>
              <dt className="text-[var(--ink-muted)]">Bills</dt>
              <dd className="text-lg font-semibold">{data.invoiceCount}</dd>
            </div>
            <div>
              <dt className="text-[var(--ink-muted)]">All costs</dt>
              <dd className="text-lg font-semibold">{formatMoney(data.totalRevenue - profit)}</dd>
            </div>
            <div>
              <dt className="text-[var(--ink-muted)]">Take-home</dt>
              <dd className={`text-lg font-semibold ${data.ownerTakeHome < 0 ? "text-[var(--neg-ink)]" : ""}`}>{formatMoney(data.ownerTakeHome)}</dd>
            </div>
          </dl>
        </div>

        {hasSales ? (
          <>
            <MoneyBar data={data} />
            <p className="mt-3 text-sm">
              {isLoss
                ? `Costs are ${formatMoney(-profit)} more than sales.`
                : `From every Rs 100 sold, Rs ${pct(profit, data.totalRevenue)} is profit.`}
            </p>
          </>
        ) : (
          <p className="mt-5 text-sm text-[var(--ink-muted)]">No sales {periodPhrase(period)}.</p>
        )}

        {signals.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {signals.slice(0, 4).map((s) => (
              <span key={s.text} className={`signal is-${s.tone}`}>
                {s.text}
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="grid lg:grid-cols-5 gap-4 items-start">
        <section className="grain-card p-4 sm:p-5 lg:col-span-2">
          <h3 className="section-title mb-2">How it adds up</h3>
          <ul className="steps">
            <Step label="Sales" value={data.totalRevenue} />
            <Step label="Rice cost" value={data.totalCostOfGoods} minus />
            <Step label="Profit on rice" value={data.grossProfit} total />
            {data.totalRideCost > 0 && <Step label="Delivery" value={data.totalRideCost} minus />}
            {data.totalCommission > 0 && <Step label="Commission" value={data.totalCommission} minus />}
            <Step label="Shop expenses" value={data.shopExpensesTotal} minus items={data.shopExpenses} />
            <Step label="Salaries" value={data.salaryTotal} minus items={data.salaries} />
            {data.returnsNetLoss > 0 && <Step label="Returns loss" value={data.returnsNetLoss} minus />}
            {data.returnsNetLoss < 0 && <Step label="Returns gain" value={-data.returnsNetLoss} />}
            <Step label="Shop profit" value={data.businessNetProfit} total />
            <Step label="Personal kharcha" value={data.personalExpensesTotal} minus items={data.personalExpenses} />
            <Step label="Take-home" value={data.ownerTakeHome} total />
          </ul>
        </section>

        <div className="lg:col-span-3 flex flex-col gap-4">
          <section className="grain-card p-4 sm:p-5">
            <h3 className="section-title mb-3">By rice type</h3>
            {data.profitByRice.length ? (
              <ul className="flex flex-col gap-3">
                {data.profitByRice.map((r) => (
                  <li key={r.name}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">
                        {r.name}
                        <span className="text-xs font-normal text-[var(--ink-muted)]"> {Math.round(r.kgSold * 10) / 10} KG sold</span>
                      </span>
                      <span className={`font-semibold tabular-nums ${r.grossProfit < 0 ? "text-[var(--neg-ink)]" : ""}`}>
                        {r.grossProfit < 0 ? "− " : ""}
                        {formatMoney(Math.abs(r.grossProfit))}
                      </span>
                    </div>
                    <div className="rice-track mt-1.5">
                      <span
                        className={r.grossProfit < 0 ? "is-loss" : ""}
                        style={{ width: `${Math.max(2, (Math.abs(r.grossProfit) / maxRice) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--ink-muted)] py-4">No sales yet.</p>
            )}
          </section>

          <section className="grain-card p-4 sm:p-5">
            <h3 className="section-title mb-3">Profit from sales, each day</h3>
            {data.dailyProfit.length ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.dailyProfit} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={dayLabel} minTickGap={12} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compactNumber} width={48} />
                    <Tooltip formatter={(v) => formatMoney(v)} labelFormatter={dayLabel} {...tooltipStyle} cursor={{ fill: "var(--bg-subtle)" }} />
                    <ReferenceLine y={0} stroke="var(--line-strong)" />
                    <Bar dataKey="profit" name="Profit" radius={[4, 4, 0, 0]} maxBarSize={24}>
                      {data.dailyProfit.map((d) => (
                        <Cell key={d.date} fill={d.profit < 0 ? "var(--neg)" : "var(--pos)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-[var(--ink-muted)] py-4">No sales yet.</p>
            )}
          </section>

          {commission.length > 0 && (
            <section className="grain-card p-4 sm:p-5">
              <h3 className="section-title mb-2">Commission</h3>
              <ul className="flex flex-col divide-y divide-[var(--line)]">
                {commission.map(([name, amount]) => (
                  <li key={name} className="flex justify-between py-2 text-sm">
                    <span>{name}</span>
                    <span className="font-semibold tabular-nums">{formatMoney(amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfitReport;

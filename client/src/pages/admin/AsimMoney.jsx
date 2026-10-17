import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, Banknote, Landmark } from "lucide-react";
import api from "../../api/axios.js";
import Loader from "../../components/Loader.jsx";
import PeriodPicker from "../../components/PeriodPicker.jsx";
import { periodPhrase, periodQuery } from "../../utils/period.js";
import { formatMoney, formatMoneyUrdu, formatDateTime } from "../../utils/format.js";

const groupIcon = { bank: Landmark, cash: Banknote, transfer: ArrowLeftRight };
const countText = (g) => {
  const word = g.kind === "cash" ? "handover" : g.kind === "transfer" ? "transfer" : "payment";
  return `${g.count} ${word}${g.count === 1 ? "" : "s"}`;
};
const tileTitle = (g) => (g.kind === "bank" ? g.bankName : g.label);
const tileSub = (g) => {
  if (g.kind === "bank") return `Asim${g.last4 ? ` ••${g.last4}` : ""}`;
  return g.kind === "cash" ? "Handed over" : "Sent to Asim";
};
// Where the money ended up, in words
const intoText = (g) => {
  if (!g) return "";
  if (g.kind === "bank") return `${g.bankName}${g.last4 ? ` ••${g.last4}` : ""}`;
  return g.kind === "cash" ? "Cash in hand" : "Asim's bank";
};

const What = ({ item }) => {
  if (item.type === "bill") {
    return (
      <Link to={`/admin/invoices/${item._id}`} className="font-medium text-[var(--accent-ink)] hover:underline">
        {item.title}
      </Link>
    );
  }
  if (item.type === "khata" && item.customerId) {
    return (
      <Link to={`/admin/khata/${item.customerId}`} className="font-medium text-[var(--accent-ink)] hover:underline">
        {item.title}
      </Link>
    );
  }
  return <span className="font-medium">{item.title}</span>;
};

// Every payment that reached Asim: each bank account, cash handed over, and money sent from
// the salesman's account - one by one, and added together.
const AsimMoney = () => {
  const [period, setPeriod] = useState({ key: "month", from: "", to: "" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get(`/reports/asim-money?${periodQuery(period)}`)
      .then((res) => {
        if (!active) return;
        setData(res.data);
        setError("");
      })
      .catch((err) => active && setError(err?.response?.data?.message || "Could not load payments"))
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
      <h2 className="page-title">Paid to Asim</h2>
      <PeriodPicker value={period} onChange={changePeriod} />
    </div>
  );

  if (loading && !data) return <div className="flex flex-col gap-6">{header}<Loader /></div>;
  if (error && !data) return <div className="flex flex-col gap-6">{header}<p className="grain-card p-6 text-center text-sm text-[var(--neg-ink)]">{error}</p></div>;

  const groups = data.groups;
  const groupOf = (key) => groups.find((g) => g.key === key);
  const items = selected ? data.items.filter((i) => i.groupKey === selected) : data.items;
  const selectedGroup = groupOf(selected);

  return (
    <div className={`flex flex-col gap-6 ${loading ? "opacity-60 transition-opacity" : ""}`}>
      {header}

      <section>
        <p className="text-sm text-[var(--ink-muted)]">Total received {periodPhrase(period)}</p>
        <p className="hero-figure mt-2">{formatMoney(data.total)}</p>
        <p className="text-sm text-[var(--ink-muted)] mt-1.5">
          ≈ {formatMoneyUrdu(data.total)}, {data.items.length} {data.items.length === 1 ? "payment" : "payments"}
        </p>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {groups.map((g) => {
          const Icon = groupIcon[g.kind] || Landmark;
          const isOn = selected === g.key;
          return (
            <button
              key={g.key}
              type="button"
              aria-pressed={isOn}
              onClick={() => setSelected(isOn ? "" : g.key)}
              className={`money-tile ${isOn ? "is-on" : ""} ${g.count === 0 ? "is-empty" : ""}`}
            >
              <span className="flex items-start gap-2 min-w-0">
                <span className={`money-tile-icon is-${g.kind}`}>
                  <Icon size={16} />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block font-semibold leading-snug break-words">{tileTitle(g)}</span>
                  <span className="block text-xs text-[var(--ink-muted)] truncate">{tileSub(g)}</span>
                </span>
              </span>
              <span className="block mt-3 text-lg font-semibold text-left">{formatMoney(g.total)}</span>
              <span className="block text-xs text-[var(--ink-muted)] text-left">{countText(g)}</span>
            </button>
          );
        })}
      </div>

      <section className="grain-card">
        <div className="px-4 pt-4 pb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="section-title">
            {selectedGroup ? `${tileTitle(selectedGroup)}: ${formatMoney(selectedGroup.total)}` : "Every payment"}
          </h3>
          {selected && (
            <button className="text-sm font-medium text-[var(--accent-ink)] hover:underline" onClick={() => setSelected("")}>
              Show all
            </button>
          )}
        </div>

        {/* Phone: one line per payment, amount always in view */}
        <ul className="md:hidden divide-y divide-[var(--line)]">
          {items.map((i) => (
            <li key={`${i.type}-${i._id}`} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <What item={i} />
                <p className="text-xs text-[var(--ink-muted)] truncate">{i.from}</p>
                <p className="text-xs text-[var(--ink-faint)]">{formatDateTime(i.date)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold">{formatMoney(i.amount)}</p>
                <p className="text-xs text-[var(--ink-muted)]">{intoText(groupOf(i.groupKey))}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Bigger screens: a table */}
        <div className={`hidden overflow-x-auto ${items.length ? "md:block" : ""}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-[var(--line)]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">What</th>
                <th className="py-3 px-4">From</th>
                <th className="py-3 px-4">Into</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {items.map((i) => (
                <tr key={`${i.type}-${i._id}`}>
                  <td className="py-2.5 px-4 whitespace-nowrap">{formatDateTime(i.date)}</td>
                  <td className="py-2.5 px-4">
                    <What item={i} />
                    {i.note && <span className="block text-xs text-[var(--ink-muted)]">{i.note}</span>}
                  </td>
                  <td className="py-2.5 px-4">{i.from}</td>
                  <td className="py-2.5 px-4 whitespace-nowrap">{intoText(groupOf(i.groupKey))}</td>
                  <td className="py-2.5 px-4 text-right font-semibold">{formatMoney(i.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!items.length && <p className="py-10 text-center text-sm text-[var(--ink-muted)]">Nothing received {periodPhrase(period)}</p>}
      </section>
    </div>
  );
};

export default AsimMoney;

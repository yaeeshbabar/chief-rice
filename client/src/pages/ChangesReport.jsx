import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios.js";
import Loader from "../components/Loader.jsx";
import Modal from "../components/Modal.jsx";
import { formatMoney, formatDateTime } from "../utils/format.js";

// Areas of the app that record corrections in the change log
const areas = [
  { key: "", label: "Everything" },
  { key: "stock", label: "Stock" },
  { key: "rice-type", label: "Rice types" },
  { key: "khula", label: "Khula" },
  { key: "payment", label: "Payments" },
  { key: "wapsi", label: "Returns" },
  { key: "expense", label: "Expenses" },
  { key: "handover", label: "Cash handovers" },
  { key: "commission", label: "Commission" },
  { key: "customer", label: "Customers" },
  { key: "settings", label: "Settings and logins" },
];
const areaLabel = (key) => areas.find((a) => a.key === key)?.label || key;

const actionBadge = (action) => {
  if (["delete", "undo"].includes(action)) return "badge-credit";
  if (["add", "restore", "turn-on"].includes(action)) return "badge-active";
  if (["close", "turn-off"].includes(action)) return "badge-finished";
  return "badge-over";
};
const actionLabel = (action) =>
  ({
    edit: "Corrected",
    delete: "Deleted",
    undo: "Undone",
    adjust: "Count fixed",
    rename: "Renamed",
    restore: "Added back",
    add: "Added",
    close: "Closed",
    "turn-on": "Turned on",
    "turn-off": "Turned off",
  })[action] || action;

const BillChanges = ({ role }) => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    api
      .get("/sales/changes")
      .then((res) => setSales(res.data))
      .catch((err) => setError(err?.response?.data?.message || "Could not load the changes report"))
      .finally(() => setLoading(false));
  }, []);

  const invoiceBase = role === "admin" ? "/admin/invoices" : "/salesman/invoices";

  if (loading) return <Loader />;
  if (error) return <p className="grain-card p-6 text-center text-sm text-[var(--color-terracotta-deep)]">{error}</p>;

  return (
    <>
      <div className="grain-card overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
              <th className="py-3 px-4 font-medium">Invoice #</th>
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium">Changes</th>
              <th className="py-3 px-4 font-medium">Last updated</th>
              <th className="py-3 px-4 font-medium text-right">Current total</th>
              <th className="py-3 px-4 font-medium text-right">History</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-husk)]">
            {sales.map((s) => (
              <tr key={s._id}>
                <td className="py-2.5 px-4">
                  <Link to={`${invoiceBase}/${s._id}`} className="font-semibold text-[var(--color-wheat-dark)]">
                    #{s.invoiceNumber}
                  </Link>
                </td>
                <td className="py-2.5 px-4">
                  {s.cancelled ? <span className="badge badge-over">Deleted</span> : <span className="badge badge-active">Edited</span>}
                </td>
                <td className="py-2.5 px-4">{s.previousVersions?.length || 0} version(s)</td>
                <td className="py-2.5 px-4 whitespace-nowrap">{formatDateTime(s.updatedAt)}</td>
                <td className="py-2.5 px-4 text-right font-semibold">{formatMoney(s.total)}</td>
                <td className="py-2.5 px-4 text-right">
                  <button className="text-xs font-semibold text-[var(--color-wheat-dark)]" onClick={() => setViewing(s)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
            {!sales.length && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[var(--color-coffee-soft)]">
                  No bills have been edited or deleted yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Invoice #${viewing?.invoiceNumber} history`} wide>
        {viewing?.cancelled && (
          <div className="grain-card p-3 mb-3 border-2 border-[var(--color-terracotta-deep)] bg-[var(--surface-soft-danger)]">
            <p className="font-semibold text-[var(--color-terracotta-deep)]">Deleted by {viewing.cancelledBy?.name}</p>
            <p className="text-sm">{formatDateTime(viewing.cancelledAt)} — Reason: {viewing.cancelReason}</p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {viewing?.previousVersions?.map((v, idx) => (
            <div key={idx} className="grain-card p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[var(--ink-muted)] capitalize">
                  Version {idx + 1}: {v.action}
                </span>
                <span className="text-xs text-[var(--color-coffee-soft)]">{formatDateTime(v.changedAt)}</span>
              </div>
              <p className="text-sm">
                By {v.changedBy?.name} {v.note && `— "${v.note}"`}
              </p>
              <p className="text-sm text-[var(--color-coffee-soft)]">
                Was: {v.paymentType}, {v.customerName || "Walk-in"}, total {formatMoney(v.total)}
              </p>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
};

// Every other correction: stock entries, counts, rice types, khula, payments, returns...
const OtherChanges = () => {
  const [area, setArea] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get(`/change-log${area ? `?area=${area}` : ""}`)
      .then((res) => active && setRows(res.data))
      .catch((err) => active && setError(err?.response?.data?.message || "Could not load the changes"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [area]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-[var(--ink-muted)]" htmlFor="change-area">
          Show
        </label>
        <select
          id="change-area"
          className="field-input max-w-[220px]"
          value={area}
          onChange={(e) => {
            setLoading(true);
            setError("");
            setArea(e.target.value);
          }}
        >
          {areas.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <Loader />
      ) : error ? (
        <p className="grain-card p-6 text-center text-sm text-[var(--neg-ink)]">{error}</p>
      ) : (
        <div className="grain-card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left border-b border-[var(--line)]">
                <th className="py-3 px-4">When</th>
                <th className="py-3 px-4">Area</th>
                <th className="py-3 px-4">What changed</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {rows.map((r) => (
                <tr key={r._id} className="align-top">
                  <td className="py-2.5 px-4 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <span className="text-[var(--ink-muted)]">{areaLabel(r.area)}</span>
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={`badge ${actionBadge(r.action)} mr-2`}>{actionLabel(r.action)}</span>
                    {r.summary}
                  </td>
                  <td className="py-2.5 px-4 text-[var(--ink-muted)]">{r.reason || "—"}</td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    {r.createdBy?.name || "—"}
                    {r.createdBy?.role && <span className="text-xs text-[var(--ink-faint)] capitalize"> ({r.createdBy.role})</span>}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[var(--ink-muted)]">
                    No changes recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const ChangesReport = ({ role }) => {
  const [tab, setTab] = useState("bills");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="page-title">Changes report</h2>
        <div className="segmented">
          <button className={`segmented-item ${tab === "bills" ? "is-active" : ""}`} onClick={() => setTab("bills")}>
            Edited &amp; deleted bills
          </button>
          <button className={`segmented-item ${tab === "other" ? "is-active" : ""}`} onClick={() => setTab("other")}>
            Stock &amp; other changes
          </button>
        </div>
      </div>
      {tab === "bills" ? <BillChanges role={role} /> : <OtherChanges />}
    </div>
  );
};

export default ChangesReport;

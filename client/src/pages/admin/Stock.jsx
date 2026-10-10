import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import api from "../../api/axios.js";
import Loader from "../../components/Loader.jsx";
import Modal from "../../components/Modal.jsx";
import StatCard from "../../components/StatCard.jsx";
import { formatMoney, formatMoneyUrdu, formatDateTime } from "../../utils/format.js";

// Stock movement types read as plain words, with a dot colour per kind of movement
const movementBadge = {
  STOCK_IN: "badge-active",
  WAPSI_IN: "badge-active",
  SOLD_BORI: "badge-account",
  OPENED_TO_KHULA: "badge-finished",
  ASIM_PERSONAL_USE: "badge-over",
  ADJUSTMENT: "badge-over",
};
const movementLabel = (type = "") => {
  const text = type.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const Stock = () => {
  const [riceTypes, setRiceTypes] = useState([]);
  const [stock, setStock] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddType, setShowAddType] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [form, setForm] = useState({ riceTypeId: "", boriSize: 25, quantity: "", pricePerBori: "", note: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([api.get("/rice-types"), api.get("/stock"), api.get("/stock/transactions")])
      .then(([rt, st, tx]) => {
        setRiceTypes(rt.data);
        setStock(st.data);
        setTransactions(tx.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAddType = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/rice-types", { name: newTypeName });
      setNewTypeName("");
      setShowAddType(false);
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not add rice type");
    } finally {
      setSaving(false);
    }
  };

  const handleAddStock = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/stock/add", form);
      setShowAddStock(false);
      setForm({ riceTypeId: "", boriSize: 25, quantity: "", pricePerBori: "", note: "" });
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not add stock");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading stock..." />;

  const valueOf = (s) => s.quantity * (s.lastPricePerBori || 0);
  const totalBags = stock.reduce((sum, s) => sum + s.quantity, 0);
  const totalValue = stock.reduce((sum, s) => sum + valueOf(s), 0);

  const visibleTypes = filterType ? riceTypes.filter((rt) => rt._id === filterType) : riceTypes;
  const grouped = visibleTypes.map((rt) => ({
    riceType: rt,
    rows: stock.filter((s) => s.riceType?._id === rt._id),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-[var(--color-coffee)]">Main Stock (Bori Inventory)</h2>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={() => setShowAddType(true)}>
            <Plus size={15} />
            Rice type
          </button>
          <button className="btn-primary" onClick={() => setShowAddStock(true)}>
            <Plus size={15} />
            Add stock
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Bori in Stock" value={`${totalBags} bags`} accent="wheat" />
        <StatCard label="Total Stock Value" value={formatMoney(totalValue)} sub={`≈ ${formatMoneyUrdu(totalValue)} · based on last purchase price`} accent="sage" />
        <StatCard label="Rice Types" value={riceTypes.length} accent="coffee" />
      </div>

      <div className="grain-card p-3 flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-[var(--color-coffee-soft)]">Filter by rice type:</label>
        <select className="field-input max-w-[220px]" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All rice types</option>
          {riceTypes.map((rt) => (
            <option key={rt._id} value={rt._id}>
              {rt.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {grouped.map(({ riceType, rows }) => {
          const typeValue = rows.reduce((sum, s) => sum + valueOf(s), 0);
          return (
            <div key={riceType._id} className="grain-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold text-[var(--color-coffee)]">{riceType.name}</h3>
                {!riceType.active && <span className="badge badge-over">Inactive</span>}
              </div>
              <div className="flex flex-col gap-2">
                {rows.map((s) => (
                  <div key={s._id} className="flex items-center justify-between bg-[var(--color-cream-deep)] rounded-lg px-3 py-2">
                    <span className="text-sm font-medium">{s.boriSize} KG Bori</span>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{s.quantity} bags</p>
                      {s.lastPricePerBori > 0 && (
                        <p className="text-xs text-[var(--color-coffee-soft)]">@ {formatMoney(s.lastPricePerBori)} = {formatMoney(valueOf(s))}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--color-husk)] flex justify-between text-sm">
                <span className="text-[var(--color-coffee-soft)]">Value of this type</span>
                <span className="font-semibold">{formatMoney(typeValue)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grain-card p-4">
        <h3 className="font-display font-semibold text-[var(--color-coffee)] mb-3">Stock Movement Log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Rice Type</th>
                <th className="py-2 font-medium">Bori</th>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 font-medium">Qty</th>
                <th className="py-2 font-medium">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-husk)]">
              {transactions.map((t) => (
                <tr key={t._id}>
                  <td className="py-2 whitespace-nowrap">{formatDateTime(t.createdAt)}</td>
                  <td className="py-2">{t.riceType?.name}</td>
                  <td className="py-2">{t.boriSize} KG</td>
                  <td className="py-2">
                    <span className={`badge ${movementBadge[t.type] || "badge-finished"}`}>{movementLabel(t.type)}</span>
                  </td>
                  <td className="py-2">{t.quantity}</td>
                  <td className="py-2">{t.createdBy?.name}</td>
                </tr>
              ))}
              {!transactions.length && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[var(--color-coffee-soft)]">
                    No stock movement yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showAddType} onClose={() => setShowAddType(false)} title="Add New Rice Type">
        <form onSubmit={handleAddType} className="flex flex-col gap-3">
          <div>
            <label className="field-label">Rice Type Name (e.g. Sela, Tota, Banaspati)</label>
            <input className="field-input" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} required autoFocus />
          </div>
          {error && <p className="text-sm text-[var(--color-terracotta-deep)]">{error}</p>}
          <button className="btn-primary mt-1" disabled={saving}>
            {saving ? "Adding..." : "Add Rice Type"}
          </button>
        </form>
      </Modal>

      <Modal open={showAddStock} onClose={() => setShowAddStock(false)} title="Add Stock to Main Inventory">
        <form onSubmit={handleAddStock} className="flex flex-col gap-3">
          <div>
            <label className="field-label">Rice Type</label>
            <select
              className="field-input"
              value={form.riceTypeId}
              onChange={(e) => setForm({ ...form, riceTypeId: e.target.value })}
              required
            >
              <option value="">Select rice type</option>
              {riceTypes.map((rt) => (
                <option key={rt._id} value={rt._id}>
                  {rt.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Bori Size</label>
            <div className="flex gap-2">
              {[25, 50].map((sz) => (
                <button
                  type="button"
                  key={sz}
                  onClick={() => setForm({ ...form, boriSize: sz })}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                    form.boriSize === sz
                      ? "border-[var(--color-wheat)] bg-[var(--color-cream-deep)]"
                      : "border-[var(--color-husk)]"
                  }`}
                >
                  {sz} KG
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Number of Bori</label>
              <input
                type="number"
                min="1"
                className="field-input"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="field-label">Price for the WHOLE Bori (Rs) *</label>
              <input
                type="number"
                min="1"
                className="field-input"
                value={form.pricePerBori}
                onChange={(e) => setForm({ ...form, pricePerBori: e.target.value })}
                placeholder={`e.g. 5000 for this ${form.boriSize}KG bag`}
                required
              />
              {form.pricePerBori > 0 && (
                <p className="text-xs text-[var(--color-coffee-soft)] mt-1">
                  = Rs {(Number(form.pricePerBori) / form.boriSize).toFixed(2)} per KG — double check this looks right
                  before saving, since it's used to work out profit on every sale.
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="field-label">Note (optional)</label>
            <input className="field-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          {error && <p className="text-sm text-[var(--color-terracotta-deep)]">{error}</p>}
          <button className="btn-primary mt-1" disabled={saving}>
            {saving ? "Saving..." : "Add to Stock"}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default Stock;

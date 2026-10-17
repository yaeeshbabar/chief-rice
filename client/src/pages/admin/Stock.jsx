import { useEffect, useState } from "react";
import { History, Pencil, Plus, Trash2 } from "lucide-react";
import api from "../../api/axios.js";
import Loader from "../../components/Loader.jsx";
import Modal from "../../components/Modal.jsx";
import ReasonModal from "../../components/ReasonModal.jsx";
import StatCard from "../../components/StatCard.jsx";
import KhulaContainers from "../../components/KhulaContainers.jsx";
import OpenBoriModal from "../../components/OpenBoriModal.jsx";
import { RenameRiceTypeModal, DeleteRiceTypeModal } from "../../components/RiceTypeFixModals.jsx";
import { formatMoney, formatMoneyUrdu, formatDateTime, formatGrams } from "../../utils/format.js";

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
  if (type === "STOCK_IN") return "Stock in";
  if (type === "WAPSI_IN") return "Returned";
  if (type === "SOLD_BORI") return "Sold";
  if (type === "OPENED_TO_KHULA") return "Opened to khula";
  if (type === "ASIM_PERSONAL_USE") return "Personal use";
  if (type === "ADJUSTMENT") return "Correction";
  const text = type.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const blankStockForm = { riceTypeId: "", boriSize: 25, quantity: "", pricePerBori: "", note: "" };
const blankLooseForm = { riceTypeId: "", kg: "", costPerKg: "", note: "" };

const ErrorText = ({ children }) =>
  children ? <p className="text-sm text-[var(--neg-ink)] bg-[var(--neg-tint)] rounded-lg px-3 py-2">{children}</p> : null;

const SizePicker = ({ value, onChange }) => (
  <div className="segmented w-full">
    {[25, 50].map((sz) => (
      <button
        type="button"
        key={sz}
        onClick={() => onChange(sz)}
        className={`segmented-item flex-1 ${Number(value) === sz ? "is-active" : ""}`}
      >
        {sz} KG
      </button>
    ))}
  </div>
);

const Stock = () => {
  const [riceTypes, setRiceTypes] = useState([]);
  const [stock, setStock] = useState([]);
  const [pools, setPools] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // modals
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [showAddStock, setShowAddStock] = useState(false);
  const [addMode, setAddMode] = useState("bori");
  const [form, setForm] = useState(blankStockForm);
  const [looseForm, setLooseForm] = useState(blankLooseForm);
  const [showOpenBori, setShowOpenBori] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTypeTarget, setDeleteTypeTarget] = useState(null);
  const [countTarget, setCountTarget] = useState(null);
  const [countForm, setCountForm] = useState({ newQuantity: "", reason: "" });
  const [editEntry, setEditEntry] = useState(null);
  const [entryForm, setEntryForm] = useState(null);
  const [deleteEntry, setDeleteEntry] = useState(null);
  const [historyEntry, setHistoryEntry] = useState(null);
  const [logLimit, setLogLimit] = useState(60);

  const load = () => {
    Promise.all([
      api.get("/rice-types?includeInactive=true"),
      api.get("/stock"),
      api.get("/khula/summary"),
      api.get("/stock/transactions"),
    ])
      .then(([rt, st, kp, tx]) => {
        setRiceTypes(rt.data);
        setStock(st.data);
        setPools(kp.data);
        setTransactions(tx.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Runs a save, shows the server's message if it fails, reloads on success.
  const save = async (request, done) => {
    setError("");
    setSaving(true);
    try {
      await request();
      done();
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const closeModal = (setter) => {
    setError("");
    setter(null);
  };

  // Today's purchase cost per KG of a type, from its latest bori price (to prefill loose rice).
  const costPerKgFor = (riceTypeId) => {
    const priced = stock
      .filter((s) => s.riceType?._id === riceTypeId && s.lastPricePerBori > 0)
      .sort((a, b) => a.boriSize - b.boriSize);
    return priced.length ? Math.round((priced[0].lastPricePerBori / priced[0].boriSize) * 100) / 100 : "";
  };

  const handleAddType = (e) => {
    e.preventDefault();
    save(
      () => api.post("/rice-types", { name: newTypeName }),
      () => {
        setNewTypeName("");
        setShowAddType(false);
      }
    );
  };

  const handleAddStock = (e) => {
    e.preventDefault();
    if (addMode === "loose") {
      save(
        () => api.post("/khula/add-loose", looseForm),
        () => {
          setShowAddStock(false);
          setLooseForm(blankLooseForm);
        }
      );
    } else {
      save(
        () => api.post("/stock/add", form),
        () => {
          setShowAddStock(false);
          setForm(blankStockForm);
        }
      );
    }
  };


  const openCount = (row) => {
    setError("");
    setCountForm({ newQuantity: String(row.quantity), reason: "" });
    setCountTarget(row);
  };
  const handleCount = (e) => {
    e.preventDefault();
    save(
      () =>
        api.post("/stock/adjust", {
          riceTypeId: countTarget.riceType._id,
          boriSize: countTarget.boriSize,
          newQuantity: Number(countForm.newQuantity),
          reason: countForm.reason,
        }),
      () => setCountTarget(null)
    );
  };

  const openEditEntry = (t) => {
    setError("");
    setEntryForm({
      riceTypeId: t.riceType?._id || "",
      boriSize: t.boriSize,
      quantity: String(t.quantity),
      pricePerBori: String(t.pricePerBori || ""),
      note: t.note || "",
      reason: "",
    });
    setEditEntry(t);
  };
  const handleEditEntry = (e) => {
    e.preventDefault();
    save(
      () =>
        api.patch(`/stock/transactions/${editEntry._id}`, {
          ...entryForm,
          quantity: Number(entryForm.quantity),
          pricePerBori: Number(entryForm.pricePerBori),
        }),
      () => setEditEntry(null)
    );
  };

  if (loading) return <Loader label="Loading stock..." />;

  const liveTypes = riceTypes.filter((rt) => !rt.deleted);
  // Types that were deleted but got bags back later (e.g. an old bill was cancelled)
  const deletedWithStock = [];
  for (const s of stock) {
    if (s.riceType && !riceTypes.some((rt) => rt._id === s.riceType._id) && !deletedWithStock.some((d) => d._id === s.riceType._id)) {
      deletedWithStock.push({ ...s.riceType, deleted: true });
    }
  }
  const allTypes = [...liveTypes, ...deletedWithStock];

  const valueOf = (s) => s.quantity * (s.lastPricePerBori || 0);
  const totalBags = stock.reduce((sum, s) => sum + s.quantity, 0);
  const totalValue = stock.reduce((sum, s) => sum + valueOf(s), 0);
  const khulaGrams = pools.reduce((sum, p) => sum + p.remainingGrams, 0);
  const khulaValue = pools.reduce((sum, p) => sum + (p.costValue || 0), 0);

  const visibleTypes = filterType ? allTypes.filter((rt) => rt._id === filterType) : allTypes;
  const grouped = visibleTypes.map((rt) => ({
    riceType: rt,
    rows: stock.filter((s) => s.riceType?._id === rt._id).sort((a, b) => a.boriSize - b.boriSize),
  }));
  const visiblePools = filterType ? pools.filter((p) => p.riceType?._id === filterType) : pools;
  const visibleTransactions = filterType ? transactions.filter((t) => t.riceType?._id === filterType) : transactions;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="page-title">Stock</h2>
        <div className="flex gap-2">
          <button
            className="btn-outline"
            onClick={() => {
              setError("");
              setShowAddType(true);
            }}
          >
            <Plus size={15} />
            Rice type
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              setError("");
              setShowAddStock(true);
            }}
          >
            <Plus size={15} />
            Add stock
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Bori in stock" value={`${totalBags} bags`} accent="wheat" />
        <StatCard label="Bori value" value={formatMoney(totalValue)} sub={`≈ ${formatMoneyUrdu(totalValue)}, last purchase price`} accent="sage" />
        <StatCard label="Khula value" value={formatMoney(khulaValue)} sub={`${formatGrams(khulaGrams)} at cost`} accent="wheat" />
        <StatCard
          label="Total stock value"
          value={formatMoney(totalValue + khulaValue)}
          sub={`≈ ${formatMoneyUrdu(totalValue + khulaValue)}, bori + khula`}
          accent="coffee"
        />
      </div>

      <div className="grain-card p-3 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-[var(--ink-muted)]" htmlFor="stock-filter">
          Rice type
        </label>
        <select id="stock-filter" className="field-input max-w-[220px]" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All rice types</option>
          {allTypes.map((rt) => (
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
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-semibold text-[var(--ink)] truncate">{riceType.name}</h3>
                  {riceType.deleted ? (
                    <span className="badge badge-credit">Deleted</span>
                  ) : (
                    !riceType.active && <span className="badge badge-finished">Off</span>
                  )}
                </div>
                {!riceType.deleted && (
                  <div className="flex shrink-0 -mr-1.5">
                    <button className="icon-btn h-8 w-8" onClick={() => setRenameTarget(riceType)} title="Rename" aria-label={`Rename ${riceType.name}`}>
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-btn h-8 w-8 hover:text-[var(--neg-ink)]"
                      onClick={() => setDeleteTypeTarget(riceType)}
                      title="Delete"
                      aria-label={`Delete ${riceType.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {rows.map((s) => (
                  <div key={s._id} className="flex items-center justify-between gap-2 bg-[var(--bg-subtle)] rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{s.boriSize} KG bori</p>
                      <button className="text-xs font-medium text-[var(--accent-ink)] hover:underline" onClick={() => openCount(s)}>
                        Fix count
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{s.quantity} bags</p>
                      {s.lastPricePerBori > 0 && (
                        <p className="text-xs text-[var(--ink-muted)]">
                          @ {formatMoney(s.lastPricePerBori)} = {formatMoney(valueOf(s))}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {!rows.length && <p className="text-xs text-[var(--ink-muted)]">No bori yet</p>}
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--line)] flex justify-between text-sm">
                <span className="text-[var(--ink-muted)]">Value of this type</span>
                <span className="font-semibold">{formatMoney(typeValue)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="section-title">Khula (loose rice)</h3>
            <p className="text-sm text-[var(--ink-muted)]">
              All open bori, loose rice and returns of a type are added together.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-outline"
              onClick={() => {
                setError("");
                setShowOpenBori(true);
              }}
            >
              Open a bori
            </button>
            <button
              className="btn-outline"
              onClick={() => {
                setError("");
                setAddMode("loose");
                setShowAddStock(true);
              }}
            >
              <Plus size={15} />
              Loose rice
            </button>
          </div>
        </div>
        <KhulaContainers
          pools={visiblePools}
          role="admin"
          showCost
          onChanged={load}
          emptyText="No khula right now. Open a bori or add loose rice."
        />
      </div>

      <div className="grain-card p-4">
        <h3 className="section-title mb-1">Stock movement log</h3>
        <p className="text-xs text-[var(--ink-muted)] mb-3">Fix or delete a wrong entry here.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-left border-b border-[var(--line)]">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Rice type</th>
                <th className="py-2 pr-3">Bori</th>
                <th className="py-2 pr-3">Movement</th>
                <th className="py-2 pr-3">Qty</th>
                <th className="py-2 pr-3">Price / bori</th>
                <th className="py-2 pr-3">Note</th>
                <th className="py-2 pr-3">By</th>
                <th className="relative py-2 w-[76px]">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {visibleTransactions.slice(0, logLimit).map((t) => {
                const canEdit = t.type === "STOCK_IN" && !t.deleted;
                const struck = t.deleted ? "line-through text-[var(--ink-faint)]" : "";
                return (
                  <tr key={t._id} className={t.deleted ? "bg-[var(--bg-subtle)]/60" : ""}>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(t.createdAt)}</td>
                    <td className={`py-2 pr-3 ${struck}`}>{t.riceType?.name}</td>
                    <td className={`py-2 pr-3 whitespace-nowrap ${struck}`}>{t.boriSize} KG</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`badge ${movementBadge[t.type] || "badge-finished"}`}>{movementLabel(t.type)}</span>
                        {t.deleted && <span className="badge badge-credit">Deleted</span>}
                        {t.edited && !t.deleted && (
                          <button
                            className="badge badge-account hover:bg-[var(--bg-subtle)]"
                            onClick={() => setHistoryEntry(t)}
                            title="See what was changed"
                          >
                            Edited
                          </button>
                        )}
                      </div>
                    </td>
                    <td className={`py-2 pr-3 whitespace-nowrap ${struck}`}>
                      {t.type === "ADJUSTMENT" && t.quantityBefore !== undefined && t.quantityAfter !== undefined
                        ? `${t.quantityBefore} → ${t.quantityAfter}`
                        : t.quantity}
                    </td>
                    <td className={`py-2 pr-3 whitespace-nowrap ${struck}`}>
                      {t.type === "STOCK_IN" && t.pricePerBori ? formatMoney(t.pricePerBori) : "—"}
                    </td>
                    <td className="py-2 pr-3 max-w-[240px]">
                      <span className={struck}>{t.note || (t.deleted ? "" : "—")}</span>
                      {t.deleted && (
                        <span className="block text-xs text-[var(--neg-ink)]">
                          Deleted{t.deletedBy?.name ? ` by ${t.deletedBy.name}` : ""}: {t.deleteReason}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">{t.createdBy?.name}</td>
                    <td className="py-1">
                      {canEdit && (
                        <div className="flex justify-end">
                          <button className="icon-btn h-8 w-8" onClick={() => openEditEntry(t)} title="Correct this entry" aria-label="Correct this entry">
                            <Pencil size={15} />
                          </button>
                          <button
                            className="icon-btn h-8 w-8 hover:text-[var(--neg-ink)]"
                            onClick={() => setDeleteEntry(t)}
                            title="Delete this entry"
                            aria-label="Delete this entry"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!visibleTransactions.length && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-[var(--ink-muted)]">
                    No stock movement yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {visibleTransactions.length > logLimit && (
          <div className="pt-3 text-center">
            <button className="btn-outline text-xs py-1.5" onClick={() => setLogLimit((n) => n + 100)}>
              Show older ({visibleTransactions.length - logLimit} more)
            </button>
          </div>
        )}
      </div>

      {/* ---------- Add rice type ---------- */}
      <Modal open={showAddType} onClose={() => setShowAddType(false)} title="Add rice type">
        <form onSubmit={handleAddType} className="flex flex-col gap-3">
          <div>
            <label className="field-label">Name (e.g. Sela, Tota, Banaspati)</label>
            <input className="field-input" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} required autoFocus />
            <p className="text-xs text-[var(--ink-faint)] mt-1.5">Adding back a name you deleted earlier brings back its old records.</p>
          </div>
          <ErrorText>{error}</ErrorText>
          <button className="btn-primary mt-1" disabled={saving}>
            {saving ? "Adding..." : "Add rice type"}
          </button>
        </form>
      </Modal>

      {/* ---------- Add stock: bori or loose rice ---------- */}
      <Modal open={showAddStock} onClose={() => setShowAddStock(false)} title="Add stock">
        <form onSubmit={handleAddStock} className="flex flex-col gap-3">
          <div className="segmented w-full">
            <button
              type="button"
              className={`segmented-item flex-1 ${addMode === "bori" ? "is-active" : ""}`}
              onClick={() => setAddMode("bori")}
            >
              Bori (bags)
            </button>
            <button
              type="button"
              className={`segmented-item flex-1 ${addMode === "loose" ? "is-active" : ""}`}
              onClick={() => setAddMode("loose")}
            >
              Loose rice (khula)
            </button>
          </div>

          {addMode === "bori" ? (
            <>
              <div>
                <label className="field-label">Rice type</label>
                <select
                  className="field-input"
                  value={form.riceTypeId}
                  onChange={(e) => setForm({ ...form, riceTypeId: e.target.value })}
                  required
                >
                  <option value="">Select rice type</option>
                  {liveTypes.map((rt) => (
                    <option key={rt._id} value={rt._id}>
                      {rt.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Bori size</label>
                <SizePicker value={form.boriSize} onChange={(sz) => setForm({ ...form, boriSize: sz })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Number of bori</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="field-input"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="field-label">Price for one whole bori (Rs)</label>
                  <input
                    type="number"
                    min="1"
                    className="field-input"
                    value={form.pricePerBori}
                    onChange={(e) => setForm({ ...form, pricePerBori: e.target.value })}
                    placeholder={`e.g. 5000 for a ${form.boriSize}KG bag`}
                    required
                  />
                </div>
              </div>
              {form.pricePerBori > 0 && (
                <p className="text-xs text-[var(--ink-muted)] -mt-1">
                  = Rs {(Number(form.pricePerBori) / form.boriSize).toFixed(2)} per KG. This is used to work out profit, so check it
                  looks right.
                </p>
              )}
              <div>
                <label className="field-label">Note (optional)</label>
                <input className="field-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-[var(--ink-muted)]">
                For rice that is already open, e.g. 10 KG lying outside the bori. It goes straight into that type&apos;s khula.
              </p>
              <div>
                <label className="field-label">Rice type</label>
                <select
                  className="field-input"
                  value={looseForm.riceTypeId}
                  onChange={(e) =>
                    setLooseForm({ ...looseForm, riceTypeId: e.target.value, costPerKg: String(costPerKgFor(e.target.value)) })
                  }
                  required
                >
                  <option value="">Select rice type</option>
                  {liveTypes.map((rt) => (
                    <option key={rt._id} value={rt._id}>
                      {rt.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">How many KG</label>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    className="field-input"
                    value={looseForm.kg}
                    onChange={(e) => setLooseForm({ ...looseForm, kg: e.target.value })}
                    placeholder="e.g. 10"
                    required
                  />
                </div>
                <div>
                  <label className="field-label">Purchase cost per KG (Rs)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="field-input"
                    value={looseForm.costPerKg}
                    onChange={(e) => setLooseForm({ ...looseForm, costPerKg: e.target.value })}
                    required
                  />
                </div>
              </div>
              {looseForm.riceTypeId && costPerKgFor(looseForm.riceTypeId) !== "" && (
                <p className="text-xs text-[var(--ink-muted)] -mt-1">
                  Filled in from the last bori price (Rs {costPerKgFor(looseForm.riceTypeId)}/KG). Change it if this rice cost
                  something else.
                </p>
              )}
              <div>
                <label className="field-label">Note (optional)</label>
                <input
                  className="field-input"
                  value={looseForm.note}
                  onChange={(e) => setLooseForm({ ...looseForm, note: e.target.value })}
                  placeholder="e.g. 10 KG extra with the last delivery"
                />
              </div>
            </>
          )}
          <ErrorText>{error}</ErrorText>
          <button className="btn-primary mt-1" disabled={saving}>
            {saving ? "Saving..." : addMode === "bori" ? "Add to stock" : "Add to khula"}
          </button>
        </form>
      </Modal>

      <OpenBoriModal
        open={showOpenBori}
        onClose={() => setShowOpenBori(false)}
        riceTypes={liveTypes.filter((rt) => rt.active)}
        stock={stock}
        onDone={() => {
          setShowOpenBori(false);
          load();
        }}
      />

      <RenameRiceTypeModal riceType={renameTarget} onClose={() => setRenameTarget(null)} onDone={load} />
      <DeleteRiceTypeModal riceType={deleteTypeTarget} onClose={() => setDeleteTypeTarget(null)} onDone={load} />

      {/* ---------- Fix bori count ---------- */}
      <Modal open={!!countTarget} onClose={() => closeModal(setCountTarget)} title="Fix bori count">
        {countTarget && (
          <form onSubmit={handleCount} className="flex flex-col gap-3">
            <p className="text-sm text-[var(--ink-muted)]">
              {countTarget.riceType?.name} · {countTarget.boriSize} KG bori. The system shows{" "}
              <strong className="text-[var(--ink)]">{countTarget.quantity}</strong>. Enter the real number after counting.
            </p>
            <div>
              <label className="field-label">Correct number of bori</label>
              <input
                type="number"
                min="0"
                step="1"
                className="field-input"
                value={countForm.newQuantity}
                onChange={(e) => setCountForm({ ...countForm, newQuantity: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="field-label">Reason</label>
              <input
                className="field-input"
                value={countForm.reason}
                onChange={(e) => setCountForm({ ...countForm, reason: e.target.value })}
                placeholder="e.g. counted in godown, 1 bag damaged"
                required
              />
            </div>
            <p className="text-xs text-[var(--ink-faint)] -mt-1">Saved in the movement log and the Changes report.</p>
            <ErrorText>{error}</ErrorText>
            <button className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save count"}
            </button>
          </form>
        )}
      </Modal>

      {/* ---------- Correct a stock-in entry ---------- */}
      <Modal open={!!editEntry} onClose={() => closeModal(setEditEntry)} title="Correct stock entry">
        {editEntry && entryForm && (
          <form onSubmit={handleEditEntry} className="flex flex-col gap-3">
            <p className="text-xs text-[var(--ink-muted)]">
              Entered {formatDateTime(editEntry.createdAt)}: {editEntry.quantity} × {editEntry.riceType?.name} {editEntry.boriSize}KG @{" "}
              {formatMoney(editEntry.pricePerBori)}. The bags in stock move with the change.
            </p>
            <div>
              <label className="field-label">Rice type</label>
              <select
                className="field-input"
                value={entryForm.riceTypeId}
                onChange={(e) => setEntryForm({ ...entryForm, riceTypeId: e.target.value })}
                required
              >
                {liveTypes.map((rt) => (
                  <option key={rt._id} value={rt._id}>
                    {rt.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Bori size</label>
              <SizePicker value={entryForm.boriSize} onChange={(sz) => setEntryForm({ ...entryForm, boriSize: sz })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Number of bori</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="field-input"
                  value={entryForm.quantity}
                  onChange={(e) => setEntryForm({ ...entryForm, quantity: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="field-label">Price for one bori (Rs)</label>
                <input
                  type="number"
                  min="1"
                  className="field-input"
                  value={entryForm.pricePerBori}
                  onChange={(e) => setEntryForm({ ...entryForm, pricePerBori: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="field-label">Note (optional)</label>
              <input className="field-input" value={entryForm.note} onChange={(e) => setEntryForm({ ...entryForm, note: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Reason for the change</label>
              <input
                className="field-input"
                value={entryForm.reason}
                onChange={(e) => setEntryForm({ ...entryForm, reason: e.target.value })}
                placeholder="e.g. typed 50 instead of 25"
                required
              />
            </div>
            <p className="text-xs text-[var(--ink-faint)] -mt-1">Old bills keep their cost. New bills use this price.</p>
            <ErrorText>{error}</ErrorText>
            <button className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save correction"}
            </button>
          </form>
        )}
      </Modal>

      {/* ---------- Delete a stock-in entry ---------- */}
      <ReasonModal
        open={!!deleteEntry}
        onClose={() => setDeleteEntry(null)}
        title="Delete stock entry?"
        confirmLabel="Delete entry"
        danger
        placeholder="e.g. entered twice"
        onConfirm={async (reason) => {
          await api.delete(`/stock/transactions/${deleteEntry._id}`, { data: { reason } });
          setDeleteEntry(null);
          load();
        }}
      >
        {deleteEntry && (
          <p>
            {deleteEntry.quantity} × {deleteEntry.riceType?.name} {deleteEntry.boriSize}KG @ {formatMoney(deleteEntry.pricePerBori)}, entered{" "}
            {formatDateTime(deleteEntry.createdAt)}. These bags will be taken out of stock. The entry stays in the log, marked as deleted.
          </p>
        )}
      </ReasonModal>

      {/* ---------- What changed on an entry ---------- */}
      <Modal open={!!historyEntry} onClose={() => setHistoryEntry(null)} title="Entry history">
        {historyEntry && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="rounded-lg bg-[var(--accent-tint)] px-3 py-2">
              <p className="text-xs text-[var(--ink-muted)]">Now</p>
              <p className="font-medium">
                {historyEntry.quantity} × {historyEntry.riceType?.name} {historyEntry.boriSize}KG @ {formatMoney(historyEntry.pricePerBori)}
              </p>
            </div>
            {[...(historyEntry.history || [])].reverse().map((h, i) => (
              <div key={i} className="rounded-lg border border-[var(--line)] px-3 py-2">
                <p className="text-xs text-[var(--ink-muted)] flex items-center gap-1.5">
                  <History size={12} />
                  Before {formatDateTime(h.changedAt)} · changed by {h.changedBy?.name || "—"}
                </p>
                <p className="font-medium">
                  {h.quantity} × {h.riceTypeName} {h.boriSize}KG @ {formatMoney(h.pricePerBori)}
                </p>
                {h.reason && <p className="text-xs text-[var(--ink-muted)] mt-0.5">Reason: {h.reason}</p>}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Stock;

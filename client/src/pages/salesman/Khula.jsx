import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import api from "../../api/axios.js";
import Loader from "../../components/Loader.jsx";
import Modal from "../../components/Modal.jsx";
import { formatGrams, formatDateTime } from "../../utils/format.js";

const Khula = () => {
  const [riceTypes, setRiceTypes] = useState([]);
  const [stock, setStock] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOpen, setShowOpen] = useState(false);
  const [openForm, setOpenForm] = useState({ riceTypeId: "", boriSize: 25 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [closeTarget, setCloseTarget] = useState(null);
  const [closeStatus, setCloseStatus] = useState("OVER");
  const [closeNote, setCloseNote] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([api.get("/rice-types"), api.get("/stock"), api.get("/khula")])
      .then(([rt, st, kb]) => {
        setRiceTypes(rt.data);
        setStock(st.data);
        setBatches(kb.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const availableFor = (riceTypeId, size) =>
    stock.find((s) => s.riceType?._id === riceTypeId && s.boriSize === Number(size))?.quantity ?? 0;

  const handleOpen = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/khula/open", openForm);
      setShowOpen(false);
      setOpenForm({ riceTypeId: "", boriSize: 25 });
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not open a new Khula batch");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    setSaving(true);
    try {
      await api.patch(`/khula/${closeTarget._id}/close`, { status: closeStatus, note: closeNote });
      setCloseTarget(null);
      setCloseNote("");
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not update this batch");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  const active = batches.filter((b) => b.status === "ACTIVE");
  const closed = batches.filter((b) => b.status !== "ACTIVE");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/assets/khula.png" className="h-10 w-10 rounded-lg object-cover" alt="" />
          <h2 className="font-display text-xl font-semibold text-[var(--color-coffee)]">Khula Stock</h2>
        </div>
        <button className="btn-primary" onClick={() => setShowOpen(true)}>
          <Plus size={15} />
          Open a bori to khula
        </button>
      </div>

      <div>
        <h3 className="font-display font-semibold text-[var(--color-coffee)] mb-3">Active Batches</h3>
        {active.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((b) => {
              const pct = Math.round((b.remainingGrams / b.totalGrams) * 100);
              return (
                <div key={b._id} className="grain-card p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{b.riceType?.name}</p>
                    <span className="badge badge-active">{b.boriSize} KG Bori</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--color-cream-deep)] overflow-hidden">
                    <div className="h-full bg-[var(--color-wheat)]" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-sm text-[var(--color-coffee-soft)]">
                    {formatGrams(b.remainingGrams)} left of {formatGrams(b.totalGrams)} ({pct}%)
                  </p>
                  <p className="text-xs text-[var(--color-coffee-soft)]">Opened {formatDateTime(b.createdAt)} by {b.openedBy?.name}</p>
                  <button className="btn-outline mt-1 text-xs" onClick={() => setCloseTarget(b)}>
                    Close this batch
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-coffee-soft)] grain-card p-6 text-center">No active Khula batches</p>
        )}
      </div>

      <div>
        <h3 className="font-display font-semibold text-[var(--color-coffee)] mb-3">History</h3>
        <div className="grain-card overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
                <th className="py-2 px-3 font-medium">Rice Type</th>
                <th className="py-2 px-3 font-medium">Bori</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 px-3 font-medium">Closed</th>
                <th className="py-2 px-3 font-medium">Shortfall</th>
                <th className="py-2 px-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-husk)]">
              {closed.map((b) => (
                <tr key={b._id}>
                  <td className="py-2 px-3">{b.riceType?.name}</td>
                  <td className="py-2 px-3">{b.boriSize} KG</td>
                  <td className="py-2 px-3">
                    <span className={`badge ${b.status === "OVER" ? "badge-over" : "badge-finished"}`}>{b.status}</span>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">{b.closedAt ? formatDateTime(b.closedAt) : "—"}</td>
                  <td className="py-2 px-3">{b.shortfallGrams > 0 ? formatGrams(b.shortfallGrams) : "—"}</td>
                  <td className="py-2 px-3">{b.note || "—"}</td>
                </tr>
              ))}
              {!closed.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[var(--color-coffee-soft)]">
                    No closed batches yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showOpen} onClose={() => setShowOpen(false)} title="Open New Bori to Khula">
        <form onSubmit={handleOpen} className="flex flex-col gap-3">
          <div>
            <label className="field-label">Rice Type</label>
            <select className="field-input" value={openForm.riceTypeId} onChange={(e) => setOpenForm({ ...openForm, riceTypeId: e.target.value })} required>
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
                  onClick={() => setOpenForm({ ...openForm, boriSize: sz })}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                    Number(openForm.boriSize) === sz ? "border-[var(--color-wheat)] bg-[var(--color-cream-deep)]" : "border-[var(--color-husk)]"
                  }`}
                >
                  {sz} KG
                </button>
              ))}
            </div>
            {openForm.riceTypeId && (
              <p className="text-xs text-[var(--color-coffee-soft)] mt-1.5">
                Available in main stock: {availableFor(openForm.riceTypeId, openForm.boriSize)} bori
              </p>
            )}
          </div>
          {error && <p className="text-sm text-[var(--color-terracotta-deep)]">{error}</p>}
          <button className="btn-primary" disabled={saving}>
            {saving ? "Opening..." : "Open to Khula"}
          </button>
        </form>
      </Modal>

      <Modal open={!!closeTarget} onClose={() => setCloseTarget(null)} title="Close Khula Batch">
        {closeTarget && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[var(--color-coffee-soft)]">
              {closeTarget.riceType?.name} — {formatGrams(closeTarget.remainingGrams)} showing as remaining
            </p>
            <div>
              <label className="field-label">Reason</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCloseStatus("OVER")}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${closeStatus === "OVER" ? "border-[var(--color-terracotta-deep)] bg-[var(--surface-soft-danger)]" : "border-[var(--color-husk)]"}`}
                >
                  Over (ran out early)
                </button>
                <button
                  type="button"
                  onClick={() => setCloseStatus("FINISHED")}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${closeStatus === "FINISHED" ? "border-[var(--color-sage-deep)] bg-[var(--surface-soft)]" : "border-[var(--color-husk)]"}`}
                >
                  Finished exactly
                </button>
              </div>
            </div>
            <div>
              <label className="field-label">Note (optional)</label>
              <input className="field-input" value={closeNote} onChange={(e) => setCloseNote(e.target.value)} />
            </div>
            {error && <p className="text-sm text-[var(--color-terracotta-deep)]">{error}</p>}
            <button className="btn-primary" disabled={saving} onClick={handleClose}>
              {saving ? "Saving..." : "Confirm"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Khula;

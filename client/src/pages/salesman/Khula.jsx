import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import api from "../../api/axios.js";
import Loader from "../../components/Loader.jsx";
import KhulaContainers from "../../components/KhulaContainers.jsx";
import OpenBoriModal from "../../components/OpenBoriModal.jsx";
import { formatGrams, formatDateTime, formatShort, khulaSourceLabel } from "../../utils/format.js";
import { useAuth } from "../../context/AuthContext.jsx";

const Khula = () => {
  const { user } = useAuth();
  const [riceTypes, setRiceTypes] = useState([]);
  const [stock, setStock] = useState([]);
  const [pools, setPools] = useState([]);
  const [closed, setClosed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOpen, setShowOpen] = useState(false);

  const load = () => {
    Promise.all([api.get("/rice-types"), api.get("/stock"), api.get("/khula/summary"), api.get("/khula")])
      .then(([rt, st, kp, kb]) => {
        setRiceTypes(rt.data);
        setStock(st.data);
        setPools(kp.data);
        setClosed(kb.data.filter((b) => b.status !== "ACTIVE"));
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <Loader />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/assets/khula.png" className="h-10 w-10 rounded-lg object-cover" alt="" />
          <div>
            <h2 className="page-title">Khula stock</h2>
            <p className="text-sm text-[var(--ink-muted)]">Loose rice per rice type. Sales take from the oldest lot first.</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowOpen(true)}>
          <Plus size={15} />
          Open a bori to khula
        </button>
      </div>

      <KhulaContainers pools={pools} role={user?.role} onChanged={load} />

      <div>
        <h3 className="section-title mb-3">Closed lots</h3>
        <div className="grain-card overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left border-b border-[var(--line)]">
                <th className="py-2 px-3">Rice type</th>
                <th className="py-2 px-3">Lot</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Closed</th>
                <th className="py-2 px-3">Short when opened</th>
                <th className="py-2 px-3">Short at end</th>
                <th className="py-2 px-3">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {closed.map((b) => (
                <tr key={b._id}>
                  <td className="py-2 px-3">{b.riceType?.name}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    {khulaSourceLabel(b)}
                    <span className="text-[var(--ink-faint)]">
                      {" "}
                      · {b.source === "BORI" || !b.source ? "weighed " : ""}
                      {formatGrams(b.totalGrams)}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <span className={`badge ${b.status === "OVER" ? "badge-over" : "badge-finished"}`}>
                      {b.status === "OVER" ? "Ended early" : "Finished"}
                    </span>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">{b.closedAt ? formatDateTime(b.closedAt) : "—"}</td>
                  <td className="py-2 px-3">
                    {b.openingShortGrams > 0 ? formatShort(b.openingShortGrams) : b.openingShortGrams < 0 ? `${formatShort(b.openingShortGrams)} extra` : "—"}
                  </td>
                  <td className="py-2 px-3">{b.shortfallGrams > 0 ? formatShort(b.shortfallGrams) : "—"}</td>
                  <td className="py-2 px-3">{b.note || "—"}</td>
                </tr>
              ))}
              {!closed.length && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[var(--ink-muted)]">
                    No closed lots yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <OpenBoriModal
        open={showOpen}
        onClose={() => setShowOpen(false)}
        riceTypes={riceTypes}
        stock={stock}
        onDone={() => {
          setShowOpen(false);
          load();
        }}
      />
    </div>
  );
};

export default Khula;

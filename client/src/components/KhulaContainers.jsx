import { useEffect, useRef, useState } from "react";
import { Undo2 } from "lucide-react";
import api from "../api/axios.js";
import ReasonModal from "./ReasonModal.jsx";
import { formatDate, formatGrams, formatMoney, formatShort, khulaSourceLabel } from "../utils/format.js";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Counts smoothly to the target number (from 0 the first time it shows).
const useCountUp = (target, duration = 1100) => {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0));
  const current = useRef(value);
  useEffect(() => {
    let frame;
    if (reducedMotion()) {
      frame = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(frame);
    }
    const from = current.current;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const next = from + (target - from) * (1 - Math.pow(1 - t, 3));
      current.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  // Whole 100 g steps while counting, the exact amount at the end
  return Math.abs(value - target) < 1 ? target : Math.round(value / 100) * 100;
};

const percentOf = (pool) => (pool.capacityGrams > 0 ? Math.min(100, (pool.remainingGrams / pool.capacityGrams) * 100) : 0);
const isLow = (pool) => pool.remainingGrams > 0 && percentOf(pool) <= 15;

// The container drawing. The rice level is the share of what was put in that is still left.
export const RiceBin = ({ percent, low = false, small = false }) => (
  <div className={`rice-bin ${small ? "rice-bin-sm" : ""} ${low ? "is-low" : ""}`} aria-hidden="true">
    <div className="rice-bin-lid" />
    <div className="rice-bin-body">
      <div className="rice-bin-pour">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className={`rice-bin-fill ${percent <= 0 ? "is-empty" : ""}`} style={{ height: `${Math.max(0, percent)}%` }} />
      <div className="rice-bin-marks">
        <span />
        <span />
        <span />
      </div>
    </div>
  </div>
);

const lotCanUndo = (lot, role) => lot.untouched && lot.source !== "RETURN" && (lot.source !== "LOOSE" || role === "admin");

const PoolCard = ({ pool, role, showCost, onEndBatch, onUndo }) => {
  const percent = percentOf(pool);
  const low = isLow(pool);
  const shown = useCountUp(pool.remainingGrams);

  return (
    <div className="grain-card p-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold leading-tight">{pool.riceType?.name}</h4>
        {low && <span className="badge badge-over">Running low</span>}
        {pool.remainingGrams <= 0 && <span className="badge badge-finished">Empty</span>}
      </div>

      <div className="flex items-end gap-4">
        <div className="w-[84px] shrink-0">
          <RiceBin percent={percent} low={low} />
        </div>
        <div className="min-w-0 pb-1">
          <p className="text-[1.65rem] leading-none font-semibold tracking-tight tabular-nums">{formatGrams(shown)}</p>
          <p className="text-xs text-[var(--ink-muted)] mt-1.5">left in khula</p>
          <p className="text-xs text-[var(--ink-faint)] mt-0.5">of {formatGrams(pool.capacityGrams)} put in</p>
          {showCost && pool.avgCostPerKg > 0 && (
            <p className="text-xs text-[var(--ink-muted)] mt-1.5">
              Cost about {formatMoney(pool.avgCostPerKg)}/KG · {formatMoney(pool.costValue)}
            </p>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs text-[var(--ink-faint)] mb-1">{pool.batches.length > 1 ? `${pool.batches.length} lots added together` : "1 lot"}</p>
        <ul className="flex flex-col divide-y divide-[var(--line)] text-xs">
          {pool.batches.map((lot) => (
            <li key={lot._id} className="flex items-center justify-between gap-2 py-1.5 min-h-[2.1rem]">
              <span className="min-w-0">
                <span className="font-medium text-[var(--ink)]">{khulaSourceLabel(lot)}</span>
                <span className="text-[var(--ink-faint)]"> · {formatDate(lot.createdAt)}</span>
                {lot.openingShortGrams > 0 && (
                  <span className="block text-[var(--warn-ink)]">{formatShort(lot.openingShortGrams)} short when weighed</span>
                )}
                {lot.openingShortGrams < 0 && (
                  <span className="block text-[var(--ink-faint)]">{formatShort(lot.openingShortGrams)} extra when weighed</span>
                )}
              </span>
              <span className="flex items-center gap-1 shrink-0 text-[var(--ink-muted)] tabular-nums">
                {lot.untouched ? formatGrams(lot.totalGrams) : `${formatGrams(lot.remainingGrams)} of ${formatGrams(lot.totalGrams)}`}
                {lotCanUndo(lot, role) && (
                  <button
                    type="button"
                    className="icon-btn h-7 w-7"
                    onClick={() => onUndo(pool, lot)}
                    title={lot.source === "LOOSE" ? "Remove this loose rice" : "Put this bori back to main stock"}
                    aria-label={lot.source === "LOOSE" ? "Remove this loose rice" : "Put this bori back to main stock"}
                  >
                    <Undo2 size={14} />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <button type="button" className="btn-outline text-xs py-1.5 mt-auto" onClick={() => onEndBatch(pool)}>
        End batch
      </button>
    </div>
  );
};

const MiniPool = ({ pool }) => {
  const shown = useCountUp(pool.remainingGrams);
  return (
    <div className="flex flex-col items-center text-center gap-1.5 min-w-0">
      <div className="w-12">
        <RiceBin percent={percentOf(pool)} low={isLow(pool)} small />
      </div>
      <p className="text-xs text-[var(--ink-muted)] truncate max-w-full">{pool.riceType?.name}</p>
      <p className="text-sm font-semibold tabular-nums -mt-1">{formatGrams(shown)}</p>
    </div>
  );
};

// Loose rice per rice type. All lots of a type (opened bori, loose rice, returns) are added
// together, e.g. a 25 KG and a 50 KG bori of Banaspati show as 75 KG; a 4 KG return makes it 79 KG.
const KhulaContainers = ({ pools, role = "salesman", onChanged, compact = false, showCost = false, emptyText }) => {
  const [emptyTarget, setEmptyTarget] = useState(null);
  const [undoTarget, setUndoTarget] = useState(null);

  if (!pools?.length) {
    return (
      <p className="grain-card p-6 text-center text-sm text-[var(--ink-muted)]">
        {emptyText || "No khula right now. Open a bori to start selling loose rice."}
      </p>
    );
  }

  if (compact) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-5">
        {pools.map((pool) => (
          <MiniPool key={pool.riceType?._id} pool={pool} />
        ))}
      </div>
    );
  }

  const undoLot = undoTarget?.lot;
  return (
    <>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {pools.map((pool) => (
          <PoolCard
            key={pool.riceType?._id}
            pool={pool}
            role={role}
            showCost={showCost}
            onEndBatch={setEmptyTarget}
            onUndo={(p, lot) => setUndoTarget({ pool: p, lot })}
          />
        ))}
      </div>

      <ReasonModal
        open={!!emptyTarget}
        onClose={() => setEmptyTarget(null)}
        title={`End ${emptyTarget?.riceType?.name || ""} batch?`}
        confirmLabel="End batch"
        reasonRequired={false}
        placeholder="e.g. khula finished, some lost in weighing"
        onConfirm={async (note) => {
          await api.post("/khula/mark-empty", { riceTypeId: emptyTarget.riceType._id, note });
          setEmptyTarget(null);
          onChanged?.();
        }}
      >
        {emptyTarget && emptyTarget.remainingGrams > 0 ? (
          <p>
            The system still shows <strong className="text-[var(--ink)]">{formatShort(emptyTarget.remainingGrams)}</strong>. It goes to
            shortfall and the batch closes.
          </p>
        ) : (
          <p>All its lots will be closed as finished.</p>
        )}
      </ReasonModal>

      <ReasonModal
        open={!!undoTarget}
        onClose={() => setUndoTarget(null)}
        title={undoLot?.source === "LOOSE" ? "Remove loose rice" : "Put bori back to stock"}
        confirmLabel={undoLot?.source === "LOOSE" ? "Remove" : "Put back"}
        danger
        placeholder="e.g. opened the wrong bori"
        onConfirm={async (reason) => {
          await api.post(`/khula/${undoLot._id}/undo`, { reason });
          setUndoTarget(null);
          onChanged?.();
        }}
      >
        {undoLot &&
          (undoLot.source === "LOOSE" ? (
            <p>
              Remove {formatGrams(undoLot.totalGrams)} loose {undoTarget.pool.riceType?.name} from khula? Use this only if it was
              added by mistake.
            </p>
          ) : (
            <p>
              Put this {undoLot.boriSize} KG bori of {undoTarget.pool.riceType?.name} back into main stock? Use this only if it was
              opened by mistake. Nothing has been sold from it yet.
            </p>
          ))}
      </ReasonModal>
    </>
  );
};

export default KhulaContainers;

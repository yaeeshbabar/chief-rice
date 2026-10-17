import { useState } from "react";
import api from "../api/axios.js";
import Modal from "./Modal.jsx";
import ReasonModal from "./ReasonModal.jsx";

const RenameForm = ({ riceType, onClose, onDone }) => {
  const [name, setName] = useState(riceType.name);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.patch(`/rice-types/${riceType._id}`, { name, reason });
      onDone();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not rename");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <label className="field-label">Name</label>
        <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <p className="text-xs text-[var(--ink-faint)] mt-1.5">Old bills keep the name they were made with.</p>
      </div>
      <div>
        <label className="field-label">Reason (optional)</label>
        <input className="field-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. spelling mistake" />
      </div>
      {error && <p className="text-sm text-[var(--neg-ink)] bg-[var(--neg-tint)] rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" disabled={saving}>
          {saving ? "Saving..." : "Save name"}
        </button>
      </div>
    </form>
  );
};

export const RenameRiceTypeModal = ({ riceType, onClose, onDone }) => (
  <Modal open={!!riceType} onClose={onClose} title="Rename rice type">
    {riceType && (
      <RenameForm
        key={riceType._id}
        riceType={riceType}
        onClose={onClose}
        onDone={() => {
          onClose();
          onDone();
        }}
      />
    )}
  </Modal>
);

// Safe delete: blocked while bori or khula of the type is left. A type that was used in bills
// or records is hidden (its records stay); an unused one is removed completely.
export const DeleteRiceTypeModal = ({ riceType, onClose, onDone }) => (
  <ReasonModal
    open={!!riceType}
    onClose={onClose}
    title={`Delete ${riceType?.name || ""}?`}
    confirmLabel="Delete rice type"
    danger
    placeholder="e.g. added by mistake"
    onConfirm={async (reason) => {
      await api.delete(`/rice-types/${riceType._id}`, { data: { reason } });
      onClose();
      onDone();
    }}
  >
    <p>Only when no bori or khula is left. Old bills keep it.</p>
    <p>To stop selling it for a while, turn it off instead.</p>
  </ReasonModal>
);

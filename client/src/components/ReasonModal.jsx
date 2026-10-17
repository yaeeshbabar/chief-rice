import { useState } from "react";
import Modal from "./Modal.jsx";

// Asks "why?" before a correction (delete, undo, fix). The reason is saved in the
// Changes report together with who did it.
const ReasonModal = ({
  open,
  onClose,
  title,
  children,
  confirmLabel = "Confirm",
  danger = false,
  reasonRequired = true,
  placeholder = "e.g. entered by mistake",
  onConfirm,
}) => {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const close = () => {
    setReason("");
    setError("");
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (reasonRequired && !reason.trim()) {
      setError("Please write a reason");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onConfirm(reason.trim());
      setReason("");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not save this change");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title={title}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {children && <div className="text-sm text-[var(--ink-muted)] flex flex-col gap-2">{children}</div>}
        <div>
          <label className="field-label" htmlFor="reason-input">
            Reason{reasonRequired ? "" : " (optional)"}
          </label>
          <input
            id="reason-input"
            className="field-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
          <p className="text-xs text-[var(--ink-faint)] mt-1.5">Saved in the Changes report with your name.</p>
        </div>
        {error && <p className="text-sm text-[var(--neg-ink)] bg-[var(--neg-tint)] rounded-lg px-3 py-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={close}>
            Cancel
          </button>
          <button className={danger ? "btn-danger" : "btn-primary"} disabled={saving}>
            {saving ? "Saving..." : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ReasonModal;

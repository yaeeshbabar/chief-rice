import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios.js";
import Modal from "./Modal.jsx";
import { formatMoney } from "../utils/format.js";

const blankForm = { name: "", shopName: "", phone: "", address: "", openingBalance: "" };

// Add a creditor without making a bill. An old balance from the paper khata can be entered
// too. Warns when the same name or phone is already in the khata, to avoid two accounts.
const AddCreditorModal = ({ open, onClose, basePath }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState(null); // { message, existingId }
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    setDuplicate(null);
  };

  const close = () => {
    setError("");
    setDuplicate(null);
    onClose();
  };

  const save = async (allowDuplicate = false) => {
    setError("");
    setSaving(true);
    try {
      const { data } = await api.post("/customers", {
        ...form,
        openingBalance: form.openingBalance === "" ? 0 : Number(form.openingBalance),
        allowDuplicate,
      });
      setForm(blankForm);
      setDuplicate(null);
      onClose();
      navigate(`${basePath}/${data._id}`);
    } catch (err) {
      if (err?.response?.status === 409) setDuplicate(err.response.data);
      else setError(err?.response?.data?.message || "Could not add the creditor");
    } finally {
      setSaving(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (form.openingBalance !== "" && Number(form.openingBalance) < 0) {
      setError("Old balance can't be less than 0");
      return;
    }
    save(false);
  };

  return (
    <Modal open={open} onClose={close} title="Add creditor">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label className="field-label" htmlFor="creditor-name">
            Name
          </label>
          <input id="creditor-name" className="field-input" value={form.name} onChange={set("name")} required autoFocus />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="creditor-shop">
              Shop name (optional)
            </label>
            <input id="creditor-shop" className="field-input" value={form.shopName} onChange={set("shopName")} />
          </div>
          <div>
            <label className="field-label" htmlFor="creditor-phone">
              Phone (optional)
            </label>
            <input id="creditor-phone" className="field-input" value={form.phone} onChange={set("phone")} inputMode="tel" />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="creditor-address">
            Address (optional)
          </label>
          <input id="creditor-address" className="field-input" value={form.address} onChange={set("address")} />
        </div>
        <div>
          <label className="field-label" htmlFor="creditor-old">
            Old balance (Rs, optional)
          </label>
          <input
            id="creditor-old"
            type="number"
            min="0"
            className="field-input"
            value={form.openingBalance}
            onChange={set("openingBalance")}
            placeholder="0"
          />
          <p className="text-xs text-[var(--ink-faint)] mt-1.5">
            Money this customer already owes from before, e.g. from the paper khata. It is not a sale, so it doesn&apos;t change
            sales or profit.
          </p>
        </div>

        {duplicate && (
          <div className="rounded-lg border border-[var(--warn)] bg-[var(--warn-tint)] px-3 py-2.5 text-sm">
            <p className="font-medium text-[var(--ink)]">{duplicate.message}</p>
            <p className="text-[var(--ink-muted)] mt-0.5">Open that khata, or add this as a different person.</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                className="btn-outline text-xs py-1.5"
                onClick={() => {
                  close();
                  navigate(`${basePath}/${duplicate.existingId}`);
                }}
              >
                Open existing
              </button>
              <button type="button" className="btn-outline text-xs py-1.5" disabled={saving} onClick={() => save(true)}>
                Add anyway
              </button>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-[var(--neg-ink)] bg-[var(--neg-tint)] rounded-lg px-3 py-2">{error}</p>}
        <button className="btn-primary" disabled={saving}>
          {saving
            ? "Saving..."
            : Number(form.openingBalance) > 0
              ? `Add creditor with ${formatMoney(form.openingBalance)} old balance`
              : "Add creditor"}
        </button>
      </form>
    </Modal>
  );
};

export default AddCreditorModal;

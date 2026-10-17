import { useState } from "react";
import api from "../api/axios.js";
import Modal from "./Modal.jsx";
import { formatGrams, formatShort } from "../utils/format.js";

const blankForm = { riceTypeId: "", boriSize: 25, weighedGrams: "" };

// Open one bori from main stock into its rice type's khula. The bori is weighed first:
// khula gets the real weight and anything missing from the bag size is saved as shortfall.
const OpenBoriModal = ({ open, onClose, riceTypes, stock, onDone }) => {
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const available = (riceTypeId, size) =>
    stock.find((s) => s.riceType?._id === riceTypeId && s.boriSize === Number(size))?.quantity ?? 0;

  const bagGrams = Number(form.boriSize) * 1000;
  const weighed = Number(form.weighedGrams);
  const hasWeight = form.weighedGrams !== "" && weighed > 0;
  const short = bagGrams - weighed;
  const tooMuch = hasWeight && weighed > bagGrams * 1.1;

  const close = () => {
    setError("");
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!hasWeight) {
      setError("Weigh the bori and enter its exact weight in grams");
      return;
    }
    if (tooMuch) {
      setError(`That's more than a ${form.boriSize} KG bori can hold. Enter the weight in grams, e.g. ${bagGrams - 300}.`);
      return;
    }
    setSaving(true);
    try {
      await api.post("/khula/open", { ...form, weighedGrams: weighed });
      setForm(blankForm);
      onDone();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not open the bori");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Open a bori to khula">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label className="field-label">Rice type</label>
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
          <label className="field-label">Bori size</label>
          <div className="segmented w-full">
            {[25, 50].map((sz) => (
              <button
                type="button"
                key={sz}
                onClick={() => setForm({ ...form, boriSize: sz })}
                className={`segmented-item flex-1 ${Number(form.boriSize) === sz ? "is-active" : ""}`}
              >
                {sz} KG
              </button>
            ))}
          </div>
          {form.riceTypeId && (
            <p className="text-xs text-[var(--ink-muted)] mt-1.5">
              In main stock: {available(form.riceTypeId, form.boriSize)} bori
            </p>
          )}
        </div>
        <div>
          <label className="field-label" htmlFor="weighed-grams">
            Exact weight on the scale (grams)
          </label>
          <input
            id="weighed-grams"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            className="field-input"
            value={form.weighedGrams}
            onChange={(e) => setForm({ ...form, weighedGrams: e.target.value })}
            placeholder={`e.g. ${bagGrams - 300}`}
            required
          />
          {hasWeight && !tooMuch && (
            <p
              className={`text-xs mt-1.5 ${
                short > 0 ? (short >= 1000 ? "text-[var(--neg-ink)]" : "text-[var(--warn-ink)]") : "text-[var(--pos-ink)]"
              }`}
            >
              {formatGrams(weighed)} goes into khula.{" "}
              {short > 0
                ? `${formatShort(short)} short of ${form.boriSize} KG, saved as shortfall.`
                : short < 0
                  ? `${formatShort(short)} more than ${form.boriSize} KG.`
                  : `Exactly ${form.boriSize} KG.`}
              {short >= 1000 && " That's a lot, please check the scale."}
            </p>
          )}
          {!hasWeight && (
            <p className="text-xs text-[var(--ink-faint)] mt-1.5">
              Bori are not always exactly {form.boriSize} KG. Weigh it first; any shortfall is recorded.
            </p>
          )}
        </div>
        {error && <p className="text-sm text-[var(--neg-ink)] bg-[var(--neg-tint)] rounded-lg px-3 py-2">{error}</p>}
        <button className="btn-primary" disabled={saving}>
          {saving ? "Opening..." : "Open to khula"}
        </button>
      </form>
    </Modal>
  );
};

export default OpenBoriModal;

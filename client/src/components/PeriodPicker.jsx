import { periodPresets } from "../utils/period.js";

// Today / This week / This month ... with two date boxes when "Custom" is picked.
const PeriodPicker = ({ value, onChange }) => (
  <div className="flex flex-wrap items-end gap-3">
    <div className="segmented">
      {periodPresets.map((p) => (
        <button
          key={p.key}
          type="button"
          className={`segmented-item ${value.key === p.key ? "is-active" : ""}`}
          onClick={() => onChange({ key: p.key, from: value.from || "", to: value.to || "" })}
        >
          {p.label}
        </button>
      ))}
    </div>
    {value.key === "custom" && (
      <>
        <div>
          <label className="field-label" htmlFor="period-from">
            From
          </label>
          <input
            id="period-from"
            type="date"
            className="field-input"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="period-to">
            To
          </label>
          <input
            id="period-to"
            type="date"
            className="field-input"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </div>
      </>
    )}
  </div>
);

export default PeriodPicker;

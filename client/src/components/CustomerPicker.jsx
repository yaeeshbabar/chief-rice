import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { formatMoney } from "../utils/format.js";

// A proper searchable combobox for picking a credit customer during billing,
// with a clear "selected" state and a toggle to add a brand-new customer instead.
// existingOnly: just search and pick an existing creditor (e.g. for a return).
const CustomerPicker = ({ addingNew, onModeChange, selectedId, onSelect, newCustomer, onNewCustomerChange, existingOnly = false }) => {
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (addingNew && !existingOnly) return;
    const handle = setTimeout(() => {
      api.get(`/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`).then((res) => setCustomers(res.data));
    }, 150);
    return () => clearTimeout(handle);
  }, [search, addingNew, existingOnly]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    const found = customers.find((c) => c._id === selectedId);
    if (found) setSelected(found);
    else if (!selected || selected._id !== selectedId) {
      api.get(`/customers/${selectedId}`).then((res) => setSelected(res.data.customer));
    }
  }, [selectedId, customers]);

  return (
    <div className={`flex flex-col gap-2 ${existingOnly ? "" : "border-t border-[var(--color-husk)] pt-3"}`}>
      {!existingOnly && (
      <div className="segmented self-start">
        <button
          type="button"
          className={`segmented-item ${!addingNew ? "is-active" : ""}`}
          onClick={() => onModeChange(false)}
        >
          Existing customer
        </button>
        <button
          type="button"
          className={`segmented-item ${addingNew ? "is-active" : ""}`}
          onClick={() => onModeChange(true)}
        >
          New customer
        </button>
      </div>
      )}

      {existingOnly || !addingNew ? (
        <div className="relative">
          {selected ? (
            <div className="flex items-center justify-between bg-[var(--surface-soft-brand)] border border-[var(--color-wheat)] rounded-lg px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-[var(--color-coffee)]">
                  {selected.name} {selected.shopName ? `· ${selected.shopName}` : ""}
                </p>
                <p className="text-xs text-[var(--color-coffee-soft)]">Current due: {formatMoney(selected.balance)}</p>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-[var(--color-wheat-dark)]"
                onClick={() => {
                  onSelect("");
                  setOpen(true);
                }}
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                className="field-input"
                placeholder="Search by name, shop or phone..."
                value={search}
                onFocus={() => setOpen(true)}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setOpen(true);
                }}
              />
              {open && (
                <div className="mt-1 max-h-56 overflow-y-auto grain-card divide-y divide-[var(--color-husk)] absolute z-10 w-full">
                  {customers.length ? (
                    customers.map((c) => (
                      <button
                        type="button"
                        key={c._id}
                        onClick={() => {
                          onSelect(c._id);
                          setOpen(false);
                          setSearch("");
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-[var(--color-cream-deep)] flex items-center justify-between"
                      >
                        <span className="text-sm">
                          <span className="font-semibold text-[var(--color-coffee)]">{c.name}</span>
                          {c.shopName && <span className="text-[var(--color-coffee-soft)]"> · {c.shopName}</span>}
                        </span>
                        <span
                          className={`text-xs font-semibold ${c.balance > 0 ? "text-[var(--color-terracotta-deep)]" : "text-[var(--color-sage-deep)]"}`}
                        >
                          {formatMoney(c.balance)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-4 text-sm text-[var(--color-coffee-soft)] text-center">No customers match</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            className="field-input"
            placeholder="Customer name *"
            value={newCustomer.name}
            onChange={(e) => onNewCustomerChange({ ...newCustomer, name: e.target.value })}
          />
          <input
            className="field-input"
            placeholder="Shop name (optional)"
            value={newCustomer.shopName}
            onChange={(e) => onNewCustomerChange({ ...newCustomer, shopName: e.target.value })}
          />
          <input
            className="field-input"
            placeholder="Phone number"
            value={newCustomer.phone}
            onChange={(e) => onNewCustomerChange({ ...newCustomer, phone: e.target.value })}
          />
          <input
            className="field-input"
            placeholder="Address"
            value={newCustomer.address}
            onChange={(e) => onNewCustomerChange({ ...newCustomer, address: e.target.value })}
          />
        </div>
      )}
    </div>
  );
};

export default CustomerPicker;

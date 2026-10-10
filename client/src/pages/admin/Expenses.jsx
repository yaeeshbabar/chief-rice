import { useEffect, useState } from "react";
import api from "../../api/axios.js";
import Loader from "../../components/Loader.jsx";
import Modal from "../../components/Modal.jsx";
import CommissionPanel from "../../components/CommissionPanel.jsx";
import { formatMoney, formatDateTime } from "../../utils/format.js";

const categories = ["Dukan Kharch Khata", "Asim Kharcha Khata", "Salary"];

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from: "", to: "", category: "" });
  const [salaryPeople, setSalaryPeople] = useState([]);
  const [rentTypes, setRentTypes] = useState([]);
  const [showOptions, setShowOptions] = useState(false);
  const [newSalaryName, setNewSalaryName] = useState("");
  const [newRentName, setNewRentName] = useState("");
  const [editingOption, setEditingOption] = useState(null); // { id, name }
  const [editExpense, setEditExpense] = useState(null);
  const [editForm, setEditForm] = useState({ category: "", subCategory: "", amount: "", description: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.category) params.set("category", filters.category);
    api
      .get(`/expenses?${params.toString()}`)
      .then((res) => setExpenses(res.data))
      .finally(() => setLoading(false));
  };

  const loadOptions = () => {
    api.get("/expense-options?type=salaryPerson").then((res) => setSalaryPeople(res.data));
    api.get("/expense-options?type=rentType").then((res) => setRentTypes(res.data));
  };

  useEffect(() => {
    load();
    loadOptions();
  }, []);

  const addOption = async (type, name, resetFn) => {
    if (!name.trim()) return;
    await api.post("/expense-options", { type, name });
    resetFn("");
    loadOptions();
  };

  const removeOption = async (id) => {
    await api.patch(`/expense-options/${id}`, { active: false });
    loadOptions();
  };

  const saveOptionRename = async () => {
    if (!editingOption.name.trim()) return;
    await api.patch(`/expense-options/${editingOption.id}`, { name: editingOption.name });
    setEditingOption(null);
    loadOptions();
  };

  const openEditExpense = (e) => {
    setError("");
    setEditForm({ category: e.category, subCategory: e.subCategory || "", amount: e.amount, description: e.description || "" });
    setEditExpense(e);
  };

  const submitEditExpense = async (ev) => {
    ev.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.patch(`/expenses/${editExpense._id}`, editForm);
      setEditExpense(null);
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not update expense");
    } finally {
      setSaving(false);
    }
  };

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = categories.map((c) => ({
    category: c,
    total: expenses.filter((e) => e.category === c).reduce((sum, e) => sum + e.amount, 0),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-[var(--color-coffee)]">Extra Expense</h2>
        <button className="btn-outline" onClick={() => setShowOptions(true)}>
          Manage Salary Names & Rent Types
        </button>
      </div>

      <div className="grain-card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="field-label">From</label>
          <input type="date" className="field-input" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </div>
        <div>
          <label className="field-label">To</label>
          <input type="date" className="field-input" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Category</label>
          <select className="field-input" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={load}>
          Apply
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="grain-card p-3">
          <p className="text-xs text-[var(--color-coffee-soft)]">Total</p>
          <p className="font-display font-semibold">{formatMoney(total)}</p>
        </div>
        {byCategory.map((c) => (
          <div className="grain-card p-3" key={c.category}>
            <p className="text-xs text-[var(--color-coffee-soft)] truncate">{c.category}</p>
            <p className="font-display font-semibold">{formatMoney(c.total)}</p>
          </div>
        ))}
      </div>

      <CommissionPanel />

      {loading ? (
        <Loader />
      ) : (
        <div className="grain-card overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">Category</th>
                <th className="py-3 px-4 font-medium">Detail</th>
                <th className="py-3 px-4 font-medium">Added By</th>
                <th className="py-3 px-4 font-medium text-right">Amount</th>
                <th className="py-3 px-4 font-medium text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-husk)]">
              {expenses.map((e) => (
                <tr key={e._id}>
                  <td className="py-2.5 px-4 whitespace-nowrap">{formatDateTime(e.createdAt)}</td>
                  <td className="py-2.5 px-4">{e.category}</td>
                  <td className="py-2.5 px-4">
                    {e.subCategory && <span className="font-medium">{e.subCategory}</span>}
                    {e.description && <span className="text-[var(--color-coffee-soft)]"> · {e.description}</span>}
                    {e.relatedQuantityBori > 0 && (
                      <span className="text-[var(--color-coffee-soft)]">
                        {" "}
                        · {e.relatedQuantityBori} × {e.relatedBoriSize}KG {e.relatedRiceType?.name} (removed from stock)
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">{e.createdBy?.name}</td>
                  <td className="py-2.5 px-4 text-right font-semibold">{formatMoney(e.amount)}</td>
                  <td className="py-2.5 px-4 text-right">
                    <button className="text-xs font-semibold text-[var(--color-wheat-dark)]" onClick={() => openEditExpense(e)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {!expenses.length && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--color-coffee-soft)]">
                    No expenses recorded for this filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showOptions} onClose={() => setShowOptions(false)} title="Manage Dropdown Options" wide>
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-sm mb-2">Salary — Salesman Names</h4>
            <div className="flex gap-2 mb-3">
              <input className="field-input" value={newSalaryName} onChange={(e) => setNewSalaryName(e.target.value)} placeholder="e.g. Kashif" />
              <button className="btn-primary" onClick={() => addOption("salaryPerson", newSalaryName, setNewSalaryName)}>
                Add
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {salaryPeople.map((p) => (
                <div key={p._id} className="flex items-center justify-between bg-[var(--color-cream-deep)] rounded-lg px-3 py-1.5 text-sm gap-2">
                  {editingOption?.id === p._id ? (
                    <input
                      className="field-input py-1"
                      value={editingOption.name}
                      onChange={(e) => setEditingOption({ ...editingOption, name: e.target.value })}
                      autoFocus
                    />
                  ) : (
                    <span>{p.name}</span>
                  )}
                  <div className="flex gap-2 shrink-0">
                    {editingOption?.id === p._id ? (
                      <button className="text-xs font-semibold text-[var(--color-sage-deep)]" onClick={saveOptionRename}>
                        Save
                      </button>
                    ) : (
                      <button className="text-xs font-semibold text-[var(--color-wheat-dark)]" onClick={() => setEditingOption({ id: p._id, name: p.name })}>
                        Edit
                      </button>
                    )}
                    <button className="text-xs font-semibold text-[var(--color-terracotta-deep)]" onClick={() => removeOption(p._id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-2">Rent Types</h4>
            <div className="flex gap-2 mb-3">
              <input className="field-input" value={newRentName} onChange={(e) => setNewRentName(e.target.value)} placeholder="e.g. House 2 Rent" />
              <button className="btn-primary" onClick={() => addOption("rentType", newRentName, setNewRentName)}>
                Add
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {rentTypes.map((p) => (
                <div key={p._id} className="flex items-center justify-between bg-[var(--color-cream-deep)] rounded-lg px-3 py-1.5 text-sm gap-2">
                  {editingOption?.id === p._id ? (
                    <input
                      className="field-input py-1"
                      value={editingOption.name}
                      onChange={(e) => setEditingOption({ ...editingOption, name: e.target.value })}
                      autoFocus
                    />
                  ) : (
                    <span>{p.name}</span>
                  )}
                  <div className="flex gap-2 shrink-0">
                    {editingOption?.id === p._id ? (
                      <button className="text-xs font-semibold text-[var(--color-sage-deep)]" onClick={saveOptionRename}>
                        Save
                      </button>
                    ) : (
                      <button className="text-xs font-semibold text-[var(--color-wheat-dark)]" onClick={() => setEditingOption({ id: p._id, name: p.name })}>
                        Edit
                      </button>
                    )}
                    <button className="text-xs font-semibold text-[var(--color-terracotta-deep)]" onClick={() => removeOption(p._id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={!!editExpense} onClose={() => setEditExpense(null)} title="Edit Expense">
        {editExpense && (
          <form onSubmit={submitEditExpense} className="flex flex-col gap-3">
            <div>
              <label className="field-label">Category</label>
              <select className="field-input" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Detail / Sub-category</label>
              <input className="field-input" value={editForm.subCategory} onChange={(e) => setEditForm({ ...editForm, subCategory: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Amount (Rs)</label>
              <input type="number" min="1" className="field-input" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} required />
            </div>
            <div>
              <label className="field-label">Description</label>
              <input className="field-input" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            {error && <p className="text-sm text-[var(--color-terracotta-deep)]">{error}</p>}
            <button className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default Expenses;

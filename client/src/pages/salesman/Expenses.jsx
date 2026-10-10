import { useEffect, useState } from "react";
import api from "../../api/axios.js";
import Loader from "../../components/Loader.jsx";
import Modal from "../../components/Modal.jsx";
import CommissionPanel from "../../components/CommissionPanel.jsx";
import { formatMoney, formatDateTime } from "../../utils/format.js";

const dukanOptions = [
  "Wifi",
  "Electricity Bill",
  "Water Charges",
  "Rent",
  "Bike Petrol",
  "Bike Expense",
  "Baraf",
  "Pani",
  "Kamayti",
  "Ride",
  "Other",
];
const asimOptions = ["Cigarette", "Khana Pina", "Rice Bags", "Rashan", "Extra Expense"];
const allCategories = ["Dukan Kharch Khata", "Asim Kharcha Khata", "Salary"];

const Expenses = () => {
  const [category, setCategory] = useState("Dukan Kharch Khata");
  const [subCategory, setSubCategory] = useState(dukanOptions[0]);
  const [rentType, setRentType] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [riceTypes, setRiceTypes] = useState([]);
  const [riceBagsRiceType, setRiceBagsRiceType] = useState("");
  const [riceBagsBoriSize, setRiceBagsBoriSize] = useState(25);
  const [riceBagsQty, setRiceBagsQty] = useState("");
  const [salaryPeople, setSalaryPeople] = useState([]);
  const [rentTypes, setRentTypes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [editForm, setEditForm] = useState({ category: "", subCategory: "", amount: "", description: "" });
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get("/expenses")
      .then((res) => setExpenses(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get("/expense-options?type=salaryPerson").then((res) => setSalaryPeople(res.data));
    api.get("/expense-options?type=rentType").then((res) => setRentTypes(res.data));
    api.get("/rice-types").then((res) => setRiceTypes(res.data));
  }, []);

  useEffect(() => {
    if (category === "Dukan Kharch Khata") setSubCategory(dukanOptions[0]);
    else if (category === "Asim Kharcha Khata") setSubCategory(asimOptions[0]);
    else setSubCategory(salaryPeople[0]?.name || "");
    setRentType("");
  }, [category, salaryPeople]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!amount || Number(amount) <= 0) {
      setError("Enter a valid amount");
      return;
    }
    const finalSubCategory = subCategory === "Rent" ? rentType : subCategory;
    if (subCategory === "Rent" && !rentType) {
      setError("Select which rent this is for");
      return;
    }
    if (subCategory === "Other" && !description.trim()) {
      setError('A note is required for "Other" expenses');
      return;
    }
    if (subCategory === "Rice Bags" && (!riceBagsRiceType || !riceBagsQty)) {
      setError("Select rice type and quantity for Rice Bags - this also removes it from main stock");
      return;
    }
    setSaving(true);
    try {
      await api.post("/expenses", {
        category,
        subCategory: finalSubCategory,
        amount,
        description,
        riceTypeId: subCategory === "Rice Bags" ? riceBagsRiceType : undefined,
        boriSize: subCategory === "Rice Bags" ? riceBagsBoriSize : undefined,
        quantityBori: subCategory === "Rice Bags" ? riceBagsQty : undefined,
      });
      setSuccess("Expense recorded");
      setAmount("");
      setDescription("");
      setRiceBagsQty("");
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not save expense");
    } finally {
      setSaving(false);
    }
  };

  const openEditExpense = (exp) => {
    setEditError("");
    setEditForm({ category: exp.category, subCategory: exp.subCategory || "", amount: exp.amount, description: exp.description || "" });
    setEditExpense(exp);
  };

  const submitEditExpense = async (ev) => {
    ev.preventDefault();
    setEditError("");
    setEditSaving(true);
    try {
      await api.patch(`/expenses/${editExpense._id}`, editForm);
      setEditExpense(null);
      load();
    } catch (err) {
      setEditError(err?.response?.data?.message || "Could not update expense");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <h2 className="lg:col-span-3 font-display text-xl font-semibold text-[var(--ink)]">Extra expense</h2>
      <div className="grain-card p-4 flex flex-col gap-3 h-fit">
        <h3 className="font-display font-semibold text-[var(--color-coffee)]">Add Expense</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="field-label">Khata</label>
            <select className="field-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {allCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {category === "Dukan Kharch Khata" && (
            <div>
              <label className="field-label">Item</label>
              <select className="field-input" value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
                {dukanOptions.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
          )}
          {category === "Dukan Kharch Khata" && subCategory === "Rent" && (
            <div>
              <label className="field-label">Which Rent</label>
              <select className="field-input" value={rentType} onChange={(e) => setRentType(e.target.value)}>
                <option value="">Select</option>
                {rentTypes.map((r) => (
                  <option key={r._id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}
          {category === "Asim Kharcha Khata" && (
            <div>
              <label className="field-label">Item</label>
              <select className="field-input" value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
                {asimOptions.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
          )}
          {category === "Asim Kharcha Khata" && subCategory === "Rice Bags" && (
            <div className="flex flex-col gap-3 bg-[var(--surface-soft-brand)] rounded-lg p-3">
              <p className="text-xs text-[var(--color-coffee-soft)]">
                This also removes the bori from main stock, same as a sale would.
              </p>
              <div>
                <label className="field-label">Rice Type</label>
                <select className="field-input" value={riceBagsRiceType} onChange={(e) => setRiceBagsRiceType(e.target.value)}>
                  <option value="">Select</option>
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
                      onClick={() => setRiceBagsBoriSize(sz)}
                      className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                        Number(riceBagsBoriSize) === sz ? "border-[var(--color-wheat)] bg-[var(--color-cream-deep)]" : "border-[var(--color-husk)]"
                      }`}
                    >
                      {sz} KG
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="field-label">Quantity (bori)</label>
                <input type="number" min="1" className="field-input" value={riceBagsQty} onChange={(e) => setRiceBagsQty(e.target.value)} />
              </div>
            </div>
          )}
          {category === "Salary" && (
            <div>
              <label className="field-label">Salesman Name</label>
              <select className="field-input" value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
                {salaryPeople.length ? (
                  salaryPeople.map((p) => <option key={p._id}>{p.name}</option>)
                ) : (
                  <option value="">Ask admin to add salesman names first</option>
                )}
              </select>
            </div>
          )}

          <div>
            <label className="field-label">Amount (Rs)</label>
            <input type="number" min="1" className="field-input" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <label className="field-label">
              Note {subCategory === "Other" ? "(required for Other)" : "(optional)"}
            </label>
            <input className="field-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. details of this expense" />
          </div>
          {error && <p className="text-sm text-[var(--color-terracotta-deep)]">{error}</p>}
          {success && <p className="text-sm text-[var(--color-sage-deep)]">{success}</p>}
          <button className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Add Expense"}
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 grain-card overflow-x-auto">
        {loading ? (
          <Loader />
        ) : (
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">Khata</th>
                <th className="py-3 px-4 font-medium">Detail</th>
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
                  <td colSpan={5} className="py-8 text-center text-[var(--color-coffee-soft)]">
                    No expenses recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="lg:col-span-3">
        <CommissionPanel />
      </div>

      <Modal open={!!editExpense} onClose={() => setEditExpense(null)} title="Edit Expense">
        {editExpense && (
          <form onSubmit={submitEditExpense} className="flex flex-col gap-3">
            <div>
              <label className="field-label">Khata</label>
              <select className="field-input" value={editForm.category} onChange={(ev) => setEditForm({ ...editForm, category: ev.target.value })}>
                {allCategories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Detail / Sub-category</label>
              <input className="field-input" value={editForm.subCategory} onChange={(ev) => setEditForm({ ...editForm, subCategory: ev.target.value })} />
            </div>
            <div>
              <label className="field-label">Amount (Rs)</label>
              <input
                type="number"
                min="1"
                className="field-input"
                value={editForm.amount}
                onChange={(ev) => setEditForm({ ...editForm, amount: ev.target.value })}
                required
              />
            </div>
            <div>
              <label className="field-label">Note</label>
              <input className="field-input" value={editForm.description} onChange={(ev) => setEditForm({ ...editForm, description: ev.target.value })} />
            </div>
            {editForm.subCategory === "Rice Bags" && (
              <p className="text-xs text-[var(--color-coffee-soft)] bg-[var(--surface-soft-brand)] rounded-lg p-2">
                To change the rice type/bori size/quantity for a Rice Bags expense, delete this one and add a fresh
                entry - that keeps the stock adjustment accurate.
              </p>
            )}
            {editError && <p className="text-sm text-[var(--color-terracotta-deep)]">{editError}</p>}
            <button className="btn-primary" disabled={editSaving}>
              {editSaving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default Expenses;

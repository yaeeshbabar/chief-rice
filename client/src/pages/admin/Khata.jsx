import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import api from "../../api/axios.js";
import Loader from "../../components/Loader.jsx";
import AddCreditorModal from "../../components/AddCreditorModal.jsx";
import { PhoneList, PhoneRow } from "../../components/PhoneList.jsx";
import { useIsPhone } from "../../utils/useIsPhone.js";
import { formatMoney } from "../../utils/format.js";

const Khata = () => {
  const isPhone = useIsPhone();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [onlyDue, setOnlyDue] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = (q = "") => {
    setLoading(true);
    api
      .get(`/customers${q ? `?search=${encodeURIComponent(q)}` : ""}`)
      .then((res) => setCustomers(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const handleSearch = (e) => {
    e.preventDefault();
    load(search);
  };

  const visible = onlyDue ? customers.filter((c) => c.balance > 0) : customers;
  const total = customers.reduce((sum, c) => sum + c.balance, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Khata</h2>
          <p className="text-sm text-[var(--color-coffee-soft)]">Total outstanding: {formatMoney(total)}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 sm:flex-none">
            <input
              className="field-input w-full sm:w-56"
              placeholder="Search by name, shop or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn-outline">Search</button>
          </form>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={15} />
            Add creditor
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--color-coffee-soft)] w-fit">
        <input type="checkbox" checked={onlyDue} onChange={(e) => setOnlyDue(e.target.checked)} />
        Show only customers with outstanding balance
      </label>

      {loading ? (
        <Loader />
      ) : isPhone ? (
        <div className="grain-card">
          <PhoneList empty="No customers found">
            {visible.map((c) => (
              <PhoneRow
                key={c._id}
                title={
                  <Link to={`/admin/khata/${c._id}`} className="font-medium text-[var(--ink)]">
                    {c.name}
                  </Link>
                }
                sub={[c.shopName, c.phone].filter(Boolean).join(", ") || undefined}
                amount={formatMoney(c.balance)}
                amountClass={c.balance > 0 ? "text-[var(--neg-ink)]" : "text-[var(--pos-ink)]"}
              />
            ))}
          </PhoneList>
        </div>
      ) : (
        <div className="grain-card overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[var(--color-coffee-soft)] border-b border-[var(--color-husk)]">
                <th className="py-3 px-4 font-medium">Name</th>
                <th className="py-3 px-4 font-medium">Shop</th>
                <th className="py-3 px-4 font-medium">Phone</th>
                <th className="py-3 px-4 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-husk)]">
              {visible.map((c) => (
                <tr key={c._id} className="hover:bg-[var(--color-cream-deep)]">
                  <td className="py-2.5 px-4">
                    <Link to={`/admin/khata/${c._id}`} className="font-medium text-[var(--color-coffee)] hover:text-[var(--color-wheat-dark)]">
                      {c.name}
                    </Link>
                  </td>
                  <td className="py-2.5 px-4">{c.shopName || "—"}</td>
                  <td className="py-2.5 px-4">{c.phone || "—"}</td>
                  <td className={`py-2.5 px-4 text-right font-semibold ${c.balance > 0 ? "text-[var(--color-terracotta-deep)]" : "text-[var(--color-sage-deep)]"}`}>
                    {formatMoney(c.balance)}
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[var(--color-coffee-soft)]">
                    No customers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AddCreditorModal open={showAdd} onClose={() => setShowAdd(false)} basePath="/admin/khata" />
    </div>
  );
};

export default Khata;

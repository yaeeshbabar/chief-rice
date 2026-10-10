import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import api from "../../api/axios.js";
import Loader from "../../components/Loader.jsx";
import Modal from "../../components/Modal.jsx";

const Settings = () => {
  const [riceTypes, setRiceTypes] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState({
    ownerType: "asim",
    ownerName: "",
    bankName: "",
    accountTitle: "",
    accountNumber: "",
    iban: "",
    branchCode: "",
  });
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [agentForm, setAgentForm] = useState({ name: "", percentage: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/rice-types?includeInactive=true"),
      api.get("/bank-accounts?includeInactive=true"),
      api.get("/commission-agents?includeInactive=true"),
    ])
      .then(([rt, ba, ca]) => {
        setRiceTypes(rt.data);
        setAccounts(ba.data);
        setAgents(ca.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleRiceType = async (rt) => {
    await api.patch(`/rice-types/${rt._id}`, { active: !rt.active });
    load();
  };

  const submitAccount = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/bank-accounts", accountForm);
      setShowAccountModal(false);
      setAccountForm({ ownerType: "asim", ownerName: "", bankName: "", accountTitle: "", accountNumber: "", iban: "", branchCode: "" });
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not add account");
    } finally {
      setSaving(false);
    }
  };

  const toggleAccount = async (a) => {
    await api.patch(`/bank-accounts/${a._id}`, { active: !a.active });
    load();
  };

  const submitAgent = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/commission-agents", agentForm);
      setShowAgentModal(false);
      setAgentForm({ name: "", percentage: "" });
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not add commission agent");
    } finally {
      setSaving(false);
    }
  };

  const toggleAgent = async (a) => {
    await api.patch(`/commission-agents/${a._id}`, { active: !a.active });
    load();
  };

  if (loading) return <Loader />;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-xl font-semibold text-[var(--color-coffee)]">Settings</h2>

      <div className="grain-card p-5">
        <h3 className="font-display font-semibold mb-1">Rice Types</h3>
        <p className="text-sm text-[var(--color-coffee-soft)] mb-4">
          Turn a rice type off if you no longer trade it — it will disappear from sale forms but keeps its sales history.
        </p>
        <div className="flex flex-col divide-y divide-[var(--color-husk)]">
          {riceTypes.map((rt) => (
            <div key={rt._id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="font-medium">{rt.name}</span>
              <button
                onClick={() => toggleRiceType(rt)}
                className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  rt.active ? "bg-[var(--surface-soft)] text-[var(--color-sage-deep)]" : "bg-[var(--surface-soft-danger)] text-[var(--color-terracotta-deep)]"
                }`}
              >
                {rt.active ? "Active" : "Inactive"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grain-card p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display font-semibold">Bank Accounts</h3>
          <button className="btn-outline text-xs px-3 py-1.5" onClick={() => setShowAccountModal(true)}>
            <Plus size={14} />
            Add account
          </button>
        </div>
        <p className="text-sm text-[var(--color-coffee-soft)] mb-4">
          Asim's accounts and the salesman's account, used when picking where an online payment landed.
        </p>
        <div className="flex flex-col divide-y divide-[var(--color-husk)]">
          {accounts.map((a) => (
            <div key={a._id} className="flex items-center justify-between py-2.5 text-sm gap-2">
              <div>
                <p className="font-medium">
                  {a.bankName} <span className="text-[var(--ink-muted)] font-normal">({a.ownerType === "asim" ? "Asim" : "Salesman"})</span>
                </p>
                <p className="text-xs text-[var(--color-coffee-soft)]">{a.accountTitle} · {a.accountNumber}</p>
              </div>
              <button
                onClick={() => toggleAccount(a)}
                className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${
                  a.active ? "bg-[var(--surface-soft)] text-[var(--color-sage-deep)]" : "bg-[var(--surface-soft-danger)] text-[var(--color-terracotta-deep)]"
                }`}
              >
                {a.active ? "Active" : "Inactive"}
              </button>
            </div>
          ))}
          {!accounts.length && <p className="text-sm text-[var(--color-coffee-soft)] py-4 text-center">No accounts added yet</p>}
        </div>
      </div>

      <div className="grain-card p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display font-semibold">Commission Agents</h3>
          <button className="btn-outline text-xs px-3 py-1.5" onClick={() => setShowAgentModal(true)}>
            <Plus size={14} />
            Add agent
          </button>
        </div>
        <p className="text-sm text-[var(--color-coffee-soft)] mb-4">
          Salesmen who earn a % of profit (not sale price) on bills tagged to them during billing.
        </p>
        <div className="flex flex-col divide-y divide-[var(--color-husk)]">
          {agents.map((a) => (
            <div key={a._id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="font-medium">
                {a.name} — {a.percentage}% of profit
              </span>
              <button
                onClick={() => toggleAgent(a)}
                className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  a.active ? "bg-[var(--surface-soft)] text-[var(--color-sage-deep)]" : "bg-[var(--surface-soft-danger)] text-[var(--color-terracotta-deep)]"
                }`}
              >
                {a.active ? "Active" : "Inactive"}
              </button>
            </div>
          ))}
          {!agents.length && <p className="text-sm text-[var(--color-coffee-soft)] py-4 text-center">No commission agents added yet</p>}
        </div>
      </div>

      <div className="grain-card p-5">
        <h3 className="font-display font-semibold mb-1">About</h3>
        <p className="text-sm text-[var(--color-coffee-soft)]">
          Chief Rice Trader — Inventory &amp; Sales Management System.
          <br />
          Built for Asim Siddique by Yaeesh Babar, Black Hole Matrix.
        </p>
      </div>

      <Modal open={showAccountModal} onClose={() => setShowAccountModal(false)} title="Add Bank Account">
        <form onSubmit={submitAccount} className="flex flex-col gap-3">
          <div>
            <label className="field-label">Owner</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAccountForm({ ...accountForm, ownerType: "asim" })}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${accountForm.ownerType === "asim" ? "border-[var(--color-wheat)] bg-[var(--color-cream-deep)]" : "border-[var(--color-husk)]"}`}
              >
                Asim
              </button>
              <button
                type="button"
                onClick={() => setAccountForm({ ...accountForm, ownerType: "salesman" })}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${accountForm.ownerType === "salesman" ? "border-[var(--color-wheat)] bg-[var(--color-cream-deep)]" : "border-[var(--color-husk)]"}`}
              >
                Salesman
              </button>
            </div>
          </div>
          <input className="field-input" placeholder="Owner Name (e.g. Asim Siddique)" value={accountForm.ownerName} onChange={(e) => setAccountForm({ ...accountForm, ownerName: e.target.value })} required />
          <input className="field-input" placeholder="Bank Name" value={accountForm.bankName} onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })} required />
          <input className="field-input" placeholder="Account Title" value={accountForm.accountTitle} onChange={(e) => setAccountForm({ ...accountForm, accountTitle: e.target.value })} required />
          <input className="field-input" placeholder="Account Number" value={accountForm.accountNumber} onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })} required />
          <input className="field-input" placeholder="IBAN (optional)" value={accountForm.iban} onChange={(e) => setAccountForm({ ...accountForm, iban: e.target.value })} />
          <input className="field-input" placeholder="Branch Code (optional)" value={accountForm.branchCode} onChange={(e) => setAccountForm({ ...accountForm, branchCode: e.target.value })} />
          {error && <p className="text-sm text-[var(--color-terracotta-deep)]">{error}</p>}
          <button className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Add Account"}
          </button>
        </form>
      </Modal>

      <Modal open={showAgentModal} onClose={() => setShowAgentModal(false)} title="Add Commission Agent">
        <form onSubmit={submitAgent} className="flex flex-col gap-3">
          <input className="field-input" placeholder="Salesman Name (e.g. Sultan)" value={agentForm.name} onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })} required />
          <input
            type="number"
            min="0"
            max="100"
            className="field-input"
            placeholder="Commission % of profit (e.g. 30)"
            value={agentForm.percentage}
            onChange={(e) => setAgentForm({ ...agentForm, percentage: e.target.value })}
            required
          />
          {error && <p className="text-sm text-[var(--color-terracotta-deep)]">{error}</p>}
          <button className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Add Agent"}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default Settings;

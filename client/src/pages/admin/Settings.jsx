import { useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import api from "../../api/axios.js";
import Loader from "../../components/Loader.jsx";
import Modal from "../../components/Modal.jsx";
import ReasonModal from "../../components/ReasonModal.jsx";
import { RenameRiceTypeModal, DeleteRiceTypeModal } from "../../components/RiceTypeFixModals.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const blankAccount = { ownerType: "asim", ownerName: "", bankName: "", accountTitle: "", accountNumber: "", iban: "", branchCode: "" };
const blankLogin = { name: "", username: "", password: "", role: "salesman" };

// On / off switch with the word next to it, so its state is clear without colour alone.
const Switch = ({ on, onChange, label, disabled = false, title }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    title={title}
    disabled={disabled}
    onClick={onChange}
    className="switch"
  >
    <span className={`switch-track ${on ? "is-on" : ""}`}>
      <span className="switch-knob" />
    </span>
    <span className="w-6 text-left">{on ? "On" : "Off"}</span>
  </button>
);

const IconButton = ({ label, onClick, danger = false, children }) => (
  <button
    type="button"
    className={`icon-btn h-8 w-8 ${danger ? "hover:text-[var(--neg-ink)]" : ""}`}
    onClick={onClick}
    title={label}
    aria-label={label}
  >
    {children}
  </button>
);

const Section = ({ title, hint, action, children }) => (
  <section className="grain-card p-5">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <h3 className="section-title">{title}</h3>
        {hint && <p className="text-sm text-[var(--ink-muted)] mt-0.5">{hint}</p>}
      </div>
      {action}
    </div>
    <div className="flex flex-col divide-y divide-[var(--line)]">{children}</div>
  </section>
);

const Row = ({ title, sub, children }) => (
  <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
    <div className="min-w-0">
      <p className="font-medium break-words">{title}</p>
      {sub && <p className="text-xs text-[var(--ink-muted)] break-all">{sub}</p>}
    </div>
    <div className="flex items-center gap-1 shrink-0">{children}</div>
  </div>
);

const ErrorText = ({ children }) =>
  children ? <p className="text-sm text-[var(--neg-ink)] bg-[var(--neg-tint)] rounded-lg px-3 py-2">{children}</p> : null;

const Field = ({ id, label, children }) => (
  <div>
    <label className="field-label" htmlFor={id}>
      {label}
    </label>
    {children}
  </div>
);

const Settings = () => {
  const { user: me, updateMe } = useAuth();
  const [riceTypes, setRiceTypes] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [pageError, setPageError] = useState("");

  const [addType, setAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [renameType, setRenameType] = useState(null);
  const [deleteType, setDeleteType] = useState(null);
  const [accountModal, setAccountModal] = useState(null); // { account } — account null = new
  const [accountForm, setAccountForm] = useState(blankAccount);
  const [deleteAccount, setDeleteAccount] = useState(null);
  const [agentModal, setAgentModal] = useState(null);
  const [agentForm, setAgentForm] = useState({ name: "", percentage: "" });
  const [deleteAgent, setDeleteAgent] = useState(null);
  const [loginModal, setLoginModal] = useState(null);
  const [loginForm, setLoginForm] = useState(blankLogin);
  const [loginOff, setLoginOff] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirm: "", currentPassword: "" });

  const load = () => {
    Promise.all([
      api.get("/rice-types?includeInactive=true"),
      api.get("/bank-accounts?includeInactive=true"),
      api.get("/commission-agents?includeInactive=true"),
      api.get("/auth/users"),
    ])
      .then(([rt, ba, ca, us]) => {
        setRiceTypes(rt.data);
        setAccounts(ba.data);
        setAgents(ca.data);
        setUsers(us.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Runs a save, shows the server's message if it fails, closes and reloads on success.
  const save = async (request, done) => {
    setError("");
    setSaving(true);
    try {
      await request();
      done?.();
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  // On/off switches: no form open, so a problem shows at the top of the page.
  const quick = async (request) => {
    setPageError("");
    try {
      await request();
      load();
    } catch (err) {
      setPageError(err?.response?.data?.message || "Could not save");
    }
  };
  const toggle = (path, item) => quick(() => api.patch(path, { active: !item.active }));

  const openAddType = () => {
    setError("");
    setNewTypeName("");
    setAddType(true);
  };
  const submitType = (e) => {
    e.preventDefault();
    save(
      () => api.post("/rice-types", { name: newTypeName }),
      () => setAddType(false)
    );
  };

  const openAccount = (account) => {
    setError("");
    setAccountForm(
      account
        ? {
            ownerType: account.ownerType,
            ownerName: account.ownerName || "",
            bankName: account.bankName || "",
            accountTitle: account.accountTitle || "",
            accountNumber: account.accountNumber || "",
            iban: account.iban || "",
            branchCode: account.branchCode || "",
          }
        : blankAccount
    );
    setAccountModal({ account });
  };
  const submitAccount = (e) => {
    e.preventDefault();
    const editing = accountModal.account;
    save(
      () => (editing ? api.patch(`/bank-accounts/${editing._id}`, accountForm) : api.post("/bank-accounts", accountForm)),
      () => setAccountModal(null)
    );
  };

  const openAgent = (agent) => {
    setError("");
    setAgentForm(agent ? { name: agent.name, percentage: String(agent.percentage) } : { name: "", percentage: "" });
    setAgentModal({ agent });
  };
  const submitAgent = (e) => {
    e.preventDefault();
    const editing = agentModal.agent;
    save(
      () => (editing ? api.patch(`/commission-agents/${editing._id}`, agentForm) : api.post("/commission-agents", agentForm)),
      () => setAgentModal(null)
    );
  };

  const openLogin = (login) => {
    setError("");
    setLoginForm(login ? { ...blankLogin, name: login.name } : blankLogin);
    setLoginModal({ login });
  };
  const submitLogin = (e) => {
    e.preventDefault();
    const editing = loginModal.login;
    save(
      () => (editing ? api.patch(`/auth/users/${editing._id}`, { name: loginForm.name }) : api.post("/auth/users", loginForm)),
      () => {
        setLoginModal(null);
        if (editing && String(editing._id) === String(me?.id)) updateMe({ name: loginForm.name.trim() });
        setNotice(editing ? "" : `Login added. ${loginForm.name.trim()} signs in as "${loginForm.username.trim().toLowerCase()}".`);
      }
    );
  };

  const openPassword = (u) => {
    setError("");
    setPasswordForm({ newPassword: "", confirm: "", currentPassword: "" });
    setPasswordTarget(u);
  };
  const submitPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (passwordForm.newPassword.length < 6) return setError("New password should be at least 6 characters");
    if (passwordForm.newPassword !== passwordForm.confirm) return setError("The two new passwords don't match");
    setSaving(true);
    try {
      const { data } = await api.patch(`/auth/users/${passwordTarget._id}/password`, {
        newPassword: passwordForm.newPassword,
        currentPassword: passwordForm.currentPassword,
      });
      // Changing your own password: keep this device logged in with the new login.
      if (data.token) localStorage.setItem("crt_token", data.token);
      setNotice(`Password changed for ${passwordTarget.name}. Old logins are signed out.`);
      setPasswordTarget(null);
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not change the password");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="page-title">Settings</h2>
      <ErrorText>{pageError}</ErrorText>
      {notice && (
        <p className="text-sm text-[var(--pos-ink)] bg-[var(--pos-tint)] rounded-lg px-3 py-2 flex justify-between gap-3">
          {notice}
          <button className="font-medium" onClick={() => setNotice("")}>
            OK
          </button>
        </p>
      )}

      <Section
        title="Rice types"
        hint="Off hides it from sales."
        action={
          <button className="btn-outline text-xs px-3 py-1.5" onClick={openAddType}>
            <Plus size={14} />
            Add
          </button>
        }
      >
        {riceTypes.map((rt) => (
          <Row key={rt._id} title={rt.name}>
            <IconButton label={`Rename ${rt.name}`} onClick={() => setRenameType(rt)}>
              <Pencil size={14} />
            </IconButton>
            <IconButton label={`Delete ${rt.name}`} danger onClick={() => setDeleteType(rt)}>
              <Trash2 size={14} />
            </IconButton>
            <Switch on={rt.active} label={`${rt.name} on or off`} onChange={() => toggle(`/rice-types/${rt._id}`, rt)} />
          </Row>
        ))}
      </Section>

      <Section
        title="Bank accounts"
        hint="Where online payments land."
        action={
          <button className="btn-outline text-xs px-3 py-1.5" onClick={() => openAccount(null)}>
            <Plus size={14} />
            Add
          </button>
        }
      >
        {accounts.map((a) => (
          <Row
            key={a._id}
            title={
              <>
                {a.bankName} <span className="font-normal text-[var(--ink-muted)]">({a.ownerType === "asim" ? "Asim" : "Salesman"})</span>
              </>
            }
            sub={`${a.accountTitle}, ${a.accountNumber}`}
          >
            <IconButton label={`Edit ${a.bankName} account`} onClick={() => openAccount(a)}>
              <Pencil size={14} />
            </IconButton>
            <IconButton label={`Delete ${a.bankName} account`} danger onClick={() => setDeleteAccount(a)}>
              <Trash2 size={14} />
            </IconButton>
            <Switch on={a.active} label={`${a.bankName} account on or off`} onChange={() => toggle(`/bank-accounts/${a._id}`, a)} />
          </Row>
        ))}
        {!accounts.length && <p className="text-sm text-[var(--ink-muted)] py-4 text-center">No accounts yet</p>}
      </Section>

      <Section
        title="Commission salesmen"
        hint="Earn a share of profit on their bills."
        action={
          <button className="btn-outline text-xs px-3 py-1.5" onClick={() => openAgent(null)}>
            <Plus size={14} />
            Add
          </button>
        }
      >
        {agents.map((a) => (
          <Row key={a._id} title={a.name} sub={`${a.percentage}% of profit`}>
            <IconButton label={`Edit ${a.name}`} onClick={() => openAgent(a)}>
              <Pencil size={14} />
            </IconButton>
            <IconButton label={`Delete ${a.name}`} danger onClick={() => setDeleteAgent(a)}>
              <Trash2 size={14} />
            </IconButton>
            <Switch on={a.active} label={`${a.name} on or off`} onChange={() => toggle(`/commission-agents/${a._id}`, a)} />
          </Row>
        ))}
        {!agents.length && <p className="text-sm text-[var(--ink-muted)] py-4 text-center">No commission salesmen yet</p>}
      </Section>

      <Section
        title="Logins"
        hint="Who can sign in."
        action={
          <button className="btn-outline text-xs px-3 py-1.5" onClick={() => openLogin(null)}>
            <Plus size={14} />
            Add
          </button>
        }
      >
        {users.map((u) => {
          const isMe = String(u._id) === String(me?.id);
          const on = u.active !== false;
          return (
            <Row
              key={u._id}
              title={
                <>
                  {u.name} <span className="font-normal text-[var(--ink-muted)] capitalize">({u.role}{isMe ? ", you" : ""})</span>
                </>
              }
              sub={`Username: ${u.username}`}
            >
              <IconButton label={`Change password for ${u.name}`} onClick={() => openPassword(u)}>
                <KeyRound size={14} />
              </IconButton>
              <IconButton label={`Edit ${u.name}`} onClick={() => openLogin(u)}>
                <Pencil size={14} />
              </IconButton>
              <Switch
                on={on}
                label={`${u.name} login on or off`}
                disabled={isMe}
                title={isMe ? "You can't turn off your own login" : undefined}
                onChange={() => (on ? setLoginOff(u) : quick(() => api.patch(`/auth/users/${u._id}`, { active: true })))}
              />
            </Row>
          );
        })}
      </Section>

      {/* ---------- Rice type ---------- */}
      <Modal open={addType} onClose={() => setAddType(false)} title="Add rice type">
        <form onSubmit={submitType} className="flex flex-col gap-3">
          <Field id="type-name" label="Name">
            <input
              id="type-name"
              className="field-input"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="e.g. Super Kernel"
              required
              autoFocus
            />
          </Field>
          <ErrorText>{error}</ErrorText>
          <button className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Add rice type"}
          </button>
        </form>
      </Modal>

      {/* ---------- Bank account ---------- */}
      <Modal open={!!accountModal} onClose={() => setAccountModal(null)} title={accountModal?.account ? "Edit bank account" : "Add bank account"}>
        <form onSubmit={submitAccount} className="flex flex-col gap-3">
          <div className="segmented w-full">
            {[
              { key: "asim", label: "Asim" },
              { key: "salesman", label: "Salesman" },
            ].map((o) => (
              <button
                type="button"
                key={o.key}
                className={`segmented-item flex-1 ${accountForm.ownerType === o.key ? "is-active" : ""}`}
                onClick={() => setAccountForm({ ...accountForm, ownerType: o.key })}
              >
                {o.label}
              </button>
            ))}
          </div>
          <Field id="acc-bank" label="Bank name">
            <input id="acc-bank" className="field-input" value={accountForm.bankName} onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })} placeholder="e.g. UBL" required />
          </Field>
          <Field id="acc-owner" label="Owner name">
            <input id="acc-owner" className="field-input" value={accountForm.ownerName} onChange={(e) => setAccountForm({ ...accountForm, ownerName: e.target.value })} required />
          </Field>
          <Field id="acc-title" label="Account title">
            <input id="acc-title" className="field-input" value={accountForm.accountTitle} onChange={(e) => setAccountForm({ ...accountForm, accountTitle: e.target.value })} required />
          </Field>
          <Field id="acc-number" label="Account number">
            <input id="acc-number" className="field-input" value={accountForm.accountNumber} onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="acc-iban" label="IBAN (optional)">
              <input id="acc-iban" className="field-input" value={accountForm.iban} onChange={(e) => setAccountForm({ ...accountForm, iban: e.target.value })} />
            </Field>
            <Field id="acc-branch" label="Branch code (optional)">
              <input id="acc-branch" className="field-input" value={accountForm.branchCode} onChange={(e) => setAccountForm({ ...accountForm, branchCode: e.target.value })} />
            </Field>
          </div>
          <ErrorText>{error}</ErrorText>
          <button className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : accountModal?.account ? "Save account" : "Add account"}
          </button>
        </form>
      </Modal>

      <ReasonModal
        open={!!deleteAccount}
        onClose={() => setDeleteAccount(null)}
        title={`Delete ${deleteAccount?.bankName || ""} account?`}
        confirmLabel="Delete account"
        danger
        placeholder="e.g. account closed"
        onConfirm={async (reason) => {
          await api.delete(`/bank-accounts/${deleteAccount._id}`, { data: { reason } });
          setDeleteAccount(null);
          load();
        }}
      >
        <p>Old bills and payments still show it.</p>
      </ReasonModal>

      {/* ---------- Commission salesman ---------- */}
      <Modal open={!!agentModal} onClose={() => setAgentModal(null)} title={agentModal?.agent ? "Edit commission salesman" : "Add commission salesman"}>
        <form onSubmit={submitAgent} className="flex flex-col gap-3">
          <Field id="agent-name" label="Name">
            <input id="agent-name" className="field-input" value={agentForm.name} onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })} required autoFocus />
          </Field>
          <Field id="agent-pct" label="Share of profit (%)">
            <input
              id="agent-pct"
              type="number"
              min="0"
              max="100"
              className="field-input"
              value={agentForm.percentage}
              onChange={(e) => setAgentForm({ ...agentForm, percentage: e.target.value })}
              placeholder="e.g. 30"
              required
            />
          </Field>
          {agentModal?.agent && <p className="text-xs text-[var(--ink-muted)]">A new % counts for new bills only.</p>}
          <ErrorText>{error}</ErrorText>
          <button className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : agentModal?.agent ? "Save" : "Add"}
          </button>
        </form>
      </Modal>

      <ReasonModal
        open={!!deleteAgent}
        onClose={() => setDeleteAgent(null)}
        title={`Delete ${deleteAgent?.name || ""}?`}
        confirmLabel="Delete"
        danger
        placeholder="e.g. left the job"
        onConfirm={async (reason) => {
          await api.delete(`/commission-agents/${deleteAgent._id}`, { data: { reason } });
          setDeleteAgent(null);
          load();
        }}
      >
        <p>Only when no commission is owed to them. Old bills keep their name.</p>
      </ReasonModal>

      {/* ---------- Logins ---------- */}
      <Modal open={!!loginModal} onClose={() => setLoginModal(null)} title={loginModal?.login ? "Edit login" : "Add login"}>
        <form onSubmit={submitLogin} className="flex flex-col gap-3">
          <Field id="login-name" label="Name">
            <input id="login-name" className="field-input" value={loginForm.name} onChange={(e) => setLoginForm({ ...loginForm, name: e.target.value })} required autoFocus />
          </Field>
          {!loginModal?.login && (
            <>
              <Field id="login-username" label="Username">
                <input
                  id="login-username"
                  className="field-input"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  placeholder="e.g. kashif"
                  autoComplete="off"
                  required
                />
              </Field>
              <Field id="login-password" label="Password (at least 6 characters)">
                <input
                  id="login-password"
                  type="password"
                  className="field-input"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  autoComplete="new-password"
                  required
                />
              </Field>
              <div className="segmented w-full">
                {[
                  { key: "salesman", label: "Salesman" },
                  { key: "admin", label: "Admin" },
                ].map((o) => (
                  <button
                    type="button"
                    key={o.key}
                    className={`segmented-item flex-1 ${loginForm.role === o.key ? "is-active" : ""}`}
                    onClick={() => setLoginForm({ ...loginForm, role: o.key })}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <ErrorText>{error}</ErrorText>
          <button className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : loginModal?.login ? "Save" : "Add login"}
          </button>
        </form>
      </Modal>

      <ReasonModal
        open={!!loginOff}
        onClose={() => setLoginOff(null)}
        title={`Turn off ${loginOff?.name || ""}'s login?`}
        confirmLabel="Turn off"
        danger
        reasonRequired={false}
        placeholder="e.g. left the job"
        onConfirm={async (reason) => {
          await api.patch(`/auth/users/${loginOff._id}`, { active: false, reason });
          setLoginOff(null);
          load();
        }}
      >
        <p>They are signed out and can&apos;t sign in. Their old records stay. You can turn it on again.</p>
      </ReasonModal>

      <Modal open={!!passwordTarget} onClose={() => setPasswordTarget(null)} title={`New password for ${passwordTarget?.name || ""}`}>
        {passwordTarget && (
          <form onSubmit={submitPassword} className="flex flex-col gap-3">
            <Field id="new-password" label="New password (at least 6 characters)">
              <input
                id="new-password"
                type="password"
                className="field-input"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                autoComplete="new-password"
                required
                autoFocus
              />
            </Field>
            <Field id="confirm-password" label="New password again">
              <input
                id="confirm-password"
                type="password"
                className="field-input"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                autoComplete="new-password"
                required
              />
            </Field>
            <Field id="admin-password" label="Your own current password">
              <input
                id="admin-password"
                type="password"
                className="field-input"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                autoComplete="current-password"
                required
              />
            </Field>
            <ErrorText>{error}</ErrorText>
            <button className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Change password"}
            </button>
          </form>
        )}
      </Modal>

      <RenameRiceTypeModal riceType={renameType} onClose={() => setRenameType(null)} onDone={load} />
      <DeleteRiceTypeModal riceType={deleteType} onClose={() => setDeleteType(null)} onDone={load} />
    </div>
  );
};

export default Settings;

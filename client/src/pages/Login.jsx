import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import Footer from "../components/Footer.jsx";
import BrandMark from "../components/BrandMark.jsx";
import api from "../api/axios.js";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    document.title = "Sign in | Chief Rice Trader";
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(username, password);
      navigate(user.role === "admin" ? "/admin" : "/salesman");
    } catch (err) {
      setError(err?.response?.data?.message || "Could not log in. Check your username and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] px-4">
      <div className="flex-1 flex items-center justify-center py-10">
        <div className="w-full max-w-[380px]">
          <div className="flex items-center gap-2.5 mb-8">
            <BrandMark className="h-9 w-9" />
            <div className="leading-tight">
              <p className="font-semibold tracking-tight">Chief Rice Trader</p>
              <p className="text-xs text-[var(--ink-muted)]">Rice wholesale &amp; retail</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grain-card p-6 sm:p-7">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--ink)]">Sign in</h1>
            <p className="text-sm text-[var(--ink-muted)] mt-1 mb-6">Use the username and password for your panel.</p>

            <label className="field-label" htmlFor="login-username">
              Username
            </label>
            <input
              id="login-username"
              className="field-input mb-4"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              required
            />

            <label className="field-label" htmlFor="login-password">
              Password
            </label>
            <div className="relative mb-5">
              <input
                id="login-password"
                className="field-input pr-10"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 grid place-items-center text-[var(--ink-faint)] hover:text-[var(--ink)]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {error && (
              <p className="mb-4 text-sm text-[var(--neg-ink)] bg-[var(--neg-tint)] rounded-lg px-3 py-2">{error}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Signing in..." : "Sign in"}
            </button>

            <button
              type="button"
              onClick={() => setShowReset(true)}
              className="mt-4 text-sm text-[var(--accent-ink)] hover:underline"
            >
              Change password
            </button>
          </form>
        </div>
      </div>

      <Footer />

      <ResetPasswordModal open={showReset} onClose={() => setShowReset(false)} />
    </div>
  );
};

const ResetPasswordModal = ({ open, onClose }) => {
  const [username, setUsername] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setUsername("");
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword.length < 6) {
      setError("New password should be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match");
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/reset-password", { username, oldPassword, newPassword });
      setSuccess("Password changed. You can sign in with the new password now.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err?.response?.data?.message || "Could not change the password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Change password">
      <p className="text-sm text-[var(--ink-muted)] mb-4">
        Enter your current password, then choose a new one. If you've forgotten your current password,
        ask Asim (admin) to reset it in the database.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="field-label">Username</label>
          <input className="field-input" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div>
          <label className="field-label">Current password</label>
          <input
            type="password"
            className="field-input"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="field-label">New password</label>
          <input
            type="password"
            className="field-input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="field-label">Confirm new password</label>
          <input
            type="password"
            className="field-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-[var(--color-terracotta-deep)]">{error}</p>}
        {success && <p className="text-sm text-[var(--color-sage-deep)]">{success}</p>}
        <button className="btn-primary mt-1" disabled={saving}>
          {saving ? "Changing..." : "Change password"}
        </button>
      </form>
    </Modal>
  );
};

export default Login;

import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import Footer from "./Footer.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import BrandMark from "./BrandMark.jsx";

const initialsOf = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

// Profile picture per role (same pictures as before), with initials if the image can't load.
const avatarFor = (role) => (role === "admin" ? "/assets/admin.jpg" : "/assets/salesman.png");

const Avatar = ({ user, className = "h-9 w-9" }) => {
  const [failed, setFailed] = useState(false);
  if (failed || !user) {
    return (
      <span
        className={`${className} shrink-0 rounded-full bg-[var(--accent-tint)] text-[var(--accent-ink)] grid place-items-center text-xs font-semibold`}
      >
        {initialsOf(user?.name)}
      </span>
    );
  }
  return (
    <img
      src={avatarFor(user.role)}
      alt={user.name}
      onError={() => setFailed(true)}
      className={`${className} shrink-0 rounded-full object-cover border border-[var(--line)] bg-[var(--surface)]`}
    />
  );
};

// The nav item that best matches the current URL (detail pages fall under their list page).
const findCurrent = (items, pathname) =>
  items
    .filter((i) => (i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(`${i.to}/`)))
    .sort((a, b) => b.to.length - a.to.length)[0];

const Layout = ({ panel, navGroups, children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const current = findCurrent(
    navGroups.flatMap((g) => g.items),
    location.pathname
  );

  useEffect(() => {
    document.title = current ? `${current.label} | Chief Rice Trader` : "Chief Rice Trader";
  }, [current]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const sidebar = (
    <SidebarContent
      panel={panel}
      navGroups={navGroups}
      user={user}
      theme={theme}
      onToggleTheme={toggleTheme}
      onLogout={handleLogout}
      onNavigate={() => setOpen(false)}
    />
  );

  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      <aside className="hidden md:block w-64 shrink-0 border-r border-[var(--line)] bg-[var(--surface)]">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-[var(--overlay)]" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-[var(--surface)] border-r border-[var(--line)] shadow-[var(--shadow-pop)]">
            <button
              className="icon-btn absolute right-2 top-3"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-3">
          <div className="flex items-center gap-2 min-w-0">
            <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <p className="text-[0.95rem] font-semibold tracking-tight truncate">{current?.label || panel}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              className="icon-btn"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Avatar user={user} className="h-8 w-8" />
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1320px] mx-auto px-4 py-5 sm:px-8 sm:py-8 flex flex-col">
          <div className="flex-1">
            <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
};

const SidebarContent = ({ panel, navGroups, user, theme, onToggleTheme, onLogout, onNavigate }) => (
  <div className="flex h-full flex-col">
    <div className="flex items-center gap-2.5 px-5 h-16 shrink-0">
      <BrandMark className="h-8 w-8 shrink-0" />
      <div className="leading-tight min-w-0">
        <p className="text-[0.95rem] font-semibold tracking-tight truncate">Chief Rice Trader</p>
        <p className="text-xs text-[var(--ink-muted)]">{panel}</p>
      </div>
    </div>

    <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-2" aria-label="Main">
      {navGroups.map((group, gi) => (
        <div key={group.label || gi} className={gi > 0 ? "mt-5" : ""}>
          {group.label && <p className="px-2.5 mb-1.5 text-xs text-[var(--ink-faint)]">{group.label}</p>}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    {item.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>

    <div className="shrink-0 border-t border-[var(--line)] p-3 flex items-center gap-2.5">
      <Avatar user={user} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-sm font-medium truncate">{user?.name}</p>
        <p className="text-xs text-[var(--ink-muted)] capitalize">{user?.role}</p>
      </div>
      <button
        className="icon-btn hidden md:inline-grid"
        onClick={onToggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={theme === "dark" ? "Light mode" : "Dark mode"}
      >
        {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      <button className="icon-btn" onClick={onLogout} aria-label="Log out" title="Log out">
        <LogOut size={17} />
      </button>
    </div>
  </div>
);

export default Layout;

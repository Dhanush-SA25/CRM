import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  Bell,
  LogOut,
  User,
  Search,
  ChevronRight,
  ChevronDown,
  Plus,
  Users,
  UserPlus,
  TrendingUp,
  CalendarClock,
  CheckSquare,
  Wifi,
  WifiOff,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useServerStatus } from "../../hooks/useServerStatus";
import { insightService } from "../../services/insightService";
import CommandPalette from "./CommandPalette";
import { timeAgo, capitalize } from "../../utils/formatters";

const ROUTE_LABELS = {
  "/dashboard": "Overview",
  "/customers": "Customers",
  "/leads": "Leads",
  "/deals": "Sales pipeline",
  "/followups": "Follow-ups",
  "/tasks": "Tasks",
  "/activities": "Activities",
  "/admin/users": "User administration",
  "/admin/employees": "Employees",
  "/admin/targets": "Sales targets",
};

const QUICK_CREATE = [
  { to: "/customers?new=1", icon: Users, label: "New customer" },
  { to: "/leads?new=1", icon: UserPlus, label: "New lead" },
  { to: "/deals?new=1", icon: TrendingUp, label: "New deal" },
  { to: "/followups?new=1", icon: CalendarClock, label: "New follow-up" },
  { to: "/tasks?new=1", icon: CheckSquare, label: "New task" },
];

const SEVERITY_META = {
  high: { icon: AlertCircle, chip: "text-red-600 bg-red-50 ring-red-100" },
  warning: { icon: AlertTriangle, chip: "text-amber-600 bg-amber-50 ring-amber-100" },
  info: { icon: Info, chip: "text-sky-600 bg-sky-50 ring-sky-100" },
  success: { icon: CheckCircle2, chip: "text-emerald-600 bg-emerald-50 ring-emerald-100" },
};

export default function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { status, lastChecked, recheck } = useServerStatus();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifData, setNotifData] = useState(null);
  const [notifLoading, setNotifLoading] = useState(false);

  const currentLabel =
    ROUTE_LABELS[location.pathname] ??
    (location.pathname.startsWith("/activities/") ? "Activities" : "Workspace");

  // Global ⌘K / Ctrl+K shortcut for search
  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    let cancelled = false;
    setNotifLoading(true);
    insightService
      .notifications()
      .then((data) => {
        if (!cancelled) setNotifData(data);
      })
      .catch(() => {
        if (!cancelled) setNotifData(null);
      })
      .finally(() => {
        if (!cancelled) setNotifLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notifOpen]);

  const statusMeta = {
    checking: { label: "Checking API", dot: "bg-amber-400", icon: Loader2, spin: true },
    online: { label: "Connected", dot: "bg-emerald-500", icon: Wifi, spin: false },
    offline: { label: "Backend offline", dot: "bg-red-500", icon: WifiOff, spin: false },
  }[status];

  const notifications = notifData?.notifications ?? [];
  const notifTotal = notifData?.total ?? 0;
  const notifCounts = notifData?.counts ?? {};

  function go(to) {
    setQuickOpen(false);
    setUserMenuOpen(false);
    navigate(to);
  }

  function refreshNotifications() {
    setNotifLoading(true);
    insightService
      .notifications()
      .then(setNotifData)
      .catch(() => setNotifData(null))
      .finally(() => setNotifLoading(false));
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
        {/* Left — mobile menu + breadcrumbs */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onMenuClick}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            <Link
              to="/dashboard"
              className="hidden text-slate-400 transition hover:text-slate-700 sm:block"
            >
              Workspace
            </Link>
            <ChevronRight size={13} className="hidden text-slate-300 sm:block" />
            <span className="truncate font-medium text-slate-800">{currentLabel}</span>
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Global search trigger */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="group hidden h-9 w-56 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 text-left text-sm text-slate-400 shadow-sm transition hover:border-slate-300 hover:bg-white md:flex xl:w-72"
          >
            <Search size={15} />
            <span className="flex-1 truncate">Search workspace…</span>
            <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              ⌘K
            </kbd>
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 md:hidden"
            aria-label="Search"
          >
            <Search size={18} />
          </button>

          {/* Live API status */}
          <button
            type="button"
            onClick={recheck}
            title={
              lastChecked
                ? `API ${status} · last check ${lastChecked.toLocaleTimeString()}`
                : "Checking API connection"
            }
            className={[
              "hidden items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition lg:flex",
              status === "online"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : status === "offline"
                  ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
            ].join(" ")}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
            {statusMeta.label}
          </button>

          {/* Quick create */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setQuickOpen((v) => !v)}
              className="btn-primary h-9 px-2.5 sm:px-3"
              aria-label="Quick create"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Create</span>
            </button>
            {quickOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setQuickOpen(false)} aria-hidden="true" />
                <div className="absolute right-0 z-20 mt-2 w-52 animate-slide-up overflow-hidden rounded-xl border border-slate-200 bg-white/95 py-1.5 shadow-card-hover backdrop-blur-xl">
                  <p className="eyebrow px-3 pb-1 pt-1.5">Quick create</p>
                  {QUICK_CREATE.map(({ to, icon: Icon, label }) => (
                    <button
                      key={to}
                      type="button"
                      onClick={() => go(to)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      <Icon size={15} className="text-slate-400" />
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {notifTotal > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                  {notifTotal > 9 ? "9+" : notifTotal}
                </span>
              )}
            </button>
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} aria-hidden="true" />
                <div className="absolute right-0 z-20 mt-2 w-[22rem] animate-slide-up overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-card-hover backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Notifications</p>
                      <p className="text-[11px] text-slate-400">
                        Derived from your live records
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {notifCounts.high > 0 && (
                        <span className="badge-red">{notifCounts.high} urgent</span>
                      )}
                      <button
                        type="button"
                        onClick={refreshNotifications}
                        disabled={notifLoading}
                        aria-label="Refresh notifications"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                      >
                        <RefreshCw
                          size={14}
                          className={notifLoading ? "animate-spin" : ""}
                        />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifLoading ? (
                      <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-400">
                        <Loader2 size={14} className="animate-spin" /> Loading…
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <CheckCircle2 size={22} className="mx-auto text-emerald-500" />
                        <p className="mt-2 text-sm font-medium text-slate-600">
                          You are all caught up
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          No overdue work or deals needing attention.
                        </p>
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const meta = SEVERITY_META[n.severity] ?? SEVERITY_META.info;
                        const Icon = meta.icon;
                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              setNotifOpen(false);
                              navigate(n.to);
                            }}
                            className="flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition last:border-0 hover:bg-slate-50"
                          >
                            <span
                              className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ring-1 ${meta.chip}`}
                            >
                              <Icon size={14} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-700">
                                {n.title}
                              </span>
                              <span className="block truncate text-[11px] text-slate-500">
                                {n.message}
                              </span>
                              <span className="block text-[10px] text-slate-400">
                                {capitalize(n.severity)} · {timeAgo(n.timestamp)}
                              </span>
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNotifOpen(false);
                      navigate("/dashboard");
                    }}
                    className="flex w-full items-center justify-center gap-1 border-t border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Open dashboard
                    <ChevronRight size={13} />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl px-1.5 py-1.5 transition hover:bg-slate-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-[11px] font-semibold text-white shadow-sm">
                {(user?.name ?? "U")
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block max-w-[120px] truncate text-sm font-medium leading-tight text-slate-800">
                  {user?.name}
                </span>
                <span className="block text-[11px] capitalize leading-tight text-slate-400">
                  {user?.role}
                </span>
              </span>
              <ChevronDown size={14} className="hidden text-slate-400 sm:block" />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} aria-hidden="true" />
                <div className="absolute right-0 z-20 mt-2 w-60 animate-slide-up overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-card-hover backdrop-blur-xl">
                  <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gradient text-white">
                      <User size={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{user?.name}</p>
                      <p className="truncate text-xs text-slate-400">{user?.email}</p>
                    </div>
                  </div>
                  <div className="px-4 py-2.5">
                    <span className="badge-ink capitalize">{user?.role}</span>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </header>
  );
}

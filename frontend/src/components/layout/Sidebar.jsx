import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  TrendingUp,
  Activity,
  CalendarClock,
  CheckSquare,
  Shield,
  X,
  Zap,
  PanelLeftClose,
  PanelLeftOpen,
  ContactRound,
  Target,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const NAV_GROUPS = [
  {
    label: "Workspace",
    items: [{ to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" }],
  },
  {
    label: "Sales",
    items: [
      { to: "/customers", icon: Users, label: "Customers" },
      { to: "/leads", icon: UserPlus, label: "Leads" },
      { to: "/deals", icon: TrendingUp, label: "Sales pipeline" },
      { to: "/followups", icon: CalendarClock, label: "Follow-ups" },
      { to: "/tasks", icon: CheckSquare, label: "Tasks" },
      { to: "/activities", icon: Activity, label: "Activities" },
    ],
  },
];

const ADMIN_ITEMS = [
  { to: "/admin/users", icon: Shield, label: "User administration" },
  { to: "/admin/employees", icon: ContactRound, label: "Employee directory" },
  { to: "/admin/targets", icon: Target, label: "Sales targets" },
];

function NavItem({ to, icon: Icon, label, collapsed }) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        [
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
          collapsed ? "lg:justify-center lg:px-0" : "",
          isActive
            ? "bg-brand-gradient text-white shadow-sm shadow-slate-900/20"
            : "text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900",
        ].join(" ")
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={18} className="flex-shrink-0" />
          <span className={collapsed ? "truncate lg:hidden" : "truncate"}>{label}</span>
          {collapsed && (
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 lg:block">
              {label}
            </span>
          )}
          {isActive && !collapsed && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/80" aria-hidden="true" />
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ open, onClose, collapsed = false, onToggleCollapse }) {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const groups = isAdmin
    ? [...NAV_GROUPS, { label: "Administration", items: ADMIN_ITEMS }]
    : NAV_GROUPS;

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200/70 bg-white/85 backdrop-blur-xl transition-[transform,width] duration-200 lg:static lg:translate-x-0",
          collapsed ? "lg:w-[76px]" : "lg:w-64",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Brand */}
        <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-100 px-4">
          <div
            className={[
              "flex w-full items-center gap-2.5",
              collapsed ? "lg:w-auto lg:justify-center" : "",
            ].join(" ")}
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-gradient shadow-sm shadow-slate-900/25">
              <Zap size={16} className="text-white" />
            </div>
            <div className={collapsed ? "lg:hidden" : ""}>
              <span className="block text-[15px] font-semibold leading-tight text-ink">
                SmartCRM
              </span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
                Revenue workspace
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {groups.map((group) => (
            <div key={group.label}>
              <p
                className={[
                  "px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400",
                  collapsed ? "lg:hidden" : "",
                ].join(" ")}
              >
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavItem key={item.to} {...item} collapsed={collapsed} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-100 px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className={collapsed ? "lg:hidden" : ""}>
              <p className="text-[11px] font-medium text-slate-500">SmartCRM v1.0.0</p>
              <p className="text-[10px] text-slate-400">Professional edition</p>
            </div>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 lg:flex"
              >
                {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

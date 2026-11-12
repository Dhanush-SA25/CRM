import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Search,
  LayoutDashboard,
  Users,
  UserPlus,
  TrendingUp,
  CalendarClock,
  CheckSquare,
  Activity,
  Shield,
  Plus,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
} from "lucide-react";
import { useDebounce } from "../../hooks/useDebounce";
import { useAuth } from "../../context/AuthContext";
import { insightService } from "../../services/insightService";

const NAV_COMMANDS = [
  { label: "Dashboard", hint: "Overview and analytics", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Customers", hint: "Accounts and contacts", icon: Users, to: "/customers" },
  { label: "Leads", hint: "Prospects and conversion", icon: UserPlus, to: "/leads" },
  { label: "Sales pipeline", hint: "Deals and stages", icon: TrendingUp, to: "/deals" },
  { label: "Follow-ups", hint: "Scheduled touchpoints", icon: CalendarClock, to: "/followups" },
  { label: "Tasks", hint: "Work to be done", icon: CheckSquare, to: "/tasks" },
  { label: "Activities", hint: "Unified timeline", icon: Activity, to: "/activities" },
];

const ADMIN_COMMANDS = [
  { label: "User administration", hint: "Manage workspace users", icon: Shield, to: "/admin/users" },
  { label: "Employees", hint: "Directory and CSV import", icon: Users, to: "/admin/employees" },
  { label: "Sales targets", hint: "Quarterly target vs achievement", icon: TrendingUp, to: "/admin/targets" },
];

const RECORD_GROUPS = [
  { key: "customers", label: "Customers", icon: Users },
  { key: "leads", label: "Leads", icon: UserPlus },
  { key: "deals", label: "Deals", icon: TrendingUp },
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "followups", label: "Follow-ups", icon: CalendarClock },
  { key: "employees", label: "Employees", icon: Users },
];

const EMPTY_RESULTS = {
  customers: [],
  leads: [],
  deals: [],
  tasks: [],
  followups: [],
  employees: [],
};

const CREATE_COMMANDS = [
  { label: "New customer", hint: "Create an account", icon: Users, to: "/customers?new=1" },
  { label: "New lead", hint: "Add a prospect", icon: UserPlus, to: "/leads?new=1" },
  { label: "New deal", hint: "Add to the pipeline", icon: TrendingUp, to: "/deals?new=1" },
  { label: "New follow-up", hint: "Schedule a touchpoint", icon: CalendarClock, to: "/followups?new=1" },
  { label: "New task", hint: "Create a task", icon: CheckSquare, to: "/tasks?new=1" },
];

function matches(command, query) {
  return (
    command.label.toLowerCase().includes(query) ||
    (command.hint ?? "").toLowerCase().includes(query)
  );
}

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 220);
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const { role } = useAuth();

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults(EMPTY_RESULTS);
    setActive(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Search records once the user has typed enough.
  useEffect(() => {
    if (!open) return;
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setResults(EMPTY_RESULTS);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    insightService
      .search(q)
      .then((data) => {
        if (cancelled) return;
        setResults({ ...EMPTY_RESULTS, ...(data?.results ?? {}) });
        setActive(0);
      })
      .catch(() => {
        if (!cancelled) setResults(EMPTY_RESULTS);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const nav = role === "admin" ? [...NAV_COMMANDS, ...ADMIN_COMMANDS] : NAV_COMMANDS;

    if (!q) {
      return [
        { label: "Navigate", items: nav.map((c) => ({ ...c, key: `nav-${c.to}` })) },
        { label: "Create", items: CREATE_COMMANDS.map((c) => ({ ...c, key: `create-${c.to}` })) },
      ];
    }

    const commandItems = [...nav, ...CREATE_COMMANDS]
      .filter((c) => matches(c, q))
      .map((c) => ({ ...c, key: `cmd-${c.to}-${c.label}` }));

    const recordGroups = RECORD_GROUPS.map(({ key, label, icon }) => ({
      label,
      items: (results[key] ?? []).map((item) => ({
        key: `${key}-${item.id}`,
        label: item.label,
        hint: [item.subtitle, item.meta].filter(Boolean).join(" · "),
        icon,
        to: item.to,
      })),
    })).filter((group) => group.items.length > 0);

    return [
      ...(commandItems.length ? [{ label: "Actions", items: commandItems }] : []),
      ...recordGroups,
    ];
  }, [query, results, role]);

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    if (active >= flatItems.length) setActive(0);
  }, [flatItems.length, active]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      document.getElementById(`cmdk-item-${active}`)?.scrollIntoView({ block: "nearest" });
    }, 0);
    return () => window.clearTimeout(id);
  }, [active, open]);

  if (!open) return null;

  const total = flatItems.length;
  const empty = query.trim().length >= 2 && !searching && total === 0;

  function choose(item) {
    if (!item) return;
    onClose();
    navigate(item.to);
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (total ? (i + 1) % total : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (total ? (i - 1 + total) % total : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(flatItems[active]);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] p-4">
      <div
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="relative mx-auto mt-[10vh] w-full max-w-xl animate-slide-up overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-lift backdrop-blur-xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search size={18} className="text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search customers, leads, deals, tasks, or jump to a page…"
            aria-label="Search"
            className="h-14 flex-1 bg-transparent text-sm text-ink placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:block">
            ESC
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {searching && (
            <p className="px-3 py-2 text-xs text-slate-400">Searching workspace…</p>
          )}

          {groups.map((group) => {
            let itemIndex = -1;
            return (
              <div key={group.label} className="pb-1">
                <p className="eyebrow px-3 pb-1 pt-2">{group.label}</p>
                {group.items.map((item) => {
                  itemIndex = flatItems.findIndex((x) => x.key === item.key);
                  const isActive = itemIndex === active;
                  const Icon = item.icon ?? Plus;
                  return (
                    <button
                      key={item.key}
                      id={`cmdk-item-${itemIndex}`}
                      type="button"
                      onMouseEnter={() => setActive(itemIndex)}
                      onClick={() => choose(item)}
                      className={[
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                        isActive
                          ? "bg-slate-100/90 ring-1 ring-inset ring-slate-200"
                          : "hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {item.label}
                        </span>
                        {item.hint && (
                          <span className="block truncate text-xs text-slate-400">
                            {item.hint}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}

          {empty && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-slate-600">No matches found</p>
              <p className="mt-1 text-xs text-slate-400">
                Try a customer name, company, lead email, deal title, task or follow-up.
              </p>
            </div>
          )}

          {!query.trim() && (
            <p className="px-3 py-2 text-[11px] text-slate-400">
              Tip: use the Create actions to open a module with its form ready.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-white/70 px-4 py-2.5 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <ArrowUp size={11} />
            <ArrowDown size={11} />
            to navigate
          </span>
          <span className="flex items-center gap-1.5">
            <CornerDownLeft size={11} />
            to open
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

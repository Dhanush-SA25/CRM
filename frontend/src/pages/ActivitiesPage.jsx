import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Activity as ActivityIcon,
  Phone,
  Mail,
  Users,
  FileText,
  CheckSquare,
  Plus,
  Trash2,
  Search,
  X,
  Pencil,
  CheckCircle2,
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useDebounce } from "../hooks/useDebounce";
import { activityService } from "../services/activityService";
import PageHeader from "../components/ui/PageHeader";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import Pagination from "../components/ui/Pagination";
import ExportButton from "../components/ui/ExportButton";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { formatDate, capitalize } from "../utils/formatters";

const PER_PAGE = 20;

const TYPE_LABELS = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
  task: "Other",
};

const TYPE_SECTIONS = {
  call: "calls",
  email: "emails",
  meeting: "meetings",
  note: "notes",
  task: "other",
};

const SECTIONS = [
  { key: "all", label: "All", type: "", icon: ActivityIcon },
  { key: "calls", label: "Calls", type: "call", icon: Phone },
  { key: "emails", label: "Emails", type: "email", icon: Mail },
  { key: "meetings", label: "Meetings", type: "meeting", icon: Users },
  { key: "notes", label: "Notes", type: "note", icon: FileText },
  { key: "other", label: "Other", type: "task", icon: CheckSquare },
];

const SECTION_DESCRIPTIONS = {
  all: "Every call, email, meeting, note and other interaction in one timeline.",
  calls: "Logged calls with customers, leads and deals.",
  emails: "Email history recorded in the CRM. SmartCRM does not send emails.",
  meetings: "Scheduled and completed meetings.",
  notes: "Notes attached to customers, leads and deals.",
  other: "Other recorded activities and tasks.",
};

const ACTIVITY_ICONS = {
  call: { icon: Phone, color: "text-slate-700  bg-slate-100  ring-slate-200" },
  email: { icon: Mail, color: "text-sky-700    bg-sky-50     ring-sky-100" },
  meeting: { icon: Users, color: "text-amber-700  bg-amber-50   ring-amber-100" },
  note: { icon: FileText, color: "text-slate-600  bg-slate-100  ring-slate-200" },
  task: { icon: CheckSquare, color: "text-emerald-700 bg-emerald-50 ring-emerald-100" },
};

const STATUS_BADGES = {
  completed: "badge-green",
  pending: "badge-yellow",
  cancelled: "badge-gray",
};

const EMPTY_FORM = {
  type: "call",
  title: "",
  customer_id: "",
  lead_id: "",
  deal_id: "",
  employee_id: "",
  due_date: "",
  status: "completed",
  description: "",
  outcome: "",
  duration_minutes: "",
  direction: "sent",
  recipient: "",
  participants: "",
  location: "",
};

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : DATE_TIME_FORMAT.format(date);
}

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function formFromActivity(activity) {
  return {
    type: activity.type || "call",
    title: activity.title ?? "",
    customer_id: activity.customer_id ? String(activity.customer_id) : "",
    lead_id: activity.lead_id ? String(activity.lead_id) : "",
    deal_id:
      activity.linked_type === "deal" && activity.linked_id
        ? String(activity.linked_id)
        : "",
    employee_id: activity.employee_id ? String(activity.employee_id) : "",
    due_date: toLocalInput(activity.due_date),
    status: activity.status || (activity.completed ? "completed" : "pending"),
    description: activity.description ?? "",
    outcome: activity.outcome ?? "",
    duration_minutes:
      activity.duration_minutes === null || activity.duration_minutes === undefined
        ? ""
        : String(activity.duration_minutes),
    direction: activity.direction || "sent",
    recipient: activity.recipient ?? "",
    participants: activity.participants ?? "",
    location: activity.location ?? "",
  };
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="card flex items-start gap-4">
          <div className="skeleton h-9 w-9 rounded-xl" />
          <div className="flex-1">
            <div className="skeleton h-4 w-1/3" />
            <div className="mt-2 skeleton h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Detail({ label, children, full = false }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-slate-700">
        {children || "—"}
      </dd>
    </div>
  );
}

export default function ActivitiesPage() {
  const { section } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const activeSection =
    SECTIONS.find((item) => item.key === section) ?? SECTIONS[0];

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [employeeId, setEmployeeId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const fetchActivities = useCallback(
    () =>
      activityService.list({
        type: activeSection.type || undefined,
        search: debouncedSearch.trim() || undefined,
        employee_id: employeeId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
        per_page: PER_PAGE,
      }),
    [activeSection.type, debouncedSearch, employeeId, dateFrom, dateTo, page]
  );
  const { data, loading, error, refetch } = useApi(fetchActivities, [
    fetchActivities,
  ]);

  const fetchOptions = useCallback(() => activityService.options(), []);
  const { data: options } = useApi(fetchOptions, [fetchOptions]);

  const activities = useMemo(() => data?.activities ?? [], [data]);
  const counts = data?.counts ?? {};
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 0;

  const customerById = useMemo(
    () =>
      Object.fromEntries(
        (options?.customers ?? []).map((customer) => [customer.id, customer])
      ),
    [options]
  );
  const leadById = useMemo(
    () => Object.fromEntries((options?.leads ?? []).map((lead) => [lead.id, lead])),
    [options]
  );
  const dealById = useMemo(
    () => Object.fromEntries((options?.deals ?? []).map((deal) => [deal.id, deal])),
    [options]
  );
  const employeeById = useMemo(
    () =>
      Object.fromEntries(
        (options?.employees ?? []).map((employee) => [employee.id, employee])
      ),
    [options]
  );

  const [modalMode, setModalMode] = useState(null);
  const [activeActivity, setActiveActivity] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState(null);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const hasFilters = Boolean(
    debouncedSearch.trim() || employeeId || dateFrom || dateTo
  );

  useEffect(() => {
    setPage(1);
  }, [activeSection.key, debouncedSearch, employeeId, dateFrom, dateTo]);

  useEffect(() => {
    if (!data) return;
    if (data.total === 0 && page !== 1) setPage(1);
    else if (data.pages && page > data.pages) setPage(data.pages);
  }, [data, page]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  // Deep link from global search: /activities?focus=<id>
  const focusId = Number(searchParams.get("focus")) || null;
  const focusedRef = useRef(null);
  useEffect(() => {
    if (!focusId || focusedRef.current === focusId) return;
    focusedRef.current = focusId;
    activityService
      .get(focusId)
      .then((activity) => {
        setActiveActivity(activity);
        setModalMode("view");
      })
      .catch(() => {});
  }, [focusId]);

  function openCreate() {
    setForm({
      ...EMPTY_FORM,
      type: activeSection.type || "call",
      status: "completed",
      direction: "sent",
    });
    setActiveActivity(null);
    setFormError("");
    setModalMode("create");
  }

  function openView(activity) {
    setActiveActivity(activity);
    setFormError("");
    setModalMode("view");
  }

  function openEdit(activity) {
    setActiveActivity(activity);
    setForm(formFromActivity(activity));
    setFormError("");
    setModalMode("edit");
  }

  function closeModal() {
    if (submitting) return;
    setModalMode(null);
    setActiveActivity(null);
    setFormError("");
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function buildPayload() {
    const type = form.type;
    return {
      type,
      title: form.title.trim(),
      description: form.description.trim() ? form.description : null,
      due_date: form.due_date || null,
      status: form.status,
      customer_id: form.customer_id ? Number(form.customer_id) : null,
      lead_id: form.lead_id ? Number(form.lead_id) : null,
      linked_type: form.deal_id ? "deal" : null,
      linked_id: form.deal_id ? Number(form.deal_id) : null,
      employee_id: form.employee_id ? Number(form.employee_id) : null,
      outcome: type === "call" && form.outcome.trim() ? form.outcome.trim() : null,
      duration_minutes:
        type === "call" && form.duration_minutes !== ""
          ? Number(form.duration_minutes)
          : null,
      direction: type === "email" ? form.direction : null,
      recipient:
        type === "email" && form.recipient.trim() ? form.recipient.trim() : null,
      participants:
        type === "meeting" && form.participants.trim()
          ? form.participants.trim()
          : null,
      location:
        type === "meeting" && form.location.trim() ? form.location.trim() : null,
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    if (!form.title.trim()) {
      setFormError("Subject or title is required.");
      return;
    }
    if (
      form.type === "call" &&
      form.duration_minutes !== "" &&
      (Number.isNaN(Number(form.duration_minutes)) ||
        Number(form.duration_minutes) < 0 ||
        Number(form.duration_minutes) > 1440)
    ) {
      setFormError("Duration must be between 0 and 1440 minutes.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    const payload = buildPayload();
    try {
      if (modalMode === "edit" && activeActivity) {
        await activityService.update(activeActivity.id, payload);
        setNotice({ tone: "success", message: "Activity updated." });
      } else {
        await activityService.create(payload);
        setNotice({ tone: "success", message: "Activity created." });
        if (activeSection.type && activeSection.type !== payload.type) {
          navigate(`/activities/${TYPE_SECTIONS[payload.type]}`);
        }
      }
      setModalMode(null);
      setActiveActivity(null);
      refetch();
    } catch (err) {
      setFormError(err?.response?.data?.error ?? "Failed to save activity.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestDelete(activity) {
    setDeleteError("");
    setPendingDelete(activity);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await activityService.delete(pendingDelete.id);
      setPendingDelete(null);
      setModalMode(null);
      setActiveActivity(null);
      setNotice({ tone: "success", message: "Activity deleted." });
      refetch();
    } catch (err) {
      setDeleteError(err?.response?.data?.error ?? "Failed to delete activity.");
    } finally {
      setDeleting(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setEmployeeId("");
    setDateFrom("");
    setDateTo("");
  }

  function linkedLabel(activity) {
    if (activity.linked_type === "deal") {
      return dealById[activity.linked_id]?.title;
    }
    if (activity.linked_type === "customer" || activity.customer_id) {
      return customerById[activity.customer_id ?? activity.linked_id]?.name;
    }
    if (activity.linked_type === "lead" || activity.lead_id) {
      return leadById[activity.lead_id ?? activity.linked_id]?.name;
    }
    return null;
  }

  function viewDetails(activity) {
    const employee = employeeById[activity.employee_id];
    const customer = customerById[activity.customer_id];
    const lead = leadById[activity.lead_id];
    const deal =
      activity.linked_type === "deal" ? dealById[activity.linked_id] : null;
    const meta = ACTIVITY_ICONS[activity.type] ?? ACTIVITY_ICONS.note;
    const Icon = meta.icon;

    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${meta.color}`}
          >
            <Icon size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-ink">{activity.title}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{TYPE_LABELS[activity.type] ?? capitalize(activity.type)}</span>
              <span className={`badge ${STATUS_BADGES[activity.status] ?? "badge-gray"}`}>
                {capitalize(activity.status ?? "pending")}
              </span>
            </div>
          </div>
        </div>

        <dl className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <Detail label={activity.due_date ? "Date & time" : "Logged on"}>
            {activity.due_date
              ? formatDateTime(activity.due_date)
              : formatDate(activity.created_at)}
          </Detail>
          <Detail label="Assigned employee">
            {employee?.name ?? (activity.employee_id ? `#${activity.employee_id}` : null)}
          </Detail>
          <Detail label="Customer">
            {customer?.name ??
              (activity.customer_id ? `#${activity.customer_id}` : null)}
          </Detail>
          <Detail label="Lead">
            {lead?.name ?? (activity.lead_id ? `#${activity.lead_id}` : null)}
          </Detail>
          <Detail label="Deal">
            {deal?.title ??
              (activity.linked_type === "deal" ? `#${activity.linked_id}` : null)}
          </Detail>
          {activity.type === "email" && (
            <>
              <Detail label="Direction">
                {activity.direction ? capitalize(activity.direction) : null}
              </Detail>
              <Detail label="Recipient">{activity.recipient}</Detail>
            </>
          )}
          {activity.type === "call" && (
            <>
              <Detail label="Duration">
                {activity.duration_minutes !== null &&
                activity.duration_minutes !== undefined
                  ? `${activity.duration_minutes} minutes`
                  : null}
              </Detail>
              <Detail label="Outcome">{activity.outcome}</Detail>
            </>
          )}
          {activity.type === "meeting" && (
            <>
              <Detail label="Participants">{activity.participants}</Detail>
              <Detail label="Location or link">{activity.location}</Detail>
            </>
          )}
          <Detail label="Description or notes" full>
            <span className="whitespace-pre-wrap">{activity.description}</span>
          </Detail>
        </dl>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" className="btn-secondary" onClick={closeModal}>
            Close
          </button>
          <button
            type="button"
            className="btn-secondary flex items-center gap-2"
            onClick={() => openEdit(activity)}
          >
            <Pencil size={15} />
            Edit
          </button>
          <button
            type="button"
            className="btn-danger flex items-center gap-2"
            onClick={() => {
              setModalMode(null);
              requestDelete(activity);
            }}
          >
            <Trash2 size={15} />
            Delete
          </button>
        </div>
      </div>
    );
  }

  const modalTitles = {
    create: "Add Activity",
    edit: "Edit Activity",
    view: "Activity details",
  };

  return (
    <div>
      <PageHeader
        title="Activities"
        description={SECTION_DESCRIPTIONS[activeSection.key]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton
              resource="activities"
              params={{ search: debouncedSearch, type: activeSection.type || undefined }}
            />
            <button
              type="button"
              onClick={openCreate}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} />
              Add Activity
            </button>
          </div>
        }
      />

      {notice && (
        <div
          role="status"
          className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          <CheckCircle2 size={16} />
          {notice.message}
        </div>
      )}

      <nav
        aria-label="Activity sections"
        className="mb-4 flex flex-wrap items-center gap-1.5"
      >
        {SECTIONS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection.key === item.key;
          const count = item.type ? counts[item.type] : counts.all;
          return (
            <Link
              key={item.key}
              to={item.key === "all" ? "/activities" : `/activities/${item.key}`}
              aria-current={isActive ? "page" : undefined}
              className={[
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              ].join(" ")}
            >
              <Icon size={15} />
              {item.label}
              {count !== undefined && count !== null && (
                <span
                  className={[
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    isActive ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500",
                  ].join(" ")}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative w-full max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, notes, recipient…"
            aria-label="Search activities"
            className="form-input pl-9"
          />
        </div>

        <select
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
          aria-label="Filter by employee"
          className="form-input w-full sm:w-56"
        >
          <option value="">All employees</option>
          {(options?.employees ?? []).map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
              {employee.department ? ` — ${employee.department}` : ""}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <label htmlFor="activity-date-from" className="sr-only">
            From date
          </label>
          <input
            id="activity-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            aria-label="From date"
            className="form-input w-full sm:w-40"
          />
          <span className="text-xs text-slate-400">to</span>
          <label htmlFor="activity-date-to" className="sr-only">
            To date
          </label>
          <input
            id="activity-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            aria-label="To date"
            className="form-input w-full sm:w-40"
          />
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 self-start rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 lg:self-auto"
          >
            <X size={13} />
            Clear filters
          </button>
        )}
      </div>

      {loading && !data ? (
        <ActivitySkeleton />
      ) : error ? (
        <ErrorState
          title="Could not load activities"
          description={error}
          onRetry={refetch}
        />
      ) : total === 0 && !hasFilters ? (
        <EmptyState
          title={
            activeSection.type
              ? `No ${activeSection.label.toLowerCase()} logged yet`
              : "No activities logged"
          }
          description="Log a call, email, meeting, note or other interaction to build your history."
          action={
            <button type="button" onClick={openCreate} className="btn-primary">
              Add Activity
            </button>
          }
        />
      ) : total === 0 ? (
        <EmptyState
          title="No matching activities"
          description="Try adjusting your search or filters."
          action={
            <button type="button" className="btn-secondary" onClick={clearFilters}>
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="divide-y divide-slate-100">
            {activities.map((activity) => {
              const meta = ACTIVITY_ICONS[activity.type] ?? ACTIVITY_ICONS.note;
              const Icon = meta.icon;
              const employee = employeeById[activity.employee_id];
              const linked = linkedLabel(activity);
              return (
                <div
                  key={activity.id}
                  className={`flex items-start gap-3 p-4 transition-colors hover:bg-slate-50/70 sm:gap-4 ${
                    focusId === activity.id ? "ring-2 ring-inset ring-slate-900/20" : ""
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${meta.color}`}
                  >
                    <Icon size={16} />
                  </span>

                  <button
                    type="button"
                    onClick={() => openView(activity)}
                    className="min-w-0 flex-1 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-primary-800/30"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <p className="text-sm font-semibold text-ink">{activity.title}</p>
                      <span className="flex-shrink-0 text-xs tabular-nums text-slate-400">
                        {activity.due_date
                          ? formatDateTime(activity.due_date)
                          : formatDate(activity.created_at)}
                      </span>
                    </div>
                    {activity.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
                        {activity.description}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-medium uppercase tracking-[0.08em]">
                        {TYPE_LABELS[activity.type] ?? capitalize(activity.type)}
                      </span>
                      {employee && <span>· {employee.name}</span>}
                      {linked && <span>· {linked}</span>}
                      {activity.type === "call" &&
                        activity.duration_minutes != null && (
                          <span>· {activity.duration_minutes} min</span>
                        )}
                      {activity.type === "email" && activity.direction && (
                        <span>· {capitalize(activity.direction)}</span>
                      )}
                    </div>
                  </button>

                  <div className="flex flex-shrink-0 items-center gap-0.5">
                    <span
                      className={`badge mr-1 hidden sm:inline-flex ${
                        STATUS_BADGES[activity.status] ?? "badge-gray"
                      }`}
                    >
                      {capitalize(activity.status ?? "pending")}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEdit(activity)}
                      aria-label={`Edit ${activity.title}`}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-800/30"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDelete(activity)}
                      aria-label={`Delete ${activity.title}`}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-danger focus:outline-none focus:ring-2 focus:ring-red-300"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination
            page={data.page}
            pages={pages}
            total={total}
            perPage={data.per_page ?? PER_PAGE}
            onPageChange={setPage}
          />
        </div>
      )}

      <Modal
        isOpen={Boolean(modalMode)}
        onClose={closeModal}
        title={modalTitles[modalMode] ?? "Activity"}
      >
        {modalMode === "view" && activeActivity ? (
          viewDetails(activeActivity)
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="activity-type" className="form-label">
                  Activity type
                </label>
                <select
                  id="activity-type"
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="meeting">Meeting</option>
                  <option value="note">Note</option>
                  <option value="task">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="activity-status" className="form-label">
                  Status
                </label>
                <select
                  id="activity-status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="activity-title" className="form-label">
                Subject or title
              </label>
              <input
                id="activity-title"
                name="title"
                type="text"
                value={form.title}
                onChange={handleChange}
                maxLength={200}
                placeholder="e.g. Discovery call with Acme"
                className="form-input"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="activity-customer" className="form-label">
                  Related customer
                </label>
                <select
                  id="activity-customer"
                  name="customer_id"
                  value={form.customer_id}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="">None</option>
                  {(options?.customers ?? []).map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                      {customer.company ? ` — ${customer.company}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="activity-lead" className="form-label">
                  Related lead (optional)
                </label>
                <select
                  id="activity-lead"
                  name="lead_id"
                  value={form.lead_id}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="">None</option>
                  {(options?.leads ?? []).map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name}
                      {lead.company ? ` — ${lead.company}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="activity-deal" className="form-label">
                  Related deal (optional)
                </label>
                <select
                  id="activity-deal"
                  name="deal_id"
                  value={form.deal_id}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="">None</option>
                  {(options?.deals ?? []).map((deal) => (
                    <option key={deal.id} value={deal.id}>
                      {deal.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="activity-employee" className="form-label">
                  Assigned employee
                </label>
                <select
                  id="activity-employee"
                  name="employee_id"
                  value={form.employee_id}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="">Unassigned</option>
                  {(options?.employees ?? []).map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                      {employee.department ? ` — ${employee.department}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="activity-date" className="form-label">
                Date and time
              </label>
              <input
                id="activity-date"
                name="due_date"
                type="datetime-local"
                value={form.due_date}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            {form.type === "call" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="activity-duration" className="form-label">
                    Duration (minutes)
                  </label>
                  <input
                    id="activity-duration"
                    name="duration_minutes"
                    type="number"
                    min="0"
                    max="1440"
                    value={form.duration_minutes}
                    onChange={handleChange}
                    placeholder="e.g. 30"
                    className="form-input"
                  />
                </div>
                <div>
                  <label htmlFor="activity-outcome" className="form-label">
                    Outcome
                  </label>
                  <input
                    id="activity-outcome"
                    name="outcome"
                    type="text"
                    maxLength={80}
                    value={form.outcome}
                    onChange={handleChange}
                    placeholder="e.g. Interested, callback next week"
                    className="form-input"
                  />
                </div>
              </div>
            )}

            {form.type === "email" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="activity-direction" className="form-label">
                      Direction
                    </label>
                    <select
                      id="activity-direction"
                      name="direction"
                      value={form.direction}
                      onChange={handleChange}
                      className="form-select"
                    >
                      <option value="sent">Sent</option>
                      <option value="received">Received</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="activity-recipient" className="form-label">
                      Recipient
                    </label>
                    <input
                      id="activity-recipient"
                      name="recipient"
                      type="email"
                      maxLength={160}
                      value={form.recipient}
                      onChange={handleChange}
                      placeholder="name@company.com"
                      className="form-input"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  This records the email in SmartCRM. SmartCRM does not send emails.
                </p>
              </div>
            )}

            {form.type === "meeting" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="activity-participants" className="form-label">
                    Participants
                  </label>
                  <input
                    id="activity-participants"
                    name="participants"
                    type="text"
                    value={form.participants}
                    onChange={handleChange}
                    placeholder="Comma-separated names"
                    className="form-input"
                  />
                </div>
                <div>
                  <label htmlFor="activity-location" className="form-label">
                    Location or meeting link
                  </label>
                  <input
                    id="activity-location"
                    name="location"
                    type="text"
                    maxLength={200}
                    value={form.location}
                    onChange={handleChange}
                    placeholder="Office, address or URL"
                    className="form-input"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="activity-description" className="form-label">
                Description or notes
              </label>
              <textarea
                id="activity-description"
                name="description"
                rows={4}
                value={form.description}
                onChange={handleChange}
                placeholder="Add context, notes or next steps…"
                className="form-input resize-none"
              />
            </div>

            {formError && (
              <p role="alert" className="form-error">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button type="button" onClick={closeModal} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting
                  ? "Saving…"
                  : modalMode === "edit"
                    ? "Save changes"
                    : "Add Activity"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete activity"
        message={
          pendingDelete
            ? `Delete activity "${pendingDelete.title}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete activity"
        busy={deleting}
        error={deleteError}
      />
    </div>
  );
}

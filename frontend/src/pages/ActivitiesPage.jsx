import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Phone,
  Mail,
  Users,
  FileText,
  CheckSquare,
  Plus,
  Trash2,
  Search,
  X,
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

const PER_PAGE = 12;

const ACTIVITY_ICONS = {
  call:    { icon: Phone,       color: "text-slate-700  bg-slate-100  ring-slate-200"   },
  email:   { icon: Mail,        color: "text-sky-700    bg-sky-50     ring-sky-100"     },
  meeting: { icon: Users,       color: "text-amber-700  bg-amber-50   ring-amber-100"   },
  note:    { icon: FileText,    color: "text-slate-600  bg-slate-100  ring-slate-200"   },
  task:    { icon: CheckSquare, color: "text-emerald-700 bg-emerald-50 ring-emerald-100" },
};

const EMPTY_FORM = {
  type: "call",
  notes: "",
  linked_type: "lead",
  linked_id: "",
};

const ACTIVITY_TYPES = ["call", "email", "meeting", "note", "task"];

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

export default function ActivitiesPage() {
  const [searchParams] = useSearchParams();
  const fetchActivities = useCallback(() => activityService.list(), []);
  const { data, loading, error, refetch } = useApi(fetchActivities);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const activities = useMemo(() => data?.activities ?? [], [data]);

  const filtered = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    return activities.filter((a) => {
      if (typeFilter && a.type !== typeFilter) return false;
      if (!needle) return true;
      return (
        (a.title ?? "").toLowerCase().includes(needle) ||
        (a.description ?? "").toLowerCase().includes(needle) ||
        (a.notes ?? "").toLowerCase().includes(needle)
      );
    });
  }, [activities, debouncedSearch, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter]);

  // Deep link from global search: /activities?focus=<id>
  const focusId = Number(searchParams.get("focus")) || null;
  useEffect(() => {
    if (!focusId) return;
    const index = filtered.findIndex((a) => a.id === focusId);
    if (index >= 0) setPage(Math.floor(index / PER_PAGE) + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, activities.length]);

  function openModal() {
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.linked_id) {
      setFormError("Linked ID is required.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      await activityService.create({
        type: form.type,
        notes: form.notes,
        linked_type: form.linked_type,
        linked_id: Number(form.linked_id),
      });
      closeModal();
      refetch();
    } catch (err) {
      setFormError(err?.response?.data?.error ?? "Failed to create activity.");
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
      refetch();
    } catch (err) {
      setDeleteError(err?.response?.data?.error ?? "Failed to delete activity.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Activities"
        description="Recent interactions and tasks"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton resource="activities" params={{ search: debouncedSearch }} />
            <button
              type="button"
              onClick={openModal}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} />
              Create Activity
            </button>
          </div>
        }
      />

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activities…"
            aria-label="Search activities"
            className="form-input pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by activity type"
          className="form-input w-full sm:w-40"
        >
          <option value="">All types</option>
          {ACTIVITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {capitalize(type)}
            </option>
          ))}
        </select>
        {(debouncedSearch || typeFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setTypeFilter("");
            }}
            className="flex items-center gap-1 self-start rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 sm:self-auto"
          >
            <X size={13} />
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <ActivitySkeleton />
      ) : error ? (
        <ErrorState
          title="Could not load activities"
          description={error}
          onRetry={refetch}
        />
      ) : activities.length === 0 ? (
        <EmptyState
          title="No activities logged"
          description="Activities are created when you log calls, emails, or meetings."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matching activities"
          description="Try adjusting your search or filters."
          action={
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSearch("");
                setTypeFilter("");
              }}
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="space-y-3 p-4">
            {paged.map((a) => {
              const meta = ACTIVITY_ICONS[a.type] ?? ACTIVITY_ICONS.note;
              const Icon = meta.icon;
              return (
                <div
                  key={a.id}
                  className={`card-hover flex items-start gap-4 p-4 ${
                    focusId === a.id ? "ring-2 ring-slate-900/30" : ""
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${meta.color}`}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">{a.title}</p>
                      <span className="flex-shrink-0 text-xs tabular-nums text-slate-400">
                        {formatDate(a.created_at)}
                      </span>
                    </div>
                    {a.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
                        {a.description}
                      </p>
                    )}
                    {a.notes && (
                      <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{a.notes}</p>
                    )}
                    <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                      {capitalize(a.type)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => requestDelete(a)}
                    aria-label={`Delete ${a.title}`}
                    className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-danger focus:outline-none focus:ring-2 focus:ring-red-300"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
          <Pagination
            page={currentPage}
            pages={totalPages}
            total={filtered.length}
            perPage={PER_PAGE}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Create Activity Modal */}
      <Modal isOpen={modalOpen} onClose={closeModal} title="Create Activity">
        <form onSubmit={handleCreate} className="space-y-4">
          {/* Type */}
          <div>
            <label htmlFor="activity-type" className="form-label">
              Type
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
            </select>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="activity-notes" className="form-label">
              Notes
            </label>
            <textarea
              id="activity-notes"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Add notes about this activity..."
              className="form-input resize-none"
            />
          </div>

          {/* Linked record type */}
          <div>
            <label htmlFor="activity-linked-type" className="form-label">
              Linked To
            </label>
            <select
              id="activity-linked-type"
              name="linked_type"
              value={form.linked_type}
              onChange={handleChange}
              className="form-select"
            >
              <option value="lead">Lead</option>
              <option value="customer">Customer</option>
              <option value="deal">Deal</option>
            </select>
          </div>

          {/* Linked ID */}
          <div>
            <label htmlFor="activity-linked-id" className="form-label">
              {capitalize(form.linked_type)} ID
            </label>
            <input
              id="activity-linked-id"
              name="linked_id"
              type="number"
              min="1"
              value={form.linked_id}
              onChange={handleChange}
              placeholder={`Enter ${form.linked_type} ID`}
              className="form-input"
              required
            />
          </div>

          {formError && <p className="form-error">{formError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? "Creating…" : "Create Activity"}
            </button>
          </div>
        </form>
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

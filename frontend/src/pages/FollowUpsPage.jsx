import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, CalendarDays, Link2, Search, X } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useDebounce } from "../hooks/useDebounce";
import { useAutoOpenCreate } from "../hooks/useAutoOpenCreate";
import { followupService } from "../services/followupService";
import FollowUpModal from "../components/followups/FollowUpModal";
import PageHeader from "../components/ui/PageHeader";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import Badge from "../components/ui/Badge";
import Pagination from "../components/ui/Pagination";
import ExportButton from "../components/ui/ExportButton";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import {
  FOLLOWUP_STATUS_COLORS,
  PRIORITY_COLORS,
  formatDate,
  capitalize,
} from "../utils/formatters";

const PER_PAGE = 12;

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "overdue", label: "Overdue" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "All priorities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function FollowUpSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="card">
          <div className="skeleton h-4 w-1/3" />
          <div className="mt-3 skeleton h-3 w-2/3" />
          <div className="mt-2 skeleton h-3 w-1/4" />
        </div>
      ))}
    </div>
  );
}

export default function FollowUpsPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get("status") ?? ""
  );
  const [priorityFilter, setPriorityFilter] = useState("");
  const [page, setPage] = useState(1);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState(null); // null = create

  // Delete confirmation state
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  const fetchFollowUps = useCallback(
    () =>
      followupService.list({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statusFilter, priorityFilter, reloadKey]
  );
  const { data, loading, error, refetch } = useApi(fetchFollowUps, [
    statusFilter,
    priorityFilter,
    reloadKey,
  ]);

  const followUps = useMemo(
    () => data?.followups ?? (Array.isArray(data) ? data : []),
    [data]
  );

  const filtered = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    if (!needle) return followUps;
    return followUps.filter(
      (f) =>
        (f.title ?? "").toLowerCase().includes(needle) ||
        (f.description ?? "").toLowerCase().includes(needle)
    );
  }, [followUps, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, priorityFilter]);

  // Deep link from global search: /followups?focus=<id>
  const focusId = Number(searchParams.get("focus")) || null;
  useEffect(() => {
    if (!focusId) return;
    let cancelled = false;
    followupService
      .get(focusId)
      .then((followUp) => {
        if (!cancelled) {
          setEditingFollowUp(followUp);
          setModalOpen(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [focusId]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingFollowUp(null);
    setModalOpen(true);
  }

  useAutoOpenCreate(openCreate);

  function openEdit(followUp) {
    setEditingFollowUp(followUp);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingFollowUp(null);
  }

  async function handleSave(formData) {
    if (editingFollowUp) {
      await followupService.update(editingFollowUp.id, formData);
    } else {
      await followupService.create(formData);
    }
    reload();
  }

  function requestDelete(followUp) {
    setDeleteError("");
    setPendingDelete(followUp);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await followupService.delete(pendingDelete.id);
      setPendingDelete(null);
      reload();
    } catch (err) {
      setDeleteError(err?.response?.data?.error ?? "Failed to delete follow-up.");
    } finally {
      setDeleting(false);
    }
  }

  const hasFilters = Boolean(debouncedSearch || statusFilter || priorityFilter);

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setPriorityFilter("");
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        description={`${followUps.length} follow-up${followUps.length !== 1 ? "s" : ""}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton
              resource="followups"
              params={{ status: statusFilter, search: debouncedSearch }}
            />
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} />
              New Follow-Up
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative w-full max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search follow-ups…"
            aria-label="Search follow-ups"
            className="form-input pl-9"
          />
        </div>
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="form-input w-full sm:w-44"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by priority"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="form-input w-full sm:w-44"
        >
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
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

      {loading ? (
        <FollowUpSkeleton />
      ) : error ? (
        <ErrorState
          title="Could not load follow-ups"
          description={error}
          onRetry={refetch}
        />
      ) : followUps.length === 0 ? (
        <EmptyState
          title="No follow-ups found"
          description={
            hasFilters
              ? "Try adjusting your search or filters."
              : "Create a follow-up to keep your pipeline moving."
          }
          action={
            hasFilters ? (
              <button type="button" className="btn-secondary" onClick={clearFilters}>
                Clear filters
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={openCreate}>
                <Plus size={16} />
                New Follow-Up
              </button>
            )
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matching follow-ups"
          description="Try adjusting your search or filters."
          action={
            <button type="button" className="btn-secondary" onClick={clearFilters}>
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="space-y-3 p-4">
            {paged.map((f) => (
              <div
                key={f.id}
                className="flex items-start gap-4 rounded-xl border border-slate-100 bg-white p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{f.title}</p>
                    <Badge className={FOLLOWUP_STATUS_COLORS[f.status] ?? "badge-gray"}>
                      {capitalize(f.status)}
                    </Badge>
                    <Badge className={PRIORITY_COLORS[f.priority] ?? "badge-gray"}>
                      {capitalize(f.priority ?? "medium")}
                    </Badge>
                  </div>

                  {f.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                      {f.description}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <CalendarDays size={12} />
                      Due {formatDate(f.due_date)}
                    </span>
                    {f.linked_type && (
                      <span className="flex items-center gap-1 capitalize">
                        <Link2 size={12} />
                        {f.linked_type} #{f.linked_id}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(f)}
                    aria-label={`Edit ${f.title}`}
                    className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => requestDelete(f)}
                    aria-label={`Delete ${f.title}`}
                    className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
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

      <FollowUpModal
        isOpen={modalOpen}
        onClose={closeModal}
        followup={editingFollowUp}
        onSave={handleSave}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete follow-up"
        message={
          pendingDelete
            ? `Delete follow-up "${pendingDelete.title}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete follow-up"
        busy={deleting}
        error={deleteError}
      />
    </div>
  );
}

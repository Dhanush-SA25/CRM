import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, Sparkles, X } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useDebounce } from "../hooks/useDebounce";
import { useAutoOpenCreate } from "../hooks/useAutoOpenCreate";
import { leadService } from "../services/leadService";
import LeadModal from "../components/leads/LeadModal";
import LeadScoreModal from "../components/leads/LeadScoreModal";
import PageHeader from "../components/ui/PageHeader";
import TableSkeleton from "../components/ui/TableSkeleton";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import Badge from "../components/ui/Badge";
import Pagination from "../components/ui/Pagination";
import ExportButton from "../components/ui/ExportButton";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Tooltip from "../components/ui/Tooltip";
import {
  LEAD_STATUS_COLORS,
  formatDate,
  capitalize,
} from "../utils/formatters";

const PER_PAGE = 20;
const STATUS_OPTIONS = ["new", "contacted", "qualified", "lost"];
const SOURCE_OPTIONS = ["website", "referral", "linkedin", "cold_call", "other"];

/** Return a Tailwind class for a coloured score badge. */
function scoreColor(score) {
  if (score >= 70) return "badge-green";
  if (score >= 40) return "badge-yellow";
  return "badge-red";
}

function prettySource(source) {
  return source ? source.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";
}

export default function LeadsPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [sort, setSort] = useState("");
  const [page, setPage] = useState(1);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null); // null = create mode
  const [scoreLead, setScoreLead] = useState(null);

  // Delete confirmation state
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Reload counter — incrementing forces useApi to re-fetch.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  const fetchLeads = useCallback(
    () =>
      leadService.list({
        search: debouncedSearch,
        status,
        source,
        sort,
        page,
        per_page: PER_PAGE,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedSearch, status, source, sort, page, reloadKey]
  );
  const { data, loading, error, refetch } = useApi(fetchLeads, [
    debouncedSearch,
    status,
    source,
    sort,
    page,
    reloadKey,
  ]);

  const leads = data?.leads ?? [];

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, source, sort]);

  // Deep link from global search: /leads?focus=<id>
  const focusId = Number(searchParams.get("focus")) || null;
  useEffect(() => {
    if (!focusId) return;
    let cancelled = false;
    leadService
      .get(focusId)
      .then((lead) => {
        if (!cancelled) {
          setEditingLead(lead);
          setModalOpen(true);
        }
      })
      .catch(() => {
        // The record may be outside the caller's scope — ignore silently.
      });
    return () => {
      cancelled = true;
    };
  }, [focusId]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingLead(null);
    setModalOpen(true);
  }

  useAutoOpenCreate(openCreate);

  function openEdit(lead) {
    setEditingLead(lead);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingLead(null);
  }

  async function handleSave(formData) {
    if (editingLead) {
      await leadService.update(editingLead.id, formData);
    } else {
      await leadService.create(formData);
    }
    reload();
  }

  function requestDelete(lead) {
    setDeleteError("");
    setPendingDelete(lead);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await leadService.delete(pendingDelete.id);
      setPendingDelete(null);
      reload();
    } catch (err) {
      setDeleteError(err?.response?.data?.error ?? "Failed to delete lead.");
    } finally {
      setDeleting(false);
    }
  }

  const hasFilters = Boolean(debouncedSearch || status || source || sort);

  function clearFilters() {
    setSearch("");
    setStatus("");
    setSource("");
    setSort("");
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Leads"
        description={`${data?.total ?? 0} total lead${(data?.total ?? 0) !== 1 ? "s" : ""}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton resource="leads" params={{ search: debouncedSearch, status, source }} />
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={16} />
              Add Lead
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
            placeholder="Search name, email or company…"
            aria-label="Search leads"
            className="form-input pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
            className="form-input"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {capitalize(option)}
              </option>
            ))}
          </select>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            aria-label="Filter by source"
            className="form-input"
          >
            <option value="">All sources</option>
            {SOURCE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {prettySource(option)}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort leads"
            className="form-input col-span-2 sm:col-span-1"
          >
            <option value="">Newest first</option>
            <option value="score">Highest score</option>
          </select>
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

      {loading ? (
        <div className="card overflow-hidden p-0">
          <TableSkeleton rows={7} columns={8} />
        </div>
      ) : error ? (
        <ErrorState title="Could not load leads" description={error} onRetry={refetch} />
      ) : leads.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No matching leads" : "No leads yet"}
          description={
            hasFilters
              ? "Try adjusting your search or filters."
              : "Add your first lead to start tracking prospects."
          }
          action={
            hasFilters ? (
              <button className="btn-secondary" onClick={clearFilters}>
                Clear filters
              </button>
            ) : (
              <button className="btn-primary" onClick={openCreate}>
                <Plus size={16} />
                Add Lead
              </button>
            )
          }
        />
      ) : (
        <div className="card data-table overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Name", "Email", "Phone", "Source", "Status", "Score", "Created", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {h === "Score" ? (
                          <span className="inline-flex items-center gap-1">
                            Score
                            <Tooltip
                              label="Rule-based score from source, status, contact completeness, business email, notes and recency. Click a score to see its breakdown."
                              side="bottom"
                            />
                          </span>
                        ) : (
                          h
                        )}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leads.map((l) => (
                  <tr key={l.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{l.name}</td>
                    <td className="px-4 py-3 text-slate-600">{l.email}</td>
                    <td className="px-4 py-3 text-slate-500">{l.phone || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{prettySource(l.source)}</td>
                    <td className="px-4 py-3">
                      <Badge className={LEAD_STATUS_COLORS[l.status] ?? "badge-gray"}>
                        {capitalize(l.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setScoreLead(l)}
                        title="View scoring breakdown"
                        className="inline-flex items-center gap-1 rounded-full transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-800/30"
                        aria-label={`View score breakdown for ${l.name}`}
                      >
                        <Badge className={scoreColor(l.score ?? 0)}>{l.score ?? 0}</Badge>
                        <Sparkles size={12} className="text-slate-300" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatDate(l.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(l)}
                          aria-label={`Edit ${l.name}`}
                          className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDelete(l)}
                          aria-label={`Delete ${l.name}`}
                          className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data?.page ?? page}
            pages={data?.pages ?? 1}
            total={data?.total ?? 0}
            perPage={PER_PAGE}
            onPageChange={setPage}
          />
        </div>
      )}

      <LeadModal
        isOpen={modalOpen}
        onClose={closeModal}
        lead={editingLead}
        onSave={handleSave}
      />

      <LeadScoreModal
        isOpen={Boolean(scoreLead)}
        onClose={() => setScoreLead(null)}
        lead={scoreLead}
        onScored={reload}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete lead"
        message={pendingDelete ? `Delete lead "${pendingDelete.name}"? This cannot be undone.` : ""}
        confirmLabel="Delete lead"
        busy={deleting}
        error={deleteError}
      />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  List,
  Columns3,
  Search,
  TrendingDown,
  X,
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useDebounce } from "../hooks/useDebounce";
import { useAutoOpenCreate } from "../hooks/useAutoOpenCreate";
import { dealService } from "../services/dealService";
import DealModal from "../components/deals/DealModal";
import KanbanBoard from "../components/deals/KanbanBoard";
import LostReasonModal from "../components/deals/LostReasonModal";
import PageHeader from "../components/ui/PageHeader";
import TableSkeleton from "../components/ui/TableSkeleton";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import Badge from "../components/ui/Badge";
import Pagination from "../components/ui/Pagination";
import ExportButton from "../components/ui/ExportButton";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import {
  DEAL_STAGE_LABELS,
  DEAL_STAGE_COLORS,
  formatCurrency,
  formatDate,
} from "../utils/formatters";

const VIEW_STORAGE_KEY = "deals_view";
const VIEWS = ["list", "kanban"];
const PER_PAGE = 15;

function readStoredView() {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    return VIEWS.includes(stored) ? stored : "list";
  } catch {
    return "list";
  }
}

export default function DealsPage() {
  const [searchParams] = useSearchParams();
  const [view, setView] = useState(readStoredView);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null); // null = create mode
  const [lostReasonsOpen, setLostReasonsOpen] = useState(false);

  // Filters + pagination (client-side — the deals endpoint returns the scoped set)
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [stageFilter, setStageFilter] = useState("");
  const [page, setPage] = useState(1);

  // Local copy so drag updates feel instant without a full refetch.
  const [deals, setDeals] = useState([]);
  const [actionError, setActionError] = useState("");

  // Delete confirmation state
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Reload counter — incrementing forces useApi to re-fetch.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  const fetchDeals = useCallback(() => dealService.list(), [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, loading, error, refetch } = useApi(fetchDeals, [reloadKey]);

  useEffect(() => {
    if (data) setDeals(data?.deals ?? (Array.isArray(data) ? data : []));
  }, [data]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, stageFilter]);

  // Deep link from global search: /deals?focus=<id>
  const focusId = Number(searchParams.get("focus")) || null;
  useEffect(() => {
    if (!focusId) return;
    let cancelled = false;
    dealService
      .get(focusId)
      .then((deal) => {
        if (!cancelled) {
          setEditingDeal(deal);
          setModalOpen(true);
        }
      })
      .catch(() => {
        // Outside the caller's scope — ignore silently.
      });
    return () => {
      cancelled = true;
    };
  }, [focusId]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const filteredDeals = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    return deals.filter((deal) => {
      if (stageFilter && deal.stage !== stageFilter) return false;
      if (needle && !(deal.title ?? "").toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [deals, debouncedSearch, stageFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDeals.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pagedDeals = filteredDeals.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE
  );

  const pipelineValue = filteredDeals
    .filter((d) => d.stage !== "lost")
    .reduce((sum, d) => sum + (d.value || 0), 0);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function changeView(next) {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable (private mode) — the view still changes.
    }
  }

  function openCreate() {
    setEditingDeal(null);
    setModalOpen(true);
  }

  useAutoOpenCreate(openCreate);

  function openEdit(deal) {
    setEditingDeal(deal);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingDeal(null);
  }

  async function handleSave(formData) {
    if (editingDeal) {
      await dealService.update(editingDeal.id, formData);
    } else {
      await dealService.create(formData);
    }
    reload();
  }

  function requestDelete(deal) {
    setDeleteError("");
    setPendingDelete(deal);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await dealService.delete(pendingDelete.id);
      setDeals((prev) => prev.filter((d) => d.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err?.response?.data?.error ?? "Failed to delete deal.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleStageChange(dealId, newStage) {
    const previous = deals.find((d) => d.id === dealId)?.stage;
    if (!previous || previous === newStage) return;

    setActionError("");
    // Optimistic move — Kanban updates immediately while the PUT is in flight.
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d))
    );

    try {
      await dealService.update(dealId, { stage: newStage });
    } catch (err) {
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage: previous } : d))
      );
      setActionError(err?.response?.data?.error ?? "Failed to update deal stage.");
    }
  }

  const showingError = actionError || error;
  const hasFilters = Boolean(debouncedSearch || stageFilter);

  function clearFilters() {
    setSearch("");
    setStageFilter("");
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const listAction = (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5"
        role="group"
        aria-label="Deal view"
      >
        <button
          type="button"
          onClick={() => changeView("list")}
          aria-pressed={view === "list"}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            view === "list"
              ? "bg-primary-600 text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <List size={14} />
          List
        </button>
        <button
          type="button"
          onClick={() => changeView("kanban")}
          aria-pressed={view === "kanban"}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            view === "kanban"
              ? "bg-primary-600 text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Columns3 size={14} />
          Kanban
        </button>
      </div>
      <ExportButton
        resource="deals"
        params={{ search: debouncedSearch, stage: stageFilter }}
      />
      <button type="button" className="btn-primary" onClick={openCreate}>
        <Plus size={16} />
        New Deal
      </button>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Deals"
        description={`${deals.length} deal${deals.length !== 1 ? "s" : ""} · ${formatCurrency(
          pipelineValue
        )} in active pipeline`}
        action={listAction}
      />

      {showingError && (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {showingError}
        </div>
      )}

      {/* Filters */}
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
            placeholder="Search deals…"
            aria-label="Search deals"
            className="form-input pl-9"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          aria-label="Filter by stage"
          className="form-input w-full sm:w-44"
        >
          <option value="">All stages</option>
          {Object.entries(DEAL_STAGE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setLostReasonsOpen(true)}
        >
          <TrendingDown size={15} />
          Lost reasons
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 self-start rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 sm:self-auto"
          >
            <X size={13} />
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="card overflow-hidden p-0">
          <TableSkeleton rows={7} columns={7} />
        </div>
      ) : !error && deals.length === 0 ? (
        <EmptyState
          title="No deals yet"
          description="Create your first deal to start tracking your pipeline."
          action={
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} />
              New Deal
            </button>
          }
        />
      ) : error ? (
        <ErrorState title="Could not load deals" description={error} onRetry={refetch} />
      ) : filteredDeals.length === 0 ? (
        <EmptyState
          title="No matching deals"
          description="Try adjusting your search or stage filter."
          action={
            <button type="button" className="btn-secondary" onClick={clearFilters}>
              Clear filters
            </button>
          }
        />
      ) : view === "kanban" ? (
        <KanbanBoard
          deals={filteredDeals}
          onStageChange={handleStageChange}
          onEdit={openEdit}
          onDelete={requestDelete}
        />
      ) : (
        <div className="card data-table overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Title", "Stage", "Value", "Probability", "Close Date", "Created", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pagedDeals.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{d.title}</p>
                      {d.stage === "lost" && d.lost_reason && (
                        <p className="text-[11px] text-red-500">{d.lost_reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={DEAL_STAGE_COLORS[d.stage] ?? "badge-gray"}>
                        {DEAL_STAGE_LABELS[d.stage] ?? d.stage}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      <span className="flex items-center gap-1">
                        <DollarSign size={13} className="text-slate-400" />
                        {formatCurrency(d.value)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${d.probability}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{d.probability}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(d.close_date)}</td>
                    <td className="px-4 py-3 text-slate-400">{formatDate(d.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(d)}
                          aria-label={`Edit ${d.title}`}
                          className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDelete(d)}
                          aria-label={`Delete ${d.title}`}
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
            page={currentPage}
            pages={totalPages}
            total={filteredDeals.length}
            perPage={PER_PAGE}
            onPageChange={setPage}
          />
        </div>
      )}

      <DealModal
        isOpen={modalOpen}
        onClose={closeModal}
        deal={editingDeal}
        onSave={handleSave}
      />

      <LostReasonModal
        isOpen={lostReasonsOpen}
        onClose={() => setLostReasonsOpen(false)}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete deal"
        message={
          pendingDelete
            ? `Delete deal "${pendingDelete.title}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete deal"
        busy={deleting}
        error={deleteError}
      />
    </div>
  );
}

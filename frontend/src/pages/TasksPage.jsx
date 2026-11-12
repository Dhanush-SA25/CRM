import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, CalendarDays, Search, X } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useDebounce } from "../hooks/useDebounce";
import { useAutoOpenCreate } from "../hooks/useAutoOpenCreate";
import { taskService } from "../services/taskService";
import TaskModal from "../components/tasks/TaskModal";
import PageHeader from "../components/ui/PageHeader";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import Badge from "../components/ui/Badge";
import ExportButton from "../components/ui/ExportButton";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { PRIORITY_COLORS, formatDate, capitalize } from "../utils/formatters";

/** Column definitions — order and labels for the three kanban columns. */
const COLUMNS = [
  { key: "todo",        label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done",        label: "Done" },
];

/** Column shell tones — neutral surfaces, emerald only for the terminal state. */
const COLUMN_ACCENT = {
  todo:        "border-surface-border bg-white/60",
  in_progress: "border-slate-300 bg-white/70",
  done:        "border-emerald-200 bg-emerald-50/40",
};

const COLUMN_TITLE_COLOR = {
  todo:        "text-ink",
  in_progress: "text-ink",
  done:        "text-emerald-700",
};

function TaskBoardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, column) => (
        <div key={column} className="rounded-2xl border border-slate-200 bg-white/60 p-4">
          <div className="skeleton h-3 w-20" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 3 }).map((__, card) => (
              <div key={card} className="rounded-xl border border-slate-100 p-3">
                <div className="skeleton h-3.5 w-3/4" />
                <div className="mt-2 skeleton h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Tasks page — displays tasks grouped into three kanban-style columns
 * (To Do / In Progress / Done) with create, edit, and delete actions.
 */
export default function TasksPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get("status") ?? ""
  );

  // Modal state
  const [modalOpen, setModalOpen]   = useState(false);
  const [editingTask, setEditingTask] = useState(null); // null = create mode

  // Delete confirmation state
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Reload counter — incrementing forces useApi to re-fetch.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  const fetchTasks = useCallback(
    // per_page keeps the whole board on one screen for the kanban view.
    () => taskService.list({ per_page: 500 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reloadKey]
  );
  const { data, loading, error, refetch } = useApi(fetchTasks, [reloadKey]);

  // The API may return { tasks: [...] } or an array directly.
  const tasks = useMemo(
    () => (Array.isArray(data) ? data : data?.tasks ?? []),
    [data]
  );

  const filteredTasks = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    const now = new Date();
    return tasks.filter((t) => {
      if (statusFilter === "overdue") {
        if (t.status === "done" || !t.due_date) return false;
        if (new Date(t.due_date) >= now) return false;
      } else if (statusFilter && t.status !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      return (
        (t.title ?? "").toLowerCase().includes(needle) ||
        (t.description ?? "").toLowerCase().includes(needle)
      );
    });
  }, [tasks, debouncedSearch, statusFilter]);

  // Deep link from global search: /tasks?focus=<id>
  const focusId = Number(searchParams.get("focus")) || null;
  useEffect(() => {
    if (!focusId) return;
    let cancelled = false;
    taskService
      .get(focusId)
      .then((task) => {
        if (!cancelled) {
          setEditingTask(task);
          setModalOpen(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [focusId]);

  // Group tasks by status.
  const grouped = Object.fromEntries(
    COLUMNS.map(({ key }) => [
      key,
      filteredTasks.filter((t) => t.status === key),
    ])
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingTask(null);
    setModalOpen(true);
  }

  useAutoOpenCreate(openCreate);

  function openEdit(task) {
    setEditingTask(task);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingTask(null);
  }

  async function handleSave(formData) {
    if (editingTask) {
      await taskService.update(editingTask.id, formData);
    } else {
      await taskService.create(formData);
    }
    reload();
  }

  function requestDelete(task) {
    setDeleteError("");
    setPendingDelete(task);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await taskService.delete(pendingDelete.id);
      setPendingDelete(null);
      reload();
    } catch (err) {
      setDeleteError(err?.response?.data?.error ?? "Failed to delete task.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Tasks"
        description={`${tasks.length} total task${tasks.length !== 1 ? "s" : ""}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton resource="tasks" params={{ search: debouncedSearch }} />
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={16} />
              Create Task
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
            placeholder="Search tasks…"
            aria-label="Search tasks"
            className="form-input pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by task status"
          className="form-input w-full sm:w-44"
        >
          <option value="">All statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
          <option value="overdue">Overdue</option>
        </select>
        {(debouncedSearch || statusFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
            }}
            className="flex items-center gap-1 self-start rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 sm:self-auto"
          >
            <X size={13} />
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <TaskBoardSkeleton />
      ) : error ? (
        <ErrorState title="Could not load tasks" description={error} onRetry={refetch} />
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Create a task to start planning your work."
          action={
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={16} />
              Create Task
            </button>
          }
        />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          title="No matching tasks"
          description="Try a different search term or status."
          action={
            <button
              className="btn-secondary"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
              }}
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {COLUMNS.map(({ key, label }) => (
            <KanbanColumn
              key={key}
              label={label}
              tasks={grouped[key] ?? []}
              accent={COLUMN_ACCENT[key]}
              titleColor={COLUMN_TITLE_COLOR[key]}
              onEdit={openEdit}
              onDelete={requestDelete}
            />
          ))}
        </div>
      )}

      <TaskModal
        isOpen={modalOpen}
        onClose={closeModal}
        task={editingTask}
        onSave={handleSave}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete task"
        message={
          pendingDelete ? `Delete task "${pendingDelete.title}"? This cannot be undone.` : ""
        }
        confirmLabel="Delete task"
        busy={deleting}
        error={deleteError}
      />
    </div>
  );
}

// ── Sub-component: KanbanColumn ───────────────────────────────────────────────

function KanbanColumn({ label, tasks, accent, titleColor, onEdit, onDelete }) {
  return (
    <div className={`flex flex-col gap-3 rounded-2xl border ${accent} p-4 backdrop-blur`}>
      {/* Column header */}
      <div className="flex items-center justify-between">
        <h2 className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${titleColor}`}>
          {label}
        </h2>
        <span className="rounded-full border border-surface-border bg-white/80 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-muted">
          {tasks.length}
        </span>
      </div>

      {/* Task cards */}
      {tasks.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">No tasks here</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Sub-component: TaskCard ───────────────────────────────────────────────────

function TaskCard({ task, onEdit, onDelete }) {
  return (
    <li className="rounded-xl border border-surface-border bg-white p-3 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-card-hover">
      {/* Title + action buttons */}
      <div className="flex items-start justify-between gap-2">
        <span className="flex-1 break-words text-sm font-medium leading-snug text-ink">
          {task.title}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit(task)}
            aria-label={`Edit task "${task.title}"`}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(task)}
            aria-label={`Delete task "${task.title}"`}
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Description (truncated) */}
      {task.description && (
        <p className="mt-1 text-xs text-ink-muted line-clamp-2">{task.description}</p>
      )}

      {/* Meta row: priority badge + due date */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge className={PRIORITY_COLORS[task.priority] ?? "badge-gray"}>
          {capitalize(task.priority ?? "medium")}
        </Badge>

        {task.due_date && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <CalendarDays size={11} />
            {formatDate(task.due_date)}
          </span>
        )}
      </div>
    </li>
  );
}

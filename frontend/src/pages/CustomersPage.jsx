import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  CopyCheck,
  X,
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useDebounce } from "../hooks/useDebounce";
import { useAutoOpenCreate } from "../hooks/useAutoOpenCreate";
import { customerService } from "../services/customerService";
import CustomerModal from "../components/customers/CustomerModal";
import Customer360Panel from "../components/customers/Customer360Panel";
import DuplicatesModal from "../components/customers/DuplicatesModal";
import PageHeader from "../components/ui/PageHeader";
import TableSkeleton from "../components/ui/TableSkeleton";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import Badge from "../components/ui/Badge";
import Pagination from "../components/ui/Pagination";
import ExportButton from "../components/ui/ExportButton";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import {
  CUSTOMER_STATUS_COLORS,
  formatDate,
  capitalize,
} from "../utils/formatters";

const PER_PAGE = 20;
const STATUS_OPTIONS = ["prospect", "active", "inactive"];

export default function CustomersPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null); // null = create mode

  // Profile + duplicates state
  const [profileId, setProfileId] = useState(null);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);

  // Delete confirmation state
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Reload counter — incrementing forces useApi to re-fetch.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  const fetchCustomers = useCallback(
    () =>
      customerService.list({
        search: debouncedSearch,
        status,
        page,
        per_page: PER_PAGE,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedSearch, status, page, reloadKey]
  );
  const { data, loading, error, refetch } = useApi(fetchCustomers, [
    debouncedSearch,
    status,
    page,
    reloadKey,
  ]);

  const customers = data?.customers ?? [];

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  // Deep link from global search: /customers?focus=<id>
  const focusId = Number(searchParams.get("focus")) || null;
  useEffect(() => {
    if (focusId) setProfileId(focusId);
  }, [focusId]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingCustomer(null);
    setModalOpen(true);
  }

  useAutoOpenCreate(openCreate);

  function openEdit(customer) {
    setEditingCustomer(customer);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingCustomer(null);
  }

  async function handleSave(formData) {
    if (editingCustomer) {
      await customerService.update(editingCustomer.id, formData);
    } else {
      await customerService.create(formData);
    }
    reload();
  }

  function requestDelete(customer) {
    setDeleteError("");
    setPendingDelete(customer);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await customerService.delete(pendingDelete.id);
      if (profileId === pendingDelete.id) setProfileId(null);
      setPendingDelete(null);
      reload();
    } catch (err) {
      setDeleteError(err?.response?.data?.error ?? "Failed to delete customer.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const hasFilters = Boolean(debouncedSearch || status);

  return (
    <div>
      <PageHeader
        title="Customers"
        description={`${data?.total ?? 0} total customer${(data?.total ?? 0) !== 1 ? "s" : ""}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setDuplicatesOpen(true)}
            >
              <CopyCheck size={16} />
              Duplicates
            </button>
            <ExportButton
              resource="customers"
              params={{ search: debouncedSearch, status }}
            />
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} />
              Add Customer
            </button>
          </div>
        }
      />

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
            placeholder="Search name, email or company…"
            aria-label="Search customers"
            className="form-input pl-9"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          className="form-input w-full sm:w-44"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {capitalize(option)}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatus("");
            }}
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
      ) : error ? (
        <ErrorState
          title="Could not load customers"
          description={error}
          onRetry={refetch}
        />
      ) : customers.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No matching customers" : "No customers yet"}
          description={
            hasFilters
              ? "Try adjusting your search or filters."
              : "Add your first customer to get started."
          }
          action={
            hasFilters ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                }}
              >
                Clear filters
              </button>
            ) : (
              <button className="btn-primary" onClick={openCreate}>
                <Plus size={16} />
                Add Customer
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
                  {["Name", "Company", "Email", "Phone", "Status", "Created", "Actions"].map(
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
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className={`transition-colors hover:bg-slate-50 ${
                      profileId === c.id ? "bg-primary-50/60" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setProfileId(c.id)}
                        className="text-left font-medium text-primary-700 hover:underline"
                        aria-label={`Open 360 profile for ${c.name}`}
                      >
                        {c.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.company || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.email}</td>
                    <td className="px-4 py-3 text-slate-600">{c.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge className={CUSTOMER_STATUS_COLORS[c.status] ?? "badge-gray"}>
                        {capitalize(c.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary-600"
                          aria-label={`Edit ${c.name}`}
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDelete(c)}
                          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          aria-label={`Delete ${c.name}`}
                          title="Delete"
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

      {/* Customer 360 drawer */}
      {profileId && (
        <Customer360Panel
          customerId={profileId}
          onClose={() => setProfileId(null)}
          onEdit={(customer) => openEdit(customer)}
        />
      )}

      <DuplicatesModal
        isOpen={duplicatesOpen}
        onClose={() => setDuplicatesOpen(false)}
        onViewCustomer={(customer) => setProfileId(customer.id)}
      />

      {/* Create / Edit modal */}
      <CustomerModal
        isOpen={modalOpen}
        onClose={closeModal}
        customer={editingCustomer}
        onSave={handleSave}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete customer"
        message={
          pendingDelete
            ? `Delete "${pendingDelete.name}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete customer"
        busy={deleting}
        error={deleteError}
      />
    </div>
  );
}

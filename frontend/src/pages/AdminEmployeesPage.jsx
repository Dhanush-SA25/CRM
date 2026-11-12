import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Building2,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Network,
  Search,
  ShieldCheck,
  Upload,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import TableSkeleton from "../components/ui/TableSkeleton";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import Pagination from "../components/ui/Pagination";
import ProgressBar from "../components/ui/ProgressBar";
import Modal from "../components/ui/Modal";
import ExportButton from "../components/ui/ExportButton";
import { useApi } from "../hooks/useApi";
import { useDebounce } from "../hooks/useDebounce";
import { employeeService } from "../services/employeeService";
import { saveBlob } from "../utils/download";
import { formatDate } from "../utils/formatters";

const PER_PAGE = 25;

const EMPTY_SUMMARY = { total: 0, active: 0, departments: 0, with_manager: 0 };

function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function StatusBadge({ status }) {
  const active = status === "active";
  return (
    <span className={active ? "badge-green" : "badge-gray"}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function ImportPanel({ isOpen, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploaded, setUploaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const inputRef = useRef(null);

  const reset = useCallback(() => {
    setFile(null);
    setProgress(0);
    setUploaded(false);
    setResult(null);
    setError("");
    setReportBusy(false);
    setTemplateBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  function handleClose() {
    if (busy) return;
    reset();
    onClose();
  }

  async function handleTemplate() {
    setTemplateBusy(true);
    setError("");
    try {
      const blob = await employeeService.downloadTemplate();
      saveBlob(blob, "employee-import-template.csv");
    } catch {
      setError("Could not download the template. Try again.");
    } finally {
      setTemplateBusy(false);
    }
  }

  async function handleImport() {
    if (!file) {
      setError("Choose a CSV file to import.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    setProgress(0);
    setUploaded(false);
    try {
      const response = await employeeService.importCsv(file, (event) => {
        if (event.total) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
        if (event.loaded >= (event.total ?? 0)) setUploaded(true);
      });
      setProgress(100);
      setResult(response);
      onImported(response);
    } catch (err) {
      setError(err?.response?.data?.error || "Import failed. Check the file and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleErrorReport() {
    if (!result?.batch) return;
    setReportBusy(true);
    setError("");
    try {
      const blob = await employeeService.downloadErrors(result.batch);
      saveBlob(blob, `employee-import-errors-${result.batch}.csv`);
    } catch {
      setError("Could not download the error report.");
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk import employees">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3">
          <ShieldCheck size={18} className="mt-0.5 flex-shrink-0 text-slate-600" />
          <p className="text-xs leading-relaxed text-slate-600">
            Imports create <span className="font-semibold text-slate-800">directory records only</span>.
            No login accounts or passwords are created, so re-uploading the same file never
            creates duplicate accounts.
          </p>
        </div>

        <div>
          <p className="form-label">1 · Get the template</p>
          <button
            type="button"
            onClick={handleTemplate}
            disabled={templateBusy}
            className="btn-secondary w-full justify-start"
          >
            {templateBusy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {templateBusy ? "Preparing template…" : "Download CSV template"}
          </button>
        </div>

        <div>
          <label htmlFor="employee-csv" className="form-label">
            2 · Choose a CSV file
          </label>
          <input
            ref={inputRef}
            id="employee-csv"
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setResult(null);
              setError("");
              setProgress(0);
              setUploaded(false);
            }}
            className="block w-full cursor-pointer rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:border-slate-400"
          />
          <p className="mt-1.5 text-[11px] text-slate-400">
            Required columns: employee_id, name, email. Supports 1,000+ rows. UTF-8 or Windows-1252.
          </p>
        </div>

        {(busy || result) && (
          <div className="rounded-xl border border-slate-200 bg-white p-3.5" aria-live="polite">
            <ProgressBar
              value={progress}
              label={uploaded ? "Validating rows…" : "Uploading file…"}
              hint={`${progress}%`}
              tone={result ? "green" : "ink"}
            />
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 size={17} />
              Import complete in {result.duration_ms} ms
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Rows", value: result.total_rows, tone: "text-slate-700" },
                { label: "Imported", value: result.imported, tone: "text-emerald-700" },
                { label: "Failed", value: result.failed, tone: "text-red-600" },
                { label: "Duplicates", value: result.duplicates, tone: "text-amber-600" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-center">
                  <p className={`text-lg font-bold leading-none ${item.tone}`}>{item.value}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Batch <span className="font-mono text-[11px] text-slate-700">{result.batch}</span> ·{" "}
              {result.accounts_created === 0
                ? "No login accounts or passwords were created."
                : `${result.accounts_created} login accounts created.`}
            </p>

            {result.errors?.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Failed records ({result.failed})
                  </p>
                  {result.errors_truncated && (
                    <span className="text-[11px] text-slate-400">
                      showing first {result.errors.length}
                    </span>
                  )}
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-[11px]">
                    <thead className="sticky top-0 bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2 py-1.5 font-semibold">Row</th>
                        <th className="px-2 py-1.5 font-semibold">Employee</th>
                        <th className="px-2 py-1.5 font-semibold">Issues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.errors.map((row) => (
                        <tr key={`${row.row}-${row.employee_id || row.email || "row"}`}>
                          <td className="px-2 py-1.5 text-slate-500">{row.row}</td>
                          <td className="px-2 py-1.5 text-slate-700">
                            <span className="block font-medium">{row.employee_id || "—"}</span>
                            <span className="block text-slate-400">{row.email || "—"}</span>
                          </td>
                          <td className="px-2 py-1.5 text-red-600">{row.errors.join("; ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={handleErrorReport}
                  disabled={reportBusy}
                  className="btn-secondary mt-2 w-full"
                >
                  {reportBusy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {reportBusy ? "Preparing report…" : "Download full error report"}
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={busy}>
            {result ? "Done" : "Cancel"}
          </button>
          <button type="button" className="btn-primary" onClick={handleImport} disabled={busy || !file}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {busy ? "Importing…" : "Import employees"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function AdminEmployeesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = Number(searchParams.get("focus")) || null;

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 350);
  const rowRefs = useRef({});

  const { data, loading, error, refetch } = useApi(
    () =>
      employeeService.list({
        page,
        per_page: PER_PAGE,
        search: debouncedSearch,
        department,
        status,
        focus: focusId || undefined,
      }),
    [page, debouncedSearch, department, status, focusId]
  );

  const employees = useMemo(() => data?.employees ?? [], [data]);
  const summary = data?.summary ?? EMPTY_SUMMARY;
  const departments = useMemo(() => data?.departments ?? [], [data]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, department, status]);

  useEffect(() => {
    if (!focusId || loading || !employees.length) return;
    const row = rowRefs.current[focusId];
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId, loading, employees]);

  function clearFocus() {
    const next = new URLSearchParams(searchParams);
    next.delete("focus");
    setSearchParams(next, { replace: true });
  }

  function handleImported(response) {
    refetch();
    if (response?.imported > 0) {
      setSearch("");
      setDepartment("");
      setStatus("");
      setPage(1);
    }
  }

  const hasFilters = Boolean(search || department || status);

  return (
    <div className="page-shell space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Employee directory"
        description="Bulk-import and manage directory records. Imports never create login accounts."
        action={
          <>
            <ExportButton resource="employees" label="Export directory" />
            <button type="button" className="btn-primary" onClick={() => setImportOpen(true)}>
              <Upload size={15} />
              Import CSV
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total employees"
          value={summary.total.toLocaleString()}
          subtitle="Directory records"
          icon={Users}
          color="ink"
        />
        <StatCard
          title="Active"
          value={summary.active.toLocaleString()}
          subtitle="Currently employed"
          icon={UserCheck}
          color="green"
        />
        <StatCard
          title="Departments"
          value={summary.departments.toLocaleString()}
          subtitle="Distinct departments"
          icon={Building2}
          color="blue"
        />
        <StatCard
          title="With manager"
          value={summary.with_manager.toLocaleString()}
          subtitle="Reporting lines mapped"
          icon={Network}
          color="purple"
        />
      </div>

      {focusId && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Showing a linked employee.</span>
          <button
            type="button"
            onClick={clearFocus}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-slate-500 hover:bg-white hover:text-slate-800"
          >
            <X size={13} />
            Clear focus
          </button>
        </div>
      )}

      <div className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by employee ID, name, email, department…"
              aria-label="Search employees"
              className="form-input pl-9"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="department-filter">
              Filter by department
            </label>
            <select
              id="department-filter"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="form-select sm:w-48"
            >
              <option value="">All departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="status-filter">
              Filter by status
            </label>
            <select
              id="status-filter"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="form-select sm:w-40"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        {loading ? (
          <TableSkeleton rows={8} columns={6} />
        ) : error ? (
          <div className="p-5">
            <ErrorState
              title="Employee directory unavailable"
              description={error}
              onRetry={refetch}
            />
          </div>
        ) : employees.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={hasFilters ? "No employees match these filters" : "No employees imported yet"}
              description={
                hasFilters
                  ? "Try a different search or clear the filters."
                  : "Upload a CSV to populate the directory with 1,000+ employees at once."
              }
              action={
                hasFilters ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setSearch("");
                      setDepartment("");
                      setStatus("");
                    }}
                  >
                    Clear filters
                  </button>
                ) : (
                  <button type="button" className="btn-primary" onClick={() => setImportOpen(true)}>
                    <Upload size={15} />
                    Import employees
                  </button>
                )
              }
            />
          </div>
        ) : (
          <>
            <div className="data-table overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Manager</th>
                    <th>Status</th>
                    <th>Imported</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => {
                    const highlighted = focusId === employee.id;
                    return (
                      <tr
                        key={employee.id}
                        ref={(node) => {
                          if (node) rowRefs.current[employee.id] = node;
                        }}
                        className={
                          highlighted ? "bg-amber-50/70 ring-1 ring-inset ring-amber-300" : ""
                        }
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-[11px] font-bold text-white">
                              {initials(employee.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-ink">{employee.name}</p>
                              <p className="truncate text-xs text-slate-400">
                                {employee.employee_id} · {employee.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>{employee.department || "—"}</td>
                        <td>{employee.designation || "—"}</td>
                        <td className="font-mono text-xs text-slate-500">
                          {employee.manager_employee_id || "—"}
                        </td>
                        <td>
                          <StatusBadge status={employee.status} />
                        </td>
                        <td className="whitespace-nowrap text-xs text-slate-400">
                          {formatDate(employee.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={data.page}
              pages={data.pages}
              total={data.total}
              perPage={PER_PAGE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-xs text-slate-500">
        <FileSpreadsheet size={15} className="mt-0.5 flex-shrink-0 text-slate-400" />
        <p>
          Validation checks employee IDs, email format, departments, designations, and manager
          references. Duplicate IDs or emails — within the file or against existing records — are
          rejected and listed in the downloadable error report.
        </p>
      </div>

      <ImportPanel
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleImported}
      />
    </div>
  );
}

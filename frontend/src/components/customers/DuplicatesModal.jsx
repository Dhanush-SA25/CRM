import { useEffect, useState } from "react";
import { CopyCheck, Mail, Phone, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import Modal from "../ui/Modal";
import Badge from "../ui/Badge";
import { customerService } from "../../services/customerService";
import { CUSTOMER_STATUS_COLORS, formatDate, capitalize } from "../../utils/formatters";

export default function DuplicatesModal({ isOpen, onClose, onViewCustomer }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    customerService
      .duplicates()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error || "Could not scan for duplicates.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const groups = data?.groups ?? [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Duplicate customers">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" />
          Scanning customer records…
        </div>
      ) : error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      ) : groups.length === 0 ? (
        <div className="py-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
            <CopyCheck size={22} />
          </span>
          <p className="mt-3 font-semibold text-ink">No duplicates found</p>
          <p className="mt-1 text-sm text-slate-500">
            {data?.scanned ?? 0} customer records scanned by email, phone and name.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Found <span className="font-semibold text-slate-700">{data.total_groups}</span>{" "}
            possible duplicate group{data.total_groups !== 1 ? "s" : ""} across{" "}
            <span className="font-semibold text-slate-700">{data.scanned}</span> records.
            Suggested primary records are marked.
          </p>

          {groups.map((group, index) => (
            <div key={index} className="rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
                {group.match_details.map((detail) => (
                  <span
                    key={`${detail.reason}-${detail.value}`}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200"
                  >
                    {detail.reason.startsWith("Same email") ? (
                      <Mail size={10} />
                    ) : detail.reason.startsWith("Same phone") ? (
                      <Phone size={10} />
                    ) : null}
                    {detail.reason}: {detail.value} ({detail.count})
                  </span>
                ))}
              </div>
              <ul className="divide-y divide-slate-50">
                {group.customers.map((customer) => (
                  <li key={customer.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-slate-800">
                          {customer.name}
                        </span>
                        {customer.id === group.suggested_primary_id && (
                          <Badge className="badge-green">Suggested primary</Badge>
                        )}
                        <Badge className={CUSTOMER_STATUS_COLORS[customer.status] ?? "badge-gray"}>
                          {capitalize(customer.status)}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        {customer.email} · {customer.company || "No company"} · created{" "}
                        {formatDate(customer.created_at)}
                      </p>
                    </div>
                    {onViewCustomer && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onViewCustomer(customer);
                        }}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                      >
                        View
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

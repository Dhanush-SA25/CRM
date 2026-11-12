import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, TrendingDown } from "lucide-react";
import Modal from "../ui/Modal";
import { dealService } from "../../services/dealService";
import { formatCurrency, formatDate } from "../../utils/formatters";

export default function LostReasonModal({ isOpen, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    dealService
      .lostReasons()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error || "Could not load lost-deal analysis.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const reasons = data?.reasons ?? [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lost-deal reason analysis">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" />
          Analysing lost deals…
        </div>
      ) : error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      ) : !data || data.total_lost === 0 ? (
        <div className="py-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 ring-1 ring-slate-200">
            <TrendingDown size={22} />
          </span>
          <p className="mt-3 font-semibold text-ink">No lost deals recorded</p>
          <p className="mt-1 text-sm text-slate-500">
            Mark a deal as lost with a reason to unlock this analysis.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Lost deals</p>
              <p className="mt-1 text-xl font-semibold text-ink">{data.total_lost}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Lost value</p>
              <p className="mt-1 text-xl font-semibold text-ink">
                {formatCurrency(data.total_lost_value)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Top reason</p>
              <p className="mt-1 truncate text-sm font-semibold text-ink" title={data.top_reason}>
                {data.top_reason ?? "—"}
              </p>
            </div>
          </div>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reasons by count
            </h3>
            <div className="space-y-2.5">
              {reasons.map((reason) => (
                <div key={reason.reason}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-medium text-slate-700">{reason.reason}</span>
                    <span className="flex-shrink-0 text-slate-400">
                      {reason.count} · {formatCurrency(reason.value)} · {reason.share}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-red-400/80"
                      style={{ width: `${Math.max(4, reason.share)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Recent lost deals
            </h3>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {(data.lost_deals ?? []).slice(0, 10).map((deal) => (
                <li key={deal.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">{deal.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {deal.lost_reason || "Unspecified"} · closed {formatDate(deal.close_date)}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-sm font-semibold text-slate-600">
                    {formatCurrency(deal.value)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Modal>
  );
}

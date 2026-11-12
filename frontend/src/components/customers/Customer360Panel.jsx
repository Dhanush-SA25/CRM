import { useEffect } from "react";
import {
  X,
  Pencil,
  Mail,
  Phone,
  Building2,
  FileText,
  DollarSign,
  Activity,
  CalendarClock,
  UserRound,
  Target,
  TrendingUp,
} from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { customerService } from "../../services/customerService";
import Badge from "../ui/Badge";
import LoadingSpinner from "../ui/LoadingSpinner";
import ErrorState from "../ui/ErrorState";
import ProgressBar from "../ui/ProgressBar";
import {
  CUSTOMER_STATUS_COLORS,
  DEAL_STAGE_LABELS,
  DEAL_STAGE_COLORS,
  FOLLOWUP_STATUS_COLORS,
  formatDate,
  formatCurrency,
  timeAgo,
  capitalize,
} from "../../utils/formatters";

const HEALTH_TONE = { healthy: "green", at_risk: "amber", dormant: "red" };
const HEALTH_LABEL = { healthy: "Healthy", at_risk: "At risk", dormant: "Dormant" };

function Metric({ label, value, hint, icon: Icon }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {Icon && <Icon size={12} />}
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold leading-tight text-ink">{value}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export default function Customer360Panel({ customerId, onClose, onEdit }) {
  const fetchProfile = () => customerService.get360(customerId);
  const { data, loading, error, refetch } = useApi(fetchProfile, [customerId]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const customer = data?.customer;
  const metrics = data?.metrics;
  const deals = data?.deals ?? [];
  const activities = data?.activities ?? [];
  const followups = data?.followups ?? [];

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={customer ? `${customer.name} profile` : "Customer profile"}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
              {(customer?.name ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-ink">
                {customer?.name ?? "Customer profile"}
              </h2>
              <p className="truncate text-xs text-slate-500">
                {customer?.company || "No company"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {customer && (
              <button
                type="button"
                onClick={() => onEdit(customer)}
                aria-label="Edit customer"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <Pencil size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close profile"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-20">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <ErrorState
              title="Profile unavailable"
              description={error}
              onRetry={refetch}
            />
          ) : (
            <div className="space-y-6">
              {/* Health + status */}
              <section>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Account health
                  </h3>
                  <Badge className={CUSTOMER_STATUS_COLORS[customer.status] ?? "badge-gray"}>
                    {capitalize(customer.status)}
                  </Badge>
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <p className="text-[30px] font-bold leading-none text-ink">
                    {metrics.health_score}
                    <span className="text-sm font-medium text-slate-400"> / 100</span>
                  </p>
                  <Badge className={`badge-${HEALTH_TONE[metrics.health_label] ?? "gray"}`}>
                    {HEALTH_LABEL[metrics.health_label] ?? metrics.health_label}
                  </Badge>
                </div>
                <ProgressBar
                  className="mt-2"
                  value={metrics.health_score}
                  tone={HEALTH_TONE[metrics.health_label] ?? "ink"}
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Derived from real activity, pipeline, revenue, status and overdue follow-ups.
                </p>
              </section>

              {/* Metrics */}
              <section className="grid grid-cols-2 gap-2">
                <Metric
                  label="Open pipeline"
                  value={formatCurrency(metrics.open_pipeline_value)}
                  hint={`${metrics.open_deals} open deal${metrics.open_deals !== 1 ? "s" : ""}`}
                  icon={DollarSign}
                />
                <Metric
                  label="Won revenue"
                  value={formatCurrency(metrics.won_value)}
                  hint={`${metrics.won_deals} won deal${metrics.won_deals !== 1 ? "s" : ""}`}
                  icon={TrendingUp}
                />
                <Metric
                  label="Win rate"
                  value={`${metrics.win_rate}%`}
                  hint={`${metrics.deals_count} total deal${metrics.deals_count !== 1 ? "s" : ""}`}
                  icon={Target}
                />
                <Metric
                  label="Last activity"
                  value={metrics.last_activity_at ? timeAgo(metrics.last_activity_at) : "—"}
                  hint={`${metrics.activities_count} recorded`}
                  icon={Activity}
                />
              </section>

              {/* Contact */}
              <section>
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Contact info
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-slate-400" />
                    <span className="break-all text-slate-700">{customer.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-slate-400" />
                    <span className="text-slate-700">{customer.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-slate-400" />
                    <span className="text-slate-700">{customer.company || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserRound size={14} className="text-slate-400" />
                    <span className="text-slate-700">
                      Owner: {data.owner?.name ?? "Unassigned"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-slate-400" />
                    <span className="text-slate-500">Created {formatDate(customer.created_at)}</span>
                  </div>
                </div>
              </section>

              {customer.notes && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Notes
                  </h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                    {customer.notes}
                  </p>
                </section>
              )}

              {/* Deals */}
              <section>
                <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <DollarSign size={13} />
                  Deals ({deals.length})
                </h3>
                {deals.length === 0 ? (
                  <p className="text-sm italic text-slate-400">No deals yet.</p>
                ) : (
                  <div className="space-y-2">
                    {deals.map((d) => (
                      <div
                        key={d.id}
                        className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-slate-800">
                            {d.title}
                          </span>
                          <Badge className={DEAL_STAGE_COLORS[d.stage] ?? "badge-gray"}>
                            {DEAL_STAGE_LABELS[d.stage] ?? d.stage}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatCurrency(d.value)} · closes {formatDate(d.close_date)}
                          {d.lost_reason ? ` · ${d.lost_reason}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Follow-ups */}
              <section>
                <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <CalendarClock size={13} />
                  Follow-ups ({followups.length})
                  {metrics.overdue_followups > 0 && (
                    <span className="badge-red ml-auto">{metrics.overdue_followups} overdue</span>
                  )}
                </h3>
                {followups.length === 0 ? (
                  <p className="text-sm italic text-slate-400">No follow-ups yet.</p>
                ) : (
                  <div className="space-y-2">
                    {followups.slice(0, 8).map((f) => (
                      <div
                        key={f.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-700">{f.title}</p>
                          <p className="text-[11px] text-slate-400">
                            Due {formatDate(f.due_date)}
                          </p>
                        </div>
                        <Badge className={FOLLOWUP_STATUS_COLORS[f.status] ?? "badge-gray"}>
                          {capitalize(f.status)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Activity timeline */}
              <section>
                <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Activity size={13} />
                  Activity timeline ({activities.length})
                </h3>
                {activities.length === 0 ? (
                  <p className="text-sm italic text-slate-400">No recorded activity.</p>
                ) : (
                  <ol className="space-y-3 border-l border-slate-100 pl-4">
                    {activities.slice(0, 12).map((a) => (
                      <li key={a.id} className="relative">
                        <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-slate-300 ring-4 ring-white" />
                        <p className="text-sm font-medium text-slate-700">{a.title}</p>
                        <p className="text-[11px] text-slate-400">
                          {capitalize(a.type)} · {timeAgo(a.created_at)}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

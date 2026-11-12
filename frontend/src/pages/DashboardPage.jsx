import { useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  UserPlus,
  TrendingUp,
  DollarSign,
  Trophy,
  Briefcase,
  CheckCircle2,
  CalendarClock,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Activity as ActivityIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { useApi } from "../hooks/useApi";
import { dashboardService } from "../services/dashboardService";
import StatCard from "../components/ui/StatCard";
import PageHeader from "../components/ui/PageHeader";
import InfoTooltip from "../components/ui/Tooltip";
import ErrorState from "../components/ui/ErrorState";
import RevenueTrendChart from "../components/dashboard/RevenueTrendChart";
import TargetPanel from "../components/dashboard/TargetPanel";
import ConversionFunnel from "../components/dashboard/ConversionFunnel";
import LostReasonsChart from "../components/dashboard/LostReasonsChart";
import EmployeePerformanceTable from "../components/dashboard/EmployeePerformanceTable";
import { DEAL_STAGE_LABELS, formatCurrency, capitalize, timeAgo } from "../utils/formatters";

// Graphite ramp keeps the charts inside the gray/white identity.
const STAGE_COLORS = ["#111827", "#1f2937", "#374151", "#4b5563", "#6b7280", "#9ca3af", "#d1d5db"];
const PIE_COLORS = ["#111827", "#374151", "#6b7280", "#9ca3af", "#d1d5db", "#2563eb"];

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  boxShadow: "0 16px 40px -20px rgba(17,24,39,0.35)",
  fontSize: 12,
  padding: "8px 12px",
  background: "rgba(255,255,255,0.98)",
};

/** Fill missing days so the area chart always spans the last 30 days. */
function buildActivitySeries(rows = []) {
  const byDate = new Map(rows.map((r) => [String(r.date), r.count]));
  const series = [];
  const now = new Date();

  for (let i = 29; i >= 0; i -= 1) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    day.setUTCDate(day.getUTCDate() - i);
    const key = day.toISOString().slice(0, 10);
    series.push({
      date: key,
      label: `${String(day.getUTCMonth() + 1).padStart(2, "0")}/${String(day.getUTCDate()).padStart(2, "0")}`,
      count: byDate.get(key) ?? 0,
    });
  }
  return series;
}

function ChartCard({ title, description, tooltip, children, className = "" }) {
  return (
    <div className={`card ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-lg font-semibold text-ink">
            {title}
            {tooltip && <InfoTooltip label={tooltip} />}
          </h2>
          {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function PipelineBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={248}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#eef0f3" />
        <XAxis
          dataKey="stage"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(stage) => DEAL_STAGE_LABELS[stage] ?? stage}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
        />
        <Tooltip
          cursor={{ fill: "rgba(17,24,39,0.04)" }}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: "#111827", fontWeight: 600 }}
          itemStyle={{ color: "#6b7280" }}
          formatter={(value) => [formatCurrency(value), "Pipeline value"]}
          labelFormatter={(stage) => DEAL_STAGE_LABELS[stage] ?? stage}
        />
        <Bar dataKey="value" name="Pipeline value" radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={entry.stage} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LeadSourcePieChart({ data }) {
  const total = data.reduce((sum, item) => sum + (item.count ?? 0), 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={248}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="source"
            cx="50%"
            cy="46%"
            innerRadius={56}
            outerRadius={86}
            paddingAngle={2}
            stroke="#ffffff"
            strokeWidth={2}
          >
            {data.map((entry, i) => (
              <Cell key={entry.source ?? i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(value) => capitalize(value || "unknown")}
            wrapperStyle={{ fontSize: 11, color: "#6b7280" }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "#111827", fontWeight: 600 }}
            formatter={(value, name) => [value, capitalize(name || "unknown")]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 top-[46%] -translate-y-1/2 text-center">
        <p className="text-xl font-semibold leading-none text-ink">{total}</p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-400">Leads</p>
      </div>
    </div>
  );
}

function ActivityAreaChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
        <defs>
          <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#111827" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#111827" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#eef0f3" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          interval={4}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: "#111827", fontWeight: 600 }}
          itemStyle={{ color: "#6b7280" }}
        />
        <Area
          type="monotone"
          dataKey="count"
          name="Activities"
          stroke="#111827"
          strokeWidth={2}
          fill="url(#activityFill)"
          activeDot={{ r: 4, fill: "#111827", stroke: "#ffffff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function MiniStat({ icon: Icon, label, value, hint, to }) {
  const content = (
    <>
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium uppercase tracking-[0.08em] text-slate-400">
          {label}
        </span>
        <span className="mt-0.5 flex items-baseline gap-2">
          <span className="text-lg font-semibold leading-none text-ink">{value}</span>
          {hint && <span className="truncate text-xs text-slate-400">{hint}</span>}
        </span>
      </span>
      {to && <ArrowRight size={14} className="text-slate-300 transition group-hover:text-slate-500" />}
    </>
  );

  const className =
    "group flex items-center gap-3 rounded-2xl border border-surface-border bg-white/70 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-card-hover";

  if (!to) return <div className={className}>{content}</div>;
  return (
    <Link to={to} className={className}>
      {content}
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div>
      <div className="mb-6 h-9 w-56 skeleton" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-surface-border bg-white p-5">
            <div className="h-3 w-24 skeleton" />
            <div className="mt-4 h-7 w-20 skeleton" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="h-80 rounded-2xl border border-surface-border bg-white p-5 lg:col-span-2">
          <div className="h-4 w-40 skeleton" />
          <div className="mt-6 h-56 skeleton" />
        </div>
        <div className="h-80 rounded-2xl border border-surface-border bg-white p-5">
          <div className="h-4 w-32 skeleton" />
          <div className="mt-6 h-56 skeleton" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const fetchDashboard = useCallback(async () => {
    const [summaryRes, analyticsRes] = await Promise.all([
      dashboardService.getSummary(),
      dashboardService.getAnalytics(),
    ]);
    return { ...summaryRes, analytics: analyticsRes };
  }, []);

  const { data, loading, error, refetch } = useApi(fetchDashboard);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <ErrorState
        title="Failed to load dashboard"
        description={error}
        onRetry={refetch}
      />
    );
  }

  const { summary = {}, recent_activities = [], analytics } = data ?? {};
  const pipelineByStage = analytics?.pipeline_by_stage ?? [];
  const leadsBySource = analytics?.leads_by_source ?? [];
  const activitySeries = buildActivitySeries(analytics?.activities_30d);
  const winRate = analytics?.win_rate ?? 0;
  const revenueTrend = analytics?.revenue_trend ?? [];
  const salesTargets = analytics?.sales_targets ?? { rows: [], totals: {} };
  const employeePerformance = analytics?.employee_performance ?? [];
  const dealConversion = analytics?.deal_conversion ?? [];
  const lostReasons = analytics?.lost_reasons ?? { reasons: [], total_lost: 0 };
  const scope = analytics?.scope ?? summary.scope ?? {};
  const scopeLabel = scope.label ?? "Workspace";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <PageHeader
        eyebrow={`${scopeLabel} overview`}
        title="Dashboard"
        description={`${today} · live metrics from ${scopeLabel.toLowerCase()} records`}
        action={
          <button type="button" onClick={refetch} className="btn-secondary">
            <RefreshCw size={15} />
            Refresh
          </button>
        }
      />

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total customers"
          value={summary.total_customers ?? 0}
          icon={Users}
          color="blue"
          subtitle="All accounts"
          tooltip="Every customer visible to you in this workspace scope."
        />
        <StatCard
          title="Active leads"
          value={summary.total_leads ?? 0}
          icon={UserPlus}
          color="purple"
          subtitle="In pipeline"
          tooltip="Leads at any status, excluding converted or archived records."
        />
        <StatCard
          title="Open deals"
          value={summary.open_deals ?? 0}
          icon={TrendingUp}
          color="amber"
          subtitle="Across open stages"
          tooltip="Deals that are not marked won or lost."
        />
        <StatCard
          title="Pipeline value"
          value={formatCurrency(summary.pipeline_value)}
          icon={DollarSign}
          color="green"
          subtitle={`Won: ${formatCurrency(summary.won_value)}`}
          tooltip="Sum of deal values in stages other than won and lost."
        />
        <StatCard
          title="Win rate"
          value={`${winRate}%`}
          icon={Trophy}
          color="ink"
          subtitle={`${summary.won_deals ?? 0} won · ${summary.lost_deals ?? 0} lost`}
          tooltip="Won deals divided by all closed (won + lost) deals."
        />
      </div>

      {/* Operational counters */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat
          icon={Briefcase}
          label="Open pipeline"
          value={summary.open_deals ?? 0}
          hint="deals in play"
          to="/deals"
        />
        <MiniStat
          icon={CheckCircle2}
          label="Won revenue"
          value={formatCurrency(summary.won_value)}
          hint={`${summary.won_deals ?? 0} deals`}
          to="/deals"
        />
        <MiniStat
          icon={CalendarClock}
          label="Pending follow-ups"
          value={summary.pending_followups ?? 0}
          hint={`${summary.overdue_followups ?? 0} overdue`}
          to="/followups"
        />
        <MiniStat
          icon={AlertTriangle}
          label="Overdue tasks"
          value={summary.overdue_tasks ?? 0}
          hint="need attention"
          to="/tasks"
        />
      </div>

      {/* Revenue and target achievement */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard
            title="Revenue trend"
            description="Won deal value by close month, last 12 months"
            tooltip="Revenue counts deals marked won, grouped by close date (falls back to last update when no close date is set)."
          >
            <RevenueTrendChart data={revenueTrend} />
          </ChartCard>
        </div>
        <ChartCard
          title="Target vs achievement"
          description={`${salesTargets.period ?? "Current quarter"} · won revenue against target`}
          tooltip="Quarterly targets are set by an administrator. Achievement uses won deals with close dates inside the quarter."
        >
          <TargetPanel targets={salesTargets} />
        </ChartCard>
      </div>

      {/* Conversion and lost reasons */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Deal conversion"
          description="Cumulative share of deals reaching each stage"
          tooltip="Because stage history is not stored, this is a cumulative snapshot of where deals currently sit — not a historical cohort."
        >
          <ConversionFunnel data={dealConversion} />
        </ChartCard>
        <ChartCard
          title="Lost deal reasons"
          description="Why deals were marked lost"
          tooltip="Lost reasons are captured on the deal record when it is moved to the lost stage."
        >
          <LostReasonsChart data={lostReasons} />
        </ChartCard>
      </div>

      {/* Employee productivity */}
      <div className="mt-6">
        <ChartCard
          title="Employee productivity"
          description={`${scopeLabel} workload and revenue by owner`}
          tooltip="Counts come from records assigned to each employee within your visibility scope."
        >
          <EmployeePerformanceTable rows={employeePerformance} />
        </ChartCard>
      </div>

      {/* Analytics charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard
            title="Pipeline value by stage"
            description="Deal value distributed across the seven pipeline stages"
          >
            <PipelineBarChart data={pipelineByStage} />
          </ChartCard>
        </div>
        <ChartCard title="Leads by source" description="Where demand originates">
          <LeadSourcePieChart data={leadsBySource} />
        </ChartCard>
      </div>

      <div className="mt-6">
        <ChartCard
          title="Activity volume"
          description="Workspace events recorded over the last 30 days"
        >
          <ActivityAreaChart data={activitySeries} />
        </ChartCard>
      </div>

      {/* Recent activity */}
      <div className="card mt-6 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Recent activity</h2>
            <p className="mt-0.5 text-xs text-slate-400">Latest workspace events</p>
          </div>
          <Link
            to="/activities"
            className="flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-900"
          >
            View timeline <ArrowRight size={13} />
          </Link>
        </div>
        {recent_activities.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            No recent activity yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent_activities.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <ActivityIcon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{a.title}</p>
                  <p className="mt-0.5 text-[11px] capitalize text-slate-400">{a.type}</p>
                </div>
                <span className="flex-shrink-0 text-[11px] text-slate-400">
                  {timeAgo(a.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

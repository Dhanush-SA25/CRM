import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Check,
  Loader2,
  Save,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import TableSkeleton from "../components/ui/TableSkeleton";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import ProgressBar from "../components/ui/ProgressBar";
import { useApi } from "../hooks/useApi";
import { targetService } from "../services/targetService";
import { formatCurrency, formatDate } from "../utils/formatters";

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
}

function quarterOptions(count = 8) {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  const options = [];
  for (let offset = -3; offset < count - 3; offset += 1) {
    let q = quarter + offset;
    let y = year;
    while (q < 1) {
      q += 4;
      y -= 1;
    }
    while (q > 4) {
      q -= 4;
      y += 1;
    }
    options.push(`${y}-Q${q}`);
  }
  return options;
}

function attainmentTone(attainment) {
  if (attainment == null) return "ink";
  if (attainment >= 100) return "green";
  if (attainment >= 60) return "amber";
  return "red";
}

function AttainmentBadge({ attainment }) {
  if (attainment == null) return <span className="badge-gray">No target</span>;
  if (attainment >= 100) return <span className="badge-green">On track</span>;
  if (attainment >= 60) return <span className="badge-yellow">At risk</span>;
  return <span className="badge-red">Behind</span>;
}

export default function AdminTargetsPage() {
  const periods = useMemo(() => quarterOptions(), []);
  const [period, setPeriod] = useState(currentPeriod);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [rowErrors, setRowErrors] = useState({});

  const { data, loading, error, refetch } = useApi(
    () => targetService.list(period),
    [period]
  );

  useEffect(() => {
    const next = {};
    (data?.targets ?? []).forEach((row) => {
      next[row.user_id] = String(row.target_amount ?? 0);
    });
    setDrafts(next);
    setRowErrors({});
  }, [data]);

  async function saveTarget(userId) {
    const raw = drafts[userId];
    const amount = Number(raw);
    if (raw === "" || !Number.isFinite(amount) || amount < 0) {
      setRowErrors((prev) => ({ ...prev, [userId]: "Enter a non-negative amount." }));
      return;
    }
    setSavingId(userId);
    setRowErrors((prev) => ({ ...prev, [userId]: "" }));
    try {
      await targetService.set({ userId, period, targetAmount: amount });
      await refetch();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [userId]: err?.response?.data?.error || "Could not save this target.",
      }));
    } finally {
      setSavingId(null);
    }
  }

  const targets = data?.targets ?? [];
  const totals = data?.totals ?? { target_amount: 0, achieved: 0, attainment: null };
  const periodIndex = periods.indexOf(period);

  return (
    <div className="page-shell space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Sales targets"
        description="Set quarterly revenue targets per person. Achievement is calculated only from won deals in the selected quarter."
      />

      <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary px-3"
            onClick={() => setPeriod(periods[Math.max(0, periodIndex - 1)])}
            disabled={periodIndex <= 0}
            aria-label="Previous quarter"
          >
            ←
          </button>
          <label htmlFor="target-period" className="sr-only">
            Select quarter
          </label>
          <select
            id="target-period"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="form-select w-40 text-center font-semibold"
          >
            {periods.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secondary px-3"
            onClick={() => setPeriod(periods[Math.min(periods.length - 1, periodIndex + 1)])}
            disabled={periodIndex >= periods.length - 1}
            aria-label="Next quarter"
          >
            →
          </button>
        </div>
        {data && (
          <p className="text-xs text-slate-500">
            {formatDate(data.start)} – {formatDate(data.end)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total target"
          value={formatCurrency(totals.target_amount)}
          subtitle="Sum across the team"
          icon={Target}
          color="ink"
          tooltip="Sum of every person's quarterly target for this period."
        />
        <StatCard
          title="Achieved"
          value={formatCurrency(totals.achieved)}
          subtitle="Won deals this quarter"
          icon={BadgeDollarSign}
          color="green"
          tooltip="Total value of deals moved to Won with a close date inside this quarter."
        />
        <StatCard
          title="Attainment"
          value={totals.attainment == null ? "—" : `${totals.attainment}%`}
          subtitle="Achieved ÷ target"
          icon={TrendingUp}
          color="blue"
          tooltip="Team attainment. Blank when no targets are set for the quarter."
        />
        <StatCard
          title="Remaining"
          value={formatCurrency(Math.max(0, totals.target_amount - totals.achieved))}
          subtitle="Still to close"
          icon={Users}
          color="amber"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        {loading ? (
          <TableSkeleton rows={7} columns={5} />
        ) : error ? (
          <div className="p-5">
            <ErrorState title="Targets unavailable" description={error} onRetry={refetch} />
          </div>
        ) : targets.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No users to assign targets to"
              description="Create users first, then set quarterly revenue targets here."
            />
          </div>
        ) : (
          <div className="data-table overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Team member</th>
                  <th>Quarterly target</th>
                  <th>Achieved</th>
                  <th>Attainment</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((row) => {
                  const dirty = Number(drafts[row.user_id] ?? 0) !== row.target_amount;
                  const saving = savingId === row.user_id;
                  return (
                    <tr key={row.user_id}>
                      <td>
                        <p className="font-semibold text-ink">{row.name}</p>
                        <p className="text-xs text-slate-400">
                          {row.email} · <span className="capitalize">{row.role}</span>
                        </p>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400">$</span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            inputMode="decimal"
                            value={drafts[row.user_id] ?? ""}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [row.user_id]: event.target.value,
                              }))
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") saveTarget(row.user_id);
                            }}
                            aria-label={`Quarterly target for ${row.name}`}
                            className="form-input w-32 px-2.5 py-1.5 text-right text-sm tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() => saveTarget(row.user_id)}
                            disabled={saving || !dirty}
                            aria-label={`Save target for ${row.name}`}
                            title={dirty ? "Save target" : "Saved"}
                            className={[
                              "flex h-8 w-8 items-center justify-center rounded-lg border transition",
                              dirty
                                ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-600",
                              saving ? "opacity-70" : "",
                            ].join(" ")}
                          >
                            {saving ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : dirty ? (
                              <Save size={14} />
                            ) : (
                              <Check size={14} />
                            )}
                          </button>
                        </div>
                        {rowErrors[row.user_id] && (
                          <p role="alert" className="mt-1 text-[11px] text-red-600">
                            {rowErrors[row.user_id]}
                          </p>
                        )}
                      </td>
                      <td className="tabular-nums">{formatCurrency(row.achieved)}</td>
                      <td className="min-w-[180px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-700">
                            {row.attainment == null ? "—" : `${row.attainment}%`}
                          </span>
                          <AttainmentBadge attainment={row.attainment} />
                        </div>
                        <ProgressBar
                          className="mt-1.5"
                          value={row.attainment ?? 0}
                          tone={attainmentTone(row.attainment)}
                        />
                      </td>
                      <td className="tabular-nums text-slate-500">
                        {formatCurrency(row.remaining)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Targets apply per calendar quarter. Figures refresh from the database each time this page
        loads — nothing is estimated or pre-filled with sample data.
      </p>
    </div>
  );
}

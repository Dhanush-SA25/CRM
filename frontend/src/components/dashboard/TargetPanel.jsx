import ProgressBar from "../ui/ProgressBar";
import { formatCurrency } from "../../utils/formatters";

function toneFor(attainment) {
  if (attainment == null) return "blue";
  if (attainment >= 100) return "green";
  if (attainment >= 60) return "amber";
  return "red";
}

export default function TargetPanel({ targets }) {
  const rows = targets?.rows ?? [];
  const totals = targets?.totals ?? { target_amount: 0, achieved: 0, attainment: null };
  const period = targets?.period ?? "";
  const activeRows = rows.filter((row) => row.target_amount > 0 || row.achieved > 0);

  if (!activeRows.length) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 text-center">
        <p className="text-sm font-medium text-slate-500">No targets set for {period || "this quarter"}</p>
        <p className="mt-1 text-xs text-slate-400">
          An administrator can assign quarterly targets under User administration.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Team attainment</p>
          <p className="mt-1 text-[30px] font-bold leading-none text-ink">
            {totals.attainment == null ? "—" : `${totals.attainment}%`}
          </p>
        </div>
        <p className="text-right text-xs text-slate-500">
          <span className="block font-semibold text-slate-700">{formatCurrency(totals.achieved)}</span>
          of {formatCurrency(totals.target_amount)}
        </p>
      </div>
      <ProgressBar
        value={totals.achieved}
        max={totals.target_amount || 1}
        tone={toneFor(totals.attainment)}
        className="mb-5"
      />
      <ul className="max-h-[248px] space-y-4 overflow-y-auto pr-1">
        {activeRows.map((row) => (
          <li key={row.user_id}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-medium text-slate-700">{row.name}</span>
              <span className="flex-shrink-0 text-slate-500">
                {row.attainment == null ? "No target" : `${row.attainment}%`}
              </span>
            </div>
            <ProgressBar
              value={row.achieved}
              max={row.target_amount || row.achieved || 1}
              tone={toneFor(row.attainment)}
            />
            <div className="mt-1 flex justify-between text-[11px] text-slate-400">
              <span>{formatCurrency(row.achieved)} achieved</span>
              <span>Target {formatCurrency(row.target_amount)}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-slate-400">
        Achievement counts won deals whose close date falls inside {period}.
      </p>
    </div>
  );
}

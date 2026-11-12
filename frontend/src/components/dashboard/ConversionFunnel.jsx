import { formatCurrency, DEAL_STAGE_LABELS } from "../../utils/formatters";
import ChartEmpty from "./ChartEmpty";

const BAR_TONES = ["bg-slate-900", "bg-slate-800", "bg-slate-700", "bg-slate-600", "bg-slate-500", "bg-emerald-600"];

export default function ConversionFunnel({ data = [] }) {
  const entry = data[0]?.count ?? 0;
  if (!entry) {
    return <ChartEmpty message="No pipeline deals to analyse" height={240} />;
  }

  return (
    <div className="space-y-4">
      {data.map((stage, index) => (
        <div key={stage.stage}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
            <span className="font-medium text-slate-700">{DEAL_STAGE_LABELS[stage.stage] ?? stage.stage}</span>
            <span className="text-slate-500">
              {stage.count} deals · {formatCurrency(stage.value)}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${BAR_TONES[index % BAR_TONES.length]}`}
              style={{ width: `${Math.max(stage.conversion, 1)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {stage.conversion}% of deals currently at or beyond this stage
          </p>
        </div>
      ))}
      <p className="border-t border-slate-100 pt-3 text-[11px] text-slate-400">
        Cumulative view of deals currently positioned at each stage; lost deals are excluded.
      </p>
    </div>
  );
}

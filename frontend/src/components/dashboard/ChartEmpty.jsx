import { BarChart3 } from "lucide-react";

export default function ChartEmpty({ message = "No data recorded yet", height = 220 }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center"
      style={{ height }}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 ring-1 ring-slate-200">
        <BarChart3 size={18} />
      </span>
      <p className="mt-3 text-sm font-medium text-slate-500">{message}</p>
      <p className="mt-0.5 text-xs text-slate-400">Data appears here as records are created.</p>
    </div>
  );
}

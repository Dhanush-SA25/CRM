/**
 * Summary stat card used on the Dashboard.
 * Props: title, value, subtitle, icon (Lucide component), color, tooltip
 * color: "blue" | "green" | "purple" | "amber" | "red" | "ink"
 */
import Tooltip from "./Tooltip";

const TONES = {
  blue: {
    wash: "from-sky-50 via-white to-transparent",
    tile: "bg-sky-50 text-sky-700 ring-sky-100",
  },
  green: {
    wash: "from-emerald-50 via-white to-transparent",
    tile: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  purple: {
    wash: "from-slate-100 via-white to-transparent",
    tile: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  amber: {
    wash: "from-amber-50 via-white to-transparent",
    tile: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  red: {
    wash: "from-red-50 via-white to-transparent",
    tile: "bg-red-50 text-red-700 ring-red-100",
  },
  ink: {
    wash: "from-slate-100 via-white to-transparent",
    tile: "bg-slate-900 text-white ring-slate-900",
  },
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "ink",
  tooltip,
}) {
  const tone = TONES[color] ?? TONES.ink;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-surface-border bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-card-hover">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${tone.wash}`}
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-1">
            {title}
            {tooltip && <Tooltip label={tooltip} />}
          </p>
          <p className="mt-2.5 text-[30px] font-bold leading-none tracking-tight text-ink">
            {value}
          </p>
          {subtitle && (
            <p className="mt-2 truncate text-xs text-slate-400">{subtitle}</p>
          )}
        </div>
        <span
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${tone.tile}`}
        >
          {Icon && <Icon size={20} />}
        </span>
      </div>
    </div>
  );
}

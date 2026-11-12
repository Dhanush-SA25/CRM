export default function ProgressBar({
  value = 0,
  max = 100,
  tone = "ink",
  label,
  hint,
  className = "",
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const tones = {
    ink: "bg-slate-900",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    blue: "bg-sky-500",
  };

  return (
    <div className={className}>
      {(label || hint) && (
        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
          {label && <span className="font-medium text-slate-600">{label}</span>}
          {hint && <span className="text-slate-400">{hint}</span>}
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${tones[tone] ?? tones.ink}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

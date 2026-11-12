import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorState({
  title = "Something went wrong",
  description = "The data could not be loaded.",
  onRetry,
  retryLabel = "Try again",
}) {
  return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-red-100">
        <AlertTriangle size={22} />
      </span>
      <div>
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary mt-1">
          <RefreshCw size={15} />
          {retryLabel}
        </button>
      )}
    </div>
  );
}

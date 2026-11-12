import { Link } from "react-router-dom";
import { Home, Compass } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-secondary px-4">
      <div className="card w-full max-w-md animate-slide-up text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg shadow-slate-900/20">
          <Compass size={26} />
        </div>
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-1 text-5xl font-bold tracking-tight text-ink">Page not found</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm text-ink-muted">
          The page you requested doesn&rsquo;t exist or has moved. Head back to your revenue workspace.
        </p>
        <Link to="/dashboard" className="btn-primary mt-6 w-full">
          <Home size={16} />
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

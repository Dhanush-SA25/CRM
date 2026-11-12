import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Zap,
  Mail,
  Lock,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  WifiOff,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useServerStatus } from "../hooks/useServerStatus";
import AuthShell from "../components/auth/AuthShell";

const REMEMBER_KEY = "smartcrm_remember_email";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { status } = useServerStatus();

  const rememberedEmail = localStorage.getItem(REMEMBER_KEY) || "";
  const [form, setForm] = useState({ email: rememberedEmail, password: "" });
  const [remember, setRemember] = useState(Boolean(rememberedEmail));
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [welcomeName, setWelcomeName] = useState("");

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const fillDemo = () =>
    setForm({ email: "admin@smartcrm.com", password: "admin123" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      if (remember) localStorage.setItem(REMEMBER_KEY, form.email);
      else localStorage.removeItem(REMEMBER_KEY);
      setWelcomeName(user?.name?.split(" ")[0] || "back");
      setSuccess(true);
      setTimeout(() => navigate("/dashboard"), 900);
    } catch (err) {
      if (!err.response) {
        setError(
          "Cannot reach the API at http://localhost:5000. Start the backend, then try again."
        );
      } else if (err.response.status === 429) {
        setError("Too many attempts. Please wait a moment and try again.");
      } else {
        setError(err.response.data?.error || "Invalid email or password");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      {/* Mobile brand */}
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient shadow-sm shadow-slate-900/20">
          <Zap size={20} className="text-white" />
        </span>
        <div>
          <p className="text-lg font-semibold leading-tight text-ink">SmartCRM</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
            Revenue workspace
          </p>
        </div>
      </div>

      <div className="mb-7">
        <p className="eyebrow">Welcome back</p>
        <h1 className="mt-1.5 text-2xl font-semibold text-ink">Sign in to your workspace</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Use your work email to continue to your pipeline.
        </p>
      </div>

      {/* API reachability */}
      {status === "offline" && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          <WifiOff size={16} className="mt-0.5 flex-shrink-0" />
          <span>
            Backend is not reachable at{" "}
            <span className="font-mono text-[12px]">http://localhost:5000</span>. Start it
            with <span className="font-mono text-[12px]">npm run dev:backend</span>.
          </span>
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-card backdrop-blur-xl sm:p-7">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-600">
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="form-label">
              Email address
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={handleChange}
                className="form-input pl-10"
                placeholder="you@company.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={form.password}
                onChange={handleChange}
                className="form-input pl-10 pr-11"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-slate-900"
              />
              Remember me
            </label>
            <button
              type="button"
              onClick={() =>
                setNotice(
                  "Password resets are handled by your workspace administrator — contact admin@smartcrm.com."
                )
              }
              className="text-sm font-medium text-slate-600 underline-offset-4 transition hover:text-slate-900 hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="btn-primary mt-1 w-full py-2.5"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Signing in…
              </>
            ) : (
              <>
                Sign in <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Demo access */}
        <div className="mt-5 rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white px-3.5 py-3">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Demo access</p>
            <span className="badge-gray">Admin</span>
          </div>
          <button
            type="button"
            onClick={fillDemo}
            className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg border border-transparent px-1 py-1 text-left transition hover:border-slate-200 hover:bg-white"
          >
            <span>
              <span className="block text-sm font-medium text-slate-700">
                admin@smartcrm.com
              </span>
              <span className="block font-mono text-[11px] text-slate-400">admin123</span>
            </span>
            <span className="text-[11px] font-medium text-slate-500">Use</span>
          </button>
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            className="font-medium text-slate-800 underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </p>

        {/* Success transition */}
        {success && (
          <div className="absolute inset-0 z-10 flex animate-fade-in flex-col items-center justify-center gap-3 bg-white/95 backdrop-blur">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
              <CheckCircle2 size={22} className="text-emerald-600" />
            </span>
            <p className="text-base font-semibold text-ink">
              Welcome back{welcomeName ? `, ${welcomeName}` : ""}!
            </p>
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 size={12} className="animate-spin" /> Preparing your workspace…
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-slate-400">
        <span
          className={[
            "h-1.5 w-1.5 rounded-full",
            status === "online"
              ? "bg-emerald-500"
              : status === "offline"
                ? "bg-red-500"
                : "bg-amber-400",
          ].join(" ")}
        />
        {status === "online"
          ? "API connected · localhost:5000"
          : status === "offline"
            ? "API offline · localhost:5000"
            : "Checking API connection…"}
      </div>
    </AuthShell>
  );
}

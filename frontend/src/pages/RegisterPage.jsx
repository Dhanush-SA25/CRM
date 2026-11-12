import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Zap,
  User,
  Mail,
  Lock,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/auth/AuthShell";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      setSuccess(true);
      setTimeout(() => navigate("/dashboard"), 800);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          (err.response
            ? "Registration failed. Please review your details."
            : "Cannot reach the API at http://localhost:5000. Start the backend and try again.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
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
        <p className="eyebrow">Get started</p>
        <h1 className="mt-1.5 text-2xl font-semibold text-ink">Create your account</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Set up access to your team&apos;s revenue workspace.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-card backdrop-blur-xl sm:p-7">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="name" className="form-label">Full name</label>
            <div className="relative">
              <User
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={form.name}
                onChange={handleChange}
                className="form-input pl-10"
                placeholder="Jane Smith"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="form-label">Work email</label>
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
            <label htmlFor="password" className="form-label">Password</label>
            <div className="relative">
              <Lock
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={form.password}
                onChange={handleChange}
                className="form-input pl-10 pr-11"
                placeholder="Min. 6 characters"
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

          <div>
            <label htmlFor="confirm" className="form-label">Confirm password</label>
            <div className="relative">
              <Lock
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="confirm"
                name="confirm"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={form.confirm}
                onChange={handleChange}
                className="form-input pl-10"
                placeholder="Repeat your password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="btn-primary mt-1 w-full py-2.5"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Creating account…
              </>
            ) : (
              <>
                Create account <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-slate-800 underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>

        {success && (
          <div className="absolute inset-0 z-10 flex animate-fade-in flex-col items-center justify-center gap-3 bg-white/95 backdrop-blur">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
              <CheckCircle2 size={22} className="text-emerald-600" />
            </span>
            <p className="text-base font-semibold text-ink">Account created</p>
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 size={12} className="animate-spin" /> Preparing your workspace…
            </p>
          </div>
        )}
      </div>
    </AuthShell>
  );
}

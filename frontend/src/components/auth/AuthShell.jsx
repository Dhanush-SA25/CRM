import { Zap, Gauge, Layers, ShieldCheck } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: Gauge,
    title: "Pipeline at a glance",
    text: "Stage-by-stage value, win rate and conversion in one disciplined view.",
  },
  {
    icon: Layers,
    title: "One connected workspace",
    text: "Customers, leads, deals, follow-ups and tasks without tab-switching.",
  },
  {
    icon: ShieldCheck,
    title: "Role-aware by design",
    text: "Admin, manager and sales permissions enforced by the API, not just the UI.",
  },
];

const STATS = [
  { value: "7", label: "Pipeline stages" },
  { value: "3", label: "Access roles" },
  { value: "100%", label: "API-driven" },
];

export default function AuthShell({ children }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[1.05fr_1fr]">
        {/* Brand panel */}
        <aside className="relative hidden overflow-hidden bg-brand-gradient p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.13]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              maskImage: "radial-gradient(70% 70% at 30% 20%, #000 40%, transparent 100%)",
              WebkitMaskImage:
                "radial-gradient(70% 70% at 30% 20%, #000 40%, transparent 100%)",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-white/10 blur-3xl"
          />

          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner-line backdrop-blur">
                <Zap size={20} className="text-white" />
              </span>
              <div>
                <p className="text-lg font-semibold leading-tight">SmartCRM</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                  Revenue workspace
                </p>
              </div>
            </div>

            <h2 className="mt-16 max-w-md text-[2.6rem] font-semibold leading-[1.08] tracking-tight">
              Run revenue with clarity, not spreadsheets.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/60">
              A single operating system for the whole customer journey — from first
              touch to closed-won. Built for teams that expect their CRM to work.
            </p>

            <ul className="mt-10 space-y-5">
              {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3.5">
                  <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07]">
                    <Icon size={16} className="text-white/80" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-white/90">{title}</span>
                    <span className="mt-0.5 block max-w-sm text-xs leading-relaxed text-white/50">
                      {text}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div className="grid grid-cols-3 gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
              {STATS.map(({ value, label }) => (
                <div key={label}>
                  <p className="text-2xl font-semibold tracking-tight text-white">{value}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/45">
                    {label}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[11px] text-white/40">
              © 2026 SmartCRM · Professional edition
            </p>
          </div>
        </aside>

        {/* Form panel */}
        <main className="flex items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md animate-slide-up">{children}</div>
        </main>
      </div>
    </div>
  );
}

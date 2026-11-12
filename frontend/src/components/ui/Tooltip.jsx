import { useId, useState } from "react";
import { Info } from "lucide-react";

export default function Tooltip({ label, children, side = "top", className = "" }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const position =
    side === "bottom"
      ? "top-full mt-2"
      : side === "left"
      ? "right-full mr-2 top-1/2 -translate-y-1/2"
      : side === "right"
      ? "left-full ml-2 top-1/2 -translate-y-1/2"
      : "bottom-full mb-2";

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label={typeof label === "string" ? label : "More information"}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center rounded-full text-slate-400 transition hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-800/30"
      >
        {children ?? <Info size={13} aria-hidden="true" />}
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className={`pointer-events-none absolute z-50 w-max max-w-[240px] rounded-lg bg-slate-900 px-2.5 py-1.5 text-left text-[11px] font-medium leading-snug text-white shadow-lg ${position} ${
            side === "top" || side === "bottom" ? "left-1/2 -translate-x-1/2" : ""
          }`}
        >
          {label}
        </span>
      )}
    </span>
  );
}

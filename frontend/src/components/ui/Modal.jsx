import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Elements that can receive keyboard focus inside the panel.
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Portal-rendered modal overlay + panel.
 *
 * Props:
 *   isOpen   — boolean, controls visibility (renders nothing when false)
 *   onClose  — function, called on backdrop click, Escape key, or close button
 *   title    — string, shown in the panel header
 *   children — modal body content (form fields, lists, etc.)
 *
 * Accessibility:
 *   - role="dialog" / aria-modal="true" / aria-labelledby on the panel
 *   - Escape closes the modal
 *   - focus moves into the panel on open and is restored to the trigger on close
 *   - Tab/Shift+Tab are trapped within the panel while open
 *   - background scrolling is locked while open
 *
 * Validates: Requirements 5.1, 6.1, 7.1
 */
export default function Modal({ isOpen, onClose, title, children }) {
  const panelRef = useRef(null);
  // Keep the latest onClose in a ref so key handlers never reference a stale callback.
  const onCloseRef = useRef(onClose);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;

    // Remember the currently focused element so we can restore it on close.
    previouslyFocusedRef.current = document.activeElement;

    // Lock background scrolling while the modal is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the panel once it has mounted.
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const firstFocusable = panel.querySelector(FOCUSABLE_SELECTOR);
      (firstFocusable ?? panel).focus();
    }, 0);

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = panel.querySelectorAll(FOCUSABLE_SELECTOR);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — clicking it dismisses the modal */}
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        tabIndex={-1}
        className="relative z-10 flex max-h-[90vh] w-full max-w-lg animate-slide-up flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-5 py-4">
          <h2 id="modal-title" className="text-lg font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-800/30"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

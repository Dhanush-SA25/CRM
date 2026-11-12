import { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import { customerService } from "../../services/customerService";

/**
 * Stage options matching the backend VALID_STAGES list,
 * with their default probabilities from STAGE_PROBABILITIES.
 */
const STAGES = [
  { value: "new", label: "New", probability: 10 },
  { value: "contacted", label: "Contacted", probability: 20 },
  { value: "qualified", label: "Qualified", probability: 40 },
  { value: "proposal", label: "Proposal", probability: 60 },
  { value: "negotiation", label: "Negotiation", probability: 80 },
  { value: "won", label: "Won", probability: 100 },
  { value: "lost", label: "Lost", probability: 0 },
];

const STAGE_PROBABILITIES = Object.fromEntries(
  STAGES.map(({ value, probability }) => [value, probability])
);

const LOST_REASON_SUGGESTIONS = [
  "Price too high",
  "Chose a competitor",
  "Budget cut",
  "No decision / stalled",
  "Bad timing",
  "Missing feature",
  "Lost to incumbent",
];

const EMPTY_FORM = {
  title: "",
  value: "",
  stage: "new",
  probability: 10,
  close_date: "",
  customer_id: "",
  notes: "",
  lost_reason: "",
};

function formatDateForInput(isoString) {
  if (!isoString) return "";
  // ISO datetime → "YYYY-MM-DD" for <input type="date">
  return isoString.slice(0, 10);
}

/**
 * DealModal — create or edit a deal.
 *
 * Props:
 *   isOpen   — boolean
 *   onClose  — function called when the modal should close
 *   deal     — null for create, deal object for edit
 *   onSave   — function(formData) called with the form values on submit
 */
export default function DealModal({ isOpen, onClose, deal, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Populate form when the modal opens or the deal prop changes.
  useEffect(() => {
    if (!isOpen) return;

    if (deal) {
      setForm({
        title: deal.title ?? "",
        value: deal.value ?? "",
        stage: deal.stage ?? "new",
        probability: deal.probability ?? 10,
        close_date: formatDateForInput(deal.close_date),
        customer_id: deal.customer_id ?? "",
        notes: deal.notes ?? "",
        lost_reason: deal.lost_reason ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [isOpen, deal]);

  // Fetch customers once when the modal opens.
  useEffect(() => {
    if (!isOpen) return;

    setLoadingCustomers(true);
    customerService
      .list()
      .then((data) => {
        // list() returns { customers: [...] } or just an array — handle both.
        const list = Array.isArray(data) ? data : data.customers ?? [];
        setCustomers(list);
      })
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCustomers(false));
  }, [isOpen]);

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => {
      const next = { ...prev, [name]: value };

      // Auto-fill probability when stage changes.
      if (name === "stage" && STAGE_PROBABILITIES[value] !== undefined) {
        next.probability = STAGE_PROBABILITIES[value];
      }

      return next;
    });

    // Clear the field's error on change.
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  function validate() {
    const errs = {};
    if (!form.title.trim()) errs.title = "Title is required.";
    if (form.value !== "" && isNaN(Number(form.value)))
      errs.value = "Value must be a number.";
    const prob = Number(form.probability);
    if (isNaN(prob) || prob < 0 || prob > 100)
      errs.probability = "Probability must be between 0 and 100.";
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    const payload = {
      title: form.title.trim(),
      value: form.value === "" ? 0 : Number(form.value),
      stage: form.stage,
      probability: Number(form.probability),
      close_date: form.close_date || null,
      customer_id: form.customer_id === "" ? null : Number(form.customer_id),
      notes: form.notes.trim() || null,
      lost_reason: form.stage === "lost" ? form.lost_reason.trim() || null : null,
    };

    setSubmitting(true);
    try {
      await onSave(payload);
      onClose();
    } catch {
      // Let the parent handle error toasts / reporting.
    } finally {
      setSubmitting(false);
    }
  }

  const isEdit = Boolean(deal);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit Deal" : "New Deal"}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">

        {/* Title */}
        <div>
          <label
            htmlFor="deal-title"
            className="form-label"
          >
            Title <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id="deal-title"
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="e.g. Enterprise licence renewal"
            required
            aria-describedby={errors.title ? "deal-title-error" : undefined}
            className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:ring-2 focus:ring-primary-500 ${
              errors.title ? "border-red-400" : "border-slate-300"
            }`}
          />
          {errors.title && (
            <p id="deal-title-error" className="mt-1 text-xs text-red-500">
              {errors.title}
            </p>
          )}
        </div>

        {/* Value */}
        <div>
          <label
            htmlFor="deal-value"
            className="form-label"
          >
            Value ($)
          </label>
          <input
            id="deal-value"
            type="number"
            name="value"
            value={form.value}
            onChange={handleChange}
            min="0"
            step="0.01"
            placeholder="0.00"
            aria-describedby={errors.value ? "deal-value-error" : undefined}
            className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:ring-2 focus:ring-primary-500 ${
              errors.value ? "border-red-400" : "border-slate-300"
            }`}
          />
          {errors.value && (
            <p id="deal-value-error" className="mt-1 text-xs text-red-500">
              {errors.value}
            </p>
          )}
        </div>

        {/* Stage + Probability side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="deal-stage"
              className="form-label"
            >
              Stage
            </label>
            <select
              id="deal-stage"
              name="stage"
              value={form.stage}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-primary-500"
            >
              {STAGES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="deal-probability"
              className="form-label"
            >
              Probability (%)
            </label>
            <input
              id="deal-probability"
              type="number"
              name="probability"
              value={form.probability}
              onChange={handleChange}
              min="0"
              max="100"
              aria-describedby={
                errors.probability ? "deal-probability-error" : undefined
              }
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-primary-500 ${
                errors.probability ? "border-red-400" : "border-slate-300"
              }`}
            />
            {errors.probability && (
              <p
                id="deal-probability-error"
                className="mt-1 text-xs text-red-500"
              >
                {errors.probability}
              </p>
            )}
          </div>
        </div>

        {/* Close Date */}
        <div>
          <label
            htmlFor="deal-close-date"
            className="form-label"
          >
            Close Date
          </label>
          <input
            id="deal-close-date"
            type="date"
            name="close_date"
            value={form.close_date}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Lost reason — only relevant when the deal is marked lost */}
        {form.stage === "lost" && (
          <div>
            <label htmlFor="deal-lost-reason" className="form-label">
              Lost reason
            </label>
            <input
              id="deal-lost-reason"
              type="text"
              name="lost_reason"
              value={form.lost_reason}
              onChange={handleChange}
              list="deal-lost-reason-options"
              placeholder="Why was this deal lost?"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:ring-2 focus:ring-primary-500"
            />
            <datalist id="deal-lost-reason-options">
              {LOST_REASON_SUGGESTIONS.map((reason) => (
                <option key={reason} value={reason} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-slate-400">
              Optional — captured for lost-deal reason analysis.
            </p>
          </div>
        )}

        {/* Customer */}
        <div>
          <label
            htmlFor="deal-customer"
            className="form-label"
          >
            Customer
          </label>
          <select
            id="deal-customer"
            name="customer_id"
            value={form.customer_id}
            onChange={handleChange}
            disabled={loadingCustomers}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
          >
            <option value="">
              {loadingCustomers ? "Loading…" : "— None —"}
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="deal-notes"
            className="form-label"
          >
            Notes
          </label>
          <textarea
            id="deal-notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            placeholder="Any additional context…"
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
          >
            {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Deal"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

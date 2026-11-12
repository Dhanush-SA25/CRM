import { useState, useEffect } from "react";
import Modal from "../ui/Modal";

/** Format an ISO date/datetime string to YYYY-MM-DD for <input type="date">. */
function formatDateForInput(isoString) {
  if (!isoString) return "";
  // Handles both "2024-06-15" and "2024-06-15T10:30:00"
  return isoString.split("T")[0];
}

const EMPTY_FORM = {
  title: "",
  notes: "",
  due_date: "",
  status: "pending",
  priority: "medium",
  linked_type: "lead",
  linked_id: "",
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const LINKED_TYPE_OPTIONS = [
  { value: "lead", label: "Lead" },
  { value: "customer", label: "Customer" },
  { value: "deal", label: "Deal" },
];

/**
 * Modal for creating or editing a follow-up.
 *
 * Props:
 *   isOpen    — boolean
 *   onClose   — function
 *   followup  — null (create mode) | object (edit mode)
 *   onSave    — async function(payload) — called with the form payload
 */
export default function FollowUpModal({ isOpen, onClose, followup, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Populate form when the modal opens or followup prop changes.
  useEffect(() => {
    if (!isOpen) return;

    if (followup) {
      setForm({
        title: followup.title ?? "",
        // Backend field is "description", but the form uses "notes" as the label
        notes: followup.description ?? "",
        due_date: formatDateForInput(followup.due_date),
        status: followup.status === "overdue" ? "pending" : (followup.status ?? "pending"),
        priority: followup.priority ?? "medium",
        linked_type: followup.linked_type ?? "lead",
        linked_id: followup.linked_id ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [isOpen, followup]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  function validate() {
    const errs = {};
    if (!form.title.trim()) errs.title = "Title is required.";
    if (!form.due_date) errs.due_date = "Due date is required.";
    if (!form.linked_id) {
      errs.linked_id = "Linked ID is required.";
    } else if (isNaN(Number(form.linked_id)) || Number(form.linked_id) <= 0) {
      errs.linked_id = "Linked ID must be a positive number.";
    }
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    // Build ISO datetime from date input (append T00:00:00 for backend parsing)
    const dueDateISO = form.due_date ? `${form.due_date}T00:00:00` : null;

    const payload = {
      title: form.title.trim(),
      description: form.notes.trim() || null,  // backend uses "description"
      due_date: dueDateISO,
      status: form.status,
      priority: form.priority,
      linked_type: form.linked_type,
      linked_id: Number(form.linked_id),
    };

    setSubmitting(true);
    try {
      await onSave(payload);
      onClose();
    } catch {
      // Let the parent handle error reporting.
    } finally {
      setSubmitting(false);
    }
  }

  const isEdit = Boolean(followup);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Follow-Up" : "New Follow-Up"}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">

        {/* Title */}
        <div>
          <label
            htmlFor="fu-title"
            className="form-label"
          >
            Title <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id="fu-title"
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="e.g. Follow up on proposal"
            required
            aria-describedby={errors.title ? "fu-title-error" : undefined}
            className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:ring-2 focus:ring-primary-500 ${
              errors.title ? "border-red-400" : "border-slate-300"
            }`}
          />
          {errors.title && (
            <p id="fu-title-error" className="mt-1 text-xs text-red-500">
              {errors.title}
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="fu-notes"
            className="form-label"
          >
            Notes
          </label>
          <textarea
            id="fu-notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            placeholder="Any additional context…"
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Due Date */}
        <div>
          <label
            htmlFor="fu-due-date"
            className="form-label"
          >
            Due Date <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id="fu-due-date"
            type="date"
            name="due_date"
            value={form.due_date}
            onChange={handleChange}
            required
            aria-describedby={errors.due_date ? "fu-due-date-error" : undefined}
            className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-primary-500 ${
              errors.due_date ? "border-red-400" : "border-slate-300"
            }`}
          />
          {errors.due_date && (
            <p id="fu-due-date-error" className="mt-1 text-xs text-red-500">
              {errors.due_date}
            </p>
          )}
        </div>

        {/* Status + Priority side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="fu-status"
              className="form-label"
            >
              Status
            </label>
            <select
              id="fu-status"
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-primary-500"
            >
              {STATUS_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="fu-priority"
              className="form-label"
            >
              Priority
            </label>
            <select
              id="fu-priority"
              name="priority"
              value={form.priority}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-primary-500"
            >
              {PRIORITY_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Linked Type + Linked ID side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="fu-linked-type"
              className="form-label"
            >
              Linked To
            </label>
            <select
              id="fu-linked-type"
              name="linked_type"
              value={form.linked_type}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-primary-500"
            >
              {LINKED_TYPE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="fu-linked-id"
              className="form-label"
            >
              Linked ID <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="fu-linked-id"
              type="number"
              name="linked_id"
              value={form.linked_id}
              onChange={handleChange}
              min="1"
              placeholder="e.g. 1"
              required
              aria-describedby={errors.linked_id ? "fu-linked-id-error" : undefined}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:ring-2 focus:ring-primary-500 ${
                errors.linked_id ? "border-red-400" : "border-slate-300"
              }`}
            />
            {errors.linked_id && (
              <p id="fu-linked-id-error" className="mt-1 text-xs text-red-500">
                {errors.linked_id}
              </p>
            )}
          </div>
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
            {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Follow-Up"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

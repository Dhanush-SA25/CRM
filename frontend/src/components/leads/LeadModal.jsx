import { useState, useEffect } from "react";
import Modal from "../ui/Modal";

const LEAD_STATUSES = ["new", "contacted", "qualified", "lost"];
const LEAD_SOURCES = ["website", "referral", "linkedin", "cold_call", "other"];

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  company: "",
  source: "",
  status: "new",
  notes: "",
};

/**
 * Modal form for creating or editing a Lead.
 *
 * Props:
 *   isOpen  — boolean, controls visibility
 *   onClose — function, called when the modal should close
 *   lead    — null for create mode; lead object for edit mode
 *   onSave  — async function(formData), called with the submitted values
 *
 * Validates: Requirements 6.1, 6.2, 6.3
 */
export default function LeadModal({ isOpen, onClose, lead, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Populate form when opening in edit mode, or reset for create mode.
  useEffect(() => {
    if (isOpen) {
      setError("");
      setSaving(false);
      if (lead) {
        setForm({
          name: lead.name ?? "",
          email: lead.email ?? "",
          phone: lead.phone ?? "",
          company: lead.company ?? "",
          source: lead.source ?? "",
          status: lead.status ?? "new",
          notes: lead.notes ?? "",
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [isOpen, lead]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (!form.email.trim()) { setError("Email is required."); return; }

    setSaving(true);
    setError("");
    try {
      await onSave({ ...form });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error ?? err?.message ?? "Failed to save lead.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={lead ? "Edit Lead" : "Create Lead"}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Name */}
        <div>
          <label htmlFor="lead-name" className="form-label">
            Name <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <input
            id="lead-name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            required
            className="form-input"
            placeholder="Jane Smith"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="lead-email" className="form-label">
            Email <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <input
            id="lead-email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
            className="form-input"
            placeholder="jane@example.com"
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="lead-phone" className="form-label">
            Phone
          </label>
          <input
            id="lead-phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            className="form-input"
            placeholder="+1 555 123 4567"
          />
        </div>

        {/* Source / Status row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="lead-source" className="form-label">
              Source
            </label>
            <select
              id="lead-source"
              name="source"
              value={form.source}
              onChange={handleChange}
              className="form-input"
            >
              <option value="">— None —</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="lead-status" className="form-label">
              Status
            </label>
            <select
              id="lead-status"
              name="status"
              value={form.status}
              onChange={handleChange}
              className="form-input"
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Company */}
        <div>
          <label htmlFor="lead-company" className="form-label">
            Company
          </label>
          <input
            id="lead-company"
            name="company"
            type="text"
            value={form.company}
            onChange={handleChange}
            className="form-input"
            placeholder="Acme Corp"
            autoComplete="off"
          />
        </div>

        {/* Score is derived server-side — never entered manually. */}
        <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
          <span className="font-medium text-slate-600">Lead score is automatic.</span>{" "}
          It is computed from source, status, contact completeness, business email, notes and
          recency — open the score badge after saving to see the breakdown.
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="lead-notes" className="form-label">
            Notes
          </label>
          <textarea
            id="lead-notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            className="form-input resize-none"
            placeholder="Any additional context…"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : lead ? "Update Lead" : "Create Lead"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

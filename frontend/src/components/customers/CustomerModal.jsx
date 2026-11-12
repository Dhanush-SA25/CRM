import { useState, useEffect } from "react";
import Modal from "../ui/Modal";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  company: "",
  status: "prospect",
  notes: "",
};

/**
 * Modal for creating or editing a customer.
 *
 * Props:
 *   isOpen   — boolean
 *   onClose  — () => void
 *   customer — null for create, customer object for edit
 *   onSave   — (formData) => Promise<void>  — called with the submitted values
 */
export default function CustomerModal({ isOpen, onClose, customer, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Populate form when editing an existing customer or reset for create.
  useEffect(() => {
    if (isOpen) {
      setError("");
      setSaving(false);
      if (customer) {
        setForm({
          name: customer.name ?? "",
          email: customer.email ?? "",
          phone: customer.phone ?? "",
          company: customer.company ?? "",
          status: customer.status ?? "prospect",
          notes: customer.notes ?? "",
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [isOpen, customer]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!form.email.trim()) {
      setError("Email is required.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Failed to save customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={customer ? "Edit Customer" : "Create Customer"}
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {/* Name */}
        <div className="mb-4">
          <label className="form-label" htmlFor="cm-name">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="cm-name"
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            className="form-input"
            placeholder="Jane Smith"
            required
            autoComplete="off"
          />
        </div>

        {/* Email */}
        <div className="mb-4">
          <label className="form-label" htmlFor="cm-email">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="cm-email"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="form-input"
            placeholder="jane@example.com"
            required
            autoComplete="off"
          />
        </div>

        {/* Phone */}
        <div className="mb-4">
          <label className="form-label" htmlFor="cm-phone">
            Phone
          </label>
          <input
            id="cm-phone"
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            className="form-input"
            placeholder="+1 555 000 0000"
            autoComplete="off"
          />
        </div>

        {/* Company */}
        <div className="mb-4">
          <label className="form-label" htmlFor="cm-company">
            Company
          </label>
          <input
            id="cm-company"
            type="text"
            name="company"
            value={form.company}
            onChange={handleChange}
            className="form-input"
            placeholder="Acme Corp"
            autoComplete="off"
          />
        </div>

        {/* Status */}
        <div className="mb-4">
          <label className="form-label" htmlFor="cm-status">
            Status
          </label>
          <select
            id="cm-status"
            name="status"
            value={form.status}
            onChange={handleChange}
            className="form-input"
          >
            <option value="prospect">Prospect</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="form-label" htmlFor="cm-notes">
            Notes
          </label>
          <textarea
            id="cm-notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            className="form-input min-h-[80px] resize-y"
            placeholder="Any relevant notes…"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : customer ? "Save Changes" : "Create Customer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

import { useState, useEffect } from "react";
import Modal from "../ui/Modal";

const TASK_STATUSES = [
  { value: "todo",        label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done",        label: "Done" },
];

const TASK_PRIORITIES = [
  { value: "low",    label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high",   label: "High" },
];

const EMPTY_FORM = {
  title:       "",
  description: "",
  due_date:    "",
  status:      "todo",
  priority:    "medium",
  assigned_to: "",
};

/**
 * Modal form for creating or editing a Task.
 *
 * Props:
 *   isOpen      — boolean, controls visibility
 *   onClose     — function, called when the modal should close
 *   task        — null for create mode; task object for edit mode
 *   onSave      — async function(formData), called with the submitted values
 */
export default function TaskModal({ isOpen, onClose, task, onSave }) {
  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  // Populate form when opening in edit mode, or reset for create mode.
  useEffect(() => {
    if (isOpen) {
      setError("");
      setSaving(false);
      if (task) {
        setForm({
          title:       task.title       ?? "",
          description: task.description ?? "",
          // Store only the date portion (YYYY-MM-DD) for the date input.
          due_date:    task.due_date ? task.due_date.slice(0, 10) : "",
          status:      task.status      ?? "todo",
          priority:    task.priority    ?? "medium",
          assigned_to: task.assigned_to != null ? String(task.assigned_to) : "",
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [isOpen, task]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }

    // Build payload — omit blank optional fields.
    const payload = {
      title:       form.title.trim(),
      description: form.description.trim(),
      due_date:    form.due_date || null,
      status:      form.status,
      priority:    form.priority,
    };
    if (form.assigned_to !== "") {
      const parsed = parseInt(form.assigned_to, 10);
      if (!isNaN(parsed)) payload.assigned_to = parsed;
    }

    setSaving(true);
    setError("");
    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error ?? err?.message ?? "Failed to save task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task ? "Edit Task" : "Create Task"}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Title */}
        <div>
          <label htmlFor="task-title" className="form-label">
            Title <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <input
            id="task-title"
            name="title"
            type="text"
            value={form.title}
            onChange={handleChange}
            required
            className="form-input"
            placeholder="Task title"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="task-description" className="form-label">
            Description
          </label>
          <textarea
            id="task-description"
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            className="form-input resize-none"
            placeholder="Optional details about this task…"
          />
        </div>

        {/* Due Date */}
        <div>
          <label htmlFor="task-due-date" className="form-label">
            Due Date
          </label>
          <input
            id="task-due-date"
            name="due_date"
            type="date"
            value={form.due_date}
            onChange={handleChange}
            className="form-input"
          />
        </div>

        {/* Status / Priority row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="task-status" className="form-label">
              Status
            </label>
            <select
              id="task-status"
              name="status"
              value={form.status}
              onChange={handleChange}
              className="form-input"
            >
              {TASK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="task-priority" className="form-label">
              Priority
            </label>
            <select
              id="task-priority"
              name="priority"
              value={form.priority}
              onChange={handleChange}
              className="form-input"
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Assigned To */}
        <div>
          <label htmlFor="task-assigned-to" className="form-label">
            Assigned To <span className="text-slate-400 font-normal">(user ID, optional)</span>
          </label>
          <input
            id="task-assigned-to"
            name="assigned_to"
            type="number"
            min={1}
            value={form.assigned_to}
            onChange={handleChange}
            className="form-input"
            placeholder="Leave blank for unassigned"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : task ? "Update Task" : "Create Task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

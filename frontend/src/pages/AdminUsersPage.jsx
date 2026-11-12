import { useState, useCallback, useEffect } from "react";
import { Plus, Pencil } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { adminService } from "../services/adminService";
import Modal from "../components/ui/Modal";
import PageHeader from "../components/ui/PageHeader";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import EmptyState from "../components/ui/EmptyState";
import Badge from "../components/ui/Badge";
import { formatDate } from "../utils/formatters";

/** Badge colour by role per design spec (admin=red, manager=blue, sales=green). */
const ROLE_BADGE_COLORS = {
  admin:   "badge-red",
  manager: "badge-blue",
  sales:   "badge-green",
};

const ROLES = ["admin", "manager", "sales"];

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  role: "sales",
};

/**
 * Modal form for creating or editing a user.
 *
 * Props:
 *   isOpen   — boolean
 *   onClose  — function
 *   user     — null for create mode; user object for edit mode
 *   onSave   — async function(formData)
 *
 * Validates: Requirements 9.1, 9.2, 9.3
 */
function UserModal({ isOpen, onClose, user, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset / populate form whenever the modal opens.
  useEffect(() => {
    if (isOpen) {
      setError("");
      setSaving(false);
      if (user) {
        setForm({
          name: user.name ?? "",
          email: user.email ?? "",
          password: "",           // password left blank means "no change"
          role: user.role ?? "sales",
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [isOpen, user]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (!form.email.trim()) { setError("Email is required."); return; }
    if (!user && !form.password.trim()) { setError("Password is required for new users."); return; }

    const payload = { name: form.name, email: form.email, role: form.role };
    // Only send password if it was provided (create always, edit only when changed).
    if (form.password.trim()) payload.password = form.password;

    setSaving(true);
    setError("");
    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error ?? err?.message ?? "Failed to save user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={user ? "Edit User" : "Create User"}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Name */}
        <div>
          <label htmlFor="user-name" className="form-label">
            Name <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <input
            id="user-name"
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
          <label htmlFor="user-email" className="form-label">
            Email <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <input
            id="user-email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
            className="form-input"
            placeholder="jane@example.com"
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="user-password" className="form-label">
            Password{" "}
            {user && (
              <span className="text-slate-400 font-normal">(leave blank to keep current)</span>
            )}
            {!user && <span aria-hidden="true" className="text-red-500">*</span>}
          </label>
          <input
            id="user-password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required={!user}
            className="form-input"
            placeholder={user ? "••••••••" : "Min. 8 characters"}
            autoComplete={user ? "new-password" : "new-password"}
          />
        </div>

        {/* Role */}
        <div>
          <label htmlFor="user-role" className="form-label">
            Role <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <select
            id="user-role"
            name="role"
            value={form.role}
            onChange={handleChange}
            className="form-input"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : user ? "Update User" : "Create User"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Toggle switch — a styled checkbox rendered as a pill toggle.
 *
 * Props:
 *   checked  — boolean
 *   onChange — function(newValue: boolean)
 *   disabled — boolean
 *   label    — accessible label string
 */
function ToggleSwitch({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1",
        checked ? "bg-primary-600" : "bg-slate-300",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200",
          checked ? "translate-x-4" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

/**
 * Admin → Users management page.
 *
 * Shows a table of all users; lets an admin create new users, edit existing
 * ones (name, email, role, optionally password), and toggle their active
 * status in-place with a toggle switch.
 *
 * Validates: Requirements 9.1, 9.2, 9.3
 */
export default function AdminUsersPage() {
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null = create mode

  // Track which user's active toggle is mid-flight to disable it during the call.
  const [togglingId, setTogglingId] = useState(null);

  // Reload counter — incrementing forces useApi to re-fetch.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  const fetchUsers = useCallback(() => adminService.listUsers(), [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: users, loading, error } = useApi(fetchUsers, [reloadKey]);

  const userList = Array.isArray(users) ? users : [];

  // ── Handlers ────────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingUser(null);
    setModalOpen(true);
  }

  function openEdit(user) {
    setEditingUser(user);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingUser(null);
  }

  async function handleSave(formData) {
    if (editingUser) {
      await adminService.updateUser(editingUser.id, formData);
    } else {
      await adminService.createUser(formData);
    }
    reload();
  }

  async function handleToggleActive(user) {
    setTogglingId(user.id);
    try {
      await adminService.updateUser(user.id, { is_active: !user.is_active });
      reload();
    } catch {
      // Silently swallow — the toggle will revert on next reload.
    } finally {
      setTogglingId(null);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Users"
        description={`${userList.length} total user${userList.length !== 1 ? "s" : ""}`}
        action={
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} />
            Create User
          </button>
        }
      />

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : userList.length === 0 ? (
        <EmptyState
          title="No users yet"
          description="Create the first user to get started."
          action={
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={16} />
              Create User
            </button>
          }
        />
      ) : (
        <div className="card data-table overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Name", "Email", "Role", "Active", "Created", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {userList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    {/* Name */}
                    <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>

                    {/* Email */}
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>

                    {/* Role badge */}
                    <td className="px-4 py-3">
                      <Badge className={ROLE_BADGE_COLORS[u.role] ?? "badge-gray"}>
                        {u.role
                          ? u.role.charAt(0).toUpperCase() + u.role.slice(1)
                          : "—"}
                      </Badge>
                    </td>

                    {/* Active toggle */}
                    <td className="px-4 py-3">
                      <ToggleSwitch
                        checked={!!u.is_active}
                        onChange={() => handleToggleActive(u)}
                        disabled={togglingId === u.id}
                        label={`Toggle active for ${u.name}`}
                      />
                    </td>

                    {/* Created date */}
                    <td className="px-4 py-3 text-slate-400">
                      {formatDate(u.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        aria-label={`Edit ${u.name}`}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <UserModal
        isOpen={modalOpen}
        onClose={closeModal}
        user={editingUser}
        onSave={handleSave}
      />
    </div>
  );
}

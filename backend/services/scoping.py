"""Role-aware record visibility.

Visibility rules (enforced server-side):

* ``admin``   — every record in the workspace.
* ``manager`` — their own records plus records owned by their direct reports
  (``User.manager_id`` points at the manager).
* ``sales``   — only records assigned to themselves.

Callers filter lists with :func:`scope_query` and guard single-record actions
with :func:`can_access_owner`.
"""
from flask_jwt_extended import get_jwt, get_jwt_identity

from models.user import User


def get_current_user_id() -> int:
    return int(get_jwt_identity())


def current_role() -> str:
    return get_jwt().get("role") or "sales"


def is_admin() -> bool:
    return current_role() == "admin"


def is_admin_or_manager() -> bool:
    return current_role() in ("admin", "manager")


def managed_user_ids():
    """Ids of the current manager's direct reports."""
    manager_id = get_current_user_id()
    rows = (
        User.query.filter(User.manager_id == manager_id)
        .with_entities(User.id)
        .all()
    )
    return [row[0] for row in rows]


def visible_user_ids():
    """Owner ids visible to the caller. ``None`` means unrestricted (admin)."""
    role = current_role()
    user_id = get_current_user_id()
    if role == "admin":
        return None
    if role == "manager":
        return [user_id] + managed_user_ids()
    return [user_id]


def scoped_query(query, model, field="assigned_to"):
    """Restrict ``query`` to records the caller is allowed to see."""
    ids = visible_user_ids()
    if ids is not None:
        query = query.filter(getattr(model, field).in_(ids))
    return query


def can_access_owner(owner_id) -> bool:
    """True when the caller may act on a record owned by ``owner_id``."""
    ids = visible_user_ids()
    if ids is None:
        return True
    return owner_id in ids


def can_assign_to(user_id) -> bool:
    """True when the caller may assign work to ``user_id``.

    Admins may assign to anyone; managers to themselves or their reports;
    sales users only to themselves.
    """
    return can_access_owner(user_id)

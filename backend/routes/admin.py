"""Admin user-management routes.

All endpoints are guarded by ``role_required("admin")`` so only admins can
list, create, retrieve, or modify users.
Validates: Requirements 9.1, 9.2, 9.3
"""
from flask import Blueprint, request, jsonify
from database.db import db
from models.user import User
from services.rbac import role_required

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

# Valid roles per requirement 2.1
VALID_ROLES = ("admin", "manager", "sales")


@admin_bp.get("/users")
@role_required("admin")
def list_users():
    """List all users.

    Returns every user field except the password hash (``User.to_dict``
    already omits ``password_hash``).
    Validates: Requirements 9.1
    """
    users = User.query.order_by(User.id.asc()).all()
    return jsonify({"users": [u.to_dict() for u in users]}), 200


@admin_bp.post("/users")
@role_required("admin")
def create_user():
    """Create a new user.

    Accepts ``name``, ``email``, ``password`` and ``role``. The password is
    hashed with the same method used by auth registration
    (``User.set_password`` -> werkzeug ``generate_password_hash``).
    Validates: Requirements 9.2
    """
    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role", "sales")

    # Required fields
    if not name or not email or not password:
        return jsonify({"error": "name, email and password are required"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    if role not in VALID_ROLES:
        return jsonify({"error": "role must be 'admin', 'manager', or 'sales'"}), 400

    manager_id = data.get("manager_id")
    if manager_id is not None:
        if not isinstance(manager_id, int) or not db.session.get(User, manager_id):
            return jsonify({"error": "manager_id must reference an existing user"}), 400

    user = User(name=name, email=email, role=role, manager_id=manager_id)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify({"user": user.to_dict()}), 201


@admin_bp.get("/users/<int:user_id>")
@role_required("admin")
def get_user(user_id):
    """Retrieve a single user by id.
    Validates: Requirements 9.1
    """
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": user.to_dict()}), 200


@admin_bp.put("/users/<int:user_id>")
@role_required("admin")
def update_user(user_id):
    """Update a user's role and/or ``is_active`` flag.

    Only ``role`` and ``is_active`` are editable through this endpoint.
    Validates: Requirements 9.3
    """
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json(silent=True) or {}

    if "role" in data:
        if data["role"] not in VALID_ROLES:
            return jsonify({"error": "role must be 'admin', 'manager', or 'sales'"}), 400
        user.role = data["role"]

    if "is_active" in data:
        value = data["is_active"]
        if isinstance(value, bool):
            user.is_active = value
        elif isinstance(value, str) and value.lower() in ("true", "false"):
            user.is_active = value.lower() == "true"
        else:
            return jsonify({"error": "is_active must be a boolean"}), 400

    if "manager_id" in data:
        manager_id = data["manager_id"]
        if manager_id is None:
            user.manager_id = None
        else:
            if not isinstance(manager_id, int) or not db.session.get(User, manager_id):
                return jsonify({"error": "manager_id must reference an existing user"}), 400
            if manager_id == user_id:
                return jsonify({"error": "A user cannot report to themselves"}), 400
            user.manager_id = manager_id

    db.session.commit()
    return jsonify({"user": user.to_dict()}), 200

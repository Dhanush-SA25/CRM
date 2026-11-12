"""FollowUp CRUD routes."""
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from database.db import db
from models.followup import FollowUp
from services.scoping import can_access_owner, can_assign_to, get_current_user_id, scoped_query

followups_bp = Blueprint("followups", __name__, url_prefix="/api/followups")

# Allowed enum values (see requirements 3.1)
VALID_LINKED_TYPES = ("customer", "lead")
VALID_STATUSES = ("pending", "completed", "overdue")
VALID_PRIORITIES = ("low", "medium", "high")


def _parse_due_date(value):
    """Parse an ISO-8601 datetime string.

    Returns (datetime, error_message). On failure datetime is None.
    """
    try:
        return datetime.fromisoformat(value), None
    except (ValueError, TypeError):
        return None, "due_date must be a valid ISO datetime"


def _to_int(value):
    """Coerce a value to int, returning (int, error_message)."""
    try:
        return int(value), None
    except (ValueError, TypeError):
        return None, "must be an integer"


@followups_bp.get("/")
@jwt_required()
def list_followups():
    """List follow-ups with optional filters.

    Applies ``scoped_query`` so sales reps only see their own follow-ups,
    then applies optional ``?status``, ``?linked_type``, ``?linked_id`` and
    ``?assigned_to`` filters.
    Validates: Requirements 3.2, 3.5
    """
    status = request.args.get("status", "").strip()
    priority = request.args.get("priority", "").strip()
    linked_type = request.args.get("linked_type", "").strip()
    linked_id = request.args.get("linked_id", type=int)
    assigned_to = request.args.get("assigned_to", type=int)

    # Scope to the current user for sales reps (no-op for admin/manager)
    query = scoped_query(FollowUp.query, FollowUp)

    # Optional filters. "overdue" is computed at serialisation time, so it
    # must be translated into its underlying predicate here.
    if status == "overdue":
        query = query.filter(
            FollowUp.status == "pending", FollowUp.due_date < datetime.utcnow()
        )
    elif status:
        query = query.filter_by(status=status)
    if priority:
        query = query.filter_by(priority=priority)
    if linked_type:
        query = query.filter_by(linked_type=linked_type)
    if linked_id is not None:
        query = query.filter_by(linked_id=linked_id)
    if assigned_to is not None:
        query = query.filter_by(assigned_to=assigned_to)

    followups = query.order_by(FollowUp.due_date.asc()).all()
    return jsonify({"followups": [f.to_dict() for f in followups]}), 200


@followups_bp.post("/")
@jwt_required()
def create_followup():
    """Create a new follow-up.

    ``created_by`` is set to the current user id. ``assigned_to`` defaults to
    the current user when not supplied so the creator can always see the
    follow-up they just created.
    Validates: Requirements 3.2
    """
    data = request.get_json(silent=True) or {}

    # Required fields
    if not data.get("title"):
        return jsonify({"error": "title is required"}), 400
    if not data.get("due_date"):
        return jsonify({"error": "due_date is required"}), 400
    if not data.get("linked_type"):
        return jsonify({"error": "linked_type is required"}), 400
    if data.get("linked_id") is None:
        return jsonify({"error": "linked_id is required"}), 400

    # Validate enum fields
    if data["linked_type"] not in VALID_LINKED_TYPES:
        return jsonify({"error": "linked_type must be 'customer' or 'lead'"}), 400
    status = data.get("status", "pending")
    if status not in VALID_STATUSES:
        return jsonify({"error": "status must be 'pending', 'completed', or 'overdue'"}), 400
    priority = data.get("priority", "medium")
    if priority not in VALID_PRIORITIES:
        return jsonify({"error": "priority must be 'low', 'medium', or 'high'"}), 400

    # Parse due_date
    due_date, err = _parse_due_date(data["due_date"])
    if err:
        return jsonify({"error": err}), 400

    # Parse linked_id
    linked_id, err = _to_int(data["linked_id"])
    if err:
        return jsonify({"error": "linked_id " + err}), 400

    user_id = get_current_user_id()

    # assigned_to defaults to the current user when not supplied
    assigned_to = data.get("assigned_to")
    if assigned_to is None:
        assigned_to = user_id
    else:
        assigned_to, err = _to_int(assigned_to)
        if err:
            return jsonify({"error": "assigned_to " + err}), 400
        if not can_assign_to(assigned_to):
            return jsonify({"error": "Forbidden: cannot assign outside your team"}), 403

    followup = FollowUp(
        title=data["title"].strip(),
        description=data.get("description"),
        due_date=due_date,
        status=status,
        priority=priority,
        linked_type=data["linked_type"],
        linked_id=linked_id,
        assigned_to=assigned_to,
        created_by=user_id,
    )
    db.session.add(followup)
    db.session.commit()
    return jsonify({"followup": followup.to_dict()}), 201


@followups_bp.get("/<int:followup_id>")
@jwt_required()
def get_followup(followup_id):
    """Retrieve a single follow-up.

    Sales reps can only access follow-ups assigned to them.
    Validates: Requirements 3.2, 3.5
    """
    followup = db.session.get(FollowUp, followup_id)
    if not followup:
        return jsonify({"error": "Follow-up not found"}), 404

    if not can_access_owner(followup.assigned_to):
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({"followup": followup.to_dict()}), 200


@followups_bp.put("/<int:followup_id>")
@jwt_required()
def update_followup(followup_id):
    """Update a follow-up.

    Sales reps can only modify their own record; managers/admins are
    unrestricted.
    Validates: Requirements 3.2, 3.5
    """
    followup = db.session.get(FollowUp, followup_id)
    if not followup:
        return jsonify({"error": "Follow-up not found"}), 404

    if not can_access_owner(followup.assigned_to):
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}

    # Validate enum fields if present
    if "status" in data and data["status"] not in VALID_STATUSES:
        return jsonify({"error": "status must be 'pending', 'completed', or 'overdue'"}), 400
    if "priority" in data and data["priority"] not in VALID_PRIORITIES:
        return jsonify({"error": "priority must be 'low', 'medium', or 'high'"}), 400
    if "linked_type" in data and data["linked_type"] not in VALID_LINKED_TYPES:
        return jsonify({"error": "linked_type must be 'customer' or 'lead'"}), 400

    # due_date needs ISO parsing
    if "due_date" in data:
        due_date, err = _parse_due_date(data["due_date"])
        if err:
            return jsonify({"error": err}), 400
        followup.due_date = due_date

    # Integer FK fields need coercion
    if "linked_id" in data and data["linked_id"] is not None:
        linked_id, err = _to_int(data["linked_id"])
        if err:
            return jsonify({"error": "linked_id " + err}), 400
        followup.linked_id = linked_id
    if "assigned_to" in data and data["assigned_to"] is not None:
        assigned_to, err = _to_int(data["assigned_to"])
        if err:
            return jsonify({"error": "assigned_to " + err}), 400
        if not can_assign_to(assigned_to):
            return jsonify({"error": "Forbidden: cannot assign outside your team"}), 403
        followup.assigned_to = assigned_to

    # Simple scalar fields
    for field in ["title", "description", "status", "priority", "linked_type"]:
        if field in data:
            setattr(followup, field, data[field])

    db.session.commit()
    return jsonify({"followup": followup.to_dict()}), 200


@followups_bp.delete("/<int:followup_id>")
@jwt_required()
def delete_followup(followup_id):
    """Delete a follow-up.

    Sales reps are restricted to their own records; managers/admins are
    unrestricted.
    Validates: Requirements 3.2, 3.5
    """
    followup = db.session.get(FollowUp, followup_id)
    if not followup:
        return jsonify({"error": "Follow-up not found"}), 404

    if not can_access_owner(followup.assigned_to):
        return jsonify({"error": "Forbidden"}), 403

    db.session.delete(followup)
    db.session.commit()
    return jsonify({"message": "Follow-up deleted"}), 200

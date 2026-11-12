"""Activity / interaction log routes."""
from datetime import datetime, time, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func, or_

from database.db import db
from models.activity import Activity
from models.customer import Customer
from models.deal import Deal
from models.employee import Employee
from models.lead import Lead
from services.scoping import can_access_owner, scoped_query

activities_bp = Blueprint("activities", __name__, url_prefix="/api/activities")

VALID_TYPES = ("call", "email", "meeting", "note", "task")
VALID_LINKED_TYPES = ("customer", "lead", "deal")
VALID_STATUSES = ("pending", "completed", "cancelled")
VALID_DIRECTIONS = ("sent", "received")

_MAX_TITLE = 200
_MAX_DESCRIPTION = 20000
_MAX_OUTCOME = 80
_MAX_RECIPIENT = 160
_MAX_PARTICIPANTS = 2000
_MAX_LOCATION = 200


def _optional_int(value):
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _parse_datetime_value(value):
    """Accept ISO datetime / date strings and ``None``; return (value, error)."""
    if value is None or value == "":
        return None, None
    if isinstance(value, datetime):
        return value, None
    try:
        text = str(value).strip()
        if not text:
            return None, None
        # ``datetime.fromisoformat`` accepts both date and datetime strings.
        return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None), None
    except ValueError:
        return None, "must be a valid ISO date/time"


def _parse_date_bound(value, end=False):
    if not value:
        return None, None
    parsed, error = _parse_datetime_value(value)
    if error:
        return None, error
    if len(str(value).strip()) == 10 and parsed is not None:
        parsed = datetime.combine(parsed.date(), time.max if end else time.min)
    return parsed, None


def _visible_reference(model, record_id):
    return (
        scoped_query(model.query, model, field="assigned_to")
        .filter(model.id == record_id)
        .first()
    )


def _get_accessible_activity(activity_id):
    activity = db.session.get(Activity, activity_id)
    if not activity:
        return None, (jsonify({"error": "Activity not found"}), 404)
    if not can_access_owner(activity.created_by):
        return None, (jsonify({"error": "Forbidden"}), 403)
    return activity, None


def _apply_payload(activity, data, is_create=False):
    """Validate and copy a request payload onto ``activity``.

    Returns an error message string, or ``None`` on success.
    """
    if "type" in data or is_create:
        activity_type = str(data.get("type") or "").strip().lower()
        if not activity_type:
            return "type is required"
        if activity_type not in VALID_TYPES:
            return "type must be one of: call, email, meeting, note, task"
        activity.type = activity_type

    if "title" in data or "subject" in data:
        title = str(data.get("title") or data.get("subject") or "").strip()
        if not title:
            return "title is required"
        if len(title) > _MAX_TITLE:
            return f"title must be at most {_MAX_TITLE} characters"
        activity.title = title
    elif is_create:
        activity.title = f"{activity.type.capitalize()} activity"

    if "description" in data or "notes" in data:
        description = data.get("description") if "description" in data else data.get("notes")
        if description is not None:
            description = str(description)
            if len(description) > _MAX_DESCRIPTION:
                return "description is too long"
        activity.description = description

    if "due_date" in data:
        due_date, error = _parse_datetime_value(data.get("due_date"))
        if error:
            return f"due_date {error}"
        activity.due_date = due_date

    if "status" in data and data.get("status") is not None:
        status = str(data.get("status")).strip().lower()
        if status not in VALID_STATUSES:
            return "status must be one of: pending, completed, cancelled"
        activity.status = status
        activity.completed = status == "completed"
    elif "completed" in data:
        activity.completed = bool(data.get("completed"))
        activity.status = "completed" if activity.completed else "pending"
    elif is_create:
        # Activities are logged after the fact; default to completed.
        activity.status = "completed"
        activity.completed = True

    if "outcome" in data:
        outcome = data.get("outcome")
        if outcome is not None:
            outcome = str(outcome).strip()
            if len(outcome) > _MAX_OUTCOME:
                return f"outcome must be at most {_MAX_OUTCOME} characters"
            outcome = outcome or None
        activity.outcome = outcome

    if "duration_minutes" in data:
        minutes = _optional_int(data.get("duration_minutes"))
        if data.get("duration_minutes") not in (None, ""):
            if minutes is None or minutes < 0 or minutes > 1440:
                return "duration_minutes must be a number between 0 and 1440"
        activity.duration_minutes = minutes

    if "direction" in data:
        direction = (str(data.get("direction") or "").strip().lower()) or None
        if direction is not None and direction not in VALID_DIRECTIONS:
            return "direction must be 'sent' or 'received'"
        activity.direction = direction

    for field, max_length in (
        ("recipient", _MAX_RECIPIENT),
        ("participants", _MAX_PARTICIPANTS),
        ("location", _MAX_LOCATION),
    ):
        if field in data:
            value = data.get(field)
            if value is not None:
                value = str(value).strip()
                if len(value) > max_length:
                    return f"{field} must be at most {max_length} characters"
                value = value or None
            setattr(activity, field, value)

    if "employee_id" in data:
        employee_id = _optional_int(data.get("employee_id"))
        if data.get("employee_id") not in (None, "") and employee_id is None:
            return "employee_id must be a number"
        if employee_id is not None and not db.session.get(Employee, employee_id):
            return "Employee not found"
        activity.employee_id = employee_id

    if "customer_id" in data:
        customer_id = _optional_int(data.get("customer_id"))
        if data.get("customer_id") not in (None, "") and customer_id is None:
            return "customer_id must be a number"
        if customer_id is not None and not _visible_reference(Customer, customer_id):
            return "Customer not found or not accessible"
        activity.customer_id = customer_id

    if "lead_id" in data:
        lead_id = _optional_int(data.get("lead_id"))
        if data.get("lead_id") not in (None, "") and lead_id is None:
            return "lead_id must be a number"
        if lead_id is not None and not _visible_reference(Lead, lead_id):
            return "Lead not found or not accessible"
        activity.lead_id = lead_id

    if "linked_type" in data:
        linked_type = (str(data.get("linked_type") or "").strip().lower()) or None
        if linked_type is not None and linked_type not in VALID_LINKED_TYPES:
            return "linked_type must be 'customer', 'lead' or 'deal'"
        activity.linked_type = linked_type

    if "linked_id" in data:
        linked_id = _optional_int(data.get("linked_id"))
        if data.get("linked_id") not in (None, "") and linked_id is None:
            return "linked_id must be a number"
        activity.linked_id = linked_id

    if activity.linked_type == "deal":
        if not activity.linked_id:
            return "linked_id is required for deal activities"
        if not _visible_reference(Deal, activity.linked_id):
            return "Deal not found or not accessible"
    elif activity.linked_type == "customer" and activity.linked_id:
        if not _visible_reference(Customer, activity.linked_id):
            return "Customer not found or not accessible"
    elif activity.linked_type == "lead" and activity.linked_id:
        if not _visible_reference(Lead, activity.linked_id):
            return "Lead not found or not accessible"

    if not activity.linked_type:
        if activity.customer_id:
            activity.linked_type = "customer"
            activity.linked_id = activity.customer_id
        elif activity.lead_id:
            activity.linked_type = "lead"
            activity.linked_id = activity.lead_id

    return None


def _apply_filters(query, args, include_type=True):
    """Apply list filters; returns (query, error_message)."""
    if include_type:
        type_filter = (args.get("type") or "").strip().lower()
        if type_filter and type_filter != "all":
            if type_filter not in VALID_TYPES:
                return None, "type must be one of: call, email, meeting, note, task"
            query = query.filter(Activity.type == type_filter)

    search = (args.get("search") or "").strip()
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Activity.title.ilike(pattern),
                Activity.description.ilike(pattern),
                Activity.recipient.ilike(pattern),
                Activity.participants.ilike(pattern),
                Activity.location.ilike(pattern),
            )
        )

    employee_id = args.get("employee_id", type=int)
    if employee_id is not None:
        query = query.filter(Activity.employee_id == employee_id)

    customer_id = args.get("customer_id", type=int)
    if customer_id is not None:
        query = query.filter(Activity.customer_id == customer_id)

    lead_id = args.get("lead_id", type=int)
    if lead_id is not None:
        query = query.filter(Activity.lead_id == lead_id)

    linked_type = (args.get("linked_type") or "").strip().lower()
    if linked_type:
        if linked_type not in VALID_LINKED_TYPES:
            return None, "linked_type must be 'customer', 'lead' or 'deal'"
        query = query.filter(Activity.linked_type == linked_type)

    linked_id = args.get("linked_id", type=int)
    if linked_id is not None:
        query = query.filter(Activity.linked_id == linked_id)

    date_from, error = _parse_date_bound(args.get("date_from"), end=False)
    if error:
        return None, f"date_from {error}"
    if date_from:
        query = query.filter(func.coalesce(Activity.due_date, Activity.created_at) >= date_from)

    date_to, error = _parse_date_bound(args.get("date_to"), end=True)
    if error:
        return None, f"date_to {error}"
    if date_to:
        query = query.filter(func.coalesce(Activity.due_date, Activity.created_at) <= date_to)

    return query, None


@activities_bp.get("/")
@jwt_required()
def list_activities():
    base_query = scoped_query(Activity.query, Activity, field="created_by")

    query, error = _apply_filters(base_query, request.args, include_type=True)
    if error:
        return jsonify({"error": error}), 400

    counts_query, error = _apply_filters(base_query, request.args, include_type=False)
    if error:
        return jsonify({"error": error}), 400
    counts = {"all": counts_query.count()}
    for activity_type, total in (
        counts_query.with_entities(Activity.type, func.count(Activity.id))
        .group_by(Activity.type)
        .all()
    ):
        counts[activity_type] = total

    page = max(request.args.get("page", default=1, type=int) or 1, 1)
    per_page = request.args.get("per_page", default=50, type=int) or 50
    per_page = max(1, min(per_page, 200))

    pagination = query.order_by(Activity.created_at.desc(), Activity.id.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    return (
        jsonify(
            {
                "activities": [activity.to_dict() for activity in pagination.items],
                "total": pagination.total,
                "page": pagination.page,
                "pages": pagination.pages,
                "per_page": pagination.per_page,
                "counts": counts,
            }
        ),
        200,
    )


@activities_bp.get("/options")
@jwt_required()
def activity_options():
    customers = (
        scoped_query(Customer.query, Customer, field="assigned_to")
        .order_by(Customer.name.asc())
        .all()
    )
    leads = (
        scoped_query(Lead.query, Lead, field="assigned_to")
        .order_by(Lead.name.asc())
        .all()
    )
    deals = (
        scoped_query(Deal.query, Deal, field="assigned_to")
        .order_by(Deal.title.asc())
        .all()
    )
    employees = (
        Employee.query.order_by(Employee.name.asc())
        .with_entities(
            Employee.id,
            Employee.employee_id,
            Employee.name,
            Employee.department,
            Employee.designation,
        )
        .all()
    )

    return (
        jsonify(
            {
                "customers": [
                    {"id": row.id, "name": row.name, "company": row.company}
                    for row in customers
                ],
                "leads": [
                    {"id": row.id, "name": row.name, "company": row.company}
                    for row in leads
                ],
                "deals": [
                    {"id": row.id, "title": row.title, "stage": row.stage}
                    for row in deals
                ],
                "employees": [
                    {
                        "id": row.id,
                        "employee_id": row.employee_id,
                        "name": row.name,
                        "department": row.department,
                        "designation": row.designation,
                    }
                    for row in employees
                ],
            }
        ),
        200,
    )


@activities_bp.get("/<int:activity_id>")
@jwt_required()
def get_activity(activity_id):
    activity, error = _get_accessible_activity(activity_id)
    if error:
        return error
    return jsonify({"activity": activity.to_dict()}), 200


@activities_bp.post("/")
@jwt_required()
def create_activity():
    data = request.get_json(silent=True) or {}
    user_id = int(get_jwt_identity())

    activity = Activity(created_by=user_id)
    error = _apply_payload(activity, data, is_create=True)
    if error:
        return jsonify({"error": error}), 400

    # Guard against accidental double-submits (e.g. a double-clicked button):
    # an identical entry from the same user within 15 seconds is returned
    # instead of being logged twice.
    duplicate = (
        Activity.query.filter(
            Activity.created_by == user_id,
            Activity.type == activity.type,
            Activity.title == activity.title,
            Activity.description == activity.description,
            Activity.due_date == activity.due_date,
            Activity.customer_id == activity.customer_id,
            Activity.lead_id == activity.lead_id,
            Activity.employee_id == activity.employee_id,
            Activity.created_at >= datetime.utcnow() - timedelta(seconds=15),
        ).first()
    )
    if duplicate:
        return jsonify({"activity": duplicate.to_dict(), "duplicate": True}), 200

    db.session.add(activity)
    db.session.commit()
    return jsonify({"activity": activity.to_dict()}), 201


@activities_bp.put("/<int:activity_id>")
@jwt_required()
def update_activity(activity_id):
    activity, error = _get_accessible_activity(activity_id)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    error = _apply_payload(activity, data, is_create=False)
    if error:
        return jsonify({"error": error}), 400

    db.session.commit()
    return jsonify({"activity": activity.to_dict()}), 200


@activities_bp.delete("/<int:activity_id>")
@jwt_required()
def delete_activity(activity_id):
    activity, error = _get_accessible_activity(activity_id)
    if error:
        return error
    db.session.delete(activity)
    db.session.commit()
    return jsonify({"message": "Activity deleted"}), 200

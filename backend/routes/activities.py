"""Activity / interaction log routes."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.db import db
from models.activity import Activity
from services.scoping import can_access_owner, scoped_query

activities_bp = Blueprint("activities", __name__, url_prefix="/api/activities")

VALID_LINKED_TYPES = ("customer", "lead", "deal")


def _get_accessible_activity(activity_id):
    activity = db.session.get(Activity, activity_id)
    if not activity:
        return None, (jsonify({"error": "Activity not found"}), 404)
    if not can_access_owner(activity.created_by):
        return None, (jsonify({"error": "Forbidden"}), 403)
    return activity, None


@activities_bp.get("/")
@jwt_required()
def list_activities():
    customer_id = request.args.get("customer_id", type=int)
    linked_type = request.args.get("linked_type", "").strip()
    linked_id = request.args.get("linked_id", type=int)
    query = scoped_query(Activity.query, Activity, field="created_by")
    if customer_id:
        query = query.filter_by(customer_id=customer_id)
    if linked_type:
        query = query.filter_by(linked_type=linked_type)
    if linked_id is not None:
        query = query.filter_by(linked_id=linked_id)
    activities = query.order_by(Activity.created_at.desc()).limit(50).all()
    return jsonify({"activities": [a.to_dict() for a in activities]}), 200


@activities_bp.post("/")
@jwt_required()
def create_activity():
    data = request.get_json(silent=True) or {}
    if not data.get("type"):
        return jsonify({"error": "type is required"}), 400

    linked_type = data.get("linked_type")
    if linked_type and linked_type not in VALID_LINKED_TYPES:
        return jsonify({"error": "linked_type must be 'customer', 'lead', or 'deal'"}), 400

    # The UI form only collects type/notes/linked record, so title defaults
    # to a readable label derived from the type.
    title = (data.get("title") or f"{data['type'].capitalize()} activity").strip()

    activity = Activity(
        type=data["type"],
        title=title,
        description=data.get("description") or data.get("notes"),
        due_date=data.get("due_date"),
        customer_id=data.get("customer_id"),
        linked_type=linked_type,
        linked_id=data.get("linked_id"),
        created_by=int(get_jwt_identity()),
    )
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

    if "linked_type" in data and data["linked_type"] not in VALID_LINKED_TYPES:
        return jsonify({"error": "linked_type must be 'customer', 'lead', or 'deal'"}), 400

    for field in [
        "type", "title", "description", "due_date", "completed",
        "linked_type", "linked_id",
    ]:
        if field in data:
            setattr(activity, field, data[field])

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
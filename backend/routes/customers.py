"""Customer CRUD routes plus Customer 360 and duplicate detection."""
from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from database.db import db
from models.activity import Activity
from models.customer import Customer
from models.deal import Deal
from models.followup import FollowUp
from models.user import User
from services.dedupe import find_duplicate_groups
from services.scoping import can_access_owner, scoped_query

customers_bp = Blueprint("customers", __name__, url_prefix="/api/customers")


def _get_accessible_customer(customer_id):
    """Return (customer, error_response) for a record the caller may act on."""
    customer = db.session.get(Customer, customer_id)
    if not customer:
        return None, (jsonify({"error": "Customer not found"}), 404)
    if not can_access_owner(customer.assigned_to):
        return None, (jsonify({"error": "Forbidden"}), 403)
    return customer, None


@customers_bp.get("/")
@jwt_required()
def list_customers():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    search = request.args.get("search", "").strip()
    status = request.args.get("status", "").strip()

    query = scoped_query(Customer.query, Customer)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (Customer.name.ilike(like)) |
            (Customer.email.ilike(like)) |
            (Customer.company.ilike(like))
        )
    if status:
        query = query.filter_by(status=status)

    pagination = query.order_by(Customer.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    return jsonify({
        "customers": [c.to_dict() for c in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": page,
    }), 200


@customers_bp.get("/duplicates")
@jwt_required()
def customer_duplicates():
    """Group visible customers that share an email, phone, or normalised name."""
    customers = scoped_query(Customer.query, Customer).all()
    groups = find_duplicate_groups(customers)
    return jsonify({
        "groups": groups,
        "total_groups": len(groups),
        "scanned": len(customers),
    }), 200


@customers_bp.post("/")
@jwt_required()
def create_customer():
    data = request.get_json(silent=True) or {}
    if not data.get("name") or not data.get("email"):
        return jsonify({"error": "name and email are required"}), 400

    if Customer.query.filter_by(email=data["email"].strip().lower()).first():
        return jsonify({"error": "Email already exists"}), 409

    customer = Customer(
        name=data["name"].strip(),
        email=data["email"].strip().lower(),
        phone=data.get("phone"),
        company=data.get("company"),
        address=data.get("address"),
        website=data.get("website"),
        status=data.get("status", "prospect"),
        notes=data.get("notes"),
        assigned_to=int(get_jwt_identity()),
    )
    db.session.add(customer)
    db.session.commit()
    return jsonify({"customer": customer.to_dict()}), 201


@customers_bp.get("/<int:customer_id>")
@jwt_required()
def get_customer(customer_id):
    customer, error = _get_accessible_customer(customer_id)
    if error:
        return error
    return jsonify({"customer": customer.to_dict()}), 200


@customers_bp.put("/<int:customer_id>")
@jwt_required()
def update_customer(customer_id):
    customer, error = _get_accessible_customer(customer_id)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    for field in ["name", "phone", "company", "address", "website", "status", "notes"]:
        if field in data:
            setattr(customer, field, data[field])
    if "email" in data:
        existing = Customer.query.filter_by(email=data["email"].lower()).first()
        if existing and existing.id != customer_id:
            return jsonify({"error": "Email already in use"}), 409
        customer.email = data["email"].lower()

    db.session.commit()
    return jsonify({"customer": customer.to_dict()}), 200


@customers_bp.delete("/<int:customer_id>")
@jwt_required()
def delete_customer(customer_id):
    customer, error = _get_accessible_customer(customer_id)
    if error:
        return error
    db.session.delete(customer)
    db.session.commit()
    return jsonify({"message": "Customer deleted"}), 200


@customers_bp.get("/<int:customer_id>/360")
@jwt_required()
def customer_360(customer_id):
    """Full customer profile: owner, deal history, activity timeline, metrics."""
    customer, error = _get_accessible_customer(customer_id)
    if error:
        return error

    deals = scoped_query(
        Deal.query.filter_by(customer_id=customer_id), Deal
    ).order_by(Deal.created_at.desc()).all()

    activities = scoped_query(
        Activity.query.filter(
            (Activity.customer_id == customer_id)
            | ((Activity.linked_type == "customer") & (Activity.linked_id == customer_id))
        ),
        Activity,
        field="created_by",
    ).order_by(Activity.created_at.desc()).limit(50).all()

    followups = scoped_query(
        FollowUp.query.filter_by(linked_type="customer", linked_id=customer_id),
        FollowUp,
    ).order_by(FollowUp.due_date.desc()).limit(50).all()

    open_deals = [d for d in deals if d.stage not in ("won", "lost")]
    won_deals = [d for d in deals if d.stage == "won"]
    lost_deals = [d for d in deals if d.stage == "lost"]

    now = datetime.utcnow()
    last_activity = activities[0].created_at if activities else None
    overdue_followups = [
        f for f in followups
        if f.status != "completed" and f.due_date and f.due_date < now
    ]

    # Health is derived from real activity, pipeline, revenue and follow-ups.
    health = 0
    if last_activity:
        age_days = (now - last_activity).days
        health += 40 if age_days <= 30 else 20 if age_days <= 90 else 0
    if open_deals:
        health += 20
    if won_deals:
        health += 20
    if (customer.status or "").lower() == "active":
        health += 20
    if overdue_followups:
        health -= 20
    health = max(0, min(100, health))
    health_label = "healthy" if health >= 70 else "at_risk" if health >= 40 else "dormant"

    owner = db.session.get(User, customer.assigned_to) if customer.assigned_to else None

    return jsonify({
        "customer": customer.to_dict(),
        "owner": (
            {"id": owner.id, "name": owner.name, "email": owner.email} if owner else None
        ),
        "metrics": {
            "deals_count": len(deals),
            "open_deals": len(open_deals),
            "won_deals": len(won_deals),
            "lost_deals": len(lost_deals),
            "open_pipeline_value": round(sum(d.value or 0 for d in open_deals), 2),
            "won_value": round(sum(d.value or 0 for d in won_deals), 2),
            "lost_value": round(sum(d.value or 0 for d in lost_deals), 2),
            "win_rate": (
                round(len(won_deals) / (len(won_deals) + len(lost_deals)) * 100, 1)
                if (won_deals or lost_deals) else 0
            ),
            "activities_count": len(activities),
            "last_activity_at": last_activity.isoformat() if last_activity else None,
            "followups_count": len(followups),
            "overdue_followups": len(overdue_followups),
            "health_score": health,
            "health_label": health_label,
        },
        "deals": [d.to_dict() for d in deals],
        "activities": [a.to_dict() for a in activities],
        "followups": [f.to_dict() for f in followups],
    }), 200
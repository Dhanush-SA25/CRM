"""Deal / Pipeline CRUD routes."""
from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.db import db
from models.deal import Deal, VALID_STAGES, STAGE_PROBABILITIES
from services.scoping import can_access_owner, can_assign_to, scoped_query

deals_bp = Blueprint("deals", __name__, url_prefix="/api/deals")


def _get_accessible_deal(deal_id):
    """Return (deal, error_response) for a record the caller may act on."""
    deal = db.session.get(Deal, deal_id)
    if not deal:
        return None, (jsonify({"error": "Deal not found"}), 404)
    if not can_access_owner(deal.assigned_to):
        return None, (jsonify({"error": "Forbidden"}), 403)
    return deal, None


def _parse_close_date(value):
    """Parse a date/datetime string; an empty value means "no close date"."""
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    for parser in (datetime.fromisoformat, lambda v: datetime.strptime(v, "%Y-%m-%d")):
        try:
            return parser(value)
        except (ValueError, TypeError):
            continue
    raise ValueError("close_date must be a valid ISO date")


@deals_bp.get("/")
@jwt_required()
def list_deals():
    stage = request.args.get("stage", "").strip()
    query = scoped_query(Deal.query, Deal)
    if stage:
        query = query.filter_by(stage=stage)
    deals = query.order_by(Deal.created_at.desc()).all()
    return jsonify({"deals": [d.to_dict() for d in deals]}), 200


@deals_bp.post("/")
@jwt_required()
def create_deal():
    data = request.get_json(silent=True) or {}
    if not data.get("title"):
        return jsonify({"error": "title is required"}), 400

    if "stage" in data and data["stage"] not in VALID_STAGES:
        return jsonify({"error": f"Invalid stage. Must be one of {VALID_STAGES}"}), 400

    try:
        close_date = _parse_close_date(data.get("close_date"))
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    stage = data.get("stage", "new")
    lost_reason = (data.get("lost_reason") or "").strip() or None

    deal = Deal(
        title=data["title"].strip(),
        value=data.get("value", 0),
        stage=stage,
        probability=data.get("probability", STAGE_PROBABILITIES.get(stage, 10)),
        close_date=close_date,
        lost_reason=lost_reason,
        notes=data.get("notes"),
        customer_id=data.get("customer_id"),
        assigned_to=int(get_jwt_identity()),
    )
    db.session.add(deal)
    db.session.commit()
    return jsonify({"deal": deal.to_dict()}), 201


@deals_bp.get("/<int:deal_id>")
@jwt_required()
def get_deal(deal_id):
    deal, error = _get_accessible_deal(deal_id)
    if error:
        return error
    return jsonify({"deal": deal.to_dict()}), 200


@deals_bp.put("/<int:deal_id>")
@jwt_required()
def update_deal(deal_id):
    deal, error = _get_accessible_deal(deal_id)
    if error:
        return error

    data = request.get_json(silent=True) or {}

    if "stage" in data and data["stage"] not in VALID_STAGES:
        return jsonify({"error": f"Invalid stage. Must be one of {VALID_STAGES}"}), 400

    if "assigned_to" in data and data["assigned_to"] is not None:
        if not can_assign_to(data["assigned_to"]):
            return jsonify({"error": "Forbidden: cannot assign outside your team"}), 403

    if "close_date" in data:
        try:
            data["close_date"] = _parse_close_date(data["close_date"])
        except ValueError as err:
            return jsonify({"error": str(err)}), 400

    for field in [
        "title", "value", "stage", "probability", "notes",
        "customer_id", "close_date", "lost_reason", "assigned_to",
    ]:
        if field in data:
            setattr(deal, field, data[field])

    if (deal.stage or "").lower() != "lost":
        deal.lost_reason = None

    db.session.commit()
    return jsonify({"deal": deal.to_dict()}), 200


@deals_bp.delete("/<int:deal_id>")
@jwt_required()
def delete_deal(deal_id):
    deal, error = _get_accessible_deal(deal_id)
    if error:
        return error
    db.session.delete(deal)
    db.session.commit()
    return jsonify({"message": "Deal deleted"}), 200


@deals_bp.get("/lost-reasons")
@jwt_required()
def lost_reasons():
    """Lost-deal analysis grouped by the recorded reason."""
    lost_deals = scoped_query(
        Deal.query.filter(Deal.stage == "lost"), Deal
    ).order_by(Deal.updated_at.desc()).all()

    total_value = sum(d.value or 0 for d in lost_deals)
    buckets = {}
    for deal in lost_deals:
        reason = (deal.lost_reason or "").strip() or "Unspecified"
        bucket = buckets.setdefault(reason, {"count": 0, "value": 0.0})
        bucket["count"] += 1
        bucket["value"] += deal.value or 0

    reasons = [
        {
            "reason": reason,
            "count": data["count"],
            "value": round(data["value"], 2),
            "share": round(data["count"] / len(lost_deals) * 100, 1) if lost_deals else 0,
        }
        for reason, data in buckets.items()
    ]
    reasons.sort(key=lambda r: (r["count"], r["value"]), reverse=True)

    return jsonify({
        "total_lost": len(lost_deals),
        "total_lost_value": round(total_value, 2),
        "top_reason": reasons[0]["reason"] if reasons else None,
        "reasons": reasons,
        "lost_deals": [d.to_dict() for d in lost_deals],
    }), 200
"""Lead CRUD routes plus rule-based scoring."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from database.db import db
from models.lead import Lead
from services.scoping import can_access_owner, scoped_query
from services.scoring import apply_score

leads_bp = Blueprint("leads", __name__, url_prefix="/api/leads")

VALID_LEAD_STATUSES = ("new", "contacted", "qualified", "lost")
VALID_LEAD_SOURCES = ("website", "referral", "linkedin", "cold_call", "other")


def _get_accessible_lead(lead_id):
    """Return (lead, error_response) for a lead the caller may act on."""
    lead = db.session.get(Lead, lead_id)
    if not lead:
        return None, (jsonify({"error": "Lead not found"}), 404)
    if not can_access_owner(lead.assigned_to):
        return None, (jsonify({"error": "Forbidden"}), 403)
    return lead, None


@leads_bp.get("/")
@jwt_required()
def list_leads():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    search = request.args.get("search", "").strip()
    status = request.args.get("status", "").strip()
    source = request.args.get("source", "").strip()
    sort = request.args.get("sort", "").strip()

    query = scoped_query(Lead.query, Lead)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (Lead.name.ilike(like)) |
            (Lead.email.ilike(like)) |
            (Lead.company.ilike(like))
        )
    if status:
        query = query.filter_by(status=status)
    if source:
        query = query.filter_by(source=source)

    if sort == "score":
        query = query.order_by(Lead.score.desc(), Lead.created_at.desc())
    else:
        query = query.order_by(Lead.created_at.desc())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        "leads": [l.to_dict() for l in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": page,
    }), 200


@leads_bp.post("/")
@jwt_required()
def create_lead():
    data = request.get_json(silent=True) or {}
    if not data.get("name") or not data.get("email"):
        return jsonify({"error": "name and email are required"}), 400

    status = data.get("status", "new")
    if status not in VALID_LEAD_STATUSES:
        return jsonify({"error": f"status must be one of {list(VALID_LEAD_STATUSES)}"}), 400
    source = data.get("source") or None
    if source is not None and source not in VALID_LEAD_SOURCES:
        return jsonify({"error": f"source must be one of {list(VALID_LEAD_SOURCES)}"}), 400

    lead = Lead(
        name=data["name"].strip(),
        email=data["email"].strip().lower(),
        phone=data.get("phone"),
        company=data.get("company"),
        status=status,
        source=source,
        notes=data.get("notes"),
        score=0,
        assigned_to=int(get_jwt_identity()),
    )
    # The score is always derived from stored fields, never client-supplied.
    apply_score(lead)
    db.session.add(lead)
    db.session.commit()
    return jsonify({"lead": lead.to_dict()}), 201


@leads_bp.get("/<int:lead_id>")
@jwt_required()
def get_lead(lead_id):
    lead, error = _get_accessible_lead(lead_id)
    if error:
        return error
    return jsonify({"lead": lead.to_dict()}), 200


@leads_bp.put("/<int:lead_id>")
@jwt_required()
def update_lead(lead_id):
    lead, error = _get_accessible_lead(lead_id)
    if error:
        return error

    data = request.get_json(silent=True) or {}

    if "status" in data and data["status"] not in VALID_LEAD_STATUSES:
        return jsonify({"error": f"status must be one of {list(VALID_LEAD_STATUSES)}"}), 400
    if data.get("source") and data["source"] not in VALID_LEAD_SOURCES:
        return jsonify({"error": f"source must be one of {list(VALID_LEAD_SOURCES)}"}), 400

    for field in ["name", "phone", "company", "status", "source", "notes"]:
        if field in data:
            setattr(lead, field, data[field])
    if "email" in data:
        lead.email = data["email"].strip().lower()

    apply_score(lead)
    db.session.commit()
    return jsonify({"lead": lead.to_dict()}), 200


@leads_bp.delete("/<int:lead_id>")
@jwt_required()
def delete_lead(lead_id):
    lead, error = _get_accessible_lead(lead_id)
    if error:
        return error
    db.session.delete(lead)
    db.session.commit()
    return jsonify({"message": "Lead deleted"}), 200


@leads_bp.post("/<int:lead_id>/score")
@jwt_required()
def rescore_lead(lead_id):
    """Recompute and return the deterministic score with its breakdown."""
    lead, error = _get_accessible_lead(lead_id)
    if error:
        return error
    result = apply_score(lead)
    db.session.commit()
    return jsonify({"lead": lead.to_dict(), "scoring": result}), 200


@leads_bp.post("/rescore")
@jwt_required()
def rescore_leads():
    """Recompute scores for every lead visible to the caller."""
    leads = scoped_query(Lead.query, Lead).all()
    for lead in leads:
        apply_score(lead)
    db.session.commit()
    return jsonify({"updated": len(leads)}), 200

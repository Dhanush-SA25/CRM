"""Admin quarterly sales-target management."""
from flask import Blueprint, jsonify, request

from database.db import db
from models.deal import Deal
from models.target import SalesTarget
from models.user import User
from services.rbac import role_required
from services.targets import current_period, parse_period, won_value_between

targets_bp = Blueprint("targets", __name__, url_prefix="/api/admin/targets")


def _target_rows(period, start, end):
    targets = {
        target.user_id: target
        for target in SalesTarget.query.filter_by(period=period).all()
    }
    won_deals = Deal.query.filter(Deal.stage == "won").all()

    rows = []
    for user in User.query.order_by(User.name.asc()).all():
        target = targets.get(user.id)
        amount = target.target_amount if target else 0.0
        achieved = won_value_between(won_deals, user.id, start, end)
        rows.append({
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "manager_id": user.manager_id,
            "target_amount": round(amount, 2),
            "achieved": achieved,
            "attainment": round(achieved / amount * 100, 1) if amount else None,
            "remaining": round(max(0.0, amount - achieved), 2),
        })

    total_target = round(sum(row["target_amount"] for row in rows), 2)
    total_achieved = round(sum(row["achieved"] for row in rows), 2)
    return rows, {
        "target_amount": total_target,
        "achieved": total_achieved,
        "attainment": round(total_achieved / total_target * 100, 1) if total_target else None,
    }


@targets_bp.get("/")
@role_required("admin")
def list_targets():
    period = request.args.get("period", "").strip() or current_period()
    try:
        start, end = parse_period(period)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    rows, totals = _target_rows(period, start, end)
    return jsonify({
        "period": period,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "targets": rows,
        "totals": totals,
    }), 200


@targets_bp.put("/")
@role_required("admin")
def set_target():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    period = (data.get("period") or current_period()).strip()
    amount = data.get("target_amount")

    if not isinstance(user_id, int) or not db.session.get(User, user_id):
        return jsonify({"error": "user_id must reference an existing user"}), 400
    try:
        start, end = parse_period(period)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return jsonify({"error": "target_amount must be a number"}), 400
    if amount < 0:
        return jsonify({"error": "target_amount cannot be negative"}), 400

    target = SalesTarget.query.filter_by(user_id=user_id, period=period).first()
    if target:
        target.target_amount = amount
    else:
        target = SalesTarget(user_id=user_id, period=period, target_amount=amount)
        db.session.add(target)
    db.session.commit()

    won_deals = Deal.query.filter(Deal.stage == "won").all()
    achieved = won_value_between(won_deals, user_id, start, end)
    return jsonify({
        "target": target.to_dict(),
        "achieved": achieved,
        "attainment": round(achieved / amount * 100, 1) if amount else None,
    }), 200

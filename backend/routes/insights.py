"""Cross-module search and notification feed endpoints."""
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import or_

from models.customer import Customer
from models.deal import Deal
from models.employee import Employee
from models.followup import FollowUp
from models.lead import Lead
from models.task import Task
from services.scoping import current_role, scoped_query

insights_bp = Blueprint("insights", __name__, url_prefix="/api")

SEVERITY_RANK = {"high": 0, "warning": 1, "info": 2, "success": 3}


def _money(value):
    return f"${(value or 0):,.0f}"


@insights_bp.get("/search")
@jwt_required()
def global_search():
    """Search every record type the caller can see. Minimum query length: 2."""
    query = request.args.get("q", "").strip()
    empty = {
        "customers": [], "leads": [], "deals": [],
        "tasks": [], "followups": [], "employees": [],
    }
    if len(query) < 2:
        return jsonify({
            "query": query,
            "results": empty,
            "total": 0,
            "error": "Enter at least 2 characters to search",
        }), 200

    like = f"%{query}%"

    customers = scoped_query(
        Customer.query.filter(or_(
            Customer.name.ilike(like),
            Customer.email.ilike(like),
            Customer.company.ilike(like),
        )),
        Customer,
    ).order_by(Customer.created_at.desc()).limit(6).all()

    leads = scoped_query(
        Lead.query.filter(or_(
            Lead.name.ilike(like),
            Lead.email.ilike(like),
            Lead.company.ilike(like),
        )),
        Lead,
    ).order_by(Lead.created_at.desc()).limit(6).all()

    deals = scoped_query(
        Deal.query.filter(Deal.title.ilike(like)), Deal
    ).order_by(Deal.created_at.desc()).limit(6).all()

    tasks = scoped_query(
        Task.query.filter(or_(
            Task.title.ilike(like),
            Task.description.ilike(like),
        )),
        Task,
    ).order_by(Task.created_at.desc()).limit(5).all()

    followups = scoped_query(
        FollowUp.query.filter(or_(
            FollowUp.title.ilike(like),
            FollowUp.description.ilike(like),
        )),
        FollowUp,
    ).order_by(FollowUp.due_date.desc()).limit(5).all()

    employees = []
    if current_role() in ("admin", "manager"):
        employees = Employee.query.filter(or_(
            Employee.name.ilike(like),
            Employee.email.ilike(like),
            Employee.employee_id.ilike(like),
            Employee.department.ilike(like),
            Employee.designation.ilike(like),
        )).order_by(Employee.name.asc()).limit(5).all()

    results = {
        "customers": [
            {
                "id": c.id,
                "type": "customer",
                "label": c.name,
                "subtitle": c.company or c.email,
                "meta": c.status,
                "to": f"/customers?focus={c.id}",
            }
            for c in customers
        ],
        "leads": [
            {
                "id": l.id,
                "type": "lead",
                "label": l.name,
                "subtitle": l.company or l.email,
                "meta": f"{l.status} · score {l.score or 0}",
                "to": f"/leads?focus={l.id}",
            }
            for l in leads
        ],
        "deals": [
            {
                "id": d.id,
                "type": "deal",
                "label": d.title,
                "subtitle": f"{_money(d.value)} · {d.stage}",
                "meta": d.stage,
                "to": f"/deals?focus={d.id}",
            }
            for d in deals
        ],
        "tasks": [
            {
                "id": t.id,
                "type": "task",
                "label": t.title,
                "subtitle": t.status.replace("_", " "),
                "meta": t.due_date.strftime("%d %b") if t.due_date else "",
                "to": f"/tasks?focus={t.id}",
            }
            for t in tasks
        ],
        "followups": [
            {
                "id": f.id,
                "type": "followup",
                "label": f.title,
                "subtitle": f.status,
                "meta": f.due_date.strftime("%d %b") if f.due_date else "",
                "to": f"/followups?focus={f.id}",
            }
            for f in followups
        ],
        "employees": [
            {
                "id": e.id,
                "type": "employee",
                "label": e.name,
                "subtitle": " · ".join(filter(None, [e.employee_id, e.department])),
                "meta": e.designation,
                "to": f"/admin/employees?focus={e.id}",
            }
            for e in employees
        ],
    }

    total = sum(len(items) for items in results.values())
    return jsonify({"query": query, "results": results, "total": total}), 200


@insights_bp.get("/notifications")
@jwt_required()
def notifications():
    """Derived notification feed built from real records the caller can see."""
    now = datetime.utcnow()
    items = []

    followups = scoped_query(
        FollowUp.query.filter(FollowUp.status == "pending"), FollowUp
    ).all()
    for followup in followups:
        if followup.due_date and followup.due_date < now:
            items.append({
                "id": f"followup-overdue-{followup.id}",
                "type": "followup_overdue",
                "severity": "high",
                "title": "Follow-up overdue",
                "message": f"{followup.title} was due {followup.due_date.strftime('%d %b %Y')}",
                "to": "/followups?status=overdue",
                "timestamp": followup.due_date.isoformat(),
            })
        elif followup.due_date and followup.due_date.date() == now.date():
            items.append({
                "id": f"followup-today-{followup.id}",
                "type": "followup_today",
                "severity": "warning",
                "title": "Follow-up due today",
                "message": followup.title,
                "to": "/followups",
                "timestamp": followup.due_date.isoformat(),
            })

    tasks = scoped_query(
        Task.query.filter(
            Task.status.in_(["todo", "in_progress"]), Task.due_date < now
        ),
        Task,
    ).all()
    for task in tasks:
        items.append({
            "id": f"task-overdue-{task.id}",
            "type": "task_overdue",
            "severity": "high",
            "title": "Task overdue",
            "message": f"{task.title} was due {task.due_date.strftime('%d %b %Y')}",
            "to": "/tasks?status=overdue",
            "timestamp": task.due_date.isoformat(),
        })

    closing_soon = scoped_query(
        Deal.query.filter(
            Deal.stage.notin_(["won", "lost"]),
            Deal.close_date.isnot(None),
            Deal.close_date >= now,
            Deal.close_date <= now + timedelta(days=7),
        ),
        Deal,
    ).order_by(Deal.close_date.asc()).limit(10).all()
    for deal in closing_soon:
        items.append({
            "id": f"deal-closing-{deal.id}",
            "type": "deal_closing",
            "severity": "warning",
            "title": "Deal closing soon",
            "message": f"{deal.title} closes {deal.close_date.strftime('%d %b %Y')}",
            "to": f"/deals?focus={deal.id}",
            "timestamp": deal.close_date.isoformat(),
        })

    stale_deals = scoped_query(
        Deal.query.filter(
            Deal.stage.notin_(["won", "lost"]),
            Deal.updated_at < now - timedelta(days=14),
        ),
        Deal,
    ).order_by(Deal.updated_at.asc()).limit(5).all()
    for deal in stale_deals:
        items.append({
            "id": f"deal-stale-{deal.id}",
            "type": "deal_stale",
            "severity": "info",
            "title": "Deal needs attention",
            "message": f"{deal.title} has not changed in over 14 days",
            "to": f"/deals?focus={deal.id}",
            "timestamp": deal.updated_at.isoformat(),
        })

    hot_leads = scoped_query(
        Lead.query.filter(
            Lead.score >= 70, Lead.status.in_(["new", "contacted"])
        ),
        Lead,
    ).order_by(Lead.score.desc()).limit(5).all()
    for lead in hot_leads:
        items.append({
            "id": f"lead-hot-{lead.id}",
            "type": "lead_hot",
            "severity": "success",
            "title": "Hot lead to contact",
            "message": f"{lead.name} scores {lead.score} / 100",
            "to": f"/leads?focus={lead.id}",
            "timestamp": lead.updated_at.isoformat(),
        })

    won_deals = scoped_query(
        Deal.query.filter(
            Deal.stage == "won", Deal.updated_at >= now - timedelta(days=7)
        ),
        Deal,
    ).order_by(Deal.updated_at.desc()).limit(5).all()
    for deal in won_deals:
        items.append({
            "id": f"deal-won-{deal.id}",
            "type": "deal_won",
            "severity": "success",
            "title": "Deal won",
            "message": f"{deal.title} · {_money(deal.value)}",
            "to": f"/deals?focus={deal.id}",
            "timestamp": deal.updated_at.isoformat(),
        })

    items.sort(key=lambda n: (SEVERITY_RANK.get(n["severity"], 9), n["timestamp"]), reverse=False)
    items = items[:30]

    counts = {"high": 0, "warning": 0, "info": 0, "success": 0}
    for item in items:
        counts[item["severity"]] = counts.get(item["severity"], 0) + 1

    return jsonify({
        "notifications": items,
        "counts": counts,
        "total": len(items),
        "generated_at": now.isoformat(),
    }), 200

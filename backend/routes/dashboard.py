"""Dashboard summary / analytics routes.

Every number is computed from stored records and filtered by the caller's
visibility (admin: organization, manager: team, sales: personal).
"""
from datetime import datetime, timedelta

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from database.db import db
from models.activity import Activity
from models.customer import Customer
from models.deal import Deal, VALID_STAGES
from models.followup import FollowUp
from models.lead import Lead
from models.target import SalesTarget
from models.task import Task
from models.user import User
from services.scoping import current_role, get_current_user_id, visible_user_ids
from services.targets import period_bounds, won_value_between

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")

SCOPE_LABELS = {
    "admin": "Organization-wide",
    "manager": "Team",
    "sales": "Personal",
}

FUNNEL_STAGES = ["new", "contacted", "qualified", "proposal", "negotiation", "won"]


def _visible(query, model, field="assigned_to"):
    """Restrict a query to records the caller may see."""
    ids = visible_user_ids()
    if ids is not None:
        query = query.filter(getattr(model, field).in_(ids))
    return query


def _scope_meta():
    role = current_role()
    ids = visible_user_ids()
    return {
        "role": role,
        "label": SCOPE_LABELS.get(role, "Personal"),
        "user_id": get_current_user_id(),
        "team_size": None if ids is None else len(ids),
    }


def _shift_month(month_start, offset):
    total = month_start.year * 12 + (month_start.month - 1) + offset
    return datetime(total // 12, total % 12 + 1, 1)


@dashboard_bp.get("/summary")
@jwt_required()
def summary():
    total_customers = _visible(Customer.query, Customer).count()
    total_leads = _visible(Lead.query, Lead).count()
    total_deals = _visible(Deal.query, Deal).count()

    # Pipeline value (open deals only)
    pipeline_value = _visible(
        db.session.query(func.sum(Deal.value)).filter(Deal.stage.notin_(["won", "lost"])),
        Deal,
    ).scalar() or 0

    # Won deals value
    won_value = _visible(
        db.session.query(func.sum(Deal.value)).filter(Deal.stage == "won"), Deal
    ).scalar() or 0

    # Pipeline health counters (real records, surfaced in dashboard KPI strip)
    open_deals = _visible(Deal.query.filter(Deal.stage.notin_(["won", "lost"])), Deal).count()
    won_deals = _visible(Deal.query.filter(Deal.stage == "won"), Deal).count()
    lost_deals = _visible(Deal.query.filter(Deal.stage == "lost"), Deal).count()

    now = datetime.utcnow()
    pending_followups = _visible(
        FollowUp.query.filter(FollowUp.status == "pending"), FollowUp
    ).count()
    overdue_followups = _visible(
        FollowUp.query.filter(FollowUp.status == "pending", FollowUp.due_date < now),
        FollowUp,
    ).count()
    overdue_tasks = _visible(
        Task.query.filter(
            Task.status.in_(["todo", "in_progress"]), Task.due_date < now
        ),
        Task,
    ).count()

    # Deals by stage
    deals_by_stage = _visible(
        db.session.query(Deal.stage, func.count(Deal.id), func.sum(Deal.value)), Deal
    ).group_by(Deal.stage).all()

    # Leads by status
    leads_by_status = _visible(
        db.session.query(Lead.status, func.count(Lead.id)), Lead
    ).group_by(Lead.status).all()

    # Customers by status
    customers_by_status = _visible(
        db.session.query(Customer.status, func.count(Customer.id)), Customer
    ).group_by(Customer.status).all()

    # Recent activities
    recent_activities = _visible(
        Activity.query, Activity, field="created_by"
    ).order_by(Activity.created_at.desc()).limit(5).all()

    return jsonify({
        "summary": {
            "total_customers": total_customers,
            "total_leads": total_leads,
            "total_deals": total_deals,
            "open_deals": open_deals,
            "won_deals": won_deals,
            "lost_deals": lost_deals,
            "pipeline_value": round(pipeline_value, 2),
            "won_value": round(won_value, 2),
            "pending_followups": pending_followups,
            "overdue_followups": overdue_followups,
            "overdue_tasks": overdue_tasks,
        },
        "deals_by_stage": [
            {"stage": s, "count": c, "value": round(v or 0, 2)}
            for s, c, v in deals_by_stage
        ],
        "leads_by_status": [
            {"status": s, "count": c} for s, c in leads_by_status
        ],
        "customers_by_status": [
            {"status": s, "count": c} for s, c in customers_by_status
        ],
        "recent_activities": [a.to_dict() for a in recent_activities],
        "scope": _scope_meta(),
    }), 200


@dashboard_bp.get("/analytics")
@jwt_required()
def analytics():
    """Role-scoped analytics computed from real records only."""
    now = datetime.utcnow()
    role = current_role()
    ids = visible_user_ids()

    all_deals = _visible(Deal.query, Deal).all()
    won_deals = [d for d in all_deals if d.stage == "won"]
    lost_deals = [d for d in all_deals if d.stage == "lost"]
    all_leads = _visible(Lead.query, Lead).all()
    all_activities = _visible(Activity.query, Activity, field="created_by").all()
    all_tasks = _visible(Task.query, Task).all()
    all_followups = _visible(FollowUp.query, FollowUp).all()

    if ids is None:
        users = User.query.order_by(User.name.asc()).all()
    else:
        users = User.query.filter(User.id.in_(ids)).order_by(User.name.asc()).all()

    # --- Pipeline by stage (all 7 stages, including those with 0 deals) ---
    stage_map = {}
    for deal in all_deals:
        bucket = stage_map.setdefault(deal.stage, {"count": 0, "value": 0.0})
        bucket["count"] += 1
        bucket["value"] += deal.value or 0
    pipeline_by_stage = [
        {
            "stage": stage,
            "count": stage_map.get(stage, {}).get("count", 0),
            "value": round(stage_map.get(stage, {}).get("value", 0), 2),
        }
        for stage in VALID_STAGES
    ]

    # --- Leads by source ---
    source_counts = {}
    for lead in all_leads:
        key = (lead.source or "unknown").strip().lower() or "unknown"
        source_counts[key] = source_counts.get(key, 0) + 1
    leads_by_source = [
        {"source": source, "count": count}
        for source, count in sorted(source_counts.items(), key=lambda item: item[1], reverse=True)
    ]

    # --- Win rate: won / (won + lost) * 100 ---
    total_closed = len(won_deals) + len(lost_deals)
    win_rate = round(len(won_deals) / total_closed * 100, 1) if total_closed else 0

    # --- Activities over the last 30 days, grouped by date ---
    thirty_days_ago = now - timedelta(days=30)
    activity_counts = {}
    for activity in all_activities:
        if activity.created_at and activity.created_at >= thirty_days_ago:
            key = activity.created_at.date().isoformat()
            activity_counts[key] = activity_counts.get(key, 0) + 1
    activities_30d = [
        {"date": key, "count": activity_counts[key]} for key in sorted(activity_counts)
    ]

    # --- Revenue trend: won value per calendar month, last 12 months ---
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    months = [_shift_month(month_start, offset) for offset in range(-11, 1)]
    trend = {
        month.strftime("%Y-%m"): {"revenue": 0.0, "deals": 0}
        for month in months
    }
    for deal in won_deals:
        when = deal.close_date or deal.updated_at
        if not when:
            continue
        key = when.strftime("%Y-%m")
        if key in trend:
            trend[key]["revenue"] += deal.value or 0
            trend[key]["deals"] += 1
    revenue_trend = [
        {
            "month": key,
            "label": datetime.strptime(key, "%Y-%m").strftime("%b %y"),
            "revenue": round(trend[key]["revenue"], 2),
            "deals": trend[key]["deals"],
        }
        for key in sorted(trend)
    ]

    # --- Sales targets vs achievement for the current quarter ---
    period, period_start, period_end = period_bounds(now=now)
    targets = {
        target.user_id: target.target_amount
        for target in SalesTarget.query.filter_by(period=period).all()
    }
    target_rows = []
    for user in users:
        amount = targets.get(user.id, 0.0)
        achieved = won_value_between(won_deals, user.id, period_start, period_end)
        target_rows.append({
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "target_amount": round(amount, 2),
            "achieved": achieved,
            "attainment": round(achieved / amount * 100, 1) if amount else None,
            "remaining": round(max(0.0, amount - achieved), 2),
        })
    total_target = round(sum(row["target_amount"] for row in target_rows), 2)
    total_achieved = round(sum(row["achieved"] for row in target_rows), 2)
    sales_targets = {
        "period": period,
        "rows": target_rows,
        "totals": {
            "target_amount": total_target,
            "achieved": total_achieved,
            "attainment": (
                round(total_achieved / total_target * 100, 1) if total_target else None
            ),
        },
    }

    # --- Employee productivity (real counts per visible user) ---
    users_by_id = {user.id: user for user in users}
    performance = {
        user.id: {
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "leads": 0,
            "activities": 0,
            "open_deals": 0,
            "deals_won": 0,
            "revenue_won": 0.0,
            "open_pipeline_value": 0.0,
            "tasks_completed": 0,
            "followups_completed": 0,
        }
        for user in users
    }

    def bucket(owner_id):
        return performance.get(owner_id) if owner_id in users_by_id else None

    for lead in all_leads:
        row = bucket(lead.assigned_to)
        if row:
            row["leads"] += 1
    for activity in all_activities:
        row = bucket(activity.created_by)
        if row:
            row["activities"] += 1
    for deal in all_deals:
        row = bucket(deal.assigned_to)
        if not row:
            continue
        if deal.stage == "won":
            row["deals_won"] += 1
            row["revenue_won"] += deal.value or 0
        elif deal.stage != "lost":
            row["open_deals"] += 1
            row["open_pipeline_value"] += deal.value or 0
    for task in all_tasks:
        row = bucket(task.assigned_to)
        if row and task.status == "done":
            row["tasks_completed"] += 1
    for followup in all_followups:
        row = bucket(followup.assigned_to)
        if row and followup.status == "completed":
            row["followups_completed"] += 1

    target_by_user = {row["user_id"]: row for row in target_rows}
    employee_performance = []
    for row in performance.values():
        target_row = target_by_user.get(row["user_id"], {})
        row["revenue_won"] = round(row["revenue_won"], 2)
        row["open_pipeline_value"] = round(row["open_pipeline_value"], 2)
        row["target_amount"] = target_row.get("target_amount", 0)
        row["target_attainment"] = target_row.get("attainment")
        row["productivity_score"] = (
            row["leads"] + row["activities"] + row["deals_won"] * 5
            + row["tasks_completed"] + row["followups_completed"]
        )
        employee_performance.append(row)
    employee_performance.sort(
        key=lambda row: (row["revenue_won"], row["productivity_score"]), reverse=True
    )

    # --- Deal conversion funnel from current pipeline positions ---
    # Deals currently at a stage are treated as having passed the earlier
    # stages; counts are cumulative from that stage onward (won included).
    stage_counts = {stage: stage_map.get(stage, {}).get("count", 0) for stage in FUNNEL_STAGES}
    stage_values = {stage: stage_map.get(stage, {}).get("value", 0.0) for stage in FUNNEL_STAGES}
    funnel = []
    entry_count = None
    for index, stage in enumerate(FUNNEL_STAGES):
        count = sum(stage_counts[s] for s in FUNNEL_STAGES[index:])
        value = sum(stage_values[s] for s in FUNNEL_STAGES[index:])
        if entry_count is None:
            entry_count = count
        funnel.append({
            "stage": stage,
            "count": count,
            "value": round(value, 2),
            "conversion": round(count / entry_count * 100, 1) if entry_count else 0,
        })

    # --- Lost reason analysis ---
    reason_buckets = {}
    for deal in lost_deals:
        reason = (deal.lost_reason or "").strip() or "Unspecified"
        bucket = reason_buckets.setdefault(reason, {"count": 0, "value": 0.0})
        bucket["count"] += 1
        bucket["value"] += deal.value or 0
    lost_reasons = [
        {
            "reason": reason,
            "count": data["count"],
            "value": round(data["value"], 2),
            "share": round(data["count"] / len(lost_deals) * 100, 1) if lost_deals else 0,
        }
        for reason, data in reason_buckets.items()
    ]
    lost_reasons.sort(key=lambda row: (row["count"], row["value"]), reverse=True)

    return jsonify({
        "role": role,
        "scope": _scope_meta(),
        "pipeline_by_stage": pipeline_by_stage,
        "leads_by_source": leads_by_source,
        "win_rate": win_rate,
        "activities_30d": activities_30d,
        "revenue_trend": revenue_trend,
        "sales_targets": sales_targets,
        "employee_performance": employee_performance,
        "deal_conversion": funnel,
        "lost_reasons": {
            "total_lost": len(lost_deals),
            "total_lost_value": round(sum(d.value or 0 for d in lost_deals), 2),
            "top_reason": lost_reasons[0]["reason"] if lost_reasons else None,
            "reasons": lost_reasons,
        },
    }), 200

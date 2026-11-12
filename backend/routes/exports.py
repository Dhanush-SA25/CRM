"""CSV export endpoints for every core record type."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import or_

from models.activity import Activity
from models.customer import Customer
from models.deal import Deal
from models.employee import Employee
from models.followup import FollowUp
from models.lead import Lead
from models.task import Task
from models.user import User
from services.csv_export import csv_response
from services.scoping import current_role, scoped_query

exports_bp = Blueprint("exports", __name__, url_prefix="/api/export")


def _user_names():
    return {user.id: user.name for user in User.query.all()}


def _search_filter(query, model, fields):
    search = request.args.get("search", "").strip()
    if not search:
        return query
    like = f"%{search}%"
    return query.filter(or_(*[getattr(model, field).ilike(like) for field in fields]))


@exports_bp.get("/<resource>")
@jwt_required()
def export_resource(resource):
    resource = resource.lower()
    if resource == "employees":
        if current_role() != "admin":
            return jsonify({"error": "Forbidden"}), 403
        employees = Employee.query.order_by(Employee.employee_id.asc()).all()
        rows = [
            (
                e.employee_id, e.name, e.email, e.phone, e.department,
                e.designation, e.manager_employee_id, e.status,
                e.import_batch, e.created_at,
            )
            for e in employees
        ]
        return csv_response(
            ["Employee ID", "Name", "Email", "Phone", "Department",
             "Designation", "Manager ID", "Status", "Import batch", "Created"],
            rows,
            resource,
        )

    names = _user_names()

    if resource == "customers":
        query = scoped_query(Customer.query, Customer)
        query = _search_filter(query, Customer, ["name", "email", "company"])
        status = request.args.get("status", "").strip()
        if status:
            query = query.filter_by(status=status)
        customers = query.order_by(Customer.created_at.desc()).all()
        rows = [
            (c.id, c.name, c.email, c.phone, c.company, c.status,
             names.get(c.assigned_to, ""), c.created_at)
            for c in customers
        ]
        return csv_response(
            ["ID", "Name", "Email", "Phone", "Company", "Status", "Owner", "Created"],
            rows,
            resource,
        )

    if resource == "leads":
        query = scoped_query(Lead.query, Lead)
        query = _search_filter(query, Lead, ["name", "email", "company"])
        status = request.args.get("status", "").strip()
        source = request.args.get("source", "").strip()
        if status:
            query = query.filter_by(status=status)
        if source:
            query = query.filter_by(source=source)
        leads = query.order_by(Lead.created_at.desc()).all()
        rows = [
            (l.id, l.name, l.email, l.phone, l.company, l.status, l.source,
             l.score, names.get(l.assigned_to, ""), l.created_at)
            for l in leads
        ]
        return csv_response(
            ["ID", "Name", "Email", "Phone", "Company", "Status", "Source",
             "Score", "Owner", "Created"],
            rows,
            resource,
        )

    if resource == "deals":
        query = scoped_query(Deal.query, Deal)
        query = _search_filter(query, Deal, ["title"])
        stage = request.args.get("stage", "").strip()
        if stage:
            query = query.filter_by(stage=stage)
        deals = query.order_by(Deal.created_at.desc()).all()
        customers = {c.id: c.name for c in Customer.query.all()}
        rows = [
            (d.id, d.title, d.value, d.stage, d.probability, d.close_date,
             d.lost_reason, customers.get(d.customer_id, ""),
             names.get(d.assigned_to, ""), d.created_at)
            for d in deals
        ]
        return csv_response(
            ["ID", "Title", "Value", "Stage", "Probability", "Close date",
             "Lost reason", "Customer", "Owner", "Created"],
            rows,
            resource,
        )

    if resource == "tasks":
        query = scoped_query(Task.query, Task)
        query = _search_filter(query, Task, ["title", "description"])
        status = request.args.get("status", "").strip()
        if status:
            query = query.filter_by(status=status)
        tasks = query.order_by(Task.due_date.asc()).all()
        rows = [
            (t.id, t.title, t.status, t.priority, t.due_date,
             names.get(t.assigned_to, ""), t.created_at)
            for t in tasks
        ]
        return csv_response(
            ["ID", "Title", "Status", "Priority", "Due date", "Owner", "Created"],
            rows,
            resource,
        )

    if resource == "followups":
        query = scoped_query(FollowUp.query, FollowUp)
        query = _search_filter(query, FollowUp, ["title", "description"])
        status = request.args.get("status", "").strip()
        followups = query.order_by(FollowUp.due_date.asc()).all()
        rows = []
        for followup in followups:
            data = followup.to_dict()
            if status and data["status"] != status:
                continue
            rows.append((
                data["id"], data["title"], data["status"], data["priority"],
                data["linked_type"], data["linked_id"], data["due_date"],
                names.get(data["assigned_to"], ""), data["created_at"],
            ))
        return csv_response(
            ["ID", "Title", "Status", "Priority", "Linked type", "Linked ID",
             "Due date", "Owner", "Created"],
            rows,
            resource,
        )

    if resource == "activities":
        query = scoped_query(Activity.query, Activity, field="created_by")
        query = _search_filter(query, Activity, ["title", "description"])
        activities = query.order_by(Activity.created_at.desc()).all()
        rows = [
            (a.id, a.type, a.title, a.linked_type, a.linked_id,
             "yes" if a.completed else "no",
             names.get(a.created_by, ""), a.created_at)
            for a in activities
        ]
        return csv_response(
            ["ID", "Type", "Title", "Linked type", "Linked ID", "Completed",
             "Created by", "Created"],
            rows,
            resource,
        )

    return jsonify({"error": f"Unknown export resource '{resource}'"}), 404

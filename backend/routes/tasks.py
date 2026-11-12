"""Task CRUD routes."""
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from database.db import db
from models.task import Task
from services.scoping import can_access_owner, can_assign_to, get_current_user_id, scoped_query

tasks_bp = Blueprint("tasks", __name__, url_prefix="/api/tasks")

# Allowed enum values (see models/task.py)
TASK_STATUSES = ("todo", "in_progress", "done")
TASK_PRIORITIES = ("low", "medium", "high")


def _can_access(task):
    """True when the caller may act on this task's owner."""
    return can_access_owner(task.assigned_to)


@tasks_bp.get("/")
@jwt_required()
def list_tasks():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    status = request.args.get("status", "").strip()
    assigned_to = request.args.get("assigned_to", type=int)

    query = Task.query
    # Scope to the current user for sales reps; no-op for admin/manager
    query = scoped_query(query, Task, field="assigned_to")

    if status:
        query = query.filter_by(status=status)
    if assigned_to is not None:
        query = query.filter_by(assigned_to=assigned_to)

    pagination = query.order_by(Task.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    return jsonify({
        "tasks": [t.to_dict() for t in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": page,
    }), 200


@tasks_bp.post("/")
@jwt_required()
def create_task():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400
    if not data.get("due_date"):
        return jsonify({"error": "due_date is required"}), 400
    try:
        due_date = datetime.fromisoformat(data["due_date"])
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid due_date format"}), 400

    status = data.get("status", "todo")
    if status not in TASK_STATUSES:
        return jsonify({"error": f"Invalid status. Must be one of {list(TASK_STATUSES)}"}), 400

    priority = data.get("priority", "medium")
    if priority not in TASK_PRIORITIES:
        return jsonify({"error": f"Invalid priority. Must be one of {list(TASK_PRIORITIES)}"}), 400

    uid = get_current_user_id()
    assigned_to = data.get("assigned_to", uid)
    if not can_assign_to(assigned_to):
        return jsonify({"error": "Forbidden: cannot assign outside your team"}), 403

    task = Task(
        title=title,
        description=data.get("description"),
        due_date=due_date,
        status=status,
        priority=priority,
        # Default to the creator so sales reps always see their own tasks
        assigned_to=assigned_to,
        created_by=uid,
    )
    db.session.add(task)
    db.session.commit()
    return jsonify({"task": task.to_dict()}), 201


@tasks_bp.get("/<int:task_id>")
@jwt_required()
def get_task(task_id):
    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    if not _can_access(task):
        return jsonify({"error": "Forbidden"}), 403
    return jsonify({"task": task.to_dict()}), 200


@tasks_bp.put("/<int:task_id>")
@jwt_required()
def update_task(task_id):
    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    if not _can_access(task):
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}

    if "title" in data:
        title = (data.get("title") or "").strip()
        if not title:
            return jsonify({"error": "title cannot be empty"}), 400
        task.title = title
    if "description" in data:
        task.description = data["description"]
    if "due_date" in data:
        try:
            task.due_date = datetime.fromisoformat(data["due_date"])
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid due_date format"}), 400
    if "status" in data:
        if data["status"] not in TASK_STATUSES:
            return jsonify({"error": f"Invalid status. Must be one of {list(TASK_STATUSES)}"}), 400
        task.status = data["status"]
    if "priority" in data:
        if data["priority"] not in TASK_PRIORITIES:
            return jsonify({"error": f"Invalid priority. Must be one of {list(TASK_PRIORITIES)}"}), 400
        task.priority = data["priority"]
    if "assigned_to" in data:
        if not can_assign_to(data["assigned_to"]):
            return jsonify({"error": "Forbidden: cannot assign outside your team"}), 403
        task.assigned_to = data["assigned_to"]

    db.session.commit()
    return jsonify({"task": task.to_dict()}), 200


@tasks_bp.delete("/<int:task_id>")
@jwt_required()
def delete_task(task_id):
    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    if not _can_access(task):
        return jsonify({"error": "Forbidden"}), 403
    db.session.delete(task)
    db.session.commit()
    return jsonify({"message": "Task deleted"}), 200

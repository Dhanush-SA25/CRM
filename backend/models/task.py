"""Task model."""
from datetime import datetime
from database.db import db


class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    due_date = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default="todo")     # todo | in_progress | done
    priority = db.Column(db.String(10), default="medium")  # low | medium | high
    customer_id = db.Column(
        db.Integer, db.ForeignKey("customers.id"), nullable=True, index=True
    )
    lead_id = db.Column(db.Integer, db.ForeignKey("leads.id"), nullable=True, index=True)
    assigned_to = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    assigned_employee_id = db.Column(
        db.Integer, db.ForeignKey("employees.id"), nullable=True, index=True
    )
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_by_employee_id = db.Column(
        db.Integer, db.ForeignKey("employees.id"), nullable=True, index=True
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "due_date": self.due_date.isoformat(),
            "status": self.status,
            "priority": self.priority,
            "customer_id": self.customer_id,
            "lead_id": self.lead_id,
            "assigned_to": self.assigned_to,
            "assigned_employee_id": self.assigned_employee_id,
            "created_by": self.created_by,
            "created_by_employee_id": self.created_by_employee_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self):
        return f"<Task {self.title}>"

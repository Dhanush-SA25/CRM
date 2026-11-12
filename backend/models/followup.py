"""FollowUp model."""
from datetime import datetime
from database.db import db


class FollowUp(db.Model):
    __tablename__ = "followups"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    due_date = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default="pending")    # pending | completed | overdue
    priority = db.Column(db.String(10), default="medium")   # low | medium | high
    linked_type = db.Column(db.String(20), nullable=False)  # customer | lead
    linked_id = db.Column(db.Integer, nullable=False)
    assigned_to = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    assigned_employee_id = db.Column(
        db.Integer, db.ForeignKey("employees.id"), nullable=True, index=True
    )
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        # Compute overdue status at serialisation time (not persisted unless
        # explicitly updated). A pending follow-up whose due_date is in the
        # past is reported as "overdue".
        now = datetime.utcnow()
        status = self.status
        if self.status == "pending" and self.due_date is not None and self.due_date < now:
            status = "overdue"
        # is_overdue is True whenever due_date is in the past and the follow-up
        # has not been completed (covers pending, overdue, and any other
        # non-completed status).
        is_overdue = (
            self.due_date is not None
            and self.due_date < now
            and self.status != "completed"
        )
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "due_date": self.due_date.isoformat(),
            "status": status,
            "is_overdue": is_overdue,
            "priority": self.priority,
            "linked_type": self.linked_type,
            "linked_id": self.linked_id,
            "assigned_to": self.assigned_to,
            "assigned_employee_id": self.assigned_employee_id,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self):
        return f"<FollowUp {self.title}>"

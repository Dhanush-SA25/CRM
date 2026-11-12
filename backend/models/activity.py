"""Activity / interaction log model."""
from datetime import datetime
from database.db import db


class Activity(db.Model):
    __tablename__ = "activities"

    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(50), nullable=False)    # call | email | meeting | note | task
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    due_date = db.Column(db.DateTime, nullable=True)
    completed = db.Column(db.Boolean, default=False)
    status = db.Column(db.String(20), nullable=True, default="completed")
    outcome = db.Column(db.String(80), nullable=True)
    duration_minutes = db.Column(db.Integer, nullable=True)
    direction = db.Column(db.String(10), nullable=True)  # sent | received (email)
    recipient = db.Column(db.String(160), nullable=True)
    participants = db.Column(db.Text, nullable=True)
    location = db.Column(db.String(200), nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=True)
    lead_id = db.Column(db.Integer, db.ForeignKey("leads.id"), nullable=True, index=True)
    linked_type = db.Column(db.String(20), nullable=True)  # customer | lead | deal
    linked_id = db.Column(db.Integer, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    employee_id = db.Column(
        db.Integer, db.ForeignKey("employees.id"), nullable=True, index=True
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "description": self.description,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "completed": self.completed,
            "status": self.status or "completed",
            "outcome": self.outcome,
            "duration_minutes": self.duration_minutes,
            "direction": self.direction,
            "recipient": self.recipient,
            "participants": self.participants,
            "location": self.location,
            "customer_id": self.customer_id,
            "lead_id": self.lead_id,
            "linked_type": self.linked_type,
            "linked_id": self.linked_id,
            "created_by": self.created_by,
            "employee_id": self.employee_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self):
        return f"<Activity {self.type}: {self.title}>"

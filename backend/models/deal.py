"""Deal / Opportunity model."""
from datetime import datetime
from database.db import db

VALID_STAGES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]

STAGE_PROBABILITIES = {
    "new": 10,
    "contacted": 20,
    "qualified": 40,
    "proposal": 60,
    "negotiation": 80,
    "won": 100,
    "lost": 0,
}


class Deal(db.Model):
    __tablename__ = "deals"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    value = db.Column(db.Float, default=0.0)           # Monetary value
    stage = db.Column(db.String(50), default="new")
    # new | contacted | qualified | proposal | negotiation | won | lost
    probability = db.Column(db.Integer, default=10)    # 0-100 %
    close_date = db.Column(db.DateTime, nullable=True)
    lost_reason = db.Column(db.String(120), nullable=True)  # populated for lost deals
    notes = db.Column(db.Text, nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=True)
    assigned_to = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "value": self.value,
            "stage": self.stage,
            "probability": self.probability,
            "close_date": self.close_date.isoformat() if self.close_date else None,
            "lost_reason": self.lost_reason,
            "notes": self.notes,
            "customer_id": self.customer_id,
            "assigned_to": self.assigned_to,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self):
        return f"<Deal {self.title}>"

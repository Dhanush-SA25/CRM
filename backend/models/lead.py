"""Lead model."""
from datetime import datetime
from database.db import db


class Lead(db.Model):
    __tablename__ = "leads"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(50), nullable=True)
    company = db.Column(db.String(120), nullable=True)
    status = db.Column(db.String(50), default="new")  # new | contacted | qualified | lost
    source = db.Column(db.String(50), nullable=True)   # website | referral | linkedin | cold_call | other
    notes = db.Column(db.Text, nullable=True)
    score = db.Column(db.Integer, default=0)           # 0-100 lead quality score
    assigned_to = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "company": self.company,
            "status": self.status,
            "source": self.source,
            "notes": self.notes,
            "score": self.score,
            "assigned_to": self.assigned_to,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self):
        return f"<Lead {self.name}>"

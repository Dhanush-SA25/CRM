"""Customer model."""
from datetime import datetime
from database.db import db


class Customer(db.Model):
    __tablename__ = "customers"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(50), nullable=True)
    company = db.Column(db.String(120), nullable=True)
    address = db.Column(db.Text, nullable=True)
    website = db.Column(db.String(256), nullable=True)
    status = db.Column(db.String(50), default="prospect")  # active | inactive | prospect
    notes = db.Column(db.Text, nullable=True)
    assigned_to = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    deals = db.relationship("Deal", backref="customer", lazy=True, cascade="all, delete-orphan")
    activities = db.relationship("Activity", backref="customer", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "company": self.company,
            "address": self.address,
            "website": self.website,
            "status": self.status,
            "notes": self.notes,
            "assigned_to": self.assigned_to,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self):
        return f"<Customer {self.name}>"

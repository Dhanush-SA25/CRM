"""User model."""
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from database.db import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(50), default="sales")  # admin | sales | manager
    avatar = db.Column(db.String(256), nullable=True)
    manager_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)  # reporting line
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    customers = db.relationship("Customer", backref="owner", lazy=True, foreign_keys="Customer.assigned_to")
    leads = db.relationship("Lead", backref="owner", lazy=True, foreign_keys="Lead.assigned_to")
    deals = db.relationship("Deal", backref="owner", lazy=True, foreign_keys="Deal.assigned_to")
    activities = db.relationship("Activity", backref="owner", lazy=True, foreign_keys="Activity.created_by")

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "avatar": self.avatar,
            "manager_id": self.manager_id,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<User {self.email}>"

"""Quarterly sales targets per user.

Targets are stored per user and calendar quarter (e.g. ``2026-Q4``) so the
dashboard can compare achieved won revenue against a real configured value.
"""
from datetime import datetime

from database.db import db


class SalesTarget(db.Model):
    __tablename__ = "sales_targets"
    __table_args__ = (
        db.UniqueConstraint("user_id", "period", name="uq_sales_target_user_period"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    period = db.Column(db.String(10), nullable=False)  # e.g. 2026-Q4
    target_amount = db.Column(db.Float, nullable=False, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "period": self.period,
            "target_amount": round(self.target_amount or 0, 2),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

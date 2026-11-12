"""Row-level failures captured during an employee CSV import.

Stored so admins can download an error report after the fact, not just see the
failures in the import response.
"""
import json
from datetime import datetime

from database.db import db


class EmployeeImportError(db.Model):
    __tablename__ = "employee_import_errors"

    id = db.Column(db.Integer, primary_key=True)
    batch = db.Column(db.String(40), nullable=False, index=True)
    row_number = db.Column(db.Integer, nullable=False)
    employee_id = db.Column(db.String(40), nullable=True)
    email = db.Column(db.String(120), nullable=True)
    errors = db.Column(db.Text, nullable=False)  # JSON array of messages
    raw = db.Column(db.Text, nullable=True)      # JSON of the original row
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def error_list(self):
        try:
            return json.loads(self.errors)
        except (TypeError, ValueError):
            return [self.errors]

    def to_dict(self):
        return {
            "row": self.row_number,
            "employee_id": self.employee_id,
            "email": self.email,
            "errors": self.error_list(),
        }

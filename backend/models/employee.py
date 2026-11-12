"""Employee directory model used by the bulk-import workflow.

Employees are directory records only — they deliberately have no password or
login relationship. Creating users/accounts is a separate admin action.
"""
from datetime import datetime

from database.db import db


class Employee(db.Model):
    __tablename__ = "employees"

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.String(40), unique=True, nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(50), nullable=True)
    department = db.Column(db.String(80), nullable=True)
    designation = db.Column(db.String(120), nullable=True)
    manager_employee_id = db.Column(db.String(40), nullable=True, index=True)
    department_id = db.Column(
        db.Integer, db.ForeignKey("departments.id"), nullable=True, index=True
    )
    role_label = db.Column(db.String(20), nullable=True)  # manager | sales | employee
    joining_date = db.Column(db.Date, nullable=True)
    location = db.Column(db.String(120), nullable=True)
    status = db.Column(db.String(20), default="active")  # active | inactive
    import_batch = db.Column(db.String(40), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "department": self.department,
            "department_id": self.department_id,
            "designation": self.designation,
            "role_label": self.role_label,
            "joining_date": self.joining_date.isoformat() if self.joining_date else None,
            "location": self.location,
            "manager_employee_id": self.manager_employee_id,
            "status": self.status,
            "import_batch": self.import_batch,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<Employee {self.employee_id}: {self.name}>"

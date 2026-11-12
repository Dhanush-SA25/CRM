"""Additive schema management for SQLite deployments.

``db.create_all()`` creates new tables but never adds columns to tables that
already exist. This module applies the small set of additive columns introduced
after the initial release so an existing ``smartcrm_dev.db`` keeps working.
"""
from sqlalchemy import inspect, text

from database.db import db
# Registered here so ``db.create_all()`` creates these tables even when no
# route imports them directly.
from models.department import Department  # noqa: F401
from models.import_mapping import ImportMapping  # noqa: F401

# table -> {column: SQL type/constraint}
ADDITIVE_COLUMNS = {
    "users": {
        "manager_id": "INTEGER REFERENCES users(id)",
    },
    "employees": {
        "department_id": "INTEGER REFERENCES departments(id)",
        "role_label": "VARCHAR(20)",
        "joining_date": "DATE",
        "location": "VARCHAR(120)",
    },
    "customers": {
        "assigned_employee_id": "INTEGER REFERENCES employees(id)",
    },
    "leads": {
        "assigned_employee_id": "INTEGER REFERENCES employees(id)",
        "customer_id": "INTEGER REFERENCES customers(id)",
    },
    "deals": {
        "lost_reason": "VARCHAR(120)",
        "lead_id": "INTEGER REFERENCES leads(id)",
        "assigned_employee_id": "INTEGER REFERENCES employees(id)",
    },
    "tasks": {
        "customer_id": "INTEGER REFERENCES customers(id)",
        "lead_id": "INTEGER REFERENCES leads(id)",
        "assigned_employee_id": "INTEGER REFERENCES employees(id)",
        "created_by_employee_id": "INTEGER REFERENCES employees(id)",
    },
    "followups": {
        "assigned_employee_id": "INTEGER REFERENCES employees(id)",
    },
    "activities": {
        "lead_id": "INTEGER REFERENCES leads(id)",
        "employee_id": "INTEGER REFERENCES employees(id)",
        "status": "VARCHAR(20)",
        "outcome": "VARCHAR(80)",
        "duration_minutes": "INTEGER",
        "direction": "VARCHAR(10)",
        "recipient": "VARCHAR(160)",
        "participants": "TEXT",
        "location": "VARCHAR(200)",
    },
}


def _add_missing_columns():
    inspector = inspect(db.engine)
    added = []
    for table, columns in ADDITIVE_COLUMNS.items():
        if not inspector.has_table(table):
            continue
        existing = {column["name"] for column in inspector.get_columns(table)}
        for name, ddl in columns.items():
            if name in existing:
                continue
            db.session.execute(
                text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")
            )
            added.append(f"{table}.{name}")
    if added:
        db.session.commit()
    return added


def ensure_schema(app):
    """Create missing tables and columns. Safe to run on every startup."""
    with app.app_context():
        db.create_all()
        return _add_missing_columns()

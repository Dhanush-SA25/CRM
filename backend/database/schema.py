"""Additive schema management for SQLite deployments.

``db.create_all()`` creates new tables but never adds columns to tables that
already exist. This module applies the small set of additive columns introduced
after the initial release so an existing ``smartcrm_dev.db`` keeps working.
"""
from sqlalchemy import inspect, text

from database.db import db

# table -> {column: SQL type/constraint}
ADDITIVE_COLUMNS = {
    "users": {
        "manager_id": "INTEGER REFERENCES users(id)",
    },
    "deals": {
        "lost_reason": "VARCHAR(120)",
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

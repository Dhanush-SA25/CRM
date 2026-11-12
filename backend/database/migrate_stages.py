"""
database/migrate_stages.py
~~~~~~~~~~~~~~~~~~~~~~~~~~
Idempotent schema + data migration helper.

Run once after upgrading from the initial SmartCRM release:

    python -c "
    from app import create_app
    from database.migrate_stages import run_migration
    run_migration(create_app())
    "

Safe to re-run: every step checks the current state before acting.
"""

from sqlalchemy import text

from database.db import db


# ---------------------------------------------------------------------------
# Stage mapping  (old value → new value; unmapped → "new")
# ---------------------------------------------------------------------------
STAGE_MAP = {
    "prospecting": "new",
    "qualification": "qualified",
    "proposal": "proposal",
    "negotiation": "negotiation",
    "closed_won": "won",
    "closed_lost": "lost",
}


def _get_table_columns(conn, table_name: str) -> set:
    """Return the set of column names that currently exist in *table_name*."""
    rows = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
    return {row[1] for row in rows}  # row[1] is the column name


def run_migration(app) -> None:
    """
    Apply all pending schema and data migrations inside *app*'s context.

    Steps
    -----
    1. Rename deal stage values via raw UPDATE statements (single transaction).
    2. Add ``linked_type`` and ``linked_id`` columns to ``activities`` if absent.
    3. Call ``db.create_all()`` to create any tables not yet present in the DB
       (e.g. ``followups``, ``tasks``).
    """
    with app.app_context():
        # Ensure all model classes are registered with SQLAlchemy metadata
        # before create_all() is called.
        import models  # noqa: F401 — imports User, Customer, Lead, Deal, Activity
        from models.followup import FollowUp  # noqa: F401
        from models.task import Task  # noqa: F401

        engine = db.engine

        with engine.begin() as conn:
            # ------------------------------------------------------------------
            # Step 1 — migrate deal stages
            # ------------------------------------------------------------------
            _migrate_deal_stages(conn)

            # ------------------------------------------------------------------
            # Step 2 — add nullable columns to activities
            # ------------------------------------------------------------------
            _add_activities_columns(conn)

        # ------------------------------------------------------------------
        # Step 3 — create missing tables (followups, tasks, …)
        # ------------------------------------------------------------------
        db.create_all()
        print("[migrate_stages] Migration complete.")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _migrate_deal_stages(conn) -> None:
    """
    Rename old stage values in the ``deals`` table.

    Only rows whose current stage is in STAGE_MAP *and* differs from the new
    value are touched, keeping the operation idempotent and minimal.
    """
    # Collect distinct stages that actually exist in the table so we only
    # issue UPDATE statements when necessary.
    rows = conn.execute(text("SELECT DISTINCT stage FROM deals")).fetchall()
    existing_stages = {row[0] for row in rows}

    if not existing_stages:
        print("[migrate_stages] No deals found — skipping stage rename.")
        return

    updates_applied = 0

    # Apply explicit mappings
    for old_stage, new_stage in STAGE_MAP.items():
        if old_stage in existing_stages and old_stage != new_stage:
            conn.execute(
                text("UPDATE deals SET stage = :new WHERE stage = :old"),
                {"new": new_stage, "old": old_stage},
            )
            print(f"[migrate_stages] Renamed stage: {old_stage!r} → {new_stage!r}")
            updates_applied += 1

    # Catch-all: any remaining unknown stage → "new"
    known_new_values = set(STAGE_MAP.values()) | {"contacted"}
    for stage in existing_stages:
        if stage not in STAGE_MAP and stage not in known_new_values:
            conn.execute(
                text("UPDATE deals SET stage = 'new' WHERE stage = :old"),
                {"old": stage},
            )
            print(f"[migrate_stages] Unknown stage {stage!r} remapped → 'new'")
            updates_applied += 1

    if updates_applied == 0:
        print("[migrate_stages] Deal stages already up-to-date — nothing to rename.")


def _add_activities_columns(conn) -> None:
    """
    Add ``linked_type VARCHAR(20)`` and ``linked_id INTEGER`` nullable columns
    to the ``activities`` table.

    SQLite does not support ``ALTER TABLE … ADD COLUMN IF NOT EXISTS``, so we
    inspect ``PRAGMA table_info`` first and only issue the ALTER when the
    column is missing.
    """
    existing = _get_table_columns(conn, "activities")

    if "linked_type" not in existing:
        conn.execute(text("ALTER TABLE activities ADD COLUMN linked_type VARCHAR(20)"))
        print("[migrate_stages] Added column: activities.linked_type")
    else:
        print("[migrate_stages] Column activities.linked_type already exists — skipping.")

    if "linked_id" not in existing:
        conn.execute(text("ALTER TABLE activities ADD COLUMN linked_id INTEGER"))
        print("[migrate_stages] Added column: activities.linked_id")
    else:
        print("[migrate_stages] Column activities.linked_id already exists — skipping.")

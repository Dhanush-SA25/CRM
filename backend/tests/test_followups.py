"""Unit tests for FollowUp overdue status computation.

Covers requirement 3.3: a pending follow-up whose due_date is in the past
must serialise with status == "overdue" and is_overdue == True.

Tests:
  - Pending follow-up with past due_date is overdue          (req 3.3)
  - Follow-up with future due_date is not overdue            (req 3.3)
  - Completed follow-up with past due_date is not overdue    (req 3.3)
  - Property 4: Overdue Consistency                          (req 3.3)
"""
from datetime import datetime, timedelta

import pytest
from hypothesis import given, settings, strategies as st, HealthCheck

from app import create_app
from config.settings import TestingConfig
from database.db import db
from models.followup import FollowUp
from models.user import User


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def _app():
    """Module-scoped Flask app with an in-memory SQLite database."""
    from sqlalchemy.pool import StaticPool

    class _TestCfg(TestingConfig):
        SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
        SQLALCHEMY_ENGINE_OPTIONS = {"poolclass": StaticPool}

    application = create_app(_TestCfg)
    with application.app_context():
        db.create_all()
        # Seed a user so foreign-key constraints on created_by are satisfied.
        u = User(name="Test User", email="test@test.local", role="admin")
        u.set_password("pass")
        db.session.add(u)
        db.session.commit()
    yield application
    with application.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def make_followup(_app):
    """Factory that creates an unsaved FollowUp instance inside an app context.

    The instance is constructed via the normal ORM constructor so SQLAlchemy's
    instrumentation is properly initialised; it is never persisted.
    """
    def _factory(due_date, status="pending"):
        with _app.app_context():
            fu = FollowUp(
                title="Test followup",
                description=None,
                due_date=due_date,
                status=status,
                priority="medium",
                linked_type="customer",
                linked_id=1,
                assigned_to=None,
                created_by=1,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            return fu.to_dict()

    return _factory


# ---------------------------------------------------------------------------
# Unit tests
# ---------------------------------------------------------------------------
# **Validates: Requirements 3.3**


def test_pending_followup_with_past_due_date_is_overdue(make_followup):
    """A pending follow-up whose due_date is in the past must serialise as
    status='overdue' and is_overdue=True.
    """
    past = datetime.utcnow() - timedelta(days=1)
    result = make_followup(due_date=past, status="pending")

    assert result["status"] == "overdue", (
        "pending follow-up with past due_date should have status 'overdue'"
    )
    assert result["is_overdue"] is True, (
        "pending follow-up with past due_date should have is_overdue=True"
    )


def test_followup_with_future_due_date_is_not_overdue(make_followup):
    """A pending follow-up whose due_date is in the future must NOT be overdue."""
    future = datetime.utcnow() + timedelta(days=1)
    result = make_followup(due_date=future, status="pending")

    assert result["status"] == "pending", (
        "pending follow-up with future due_date should keep status 'pending'"
    )
    assert result["is_overdue"] is False, (
        "pending follow-up with future due_date should have is_overdue=False"
    )


def test_completed_followup_with_past_due_date_is_not_overdue(make_followup):
    """A completed follow-up must NOT be reported as overdue, even if its
    due_date is in the past.
    """
    past = datetime.utcnow() - timedelta(days=5)
    result = make_followup(due_date=past, status="completed")

    assert result["status"] == "completed", (
        "completed follow-up should retain status 'completed' regardless of due_date"
    )
    assert result["is_overdue"] is False, (
        "completed follow-up should have is_overdue=False even with past due_date"
    )


# ---------------------------------------------------------------------------
# Property-based test — Property 4: Overdue Consistency
# ---------------------------------------------------------------------------
# **Validates: Requirements 3.3**
#
# For any (status, days_offset) combination the following invariants hold:
#   - completed + any due_date  → is_overdue is False
#   - non-completed + past      → is_overdue is True
#   - non-completed + future    → is_overdue is False
#   - pending + past            → serialised status is "overdue"


@given(
    status=st.sampled_from(["pending", "completed", "overdue"]),
    days_offset=st.floats(
        min_value=-3650.0,
        max_value=3650.0,
        allow_nan=False,
        allow_infinity=False,
    ),
)
@settings(
    max_examples=200,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
def test_property_overdue_consistency(status, days_offset, make_followup):
    """Property 4: Overdue Consistency.

    is_overdue is True if and only if the follow-up is not completed AND
    its due_date lies strictly in the past. The serialised status equals
    "overdue" (not just the stored value) under those same conditions when
    the stored status is "pending".
    """
    now = datetime.utcnow()
    due_date = now + timedelta(days=days_offset)
    result = make_followup(due_date=due_date, status=status)

    # Use a small epsilon (1 second) to avoid boundary flakiness: a due_date
    # that is "exactly now" can land either side of the comparison depending on
    # sub-millisecond clock drift between constructing due_date and the
    # datetime.utcnow() call inside to_dict().
    epsilon = timedelta(seconds=1)
    clearly_past = due_date < (now - epsilon)
    clearly_future = due_date > (now + epsilon)

    if status == "completed":
        # Completed follow-ups are never overdue, regardless of due_date.
        assert result["is_overdue"] is False, (
            f"Completed followup must never be overdue (days_offset={days_offset})"
        )
        assert result["status"] == "completed"

    elif clearly_past:
        # Non-completed follow-up clearly in the past must be reported as overdue.
        assert result["is_overdue"] is True, (
            f"Non-completed followup with past due_date must be overdue "
            f"(status={status}, days_offset={days_offset})"
        )
        if status == "pending":
            assert result["status"] == "overdue", (
                f"Pending followup with past due_date must serialise as 'overdue' "
                f"(days_offset={days_offset})"
            )

    elif clearly_future:
        # Non-completed follow-up clearly in the future must NOT be overdue.
        assert result["is_overdue"] is False, (
            f"Non-completed followup with future due_date must not be overdue "
            f"(status={status}, days_offset={days_offset})"
        )
    # else: due_date is within ±1 second of now — skip assertion (boundary zone)

"""Shared pytest fixtures for the SmartCRM backend test suite.

Running ``pytest`` from the ``backend/`` directory uses an isolated in-memory
SQLite database (one connection kept alive via ``StaticPool``) so tests are
fast and never touch the real dev database.
"""
import pytest
from sqlalchemy.pool import StaticPool

from app import create_app
from config.settings import TestingConfig
from database.db import db
from flask_jwt_extended import create_access_token
from models.user import User


class _InMemoryConfig(TestingConfig):
    """TestingConfig backed by a single shared in-memory SQLite connection.

    Plain ``sqlite:///:memory:`` hands every new connection its own fresh
    database, which breaks Flask-SQLAlchemy request-scoped sessions during
    tests. ``StaticPool`` reuses one connection for the whole app lifetime so
    the tables created in setup persist across every request the test client
    makes.
    """

    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_ENGINE_OPTIONS = {"poolclass": StaticPool}


@pytest.fixture()
def app():
    """A fresh Flask app with an empty in-memory database."""
    application = create_app(_InMemoryConfig)
    with application.app_context():
        db.create_all()
    yield application
    with application.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def auth_headers(app):
    """Auth headers carrying a valid admin JWT (bypasses sales-rep scoping)."""
    with app.app_context():
        user = User(name="Test Admin", email="admin@test.local", role="admin")
        user.set_password("password123")
        db.session.add(user)
        db.session.commit()
        token = create_access_token(
            identity=str(user.id), additional_claims={"role": "admin"}
        )
    return {"Authorization": f"Bearer {token}"}

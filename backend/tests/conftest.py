"""Shared pytest fixtures for SmartCRM backend tests."""
import pytest

from app import create_app
from config.settings import TestingConfig
from database.db import db
from routes.admin import admin_bp
from services.rbac import role_required
from flask import jsonify


@pytest.fixture
def app():
    """Create a test application with in-memory SQLite.

    Registers the admin blueprint (not yet wired into ``create_app``) and a
    helper route that allows both ``admin`` and ``manager`` roles, so the
    ``role_required`` decorator can be exercised across different role sets.
    """
    app = create_app(TestingConfig)

    # Admin user-management routes (guarded by role_required("admin")).
    # Only register if create_app() hasn't already wired it in.
    if "admin" not in app.blueprints:
        app.register_blueprint(admin_bp)

    # Helper route that allows admin AND manager — used to verify managers
    # are permitted when explicitly included in the allowed set.
    @app.get("/test-admin-manager")
    @role_required("admin", "manager")
    def _test_admin_manager():
        return jsonify({"ok": True}), 200

    with app.app_context():
        db.create_all()
        # Seed a user so PUT /api/admin/users/<id> has a valid target.
        from models.user import User

        user = User(name="Seed User", email="seed@example.com", role="sales")
        user.set_password("password123")
        db.session.add(user)
        db.session.commit()

    yield app

    with app.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Return a Flask test client."""
    return app.test_client()


@pytest.fixture
def make_token(app):
    """Return a helper that mints JWT access tokens with a given role claim."""
    from flask_jwt_extended import create_access_token

    def _make(role, user_id=1):
        with app.app_context():
            return create_access_token(
                identity=str(user_id),
                additional_claims={"role": role},
            )

    return _make

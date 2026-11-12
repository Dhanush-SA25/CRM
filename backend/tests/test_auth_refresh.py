"""Refreshed access tokens must retain the user's role claim."""
from flask_jwt_extended import create_refresh_token, decode_token

from database.db import db
from models.user import User


def _make_user(app, role="admin"):
    with app.app_context():
        user = User(name="Refresh User", email="refresh@example.com", role=role)
        user.set_password("password123")
        db.session.add(user)
        db.session.commit()
        return user.id


def test_refresh_preserves_role_and_admin_access(client, app):
    user_id = _make_user(app)
    with app.app_context():
        refresh_token = create_refresh_token(identity=str(user_id))

    resp = client.post(
        "/api/auth/refresh",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )
    assert resp.status_code == 200
    access_token = resp.get_json()["access_token"]

    with app.app_context():
        claims = decode_token(access_token)
    assert claims["role"] == "admin"

    admin_resp = client.get(
        "/api/admin/users",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert admin_resp.status_code == 200


def test_refresh_for_deleted_user_returns_404(client, app):
    user_id = _make_user(app, role="sales")
    with app.app_context():
        refresh_token = create_refresh_token(identity=str(user_id))
        user = db.session.get(User, user_id)
        db.session.delete(user)
        db.session.commit()

    resp = client.post(
        "/api/auth/refresh",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )
    assert resp.status_code == 404

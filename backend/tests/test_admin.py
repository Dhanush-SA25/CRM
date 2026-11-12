"""Unit tests for admin route guards.

Verifies access-control enforcement on every admin user-management endpoint:

* GET  /api/admin/users          — list all users
* POST /api/admin/users          — create a user
* GET  /api/admin/users/<id>     — retrieve a single user
* PUT  /api/admin/users/<id>     — update role / active flag

Scenarios covered
-----------------
1. Unauthenticated requests (no JWT) → 401
2. Non-admin roles (``sales``, ``manager``) → 403
3. Admin role → 200/201 (endpoint works as expected)

Validates: Requirements 9.2, 9.3
"""
import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seed_user_id(app):
    """Return the id of the seed user created by the conftest fixture."""
    with app.app_context():
        from models.user import User
        user = User.query.filter_by(email="seed@example.com").first()
        return user.id if user else 1


# ---------------------------------------------------------------------------
# Unauthenticated → 401
# ---------------------------------------------------------------------------

class TestUnauthenticated:
    """All admin endpoints must reject requests that carry no JWT."""

    def test_get_users_no_token_returns_401(self, client):
        """GET /api/admin/users without a token returns 401.

        Validates: Requirements 9.2
        """
        resp = client.get("/api/admin/users")
        assert resp.status_code == 401

    def test_post_users_no_token_returns_401(self, client):
        """POST /api/admin/users without a token returns 401.

        Validates: Requirements 9.2
        """
        resp = client.post(
            "/api/admin/users",
            json={"name": "X", "email": "x@x.com", "password": "secret1"},
        )
        assert resp.status_code == 401

    def test_get_single_user_no_token_returns_401(self, client):
        """GET /api/admin/users/<id> without a token returns 401.

        Validates: Requirements 9.2
        """
        resp = client.get("/api/admin/users/1")
        assert resp.status_code == 401

    def test_put_user_no_token_returns_401(self, client):
        """PUT /api/admin/users/<id> without a token returns 401.

        Validates: Requirements 9.2
        """
        resp = client.put("/api/admin/users/1", json={"role": "sales"})
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Non-admin roles → 403
# ---------------------------------------------------------------------------

class TestNonAdminForbidden:
    """Sales-rep and manager roles must receive 403 on every admin endpoint."""

    @pytest.mark.parametrize("role", ["sales", "manager"])
    def test_get_users_non_admin_returns_403(self, client, make_token, role):
        """GET /api/admin/users returns 403 for sales and manager roles.

        Validates: Requirements 9.2
        """
        token = make_token(role)
        resp = client.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    @pytest.mark.parametrize("role", ["sales", "manager"])
    def test_post_users_non_admin_returns_403(self, client, make_token, role):
        """POST /api/admin/users returns 403 for sales and manager roles.

        Validates: Requirements 9.2
        """
        token = make_token(role)
        resp = client.post(
            "/api/admin/users",
            json={"name": "Eve", "email": "eve@example.com", "password": "secret1"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    @pytest.mark.parametrize("role", ["sales", "manager"])
    def test_get_single_user_non_admin_returns_403(self, client, make_token, role):
        """GET /api/admin/users/<id> returns 403 for sales and manager roles.

        Validates: Requirements 9.2
        """
        token = make_token(role)
        resp = client.get(
            "/api/admin/users/1",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    @pytest.mark.parametrize("role", ["sales", "manager"])
    def test_put_user_non_admin_returns_403(self, client, make_token, role):
        """PUT /api/admin/users/<id> returns 403 for sales and manager roles.

        Validates: Requirements 9.3
        """
        token = make_token(role)
        resp = client.put(
            "/api/admin/users/1",
            json={"role": "manager"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Admin role → success
# ---------------------------------------------------------------------------

class TestAdminAccess:
    """Admin-role JWTs must be allowed through and receive correct responses."""

    def test_get_users_admin_returns_200(self, client, make_token):
        """GET /api/admin/users returns 200 with a users list for admin role.

        Validates: Requirements 9.1, 9.2
        """
        token = make_token("admin")
        resp = client.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert "users" in body
        assert isinstance(body["users"], list)

    def test_post_users_admin_returns_201(self, client, make_token):
        """POST /api/admin/users creates a user and returns 201 for admin role.

        Validates: Requirements 9.2
        """
        token = make_token("admin")
        resp = client.post(
            "/api/admin/users",
            json={
                "name": "Alice Admin",
                "email": "alice@example.com",
                "password": "password123",
                "role": "sales",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        body = resp.get_json()
        assert body["user"]["email"] == "alice@example.com"
        assert body["user"]["role"] == "sales"

    def test_get_single_user_admin_returns_200(self, client, make_token, app):
        """GET /api/admin/users/<id> returns 200 with user data for admin role.

        Validates: Requirements 9.1
        """
        token = make_token("admin")
        user_id = _seed_user_id(app)
        resp = client.get(
            f"/api/admin/users/{user_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert "user" in body
        assert body["user"]["id"] == user_id

    def test_put_user_admin_returns_200(self, client, make_token, app):
        """PUT /api/admin/users/<id> updates and returns 200 for admin role.

        Validates: Requirements 9.3
        """
        token = make_token("admin")
        user_id = _seed_user_id(app)
        resp = client.put(
            f"/api/admin/users/{user_id}",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["user"]["is_active"] is False

    def test_get_nonexistent_user_admin_returns_404(self, client, make_token):
        """GET /api/admin/users/<id> returns 404 for a non-existent user id.

        Validates: Requirements 9.1
        """
        token = make_token("admin")
        resp = client.get(
            "/api/admin/users/99999",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    def test_post_users_duplicate_email_returns_409(self, client, make_token, app):
        """POST /api/admin/users with a duplicate email returns 409.

        Validates: Requirements 9.2
        """
        token = make_token("admin")
        # The seed user already has this email.
        resp = client.post(
            "/api/admin/users",
            json={
                "name": "Duplicate",
                "email": "seed@example.com",
                "password": "password123",
                "role": "sales",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 409

    def test_post_users_missing_fields_returns_400(self, client, make_token):
        """POST /api/admin/users with missing required fields returns 400.

        Validates: Requirements 9.2
        """
        token = make_token("admin")
        resp = client.post(
            "/api/admin/users",
            json={"name": "No Email"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_put_user_invalid_role_returns_400(self, client, make_token, app):
        """PUT /api/admin/users/<id> with an invalid role value returns 400.

        Validates: Requirements 9.3
        """
        token = make_token("admin")
        user_id = _seed_user_id(app)
        resp = client.put(
            f"/api/admin/users/{user_id}",
            json={"role": "superuser"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

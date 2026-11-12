"""Unit and property-based tests for the ``role_required`` RBAC decorator.

Property 6: Admin-Only User Management — validates that admin routes
return 403 for non-admin roles.

Validates: Requirements 2.5, 9.2
"""
from hypothesis import given, assume, settings, HealthCheck
from hypothesis.strategies import sampled_from

# The client fixture is function-scoped; hypothesis warns that it is not
# reset between generated inputs.  This is safe here because the 403 path
# short-circuits before the route body runs, so no DB state changes.
PBT_SETTINGS = settings(suppress_health_check=[HealthCheck.function_scoped_fixture])


# ---------------------------------------------------------------------------
# Unit tests — verify specific role / route combinations
# ---------------------------------------------------------------------------

class TestRoleRequired:
    """Unit tests for the ``role_required`` decorator."""

    def test_sales_blocked_from_admin_route(self, client, make_token):
        """A sales-role JWT must receive 403 on an admin-only route.

        Validates: Requirements 2.5, 9.2
        """
        token = make_token("sales")
        resp = client.post(
            "/api/admin/users",
            json={"name": "X", "email": "x@x.com", "password": "secret1"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_admin_allowed_admin_route(self, client, make_token):
        """An admin-role JWT must be allowed through an admin-only route.

        Validates: Requirements 2.5, 9.2
        """
        token = make_token("admin")
        resp = client.post(
            "/api/admin/users",
            json={
                "name": "New User",
                "email": "new@example.com",
                "password": "password123",
                "role": "sales",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201

    def test_manager_allowed_when_included(self, client, make_token):
        """A manager-role JWT must pass a route that allows admin and manager.

        Validates: Requirements 2.5
        """
        token = make_token("manager")
        resp = client.get(
            "/test-admin-manager",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    def test_no_jwt_rejected(self, client):
        """A request without a valid JWT must receive 401.

        Validates: Requirements 2.5
        """
        resp = client.post(
            "/api/admin/users",
            json={"name": "X", "email": "x@x.com", "password": "secret1"},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Property-based tests — Property 6: Admin-Only User Management
# ---------------------------------------------------------------------------

class TestProperty6AdminOnlyUserManagement:
    """Property 6: Admin-Only User Management.

    ``POST /api/admin/users`` and ``PUT /api/admin/users/<id>`` return
    HTTP 403 for any JWT whose ``role`` claim is not ``"admin"``.

    Validates: Requirements 2.5, 9.2
    """

    @PBT_SETTINGS
    @given(role=sampled_from(["admin", "manager", "sales"]))
    def test_post_admin_users_rejects_non_admin(self, client, make_token, role):
        """POST /api/admin/users returns 403 for every non-admin role.

        **Validates: Requirements 2.5, 9.2**
        """
        assume(role != "admin")
        token = make_token(role)
        resp = client.post(
            "/api/admin/users",
            json={"name": "X", "email": "x@x.com", "password": "secret1"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    @PBT_SETTINGS
    @given(role=sampled_from(["admin", "manager", "sales"]))
    def test_put_admin_users_rejects_non_admin(self, client, make_token, role):
        """PUT /api/admin/users/<id> returns 403 for every non-admin role.

        **Validates: Requirements 2.5, 9.2**
        """
        assume(role != "admin")
        token = make_token(role)
        resp = client.put(
            "/api/admin/users/1",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

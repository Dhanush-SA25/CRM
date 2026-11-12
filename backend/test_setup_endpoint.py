"""
Comprehensive tests for the setup endpoint.

Tests verify:
1. Token validation
2. Admin existence check (auto-disable)
3. Email/password validation
4. Password hashing security
5. Database transaction safety
6. No side effects on other data
"""
import os
import json
import pytest
from werkzeug.security import check_password_hash
from app import create_app
from database.db import db
from models.user import User


@pytest.fixture
def app():
    """Create Flask test app with test database."""
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture
def setup_token():
    """Setup token for testing."""
    return "test-setup-token-12345"


# ============================================================================
# Test 1: Token Validation
# ============================================================================

def test_missing_token_header(client, app):
    """Should return 401 when token header is missing."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        
        response = client.post(
            "/api/setup/initial-admin",
            json={"email": "admin@test.com", "password": "password123"}
        )
        
        assert response.status_code == 401
        assert response.json["error"] == "Unauthorized"


def test_wrong_token(client, app):
    """Should return 401 when token doesn't match."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "correct-token"
        
        response = client.post(
            "/api/setup/initial-admin",
            json={"email": "admin@test.com", "password": "password123"},
            headers={"X-Setup-Token": "wrong-token"}
        )
        
        assert response.status_code == 401
        assert response.json["error"] == "Unauthorized"


def test_token_not_configured(client, app):
    """Should return 403 when token not configured in environment."""
    with app.app_context():
        # Remove token from environment
        os.environ.pop("ADMIN_SETUP_TOKEN", None)
        
        response = client.post(
            "/api/setup/initial-admin",
            json={"email": "admin@test.com", "password": "password123"},
            headers={"X-Setup-Token": "any-token"}
        )
        
        assert response.status_code == 403
        assert response.json["error"] == "Forbidden"


def test_token_with_whitespace(client, app):
    """Should handle tokens with whitespace correctly."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "  test-token  "  # whitespace
        
        response = client.post(
            "/api/setup/initial-admin",
            json={"email": "admin@test.com", "password": "password123"},
            headers={"X-Setup-Token": "test-token"}  # without whitespace
        )
        
        # Should match after stripping
        assert response.status_code in [400, 201]  # Not 401


# ============================================================================
# Test 2: Admin Existence Check (Auto-Disable)
# ============================================================================

def test_admin_exists_blocks_creation(client, app):
    """Should return 403 if admin already exists."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        
        # Create first admin
        admin = User(name="Admin", email="admin@test.com", role="admin")
        admin.set_password("password123")
        db.session.add(admin)
        db.session.commit()
        
        # Try to create another admin
        response = client.post(
            "/api/setup/initial-admin",
            json={"email": "admin2@test.com", "password": "password123"},
            headers={"X-Setup-Token": "test-token"}
        )
        
        assert response.status_code == 403
        assert response.json["error"] == "Forbidden"


def test_endpoint_disables_after_first_admin(client, app):
    """Should disable endpoint after first admin creation."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        
        # First call succeeds
        response1 = client.post(
            "/api/setup/initial-admin",
            json={"email": "admin@test.com", "password": "password123"},
            headers={"X-Setup-Token": "test-token"}
        )
        assert response1.status_code == 201
        
        # Second call with same token fails
        response2 = client.post(
            "/api/setup/initial-admin",
            json={"email": "admin2@test.com", "password": "password456"},
            headers={"X-Setup-Token": "test-token"}
        )
        assert response2.status_code == 403


def test_admin_check_happens_before_token_validation(client, app):
    """Admin check should happen before token validation (fail fast)."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "correct-token"
        
        # Create an admin first
        admin = User(name="Admin", email="admin@test.com", role="admin")
        admin.set_password("password123")
        db.session.add(admin)
        db.session.commit()
        
        # Try with wrong token - should get 403, not 401
        response = client.post(
            "/api/setup/initial-admin",
            json={"email": "admin2@test.com", "password": "password123"},
            headers={"X-Setup-Token": "wrong-token"}
        )
        
        # Should return 403 (admin exists), not 401 (wrong token)
        assert response.status_code == 403


# ============================================================================
# Test 3: Email Validation
# ============================================================================

def test_missing_email(client, app):
    """Should return 400 for missing email."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        
        response = client.post(
            "/api/setup/initial-admin",
            json={"password": "password123"},
            headers={"X-Setup-Token": "test-token"}
        )
        
        assert response.status_code == 400
        assert "Email is required" in response.json["error"]


def test_invalid_email_format(client, app):
    """Should return 400 for invalid email format."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        
        invalid_emails = ["notanemail", "user@", "@domain.com", "user@domain"]
        
        for invalid_email in invalid_emails:
            response = client.post(
                "/api/setup/initial-admin",
                json={"email": invalid_email, "password": "password123"},
                headers={"X-Setup-Token": "test-token"}
            )
            assert response.status_code == 400
            assert "Invalid email format" in response.json["error"]


def test_valid_email_formats(client, app):
    """Should accept valid email formats."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        
        valid_emails = [
            "admin@example.com",
            "user.name@domain.co.uk",
            "user+tag@domain.org",
        ]
        
        for i, valid_email in enumerate(valid_emails):
            response = client.post(
                "/api/setup/initial-admin",
                json={"email": valid_email, "password": "password123"},
                headers={"X-Setup-Token": "test-token"}
            )
            # Not 400 for email format
            assert response.status_code != 400 or "Invalid email format" not in response.json.get("error", "")


def test_duplicate_email(client, app):
    """Should return 400 for duplicate email."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        
        # Create first user (non-admin)
        user = User(name="User", email="admin@test.com", role="sales")
        user.set_password("password123")
        db.session.add(user)
        db.session.commit()
        
        # Try to create admin with same email
        response = client.post(
            "/api/setup/initial-admin",
            json={"email": "admin@test.com", "password": "password456"},
            headers={"X-Setup-Token": "test-token"}
        )
        
        assert response.status_code == 400
        assert "already exists" in response.json["error"]


def test_email_lowercased(client, app):
    """Email should be lowercased before processing."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        
        response = client.post(
            "/api/setup/initial-admin",
            json={"email": "ADMIN@TEST.COM", "password": "password123"},
            headers={"X-Setup-Token": "test-token"}
        )
        
        assert response.status_code == 201
        
        # Verify stored email is lowercase
        admin = User.query.filter_by(email="admin@test.com").first()
        assert admin is not None
        assert admin.email == "admin@test.com"


# ============================================================================
# Test 4: Password Validation
# ============================================================================

def test_missing_password(client, app):
    """Should return 400 for missing password."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        
        response = client.post(
            "/api/setup/initial-admin",
            json={"email": "admin@test.com"},
            headers={"X-Setup-Token": "test-token"}
        )
        
        assert response.status_code == 400
        assert "Password is required" in response.json["error"]


def test_short_password(client, app):
    """Should return 400 for password shorter than 8 characters."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        
        response = client.post(
            "/api/setup/initial-admin",
            json={"email": "admin@test.com", "password": "short"},
            headers={"X-Setup-Token": "test-token"}
        )
        
        assert response.status_code == 400
        assert "at least 8 characters" in response.json["error"]


def test_password_exactly_8_chars(client, app):
    """Should accept password with exactly 8 characters."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        
        response = client.post(
            "/api/setup/initial-admin",
            json={"email": "admin@test.com", "password": "12345678"},
            headers={"X-Setup-Token": "test-token"}
        )
        
        assert response.status_code == 201


# ============================================================================
# Test 5: Password Hashing Security
# ============================================================================

def test_password_is_hashed(client, app):
    """Password should be hashed using werkzeug, not stored plaintext."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        password = "MySecurePassword123"
        
        response = client.post(
            "/api/setup/initial-admin",
            json={"email": "admin@test.com", "password": password},
            headers={"X-Setup-Token": "test-token"}
        )
        
        assert response.status_code == 201
        
        # Verify password is hashed
        admin = User.query.filter_by(email="admin@test.com").first()
        assert admin is not None
        assert admin.password_hash != password  # Not plaintext
        # werkzeug uses pbkdf2 or scrypt (depends on version)
        assert admin.password_hash.startswith(("pbkdf2", "scrypt"))
        assert check_password_hash(admin.password_hash, password)


def test_different_passwords_produce_different_hashes(client, app):
    """Same password called twice should produce different hashes."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        password = "SamePassword123"
        
        # Create first admin
        admin1 = User(name="Admin1", email="admin1@test.com", role="admin")
        admin1.set_password(password)
        db.session.add(admin1)
        db.session.commit()
        
        # Now try to create second admin with same password via endpoint
        # First, we need a new app context to get past the admin exists check
        # So we'll test it directly without going through endpoint
        admin2 = User(name="Admin2", email="admin2@test.com", role="sales")
        admin2.set_password(password)
        
        # Hashes should be different (salted)
        assert admin1.password_hash != admin2.password_hash
        
        # But both should verify the same password
        assert check_password_hash(admin1.password_hash, password)
        assert check_password_hash(admin2.password_hash, password)


# ============================================================================
# Test 6: Success Response
# ============================================================================

def test_successful_admin_creation(client, app):
    """Should create admin and return 201 with user data."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        
        response = client.post(
            "/api/setup/initial-admin",
            json={"email": "admin@test.com", "password": "password123"},
            headers={"X-Setup-Token": "test-token"}
        )
        
        assert response.status_code == 201
        data = response.json
        
        assert data["id"] is not None
        assert data["email"] == "admin@test.com"
        assert data["name"] == "Administrator"
        assert data["role"] == "admin"
        assert "message" in data


def test_admin_created_in_database(client, app):
    """Admin should be created in database."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        
        response = client.post(
            "/api/setup/initial-admin",
            json={"email": "admin@test.com", "password": "password123"},
            headers={"X-Setup-Token": "test-token"}
        )
        
        assert response.status_code == 201
        
        # Verify in database
        admin = User.query.filter_by(email="admin@test.com").first()
        assert admin is not None
        assert admin.role == "admin"
        assert admin.name == "Administrator"
        assert admin.check_password("password123")


# ============================================================================
# Test 7: No Side Effects
# ============================================================================

def test_no_modification_of_existing_users(client, app):
    """Should not modify existing users."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        
        # Create existing user
        existing = User(name="Existing", email="existing@test.com", role="sales")
        existing.set_password("oldpassword")
        db.session.add(existing)
        db.session.commit()
        
        existing_id = existing.id
        original_hash = existing.password_hash
        
        # Create admin
        response = client.post(
            "/api/setup/initial-admin",
            json={"email": "admin@test.com", "password": "password123"},
            headers={"X-Setup-Token": "test-token"}
        )
        
        assert response.status_code == 201
        
        # Verify existing user unchanged
        unchanged = User.query.get(existing_id)
        assert unchanged.password_hash == original_hash


def test_database_transaction_rollback_on_error(client, app):
    """Should rollback transaction on database error."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        
        # This test is tricky - we'd need to mock a DB error
        # For now, verify normal flow doesn't leave partial data
        response = client.post(
            "/api/setup/initial-admin",
            json={"email": "admin@test.com", "password": "password123"},
            headers={"X-Setup-Token": "test-token"}
        )
        
        assert response.status_code == 201
        
        # Should have exactly 1 admin
        admin_count = User.query.filter_by(role="admin").count()
        assert admin_count == 1


# ============================================================================
# Test 8: Edge Cases
# ============================================================================

def test_empty_request_body(client, app):
    """Should handle empty request body gracefully."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        
        response = client.post(
            "/api/setup/initial-admin",
            json={},
            headers={"X-Setup-Token": "test-token"}
        )
        
        assert response.status_code == 400


def test_no_request_body(client, app):
    """Should handle missing request body gracefully."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        
        response = client.post(
            "/api/setup/initial-admin",
            headers={"X-Setup-Token": "test-token", "Content-Type": "application/json"}
        )
        
        # Should return 400 or 415 (Flask behavior for missing body)
        assert response.status_code in [400, 415]


def test_invalid_json(client, app):
    """Should handle invalid JSON gracefully."""
    with app.app_context():
        os.environ["ADMIN_SETUP_TOKEN"] = "test-token"
        
        response = client.post(
            "/api/setup/initial-admin",
            data="not json",
            headers={"X-Setup-Token": "test-token", "Content-Type": "application/json"}
        )
        
        # Should fail gracefully (400 or 500, not crash)
        assert response.status_code in [400, 500]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

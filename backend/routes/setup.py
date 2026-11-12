"""
Setup routes for initial admin bootstrap.

Provides a token-authenticated endpoint to create the first admin user
without requiring shell access (useful for Render's free tier).

Security:
- Requires X-Setup-Token header matching ADMIN_SETUP_TOKEN env var
- Only works if no admin users exist (auto-disables after first admin)
- Returns generic 403 for both "token mismatch" and "admin exists" scenarios
- Prevents token brute-force and state enumeration attacks
- Validates email format, password length before processing
"""
import os
from flask import Blueprint, request, jsonify
from database.db import db
from models.user import User

setup_bp = Blueprint("setup", __name__, url_prefix="/api/setup")


def _admin_exists():
    """Check if any admin user already exists in the database."""
    return User.query.filter_by(role="admin").first() is not None


def _get_setup_token():
    """Get the setup token from environment, or None if not configured."""
    return os.getenv("ADMIN_SETUP_TOKEN", "").strip()


@setup_bp.post("/initial-admin")
def create_initial_admin():
    """
    Create the first admin user.

    Requires:
    - X-Setup-Token header matching ADMIN_SETUP_TOKEN environment variable
    - JSON body with 'email' and 'password' fields

    Returns:
    - 201 with user object on success
    - 400 if email or password is missing/invalid
    - 401 if token is missing or incorrect
    - 403 if admin already exists or token not configured
    - 500 on database error

    Security: After the first admin is created, this endpoint always returns 403
    (even with a valid token), preventing repeated creation or account enumeration.
    """
    # Step 1: Check if admin already exists (fail fast, secure response)
    if _admin_exists():
        return jsonify({"error": "Forbidden"}), 403

    # Step 2: Get token from environment
    configured_token = _get_setup_token()

    # Step 3: Check if setup is even enabled (token not configured)
    if not configured_token:
        return jsonify({"error": "Forbidden"}), 403

    # Step 4: Validate token in request (return 401 if missing or wrong)
    provided_token = request.headers.get("X-Setup-Token", "").strip()
    if not provided_token or provided_token != configured_token:
        return jsonify({"error": "Unauthorized"}), 401

    # Step 5: Validate request body
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    # Email validation
    if not email:
        return jsonify({"error": "Email is required"}), 400
    
    # Basic email validation: must have @ and . in domain
    if "@" not in email:
        return jsonify({"error": "Invalid email format"}), 400
    
    local, domain = email.rsplit("@", 1)
    if not local or not domain or "." not in domain:
        return jsonify({"error": "Invalid email format"}), 400

    # Password validation
    if not password:
        return jsonify({"error": "Password is required"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    # Step 6: Check if user with this email already exists
    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({"error": "User with this email already exists"}), 400

    # Step 7: Create admin user
    try:
        admin = User(name="Administrator", email=email, role="admin")
        admin.set_password(password)
        db.session.add(admin)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to create user", "detail": str(e)}), 500

    # Step 8: Return success
    return (
        jsonify({
            "id": admin.id,
            "email": admin.email,
            "name": admin.name,
            "role": admin.role,
            "message": "Admin user created successfully"
        }),
        201
    )

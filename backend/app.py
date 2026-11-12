"""
SmartCRM -- Flask application factory.
"""
import click
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config.settings import get_config
from database.db import db
from database.schema import ensure_schema
from routes import (
    auth_bp,
    customers_bp,
    leads_bp,
    deals_bp,
    activities_bp,
    dashboard_bp,
    followups_bp,
    tasks_bp,
    admin_bp,
    insights_bp,
    exports_bp,
    employees_bp,
    targets_bp,
)


def create_app(config_class=None):
    app = Flask(__name__)

    # Load configuration
    cfg = config_class or get_config()
    app.config.from_object(cfg)

    # Extensions — allow all origins in dev; tighten in production
    CORS(
        app,
        resources={r"/api/*": {"origins": "*"}},
        supports_credentials=False,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )
    db.init_app(app)
    JWTManager(app)

    # Register blueprints
    for bp in [
        auth_bp,
        customers_bp,
        leads_bp,
        deals_bp,
        activities_bp,
        dashboard_bp,
        followups_bp,
        tasks_bp,
        admin_bp,
        insights_bp,
        exports_bp,
        employees_bp,
        targets_bp,
    ]:
        app.register_blueprint(bp)

    # Health-check
    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "app": "SmartCRM API", "version": "1.0.0"}), 200

    # --- Error handlers (always return JSON, never HTML) ---
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "Bad request", "detail": str(e)}), 400

    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({"error": "Unauthorized"}), 401

    @app.errorhandler(403)
    def forbidden(e):
        return jsonify({"error": "Forbidden"}), 403

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error"}), 500

    # CLI commands
    @app.cli.command("create-db")
    def create_db():
        """Create missing tables and apply additive column upgrades."""
        added = ensure_schema(app)
        for column in added:
            click.echo(f"Added column {column}")
        click.echo("Database schema is up to date.")

    @app.cli.command("seed")
    def seed():
        """Seed the database with sample data."""
        from database.seed import seed_database
        seed_database(app)

    @app.cli.command("drop-db")
    def drop_db():
        """Drop all database tables (DANGEROUS)."""
        if click.confirm("This will delete ALL data. Are you sure?"):
            db.drop_all()
            click.echo("All tables dropped.")

    # Create tables / apply additive column upgrades for existing databases.
    ensure_schema(app)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
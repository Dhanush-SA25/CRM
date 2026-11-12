"""Application configuration settings.

Configuration is selected automatically:
  - On Render (RENDER env var is set) → ProductionConfig
  - When FLASK_ENV=production          → ProductionConfig
  - When FLASK_ENV=testing             → TestingConfig
  - Otherwise (local dev)              → DevelopmentConfig

Database URL handling:
  - `postgres://` is normalised to `postgresql://` for SQLAlchemy 2.x
  - In production, `DATABASE_URL` must be set — the app refuses to
    silently fall back to SQLite
  - In development, SQLite is the default when `DATABASE_URL` is absent
"""
import logging
import os
from datetime import timedelta
from urllib.parse import urlparse, urlunparse

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────

def _normalize_db_url(url):
    """Normalise a database URL for SQLAlchemy compatibility.

    SQLAlchemy 2.x dropped the `postgres` dialect alias, so Render and
    Heroku-style `postgres://` URLs must be rewritten to `postgresql://`.
    """
    if not url:
        return url
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://"):]
    return url


def _safe_db_url(url):
    """Return a database URL with credentials masked — safe for logs."""
    if not url:
        return "<not set>"
    try:
        parsed = urlparse(url)
        # Only show scheme + host:port, strip user/password
        if parsed.username or parsed.password:
            safe_netloc = parsed.hostname or ""
            if parsed.port:
                safe_netloc += f":{parsed.port}"
            return urlunparse(parsed._replace(netloc=safe_netloc))
        return url
    except Exception:
        return "<redacted>"


def _validate_db_url(url, is_production):
    """Validate and normalise the database URL.

    Returns the normalised URL ready for Flask-SQLAlchemy.

    Raises `RuntimeError` in production when `DATABASE_URL` is missing
    so the app never silently falls back to SQLite.
    """
    if is_production:
        if not url:
            raise RuntimeError(
                "DATABASE_URL is not set. Production requires a PostgreSQL "
                "connection string (e.g. postgresql://user:pass@host:5432/db). "
                "Add it in the Render dashboard → Environment → DATABASE_URL."
            )
        url = _normalize_db_url(url)
        # Warn (don't crash) if someone explicitly set a SQLite URL in prod
        if url.startswith("sqlite:///"):
            logger.warning(
                "Production DATABASE_URL points to SQLite (%s). "
                "This is acceptable for testing but not recommended — "
                "use a managed PostgreSQL database.",
                _safe_db_url(url),
            )
        return url

    # Development / testing — normalise if a URL was provided, else SQLite
    if url:
        return _normalize_db_url(url)
    return "sqlite:///smartcrm_dev.db"


def _is_render():
    """Detect whether the process is running on Render.com."""
    return (
        os.getenv("RENDER") == "true"
        or os.getenv("RENDER_SERVICE_ID") is not None
    )


# ── Config classes ───────────────────────────────────────────────────────

class Config:
    """Base configuration shared by all environments."""
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


class DevelopmentConfig(Config):
    """Local development — SQLite is the default."""
    DEBUG = True
    SQLALCHEMY_ECHO = False
    SQLALCHEMY_DATABASE_URI = "sqlite:///smartcrm_dev.db"


class ProductionConfig(Config):
    """Production — requires DATABASE_URL pointing to PostgreSQL."""
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = "sqlite:///smartcrm.db"


class TestingConfig(Config):
    """Unit tests — in-memory SQLite for speed and isolation."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


config_map = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}


# ── Factory ──────────────────────────────────────────────────────────────

def get_config():
    """Select and return the active configuration class.

    Precedence:
      1. `FLASK_ENV` environment variable (explicit override)
      2. Auto-detect Render → ProductionConfig
      3. Default → DevelopmentConfig

    The returned class has `SQLALCHEMY_DATABASE_URI` set to a validated,
    normalised value computed at call time.
    """
    flask_env = os.getenv("FLASK_ENV")

    if flask_env and flask_env in config_map:
        config_class = config_map[flask_env]
    elif _is_render():
        config_class = ProductionConfig
    else:
        config_class = DevelopmentConfig

    is_production = config_class is ProductionConfig
    is_testing = config_class is TestingConfig

    # ── Resolve the database URL ─────────────────────────────────────────
    raw_url = os.getenv("DATABASE_URL")

    if is_testing:
        db_url = "sqlite:///:memory:"
    else:
        db_url = _validate_db_url(raw_url, is_production)

    logger.info(
        "Config selected: %s | database: %s",
        config_class.__name__,
        _safe_db_url(db_url),
    )

    # Return a subclass with the resolved URI so the original class
    # definitions stay clean (no mutation of shared class attributes).
    class _ResolvedConfig(config_class):
        SQLALCHEMY_DATABASE_URI = db_url

    _ResolvedConfig.__name__ = config_class.__name__
    _ResolvedConfig.__qualname__ = config_class.__qualname__
    return _ResolvedConfig


"""Gunicorn production configuration for SmartCRM backend."""
import os

# Render sets the PORT env var — gunicorn must bind to it
bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"
workers = 2
timeout = 30
keepalive = 2
errorlog = "-"
accesslog = "-"
loglevel = "info"

# SQLite needs this to avoid "database is locked" under concurrent workers
preload_app = True

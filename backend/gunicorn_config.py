"""Gunicorn production configuration for SmartCRM backend."""
import os

bind = "0.0.0.0:"
workers = 2
timeout = 30
keepalive = 2
errorlog = "-"
accesslog = "-"
loglevel = "info"

# SQLite needs this to avoid "database is locked" under concurrent workers
preload_app = True

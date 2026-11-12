"""
Database initialisation — holds the shared SQLAlchemy instance.
Import `db` from here everywhere (avoids circular imports).
"""
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

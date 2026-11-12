"""
Auth service — business logic for authentication.
Keeps route handlers thin.
"""
from models.user import User
from database.db import db


class AuthService:
    @staticmethod
    def get_user_by_email(email: str) -> User | None:
        return User.query.filter_by(email=email.lower()).first()

    @staticmethod
    def get_user_by_id(user_id: int) -> User | None:
        return db.session.get(User, user_id)

    @staticmethod
    def create_user(name: str, email: str, password: str, role: str = "sales") -> User:
        user = User(name=name, email=email.lower(), role=role)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return user

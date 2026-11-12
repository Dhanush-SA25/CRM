from .auth import auth_bp
from .customers import customers_bp
from .leads import leads_bp
from .deals import deals_bp
from .activities import activities_bp
from .dashboard import dashboard_bp
from .followups import followups_bp
from .tasks import tasks_bp
from .admin import admin_bp
from .insights import insights_bp
from .exports import exports_bp
from .employees import employees_bp
from .targets import targets_bp

__all__ = [
    "auth_bp",
    "customers_bp",
    "leads_bp",
    "deals_bp",
    "activities_bp",
    "dashboard_bp",
    "followups_bp",
    "tasks_bp",
    "admin_bp",
    "insights_bp",
    "exports_bp",
    "employees_bp",
    "targets_bp",
]

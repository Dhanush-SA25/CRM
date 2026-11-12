"""Tests for global search, the notification feed, and dashboard analytics.

All analytics assertions check values derived from real seeded records; no
mock or sample figures are used.
"""
from datetime import datetime, timedelta

import pytest

from database.db import db
from models.activity import Activity
from models.customer import Customer
from models.deal import Deal
from models.employee import Employee
from models.followup import FollowUp
from models.lead import Lead
from models.target import SalesTarget
from models.task import Task
from models.user import User
from services.targets import current_period


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _seed(app):
    """Seed a manager/report team plus an unrelated rep and rich deal data."""
    with app.app_context():
        now = datetime.utcnow()
        admin = User(name="Ada Admin", email="admin@example.com", role="admin")
        manager = User(name="Mia Manager", email="manager@example.com", role="manager")
        rep = User(name="Ravi Rep", email="rep@example.com", role="sales")
        other = User(name="Omar Other", email="other@example.com", role="sales")
        for user in (admin, manager, rep, other):
            user.set_password("password123")
        db.session.add_all([admin, manager, rep, other])
        db.session.flush()
        rep.manager_id = manager.id

        customer = Customer(
            name="Globex Corporation", email="hello@globex.example",
            company="Globex", status="active", assigned_to=rep.id,
        )
        other_customer = Customer(
            name="Initech", email="hello@initech.example",
            company="Initech", status="prospect", assigned_to=other.id,
        )
        db.session.add_all([customer, other_customer])
        db.session.flush()

        deals = [
            Deal(
                title="Globex platform", value=1000, stage="won",
                close_date=now, customer_id=customer.id, assigned_to=rep.id,
                updated_at=now,
            ),
            Deal(
                title="Globex add-on", value=400, stage="lost",
                lost_reason="Budget", close_date=now,
                customer_id=customer.id, assigned_to=rep.id,
                updated_at=now,
            ),
            Deal(
                title="Globex rollout", value=2000, stage="proposal",
                close_date=now + timedelta(days=3),
                customer_id=customer.id, assigned_to=rep.id,
                updated_at=now,
            ),
            Deal(
                title="Old opportunity", value=900, stage="qualified",
                close_date=None, customer_id=customer.id, assigned_to=rep.id,
                updated_at=now - timedelta(days=20),
            ),
            Deal(
                title="Initech migration", value=7000, stage="won",
                close_date=now, customer_id=other_customer.id,
                assigned_to=other.id, updated_at=now,
            ),
        ]
        db.session.add_all(deals)

        lead = Lead(
            name="Globex champion", email="champion@globex.example",
            company="Globex", status="new", source="referral",
            score=90, assigned_to=rep.id,
        )
        db.session.add(lead)

        db.session.add_all([
            FollowUp(
                title="Globex overdue call", due_date=now - timedelta(days=1),
                status="pending", linked_type="customer", linked_id=customer.id,
                assigned_to=rep.id, created_by=rep.id,
            ),
            Task(
                title="Send Globex proposal", due_date=now - timedelta(days=2),
                status="todo", assigned_to=rep.id, created_by=rep.id,
            ),
            Activity(
                type="call", title="Globex discovery", customer_id=customer.id,
                created_by=rep.id,
            ),
            Employee(
                employee_id="EMP9001", name="Nadia Employee",
                email="nadia@example.com", department="Sales",
            ),
            SalesTarget(
                user_id=rep.id, period=current_period(), target_amount=5000,
            ),
        ])
        db.session.commit()
        return {
            "admin": admin.id,
            "manager": manager.id,
            "rep": rep.id,
            "other": other.id,
            "customer": customer.id,
            "lead": lead.id,
            "deals": [deal.id for deal in deals],
        }


class TestGlobalSearch:
    def test_short_query_returns_hint_without_results(self, client, app, make_token):
        ids = _seed(app)
        resp = client.get(
            "/api/search?q=g", headers=_headers(make_token("admin", ids["admin"]))
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["total"] == 0
        assert "at least 2" in body["error"]

    def test_admin_search_returns_deep_links(self, client, app, make_token):
        ids = _seed(app)
        resp = client.get(
            "/api/search?q=Globex", headers=_headers(make_token("admin", ids["admin"]))
        )
        assert resp.status_code == 200
        results = resp.get_json()["results"]
        assert results["customers"][0]["to"] == f"/customers?focus={ids['customer']}"
        assert results["deals"]
        assert all(item["to"].startswith("/deals?focus=") for item in results["deals"])
        assert results["leads"][0]["to"] == f"/leads?focus={ids['lead']}"
        assert results["followups"][0]["to"].startswith("/followups?focus=")
        assert results["tasks"][0]["to"].startswith("/tasks?focus=")

    def test_sales_scope_hides_other_records_and_employees(self, client, app, make_token):
        ids = _seed(app)
        rep_results = client.get(
            "/api/search?q=Initech", headers=_headers(make_token("sales", ids["rep"]))
        ).get_json()["results"]
        assert rep_results["customers"] == []
        assert rep_results["deals"] == []

        # Employees are a directory shared with admins/managers, not sales.
        rep_emp = client.get(
            "/api/search?q=Nadia", headers=_headers(make_token("sales", ids["rep"]))
        ).get_json()["results"]["employees"]
        assert rep_emp == []

        manager_emp = client.get(
            "/api/search?q=Nadia", headers=_headers(make_token("manager", ids["manager"]))
        ).get_json()["results"]["employees"]
        assert manager_emp and manager_emp[0]["to"].startswith("/admin/employees?focus=")

    def test_search_requires_authentication(self, client):
        assert client.get("/api/search?q=Globex").status_code == 401


class TestNotifications:
    def test_feed_is_built_from_real_records(self, client, app, make_token):
        ids = _seed(app)
        resp = client.get(
            "/api/notifications", headers=_headers(make_token("sales", ids["rep"]))
        )
        assert resp.status_code == 200
        body = resp.get_json()
        types = {item["type"] for item in body["notifications"]}
        assert {
            "followup_overdue", "task_overdue", "deal_closing", "deal_won", "lead_hot",
        } <= types
        assert body["counts"]["high"] >= 2
        assert all(item["to"].startswith("/") for item in body["notifications"])
        overdue = next(i for i in body["notifications"] if i["type"] == "followup_overdue")
        assert overdue["to"] == "/followups?status=overdue"
        task = next(i for i in body["notifications"] if i["type"] == "task_overdue")
        assert task["to"] == "/tasks?status=overdue"

    def test_other_rep_only_sees_own_alerts(self, client, app, make_token):
        ids = _seed(app)
        body = client.get(
            "/api/notifications", headers=_headers(make_token("sales", ids["other"]))
        ).get_json()
        types = {item["type"] for item in body["notifications"]}
        assert "deal_won" in types
        assert "followup_overdue" not in types
        assert "task_overdue" not in types


class TestDashboardAnalytics:
    def test_admin_analytics_cover_organization(self, client, app, make_token):
        ids = _seed(app)
        resp = client.get(
            "/api/dashboard/analytics",
            headers=_headers(make_token("admin", ids["admin"])),
        )
        assert resp.status_code == 200
        body = resp.get_json()

        assert body["scope"]["label"] == "Organization-wide"
        assert len(body["pipeline_by_stage"]) == 7
        assert sum(row["count"] for row in body["pipeline_by_stage"]) == 5
        assert body["win_rate"] == 66.7

        assert len(body["revenue_trend"]) == 12
        assert sum(row["revenue"] for row in body["revenue_trend"]) == 8000

        assert len(body["deal_conversion"]) == 6
        assert body["deal_conversion"][0]["conversion"] == 100.0
        top_stage = body["deal_conversion"][0]
        assert top_stage["count"] >= 1

        lost = body["lost_reasons"]
        assert lost["total_lost"] == 1
        assert lost["top_reason"] == "Budget"

        targets = body["sales_targets"]
        assert targets["period"] == current_period()
        rep_row = next(r for r in targets["rows"] if r["user_id"] == ids["rep"])
        assert rep_row["target_amount"] == 5000
        assert rep_row["achieved"] == 1000
        assert rep_row["attainment"] == 20.0
        assert rep_row["remaining"] == 4000

        performance = {row["user_id"]: row for row in body["employee_performance"]}
        assert performance[ids["rep"]]["revenue_won"] == 1000
        assert performance[ids["rep"]]["leads"] == 1
        assert performance[ids["rep"]]["activities"] == 1
        assert performance[ids["rep"]]["productivity_score"] == 1 + 1 + 5
        assert "Initech migration" not in str(body)  # deal titles are not leaked

    def test_manager_scope_is_team_only(self, client, app, make_token):
        ids = _seed(app)
        body = client.get(
            "/api/dashboard/analytics",
            headers=_headers(make_token("manager", ids["manager"])),
        ).get_json()
        assert body["scope"]["label"] == "Team"
        assert body["scope"]["team_size"] == 2
        assert sum(row["count"] for row in body["pipeline_by_stage"]) == 4
        assert sum(row["revenue"] for row in body["revenue_trend"]) == 1000
        assert {row["user_id"] for row in body["employee_performance"]} == {
            ids["manager"], ids["rep"],
        }

    def test_sales_scope_is_personal(self, client, app, make_token):
        ids = _seed(app)
        body = client.get(
            "/api/dashboard/analytics",
            headers=_headers(make_token("sales", ids["rep"])),
        ).get_json()
        assert body["scope"]["label"] == "Personal"
        assert body["scope"]["team_size"] == 1
        assert sum(row["count"] for row in body["pipeline_by_stage"]) == 4
        assert sum(row["revenue"] for row in body["revenue_trend"]) == 1000
        assert [row["user_id"] for row in body["employee_performance"]] == [ids["rep"]]

    def test_summary_is_scoped(self, client, app, make_token):
        ids = _seed(app)
        rep = client.get(
            "/api/dashboard/summary", headers=_headers(make_token("sales", ids["rep"]))
        ).get_json()["summary"]
        assert rep["total_deals"] == 4
        assert rep["won_value"] == 1000
        assert rep["overdue_followups"] == 1
        assert rep["overdue_tasks"] == 1

        admin = client.get(
            "/api/dashboard/summary", headers=_headers(make_token("admin", ids["admin"]))
        ).get_json()["summary"]
        assert admin["total_deals"] == 5
        assert admin["won_value"] == 8000

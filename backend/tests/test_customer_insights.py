"""Tests for Customer 360, duplicate detection, and activity scoping."""
from datetime import datetime, timedelta

import pytest

from database.db import db
from models.activity import Activity
from models.customer import Customer
from models.deal import Deal
from models.followup import FollowUp
from models.user import User


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _seed_team(app):
    """Create an admin, a manager, one report, and an unrelated sales rep."""
    with app.app_context():
        admin = User(name="Ada Admin", email="admin@example.com", role="admin")
        manager = User(name="Mia Manager", email="manager@example.com", role="manager")
        rep = User(
            name="Ravi Rep", email="rep@example.com", role="sales",
            manager_id=None,
        )
        other = User(name="Omar Other", email="other@example.com", role="sales")
        for user in (admin, manager, rep, other):
            user.set_password("password123")
        db.session.add_all([admin, manager, rep, other])
        db.session.flush()
        rep.manager_id = manager.id
        db.session.commit()
        return {
            "admin": admin.id,
            "manager": manager.id,
            "rep": rep.id,
            "other": other.id,
        }


def _seed_360_customer(app, rep_id):
    with app.app_context():
        now = datetime.utcnow()
        customer = Customer(
            name="Globex Corporation",
            email="hello@globex.example",
            phone="+1 555 0100",
            company="Globex",
            status="active",
            assigned_to=rep_id,
            created_at=now,
        )
        db.session.add(customer)
        db.session.flush()

        db.session.add_all([
            Deal(
                title="Globex expansion", value=2000, stage="proposal",
                close_date=now + timedelta(days=14), customer_id=customer.id,
                assigned_to=rep_id, created_at=now, updated_at=now,
            ),
            Deal(
                title="Globex pilot", value=1000, stage="won",
                close_date=now, customer_id=customer.id,
                assigned_to=rep_id, created_at=now, updated_at=now,
            ),
            Deal(
                title="Globex renewal", value=500, stage="lost",
                lost_reason="Price", close_date=now, customer_id=customer.id,
                assigned_to=rep_id, created_at=now, updated_at=now,
            ),
            Activity(
                type="call", title="Intro call", customer_id=customer.id,
                created_by=rep_id, created_at=now, updated_at=now,
            ),
            FollowUp(
                title="Overdue check-in", due_date=now - timedelta(days=2),
                status="pending", linked_type="customer", linked_id=customer.id,
                assigned_to=rep_id, created_by=rep_id,
            ),
        ])
        db.session.commit()
        return customer.id


class TestCustomer360:
    def test_metrics_are_derived_from_records(self, client, app, make_token):
        ids = _seed_team(app)
        customer_id = _seed_360_customer(app, ids["rep"])

        resp = client.get(
            f"/api/customers/{customer_id}/360",
            headers=_headers(make_token("sales", ids["rep"])),
        )
        assert resp.status_code == 200
        body = resp.get_json()
        metrics = body["metrics"]

        assert metrics["deals_count"] == 3
        assert metrics["open_deals"] == 1
        assert metrics["won_deals"] == 1
        assert metrics["lost_deals"] == 1
        assert metrics["open_pipeline_value"] == 2000
        assert metrics["won_value"] == 1000
        assert metrics["lost_value"] == 500
        assert metrics["win_rate"] == 50.0
        assert metrics["activities_count"] == 1
        assert metrics["followups_count"] == 1
        assert metrics["overdue_followups"] == 1
        # recent activity 40 + open deal 20 + won deal 20 + active status 20
        # - overdue follow-up 20 = 80
        assert metrics["health_score"] == 80
        assert metrics["health_label"] == "healthy"
        assert body["owner"]["id"] == ids["rep"]
        assert len(body["deals"]) == 3
        assert len(body["activities"]) == 1
        assert len(body["followups"]) == 1

    def test_other_sales_rep_is_forbidden(self, client, app, make_token):
        ids = _seed_team(app)
        customer_id = _seed_360_customer(app, ids["rep"])
        resp = client.get(
            f"/api/customers/{customer_id}/360",
            headers=_headers(make_token("sales", ids["other"])),
        )
        assert resp.status_code == 403

    def test_manager_can_view_report_customer(self, client, app, make_token):
        ids = _seed_team(app)
        customer_id = _seed_360_customer(app, ids["rep"])
        resp = client.get(
            f"/api/customers/{customer_id}/360",
            headers=_headers(make_token("manager", ids["manager"])),
        )
        assert resp.status_code == 200


class TestDuplicateCustomers:
    def test_groups_are_scoped_and_transitive(self, client, app, make_token):
        ids = _seed_team(app)
        with app.app_context():
            db.session.add_all([
                Customer(
                    name="Acme Inc", email="acme1@example.com",
                    phone="(555) 123-4567", assigned_to=ids["rep"],
                ),
                Customer(
                    name="Acme", email="acme2@example.com",
                    phone="+1 555 123 4567", assigned_to=ids["rep"],
                ),
                Customer(
                    name="Acme Corp", email="acme3@example.com",
                    phone="+1 555 987 6543", assigned_to=ids["other"],
                ),
                Customer(
                    name="Unrelated LLC", email="solo@example.com",
                    phone="+1 555 000 0000", assigned_to=ids["rep"],
                ),
            ])
            db.session.commit()

        rep_resp = client.get(
            "/api/customers/duplicates",
            headers=_headers(make_token("sales", ids["rep"])),
        )
        assert rep_resp.status_code == 200
        rep_body = rep_resp.get_json()
        assert rep_body["scanned"] == 3
        assert rep_body["total_groups"] == 1
        assert len(rep_body["groups"][0]["customers"]) == 2
        reasons = {detail["reason"] for detail in rep_body["groups"][0]["match_details"]}
        assert "Same name" in reasons

        admin_resp = client.get(
            "/api/customers/duplicates",
            headers=_headers(make_token("admin", ids["admin"])),
        )
        admin_body = admin_resp.get_json()
        assert admin_body["scanned"] == 4
        assert len(admin_body["groups"][0]["customers"]) == 3


class TestActivityScoping:
    def test_list_update_delete_respect_ownership(self, client, app, make_token):
        ids = _seed_team(app)
        rep_headers = _headers(make_token("sales", ids["rep"]))
        other_headers = _headers(make_token("sales", ids["other"]))
        manager_headers = _headers(make_token("manager", ids["manager"]))
        admin_headers = _headers(make_token("admin", ids["admin"]))

        own = client.post(
            "/api/activities/", json={"type": "call", "title": "Rep call"},
            headers=rep_headers,
        )
        foreign = client.post(
            "/api/activities/", json={"type": "email", "title": "Other email"},
            headers=other_headers,
        )
        assert own.status_code == 201 and foreign.status_code == 201
        foreign_id = foreign.get_json()["activity"]["id"]

        rep_list = client.get("/api/activities/", headers=rep_headers).get_json()
        assert [a["title"] for a in rep_list["activities"]] == ["Rep call"]

        manager_list = client.get(
            "/api/activities/", headers=manager_headers
        ).get_json()
        assert [a["title"] for a in manager_list["activities"]] == ["Rep call"]

        admin_list = client.get("/api/activities/", headers=admin_headers).get_json()
        assert len(admin_list["activities"]) == 2

        forbidden = client.put(
            f"/api/activities/{foreign_id}", json={"title": "hijack"},
            headers=rep_headers,
        )
        assert forbidden.status_code == 403

        allowed = client.put(
            f"/api/activities/{foreign_id}", json={"completed": True},
            headers=other_headers,
        )
        assert allowed.status_code == 200

        delete_forbidden = client.delete(
            f"/api/activities/{foreign_id}", headers=rep_headers
        )
        assert delete_forbidden.status_code == 403

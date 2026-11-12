"""Tests for admin quarterly targets and CSV exports."""
from datetime import datetime, timedelta

import pytest

from database.db import db
from models.customer import Customer
from models.deal import Deal
from models.employee import Employee
from models.lead import Lead
from models.target import SalesTarget
from models.user import User
from services.targets import current_period


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _seed(app):
    with app.app_context():
        now = datetime.utcnow()
        admin = User(name="Ada Admin", email="admin@example.com", role="admin")
        rep = User(name="Ravi Rep", email="rep@example.com", role="sales")
        other = User(name="Omar Other", email="other@example.com", role="sales")
        for user in (admin, rep, other):
            user.set_password("password123")
        db.session.add_all([admin, rep, other])
        db.session.flush()

        rep_customer = Customer(
            name="Globex", email="hello@globex.example", assigned_to=rep.id
        )
        other_customer = Customer(
            name="Initech", email="hello@initech.example", assigned_to=other.id
        )
        db.session.add_all([rep_customer, other_customer])
        db.session.flush()

        db.session.add_all([
            Deal(
                title="Globex win", value=2500, stage="won",
                close_date=now, assigned_to=rep.id,
            ),
            Deal(
                title="Old win", value=9000, stage="won",
                close_date=now - timedelta(days=400), assigned_to=rep.id,
            ),
            Deal(
                title="Initech win", value=1200, stage="won",
                close_date=now, assigned_to=other.id,
            ),
            Lead(
                name="Globex lead", email="lead@globex.example",
                status="new", source="referral", score=55, assigned_to=rep.id,
            ),
            Employee(
                employee_id="EMP0001", name="Jane Doe",
                email="jane@example.com", department="Sales",
                designation="AE", status="active", import_batch="IMP-TEST",
            ),
        ])
        db.session.commit()
        return {"admin": admin.id, "rep": rep.id, "other": other.id}


class TestSalesTargets:
    def test_default_period_and_achievement(self, client, app, make_token):
        ids = _seed(app)
        with app.app_context():
            db.session.add(SalesTarget(
                user_id=ids["rep"], period=current_period(), target_amount=5000,
            ))
            db.session.commit()

        resp = client.get(
            "/api/admin/targets/", headers=_headers(make_token("admin", ids["admin"]))
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["period"] == current_period()
        assert body["start"] and body["end"]

        rep_row = next(r for r in body["targets"] if r["user_id"] == ids["rep"])
        # Only the in-quarter win (2500) counts; the 400-day-old win does not.
        assert rep_row["achieved"] == 2500
        assert rep_row["attainment"] == 50.0
        assert rep_row["remaining"] == 2500

        assert body["totals"]["target_amount"] == 5000
        assert body["totals"]["achieved"] == 3700

    def test_put_creates_and_updates_without_duplicates(self, client, app, make_token):
        ids = _seed(app)
        token = make_token("admin", ids["admin"])
        headers = _headers(token)

        created = client.put(
            "/api/admin/targets/",
            json={"user_id": ids["other"], "period": current_period(), "target_amount": 1000},
            headers=headers,
        )
        assert created.status_code == 200

        updated = client.put(
            "/api/admin/targets/",
            json={"user_id": ids["other"], "period": current_period(), "target_amount": 3000},
            headers=headers,
        )
        assert updated.status_code == 200
        assert updated.get_json()["target"]["target_amount"] == 3000
        assert updated.get_json()["achieved"] == 1200

        with app.app_context():
            rows = SalesTarget.query.filter_by(
                user_id=ids["other"], period=current_period()
            ).all()
            assert len(rows) == 1

    def test_explicit_period_returns_bounds(self, client, app, make_token):
        ids = _seed(app)
        resp = client.get(
            "/api/admin/targets/?period=2025-Q1",
            headers=_headers(make_token("admin", ids["admin"])),
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["period"] == "2025-Q1"
        assert body["start"].startswith("2025-01-01")
        assert body["end"].startswith("2025-04-01")

    @pytest.mark.parametrize(
        "payload",
        [
            {"period": current_period(), "target_amount": -1},
            {"period": "2026-Q9", "target_amount": 100},
            {"period": current_period(), "target_amount": "not-a-number"},
        ],
    )
    def test_invalid_payloads_return_400(self, client, app, make_token, payload):
        ids = _seed(app)
        resp = client.put(
            "/api/admin/targets/", json={"user_id": ids["rep"], **payload},
            headers=_headers(make_token("admin", ids["admin"])),
        )
        assert resp.status_code == 400

    def test_missing_user_returns_400(self, client, app, make_token):
        ids = _seed(app)
        resp = client.put(
            "/api/admin/targets/",
            json={"period": current_period(), "target_amount": 100},
            headers=_headers(make_token("admin", ids["admin"])),
        )
        assert resp.status_code == 400

    def test_non_admin_is_forbidden(self, client, app, make_token):
        ids = _seed(app)
        headers = _headers(make_token("sales", ids["rep"]))
        assert client.get("/api/admin/targets/", headers=headers).status_code == 403
        resp = client.put(
            "/api/admin/targets/",
            json={"user_id": ids["rep"], "period": current_period(), "target_amount": 1},
            headers=headers,
        )
        assert resp.status_code == 403


class TestExports:
    def test_employee_export_is_admin_only(self, client, app, make_token):
        ids = _seed(app)
        admin_resp = client.get(
            "/api/export/employees",
            headers=_headers(make_token("admin", ids["admin"])),
        )
        assert admin_resp.status_code == 200
        assert "text/csv" in admin_resp.headers["Content-Type"]
        assert "attachment" in admin_resp.headers["Content-Disposition"]
        text = admin_resp.get_data(as_text=True)
        assert "Employee ID,Name,Email" in text
        assert "EMP0001" in text

        sales_resp = client.get(
            "/api/export/employees",
            headers=_headers(make_token("sales", ids["rep"])),
        )
        assert sales_resp.status_code == 403

    def test_customer_export_respects_scope(self, client, app, make_token):
        ids = _seed(app)
        resp = client.get(
            "/api/export/customers",
            headers=_headers(make_token("sales", ids["rep"])),
        )
        assert resp.status_code == 200
        text = resp.get_data(as_text=True)
        assert "Globex" in text
        assert "Initech" not in text

        admin_text = client.get(
            "/api/export/customers",
            headers=_headers(make_token("admin", ids["admin"])),
        ).get_data(as_text=True)
        assert "Globex" in admin_text and "Initech" in admin_text

    def test_lead_export_includes_score(self, client, app, make_token):
        ids = _seed(app)
        text = client.get(
            "/api/export/leads",
            headers=_headers(make_token("sales", ids["rep"])),
        ).get_data(as_text=True)
        assert "Score" in text.splitlines()[0]
        assert "Globex lead" in text

    def test_unknown_resource_and_unauthenticated(self, client, app, make_token):
        ids = _seed(app)
        assert client.get(
            "/api/export/nonsense",
            headers=_headers(make_token("admin", ids["admin"])),
        ).status_code == 404
        assert client.get("/api/export/customers").status_code == 401

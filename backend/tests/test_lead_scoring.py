"""Tests for deterministic, rule-based lead scoring.

Covers:
* Server-side scoring on create (client-supplied score is ignored)
* Full-signal lead scoring 100 and weak lead scoring low
* Incremental rescore endpoint returns a breakdown that sums to the score
* Bulk rescore only touches the caller's visible leads
"""
import pytest

from database.db import db
from models.lead import Lead


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


class TestLeadScoring:
    def test_full_signal_lead_scores_100(self, client, make_token):
        token = make_token("sales")
        resp = client.post(
            "/api/leads/",
            json={
                "name": "Priya Sharma",
                "email": "priya.sharma@acme-industries.com",
                "phone": "+1 555 0142",
                "company": "Acme Industries",
                "status": "qualified",
                "source": "referral",
                "notes": (
                    "Discovery call done: budget approved for Q4, timeline is "
                    "30 days, and the VP of Operations is the decision maker."
                ),
                "score": 5,  # must be ignored — the server derives the score
            },
            headers=_headers(token),
        )
        assert resp.status_code == 201
        lead = resp.get_json()["lead"]
        assert lead["score"] == 100

    def test_weak_lead_scores_low(self, client, make_token):
        token = make_token("sales")
        resp = client.post(
            "/api/leads/",
            json={
                "name": "Anon",
                "email": "anon@gmail.com",
                "status": "new",
                "source": "other",
                "score": 99,
            },
            headers=_headers(token),
        )
        assert resp.status_code == 201
        # other 2 + new 5 + no company/phone/domain/notes + recent 15 = 22
        assert resp.get_json()["lead"]["score"] == 22

    def test_rescore_returns_breakdown_that_sums_to_score(self, client, make_token):
        token = make_token("sales")
        created = client.post(
            "/api/leads/",
            json={
                "name": "Rohan Mehta",
                "email": "rohan@northwind.example",
                "company": "Northwind",
                "status": "contacted",
                "source": "linkedin",
                "notes": "x" * 45,
            },
            headers=_headers(token),
        ).get_json()["lead"]

        resp = client.post(
            f"/api/leads/{created['id']}/score", headers=_headers(token)
        )
        assert resp.status_code == 200
        body = resp.get_json()
        scoring = body["scoring"]
        assert scoring["score"] == body["lead"]["score"]
        assert scoring["breakdown"]
        assert sum(item["points"] for item in scoring["breakdown"]) == scoring["score"]
        rules = {item["rule"] for item in scoring["breakdown"]}
        assert {"Lead source", "Pipeline status", "Company identified"} <= rules

    def test_scoring_is_deterministic(self, client, make_token):
        token = make_token("sales")
        payload = {
            "name": "Repeatable",
            "email": "repeatable@corp.example",
            "company": "Corp",
            "status": "contacted",
            "source": "website",
        }
        first = client.post(
            "/api/leads/", json=payload, headers=_headers(token)
        ).get_json()["lead"]
        second = client.post(
            "/api/leads/", json={**payload, "email": "repeatable2@corp.example"},
            headers=_headers(token),
        ).get_json()["lead"]
        assert first["score"] == second["score"]

    def test_bulk_rescore_scopes_to_visible_leads(self, client, make_token, app):
        sales_a = make_token("sales", user_id=1)
        sales_b = make_token("sales", user_id=2)

        client.post(
            "/api/leads/",
            json={"name": "Owned by one", "email": "one@example.com"},
            headers=_headers(sales_a),
        )
        client.post(
            "/api/leads/",
            json={"name": "Owned by two", "email": "two@example.com"},
            headers=_headers(sales_b),
        )

        resp = client.post("/api/leads/rescore", headers=_headers(sales_a))
        assert resp.status_code == 200
        assert resp.get_json()["updated"] == 1

        with app.app_context():
            assert Lead.query.count() == 2

"""Unit and property-based tests for Deal stage validation.

Covers the 7-stage sales pipeline migration:
  * POST /api/deals/  with an invalid stage -> HTTP 400   (req 1.4)
  * PUT  /api/deals/<id> with an invalid stage -> HTTP 400 (req 1.4)
  * All 7 valid stages accepted on POST                    (req 1.1)
  * Property 1: Stage Enum Closure                         (req 1.1, 1.4)
"""
import pytest
from hypothesis import given, settings, strategies as st, HealthCheck

from models.deal import VALID_STAGES

# The closed set of stages every deal must come from (req 1.1).
assert VALID_STAGES == [
    "new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"
], "VALID_STAGES must contain exactly the 7 pipeline stages in order"


# --------------------------------------------------------------------------- #
# Unit tests                                                                   #
# --------------------------------------------------------------------------- #
# **Validates: Requirements 1.4**


def test_post_deal_invalid_stage_returns_400(client, auth_headers):
    """POST /api/deals/ with an invalid stage must return HTTP 400."""
    resp = client.post(
        "/api/deals/",
        json={"title": "Bad Stage Deal", "stage": "invalid_stage"},
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert "stage" in resp.get_json()["error"].lower()


@pytest.mark.parametrize(
    "invalid_stage",
    ["", "won ", "WON", "prospecting", "closed_won", "stage42", "disco"],
)
def test_post_deal_various_invalid_stages_return_400(
    client, auth_headers, invalid_stage
):
    """A representative range of invalid stage values are all rejected (400)."""
    resp = client.post(
        "/api/deals/",
        json={"title": "Bad Deal", "stage": invalid_stage},
        headers=auth_headers,
    )
    assert resp.status_code == 400


@pytest.mark.parametrize("valid_stage", VALID_STAGES)
def test_post_deal_all_valid_stages_accepted(client, auth_headers, valid_stage):
    """Every one of the 7 valid stages must be accepted on POST (HTTP 201)."""
    resp = client.post(
        "/api/deals/",
        json={"title": f"Deal {valid_stage}", "stage": valid_stage},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["deal"]["stage"] == valid_stage
    assert body["deal"]["stage"] in VALID_STAGES


def test_put_deal_invalid_stage_returns_400(client, auth_headers):
    """PUT /api/deals/<id> with an invalid stage must return HTTP 400."""
    # Create a valid deal to update.
    create = client.post(
        "/api/deals/",
        json={"title": "Valid Deal", "stage": "new"},
        headers=auth_headers,
    )
    assert create.status_code == 201
    deal_id = create.get_json()["deal"]["id"]

    # Attempting to move it to an invalid stage must be rejected.
    resp = client.put(
        f"/api/deals/{deal_id}",
        json={"stage": "invalid_stage"},
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert "stage" in resp.get_json()["error"].lower()


def test_put_deal_valid_stage_updates(client, auth_headers):
    """PUT /api/deals/<id> with a valid stage updates the deal (HTTP 200)."""
    create = client.post(
        "/api/deals/",
        json={"title": "Deal To Move", "stage": "new"},
        headers=auth_headers,
    )
    deal_id = create.get_json()["deal"]["id"]

    resp = client.put(
        f"/api/deals/{deal_id}",
        json={"stage": "won"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.get_json()["deal"]["stage"] == "won"


def test_put_deal_unchanged_when_stage_invalid(client, auth_headers):
    """A rejected PUT must leave the deal's stored stage untouched."""
    create = client.post(
        "/api/deals/",
        json={"title": "Stable Deal", "stage": "qualified"},
        headers=auth_headers,
    )
    deal_id = create.get_json()["deal"]["id"]

    client.put(
        f"/api/deals/{deal_id}",
        json={"stage": "not_a_stage"},
        headers=auth_headers,
    )

    resp = client.get(f"/api/deals/{deal_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()["deal"]["stage"] == "qualified"


# --------------------------------------------------------------------------- #
# Property-based test                                                          #
# --------------------------------------------------------------------------- #
# **Validates: Requirements 1.1, 1.4**
# Property 1: Stage Enum Closure -- every deal that reaches the database has a
# stage drawn from the closed set of 7 valid values.


@given(stage=st.text(min_size=0, max_size=30))
@settings(
    max_examples=100,
    # The test client / auth token are function-scoped pytest fixtures. They do
    # not need resetting between generated inputs: each POST's outcome depends
    # only on the submitted ``stage`` value, never on deals created by earlier
    # examples, so the default function-scoped-fixture health check is safe to
    # suppress here.
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
def test_property_stage_enum_closure(client, auth_headers, stage):
    """For any stage string submitted via POST, either the request is rejected
    with HTTP 400 (the stage is not a valid member) or a deal is created whose
    stored stage equals the submitted value and is a member of VALID_STAGES.

    This guarantees the closure property: no deal is ever persisted with a
    stage outside the seven-value set.
    """
    resp = client.post(
        "/api/deals/",
        json={"title": "PBT Deal", "stage": stage},
        headers=auth_headers,
    )
    if resp.status_code == 201:
        stored_stage = resp.get_json()["deal"]["stage"]
        # A persisted deal's stage is always a valid, closed-set member ...
        assert stored_stage in VALID_STAGES
        # ... and equals exactly what was submitted.
        assert stored_stage == stage
    else:
        # A rejected request must be a 400 caused by an invalid stage.
        assert resp.status_code == 400
        assert stage not in VALID_STAGES

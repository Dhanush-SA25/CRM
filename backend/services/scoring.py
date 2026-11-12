"""Deterministic, rule-based lead scoring.

The score is always derived from stored lead fields so two leads with the same
data always score the same. It is recomputed server-side on create/update and
exposed through the rescore endpoint for existing records.
"""
from datetime import datetime

from models.lead import Lead

# Free mail providers — a corporate domain is a stronger buying signal.
FREE_EMAIL_DOMAINS = {
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "yahoo.co.in",
    "hotmail.com",
    "outlook.com",
    "live.com",
    "aol.com",
    "icloud.com",
    "me.com",
    "protonmail.com",
    "proton.me",
    "mail.com",
    "gmx.com",
    "zoho.com",
    "yandex.com",
}

SOURCE_POINTS = {
    "referral": 20,
    "linkedin": 15,
    "website": 10,
    "cold_call": 5,
    "other": 2,
}

STATUS_POINTS = {
    "qualified": 25,
    "contacted": 15,
    "new": 5,
    "lost": 0,
}


def _recency_points(created_at, now):
    # A lead that has not been flushed yet (created_at is None) is brand new.
    if not created_at:
        return 15
    age_days = max(0, (now - created_at).days)
    if age_days <= 7:
        return 15
    if age_days <= 30:
        return 8
    if age_days <= 90:
        return 3
    return 0


def _email_domain(email):
    if not email or "@" not in email:
        return ""
    return email.rsplit("@", 1)[1].strip().lower()


def score_lead(lead, now=None):
    """Return ``{"score": int, "breakdown": [...]}`` for a Lead instance."""
    now = now or datetime.utcnow()
    breakdown = []

    def add(rule, points, detail):
        if points:
            breakdown.append({"rule": rule, "points": points, "detail": detail})

    source = (lead.source or "").strip().lower()
    add("Lead source", SOURCE_POINTS.get(source, 0), source or "not provided")

    status = (lead.status or "").strip().lower()
    add("Pipeline status", STATUS_POINTS.get(status, 0), status or "new")

    if (lead.phone or "").strip():
        add("Phone on file", 5, "reachable by phone")

    if (lead.company or "").strip():
        add("Company identified", 10, lead.company.strip())

    domain = _email_domain(lead.email)
    if domain and domain not in FREE_EMAIL_DOMAINS:
        add("Business email domain", 15, domain)

    notes = (lead.notes or "").strip()
    if len(notes) >= 40:
        add("Detailed notes", 10, f"{len(notes)} characters")

    recency = _recency_points(lead.created_at, now)
    add("Recent enquiry", recency, "created within 90 days")

    total = sum(item["points"] for item in breakdown)
    return {"score": max(0, min(100, total)), "breakdown": breakdown}


def apply_score(lead, now=None):
    """Recompute and persist ``lead.score``; returns the scoring result."""
    result = score_lead(lead, now=now)
    lead.score = result["score"]
    return result


def rescore_all():
    """Recompute scores for every stored lead. Returns the number updated."""
    leads = Lead.query.all()
    for lead in leads:
        apply_score(lead)
    return len(leads)

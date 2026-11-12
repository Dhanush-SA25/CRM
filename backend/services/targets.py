"""Calendar-quarter helpers shared by target management and analytics."""
import re
from datetime import datetime

PERIOD_RE = re.compile(r"^(\d{4})-Q([1-4])$")


def current_period(now=None):
    now = now or datetime.utcnow()
    quarter = (now.month - 1) // 3 + 1
    return f"{now.year}-Q{quarter}"


def parse_period(period):
    """Return (start, end) for a ``YYYY-Qn`` label, or raise ValueError."""
    match = PERIOD_RE.match(period or "")
    if not match:
        raise ValueError("period must look like 2026-Q4")
    year, quarter = int(match.group(1)), int(match.group(2))
    start_month = 3 * (quarter - 1) + 1
    start = datetime(year, start_month, 1)
    if start_month == 10:
        end = datetime(year + 1, 1, 1)
    else:
        end = datetime(year, start_month + 3, 1)
    return start, end


def period_bounds(period=None, now=None):
    label = period or current_period(now)
    start, end = parse_period(label)
    return label, start, end


def won_value_between(deals, user_id=None, start=None, end=None):
    """Sum of won deal value, optionally for one owner and one period."""
    total = 0.0
    for deal in deals:
        if deal.stage != "won":
            continue
        if user_id is not None and deal.assigned_to != user_id:
            continue
        when = deal.close_date or deal.updated_at
        if when is None:
            continue
        if start is not None and when < start:
            continue
        if end is not None and when >= end:
            continue
        total += deal.value or 0
    return round(total, 2)

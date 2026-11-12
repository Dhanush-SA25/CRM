"""Duplicate customer detection.

Customers are clustered when they share a normalised email, phone number, or
name. Clustering is transitive: if A matches B on phone and B matches C on
email, all three are returned as one group.
"""
import re

LEGAL_SUFFIXES = {"inc", "llc", "ltd", "corp", "co", "company", "limited", "plc", "gmbh"}


def _digits(value):
    return re.sub(r"\D", "", value or "")


def _normalize_name(value):
    tokens = re.findall(r"[a-z0-9]+", (value or "").lower())
    tokens = [t for t in tokens if t not in LEGAL_SUFFIXES]
    return "".join(tokens)


def _keys(customer):
    email = (customer.email or "").strip().lower()
    if email:
        yield "Same email", email
    phone = _digits(customer.phone)
    if len(phone) >= 7:
        yield "Same phone", phone
    name = _normalize_name(customer.name)
    if len(name) >= 3:
        yield "Same name", name


def find_duplicate_groups(customers, max_groups=50):
    """Return duplicate clusters for a list of Customer instances."""
    parent = list(range(len(customers)))

    def find(index):
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(a, b):
        root_a, root_b = find(a), find(b)
        if root_a != root_b:
            parent[root_b] = root_a

    buckets = {}
    for index, customer in enumerate(customers):
        for reason, value in _keys(customer):
            buckets.setdefault((reason, value), []).append(index)

    for indexes in buckets.values():
        for index in indexes[1:]:
            union(indexes[0], index)

    clusters = {}
    for index in range(len(customers)):
        clusters.setdefault(find(index), []).append(index)

    groups = []
    for root, indexes in clusters.items():
        if len(indexes) < 2:
            continue
        details = []
        for (reason, value), bucket_indexes in buckets.items():
            inside = [i for i in bucket_indexes if find(i) == root]
            if len(inside) >= 2:
                details.append({"reason": reason, "value": value, "count": len(inside)})

        members = sorted(
            (customers[i] for i in indexes),
            key=lambda c: (c.created_at is None, c.created_at),
        )
        groups.append({
            "suggested_primary_id": members[0].id,
            "match_details": details,
            "customers": [customer.to_dict() for customer in members],
        })

    groups.sort(key=lambda group: len(group["customers"]), reverse=True)
    return groups[:max_groups]

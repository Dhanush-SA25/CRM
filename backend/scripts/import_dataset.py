#!/usr/bin/env python
"""Import the SmartCRM synthetic dataset into the existing database.

The importer is additive and idempotent:

* every CSV source ID is recorded in ``import_mappings`` so a re-run updates
  the same local rows instead of creating duplicates;
* employees upsert on ``employee_id``, departments on their source ID or name,
  and customers on email;
* existing users, passwords and records are never deleted;
* no login accounts are created for imported employees;
* ``smartcrm_demo.sqlite`` is never used.

Usage (from ``backend/``)::

    .venv\\Scripts\\python.exe scripts\\import_dataset.py --dry-run
    .venv\\Scripts\\python.exe scripts\\import_dataset.py
"""
import argparse
import csv
import json
import shutil
import sys
import uuid
from collections import Counter
from datetime import date, datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import app  # noqa: E402  (creates the app and applies additive schema)
from database.db import db  # noqa: E402
from models.activity import Activity  # noqa: E402
from models.customer import Customer  # noqa: E402
from models.deal import STAGE_PROBABILITIES, VALID_STAGES, Deal  # noqa: E402
from models.department import Department  # noqa: E402
from models.employee import Employee  # noqa: E402
from models.followup import FollowUp  # noqa: E402
from models.import_mapping import ImportMapping  # noqa: E402
from models.lead import Lead  # noqa: E402
from models.task import Task  # noqa: E402
from models.user import User  # noqa: E402
from sqlalchemy import text  # noqa: E402

DEFAULT_DATA_DIR = BACKEND_DIR / "data" / "import" / "SmartCRM_dataset"
REPORT_DIR = BACKEND_DIR / "data" / "import"
BACKUP_DIR = BACKEND_DIR / "backups"

MODULES = [
    "departments",
    "employees",
    "customers",
    "leads",
    "deals",
    "tasks",
    "followups",
    "activities",
]

REQUIRED_HEADERS = {
    "departments": ["department_id", "department_name", "description"],
    "employees": ["employee_id", "full_name", "email", "department_id", "role"],
    "customers": ["customer_id", "name", "email", "assigned_to", "status", "created_at"],
    "leads": ["lead_id", "name", "email", "source", "assigned_to", "status", "score"],
    "deals": ["deal_id", "lead_id", "customer_id", "title", "amount", "stage"],
    "tasks": ["task_id", "title", "assigned_to", "due_date", "status", "priority"],
    "followups": ["followup_id", "lead_id", "customer_id", "assigned_to", "scheduled_date", "status"],
    "activities": ["activity_id", "user_id", "activity_type", "created_at"],
}

CUSTOMER_STATUS = {
    "active": "active",
    "inactive": "inactive",
    "prospective": "prospect",
    "prospect": "prospect",
}

# The application supports new/contacted/qualified/lost for leads. Advanced
# positive stages stay in the "qualified" bucket; the original value is
# preserved in the imported activity/lead context where available.
LEAD_STATUS = {
    "new": "new",
    "contacted": "contacted",
    "qualified": "qualified",
    "proposal": "qualified",
    "negotiation": "qualified",
    "won": "qualified",
    "lost": "lost",
}

LEAD_SOURCE = {
    "linkedin": "linkedin",
    "website": "website",
    "referral": "referral",
    "partner": "referral",
    "cold call": "cold_call",
    "cold_call": "cold_call",
    "email campaign": "other",
    "social media": "other",
    "trade show": "other",
    "other": "other",
}

TASK_STATUS = {
    "completed": "done",
    "pending": "todo",
    "in progress": "in_progress",
}

FOLLOWUP_STATUS = {
    "completed": "completed",
    "pending": "pending",
    # The app has no "cancelled" status; a cancelled follow-up is closed work.
    "cancelled": "completed",
}

ACTIVITY_TYPE = {
    "call": "call",
    "email": "email",
    "meeting": "meeting",
    "note": "note",
    "task completed": "task",
    "follow-up completed": "task",
    "lead updated": "note",
    "deal stage changed": "note",
}

COMPLETED_ACTIVITY_TYPES = {"task completed", "follow-up completed"}


class ImportError_(RuntimeError):
    """Raised for an unrecoverable import problem."""


def read_rows(data_dir: Path, module: str):
    path = data_dir / f"{module}.csv"
    if not path.exists():
        raise ImportError_(f"Missing CSV file: {path}")
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        headers = reader.fieldnames or []
        missing = [name for name in REQUIRED_HEADERS[module] if name not in headers]
        if missing:
            raise ImportError_(
                f"{module}.csv is missing required columns: {', '.join(missing)}"
            )
        return list(reader)


def value(row, key):
    return (row.get(key) or "").strip()


def parse_datetime(raw, *, module, source_id, field, errors, required=False):
    raw = (raw or "").strip()
    if not raw:
        if required:
            errors.append(
                {"module": module, "source_id": source_id, "error": f"missing {field}"}
            )
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        errors.append(
            {
                "module": module,
                "source_id": source_id,
                "error": f"invalid {field}: {raw!r}",
            }
        )
        return None


def parse_date(raw, *, module, source_id, field, errors):
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        errors.append(
            {
                "module": module,
                "source_id": source_id,
                "error": f"invalid {field}: {raw!r}",
            }
        )
        return None


def parse_float(raw, *, module, source_id, field, errors, default=0.0):
    raw = (raw or "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        errors.append(
            {
                "module": module,
                "source_id": source_id,
                "error": f"invalid {field}: {raw!r}",
            }
        )
        return default


def parse_int(raw, *, module, source_id, field, errors, default=0):
    raw = (raw or "").strip()
    if not raw:
        return default
    try:
        return int(float(raw))
    except ValueError:
        errors.append(
            {
                "module": module,
                "source_id": source_id,
                "error": f"invalid {field}: {raw!r}",
            }
        )
        return default


def lookup(mapping, raw, *, module, source_id, field, errors):
    """Resolve an optional source foreign key to a local primary key."""
    if not raw:
        return None
    local_id = mapping.get(raw)
    if local_id is None:
        errors.append(
            {
                "module": module,
                "source_id": source_id,
                "error": f"unknown {field}: {raw}",
            }
        )
    return local_id


def normalise(raw, table, *, module, source_id, errors, default):
    key = (raw or "").strip().lower()
    if not key:
        return default
    mapped = table.get(key)
    if mapped is None:
        errors.append(
            {
                "module": module,
                "source_id": source_id,
                "error": f"unmapped {module} value: {raw!r}",
            }
        )
        return default
    return mapped


class ImportRun:
    def __init__(self, dry_run: bool):
        self.dry_run = dry_run
        self.batch = f"DS-{datetime.now():%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:6].upper()}"
        self.stats = {
            module: {"rows": 0, "created": 0, "updated": 0, "skipped": 0}
            for module in MODULES
        }
        self.errors = []
        self.normalisations = Counter()
        self.mapping_rows = {
            (row.entity_type, row.source_id): row for row in ImportMapping.query.all()
        }
        self.department_map = {}
        self.employee_map = {}
        self.customer_map = {}
        self.lead_map = {}

    def bump(self, module, key):
        self.stats[module][key] += 1

    def record_mapping(self, entity, source_id, local_id):
        key = (entity, source_id)
        row = self.mapping_rows.get(key)
        if row is None:
            row = ImportMapping(
                entity_type=entity, source_id=source_id, local_id=local_id
            )
            db.session.add(row)
            self.mapping_rows[key] = row
        else:
            row.local_id = local_id
        return row


def import_departments(rows, run):
    for row in rows:
        source_id = value(row, "department_id")
        name = value(row, "department_name")
        if not source_id or not name:
            run.bump("departments", "skipped")
            run.errors.append(
                {
                    "module": "departments",
                    "source_id": source_id or "?",
                    "error": "department_id and department_name are required",
                }
            )
            continue
        department = Department.query.filter_by(source_id=source_id).first()
        if department is None:
            department = Department.query.filter_by(name=name).first()
        if department is None:
            department = Department(source_id=source_id, name=name)
            db.session.add(department)
            run.bump("departments", "created")
        else:
            department.source_id = source_id
            department.name = name
            run.bump("departments", "updated")
        department.description = value(row, "description") or None
        run.bump("departments", "rows")
    db.session.flush()
    for department in Department.query.all():
        run.department_map[department.source_id] = department.id
        run.record_mapping("department", department.source_id, department.id)


def import_employees(rows, run):
    existing = {employee.employee_id: employee for employee in Employee.query.all()}
    email_owner = {employee.email.lower(): employee for employee in existing.values()}
    for row in rows:
        source_id = value(row, "employee_id")
        name = value(row, "full_name")
        email = value(row, "email").lower()
        if not source_id or not name or not email:
            run.bump("employees", "skipped")
            run.errors.append(
                {
                    "module": "employees",
                    "source_id": source_id or "?",
                    "error": "employee_id, full_name and email are required",
                }
            )
            continue

        email_match = email_owner.get(email)
        if email_match is not None and email_match.employee_id != source_id:
            run.bump("employees", "skipped")
            run.errors.append(
                {
                    "module": "employees",
                    "source_id": source_id,
                    "error": f"email {email} already belongs to {email_match.employee_id}",
                }
            )
            continue

        department_id = lookup(
            run.department_map,
            value(row, "department_id"),
            module="employees",
            source_id=source_id,
            field="department_id",
            errors=run.errors,
        )
        joining_date = parse_date(
            value(row, "joining_date"),
            module="employees",
            source_id=source_id,
            field="joining_date",
            errors=run.errors,
        )
        status_label = (value(row, "employment_status") or "active").lower()
        status = "inactive" if status_label == "inactive" else "active"

        employee = existing.get(source_id)
        if employee is None:
            employee = Employee(employee_id=source_id)
            db.session.add(employee)
            existing[source_id] = employee
            run.bump("employees", "created")
        else:
            run.bump("employees", "updated")

        employee.name = name
        employee.email = email
        employee.phone = value(row, "phone") or None
        employee.department = value(row, "department") or None
        employee.department_id = department_id
        employee.designation = value(row, "designation") or None
        employee.role_label = value(row, "role") or None
        employee.joining_date = joining_date
        employee.location = value(row, "location") or None
        employee.manager_employee_id = value(row, "manager_id") or None
        employee.status = status
        employee.import_batch = run.batch
        email_owner[email] = employee
        run.bump("employees", "rows")

    db.session.flush()
    for employee in Employee.query.all():
        run.employee_map[employee.employee_id] = employee.id
        run.record_mapping("employee", employee.employee_id, employee.id)


def import_customers(rows, run):
    by_email = {customer.email.lower(): customer for customer in Customer.query.all()}
    processed = []
    for row in rows:
        source_id = value(row, "customer_id")
        name = value(row, "name")
        email = value(row, "email").lower()
        if not source_id or not name or not email:
            run.bump("customers", "skipped")
            run.errors.append(
                {
                    "module": "customers",
                    "source_id": source_id or "?",
                    "error": "customer_id, name and email are required",
                }
            )
            continue

        mapped = run.mapping_rows.get(("customer", source_id))
        customer = None
        if mapped is not None:
            customer = db.session.get(Customer, mapped.local_id)
        if customer is None:
            customer = by_email.get(email)
        if customer is None:
            customer = Customer(name=name, email=email)
            db.session.add(customer)
            by_email[email] = customer
            run.bump("customers", "created")
        else:
            run.bump("customers", "updated")

        customer.name = name
        customer.email = email
        customer.phone = value(row, "phone") or None
        customer.company = value(row, "company") or None
        customer.address = value(row, "address") or None
        customer.status = normalise(
            value(row, "status"),
            CUSTOMER_STATUS,
            module="customers",
            source_id=source_id,
            errors=run.errors,
            default="prospect",
        )
        industry = value(row, "industry")
        customer.notes = f"Industry: {industry}" if industry else customer.notes
        customer.assigned_employee_id = lookup(
            run.employee_map,
            value(row, "assigned_to"),
            module="customers",
            source_id=source_id,
            field="assigned_to employee",
            errors=run.errors,
        )
        created_at = parse_datetime(
            value(row, "created_at"),
            module="customers",
            source_id=source_id,
            field="created_at",
            errors=run.errors,
        )
        if customer.id is None and created_at:
            customer.created_at = created_at
            customer.updated_at = created_at
        processed.append((source_id, customer))
        run.bump("customers", "rows")

    db.session.flush()
    for source_id, customer in processed:
        run.customer_map[source_id] = customer.id
        run.record_mapping("customer", source_id, customer.id)


def import_leads(rows, run):
    by_email = {lead.email.lower(): lead for lead in Lead.query.all()}
    processed = []
    for row in rows:
        source_id = value(row, "lead_id")
        name = value(row, "name")
        email = value(row, "email").lower()
        if not source_id or not name or not email:
            run.bump("leads", "skipped")
            run.errors.append(
                {
                    "module": "leads",
                    "source_id": source_id or "?",
                    "error": "lead_id, name and email are required",
                }
            )
            continue

        mapped = run.mapping_rows.get(("lead", source_id))
        lead = None
        if mapped is not None:
            lead = db.session.get(Lead, mapped.local_id)
        if lead is None:
            lead = by_email.get(email)
        if lead is None:
            lead = Lead(name=name, email=email)
            db.session.add(lead)
            by_email[email] = lead
            run.bump("leads", "created")
        else:
            run.bump("leads", "updated")

        lead.name = name
        lead.email = email
        lead.phone = value(row, "phone") or None
        lead.company = value(row, "company") or None
        lead.status = normalise(
            value(row, "status"),
            LEAD_STATUS,
            module="leads",
            source_id=source_id,
            errors=run.errors,
            default="new",
        )
        source = value(row, "source")
        lead.source = normalise(
            source,
            LEAD_SOURCE,
            module="leads",
            source_id=source_id,
            errors=run.errors,
            default="other",
        )
        if source:
            run.normalisations[f"lead source: {source}"] += 1
        details = [
            f"Industry: {value(row, 'industry')}" if value(row, "industry") else "",
            f"Budget: {value(row, 'budget')}" if value(row, "budget") else "",
            f"Interest: {value(row, 'interest_level')}" if value(row, "interest_level") else "",
            f"Timeline: {value(row, 'purchase_timeline')}" if value(row, "purchase_timeline") else "",
        ]
        lead.notes = " · ".join(item for item in details if item) or lead.notes
        lead.score = parse_int(
            value(row, "score"),
            module="leads",
            source_id=source_id,
            field="score",
            errors=run.errors,
        )
        lead.assigned_employee_id = lookup(
            run.employee_map,
            value(row, "assigned_to"),
            module="leads",
            source_id=source_id,
            field="assigned_to employee",
            errors=run.errors,
        )
        lead.customer_id = lookup(
            run.customer_map,
            value(row, "customer_id"),
            module="leads",
            source_id=source_id,
            field="customer_id",
            errors=run.errors,
        )
        created_at = parse_datetime(
            value(row, "created_at"),
            module="leads",
            source_id=source_id,
            field="created_at",
            errors=run.errors,
        )
        if lead.id is None and created_at:
            lead.created_at = created_at
            lead.updated_at = created_at
        processed.append((source_id, lead))
        run.bump("leads", "rows")

    db.session.flush()
    for source_id, lead in processed:
        run.lead_map[source_id] = lead.id
        run.record_mapping("lead", source_id, lead.id)


def import_deals(rows, run):
    processed = []
    for row in rows:
        source_id = value(row, "deal_id")
        title = value(row, "title")
        if not source_id or not title:
            run.bump("deals", "skipped")
            run.errors.append(
                {
                    "module": "deals",
                    "source_id": source_id or "?",
                    "error": "deal_id and title are required",
                }
            )
            continue

        stage = value(row, "stage").lower()
        if stage not in VALID_STAGES:
            run.bump("deals", "skipped")
            run.errors.append(
                {
                    "module": "deals",
                    "source_id": source_id,
                    "error": f"unsupported stage: {value(row, 'stage')!r}",
                }
            )
            continue

        mapped = run.mapping_rows.get(("deal", source_id))
        deal = db.session.get(Deal, mapped.local_id) if mapped is not None else None
        if deal is None:
            deal = Deal(title=title)
            db.session.add(deal)
            run.bump("deals", "created")
        else:
            run.bump("deals", "updated")

        lead_id = lookup(
            run.lead_map,
            value(row, "lead_id"),
            module="deals",
            source_id=source_id,
            field="lead_id",
            errors=run.errors,
        )
        customer_id = lookup(
            run.customer_map,
            value(row, "customer_id"),
            module="deals",
            source_id=source_id,
            field="customer_id",
            errors=run.errors,
        )
        closed_at = parse_datetime(
            value(row, "closed_at"),
            module="deals",
            source_id=source_id,
            field="closed_at",
            errors=run.errors,
        )
        expected_close = parse_datetime(
            value(row, "expected_close_date"),
            module="deals",
            source_id=source_id,
            field="expected_close_date",
            errors=run.errors,
        )
        deal.title = title
        deal.value = parse_float(
            value(row, "amount"),
            module="deals",
            source_id=source_id,
            field="amount",
            errors=run.errors,
        )
        deal.stage = stage
        deal.probability = STAGE_PROBABILITIES[stage]
        deal.close_date = closed_at or expected_close
        deal.lost_reason = (
            value(row, "loss_reason") or None if stage == "lost" else None
        )
        deal.customer_id = customer_id
        deal.lead_id = lead_id
        deal.assigned_employee_id = lookup(
            run.employee_map,
            value(row, "assigned_to"),
            module="deals",
            source_id=source_id,
            field="assigned_to employee",
            errors=run.errors,
        )
        created_at = parse_datetime(
            value(row, "created_at"),
            module="deals",
            source_id=source_id,
            field="created_at",
            errors=run.errors,
        )
        if deal.id is None and created_at:
            deal.created_at = created_at
            deal.updated_at = created_at
        processed.append((source_id, deal))
        run.bump("deals", "rows")

    db.session.flush()
    for source_id, deal in processed:
        run.record_mapping("deal", source_id, deal.id)


def import_tasks(rows, run, admin_user_id):
    processed = []
    for row in rows:
        source_id = value(row, "task_id")
        title = value(row, "title")
        if not source_id or not title:
            run.bump("tasks", "skipped")
            run.errors.append(
                {
                    "module": "tasks",
                    "source_id": source_id or "?",
                    "error": "task_id and title are required",
                }
            )
            continue
        due_date = parse_datetime(
            value(row, "due_date"),
            module="tasks",
            source_id=source_id,
            field="due_date",
            errors=run.errors,
            required=True,
        )
        if due_date is None:
            run.bump("tasks", "skipped")
            continue

        mapped = run.mapping_rows.get(("task", source_id))
        task = db.session.get(Task, mapped.local_id) if mapped is not None else None
        if task is None:
            task = Task(title=title)
            db.session.add(task)
            run.bump("tasks", "created")
        else:
            run.bump("tasks", "updated")

        task.title = title
        task.description = value(row, "description") or None
        task.due_date = due_date
        task.status = normalise(
            value(row, "status"),
            TASK_STATUS,
            module="tasks",
            source_id=source_id,
            errors=run.errors,
            default="todo",
        )
        task.priority = normalise(
            value(row, "priority"),
            {"low": "low", "medium": "medium", "high": "high"},
            module="tasks",
            source_id=source_id,
            errors=run.errors,
            default="medium",
        )
        task.assigned_employee_id = lookup(
            run.employee_map,
            value(row, "assigned_to"),
            module="tasks",
            source_id=source_id,
            field="assigned_to employee",
            errors=run.errors,
        )
        task.created_by_employee_id = lookup(
            run.employee_map,
            value(row, "created_by"),
            module="tasks",
            source_id=source_id,
            field="created_by employee",
            errors=run.errors,
        )
        task.customer_id = lookup(
            run.customer_map,
            value(row, "customer_id"),
            module="tasks",
            source_id=source_id,
            field="customer_id",
            errors=run.errors,
        )
        task.lead_id = lookup(
            run.lead_map,
            value(row, "lead_id"),
            module="tasks",
            source_id=source_id,
            field="lead_id",
            errors=run.errors,
        )
        task.created_by = admin_user_id
        created_at = parse_datetime(
            value(row, "created_at"),
            module="tasks",
            source_id=source_id,
            field="created_at",
            errors=run.errors,
        )
        if task.id is None:
            task.created_at = created_at or datetime.utcnow()
            task.updated_at = task.created_at
        processed.append((source_id, task))
        run.bump("tasks", "rows")

    db.session.flush()
    for source_id, task in processed:
        run.record_mapping("task", source_id, task.id)


def import_followups(rows, run, admin_user_id):
    processed = []
    for row in rows:
        source_id = value(row, "followup_id")
        if not source_id:
            run.bump("followups", "skipped")
            run.errors.append(
                {"module": "followups", "source_id": "?", "error": "followup_id is required"}
            )
            continue
        due_date = parse_datetime(
            value(row, "scheduled_date"),
            module="followups",
            source_id=source_id,
            field="scheduled_date",
            errors=run.errors,
            required=True,
        )
        if due_date is None:
            run.bump("followups", "skipped")
            continue

        linked_type = "lead" if value(row, "lead_id") else "customer"
        mapped_id = (
            lookup(
                run.lead_map,
                value(row, "lead_id"),
                module="followups",
                source_id=source_id,
                field="lead_id",
                errors=run.errors,
            )
            if linked_type == "lead"
            else lookup(
                run.customer_map,
                value(row, "customer_id"),
                module="followups",
                source_id=source_id,
                field="customer_id",
                errors=run.errors,
            )
        )
        if mapped_id is None:
            run.bump("followups", "skipped")
            run.errors.append(
                {
                    "module": "followups",
                    "source_id": source_id,
                    "error": "follow-up has no resolvable customer or lead link",
                }
            )
            continue

        mapped = run.mapping_rows.get(("followup", source_id))
        followup = (
            db.session.get(FollowUp, mapped.local_id) if mapped is not None else None
        )
        followup_type = value(row, "followup_type") or "Follow-up"
        if followup is None:
            followup = FollowUp(title=f"{followup_type} follow-up", linked_type=linked_type)
            db.session.add(followup)
            run.bump("followups", "created")
        else:
            run.bump("followups", "updated")

        followup.title = f"{followup_type} follow-up"
        followup.description = value(row, "notes") or None
        followup.due_date = due_date
        followup.status = normalise(
            value(row, "status"),
            FOLLOWUP_STATUS,
            module="followups",
            source_id=source_id,
            errors=run.errors,
            default="pending",
        )
        followup.priority = "medium"
        followup.linked_type = linked_type
        followup.linked_id = mapped_id
        followup.assigned_employee_id = lookup(
            run.employee_map,
            value(row, "assigned_to"),
            module="followups",
            source_id=source_id,
            field="assigned_to employee",
            errors=run.errors,
        )
        followup.created_by = admin_user_id
        created_at = parse_datetime(
            value(row, "created_at"),
            module="followups",
            source_id=source_id,
            field="created_at",
            errors=run.errors,
        )
        if followup.id is None:
            followup.created_at = created_at or datetime.utcnow()
            followup.updated_at = followup.created_at
        processed.append((source_id, followup))
        run.bump("followups", "rows")

    db.session.flush()
    for source_id, followup in processed:
        run.record_mapping("followup", source_id, followup.id)


def import_activities(rows, run, admin_user_id):
    processed = []
    for row in rows:
        source_id = value(row, "activity_id")
        raw_type = value(row, "activity_type")
        if not source_id or not raw_type:
            run.bump("activities", "skipped")
            run.errors.append(
                {
                    "module": "activities",
                    "source_id": source_id or "?",
                    "error": "activity_id and activity_type are required",
                }
            )
            continue
        created_at = parse_datetime(
            value(row, "created_at"),
            module="activities",
            source_id=source_id,
            field="created_at",
            errors=run.errors,
            required=True,
        )
        if created_at is None:
            run.bump("activities", "skipped")
            continue

        mapped = run.mapping_rows.get(("activity", source_id))
        activity = (
            db.session.get(Activity, mapped.local_id) if mapped is not None else None
        )
        if activity is None:
            activity = Activity(title=raw_type)
            db.session.add(activity)
            run.bump("activities", "created")
        else:
            run.bump("activities", "updated")

        customer_id = lookup(
            run.customer_map,
            value(row, "customer_id"),
            module="activities",
            source_id=source_id,
            field="customer_id",
            errors=run.errors,
        )
        lead_id = lookup(
            run.lead_map,
            value(row, "lead_id"),
            module="activities",
            source_id=source_id,
            field="lead_id",
            errors=run.errors,
        )
        activity.type = normalise(
            raw_type,
            ACTIVITY_TYPE,
            module="activities",
            source_id=source_id,
            errors=run.errors,
            default="note",
        )
        activity.title = raw_type
        activity.description = value(row, "description") or None
        activity.customer_id = customer_id
        activity.lead_id = lead_id
        activity.linked_type = "lead" if lead_id else "customer" if customer_id else None
        activity.linked_id = lead_id or customer_id
        activity.employee_id = lookup(
            run.employee_map,
            value(row, "user_id"),
            module="activities",
            source_id=source_id,
            field="user_id employee",
            errors=run.errors,
        )
        activity.completed = raw_type.lower() in COMPLETED_ACTIVITY_TYPES
        activity.created_by = admin_user_id
        activity.created_at = created_at
        activity.updated_at = created_at
        processed.append((source_id, activity))
        run.bump("activities", "rows")

    db.session.flush()
    for source_id, activity in processed:
        run.record_mapping("activity", source_id, activity.id)


def table_counts():
    return {
        "users": User.query.count(),
        "departments": Department.query.count(),
        "employees": Employee.query.count(),
        "customers": Customer.query.count(),
        "leads": Lead.query.count(),
        "deals": Deal.query.count(),
        "tasks": Task.query.count(),
        "followups": FollowUp.query.count(),
        "activities": Activity.query.count(),
        "import_mappings": ImportMapping.query.count(),
    }


def database_file(app_instance):
    raw = db.engine.url.database
    path = Path(raw)
    if not path.is_absolute():
        path = Path(app_instance.instance_path) / path
    return path


def backup_database(app_instance):
    source = database_file(app_instance)
    if not source.exists():
        raise ImportError_(f"Database file not found: {source}")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    target = BACKUP_DIR / f"{source.stem}_{datetime.now():%Y%m%d_%H%M%S}.db"
    shutil.copy2(source, target)
    return target


def run_import(data_dir, dry_run, make_backup):
    rows = {module: read_rows(data_dir, module) for module in MODULES}
    admin = User.query.filter_by(role="admin").order_by(User.id.asc()).first()
    if admin is None:
        raise ImportError_("No admin user exists; refusing to create accounts automatically.")

    run = ImportRun(dry_run=dry_run)
    backup_path = backup_database(app) if (make_backup and not dry_run) else None

    try:
        import_departments(rows["departments"], run)
        import_employees(rows["employees"], run)
        import_customers(rows["customers"], run)
        import_leads(rows["leads"], run)
        import_deals(rows["deals"], run)
        import_tasks(rows["tasks"], run, admin.id)
        import_followups(rows["followups"], run, admin.id)
        import_activities(rows["activities"], run, admin.id)

        db.session.flush()
        fk_violations = db.session.execute(text("PRAGMA foreign_key_check")).fetchall()
        if fk_violations:
            raise ImportError_(
                f"Foreign-key check failed with {len(fk_violations)} violation(s); rolling back."
            )
        counts = table_counts()
        if dry_run:
            db.session.rollback()
        else:
            db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    report = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "dry_run": dry_run,
        "batch": run.batch,
        "data_dir": str(data_dir),
        "database": str(database_file(app)),
        "backup": str(backup_path) if backup_path else None,
        "admin_user": {"id": admin.id, "email": admin.email},
        "modules": run.stats,
        "errors": run.errors,
        "normalisations": dict(sorted(run.normalisations.items())),
        "table_counts": counts,
        "foreign_key_violations": len(fk_violations),
    }

    if not dry_run:
        REPORT_DIR.mkdir(parents=True, exist_ok=True)
        report_path = REPORT_DIR / f"import_report_{run.batch}.json"
        report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        report["report_path"] = str(report_path)

    return report


def print_report(report):
    print(f"Batch: {report['batch']}  |  dry run: {report['dry_run']}")
    print(f"Database: {report['database']}")
    if report["backup"]:
        print(f"Backup:   {report['backup']}")
    print()
    for module in MODULES:
        stats = report["modules"][module]
        print(
            f"{module:12} rows={stats['rows']:5} created={stats['created']:5} "
            f"updated={stats['updated']:5} skipped={stats['skipped']:5}"
        )
    print()
    print("Table counts:")
    for table, count in report["table_counts"].items():
        print(f"  {table:16} {count}")
    print(f"Foreign-key violations: {report['foreign_key_violations']}")
    if report["errors"]:
        print(f"\nIssues ({len(report['errors'])}):")
        for issue in report["errors"][:25]:
            print(
                f"  [{issue['module']}] {issue['source_id']}: {issue['error']}"
            )
        if len(report["errors"]) > 25:
            print(f"  … {len(report['errors']) - 25} more")
    if report.get("report_path"):
        print(f"\nReport written to {report['report_path']}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=DEFAULT_DATA_DIR,
        help="Folder containing the CSV files",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and simulate the import, then roll back",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip the automatic database backup (not recommended)",
    )
    args = parser.parse_args()

    with app.app_context():
        try:
            report = run_import(args.data_dir, args.dry_run, not args.no_backup)
        except ImportError_ as error:
            print(f"Import aborted: {error}", file=sys.stderr)
            return 1
        print_report(report)
        if report["errors"] and not args.dry_run:
            return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

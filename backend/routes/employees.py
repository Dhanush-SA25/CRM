"""Admin employee directory: bulk CSV import, listing, and error reports."""
import csv
import json
import re
import time
import uuid
from datetime import datetime
from io import StringIO

from flask import Blueprint, jsonify, request
from sqlalchemy import or_

from database.db import db
from models.employee import Employee
from models.employee_import_error import EmployeeImportError
from services.csv_export import csv_response
from services.rbac import role_required

employees_bp = Blueprint("employees", __name__, url_prefix="/api/admin/employees")

EMPLOYEE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")
MAX_ROWS = 50000
CHUNK_SIZE = 200
RESPONSE_ERROR_LIMIT = 200

HEADER_ALIASES = {
    "employee_id": {
        "employee_id", "employeeid", "emp_id", "empid", "id",
        "staff_id", "staffid", "employee_code", "employeecode",
    },
    "name": {"name", "full_name", "fullname", "employee_name", "employeename"},
    "email": {
        "email", "email_address", "emailaddress", "work_email",
        "workemail", "mail",
    },
    "phone": {
        "phone", "phone_number", "phonenumber", "mobile",
        "mobile_number", "mobilenumber", "contact",
    },
    "department": {"department", "dept", "division"},
    "designation": {"designation", "title", "job_title", "jobtitle", "role"},
    "manager_employee_id": {
        "manager_employee_id", "managerid", "manager_id", "manager",
        "reports_to", "reportsto",
    },
    "status": {"status", "employment_status", "employmentstatus"},
}

ALIAS_TO_FIELD = {
    alias: field for field, aliases in HEADER_ALIASES.items() for alias in aliases
}


def _normalize_header(header):
    return re.sub(r"[^a-z0-9]+", "_", (header or "").strip().lower()).strip("_")


def _validate(values):
    errors = []
    employee_id = values.get("employee_id", "")
    name = values.get("name", "")
    email = values.get("email", "")
    department = values.get("department", "")
    designation = values.get("designation", "")
    manager = values.get("manager_employee_id", "")
    status = (values.get("status") or "active").lower()

    if not employee_id:
        errors.append("employee_id is required")
    elif not EMPLOYEE_ID_RE.match(employee_id):
        errors.append("employee_id must be 1-40 letters, digits, '-' or '_'")

    if not name:
        errors.append("name is required")
    elif len(name) > 120:
        errors.append("name must be 120 characters or fewer")

    if not email:
        errors.append("email is required")
    elif not EMAIL_RE.match(email):
        errors.append("email is not a valid address")
    elif len(email) > 120:
        errors.append("email must be 120 characters or fewer")

    if values.get("phone") and len(values["phone"]) > 50:
        errors.append("phone must be 50 characters or fewer")
    if len(department) > 80:
        errors.append("department must be 80 characters or fewer")
    if len(designation) > 120:
        errors.append("designation must be 120 characters or fewer")
    if len(manager) > 40:
        errors.append("manager_employee_id must be 40 characters or fewer")
    if status not in ("active", "inactive"):
        errors.append("status must be 'active' or 'inactive'")
    if manager and employee_id and manager.lower() == employee_id.lower():
        errors.append("manager_employee_id cannot reference the same employee")

    return errors


def _map_headers(fieldnames):
    mapping = {}
    unknown = []
    for original in fieldnames or []:
        field = ALIAS_TO_FIELD.get(_normalize_header(original))
        if field and field not in mapping.values():
            mapping[original] = field
        elif not field:
            unknown.append(original)
    return mapping, unknown


@employees_bp.get("/")
@role_required("admin")
def list_employees():
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 25, type=int), 100)
    search = request.args.get("search", "").strip()
    department = request.args.get("department", "").strip()
    status = request.args.get("status", "").strip()

    # Deep links from global search carry the numeric record id; resolve it to
    # the employee's business id so the target row is guaranteed to be listed.
    focus = request.args.get("focus", type=int)
    if focus:
        focused = db.session.get(Employee, focus)
        if focused:
            search = focused.employee_id

    query = Employee.query
    if search:
        like = f"%{search}%"
        query = query.filter(or_(
            Employee.employee_id.ilike(like),
            Employee.name.ilike(like),
            Employee.email.ilike(like),
            Employee.department.ilike(like),
            Employee.designation.ilike(like),
        ))
    if department:
        query = query.filter_by(department=department)
    if status:
        query = query.filter_by(status=status)

    pagination = query.order_by(Employee.employee_id.asc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    departments = [
        row[0] for row in db.session.query(Employee.department)
        .filter(Employee.department.isnot(None), Employee.department != "")
        .distinct().order_by(Employee.department.asc()).all()
    ]

    return jsonify({
        "employees": [e.to_dict() for e in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": page,
        "departments": departments,
        "summary": {
            "total": Employee.query.count(),
            "active": Employee.query.filter_by(status="active").count(),
            "departments": len(departments),
            "with_manager": Employee.query.filter(
                Employee.manager_employee_id.isnot(None),
                Employee.manager_employee_id != "",
            ).count(),
        },
    }), 200


@employees_bp.get("/template.csv")
@role_required("admin")
def import_template():
    return csv_response(
        ["employee_id", "name", "email", "phone", "department",
         "designation", "manager_employee_id", "status"],
        [["EMP0001", "Jane Doe", "jane.doe@example.com", "+1 555 0100",
          "Sales", "Account Executive", "EMP0000", "active"]],
        "employee-import-template",
    )


@employees_bp.post("/import")
@role_required("admin")
def import_employees():
    """Validate and import a CSV of employees in two passes.

    No User accounts or passwords are created — this populates the directory
    table only, so importing the same file twice never creates duplicate
    accounts.
    """
    started = time.perf_counter()
    upload = request.files.get("file")
    if not upload or not upload.filename:
        return jsonify({"error": "Attach a CSV file in the 'file' field"}), 400
    if not upload.filename.lower().endswith(".csv"):
        return jsonify({"error": "Only .csv files are supported"}), 400

    raw_bytes = upload.read()
    text = None
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            text = raw_bytes.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        return jsonify({"error": "File must be UTF-8 or Windows-1252 encoded"}), 400

    reader = csv.DictReader(StringIO(text))
    if not reader.fieldnames:
        return jsonify({"error": "CSV file has no header row"}), 400

    mapping, _unknown = _map_headers(reader.fieldnames)
    missing = {"employee_id", "name", "email"} - set(mapping.values())
    if missing:
        return jsonify({
            "error": f"Missing required columns: {', '.join(sorted(missing))}",
            "found_columns": reader.fieldnames,
        }), 400

    records = []
    for row_number, raw in enumerate(reader, start=2):
        if len(records) >= MAX_ROWS:
            return jsonify({"error": f"File exceeds the {MAX_ROWS} row limit"}), 400
        values = {}
        for original, value in raw.items():
            if original is None:
                continue
            field = mapping.get(original)
            if field:
                values[field] = (value or "").strip()
        if not any(values.values()):
            continue
        records.append({
            "row": row_number,
            "values": values,
            "errors": _validate(values),
            "duplicate": False,
        })

    if not records:
        return jsonify({"error": "The CSV contains no employee rows"}), 400

    # --- Second pass: duplicates against the file and the database ---
    db_employee_ids = {
        (value or "").lower()
        for (value,) in db.session.query(Employee.employee_id).all()
    }
    db_emails = {
        (value or "").lower()
        for (value,) in db.session.query(Employee.email).all()
    }
    seen_ids, seen_emails = {}, {}
    candidates = []

    for record in records:
        if record["errors"]:
            continue
        values = record["values"]
        key_id = values.get("employee_id", "").lower()
        key_email = values.get("email", "").lower()

        if key_id in seen_ids:
            record["errors"].append(
                f"duplicate employee_id in file (first seen on row {seen_ids[key_id]})"
            )
            record["duplicate"] = True
        if key_email in seen_emails:
            record["errors"].append(
                f"duplicate email in file (first seen on row {seen_emails[key_email]})"
            )
            record["duplicate"] = True
        if key_id in db_employee_ids:
            record["errors"].append("employee_id already exists in the directory")
            record["duplicate"] = True
        if key_email in db_emails:
            record["errors"].append("email already exists in the directory")
            record["duplicate"] = True

        if record["errors"]:
            continue
        seen_ids[key_id] = record["row"]
        seen_emails[key_email] = record["row"]
        candidates.append(record)

    # --- Manager references must resolve to the database or this file ---
    known_ids = db_employee_ids | {
        record["values"]["employee_id"].lower() for record in candidates
    }
    accepted = []
    for record in candidates:
        manager = record["values"].get("manager_employee_id", "")
        if manager and manager.lower() not in known_ids:
            record["errors"].append(
                f"manager_employee_id '{manager}' was not found in the file or directory"
            )
            continue
        accepted.append(record)

    batch = f"IMP-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
    now = datetime.utcnow()

    if accepted:
        mappings = []
        for record in accepted:
            values = record["values"]
            mappings.append({
                "employee_id": values["employee_id"],
                "name": values["name"],
                "email": values["email"].lower(),
                "phone": values.get("phone") or None,
                "department": values.get("department") or None,
                "designation": values.get("designation") or None,
                "manager_employee_id": values.get("manager_employee_id") or None,
                "status": (values.get("status") or "active").lower(),
                "import_batch": batch,
                "created_at": now,
                "updated_at": now,
            })
        for start in range(0, len(mappings), CHUNK_SIZE):
            db.session.bulk_insert_mappings(Employee, mappings[start:start + CHUNK_SIZE])

    failures = [record for record in records if record["errors"]]
    if failures:
        error_mappings = []
        for record in failures:
            values = record["values"]
            error_mappings.append({
                "batch": batch,
                "row_number": record["row"],
                "employee_id": values.get("employee_id") or None,
                "email": values.get("email") or None,
                "errors": json.dumps(record["errors"]),
                "raw": json.dumps(values),
                "created_at": now,
            })
        for start in range(0, len(error_mappings), CHUNK_SIZE):
            db.session.bulk_insert_mappings(
                EmployeeImportError, error_mappings[start:start + CHUNK_SIZE]
            )

    db.session.commit()

    response_errors = [
        {
            "row": record["row"],
            "employee_id": record["values"].get("employee_id"),
            "email": record["values"].get("email"),
            "errors": record["errors"],
        }
        for record in failures[:RESPONSE_ERROR_LIMIT]
    ]

    return jsonify({
        "batch": batch,
        "total_rows": len(records),
        "imported": len(accepted),
        "failed": len(failures),
        "duplicates": sum(1 for record in records if record["duplicate"]),
        "accounts_created": 0,
        "errors": response_errors,
        "errors_truncated": len(failures) > RESPONSE_ERROR_LIMIT,
        "error_report_url": (
            f"/api/admin/employees/imports/{batch}/errors.csv" if failures else None
        ),
        "duration_ms": int((time.perf_counter() - started) * 1000),
    }), 200


@employees_bp.get("/imports/<batch>/errors.csv")
@role_required("admin")
def import_error_report(batch):
    errors = EmployeeImportError.query.filter_by(batch=batch).order_by(
        EmployeeImportError.row_number.asc()
    ).all()
    if not errors:
        return jsonify({"error": "No error report found for this batch"}), 404

    return csv_response(
        ["Row", "Employee ID", "Email", "Validation errors"],
        [
            (error.row_number, error.employee_id, error.email,
             "; ".join(error.error_list()))
            for error in errors
        ],
        f"employee-import-errors-{batch}",
    )

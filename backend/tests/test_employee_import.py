"""Tests for the admin bulk employee import.

Covers the 1,000-row synthetic fixture, duplicate handling on re-import,
row-level validation, error report downloads, filtering/pagination, deep-link
focus, and the guarantee that no User accounts or passwords are created.
"""
from io import BytesIO
from pathlib import Path

import pytest

from database.db import db
from models.employee import Employee
from models.user import User


FIXTURE = Path(__file__).resolve().parents[2] / "smartcrm_1000_synthetic_employees.csv"


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _post_csv(client, headers, content, filename="employees.csv"):
    return client.post(
        "/api/admin/employees/import",
        data={"file": (BytesIO(content.encode("utf-8")), filename)},
        headers=headers,
        content_type="multipart/form-data",
    )


def _admin(app):
    with app.app_context():
        user = User.query.filter_by(email="seed@example.com").first()
        return user.id


class TestBulkImport:
    def test_fixture_exists_and_has_1000_rows(self):
        assert FIXTURE.exists(), f"Missing test fixture: {FIXTURE}"
        lines = FIXTURE.read_text(encoding="utf-8").splitlines()
        assert len(lines) == 1001
        assert lines[0].startswith("employee_id,name,email")

    def test_import_1000_rows_without_creating_accounts(self, client, app, make_token):
        headers = _headers(make_token("admin", _admin(app)))
        users_before = None
        with app.app_context():
            users_before = User.query.count()

        resp = _post_csv(
            client, headers, FIXTURE.read_text(encoding="utf-8"),
            filename="smartcrm_1000_synthetic_employees.csv",
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["total_rows"] == 1000
        assert body["imported"] == 1000
        assert body["failed"] == 0
        assert body["duplicates"] == 0
        assert body["accounts_created"] == 0
        assert body["errors"] == []
        assert body["batch"].startswith("IMP-")

        with app.app_context():
            assert Employee.query.count() == 1000
            assert User.query.count() == users_before  # no accounts created

        listing = client.get(
            "/api/admin/employees/?per_page=5", headers=headers
        ).get_json()
        assert listing["total"] == 1000
        assert listing["pages"] == 200
        assert listing["summary"] == {
            "total": 1000,
            "active": 957,
            "departments": 10,
            "with_manager": 990,
        }

    def test_reimport_reports_duplicates_and_keeps_directory_stable(
        self, client, app, make_token
    ):
        headers = _headers(make_token("admin", _admin(app)))
        content = FIXTURE.read_text(encoding="utf-8")
        assert _post_csv(client, headers, content).get_json()["imported"] == 1000

        second = _post_csv(client, headers, content)
        assert second.status_code == 200
        body = second.get_json()
        assert body["imported"] == 0
        assert body["failed"] == 1000
        assert body["duplicates"] == 1000
        assert body["accounts_created"] == 0

        with app.app_context():
            assert Employee.query.count() == 1000

    def test_row_validation_and_error_report(self, client, app, make_token):
        headers = _headers(make_token("admin", _admin(app)))
        content = "\n".join([
            "employee_id,name,email,phone,department,designation,manager_employee_id,status",
            "EMP2001,Good Person,good@example.com,,Sales,AE,EMP2002,active",
            "EMP2002,Boss Person,boss@example.com,,Sales,Manager,,active",
            "BAD ID!,Bad Id,bad@example.com,,Sales,AE,,active",
            "EMP2003,Bad Email,not-an-email,,Sales,AE,,active",
            "EMP2004,,missing-name@example.com,,Sales,AE,,active",
            "EMP2005,Dup One,dup@example.com,,Sales,AE,,active",
            "EMP2005,Dup Two,dup2@example.com,,Sales,AE,,active",
            "EMP2006,Missing Mgr,mm@example.com,,Sales,AE,EMP9999,active",
            "EMP2007,Bad Status,bs@example.com,,Sales,AE,,retired",
            "EMP2008,Self Mgr,sm@example.com,,Sales,AE,EMP2008,active",
            "EMP2009,Duplicate Email,dup@example.com,,Sales,AE,,active",
        ]) + "\n"

        resp = _post_csv(client, headers, content)
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["total_rows"] == 11
        assert body["imported"] == 3
        assert body["failed"] == 8
        assert body["duplicates"] == 2
        assert body["accounts_created"] == 0
        assert body["error_report_url"].endswith("/errors.csv")

        messages = " ".join(
            message for row in body["errors"] for message in row["errors"]
        )
        assert "must be 1-40 letters" in messages
        assert "email is not a valid address" in messages
        assert "name is required" in messages
        assert "duplicate employee_id in file" in messages
        assert "duplicate email in file" in messages
        assert "was not found in the file or directory" in messages
        assert "status must be 'active' or 'inactive'" in messages
        assert "cannot reference the same employee" in messages

        report = client.get(
            f"/api/admin/employees/imports/{body['batch']}/errors.csv",
            headers=headers,
        )
        assert report.status_code == 200
        assert "text/csv" in report.headers["Content-Type"]
        text = report.get_data(as_text=True).lstrip("\ufeff")
        assert text.splitlines()[0] == "Row,Employee ID,Email,Validation errors"
        assert "EMP9999" in text
        assert len(text.splitlines()) == 9  # header + 8 failed rows

    def test_missing_error_report_returns_404(self, client, app, make_token):
        headers = _headers(make_token("admin", _admin(app)))
        resp = client.get(
            "/api/admin/employees/imports/IMP-NOPE/errors.csv", headers=headers
        )
        assert resp.status_code == 404

    def test_header_aliases_are_accepted(self, client, app, make_token):
        headers = _headers(make_token("admin", _admin(app)))
        content = (
            "Employee ID,Full Name,Email Address,Mobile,Dept,Job Title,Manager,Status\n"
            "EMP3001,Alias Person,alias@example.com,+1 555 0000,Support,Agent,,active\n"
        )
        body = _post_csv(client, headers, content).get_json()
        assert body["imported"] == 1
        with app.app_context():
            employee = Employee.query.filter_by(employee_id="EMP3001").first()
            assert employee.name == "Alias Person"
            assert employee.department == "Support"

    def test_missing_required_columns_returns_400(self, client, app, make_token):
        headers = _headers(make_token("admin", _admin(app)))
        resp = _post_csv(client, headers, "employee_id,name\nEMP1,Only Name\n")
        assert resp.status_code == 400
        assert "Missing required columns" in resp.get_json()["error"]

    def test_no_file_returns_400(self, client, app, make_token):
        headers = _headers(make_token("admin", _admin(app)))
        resp = client.post(
            "/api/admin/employees/import", headers=headers,
            content_type="multipart/form-data",
        )
        assert resp.status_code == 400

    def test_non_admin_cannot_import_or_list(self, client, app, make_token):
        token = make_token("sales", _admin(app))
        headers = _headers(token)
        resp = _post_csv(client, headers, "employee_id,name,email\nEMP1,X,x@x.com\n")
        assert resp.status_code == 403
        assert client.get("/api/admin/employees/", headers=headers).status_code == 403


class TestEmployeeDirectory:
    @pytest.fixture
    def imported(self, client, app, make_token):
        headers = _headers(make_token("admin", _admin(app)))
        _post_csv(client, headers, FIXTURE.read_text(encoding="utf-8"))
        return headers

    def test_filters_and_pagination(self, client, imported):
        filtered = client.get(
            "/api/admin/employees/?department=Sales&status=inactive&per_page=100",
            headers=imported,
        ).get_json()
        assert filtered["total"] == 4
        assert all(
            row["department"] == "Sales" and row["status"] == "inactive"
            for row in filtered["employees"]
        )

        capped = client.get(
            "/api/admin/employees/?per_page=500", headers=imported
        ).get_json()
        assert len(capped["employees"]) == 100
        assert capped["pages"] == 10

        search = client.get(
            "/api/admin/employees/?search=EMP0500", headers=imported
        ).get_json()
        assert search["total"] == 1
        assert search["employees"][0]["employee_id"] == "EMP0500"

    def test_focus_deep_link_returns_target_row(self, client, imported):
        listing = client.get(
            "/api/admin/employees/?per_page=1", headers=imported
        ).get_json()
        target = listing["employees"][0]
        focused = client.get(
            f"/api/admin/employees/?focus={target['id']}", headers=imported
        ).get_json()
        assert focused["total"] == 1
        assert focused["employees"][0]["employee_id"] == target["employee_id"]

    def test_template_download(self, client, imported):
        resp = client.get("/api/admin/employees/template.csv", headers=imported)
        assert resp.status_code == 200
        assert "attachment" in resp.headers["Content-Disposition"]
        assert resp.get_data(as_text=True).lstrip("\ufeff").startswith(
            "employee_id,name,email,phone,department"
        )

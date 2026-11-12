SmartCRM Synthetic Dataset

All records are fictional synthetic test data. Emails use example.com. Phone fields are blank; no real phone numbers are fabricated.

Files:
- smartcrm_demo.sqlite: relational SQLite demo database with foreign keys.
- CSV exports for departments, employees, customers, leads, deals, tasks, followups and activities.
- manifest.json: record counts and validation summary.

Counts:
1,000 employees; 500 customers; 300 leads; 200 deals; 500 tasks; 300 follow-ups; 2,000 activities; 10 departments.

Import into an existing app:
1. Back up your existing database.
2. Compare these columns with your SQLAlchemy models.
3. Map field names and role/stage enums as needed.
4. Import in dependency order: departments, employees, customers, leads, deals, tasks, followups, activities.
5. Test dashboard calculations and role-based access.
This is a standalone demonstration schema, not a drop-in migration for every CRM database.

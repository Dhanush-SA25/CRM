# Implementation Plan: SmartCRM Steps 2–10

## Overview

Extend the existing SmartCRM (Flask backend + React/Vite/Tailwind frontend) with a 7-stage Kanban pipeline, three-tier RBAC, follow-up and task models, full CRUD modals for all entities, an admin user management panel, and an enhanced analytics dashboard. Each task builds directly on the previous one so no code is left orphaned.

---

## Tasks

- [x] 1. Backend — Stage migration and Deal model update
  - [x] 1.1 Update `models/deal.py` with `VALID_STAGES` list and `STAGE_PROBABILITIES` dict; change default stage from `"prospecting"` to `"new"`
    - Export `VALID_STAGES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]`
    - Export `STAGE_PROBABILITIES` mapping each stage to its default int probability
    - _Requirements: 1.1, 1.3_
  - [x] 1.2 Create `database/migrate_stages.py` with an idempotent `run_migration(app)` function
    - Map old stage names to new ones via raw `UPDATE deals SET stage = ...` SQL in a transaction
    - Add `linked_type VARCHAR(20)` and `linked_id INTEGER` nullable columns to `activities` table using `ALTER TABLE … ADD COLUMN IF NOT EXISTS`
    - Call `db.create_all()` to create any missing tables
    - _Requirements: 1.2, 8.1_
  - [x] 1.3 Update `routes/deals.py` to validate stage on create/update using `VALID_STAGES`; return HTTP 400 on invalid stage
    - _Requirements: 1.4_
  - [x] 1.4 Update `database/seed.py` to use the new stage values (`new`, `contacted`, `qualified`, `proposal`, `negotiation`, `won`, `lost`)
    - _Requirements: 1.8_
  - [x] 1.5 Write unit tests for stage validation in `tests/test_deals.py`
    - Test that POST/PUT with an invalid stage returns 400
    - Test that all 7 valid stages are accepted
    - _Requirements: 1.4_

- [x] 2. Backend — RBAC and JWT role claim
  - [x] 2.1 Create `services/rbac.py` with the `role_required(*roles)` decorator and `services/scoping.py` with `scoped_query`, `get_current_user_id`, `is_admin_or_manager` helpers
    - _Requirements: 2.5_
  - [x] 2.2 Update `routes/auth.py` — add `additional_claims={"role": user.role}` to both `create_access_token` calls (register + login)
    - _Requirements: 2.6_
  - [x] 2.3 Apply `scoped_query` to `routes/customers.py`, `routes/leads.py`, `routes/deals.py` list endpoints so sales reps only see their own records
    - _Requirements: 2.4_
  - [x] 2.4 Write unit tests for `role_required` decorator in `tests/test_rbac.py`
    - Test that `sales` role is blocked from admin-only routes (403)
    - Test that `admin` and `manager` are allowed through
    - **Property 6: Admin-Only User Management**
    - **Validates: Requirements 2.5, 9.2**

- [x] 3. Backend — FollowUp and Task models + routes
  - [x] 3.1 Create `models/followup.py` with `FollowUp` model; include overdue logic in `to_dict()`
    - _Requirements: 3.1, 3.3_
  - [x] 3.2 Create `models/task.py` with `Task` model
    - _Requirements: 4.1_
  - [x] 3.3 Register both models in `models/__init__.py`
    - _Requirements: 3.1, 4.1_
  - [x] 3.4 Create `routes/followups.py` blueprint with full CRUD; apply `scoped_query` for sales reps; support `?status`, `?linked_type`, `?linked_id`, `?assigned_to` query params
    - _Requirements: 3.2, 3.5_
  - [x] 3.5 Create `routes/tasks.py` blueprint with full CRUD; apply `scoped_query` for sales reps; support `?status`, `?assigned_to` query params
    - _Requirements: 4.2, 4.4_
  - [x] 3.6 Register `followups_bp` and `tasks_bp` in `routes/__init__.py` and `app.py`
    - _Requirements: 3.2, 4.2_
  - [x] 3.7 Write unit tests for overdue status computation in `tests/test_followups.py`
    - Test that a pending follow-up with past due_date serialises as `overdue`
    - **Property 4: Overdue Consistency**
    - **Validates: Requirements 3.3**

- [x] 4. Backend — Admin panel API and analytics extension
  - [x] 4.1 Create `routes/admin.py` blueprint at `/api/admin`; add endpoints: `GET /users`, `POST /users`, `GET /users/<id>`, `PUT /users/<id>`; guard all with `role_required("admin")`
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 4.2 Extend `routes/dashboard.py` with `GET /api/dashboard/analytics`; compute pipeline-by-stage, leads-by-source, win-rate, and activities-30d using SQLAlchemy aggregates
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  - [x] 4.3 Register `admin_bp` in `routes/__init__.py` and `app.py`
    - _Requirements: 9.1_
  - [x] 4.4 Write unit tests for admin route guards in `tests/test_admin.py`
    - Test that manager and sales roles receive 403
    - **Property 6: Admin-Only User Management**
    - **Validates: Requirements 9.2, 9.3**

- [x] 5. Checkpoint — Run migration and verify backend
  - Ensure all tests pass, ask the user if questions arise.
  - Run `python -c "from app import create_app; from database.migrate_stages import run_migration; run_migration(create_app())"` to apply migration.

- [x] 6. Frontend — Auth context role + npm dependency
  - [x] 6.1 Install `@hello-pangea/dnd@^16.6.0` by adding it to `frontend/package.json` dependencies and running `npm install`
    - _Requirements: 1.6_
  - [x] 6.2 Update `src/context/AuthContext.jsx` — decode the `role` from the JWT access token and expose it in the context value; add helper `decodeRole(token)` function
    - _Requirements: 2.6, 2.7_
  - [x] 6.3 Update `src/services/api.js` to pass role-aware logic (no change needed unless refresh path needs updating) — verify token refresh still sets role correctly by re-reading updated auth context flow
    - _Requirements: 2.7_

- [x] 7. Frontend — Shared Modal component and updated formatters
  - [x] 7.1 Create `src/components/ui/Modal.jsx` — portal-rendered overlay + panel; props: `isOpen`, `onClose`, `title`, `children`
    - _Requirements: 5.1, 6.1, 7.1_
  - [x] 7.2 Update `src/utils/formatters.js` — replace `DEAL_STAGE_LABELS` and `DEAL_STAGE_COLORS` with the 7 new stage values; add `FOLLOWUP_STATUS_COLORS`, `TASK_STATUS_COLORS`, `PRIORITY_COLORS` maps
    - _Requirements: 1.1, 3.1, 4.1_
  - [x] 7.3 Create `src/components/AdminRoute.jsx` — renders `<Outlet />` if `role === "admin"`, else redirects to `/dashboard`
    - _Requirements: 9.4_

- [x] 8. Frontend — Deals page with Kanban board
  - [x] 8.1 Create `src/components/deals/DealCard.jsx` (Draggable wrapper) and `src/components/deals/KanbanColumn.jsx` (Droppable wrapper)
    - _Requirements: 1.5, 1.6_
  - [x] 8.2 Create `src/components/deals/KanbanBoard.jsx` — wraps `DragDropContext`; calls `onStageChange(dealId, newStage)` on `onDragEnd`; groups deals by stage
    - _Requirements: 1.5, 1.6_
  - [x] 8.3 Create `src/components/deals/DealModal.jsx` using `Modal.jsx`; fields: title, value, stage, probability, close_date, customer dropdown, notes
    - _Requirements: 5.1_
  - [x] 8.4 Rewrite `src/pages/DealsPage.jsx` — add list/kanban toggle (persist in `localStorage` key `"deals_view"`); wire `DealModal` for create/edit; add delete with confirmation; call `dealService` for all mutations
    - _Requirements: 1.5, 1.6, 1.7, 5.1, 5.3_
  - [x] 8.5 Update `src/services/dealService.js` to include `update(id, data)` and `delete(id)` methods if not already present
    - _Requirements: 1.6, 5.3_
  - [x] 8.6 Write unit tests for `KanbanBoard` drag-and-drop in `src/components/deals/__tests__/KanbanBoard.test.jsx`
    - Simulate drag from one column to another; assert `onStageChange` called with correct args
    - **Property 7: Drag-and-Drop Persistence**
    - **Validates: Requirements 1.6**

- [x] 9. Frontend — Leads, Customers, Activities CRUD modals
  - [x] 9.1 Create `src/components/leads/LeadModal.jsx`; update `src/pages/LeadsPage.jsx` to wire create/edit modal, delete confirmation, and score badge
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 9.2 Create `src/components/customers/CustomerModal.jsx`; update `src/pages/CustomersPage.jsx` to wire create/edit modal, delete confirmation, and detail panel
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 9.3 Update `src/pages/ActivitiesPage.jsx` to include create modal (type, notes, linked record) and delete button; update `src/services/activityService.js` (create if missing) with `create` and `delete` methods
    - _Requirements: 8.2_
  - [x] 9.4 Update `src/services/leadService.js` and `src/services/customerService.js` to include `create`, `update`, `delete` methods matching updated routes
    - _Requirements: 6.1, 6.3, 7.1, 7.3_

- [x] 10. Frontend — FollowUps and Tasks pages
  - [x] 10.1 Create `src/services/followupService.js` with `list(params)`, `create`, `update`, `delete`
    - _Requirements: 3.2_
  - [x] 10.2 Create `src/components/followups/FollowUpModal.jsx`; create `src/pages/FollowUpsPage.jsx` with list, status/priority filters, and modal
    - _Requirements: 3.4_
  - [x] 10.3 Create `src/services/taskService.js` with `list(params)`, `create`, `update`, `delete`
    - _Requirements: 4.2_
  - [x] 10.4 Create `src/components/tasks/TaskModal.jsx`; create `src/pages/TasksPage.jsx` with tasks grouped by status (To Do / In Progress / Done) and modal
    - _Requirements: 4.3_

- [x] 11. Frontend — Admin Users page
  - [x] 11.1 Create `src/services/adminService.js` with `listUsers`, `createUser`, `updateUser` methods
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 11.2 Create `src/pages/AdminUsersPage.jsx` — table of all users with role badge, active toggle, and create/edit modal; role and active fields editable by admin
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 12. Frontend — Sidebar and routing wiring
  - [x] 12.1 Update `src/components/layout/Sidebar.jsx` — add "Follow-ups" and "Tasks" links for all roles; add "Admin" section with "Users" link only when `role === "admin"`
    - _Requirements: 2.7, 9.4_
  - [x] 12.2 Update `src/App.jsx` — add routes for `/followups`, `/tasks`, `/admin/users` (last wrapped in `AdminRoute`); import all new page components
    - _Requirements: 3.4, 4.3, 9.1_

- [x] 13. Frontend — Enhanced Dashboard analytics
  - [x] 13.1 Add `getAnalytics()` method to `src/services/dashboardService.js`
    - _Requirements: 10.5_
  - [x] 13.2 Update `src/pages/DashboardPage.jsx` — add `PipelineBarChart` (Recharts BarChart), `LeadSourcePieChart` (Recharts PieChart), `ActivityLineChart` (Recharts LineChart), and win-rate StatCard using data from `getAnalytics()`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify the migration script has run; confirm Kanban board renders all 7 columns; confirm admin nav hidden for non-admin users.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- The migration script (task 1.2) should be run once against the existing dev database before starting frontend work
- `@hello-pangea/dnd` is a maintained fork of `react-beautiful-dnd` and is API-compatible
- The `role` field decoded from the JWT is used purely for UI gating; all real security is enforced server-side
- Property tests validate universal correctness properties; unit tests validate specific examples and edge cases

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "3.2"] },
    { "id": 1, "tasks": ["1.2", "2.2", "3.3", "7.2"] },
    { "id": 2, "tasks": ["1.3", "1.4", "2.3", "3.4", "3.5", "7.1", "7.3", "6.1"] },
    { "id": 3, "tasks": ["1.5", "2.4", "3.6", "4.1", "4.2", "6.2"] },
    { "id": 4, "tasks": ["3.7", "4.3", "4.4", "6.3", "8.5", "9.4", "10.1", "10.3", "11.1", "13.1"] },
    { "id": 5, "tasks": ["8.1", "8.3", "9.1", "9.2", "9.3", "10.2", "10.4", "11.2"] },
    { "id": 6, "tasks": ["8.2", "12.1"] },
    { "id": 7, "tasks": ["8.4", "8.6", "12.2"] },
    { "id": 8, "tasks": ["13.2"] }
  ]
}
```

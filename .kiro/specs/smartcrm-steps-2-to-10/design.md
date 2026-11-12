# Design Document

## Overview

This document details the technical design for SmartCRM Steps 2–10, extending the existing Flask + React 18/Vite/Tailwind CRM. The implementation is split across backend (Python/Flask/SQLAlchemy/SQLite) and frontend (React/JSX, Tailwind CSS, Vite). No ORM migration tool (Alembic) is currently used; schema changes are applied via a one-time migration helper script that uses raw SQL through SQLAlchemy's engine.

---

## Architecture

The project follows its existing layered architecture:

```
backend/
  models/         — SQLAlchemy ORM models (one file per entity)
  routes/         — Flask Blueprint CRUD endpoints
  services/       — Shared utilities (auth helpers, decorators)
  database/       — db.py (SQLAlchemy instance), seed.py
  config/         — settings.py

frontend/src/
  pages/          — Top-level route components
  components/     — Reusable UI (layout, ui/, modals/)
  services/       — Axios wrappers per entity
  context/        — AuthContext (global user/role state)
  hooks/          — useApi, useDebounce
  utils/          — formatters.js, validators.js
```

New files introduced by this feature set slot naturally into the existing structure.

---

## Data Models

### Deal Model — Stage Migration

The existing `Deal.stage` column keeps the same `String(50)` type. The valid values change:

| Old value      | New value    | Default probability |
|----------------|-------------|---------------------|
| prospecting    | new         | 10                  |
| qualification  | qualified   | 40                  |
| proposal       | proposal    | 60                  |
| negotiation    | negotiation | 80                  |
| closed_won     | won         | 100                 |
| closed_lost    | lost        | 0                   |
| *(new)*        | contacted   | 20                  |

A standalone migration script `database/migrate_stages.py` runs the rename with `UPDATE deals SET stage = ...` statements inside a transaction.

Updated `deal.py`:
```python
VALID_STAGES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]
STAGE_PROBABILITIES = {"new": 10, "contacted": 20, "qualified": 40,
                       "proposal": 60, "negotiation": 80, "won": 100, "lost": 0}
```

### FollowUp Model (`models/followup.py`)

```python
class FollowUp(db.Model):
    __tablename__ = "followups"
    id           = Column(Integer, primary_key=True)
    title        = Column(String(200), nullable=False)
    description  = Column(Text, nullable=True)
    due_date     = Column(DateTime, nullable=False)
    status       = Column(String(20), default="pending")   # pending | completed | overdue
    priority     = Column(String(10), default="medium")    # low | medium | high
    linked_type  = Column(String(20), nullable=False)      # customer | lead
    linked_id    = Column(Integer, nullable=False)
    assigned_to  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by   = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

The `to_dict()` method computes `status = "overdue"` at serialisation time when `status == "pending"` and `due_date < datetime.utcnow()`.

### Task Model (`models/task.py`)

```python
class Task(db.Model):
    __tablename__ = "tasks"
    id          = Column(Integer, primary_key=True)
    title       = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    due_date    = Column(DateTime, nullable=False)
    status      = Column(String(20), default="todo")    # todo | in_progress | done
    priority    = Column(String(10), default="medium")  # low | medium | high
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by  = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

### Activity Model — Soft Extension

Two nullable columns are added to the existing `activities` table via a migration helper:

```sql
ALTER TABLE activities ADD COLUMN linked_type VARCHAR(20);
ALTER TABLE activities ADD COLUMN linked_id   INTEGER;
```

The `Activity.to_dict()` method is updated to include these fields. No existing rows are affected.

### User Model — No Schema Change

The `role` column already exists with values `admin | sales | manager`. The JWT encoding is extended to include `role` as an additional claim.

---

## Backend Design

### RBAC Decorator (`services/rbac.py`)

```python
from functools import wraps
from flask import jsonify
from flask_jwt_extended import jwt_required, get_jwt

def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            claims = get_jwt()
            if claims.get("role") not in roles:
                return jsonify({"error": "Forbidden"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator
```

### JWT Role Claim

In `routes/auth.py`, `create_access_token` calls are updated:

```python
additional_claims = {"role": user.role}
access_token = create_access_token(identity=str(user.id),
                                   additional_claims=additional_claims)
```

### Scope Helper (`services/scoping.py`)

```python
from flask_jwt_extended import get_jwt, get_jwt_identity

def get_current_user_id() -> int:
    return int(get_jwt_identity())

def is_admin_or_manager() -> bool:
    return get_jwt().get("role") in ("admin", "manager")

def scoped_query(query, model, field="assigned_to"):
    """Filter query to current user unless admin/manager."""
    if not is_admin_or_manager():
        query = query.filter(getattr(model, field) == get_current_user_id())
    return query
```

### New Blueprints

| Blueprint        | Prefix             | File                       |
|------------------|--------------------|----------------------------|
| `followups_bp`   | `/api/followups`   | `routes/followups.py`      |
| `tasks_bp`       | `/api/tasks`       | `routes/tasks.py`          |
| `admin_bp`       | `/api/admin`       | `routes/admin.py`          |
| `analytics_bp`   | `/api/dashboard`   | extended `routes/dashboard.py` |

#### `routes/followups.py` — Key Logic

- `GET /api/followups/` — applies `scoped_query`, then optional `?status`, `?linked_type`, `?linked_id`, `?assigned_to` filters.
- `POST /api/followups/` — sets `created_by = current_user_id()`.
- `PUT /api/followups/<id>` — sales rep can only modify their own record.
- `DELETE /api/followups/<id>` — sales rep restricted to own records; manager/admin unrestricted.

#### `routes/tasks.py` — Key Logic

Same pattern as followups but without `linked_type`/`linked_id`.

#### `routes/admin.py` — Endpoints

All routes require `role_required("admin")`:

- `GET  /api/admin/users` — list all users
- `POST /api/admin/users` — create user (name, email, password, role)
- `PUT  /api/admin/users/<id>` — update role, is_active
- `GET  /api/admin/users/<id>` — get single user

#### `routes/deals.py` — Stage Validation

Updated to validate stage on create/update:

```python
from models.deal import VALID_STAGES

if "stage" in data and data["stage"] not in VALID_STAGES:
    return jsonify({"error": f"Invalid stage. Must be one of {VALID_STAGES}"}), 400
```

#### `routes/dashboard.py` — Analytics Extension

New endpoint `GET /api/dashboard/analytics` returns:

```json
{
  "pipeline_by_stage": [{"stage": "new", "count": 3, "value": 45000}, ...],
  "leads_by_source":   [{"source": "website", "count": 5}, ...],
  "win_rate":          42.5,
  "activities_30d":    [{"date": "2024-06-15", "count": 4}, ...]
}
```

Computed with SQLAlchemy aggregate queries using `func.count`, `func.sum`, and `func.date`.

---

## Frontend Design

### New npm Dependency

`@hello-pangea/dnd` (version `^16.6.0`) is added for drag-and-drop Kanban support.

### Updated `AuthContext`

The JWT access token's payload is decoded client-side (base64 split, no verification needed as the backend already verifies it):

```javascript
// AuthContext.jsx
function decodeRole(token) {
  try {
    return JSON.parse(atob(token.split(".")[1])).role ?? null;
  } catch { return null; }
}
```

The context value gains a `role` field. All existing consumers are unaffected.

### New Pages

| Route              | Component                 | File                            |
|--------------------|---------------------------|---------------------------------|
| `/deals`           | `DealsPage` (enhanced)    | `src/pages/DealsPage.jsx`       |
| `/followups`       | `FollowUpsPage`           | `src/pages/FollowUpsPage.jsx`   |
| `/tasks`           | `TasksPage`               | `src/pages/TasksPage.jsx`       |
| `/admin/users`     | `AdminUsersPage`          | `src/pages/AdminUsersPage.jsx`  |

`App.jsx` gains routes for `/followups`, `/tasks`, and `/admin/users`. The last is guarded by an `AdminRoute` component that redirects non-admins.

### Deals Page — Kanban Board

```
DealsPage
├── toggle: list | kanban  (localStorage key: "deals_view")
├── ListViewTable           (existing table, refactored)
└── KanbanBoard
    ├── DragDropContext (from @hello-pangea/dnd)
    └── for each stage:
        └── KanbanColumn (Droppable)
            └── for each deal in stage:
                └── DealCard (Draggable)
```

`KanbanBoard` receives `deals[]` and `onStageChange(dealId, newStage)`. The `onDragEnd` callback calls `dealService.update(id, { stage: destination.droppableId })` and updates local state optimistically.

### Shared Modal Component

A generic `Modal.jsx` component is created at `src/components/ui/Modal.jsx`. It wraps a portal-rendered overlay + panel. All entity create/edit forms (Deal, Lead, Customer, FollowUp, Task) use it.

### New Service Files

| File                              | Methods                                      |
|-----------------------------------|----------------------------------------------|
| `src/services/followupService.js` | `list(params)`, `create`, `update`, `delete` |
| `src/services/taskService.js`     | `list(params)`, `create`, `update`, `delete` |
| `src/services/adminService.js`    | `listUsers`, `createUser`, `updateUser`      |

### Sidebar Update

`Sidebar.jsx` reads `role` from `AuthContext`. The "Admin" nav section renders only when `role === "admin"`. A "Follow-ups" and "Tasks" link are always visible.

### Dashboard Page Enhancement

New chart components added inside `DashboardPage.jsx`:

- `PipelineBarChart` — Recharts `BarChart` using `pipeline_by_stage` data
- `LeadSourcePieChart` — Recharts `PieChart` using `leads_by_source` data
- `ActivityLineChart` — Recharts `LineChart` using `activities_30d` data
- Win rate displayed as an existing-style `StatCard`

Data fetched from `GET /api/dashboard/analytics` via a new `dashboardService.getAnalytics()` method.

---

## Migration Strategy

1. `database/migrate_stages.py` — standalone script run once via `flask shell` or directly:
   - Renames old stage values in `deals` table
   - Adds `linked_type` / `linked_id` columns to `activities` table
   - Creates `followups` and `tasks` tables via `db.create_all()`
   - Safe to re-run (checks for column existence before ALTER)

2. Seed script (`database/seed.py`) updated to use new stage names and to seed sample FollowUps and Tasks.

---

## Components and Interfaces

### Backend Components

| Component | Interface |
|-----------|-----------|
| `services/rbac.py` → `role_required(*roles)` | Decorator factory; wraps any Flask route function; reads `role` from JWT claims via `get_jwt()` |
| `services/scoping.py` → `scoped_query(query, model, field)` | Returns filtered SQLAlchemy query; no-op for admin/manager, adds `WHERE assigned_to = <uid>` for sales |
| `models/deal.py` → `VALID_STAGES`, `STAGE_PROBABILITIES` | Module-level constants consumed by routes and migration script |
| `models/followup.py` → `FollowUp.to_dict()` | Serialises to dict; computes `overdue` status at call time |
| `models/task.py` → `Task.to_dict()` | Serialises to dict |
| `database/migrate_stages.py` → `run_migration(app)` | Idempotent function; performs raw SQL updates inside a transaction |
| `routes/admin.py` → `admin_bp` | Flask Blueprint at `/api/admin`; all routes gated by `role_required("admin")` |
| `routes/followups.py` → `followups_bp` | Flask Blueprint at `/api/followups`; uses `scoped_query` for sales reps |
| `routes/tasks.py` → `tasks_bp` | Flask Blueprint at `/api/tasks`; uses `scoped_query` for sales reps |

### Frontend Components

| Component | Interface |
|-----------|-----------|
| `components/ui/Modal.jsx` | Props: `isOpen: bool`, `onClose: fn`, `title: string`, `children`; renders portal overlay |
| `components/deals/KanbanBoard.jsx` | Props: `deals: Deal[]`, `onStageChange: fn(dealId, newStage)`; wraps `DragDropContext` |
| `components/deals/KanbanColumn.jsx` | Props: `stage: string`, `deals: Deal[]`; wraps `Droppable` |
| `components/deals/DealCard.jsx` | Props: `deal: Deal`, `index: number`; wraps `Draggable` |
| `components/deals/DealModal.jsx` | Props: `deal: Deal|null`, `onSave: fn`, `onClose: fn`; create/edit form |
| `components/leads/LeadModal.jsx` | Props: `lead: Lead|null`, `onSave: fn`, `onClose: fn` |
| `components/customers/CustomerModal.jsx` | Props: `customer: Customer|null`, `onSave: fn`, `onClose: fn` |
| `components/followups/FollowUpModal.jsx` | Props: `followup: FollowUp|null`, `onSave: fn`, `onClose: fn` |
| `components/tasks/TaskModal.jsx` | Props: `task: Task|null`, `onSave: fn`, `onClose: fn` |
| `components/AdminRoute.jsx` | Renders `<Outlet />` if role === "admin", else `<Navigate to="/dashboard" />` |
| `context/AuthContext.jsx` → `role` | Added to context value; decoded from JWT access token |

---

## Correctness Properties

### Property 1: Stage Enum Closure
For every deal `d` stored in the database, `d.stage` is one of: `new`, `contacted`, `qualified`, `proposal`, `negotiation`, `won`, `lost`.
**Validates: Requirements 1.1, 1.4**

### Property 2: Probability Bounds
For every deal `d`, `0 <= d.probability <= 100`.
**Validates: Requirements 1.3**

### Property 3: RBAC Non-Escalation
A `sales` user cannot read or write any record where `assigned_to != current_user_id`.
**Validates: Requirements 2.4, 3.5, 4.4**

### Property 4: Overdue Consistency
For any FollowUp `f`, if `f.status == "pending"` and `f.due_date < now()`, then `f.to_dict()["status"] == "overdue"`.
**Validates: Requirements 3.3**

### Property 5: JWT Role Claim Integrity
The `role` claim in every issued JWT equals `User.role` at the time of token issuance.
**Validates: Requirements 2.6**

### Property 6: Admin-Only User Management
`POST /api/admin/users` and `PUT /api/admin/users/<id>` return HTTP 403 for any JWT whose `role` claim is not `"admin"`.
**Validates: Requirements 9.2, 9.3**

### Property 7: Drag-and-Drop Persistence
After a successful `onDragEnd` callback, the deal's displayed stage matches the backend stage returned by the subsequent `GET /api/deals/<id>`.
**Validates: Requirements 1.6**

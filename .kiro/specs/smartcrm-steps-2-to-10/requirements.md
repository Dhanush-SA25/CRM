# Requirements Document

## Introduction

Extend the existing SmartCRM application (Flask + React 18/Vite/Tailwind) with eight major feature groups: a 7-stage sales pipeline with Kanban view, role-based access control, follow-up and task management, an enhanced deals UI, improved leads management, activity feed improvements, an admin panel for user management, and a richer analytics dashboard.

---

## Requirements

### 1. Sales Pipeline — 7-Stage Migration

#### 1.1 Stage Definition

The Deal model MUST support exactly seven stages in this order: `new`, `contacted`, `qualified`, `proposal`, `negotiation`, `won`, `lost`.

#### 1.2 Data Migration

The backend MUST include a migration script that maps existing stage values to the new schema:
- `prospecting` → `new`
- `qualification` → `qualified`
- `proposal` → `proposal`
- `negotiation` → `negotiation`
- `closed_won` → `won`
- `closed_lost` → `lost`
- Any unmapped value → `new`

#### 1.3 Default Probabilities

Each stage MUST have a default probability: `new`=10, `contacted`=20, `qualified`=40, `proposal`=60, `negotiation`=80, `won`=100, `lost`=0.

#### 1.4 Stage Validation

The backend MUST reject `PUT /api/deals/<id>` and `POST /api/deals/` requests with an invalid `stage` value, returning HTTP 400.

#### 1.5 Kanban Board View

The Deals page MUST offer a Kanban board view that renders one column per stage.

#### 1.6 Drag-and-Drop Stage Updates

Cards in the Kanban board MUST be draggable across columns using the `@hello-pangea/dnd` library. Dropping a card in a new column MUST immediately call `PUT /api/deals/<id>` to persist the stage change.

#### 1.7 List/Kanban Toggle

The Deals page MUST provide a toggle to switch between the existing list view and the new Kanban view, persisting the user's preference in `localStorage`.

#### 1.8 Seed Data Update

The seed script MUST be updated to use the new stage values so `flask seed` works on a fresh database.

---

### 2. Role-Based Access Control (RBAC)

#### 2.1 Role Definitions

Three roles MUST exist: `admin`, `manager`, `sales`. The existing `role` column on the User model is reused; the string value `"sales"` replaces the previous `"sales"` label (no DB change needed for the column itself, only logic).

#### 2.2 Admin Capabilities

Users with role `admin` MUST have unrestricted read/write access to all resources and MUST be able to manage users (list, create, update role/active status, deactivate).

#### 2.3 Manager Capabilities

Users with role `manager` MUST be able to read all Customers, Leads, Deals, Activities, and FollowUps/Tasks without restriction, but MUST NOT be able to manage users or delete records they do not own.

#### 2.4 Sales Rep Scoping

Users with role `sales` MUST only see Customers, Leads, Deals, FollowUps, and Tasks that are `assigned_to` their own user ID. Activities are scoped to records the sales rep can see.

#### 2.5 Role Enforcement Decorator

A reusable `role_required(*roles)` decorator MUST be created in `services/` and applied to all protected routes.

#### 2.6 JWT Role Claim

The JWT access token MUST include the user's role as an additional claim so the frontend can gate UI elements without an extra API call.

#### 2.7 Frontend Role Guards

The React `AuthContext` MUST expose the user's role. UI elements that require elevated roles (admin-only nav links, manager-visible controls) MUST be conditionally rendered based on the role from the JWT/AuthContext.

---

### 3. Follow-Up Management

#### 3.1 FollowUp Model

A new `FollowUp` SQLAlchemy model MUST be created with fields: `id`, `title` (string, required), `description` (text, optional), `due_date` (datetime, required), `status` (`pending` | `completed` | `overdue`), `priority` (`low` | `medium` | `high`, default `medium`), `linked_type` (`customer` | `lead`, required), `linked_id` (integer, required), `assigned_to` (FK → users.id), `created_by` (FK → users.id), `created_at`, `updated_at`.

#### 3.2 FollowUp CRUD API

A REST blueprint at `/api/followups` MUST provide: `GET /` (list with optional `?status=`, `?linked_type=`, `?linked_id=`, `?assigned_to=` filters), `POST /`, `GET /<id>`, `PUT /<id>`, `DELETE /<id>`.

#### 3.3 Overdue Auto-Status

When listing or retrieving a FollowUp, if `status == "pending"` and `due_date < now()` the API MUST return `status = "overdue"` (computed, not persisted unless explicitly updated).

#### 3.4 FollowUps Page

A new `/followups` page MUST be added to the frontend showing a list of follow-ups with filters for status and priority, and a create/edit modal.

#### 3.5 Sales Rep Scoping for FollowUps

Sales reps MUST only see FollowUps where `assigned_to == current_user.id`. Managers and admins see all.

---

### 4. Task Management

#### 4.1 Task Model

A new `Task` SQLAlchemy model MUST be created with fields: `id`, `title` (string, required), `description` (text, optional), `due_date` (datetime, required), `status` (`todo` | `in_progress` | `done`), `priority` (`low` | `medium` | `high`, default `medium`), `assigned_to` (FK → users.id), `created_by` (FK → users.id), `created_at`, `updated_at`.

#### 4.2 Task CRUD API

A REST blueprint at `/api/tasks` MUST provide: `GET /` (list with optional `?status=`, `?assigned_to=` filters), `POST /`, `GET /<id>`, `PUT /<id>`, `DELETE /<id>`.

#### 4.3 Tasks Page

A new `/tasks` page MUST be added to the frontend showing tasks grouped by status (To Do / In Progress / Done) with a create/edit modal.

#### 4.4 Sales Rep Scoping for Tasks

Sales reps MUST only see Tasks where `assigned_to == current_user.id`. Managers and admins see all.

---

### 5. Enhanced Deals UI

#### 5.1 Deal Create/Edit Modal

The Deals page MUST include a modal form for creating and editing deals, replacing the stub button that currently does nothing. Fields: title, value, stage, probability, close_date, customer (dropdown), assigned_to (admin/manager only), notes.

#### 5.2 Deal Detail View

Clicking a deal card or row MUST open a detail panel/drawer showing all deal fields plus a list of related activities.

#### 5.3 Deal Delete

Each deal row/card MUST have a delete option with a confirmation prompt.

---

### 6. Enhanced Leads UI

#### 6.1 Lead Create/Edit Modal

The Leads page MUST include a modal form for creating and editing leads. Fields: name, email, phone, company, status, source, score (0–100), assigned_to (admin/manager only), notes.

#### 6.2 Lead Score Badge

Each lead row MUST display the lead score as a coloured badge: 0–39 red, 40–69 yellow, 70–100 green.

#### 6.3 Lead Delete

Each lead row MUST have a delete option with a confirmation prompt.

---

### 7. Enhanced Customers UI

#### 7.1 Customer Create/Edit Modal

The Customers page MUST include a modal form for creating and editing customers. Fields: name, email, phone, company, status, assigned_to (admin/manager only), notes.

#### 7.2 Customer Detail View

Clicking a customer row MUST open a detail panel showing all fields, related deals, and related activities.

#### 7.3 Customer Delete

Each customer row MUST have a delete option with a confirmation prompt.

---

### 8. Activity Feed Improvements

#### 8.1 Link Activities to Records

The Activity model already has a `created_by` FK. The backend MUST add optional `linked_type` (`customer` | `lead` | `deal`) and `linked_id` integer columns (nullable, no migration breakage) so activities can be anchored to a specific record.

#### 8.2 Activity CRUD in UI

The Activities page MUST allow creating new activities via a modal form (type, notes, linked record) and deleting existing ones.

#### 8.3 Inline Activity List

The Customer and Deal detail views MUST render a filtered activity list showing only activities linked to that record.

---

### 9. Admin Panel — User Management

#### 9.1 Users List

Admins MUST be able to view a `/admin/users` page listing all users with name, email, role, active status, and created date.

#### 9.2 Create User

Admins MUST be able to create new users with name, email, password, and role via a modal form. The backend `POST /api/admin/users` endpoint MUST be guarded by `role_required("admin")`.

#### 9.3 Edit User Role and Status

Admins MUST be able to change a user's role and toggle their `is_active` flag via `PUT /api/admin/users/<id>`.

#### 9.4 Admin Nav Link

The sidebar MUST show an "Admin" section with a link to `/admin/users` only when the logged-in user's role is `admin`.

---

### 10. Analytics Dashboard Enhancement

#### 10.1 Pipeline Value by Stage

The dashboard MUST display a bar chart (using existing Recharts library) showing total deal value grouped by pipeline stage.

#### 10.2 Lead Source Breakdown

The dashboard MUST display a pie/donut chart showing lead count by source.

#### 10.3 Win Rate

The dashboard MUST display a stat card showing the win rate: `won deals / (won + lost deals) * 100`, formatted as a percentage.

#### 10.4 Activities Over Time

The dashboard MUST display a line chart showing activity count per day for the last 30 days.

#### 10.5 Enhanced Dashboard API

The existing `GET /api/dashboard/summary` endpoint MUST be extended (or supplemented with `GET /api/dashboard/analytics`) to return all data needed for the four new charts, computed server-side.

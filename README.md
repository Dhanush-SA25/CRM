# SmartCRM

A professional full-stack Customer Relationship Management (CRM) system.

| Layer    | Technology                       |
|----------|----------------------------------|
| Frontend | React 18 + Vite + Tailwind CSS   |
| Backend  | Python Flask + SQLAlchemy        |
| Database | SQLite                           |
| Auth     | JWT (Flask-JWT-Extended)         |
| Charts   | Recharts                         |
| Icons    | Lucide React                     |

---

## Project structure

```
CRM/
├── backend/
│   ├── app.py              ← Flask application factory + CLI commands
│   ├── requirements.txt
│   ├── .env.example
│   ├── .flaskenv
│   ├── config/
│   │   └── settings.py
│   ├── database/
│   │   ├── db.py           ← shared SQLAlchemy instance
│   │   └── seed.py         ← dev-only sample data
│   ├── models/
│   │   ├── user.py
│   │   ├── customer.py
│   │   ├── lead.py
│   │   ├── deal.py
│   │   └── activity.py
│   ├── routes/
│   │   ├── auth.py
│   │   ├── customers.py
│   │   ├── leads.py
│   │   ├── deals.py
│   │   ├── activities.py
│   │   └── dashboard.py
│   └── services/
│       └── auth_service.py
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── context/
        │   └── AuthContext.jsx
        ├── hooks/
        │   ├── useApi.js
        │   └── useDebounce.js
        ├── services/
        │   ├── api.js            ← Axios instance + interceptors
        │   ├── authService.js
        │   ├── customerService.js
        │   ├── leadService.js
        │   ├── dealService.js
        │   └── dashboardService.js
        ├── utils/
        │   ├── formatters.js
        │   └── validators.js
        ├── components/
        │   ├── ProtectedRoute.jsx
        │   ├── layout/
        │   │   ├── AppLayout.jsx
        │   │   ├── Sidebar.jsx
        │   │   └── Topbar.jsx
        │   └── ui/
        │       ├── Badge.jsx
        │       ├── EmptyState.jsx
        │       ├── LoadingSpinner.jsx
        │       ├── PageHeader.jsx
        │       └── StatCard.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── RegisterPage.jsx
            ├── DashboardPage.jsx
            ├── CustomersPage.jsx
            ├── LeadsPage.jsx
            ├── DealsPage.jsx
            ├── ActivitiesPage.jsx
            └── NotFoundPage.jsx
```

---

## Quick start

### Fastest path — root scripts

Two PowerShell launchers handle environment checks and resolve Node/npm even when
they are not on `PATH` (the bundled Node install lives at `D:\python` on this machine).

```powershell
# Terminal 1 — API on http://localhost:5000
.\start-backend.ps1

# Terminal 2 — web app on http://localhost:5173
.\start-frontend.ps1
```

The root `package.json` mirrors the same commands:

```powershell
npm run dev:backend     # Flask (uses backend\.venv)
npm run dev:frontend    # Vite
npm run test:backend    # pytest
npm run test:frontend   # vitest
npm run build           # production bundle
```

### Troubleshooting "Cannot reach the server"

1. Confirm the API is up: open <http://localhost:5000/api/health> — it must return `{"status":"ok"}`.
2. Confirm the frontend is on port **5173**; the app calls `http://localhost:5000/api`
   (see `frontend/.env` → `VITE_API_BASE_URL`).
3. Restart both processes after changing `.env` files — Vite reads env vars only at startup.
4. The login screen shows a red *API offline* banner and the topbar shows a **Connected**
   pill driven by live health checks, so you can see connectivity at a glance.
5. If PowerShell blocks the scripts: `powershell -ExecutionPolicy Bypass -File .\start-backend.ps1`.

### 1 — Backend

```powershell
# From the project root
cd backend

# Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Copy the environment template and edit if needed
Copy-Item .env.example .env

# Create the database tables
flask create-db

# (Optional) seed with sample data
flask seed

# Start the development server  →  http://localhost:5000
python app.py
```

The API will be available at **http://localhost:5000/api**

Health check: `GET http://localhost:5000/api/health`

### 2 — Frontend

Open a **new terminal** tab:

```powershell
cd frontend

# Install Node dependencies
npm install

# Copy the environment template
Copy-Item .env.example .env

# Start the Vite dev server  →  http://localhost:5173
npm run dev
```

The Vite dev server automatically proxies `/api/*` to the Flask backend,
so you can call `/api/...` without worrying about CORS in development.

---

## Demo credentials (after seeding)

| Email                   | Password  | Role  |
|-------------------------|-----------|-------|
| admin@smartcrm.com      | admin123  | admin |
| jane@smartcrm.com       | jane123   | sales |

---

## REST API overview

| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| POST   | /api/auth/register          | Register a new user      |
| POST   | /api/auth/login             | Login → returns JWT      |
| POST   | /api/auth/refresh           | Refresh access token     |
| GET    | /api/auth/me                | Current user info        |
| GET    | /api/customers/             | List / search customers  |
| POST   | /api/customers/             | Create customer          |
| GET    | /api/customers/:id          | Get customer             |
| PUT    | /api/customers/:id          | Update customer          |
| DELETE | /api/customers/:id          | Delete customer          |
| GET    | /api/leads/                 | List leads               |
| POST   | /api/leads/                 | Create lead              |
| GET    | /api/deals/                 | List deals               |
| POST   | /api/deals/                 | Create deal              |
| GET    | /api/activities/            | List activities          |
| POST   | /api/activities/            | Log activity             |
| GET    | /api/dashboard/summary      | Dashboard stats          |

All protected endpoints require the header: `Authorization: Bearer <access_token>`

Additional endpoints: `/api/followups/`, `/api/tasks/`, `/api/dashboard/analytics`,
`/api/users/` (admin only), and `/api/health` (public).

---

## Design system

The UI follows a single graphite-on-white identity defined once and inherited everywhere:

| Token | Value |
|-------|-------|
| Page background | `#F5F6F8` with a fixed charcoal-to-white gradient wash |
| Surface | `#FFFFFF` cards, `rounded-2xl`, ring `#E5E7EB` |
| Primary gradient | `#111827 → #6B7280` |
| Text | `#1F2937` primary, `#6B7280` secondary |
| Semantic | success `#16A34A`, warning `#D97706`, danger `#DC2626`, info `#2563EB` |

Tokens live in `frontend/tailwind.config.js` (`primary`, `ink`, `surface`, `backgroundImage`,
`boxShadow`) and component classes in `frontend/src/index.css`
(`.btn-primary`, `.card`, `.glass-panel`, `.form-input`, `.badge-*`, `.data-table`).
Use these classes for new screens instead of ad-hoc Tailwind colors.

---

## Production build

```powershell
# Build the frontend
cd frontend
npm run build        # output → frontend/dist/

# Serve the Flask API (use gunicorn on Linux/Mac)
# On Windows, use waitress:
pip install waitress
waitress-serve --port=5000 app:app
```

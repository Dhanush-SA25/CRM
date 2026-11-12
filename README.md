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
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ app.py              â† Flask application factory + CLI commands
â”‚   â”œâ”€â”€ requirements.txt
â”‚   â”œâ”€â”€ .env.example
â”‚   â”œâ”€â”€ .flaskenv
â”‚   â”œâ”€â”€ config/
â”‚   â”‚   â””â”€â”€ settings.py
â”‚   â”œâ”€â”€ database/
â”‚   â”‚   â”œâ”€â”€ db.py           â† shared SQLAlchemy instance
â”‚   â”‚   â””â”€â”€ seed.py         â† dev-only sample data
â”‚   â”œâ”€â”€ models/
â”‚   â”‚   â”œâ”€â”€ user.py
â”‚   â”‚   â”œâ”€â”€ customer.py
â”‚   â”‚   â”œâ”€â”€ lead.py
â”‚   â”‚   â”œâ”€â”€ deal.py
â”‚   â”‚   â””â”€â”€ activity.py
â”‚   â”œâ”€â”€ routes/
â”‚   â”‚   â”œâ”€â”€ auth.py
â”‚   â”‚   â”œâ”€â”€ customers.py
â”‚   â”‚   â”œâ”€â”€ leads.py
â”‚   â”‚   â”œâ”€â”€ deals.py
â”‚   â”‚   â”œâ”€â”€ activities.py
â”‚   â”‚   â””â”€â”€ dashboard.py
â”‚   â””â”€â”€ services/
â”‚       â””â”€â”€ auth_service.py
â”‚
â””â”€â”€ frontend/
    â”œâ”€â”€ index.html
    â”œâ”€â”€ vite.config.js
    â”œâ”€â”€ tailwind.config.js
    â”œâ”€â”€ postcss.config.js
    â”œâ”€â”€ package.json
    â””â”€â”€ src/
        â”œâ”€â”€ main.jsx
        â”œâ”€â”€ App.jsx
        â”œâ”€â”€ index.css
        â”œâ”€â”€ context/
        â”‚   â””â”€â”€ AuthContext.jsx
        â”œâ”€â”€ hooks/
        â”‚   â”œâ”€â”€ useApi.js
        â”‚   â””â”€â”€ useDebounce.js
        â”œâ”€â”€ services/
        â”‚   â”œâ”€â”€ api.js            â† Axios instance + interceptors
        â”‚   â”œâ”€â”€ authService.js
        â”‚   â”œâ”€â”€ customerService.js
        â”‚   â”œâ”€â”€ leadService.js
        â”‚   â”œâ”€â”€ dealService.js
        â”‚   â””â”€â”€ dashboardService.js
        â”œâ”€â”€ utils/
        â”‚   â”œâ”€â”€ formatters.js
        â”‚   â””â”€â”€ validators.js
        â”œâ”€â”€ components/
        â”‚   â”œâ”€â”€ ProtectedRoute.jsx
        â”‚   â”œâ”€â”€ layout/
        â”‚   â”‚   â”œâ”€â”€ AppLayout.jsx
        â”‚   â”‚   â”œâ”€â”€ Sidebar.jsx
        â”‚   â”‚   â””â”€â”€ Topbar.jsx
        â”‚   â””â”€â”€ ui/
        â”‚       â”œâ”€â”€ Badge.jsx
        â”‚       â”œâ”€â”€ EmptyState.jsx
        â”‚       â”œâ”€â”€ LoadingSpinner.jsx
        â”‚       â”œâ”€â”€ PageHeader.jsx
        â”‚       â””â”€â”€ StatCard.jsx
        â””â”€â”€ pages/
            â”œâ”€â”€ LoginPage.jsx
            â”œâ”€â”€ RegisterPage.jsx
            â”œâ”€â”€ DashboardPage.jsx
            â”œâ”€â”€ CustomersPage.jsx
            â”œâ”€â”€ LeadsPage.jsx
            â”œâ”€â”€ DealsPage.jsx
            â”œâ”€â”€ ActivitiesPage.jsx
            â””â”€â”€ NotFoundPage.jsx
```

---

## Quick start

### Fastest path â€” root scripts

Two PowerShell launchers handle environment checks and resolve Node/npm even when
they are not on `PATH` (the bundled Node install lives at `D:\python` on this machine).

```powershell
# Terminal 1 â€” API on http://localhost:5000
.\start-backend.ps1

# Terminal 2 â€” web app on http://localhost:5173
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

1. Confirm the API is up: open <http://localhost:5000/api/health> â€” it must return `{"status":"ok"}`.
2. Confirm the frontend is on port **5173**; the app calls `http://localhost:5000/api`
   (see `frontend/.env` â†’ `VITE_API_BASE_URL`).
3. Restart both processes after changing `.env` files â€” Vite reads env vars only at startup.
4. The login screen shows a red *API offline* banner and the topbar shows a **Connected**
   pill driven by live health checks, so you can see connectivity at a glance.
5. If PowerShell blocks the scripts: `powershell -ExecutionPolicy Bypass -File .\start-backend.ps1`.

### 1 â€” Backend

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

# Start the development server  â†’  http://localhost:5000
python app.py
```

The API will be available at **http://localhost:5000/api**

Health check: `GET http://localhost:5000/api/health`

### 2 â€” Frontend

Open a **new terminal** tab:

```powershell
cd frontend

# Install Node dependencies
npm install

# Copy the environment template
Copy-Item .env.example .env

# Start the Vite dev server  â†’  http://localhost:5173
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
| POST   | /api/auth/login             | Login â†’ returns JWT      |
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
| Primary gradient | `#111827 â†’ #6B7280` |
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
npm run build        # output â†’ frontend/dist/

# Serve the Flask API (use gunicorn on Linux/Mac)
# On Windows, use waitress:
pip install waitress
waitress-serve --port=5000 app:app
```

---

# SmartCRM Deployment Guide

## Architecture

GitHub is the single source of truth. Every push to main triggers auto-deploy on both platforms.

- Frontend: Netlify (React/Vite static build)
- Backend: Render (Flask API + SQLite)

## Step 1: Deploy Backend to Render

1. Go to https://dashboard.render.com and sign in with GitHub
2. Click New, then Blueprint
3. Select repo Dhanush-SA25/CRM
4. Render detects render.yaml at repo root
5. Click Apply to create smartcrm-api web service
6. Your API URL: https://smartcrm-api.onrender.com
7. Verify: visit https://smartcrm-api.onrender.com/api/health

After first deploy, open Render shell and run:
- flask create-db
- flask seed

## Step 2: Connect Frontend to Netlify

1. Go to https://app.netlify.com and sign in with GitHub
2. Click Add new site, then Import an existing project
3. Select repo Dhanush-SA25/CRM
4. Netlify detects netlify.toml and auto-fills build settings
5. Under Environment variables, add:
   VITE_API_BASE_URL = https://smartcrm-api.onrender.com/api
6. Click Deploy site

## Step 3: Verify

1. Visit your Netlify URL
2. Login with admin@smartcrm.com / admin123
3. Navigate Dashboard, Customers, Leads, Deals, Follow-ups, Tasks
4. Check browser console for errors

## White Screen Fix

Fixed via frontend/public/_redirects file with SPA catch-all redirect.
This ensures direct URL visits like /dashboard serve index.html.

## Auto-Deploy Flow

Every commit to main on GitHub:
- Netlify rebuilds frontend and publishes to CDN
- Render redeploys Flask backend

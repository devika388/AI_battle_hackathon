# FoodBridge

FoodBridge connects food donors, community organizations, and delivery partners
to help surplus food reach the people who need it. This repository is organized
as separate React frontend and Express backend applications.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Setup and run

From the repository root, install the workspace dependencies and copy the
environment template:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The development command starts both applications:

- Frontend: <http://localhost:5173>
- Backend: <http://localhost:3001>
- API health check: <http://localhost:3001/api/health>

The frontend uses the Vite development proxy for `/api` requests. API settings
are centralized in `frontend/src/config/api.ts`.

To build both workspaces:

```powershell
npm run build
```

To run the compiled backend after building:

```powershell
npm run start:backend
```

## Environment variables

`.env.example` lists the application settings:

| Variable | Purpose | Default |
|---|---|---|
| `API_PORT` | Express listening port | `3001` |
| `FRONTEND_ORIGIN` | Allowed browser origin for API requests | `http://localhost:5173` |
| `VITE_API_BASE_URL` | API prefix used by the frontend and Vite proxy | `/api` |

Keep `.env` local; it is ignored by Git. Never put private credentials or a
Supabase service-role key in frontend variables. No Supabase queries or schema
changes are included in this scaffold: the existing 13 tables are left intact.
Before adding database operations, inspect the live project schema and use its
actual table and column definitions.

## Folder structure

```text
frontend/
  src/
    components/  Reusable interface components
    config/      Centralized frontend API configuration
    pages/       React Router page components
    services/    API client and response handling
    styles/      Tailwind entry stylesheet
    types/       Shared frontend response types
backend/
  src/
    config/      Environment loading and validation
    controllers/ HTTP request handlers
    middleware/  Not-found and centralized error handling
    routes/      Express API routes
    services/    Backend health service
    types/       API response types
    utils/       Shared backend utilities
```

The API currently exposes only a real process health check (`GET /api/health`).
Database-backed features should be added after the existing Supabase schema has
been inspected; this setup does not create simulated donation or user data.

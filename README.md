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

The root page is the FoodBridge public website. The design system and reusable
component preview are available at `/design-system`. Reusable UI components
are exported from `frontend/src/components/ui`; visual tokens, field styles,
motion, and reduced-motion behavior live in `frontend/src/styles/index.css`
and `frontend/tailwind.config.js`.

To build both workspaces:

```powershell
npm run build
```

To run the compiled backend after building:

```powershell
npm run start:backend
```

The backend API routes, payloads, access roles, and delivery-proof upload format
are documented in [`backend/API.md`](./backend/API.md).

## Environment variables

`.env.example` lists the application settings:

| Variable | Purpose | Default |
|---|---|---|
| `API_PORT` | Express listening port | `3001` |
| `FRONTEND_ORIGIN` | Allowed browser origin for API requests | `http://localhost:5173` |
| `VITE_API_BASE_URL` | API prefix used by the frontend and Vite proxy | `/api` |
| `VITE_PUBLIC_CONTACT_EMAIL` | Address used to open contact-form email drafts | Not configured |
| `VITE_SUPABASE_URL` | Supabase project URL used in the browser | Required |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/publishable key used in the browser | Required |
| `SUPABASE_URL` | Supabase project URL used by the trusted API | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend-only key for profile RPC and approval operations | Required |

Keep `.env` local; it is ignored by Git. Never put private credentials or the
Supabase service-role key in frontend variables. The service-role key bypasses
RLS and must only be available to the backend.

### Supabase authentication setup

1. Copy `.env.example` to `.env`, then set `VITE_SUPABASE_URL` and
   `SUPABASE_URL` to the project URL, `VITE_SUPABASE_ANON_KEY` to the
   anon/publishable key, and `SUPABASE_SERVICE_ROLE_KEY` to the service-role
   key. Keep the service-role key backend-only and never commit `.env`.
2. Inspect the live database with the read-only
   [`supabase/inspect_schema.sql`](./supabase/inspect_schema.sql) query before
   applying policies. The query result should include actual policies and
   bucket settings as well as schema. Do not share credentials or user records.
3. Apply [`supabase/migrations/20261107193000_foodbridge_auth.sql`](./supabase/migrations/20261107193000_foodbridge_auth.sql)
   in the Supabase SQL editor. It does not create, drop, or alter the existing
   13 tables or their columns. It adds a service-role-only, serialized,
   idempotent profile completion function and enables RLS on `profiles`,
   `donor_profiles`, `ngo_profiles`, and `partner_profiles`. Restrictive
   policies prevent direct client profile writes/role changes and limit reads
   to the owning account without deleting existing policies. SQL files in this
   repository are not active until explicitly run in Supabase.
4. Apply [`supabase/migrations/20261107210000_foodbridge_backend_security.sql`](./supabase/migrations/20261107210000_foodbridge_backend_security.sql)
   after confirming the read-only inspection output. It adds suspension state,
   backend-only transaction functions, and restrictive RLS/storage policies
   without dropping existing tables or policies. No policy should be treated
   as active until this migration has succeeded in Supabase.
5. To temporarily skip signup email verification, open Supabase Dashboard →
   Authentication → Providers → Email and turn off **Confirm email**. Keep
   email/password sign-in enabled. The backend still requires a valid Supabase
   access token and enforces account roles and permissions. Allow the app origin
   and `/reset-password` in the Supabase redirect URL configuration for local
   and deployed environments.
6. Apply [`supabase/migrations/20261107222000_foodbridge_dashboard_fields.sql`](./supabase/migrations/20261107222000_foodbridge_dashboard_fields.sql)
   to add the donor donation details and NGO matching preferences required by
   the dashboards. This migration adds columns and trusted transactional
   functions; it does not recreate or delete existing tables.
7. Start the frontend and backend with `npm run dev`.

The registration handler uses the inspected schema: `profiles.id` is the auth
user UUID; contact details go in `profiles`; donor, NGO, and vehicle details go
in their existing subtype tables. The requested donor type has no column in the
existing schema, so it is kept as non-authoritative Supabase user metadata.
Registration metadata is validated server-side; only the backend's service-role
RPC writes profile roles. Existing profile rows are returned unchanged rather
than duplicated.

NGOs remain unverified using `ngo_profiles.is_verified = false`. Since the
existing partner table has no approval column, new delivery accounts use the
`delivery_partner_pending` value in `profiles.role` and are made unavailable
until an admin approves them through the protected admin dashboard. Public
registration only permits donor, NGO, and delivery partner roles. To provision
an initial admin, create the Auth user in Supabase, then assign `admin`
to that user's matching `profiles.id` using the trusted Supabase SQL editor.
There is intentionally no public admin signup or role-change endpoint. Email
verification is disabled in the application flow for now; re-enable **Confirm
email** in Supabase to restore its signup confirmation requirement.

The API verifies Supabase access tokens and resolves the effective role from
`profiles`; frontend metadata is never used for authorization. Dashboard routes
are guarded client-side for UX and protected API operations are verified again
on the server. Password reset continues to use Supabase email links.

The public contact form opens an email draft and does not store or submit
messages to the backend. Set `VITE_PUBLIC_CONTACT_EMAIL` in `.env` to enable it.
Impact figures on the public page are explicitly marked as illustrative
demonstration data, not platform achievements; testimonials are not fabricated.

## Folder structure

```text
frontend/
  src/
    auth/         Session context and protected route guards
    components/   Reusable interface and authentication components
    config/      Centralized frontend API configuration
    pages/       Public, auth, verification, and dashboard pages
    services/    API client and Supabase client
    styles/      Tailwind entry stylesheet
    types/       Shared frontend response types
backend/
  src/
    config/      Environment loading and validation
    controllers/ HTTP request handlers
    middleware/  Token verification, role checks, and error handling
    routes/      Express API routes
    services/    Supabase admin client and profile workflows
    types/       API, auth, and Express types
    utils/       Shared backend utilities
supabase/
  migrations/    Idempotent registration function and profile RLS
```

The API also provides authenticated donor and NGO dashboard data and actions,
partner delivery workflows, administration, notifications, and impact
statistics. See [`backend/API.md`](./backend/API.md) for all routes and access
requirements. Donor and NGO pages use live API/Supabase data; the matching score
is a documented rules-based score rather than a trained AI model.

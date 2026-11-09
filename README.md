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

## Temporary read-only demo mode

Demo mode is optional with `VITE_DEMO_MODE=true` and `DEMO_MODE=true`.
It removes the login and registration screens and opens a sample dashboard at
`/demo`. The backend exposes only `/api/health` and the read-only `/api/demo`
status endpoint; all account and data APIs are disabled. Sample dashboard data
is local demo content and is never written to Supabase. Both flags default to
`false`, so normal Auth mode is used unless demo mode is explicitly enabled.

To use account-based functionality, leave both flags unset or set them to
`false` and restart the frontend and backend. Keep the Supabase Auth setup below
for that mode. Do not apply database policies to make public writes possible.

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

## Deploy on Render

Deploy this repository as two Render services. Keep each service's **Root
Directory** at the repository root so npm can use the root workspace and
`package-lock.json`.

### Backend web service

- **Build Command:** `npm ci && npm run build --workspace backend`
- **Start Command:** `npm run start --workspace backend`
- **Health Check Path:** `/api/health`

Set these environment variables on the backend service:

- `FRONTEND_ORIGIN`: the deployed frontend's exact `https://...onrender.com`
  origin (no trailing slash). `http://localhost:5173` is also allowed for
  local development.
- `SUPABASE_URL`: your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: the Supabase service-role key; backend only
- `DEMO_MODE`: `false` for the real app, or `true` for the read-only demo

The backend listens on Render's `PORT` automatically. Do not set
`SUPABASE_SERVICE_ROLE_KEY` on the frontend.

### Frontend static site

- **Build Command:** `npm ci && npm run build --workspace frontend`
- **Publish Directory:** `frontend/dist`

Set these build environment variables on the static site:

- `VITE_API_BASE_URL`: the backend URL followed by `/api`, for example
  `https://foodbridge-api.onrender.com/api`
- `VITE_SUPABASE_URL`: your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: your Supabase anon/publishable key
- `VITE_DEMO_MODE`: `false` for the real app, or `true` for the read-only demo
- `VITE_PUBLIC_CONTACT_EMAIL`: optional contact-form email address

For React Router deep links to load on refresh, add a Render rewrite from
`/*` to `/index.html`.

Deploy the backend first, then set the frontend's backend URL and deploy the
static site. Copy its Render URL into the backend's `FRONTEND_ORIGIN` and
redeploy/restart the backend. Before using account features, apply the
Supabase migrations in `supabase/migrations/` in order and allow the deployed
frontend URL plus `/auth/callback` and `/reset-password` in Supabase Auth
redirect settings.

The backend API routes, payloads, access roles, and delivery-proof upload format
are documented in [`backend/API.md`](./backend/API.md).

## Environment variables

`.env.example` lists the application settings:

| Variable | Purpose | Default |
|---|---|---|
| `API_PORT` | Express listening port | `3001` |
| `FRONTEND_ORIGIN` | Deployed browser origin; localhost is also allowed | `http://localhost:5173` |
| `DEMO_MODE` | Serve only public read-only demo API endpoints | `false` |
| `VITE_API_BASE_URL` | API prefix used by the frontend and Vite proxy | `/api` |
| `VITE_DEMO_MODE` | Show the no-login sample dashboard | `false` |
| `VITE_PUBLIC_CONTACT_EMAIL` | Address used to open contact-form email drafts | Not configured |
| `VITE_SUPABASE_URL` | Supabase project URL used in the browser | Required |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/publishable key used in the browser | Required |
| `SUPABASE_URL` | Supabase project URL used by the trusted API | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend-only key for profile RPC and approval operations | Required |

Keep `.env` local; it is ignored by Git. Never put private credentials or the
Supabase service-role key in frontend variables. The service-role key bypasses
RLS and must only be available to the backend.

### Supabase authentication setup (when demo mode is disabled)

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
   policies initially prevent direct client profile writes and limit reads to
   the owning account without deleting existing policies. Step 9 adds narrowly
   scoped self-registration inserts. SQL files in this repository are not
   active until explicitly run in Supabase.
4. Apply [`supabase/migrations/20261107210000_foodbridge_backend_security.sql`](./supabase/migrations/20261107210000_foodbridge_backend_security.sql)
   after confirming the read-only inspection output. It adds suspension state,
   backend-only transaction functions, and restrictive policies on the
   application tables. It intentionally does not alter Supabase-managed
   `storage.objects` or bucket settings, which require separate Storage
   configuration. Existing storage policies and buckets are left untouched.
   No database policy should be treated as active until this migration has
   succeeded in Supabase.
5. To temporarily skip signup email verification, open Supabase Dashboard →
   Authentication → Providers → Email and turn off **Confirm email**. Keep
   email/password sign-in enabled. The backend still requires a valid Supabase
   access token and enforces account roles and permissions. Allow the app origin
   and `/auth/callback` and `/reset-password` in the Supabase redirect URL
   configuration for local and deployed environments.
6. Apply [`supabase/migrations/20261107222000_foodbridge_dashboard_fields.sql`](./supabase/migrations/20261107222000_foodbridge_dashboard_fields.sql)
   to add the donor donation details and NGO matching preferences required by
   the dashboards. This migration adds columns and trusted transactional
   functions; it does not recreate or delete existing tables.
7. Apply [`supabase/migrations/20261107234000_admin_delivery_dashboard.sql`](./supabase/migrations/20261107234000_admin_delivery_dashboard.sql)
   to add review outcomes, delivery proof details, and persisted route
   checkpoints for the partner/admin dashboards.
8. Apply [`supabase/migrations/20261108130000_foodbridge_rescue_passport.sql`](./supabase/migrations/20261108130000_foodbridge_rescue_passport.sql)
   to add rescue outcome and escalation fields and donation timeline metadata.
9. Apply [`supabase/migrations/20261108140000_foodbridge_engagement_location.sql`](./supabase/migrations/20261108140000_foodbridge_engagement_location.sql)
   after the rescue-passport migration to add location and notification event
   fields plus the impact and rescue report functions used by the dashboards.
10. Apply [`supabase/migrations/20261108230000_foodbridge_self_activation.sql`](./supabase/migrations/20261108230000_foodbridge_self_activation.sql)
   to activate NGO and delivery partner accounts at registration and upgrade
   existing pending accounts. Rejected accounts remain rejected. Admin accounts
   still cannot be created through public registration.
11. Apply [`supabase/migrations/20261109120000_foodbridge_browser_profile_writes.sql`](./supabase/migrations/20261109120000_foodbridge_browser_profile_writes.sql)
   to allow authenticated users to insert only their own registration profile
   and matching role-specific row through restrictive RLS policies. It does not
   create triggers on Supabase-managed Auth tables. Users without a profile or
   saved registration details must register again or have details entered by an
   administrator.
12. Apply [`supabase/migrations/20261109123000_foodbridge_remove_signup_profile_trigger.sql`](./supabase/migrations/20261109123000_foodbridge_remove_signup_profile_trigger.sql)
    to remove the obsolete FoodBridge signup trigger if it was installed during
    earlier setup attempts. Run it from the Supabase SQL Editor with a database
    owner account; it does not change Supabase-managed Auth users or credentials.
13. Apply [`supabase/migrations/20261109131000_foodbridge_unique_ngo_profile_owner.sql`](./supabase/migrations/20261109131000_foodbridge_unique_ngo_profile_owner.sql)
    to prevent duplicate NGO profile rows for one account.
14. Apply [`supabase/migrations/20261109140000_foodbridge_fix_accept_donation_status.sql`](./supabase/migrations/20261109140000_foodbridge_fix_accept_donation_status.sql)
    to fix the PostgreSQL return-type mismatch in the NGO donation-acceptance
    function.
15. Apply [`supabase/migrations/20261109150000_foodbridge_fix_accept_assignment_status.sql`](./supabase/migrations/20261109150000_foodbridge_fix_accept_assignment_status.sql)
    to fix the PostgreSQL return-type mismatch in delivery-partner assignment
    acceptance.
16. Apply [`supabase/migrations/20261109153000_foodbridge_fix_delivery_stage_return_types.sql`](./supabase/migrations/20261109153000_foodbridge_fix_delivery_stage_return_types.sql)
    to fix return-type mismatches when delivery partners update pickup and
    journey checkpoints.
17. Apply [`supabase/migrations/20261109160000_foodbridge_fix_delivery_status_return_type.sql`](./supabase/migrations/20261109160000_foodbridge_fix_delivery_status_return_type.sql)
    to fix the PostgreSQL return-type mismatch when a delivery partner
    confirms the delivery after submitting proof.
18. Start the frontend and backend with `npm run dev`.

The registration handler uses the inspected schema: `profiles.id` is the auth
user UUID; contact details go in `profiles`; donor, NGO, and vehicle details go
in their existing subtype tables. The requested donor type has no column in the
existing schema, so it is kept as non-authoritative Supabase user metadata.
Registration metadata is stored with the Supabase Auth user and copied by the
authenticated browser into the role-specific tables under RLS policies that
bind inserts to the signed-in user and saved registration role. Passwords and
authentication credentials remain only in Supabase Auth. Authorization
continues to use the role stored in `profiles`, never user metadata.

Public registration only permits donor, NGO, and delivery partner roles. NGOs
and delivery partners become active immediately after registration; admins can
still suspend accounts through the protected dashboard. To provision an
initial admin, create the user in Supabase Auth, then run this in the trusted
Supabase SQL editor with that Auth user's UUID and email:

```sql
insert into public.profiles (id, full_name, email, phone, role)
values ('AUTH_USER_UUID', 'Administrator', 'ADMIN_EMAIL', null, 'admin')
on conflict (id) do update set role = 'admin';
```

Admins sign in at `/admin/login` or use the shared `/login` form; their database
role automatically routes them to the admin dashboard. There is intentionally
no public admin signup or role-change endpoint. Email
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

# FoodBridge API

The API is mounted at `/api`. Private routes require
`Authorization: Bearer <Supabase access token>` and a verified email. Roles are
loaded from `profiles` on the server; request bodies and user metadata never
grant a role. Suspended accounts are denied.

Paginated list routes accept `limit` (1–100, default 50) and `offset`
(default 0). IDs in paths must be UUIDs. JSON request bodies are validated;
errors use `{ "error": "..." }`.

## Authentication and profiles

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/auth/me` | Signed-in | Current Auth user and profile |
| POST | `/auth/complete-registration` | Verified | Complete a validated registration |
| GET | `/profile` | Signed-in | Current profile and role-specific details |
| PATCH | `/profile` | Signed-in | Update `full_name`/`phone` and permitted own subtype fields |

## Donations and NGOs

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/donations` | Donor | Create a future-expiring donation |
| GET | `/donations/eligible` | Verified NGO | Available, unexpired donations |
| GET | `/donations/mine` | Donor | Donor donation history |
| GET | `/donations/:donationId` | Donor, NGO, assigned partner, admin | Donation and status history, scoped to access |
| PATCH | `/donations/:donationId` | Donor | Edit own available donation |
| DELETE | `/donations/:donationId` | Donor | Cancel own available donation |
| GET | `/ngo/donations/matching` | Verified NGO | Pending matches for that NGO |
| POST | `/ngo/donations/:donationId/accept` | Verified NGO | Atomically accept a donation |
| POST | `/ngo/donations/:donationId/decline` | Verified NGO | Decline own pending match |
| GET | `/ngo/donations/accepted` | NGO | Accepted and in-progress donations |

## Delivery partners

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/partners/assignments/available` | Approved, available partner | Unassigned deliveries |
| GET | `/partners/assignments` | Approved partner | Own assignments |
| POST | `/partners/assignments/:assignmentId/accept` | Approved partner | Atomically claim an assignment |
| PATCH | `/partners/assignments/:assignmentId/status` | Assigned partner | Transition to `picked_up` or `delivered` |
| POST | `/partners/assignments/:assignmentId/proof` | Assigned partner | Upload raw JPEG/PNG/WebP bytes (maximum 5 MB) |
| GET | `/partners/proofs/:proofId/url` | Owning partner | Get a 60-second signed URL for private proof |

Upload proof before marking an assignment `delivered`. The proof bucket object
key, not a public URL, is stored in `delivery_proofs.proof_url`.

## Administration

All `/admin` routes require a verified, active profile whose database role is
`admin`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/approvals` | Pending NGO and partner approvals |
| POST | `/admin/approvals/:userId/approve` | Approve a pending account |
| GET | `/admin/users` | Paginated user list |
| PATCH | `/admin/users/:userId/suspension` | Set `{ "is_suspended": true/false }` |
| POST | `/admin/ngos/:userId/verify` | Verify an NGO |
| POST | `/admin/partners/:userId/verify` | Approve a delivery partner |
| GET | `/admin/donations` | Monitor donations |
| GET | `/admin/assignments` | Monitor assignments |
| GET | `/admin/rescue-requests` | List rescue requests |
| PATCH | `/admin/rescue-requests/:rescueId` | Update status and optional assigned partner |
| GET | `/admin/impact` | Global impact totals |

## Notifications and impact

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/notifications` | Signed-in | Current user's notifications |
| PATCH | `/notifications/:notificationId/read` | Signed-in | Mark own notification read |
| POST | `/notifications/read-all` | Signed-in | Mark all own notifications read |
| GET | `/impact` | Donor, NGO, approved partner, admin | Scoped food, meals, CO2, and donation totals |

Impact totals are queried from `impact_records`; they are not estimates
fabricated by the API.

## Supabase setup and security

Run these files in the Supabase SQL Editor, in order:

1. `supabase/migrations/20261107193000_foodbridge_auth.sql`
2. `supabase/migrations/20261107210000_foodbridge_backend_security.sql`

The second migration adds `profiles.is_suspended`, backend-only transaction
functions, and additive policies. It does not create, drop, or redefine
application tables. It sets the existing food/profile image buckets public
and delivery proof/NGO document buckets private, and applies 10 MB upload
limits (5 MB for delivery proof) plus allowed MIME types.
It preserves existing policies and adds restrictive guards. **Policies are not
active until the migrations have actually been run in Supabase.**

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are backend-only. Never set the
service-role key in any `VITE_` variable. The browser Supabase client uses only
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

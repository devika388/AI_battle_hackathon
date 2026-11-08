# FoodBridge API

The API is mounted at `/api`. Private routes require
`Authorization: Bearer <Supabase access token>` and a valid Supabase access token. Email confirmation is temporarily disabled;
the API still validates every access token. Roles are
loaded from `profiles` on the server; request bodies and user metadata never
grant a role. Suspended accounts are denied.

Paginated list routes accept `limit` (1–100, default 50) and `offset`
(default 0). IDs in paths must be UUIDs. JSON request bodies are validated;
errors use `{ "error": "..." }`.

## Authentication and profiles

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/auth/me` | Signed-in | Current Auth user and profile |
| POST | `/auth/complete-registration` | Signed-in | Complete a validated registration |
| GET | `/profile` | Signed-in | Current profile and role-specific details |
| PATCH | `/profile` | Signed-in | Update `full_name`/`phone` and permitted own subtype fields |

## Donations and NGOs

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/donations` | Donor | Create a future-expiring donation |
| GET | `/donations/eligible` | Verified NGO | Prepared donations with at least two hours before donor-provided expiry |
| GET | `/donations/mine` | Donor | Donor donation history |
| GET | `/donations/:donationId` | Donor, NGO, assigned partner, admin | Donation and status history, scoped to access |
| PATCH | `/donations/:donationId` | Donor | Edit own available donation |
| DELETE | `/donations/:donationId` | Donor | Cancel own available donation |
| GET | `/ngo/donations/matching` | Verified NGO | Prepared donations with at least two hours before donor-provided expiry |
| POST | `/ngo/donations/:donationId/accept` | Verified NGO | Atomically accept a donation |
| POST | `/ngo/donations/:donationId/decline` | Verified NGO | Decline own pending match |
| GET | `/ngo/donations/accepted` | Verified NGO | Accepted and in-progress donations |
| POST | `/ngo/assignments/:assignmentId/confirm-receipt` | Verified NGO | Confirm receipt of a delivered donation |

## Delivery partners

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/partners/assignments/available` | Approved, available partner | Unassigned deliveries |
| GET | `/partners/assignments` | Approved partner | Own assignments |
| POST | `/partners/assignments/:assignmentId/accept` | Approved partner | Atomically claim an assignment after providing `{ "estimated_duration_minutes": 1..720 }` |
| PATCH | `/partners/assignments/:assignmentId/status` | Assigned partner | Mark a proof-backed delivery as delivered |
| PATCH | `/partners/assignments/:assignmentId/stage` | Approved assigned partner | Advance one validated pickup/transit checkpoint |
| POST | `/partners/assignments/:assignmentId/proof` | Assigned partner | Upload raw JPEG/PNG/WebP bytes (maximum 5 MB) |
| GET | `/partners/proofs/:proofId/url` | Owning partner | Get a 60-second signed URL for private proof |

The checkpoint sequence is pickup pending → pickup started → pickup confirmed
→ in transit → arrived. Upload proof at arrival with `X-Receiver-Name`,
`X-Delivered-At`, and optional `X-Proof-Notes` headers before marking the
assignment delivered. The proof bucket object key, not a public URL, is stored
in `delivery_proofs.proof_url`. The NGO is notified on delivery and must confirm
receipt before the assignment becomes completed.

## Community Rescue Mode and Food Passport

The backend runs a rescue scan at startup and every five minutes. Admins may
also run it from Rescue Management. The scan considers unaccepted donations
approaching their donor-provided expiry, records an auditable rescue request,
and notifies verified, active NGOs in the same city whose declared category
and capacity preferences match. Further eligible NGOs are notified in batches
after 15 minutes; reminders follow every 30 minutes. NGOs still need to accept
donations themselves, and delivery partners still need to accept an actual
assignment. The scan never creates a synthetic delivery assignment.

Expired donations, missing/future preparation times, and windows under two
hours are blocked. City is only a location proxy; FoodBridge does not infer a route or ETA and
does not certify food safety. Assignments require NGO/partner acceptance, an available preparation time,
at least two hours before the donor-provided expiry, and a partner-provided
travel estimate plus a 30-minute handoff buffer that fits before expiry. The
estimate is operational input, not a FoodBridge route guarantee. NGO
acceptance creates the normal donation assignment; Community Rescue Mode
doesn't bypass recipient or partner acceptance. Rescue outcomes can only be
marked rescued after the NGO confirms receipt; blocked outcomes require
resolution notes.

Every donation's `/donations/:donationId` response includes its append-only
`status_events` timeline, with timestamps, descriptions, responsible users,
and recorded locations where available. Donors, accepted NGOs, assigned
partners, and admins receive role-scoped access. The Food Passport in each
dashboard distinguishes recorded history from pending journey stages.

## Administration

All `/admin` routes require an active profile whose database role is
`admin`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/approvals` | Pending NGO and partner approvals |
| POST | `/admin/approvals/:userId/approve` | Approve a pending account |
| GET | `/admin/users` | Paginated user list |
| PATCH | `/admin/users/:userId/suspension` | Set `{ "is_suspended": true/false }` |
| POST | `/admin/ngos/:userId/verify` | Verify an NGO |
| POST | `/admin/partners/:userId/verify` | Approve a delivery partner |
| POST | `/admin/ngos/:userId/reject` | Reject NGO verification with a reason |
| POST | `/admin/partners/:userId/reject` | Reject partner verification with a reason |
| GET | `/admin/donations` | Monitor donations |
| GET | `/admin/assignments` | Monitor assignments |
| GET | `/admin/rescue-requests` | List rescue requests |
| POST | `/admin/rescue-requests/scan` | Escalate eligible, unaccepted donations and notify suitable NGOs |
| PATCH | `/admin/rescue-requests/:rescueId` | Record a verified assignment or a final rescued/blocked outcome |
| GET | `/admin/impact` | Global impact totals |
| GET | `/admin/reports` | Actual database totals and analytics series |

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
3. `supabase/migrations/20261107222000_foodbridge_dashboard_fields.sql`
4. `supabase/migrations/20261107234000_admin_delivery_dashboard.sql`
5. `supabase/migrations/20261108130000_foodbridge_rescue_passport.sql`

The second migration adds `profiles.is_suspended`, backend-only transaction
functions, and additive policies. It does not create, drop, or redefine
application tables. It sets the existing food/profile image buckets public
and delivery proof/NGO document buckets private, and applies 10 MB upload
limits (5 MB for delivery proof) plus allowed MIME types.
It preserves existing policies and adds restrictive guards. **Policies are not
active until the migrations have actually been run in Supabase.**

The third migration adds donation preparation time, city, and pincode fields,
NGO category and capacity preferences, and the trusted functions used to
create donations, decline available donations, and confirm NGO receipt. NGO
available-donation matching is a transparent rules-based score; city is used
as a location proxy because the schema has no map coordinates. Declined
donations are hidden from that NGO's subsequent available list.

The fourth migration adds verification review status/notes, private delivery
proof receiver names, persisted delivery checkpoints, and the trusted stage
transition function. It also synchronizes completed statuses and notifies the
assigned NGO when a partner marks a delivery delivered. Review this additive
migration and apply it before using the partner/admin dashboards.

The fifth migration adds rescue escalation/outcome metadata and timeline
responsible-user/location fields. It also enforces donor-provided preparation
and minimum handling-window checks when NGOs accept a donation or a partner
claims its delivery assignment.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are backend-only. Never set the
service-role key in any `VITE_` variable. The browser Supabase client uses only
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

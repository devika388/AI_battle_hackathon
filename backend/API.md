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
| PATCH | `/profile` | Signed-in | Update `full_name`/`phone`, permitted own subtype fields, and optional NGO map coordinates |

## Donations and NGOs

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/donations` | Donor | Create a future-expiring donation; optional pickup coordinates must be supplied as a valid latitude/longitude pair |
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
| GET | `/notifications` | Signed-in | Current user's notifications and unread count |
| PATCH | `/notifications/:notificationId/read` | Signed-in | Mark own notification read |
| POST | `/notifications/read-all` | Signed-in | Mark all own notifications read |
| GET | `/impact` | Donor, NGO, approved partner, admin | Scoped confirmed impact totals, chart/report records, and rescue outcomes |

Impact totals and reports only include `impact_records` for completed donations
whose NGO receipt was confirmed. CO2 is explicitly an estimate copied from
`impact_records.co2_saved_kg`; FoodBridge applies no conversion factor or
independent certification. The CSV download in the dashboard contains only the
current account's authorized records.

The shared dashboard header polls notifications every 30 seconds and on window
focus. Database events are deduplicated by event key, and notification API
queries always filter by the signed-in user ID.

## Maps and location

Maps use Leaflet and OpenStreetMap. Donors may explicitly enter a pickup
latitude/longitude pair when creating a donation; verified NGOs may save their
organization coordinates in Profile. Coordinates are optional and validated
against geographic ranges. FoodBridge does not geocode addresses or infer
coordinates. If coordinates are missing, the UI shows the saved address and an
OpenStreetMap address-search link instead of a fabricated pin.

NGOs can discover donations within a selected straight-line radius when both
their own and the donation's coordinates are present. Delivery partner maps
show saved pickup/destination coordinates and a dashed straight-line visual
when possible; this is not a road route or ETA guarantee. Saved addresses
remain visible when coordinates are unavailable.

## Supabase setup and security

Run these files in the Supabase SQL Editor, in order:

1. `supabase/migrations/20261107193000_foodbridge_auth.sql`
2. `supabase/migrations/20261107210000_foodbridge_backend_security.sql`
3. `supabase/migrations/20261107222000_foodbridge_dashboard_fields.sql`
4. `supabase/migrations/20261107234000_admin_delivery_dashboard.sql`
5. `supabase/migrations/20261108130000_foodbridge_rescue_passport.sql`
6. `supabase/migrations/20261108140000_foodbridge_engagement_location.sql`

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
available-donation matching is a transparent rules-based score and uses city
for matching; optional saved coordinates power map and radius features. Declined
donations are hidden from that NGO's subsequent available list.

The fourth migration adds verification review status/notes, private delivery
proof receiver names, persisted delivery checkpoints, and the trusted stage
transition function. It also synchronizes completed statuses and initially
notifies the assigned NGO on delivery. The sixth migration replaces that
notification hook with deduplicated, role-targeted event notifications.

The fifth migration adds rescue escalation/outcome metadata and timeline
responsible-user/location fields. It also enforces donor-provided preparation
and minimum handling-window checks when NGOs accept a donation or a partner
claims its delivery assignment.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are backend-only. Never set the
service-role key in any `VITE_` variable. The browser Supabase client uses only
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

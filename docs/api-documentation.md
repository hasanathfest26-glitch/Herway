# API Documentation — Herway Backend (`v1`)

Base URL: `/api/v1`  
Authentication: `Authorization: Bearer <token>` (Supabase JWT or platform token), except public tracking endpoints.

## 1. Auth (`/auth`)
- `POST /auth/register` — Register unified account (Email/Password or Supabase token) and initial role preferences.
- `POST /auth/login` — Authenticate and return access token + user profile + active roles.
- `GET /auth/me` — Retrieve authenticated user profile, roles, and verification status.

## 2. Users & Profile (`/users`)
- `PATCH /users/me` — Update profile details, languages, interests, bio, homeCity.
- `POST /users/me/roles` — Request/enable additional role (`TRAVELLER`, `TRAVEL_BUDDY`, `LOCAL_GUARDIAN`, `SAFE_HAVEN_PARTNER`).
- `POST /users/me/favourites/:targetUserId` — Toggle favourite Travel Buddy / Traveller.
- `POST /users/me/safety-action` — Block or report a user (`BLOCK | REPORT` with reason).

## 3. Verification (`/verification`)
- `POST /verification/apply` — Submit verification application (Buddy 18+ selfie + ID, Guardian credentials, or Safe Haven licence).
- `GET /verification/me` — Get current user's verification applications and statuses.
- `GET /verification/pending` — (Admin) List pending applications.
- `PATCH /verification/:id/review` — (Admin) Approve or reject application with review notes.

## 4. People Discovery & Travel Buddies (`/buddies`)
- `GET /buddies/discover/travellers` — Discover **Nearby Travellers** (`lat`, `lng`, `radiusKm`, `startDate`, `endDate`, `language`, `interest`). Excludes blocked users; returns approximate distance only.
- `GET /buddies/discover/buddies` — Discover **Nearby Travel Buddies** (`lat`, `lng`, `radiusKm`, `language`, `interest`, `minRating`, `availableOnly`).
- `PUT /buddies/profile` — Create/update Travel Buddy profile, services, hourly rate, and availability schedule.
- `GET /buddies/:userId` — View verified Travel Buddy public profile and reviews.

## 5. Bookings & In-App Chat (`/bookings`)
- `POST /bookings` — Create booking request for a Travel Buddy with date/time and suggested public meeting point.
- `GET /bookings` — List user's bookings (as Traveller or Buddy).
- `PATCH /bookings/:id/respond` — Buddy accepts or rejects request.
- `PATCH /bookings/:id/confirm` — Confirm booking with verified public meeting point.
- `PATCH /bookings/:id/cancel` — Cancel booking with reason.
- `PATCH /bookings/:id/complete` — Mark activity completed.
- `POST /bookings/:id/reviews` — Submit rating and review after completion.
- `GET /bookings/:id/messages` — Retrieve privacy-safe in-app chat history.
- `POST /bookings/:id/messages` — Send in-app chat message (phone numbers masked/blocked).

## 6. Trips, Check-Ins & Offline Safety Pack (`/trips`)
- `POST /trips` — Create trip with destination, dates, accommodation, transport, and planned stops.
- `GET /trips` — List user's trips.
- `GET /trips/:id` — Get full trip itinerary & check-ins.
- `PATCH /trips/:id` — Update trip status or itinerary details.
- `GET /trips/:id/offline-pack` — Bundle active trip, itinerary, stops, nearby Safe Havens, and emergency numbers (`112`, `181`, `100`, `108`) with `lastUpdatedAt`.
- `POST /trips/:id/check-ins` — Schedule a journey check-in with `scheduledAt` and `graceMinutes`.
- `POST /trips/check-ins/:checkInId/confirm` — Confirm safe arrival / check-in.

## 7. Trusted Contacts (`/contacts`)
- `GET /contacts` — List user's Trusted Contacts.
- `POST /contacts` — Add Trusted Contact with granular notification/location/SOS flags.
- `PATCH /contacts/:id` — Update contact details or permission flags.
- `DELETE /contacts/:id` — Remove Trusted Contact.

## 8. Live Location Sharing (`/locations`)
- `POST /locations/shares` — Create private, expiring share session (`durationMinutes`, `allowedContactIds`, `tripId`) returning browser URL `/track/<token>`.
- `GET /locations/shares` — List user's active/recent share sessions.
- `POST /locations/ping` — Update Traveller's latest coordinates (also emitted over WebSocket).
- `PATCH /locations/shares/:id/state` — Pause, resume, stop, or revoke live sharing immediately.
- `GET /locations/public/:token` — **Public (No Auth)**: View latest available location, expiry, and active/paused status for a valid share token.

## 9. Local Guardians (`/guardians`)
- `PUT /guardians/profile` — Update Guardian profile, service radius, languages, and on-duty toggle.
- `GET /guardians/nearby` — Find verified, on-duty Local Guardians near coordinates.
- `POST /guardians/requests` — Request Local Guardian language/coordination assistance.
- `PATCH /guardians/requests/:id/respond` — Guardian accepts or declines assistance request.

## 10. Safe Haven Partner Network (`/safe-havens`)
- `POST /safe-havens/register` — Submit establishment for Safe Haven verification.
- `GET /safe-havens/nearby` — Discover verified Safe Havens near `lat`/`lng` (separate from ordinary Google Maps places).
- `GET /safe-havens/partner/mine` — (Partner) View own Safe Haven establishments.
- `PATCH /safe-havens/:id/partner` — (Partner) Update hours, services, contact info, and participation status.
- `GET /safe-havens/admin/all` — (Admin) List all Safe Haven applications & partners.
- `PATCH /safe-havens/:id/approve` — (Admin) Approve, reject, or suspend Safe Haven and grant/revoke `verifiedBadge`.

## 11. SOS & Emergency (`/emergency`)
- `POST /emergency/sos` — Trigger SOS alert: notifies selected SOS Trusted Contacts, shares latest location & active trip summary, optionally alerts nearby Local Guardians, and returns emergency numbers (`112`).
- `GET /emergency/sos/active` — Get user's active SOS incident & per-recipient delivery/acknowledgement statuses.
- `POST /emergency/sos/:id/acknowledge` — Mark delivery acknowledged by recipient/Guardian/Admin.
- `PATCH /emergency/sos/:id/resolve` — Mark SOS resolved by Traveller or Admin.
- `GET /emergency/numbers` — Get validated regional emergency numbers (India/Kerala: `112`, `181`, `100`, `108`).
- `GET /emergency/admin/incidents` — (Admin) Monitor active and historical SOS incidents.

## 12. Travel Document Vault (`/documents` — inside users/documents controller)
- `GET /documents` — List encrypted document metadata owned by authenticated user.
- `POST /documents` — Register/upload encrypted travel document metadata & private storage path.
- `GET /documents/:id/download-url` — Issue short-lived private signed URL strictly for owning user.
- `PUT /documents/:id` — Replace document metadata/file.
- `DELETE /documents/:id` — Permanently delete document.

## 13. Notifications (`/notifications`)
- `GET /notifications` — List user's notifications.
- `PATCH /notifications/:id/read` — Mark notification as read.
- `POST /notifications/device-token` — Register FCM device token.

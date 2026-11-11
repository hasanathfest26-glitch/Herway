# Product Requirements Document (PRD) — Herway Travel Safety & Assistance Platform

## 1. Product Vision & Scope
Herway is a women-focused travel safety and assistance platform designed to help women travel more safely, confidently, and independently by combining travel planning, people discovery, verified companionship, and coordinated safety support in one mobile application, backed by a web Admin Dashboard and Safe Haven Partner Portal.

### Initial Pilot Geography
- **Phase 1 Pilot**: Kochi, Kerala, India
- **Phase 2 Expansion**: Kozhikode, Munnar, Wayanad (Kerala)

## 2. User Roles & Verification Model
Every user creates a single unified account and chooses how to participate:
1. **Traveller**: Plans trips, discovers nearby Travellers and Travel Buddies, manages trusted contacts, shares live location links, configures journey check-ins, triggers SOS, caches offline safety packs, and stores encrypted travel documents.
2. **Travel Buddy**: Verified women aged 18+ who capture a real-time in-app selfie, complete identity & age eligibility verification, list services and languages, manage availability slots, accept/reject booking requests, set public meeting points, chat without exposing phone numbers, and exchange ratings/reviews.
   - *Rule*: A Travel Buddy does **not** automatically become a Local Guardian.
3. **Local Guardian**: Separately vetted and verified local responders who provide local guidance, translation/communication assistance, contact nearby emergency/support services, and coordinate help when a Traveller requests assistance.
4. **Safe Haven Partner**: Approved physical establishments (hotels, hostels, hospitals, clinics, pharmacies, tourist assistance centres) that voluntarily register, verify identity/location/licences, and commit to documented assistance responsibilities.
5. **Administrator**: Platform safety & operations team reviewing Buddy/Guardian verifications, Safe Haven approvals, bookings, user reports, complaints/disputes, emergency incidents, notifications, and audit logs.

## 3. Functional Requirements

### 3.1 Mobile Application Navigation (5 Tabs + Persistent SOS)
- **Home**: Safety dashboard, active trip summary, upcoming check-in status, quick live-location toggle, important alerts/notifications, and prominent SOS access.
- **Explore**: Destinations, Google Maps nearby services, verified Safe Haven establishments (with Safe Haven badge) clearly separated from ordinary unverified map places, directions via Google Maps.
- **People**: Two distinct discovery categories — **Nearby Travellers** and **Nearby Travel Buddies** — filterable by location, distance, travel dates, languages, interests, availability, and ratings.
- **Bookings**: Booking requests, confirmed activities, public meeting point selection, cancellation management, post-activity reviews/ratings, favourites, and privacy-preserving in-app chat.
- **Profile**: Personal profile, role toggles & verification status, Trusted Contacts Management, encrypted Travel Document Vault, Offline Safety Pack management, block/report lists, and privacy/notification settings.
- **Persistent SOS**: Easily reachable across all primary screens.

### 3.2 Journey Planning & Offline Safety Information
- Trips include destination, start/end dates, accommodation details, transport details, planned stops, and itinerary items.
- Offline Safety Pack caches active trip details, itinerary, accommodation, planned stops, nearby verified Safe Havens, local emergency numbers (including India `112`), and safety guidance locally with an explicit `lastUpdatedAt` timestamp.

### 3.3 Trusted Contacts, Live Location Sharing & Check-Ins
- **Trusted Contacts**: Add/edit/remove family or friends with independent per-contact permissions: `canReceiveTripUpdates`, `canViewLocation`, `canReceiveCheckIns`, `canReceiveSos`.
- **Live Location Sharing**: Generates private, expiring, revocable tracking URLs shareable via WhatsApp, SMS, or Telegram. Recipients open the link in a standard web browser on Google Maps without installing the app or creating an account. Traveller controls duration and can pause, resume, stop, or revoke at any time.
- **Scheduled Journey Check-Ins**: Scheduled reminders + safe-arrival confirmation. Missed check-ins follow a staged escalation workflow (soft reminder -> grace period -> notify designated check-in contacts) without immediately assuming a critical emergency on a single missed prompt.

### 3.4 SOS & Emergency Coordination
- Alerts selected SOS Trusted Contacts with latest available coordinates and active trip summary.
- Displays local emergency numbers (including India `112`, Women Helpline `181`, Police `100`, Ambulance `108` — subject to validated regional dialling/integration checks).
- Optionally dispatches a Local Guardian assistance request.
- Tracks alert lifecycle states (`SENT`, `DELIVERED`, `ACKNOWLEDGED`, `RESOLVED`).
- **Safety Invariant**: Emergency response and contact alerting **never** depend solely on a Local Guardian accepting a request.

### 3.5 Travel Document Vault
- Optional upload, view, replace, and delete for passports, visas, government IDs, tickets, accommodation bookings, and travel insurance.
- Stored in private Supabase Storage with per-user authorization and envelope encryption metadata; never shared publicly or exposed to other users.

### 3.6 Privacy, Safety & Compliance Principles (India / DPDP Act Alignment)
- Exact live coordinates are never broadcast publicly; discovery endpoints expose coarse/approximated distance only.
- All tracking links have mandatory TTL expiration and instant revocation.
- Identity and verification documents remain strictly private to the user and authorised verification reviewers.
- In-app chat masks personal phone numbers and contact identifiers.
- Every user has one-tap Report and Block controls.
- Explicit purpose-based consent for location sharing, emergency contacts, and document storage.

## 4. Staged Delivery Roadmap
1. **Stage 1**: Registration, login, profiles, unified role management & verification workflows.
2. **Stage 2**: People discovery (Nearby Travellers & Travel Buddies) and Buddy bookings + in-app chat.
3. **Stage 3**: Trip planning, Trusted Contacts, scheduled check-ins & revocable live location sharing.
4. **Stage 4**: Local Guardian assistance, Safe Haven Partner Network & SOS emergency system.
5. **Stage 5**: Offline Safety Information, Travel Document Vault, Admin Dashboard, Partner Portal, security hardening & Kerala pilot launch.

# System Architecture — Herway

## 1. High-Level Topology

```
+-----------------------+      HTTPS / WSS       +-------------------------+
|   Mobile App (Expo)   |<--------------------->|     NestJS API & WS     |
|  React Native + TS    |                        |  Modular Monolith + DI  |
+-----------------------+                        +------------+------------+
                                                              |
+-----------------------+      HTTPS / WSS                    |
|   Next.js Web App     |<------------------------------------+
| - Admin Dashboard     |                        |
| - Partner Portal      |         +--------------+--------------+
| - /track/[token] Web  |         |              |              |
+-----------------------+         v              v              v
                          +------------+  +------------+  +------------+
                          | PostgreSQL |  |   Redis    |  |  Supabase  |
                          |  + PostGIS |  |  + BullMQ  |  | Auth/Store |
                          +------------+  +------------+  +------------+
                                                                |
                          +------------+  +------------+        |
                          |Google Maps |  |    FCM     |<-------+
                          |  Platform  |  |Push Notifs |
                          +------------+  +------------+
```

## 2. Component Responsibilities

### 2.1 Mobile Application (`mobile/`)
- **Framework**: React Native with Expo & Expo Router (5-tab root layout + auth/modal stacks).
- **Real-time**: Socket.IO client connecting to NestJS `/realtime` gateway for chat messages, live location telemetry, and SOS acknowledgements.
- **Offline Resilience**: Local offline safety snapshot (`services/offlineCache.ts`) backed by `AsyncStorage` storing active trip itineraries, accommodation/transport notes, nearby approved Safe Havens, and regional emergency numbers with `lastUpdatedAt` metadata.
- **Privacy Controls**: Live selfie camera capture via `expo-camera` / `expo-image-picker` for Buddy verification; zero phone number display in booking chat.

### 2.2 Backend (`backend/`)
- **Framework**: NestJS + TypeScript + Prisma ORM.
- **Database**: PostgreSQL with PostGIS (`geography(Point, 4326)`) for geospatial radius queries (`ST_DWithin`, `ST_Distance`) across Travellers, Travel Buddies, Local Guardians, and Safe Havens.
- **Authentication**: Supabase Auth JWT verification guard with unified account claims and role-based access control (`TRAVELLER`, `TRAVEL_BUDDY`, `LOCAL_GUARDIAN`, `SAFE_HAVEN_PARTNER`, `ADMIN`).
- **Background Jobs (Redis + BullMQ)**:
  - `checkins` queue: schedules reminder jobs (`T - 15m`), check-in due prompts (`T`), and gentle escalation (`T + graceMinutes`) without immediately triggering an SOS.
  - `location-expiry` queue: automatically expires and marks tracking links inactive when `expiresAt` passes.
  - `notifications` queue: dispatches FCM push notifications and persists in-app notification records.
- **WebSockets**:
  - Live location streaming from Traveller device to active authorized tracking rooms (`shareToken`) and SOS incident monitors.
  - Real-time booking chat rooms (`bookingId`) with participant validation and block enforcement.

### 2.3 Web Portal (`admin/`)
- **Framework**: Next.js (App Router) + Tailwind CSS.
- **Three Integrated Surfaces**:
  1. **Admin Dashboard (`/admin`)**: User management, Travel Buddy & Local Guardian verification queue, Safe Haven Partner approval queue, bookings & disputes, user safety reports, live SOS incident monitor, notifications broadcast, and audit logs.
  2. **Safe Haven Partner Portal (`/partner`)**: Self-service management for approved establishments to update facility metadata, operating hours, assistance services, emergency phone lines, and active participation status.
  3. **Public Live Location Tracking (`/track/[token]`)**: Zero-auth, browser-friendly live tracking view backed by revocable token API, displaying latest position on Google Maps, active/paused/expired status, and trip safety context.

## 3. Security & Privacy Architecture
- **Location Privacy**: Public/discovery queries round or bucket coordinates and return distance bands rather than exact street coordinates. Exact coordinates are only emitted to active `LocationShareSession` token holders (while unpaused & unexpired) and active `SosIncident` responders.
- **Document Vault Security**: Files reside in private Supabase Storage buckets; database stores encrypted file keys/metadata using AES-256-GCM envelope encryption (`DOCUMENT_ENCRYPTION_KEY`) and issues short-lived signed URLs solely to the owning `userId`.
- **Role Separation**: `VerificationApplication` tracks separate approval state machines for `TRAVEL_BUDDY`, `LOCAL_GUARDIAN`, and `SAFE_HAVEN_PARTNER` so becoming a Buddy never implicitly grants Guardian privileges.

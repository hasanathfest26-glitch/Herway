# Herway — Women-Focused Travel Safety & Assistance Platform

Herway brings travel planning, companionship, people discovery, and coordinated safety assistance into one connected platform—helping women travel more safely, confidently, and independently.

## Pilot Region
Initially designed for pilot deployment in **Kerala, India** (starting in **Kochi**, expanding to **Kozhikode**, **Munnar**, and **Wayanad**).

## Repository Structure

```
Herway/ (travel-safety-platform)
├── mobile/                 # React Native + Expo (Android & iOS Traveller/Buddy/Guardian app)
├── backend/                # NestJS + Prisma (PostgreSQL/PostGIS, WebSockets, BullMQ, Supabase)
├── admin/                  # Next.js (Admin Dashboard, Safe Haven Partner Portal, Public Tracking Web)
├── docs/                   # Product requirements, architecture, DB schema, API docs
└── docker-compose.yml      # Local PostGIS + Redis stack
```

## Core Capabilities

1. **Unified Account & Role Verification**: Register once via Supabase Auth and operate as a Traveller, Travel Buddy (18+ women, real-time selfie & ID verification), or separate Local Guardian.
2. **People Discovery & Travel Buddy Bookings**: Separate discovery for *Nearby Travellers* and *Nearby Travel Buddies* with location, distance, dates, languages, interests, availability, and rating filters; privacy-preserving in-app chat (no phone number exposure), public meeting points, cancellations, reviews, favourites, and block/report controls.
3. **Trips, Itineraries & Offline Safety Cache**: Plan trips with destinations, accommodation, transport, and planned stops; cache active trip details, emergency numbers (including India `112`), and nearby Safe Havens locally for offline access with clear `lastUpdatedAt` timestamps.
4. **Trusted Contacts & Live Location Sharing**: Per-contact permissions (trip updates, location access, check-ins, SOS alerts) and private, expiring, revocable browser-based tracking links viewable on Google Maps without installing the app.
5. **Scheduled Journey Check-Ins & Safe Arrival**: Redis/BullMQ-backed check-in reminders and gradual escalation workflows that do not immediately assume an emergency on a single missed check-in.
6. **Local Guardian Assistance & Safe Haven Partner Network**: Verified Local Guardians for local coordination and language assistance, alongside admin-approved Safe Haven establishments (hotels, hostels, hospitals, clinics, pharmacies, tourist assistance centres) distinguished from unverified Google Maps places by a verified Safe Haven badge.
7. **SOS & Emergency Response**: Always-accessible SOS alerting selected contacts, sharing latest location & trip context, displaying local emergency numbers (`112`), requesting Guardian support, and tracking sent/delivered/acknowledged states—never solely dependent on a Guardian accepting.
8. **Encrypted Travel Document Vault**: Optional storage for passports, visas, IDs, tickets, accommodation bookings, and travel insurance in private Supabase Storage with per-user access restrictions and AES-256-GCM envelope encryption metadata.

## Quick Start

1. Copy `.env.example` to `.env` and fill in Supabase, Google Maps, Redis, and Postgres values (or start local DB/Redis via `docker compose up -d`).
2. **Backend**:
   ```bash
   cd backend
   npm install
   npx prisma generate
   npm run start:dev
   ```
3. **Admin, Partner Portal & Public Tracking Web**:
   ```bash
   cd admin
   npm install
   npm run dev
   ```
4. **Mobile (Expo)**:
   ```bash
   cd mobile
   npm install
   npx expo start
   ```

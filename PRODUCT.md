# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

- **Primary users — Women Travellers**: Solo and small-group women travellers navigating pilot cities in Kerala, India (`Kochi`, `Munnar`, `Kozhikode`, `Wayanad`), using Herway on mobile while in transit and on desktop web while planning trips or managing safety documents.
- **Verified Travel Buddies (18+ Women)**: Age-verified, live-selfie vetted women companions offering local orientation, public-meetup walks, and language support.
- **Local Guardians (Separate Role)**: Vetted on-duty local coordinators providing transit, hospital, and language assistance (emergency response never depends solely on a Guardian accepting).
- **Safe Haven Partners & Admins**: Physical establishments (hotels, hostels, hospitals, clinics, pharmacies, tourist assistance centres) and operations admins managed via the Next.js console (`admin/`).

## Product Purpose

Herway brings trip planning, verified companionship, Safe Haven discovery, live location sharing, scheduled journey check-ins, and 112/1515 emergency response into one connected safety platform so women can travel independently with confidence.

## Positioning

Unlike generic map or travel-booking apps, Herway enforces verified Safe Haven differentiation (explicitly distinguishing admin-approved Safe Havens from ordinary Google Maps places), 18+ live-selfie Travel Buddy vetting, automatic phone-number masking in private booking chat, gradual check-in escalation, and an offline-capable Kerala safety pack (`112`, `1515`, cached itinerary & Safe Havens).

## Operating Context

- **Mobile (iOS / Android / Mobile Web `< 820px`)**: On-the-go one-handed usage during travel; bottom tab navigation, persistent SOS access, quick check-in confirmation, offline safety pack, and Mint-Teal-Cream onboarding flow.
- **Desktop Web App (`>= 820px`)**: Trip planning, companion comparison, booking management, and profile/vault administration via a horizontal top app navbar, full-width multi-column workspace grids, and a split detail drawer (never stretched mobile phone chrome).
- **Admin & Partner Web (`admin/`)**: Next.js operations console (`localhost:3000`) backed by NestJS + Prisma + PostGIS + BullMQ (`backend/`, `localhost:3001/api/v1`).

## Capabilities and Constraints

- 6-step onboarding flow: 3-slide Intro -> Log in / Sign up -> Choose Language -> Verify Account (Email/Phone OTP) -> Create Basic Profile -> Select Role (`Traveller`, `Travel Buddy`, or `Both`).
- Privacy & DPDP constraints: no personal phone number exposure in companion discovery or booking chat; expiring, revocable browser-based live tracking links; encrypted Travel Document Vault.
- Safety constraint: SOS alerts always notify selected Trusted Contacts and provide direct OS dialing (`112`, `181`, `1515`, `100`, `108`) without depending solely on Guardian availability.

## Brand Commitments

- **Color Identity**: Mint-Teal-Cream visual world (`#00B6C7` primary teal, `#C5EFF2` soft mint surface, `#D3F3F5` -> `#FAF9F4` mint-cream canvas, `#F5F4EE` warm input surface, `#131A20` ink, `#646F78` muted text).
- **Platform Separation**: Dedicated native-feeling mobile UI on phones (`width < 820`) and dedicated desktop web app UI on PC (`width >= 820`) sharing the same underlying Herway data and APIs.

## Evidence on Hand

- Real Kerala pilot catalog (`mobile/data/herwayCatalog.ts`), offline pack (`mobile/services/offlineCache.ts`), and full NestJS backend + Prisma schema (`backend/`).
- Local development runs cleanly offline/without local Postgres via local session fallback while preserving live API calls when connected.

## Product Principles

1. **Safety never blocks on a single responder**: Offline emergency numbers, Trusted Contacts, and SOS work independently of Guardian acceptance.
2. **Privacy by default**: Phone numbers stay masked, location links are expiring and revocable, and Travel Documents stay private to the owner.
3. **Device-native ergonomics**: Mobile feels like a crisp phone app; Desktop feels like a true desktop web app with horizontal top navigation, multi-column grids, and split detail drawers.
4. **Verified truth over generic listings**: Admin-approved Safe Havens and 18+ vetted Travel Buddies are visibly separated from unverified public places.

## Accessibility & Inclusion

- High-contrast text (`#131A20` on `#FAF9F4`/`#FFFFFF`), 44px+ touch targets on mobile, keyboard-accessible controls and hover states on desktop web, and multilingual support (`English`, `Malayalam`, `Hindi`, `Tamil`, and international languages).

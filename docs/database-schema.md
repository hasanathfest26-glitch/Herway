# Database Schema — Herway (PostgreSQL + PostGIS + Prisma)

## 1. Extensions & Spatial Strategy
- Requires PostgreSQL 15+ with `postgis` and `pgcrypto` extensions enabled.
- Spatial entities (`UserLocationSnapshot`, `TravelBuddyProfile`, `LocalGuardianProfile`, `SafeHaven`) store `latitude` and `longitude` (`Float`) alongside indexed PostGIS `geography(Point, 4326)` columns managed via SQL migrations for sub-second `ST_DWithin` radius filtering in Kochi, Kozhikode, Munnar, and Wayanad.

## 2. Core Entities & Relationships

### 2.1 Identity, Roles & Verification
- **`User`**: Unified account (`id`, `supabaseAuthId`, `email`, `fullName`, `phoneEncrypted`, `dateOfBirth`, `gender`, `bio`, `languages[]`, `interests[]`, `homeCity`, `roles[]`, `status`, `avatarUrl`, `createdAt`, `updatedAt`).
- **`VerificationApplication`**: Separate review records per role (`role`: `TRAVEL_BUDDY | LOCAL_GUARDIAN | SAFE_HAVEN_PARTNER`), capturing `liveSelfieStoragePath`, `idDocumentStoragePath`, `ageVerified18Plus`, `licenceReference`, `status` (`PENDING | UNDER_REVIEW | APPROVED | REJECTED`), `reviewerId`, `reviewNotes`, `reviewedAt`.

### 2.2 People Discovery, Buddies & Bookings
- **`TravelBuddyProfile`**: `userId`, `headline`, `servicesOffered[]`, `languages[]`, `hourlyRateInr`, `isAvailable`, `availabilityScheduleJson`, `baseLatitude`, `baseLongitude`, `city`, `ratingAverage`, `reviewCount`, `verifiedAt`.
- **`BuddyBooking`**: `travellerId`, `buddyId`, `status` (`REQUESTED | ACCEPTED | REJECTED | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED`), `startAt`, `endAt`, `meetingPointName`, `meetingPointLat`, `meetingPointLng`, `isPublicMeetingPoint`, `cancellationReason`, `cancelledById`.
- **`BookingMessage`**: `bookingId`, `senderId`, `body` (sanitized to prevent phone-number leakage or flagged if needed), `createdAt`.
- **`BuddyReview`**: `bookingId`, `reviewerId`, `buddyUserId`, `rating` (1–5), `comment`, `safetyScore` (1–5).
- **`UserFavourite`** & **`UserBlockReport`**: Favourites (`userId`, `targetUserId`) and safety controls (`reporterId`, `targetUserId`, `type`: `BLOCK | REPORT`, `reason`, `status`).

### 2.3 Trips, Check-Ins & Offline Pack
- **`Trip`**: `userId`, `title`, `destinationCity`, `region` (e.g., `Kochi`, `Munnar`, `Wayanad`, `Kozhikode`), `startDate`, `endDate`, `accommodationJson`, `transportJson`, `status` (`PLANNED | ACTIVE | COMPLETED | CANCELLED`).
- **`TripStop`**: `tripId`, `title`, `stopType`, `scheduledAt`, `latitude`, `longitude`, `address`, `notes`, `sortOrder`.
- **`JourneyCheckIn`**: `tripId`, `userId`, `title`, `scheduledAt`, `graceMinutes`, `status` (`SCHEDULED | REMINDED | CONFIRMED | MISSED | ESCALATED | CANCELLED`), `confirmedAt`, `escalatedAt`.

### 2.4 Trusted Contacts & Live Location Sharing
- **`TrustedContact`**: `userId`, `name`, `relationship`, `phone`, `email`, `canReceiveTripUpdates`, `canViewLocation`, `canReceiveCheckIns`, `canReceiveSos`.
- **`LocationShareSession`**: `userId`, `tripId`, `shareToken` (cryptographically random URL-safe token), `status` (`ACTIVE | PAUSED | STOPPED | EXPIRED | REVOKED`), `expiresAt`, `lastLatitude`, `lastLongitude`, `lastAccuracyMeters`, `lastUpdatedAt`, `allowedContactIds[]`.

### 2.5 Local Guardians, Safe Havens & SOS
- **`LocalGuardianProfile`**: `userId`, `verifiedCity`, `serviceRadiusKm`, `languages[]`, `specialties[]`, `isOnDuty`, `baseLatitude`, `baseLongitude`, `ratingAverage`, `verifiedAt`.
- **`SafeHaven`**: `partnerUserId`, `name`, `category` (`HOTEL | HOSTEL | HOSPITAL | CLINIC | PHARMACY | TOURIST_ASSISTANCE_CENTRE`), `address`, `city`, `latitude`, `longitude`, `phone`, `operatingHoursJson`, `assistanceServices[]`, `licenceNumber`, `approvalStatus` (`PENDING | APPROVED | SUSPENDED | REJECTED`), `isActive`, `verifiedBadge` (boolean — `true` only when `approvalStatus == APPROVED`).
- **`SosIncident`**: `userId`, `tripId`, `status` (`TRIGGERED | ACTIVE | ACKNOWLEDGED | RESOLVED | FALSE_ALARM`), `latitude`, `longitude`, `message`, `guardianRequested`, `assignedGuardianId`, `triggeredAt`, `resolvedAt`.
- **`SosAlertDelivery`**: `incidentId`, `recipientType` (`TRUSTED_CONTACT | LOCAL_GUARDIAN | EMERGENCY_DISPATCH`), `recipientId`, `recipientLabel`, `channel` (`PUSH | SMS | WHATSAPP_LINK | IN_APP`), `deliveryStatus` (`SENT | DELIVERED | ACKNOWLEDGED | FAILED`), `sentAt`, `deliveredAt`, `acknowledgedAt`.

### 2.6 Document Vault, Notifications & Audit
- **`TravelDocument`**: `userId`, `documentType` (`PASSPORT | VISA | GOVERNMENT_ID | TICKET | ACCOMMODATION | INSURANCE`), `title`, `storagePath`, `encryptedDek`, `iv`, `mimeType`, `expiresAt`.
- **`Notification`**: `userId`, `type`, `title`, `body`, `metadataJson`, `isRead`, `createdAt`.
- **`AuditLog`**: `actorId`, `action`, `targetType`, `targetId`, `detailsJson`, `createdAt`.

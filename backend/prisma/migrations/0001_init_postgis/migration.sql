-- Enable PostGIS and cryptographic extensions for geospatial discovery and vault IDs
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Spatial functional indexes on coordinate columns for rapid ST_DWithin queries
-- (Execute after Prisma initial table push/migration)
-- CREATE INDEX IF NOT EXISTS idx_buddy_geog ON "TravelBuddyProfile" USING GIST ((ST_SetSRID(ST_MakePoint("baseLongitude", "baseLatitude"), 4326)::geography));
-- CREATE INDEX IF NOT EXISTS idx_guardian_geog ON "LocalGuardianProfile" USING GIST ((ST_SetSRID(ST_MakePoint("baseLongitude", "baseLatitude"), 4326)::geography));
-- CREATE INDEX IF NOT EXISTS idx_safehaven_geog ON "SafeHaven" USING GIST ((ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography));
-- CREATE INDEX IF NOT EXISTS idx_user_approx_geog ON "User" USING GIST ((ST_SetSRID(ST_MakePoint("approxLongitude", "approxLatitude"), 4326)::geography));

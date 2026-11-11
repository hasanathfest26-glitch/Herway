const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Computes great-circle distance in kilometres between two WGS84 coordinates.
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((EARTH_RADIUS_KM * c).toFixed(2));
}

/**
 * Coarsens exact coordinates to ~1.1 km grid cells so public discovery never reveals exact live position.
 */
export function coarsenCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Returns a privacy-friendly distance band label for People Discovery.
 */
export function formatDistanceBand(distanceKm: number): string {
  if (distanceKm < 1) return 'Within 1 km';
  if (distanceKm < 3) return '1 - 3 km away';
  if (distanceKm < 10) return `${Math.ceil(distanceKm)} km away`;
  return `${Math.round(distanceKm)} km away`;
}

import { Platform } from 'react-native';
import * as Location from 'expo-location';

export interface LiveCoordinates {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
}

export interface LocationPermissionResult {
  status: 'granted' | 'denied' | 'unavailable';
  coords?: LiveCoordinates;
  error?: string;
}

export function computeDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export function formatDistanceLabel(km?: number | null): string {
  if (km == null || Number.isNaN(km)) return 'Distance unavailable';
  if (km < 1) return `${Math.max(50, Math.round(km * 1000))} m away`;
  return `${km.toFixed(1)} km away`;
}

async function getBrowserGeolocation(): Promise<LiveCoordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Browser geolocation is not available'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        });
      },
      (err) => {
        reject(new Error(err.message || 'Location permission denied in browser'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}

export async function requestAndFetchLiveLocation(): Promise<LocationPermissionResult> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      if (Platform.OS === 'web') {
        try {
          const browserCoords = await getBrowserGeolocation();
          return { status: 'granted', coords: browserCoords };
        } catch (webErr) {
          return {
            status: 'denied',
            error: (webErr as Error).message || 'Location permission was denied.',
          };
        }
      }
      return {
        status: 'denied',
        error: 'Location permission is required to show nearby Safe Havens, Buddies, and distances.',
      };
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      status: 'granted',
      coords: {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracyMeters: pos.coords.accuracy,
      },
    };
  } catch (err) {
    if (Platform.OS === 'web') {
      try {
        const browserCoords = await getBrowserGeolocation();
        return { status: 'granted', coords: browserCoords };
      } catch (webErr) {
        return {
          status: 'denied',
          error: (webErr as Error).message || 'Could not access browser location.',
        };
      }
    }
    return {
      status: 'unavailable',
      error: (err as Error).message || 'Unable to fetch current GPS location.',
    };
  }
}

export async function readCurrentLocationIfGranted(): Promise<LiveCoordinates | null> {
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.status === 'granted') {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracyMeters: pos.coords.accuracy,
      };
    }
  } catch {
    // Fall through cleanly
  }
  return null;
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { mobileApi } from '@/services/apiClient';

const OFFLINE_PACK_KEY = 'herway_offline_safety_pack_v2';

export interface OfflineSafetyPack {
  trip: {
    id: string;
    title: string;
    destinationCity: string;
    startDate: string;
    endDate: string;
    accommodationJson?: { name?: string; address?: string };
    transportJson?: { summary?: string };
    stops: Array<{ title: string; stopType: string; notes?: string }>;
  } | null;
  nearbySafeHavens: Array<{
    id: string;
    name: string;
    category: string;
    address: string;
    phone: string;
    latitude?: number;
    longitude?: number;
    operatingHoursJson?: { display?: string };
    assistanceServices: string[];
    verifiedBadge: boolean;
  }>;
  trustedSosContacts: Array<{
    id: string;
    name: string;
    relationship: string;
    phone: string;
  }>;
  emergencyNumbers: Array<{
    label: string;
    number: string;
    validatedForIndia: boolean;
  }>;
  safetyInstructions: string[];
  lastUpdatedAt: string;
}

export const STATIC_EMERGENCY_NUMBERS = [
  { label: 'India National Emergency', number: '112', validatedForIndia: true },
  { label: 'Women Helpline (24x7)', number: '181', validatedForIndia: true },
  { label: 'Kerala Police Pink Patrol', number: '1515', validatedForIndia: true },
  { label: 'Police Control Room', number: '100', validatedForIndia: true },
  { label: 'Ambulance Emergency', number: '108', validatedForIndia: true },
];

interface RawPackResponse {
  trip?: OfflineSafetyPack['trip'];
  nearbySafeHavens?: OfflineSafetyPack['nearbySafeHavens'];
  trustedSosContacts?: OfflineSafetyPack['trustedSosContacts'];
  emergencyNumbers?: OfflineSafetyPack['emergencyNumbers'];
  emergencyHelplines?: Array<{ number: string; label: string }>;
  safetyInstructions?: string[];
  safetyGuidance?: string;
  lastUpdatedAt?: string;
}

function normalizeOfflinePack(raw: RawPackResponse): OfflineSafetyPack {
  const numbers =
    raw.emergencyNumbers && raw.emergencyNumbers.length > 0
      ? raw.emergencyNumbers
      : raw.emergencyHelplines && raw.emergencyHelplines.length > 0
        ? raw.emergencyHelplines.map((h) => ({
            label: h.label,
            number: h.number,
            validatedForIndia: true,
          }))
        : STATIC_EMERGENCY_NUMBERS;

  const instructions =
    raw.safetyInstructions && raw.safetyInstructions.length > 0
      ? raw.safetyInstructions
      : raw.safetyGuidance
        ? [raw.safetyGuidance]
        : [
            'Keep battery above 20% and confirm Buddy meetings in public stations or plazas.',
            'Call 112 or 1515 immediately in an emergency.',
          ];

  return {
    trip: raw.trip ?? null,
    nearbySafeHavens: raw.nearbySafeHavens ?? [],
    trustedSosContacts: raw.trustedSosContacts ?? [],
    emergencyNumbers: numbers,
    safetyInstructions: instructions,
    lastUpdatedAt: raw.lastUpdatedAt || new Date().toISOString(),
  };
}

export async function saveOfflineSafetyPack(pack: OfflineSafetyPack): Promise<void> {
  await AsyncStorage.setItem(OFFLINE_PACK_KEY, JSON.stringify(pack));
}

export async function loadOfflineSafetyPack(): Promise<OfflineSafetyPack | null> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_PACK_KEY);
    if (!raw) return null;
    return normalizeOfflinePack(JSON.parse(raw) as RawPackResponse);
  } catch {
    return null;
  }
}

/**
 * Fetches and caches a complete offline pack for the selected or active trip,
 * falling back to general verified Safe Havens and SOS contacts when no trip exists.
 */
export async function syncOfflineSafetyPack(tripId?: string): Promise<OfflineSafetyPack> {
  let targetTripId = tripId;

  if (!targetTripId) {
    const trips = await mobileApi<Array<{ id: string; status: string }>>('/trips');
    const active = trips.find((t) => t.status === 'ACTIVE') || trips[0];
    targetTripId = active?.id;
  }

  if (targetTripId) {
    const raw = await mobileApi<RawPackResponse>(`/trips/${targetTripId}/offline-pack`);
    const normalized = normalizeOfflinePack(raw);
    await saveOfflineSafetyPack(normalized);
    return normalized;
  }

  const [havensRes, contactsRes] = await Promise.allSettled([
    mobileApi<OfflineSafetyPack['nearbySafeHavens']>('/safe-havens/nearby'),
    mobileApi<Array<{ id: string; name: string; relationship: string; phone: string; canReceiveSos?: boolean }>>(
      '/contacts',
    ),
  ]);

  const pack = normalizeOfflinePack({
    trip: null,
    nearbySafeHavens:
      havensRes.status === 'fulfilled'
        ? havensRes.value.filter((h) => h.verifiedBadge).slice(0, 15)
        : [],
    trustedSosContacts:
      contactsRes.status === 'fulfilled'
        ? contactsRes.value.filter((c) => c.canReceiveSos !== false)
        : [],
    lastUpdatedAt: new Date().toISOString(),
  });

  await saveOfflineSafetyPack(pack);
  return pack;
}

export function isOfflinePackOutdated(pack: OfflineSafetyPack, maxAgeHours = 24): boolean {
  const updatedMs = new Date(pack.lastUpdatedAt).getTime();
  if (Number.isNaN(updatedMs)) return true;
  return Date.now() - updatedMs > maxAgeHours * 3600_000;
}

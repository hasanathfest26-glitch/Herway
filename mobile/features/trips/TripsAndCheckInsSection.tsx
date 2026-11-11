import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  HerwayColors,
  HerwayRadii,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useAuth } from '@/features/auth/AuthContext';
import { createIdempotencyKey, mobileApi } from '@/services/apiClient';
import { showFeedback } from '@/services/feedback';
import { syncOfflineSafetyPack } from '@/services/offlineCache';
import { AsyncButton } from '@/components/AsyncButton';
import {
  SecondaryButton,
  StandardCard,
  StandardInput,
  StatusBadge,
} from '@/components/ui';

interface TripRecord {
  id: string;
  title: string;
  startingLocation?: string | null;
  destinationCity: string;
  startDate: string;
  endDate: string;
  status: string;
  accommodationJson?: { name?: string };
  transportJson?: { summary?: string };
  checkIns: Array<{ id: string; title: string; status: string; scheduledAt: string }>;
}

export function TripsAndCheckInsSection() {
  const { user } = useAuth();
  const router = useRouter();
  const layout = useResponsiveLayout();
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [showNewTrip, setShowNewTrip] = useState(false);
  const [tripTitle, setTripTitle] = useState('');
  const [startingLocation, setStartingLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [accommodation, setAccommodation] = useState('');
  const [transport, setTransport] = useState('');

  const loadTrips = useCallback(async () => {
    if (!user) return;
    try {
      const list = await mobileApi<TripRecord[]>('/trips');
      setTrips(list);
    } catch {
      // Offline mode still allows viewing cached pack
    }
  }, [user]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const activeTrip = trips.find((t) => t.status === 'ACTIVE') ?? trips[0];

  async function confirmSafeArrival(tripId: string) {
    try {
      await mobileApi(`/trips/${tripId}/manual-check-in`, {
        method: 'POST',
        idempotencyKey: createIdempotencyKey(`manual-ci-${tripId}`),
        body: JSON.stringify({ title: 'Safe Arrival Confirmed' }),
      });
      await loadTrips();
      showFeedback({
        tone: 'success',
        title: 'Safe Arrival Confirmed',
        message: 'Your check-in has been logged and contacts updated.',
      });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Check-In Failed', message: (err as Error).message });
      throw err;
    }
  }

  async function cacheOfflineSafetyPack(tripId: string) {
    try {
      const pack = await syncOfflineSafetyPack(tripId);
      showFeedback({
        tone: 'success',
        title: 'Offline Safety Pack Updated',
        message: `Saved offline at ${new Date(pack.lastUpdatedAt).toLocaleTimeString()}.`,
      });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Sync Failed', message: (err as Error).message });
      throw err;
    }
  }

  async function saveNewTrip() {
    if (!tripTitle.trim() || !destination.trim()) {
      showFeedback({
        tone: 'error',
        title: 'Missing Fields',
        message: 'Please enter a trip title and destination city.',
      });
      throw new Error('Missing Fields');
    }
    const tempId = createIdempotencyKey('trip');
    const cleanTitle = tripTitle.trim();
    const cleanDest = destination.trim();
    const optimistic: TripRecord = {
      id: tempId,
      title: cleanTitle,
      startingLocation: startingLocation.trim() || null,
      destinationCity: cleanDest,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 3 * 86400_000).toISOString(),
      status: 'PENDING_CONFIRMATION',
      accommodationJson: accommodation.trim() ? { name: accommodation.trim() } : undefined,
      transportJson: transport.trim() ? { summary: transport.trim() } : undefined,
      checkIns: [],
    };
    setTrips((prev) => [optimistic, ...prev]);

    try {
      const created = await mobileApi<TripRecord>('/trips', {
        method: 'POST',
        idempotencyKey: tempId,
        body: JSON.stringify({
          title: cleanTitle,
          startingLocation: startingLocation.trim() || undefined,
          destinationCity: cleanDest,
          startDate: optimistic.startDate,
          endDate: optimistic.endDate,
          accommodationJson: accommodation.trim() ? { name: accommodation.trim() } : {},
          transportJson: transport.trim() ? { summary: transport.trim() } : {},
        }),
      });
      setTrips((prev) => prev.map((t) => (t.id === tempId ? created : t)));
      setShowNewTrip(false);
      setTripTitle('');
      setDestination('');
      setStartingLocation('');
      setAccommodation('');
      setTransport('');
      showFeedback({ tone: 'success', title: 'Trip saved ✓' });
    } catch (err) {
      setTrips((prev) => prev.filter((t) => t.id !== tempId));
      showFeedback({ tone: 'error', title: 'Could Not Save Trip', message: (err as Error).message });
      throw err;
    }
  }

  return (
    <StandardCard>
      <View style={styles.rowBetween}>
        <Text style={[layout.type.cardHeading, styles.title]}>Journeys &amp; Check-Ins</Text>
        {activeTrip && <StatusBadge label={activeTrip.status} tone="safe" />}
      </View>

      {activeTrip ? (
        <>
          <Text style={styles.tripTitle}>
            {activeTrip.title} ({activeTrip.destinationCity})
          </Text>
          {activeTrip.accommodationJson?.name && (
            <Text style={styles.meta}>Stay: {activeTrip.accommodationJson.name}</Text>
          )}
          {activeTrip.transportJson?.summary && (
            <Text style={styles.meta}>Transport: {activeTrip.transportJson.summary}</Text>
          )}
          <View style={styles.btnRow}>
            <View style={styles.btnFlex}>
              <AsyncButton
                label="Manual Safe Check-In"
                loadingLabel="Confirming..."
                successLabel="Checked In ✓"
                onPress={() => confirmSafeArrival(activeTrip.id)}
              />
            </View>
            <View style={styles.btnFlex}>
              <AsyncButton
                label="Sync Offline Pack"
                loadingLabel="Syncing..."
                successLabel="Synced ✓"
                variant="outline"
                onPress={() => cacheOfflineSafetyPack(activeTrip.id)}
              />
            </View>
          </View>
        </>
      ) : (
        <Text style={styles.meta}>
          No active trips planned yet. Plan a journey to schedule check-ins and offline safety packs.
        </Text>
      )}

      <View style={styles.btnRow}>
        <SecondaryButton
          label="Offline Safety Pack"
          onPress={() => router.push('/modals/offline-pack')}
          style={styles.btnFlex}
        />
        {user && (
          <SecondaryButton
            label={showNewTrip ? 'Close Form' : '+ Plan Trip'}
            tone="tealSoft"
            onPress={() => setShowNewTrip((v) => !v)}
            style={styles.btnFlex}
          />
        )}
      </View>

      {showNewTrip && (
        <View style={styles.form}>
          <StandardInput
            value={tripTitle}
            onChangeText={setTripTitle}
            placeholder="Trip name"
            surface="white"
          />
          <StandardInput
            value={startingLocation}
            onChangeText={setStartingLocation}
            placeholder="From (origin)"
            surface="white"
          />
          <StandardInput
            value={destination}
            onChangeText={setDestination}
            placeholder="Destination city"
            surface="white"
          />
          <StandardInput
            value={accommodation}
            onChangeText={setAccommodation}
            placeholder="Stay / Hotel"
            surface="white"
          />
          <StandardInput
            value={transport}
            onChangeText={setTransport}
            placeholder="Transport"
            surface="white"
          />
          <AsyncButton
            label="Save Trip"
            loadingLabel="Creating trip..."
            successLabel="Trip Saved ✓"
            variant="dark"
            onPress={saveNewTrip}
          />
        </View>
      )}
    </StandardCard>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  title: { color: HerwayColors.ink, flex: 1 },
  tripTitle: { fontSize: 15, fontWeight: '700', color: HerwayColors.tealDark },
  meta: { fontSize: 13, fontWeight: '500', color: HerwayColors.muted, lineHeight: 19 },
  btnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: HerwaySpacing.sm,
    marginTop: HerwaySpacing.xs,
  },
  btnFlex: { flex: 1, minWidth: 140 },
  form: {
    marginTop: HerwaySpacing.sm,
    gap: HerwaySpacing.sm,
    backgroundColor: HerwayColors.creamBg,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.borderSubtle,
    padding: HerwaySpacing.md,
    borderRadius: HerwayRadii.input,
  },
});

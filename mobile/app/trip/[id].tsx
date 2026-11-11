import React, { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HerwayColors,
  HerwayRadii,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { createIdempotencyKey, mobileApi } from '@/services/apiClient';
import { showFeedback } from '@/services/feedback';
import { syncOfflineSafetyPack } from '@/services/offlineCache';
import { LiveLocationSharePanel } from '@/features/location/LiveLocationSharePanel';
import {
  CollectionPaginationFooter,
  ErrorState,
  FilterChipBar,
  LoadingState,
  PrimaryButton,
  ResponsiveContainer,
  SearchInput,
  SecondaryButton,
  SmallButton,
  StandardCard,
  StandardInput,
  StatusBadge,
} from '@/components/ui';

interface TripStopRecord {
  id: string;
  title: string;
  stopType: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  sortOrder: number;
}

interface TripCheckInRecord {
  id: string;
  title: string;
  scheduledAt: string;
  status: string;
  confirmedAt?: string | null;
}

interface TripDetailRecord {
  id: string;
  title: string;
  startingLocation?: string | null;
  destinationCity: string;
  startDate: string;
  endDate: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  accommodationJson?: { name?: string };
  transportJson?: { summary?: string };
  notes?: string | null;
  stops: TripStopRecord[];
  checkIns: TripCheckInRecord[];
}

const STOP_TYPES = ['STAY', 'TRANSIT', 'LANDMARK', 'SAFE_HAVEN'] as const;

export default function TripDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  const [trip, setTrip] = useState<TripDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddStop, setShowAddStop] = useState(false);
  const [stopTitle, setStopTitle] = useState('');
  const [stopType, setStopType] = useState<(typeof STOP_TYPES)[number]>('LANDMARK');
  const [stopAddress, setStopAddress] = useState('');
  const [stopNotes, setStopNotes] = useState('');

  const [showAddCheckIn, setShowAddCheckIn] = useState(false);
  const [checkInTitle, setCheckInTitle] = useState('');
  const [hoursAhead, setHoursAhead] = useState('2');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [stopSearch, setStopSearch] = useState('');
  const [stopsLimit, setStopsLimit] = useState(6);
  const [checkInFilter, setCheckInFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED'>('ALL');
  const [checkInsLimit, setCheckInsLimit] = useState(6);

  const loadTrip = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await mobileApi<TripDetailRecord>(`/trips/${id}`);
      setTrip(data);
    } catch (err) {
      setError((err as Error).message || 'Unable to load trip details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  async function updateTripStatus(status: 'ACTIVE' | 'COMPLETED') {
    if (!trip || busyAction) return;
    setBusyAction('status');
    try {
      await mobileApi(`/trips/${trip.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadTrip();
      showFeedback({ tone: 'success', title: `Trip marked ${status}` });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Status Update Failed', message: (err as Error).message });
    } finally {
      setBusyAction(null);
    }
  }

  async function addStop() {
    if (!trip || busyAction) return;
    if (!stopTitle.trim()) {
      showFeedback({
        tone: 'error',
        title: 'Stop Title Required',
        message: 'Enter a place or milestone name for your itinerary.',
      });
      return;
    }
    setBusyAction('addStop');
    const tempStopId = createIdempotencyKey('stop');
    const cleanTitle = stopTitle.trim();
    const optimisticStop: TripStopRecord = {
      id: tempStopId,
      title: cleanTitle,
      stopType,
      address: stopAddress.trim() || null,
      notes: stopNotes.trim() || null,
      sortOrder: trip.stops.length,
    };
    setTrip((prev) => (prev ? { ...prev, stops: [...prev.stops, optimisticStop] } : prev));
    try {
      const saved = await mobileApi<TripStopRecord>(`/trips/${trip.id}/stops`, {
        method: 'POST',
        idempotencyKey: tempStopId,
        body: JSON.stringify({
          title: cleanTitle,
          stopType,
          address: stopAddress.trim() || undefined,
          notes: stopNotes.trim() || undefined,
        }),
      });
      setTrip((prev) =>
        prev
          ? { ...prev, stops: prev.stops.map((s) => (s.id === tempStopId ? saved : s)) }
          : prev,
      );
      setStopTitle('');
      setStopAddress('');
      setStopNotes('');
      setShowAddStop(false);
      showFeedback({ tone: 'success', title: 'Stop Added ✓' });
    } catch (err) {
      setTrip((prev) =>
        prev ? { ...prev, stops: prev.stops.filter((s) => s.id !== tempStopId) } : prev,
      );
      showFeedback({ tone: 'error', title: 'Could Not Add Stop', message: (err as Error).message });
    } finally {
      setBusyAction(null);
    }
  }

  async function removeStop(stopId: string) {
    if (busyAction) return;
    setBusyAction(`rm-${stopId}`);
    try {
      await mobileApi(`/trips/stops/${stopId}`, { method: 'DELETE' });
      await loadTrip();
      showFeedback({ tone: 'info', title: 'Stop Removed' });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Remove Failed', message: (err as Error).message });
    } finally {
      setBusyAction(null);
    }
  }

  async function scheduleCheckIn() {
    if (!trip || busyAction) return;
    if (!checkInTitle.trim()) {
      showFeedback({
        tone: 'error',
        title: 'Check-In Title Required',
        message: 'Enter a check-in label (e.g. Hotel Arrival).',
      });
      return;
    }
    const hrs = Math.max(0.25, Number(hoursAhead) || 2);
    const scheduledAt = new Date(Date.now() + hrs * 3600_000).toISOString();
    setBusyAction('scheduleCheckIn');
    try {
      const created = await mobileApi<TripCheckInRecord>(`/trips/${trip.id}/check-ins`, {
        method: 'POST',
        idempotencyKey: createIdempotencyKey(`sched-ci-${trip.id}`),
        body: JSON.stringify({
          title: checkInTitle.trim(),
          scheduledAt,
          graceMinutes: 20,
        }),
      });
      setTrip((prev) => (prev ? { ...prev, checkIns: [...prev.checkIns, created] } : prev));
      setCheckInTitle('');
      setShowAddCheckIn(false);
      showFeedback({ tone: 'success', title: 'Safety Check-In Scheduled ✓' });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Schedule Failed', message: (err as Error).message });
    } finally {
      setBusyAction(null);
    }
  }

  async function manualSafeArrival() {
    if (!trip || busyAction) return;
    setBusyAction('manualSafe');
    try {
      const created = await mobileApi<TripCheckInRecord>(`/trips/${trip.id}/manual-check-in`, {
        method: 'POST',
        idempotencyKey: createIdempotencyKey(`manual-ci-${trip.id}`),
        body: JSON.stringify({ title: `Safe Arrival in ${trip.destinationCity}` }),
      });
      setTrip((prev) => (prev ? { ...prev, checkIns: [...prev.checkIns, created] } : prev));
      showFeedback({
        tone: 'success',
        title: 'Safe Arrival Logged ✓',
        message: 'Your safe check-in has been recorded.',
      });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Check-In Failed', message: (err as Error).message });
    } finally {
      setBusyAction(null);
    }
  }

  async function confirmCheckIn(checkInId: string) {
    if (busyAction) return;
    setBusyAction(`ci-${checkInId}`);
    const prevCheckIns = trip?.checkIns;
    setTrip((prev) =>
      prev
        ? {
            ...prev,
            checkIns: prev.checkIns.map((c) =>
              c.id === checkInId ? { ...c, status: 'CONFIRMED' } : c,
            ),
          }
        : prev,
    );
    try {
      await mobileApi(`/trips/check-ins/${checkInId}/confirm`, {
        method: 'POST',
        idempotencyKey: createIdempotencyKey(`ci-confirm-${checkInId}`),
      });
      showFeedback({ tone: 'success', title: 'Check-In Confirmed ✓' });
    } catch (err) {
      setTrip((prev) => (prev && prevCheckIns ? { ...prev, checkIns: prevCheckIns } : prev));
      showFeedback({ tone: 'error', title: 'Confirmation Failed', message: (err as Error).message });
    } finally {
      setBusyAction(null);
    }
  }

  async function syncOfflinePack() {
    if (!trip || busyAction) return;
    setBusyAction('offlinePack');
    try {
      await syncOfflineSafetyPack(trip.id);
      showFeedback({
        tone: 'success',
        title: 'Offline Pack Synced ✓',
        message: 'Itinerary, contacts & emergency numbers cached for offline access.',
      });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Sync Failed', message: (err as Error).message });
    } finally {
      setBusyAction(null);
    }
  }

  function openStopDirections(stop: TripStopRecord) {
    const query =
      stop.latitude != null && stop.longitude != null
        ? `${stop.latitude},${stop.longitude}`
        : encodeURIComponent(stop.address || `${stop.title}, ${trip?.destinationCity || 'Kerala'}`);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(() => {});
  }

  const renderItineraryCard = () => {
    const allStops = trip?.stops ?? [];
    const q = stopSearch.trim().toLowerCase();
    const filteredStops = q
      ? allStops.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            (s.address || '').toLowerCase().includes(q) ||
            (s.notes || '').toLowerCase().includes(q),
        )
      : allStops;
    const visibleStops = filteredStops.slice(0, stopsLimit);

    return (
      <StandardCard>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Text style={[layout.type.cardHeading, styles.cardTitle]}>
              Itinerary &amp; Stops ({allStops.length})
            </Text>
          </View>
          <SmallButton
            label={showAddStop ? 'Cancel' : '+ Add Stop'}
            tone="tealSoft"
            onPress={() => setShowAddStop((v) => !v)}
          />
        </View>

        {allStops.length > 4 && (
          <SearchInput
            placeholder="Filter itinerary stops..."
            value={stopSearch}
            onChangeText={(txt) => {
              setStopSearch(txt);
              setStopsLimit(6);
            }}
            onClear={() => setStopSearch('')}
          />
        )}

        {showAddStop && (
          <View style={styles.inlineForm}>
            <StandardInput
              value={stopTitle}
              onChangeText={setStopTitle}
              placeholder="Stop name"
              surface="white"
            />
            <View style={styles.chipRow}>
              {STOP_TYPES.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setStopType(t)}
                  style={[styles.chip, stopType === t && styles.chipActive]}
                >
                  <Text style={[styles.chipText, stopType === t && styles.chipTextActive]}>
                    {t.replace(/_/g, ' ')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <StandardInput
              value={stopAddress}
              onChangeText={setStopAddress}
              placeholder="Address"
              surface="white"
            />
            <StandardInput
              value={stopNotes}
              onChangeText={setStopNotes}
              placeholder="Notes"
              surface="white"
            />
            <PrimaryButton
              label="Save Stop"
              loading={busyAction === 'addStop'}
              disabled={Boolean(busyAction)}
              onPress={addStop}
              fullWidth
            />
          </View>
        )}

        {filteredStops.length === 0 ? (
          <Text style={styles.mutedText}>
            {q ? 'No stops match your search.' : 'No itinerary stops yet.'}
          </Text>
        ) : (
          <View style={{ gap: HerwaySpacing.sm }}>
            {visibleStops.map((stop, idx) => (
              <View key={stop.id} style={styles.stopRow}>
                <View style={styles.stopOrderBadge}>
                  <Text style={styles.stopOrderText}>{(stop.sortOrder ?? idx) + 1}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: HerwaySpacing.xs }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {stop.title}
                    </Text>
                    <View style={{ flexShrink: 0 }}>
                      <StatusBadge label={stop.stopType.replace(/_/g, ' ')} tone="neutral" />
                    </View>
                  </View>
                  {stop.address ? (
                    <Text style={styles.metaText} numberOfLines={2}>
                      {stop.address}
                    </Text>
                  ) : null}
                  {stop.notes ? (
                    <Text style={styles.metaText} numberOfLines={3}>
                      {stop.notes}
                    </Text>
                  ) : null}
                  <View style={styles.stopActions}>
                    <SmallButton
                      label="Directions"
                      tone="tealSoft"
                      onPress={() => openStopDirections(stop)}
                    />
                    <SmallButton
                      label="Remove"
                      tone="danger"
                      disabled={Boolean(busyAction)}
                      onPress={() => removeStop(stop.id)}
                    />
                  </View>
                </View>
              </View>
            ))}

            <CollectionPaginationFooter
              visibleCount={visibleStops.length}
              totalCount={filteredStops.length}
              hasMore={visibleStops.length < filteredStops.length}
              noun="stops"
              onLoadMore={() => setStopsLimit((n) => n + 8)}
            />
          </View>
        )}
      </StandardCard>
    );
  };

  const renderCheckInsCard = () => {
    const allCheckIns = trip?.checkIns ?? [];
    const filteredCheckIns = allCheckIns.filter((ci) => {
      if (checkInFilter === 'PENDING') return ci.status !== 'CONFIRMED';
      if (checkInFilter === 'CONFIRMED') return ci.status === 'CONFIRMED';
      return true;
    });
    const visibleCheckIns = filteredCheckIns.slice(0, checkInsLimit);

    return (
      <StandardCard>
        <View style={styles.rowBetween}>
          <Text style={[layout.type.cardHeading, styles.cardTitle]}>
            Check-ins &amp; Safe Arrival ({allCheckIns.length})
          </Text>
          <SmallButton
            label={showAddCheckIn ? 'Close' : '+ Schedule Check-in'}
            tone="tealSoft"
            onPress={() => setShowAddCheckIn((v) => !v)}
          />
        </View>

        {showAddCheckIn && (
          <View style={styles.inlineForm}>
            <StandardInput
              value={checkInTitle}
              onChangeText={setCheckInTitle}
              placeholder="Check-in title (e.g. Hotel Arrival)"
              surface="white"
            />
            <StandardInput
              value={hoursAhead}
              onChangeText={setHoursAhead}
              keyboardType="numeric"
              placeholder="Hours from now"
              surface="white"
            />
            <PrimaryButton
              label="Schedule Safety Check-in"
              loading={busyAction === 'scheduleCheckIn'}
              disabled={Boolean(busyAction)}
              onPress={scheduleCheckIn}
              fullWidth
            />
          </View>
        )}

        <PrimaryButton
          label="Log Safe Arrival Now"
          icon="verified-user"
          tone="safe"
          loading={busyAction === 'manualSafe'}
          disabled={Boolean(busyAction)}
          onPress={manualSafeArrival}
          fullWidth
        />

        {allCheckIns.length > 3 && (
          <FilterChipBar
            value={checkInFilter}
            onChange={(next) => {
              setCheckInFilter(next);
              setCheckInsLimit(6);
            }}
            options={[
              { value: 'ALL', label: 'All', count: allCheckIns.length },
              {
                value: 'PENDING',
                label: 'Pending',
                count: allCheckIns.filter((c) => c.status !== 'CONFIRMED').length,
              },
              {
                value: 'CONFIRMED',
                label: 'Confirmed',
                count: allCheckIns.filter((c) => c.status === 'CONFIRMED').length,
              },
            ]}
          />
        )}

        {filteredCheckIns.length === 0 ? (
          <Text style={styles.mutedText}>No check-ins in this view.</Text>
        ) : (
          <View style={{ gap: HerwaySpacing.sm }}>
            {visibleCheckIns.map((ci) => {
              const pending = ci.status !== 'CONFIRMED';
              return (
                <View key={ci.id} style={styles.checkInRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {ci.title}
                    </Text>
                    <Text style={styles.metaText}>
                      {new Date(ci.scheduledAt).toLocaleString()}
                    </Text>
                  </View>
                  {pending ? (
                    <SmallButton
                      label="Confirm Safe"
                      tone="primary"
                      loading={busyAction === `ci-${ci.id}`}
                      disabled={Boolean(busyAction)}
                      onPress={() => confirmCheckIn(ci.id)}
                    />
                  ) : (
                    <StatusBadge label="CONFIRMED" tone="safe" />
                  )}
                </View>
              );
            })}

            <CollectionPaginationFooter
              visibleCount={visibleCheckIns.length}
              totalCount={filteredCheckIns.length}
              hasMore={visibleCheckIns.length < filteredCheckIns.length}
              noun="check-ins"
              onLoadMore={() => setCheckInsLimit((n) => n + 8)}
            />
          </View>
        )}
      </StandardCard>
    );
  };

  const renderContactsAndVaultCard = () => (
    <StandardCard>
      <Text style={[layout.type.cardHeading, styles.cardTitle]}>
        Trusted Contacts &amp; Vault
      </Text>
      <Text style={styles.mutedText}>
        Manage who receives your check-in and SOS alerts or store private trip tickets in your encrypted vault.
      </Text>
      <SecondaryButton
        label="Manage Contacts & Vault"
        onPress={() => router.push('/(tabs)/profile' as Href)}
        fullWidth
      />
    </StandardCard>
  );

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: layout.isWideLayout
            ? HerwaySpacing.xl
            : Math.max(insets.top + HerwaySpacing.md, HerwaySpacing.xl),
          paddingBottom: Math.max(insets.bottom + HerwaySpacing.xxl, HerwaySpacing.section),
        }}
      >
        <ResponsiveContainer>
          <View style={styles.topNav}>
            <SecondaryButton
              label="Back"
              icon="arrow-back"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            />
            <SmallButton
              label="SOS"
              icon="warning"
              tone="danger"
              onPress={() => router.push('/sos')}
            />
          </View>

          {loading ? (
            <LoadingState label="Loading trip workspace..." />
          ) : error || !trip ? (
            <ErrorState
              title="Trip Unavailable"
              message={error || 'Trip record not found.'}
              onRetry={loadTrip}
            />
          ) : (
            <>
              <StandardCard>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, minWidth: 180 }}>
                    <Text style={[layout.type.pageHeading, styles.tripTitle]}>
                      {trip.title}
                    </Text>
                    <Text style={styles.tripRoute}>
                      {trip.startingLocation ? `${trip.startingLocation} → ` : ''}
                      {trip.destinationCity} • {new Date(trip.startDate).toLocaleDateString()} –{' '}
                      {new Date(trip.endDate).toLocaleDateString()}
                    </Text>
                  </View>
                  <StatusBadge
                    label={trip.status}
                    tone={trip.status === 'ACTIVE' ? 'safe' : 'neutral'}
                  />
                </View>

                {(trip.accommodationJson?.name || trip.transportJson?.summary) && (
                  <Text style={styles.metaText}>
                    {[
                      trip.accommodationJson?.name ? `Stay: ${trip.accommodationJson.name}` : '',
                      trip.transportJson?.summary
                        ? `Transport: ${trip.transportJson.summary}`
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </Text>
                )}

                <View style={styles.actionWrap}>
                  {trip.status === 'PLANNED' && (
                    <PrimaryButton
                      label="Start Trip"
                      loading={busyAction === 'status'}
                      disabled={Boolean(busyAction)}
                      onPress={() => updateTripStatus('ACTIVE')}
                    />
                  )}
                  {trip.status === 'ACTIVE' && (
                    <PrimaryButton
                      label="Mark Trip Completed"
                      tone="dark"
                      loading={busyAction === 'status'}
                      disabled={Boolean(busyAction)}
                      onPress={() => updateTripStatus('COMPLETED')}
                    />
                  )}
                  <SecondaryButton
                    label="Sync Offline Pack"
                    loading={busyAction === 'offlinePack'}
                    disabled={Boolean(busyAction)}
                    onPress={syncOfflinePack}
                  />
                  <SecondaryButton
                    label="View Offline Pack"
                    onPress={() => router.push('/modals/offline-pack')}
                  />
                  <SecondaryButton
                    label="Nearby Safe Havens"
                    onPress={() => router.push('/(tabs)/explore' as Href)}
                  />
                </View>
              </StandardCard>

              {layout.isWideLayout ? (
                <View style={[styles.desktopGrid, { gap: layout.gridGap }]}>
                  <View style={[styles.desktopCol, { gap: layout.gridGap }]}>
                    {renderItineraryCard()}
                    {renderCheckInsCard()}
                  </View>
                  <View style={[styles.desktopCol, { gap: layout.gridGap }]}>
                    <LiveLocationSharePanel />
                    {renderContactsAndVaultCard()}
                  </View>
                </View>
              ) : (
                <View style={{ gap: layout.gridGap }}>
                  {renderItineraryCard()}
                  {renderCheckInsCard()}
                  <LiveLocationSharePanel />
                  {renderContactsAndVaultCard()}
                </View>
              )}
            </>
          )}
        </ResponsiveContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: HerwayColors.creamBg },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.md,
  },
  tripTitle: { color: HerwayColors.ink },
  tripRoute: { fontSize: 14, fontWeight: '500', color: HerwayColors.muted, marginTop: 4 },
  actionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: HerwaySpacing.sm, marginTop: HerwaySpacing.xs },
  desktopGrid: { flexDirection: 'row', alignItems: 'flex-start' },
  desktopCol: { flex: 1, minWidth: 0 },
  rowBetween: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  cardTitle: { color: HerwayColors.ink, flex: 1 },
  mutedText: { fontSize: 13, color: HerwayColors.muted, lineHeight: 19 },
  metaText: { fontSize: 13, color: HerwayColors.muted, lineHeight: 19 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: HerwayColors.ink, flex: 1 },
  inlineForm: {
    backgroundColor: HerwayColors.inputBg,
    borderRadius: HerwayRadii.input,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.inputBorder,
    padding: HerwaySpacing.md,
    gap: HerwaySpacing.sm,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: HerwaySpacing.sm },
  chip: {
    minHeight: HerwaySizes.buttonSmall,
    justifyContent: 'center',
    backgroundColor: HerwayColors.white,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.pill,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
  },
  chipActive: { backgroundColor: HerwayColors.teal, borderColor: HerwayColors.teal },
  chipText: { fontSize: 12, fontWeight: '600', color: HerwayColors.muted },
  chipTextActive: { color: HerwayColors.white, fontWeight: '700' },
  stopRow: {
    flexDirection: 'row',
    gap: HerwaySpacing.md,
    backgroundColor: HerwayColors.creamBg,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.borderSubtle,
    padding: HerwaySpacing.md,
    borderRadius: HerwayRadii.input,
  },
  stopOrderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: HerwayColors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stopOrderText: { fontSize: 13, fontWeight: '800', color: HerwayColors.white },
  stopActions: { flexDirection: 'row', flexWrap: 'wrap', gap: HerwaySpacing.sm, marginTop: HerwaySpacing.xs },
  checkInRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.sm,
    backgroundColor: HerwayColors.creamBg,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.borderSubtle,
    padding: HerwaySpacing.md,
    borderRadius: HerwayRadii.input,
  },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { Href, Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HerwayColors,
  HerwayRadii,
  HerwayShadows,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useAuth } from '@/features/auth/AuthContext';
import { RoleChoice, useHerwayState } from '@/features/app/HerwayStateContext';
import { mobileApi, createIdempotencyKey } from '@/services/apiClient';
import { useCachedApiQuery } from '@/services/queryCache';
import { getRealtimeSocket } from '@/services/realtimeSocket';
import { showFeedback } from '@/services/feedback';
import { UserAvatar } from '@/components/UserAvatar';
import { CityDropdownField } from '@/components/CityDropdownField';
import { HomeHeroMapArt } from '@/components/HomeHeroMapArt';
import { formatRelativeTime } from '@/utils/dateFormat';
import {
  BuddyBookingItem,
  TravelBuddyDashboardSection,
} from '@/features/dashboard/TravelBuddyDashboardSection';
import {
  CollectionPaginationFooter,
  ErrorState,
  FilterChipBar,
  IconButton,
  InteractiveCard,
  PrimaryButton,
  ResponsiveContainer,
  SecondaryButton,
  SmallButton,
  StandardCard,
  StandardInput,
  StatusBadge,
} from '@/components/ui';
import {
  RevealMask,
  triggerSmoothLayout,
  useReduceMotion,
} from '@/components/motion/HerwayMotion';

interface ApiTripRecord {
  id: string;
  title: string;
  startingLocation?: string | null;
  destinationCity: string;
  startDate: string;
  endDate: string;
  status: string;
  accommodationJson?: { name?: string };
  transportJson?: { summary?: string };
  stops?: Array<{ id: string; title: string }>;
  checkIns?: Array<{
    id: string;
    title: string;
    status: string;
    scheduledAt: string;
  }>;
}

interface CheckInAttentionItem {
  id: string;
  tripId: string;
  tripTitle: string;
  title: string;
  scheduledAt: string;
  status: string;
}

interface NotificationRecord {
  id: string;
  type?: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

interface PaginatedNotifResponse {
  items: NotificationRecord[];
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
  meta?: { unreadCount?: number };
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
}

function formatDateRange(startIso: string, endIso: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime())) return 'Dates TBD';
  if (Number.isNaN(e.getTime())) return s.toLocaleDateString(undefined, opts);
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Scheduled';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function getNotificationRoleTag(type?: string): {
  label: string;
  tone: 'safe' | 'warn' | 'danger' | 'neutral';
} {
  if (!type) return { label: 'TRAVELLER', tone: 'neutral' };
  if (type.includes('BOOKING') || type.includes('VERIFICATION')) {
    return { label: 'BUDDY', tone: 'safe' };
  }
  if (type.includes('SOS') || type.includes('ESCALATED')) {
    return { label: 'SAFETY', tone: 'danger' };
  }
  return { label: 'TRAVELLER', tone: 'neutral' };
}

export default function HomeScreen() {
  const { user, token, loading: authLoading } = useAuth();
  const {
    hasOnboarded,
    profileDraft,
    selectedCity,
    cycleCity,
    selectedRoleChoice,
    buddyVerificationStatus,
  } = useHerwayState();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const reducedMotion = useReduceMotion();

  const {
    data: cachedTrips,
    loading: tripsLoading,
    error: tripsError,
    refetch: refetchTrips,
    setData: setTrips,
  } = useCachedApiQuery<ApiTripRecord[]>(
    user ? `trips:list:${user.id}` : null,
    '/trips',
    { staleTimeMs: 20_000, enabled: Boolean(user) },
  );
  const {
    data: cachedBookings,
    loading: bookingsLoading,
    refetch: refetchBookings,
    setData: setBookings,
  } = useCachedApiQuery<BuddyBookingItem[]>(
    user ? `bookings:list:${user.id}` : null,
    '/bookings',
    { staleTimeMs: 15_000, enabled: Boolean(user) },
  );
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [notifTotal, setNotifTotal] = useState(0);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const [notifHasMore, setNotifHasMore] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'UNREAD' | 'ALL'>('UNREAD');
  const [notifLoadingMore, setNotifLoadingMore] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [expandedNotifIds, setExpandedNotifIds] = useState<Record<string, boolean>>({});
  const [activeTripsLimit, setActiveTripsLimit] = useState(3);
  const [upcomingTripsLimit, setUpcomingTripsLimit] = useState(4);
  const [dueCheckInsLimit, setDueCheckInsLimit] = useState(2);

  const fetchNotifFeed = useCallback(
    async (opts: { reset?: boolean; skipOverride?: number } = {}) => {
      if (!user) return;
      const isReset = opts.reset ?? true;
      const skip = isReset ? 0 : (opts.skipOverride ?? notifications.length);
      if (!isReset) setNotifLoadingMore(true);
      try {
        const params = new URLSearchParams({
          paginated: 'true',
          limit: '15',
          skip: String(skip),
        });
        if (notifFilter === 'UNREAD') params.set('unreadOnly', 'true');
        const res = await mobileApi<PaginatedNotifResponse | NotificationRecord[]>(
          `/notifications?${params.toString()}`,
        );
        const safeItems = Array.isArray(res)
          ? res
          : Array.isArray(res?.items)
            ? res.items
            : [];
        const total = Array.isArray(res) ? res.length : (res?.total ?? safeItems.length);
        const hasMore = Array.isArray(res) ? false : Boolean(res?.hasMore);
        const unreadCount = Array.isArray(res)
          ? safeItems.filter((n) => !n.isRead).length
          : (res?.meta?.unreadCount ?? total);

        setNotifTotal(total);
        setNotifHasMore(hasMore);
        setNotifUnreadCount(unreadCount);
        setNotifications((prev) => {
          if (isReset) return safeItems;
          const byId = new Map<string, NotificationRecord>();
          for (const item of prev) byId.set(item.id, item);
          for (const item of safeItems) byId.set(item.id, item);
          return Array.from(byId.values());
        });
      } catch {
        // Silent in background
      } finally {
        setNotifLoadingMore(false);
      }
    },
    [user, notifFilter, notifications?.length],
  );

  useEffect(() => {
    void fetchNotifFeed({ reset: true, skipOverride: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, notifFilter]);

  const refetchNotifs = useCallback(
    () => fetchNotifFeed({ reset: true, skipOverride: 0 }),
    [fetchNotifFeed],
  );

  const trips = useMemo(() => cachedTrips ?? [], [cachedTrips]);
  const bookings = useMemo(() => cachedBookings ?? [], [cachedBookings]);
  const loadingData = tripsLoading || bookingsLoading;
  const dataError = tripsError;

  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [viewAll, setViewAll] = useState(false);
  const [activeMode, setActiveMode] = useState<'TRAVELLER' | 'TRAVEL_BUDDY'>('TRAVELLER');

  const [tripTitle, setTripTitle] = useState('');
  const [startingLocation, setStartingLocation] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [startDateInput, setStartDateInput] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [endDateInput, setEndDateInput] = useState(
    new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10),
  );
  const [accommodation, setAccommodation] = useState('');
  const [transport, setTransport] = useState('');
  const [firstStopTitle, setFirstStopTitle] = useState('');
  const [savingTrip, setSavingTrip] = useState(false);
  const [busyCheckInIds, setBusyCheckInIds] = useState<Record<string, boolean>>({});

  const resolvedDashboardRole: RoleChoice = useMemo(() => {
    const prefChoice = user?.travelPreferencesJson?.selectedRoleChoice as RoleChoice | undefined;
    if (prefChoice === 'TRAVELLER' || prefChoice === 'TRAVEL_BUDDY' || prefChoice === 'BOTH') {
      return prefChoice;
    }
    const roles = user?.roles || [];
    if (roles.includes('TRAVEL_BUDDY') && roles.includes('TRAVELLER')) return 'BOTH';
    if (roles.includes('TRAVEL_BUDDY')) return 'TRAVEL_BUDDY';
    return selectedRoleChoice || 'TRAVELLER';
  }, [user, selectedRoleChoice]);

  useEffect(() => {
    if (resolvedDashboardRole === 'TRAVEL_BUDDY') {
      setActiveMode('TRAVEL_BUDDY');
    } else if (resolvedDashboardRole === 'TRAVELLER') {
      setActiveMode('TRAVELLER');
    }
  }, [resolvedDashboardRole]);

  const loadHomeData = useCallback(async () => {
    if (!user) return;
    await Promise.all([refetchTrips(), refetchNotifs(), refetchBookings()]);
  }, [user, refetchTrips, refetchNotifs, refetchBookings]);

  useEffect(() => {
    if (!user || !token) return;
    const socket = getRealtimeSocket(token);
    const onTripUpdate = () => {
      void refetchTrips();
    };
    const onBookingEvent = (incoming: BuddyBookingItem) => {
      setBookings((prev) => {
        const list = prev ?? [];
        return list.some((b) => b.id === incoming.id)
          ? list.map((b) => (b.id === incoming.id ? { ...b, ...incoming } : b))
          : [incoming, ...list];
      });
    };
    const onNotificationNew = (incoming: NotificationRecord) => {
      setNotifUnreadCount((c) => c + (incoming.isRead ? 0 : 1));
      setNotifTotal((t) => t + 1);
      setNotifications((prev) => [
        incoming,
        ...prev.filter((n) => n.id !== incoming.id),
      ]);
    };
    socket.on('trip:updated', onTripUpdate);
    socket.on('checkin:updated', onTripUpdate);
    socket.on('booking:created', onBookingEvent);
    socket.on('booking:updated', onBookingEvent);
    socket.on('notification:new', onNotificationNew);
    return () => {
      socket.off('trip:updated', onTripUpdate);
      socket.off('checkin:updated', onTripUpdate);
      socket.off('booking:created', onBookingEvent);
      socket.off('booking:updated', onBookingEvent);
      socket.off('notification:new', onNotificationNew);
    };
  }, [user, token, refetchTrips, setBookings, setNotifications]);

  const activeTrips = useMemo(() => {
    const now = Date.now();
    return trips.filter((t) => {
      if (t.status === 'ACTIVE') return true;
      if (t.status === 'COMPLETED' || t.status === 'CANCELLED') return false;
      const start = new Date(t.startDate).getTime();
      const end = new Date(t.endDate).getTime();
      return !Number.isNaN(start) && !Number.isNaN(end) && start <= now && now <= end;
    });
  }, [trips]);

  const upcomingJourneys = useMemo(() => {
    const activeIds = new Set(activeTrips.map((t) => t.id));
    return trips.filter(
      (t) =>
        !activeIds.has(t.id) &&
        t.status !== 'COMPLETED' &&
        t.status !== 'CANCELLED',
    );
  }, [trips, activeTrips]);

  const attentionCheckIns: CheckInAttentionItem[] = useMemo(() => {
    const attentionStates = new Set(['SCHEDULED', 'REMINDED', 'OVERDUE', 'MISSED']);
    const items: CheckInAttentionItem[] = [];
    for (const trip of trips) {
      for (const ci of trip.checkIns ?? []) {
        if (attentionStates.has(ci.status)) {
          items.push({
            id: ci.id,
            tripId: trip.id,
            tripTitle: trip.title,
            title: ci.title,
            scheduledAt: ci.scheduledAt,
            status: ci.status,
          });
        }
      }
    }
    return items;
  }, [trips]);

  const unreadCountDisplay = notifUnreadCount;

  if (!authLoading && !user && !hasOnboarded) {
    return <Redirect href={'/welcome' as Href} />;
  }

  if (!authLoading && !user) {
    return <Redirect href={'/(auth)/login' as Href} />;
  }

  const displayName = user?.fullName || profileDraft.fullName || user?.email || 'Traveller';
  const firstName = displayName.split(' ')[0];
  const displayCity = user?.homeCity || profileDraft.homeCity || selectedCity;
  const avatarUri = user?.avatarUrl || profileDraft.avatarUri;

  async function handleCreateTrip() {
    if (savingTrip) return;
    const cleanTitle = tripTitle.trim();
    const cleanDest = destinationCity.trim();
    if (!cleanTitle || !cleanDest) {
      showFeedback({
        tone: 'error',
        title: 'Required Fields',
        message: 'Please enter a trip title and destination city.',
      });
      return;
    }

    const parsedStart = new Date(startDateInput);
    const parsedEnd = new Date(endDateInput);
    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
      showFeedback({
        tone: 'error',
        title: 'Invalid Dates',
        message: 'Please enter valid YYYY-MM-DD start and end dates.',
      });
      return;
    }

    const tempTripId = createIdempotencyKey('trip');
    const optimisticTrip: ApiTripRecord = {
      id: tempTripId,
      title: cleanTitle,
      startingLocation: startingLocation.trim() || null,
      destinationCity: cleanDest,
      startDate: parsedStart.toISOString(),
      endDate: parsedEnd.toISOString(),
      status: 'PENDING_CONFIRMATION',
      accommodationJson: accommodation.trim() ? { name: accommodation.trim() } : undefined,
      transportJson: transport.trim() ? { summary: transport.trim() } : undefined,
      stops: firstStopTitle.trim() ? [{ id: 'temp-stop', title: firstStopTitle.trim() }] : [],
      checkIns: [],
    };

    setSavingTrip(true);
    setTrips((prev) => [optimisticTrip, ...(prev ?? [])]);
    try {
      const created = await mobileApi<ApiTripRecord>('/trips', {
        method: 'POST',
        idempotencyKey: tempTripId,
        body: JSON.stringify({
          title: cleanTitle,
          startingLocation: startingLocation.trim() || undefined,
          destinationCity: cleanDest,
          startDate: parsedStart.toISOString(),
          endDate: parsedEnd.toISOString(),
          accommodationJson: accommodation.trim()
            ? { name: accommodation.trim() }
            : undefined,
          transportJson: transport.trim()
            ? { summary: transport.trim() }
            : undefined,
          stops: firstStopTitle.trim()
            ? [{ title: firstStopTitle.trim(), stopType: 'STAY' }]
            : undefined,
        }),
      });
      setTrips((prev) =>
        (prev ?? []).map((t) => (t.id === tempTripId ? created : t)),
      );
      triggerSmoothLayout(reducedMotion);
      setShowCreateTrip(false);
      setTripTitle('');
      setStartingLocation('');
      setDestinationCity('');
      setAccommodation('');
      setTransport('');
      setFirstStopTitle('');
      showFeedback({
        tone: 'success',
        title: 'Trip Created ✓',
        message: `Added "${cleanTitle}" (${cleanDest}).`,
      });
      if (created?.id) {
        router.push(`/trip/${created.id}` as Href);
      }
    } catch (err) {
      setTrips((prev) => (prev ?? []).filter((t) => t.id !== tempTripId));
      showFeedback({ tone: 'error', title: 'Could Not Save Trip', message: (err as Error).message });
    } finally {
      setSavingTrip(false);
    }
  }

  async function handleConfirmCheckIn(ci: CheckInAttentionItem) {
    if (busyCheckInIds[ci.id]) return;
    setBusyCheckInIds((prev) => ({ ...prev, [ci.id]: true }));
    const prevSnapshot = trips;
    setTrips((prev) =>
      (prev ?? []).map((trip) =>
        trip.id === ci.tripId
          ? {
              ...trip,
              checkIns: (trip.checkIns || []).map((c) =>
                c.id === ci.id ? { ...c, status: 'CONFIRMED' } : c,
              ),
            }
          : trip,
      ),
    );
    try {
      await mobileApi(`/trips/check-ins/${ci.id}/confirm`, {
        method: 'POST',
        idempotencyKey: createIdempotencyKey(`checkin-confirm-${ci.id}`),
      });
      triggerSmoothLayout(reducedMotion);
      showFeedback({
        tone: 'success',
        title: 'Check-In Confirmed ✓',
        message: `Confirmed safe for "${ci.title}".`,
      });
    } catch (err) {
      setTrips(prevSnapshot);
      showFeedback({
        tone: 'error',
        title: 'Confirmation Failed',
        message: (err as Error).message,
      });
    } finally {
      setBusyCheckInIds((prev) => ({ ...prev, [ci.id]: false }));
    }
  }

  async function handleMarkNotificationRead(id: string) {
    setNotifications((prev) =>
      notifFilter === 'UNREAD'
        ? prev.filter((n) => n.id !== id)
        : prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setNotifUnreadCount((c) => Math.max(0, c - 1));
    try {
      await mobileApi(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch (err) {
      void refetchNotifs();
      showFeedback({ tone: 'error', title: 'Error', message: (err as Error).message });
    }
  }

  async function handleMarkAllNotificationsRead() {
    if (markingAllRead || notifUnreadCount === 0) return;
    setMarkingAllRead(true);
    try {
      await mobileApi('/notifications/read-all', { method: 'PATCH' });
      setNotifUnreadCount(0);
      setNotifications((prev) =>
        notifFilter === 'UNREAD'
          ? []
          : prev.map((n) => ({ ...n, isRead: true })),
      );
      if (notifFilter === 'UNREAD') setNotifTotal(0);
      showFeedback({ tone: 'success', title: 'All caught up' });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Error', message: (err as Error).message });
    } finally {
      setMarkingAllRead(false);
    }
  }

  function renderHeader() {
    return (
      <RevealMask scrollTrigger={false} mask={false}>
        <View style={styles.headerBlock}>
          <View style={styles.headerTopRow}>
            <View style={styles.profileCluster}>
              <Pressable
                onPress={() => router.push('/edit-profile' as Href)}
                style={styles.avatarRing}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
              >
                <UserAvatar uri={avatarUri} size={46} imageStyle={styles.avatarImg} />
              </Pressable>

              <View style={styles.greetingCol}>
                <Text style={styles.greetingLabel}>{getTimeGreeting()}</Text>
                <Text style={[layout.type.sectionHeading, styles.greetingName]} numberOfLines={1}>
                  {firstName}
                </Text>
                <Pressable
                  onPress={user?.homeCity ? () => router.push('/edit-profile' as Href) : cycleCity}
                  hitSlop={4}
                  style={styles.locationChip}
                  accessibilityRole="button"
                  accessibilityLabel={`Current city: ${displayCity}`}
                >
                  <MaterialIcons name="location-on" size={14} color={HerwayColors.tealDark} />
                  <Text style={styles.locationChipText} numberOfLines={1}>
                    {displayCity}
                  </Text>
                </Pressable>
              </View>
            </View>

            {resolvedDashboardRole === 'BOTH' && (
              <View style={styles.roleSegmentedWrap}>
                <Pressable
                  onPress={() => setActiveMode('TRAVELLER')}
                  style={[
                    styles.roleSegmentedBtn,
                    activeMode === 'TRAVELLER' && styles.roleSegmentedBtnActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeMode === 'TRAVELLER' }}
                >
                  <Text
                    style={[
                      styles.roleSegmentedText,
                      activeMode === 'TRAVELLER' && styles.roleSegmentedTextActive,
                    ]}
                  >
                    Traveller
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setActiveMode('TRAVEL_BUDDY')}
                  style={[
                    styles.roleSegmentedBtn,
                    activeMode === 'TRAVEL_BUDDY' && styles.roleSegmentedBtnActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeMode === 'TRAVEL_BUDDY' }}
                >
                  <Text
                    style={[
                      styles.roleSegmentedText,
                      activeMode === 'TRAVEL_BUDDY' && styles.roleSegmentedTextActive,
                    ]}
                  >
                    Buddy
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {(buddyVerificationStatus === 'PENDING' ||
            buddyVerificationStatus === 'UNDER_REVIEW') && (
            <Pressable
              onPress={() => router.push('/(onboarding)/pending-buddy' as Href)}
              style={styles.pendingBanner}
            >
              <StatusBadge
                label={`Buddy verification ${buddyVerificationStatus.replace(/_/g, ' ').toLowerCase()}`}
                tone="warn"
                icon="hourglass-top"
              />
            </Pressable>
          )}
        </View>
      </RevealMask>
    );
  }

  function renderHeroMapCard() {
    const statusLabel = activeTrips.length > 0 ? `${activeTrips.length} Active` : 'Ready';

    return (
      <RevealMask delay={20} scrollTrigger={false}>
        <StandardCard compact style={styles.heroCardFrame}>
          <View style={[styles.heroCardInner, layout.isWideLayout && styles.heroCardInnerDesktop]}>
            <HomeHeroMapArt seed={displayCity} />

            <View style={styles.heroContent}>
              <Text style={[layout.type.sectionHeading, styles.heroTitle]} numberOfLines={1}>
                Explore {displayCity}
              </Text>

              <View style={styles.heroFooterRow}>
                <StatusBadge
                  label={statusLabel}
                  tone={activeTrips.length > 0 ? 'safe' : 'neutral'}
                />

                <SmallButton
                  label={showCreateTrip ? 'Close' : 'Plan Trip'}
                  icon={showCreateTrip ? 'close' : 'add'}
                  tone="primary"
                  onPress={() => {
                    triggerSmoothLayout(reducedMotion);
                    setShowCreateTrip((v) => !v);
                  }}
                />
              </View>
            </View>
          </View>
        </StandardCard>
      </RevealMask>
    );
  }

  function renderInlineCreateTripForm() {
    if (!showCreateTrip) return null;
    const twoColForm = layout.isWideLayout;

    return (
      <RevealMask scrollTrigger={false} offsetY={10}>
        <StandardCard>
          <View style={styles.sectionHeader}>
            <Text style={[layout.type.cardHeading, styles.sectionTitle]}>New Trip</Text>
            <IconButton
              icon="close"
              size="small"
              onPress={() => {
                triggerSmoothLayout(reducedMotion);
                setShowCreateTrip(false);
              }}
              accessibilityLabel="Close trip form"
            />
          </View>

          <View style={[styles.formGrid, twoColForm && styles.formGridDesktop]}>
            <View style={twoColForm ? styles.formFieldHalf : styles.formFieldFull}>
              <StandardInput
                label="Title"
                value={tripTitle}
                onChangeText={setTripTitle}
                placeholder="Trip name"
              />
            </View>

            <View style={twoColForm ? styles.formFieldHalf : styles.formFieldFull}>
              <CityDropdownField
                label="Destination"
                value={destinationCity}
                onChange={setDestinationCity}
                placeholder="Select destination"
                customPlaceholder="Enter custom destination"
                variant="pill"
              />
            </View>

            <View style={twoColForm ? styles.formFieldHalf : styles.formFieldFull}>
              <StandardInput
                label="From"
                value={startingLocation}
                onChangeText={setStartingLocation}
                placeholder="Origin"
              />
            </View>

            <View style={twoColForm ? styles.formFieldHalf : styles.formFieldFull}>
              <View style={[styles.dateRow, layout.isSmallMobile && styles.dateColSmall]}>
                <View style={layout.isSmallMobile ? styles.formFieldFull : { flex: 1 }}>
                  <StandardInput
                    label="Start Date"
                    value={startDateInput}
                    onChangeText={setStartDateInput}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={layout.isSmallMobile ? styles.formFieldFull : { flex: 1 }}>
                  <StandardInput
                    label="End Date"
                    value={endDateInput}
                    onChangeText={setEndDateInput}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>
            </View>

            <View style={twoColForm ? styles.formFieldHalf : styles.formFieldFull}>
              <StandardInput
                label="Stay"
                value={accommodation}
                onChangeText={setAccommodation}
                placeholder="Hotel or stay"
              />
            </View>

            <View style={twoColForm ? styles.formFieldHalf : styles.formFieldFull}>
              <StandardInput
                label="Transport"
                value={transport}
                onChangeText={setTransport}
                placeholder="Train, bus, cab"
              />
            </View>

            <View style={styles.formFieldFull}>
              <StandardInput
                label="First Stop"
                value={firstStopTitle}
                onChangeText={setFirstStopTitle}
                placeholder="First stop"
              />
            </View>
          </View>

          <PrimaryButton
            label={savingTrip ? 'Saving...' : 'Save Trip'}
            tone="dark"
            loading={savingTrip}
            disabled={savingTrip}
            onPress={handleCreateTrip}
            fullWidth
          />
        </StandardCard>
      </RevealMask>
    );
  }

  function renderBentoActionGrid() {
    return (
      <RevealMask delay={40} scrollTrigger={false}>
        <View style={styles.bentoGrid}>
          <View style={styles.bentoRow}>
            <InteractiveCard
              compact
              onPress={() => router.push('/(tabs)/explore' as Href)}
              accessibilityLabel="Explore Safe Havens"
              style={styles.bentoCard}
            >
              <View style={styles.bentoIconTeal}>
                <MaterialIcons name="explore" size={18} color={HerwayColors.white} />
              </View>
              <View style={styles.bentoTextBlock}>
                <Text style={styles.bentoTitle}>Safe Havens</Text>
                <Text style={styles.bentoSub}>Verified places</Text>
              </View>
            </InteractiveCard>

            <InteractiveCard
              compact
              onPress={() => router.push('/(tabs)/people' as Href)}
              accessibilityLabel="Browse Travel Buddies"
              style={styles.bentoCard}
            >
              <View style={styles.bentoIconTeal}>
                <MaterialIcons name="groups" size={18} color={HerwayColors.white} />
              </View>
              <View style={styles.bentoTextBlock}>
                <Text style={styles.bentoTitle}>Travel Buddies</Text>
                <Text style={styles.bentoSub}>Local companions</Text>
              </View>
            </InteractiveCard>
          </View>

          <View style={styles.bentoRow}>
            <InteractiveCard
              compact
              onPress={() => router.push('/modals/offline-pack' as Href)}
              accessibilityLabel="Open Offline Safety Pack"
              style={styles.bentoCard}
            >
              <View style={styles.bentoIconTeal}>
                <MaterialIcons name="offline-pin" size={18} color={HerwayColors.white} />
              </View>
              <View style={styles.bentoTextBlock}>
                <Text style={styles.bentoTitle}>Offline Pack</Text>
                <Text style={styles.bentoSub}>112 &amp; guides</Text>
              </View>
            </InteractiveCard>

            <InteractiveCard
              compact
              tone="danger"
              onPress={() => router.push('/sos' as Href)}
              accessibilityLabel="Open Emergency SOS"
              style={styles.bentoCard}
            >
              <View style={styles.bentoIconSos}>
                <MaterialIcons name="shield" size={18} color={HerwayColors.white} />
              </View>
              <View style={styles.bentoTextBlock}>
                <Text style={styles.bentoTitle}>Emergency SOS</Text>
                <StatusBadge label="Open SOS" tone="danger" hideIcon />
              </View>
            </InteractiveCard>
          </View>
        </View>
      </RevealMask>
    );
  }

  function renderActiveTripsSection() {
    const visibleTrips = activeTrips.slice(0, activeTripsLimit);
    const hasMoreActive = activeTrips.length > activeTripsLimit;

    return (
      <RevealMask delay={60} scrollTrigger={false}>
        <StandardCard>
          <View style={styles.sectionHeader}>
            <Text style={[layout.type.cardHeading, styles.sectionTitle]}>Active Trips</Text>
            <View style={styles.sectionRightRow}>
              <StatusBadge
                label={`${activeTrips.length} Ongoing`}
                tone={activeTrips.length > 0 ? 'safe' : 'neutral'}
              />
              {upcomingJourneys.length > 0 && (
                <SmallButton
                  label={viewAll ? 'Compact' : `Upcoming (${upcomingJourneys.length})`}
                  tone={viewAll ? 'tealSoft' : 'primary'}
                  onPress={() => {
                    triggerSmoothLayout(reducedMotion);
                    setViewAll((v) => !v);
                  }}
                />
              )}
            </View>
          </View>

          {loadingData ? (
            <ActivityIndicator color={HerwayColors.tealDark} />
          ) : activeTrips.length === 0 ? (
            <View style={styles.emptyPillRow}>
              <Text style={styles.emptyPillText}>No active trips</Text>
            </View>
          ) : (
            <View style={styles.itemsStack}>
              {visibleTrips.map((trip) => (
                <Pressable
                  key={trip.id}
                  onPress={() => router.push(`/trip/${trip.id}` as Href)}
                  style={styles.activeTripRow}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {trip.title}
                    </Text>
                    <Text style={styles.itemMeta} numberOfLines={1}>
                      {trip.destinationCity} • {formatDateRange(trip.startDate, trip.endDate)}
                    </Text>
                  </View>
                  <MaterialIcons
                    name="arrow-forward"
                    size={18}
                    color={HerwayColors.tealDark}
                  />
                </Pressable>
              ))}
              {hasMoreActive ? (
                <SmallButton
                  label={`Show more active trips (${activeTrips.length - activeTripsLimit})`}
                  tone="tealSoft"
                  onPress={() => setActiveTripsLimit((n) => n + 5)}
                />
              ) : activeTripsLimit > 3 && activeTrips.length > 3 ? (
                <SmallButton
                  label="Show fewer"
                  tone="tealSoft"
                  onPress={() => setActiveTripsLimit(3)}
                />
              ) : null}
            </View>
          )}
        </StandardCard>
      </RevealMask>
    );
  }

  function renderDueCheckInsSection() {
    if (attentionCheckIns.length === 0) return null;
    const visibleCheckIns = attentionCheckIns.slice(0, dueCheckInsLimit);
    return (
      <RevealMask delay={70}>
        <StandardCard>
          <View style={styles.sectionHeader}>
            <Text style={[layout.type.cardHeading, styles.sectionTitle]}>Check-in Due</Text>
            <StatusBadge label={`${attentionCheckIns.length} Due`} tone="warn" />
          </View>

          <View style={styles.itemsStack}>
            {visibleCheckIns.map((ci) => {
              const urgent = ci.status === 'OVERDUE' || ci.status === 'MISSED';
              return (
                <View
                  key={ci.id}
                  style={[styles.checkInCard, urgent && styles.checkInCardUrgent]}
                >
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {ci.title}
                      </Text>
                      <Text style={styles.itemMeta} numberOfLines={1}>
                        {ci.tripTitle}
                      </Text>
                    </View>
                    <StatusBadge
                      label={urgent ? ci.status : formatTimeShort(ci.scheduledAt)}
                      tone={urgent ? 'danger' : 'warn'}
                    />
                  </View>
                  <SecondaryButton
                    label={busyCheckInIds[ci.id] ? 'Confirming...' : 'Confirm Safe'}
                    icon="check-circle"
                    tone="tealSoft"
                    loading={Boolean(busyCheckInIds[ci.id])}
                    disabled={Boolean(busyCheckInIds[ci.id])}
                    onPress={() => handleConfirmCheckIn(ci)}
                    fullWidth
                  />
                </View>
              );
            })}
            {attentionCheckIns.length > dueCheckInsLimit && (
              <SmallButton
                label={`Show ${attentionCheckIns.length - dueCheckInsLimit} more check-ins`}
                tone="tealSoft"
                onPress={() => setDueCheckInsLimit((n) => n + 4)}
              />
            )}
          </View>
        </StandardCard>
      </RevealMask>
    );
  }

  function renderUpcomingJourneysSection() {
    if ((!viewAll && activeTrips.length > 0) || upcomingJourneys.length === 0) return null;
    const visibleUpcoming = upcomingJourneys.slice(0, upcomingTripsLimit);
    return (
      <RevealMask delay={80}>
        <StandardCard>
          <View style={styles.sectionHeader}>
            <Text style={[layout.type.cardHeading, styles.sectionTitle]}>Upcoming Trips</Text>
            <StatusBadge label={`${upcomingJourneys.length}`} tone="neutral" hideIcon />
          </View>
          <View style={styles.itemsStack}>
            {visibleUpcoming.map((trip) => (
              <Pressable
                key={trip.id}
                onPress={() => router.push(`/trip/${trip.id}` as Href)}
                style={styles.journeyRow}
              >
                <View style={styles.journeyIconCircle}>
                  <MaterialIcons name="luggage" size={18} color={HerwayColors.tealDark} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {trip.title}
                  </Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    {trip.destinationCity} • {formatDateRange(trip.startDate, trip.endDate)}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={18} color={HerwayColors.muted} />
              </Pressable>
            ))}
            {upcomingJourneys.length > upcomingTripsLimit && (
              <SmallButton
                label={`Show more trips (${upcomingJourneys.length - upcomingTripsLimit})`}
                tone="tealSoft"
                onPress={() => setUpcomingTripsLimit((n) => n + 6)}
              />
            )}
          </View>
        </StandardCard>
      </RevealMask>
    );
  }

  function renderNotificationsSection() {
    if (notifications.length === 0 && unreadCountDisplay === 0 && notifFilter === 'UNREAD') {
      return null;
    }
    return (
      <RevealMask delay={100}>
        <StandardCard>
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={[layout.type.cardHeading, styles.sectionTitle]}>Notifications</Text>
              <Text style={styles.itemMeta}>Safety alerts, bookings, and trip reminders</Text>
            </View>
            <View style={styles.sectionRightRow}>
              <StatusBadge
                label={unreadCountDisplay > 0 ? `${unreadCountDisplay} Unread` : 'All Read'}
                tone={unreadCountDisplay > 0 ? 'info' : 'neutral'}
              />
              {unreadCountDisplay > 0 && (
                <SmallButton
                  label={markingAllRead ? 'Clearing...' : 'Mark all read'}
                  tone="tealSoft"
                  loading={markingAllRead}
                  disabled={markingAllRead}
                  onPress={handleMarkAllNotificationsRead}
                />
              )}
            </View>
          </View>

          <FilterChipBar
            value={notifFilter}
            onChange={setNotifFilter}
            options={[
              { value: 'UNREAD', label: 'Unread', count: unreadCountDisplay },
              { value: 'ALL', label: 'All Updates' },
            ]}
          />

          {notifications.length === 0 ? (
            <View style={styles.emptyPillRow}>
              <Text style={styles.emptyPillText}>
                {notifFilter === 'UNREAD' ? 'No unread notifications' : 'No notifications yet'}
              </Text>
            </View>
          ) : (
            <View style={styles.itemsStack}>
              {notifications.map((n) => {
                const isSafety = n.type === 'SAFETY' || n.type === 'SOS_ALERT';
                const isBooking = n.type?.includes('BOOKING');
                const roleTag = getNotificationRoleTag(n.type);
                const isExpanded = Boolean(expandedNotifIds[n.id]);
                const relTime = formatRelativeTime(n.createdAt);

                return (
                  <Pressable
                    key={n.id}
                    onPress={() => {
                      if (n.body.length > 80) {
                        setExpandedNotifIds((prev) => ({ ...prev, [n.id]: !prev[n.id] }));
                      } else if (isBooking) {
                        router.push('/(tabs)/bookings');
                      }
                    }}
                    style={[
                      styles.notifCard,
                      !n.isRead && { borderLeftWidth: 3, borderLeftColor: HerwayColors.tealDark },
                    ]}
                  >
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <View style={styles.rowBetween}>
                        <Text
                          style={styles.notifTitle}
                          numberOfLines={isExpanded ? undefined : 1}
                        >
                          {n.title}
                        </Text>
                        <View style={{ flexShrink: 0 }}>
                          <StatusBadge
                            label={roleTag.label}
                            tone={isSafety ? 'danger' : roleTag.tone}
                          />
                        </View>
                      </View>
                      <Text
                        style={styles.notifBody}
                        numberOfLines={isExpanded ? undefined : 2}
                      >
                        {n.body}
                      </Text>
                      <View style={styles.rowBetween}>
                        <Text style={styles.itemMeta}>{relTime}</Text>
                        {isBooking && (
                          <Text style={styles.notifActionLink}>Open Bookings →</Text>
                        )}
                      </View>
                    </View>
                    {!n.isRead && (
                      <IconButton
                        icon="done"
                        size="small"
                        tone="surface"
                        onPress={() => handleMarkNotificationRead(n.id)}
                        accessibilityLabel="Mark notification read"
                      />
                    )}
                  </Pressable>
                );
              })}

              <CollectionPaginationFooter
                visibleCount={notifications.length}
                totalCount={notifTotal}
                hasMore={notifHasMore}
                loadingMore={notifLoadingMore}
                noun="notifications"
                onLoadMore={() =>
                  fetchNotifFeed({ reset: false, skipOverride: notifications.length })
                }
              />
            </View>
          )}
        </StandardCard>
      </RevealMask>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          layout.isWideLayout
            ? styles.desktopScroll
            : { paddingTop: Math.max(insets.top + HerwaySpacing.md, HerwaySpacing.xxl), paddingBottom: 140 },
        ]}
      >
        <ResponsiveContainer>
          {dataError ? (
            <ErrorState inline message={dataError} onRetry={loadHomeData} />
          ) : null}

          {renderHeader()}

          {activeMode === 'TRAVEL_BUDDY' ? (
            <>
              <TravelBuddyDashboardSection
                bookings={bookings}
                onReload={loadHomeData}
                isDesktop={layout.isWideLayout}
                viewAll={viewAll}
              />
              {renderNotificationsSection()}
            </>
          ) : layout.isWideLayout ? (
            <View style={[styles.desktopGrid, { gap: layout.gridGap }]}>
              <View style={[styles.desktopColLeft, { gap: layout.gridGap }]}>
                {renderHeroMapCard()}
                {renderInlineCreateTripForm()}
                {renderActiveTripsSection()}
              </View>
              <View style={[styles.desktopColRight, { gap: layout.gridGap }]}>
                {renderBentoActionGrid()}
                {renderDueCheckInsSection()}
                {renderUpcomingJourneysSection()}
                {renderNotificationsSection()}
              </View>
            </View>
          ) : (
            <View style={{ gap: layout.gridGap }}>
              {renderHeroMapCard()}
              {renderInlineCreateTripForm()}
              {renderBentoActionGrid()}
              {renderActiveTripsSection()}
              {renderDueCheckInsSection()}
              {renderUpcomingJourneysSection()}
              {renderNotificationsSection()}
            </View>
          )}
        </ResponsiveContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: HerwayColors.creamBg },
  desktopScroll: { paddingTop: HerwaySpacing.xl, paddingBottom: HerwaySpacing.section },
  headerBlock: { gap: HerwaySpacing.sm },
  headerTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.md,
  },
  profileCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.md,
    flex: 1,
    minWidth: 180,
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: HerwayColors.teal,
    padding: 2,
    backgroundColor: HerwayColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  greetingCol: { flex: 1, gap: 2, minWidth: 0 },
  greetingLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: HerwayColors.muted,
  },
  greetingName: {
    color: HerwayColors.ink,
  },
  locationChip: {
    alignSelf: 'flex-start',
    minHeight: HerwaySizes.buttonSmall,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
    marginTop: HerwaySpacing.xs,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.pill,
    backgroundColor: HerwayColors.white,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
  },
  locationChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: HerwayColors.ink,
  },
  roleSegmentedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HerwayColors.white,
    borderRadius: HerwayRadii.button,
    padding: HerwaySpacing.xs,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    minHeight: HerwaySizes.buttonSecondary,
  },
  roleSegmentedBtn: {
    minHeight: HerwaySizes.buttonSmall,
    paddingHorizontal: HerwaySpacing.md,
    borderRadius: HerwayRadii.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleSegmentedBtnActive: {
    backgroundColor: HerwayColors.ink,
  },
  roleSegmentedText: {
    fontSize: 13,
    fontWeight: '700',
    color: HerwayColors.muted,
  },
  roleSegmentedTextActive: {
    color: HerwayColors.white,
  },
  pendingBanner: {
    alignSelf: 'flex-start',
  },
  heroCardFrame: {
    padding: HerwaySpacing.sm,
  },
  heroCardInner: {
    height: 168,
    borderRadius: HerwayRadii.input,
    overflow: 'hidden',
    position: 'relative',
  },
  heroCardInnerDesktop: {
    height: 192,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: HerwaySpacing.lg,
  },
  heroTitle: {
    color: HerwayColors.ink,
  },
  heroFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.md,
  },
  formGrid: { gap: HerwaySpacing.md },
  formGridDesktop: { flexDirection: 'row', flexWrap: 'wrap', gap: HerwaySpacing.md },
  formFieldHalf: { width: '48.8%' },
  formFieldFull: { width: '100%' },
  dateRow: { flexDirection: 'row', gap: HerwaySpacing.sm },
  dateColSmall: { flexDirection: 'column', gap: HerwaySpacing.md },
  bentoGrid: { gap: HerwaySpacing.md },
  bentoRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: HerwaySpacing.md,
  },
  bentoCard: {
    flex: 1,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  bentoTextBlock: {
    gap: HerwaySpacing.xs,
  },
  bentoIconTeal: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: HerwayColors.tealDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoIconSos: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: HerwayColors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: HerwayColors.ink,
  },
  bentoSub: {
    fontSize: 13,
    fontWeight: '500',
    color: HerwayColors.muted,
  },
  desktopGrid: { flexDirection: 'row', alignItems: 'flex-start' },
  desktopColLeft: { flex: 1.05, minWidth: 0 },
  desktopColRight: { flex: 0.95, minWidth: 0 },
  sectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.sm,
  },
  sectionRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  sectionTitle: { color: HerwayColors.ink },
  emptyPillRow: {
    backgroundColor: HerwayColors.inputBg,
    borderRadius: HerwayRadii.input,
    paddingHorizontal: HerwaySpacing.lg,
    paddingVertical: HerwaySpacing.md,
    alignItems: 'center',
  },
  emptyPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: HerwayColors.muted,
  },
  itemsStack: { gap: HerwaySpacing.md },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.sm,
  },
  activeTripRow: {
    minHeight: HerwaySizes.buttonPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.md,
    backgroundColor: HerwayColors.tealSoft,
    borderRadius: HerwayRadii.input,
    paddingHorizontal: HerwaySpacing.lg,
    paddingVertical: HerwaySpacing.md,
  },
  itemTitle: { fontSize: 15, fontWeight: '700', color: HerwayColors.ink, flex: 1 },
  itemMeta: { fontSize: 13, fontWeight: '500', color: HerwayColors.muted },
  journeyRow: {
    minHeight: HerwaySizes.buttonPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.md,
    backgroundColor: HerwayColors.inputBg,
    borderRadius: HerwayRadii.input,
    padding: HerwaySpacing.md,
  },
  journeyIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: HerwayColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInCard: {
    backgroundColor: HerwayColors.warningSoft,
    borderRadius: HerwayRadii.input,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.warningBorder,
    padding: HerwaySpacing.md,
    gap: HerwaySpacing.md,
  },
  checkInCardUrgent: {
    backgroundColor: HerwayColors.dangerSoft,
    borderColor: HerwayColors.dangerBorder,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: HerwaySpacing.md,
    backgroundColor: HerwayColors.inputBg,
    borderRadius: HerwayRadii.input,
    padding: HerwaySpacing.md,
  },
  notifTitle: { fontSize: 14, fontWeight: '700', color: HerwayColors.ink, flex: 1 },
  notifBody: { fontSize: 13, lineHeight: 19, color: HerwayColors.muted },
  notifActionLink: { fontSize: 12, fontWeight: '700', color: HerwayColors.tealDark },
});

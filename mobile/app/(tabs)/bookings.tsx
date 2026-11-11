import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HerwayColors, HerwayRadii, HerwaySizes, HerwaySpacing } from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useAuth } from '@/features/auth/AuthContext';
import { createIdempotencyKey, mobileApi } from '@/services/apiClient';
import { getRealtimeSocket } from '@/services/realtimeSocket';
import { showFeedback } from '@/services/feedback';
import {
  BookingCardRecord,
  BookingRequestCard,
} from '@/features/bookings/BookingRequestCard';
import {
  CollectionPaginationFooter,
  EmptyState,
  ErrorState,
  FilterChipBar,
  FilterChipOption,
  LiveUpdatePill,
  Modal,
  PageHeader,
  PrimaryButton,
  ResponsiveContainer,
  SearchInput,
  SecondaryButton,
  SkeletonLoader,
  StandardInput,
  StatusBadge,
  chunkRows,
  useGridColumnCount,
} from '@/components/ui';

type BookingFilterTab = 'ALL' | 'INCOMING_REQUESTS' | 'REQUESTS' | 'CONFIRMED' | 'HISTORY';

interface PaginatedBookingsResponse {
  items: BookingCardRecord[];
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
  meta?: {
    counts?: {
      all: number;
      incomingRequests: number;
      requests: number;
      confirmed: number;
      history: number;
    };
  };
}

const PAGE_SIZE = 18;

export default function BookingsTab() {
  const { user, token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const numCols = useGridColumnCount({ mobile: 1, tablet: 2, laptop: 2, desktop: 3 });

  const [bookings, setBookings] = useState<BookingCardRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [counts, setCounts] = useState({
    all: 0,
    incomingRequests: 0,
    requests: 0,
    confirmed: 0,
    history: 0,
  });

  const [filterTab, setFilterTab] = useState<BookingFilterTab>('ALL');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyActions, setBusyActions] = useState<Record<string, string>>({});
  const [hasPendingTopUpdate, setHasPendingTopUpdate] = useState(false);

  const [reviewTarget, setReviewTarget] = useState<BookingCardRecord | null>(null);
  const [rating, setRating] = useState(5);
  const [safetyScore, setSafetyScore] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const [spotTarget, setSpotTarget] = useState<BookingCardRecord | null>(null);
  const [spotName, setSpotName] = useState('');
  const [spotAddress, setSpotAddress] = useState('');
  const [savingSpot, setSavingSpot] = useState(false);

  const listRef = useRef<FlatList<BookingCardRecord[]> | null>(null);
  const scrollOffsetRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  const fetchBookingsPage = useCallback(
    async (opts: { reset?: boolean; skipOverride?: number } = {}) => {
      if (!user) return;
      const isReset = opts.reset ?? true;
      const skip = isReset ? 0 : (opts.skipOverride ?? bookings.length);
      if (isReset) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({
          paginated: 'true',
          limit: String(PAGE_SIZE),
          skip: String(skip),
        });
        if (filterTab !== 'ALL') params.set('filter', filterTab);
        if (debouncedSearch) params.set('search', debouncedSearch);

        const res = await mobileApi<PaginatedBookingsResponse>(
          `/bookings?${params.toString()}`,
        );

        setTotal(res.total);
        setHasMore(res.hasMore);
        if (res.meta?.counts) setCounts(res.meta.counts);
        setBookings((prev) => {
          if (isReset) return res.items;
          const byId = new Map<string, BookingCardRecord>();
          for (const item of prev) byId.set(item.id, item);
          for (const item of res.items) byId.set(item.id, item);
          return Array.from(byId.values());
        });
      } catch (err) {
        setError((err as Error).message || 'Unable to load bookings.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user, filterTab, debouncedSearch, bookings.length],
  );

  useEffect(() => {
    if (!user) return;
    void fetchBookingsPage({ reset: true, skipOverride: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, filterTab, debouncedSearch]);

  useEffect(() => {
    if (!user || !token) return;
    const socket = getRealtimeSocket(token);
    const onBookingCreated = (incoming: BookingCardRecord) => {
      setCounts((prev) => ({
        ...prev,
        all: prev.all + 1,
        incomingRequests:
          incoming.buddyId === user.id && incoming.status === 'REQUESTED'
            ? prev.incomingRequests + 1
            : prev.incomingRequests,
        requests:
          incoming.status === 'REQUESTED' || incoming.status === 'ACCEPTED'
            ? prev.requests + 1
            : prev.requests,
      }));
      setBookings((prev) => {
        if (prev.some((b) => b.id === incoming.id)) {
          return prev.map((b) => (b.id === incoming.id ? { ...b, ...incoming } : b));
        }
        return [incoming, ...prev];
      });
      setTotal((prev) => prev + 1);
      if (scrollOffsetRef.current > 180) {
        setHasPendingTopUpdate(true);
      }
    };

    const onBookingUpdated = (incoming: BookingCardRecord) => {
      setBookings((prev) => {
        const exists = prev.some((b) => b.id === incoming.id);
        return exists
          ? prev.map((b) => (b.id === incoming.id ? { ...b, ...incoming } : b))
          : prev;
      });
      // Synchronize server tab counts quietly
      void mobileApi<PaginatedBookingsResponse>('/bookings?paginated=true&limit=1&skip=0')
        .then((res) => {
          if (res.meta?.counts) setCounts(res.meta.counts);
        })
        .catch(() => {});
    };

    socket.on('booking:created', onBookingCreated);
    socket.on('booking:updated', onBookingUpdated);
    return () => {
      socket.off('booking:created', onBookingCreated);
      socket.off('booking:updated', onBookingUpdated);
    };
  }, [user, token]);

  async function runBookingAction(
    bookingId: string,
    actionKey: string,
    requestFn: () => Promise<BookingCardRecord>,
    successTitle: string,
    successMessage?: string,
  ) {
    if (busyActions[bookingId]) return;
    setBusyActions((prev) => ({ ...prev, [bookingId]: actionKey }));
    try {
      const updated = await requestFn();
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
      showFeedback({ tone: 'success', title: successTitle, message: successMessage });
      // Refresh counts cleanly without wiping list or scroll position
      void mobileApi<PaginatedBookingsResponse>('/bookings?paginated=true&limit=1&skip=0')
        .then((res) => {
          if (res.meta?.counts) setCounts(res.meta.counts);
        })
        .catch(() => {});
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Action Failed', message: (err as Error).message });
    } finally {
      setBusyActions((prev) => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
    }
  }

  async function respond(bookingId: string, decision: 'ACCEPTED' | 'REJECTED') {
    await runBookingAction(
      bookingId,
      decision === 'ACCEPTED' ? 'ACCEPT' : 'REJECT',
      () =>
        mobileApi<BookingCardRecord>(`/bookings/${bookingId}/respond`, {
          method: 'PATCH',
          idempotencyKey: createIdempotencyKey(`resp-${bookingId}-${decision}`),
          body: JSON.stringify({ decision }),
        }),
      decision === 'ACCEPTED' ? 'Booking Accepted' : 'Booking Declined',
      decision === 'ACCEPTED'
        ? 'Confirm the public meeting point to lock in your session.'
        : 'Traveller has been notified.',
    );
  }

  async function confirmPublicMeetingPoint(booking: BookingCardRecord) {
    await runBookingAction(
      booking.id,
      'CONFIRM',
      () =>
        mobileApi<BookingCardRecord>(`/bookings/${booking.id}/confirm`, {
          method: 'PATCH',
          idempotencyKey: createIdempotencyKey(`confirm-${booking.id}`),
          body: JSON.stringify({
            meetingPointName: booking.meetingPointName || 'Public Main Plaza / Transit Hub',
            isPublicMeetingPoint: true,
          }),
        }),
      'Public Spot Confirmed',
      `Meeting point: ${booking.meetingPointName || 'Public Main Plaza / Transit Hub'}.`,
    );
  }

  function openChangeSpotModal(booking: BookingCardRecord) {
    setSpotTarget(booking);
    setSpotName(booking.meetingPointName || '');
    setSpotAddress(booking.meetingPointAddress || '');
  }

  async function submitSpotChange() {
    if (!spotTarget || savingSpot) return;
    const cleanName = spotName.trim();
    if (!cleanName) {
      showFeedback({
        tone: 'error',
        title: 'Meeting Spot Required',
        message: 'Enter or choose a well-lit public meeting spot.',
      });
      return;
    }

    const booking = spotTarget;
    setSavingSpot(true);
    try {
      await runBookingAction(
        booking.id,
        'CHANGE_SPOT',
        () =>
          mobileApi<BookingCardRecord>(`/bookings/${booking.id}/confirm`, {
            method: 'PATCH',
            idempotencyKey: createIdempotencyKey(`spot-${booking.id}-${cleanName}`),
            body: JSON.stringify({
              meetingPointName: cleanName,
              meetingPointAddress: spotAddress.trim() || undefined,
              isPublicMeetingPoint: true,
            }),
          }),
        'Public Spot Updated',
        `Proposed "${cleanName}". Both participants confirm before final lock.`,
      );
      setSpotTarget(null);
    } finally {
      setSavingSpot(false);
    }
  }

  async function completeBooking(id: string) {
    await runBookingAction(
      id,
      'COMPLETE',
      () =>
        mobileApi<BookingCardRecord>(`/bookings/${id}/complete`, {
          method: 'PATCH',
          idempotencyKey: createIdempotencyKey(`complete-${id}`),
        }),
      'Session Completed',
      'You can now leave a rating and safety review.',
    );
  }

  async function cancelBooking(id: string) {
    await runBookingAction(
      id,
      'CANCEL',
      () =>
        mobileApi<BookingCardRecord>(`/bookings/${id}/cancel`, {
          method: 'PATCH',
          idempotencyKey: createIdempotencyKey(`cancel-${id}`),
          body: JSON.stringify({ reason: 'Schedule changed by participant' }),
        }),
      'Booking Cancelled',
      'Booking updated and participant notified.',
    );
  }

  async function reportNoShow(id: string) {
    await runBookingAction(
      id,
      'NOSHOW',
      () =>
        mobileApi<BookingCardRecord>(`/bookings/${id}/no-show`, {
          method: 'POST',
          body: JSON.stringify({ notes: 'Other party did not arrive at public meeting point' }),
        }),
      'No-Show Logged',
      'Dispute opened for admin review.',
    );
  }

  async function submitReview() {
    if (!reviewTarget || submittingReview) return;
    setSubmittingReview(true);
    try {
      const targetId = reviewTarget.id;
      const savedReview = await mobileApi<{ id: string; rating: number; comment?: string | null }>(
        `/bookings/${targetId}/reviews`,
        {
          method: 'POST',
          idempotencyKey: createIdempotencyKey(`review-${targetId}`),
          body: JSON.stringify({
            rating,
            safetyScore,
            comment: reviewComment.trim() || undefined,
          }),
        },
      );
      setBookings((prev) =>
        prev.map((b) =>
          b.id === targetId ? { ...b, reviews: [...(b.reviews || []), savedReview] } : b,
        ),
      );
      setReviewTarget(null);
      setReviewComment('');
      showFeedback({
        tone: 'success',
        title: 'Review Saved',
        message: 'Thank you for sharing your Travel Buddy safety feedback.',
      });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Review Failed', message: (err as Error).message });
    } finally {
      setSubmittingReview(false);
    }
  }

  const filterOptions: FilterChipOption<BookingFilterTab>[] = useMemo(
    () => [
      { value: 'ALL', label: 'All', count: counts.all },
      ...(user?.roles.includes('TRAVEL_BUDDY') || counts.incomingRequests > 0
        ? [
            {
              value: 'INCOMING_REQUESTS' as const,
              label: 'Incoming',
              count: counts.incomingRequests,
            },
          ]
        : []),
      { value: 'REQUESTS', label: 'Requests', count: counts.requests },
      { value: 'CONFIRMED', label: 'Confirmed', count: counts.confirmed },
      { value: 'HISTORY', label: 'History', count: counts.history },
    ],
    [counts, user?.roles],
  );

  const visibleRows = useMemo(() => chunkRows(bookings, numCols), [bookings, numCols]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
    if (e.nativeEvent.contentOffset.y < 100) {
      setHasPendingTopUpdate(false);
    }
  }, []);

  if (!user) {
    return (
      <View style={styles.emptyBox}>
        <StatusBar style="dark" />
        <View style={styles.emptyCenter}>
          <EmptyState
            icon="event-note"
            title="Bookings & Private Chat"
            description="Sign in to view your Travel Buddy booking requests, confirmations, reviews, and private chats."
            actionLabel="Sign In to View Bookings"
            onAction={() => router.push('/(auth)/login' as Href)}
          />
        </View>
      </View>
    );
  }

  const spotCityPrefix =
    spotTarget?.buddy?.homeCity ||
    spotTarget?.traveller?.homeCity ||
    user.homeCity ||
    'City';
  const publicSpotPresets = [
    `${spotCityPrefix} Public Transit / Plaza`,
    `${spotCityPrefix} Railway Station Main Gate`,
    `${spotCityPrefix} Police Aid Post / Help Desk`,
    `${spotCityPrefix} Central Mall Atrium`,
  ];

  const topPad = layout.isWideLayout
    ? HerwaySpacing.xl
    : Math.max(insets.top + HerwaySpacing.lg, HerwaySpacing.section);
  const bottomPad = layout.isWideLayout ? HerwaySpacing.section : 140;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <Modal
        visible={Boolean(spotTarget)}
        onClose={() => !savingSpot && setSpotTarget(null)}
        title="Change Public Meeting Spot"
        subtitle={
          spotTarget
            ? `${spotTarget.activitySummary} • Both participants must confirm a changed public spot`
            : undefined
        }
        maxWidth={480}
        footer={
          <View style={styles.btnRow}>
            <SecondaryButton
              label="Cancel"
              disabled={savingSpot}
              onPress={() => setSpotTarget(null)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label={savingSpot ? 'Updating...' : 'Save Public Spot'}
              loading={savingSpot}
              disabled={savingSpot}
              onPress={submitSpotChange}
              style={{ flex: 1.4 }}
            />
          </View>
        }
      >
        <View style={{ gap: HerwaySpacing.md }}>
          <View style={{ gap: HerwaySpacing.xs }}>
            <Text style={styles.fieldLabel}>Quick verified public landmark ideas</Text>
            <View style={styles.presetWrap}>
              {publicSpotPresets.map((preset) => {
                const selected = spotName.trim().toLowerCase() === preset.toLowerCase();
                return (
                  <Pressable
                    key={preset}
                    onPress={() => setSpotName(preset)}
                    style={[styles.presetChip, selected && styles.presetChipActive]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${preset}`}
                  >
                    <Text
                      style={[styles.presetText, selected && styles.presetTextActive]}
                      numberOfLines={1}
                    >
                      {preset}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <StandardInput
            label="Public Meeting Point"
            value={spotName}
            onChangeText={setSpotName}
            placeholder="e.g. Alappuzha KSRTC Transit Hub Main Gate"
            surface="white"
          />

          <StandardInput
            label="Landmark / Street Details (optional)"
            value={spotAddress}
            onChangeText={setSpotAddress}
            placeholder="Near ticket counter or Safe Haven reception desk"
            surface="white"
          />
        </View>
      </Modal>

      <Modal
        visible={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        title="Rate & Review Session"
        subtitle={
          reviewTarget
            ? `${reviewTarget.activitySummary} • Buddy: ${reviewTarget.buddy.fullName}`
            : undefined
        }
        maxWidth={440}
        footer={
          <View style={styles.btnRow}>
            <SecondaryButton
              label="Cancel"
              disabled={submittingReview}
              onPress={() => setReviewTarget(null)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label={submittingReview ? 'Submitting...' : 'Submit Review'}
              loading={submittingReview}
              disabled={submittingReview}
              onPress={submitReview}
              style={{ flex: 1.3 }}
            />
          </View>
        }
      >
        <View style={{ gap: HerwaySpacing.md }}>
          <View style={{ gap: HerwaySpacing.xs }}>
            <Text style={styles.fieldLabel}>Overall Rating ({rating}/5)</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setRating(n)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Set rating ${n} out of 5`}
                >
                  <MaterialIcons
                    name={n <= rating ? 'star' : 'star-border'}
                    size={28}
                    color={n <= rating ? HerwayColors.warning : HerwayColors.muted}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: HerwaySpacing.xs }}>
            <Text style={styles.fieldLabel}>Safety Score ({safetyScore}/5)</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setSafetyScore(n)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Set safety score ${n} out of 5`}
                >
                  <MaterialIcons
                    name={n <= safetyScore ? 'verified-user' : 'shield'}
                    size={26}
                    color={n <= safetyScore ? HerwayColors.teal : HerwayColors.borderStrong}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          <StandardInput
            label="Note (optional)"
            value={reviewComment}
            onChangeText={setReviewComment}
            placeholder="Share how safe and helpful the meetup felt"
            multiline
            surface="white"
          />
        </View>
      </Modal>

      <FlatList
        ref={listRef}
        data={loading && bookings.length === 0 ? [] : visibleRows}
        key={`bookings-cols-${numCols}`}
        keyExtractor={(row) => row.map((item) => item.id).join('_')}
        onScroll={handleScroll}
        scrollEventThrottle={120}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        contentContainerStyle={{
          paddingTop: topPad,
          paddingBottom: bottomPad,
          gap: layout.gridGap,
        }}
        ListHeaderComponent={
          <ResponsiveContainer>
            <PageHeader
              title="Bookings"
              subtitle="Manage meetup requests, confirm public meeting points, and open private masked chat"
              rightSlot={
                counts.incomingRequests > 0 ? (
                  <StatusBadge
                    label={`${counts.incomingRequests} Pending Request${counts.incomingRequests > 1 ? 's' : ''}`}
                    tone="warn"
                  />
                ) : undefined
              }
            />

            <View style={styles.controlsGroup}>
              <SearchInput
                placeholder="Search bookings, people, or spots..."
                value={searchText}
                onChangeText={setSearchText}
                onClear={() => setSearchText('')}
              />
              <FilterChipBar
                options={filterOptions}
                value={filterTab}
                onChange={setFilterTab}
              />
            </View>

            {hasPendingTopUpdate && (
              <LiveUpdatePill
                label="New booking update at top"
                onPress={() => {
                  setHasPendingTopUpdate(false);
                  listRef.current?.scrollToOffset({ offset: 0, animated: true });
                }}
              />
            )}

            {error ? (
              <ErrorState
                inline
                message={error}
                onRetry={() => fetchBookingsPage({ reset: true, skipOverride: 0 })}
              />
            ) : null}

            {loading && bookings.length === 0 ? <SkeletonLoader count={3} height={138} /> : null}
          </ResponsiveContainer>
        }
        renderItem={({ item: row }) => (
          <ResponsiveContainer noPadding={false}>
            <View style={[styles.gridRow, { gap: layout.gridGap }]}>
              {row.map((b) => (
                <View key={b.id} style={styles.gridCell}>
                  <BookingRequestCard
                    booking={b}
                    currentUserId={user.id}
                    busyAction={busyActions[b.id]}
                    onOpenChat={(id) => router.push(`/chat/${id}`)}
                    onRespond={respond}
                    onConfirmSpot={confirmPublicMeetingPoint}
                    onChangeSpot={openChangeSpotModal}
                    onComplete={completeBooking}
                    onNoShow={reportNoShow}
                    onCancel={cancelBooking}
                    onLeaveReview={setReviewTarget}
                  />
                </View>
              ))}
              {row.length < numCols &&
                Array.from({ length: numCols - row.length }).map((_, idx) => (
                  <View key={`spacer-${idx}`} style={styles.gridCell} />
                ))}
            </View>
          </ResponsiveContainer>
        )}
        ListEmptyComponent={
          !loading ? (
            <ResponsiveContainer>
              <EmptyState
                icon="event-busy"
                title={debouncedSearch ? 'No matching bookings' : 'No bookings in this view'}
                description={
                  debouncedSearch
                    ? 'Try clearing your search term or switching booking filters.'
                    : 'Discover verified Travel Buddies in the Companions tab to request a safe meetup.'
                }
                actionLabel={debouncedSearch ? 'Reset Search' : 'Find a Travel Buddy'}
                onAction={() => {
                  if (debouncedSearch) {
                    setSearchText('');
                  } else {
                    router.push('/(tabs)/people' as Href);
                  }
                }}
              />
            </ResponsiveContainer>
          ) : null
        }
        ListFooterComponent={
          bookings.length > 0 ? (
            <ResponsiveContainer>
              <CollectionPaginationFooter
                visibleCount={bookings.length}
                totalCount={total}
                hasMore={hasMore}
                loadingMore={loadingMore}
                noun="bookings"
                onLoadMore={() =>
                  fetchBookingsPage({ reset: false, skipOverride: bookings.length })
                }
              />
            </ResponsiveContainer>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: HerwayColors.creamBg },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    padding: HerwaySpacing.xl,
    backgroundColor: HerwayColors.creamBg,
  },
  emptyCenter: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  controlsGroup: {
    gap: HerwaySpacing.sm,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
  },
  gridCell: {
    flex: 1,
    minWidth: 0,
  },
  btnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
    marginTop: HerwaySpacing.sm,
  },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: HerwayColors.ink },
  starsRow: { flexDirection: 'row', gap: HerwaySpacing.sm },
  presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: HerwaySpacing.xs },
  presetChip: {
    minHeight: HerwaySizes.buttonSmall,
    justifyContent: 'center',
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.pill,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    backgroundColor: HerwayColors.inputBg,
    maxWidth: '100%',
  },
  presetChipActive: {
    backgroundColor: HerwayColors.tealSoft,
    borderColor: HerwayColors.teal,
  },
  presetText: { fontSize: 12, fontWeight: '600', color: HerwayColors.ink },
  presetTextActive: { color: HerwayColors.tealDark, fontWeight: '700' },
});

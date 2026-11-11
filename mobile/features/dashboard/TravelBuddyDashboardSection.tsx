import React, { useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { Href, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  HerwayColors,
  HerwayRadii,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useAuth } from '@/features/auth/AuthContext';
import { useHerwayState } from '@/features/app/HerwayStateContext';
import { createIdempotencyKey, mobileApi } from '@/services/apiClient';
import { showFeedback } from '@/services/feedback';
import {
  BookingCardRecord,
  BookingRequestCard,
} from '@/features/bookings/BookingRequestCard';
import {
  CollectionPaginationFooter,
  EmptyState,
  FilterChipBar,
  PrimaryButton,
  SearchInput,
  SmallButton,
  StandardCard,
  StandardInput,
  StatusBadge,
} from '@/components/ui';

export type BuddyBookingItem = BookingCardRecord;

interface TravelBuddyDashboardSectionProps {
  bookings: BuddyBookingItem[];
  onReload: () => Promise<void>;
  isDesktop: boolean;
  viewAll?: boolean;
}

type BuddyQueueTab = 'REQUESTED' | 'CONFIRMED' | 'HISTORY' | 'ALL';

const SERVICE_OPTIONS = [
  'City Orientation',
  'Airport Pickup Escort',
  'Market Visits',
  'Language Help',
  'Heritage Walks',
  'Cafe & Transit Help',
];

const INITIAL_QUEUE_PAGE = 6;
const INITIAL_REVIEWS_PAGE = 4;

export function TravelBuddyDashboardSection({
  bookings,
  onReload,
}: TravelBuddyDashboardSectionProps) {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const { user, refreshProfile } = useAuth();
  const { selectedCity } = useHerwayState();

  const buddyProfile = user?.buddyProfile;
  const isVerified = Boolean(buddyProfile?.isVerified || user?.roles.includes('TRAVEL_BUDDY'));

  const [isAvailable, setIsAvailable] = useState(buddyProfile?.isAvailable ?? true);
  const [editingServices, setEditingServices] = useState(false);
  const [headline, setHeadline] = useState(
    buddyProfile?.headline || `Local Travel Buddy in ${user?.homeCity || selectedCity}`,
  );
  const [city, setCity] = useState(buddyProfile?.city || user?.homeCity || selectedCity);
  const [services, setServices] = useState<string[]>(
    buddyProfile?.servicesOffered?.length
      ? buddyProfile.servicesOffered
      : ['City Orientation', 'Language Help'],
  );
  const [languagesCsv, setLanguagesCsv] = useState(
    (buddyProfile?.languages || user?.languages || ['English', 'Malayalam']).join(', '),
  );
  const [hourlyRate, setHourlyRate] = useState(String(buddyProfile?.hourlyRateInr ?? 500));
  const [savingProfile, setSavingProfile] = useState(false);
  const [busyActions, setBusyActions] = useState<Record<string, string>>({});
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, string>>({});

  const [queueTab, setQueueTab] = useState<BuddyQueueTab>('REQUESTED');
  const [queueSearch, setQueueSearch] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_QUEUE_PAGE);
  const [reviewsLimit, setReviewsLimit] = useState(INITIAL_REVIEWS_PAGE);

  const buddyBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.buddyId === user?.id)
        .map((b) => ({
          ...b,
          status:
            optimisticStatuses[b.id] && b.status === 'REQUESTED'
              ? optimisticStatuses[b.id]
              : b.status,
        })),
    [bookings, user?.id, optimisticStatuses],
  );

  const queueCounts = useMemo(() => {
    let requested = 0;
    let confirmed = 0;
    let history = 0;
    for (const b of buddyBookings) {
      if (b.status === 'REQUESTED') requested += 1;
      else if (b.status === 'ACCEPTED' || b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS') {
        confirmed += 1;
      } else {
        history += 1;
      }
    }
    return { requested, confirmed, history, all: buddyBookings.length };
  }, [buddyBookings]);

  const filteredQueue = useMemo(() => {
    const q = queueSearch.trim().toLowerCase();
    return buddyBookings.filter((b) => {
      if (queueTab === 'REQUESTED' && b.status !== 'REQUESTED') return false;
      if (
        queueTab === 'CONFIRMED' &&
        b.status !== 'ACCEPTED' &&
        b.status !== 'CONFIRMED' &&
        b.status !== 'IN_PROGRESS'
      ) {
        return false;
      }
      if (
        queueTab === 'HISTORY' &&
        b.status !== 'COMPLETED' &&
        b.status !== 'CANCELLED' &&
        b.status !== 'REJECTED'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        b.traveller.fullName.toLowerCase().includes(q) ||
        b.activitySummary.toLowerCase().includes(q) ||
        (b.meetingPointName || '').toLowerCase().includes(q)
      );
    });
  }, [buddyBookings, queueTab, queueSearch]);

  const visibleQueue = useMemo(
    () => filteredQueue.slice(0, visibleLimit),
    [filteredQueue, visibleLimit],
  );

  const recentReviews = useMemo(() => {
    const out: Array<{ id: string; rating: number; comment?: string | null; traveller: string }> =
      [];
    for (const b of buddyBookings) {
      for (const r of b.reviews ?? []) {
        out.push({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          traveller: b.traveller.fullName,
        });
      }
    }
    return out;
  }, [buddyBookings]);

  async function toggleAvailability(next: boolean) {
    const prevVal = isAvailable;
    setIsAvailable(next);
    try {
      await mobileApi('/buddies/profile', {
        method: 'PUT',
        body: JSON.stringify({
          headline,
          city,
          servicesOffered: services,
          languages: languagesCsv
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          hourlyRateInr: Number(hourlyRate) || 500,
          isAvailable: next,
        }),
      });
      await refreshProfile();
      showFeedback({
        tone: 'success',
        title: next ? 'Available for bookings ✓' : 'Marked Unavailable',
      });
    } catch (err) {
      setIsAvailable(prevVal);
      showFeedback({
        tone: 'error',
        title: 'Availability Update Failed',
        message: (err as Error).message,
      });
    }
  }

  async function saveBuddyDetails() {
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      await mobileApi('/buddies/profile', {
        method: 'PUT',
        body: JSON.stringify({
          headline: headline.trim() || 'Verified Travel Buddy',
          city: city.trim() || 'Kochi',
          servicesOffered: services,
          languages: languagesCsv
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          hourlyRateInr: Number(hourlyRate) || 500,
          isAvailable,
        }),
      });
      await refreshProfile();
      setEditingServices(false);
      showFeedback({
        tone: 'success',
        title: 'Buddy Profile Saved',
        message: 'Your services and availability were updated.',
      });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Update Failed', message: (err as Error).message });
    } finally {
      setSavingProfile(false);
    }
  }

  async function respondToRequest(bookingId: string, decision: 'ACCEPTED' | 'REJECTED') {
    if (busyActions[bookingId]) return;
    setBusyActions((prev) => ({ ...prev, [bookingId]: decision === 'ACCEPTED' ? 'ACCEPT' : 'REJECT' }));
    try {
      await mobileApi(`/bookings/${bookingId}/respond`, {
        method: 'PATCH',
        idempotencyKey: createIdempotencyKey(`buddy-resp-${bookingId}-${decision}`),
        body: JSON.stringify({ decision }),
      });
      setOptimisticStatuses((prev) => ({ ...prev, [bookingId]: decision }));
      showFeedback({
        tone: 'success',
        title: decision === 'ACCEPTED' ? 'Booking Accepted ✓' : 'Booking Declined',
        message:
          decision === 'ACCEPTED'
            ? 'Traveller notified. Confirm a public meeting spot to finalize.'
            : 'Traveller has been notified.',
      });
      await onReload();
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

  async function confirmSpot(booking: BuddyBookingItem) {
    if (busyActions[booking.id]) return;
    setBusyActions((prev) => ({ ...prev, [booking.id]: 'CONFIRM' }));
    try {
      await mobileApi(`/bookings/${booking.id}/confirm`, {
        method: 'PATCH',
        idempotencyKey: createIdempotencyKey(`buddy-confirm-${booking.id}`),
        body: JSON.stringify({
          meetingPointName: booking.meetingPointName || 'Public Main Plaza / Transit Hub',
          isPublicMeetingPoint: true,
        }),
      });
      showFeedback({ tone: 'success', title: 'Public Meeting Point Confirmed' });
      await onReload();
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Action Failed', message: (err as Error).message });
    } finally {
      setBusyActions((prev) => {
        const next = { ...prev };
        delete next[booking.id];
        return next;
      });
    }
  }

  function toggleService(s: string) {
    setServices((prev) =>
      prev.includes(s) ? prev.filter((item) => item !== s) : [...prev, s],
    );
  }

  const verificationLabel = isVerified ? 'BUDDY ACTIVE' : 'BUDDY READY';
  const twoCols = layout.isWideLayout;

  return (
    <View style={[styles.wrapper, { gap: layout.sectionGap }]}>
      <StandardCard>
        <View style={styles.rowBetween}>
          <View style={styles.headerTextCol}>
            <Text style={[layout.type.cardHeading, styles.title]}>Buddy Profile</Text>
            <Text style={[layout.type.secondary, styles.sub]} numberOfLines={2}>
              {headline}
            </Text>
          </View>
          <StatusBadge label={verificationLabel} tone="safe" />
        </View>

        <View style={styles.availabilityRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.availLabel}>Available for bookings</Text>
            <Text style={styles.meta}>
              {isAvailable ? 'Visible to travellers' : 'Hidden from requests'}
            </Text>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={toggleAvailability}
            trackColor={{ false: HerwayColors.dotInactive, true: HerwayColors.teal }}
            thumbColor={HerwayColors.white}
          />
        </View>
      </StandardCard>

      <View style={[twoCols ? styles.desktopGrid : styles.mobileCol, { gap: layout.gridGap }]}>
        <View style={[styles.col, twoCols && { flex: 1.2 }, { gap: layout.gridGap }]}>
          <StandardCard>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[layout.type.cardHeading, styles.title]}>Booking Queue</Text>
                <Text style={styles.meta}>
                  Manage incoming requests, confirmed sessions, and past bookings
                </Text>
              </View>
              <StatusBadge
                label={`${queueCounts.requested} New`}
                tone={queueCounts.requested > 0 ? 'warn' : 'neutral'}
              />
            </View>

            <SearchInput
              placeholder="Search traveller, activity, or spot..."
              value={queueSearch}
              onChangeText={(txt) => {
                setQueueSearch(txt);
                setVisibleLimit(INITIAL_QUEUE_PAGE);
              }}
              onClear={() => setQueueSearch('')}
            />

            <FilterChipBar
              scrollable
              value={queueTab}
              onChange={(next) => {
                setQueueTab(next);
                setVisibleLimit(INITIAL_QUEUE_PAGE);
              }}
              options={[
                { value: 'REQUESTED', label: 'Incoming', count: queueCounts.requested },
                { value: 'CONFIRMED', label: 'Confirmed', count: queueCounts.confirmed },
                { value: 'HISTORY', label: 'History', count: queueCounts.history },
                { value: 'ALL', label: 'All', count: queueCounts.all },
              ]}
            />

            {filteredQueue.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="No bookings in this view"
                description={
                  queueSearch.trim()
                    ? 'No matching requests found for your search.'
                    : 'New traveller requests will appear here immediately.'
                }
              />
            ) : (
              <View style={styles.queueStack}>
                {visibleQueue.map((req) => (
                  <BookingRequestCard
                    key={req.id}
                    booking={req}
                    currentUserId={user?.id || ''}
                    busyAction={busyActions[req.id]}
                    compact
                    onOpenChat={(id) => router.push(`/chat/${id}`)}
                    onRespond={respondToRequest}
                    onConfirmSpot={confirmSpot}
                  />
                ))}

                <CollectionPaginationFooter
                  visibleCount={visibleQueue.length}
                  totalCount={filteredQueue.length}
                  hasMore={visibleQueue.length < filteredQueue.length}
                  noun="requests"
                  onLoadMore={() => setVisibleLimit((prev) => prev + INITIAL_QUEUE_PAGE)}
                />

                {filteredQueue.length > INITIAL_QUEUE_PAGE && (
                  <SmallButton
                    label="Manage All in Bookings Tab"
                    tone="tealSoft"
                    onPress={() => router.push('/(tabs)/bookings' as Href)}
                  />
                )}
              </View>
            )}
          </StandardCard>
        </View>

        <View style={[styles.col, twoCols && { flex: 0.8 }, { gap: layout.gridGap }]}>
          <StandardCard>
            <View style={styles.rowBetween}>
              <Text style={[layout.type.cardHeading, styles.title]}>Services &amp; Rates</Text>
              <SmallButton
                label={editingServices ? 'Close' : 'Edit'}
                tone="tealSoft"
                onPress={() => setEditingServices((v) => !v)}
              />
            </View>

            {!editingServices ? (
              <View style={{ gap: HerwaySpacing.sm }}>
                <Text style={styles.meta}>
                  {city} • ₹{hourlyRate}/hr • {languagesCsv}
                </Text>
                <View style={styles.chipsWrap}>
                  {services.map((s) => (
                    <View key={s} style={styles.serviceChip}>
                      <Text style={styles.serviceChipText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={{ gap: HerwaySpacing.md }}>
                <StandardInput
                  label="Headline"
                  value={headline}
                  onChangeText={setHeadline}
                  placeholder="Headline"
                />
                <StandardInput
                  label="City"
                  value={city}
                  onChangeText={setCity}
                  placeholder="City"
                />
                <StandardInput
                  label="Languages"
                  value={languagesCsv}
                  onChangeText={setLanguagesCsv}
                  placeholder="English, Malayalam"
                />
                <StandardInput
                  label="Hourly Rate (INR)"
                  value={hourlyRate}
                  onChangeText={setHourlyRate}
                  keyboardType="numeric"
                  placeholder="500"
                />
                <View style={styles.chipsWrap}>
                  {SERVICE_OPTIONS.map((opt) => {
                    const active = services.includes(opt);
                    return (
                      <Pressable
                        key={opt}
                        onPress={() => toggleService(opt)}
                        style={[styles.serviceChip, active && styles.serviceChipActive]}
                      >
                        <Text
                          style={[
                            styles.serviceChipText,
                            active && styles.serviceChipTextActive,
                          ]}
                        >
                          {opt}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <PrimaryButton
                  label={savingProfile ? 'Saving...' : 'Save Changes'}
                  loading={savingProfile}
                  disabled={savingProfile}
                  onPress={saveBuddyDetails}
                  fullWidth
                />
              </View>
            )}
          </StandardCard>

          <StandardCard>
            <View style={styles.rowBetween}>
              <Text style={[layout.type.cardHeading, styles.title]}>Reviews</Text>
              <View style={styles.ratingBadge}>
                <MaterialIcons name="star" size={15} color={HerwayColors.warning} />
                <Text style={styles.ratingText}>
                  {(buddyProfile?.ratingAverage ?? 5.0).toFixed(1)} (
                  {buddyProfile?.reviewCount ?? recentReviews.length})
                </Text>
              </View>
            </View>
            {recentReviews.length === 0 ? (
              <Text style={styles.meta}>No reviews yet.</Text>
            ) : (
              <View style={{ gap: HerwaySpacing.sm }}>
                {recentReviews.slice(0, reviewsLimit).map((r) => (
                  <View key={r.id} style={styles.reviewBox}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      ★ {r.rating}/5 • {r.traveller}
                    </Text>
                    {r.comment ? (
                      <Text style={styles.meta} numberOfLines={3}>
                        {r.comment}
                      </Text>
                    ) : null}
                  </View>
                ))}
                {reviewsLimit < recentReviews.length && (
                  <SmallButton
                    label={`Show more reviews (${recentReviews.length - reviewsLimit})`}
                    tone="tealSoft"
                    onPress={() => setReviewsLimit((prev) => prev + INITIAL_REVIEWS_PAGE)}
                  />
                )}
              </View>
            )}
          </StandardCard>

          <StandardCard>
            <View style={styles.rowBetween}>
              <Text style={[layout.type.cardHeading, styles.title]}>Sessions</Text>
              <StatusBadge
                label={`${buddyBookings.filter((b) => b.status === 'COMPLETED').length} Done`}
                tone="neutral"
              />
            </View>
            <Text style={styles.meta}>Payouts disabled in pilot.</Text>
          </StandardCard>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  desktopGrid: { flexDirection: 'row', alignItems: 'flex-start' },
  mobileCol: { width: '100%' },
  col: { width: '100%', minWidth: 0 },
  rowBetween: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.sm,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 180,
    gap: HerwaySpacing.xs,
  },
  title: { color: HerwayColors.ink },
  sub: { color: HerwayColors.tealDark },
  meta: { fontSize: 13, color: HerwayColors.muted, lineHeight: 19 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: HerwayColors.ink },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.md,
    backgroundColor: HerwayColors.creamBg,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.borderSubtle,
    padding: HerwaySpacing.md,
    borderRadius: HerwayRadii.input,
  },
  availLabel: { fontSize: 14, fontWeight: '700', color: HerwayColors.ink },
  queueStack: {
    gap: HerwaySpacing.md,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: HerwaySpacing.sm,
  },
  serviceChip: {
    minHeight: HerwaySizes.buttonSmall,
    justifyContent: 'center',
    backgroundColor: HerwayColors.inputBg,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.pill,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.inputBorder,
  },
  serviceChipActive: {
    backgroundColor: HerwayColors.tealDark,
    borderColor: HerwayColors.tealDark,
  },
  serviceChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: HerwayColors.ink,
  },
  serviceChipTextActive: {
    color: HerwayColors.white,
    fontWeight: '700',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
    backgroundColor: HerwayColors.warningSoft,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.warningBorder,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.pill,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: HerwayColors.warningText,
  },
  reviewBox: {
    backgroundColor: HerwayColors.creamBg,
    borderRadius: HerwayRadii.input,
    padding: HerwaySpacing.md,
    gap: HerwaySpacing.xs,
  },
});

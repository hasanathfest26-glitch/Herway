import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HerwayColors,
  HerwayRadii,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useAuth } from '@/features/auth/AuthContext';
import { createIdempotencyKey, mobileApi } from '@/services/apiClient';
import { invalidateQueryPrefix } from '@/services/queryCache';
import { showFeedback } from '@/services/feedback';
import {
  LiveCoordinates,
  readCurrentLocationIfGranted,
  requestAndFetchLiveLocation,
} from '@/services/locationService';
import { PILOT_CITIES } from '@/data/herwayCatalog';
import { UserAvatar } from '@/components/UserAvatar';
import {
  CollectionPaginationFooter,
  EmptyState,
  ErrorState,
  ExpandableToggleRow,
  Modal,
  PageHeader,
  PrimaryButton,
  ResponsiveContainer,
  SearchInput,
  SecondaryButton,
  SkeletonLoader,
  SmallButton,
  StandardCard,
  StandardInput,
  StatusBadge,
  chunkRows,
  useGridColumnCount,
} from '@/components/ui';

type Category = 'TRAVELLERS' | 'BUDDIES';

interface TravellerCardData {
  id: string;
  fullName: string;
  homeCity?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  distanceBand: string;
  languages: string[];
  interests: string[];
  upcomingTrips: Array<{
    id?: string;
    title: string;
    destinationCity: string;
    startDate: string;
    endDate: string;
  }>;
}

interface BuddyCardData {
  id: string;
  fullName: string;
  city: string;
  headline: string;
  avatarUrl?: string | null;
  distanceBand: string;
  languages: string[];
  servicesOffered: string[];
  interests?: string[];
  hourlyRateInr: number;
  ratingAverage: number;
  reviewCount?: number;
  isAvailable: boolean;
}

interface PaginatedDiscoveryResponse<T> {
  items: T[];
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
}

const PAGE_SIZE = 18;

const DiscoveryCard = React.memo(function DiscoveryCard({
  category,
  item,
  busyBooking,
  sentBooking,
  busyFav,
  isFaved,
  onRequestBooking,
  onToggleFavourite,
  onBlockOrReport,
}: {
  category: Category;
  item: TravellerCardData | BuddyCardData;
  busyBooking: boolean;
  sentBooking: boolean;
  busyFav: boolean;
  isFaved: boolean;
  onRequestBooking: (buddy: BuddyCardData) => void;
  onToggleFavourite: (id: string) => void;
  onBlockOrReport: (id: string, name: string) => void;
}) {
  const layout = useResponsiveLayout();
  const [expanded, setExpanded] = useState(false);

  if (category === 'TRAVELLERS') {
    const t = item as TravellerCardData;
    const hasDetails = Boolean(
      (t.bio && t.bio.length > 0) ||
        t.languages.length > 3 ||
        t.interests.length > 3 ||
        t.upcomingTrips.length > 0,
    );
    return (
      <StandardCard style={styles.gridCardStretch}>
        <View style={styles.cardBody}>
          <View style={styles.rowBetween}>
            <View style={styles.personHeader}>
              <UserAvatar uri={t.avatarUrl} size={42} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[layout.type.cardHeading, styles.name]}
                  numberOfLines={expanded ? undefined : 1}
                >
                  {t.fullName}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {[t.homeCity || 'Kerala', t.distanceBand].filter(Boolean).join(' • ')}
                </Text>
              </View>
            </View>
            <View style={styles.badgeWrap}>
              <StatusBadge label="Traveller" tone="safe" />
            </View>
          </View>

          {t.languages.length > 0 ? (
            <Text style={styles.meta} numberOfLines={expanded ? undefined : 1}>
              Languages: {t.languages.join(', ')}
            </Text>
          ) : null}

          {t.interests.length > 0 ? (
            <Text style={styles.meta} numberOfLines={expanded ? undefined : 2}>
              Interests: {t.interests.join(', ')}
            </Text>
          ) : null}

          {expanded && (
            <View style={styles.expandedDetails}>
              {t.bio ? <Text style={styles.detailText}>{t.bio}</Text> : null}
              {t.upcomingTrips.map((tr, idx) => (
                <Text key={tr.id || idx} style={styles.detailText}>
                  Upcoming: {tr.title} ({tr.destinationCity})
                </Text>
              ))}
            </View>
          )}

          {hasDetails && (
            <ExpandableToggleRow
              expanded={expanded}
              onToggle={() => setExpanded((v) => !v)}
              expandLabel="More details"
              collapseLabel="Less details"
            />
          )}
        </View>

        <View style={styles.actionsRow}>
          <SecondaryButton
            label="Report / Block"
            onPress={() => onBlockOrReport(t.id, t.fullName)}
            style={styles.compactSecondary}
          />
        </View>
      </StandardCard>
    );
  }

  const b = item as BuddyCardData;
  const hasLongDetails = Boolean(
    b.headline.length > 44 || b.servicesOffered.length > 3 || b.languages.length > 3,
  );

  return (
    <StandardCard style={styles.gridCardStretch}>
      <View style={styles.cardBody}>
        <View style={styles.rowBetween}>
          <View style={styles.personHeader}>
            <UserAvatar uri={b.avatarUrl} size={42} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[layout.type.cardHeading, styles.name]}
                numberOfLines={expanded ? undefined : 1}
              >
                {b.fullName}
              </Text>
              <Text style={styles.headline} numberOfLines={expanded ? undefined : 1}>
                {b.headline}
              </Text>
            </View>
          </View>
          <View style={styles.badgeWrap}>
            <StatusBadge
              label={b.ratingAverage.toFixed(1)}
              tone="safe"
              icon="star"
            />
          </View>
        </View>

        <Text style={styles.meta} numberOfLines={1}>
          {[
            b.city,
            b.distanceBand && b.distanceBand !== b.city ? b.distanceBand : '',
            `₹${b.hourlyRateInr}/hr`,
          ]
            .filter(Boolean)
            .join(' • ')}
        </Text>

        <Text style={styles.meta} numberOfLines={expanded ? undefined : 2}>
          {[
            b.languages.length > 0 ? b.languages.join(', ') : '',
            b.servicesOffered.length > 0
              ? (expanded ? b.servicesOffered : b.servicesOffered.slice(0, 3)).join(' · ')
              : '',
          ]
            .filter(Boolean)
            .join(' • ')}
        </Text>

        {hasLongDetails && (
          <ExpandableToggleRow
            expanded={expanded}
            onToggle={() => setExpanded((v) => !v)}
            expandLabel="More details"
            collapseLabel="Less details"
          />
        )}
      </View>

      <View style={styles.actionsRow}>
        <PrimaryButton
          label={busyBooking ? 'Sending...' : sentBooking ? 'Sent ✓' : 'Book'}
          tone={sentBooking ? 'safe' : 'primary'}
          loading={busyBooking}
          disabled={busyBooking || sentBooking}
          onPress={() => onRequestBooking(b)}
          style={styles.bookBtn}
        />
        <SecondaryButton
          label={isFaved ? '★ Saved' : '☆ Save'}
          tone={isFaved ? 'tealSoft' : undefined}
          disabled={busyFav}
          onPress={() => onToggleFavourite(b.id)}
        />
        <SecondaryButton
          label="Report"
          onPress={() => onBlockOrReport(b.id, b.fullName)}
        />
      </View>
    </StandardCard>
  );
});

export function PeopleDiscoveryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const numCols = useGridColumnCount({ mobile: 1, tablet: 2, laptop: 2, desktop: 3 });

  const [category, setCategory] = useState<Category>('BUDDIES');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [debouncedCity, setDebouncedCity] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [minRating, setMinRating] = useState('');
  const [nearMeOnly, setNearMeOnly] = useState(false);
  const [userCoords, setUserCoords] = useState<LiveCoordinates | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [travellers, setTravellers] = useState<TravellerCardData[]>([]);
  const [buddies, setBuddies] = useState<BuddyCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [busyBuddyIds, setBusyBuddyIds] = useState<Record<string, boolean>>({});
  const [sentBuddyIds, setSentBuddyIds] = useState<Record<string, boolean>>({});
  const [busyFavIds, setBusyFavIds] = useState<Record<string, boolean>>({});
  const [favBuddyIds, setFavBuddyIds] = useState<Record<string, boolean>>({});
  const [safetyTarget, setSafetyTarget] = useState<{ id: string; name: string } | null>(null);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    readCurrentLocationIfGranted().then((coords) => {
      if (coords) setUserCoords(coords);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText.trim()), 250);
    return () => clearTimeout(t);
  }, [searchText]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCity(cityFilter.trim()), 250);
    return () => clearTimeout(t);
  }, [cityFilter]);

  async function enableGpsFilter() {
    const res = await requestAndFetchLiveLocation();
    if (res.status === 'granted' && res.coords) {
      setUserCoords(res.coords);
      showFeedback({
        tone: 'success',
        title: 'Live GPS updated',
        message: 'Sorting people closest to your location.',
      });
    } else {
      showFeedback({
        tone: 'error',
        title: 'Location Permission',
        message: res.error || 'Enable location permission to sort nearby people.',
      });
    }
  }

  const fetchDiscovery = useCallback(
    async (opts: { reset?: boolean; skipOverride?: number } = {}) => {
      if (!user) return;
      const isReset = opts.reset ?? true;
      const activeLength = category === 'TRAVELLERS' ? travellers.length : buddies.length;
      const skip = isReset ? 0 : (opts.skipOverride ?? activeLength);

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
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (debouncedCity) params.set('city', debouncedCity);
        if (languageFilter.trim()) params.set('language', languageFilter.trim());
        if (category === 'BUDDIES' && minRating.trim()) params.set('minRating', minRating.trim());
        if (userCoords) {
          params.set('lat', String(userCoords.latitude));
          params.set('lng', String(userCoords.longitude));
          if (nearMeOnly && !debouncedCity) {
            params.set('radiusKm', '30');
          }
        }

        if (category === 'TRAVELLERS') {
          const res = await mobileApi<PaginatedDiscoveryResponse<TravellerCardData>>(
            `/buddies/discover/travellers?${params.toString()}`,
          );
          setTotal(res.total);
          setHasMore(res.hasMore);
          setTravellers((prev) => (isReset ? res.items : [...prev, ...res.items]));
        } else {
          const res = await mobileApi<PaginatedDiscoveryResponse<BuddyCardData>>(
            `/buddies/discover/buddies?${params.toString()}`,
          );
          setTotal(res.total);
          setHasMore(res.hasMore);
          setBuddies((prev) => (isReset ? res.items : [...prev, ...res.items]));
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      user,
      category,
      debouncedSearch,
      debouncedCity,
      languageFilter,
      minRating,
      nearMeOnly,
      userCoords,
      travellers.length,
      buddies.length,
    ],
  );

  useEffect(() => {
    void fetchDiscovery({ reset: true, skipOverride: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, category, debouncedSearch, debouncedCity, nearMeOnly, userCoords]);

  const requestBooking = useCallback(async (buddy: BuddyCardData) => {
    if (busyBuddyIds[buddy.id] || sentBuddyIds[buddy.id]) return;
    setBusyBuddyIds((prev) => ({ ...prev, [buddy.id]: true }));
    try {
      await mobileApi('/bookings', {
        method: 'POST',
        idempotencyKey: createIdempotencyKey(`booking-${buddy.id}`),
        body: JSON.stringify({
          buddyId: buddy.id,
          startAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
          endAt: new Date(Date.now() + 27 * 3600_000).toISOString(),
          activitySummary: `${buddy.city} Companion Session`,
          meetingPointName: `${buddy.city} Public Transit / Plaza`,
        }),
      });
      setSentBuddyIds((prev) => ({ ...prev, [buddy.id]: true }));
      invalidateQueryPrefix('bookings:');
      showFeedback({
        tone: 'success',
        title: 'Request sent',
        message: `Booking request sent to ${buddy.fullName}. Track status under Bookings.`,
      });
    } catch (err) {
      showFeedback({
        tone: 'error',
        title: "Couldn't send request. Try again.",
        message: (err as Error).message,
      });
    } finally {
      setBusyBuddyIds((prev) => ({ ...prev, [buddy.id]: false }));
    }
  }, [busyBuddyIds, sentBuddyIds]);

  const toggleFavourite = useCallback(async (targetUserId: string) => {
    if (busyFavIds[targetUserId]) return;
    const optimisticNext = !favBuddyIds[targetUserId];
    setBusyFavIds((prev) => ({ ...prev, [targetUserId]: true }));
    setFavBuddyIds((prev) => ({ ...prev, [targetUserId]: optimisticNext }));
    try {
      const res = await mobileApi<{ favourited: boolean }>(
        `/users/me/favourites/${targetUserId}`,
        { method: 'POST' },
      );
      setFavBuddyIds((prev) => ({ ...prev, [targetUserId]: res.favourited }));
      showFeedback({
        tone: 'success',
        title: res.favourited ? 'Added to Favourites' : 'Removed from Favourites',
      });
    } catch (err) {
      setFavBuddyIds((prev) => ({ ...prev, [targetUserId]: !optimisticNext }));
      showFeedback({ tone: 'error', title: 'Error', message: (err as Error).message });
    } finally {
      setBusyFavIds((prev) => ({ ...prev, [targetUserId]: false }));
    }
  }, [busyFavIds, favBuddyIds]);

  const handleBlockOrReport = useCallback((targetId: string, targetName: string) => {
    setSafetyTarget({ id: targetId, name: targetName });
  }, []);

  async function submitSafetyAction(actionType: 'BLOCK' | 'REPORT') {
    if (!safetyTarget || safetyBusy) return;
    setSafetyBusy(true);
    try {
      await mobileApi('/users/me/safety-action', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: safetyTarget.id,
          actionType,
          reason:
            actionType === 'BLOCK'
              ? 'User blocked from discovery'
              : 'Safety concern flagged by user',
        }),
      });
      const targetName = safetyTarget.name;
      setSafetyTarget(null);
      if (actionType === 'BLOCK') {
        void fetchDiscovery({ reset: true, skipOverride: 0 });
        showFeedback({ tone: 'info', title: 'User Blocked', message: `${targetName} was blocked.` });
      } else {
        showFeedback({
          tone: 'success',
          title: 'Report Submitted',
          message: 'Submitted confidentially to Herway Safety Admin.',
        });
      }
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Action Failed', message: (err as Error).message });
    } finally {
      setSafetyBusy(false);
    }
  }

  const activeList = category === 'TRAVELLERS' ? travellers : buddies;
  const rows = useMemo(
    () => chunkRows<TravellerCardData | BuddyCardData>(activeList, numCols),
    [activeList, numCols],
  );

  if (!user) {
    return (
      <View style={styles.emptyBox}>
        <StatusBar style="dark" />
        <View style={styles.emptyCenter}>
          <EmptyState
            icon="groups"
            title="People & Travel Buddies"
            description="Sign in on the Profile or Home tab to discover Nearby Travellers and verified 18+ Travel Buddies."
            actionLabel="Sign In to Discover People"
            onAction={() => router.push('/(auth)/login')}
          />
        </View>
      </View>
    );
  }

  const topPad = layout.isWideLayout
    ? HerwaySpacing.xl
    : Math.max(insets.top + HerwaySpacing.lg, HerwaySpacing.section);
  const bottomPad = layout.isWideLayout ? HerwaySpacing.section : 140;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <FlatList
        data={loading && activeList.length === 0 ? [] : rows}
        key={`people-${category}-cols-${numCols}`}
        keyExtractor={(row) => row.map((item) => item.id).join('_')}
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
              title="Companions"
              subtitle="Discover nearby women travellers and live-selfie vetted Travel Buddies"
              rightSlot={
                total > 0 ? (
                  <StatusBadge label={`${total} Found`} tone="safe" hideIcon />
                ) : undefined
              }
            />

            <View style={styles.segmentRow}>
              <Pressable
                onPress={() => setCategory('BUDDIES')}
                accessibilityRole="button"
                accessibilityState={{ selected: category === 'BUDDIES' }}
                style={[styles.segmentBtn, category === 'BUDDIES' && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, category === 'BUDDIES' && styles.segmentTextActive]}>
                  Travel Buddies
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setCategory('TRAVELLERS')}
                accessibilityRole="button"
                accessibilityState={{ selected: category === 'TRAVELLERS' }}
                style={[styles.segmentBtn, category === 'TRAVELLERS' && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, category === 'TRAVELLERS' && styles.segmentTextActive]}>
                  Travellers
                </Text>
              </Pressable>
            </View>

            <StandardCard compact>
              <View style={styles.filterRow}>
                <View style={styles.searchGrow}>
                  <SearchInput
                    placeholder="Search name, city, or specialty..."
                    value={searchText}
                    onChangeText={setSearchText}
                    onClear={() => setSearchText('')}
                  />
                </View>
                <View style={styles.filterBtnGroup}>
                  <SmallButton
                    label={userCoords ? 'GPS On' : 'GPS'}
                    icon="my-location"
                    tone="primary"
                    onPress={enableGpsFilter}
                  />
                  <SecondaryButton
                    label={showFilters ? 'Hide' : 'Filters'}
                    icon="tune"
                    tone={showFilters ? 'tealSoft' : undefined}
                    onPress={() => setShowFilters((v) => !v)}
                    style={styles.compactFilterBtn}
                  />
                </View>
              </View>

              {showFilters && (
                <View style={styles.expandedFilters}>
                  {userCoords && (
                    <View style={styles.gpsBar}>
                      <Text style={styles.meta}>
                        {nearMeOnly ? 'Within 30 km' : 'Sorted by distance'}
                      </Text>
                      <SmallButton
                        label={nearMeOnly ? 'Near Me (30km)' : 'All Kerala'}
                        tone={nearMeOnly ? 'tealSoft' : 'primary'}
                        onPress={() => setNearMeOnly((v) => !v)}
                      />
                    </View>
                  )}

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.districtChipsRow}
                  >
                    <Pressable
                      onPress={() => setCityFilter('')}
                      style={[styles.districtChip, !cityFilter.trim() && styles.districtChipActive]}
                    >
                      <Text
                        style={[
                          styles.districtChipText,
                          !cityFilter.trim() && styles.districtChipTextActive,
                        ]}
                      >
                        All Cities
                      </Text>
                    </Pressable>
                    {PILOT_CITIES.map((city) => {
                      const active = cityFilter.trim().toLowerCase() === city.toLowerCase();
                      return (
                        <Pressable
                          key={city}
                          onPress={() => setCityFilter(active ? '' : city)}
                          style={[styles.districtChip, active && styles.districtChipActive]}
                        >
                          <Text
                            style={[
                              styles.districtChipText,
                              active && styles.districtChipTextActive,
                            ]}
                          >
                            {city}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <View style={styles.filterRow}>
                    <View style={{ flex: 1, minWidth: 140 }}>
                      <StandardInput
                        placeholder="Language (e.g. Malayalam)"
                        value={languageFilter}
                        onChangeText={setLanguageFilter}
                      />
                    </View>
                    {category === 'BUDDIES' && (
                      <View style={{ width: 110 }}>
                        <StandardInput
                          placeholder="Min ★"
                          value={minRating}
                          onChangeText={setMinRating}
                          keyboardType="numeric"
                        />
                      </View>
                    )}
                    <PrimaryButton
                      label="Apply"
                      tone="dark"
                      onPress={() => fetchDiscovery({ reset: true, skipOverride: 0 })}
                    />
                  </View>
                </View>
              )}
            </StandardCard>

            {loading && activeList.length === 0 ? <SkeletonLoader count={3} height={138} /> : null}
            {error ? (
              <ErrorState
                inline
                message={error}
                onRetry={() => fetchDiscovery({ reset: true, skipOverride: 0 })}
              />
            ) : null}
          </ResponsiveContainer>
        }
        renderItem={({ item: row }) => (
          <ResponsiveContainer>
            <View style={[styles.gridRow, { gap: layout.gridGap }]}>
              {row.map((entry) => (
                <View key={entry.id} style={styles.gridCell}>
                  <DiscoveryCard
                    category={category}
                    item={entry}
                    busyBooking={Boolean(busyBuddyIds[entry.id])}
                    sentBooking={Boolean(sentBuddyIds[entry.id])}
                    busyFav={Boolean(busyFavIds[entry.id])}
                    isFaved={Boolean(favBuddyIds[entry.id])}
                    onRequestBooking={requestBooking}
                    onToggleFavourite={toggleFavourite}
                    onBlockOrReport={handleBlockOrReport}
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
                icon="person-search"
                title="No matches found"
                description="Adjust your search, city, language, or minimum rating filter to view more people."
                actionLabel="Reset Filters"
                onAction={() => {
                  setSearchText('');
                  setCityFilter('');
                  setLanguageFilter('');
                  setMinRating('');
                }}
              />
            </ResponsiveContainer>
          ) : null
        }
        ListFooterComponent={
          activeList.length > 0 ? (
            <ResponsiveContainer>
              <CollectionPaginationFooter
                visibleCount={activeList.length}
                totalCount={total}
                hasMore={hasMore}
                loadingMore={loadingMore}
                noun={category === 'BUDDIES' ? 'buddies' : 'travellers'}
                onLoadMore={() =>
                  fetchDiscovery({ reset: false, skipOverride: activeList.length })
                }
              />
            </ResponsiveContainer>
          ) : null
        }
      />

      <Modal
        visible={Boolean(safetyTarget)}
        onClose={() => setSafetyTarget(null)}
        title="Safety Controls"
        subtitle={`Choose a confidential safety action for ${safetyTarget?.name}:`}
        maxWidth={400}
      >
        <View style={{ gap: HerwaySpacing.sm }}>
          <PrimaryButton
            label={safetyBusy ? 'Submitting...' : 'Report Safety Concern'}
            loading={safetyBusy}
            disabled={safetyBusy}
            onPress={() => submitSafetyAction('REPORT')}
            fullWidth
          />
          <SecondaryButton
            label="Block User"
            tone="danger"
            disabled={safetyBusy}
            onPress={() => submitSafetyAction('BLOCK')}
            fullWidth
          />
          <SecondaryButton
            label="Cancel"
            onPress={() => setSafetyTarget(null)}
            fullWidth
          />
        </View>
      </Modal>
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
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: HerwayColors.white,
    borderRadius: HerwayRadii.button,
    padding: HerwaySpacing.xs,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    minHeight: HerwaySizes.inputHeight,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: HerwayRadii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: HerwayColors.ink },
  segmentText: { fontSize: 14, fontWeight: '600', color: HerwayColors.textSecondary },
  segmentTextActive: { color: HerwayColors.white, fontWeight: '700' },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  searchGrow: {
    flex: 1,
    minWidth: 180,
  },
  filterBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  compactFilterBtn: {
    minHeight: HerwaySizes.buttonSmall,
    paddingVertical: 6,
    paddingHorizontal: HerwaySpacing.md,
  },
  expandedFilters: {
    gap: HerwaySpacing.md,
    paddingTop: HerwaySpacing.sm,
    borderTopWidth: HerwaySizes.borderWidth,
    borderTopColor: HerwayColors.borderSubtle,
  },
  gpsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.sm,
    backgroundColor: HerwayColors.inputBg,
    borderRadius: HerwayRadii.input,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.sm,
  },
  districtChipsRow: { gap: HerwaySpacing.sm, paddingVertical: 2 },
  districtChip: {
    minHeight: HerwaySizes.buttonSmall,
    justifyContent: 'center',
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.pill,
    backgroundColor: HerwayColors.white,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
  },
  districtChipActive: {
    backgroundColor: HerwayColors.teal,
    borderColor: HerwayColors.teal,
  },
  districtChipText: { fontSize: 13, fontWeight: '600', color: HerwayColors.ink },
  districtChipTextActive: { color: HerwayColors.white, fontWeight: '700' },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
  },
  gridCell: {
    flex: 1,
    minWidth: 0,
  },
  gridCardStretch: { flex: 1, justifyContent: 'space-between' },
  cardBody: { gap: HerwaySpacing.xs, minWidth: 0 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: HerwaySpacing.sm,
  },
  personHeader: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  badgeWrap: {
    flexShrink: 0,
  },
  name: { color: HerwayColors.ink },
  headline: { fontSize: 13, fontWeight: '600', color: HerwayColors.tealDark, marginTop: 2 },
  meta: { fontSize: 13, fontWeight: '500', color: HerwayColors.muted, lineHeight: 19 },
  expandedDetails: {
    marginTop: HerwaySpacing.xs,
    padding: HerwaySpacing.sm,
    borderRadius: HerwayRadii.input,
    backgroundColor: HerwayColors.inputBg,
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: HerwayColors.ink,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: HerwaySpacing.sm,
    marginTop: HerwaySpacing.sm,
  },
  bookBtn: { flex: 1, minWidth: 112 },
  compactSecondary: { alignSelf: 'flex-start' },
});

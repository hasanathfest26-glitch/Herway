import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { Href, useRouter } from 'expo-router';
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
import { useAuth } from '@/features/auth/AuthContext';
import { mobileApi } from '@/services/apiClient';
import { showFeedback } from '@/services/feedback';
import {
  DEMO_SAFE_HAVENS,
  PILOT_CITIES,
  SafeHavenRecord,
} from '@/data/herwayCatalog';
import {
  computeDistanceKm,
  formatDistanceLabel,
  LiveCoordinates,
  readCurrentLocationIfGranted,
  requestAndFetchLiveLocation,
} from '@/services/locationService';
import { SafeHavenBadge } from '@/components/SafeHavenBadge';
import {
  CollectionPaginationFooter,
  EmptyState,
  ErrorState,
  FilterChipBar,
  InteractiveCard,
  Modal,
  PageHeader,
  PrimaryButton,
  ResponsiveContainer,
  SearchInput,
  SecondaryButton,
  SkeletonLoader,
  SmallButton,
  StandardCard,
  StatusBadge,
  chunkRows,
  useGridColumnCount,
} from '@/components/ui';

interface ApiSafeHaven {
  id: string;
  name: string;
  category: SafeHavenRecord['category'];
  city: string;
  logoUrl?: string | null;
  address: string;
  phone: string;
  contactEmail?: string | null;
  operatingHoursJson?: { open24Hours?: boolean; display?: string };
  assistanceServices: string[];
  licenceNumber?: string;
  verificationDocumentsJson?: Record<string, unknown> | null;
  partnershipAgreementJson?: Record<string, unknown> | null;
  approvalStatus?: SafeHavenRecord['approvalStatus'];
  approvalNotes?: string | null;
  lastRecheckedAt?: string | null;
  approvedAt?: string | null;
  latitude: number;
  longitude: number;
  verifiedBadge: boolean;
  isDemoData?: boolean;
  distanceKm?: number | null;
}

interface PaginatedHavensResponse {
  items: ApiSafeHaven[];
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
}

interface OrdinaryPlace {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number | null;
}

type ExploreEntry =
  | { kind: 'HAVEN'; id: string; record: SafeHavenRecord }
  | { kind: 'ORDINARY'; id: string; place: OrdinaryPlace };

const CITY_FILTERS = ['All', ...PILOT_CITIES] as const;
const CATEGORY_FILTERS = [
  { id: 'ALL', label: 'All Types' },
  { id: 'HOSPITAL', label: 'Hospital' },
  { id: 'CLINIC', label: 'Clinic' },
  { id: 'PHARMACY', label: 'Pharmacy' },
  { id: 'HOSTEL', label: 'Hostel' },
  { id: 'HOTEL', label: 'Hotel' },
  { id: 'TOURIST_ASSISTANCE_CENTRE', label: 'Tourist Help' },
] as const;

const ORDINARY_SAMPLE_SERVICES: OrdinaryPlace[] = [
  {
    id: 'ord-1',
    name: 'Kannur Railway Station Public Help Desk',
    address: 'Station Road, Kannur (Public Transit Map Point)',
    latitude: 11.8732,
    longitude: 75.3691,
  },
  {
    id: 'ord-2',
    name: 'Ernakulam South Junction Police Aid Post',
    address: 'Jos Junction, Kochi (Public Map Point)',
    latitude: 9.9685,
    longitude: 76.2906,
  },
  {
    id: 'ord-3',
    name: 'Kozhikode KSRTC Bus Terminal',
    address: 'Mavoor Road, Kozhikode (Public Transit Map Point)',
    latitude: 11.2571,
    longitude: 75.7862,
  },
];

const PAGE_SIZE = 18;

function mapApiHaven(item: ApiSafeHaven): SafeHavenRecord {
  const docList = item.verificationDocumentsJson
    ? Object.values(item.verificationDocumentsJson).map((v) => String(v))
    : undefined;
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    city: item.city,
    logoUrl: item.logoUrl,
    address: item.address,
    latitude: item.latitude,
    longitude: item.longitude,
    phone: item.phone,
    contactEmail: item.contactEmail,
    operatingHoursJson: item.operatingHoursJson,
    assistanceServices: item.assistanceServices || [],
    licenceNumber: item.licenceNumber || 'PENDING-REF',
    verificationDocuments: docList,
    partnershipAgreementStatus: item.partnershipAgreementJson
      ? String(
          item.partnershipAgreementJson.status ||
            (item.partnershipAgreementJson.accepted ? 'Accepted' : 'Pending'),
        )
      : undefined,
    approvalStatus: item.approvalStatus || (item.verifiedBadge ? 'APPROVED' : 'PENDING'),
    approvalNotes: item.approvalNotes,
    lastVerifiedAt: item.lastRecheckedAt || item.approvedAt || null,
    verifiedBadge: Boolean(item.verifiedBadge) && item.approvalStatus !== 'PENDING',
    isDemoData: Boolean(item.isDemoData),
    distanceKm: item.distanceKm ?? null,
  };
}

const HavenGridCard = React.memo(function HavenGridCard({
  place,
  onSelect,
  onDirections,
}: {
  place: SafeHavenRecord;
  onSelect: (p: SafeHavenRecord) => void;
  onDirections: (lat?: number, lng?: number, name?: string) => void;
}) {
  const layout = useResponsiveLayout();
  return (
    <InteractiveCard
      onPress={() => onSelect(place)}
      accessibilityLabel={`${place.name}, ${place.city}`}
      style={styles.gridCardStretch}
    >
      <View style={styles.cardBody}>
        <View style={styles.havenHeader}>
          {place.logoUrl ? (
            <Image source={{ uri: place.logoUrl }} style={styles.logoThumb} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <MaterialIcons name="local-hospital" size={20} color={HerwayColors.tealDark} />
            </View>
          )}
          <View style={styles.havenTitleCol}>
            <SafeHavenBadge
              verified={place.verifiedBadge}
              isDemo={place.isDemoData}
              approvalStatus={place.approvalStatus}
            />
            <Text style={[layout.type.cardHeading, styles.placeName]} numberOfLines={2}>
              {place.name}
            </Text>
          </View>
        </View>

        <Text style={styles.meta} numberOfLines={1}>
          {place.category.replace(/_/g, ' ')} • {place.city}
          {place.distanceKm != null ? ` • ${formatDistanceLabel(place.distanceKm)}` : ''}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {place.address}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          Hours: {place.operatingHoursJson?.display || 'See facility'} • {place.phone}
        </Text>
        {place.assistanceServices.length > 0 && (
          <Text style={styles.services} numberOfLines={2}>
            Services: {place.assistanceServices.join(' • ')}
          </Text>
        )}
      </View>

      <View style={styles.btnRow}>
        <SecondaryButton
          label="Details"
          onPress={() => onSelect(place)}
          style={styles.btnFlex}
        />
        <PrimaryButton
          label="Directions"
          onPress={() => onDirections(place.latitude, place.longitude, place.name)}
          style={styles.btnFlex}
        />
      </View>
    </InteractiveCard>
  );
});

export default function ExploreScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const numCols = useGridColumnCount({ mobile: 1, tablet: 2, laptop: 2, desktop: 3 });

  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState<(typeof CITY_FILTERS)[number]>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'VERIFIED' | 'DEMO_PENDING' | 'PUBLIC_POINTS'>('VERIFIED');

  const [userCoords, setUserCoords] = useState<LiveCoordinates | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedHavens, setVerifiedHavens] = useState<SafeHavenRecord[]>([]);
  const [verifiedTotal, setVerifiedTotal] = useState(0);
  const [verifiedHasMore, setVerifiedHasMore] = useState(false);
  const [demoHavens, setDemoHavens] = useState<SafeHavenRecord[]>(DEMO_SAFE_HAVENS);
  const [demoTotal, setDemoTotal] = useState(DEMO_SAFE_HAVENS.length);
  const [demoHasMore, setDemoHasMore] = useState(false);
  const [ordinaryPlaces, setOrdinaryPlaces] = useState<OrdinaryPlace[]>(ORDINARY_SAMPLE_SERVICES);

  const [selectedDetail, setSelectedDetail] = useState<SafeHavenRecord | null>(null);
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

  async function enableLiveLocation() {
    setLocLoading(true);
    setLocError(null);
    const res = await requestAndFetchLiveLocation();
    if (res.status === 'granted' && res.coords) {
      setUserCoords(res.coords);
    } else {
      setLocError(res.error || 'Location permission denied.');
    }
    setLocLoading(false);
  }

  const loadExplore = useCallback(
    async (opts: { reset?: boolean; skipOverride?: number } = {}) => {
      if (!user) return;
      const isReset = opts.reset ?? true;
      const currentListLen =
        statusFilter === 'DEMO_PENDING' ? demoHavens.length : verifiedHavens.length;
      const skip = isReset ? 0 : (opts.skipOverride ?? currentListLen);

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
        if (selectedCity !== 'All') params.set('city', selectedCity);
        if (selectedCategory !== 'ALL') params.set('category', selectedCategory);
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (userCoords) {
          params.set('lat', String(userCoords.latitude));
          params.set('lng', String(userCoords.longitude));
        }

        const queryStr = `?${params.toString()}`;
        if (statusFilter === 'PUBLIC_POINTS') {
          const mapLat = userCoords?.latitude ?? 11.8745;
          const mapLng = userCoords?.longitude ?? 75.3704;
          const gmRes = await mobileApi<{ places: OrdinaryPlace[] }>(
            `/safe-havens/places-nearby?lat=${mapLat}&lng=${mapLng}&type=hospital`,
          );
          setOrdinaryPlaces(
            gmRes.places?.length ? gmRes.places : ORDINARY_SAMPLE_SERVICES,
          );
        } else if (statusFilter === 'DEMO_PENDING') {
          const demoRes = await mobileApi<PaginatedHavensResponse>(
            `/safe-havens/demo${queryStr}`,
          );
          const mapped = demoRes.items.map(mapApiHaven);
          setDemoTotal(demoRes.total);
          setDemoHasMore(demoRes.hasMore);
          setDemoHavens((prev) => (isReset ? mapped : [...prev, ...mapped]));
        } else {
          const shRes = await mobileApi<PaginatedHavensResponse>(
            `/safe-havens/nearby${queryStr}`,
          );
          const mapped = shRes.items.map(mapApiHaven);
          setVerifiedTotal(shRes.total);
          setVerifiedHasMore(shRes.hasMore);
          setVerifiedHavens((prev) => (isReset ? mapped : [...prev, ...mapped]));
        }
      } catch (err) {
        setError((err as Error).message || 'Unable to load Safe Havens.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      user,
      statusFilter,
      selectedCity,
      selectedCategory,
      debouncedSearch,
      userCoords,
      verifiedHavens.length,
      demoHavens.length,
    ],
  );

  useEffect(() => {
    void loadExplore({ reset: true, skipOverride: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, statusFilter, selectedCity, selectedCategory, debouncedSearch, userCoords]);

  const withDistance = useCallback(
    <T extends { latitude?: number; longitude?: number; distanceKm?: number | null }>(list: T[]): T[] => {
      if (!userCoords) return list;
      return [...list]
        .map((item) => ({
          ...item,
          distanceKm:
            item.latitude != null && item.longitude != null
              ? computeDistanceKm(
                  userCoords.latitude,
                  userCoords.longitude,
                  item.latitude,
                  item.longitude,
                )
              : item.distanceKm ?? null,
        }))
        .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    },
    [userCoords],
  );

  const openGoogleMapsDirections = useCallback((lat?: number, lng?: number, name?: string) => {
    if (lat == null || lng == null) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url).catch(() =>
      showFeedback({
        tone: 'info',
        title: 'Directions',
        message: `Navigate to ${name} (${lat}, ${lng})`,
      }),
    );
  }, []);

  async function reportHaven(havenId: string) {
    if (havenId.startsWith('demo-')) {
      showFeedback({
        tone: 'info',
        title: 'Demo Record',
        message: 'Demo Safe Havens are placeholder test data only.',
      });
      return;
    }
    try {
      await mobileApi(`/safe-havens/${havenId}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Hours or phone number inaccurate' }),
      });
      showFeedback({
        tone: 'success',
        title: 'Report Submitted',
        message: 'Herway Safety Team will re-verify this facility.',
      });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Error', message: (err as Error).message });
    }
  }

  const entries: ExploreEntry[] = useMemo(() => {
    if (statusFilter === 'PUBLIC_POINTS') {
      const q = debouncedSearch.toLowerCase();
      return withDistance(ordinaryPlaces)
        .filter((p) =>
          q
            ? p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)
            : true,
        )
        .map((place) => ({ kind: 'ORDINARY' as const, id: place.id, place }));
    }
    if (statusFilter === 'DEMO_PENDING') {
      return demoHavens.map((record) => ({ kind: 'HAVEN' as const, id: record.id, record }));
    }
    return verifiedHavens.map((record) => ({ kind: 'HAVEN' as const, id: record.id, record }));
  }, [statusFilter, ordinaryPlaces, demoHavens, verifiedHavens, debouncedSearch, withDistance]);

  const rows = useMemo(() => chunkRows(entries, numCols), [entries, numCols]);
  const activeTotal =
    statusFilter === 'VERIFIED'
      ? verifiedTotal
      : statusFilter === 'DEMO_PENDING'
        ? demoTotal
        : entries.length;
  const activeHasMore =
    statusFilter === 'VERIFIED'
      ? verifiedHasMore
      : statusFilter === 'DEMO_PENDING'
        ? demoHasMore
        : false;

  if (!user) {
    return (
      <View style={styles.emptyBox}>
        <StatusBar style="dark" />
        <View style={styles.emptyCenter}>
          <EmptyState
            icon="verified-user"
            title="Explore Safe Network"
            description="Sign in to explore live Verified Safe Havens, Demo Safe Haven test listings, and nearby public map services."
            actionLabel="Sign In to Explore"
            onAction={() => router.push('/(auth)/login' as Href)}
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

      <Modal
        visible={Boolean(selectedDetail)}
        onClose={() => setSelectedDetail(null)}
        title={selectedDetail?.name}
        subtitle={
          selectedDetail
            ? `${selectedDetail.category.replace(/_/g, ' ')} • ${selectedDetail.city}`
            : undefined
        }
        maxWidth={560}
        footer={
          selectedDetail ? (
            <View style={styles.btnRow}>
              <PrimaryButton
                label="Open in Google Maps"
                onPress={() =>
                  openGoogleMapsDirections(
                    selectedDetail.latitude,
                    selectedDetail.longitude,
                    selectedDetail.name,
                  )
                }
                style={styles.btnFlex}
              />
              <SecondaryButton
                label="Report Inaccuracy"
                onPress={() => reportHaven(selectedDetail.id)}
                style={styles.btnFlex}
              />
            </View>
          ) : null
        }
      >
        {selectedDetail ? (
          <View style={{ gap: HerwaySpacing.md }}>
            <SafeHavenBadge
              verified={selectedDetail.verifiedBadge}
              isDemo={selectedDetail.isDemoData}
              approvalStatus={selectedDetail.approvalStatus}
            />

            {selectedDetail.isDemoData && (
              <StandardCard tone="warn" compact>
                <Text style={styles.demoNoticeText}>
                  DEMO DATA — NOT VERIFIED PARTNERS. This fictional record is for UI, filter, and map testing only and does not carry the official Safe Haven badge.
                </Text>
              </StandardCard>
            )}

            {selectedDetail.logoUrl ? (
              <Image source={{ uri: selectedDetail.logoUrl }} style={styles.logoLarge} />
            ) : null}

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Address &amp; Map Coordinates</Text>
              <Text style={styles.detailValue}>{selectedDetail.address}</Text>
              <Text style={styles.meta}>
                Lat: {selectedDetail.latitude.toFixed(4)} • Lng:{' '}
                {selectedDetail.longitude.toFixed(4)}
                {selectedDetail.distanceKm != null
                  ? ` (${formatDistanceLabel(selectedDetail.distanceKm)})`
                  : ''}
              </Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Contact &amp; Operating Hours</Text>
              <Text style={styles.detailValue}>Phone: {selectedDetail.phone}</Text>
              {selectedDetail.contactEmail ? (
                <Text style={styles.detailValue}>Email: {selectedDetail.contactEmail}</Text>
              ) : null}
              <Text style={styles.detailValue}>
                Hours: {selectedDetail.operatingHoursJson?.display || 'N/A'}
              </Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Available Assistance Services</Text>
              <Text style={styles.detailValue}>
                {selectedDetail.assistanceServices.join(' • ') || 'Standard Safe Haven desk'}
              </Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Verification &amp; Compliance Dossier</Text>
              <Text style={styles.detailValue}>
                Registration / Licence: {selectedDetail.licenceNumber}
              </Text>
              <Text style={styles.detailValue}>
                Verification Documents:{' '}
                {selectedDetail.verificationDocuments?.join(', ') || 'Pending upload'}
              </Text>
              <Text style={styles.detailValue}>
                Partnership Agreement:{' '}
                {selectedDetail.partnershipAgreementStatus || 'Pending review'}
              </Text>
              <Text style={styles.detailValue}>
                Admin Verification Status: {selectedDetail.approvalStatus}
              </Text>
              {selectedDetail.approvalNotes ? (
                <Text style={styles.detailValue}>
                  Approval / Rejection Reason: {selectedDetail.approvalNotes}
                </Text>
              ) : null}
              <Text style={styles.detailValue}>
                Last Verification Date:{' '}
                {selectedDetail.lastVerifiedAt
                  ? new Date(selectedDetail.lastVerifiedAt).toLocaleDateString()
                  : 'Not yet verified'}
              </Text>
            </View>
          </View>
        ) : null}
      </Modal>

      <FlatList
        data={loading && entries.length === 0 ? [] : rows}
        key={`explore-${statusFilter}-cols-${numCols}`}
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
              title="Safe Havens"
              subtitle="Admin-verified partner venues and nearby public aid points"
              rightSlot={
                <StatusBadge
                  label={`${activeTotal} ${statusFilter === 'VERIFIED' ? 'Verified' : statusFilter === 'DEMO_PENDING' ? 'Demo' : 'Public'}`}
                  tone={statusFilter === 'VERIFIED' ? 'safe' : 'neutral'}
                  hideIcon
                />
              }
            />

            <StandardCard compact>
              <View style={styles.locationRow}>
                <View style={{ flex: 1, minWidth: 200 }}>
                  <SearchInput
                    placeholder="Search Safe Havens, street, or service..."
                    value={searchText}
                    onChangeText={setSearchText}
                    onClear={() => setSearchText('')}
                  />
                </View>
                <View style={styles.locActions}>
                  <SmallButton
                    label={locLoading ? 'Locating...' : userCoords ? 'GPS On' : 'Use GPS'}
                    icon="my-location"
                    tone="primary"
                    loading={locLoading}
                    disabled={locLoading}
                    onPress={enableLiveLocation}
                  />
                  <SecondaryButton
                    label={showFilters ? 'Hide' : 'Filters'}
                    icon="tune"
                    tone={showFilters ? 'tealSoft' : undefined}
                    onPress={() => setShowFilters((v) => !v)}
                    style={styles.filterBtnCompact}
                  />
                </View>
              </View>

              {locError ? <Text style={styles.errorText}>{locError}</Text> : null}

              <FilterChipBar
                scrollable
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'VERIFIED', label: 'Verified Havens' },
                  { value: 'DEMO_PENDING', label: 'Demo Listings' },
                  { value: 'PUBLIC_POINTS', label: 'Public Transit Points' },
                ]}
              />

              {showFilters && statusFilter !== 'PUBLIC_POINTS' && (
                <View style={styles.filtersGroup}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    {CITY_FILTERS.map((city) => (
                      <Pressable
                        key={city}
                        onPress={() => setSelectedCity(city)}
                        style={[styles.chip, selectedCity === city && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, selectedCity === city && styles.chipTextActive]}>
                          {city}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <View style={styles.chipRow}>
                    {CATEGORY_FILTERS.map((cat) => (
                      <Pressable
                        key={cat.id}
                        onPress={() => setSelectedCategory(cat.id)}
                        style={[styles.chip, selectedCategory === cat.id && styles.chipActive]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selectedCategory === cat.id && styles.chipTextActive,
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </StandardCard>

            {error ? (
              <ErrorState
                inline
                message={error}
                onRetry={() => loadExplore({ reset: true, skipOverride: 0 })}
              />
            ) : null}

            {loading && entries.length === 0 ? <SkeletonLoader count={3} height={152} /> : null}
          </ResponsiveContainer>
        }
        renderItem={({ item: row }) => (
          <ResponsiveContainer>
            <View style={[styles.gridRow, { gap: layout.gridGap }]}>
              {row.map((entry) => (
                <View key={entry.id} style={styles.gridCell}>
                  {entry.kind === 'HAVEN' ? (
                    <HavenGridCard
                      place={entry.record}
                      onSelect={setSelectedDetail}
                      onDirections={openGoogleMapsDirections}
                    />
                  ) : (
                    <StandardCard style={styles.gridCardStretch}>
                      <View style={styles.cardBody}>
                        <SafeHavenBadge verified={false} />
                        <Text style={[layout.type.cardHeading, styles.placeName]} numberOfLines={2}>
                          {entry.place.name}
                        </Text>
                        <Text style={styles.meta} numberOfLines={2}>
                          {entry.place.address}
                          {entry.place.distanceKm != null
                            ? ` • ${formatDistanceLabel(entry.place.distanceKm)}`
                            : ''}
                        </Text>
                      </View>
                      <SecondaryButton
                        label="Open Map"
                        onPress={() =>
                          openGoogleMapsDirections(
                            entry.place.latitude,
                            entry.place.longitude,
                            entry.place.name,
                          )
                        }
                        fullWidth
                      />
                    </StandardCard>
                  )}
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
                icon="verified-user"
                title="No Safe Havens matched"
                description="Try clearing your search or city/category filter, or check Demo Listings."
                actionLabel="Reset Filters"
                onAction={() => {
                  setSearchText('');
                  setSelectedCity('All');
                  setSelectedCategory('ALL');
                }}
              />
            </ResponsiveContainer>
          ) : null
        }
        ListFooterComponent={
          entries.length > 0 ? (
            <ResponsiveContainer>
              <CollectionPaginationFooter
                visibleCount={entries.length}
                totalCount={activeTotal}
                hasMore={activeHasMore}
                loadingMore={loadingMore}
                noun="Safe Havens"
                onLoadMore={() => loadExplore({ reset: false, skipOverride: entries.length })}
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
  locationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.sm,
  },
  errorText: { fontSize: 13, fontWeight: '600', color: HerwayColors.danger },
  locActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: HerwaySpacing.sm },
  filterBtnCompact: {
    minHeight: HerwaySizes.buttonSmall,
    paddingVertical: 6,
    paddingHorizontal: HerwaySpacing.md,
  },
  filtersGroup: {
    gap: HerwaySpacing.sm,
    paddingTop: HerwaySpacing.sm,
    borderTopWidth: HerwaySizes.borderWidth,
    borderTopColor: HerwayColors.borderSubtle,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: HerwaySpacing.sm },
  chip: {
    minHeight: HerwaySizes.buttonSmall,
    justifyContent: 'center',
    backgroundColor: HerwayColors.white,
    borderRadius: HerwayRadii.pill,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
  },
  chipActive: { backgroundColor: HerwayColors.teal, borderColor: HerwayColors.teal },
  chipText: { fontSize: 13, fontWeight: '600', color: HerwayColors.muted },
  chipTextActive: { color: HerwayColors.white, fontWeight: '700' },
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
  cardBody: { gap: HerwaySpacing.sm, minWidth: 0 },
  havenHeader: { flexDirection: 'row', alignItems: 'center', gap: HerwaySpacing.md },
  havenTitleCol: { flex: 1, minWidth: 0, gap: HerwaySpacing.xs },
  logoThumb: {
    width: 48,
    height: 48,
    borderRadius: HerwayRadii.input,
    backgroundColor: HerwayColors.mintMid,
  },
  logoLarge: {
    width: 64,
    height: 64,
    borderRadius: HerwayRadii.input,
    backgroundColor: HerwayColors.mintMid,
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: HerwayRadii.input,
    backgroundColor: HerwayColors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeName: { color: HerwayColors.ink },
  meta: { fontSize: 13, fontWeight: '500', color: HerwayColors.muted, lineHeight: 19 },
  services: { fontSize: 13, color: HerwayColors.tealDark, fontWeight: '600', lineHeight: 19 },
  btnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: HerwaySpacing.sm,
    marginTop: HerwaySpacing.sm,
  },
  btnFlex: { flex: 1, minWidth: 112 },
  demoNoticeText: {
    fontSize: 13,
    fontWeight: '700',
    color: HerwayColors.warningText,
    lineHeight: 19,
  },
  detailSection: {
    backgroundColor: HerwayColors.creamBg,
    borderRadius: HerwayRadii.input,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.borderSubtle,
    padding: HerwaySpacing.md,
    gap: HerwaySpacing.xs,
  },
  detailLabel: { fontSize: 13, fontWeight: '700', color: HerwayColors.tealDark },
  detailValue: { fontSize: 14, color: HerwayColors.ink, lineHeight: 20 },
});

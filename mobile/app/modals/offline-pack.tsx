import React, { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Href, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HerwayColors,
  HerwayRadii,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  isOfflinePackOutdated,
  loadOfflineSafetyPack,
  OfflineSafetyPack,
  STATIC_EMERGENCY_NUMBERS,
  syncOfflineSafetyPack,
} from '@/services/offlineCache';
import {
  CachedDocPayload,
  VaultDoc,
  downloadAndCacheDocument,
  getCachedDocIdSet,
  loadCachedDocList,
  loadCachedDocPayload,
  syncAllDocumentsOffline,
} from '@/services/offlineDocuments';
import { OfflineDocumentPreviewModal } from '@/components/OfflineDocumentPreviewModal';
import { mobileApi } from '@/services/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import { showFeedback } from '@/services/feedback';
import { SafeHavenBadge } from '@/components/SafeHavenBadge';
import { ViewAllSwitch, ViewAllToggle } from '@/components/ViewAllSwitch';
import { Pressable } from '@/components/InteractivePressable';
import {
  PrimaryButton,
  ResponsiveContainer,
  SecondaryButton,
  SmallButton,
  StandardCard,
  StatusBadge,
} from '@/components/ui';
import { RevealMask } from '@/components/motion/HerwayMotion';

interface TripSummary {
  id: string;
  title: string;
  destinationCity: string;
  status: string;
}

function formatSyncTimestamp(iso?: string | null): string {
  if (!iso) return 'Not synced yet';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not synced yet';
  const diffMin = Math.round((Date.now() - date.getTime()) / 60_000);
  if (diffMin < 1) return 'Synced just now';
  if (diffMin < 60) return `Synced ${diffMin}m ago`;
  return `Synced ${date.toLocaleDateString()} · ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export default function OfflinePackModal() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  const [pack, setPack] = useState<OfflineSafetyPack | null>(null);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [cachedDocs, setCachedDocs] = useState<VaultDoc[]>([]);
  const [cachedDocIds, setCachedDocIds] = useState<Set<string>>(new Set());
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<VaultDoc | null>(null);
  const [previewPayload, setPreviewPayload] = useState<CachedDocPayload | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | undefined>(undefined);
  const [syncing, setSyncing] = useState(false);
  const [viewAll, setViewAll] = useState(false);

  const loadInitial = useCallback(async () => {
    const cached = await loadOfflineSafetyPack();
    if (cached) {
      setPack(cached);
      if (cached.trip?.id) setSelectedTripId(cached.trip.id);
    }

    if (user) {
      const localDocs = await loadCachedDocList(user.id);
      setCachedDocs(localDocs);
      setCachedDocIds(await getCachedDocIdSet(user.id, localDocs));

      try {
        const list = await mobileApi<TripSummary[]>('/trips');
        setTrips(list);
        if (!cached?.trip?.id && list.length > 0) {
          const preferred = list.find((t) => t.status === 'ACTIVE') || list[0];
          setSelectedTripId(preferred.id);
        }
      } catch {
        // Offline: keep showing local cache without error noise
      }
    }
  }, [user]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  async function handleSync(overrideTripId?: string) {
    if (syncing) return;
    if (!user) {
      showFeedback({
        tone: 'info',
        title: 'Sign in required',
        message: 'Sign in while online to download your offline pack.',
      });
      return;
    }

    setSyncing(true);
    try {
      const targetId = overrideTripId ?? selectedTripId;
      const [synced, docsList] = await Promise.all([
        syncOfflineSafetyPack(targetId),
        syncAllDocumentsOffline(user.id).catch(() => loadCachedDocList(user.id)),
      ]);
      setPack(synced);
      setCachedDocs(docsList);
      setCachedDocIds(await getCachedDocIdSet(user.id, docsList));
      showFeedback({
        tone: 'success',
        title: 'Offline Pack Synced',
        message: synced.trip
          ? `${synced.trip.title} & travel documents ready offline.`
          : 'Safe Havens, helplines & travel documents cached.',
      });
    } catch (err) {
      showFeedback({
        tone: 'error',
        title: 'Sync Failed',
        message: (err as Error).message || 'Check internet connection.',
      });
    } finally {
      setSyncing(false);
    }
  }

  async function openOfflineDoc(doc: VaultDoc) {
    if (!user || openingDocId) return;
    setOpeningDocId(doc.id);
    try {
      let payload = await loadCachedDocPayload(user.id, doc.id);
      if (!payload) {
        payload = await downloadAndCacheDocument(user.id, doc);
        setCachedDocIds((prev) => new Set(prev).add(doc.id));
      }
      setPreviewDoc(doc);
      setPreviewPayload(payload);
    } catch (err) {
      showFeedback({
        tone: 'error',
        title: 'Document Offline Copy Missing',
        message: (err as Error).message,
      });
    } finally {
      setOpeningDocId(null);
    }
  }

  function callNumber(phone: string) {
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() =>
      showFeedback({ tone: 'info', title: 'Dial', message: phone }),
    );
  }

  function openDirections(lat?: number, lng?: number, name?: string) {
    if (lat == null || lng == null) return;
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
    ).catch(() =>
      showFeedback({ tone: 'info', title: 'Location', message: name || 'Safe Haven' }),
    );
  }

  const outdated = pack ? isOfflinePackOutdated(pack, 24) : false;
  const helplines = pack?.emergencyNumbers?.length
    ? pack.emergencyNumbers
    : STATIC_EMERGENCY_NUMBERS;
  const visibleHelplines = viewAll ? helplines : helplines.slice(0, 3);
  const contacts = pack?.trustedSosContacts ?? [];
  const havens = pack?.nearbySafeHavens ?? [];
  const visibleHavens = viewAll ? havens : havens.slice(0, 2);
  const stops = pack?.trip?.stops ?? [];
  const visibleStops = viewAll ? stops : stops.slice(0, 3);

  const syncTone = !pack ? 'warn' : outdated ? 'warn' : 'safe';
  const syncStatusLabel = !pack ? 'Not Cached' : outdated ? 'Update Due' : 'Offline Ready';

  return (
    <>
      <OfflineDocumentPreviewModal
        doc={previewDoc}
        payload={previewPayload}
        onClose={() => {
          setPreviewDoc(null);
          setPreviewPayload(null);
        }}
      />
      <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.root}
      contentContainerStyle={{
        paddingTop: layout.isWideLayout ? HerwaySpacing.xl : HerwaySpacing.lg,
        paddingBottom: Math.max(insets.bottom + HerwaySpacing.xxl, HerwaySpacing.section),
      }}
    >
      <ResponsiveContainer>
        <RevealMask scrollTrigger={false} mask={false}>
          <StandardCard>
            <View style={styles.heroTopBar}>
              <StatusBadge label={syncStatusLabel} tone={syncTone} />
              <ViewAllSwitch value={viewAll} onValueChange={setViewAll} />
            </View>

            <View style={[styles.heroSplit, layout.isWideLayout && styles.heroSplitDesktop]}>
              <View style={styles.heroCopy}>
                <Text style={[layout.type.pageHeading, styles.heroTitle]}>
                  Offline Safety Pack
                </Text>
                <Text style={styles.heroFact}>
                  {pack
                    ? formatSyncTimestamp(pack.lastUpdatedAt)
                    : 'Helplines available · Sync trips & Safe Havens'}
                </Text>
              </View>

              <PrimaryButton
                label={syncing ? 'Syncing...' : pack ? 'Refresh Offline Pack' : 'Sync Offline Pack'}
                icon="sync"
                loading={syncing}
                disabled={syncing}
                onPress={() => handleSync()}
                fullWidth={!layout.isWideLayout}
              />
            </View>

            {trips.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tripChipsRow}
              >
                {trips.map((t) => {
                  const active = selectedTripId === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => {
                        setSelectedTripId(t.id);
                        handleSync(t.id);
                      }}
                      style={[styles.tripChip, active && styles.tripChipActive]}
                    >
                      <MaterialIcons
                        name="luggage"
                        size={15}
                        color={active ? HerwayColors.tealDark : HerwayColors.muted}
                      />
                      <Text style={[styles.tripChipText, active && styles.tripChipTextActive]}>
                        {t.title} · {t.destinationCity}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.pipelineStrip}>
              <View style={styles.pipelineNode}>
                <MaterialIcons name="route" size={15} color={HerwayColors.tealDark} />
                <Text style={styles.pipelineLabel}>
                  {pack?.trip ? `${stops.length} stops` : 'Helplines'}
                </Text>
              </View>
              <View style={styles.pipelineNode}>
                <MaterialIcons name="shield" size={15} color={HerwayColors.tealDark} />
                <Text style={styles.pipelineLabel}>{havens.length} Safe Havens</Text>
              </View>
              <View style={[styles.pipelineNode, pack && styles.pipelineNodeReady]}>
                <MaterialIcons
                  name={pack ? 'offline-pin' : 'cloud-download'}
                  size={15}
                  color={pack ? HerwayColors.safe : HerwayColors.muted}
                />
                <Text
                  style={[
                    styles.pipelineLabel,
                    pack && { color: HerwayColors.successText, fontWeight: '700' },
                  ]}
                >
                  {contacts.length} SOS Contacts
                </Text>
              </View>
            </View>
          </StandardCard>
        </RevealMask>

        <View
          style={[
            layout.isWideLayout ? styles.bentoGrid : styles.mobileStack,
            { gap: layout.gridGap },
          ]}
        >
          <View style={[layout.isWideLayout ? styles.bentoCol : styles.mobileStack, { gap: layout.gridGap }]}>
            <RevealMask delay={40}>
              <StandardCard>
                <View style={styles.cardHeader}>
                  <Text style={[layout.type.cardHeading, styles.cardTitle]}>
                    Emergency Helplines
                  </Text>
                  <StatusBadge label="Offline Ready" tone="safe" />
                </View>

                <View style={styles.rowsStack}>
                  {visibleHelplines.map((e) => (
                    <View key={e.number} style={styles.helplineRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.rowTitle}>{e.label}</Text>
                        <Text style={styles.rowSub}>India 24x7</Text>
                      </View>
                      <SmallButton
                        label={e.number}
                        icon="call"
                        tone="dark"
                        onPress={() => callNumber(e.number)}
                      />
                    </View>
                  ))}
                </View>

                {!viewAll && (
                  <ViewAllToggle
                    expanded={viewAll}
                    onToggle={() => setViewAll(true)}
                    totalCount={helplines.length}
                    visibleCount={3}
                  />
                )}
              </StandardCard>
            </RevealMask>

            {pack?.trip && (
              <RevealMask delay={80}>
                <StandardCard>
                  <View style={styles.cardHeader}>
                    <Text style={[layout.type.cardHeading, styles.cardTitle]}>Cached Trip</Text>
                    <StatusBadge label={`${stops.length} stops`} tone="info" hideIcon />
                  </View>

                  <View style={styles.tripHighlightBox}>
                    <Text style={styles.tripName}>{pack.trip.title}</Text>
                    <Text style={styles.tripMeta}>
                      {pack.trip.destinationCity} ·{' '}
                      {new Date(pack.trip.startDate).toLocaleDateString()} –{' '}
                      {new Date(pack.trip.endDate).toLocaleDateString()}
                    </Text>
                    {(pack.trip.accommodationJson?.name || pack.trip.transportJson?.summary) && (
                      <Text style={styles.rowSub}>
                        {[pack.trip.accommodationJson?.name, pack.trip.transportJson?.summary]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    )}
                  </View>

                  {visibleStops.length > 0 && (
                    <View style={styles.rowsStack}>
                      {visibleStops.map((s, idx) => (
                        <View key={`${s.title}-${idx}`} style={styles.stopRow}>
                          <View style={styles.stopIndexBadge}>
                            <Text style={styles.stopIndexText}>{idx + 1}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.rowTitle}>{s.title}</Text>
                            <Text style={styles.rowSub}>
                              {s.stopType.replace(/_/g, ' ')}
                              {s.notes ? ` · ${s.notes}` : ''}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {!viewAll && (
                    <ViewAllToggle
                      expanded={viewAll}
                      onToggle={() => setViewAll(true)}
                      totalCount={stops.length}
                      visibleCount={3}
                    />
                  )}
                </StandardCard>
              </RevealMask>
            )}
          </View>

          <View style={[layout.isWideLayout ? styles.bentoCol : styles.mobileStack, { gap: layout.gridGap }]}>
            <RevealMask delay={60}>
              <StandardCard>
                <View style={styles.cardHeader}>
                  <Text style={[layout.type.cardHeading, styles.cardTitle]}>SOS Contacts</Text>
                  <StatusBadge label={`${contacts.length} synced`} tone="neutral" hideIcon />
                </View>

                {contacts.length === 0 ? (
                  <View style={styles.quietEmpty}>
                    <Text style={styles.rowSub}>No SOS contacts cached.</Text>
                    <SmallButton
                      label="Manage Contacts"
                      tone="tealSoft"
                      onPress={() => router.push('/(tabs)/profile' as Href)}
                    />
                  </View>
                ) : (
                  <View style={styles.rowsStack}>
                    {(viewAll ? contacts : contacts.slice(0, 3)).map((c) => (
                      <View key={c.id} style={styles.helplineRow}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.rowTitle}>{c.name}</Text>
                          <Text style={styles.rowSub}>{c.relationship}</Text>
                        </View>
                        <SecondaryButton
                          label={c.phone}
                          icon="call"
                          onPress={() => callNumber(c.phone)}
                          style={{ minHeight: HerwaySizes.buttonSmall, paddingVertical: 6 }}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </StandardCard>
            </RevealMask>

            <RevealMask delay={100}>
              <StandardCard>
                <View style={styles.cardHeader}>
                  <Text style={[layout.type.cardHeading, styles.cardTitle]}>
                    Cached Safe Havens
                  </Text>
                  <StatusBadge label={`${havens.length} saved`} tone="neutral" hideIcon />
                </View>

                {havens.length === 0 ? (
                  <View style={styles.quietEmpty}>
                    <Text style={styles.rowSub}>
                      {pack
                        ? 'No verified Safe Havens cached for this destination.'
                        : 'Sync your pack above to store nearby Safe Havens offline.'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.rowsStack}>
                    {visibleHavens.map((h) => (
                      <View key={h.id} style={styles.havenItem}>
                        <View style={styles.cardHeader}>
                          <SafeHavenBadge verified={h.verifiedBadge} />
                          {h.operatingHoursJson?.display ? (
                            <Text style={styles.rowSub}>{h.operatingHoursJson.display}</Text>
                          ) : null}
                        </View>
                        <Text style={styles.rowTitle}>{h.name}</Text>
                        <Text style={styles.rowSub}>{h.address}</Text>
                        <View style={styles.btnRow}>
                          <SmallButton
                            label={h.phone}
                            icon="call"
                            tone="dark"
                            onPress={() => callNumber(h.phone)}
                          />
                          {h.latitude != null && h.longitude != null && (
                            <SmallButton
                              label="Directions"
                              icon="directions"
                              tone="tealSoft"
                              onPress={() => openDirections(h.latitude, h.longitude, h.name)}
                            />
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {!viewAll && (
                  <ViewAllToggle
                    expanded={viewAll}
                    onToggle={() => setViewAll(true)}
                    totalCount={havens.length}
                    visibleCount={2}
                  />
                )}
              </StandardCard>
            </RevealMask>

            {viewAll && pack && pack.safetyInstructions.length > 0 && (
              <StandardCard>
                <Text style={[layout.type.cardHeading, styles.cardTitle]}>Safety Checklist</Text>
                <View style={styles.rowsStack}>
                  {pack.safetyInstructions.map((tip, idx) => (
                    <View key={idx} style={styles.tipRow}>
                      <MaterialIcons name="check-circle" size={16} color={HerwayColors.tealDark} />
                      <Text style={[styles.rowSub, { flex: 1 }]}>{tip}</Text>
                    </View>
                  ))}
                </View>
              </StandardCard>
            )}

            <RevealMask delay={120}>
              <StandardCard>
                <View style={styles.cardHeader}>
                  <Text style={[layout.type.cardHeading, styles.cardTitle]}>
                    Travel Document Vault
                  </Text>
                  <StatusBadge
                    label={`${cachedDocs.filter((d) => cachedDocIds.has(d.id)).length} offline`}
                    tone="safe"
                    icon="offline-pin"
                  />
                </View>

                {cachedDocs.length === 0 ? (
                  <View style={styles.quietEmpty}>
                    <Text style={styles.rowSub}>
                      Upload passports, visas, tickets, or IDs in Profile → Document Vault and tap Sync above to keep offline copies here.
                    </Text>
                    <SmallButton
                      label="Open Document Vault"
                      tone="tealSoft"
                      onPress={() => router.push('/(tabs)/profile' as Href)}
                    />
                  </View>
                ) : (
                  <View style={styles.rowsStack}>
                    {(viewAll ? cachedDocs : cachedDocs.slice(0, 4)).map((doc) => {
                      const ready = cachedDocIds.has(doc.id);
                      return (
                        <View key={doc.id} style={styles.helplineRow}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.rowTitle} numberOfLines={1}>
                              {doc.title}
                            </Text>
                            <Text style={styles.rowSub}>
                              {doc.documentType.replace(/_/g, ' ')} • {ready ? 'Cached Offline' : 'Cloud Only'}
                            </Text>
                          </View>
                          <SmallButton
                            label={openingDocId === doc.id ? 'Opening...' : ready ? 'View Offline' : 'View'}
                            icon="visibility"
                            tone={ready ? 'primary' : 'dark'}
                            loading={openingDocId === doc.id}
                            disabled={openingDocId === doc.id}
                            onPress={() => openOfflineDoc(doc)}
                          />
                        </View>
                      );
                    })}
                  </View>
                )}
              </StandardCard>
            </RevealMask>
          </View>
        </View>
      </ResponsiveContainer>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: HerwayColors.creamBg },
  heroTopBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.sm,
  },
  heroSplit: { gap: HerwaySpacing.md },
  heroSplitDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroCopy: { flex: 1, minWidth: 180, gap: HerwaySpacing.xs },
  heroTitle: { color: HerwayColors.ink },
  heroFact: { fontSize: 13, fontWeight: '600', color: HerwayColors.muted },
  tripChipsRow: { gap: HerwaySpacing.sm, paddingVertical: 2 },
  tripChip: {
    minHeight: HerwaySizes.buttonSmall,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.pill,
    backgroundColor: HerwayColors.inputBg,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
  },
  tripChipActive: {
    backgroundColor: HerwayColors.mintMid,
    borderColor: HerwayColors.tealSoft,
  },
  tripChipText: { fontSize: 13, fontWeight: '600', color: HerwayColors.muted },
  tripChipTextActive: { color: HerwayColors.tealDark, fontWeight: '700' },
  pipelineStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: HerwayColors.inputBg,
    borderRadius: HerwayRadii.input,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.inputBorder,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.sm,
    gap: HerwaySpacing.sm,
  },
  pipelineNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
  },
  pipelineNodeReady: {
    backgroundColor: HerwayColors.successSoft,
    paddingHorizontal: HerwaySpacing.sm,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.pill,
  },
  pipelineLabel: { fontSize: 13, fontWeight: '600', color: HerwayColors.ink },
  bentoGrid: { flexDirection: 'row', alignItems: 'flex-start' },
  bentoCol: { flex: 1, minWidth: 0 },
  mobileStack: { width: '100%' },
  cardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.sm,
  },
  cardTitle: { color: HerwayColors.ink },
  rowsStack: { gap: HerwaySpacing.sm },
  helplineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.md,
    backgroundColor: HerwayColors.inputBg,
    borderRadius: HerwayRadii.input,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.md,
  },
  rowTitle: { fontSize: 14, fontWeight: '700', color: HerwayColors.ink },
  rowSub: { fontSize: 13, fontWeight: '500', color: HerwayColors.muted, lineHeight: 19 },
  tripHighlightBox: {
    backgroundColor: HerwayColors.mintMid,
    borderRadius: HerwayRadii.input,
    padding: HerwaySpacing.md,
    gap: HerwaySpacing.xs,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.tealSoft,
  },
  tripName: { fontSize: 16, fontWeight: '700', color: HerwayColors.ink },
  tripMeta: { fontSize: 13, fontWeight: '600', color: HerwayColors.tealDark },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.md,
    backgroundColor: HerwayColors.inputBg,
    borderRadius: HerwayRadii.input,
    padding: HerwaySpacing.md,
  },
  stopIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: HerwayColors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIndexText: { fontSize: 13, fontWeight: '800', color: HerwayColors.tealDark },
  havenItem: {
    backgroundColor: HerwayColors.inputBg,
    borderRadius: HerwayRadii.input,
    padding: HerwaySpacing.md,
    gap: HerwaySpacing.xs,
  },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: HerwaySpacing.sm, marginTop: HerwaySpacing.xs },
  quietEmpty: {
    backgroundColor: HerwayColors.inputBg,
    borderRadius: HerwayRadii.input,
    padding: HerwaySpacing.lg,
    gap: HerwaySpacing.sm,
    alignItems: 'flex-start',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: HerwaySpacing.sm,
    backgroundColor: HerwayColors.inputBg,
    borderRadius: HerwayRadii.input,
    padding: HerwaySpacing.md,
  },
});

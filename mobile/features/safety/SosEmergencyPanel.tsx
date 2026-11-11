import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
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
import { requestAndFetchLiveLocation } from '@/services/locationService';
import { STATIC_EMERGENCY_NUMBERS } from '@/services/offlineCache';
import { getRealtimeSocket } from '@/services/realtimeSocket';
import {
  CollectionPaginationFooter,
  PrimaryButton,
  SecondaryButton,
  SmallButton,
  StandardCard,
  StatusBadge,
} from '@/components/ui';

interface SosIncidentRecord {
  id: string;
  status: string;
  deliveries: Array<{ id: string; recipientLabel: string; deliveryStatus: string }>;
}

export function SosEmergencyPanel() {
  const { user, token } = useAuth();
  const layout = useResponsiveLayout();
  const [activeIncident, setActiveIncident] = useState<SosIncidentRecord | null>(null);
  const [sosBusy, setSosBusy] = useState(false);
  const [sosStage, setSosStage] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [deliveriesLimit, setDeliveriesLimit] = useState(6);
  const [numbers, setNumbers] = useState(
    STATIC_EMERGENCY_NUMBERS.map((n) => ({ code: n.number, label: n.label })),
  );

  const loadState = useCallback(async () => {
    try {
      const apiNums = await mobileApi<Array<{ code: string; label: string }>>(
        '/emergency/numbers',
        {},
        null,
      );
      if (apiNums.length > 0) setNumbers(apiNums);
    } catch {
      // Static validated India numbers stay active offline
    }

    if (!user) return;
    try {
      const active = await mobileApi<SosIncidentRecord[]>('/emergency/sos/active');
      setActiveIncident(active[0] ?? null);
    } catch {
      // Handled silently if offline
    }
  }, [user]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  useEffect(() => {
    if (!user || !token) return;
    const socket = getRealtimeSocket(token);
    const onSosUpdated = (incident: SosIncidentRecord) => {
      if (incident.status === 'RESOLVED' || incident.status === 'FALSE_ALARM') {
        setActiveIncident(null);
      } else {
        setActiveIncident(incident);
      }
    };
    socket.on('sos:updated', onSosUpdated);
    return () => {
      socket.off('sos:updated', onSosUpdated);
    };
  }, [user, token]);

  async function triggerSosAlert() {
    if (sosBusy) return;
    if (!user) {
      showFeedback({
        tone: 'info',
        title: 'Direct Emergency Dial 112',
        message: 'Calling India National Emergency 112 directly.',
      });
      dialEmergency('112');
      return;
    }

    setSosBusy(true);
    setSosStage('sending');
    const idemKey = createIdempotencyKey('sos');
    let lat: number | undefined;
    let lng: number | undefined;
    const loc = await requestAndFetchLiveLocation();
    if (loc.status === 'granted' && loc.coords) {
      lat = loc.coords.latitude;
      lng = loc.coords.longitude;
    }

    try {
      const incident = await mobileApi<SosIncidentRecord>('/emergency/sos', {
        method: 'POST',
        idempotencyKey: idemKey,
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          message: 'SOS Emergency triggered from Herway Mobile',
        }),
      });
      setActiveIncident(incident);
      setSosStage('sent');
      showFeedback({
        tone: 'success',
        title: 'Alert sent',
        message: 'Trusted contacts & emergency responders notified.',
      });
    } catch (err) {
      setSosStage('failed');
      showFeedback({
        tone: 'error',
        title: 'Alert Failed — Dial 112 Directly',
        message: (err as Error).message,
      });
    } finally {
      setSosBusy(false);
    }
  }

  async function cancelAccidental() {
    if (!activeIncident || sosBusy) return;
    setSosBusy(true);
    try {
      await mobileApi(`/emergency/sos/${activeIncident.id}/cancel-accidental`, { method: 'POST' });
      setActiveIncident(null);
      showFeedback({
        tone: 'success',
        title: 'Cancelled Safely',
        message: 'Marked as accidental alert and contacts updated.',
      });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Error', message: (err as Error).message });
    } finally {
      setSosBusy(false);
    }
  }

  async function escalateContacts() {
    if (!activeIncident || sosBusy) return;
    setSosBusy(true);
    try {
      const updated = await mobileApi<SosIncidentRecord>(
        `/emergency/sos/${activeIncident.id}/escalate`,
        { method: 'POST' },
      );
      setActiveIncident(updated);
      showFeedback({
        tone: 'info',
        title: 'Escalated',
        message: 'Secondary trusted contacts have been alerted.',
      });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Error', message: (err as Error).message });
    } finally {
      setSosBusy(false);
    }
  }

  async function resolveSos() {
    if (!activeIncident || sosBusy) return;
    setSosBusy(true);
    try {
      await mobileApi(`/emergency/sos/${activeIncident.id}/resolve`, { method: 'PATCH' });
      setActiveIncident(null);
      showFeedback({ tone: 'success', title: 'Marked Safe ✓' });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Error', message: (err as Error).message });
    } finally {
      setSosBusy(false);
    }
  }

  function dialEmergency(code: string) {
    Linking.openURL(`tel:${code}`).catch(() => {
      showFeedback({
        tone: 'info',
        title: 'Emergency Dial',
        message: `Call ${code} directly from your phone dialer.`,
      });
    });
  }

  return (
    <View style={[styles.wrapper, { gap: layout.gridGap }]}>
      <StandardCard tone="danger">
        <Text style={[layout.type.cardHeading, styles.heading]}>
          Emergency SOS &amp; Rapid Support
        </Text>
        <Text style={styles.sub}>
          Immediately alerts your selected Trusted Contacts with your live location and active trip info, plus gives instant 1-tap dialing to 112, 181, and 1515.
        </Text>

        {!activeIncident ? (
          <PrimaryButton
            label={
              sosBusy
                ? 'Sending emergency alert...'
                : sosStage === 'failed'
                  ? 'Alert Failed – Retry SOS'
                  : 'SEND SOS ALERT NOW'
            }
            tone="danger"
            icon="warning"
            loading={sosBusy}
            disabled={sosBusy}
            onPress={triggerSosAlert}
            fullWidth
          />
        ) : (
          <View style={styles.activeBox}>
            <View style={styles.rowBetween}>
              <Text style={styles.activeTitle} numberOfLines={1}>
                SOS Incident: {activeIncident.status}
              </Text>
              <SmallButton
                label="Mark Safe"
                tone="safe"
                disabled={sosBusy}
                onPress={resolveSos}
              />
            </View>

            {activeIncident.deliveries.slice(0, deliveriesLimit).map((d) => (
              <View key={d.id} style={styles.deliveryRow}>
                <Text style={styles.deliveryName} numberOfLines={1}>
                  {d.recipientLabel}
                </Text>
                <StatusBadge
                  label={d.deliveryStatus}
                  tone={d.deliveryStatus === 'ACKNOWLEDGED' ? 'safe' : 'warn'}
                />
              </View>
            ))}

            {activeIncident.deliveries.length > deliveriesLimit && (
              <CollectionPaginationFooter
                visibleCount={Math.min(deliveriesLimit, activeIncident.deliveries.length)}
                totalCount={activeIncident.deliveries.length}
                hasMore={deliveriesLimit < activeIncident.deliveries.length}
                noun="recipient alerts"
                onLoadMore={() => setDeliveriesLimit((n) => n + 8)}
              />
            )}

            <View style={styles.btnRow}>
              <PrimaryButton
                label="Escalate Next Contact"
                tone="dark"
                disabled={sosBusy}
                onPress={escalateContacts}
                style={styles.btnFlex}
              />
              <SecondaryButton
                label="Cancel Accidental"
                disabled={sosBusy}
                onPress={cancelAccidental}
                style={styles.btnFlex}
              />
            </View>
          </View>
        )}
      </StandardCard>

      <StandardCard>
        <Text style={[layout.type.cardHeading, styles.cardTitle]}>
          Validated Direct Emergency Numbers (India / Kerala)
        </Text>
        <View style={styles.numbersList}>
          {numbers.map((item) => (
            <Pressable
              key={item.code}
              onPress={() => dialEmergency(item.code)}
              style={styles.numberRow}
              accessibilityRole="button"
              accessibilityLabel={`Call ${item.label} at ${item.code}`}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.numLabel}>{item.label}</Text>
                <Text style={styles.numSub}>Direct OS dialer handoff</Text>
              </View>
              <View style={styles.callBadge}>
                <Text style={styles.callBadgeText}>Call {item.code}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </StandardCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  heading: { color: HerwayColors.dangerText },
  sub: { fontSize: 14, color: HerwayColors.dangerText, lineHeight: 20 },
  activeBox: {
    backgroundColor: HerwayColors.white,
    borderRadius: HerwayRadii.input,
    padding: HerwaySpacing.lg,
    gap: HerwaySpacing.md,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.dangerBorder,
  },
  rowBetween: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  activeTitle: { fontSize: 15, fontWeight: '800', color: HerwayColors.dangerText, flex: 1 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: HerwaySpacing.sm, marginTop: HerwaySpacing.xs },
  btnFlex: { flex: 1, minWidth: 150 },
  deliveryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  deliveryName: { fontSize: 13, color: HerwayColors.ink, flex: 1 },
  cardTitle: { color: HerwayColors.ink },
  numbersList: { gap: HerwaySpacing.sm },
  numberRow: {
    minHeight: HerwaySizes.inputHeight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: HerwaySpacing.md,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.sm,
    backgroundColor: HerwayColors.inputBg,
    borderRadius: HerwayRadii.input,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.inputBorder,
  },
  numLabel: { fontSize: 14, fontWeight: '700', color: HerwayColors.ink },
  numSub: { fontSize: 12, color: HerwayColors.muted },
  callBadge: {
    minHeight: HerwaySizes.buttonSmall,
    backgroundColor: HerwayColors.danger,
    borderRadius: HerwayRadii.button,
    paddingHorizontal: HerwaySpacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callBadgeText: { color: HerwayColors.white, fontSize: 13, fontWeight: '700' },
});

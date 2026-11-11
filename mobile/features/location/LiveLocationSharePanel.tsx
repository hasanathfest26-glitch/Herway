import React, { useCallback, useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
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
import { getRealtimeSocket } from '@/services/realtimeSocket';
import {
  PrimaryButton,
  SecondaryButton,
  StandardCard,
  StatusBadge,
} from '@/components/ui';

interface ShareSessionRecord {
  id: string;
  label: string;
  status: 'ACTIVE' | 'PAUSED' | 'STOPPED' | 'EXPIRED' | 'REVOKED';
  trackingUrl: string;
  expiresAt: string;
}

export function LiveLocationSharePanel() {
  const { user, token } = useAuth();
  const layout = useResponsiveLayout();
  const [sessions, setSessions] = useState<ShareSessionRecord[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [busyAction, setBusyAction] = useState(false);

  const loadShares = useCallback(async () => {
    if (!user) return;
    try {
      const list = await mobileApi<ShareSessionRecord[]>('/locations/shares');
      setSessions(list);
    } catch {
      // Handled when offline
    }
  }, [user]);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  const activeSession = sessions.find((s) => s.status === 'ACTIVE' || s.status === 'PAUSED');

  async function startLiveShare() {
    if (!user) {
      showFeedback({
        tone: 'info',
        title: 'Sign In Required',
        message: 'Please sign in to create a private live tracking link.',
      });
      return;
    }

    const loc = await requestAndFetchLiveLocation();
    if (loc.status !== 'granted' || !loc.coords) {
      showFeedback({
        tone: 'error',
        title: 'Location Permission Needed',
        message: loc.error || 'Grant location permission to share your live position.',
      });
      return;
    }

    const coords = loc.coords;
    if (busyAction) return;
    setBusyAction(true);
    try {
      const created = await mobileApi<ShareSessionRecord>('/locations/shares', {
        method: 'POST',
        idempotencyKey: createIdempotencyKey('loc-share'),
        body: JSON.stringify({
          label: 'Live Safety Share',
          durationMinutes,
          initialLatitude: coords.latitude,
          initialLongitude: coords.longitude,
        }),
      });
      setSessions((prev) => [created, ...prev]);
      showFeedback({ tone: 'success', title: 'Live Tracking Link Created ✓' });

      const socket = getRealtimeSocket(token);
      socket.emit('location:ping', {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters: coords.accuracyMeters ?? undefined,
      });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Share Failed', message: (err as Error).message });
    } finally {
      setBusyAction(false);
    }
  }

  async function updateState(shareId: string, nextStatus: 'ACTIVE' | 'PAUSED' | 'REVOKED') {
    if (busyAction) return;
    setBusyAction(true);
    const prevSessions = sessions;
    setSessions((prev) =>
      prev.map((s) => (s.id === shareId ? { ...s, status: nextStatus } : s)),
    );
    try {
      await mobileApi(`/locations/shares/${shareId}/state`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      if (nextStatus === 'REVOKED') {
        showFeedback({
          tone: 'info',
          title: 'Link Revoked',
          message: 'Recipients can no longer view your location.',
        });
      }
    } catch (err) {
      setSessions(prevSessions);
      showFeedback({ tone: 'error', title: 'Update Failed', message: (err as Error).message });
    } finally {
      setBusyAction(false);
    }
  }

  async function pingNow() {
    if (busyAction) return;
    setBusyAction(true);
    try {
      const loc = await requestAndFetchLiveLocation();
      if (loc.status !== 'granted' || !loc.coords) {
        showFeedback({
          tone: 'error',
          title: 'Location Unavailable',
          message: loc.error || 'Enable location permission to ping GPS.',
        });
        return;
      }
      await mobileApi('/locations/ping', {
        method: 'POST',
        body: JSON.stringify({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracyMeters: loc.coords.accuracyMeters ?? undefined,
        }),
      });
      const socket = getRealtimeSocket(token);
      socket.emit('location:ping', {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracyMeters: loc.coords.accuracyMeters ?? undefined,
      });
      showFeedback({
        tone: 'success',
        title: 'Location Updated ✓',
        message: 'Latest GPS coordinates sent to active tracking link.',
      });
    } finally {
      setBusyAction(false);
    }
  }

  return (
    <StandardCard>
      <View style={styles.rowBetween}>
        <Text style={[layout.type.cardHeading, styles.title]}>Live Location Sharing</Text>
        <StatusBadge
          label={activeSession ? activeSession.status : 'OFF'}
          tone={activeSession?.status === 'ACTIVE' ? 'safe' : activeSession ? 'warn' : 'neutral'}
        />
      </View>

      <Text style={styles.desc}>
        Create an expiring, revocable link for WhatsApp, SMS, or Telegram. Contacts open it in a normal browser without installing Herway.
      </Text>

      {!activeSession ? (
        <>
          <View style={styles.durationRow}>
            {[60, 120, 240].map((mins) => (
              <Pressable
                key={mins}
                onPress={() => setDurationMinutes(mins)}
                style={[styles.chip, durationMinutes === mins && styles.chipActive]}
              >
                <Text style={[styles.chipText, durationMinutes === mins && styles.chipTextActive]}>
                  {mins / 60} hr
                </Text>
              </Pressable>
            ))}
          </View>
          <PrimaryButton
            label={`Start Private Live Share (${durationMinutes / 60}h)`}
            tone="dark"
            loading={busyAction}
            disabled={busyAction}
            onPress={startLiveShare}
            fullWidth
          />
        </>
      ) : (
        <View style={styles.controlsCol}>
          <Text selectable style={styles.urlBox}>
            {activeSession.trackingUrl}
          </Text>
          <View style={styles.btnRow}>
            <PrimaryButton
              label="Share Link"
              tone="dark"
              onPress={() =>
                Share.share({
                  message: `Track my Herway journey live in any browser: ${activeSession.trackingUrl}`,
                })
              }
              style={styles.btnGrow}
            />
            <SecondaryButton
              label="Ping GPS"
              disabled={busyAction}
              onPress={pingNow}
              style={styles.btnGrow}
            />
            <SecondaryButton
              label={activeSession.status === 'PAUSED' ? 'Resume' : 'Pause'}
              disabled={busyAction}
              onPress={() =>
                updateState(
                  activeSession.id,
                  activeSession.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED',
                )
              }
              style={styles.btnGrow}
            />
            <SecondaryButton
              label="Revoke"
              tone="danger"
              disabled={busyAction}
              onPress={() => updateState(activeSession.id, 'REVOKED')}
              style={styles.btnGrow}
            />
          </View>
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
  desc: { fontSize: 13, fontWeight: '500', color: HerwayColors.muted, lineHeight: 19 },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: HerwaySpacing.sm },
  chip: {
    minHeight: HerwaySizes.buttonSmall,
    justifyContent: 'center',
    backgroundColor: HerwayColors.inputBg,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.inputBorder,
    borderRadius: HerwayRadii.pill,
    paddingHorizontal: HerwaySpacing.lg,
    paddingVertical: HerwaySpacing.xs,
  },
  chipActive: { backgroundColor: HerwayColors.teal, borderColor: HerwayColors.teal },
  chipText: { fontSize: 13, fontWeight: '600', color: HerwayColors.ink },
  chipTextActive: { color: HerwayColors.white, fontWeight: '700' },
  controlsCol: { gap: HerwaySpacing.md },
  urlBox: {
    backgroundColor: HerwayColors.inputBg,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.inputBorder,
    borderRadius: HerwayRadii.input,
    padding: HerwaySpacing.md,
    fontSize: 12,
    color: HerwayColors.ink,
  },
  btnRow: { flexDirection: 'row', gap: HerwaySpacing.sm, flexWrap: 'wrap' },
  btnGrow: { flexGrow: 1, minWidth: 112 },
});

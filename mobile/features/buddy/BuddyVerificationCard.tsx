import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AsyncButton } from '@/components/AsyncButton';
import { HerwayColors } from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useAuth } from '@/features/auth/AuthContext';
import { createIdempotencyKey, mobileApi } from '@/services/apiClient';
import { showFeedback } from '@/services/feedback';
import { StandardCard, StatusBadge } from '@/components/ui';

export function BuddyVerificationCard() {
  const { user, updateLocalUser } = useAuth();
  const layout = useResponsiveLayout();
  const [submitting, setSubmitting] = useState(false);

  const isBuddy = Boolean(user?.roles.includes('TRAVEL_BUDDY'));

  async function toggleBuddyRole() {
    if (submitting) return;
    if (!user) {
      showFeedback({ tone: 'info', title: 'Sign In Required', message: 'Please sign in first.' });
      return;
    }

    const prevRoles = user.roles;
    const nextRoles = isBuddy
      ? prevRoles.filter((r) => r !== 'TRAVEL_BUDDY')
      : Array.from(new Set([...prevRoles, 'TRAVEL_BUDDY']));
    const finalRoles = nextRoles.length > 0 ? nextRoles : ['TRAVELLER'];

    setSubmitting(true);
    await updateLocalUser({ roles: finalRoles });
    try {
      const updated = await mobileApi<Record<string, unknown>>('/users/me', {
        method: 'PATCH',
        idempotencyKey: createIdempotencyKey('toggle-buddy-role'),
        body: JSON.stringify({ roles: finalRoles }),
      });
      await updateLocalUser(updated);
      showFeedback({
        tone: 'success',
        title: isBuddy ? 'Travel Buddy Disabled' : 'Travel Buddy Enabled ✓',
        message: isBuddy
          ? 'Switched back to Traveller-only mode.'
          : 'Travel Buddy role is now active for your account.',
      });
    } catch (err) {
      await updateLocalUser({ roles: prevRoles });
      showFeedback({ tone: 'error', title: 'Role Update Failed', message: (err as Error).message });
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StandardCard>
      <View style={styles.headerRow}>
        <Text style={[layout.type.cardHeading, styles.title]}>Travel Buddy Role</Text>
        <StatusBadge label={isBuddy ? 'Active' : 'Inactive'} tone={isBuddy ? 'safe' : 'neutral'} />
      </View>
      <Text style={styles.desc}>
        Enable or disable the Travel Buddy role anytime to offer local companionship, walks, and city guidance.
      </Text>

      <AsyncButton
        label={isBuddy ? 'Switch to Traveller Only' : 'Activate Travel Buddy Role'}
        loadingLabel="Updating role..."
        successLabel="Updated ✓"
        onPress={toggleBuddyRole}
        disabled={submitting}
      />
    </StandardCard>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { color: HerwayColors.ink, flex: 1 },
  desc: { fontSize: 13, color: HerwayColors.muted, lineHeight: 19 },
});

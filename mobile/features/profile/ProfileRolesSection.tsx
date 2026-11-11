import React, { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { Href, useRouter } from 'expo-router';
import { HerwayColors, HerwaySpacing } from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useAuth } from '@/features/auth/AuthContext';
import { useHerwayState } from '@/features/app/HerwayStateContext';
import { mobileApi } from '@/services/apiClient';
import { UserAvatar } from '@/components/UserAvatar';
import {
  PrimaryButton,
  SecondaryButton,
  SmallButton,
  StandardCard,
  StatusBadge,
} from '@/components/ui';

export function ProfileRolesSection() {
  const { user, updateLocalUser, logout } = useAuth();
  const { resetOnboarding, profileDraft } = useHerwayState();
  const router = useRouter();
  const layout = useResponsiveLayout();
  const [discoverable, setDiscoverable] = useState(user?.discoverableAsTraveller ?? true);

  if (!user) {
    return (
      <StandardCard>
        <Text style={[layout.type.cardHeading, styles.name]}>Not Signed In</Text>
        <Text style={styles.note}>
          Sign in to manage your profile, roles, trusted contacts, and travel documents.
        </Text>
        <View style={styles.btnRow}>
          <PrimaryButton
            label="Sign In / Create Account"
            onPress={() => router.push('/(auth)/login')}
            style={{ flex: 1, minWidth: 180 }}
          />
          <SecondaryButton
            label="Edit Profile"
            onPress={() => router.push('/edit-profile' as Href)}
          />
        </View>
      </StandardCard>
    );
  }

  async function toggleDiscoverable(nextValue: boolean) {
    setDiscoverable(nextValue);
    try {
      const updated = await mobileApi<Record<string, unknown>>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ discoverableAsTraveller: nextValue }),
      });
      await updateLocalUser(updated);
    } catch {
      // Keep optimistic toggle if offline
    }
  }

  async function exportMyData() {
    try {
      const exported = await mobileApi<{ exportedAt: string }>('/users/me/export');
      Alert.alert(
        'Data Export Ready',
        `Generated DPDP personal data export at ${exported.exportedAt}.`,
      );
    } catch (err) {
      Alert.alert('Export Failed', (err as Error).message);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete Account & Documents',
      'This permanently deletes your private travel documents, contacts, and anonymizes your account. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            await mobileApi('/users/me', { method: 'DELETE' });
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  }

  const occupation =
    (typeof user.travelPreferencesJson?.occupation === 'string'
      ? user.travelPreferencesJson.occupation
      : '') || profileDraft.occupation;
  const avatarUri = user.avatarUrl || profileDraft.avatarUri;

  return (
    <StandardCard>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.push('/edit-profile' as Href)}
          style={styles.profileTap}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
        >
          <UserAvatar uri={avatarUri} size={48} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[layout.type.cardHeading, styles.name]} numberOfLines={1}>
              {user.fullName}
            </Text>
            <Text style={styles.sub} numberOfLines={2}>
              {user.email} • {occupation ? `${occupation} • ` : ''}
              {user.homeCity || 'Kochi'}
            </Text>
          </View>
        </Pressable>
        <SmallButton
          label="Sign Out"
          tone="tealSoft"
          onPress={async () => {
            await logout();
            resetOnboarding();
            router.replace('/welcome');
          }}
        />
      </View>

      {user.bio ? <Text style={styles.bioPreview}>{user.bio}</Text> : null}

      <View style={{ gap: HerwaySpacing.sm }}>
        <Text style={styles.sectionLabel}>Active Account Roles</Text>
        <View style={styles.rolesRow}>
          {user.roles.map((r) => (
            <StatusBadge key={r} label={r.replace(/_/g, ' ')} tone="safe" />
          ))}
          <StatusBadge
            label={user.emailVerifiedAt ? 'Email Verified' : 'Email Unverified'}
            tone={user.emailVerifiedAt ? 'safe' : 'warn'}
          />
        </View>
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Allow Nearby Travellers Discovery</Text>
        <Switch
          value={discoverable}
          onValueChange={toggleDiscoverable}
          trackColor={{ false: HerwayColors.dotInactive, true: HerwayColors.teal }}
          thumbColor={HerwayColors.white}
        />
      </View>

      <View style={styles.btnRow}>
        <SecondaryButton
          label="Edit Profile"
          onPress={() => router.push('/edit-profile' as Href)}
        />
        <SecondaryButton label="Export My Data" onPress={exportMyData} />
        <SecondaryButton
          label="Delete Account"
          tone="danger"
          onPress={confirmDeleteAccount}
        />
      </View>
    </StandardCard>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: HerwaySpacing.md,
  },
  profileTap: {
    flex: 1,
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.md,
  },
  name: { color: HerwayColors.ink },
  sub: { fontSize: 13, fontWeight: '500', color: HerwayColors.muted, marginTop: 2 },
  bioPreview: { fontSize: 14, lineHeight: 20, color: HerwayColors.textSecondary },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: HerwayColors.ink },
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: HerwaySpacing.sm },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: HerwaySpacing.md,
  },
  toggleLabel: { flex: 1, fontSize: 14, color: HerwayColors.ink, fontWeight: '600' },
  note: { fontSize: 13, fontWeight: '500', color: HerwayColors.muted, lineHeight: 19 },
  btnRow: { flexDirection: 'row', gap: HerwaySpacing.sm, flexWrap: 'wrap' },
});

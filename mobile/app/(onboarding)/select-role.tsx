import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { HerwayColors, HerwaySpacing } from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useAuth } from '@/features/auth/AuthContext';
import { RoleChoice, useHerwayState } from '@/features/app/HerwayStateContext';
import { resolveMobileLocationCoords } from '@/data/herwayCatalog';
import { createIdempotencyKey, mobileApi } from '@/services/apiClient';
import { readCurrentLocationIfGranted } from '@/services/locationService';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import {
  ErrorState,
  InteractiveCard,
  PrimaryButton,
  StatusBadge,
} from '@/components/ui';
import { ElasticBounce } from '@/components/motion/HerwayMotion';

const ROLE_OPTIONS: Array<{
  id: RoleChoice;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  badge?: string;
}> = [
  {
    id: 'TRAVELLER',
    title: 'Traveller',
    subtitle: 'Plan trips, access Safe Havens, connect with companions & trigger SOS anytime.',
    icon: 'luggage',
  },
  {
    id: 'TRAVEL_BUDDY',
    title: 'Travel Buddy',
    subtitle: 'Offer safe local companionship, walks, language help & city guidance.',
    icon: 'groups',
  },
  {
    id: 'BOTH',
    title: 'Both (Traveller & Buddy)',
    subtitle: 'Travel with full safety tools and host companions in your city when available.',
    icon: 'verified-user',
    badge: 'Recommended',
  },
];

export default function SelectRoleScreen() {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const { user, updateLocalUser } = useAuth();
  const {
    selectedRoleChoice,
    setSelectedRoleChoice,
    selectedLanguage,
    profileDraft,
    setBuddyVerificationStatus,
    completeOnboarding,
  } = useHerwayState();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleFinishSetup() {
    if (submitting) return;
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const roles =
        selectedRoleChoice === 'BOTH'
          ? ['TRAVELLER', 'TRAVEL_BUDDY']
          : selectedRoleChoice === 'TRAVEL_BUDDY'
            ? ['TRAVEL_BUDDY']
            : ['TRAVELLER'];

      const dobValid = /^\d{4}-\d{2}-\d{2}$/.test(profileDraft.dateOfBirth);
      const effectiveCity = profileDraft.homeCity || user?.homeCity || undefined;
      const gpsCoords = await readCurrentLocationIfGranted();
      const coords = gpsCoords ?? resolveMobileLocationCoords(effectiveCity);
      const updated = await mobileApi<{
        roles?: string[];
        buddyProfile?: { isVerified?: boolean } | null;
      }>('/users/me', {
        method: 'PATCH',
        idempotencyKey: createIdempotencyKey('onboarding-role'),
        body: JSON.stringify({
          fullName: profileDraft.fullName || user?.fullName || undefined,
          homeCity: effectiveCity,
          bio: profileDraft.bio || undefined,
          dateOfBirth: dobValid ? profileDraft.dateOfBirth : undefined,
          languages: [selectedLanguage],
          interests: profileDraft.interests,
          roles,
          ...(coords
            ? { approxLatitude: coords.latitude, approxLongitude: coords.longitude }
            : {}),
          travelPreferencesJson: {
            preferredLanguage: selectedLanguage,
            selectedRoleChoice,
          },
        }),
      });

      await updateLocalUser(updated as Record<string, unknown>);
      const serverBuddyApproved = Boolean(
        updated.buddyProfile?.isVerified || updated.roles?.includes('TRAVEL_BUDDY'),
      );
      setBuddyVerificationStatus(
        serverBuddyApproved
          ? 'APPROVED'
          : selectedRoleChoice === 'TRAVEL_BUDDY' || selectedRoleChoice === 'BOTH'
            ? 'PENDING'
            : 'NONE',
      );
      completeOnboarding();
      router.replace('/(tabs)');
    } catch (err) {
      setErrorMsg((err as Error).message || 'Could not complete onboarding.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <OnboardingLayout
      currentStep={6}
      onBack={() => router.back()}
      desktopHeading="Choose how you want to use Herway"
      desktopSubheading="Start as a Traveller, Travel Buddy, or enable both in one unified account."
      desktopIllustrationSlide={2}
    >
      <Text style={[layout.type.pageHeading, styles.title]}>Select your role</Text>
      <Text style={[layout.type.secondary, styles.subtitle]}>
        Choose Traveller, Travel Buddy, or Both. You can switch your active role anytime.
      </Text>

      {errorMsg ? (
        <View style={styles.errorWrap}>
          <ErrorState inline message={errorMsg} />
        </View>
      ) : null}

      <View style={styles.optionsList}>
        {ROLE_OPTIONS.map((opt) => {
          const selected = selectedRoleChoice === opt.id;
          return (
            <InteractiveCard
              key={opt.id}
              onPress={() => setSelectedRoleChoice(opt.id)}
              tone={selected ? 'mint' : 'default'}
              compact
              accessibilityLabel={`${opt.title}. ${opt.subtitle}`}
              style={selected ? styles.roleCardSelected : undefined}
            >
              <View style={styles.roleRow}>
                <View style={[styles.roleIconCircle, selected && styles.roleIconCircleSelected]}>
                  <MaterialIcons
                    name={opt.icon}
                    size={22}
                    color={selected ? HerwayColors.white : HerwayColors.tealDark}
                  />
                </View>

                <View style={styles.roleBody}>
                  <View style={styles.roleTitleRow}>
                    <Text style={styles.roleTitle}>{opt.title}</Text>
                    {opt.badge ? (
                      <StatusBadge label={opt.badge} tone="info" hideIcon />
                    ) : null}
                  </View>
                  <Text style={styles.roleDesc}>{opt.subtitle}</Text>
                </View>

                {selected ? (
                  <ElasticBounce pulseKey={selected}>
                    <View style={styles.radioSelected}>
                      <MaterialIcons name="check" size={14} color={HerwayColors.white} />
                    </View>
                  </ElasticBounce>
                ) : (
                  <View style={styles.radioUnselected} />
                )}
              </View>
            </InteractiveCard>
          );
        })}
      </View>

      <PrimaryButton
        label={submitting ? 'Saving...' : 'Continue to Herway'}
        loading={submitting}
        disabled={submitting}
        onPress={handleFinishSetup}
        fullWidth
      />
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  title: { color: HerwayColors.ink },
  subtitle: {
    marginTop: HerwaySpacing.sm,
    color: HerwayColors.muted,
    marginBottom: HerwaySpacing.xl,
  },
  errorWrap: {
    marginBottom: HerwaySpacing.lg,
  },
  optionsList: {
    gap: HerwaySpacing.md,
    marginBottom: HerwaySpacing.xl,
  },
  roleCardSelected: {
    borderColor: HerwayColors.teal,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.md,
  },
  roleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: HerwayColors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconCircleSelected: {
    backgroundColor: HerwayColors.tealDark,
  },
  roleBody: {
    flex: 1,
    minWidth: 0,
    gap: HerwaySpacing.xs,
  },
  roleTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: HerwayColors.ink,
  },
  roleDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: HerwayColors.muted,
  },
  radioSelected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: HerwayColors.tealDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioUnselected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: HerwayColors.borderStrong,
  },
});

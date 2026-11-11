import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { Href, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import {
  HerwayColors,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { PILOT_CITIES, resolveMobileLocationCoords } from '@/data/herwayCatalog';
import { useAuth } from '@/features/auth/AuthContext';
import { useHerwayState } from '@/features/app/HerwayStateContext';
import { mobileApi } from '@/services/apiClient';
import { readCurrentLocationIfGranted } from '@/services/locationService';
import { CityDropdownField } from '@/components/CityDropdownField';
import { DateOfBirthField } from '@/components/DateOfBirthField';
import { InterestsSelectorField } from '@/components/InterestsSelectorField';
import { UserAvatar } from '@/components/UserAvatar';
import { validateDob } from '@/utils/dateOfBirth';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { ErrorState, PrimaryButton, StandardInput } from '@/components/ui';

const INTEREST_OPTIONS = [
  'Heritage Walks',
  'Backwaters',
  'Cafes',
  'Photography',
  'Hill Stations',
  'Food Tours',
] as const;

export default function CreateProfileScreen() {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const { user, refreshProfile } = useAuth();
  const { profileDraft, updateProfileDraft, setSelectedCity } = useHerwayState();

  const [fullName, setFullName] = useState(profileDraft.fullName || user?.fullName || '');
  const [homeCity, setHomeCity] = useState(profileDraft.homeCity || user?.homeCity || '');
  const [dateOfBirth, setDateOfBirth] = useState(profileDraft.dateOfBirth || '');
  const [bio, setBio] = useState(profileDraft.bio || user?.bio || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(profileDraft.avatarUri);
  const [interests, setInterests] = useState<string[]>(
    profileDraft.interests.length > 0 ? profileDraft.interests : user?.interests || [],
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function pickAvatar() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]) {
      setAvatarUri(res.assets[0].uri);
    }
  }

  async function handleContinue() {
    if (submitting) return;
    setErrorMsg(null);
    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name to continue.');
      return;
    }

    const dobCheck = validateDob(dateOfBirth, 'YYYY-MM-DD', false);
    if (!dobCheck.valid) {
      setErrorMsg(dobCheck.error || 'Please enter a valid date of birth.');
      return;
    }

    const cleanCity = homeCity.trim() || 'Kochi';

    setSubmitting(true);
    try {
      const gpsCoords = await readCurrentLocationIfGranted();
      const coords = gpsCoords ?? resolveMobileLocationCoords(cleanCity);
      await mobileApi('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: fullName.trim(),
          homeCity: cleanCity,
          bio: bio.trim() || undefined,
          dateOfBirth: dobCheck.isoDate,
          avatarUrl: avatarUri || undefined,
          interests,
          ...(coords
            ? { approxLatitude: coords.latitude, approxLongitude: coords.longitude }
            : {}),
        }),
      });
      await refreshProfile();

      updateProfileDraft({
        fullName: fullName.trim(),
        homeCity: cleanCity,
        dateOfBirth: dobCheck.isoDate || '',
        bio: bio.trim(),
        avatarUri,
        interests,
      });

      const matchedCity = PILOT_CITIES.find(
        (c) => c.toLowerCase() === cleanCity.toLowerCase(),
      );
      if (matchedCity) setSelectedCity(matchedCity);

      router.push('/(onboarding)/select-role' as Href);
    } catch (err) {
      setErrorMsg((err as Error).message || 'Could not save your profile.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <OnboardingLayout
      currentStep={5}
      onBack={() => router.back()}
      desktopHeading="Create your basic profile"
      desktopSubheading="Your name, home city, and travel interests personalize Safe Havens and companion recommendations."
      desktopIllustrationSlide={1}
    >
      <Text style={[layout.type.pageHeading, styles.title]}>Create basic profile</Text>
      <Text style={[layout.type.secondary, styles.subtitle]}>
        Tell us a little about yourself so we can personalize your safety workspace.
      </Text>

      {errorMsg ? (
        <View style={styles.errorWrap}>
          <ErrorState inline message={errorMsg} />
        </View>
      ) : null}

      <View style={styles.avatarSection}>
        <Pressable
          onPress={pickAvatar}
          accessibilityRole="button"
          accessibilityLabel="Upload profile photo"
          style={styles.avatarWrap}
        >
          <View style={styles.avatarRing}>
            <UserAvatar uri={avatarUri} size={80} />
          </View>
          <View style={styles.cameraBadge}>
            <MaterialIcons name="photo-camera" size={14} color={HerwayColors.white} />
          </View>
        </Pressable>
        <Text style={styles.avatarHint}>Tap to add profile photo (optional)</Text>
      </View>

      <View style={styles.formStack}>
        <StandardInput
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
        />

        <CityDropdownField
          label="City"
          value={homeCity}
          onChange={setHomeCity}
          cities={PILOT_CITIES}
          placeholder="Select your city"
          customPlaceholder="Type your custom city"
          variant="pill"
        />

        <DateOfBirthField
          label="Date of birth (optional)"
          value={dateOfBirth}
          onChange={(v) => {
            setDateOfBirth(v);
            if (errorMsg) setErrorMsg(null);
          }}
          format="YYYY-MM-DD"
          variant="pill"
        />

        <StandardInput
          label="Bio"
          value={bio}
          onChangeText={setBio}
          placeholder="Short bio"
        />

        <InterestsSelectorField
          label="Travel interests"
          options={INTEREST_OPTIONS}
          selected={interests}
          onChange={setInterests}
          variant="pill"
        />

        <View style={styles.ctaWrap}>
          <PrimaryButton
            label={submitting ? 'Saving...' : 'Continue'}
            loading={submitting}
            disabled={submitting}
            onPress={handleContinue}
            fullWidth
          />
        </View>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  title: { color: HerwayColors.ink },
  subtitle: {
    marginTop: HerwaySpacing.sm,
    color: HerwayColors.muted,
    marginBottom: HerwaySpacing.lg,
  },
  errorWrap: {
    marginBottom: HerwaySpacing.lg,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: HerwaySpacing.lg,
    gap: HerwaySpacing.sm,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.teal,
    backgroundColor: HerwayColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: HerwayColors.tealDark,
    borderWidth: 2,
    borderColor: HerwayColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    fontSize: 13,
    fontWeight: '500',
    color: HerwayColors.muted,
  },
  formStack: {
    gap: HerwaySpacing.lg,
  },
  ctaWrap: {
    marginTop: HerwaySpacing.sm,
  },
});

import React, { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path } from 'react-native-svg';
import {
  FigmaImages,
  HerwayColors,
  HerwayRadii,
  HerwayShadows,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useAuth } from '@/features/auth/AuthContext';
import { useHerwayState } from '@/features/app/HerwayStateContext';
import { createIdempotencyKey, mobileApi } from '@/services/apiClient';
import { PILOT_CITIES } from '@/data/herwayCatalog';
import { CityDropdownField } from '@/components/CityDropdownField';
import { DateOfBirthField } from '@/components/DateOfBirthField';
import { InterestsSelectorField } from '@/components/InterestsSelectorField';
import { UserAvatar } from '@/components/UserAvatar';
import { validateDob } from '@/utils/dateOfBirth';
import { HerwayWordmark } from '@/components/onboarding/IntroIllustrations';
import {
  ErrorState,
  IconButton,
  Modal,
  PrimaryButton,
  ResponsiveContainer,
  SecondaryButton,
  StandardCard,
  StandardInput,
} from '@/components/ui';

type GenderOption = 'FEMALE' | 'MALE' | 'OTHER';
type RoleChoiceOption = 'TRAVELLER' | 'TRAVEL_BUDDY' | 'BOTH';

const CITY_OPTIONS = ['Kochi', 'Kannur', 'Kozhikode', 'Munnar', 'Wayanad', 'Alleppey', 'Varkala'];
const LANGUAGE_OPTIONS = ['English', 'Malayalam', 'Hindi', 'Tamil', 'Kannada'];
const INTEREST_OPTIONS = [
  'Heritage Walks',
  'Backwaters',
  'Cafes',
  'Photography',
  'Hill Stations',
  'Food Tours',
];

async function compressAvatarIfNeeded(uri: string): Promise<string> {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || !uri.startsWith('data:image')) {
    return uri;
  }
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const maxDim = 256;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(uri);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => resolve(uri);
    img.src = uri;
  });
}

function formatDobDisplay(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
  return trimmed;
}

function PencilLineIcon({ size = 20, color = HerwayColors.white }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L7.5 20.036H4v-3.572L16.732 3.732z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="13"
        y1="20.5"
        x2="20"
        y2="20.5"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  const { user, token, updateLocalUser, logout } = useAuth();
  const {
    profileDraft,
    updateProfileDraft,
    setSelectedCity,
    setSelectedRoleChoice,
    resetOnboarding,
  } = useHerwayState();

  const initialOccupation =
    (typeof user?.travelPreferencesJson?.occupation === 'string'
      ? user.travelPreferencesJson.occupation
      : '') ||
    profileDraft.occupation ||
    '';

  const initialGender: GenderOption =
    user?.gender === 'MALE' || profileDraft.gender === 'MALE'
      ? 'MALE'
      : user?.gender === 'OTHER'
        ? 'OTHER'
        : 'FEMALE';

  const deriveRoleChoice = (roles?: string[]): RoleChoiceOption => {
    if (roles?.includes('TRAVELLER') && roles?.includes('TRAVEL_BUDDY')) return 'BOTH';
    if (roles?.includes('TRAVEL_BUDDY')) return 'TRAVEL_BUDDY';
    return 'TRAVELLER';
  };

  const [fullName, setFullName] = useState(user?.fullName || profileDraft.fullName || '');
  const [homeCity, setHomeCity] = useState(user?.homeCity || profileDraft.homeCity || 'Kochi');
  const [dateOfBirth, setDateOfBirth] = useState(
    formatDobDisplay(user?.dateOfBirth) ||
      formatDobDisplay(profileDraft.dateOfBirth) ||
      '',
  );
  const [occupation, setOccupation] = useState(initialOccupation);
  const [gender, setGender] = useState<GenderOption>(initialGender);
  const [bio, setBio] = useState(user?.bio || profileDraft.bio || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(
    user?.avatarUrl || profileDraft.avatarUri || null,
  );
  const [languages, setLanguages] = useState<string[]>(
    user?.languages?.length ? user.languages : ['English', 'Malayalam'],
  );
  const [interests, setInterests] = useState<string[]>(
    user?.interests?.length ? user.interests : profileDraft.interests || [],
  );
  const [preferredDestinations, setPreferredDestinations] = useState<string[]>(
    user?.preferredDestinations?.length ? user.preferredDestinations : ['Kochi', 'Munnar'],
  );
  const [roleChoice, setRoleChoice] = useState<RoleChoiceOption>(deriveRoleChoice(user?.roles));
  const [discoverable, setDiscoverable] = useState<boolean>(
    user?.discoverableAsTraveller ?? true,
  );

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwFeedback, setPwFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      if (user.homeCity) setHomeCity(user.homeCity);
      if (user.dateOfBirth) setDateOfBirth(formatDobDisplay(user.dateOfBirth));
      const userOccupation =
        typeof user.travelPreferencesJson?.occupation === 'string'
          ? user.travelPreferencesJson.occupation
          : '';
      if (userOccupation) setOccupation(userOccupation);
      if (user.gender === 'MALE' || user.gender === 'FEMALE' || user.gender === 'OTHER') {
        setGender(user.gender);
      }
      if (user.bio !== undefined && user.bio !== null) setBio(user.bio);
      if (user.avatarUrl) setAvatarUri(user.avatarUrl);
      if (user.languages?.length) setLanguages(user.languages);
      if (user.interests?.length) setInterests(user.interests);
      if (user.preferredDestinations?.length) setPreferredDestinations(user.preferredDestinations);
      setRoleChoice(deriveRoleChoice(user.roles));
      if (user.discoverableAsTraveller !== undefined) {
        setDiscoverable(user.discoverableAsTraveller);
      }
    }
  }, [user]);

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  }

  async function pickAvatar() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.55,
      });
      if (!res.canceled && res.assets[0]) {
        const compressed = await compressAvatarIfNeeded(res.assets[0].uri);
        setAvatarUri(compressed);
        setFeedback(null);
      }
    } catch {
      setFeedback({ type: 'error', text: 'Could not open image picker on this device.' });
    }
  }

  async function handleSave() {
    if (saving) return;
    setFeedback(null);
    const cleanName = fullName.trim();
    if (!cleanName) {
      setFeedback({ type: 'error', text: 'Please enter your full name.' });
      return;
    }

    const dobCheck = validateDob(dateOfBirth, 'DD/MM/YYYY', false);
    if (!dobCheck.valid) {
      setFeedback({ type: 'error', text: dobCheck.error || 'Please enter a valid date of birth.' });
      return;
    }
    const isoDob = dobCheck.isoDate;

    const nextRoles =
      roleChoice === 'BOTH'
        ? ['TRAVELLER', 'TRAVEL_BUDDY']
        : roleChoice === 'TRAVEL_BUDDY'
          ? ['TRAVEL_BUDDY']
          : ['TRAVELLER'];

    const nextPrefs = {
      ...(user?.travelPreferencesJson || {}),
      occupation: occupation.trim(),
      selectedRoleChoice: roleChoice,
    };

    const cleanCity = homeCity.trim() || 'Kochi';
    const prevUserSnapshot = user ? { ...user } : null;

    setSaving(true);
    await updateLocalUser({
      fullName: cleanName,
      homeCity: cleanCity,
      dateOfBirth: isoDob || null,
      gender,
      bio: bio.trim(),
      avatarUrl: avatarUri,
      languages,
      interests,
      preferredDestinations,
      roles: nextRoles,
      discoverableAsTraveller: discoverable,
      travelPreferencesJson: nextPrefs,
    });

    try {
      if (token) {
        const updated = await mobileApi<Record<string, unknown>>('/users/me', {
          method: 'PATCH',
          idempotencyKey: createIdempotencyKey('profile-save'),
          body: JSON.stringify({
            fullName: cleanName,
            homeCity: cleanCity,
            dateOfBirth: isoDob,
            gender,
            bio: bio.trim(),
            avatarUrl: avatarUri || undefined,
            languages,
            interests,
            preferredDestinations,
            roles: nextRoles,
            discoverableAsTraveller: discoverable,
            travelPreferencesJson: nextPrefs,
          }),
        });
        await updateLocalUser(updated);
      }

      setSelectedRoleChoice(roleChoice);
      const matchedCity = CITY_OPTIONS.find(
        (c) => c.toLowerCase() === cleanCity.toLowerCase(),
      );
      if (
        matchedCity &&
        (matchedCity === 'Kochi' ||
          matchedCity === 'Kozhikode' ||
          matchedCity === 'Munnar' ||
          matchedCity === 'Wayanad')
      ) {
        setSelectedCity(matchedCity);
      }

      updateProfileDraft({
        fullName: cleanName,
        homeCity: cleanCity,
        dateOfBirth: isoDob || dateOfBirth.trim(),
        occupation: occupation.trim(),
        gender: gender === 'MALE' ? 'MALE' : 'FEMALE',
        bio: bio.trim(),
        avatarUri,
        interests,
      });

      setFeedback({ type: 'success', text: 'Profile saved cleanly ✓' });
    } catch (err) {
      if (prevUserSnapshot) {
        await updateLocalUser(prevUserSnapshot);
      }
      setFeedback({
        type: 'error',
        text: (err as Error).message || 'Could not save profile changes.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    setPwFeedback(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwFeedback({ type: 'error', text: 'Please fill in all password fields.' });
      return;
    }
    if (newPassword.length < 8) {
      setPwFeedback({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwFeedback({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (!token) {
      setPwFeedback({
        type: 'error',
        text: 'Sign in with an active session to update your account password.',
      });
      return;
    }

    setPwSubmitting(true);
    try {
      await mobileApi('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      setPwFeedback({ type: 'success', text: 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPwModalOpen(false);
        setPwFeedback(null);
      }, 900);
    } catch (err) {
      setPwFeedback({
        type: 'error',
        text: (err as Error).message || 'Could not update password.',
      });
    } finally {
      setPwSubmitting(false);
    }
  }

  function toggleTag(
    list: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    tag: string,
  ) {
    setter(list.includes(tag) ? list.filter((item) => item !== tag) : [...list, tag]);
  }

  const renderGenderField = () => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>Gender</Text>
      <View style={[styles.genderRow, layout.isSmallMobile && styles.genderRowWrap]}>
        {(['FEMALE', 'MALE', 'OTHER'] as const).map((option) => {
          const selected = gender === option;
          return (
            <Pressable
              key={option}
              onPress={() => setGender(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                styles.genderCard,
                selected && styles.genderCardSelected,
                layout.isSmallMobile && { minWidth: '47%' },
              ]}
            >
              <View style={[styles.radioCircle, selected && styles.radioCircleSelected]} />
              <Text style={[styles.genderText, selected && styles.genderTextSelected]}>
                {option === 'FEMALE' ? 'Female' : option === 'MALE' ? 'Male' : 'Other'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderExtendedProfileFields = () => (
    <>
      <CityDropdownField
        label="Home city"
        value={homeCity}
        onChange={setHomeCity}
        cities={PILOT_CITIES}
        placeholder="Select home city"
        customPlaceholder="Type your home city"
        variant="box"
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Active role</Text>
        <View style={styles.chipsWrap}>
          {(
            [
              { id: 'TRAVELLER', label: 'Traveller' },
              { id: 'TRAVEL_BUDDY', label: 'Travel Buddy' },
              { id: 'BOTH', label: 'Both (Traveller & Buddy)' },
            ] as const
          ).map((opt) => {
            const active = roleChoice === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setRoleChoice(opt.id)}
                style={[styles.editChip, active && styles.editChipActive]}
              >
                <Text style={[styles.editChipText, active && styles.editChipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Languages</Text>
        <View style={styles.chipsWrap}>
          {LANGUAGE_OPTIONS.map((lang) => {
            const active = languages.includes(lang);
            return (
              <Pressable
                key={lang}
                onPress={() => toggleTag(languages, setLanguages, lang)}
                style={[styles.editChip, active && styles.editChipActive]}
              >
                <Text style={[styles.editChipText, active && styles.editChipTextActive]}>
                  {lang}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <InterestsSelectorField
        label="Travel interests"
        options={INTEREST_OPTIONS}
        selected={interests}
        onChange={setInterests}
        variant="box"
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Preferred destinations</Text>
        <View style={styles.chipsWrap}>
          {CITY_OPTIONS.map((dest) => {
            const active = preferredDestinations.includes(dest);
            return (
              <Pressable
                key={dest}
                onPress={() => toggleTag(preferredDestinations, setPreferredDestinations, dest)}
                style={[styles.editChip, active && styles.editChipActive]}
              >
                <Text style={[styles.editChipText, active && styles.editChipTextActive]}>
                  {dest}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.discoverySwitchRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.fieldLabel}>Allow Nearby Travellers Discovery</Text>
          <Text style={styles.discoveryHint}>
            Only approximate city distance is shown—exact live location is never public.
          </Text>
        </View>
        <Switch
          value={discoverable}
          onValueChange={setDiscoverable}
          trackColor={{ false: HerwayColors.dotInactive, true: HerwayColors.teal }}
          thumbColor={HerwayColors.white}
        />
      </View>
    </>
  );

  const renderFeedback = () => {
    if (!feedback) return null;
    if (feedback.type === 'error') {
      return <ErrorState inline message={feedback.text} />;
    }
    return (
      <StandardCard tone="mint" compact>
        <View style={styles.feedbackRow}>
          <MaterialIcons name="check-circle-outline" size={18} color={HerwayColors.safe} />
          <Text style={styles.feedbackSuccessText}>{feedback.text}</Text>
        </View>
      </StandardCard>
    );
  };

  const renderPasswordModal = () => (
    <Modal
      visible={pwModalOpen}
      onClose={() => {
        setPwModalOpen(false);
        setPwFeedback(null);
      }}
      title="Change password"
      subtitle="Enter your current password and choose a new password of at least 8 characters."
      maxWidth={440}
      footer={
        <View style={styles.modalActions}>
          <SecondaryButton
            label="Cancel"
            onPress={() => {
              setPwModalOpen(false);
              setPwFeedback(null);
            }}
            style={{ flex: 1 }}
          />
          <PrimaryButton
            label={pwSubmitting ? 'Updating...' : 'Update password'}
            loading={pwSubmitting}
            disabled={pwSubmitting}
            onPress={handleChangePassword}
            style={{ flex: 1.4 }}
          />
        </View>
      }
    >
      <View style={{ gap: HerwaySpacing.md }}>
        {pwFeedback && (
          pwFeedback.type === 'error' ? (
            <ErrorState inline message={pwFeedback.text} />
          ) : (
            <StandardCard tone="mint" compact>
              <Text style={styles.feedbackSuccessText}>{pwFeedback.text}</Text>
            </StandardCard>
          )
        )}

        <StandardInput
          label="Current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry={!showCurrentPw}
          placeholder="Current password"
          surface="white"
          rightSlot={
            <IconButton
              icon={showCurrentPw ? 'visibility-off' : 'visibility'}
              size="small"
              onPress={() => setShowCurrentPw((v) => !v)}
              accessibilityLabel={showCurrentPw ? 'Hide current password' : 'Show current password'}
            />
          }
        />

        <StandardInput
          label="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry={!showNewPw}
          placeholder="New password"
          surface="white"
          rightSlot={
            <IconButton
              icon={showNewPw ? 'visibility-off' : 'visibility'}
              size="small"
              onPress={() => setShowNewPw((v) => !v)}
              accessibilityLabel={showNewPw ? 'Hide new password' : 'Show new password'}
            />
          }
        />

        <StandardInput
          label="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showNewPw}
          placeholder="Confirm password"
          surface="white"
        />
      </View>
    </Modal>
  );

  if (layout.isWideLayout) {
    return (
      <View style={styles.desktopRoot}>
        <StatusBar style="dark" />
        {renderPasswordModal()}

        <View style={styles.desktopTopBar}>
          <View
            style={[
              styles.desktopTopInner,
              { maxWidth: layout.maxContentWidth, paddingHorizontal: layout.pageGutter },
            ]}
          >
            <Pressable onPress={() => router.push('/(tabs)')}>
              <HerwayWordmark size={26} />
            </Pressable>
            <SecondaryButton
              label="Back to Safety & Profile"
              icon="arrow-back"
              onPress={handleBack}
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.desktopScroll}
          showsVerticalScrollIndicator={false}
        >
          <ResponsiveContainer maxWidth={920}>
            <View style={styles.desktopCard}>
              <View style={styles.desktopHero}>
                <Image
                  source={FigmaImages.detailHero}
                  style={styles.heroBgImage}
                  resizeMode="cover"
                />
                <View style={styles.heroDarkOverlay} />

                <View style={styles.desktopHeroContent}>
                  <View style={{ flex: 1 }}>
                    <Text style={[layout.type.sectionHeading, styles.desktopHeroTitle]}>
                      Edit profile
                    </Text>
                    <Text style={styles.desktopHeroSub}>
                      Keep your Herway personal profile, occupation, and bio up to date
                    </Text>
                  </View>

                  <Pressable
                    onPress={pickAvatar}
                    style={styles.heroEditCircle}
                    accessibilityRole="button"
                    accessibilityLabel="Change profile photo"
                  >
                    <PencilLineIcon size={18} color={HerwayColors.white} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.desktopBody}>
                <View style={styles.desktopAvatarBar}>
                  <View style={styles.desktopAvatarGroup}>
                    <Pressable onPress={pickAvatar} style={styles.desktopAvatarRing}>
                      <UserAvatar uri={avatarUri} size={96} imageStyle={styles.desktopAvatarImg} />
                    </Pressable>
                    <View style={styles.desktopIdentityMeta}>
                      <Text style={[layout.type.sectionHeading, { color: HerwayColors.ink }]}>
                        {fullName.trim() || 'Herway Traveller'}
                      </Text>
                      <Text style={styles.desktopIdentitySub}>
                        {user?.email || 'traveller@herway.in'} • {occupation.trim() || 'Traveller'}
                      </Text>
                    </View>
                  </View>

                  <SecondaryButton
                    label="Change photo"
                    icon="photo-camera"
                    onPress={pickAvatar}
                  />
                </View>

                {feedback ? <View style={{ marginBottom: HerwaySpacing.lg }}>{renderFeedback()}</View> : null}

                <View style={styles.desktopFormGrid}>
                  <View style={styles.desktopRow}>
                    <View style={styles.desktopCol}>
                      <StandardInput
                        label="Full name"
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="Full name"
                        surface="white"
                      />
                    </View>
                    <View style={styles.desktopCol}>
                      <DateOfBirthField
                        label="Date of birth"
                        value={dateOfBirth}
                        onChange={setDateOfBirth}
                        format="DD/MM/YYYY"
                        variant="box"
                      />
                    </View>
                  </View>

                  <View style={styles.desktopRow}>
                    <View style={styles.desktopCol}>
                      <StandardInput
                        label="Occupation"
                        value={occupation}
                        onChangeText={setOccupation}
                        placeholder="Occupation"
                        surface="white"
                      />
                    </View>
                    <View style={styles.desktopCol}>{renderGenderField()}</View>
                  </View>

                  <StandardInput
                    label="Bio"
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Bio"
                    multiline
                    numberOfLines={4}
                    surface="white"
                  />

                  {renderExtendedProfileFields()}
                </View>

                <View style={styles.desktopFooter}>
                  <View style={styles.footerCluster}>
                    <SecondaryButton
                      label="Change password"
                      onPress={() => {
                        setPwFeedback(null);
                        setPwModalOpen(true);
                      }}
                    />
                    <SecondaryButton
                      label="Sign out"
                      tone="danger"
                      onPress={async () => {
                        await logout();
                        resetOnboarding();
                        router.replace('/welcome');
                      }}
                    />
                  </View>

                  <View style={styles.footerCluster}>
                    <SecondaryButton label="Cancel" onPress={handleBack} />
                    <PrimaryButton
                      label={saving ? 'Saving...' : 'Save'}
                      loading={saving}
                      disabled={saving}
                      onPress={handleSave}
                      style={{ minWidth: 148 }}
                    />
                  </View>
                </View>
              </View>
            </View>
          </ResponsiveContainer>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.mobileRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      {renderPasswordModal()}

      <ScrollView
        style={styles.mobileScroll}
        contentContainerStyle={styles.mobileScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={[styles.mobileHero, { height: 128 + insets.top }]}>
          <Image source={FigmaImages.detailHero} style={styles.heroBgImage} resizeMode="cover" />
          <View style={styles.heroDarkOverlay} />

          <View
            style={[
              styles.mobileHeroTopBar,
              {
                paddingTop: Math.max(insets.top + HerwaySpacing.sm, HerwaySpacing.lg),
                paddingHorizontal: layout.pageGutter,
              },
            ]}
          >
            <Pressable
              onPress={handleBack}
              hitSlop={10}
              style={styles.mobileTitleBackRow}
              accessibilityRole="button"
              accessibilityLabel="Back from edit profile"
            >
              <MaterialIcons name="chevron-left" size={24} color={HerwayColors.white} />
              <Text style={[layout.type.sectionHeading, { color: HerwayColors.white }]}>
                Edit profile
              </Text>
            </Pressable>

            <Pressable
              onPress={pickAvatar}
              style={styles.heroEditCircle}
              accessibilityRole="button"
              accessibilityLabel="Edit profile photo"
            >
              <PencilLineIcon size={20} color={HerwayColors.white} />
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.mobileSheet,
            {
              paddingHorizontal: layout.pageGutter,
              paddingBottom: Math.max(insets.bottom + HerwaySpacing.xl, HerwaySpacing.xxl),
            },
          ]}
        >
          <Pressable
            onPress={pickAvatar}
            style={styles.mobileAvatarRing}
            accessibilityRole="button"
            accessibilityLabel="Change profile avatar"
          >
            <UserAvatar uri={avatarUri} size={82} imageStyle={styles.mobileAvatarImg} />
          </Pressable>

          {feedback ? <View style={{ marginTop: HerwaySpacing.md }}>{renderFeedback()}</View> : null}

          <View style={styles.mobileForm}>
            <StandardInput
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full name"
              surface="white"
            />

            <DateOfBirthField
              label="Date of birth"
              value={dateOfBirth}
              onChange={setDateOfBirth}
              format="DD/MM/YYYY"
              variant="box"
            />

            <StandardInput
              label="Occupation"
              value={occupation}
              onChangeText={setOccupation}
              placeholder="Occupation"
              surface="white"
            />

            {renderGenderField()}

            <StandardInput
              label="Bio"
              value={bio}
              onChangeText={setBio}
              placeholder="Bio"
              multiline
              numberOfLines={3}
              surface="white"
            />

            {renderExtendedProfileFields()}
          </View>

          <View style={styles.mobileActions}>
            <PrimaryButton
              label={saving ? 'Saving...' : 'Save'}
              loading={saving}
              disabled={saving}
              onPress={handleSave}
              fullWidth
            />
            <SecondaryButton
              label="Change password"
              onPress={() => {
                setPwFeedback(null);
                setPwModalOpen(true);
              }}
              fullWidth
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  heroBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(19, 26, 32, 0.72)',
  },
  heroEditCircle: {
    width: HerwaySizes.touchTargetMin,
    height: HerwaySizes.touchTargetMin,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: HerwaySizes.borderWidth,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileRoot: { flex: 1, backgroundColor: HerwayColors.white },
  mobileScroll: { flex: 1, backgroundColor: HerwayColors.white },
  mobileScrollContent: { flexGrow: 1, backgroundColor: HerwayColors.white },
  mobileHero: { width: '100%', backgroundColor: HerwayColors.ink, overflow: 'hidden' },
  mobileHeroTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mobileTitleBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
    minHeight: HerwaySizes.touchTargetMin,
  },
  mobileSheet: {
    flex: 1,
    marginTop: -24,
    backgroundColor: HerwayColors.white,
    borderTopLeftRadius: HerwayRadii.sheet,
    borderTopRightRadius: HerwayRadii.sheet,
  },
  mobileAvatarRing: {
    alignSelf: 'center',
    marginTop: -44,
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: HerwayColors.white,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    ...HerwayShadows.card,
  },
  mobileAvatarImg: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: HerwayColors.inputBg,
  },
  mobileForm: {
    marginTop: HerwaySpacing.md,
    gap: HerwaySpacing.lg,
  },
  mobileActions: {
    marginTop: HerwaySpacing.xl,
    gap: HerwaySpacing.md,
  },
  fieldGroup: { gap: HerwaySpacing.xs },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: HerwayColors.ink,
    marginLeft: HerwaySpacing.xs,
  },
  genderRow: { flexDirection: 'row', gap: HerwaySpacing.md },
  genderRowWrap: { flexWrap: 'wrap' },
  genderCard: {
    flex: 1,
    minHeight: HerwaySizes.inputMinHeight,
    borderRadius: HerwayRadii.input,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    backgroundColor: HerwayColors.white,
    paddingHorizontal: HerwaySpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  genderCardSelected: {
    borderColor: HerwayColors.teal,
    backgroundColor: HerwayColors.mintMid,
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: HerwayColors.borderStrong,
  },
  radioCircleSelected: {
    borderWidth: 0,
    backgroundColor: HerwayColors.teal,
  },
  genderText: { fontSize: 14, fontWeight: '500', color: HerwayColors.ink },
  genderTextSelected: { fontWeight: '700', color: HerwayColors.tealDark },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: HerwaySpacing.sm },
  feedbackSuccessText: { fontSize: 13, fontWeight: '600', color: HerwayColors.successText },
  desktopRoot: { flex: 1, backgroundColor: HerwayColors.creamBg },
  desktopTopBar: {
    backgroundColor: HerwayColors.white,
    borderBottomWidth: HerwaySizes.borderWidth,
    borderBottomColor: HerwayColors.border,
  },
  desktopTopInner: {
    width: '100%',
    alignSelf: 'center',
    height: HerwaySizes.navbarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.md,
  },
  desktopScroll: { paddingVertical: HerwaySpacing.xxl },
  desktopCard: {
    width: '100%',
    backgroundColor: HerwayColors.white,
    borderRadius: HerwayRadii.card,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    overflow: 'hidden',
    ...HerwayShadows.card,
  },
  desktopHero: { height: 168, backgroundColor: HerwayColors.ink, justifyContent: 'flex-start' },
  desktopHeroContent: {
    paddingHorizontal: HerwaySpacing.xxl,
    paddingTop: HerwaySpacing.xl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: HerwaySpacing.md,
  },
  desktopHeroTitle: { color: HerwayColors.white },
  desktopHeroSub: {
    marginTop: HerwaySpacing.xs,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.82)',
  },
  desktopBody: {
    marginTop: -24,
    backgroundColor: HerwayColors.white,
    borderTopLeftRadius: HerwayRadii.card,
    borderTopRightRadius: HerwayRadii.card,
    paddingHorizontal: HerwaySpacing.xxl,
    paddingBottom: HerwaySpacing.xxl,
  },
  desktopAvatarBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -44,
    marginBottom: HerwaySpacing.xl,
    gap: HerwaySpacing.md,
  },
  desktopAvatarGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: HerwaySpacing.md,
    flex: 1,
    minWidth: 220,
  },
  desktopAvatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: HerwayColors.white,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    ...HerwayShadows.card,
  },
  desktopAvatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: HerwayColors.inputBg,
  },
  desktopIdentityMeta: { paddingBottom: HerwaySpacing.sm, gap: 2, flex: 1, minWidth: 0 },
  desktopIdentitySub: { fontSize: 13, fontWeight: '500', color: HerwayColors.muted },
  desktopFormGrid: { gap: HerwaySpacing.lg },
  desktopRow: { flexDirection: 'row', gap: HerwaySpacing.lg },
  desktopCol: { flex: 1, minWidth: 0 },
  desktopFooter: {
    marginTop: HerwaySpacing.xl,
    paddingTop: HerwaySpacing.xl,
    borderTopWidth: HerwaySizes.borderWidth,
    borderTopColor: HerwayColors.borderSubtle,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.md,
  },
  footerCluster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  modalActions: { flexDirection: 'row', gap: HerwaySpacing.md },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: HerwaySpacing.sm, marginTop: HerwaySpacing.xs },
  editChip: {
    minHeight: HerwaySizes.buttonSmall,
    justifyContent: 'center',
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.pill,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    backgroundColor: HerwayColors.inputBg,
  },
  editChipActive: {
    backgroundColor: HerwayColors.tealSoft,
    borderColor: HerwayColors.teal,
  },
  editChipText: { fontSize: 13, fontWeight: '600', color: HerwayColors.textSecondary },
  editChipTextActive: { color: HerwayColors.tealDark, fontWeight: '700' },
  discoverySwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.md,
    paddingHorizontal: HerwaySpacing.lg,
    borderRadius: HerwayRadii.input,
    backgroundColor: HerwayColors.inputBg,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.inputBorder,
  },
  discoveryHint: {
    fontSize: 12,
    color: HerwayColors.muted,
    marginTop: 2,
    lineHeight: 17,
  },
});

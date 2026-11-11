import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { Href, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  HerwayColors,
  HerwayRadii,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useAuth } from '@/features/auth/AuthContext';
import { useHerwayState } from '@/features/app/HerwayStateContext';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { PrimaryButton, SearchInput } from '@/components/ui';
import { ElasticBounce } from '@/components/motion/HerwayMotion';

const LANGUAGE_OPTIONS = [
  { id: 'English', label: 'English', flag: '🇬🇧' },
  { id: 'Malayalam', label: 'Malayalam', flag: '🇮🇳' },
  { id: 'Hindi', label: 'Hindi', flag: '🇮🇳' },
  { id: 'Tamil', label: 'Tamil', flag: '🇮🇳' },
  { id: 'Italian', label: 'Italian', flag: '🇮🇹' },
  { id: 'Chinese', label: 'Chinese', flag: '🇨🇳' },
  { id: 'French', label: 'French', flag: '🇫🇷' },
  { id: 'German', label: 'German', flag: '🇩🇪' },
  { id: 'Spanish', label: 'Spanish', flag: '🇪🇸' },
] as const;

export default function ChooseLanguageScreen() {
  const router = useRouter();
  const layout = useResponsiveLayout();

  const { selectedLanguage, setSelectedLanguage, setAccountVerified } = useHerwayState();
  const { updateLocalUser } = useAuth();
  const [search, setSearch] = useState('');

  const filteredLanguages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return LANGUAGE_OPTIONS;
    return LANGUAGE_OPTIONS.filter((lang) => lang.label.toLowerCase().includes(q));
  }, [search]);

  async function handleContinue() {
    await updateLocalUser({ languages: [selectedLanguage] });
    setAccountVerified(true);
    router.push('/(onboarding)/create-profile' as Href);
  }

  const twoCols = layout.isDesktopWorkspace;

  return (
    <OnboardingLayout
      currentStep={3}
      onBack={() => router.back()}
      desktopHeading="Choose your preferred language"
      desktopSubheading="Herway localizes Safe Haven guidance, emergency instructions, and Travel Buddy matching for you."
      desktopIllustrationSlide={0}
    >
      <Text style={[layout.type.pageHeading, styles.title]}>Choose the language</Text>
      <Text style={[layout.type.secondary, styles.subtitle]}>
        Select the language you prefer for safety alerts, Safe Havens, and companion profiles.
      </Text>

      <View style={styles.searchWrap}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
          placeholder="Search language"
          surface="white"
        />
      </View>

      <View style={[styles.listWrap, twoCols && styles.listWrapDesktop]}>
        {filteredLanguages.map((item) => {
          const selected = selectedLanguage === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setSelectedLanguage(item.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                styles.langRow,
                twoCols && styles.langRowHalf,
                selected && styles.langRowSelected,
              ]}
            >
              <View style={styles.langLeft}>
                <Text style={styles.flag}>{item.flag}</Text>
                <Text style={styles.langLabel} numberOfLines={1}>
                  {item.label}
                </Text>
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
            </Pressable>
          );
        })}
      </View>

      <PrimaryButton label="Continue" onPress={handleContinue} fullWidth />
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    color: HerwayColors.ink,
  },
  subtitle: {
    marginTop: HerwaySpacing.sm,
    color: HerwayColors.muted,
    marginBottom: HerwaySpacing.lg,
  },
  searchWrap: {
    marginBottom: HerwaySpacing.lg,
  },
  listWrap: {
    gap: HerwaySpacing.md,
    marginBottom: HerwaySpacing.xl,
  },
  listWrapDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: HerwaySpacing.md,
  },
  langRow: {
    minHeight: HerwaySizes.inputHeight,
    borderRadius: HerwayRadii.input,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    backgroundColor: HerwayColors.white,
    paddingHorizontal: HerwaySpacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.md,
  },
  langRowHalf: {
    width: '48.5%',
  },
  langRowSelected: {
    backgroundColor: HerwayColors.tealSoft,
    borderColor: HerwayColors.teal,
  },
  langLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.md,
    flex: 1,
    minWidth: 0,
  },
  flag: {
    fontSize: 20,
  },
  langLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: HerwayColors.ink,
    flex: 1,
  },
  radioSelected: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: HerwayColors.tealDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioUnselected: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: HerwayColors.borderStrong,
  },
});

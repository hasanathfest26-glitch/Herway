import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HerwayColors,
  HerwayRadii,
  HerwayShadows,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { MintGradientBackground } from '@/components/onboarding/MintGradientBackground';
import {
  HerwayWordmark,
  IntroSlideIllustration,
} from '@/components/onboarding/IntroIllustrations';
import { PrimaryButton, SecondaryButton, StatusBadge } from '@/components/ui';
import { RevealMask } from '@/components/motion/HerwayMotion';

const INTRO_SLIDES = [
  {
    tag: '01 • SAFE NETWORK',
    title: 'All You Need, One App',
    description:
      'From verified Safe Havens to 18+ Travel Buddies, Herway brings every safety tool together—quickly and reliably.',
  },
  {
    tag: '02 • 18+ COMPANIONS',
    title: 'Verified Women Buddies',
    description:
      'Connect with live-selfie vetted Travel Buddies with private in-app chat and public meetups.',
  },
  {
    tag: '03 • LIVE SAFETY',
    title: 'Protected Every Mile',
    description:
      'Share expiring browser live-location links, confirm scheduled check-ins, and access offline 112 SOS anytime.',
  },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  const [slideIndex, setSlideIndex] = useState(0);
  const current = INTRO_SLIDES[slideIndex];
  const isLast = slideIndex === INTRO_SLIDES.length - 1;

  function handleNext() {
    if (!isLast) {
      setSlideIndex((prev) => prev + 1);
      return;
    }
    router.replace('/(auth)/login');
  }

  function handleSkip() {
    router.replace('/(auth)/login');
  }

  if (layout.isWideLayout) {
    const stackedTablet = !layout.isDesktopWorkspace;
    return (
      <View style={styles.desktopRoot}>
        <StatusBar style="dark" />
        <MintGradientBackground variant="hero" />

        <View
          style={[
            styles.desktopNav,
            {
              maxWidth: layout.maxContentWidth,
              paddingHorizontal: layout.pageGutter,
            },
          ]}
        >
          <HerwayWordmark size={32} />
          <View style={styles.desktopNavRight}>
            <StatusBadge
              label="Kerala Travel Safety Pilot"
              tone="info"
              icon="shield"
            />
            <SecondaryButton
              label="Log in / Sign up"
              onPress={handleSkip}
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.desktopCenter,
            { paddingHorizontal: layout.pageGutter },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.desktopHeroGrid,
              { maxWidth: layout.maxContentWidth },
              stackedTablet && styles.tabletHeroStack,
            ]}
          >
            <View style={[styles.desktopLeftCol, stackedTablet && { width: '100%' }]}>
              <View style={styles.slideTabs}>
                {INTRO_SLIDES.map((item, idx) => {
                  const active = slideIndex === idx;
                  return (
                    <Pressable
                      key={item.tag}
                      onPress={() => setSlideIndex(idx)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[styles.slideTab, active && styles.slideTabActive]}
                    >
                      <Text
                        style={[
                          styles.slideTabText,
                          active && styles.slideTabTextActive,
                        ]}
                      >
                        {item.tag}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <RevealMask triggerKey={slideIndex} offsetY={12} scrollTrigger={false}>
                <Text style={[layout.type.pageHeading, styles.desktopTitle]}>
                  {current.title}
                </Text>
                <Text style={[layout.type.body, styles.desktopDesc]}>
                  {current.description}
                </Text>
              </RevealMask>

              <View style={styles.desktopActions}>
                <SecondaryButton
                  label="Skip"
                  onPress={handleSkip}
                  style={{ minWidth: 120 }}
                />
                <PrimaryButton
                  label={isLast ? 'Get Started' : 'Next'}
                  rightIcon="arrow-forward"
                  onPress={handleNext}
                  style={{ minWidth: 168 }}
                />
              </View>

              <View style={styles.desktopDotsRow}>
                {INTRO_SLIDES.map((_, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => setSlideIndex(idx)}
                    hitSlop={16}
                    accessibilityRole="button"
                    accessibilityLabel={`Slide ${idx + 1}`}
                    style={[styles.dot, slideIndex === idx && styles.dotActive]}
                  />
                ))}
              </View>
            </View>

            <View
              style={[
                styles.desktopRightCard,
                stackedTablet && { width: '100%', maxWidth: 540 },
              ]}
            >
              <RevealMask triggerKey={slideIndex} offsetX={14} offsetY={0} scrollTrigger={false}>
                <IntroSlideIllustration
                  slideIndex={slideIndex}
                  size={stackedTablet ? 260 : 300}
                />
              </RevealMask>
              <View style={styles.desktopBadgeRow}>
                <StatusBadge label="Verified Safe Havens" tone="info" icon="verified-user" />
                <StatusBadge label="Live Share Links" tone="info" icon="share-location" />
                <StatusBadge label="112 Offline SOS" tone="info" icon="phone-in-talk" />
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.mobileRoot}>
      <StatusBar style="dark" />
      <MintGradientBackground variant="hero" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.mobileScrollWrap}
      >
        <View
          style={[
            styles.mobileHeroArea,
            { paddingTop: Math.max(insets.top + HerwaySpacing.md, HerwaySpacing.xl) },
          ]}
        >
          <IntroSlideIllustration
            slideIndex={slideIndex}
            size={layout.isSmallMobile ? 210 : 264}
          />
        </View>

        <View
          style={[
            styles.mobileSheet,
            {
              paddingHorizontal: layout.pageGutter,
              paddingBottom: Math.max(insets.bottom + HerwaySpacing.lg, HerwaySpacing.xl),
            },
          ]}
        >
          <Text style={[layout.type.pageHeading, styles.mobileTitle]}>
            {current.title}
          </Text>
          <Text style={[layout.type.body, styles.mobileDesc]}>
            {current.description}
          </Text>

          <View style={styles.mobileBtnRow}>
            <SecondaryButton
              label="Skip"
              onPress={handleSkip}
              style={{ flex: 1, minHeight: HerwaySizes.buttonPrimary }}
            />
            <PrimaryButton
              label={isLast ? 'Get Started' : 'Next'}
              onPress={handleNext}
              style={{ flex: 1 }}
            />
          </View>

          <View style={styles.dotsRow}>
            {INTRO_SLIDES.map((_, idx) => (
              <Pressable
                key={idx}
                onPress={() => setSlideIndex(idx)}
                hitSlop={16}
                accessibilityRole="button"
                accessibilityLabel={`Slide ${idx + 1}`}
                style={[styles.dot, slideIndex === idx && styles.dotActive]}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mobileRoot: {
    flex: 1,
    backgroundColor: HerwayColors.creamBg,
  },
  mobileScrollWrap: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  mobileHeroArea: {
    flex: 1,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: HerwaySpacing.lg,
    paddingVertical: HerwaySpacing.lg,
  },
  mobileSheet: {
    backgroundColor: HerwayColors.white,
    borderTopLeftRadius: HerwayRadii.sheet,
    borderTopRightRadius: HerwayRadii.sheet,
    borderTopWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    paddingTop: HerwaySpacing.xxl,
    ...HerwayShadows.card,
  },
  mobileTitle: {
    color: HerwayColors.ink,
    textAlign: 'center',
  },
  mobileDesc: {
    marginTop: HerwaySpacing.md,
    color: HerwayColors.muted,
    textAlign: 'center',
  },
  mobileBtnRow: {
    marginTop: HerwaySpacing.xl,
    flexDirection: 'row',
    gap: HerwaySpacing.md,
  },
  dotsRow: {
    marginTop: HerwaySpacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: HerwaySpacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: HerwayColors.dotInactive,
  },
  dotActive: {
    width: 24,
    backgroundColor: HerwayColors.teal,
  },
  desktopRoot: {
    flex: 1,
    backgroundColor: HerwayColors.creamBg,
  },
  desktopNav: {
    width: '100%',
    alignSelf: 'center',
    paddingTop: HerwaySpacing.xl,
    paddingBottom: HerwaySpacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.md,
  },
  desktopNavRight: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: HerwaySpacing.md,
  },
  desktopCenter: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: HerwaySpacing.xl,
  },
  desktopHeroGrid: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.section,
  },
  tabletHeroStack: {
    flexDirection: 'column',
    gap: HerwaySpacing.xxl,
  },
  desktopLeftCol: {
    flex: 1,
    minWidth: 0,
  },
  slideTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: HerwaySpacing.sm,
    marginBottom: HerwaySpacing.xl,
  },
  slideTab: {
    minHeight: HerwaySizes.buttonSmall,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.sm,
    borderRadius: HerwayRadii.pill,
    backgroundColor: HerwayColors.white,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    justifyContent: 'center',
  },
  slideTabActive: {
    backgroundColor: HerwayColors.tealSoft,
    borderColor: HerwayColors.teal,
  },
  slideTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: HerwayColors.muted,
  },
  slideTabTextActive: {
    color: HerwayColors.tealDark,
    fontWeight: '700',
  },
  desktopTitle: {
    color: HerwayColors.ink,
  },
  desktopDesc: {
    marginTop: HerwaySpacing.lg,
    color: HerwayColors.textSecondary,
    maxWidth: 520,
  },
  desktopActions: {
    marginTop: HerwaySpacing.xxl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: HerwaySpacing.md,
  },
  desktopDotsRow: {
    marginTop: HerwaySpacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  desktopRightCard: {
    width: 440,
    backgroundColor: HerwayColors.white,
    borderRadius: HerwayRadii.card,
    padding: HerwaySpacing.xxl,
    alignItems: 'center',
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    ...HerwayShadows.card,
  },
  desktopBadgeRow: {
    marginTop: HerwaySpacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: HerwaySpacing.sm,
  },
});

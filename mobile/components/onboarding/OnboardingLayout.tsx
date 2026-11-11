import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  HerwayColors,
  HerwayRadii,
  HerwayShadows,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { IconButton } from '@/components/ui/Buttons';
import { MintGradientBackground } from './MintGradientBackground';
import { HerwayWordmark, IntroSlideIllustration } from './IntroIllustrations';

interface OnboardingLayoutProps {
  currentStep?: 1 | 2 | 3 | 4 | 5 | 6;
  onBack?: () => void;
  desktopHeading?: string;
  desktopSubheading?: string;
  desktopIllustrationSlide?: number;
  children: React.ReactNode;
}

export function OnboardingLayout({
  onBack,
  desktopHeading = 'Travel safely across Kerala with Herway',
  desktopSubheading = 'Verified Safe Havens, 18+ women Travel Buddies, scheduled check-ins, and 24/7 SOS coordination.',
  desktopIllustrationSlide = 0,
  children,
}: OnboardingLayoutProps) {
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const isWide = layout.isWideLayout; // >= 768px
  const showSideShowcase = layout.isDesktopWorkspace; // >= 1024px so 768px tablet never crushes form

  if (isWide) {
    return (
      <View style={styles.desktopRoot}>
        <StatusBar style="dark" />
        <MintGradientBackground variant="soft" />

        <View
          style={[
            styles.desktopHeader,
            { maxWidth: layout.maxContentWidth, paddingHorizontal: layout.pageGutter },
          ]}
        >
          <HerwayWordmark size={30} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.desktopScroll,
            { paddingHorizontal: layout.pageGutter },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.desktopCard,
              { maxWidth: showSideShowcase ? 1120 : 640 },
            ]}
          >
            {showSideShowcase && (
              <View style={styles.desktopLeft}>
                <View style={styles.desktopPill}>
                  <MaterialIcons name="verified-user" size={14} color={HerwayColors.tealDark} />
                  <Text style={styles.desktopPillText}>KERALA SAFETY PLATFORM</Text>
                </View>

                <View style={styles.desktopIllustWrap}>
                  <IntroSlideIllustration slideIndex={desktopIllustrationSlide} size={220} />
                </View>

                <View>
                  <Text style={styles.desktopShowcaseTitle}>{desktopHeading}</Text>
                  <Text style={styles.desktopShowcaseSub}>{desktopSubheading}</Text>
                </View>

                <View style={styles.desktopHighlights}>
                  <View style={styles.highlightRow}>
                    <View style={styles.highlightDot} />
                    <Text style={styles.highlightText}>Admin-verified Safe Haven hotels &amp; clinics</Text>
                  </View>
                  <View style={styles.highlightRow}>
                    <View style={styles.highlightDot} />
                    <Text style={styles.highlightText}>18+ live-selfie vetted Travel Buddies</Text>
                  </View>
                  <View style={styles.highlightRow}>
                    <View style={styles.highlightDot} />
                    <Text style={styles.highlightText}>Offline 112 &amp; Kerala Pink Police 1515 pack</Text>
                  </View>
                </View>
              </View>
            )}

            <View
              style={[
                styles.desktopRight,
                { padding: showSideShowcase ? HerwaySpacing.xxxl : HerwaySpacing.xxl },
              ]}
            >
              {onBack && (
                <View style={styles.backWrap}>
                  <IconButton
                    icon="arrow-back"
                    onPress={onBack}
                    accessibilityLabel="Go back"
                    tone="surface"
                  />
                </View>
              )}
              <View style={styles.desktopFormInner}>{children}</View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.mobileRoot}>
      <StatusBar style="dark" />
      <MintGradientBackground variant="soft" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.mobileScroll,
          {
            paddingHorizontal: layout.pageGutter,
            paddingTop: Math.max(insets.top + HerwaySpacing.md, HerwaySpacing.xl),
            paddingBottom: Math.max(insets.bottom + HerwaySpacing.xl, HerwaySpacing.xxl),
          },
        ]}
      >
        {onBack && (
          <View style={styles.backWrap}>
            <IconButton
              icon="arrow-back"
              onPress={onBack}
              accessibilityLabel="Go back"
              tone="surface"
            />
          </View>
        )}
        <View style={styles.mobileBody}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mobileRoot: {
    flex: 1,
    backgroundColor: HerwayColors.creamBg,
  },
  mobileScroll: {
    flexGrow: 1,
  },
  mobileBody: {
    flex: 1,
  },
  backWrap: {
    alignSelf: 'flex-start',
    marginBottom: HerwaySpacing.lg,
  },
  desktopRoot: {
    flex: 1,
    backgroundColor: HerwayColors.creamBg,
  },
  desktopHeader: {
    width: '100%',
    alignSelf: 'center',
    paddingTop: HerwaySpacing.xl,
    paddingBottom: HerwaySpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  desktopScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: HerwaySpacing.xl,
  },
  desktopCard: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    borderRadius: HerwayRadii.card,
    backgroundColor: HerwayColors.white,
    overflow: 'hidden',
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    ...HerwayShadows.card,
  },
  desktopLeft: {
    width: '44%',
    backgroundColor: HerwayColors.mintMid,
    padding: HerwaySpacing.xxl,
    justifyContent: 'space-between',
    gap: HerwaySpacing.lg,
    borderRightWidth: HerwaySizes.borderWidth,
    borderRightColor: HerwayColors.border,
  },
  desktopPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
    backgroundColor: HerwayColors.white,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.pill,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.tealSoft,
  },
  desktopPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: HerwayColors.tealDark,
    letterSpacing: 0.3,
  },
  desktopIllustWrap: {
    alignItems: 'center',
    marginVertical: HerwaySpacing.sm,
  },
  desktopShowcaseTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: HerwayColors.ink,
    lineHeight: 28,
  },
  desktopShowcaseSub: {
    marginTop: HerwaySpacing.sm,
    fontSize: 14,
    color: HerwayColors.textSecondary,
    lineHeight: 20,
  },
  desktopHighlights: {
    gap: HerwaySpacing.sm,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  highlightDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: HerwayColors.teal,
  },
  highlightText: {
    fontSize: 13,
    fontWeight: '600',
    color: HerwayColors.ink,
    flex: 1,
  },
  desktopRight: {
    flex: 1,
    backgroundColor: HerwayColors.creamBg,
    justifyContent: 'center',
  },
  desktopFormInner: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
});

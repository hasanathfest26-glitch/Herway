import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { HerwayColors, HerwaySpacing } from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { IconButton } from './Buttons';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Page-level heading (32px desktop / 26px mobile) with baseline-aligned right actions.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  onBack,
  rightSlot,
  style,
}: PageHeaderProps) {
  const layout = useResponsiveLayout();

  return (
    <View style={[styles.pageWrap, style]}>
      <View style={styles.topRow}>
        <View style={styles.titleCluster}>
          {onBack ? (
            <IconButton
              icon="arrow-back"
              onPress={onBack}
              accessibilityLabel="Go back"
              tone="surface"
            />
          ) : null}
          <View style={styles.textCol}>
            {eyebrow ? (
              <Text style={styles.eyebrow} numberOfLines={1}>
                {eyebrow}
              </Text>
            ) : null}
            <Text style={[layout.type.pageHeading, styles.title]} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text style={[layout.type.secondary, styles.subtitle]}>{subtitle}</Text>
            ) : null}
          </View>
        </View>
        {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
      </View>
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Section-level heading (22px desktop / 20px mobile) with right action/badge alignment.
 */
export function SectionHeader({
  title,
  subtitle,
  rightSlot,
  style,
}: SectionHeaderProps) {
  const layout = useResponsiveLayout();

  return (
    <View style={[styles.sectionWrap, style]}>
      <View style={styles.sectionTextCol}>
        <Text style={[layout.type.sectionHeading, styles.title]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text style={[layout.type.secondary, styles.subtitle]}>{subtitle}</Text>
        ) : null}
      </View>
      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrap: {
    width: '100%',
    gap: HerwaySpacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.md,
  },
  titleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.md,
    flex: 1,
    minWidth: 200,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: HerwaySpacing.xs,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    color: HerwayColors.tealDark,
    letterSpacing: 0.3,
  },
  title: {
    color: HerwayColors.ink,
  },
  subtitle: {
    color: HerwayColors.muted,
  },
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
    flexShrink: 0,
  },
  sectionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.sm,
  },
  sectionTextCol: {
    flex: 1,
    minWidth: 160,
    gap: 2,
  },
});

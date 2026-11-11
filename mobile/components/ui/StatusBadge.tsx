import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  HerwayColors,
  HerwayRadii,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';

export type StatusTone = 'safe' | 'warn' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  icon?: keyof typeof MaterialIcons.glyphMap;
  hideIcon?: boolean;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_ICON: Record<StatusTone, keyof typeof MaterialIcons.glyphMap> = {
  safe: 'check-circle',
  warn: 'schedule',
  danger: 'error-outline',
  info: 'info-outline',
  neutral: 'lens',
};

const TONE_PALETTE: Record<StatusTone, { bg: string; fg: string; border: string }> = {
  safe: {
    bg: HerwayColors.successSoft,
    fg: HerwayColors.successText,
    border: HerwayColors.successBorder,
  },
  warn: {
    bg: HerwayColors.warningSoft,
    fg: HerwayColors.warningText,
    border: HerwayColors.warningBorder,
  },
  danger: {
    bg: HerwayColors.dangerSoft,
    fg: HerwayColors.dangerText,
    border: HerwayColors.dangerBorder,
  },
  info: {
    bg: HerwayColors.tealSoft,
    fg: HerwayColors.tealDark,
    border: HerwayColors.tealSoft,
  },
  neutral: {
    bg: HerwayColors.surfaceSubtle,
    fg: HerwayColors.textSecondary,
    border: HerwayColors.border,
  },
};

/**
 * Accessible status pill that pairs semantic color with an icon so color is never sole indicator.
 */
export function StatusBadge({
  label,
  tone = 'neutral',
  icon,
  hideIcon = false,
  style,
}: StatusBadgeProps) {
  const palette = TONE_PALETTE[tone];
  const resolvedIcon = icon ?? DEFAULT_ICON[tone];

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      {!hideIcon ? (
        <MaterialIcons
          name={resolvedIcon}
          size={tone === 'neutral' ? 8 : 13}
          color={palette.fg}
        />
      ) : null}
      <Text style={[styles.text, { color: palette.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.pill,
    borderWidth: HerwaySizes.borderWidth,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    flexShrink: 1,
  },
});

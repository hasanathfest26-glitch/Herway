import React, { useState } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import {
  HerwayColors,
  HerwayRadii,
  HerwayShadows,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

export type CardTone = 'default' | 'subtle' | 'mint' | 'danger' | 'warn';

interface StandardCardProps {
  children: React.ReactNode;
  tone?: CardTone;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

function getCardTone(tone: CardTone) {
  switch (tone) {
    case 'subtle':
      return { bg: HerwayColors.surfaceSubtle, border: HerwayColors.inputBorder };
    case 'mint':
      return { bg: HerwayColors.mintMid, border: HerwayColors.tealSoft };
    case 'danger':
      return { bg: HerwayColors.dangerSoft, border: HerwayColors.dangerBorder };
    case 'warn':
      return { bg: HerwayColors.warningSoft, border: HerwayColors.warningBorder };
    case 'default':
    default:
      return { bg: HerwayColors.surface, border: HerwayColors.border };
  }
}

/**
 * Standard Herway Card: 20px radius, 1px hairline border, unified padding.
 */
export function StandardCard({
  children,
  tone = 'default',
  compact = false,
  style,
}: StandardCardProps) {
  const layout = useResponsiveLayout();
  const palette = getCardTone(tone);
  const pad = compact ? HerwaySpacing.lg : layout.cardPadding;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          padding: pad,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface InteractiveCardProps extends StandardCardProps {
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
}

/**
 * Clickable / hoverable card with quiet lift on web and equal-height row support.
 */
export function InteractiveCard({
  children,
  onPress,
  tone = 'default',
  compact = false,
  disabled = false,
  accessibilityLabel,
  style,
}: InteractiveCardProps) {
  const layout = useResponsiveLayout();
  const palette = getCardTone(tone);
  const pad = compact ? HerwaySpacing.lg : layout.cardPadding;
  const [hovered, setHovered] = useState(false);

  const webHoverProps =
    Platform.OS === 'web'
      ? ({
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        } as Record<string, unknown>)
      : {};

  return (
    <Pressable
      {...webHoverProps}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: palette.bg,
          borderColor: hovered && !disabled ? HerwayColors.teal : palette.border,
          padding: pad,
        },
        Platform.OS === 'web' &&
          hovered &&
          !disabled &&
          ({ transform: [{ translateY: -2 }] } as ViewStyle),
        pressed && !disabled && { opacity: 0.94 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: HerwayRadii.card,
    borderWidth: HerwaySizes.borderWidth,
    gap: HerwaySpacing.md,
    minWidth: 0,
    maxWidth: '100%',
    ...HerwayShadows.card,
  },
});

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable } from '@/components/InteractivePressable';
import {
  HerwayColors,
  HerwayRadii,
  HerwayShadows,
  HerwaySizes,
  HerwaySpacing,
  HerwayStates,
} from '@/constants/theme';

export type ButtonTone = 'primary' | 'dark' | 'danger' | 'safe' | 'tealSoft';

interface BaseButtonProps {
  label: string;
  onPress: () => Promise<unknown> | void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  rightIcon?: keyof typeof MaterialIcons.glyphMap;
  tone?: ButtonTone;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

function getToneStyles(tone: ButtonTone) {
  switch (tone) {
    case 'dark':
      return {
        bg: HerwayColors.ink,
        text: HerwayColors.white,
        border: HerwayColors.ink,
      };
    case 'danger':
      return {
        bg: HerwayColors.danger,
        text: HerwayColors.white,
        border: HerwayColors.danger,
      };
    case 'safe':
      return {
        bg: HerwayColors.safe,
        text: HerwayColors.white,
        border: HerwayColors.safe,
      };
    case 'tealSoft':
      return {
        bg: HerwayColors.tealSoft,
        text: HerwayColors.tealDark,
        border: HerwayColors.tealSoft,
      };
    case 'primary':
    default:
      return {
        bg: HerwayColors.teal,
        text: HerwayColors.white,
        border: HerwayColors.teal,
      };
  }
}

function useButtonAsync(onPress: () => Promise<unknown> | void, externalLoading?: boolean) {
  const [internalLoading, setInternalLoading] = useState(false);
  const busy = Boolean(externalLoading || internalLoading);

  async function handlePress() {
    if (busy) return;
    const res = onPress();
    if (res && typeof (res as Promise<unknown>).then === 'function') {
      setInternalLoading(true);
      try {
        await res;
      } finally {
        setInternalLoading(false);
      }
    }
  }

  return { busy, handlePress };
}

/**
 * Standard Primary CTA Button (48px height, 12px radius).
 */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading,
  icon,
  rightIcon,
  tone = 'primary',
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
}: BaseButtonProps) {
  const { busy, handlePress } = useButtonAsync(onPress, loading);
  const palette = getToneStyles(tone);
  const isDisabled = disabled || busy;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: busy }}
      style={({ pressed }) => [
        styles.base,
        styles.primary,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
        tone === 'primary' && HerwayShadows.tealPill,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      <View style={styles.innerRow}>
        {busy ? (
          <ActivityIndicator size="small" color={palette.text} />
        ) : icon ? (
          <MaterialIcons name={icon} size={18} color={palette.text} />
        ) : null}
        <Text style={[styles.primaryText, { color: palette.text }, textStyle]} numberOfLines={1}>
          {label}
        </Text>
        {!busy && rightIcon ? (
          <MaterialIcons name={rightIcon} size={18} color={palette.text} />
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Standard Secondary Button (44px height, 12px radius, 1px border).
 */
export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  loading,
  icon,
  rightIcon,
  tone,
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
}: BaseButtonProps) {
  const { busy, handlePress } = useButtonAsync(onPress, loading);
  const isDisabled = disabled || busy;
  const isDanger = tone === 'danger';
  const isTeal = tone === 'tealSoft';

  const bgColor = isDanger
    ? HerwayColors.dangerSoft
    : isTeal
      ? HerwayColors.mintMid
      : HerwayColors.surface;
  const borderColor = isDanger
    ? HerwayColors.dangerBorder
    : isTeal
      ? HerwayColors.tealSoft
      : HerwayColors.border;
  const fgColor = isDanger
    ? HerwayColors.dangerText
    : isTeal
      ? HerwayColors.tealDark
      : HerwayColors.ink;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: busy }}
      style={({ pressed }) => [
        styles.base,
        styles.secondary,
        {
          backgroundColor: bgColor,
          borderColor,
        },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      <View style={styles.innerRow}>
        {busy ? (
          <ActivityIndicator size="small" color={fgColor} />
        ) : icon ? (
          <MaterialIcons name={icon} size={17} color={fgColor} />
        ) : null}
        <Text style={[styles.secondaryText, { color: fgColor }, textStyle]} numberOfLines={1}>
          {label}
        </Text>
        {!busy && rightIcon ? (
          <MaterialIcons name={rightIcon} size={17} color={fgColor} />
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Compact Small Button (36px height, 12px radius, 4px hitSlop for 44px touch target).
 */
export function SmallButton({
  label,
  onPress,
  disabled = false,
  loading,
  icon,
  tone = 'tealSoft',
  style,
  textStyle,
  accessibilityLabel,
}: Omit<BaseButtonProps, 'fullWidth' | 'rightIcon'>) {
  const { busy, handlePress } = useButtonAsync(onPress, loading);
  const isDisabled = disabled || busy;
  const palette = getToneStyles(tone);

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: busy }}
      style={({ pressed }) => [
        styles.base,
        styles.small,
        {
          backgroundColor: palette.bg,
          borderColor: tone === 'tealSoft' ? HerwayColors.tealSoft : palette.border,
        },
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      <View style={styles.innerRow}>
        {busy ? (
          <ActivityIndicator size="small" color={palette.text} />
        ) : icon ? (
          <MaterialIcons name={icon} size={15} color={palette.text} />
        ) : null}
        <Text style={[styles.smallText, { color: palette.text }, textStyle]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

interface IconButtonProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  size?: 'default' | 'small';
  tone?: 'surface' | 'subtle' | 'tealSoft' | 'danger';
  iconColor?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Accessible icon-only button with 44px minimum touch target.
 */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 'default',
  tone = 'subtle',
  iconColor,
  disabled = false,
  style,
}: IconButtonProps) {
  const dim = size === 'small' ? HerwaySizes.buttonSmall : HerwaySizes.touchTargetMin;
  const bg =
    tone === 'surface'
      ? HerwayColors.surface
      : tone === 'tealSoft'
        ? HerwayColors.tealSoft
        : tone === 'danger'
          ? HerwayColors.dangerSoft
          : HerwayColors.surfaceSubtle;
  const borderColor =
    tone === 'surface'
      ? HerwayColors.border
      : tone === 'tealSoft'
        ? HerwayColors.tealSoft
        : tone === 'danger'
          ? HerwayColors.dangerBorder
          : HerwayColors.inputBorder;
  const color =
    iconColor ??
    (tone === 'tealSoft'
      ? HerwayColors.tealDark
      : tone === 'danger'
        ? HerwayColors.danger
        : HerwayColors.ink);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={size === 'small' ? 4 : 0}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        {
          width: dim,
          height: dim,
          borderRadius: HerwayRadii.button,
          backgroundColor: bg,
          borderWidth: HerwaySizes.borderWidth,
          borderColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <MaterialIcons name={icon} size={size === 'small' ? 18 : 20} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: HerwayRadii.button,
    borderWidth: HerwaySizes.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ transition: 'transform 120ms ease, opacity 120ms ease, background-color 150ms ease' } as object)
      : {}),
  },
  primary: {
    minHeight: HerwaySizes.buttonPrimary,
    paddingHorizontal: HerwaySpacing.xl,
    paddingVertical: HerwaySpacing.md,
  },
  secondary: {
    minHeight: HerwaySizes.buttonSecondary,
    paddingHorizontal: HerwaySpacing.lg,
    paddingVertical: 10,
  },
  small: {
    minHeight: HerwaySizes.buttonSmall,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: 6,
  },
  fullWidth: {
    width: '100%',
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: HerwaySpacing.sm,
  },
  primaryText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  secondaryText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  smallText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  pressed: {
    opacity: HerwayStates.pressedOpacity,
  },
  disabled: {
    opacity: HerwayStates.disabledOpacity,
  },
});

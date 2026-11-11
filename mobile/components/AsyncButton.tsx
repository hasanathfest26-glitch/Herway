import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  HerwayColors,
  HerwayRadii,
  HerwaySizes,
  HerwaySpacing,
  HerwayStates,
} from '@/constants/theme';
import { ActionStatus } from '@/hooks/useAsyncAction';

interface AsyncButtonProps {
  label: string;
  loadingLabel?: string;
  successLabel?: string;
  failedLabel?: string;
  onPress: () => Promise<unknown> | void;
  disabled?: boolean;
  externalStatus?: ActionStatus;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  spinnerColor?: string;
  variant?: 'primary' | 'danger' | 'outline' | 'dark';
  resetSuccessMs?: number;
}

export function AsyncButton({
  label,
  loadingLabel = 'Processing...',
  successLabel = 'Done ✓',
  failedLabel = 'Failed – Retry',
  onPress,
  disabled = false,
  externalStatus,
  style,
  textStyle,
  spinnerColor,
  variant = 'primary',
  resetSuccessMs = 1800,
}: AsyncButtonProps) {
  const [internalStatus, setInternalStatus] = useState<ActionStatus>('idle');
  const lockRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scale = useRef(new Animated.Value(1)).current;

  const status = externalStatus ?? internalStatus;
  const isBusy =
    status === 'processing' || status === 'retrying' || status === 'pending_confirmation';

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function handlePress() {
    if (disabled || isBusy || lockRef.current) return;
    lockRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);

    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 55, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 90, useNativeDriver: true }),
    ]).start();

    if (!externalStatus) {
      setInternalStatus((prev) => (prev === 'failed' ? 'retrying' : 'processing'));
    }

    try {
      await onPress();
      if (!externalStatus) {
        setInternalStatus('success');
        if (resetSuccessMs > 0) {
          timerRef.current = setTimeout(() => {
            setInternalStatus((cur) => (cur === 'success' ? 'idle' : cur));
          }, resetSuccessMs);
        }
      }
    } catch {
      if (!externalStatus) {
        setInternalStatus('failed');
      }
    } finally {
      lockRef.current = false;
    }
  }

  const displayLabel =
    status === 'processing' || status === 'retrying' || status === 'pending_confirmation'
      ? loadingLabel
      : status === 'success'
        ? successLabel
        : status === 'failed'
          ? failedLabel
          : label;

  const variantStyle =
    variant === 'danger'
      ? styles.danger
      : variant === 'outline'
        ? styles.outline
        : variant === 'dark'
          ? styles.dark
          : styles.primary;

  const stateBgOverride =
    status === 'success'
      ? styles.successOverride
      : status === 'failed'
        ? styles.failedOverride
        : null;

  const resolvedSpinner =
    spinnerColor ??
    (variant === 'outline' && status === 'idle' ? HerwayColors.ink : HerwayColors.white);

  const resolvedTextStyle = [
    styles.text,
    variant === 'outline' && status === 'idle' && styles.outlineText,
    status === 'failed' && variant === 'outline' && { color: HerwayColors.white },
    status === 'success' && variant === 'outline' && { color: HerwayColors.white },
    textStyle,
  ];

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={handlePress}
        disabled={disabled || isBusy}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || isBusy, busy: isBusy }}
        style={({ pressed }) => [
          styles.base,
          variant === 'outline' ? styles.secondaryHeight : styles.primaryHeight,
          variantStyle,
          stateBgOverride,
          (disabled || isBusy) && styles.disabled,
          pressed && !disabled && !isBusy && styles.pressed,
          style,
        ]}
      >
        <View style={styles.content}>
          {isBusy ? (
            <ActivityIndicator size="small" color={resolvedSpinner} />
          ) : status === 'success' ? (
            <MaterialIcons name="check-circle" size={16} color={resolvedSpinner} />
          ) : status === 'failed' ? (
            <MaterialIcons name="refresh" size={16} color={resolvedSpinner} />
          ) : null}
          <Text style={resolvedTextStyle} numberOfLines={1}>
            {displayLabel}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: HerwayRadii.button,
    paddingHorizontal: HerwaySpacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryHeight: {
    minHeight: HerwaySizes.buttonPrimary,
    paddingVertical: HerwaySpacing.md,
  },
  secondaryHeight: {
    minHeight: HerwaySizes.buttonSecondary,
    paddingVertical: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: HerwaySpacing.sm,
  },
  primary: {
    backgroundColor: HerwayColors.teal,
  },
  dark: {
    backgroundColor: HerwayColors.ink,
  },
  danger: {
    backgroundColor: HerwayColors.danger,
  },
  outline: {
    backgroundColor: HerwayColors.surface,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
  },
  successOverride: {
    backgroundColor: HerwayColors.safe,
  },
  failedOverride: {
    backgroundColor: HerwayColors.danger,
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: HerwayStates.disabledOpacity,
  },
  text: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: HerwayColors.white,
  },
  outlineText: {
    color: HerwayColors.ink,
    fontWeight: '600',
  },
});

import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { HerwayColors, HerwayRadii, HerwaySpacing } from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { StandardCard } from './Cards';
import { PrimaryButton, SecondaryButton } from './Buttons';

export function LoadingState({
  label = 'Loading...',
  style,
}: {
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const layout = useResponsiveLayout();
  return (
    <StandardCard style={[styles.centerCard, style]}>
      <ActivityIndicator size="small" color={HerwayColors.tealDark} />
      <Text style={[layout.type.secondary, styles.mutedText]}>{label}</Text>
    </StandardCard>
  );
}

export function SkeletonLoader({
  count = 2,
  height = 120,
}: {
  count?: number;
  height?: number;
}) {
  return (
    <View style={styles.skeletonStack}>
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonBlock
          key={idx}
          height={height}
          borderRadius={HerwayRadii.card}
        />
      ))}
    </View>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  actionLabel,
  onAction,
  style,
}: {
  icon?: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const layout = useResponsiveLayout();
  return (
    <StandardCard style={[styles.centerCard, style]}>
      <View style={styles.iconCircle}>
        <MaterialIcons name={icon} size={24} color={HerwayColors.tealDark} />
      </View>
      <Text style={[layout.type.cardHeading, styles.centerTitle]}>{title}</Text>
      {description ? (
        <Text style={[layout.type.secondary, styles.centerDesc]}>{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} style={styles.ctaGap} />
      ) : null}
    </StandardCard>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Retry',
  inline = false,
  style,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const layout = useResponsiveLayout();

  if (inline) {
    return (
      <StandardCard tone="danger" compact style={[styles.inlineRow, style]}>
        <MaterialIcons name="error-outline" size={18} color={HerwayColors.danger} />
        <Text style={[layout.type.secondary, styles.inlineErrorText]}>{message}</Text>
        {onRetry ? (
          <SecondaryButton
            label={retryLabel}
            tone="danger"
            onPress={onRetry}
            style={styles.inlineRetry}
          />
        ) : null}
      </StandardCard>
    );
  }

  return (
    <StandardCard tone="danger" style={[styles.centerCard, style]}>
      <View style={[styles.iconCircle, styles.dangerCircle]}>
        <MaterialIcons name="error-outline" size={24} color={HerwayColors.danger} />
      </View>
      <Text style={[layout.type.cardHeading, { color: HerwayColors.dangerText, textAlign: 'center' }]}>
        {title}
      </Text>
      <Text style={[layout.type.secondary, { color: HerwayColors.dangerText, textAlign: 'center' }]}>
        {message}
      </Text>
      {onRetry ? (
        <SecondaryButton label={retryLabel} tone="danger" onPress={onRetry} style={styles.ctaGap} />
      ) : null}
    </StandardCard>
  );
}

const styles = StyleSheet.create({
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: HerwaySpacing.xl,
  },
  skeletonStack: {
    gap: HerwaySpacing.md,
    width: '100%',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: HerwayColors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerCircle: {
    backgroundColor: HerwayColors.white,
  },
  centerTitle: {
    color: HerwayColors.ink,
    textAlign: 'center',
  },
  centerDesc: {
    color: HerwayColors.muted,
    textAlign: 'center',
    maxWidth: 420,
  },
  mutedText: {
    color: HerwayColors.muted,
    textAlign: 'center',
  },
  ctaGap: {
    marginTop: HerwaySpacing.xs,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  inlineErrorText: {
    flex: 1,
    color: HerwayColors.dangerText,
  },
  inlineRetry: {
    minHeight: 36,
    paddingHorizontal: HerwaySpacing.md,
  },
});

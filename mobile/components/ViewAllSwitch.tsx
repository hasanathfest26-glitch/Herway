import React from 'react';
import { StyleSheet, Switch, Text } from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { MaterialIcons } from '@expo/vector-icons';
import { HerwayColors, HerwayRadii, HerwaySizes, HerwaySpacing } from '@/constants/theme';

interface ViewAllSwitchProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  label?: string;
}

export function ViewAllSwitch({
  value,
  onValueChange,
  label = 'View all',
}: ViewAllSwitchProps) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      hitSlop={4}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      style={[styles.switchPill, value && styles.switchPillActive]}
    >
      <Text style={[styles.switchLabel, value && styles.switchLabelActive]}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: HerwayColors.border, true: HerwayColors.teal }}
        thumbColor={HerwayColors.white}
        style={styles.nativeSwitch}
      />
    </Pressable>
  );
}

interface ViewAllToggleProps {
  expanded: boolean;
  onToggle: () => void;
  totalCount: number;
  visibleCount: number;
}

export function ViewAllToggle({
  expanded,
  onToggle,
  totalCount,
  visibleCount,
}: ViewAllToggleProps) {
  if (totalCount <= visibleCount) return null;

  return (
    <Pressable
      onPress={onToggle}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={expanded ? 'Show less items' : `View all ${totalCount} items`}
      style={styles.toggleBtn}
    >
      <Text style={styles.toggleText}>
        {expanded ? 'Show less' : `View all (${totalCount})`}
      </Text>
      <MaterialIcons
        name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
        size={18}
        color={HerwayColors.tealDark}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  switchPill: {
    minHeight: HerwaySizes.buttonSmall,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
    paddingLeft: HerwaySpacing.md,
    paddingRight: HerwaySpacing.sm,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.pill,
    backgroundColor: HerwayColors.surface,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
  },
  switchPillActive: {
    backgroundColor: HerwayColors.mintMid,
    borderColor: HerwayColors.tealSoft,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: HerwayColors.textSecondary,
  },
  switchLabelActive: {
    color: HerwayColors.tealDark,
    fontWeight: '700',
  },
  nativeSwitch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },
  toggleBtn: {
    minHeight: HerwaySizes.buttonSmall,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: HerwaySpacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.sm,
    borderRadius: HerwayRadii.button,
    backgroundColor: HerwayColors.surface,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    marginTop: HerwaySpacing.xs,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: HerwayColors.tealDark,
  },
});

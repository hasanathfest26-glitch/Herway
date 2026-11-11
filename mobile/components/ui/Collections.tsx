import React from 'react';
import { ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable } from '@/components/InteractivePressable';
import {
  HerwayColors,
  HerwayRadii,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { SecondaryButton, SmallButton } from './Buttons';

/**
 * Splits an array into fixed-width row chunks for virtualized multi-column FlatList grids.
 */
export function chunkRows<T>(items: readonly T[], columns: number): T[][] {
  if (columns <= 1) return items.map((item) => [item]);
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

export function useGridColumnCount(
  columns: { mobile?: number; tablet?: number; laptop?: number; desktop?: number } = {
    mobile: 1,
    tablet: 2,
    laptop: 2,
    desktop: 3,
  },
): number {
  const layout = useResponsiveLayout();
  if (layout.isMobile) return columns.mobile ?? 1;
  if (layout.isTablet) return columns.tablet ?? 2;
  if (layout.isLaptop) return columns.laptop ?? columns.tablet ?? 2;
  return columns.desktop ?? columns.laptop ?? 3;
}

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function FilterChipBar<T extends string>({
  options,
  value,
  onChange,
  scrollable = false,
  style,
}: {
  options: ReadonlyArray<FilterChipOption<T>>;
  value: T;
  onChange: (next: T) => void;
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const chips = options.map((opt) => {
    const active = opt.value === value;
    return (
      <Pressable
        key={opt.value}
        onPress={() => onChange(opt.value)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={[styles.chip, active && styles.chipActive]}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
          {opt.label}
        </Text>
        {opt.count !== undefined ? (
          <View style={[styles.countPill, active && styles.countPillActive]}>
            <Text style={[styles.countText, active && styles.countTextActive]}>
              {opt.count}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  });

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollRow, style]}
      >
        {chips}
      </ScrollView>
    );
  }

  return <View style={[styles.wrapRow, style]}>{chips}</View>;
}

/**
 * Predictable footer control for paginated or incrementally loaded collections.
 */
export function CollectionPaginationFooter({
  visibleCount,
  totalCount,
  hasMore,
  loadingMore = false,
  onLoadMore,
  noun = 'items',
  style,
}: {
  visibleCount: number;
  totalCount: number;
  hasMore: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  noun?: string;
  style?: StyleProp<ViewStyle>;
}) {
  if (totalCount === 0) return null;

  return (
    <View style={[styles.paginationBar, style]}>
      <Text style={styles.paginationMeta}>
        Showing {visibleCount} of {totalCount} {noun}
      </Text>
      {hasMore && onLoadMore ? (
        <SecondaryButton
          label={loadingMore ? 'Loading more...' : `Load more (${totalCount - visibleCount} remaining)`}
          tone="tealSoft"
          loading={loadingMore}
          disabled={loadingMore}
          onPress={onLoadMore}
          style={styles.loadMoreBtn}
        />
      ) : null}
    </View>
  );
}

/**
 * Inline alert banner shown when live Socket.IO or background sync updates arrive
 * while scrolled down or inspecting a feed.
 */
export function LiveUpdatePill({
  label,
  icon = 'arrow-upward',
  onPress,
}: {
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
}) {
  return (
    <SmallButton
      label={label}
      icon={icon}
      tone="primary"
      onPress={onPress}
      style={styles.livePill}
    />
  );
}

/**
 * Clean row wrapper with truncated primary label, optional subtitle, and aligned right badge/actions.
 */
export function ExpandableToggleRow({
  expanded,
  onToggle,
  expandLabel = 'Show details',
  collapseLabel = 'Hide details',
}: {
  expanded: boolean;
  onToggle: () => void;
  expandLabel?: string;
  collapseLabel?: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={expanded ? collapseLabel : expandLabel}
      accessibilityState={{ expanded }}
      style={styles.expandBtn}
    >
      <Text style={styles.expandLabel}>{expanded ? collapseLabel : expandLabel}</Text>
      <MaterialIcons
        name={expanded ? 'expand-less' : 'expand-more'}
        size={18}
        color={HerwayColors.tealDark}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: HerwaySpacing.sm,
  },
  scrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
    paddingVertical: 2,
  },
  chip: {
    minHeight: HerwaySizes.buttonSmall,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
    backgroundColor: HerwayColors.white,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.pill,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
  },
  chipActive: {
    backgroundColor: HerwayColors.tealDark,
    borderColor: HerwayColors.tealDark,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: HerwayColors.ink,
  },
  chipTextActive: {
    color: HerwayColors.white,
    fontWeight: '700',
  },
  countPill: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: HerwayRadii.pill,
    backgroundColor: HerwayColors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: HerwayColors.muted,
  },
  countTextActive: {
    color: HerwayColors.white,
  },
  paginationBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.sm,
    paddingHorizontal: HerwaySpacing.md,
    backgroundColor: HerwayColors.white,
    borderRadius: HerwayRadii.input,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
  },
  paginationMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: HerwayColors.muted,
  },
  loadMoreBtn: {
    minHeight: HerwaySizes.buttonSmall,
    paddingVertical: 6,
    paddingHorizontal: HerwaySpacing.md,
  },
  livePill: {
    alignSelf: 'center',
  },
  expandBtn: {
    alignSelf: 'flex-start',
    minHeight: HerwaySizes.buttonSmall,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
    paddingVertical: 6,
    paddingHorizontal: HerwaySpacing.sm,
    borderRadius: HerwayRadii.button,
  },
  expandLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: HerwayColors.tealDark,
  },
});

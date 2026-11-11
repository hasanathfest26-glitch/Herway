import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { HerwaySpacing } from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  maxWidth?: number;
  noPadding?: boolean;
}

/**
 * Centered layout container that applies Herway's responsive max-widths
 * and breakpoint-aware horizontal page gutters.
 */
export function ResponsiveContainer({
  children,
  style,
  maxWidth,
  noPadding = false,
}: ResponsiveContainerProps) {
  const layout = useResponsiveLayout();
  const resolvedMax = maxWidth ?? layout.maxContentWidth;

  return (
    <View
      style={[
        styles.container,
        {
          maxWidth: layout.isMobile ? '100%' : resolvedMax,
          paddingHorizontal: noPadding ? 0 : layout.pageGutter,
          gap: layout.sectionGap,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface ResponsiveGridProps {
  children: React.ReactNode;
  /** Number of columns at each tier. Defaults to 1 mobile, 2 tablet/laptop/desktop. */
  columns?: {
    mobile?: number;
    tablet?: number;
    laptop?: number;
    desktop?: number;
  };
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Equal-height responsive multi-column grid wrapper.
 * Wraps children into equal-width columns using flex-wrap with exact gap compensation.
 */
export function ResponsiveGrid({
  children,
  columns = { mobile: 1, tablet: 2, laptop: 2, desktop: 2 },
  gap,
  style,
}: ResponsiveGridProps) {
  const layout = useResponsiveLayout();
  const resolvedGap = gap ?? layout.gridGap;

  const colCount = layout.isMobile
    ? (columns.mobile ?? 1)
    : layout.isTablet
      ? (columns.tablet ?? 2)
      : layout.isLaptop
        ? (columns.laptop ?? columns.tablet ?? 2)
        : (columns.desktop ?? columns.laptop ?? 2);

  if (colCount <= 1) {
    return (
      <View style={[styles.stack, { gap: resolvedGap }, style]}>
        {children}
      </View>
    );
  }

  const items = React.Children.toArray(children);
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += colCount) {
    rows.push(items.slice(i, i + colCount));
  }

  return (
    <View style={[styles.gridStack, { gap: resolvedGap }, style]}>
      {rows.map((row, rIdx) => (
        <View key={rIdx} style={[styles.gridRow, { gap: resolvedGap }]}>
          {row.map((child, cIdx) => (
            <View key={cIdx} style={styles.gridCell}>
              {child}
            </View>
          ))}
          {row.length < colCount &&
            Array.from({ length: colCount - row.length }).map((_, emptyIdx) => (
              <View key={`empty-${emptyIdx}`} style={styles.gridCellSpacer} />
            ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
  },
  stack: {
    width: '100%',
    gap: HerwaySpacing.md,
  },
  gridStack: {
    width: '100%',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
  },
  gridCell: {
    flex: 1,
    minWidth: 0,
  },
  gridCellSpacer: {
    flex: 1,
    minWidth: 0,
  },
});

import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { HerwayBreakpoints, HerwaySpacing, HerwayTypography } from '@/constants/theme';

export type ViewportTier =
  | 'smallMobile'
  | 'mobile'
  | 'tablet'
  | 'laptop'
  | 'desktop'
  | 'largeDesktop';

export interface ResponsiveLayoutInfo {
  width: number;
  height: number;
  tier: ViewportTier;
  isSmallMobile: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isLaptop: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  /** True for tablet and wider (>= 768px) where top desktop/tablet navigation replaces mobile bottom tabs. */
  isWideLayout: boolean;
  /** True for laptop and wider (>= 1024px) for 3-column or split-rail workspaces. */
  isDesktopWorkspace: boolean;
  pageGutter: number;
  sectionGap: number;
  gridGap: number;
  cardPadding: number;
  maxContentWidth: number;
  columns: number;
  type: typeof HerwayTypography.desktop | typeof HerwayTypography.mobile;
}

export function getViewportTier(width: number): ViewportTier {
  if (width <= HerwayBreakpoints.smallMobileMax) return 'smallMobile';
  if (width <= HerwayBreakpoints.mobileMax) return 'mobile';
  if (width <= HerwayBreakpoints.tabletMax) return 'tablet';
  if (width <= HerwayBreakpoints.laptopMax) return 'laptop';
  if (width <= HerwayBreakpoints.desktopMax) return 'desktop';
  return 'largeDesktop';
}

export function useResponsiveLayout(): ResponsiveLayoutInfo {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const tier = getViewportTier(width);
    const isSmallMobile = tier === 'smallMobile';
    const isMobile = tier === 'smallMobile' || tier === 'mobile';
    const isTablet = tier === 'tablet';
    const isLaptop = tier === 'laptop';
    const isDesktop = tier === 'desktop';
    const isLargeDesktop = tier === 'largeDesktop';
    const isWideLayout = width >= HerwayBreakpoints.tabletMin;
    const isDesktopWorkspace = width >= HerwayBreakpoints.laptopMin;

    const pageGutter = isMobile
      ? HerwaySpacing.lg // 16px
      : isTablet
        ? HerwaySpacing.xl // 24px
        : isLargeDesktop
          ? HerwaySpacing.section // 48px
          : HerwaySpacing.xxl; // 32px

    const sectionGap = isMobile ? HerwaySpacing.lg : HerwaySpacing.xl;
    const gridGap = isMobile ? HerwaySpacing.md : HerwaySpacing.lg;
    const cardPadding = isMobile ? HerwaySpacing.lg : HerwaySpacing.xl;

    const maxContentWidth = isLargeDesktop
      ? 1400
      : isDesktop
        ? 1280
        : isLaptop
          ? 1120
          : isTablet
            ? 960
            : width;

    const columns = isMobile ? 1 : isTablet ? 2 : 3;
    const type = isWideLayout ? HerwayTypography.desktop : HerwayTypography.mobile;

    return {
      width,
      height,
      tier,
      isSmallMobile,
      isMobile,
      isTablet,
      isLaptop,
      isDesktop,
      isLargeDesktop,
      isWideLayout,
      isDesktopWorkspace,
      pageGutter,
      sectionGap,
      gridGap,
      cardPadding,
      maxContentWidth,
      columns,
      type,
    };
  }, [width, height]);
}

import { Platform } from 'react-native';
import sharedTokens from '../../shared/design-tokens.json';

/**
 * Herway Central Design Tokens
 * Single source of truth imported from ../../shared/design-tokens.json
 * Brand identity: Mint-Teal-Cream (#00B6C7 primary teal, #FAF9F4 warm cream, #131A20 ink)
 */
export const HerwayColors = sharedTokens.colors;

/**
 * Strict spacing scale: 4, 8, 12, 16, 24, 32, 40, 48, 64px
 */
export const HerwaySpacing = sharedTokens.spacing;

/**
 * Standard component dimensions
 */
export const HerwaySizes = sharedTokens.sizes;

/**
 * Standard border radii
 */
export const HerwayRadii = sharedTokens.radii;

/**
 * Responsive breakpoints
 */
export const HerwayBreakpoints = sharedTokens.breakpoints;

/**
 * Interaction state tokens (disabled, pressed, focus)
 */
export const HerwayStates = sharedTokens.states;

/**
 * Typography tokens (desktop & mobile pairs)
 */
export const HerwayTypography = {
  desktop: {
    pageHeading: { ...sharedTokens.typography.desktop.pageHeading, fontWeight: '800' as const },
    sectionHeading: { ...sharedTokens.typography.desktop.sectionHeading, fontWeight: '800' as const },
    cardHeading: { ...sharedTokens.typography.desktop.cardHeading, fontWeight: '700' as const },
    body: { ...sharedTokens.typography.desktop.body, fontWeight: '400' as const },
    bodyMedium: { ...sharedTokens.typography.desktop.bodyMedium, fontWeight: '500' as const },
    secondary: { ...sharedTokens.typography.desktop.secondary, fontWeight: '500' as const },
    label: { ...sharedTokens.typography.desktop.label, fontWeight: '600' as const },
  },
  mobile: {
    pageHeading: { ...sharedTokens.typography.mobile.pageHeading, fontWeight: '800' as const },
    sectionHeading: { ...sharedTokens.typography.mobile.sectionHeading, fontWeight: '800' as const },
    cardHeading: { ...sharedTokens.typography.mobile.cardHeading, fontWeight: '700' as const },
    body: { ...sharedTokens.typography.mobile.body, fontWeight: '400' as const },
    bodyMedium: { ...sharedTokens.typography.mobile.bodyMedium, fontWeight: '500' as const },
    secondary: { ...sharedTokens.typography.mobile.secondary, fontWeight: '500' as const },
    label: { ...sharedTokens.typography.mobile.label, fontWeight: '600' as const },
  },
} as const;

export const HerwayShadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#131A20',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.05,
      shadowRadius: 20,
    },
    android: { elevation: 3 },
    default: {
      shadowColor: '#131A20',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.05,
      shadowRadius: 20,
    },
  }),
  tealPill: Platform.select({
    ios: {
      shadowColor: '#00B6C7',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 16,
    },
    android: { elevation: 4 },
    default: {
      shadowColor: '#00B6C7',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 16,
    },
  }),
};

/**
 * Legacy token aliases mapped cleanly to the unified Herway palette.
 */
export const FigmaColors = {
  background: HerwayColors.background,
  white: HerwayColors.surface,
  galaxy: HerwayColors.ink,
  blue: HerwayColors.primary,
  spacesuit: HerwayColors.muted,
  spaceship: HerwayColors.textSecondary,
  border: HerwayColors.border,
  danger: HerwayColors.danger,
  dangerSoft: HerwayColors.dangerSoft,
  safe: HerwayColors.safe,
  safeSoft: HerwayColors.safeSoft,
  warn: HerwayColors.warning,
  warnSoft: HerwayColors.warningSoft,
} as const;

export const FigmaShadows = {
  card: HerwayShadows.card,
  blueGlow: HerwayShadows.tealPill,
  darkButton: HerwayShadows.card,
};

export const FigmaImages = {
  welcomeBg: require('@/assets/figma/welcome-bg.png'),
  avatarUser: require('@/assets/figma/avatar-user.png'),
  place1: require('@/assets/figma/place-1.png'),
  place2: require('@/assets/figma/place-2.png'),
  detailHero: require('@/assets/figma/detail-hero.png'),
  miniAvatars: [
    require('@/assets/figma/avatar-mini-1.png'),
    require('@/assets/figma/avatar-mini-2.png'),
    require('@/assets/figma/avatar-mini-3.png'),
  ],
  detailAvatars: [
    require('@/assets/figma/detail-avatar-1.png'),
    require('@/assets/figma/detail-avatar-2.png'),
    require('@/assets/figma/detail-avatar-3.png'),
  ],
} as const;

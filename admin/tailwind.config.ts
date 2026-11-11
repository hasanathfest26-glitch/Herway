import type { Config } from 'tailwindcss';
import tokens from '../shared/design-tokens.json';

const { colors, breakpoints, radii } = tokens;

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      xs: `${breakpoints.mobileMin}px`,
      sm: '640px',
      md: `${breakpoints.tabletMin}px`,
      tablet: `${breakpoints.tabletMin}px`,
      lg: `${breakpoints.laptopMin}px`,
      laptop: `${breakpoints.laptopMin}px`,
      xl: `${breakpoints.desktopMin}px`,
      desktop: `${breakpoints.desktopMin}px`,
      '2xl': `${breakpoints.largeDesktopMin}px`,
      wide: `${breakpoints.largeDesktopMin}px`,
    },
    extend: {
      colors: {
        brand: {
          50: colors.mintMid,
          100: colors.tealSoft,
          300: colors.tealGlow,
          500: colors.primary,
          600: colors.primaryDark,
          700: '#007C88',
          900: colors.ink,
        },
        primary: {
          DEFAULT: colors.primary,
          dark: colors.primaryDark,
          soft: colors.primarySoft,
        },
        mint: {
          top: colors.mintTop,
          mid: colors.mintMid,
        },
        ink: colors.ink,
        muted: colors.muted,
        'secondary-text': colors.textSecondary,
        canvas: colors.background,
        surface: colors.surface,
        'surface-subtle': colors.surfaceSubtle,
        border: {
          DEFAULT: colors.border,
          input: colors.inputBorder,
          subtle: colors.borderSubtle,
        },
        safe: {
          50: colors.safeSoft,
          600: colors.safe,
          700: colors.successText,
        },
        warn: {
          50: colors.warningSoft,
          600: colors.warning,
          700: colors.warningText,
        },
        danger: {
          50: colors.dangerSoft,
          600: colors.danger,
          700: colors.dangerText,
        },
      },
      borderRadius: {
        card: `${radii.card}px`,
        input: `${radii.input}px`,
        btn: `${radii.button}px`,
      },
      boxShadow: {
        card: '0px 8px 20px 0px rgba(19, 26, 32, 0.05)',
        'teal-glow': '0px 8px 16px 0px rgba(0, 182, 199, 0.22)',
        'nav-bar': '0px 2px 12px 0px rgba(19, 26, 32, 0.04)',
      },
    },
  },
  plugins: [],
};

export default config;

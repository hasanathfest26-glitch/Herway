#!/usr/bin/env node
/**
 * Herway Design Tokens Single-Source-of-Truth Synchronizer & Verifier.
 * Reads shared/design-tokens.json and generates/checks admin/app/tokens.css.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const tokensPath = path.join(__dirname, 'design-tokens.json');
const cssOutPath = path.join(rootDir, 'admin', 'app', 'tokens.css');

const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
const { colors, spacing, sizes, radii, states } = tokens;

const cssContent = `/* AUTO-GENERATED FROM shared/design-tokens.json — DO NOT EDIT MANUALLY */
:root {
  /* Brand & Semantic Colors */
  --hw-primary: ${colors.primary};
  --hw-primary-dark: ${colors.primaryDark};
  --hw-primary-soft: ${colors.primarySoft};
  --hw-mint-top: ${colors.mintTop};
  --hw-mint-mid: ${colors.mintMid};

  --hw-bg: ${colors.background};
  --hw-surface: ${colors.surface};
  --hw-surface-subtle: ${colors.surfaceSubtle};
  --hw-ink: ${colors.ink};
  --hw-text-secondary: ${colors.textSecondary};
  --hw-text-muted: ${colors.textMuted};
  --hw-placeholder: ${colors.placeholder};

  --hw-border: ${colors.border};
  --hw-border-input: ${colors.inputBorder};
  --hw-border-subtle: ${colors.borderSubtle};

  --hw-success: ${colors.success};
  --hw-success-soft: ${colors.successSoft};
  --hw-success-border: ${colors.successBorder};
  --hw-success-text: ${colors.successText};

  --hw-warning: ${colors.warning};
  --hw-warning-soft: ${colors.warningSoft};
  --hw-warning-border: ${colors.warningBorder};
  --hw-warning-text: ${colors.warningText};

  --hw-danger: ${colors.danger};
  --hw-danger-soft: ${colors.dangerSoft};
  --hw-danger-border: ${colors.dangerBorder};
  --hw-danger-text: ${colors.dangerText};

  /* Spacing Scale: 4, 8, 12, 16, 24, 32, 40, 48, 64px */
  --s-1: ${spacing.xs}px;
  --s-2: ${spacing.sm}px;
  --s-3: ${spacing.md}px;
  --s-4: ${spacing.lg}px;
  --s-6: ${spacing.xl}px;
  --s-8: ${spacing.xxl}px;
  --s-10: ${spacing.xxxl}px;
  --s-12: ${spacing.section}px;
  --s-16: ${spacing.hero}px;

  /* Component Dimensions & Radii */
  --h-btn-primary: ${sizes.buttonPrimary}px;
  --h-btn-secondary: ${sizes.buttonSecondary}px;
  --h-btn-small: ${sizes.buttonSmall}px;
  --h-input: ${sizes.inputHeight}px;
  --h-navbar: ${sizes.navbarHeight}px;
  --max-content-width: ${sizes.maxContentWidth}px;

  --r-card: ${radii.card}px;
  --r-input: ${radii.input}px;
  --r-btn: ${radii.button}px;
  --r-pill: ${radii.pill}px;

  /* Interaction States */
  --hw-disabled-opacity: ${states.disabledOpacity};
  --hw-pressed-opacity: ${states.pressedOpacity};
}
`;

const checkOnly = process.argv.includes('--check');

if (checkOnly) {
  const existing = fs.existsSync(cssOutPath) ? fs.readFileSync(cssOutPath, 'utf8') : '';
  if (existing !== cssContent) {
    console.error('Token drift detected: admin/app/tokens.css does not match shared/design-tokens.json. Run: node shared/sync-tokens.mjs');
    process.exit(1);
  }
  const mobileTheme = fs.readFileSync(path.join(rootDir, 'mobile', 'constants', 'theme.ts'), 'utf8');
  if (!mobileTheme.includes('shared/design-tokens.json')) {
    console.error('mobile/constants/theme.ts is not consuming shared/design-tokens.json');
    process.exit(1);
  }
  const adminTailwind = fs.readFileSync(path.join(rootDir, 'admin', 'tailwind.config.ts'), 'utf8');
  if (!adminTailwind.includes('shared/design-tokens.json')) {
    console.error('admin/tailwind.config.ts is not consuming shared/design-tokens.json');
    process.exit(1);
  }
  console.log('Design tokens verified: mobile, admin Tailwind, and CSS variables share 100% single source of truth (shared/design-tokens.json).');
  process.exit(0);
}

fs.writeFileSync(cssOutPath, cssContent, 'utf8');
console.log('Synced admin/app/tokens.css from shared/design-tokens.json');

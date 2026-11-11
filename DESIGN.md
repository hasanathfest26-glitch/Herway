---
name: Herway
description: Women-focused travel safety and companion platform — Adaptive Mobile & Desktop Web design system
colors:
  teal: "#00B6C7"
  teal-dark: "#0099A8"
  teal-soft: "#C5EFF2"
  mint-top: "#D3F3F5"
  mint-mid: "#E9F7F7"
  cream-bg: "#FAF9F4"
  input-bg: "#F5F4EE"
  input-border: "#E5E4DD"
  pill-border: "#E0E4E7"
  white: "#FFFFFF"
  ink: "#131A20"
  muted: "#646F78"
  danger: "#DC2626"
  safe: "#059669"
typography:
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "0em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "24px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "14px 24px"
  input-pill:
    backgroundColor: "{colors.input-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
---

## Overview

Herway uses an **adaptive** design system built in [theme.ts](file:///c:/Users/muham/OneDrive/Documents/Herway/mobile/constants/theme.ts) that pairs a Mint-Teal-Cream onboarding and mobile interface (`< 820px`) with a dedicated Desktop Web App workspace (`>= 820px`).

## Colors

- **Primary Accent (`#00B6C7` / `#0099A8`)**: Reserved for primary CTAs, active navigation state, verified selection badges, and interactive links.
- **Soft Mint Surface (`#C5EFF2`, `#D3F3F5` → `#E9F7F7`)**: Used for selected pill options, active category/nav pills, and onboarding gradient backdrops.
- **Ground & Surfaces (`#FAF9F4` / `#FFFFFF` / `#F5F4EE`)**: Warm cream app canvas with crisp `#FFFFFF` structured panels (`1px` `#E5E8EB` borders) and `#F5F4EE` form fields.
- **Ink & Semantic (`#131A20`, `#646F78`, `#DC2626`, `#059669`)**: High-contrast dark ink typography, muted metadata labels, `#DC2626` strictly reserved for Emergency SOS, and `#059669` for verified safe/confirmed states.

## Typography

- Clean geometric system sans stack across all screens (`800` weight for page/section headings with `-0.5` to `-0.96` letter-spacing, `600`/`700` for interactive controls, `400`/`500` for body copy).

## Layout

- **Desktop (`width >= 820`)**: Top 68px horizontal app navbar (`herway` wordmark + city pill left, 5 horizontal nav links center, Offline Pack / Alerts / SOS pill / Profile right) over a centered `maxWidth: 1320` multi-column workspace grid (`48.6%` / `48.8%` 2-column grids) paired with a `400px` right rail for Active Safety & Trips or the `SplitDetailDrawer`.
- **Mobile (`width < 820`)**: Touch-first vertical layout with Mint-Teal-Cream onboarding (`welcome`, `login`, `language`, `verify-account`, `create-profile`, `select-role`), rounded-top-32 bottom tab bar, and persistent floating SOS pill.

## Elevation & Depth

- Subtle offset card shadow (`0px 10px 24px rgba(19, 26, 32, 0.06)`) paired with `1px` hairline borders (`#E5E8EB`) on desktop cards and drawers.

## Shapes

- Full-pill (`999px`) controls and inputs across onboarding, search, and filter chips; `20px`–`24px` radii on workspace cards and drawers; `32px`–`34px` on mobile bottom sheets.

## Components

- [OnboardingLayout.tsx](file:///c:/Users/muham/OneDrive/Documents/Herway/mobile/components/onboarding/OnboardingLayout.tsx)
- [SplitDetailDrawer.tsx](file:///c:/Users/muham/OneDrive/Documents/Herway/mobile/components/desktop/SplitDetailDrawer.tsx)
- [_layout.tsx](file:///c:/Users/muham/OneDrive/Documents/Herway/mobile/app/(tabs)/_layout.tsx)

## Do's and Don'ts

- **Do** keep Desktop (`>= 820px`) structured with the horizontal top navbar, multi-column grids, and split detail drawer.
- **Don't** render the mobile bottom tab bar, floating mobile SOS FAB, or narrow horizontal card strips stretched across desktop viewports.

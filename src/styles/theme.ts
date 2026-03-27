// SiteSync AI — Category-Defining Design System
// Every token here is a deliberate design decision.
// Typography crafted with the same obsession Apple brings to SF Pro.

export const colors = {
  // Brand
  primaryOrange: '#F47820',
  orangeHover: '#E06A10',
  orangePressed: '#D05E08',
  orangeSubtle: 'rgba(244, 120, 32, 0.08)',
  orangeLight: 'rgba(244, 120, 32, 0.12)',

  // Surfaces — warm, layered, architectural
  surfacePage: '#FAFAF8',
  surfaceSidebar: '#F6F3F0',
  surfaceRaised: '#FFFFFF',
  surfaceInset: '#F3EFEC',
  surfaceHover: '#F0EDE8',
  surfaceSelected: '#FEF7F2',

  // Borders — barely there
  borderSubtle: '#F0EDE9',
  borderDefault: '#E5E1DC',
  borderFocus: '#F47820',

  // Text — warm, four levels
  textPrimary: '#1A1613',
  textSecondary: '#5C5550',
  textTertiary: '#9A9490',
  textOnDark: 'rgba(255, 255, 255, 0.92)',
  textOnDarkMuted: 'rgba(255, 255, 255, 0.5)',

  // Status — desaturated, sophisticated
  statusActive: '#2D8A6E',
  statusActiveSubtle: 'rgba(45, 138, 110, 0.08)',
  statusPending: '#C4850C',
  statusPendingSubtle: 'rgba(196, 133, 12, 0.06)',
  statusCritical: '#C93B3B',
  statusCriticalSubtle: 'rgba(201, 59, 59, 0.06)',
  statusInfo: '#3A7BC8',
  statusInfoSubtle: 'rgba(58, 123, 200, 0.06)',
  statusReview: '#7C5DC7',
  statusReviewSubtle: 'rgba(124, 93, 199, 0.06)',
  statusNeutral: '#8C8580',
  statusNeutralSubtle: 'rgba(140, 133, 128, 0.06)',

  // Utility
  white: '#FFFFFF',

  // Legacy aliases (for components that haven't been updated yet)
  tealSuccess: '#2D8A6E',
  red: '#C93B3B',
  amber: '#C4850C',
  green: '#2D8A6E',
  blue: '#3A7BC8',
  purple: '#7C5DC7',
  cyan: '#06B6D4',
  lightBackground: '#FAFAF8',
  cardBackground: '#FFFFFF',
  border: '#E5E1DC',
  borderLight: '#F0EDE9',
  surfaceFlat: '#F6F3F0',
  darkNavy: '#0F1629',
  orangeGradientStart: '#F47820',
  orangeGradientEnd: '#FF9C42',
  orangeMedium: 'rgba(244, 120, 32, 0.08)',
};

// 4px base grid — the backbone of visual coherence
export const spacing = {
  '1': '4px',
  '2': '8px',
  '3': '12px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '8': '32px',
  '10': '40px',
  '12': '48px',
  // Legacy aliases
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
  '2xl': '40px',
  '3xl': '56px',
};

export const typography = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: {
    // The type scale: each step is purposeful
    caption: '11px',    // timestamps, metadata, labels
    label: '12px',      // form labels, section labels, badges
    sm: '13px',         // secondary text, table cells, tags
    body: '14px',       // primary reading text
    title: '16px',      // card titles, section names
    subtitle: '18px',   // page subtitles, large card headers
    heading: '28px',    // page headings
    display: '36px',    // hero numbers, dashboard KPIs
    // Legacy aliases
    xs: '12px',
    base: '14px',
    lg: '15px',
    xl: '16px',
    '2xl': '18px',
    '3xl': '20px',
    '4xl': '24px',
    '5xl': '28px',
    '6xl': '36px',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    // Legacy aliases
    light: 300,
    bold: 600,
  },
  lineHeight: {
    none: 1,        // single line display numbers
    tight: 1.2,     // headings
    snug: 1.35,     // subheadings, card titles
    normal: 1.55,   // body text
    relaxed: 1.7,   // long form reading, descriptions
  },
  letterSpacing: {
    tighter: '-0.03em',   // large display numbers
    tight: '-0.02em',     // headings
    normal: '-0.011em',   // body text (the sweet spot for Inter)
    wide: '0.01em',       // small text that needs air
    wider: '0.04em',      // labels, captions
    widest: '0.08em',     // uppercase section headers
  },
};

// Ring technique — border-like presence without visible borders
export const shadows = {
  none: 'none',
  xs: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.03)',
  card: '0 1px 3px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.015)',
  cardHover: '0 3px 12px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.02)',
  dropdown: '0 4px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.03)',
  panel: '0 16px 48px rgba(0, 0, 0, 0.12)',
  pressed: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
  glow: '0 4px 24px rgba(244, 120, 32, 0.25)',
  // Legacy aliases
  base: '0 1px 3px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.015)',
  md: '0 3px 12px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.02)',
  lg: '0 16px 48px rgba(0, 0, 0, 0.12)',
};

// Tighter radii — serious, not playful
export const borderRadius = {
  none: '0',
  sm: '4px',
  base: '6px',
  md: '8px',
  lg: '10px',
  xl: '12px',
  '2xl': '16px',
  full: '9999px',
};

export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modal: 1040,
  popover: 1050,
  tooltip: 1060,
  command: 1070,
};

// Three tiers of motion
export const transitions = {
  instant: '80ms ease-out',
  quick: '160ms cubic-bezier(0.25, 0.1, 0.25, 1)',
  smooth: '300ms cubic-bezier(0.32, 0.72, 0, 1)',
  // Legacy aliases
  fast: '80ms ease-out',
  base: '160ms cubic-bezier(0.25, 0.1, 0.25, 1)',
  slow: '300ms cubic-bezier(0.32, 0.72, 0, 1)',
  spring: '300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
};

export const layout = {
  sidebarWidth: '252px',
  contentMaxWidth: '1140px',
  contentPaddingX: '36px',
  contentPaddingY: '36px',
  // Legacy aliases
  sidebarCollapsed: '72px',
  topbarHeight: '64px',
  pageMaxWidth: '1140px',
  pagePaddingX: '36px',
  pagePaddingY: '36px',
  mobileBreak: '768px',
  tabletBreak: '1024px',
};

// SiteSync AI — Unified Design System
// Single source of truth for all design tokens.
// Every color, spacing, font, shadow, radius, and z-index value in the app comes from here.

// ── Colors ───────────────────────────────────────────────

export const colors = {
  // Brand
  primaryOrange: '#F47820',
  orangeText: '#C45A0C', // AA compliant (5.5:1 on white) for text use
  orangeHover: '#E06A10',
  orangePressed: '#D05E08',
  orangeSubtle: 'rgba(244, 120, 32, 0.08)',
  orangeLight: 'rgba(244, 120, 32, 0.12)',

  // Brand palette (full scale for charts, gradients, illustrations)
  brand50: '#FEF5ED',
  brand100: '#FDDCB8',
  brand200: '#FBBD84',
  brand300: '#F9974F',
  brand400: '#F47820',
  brand500: '#E06A10',
  brand600: '#C45A0C',
  brand700: '#A04808',
  brand800: '#7C3606',
  brand900: '#582604',

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
  black: '#000000',
  textDisabled: '#C5C0BB',
  surfaceDisabled: '#EDEDEB',
  borderHover: '#D5D0CA',

  // Overlay / Backdrop
  overlayDark: 'rgba(0, 0, 0, 0.4)',
  overlayLight: 'rgba(255, 255, 255, 0.9)',
  overlayScrim: 'rgba(0, 0, 0, 0.6)',
  overlayHeavy: 'rgba(0, 0, 0, 0.8)',
  overlayBackdrop: 'rgba(0, 0, 0, 0.5)',
  overlayWhiteThin: 'rgba(255, 255, 255, 0.1)',
  overlayWhiteMedium: 'rgba(255, 255, 255, 0.6)',
  overlayWhiteBold: 'rgba(255, 255, 255, 0.7)',
  overlayBlackThin: 'rgba(0, 0, 0, 0.03)',
  overlayBlackLight: 'rgba(0, 0, 0, 0.08)',
  overlayBlackMedium: 'rgba(0, 0, 0, 0.1)',
  overlayBlackHeavy: 'rgba(0, 0, 0, 0.12)',
  panelBg: 'rgba(255, 255, 255, 0.95)',
  toolbarBg: 'rgba(0, 0, 0, 0.3)',

  // Indigo / AI accent
  indigo: '#4F46E5',
  indigoSubtle: 'rgba(79, 70, 229, 0.06)',

  // Dark mode topbar
  topbarDark: 'rgba(12, 13, 15, 0.72)',
  topbarLight: 'rgba(255, 255, 255, 0.72)',
  darkHoverBg: 'rgba(255, 255, 255, 0.06)',
  darkBorder: 'rgba(255, 255, 255, 0.1)',
  darkMutedText: 'rgba(255, 255, 255, 0.5)',

  // Photo/viewer overlays
  photoGradient: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
  photoGradientHeavy: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
  viewerBg: 'rgba(0, 0, 0, 0.9)',

  // Error banner
  errorSubtle: 'rgba(200, 50, 50, 0.06)',

  // Status subtle variants (extra)
  statusInfoExtraSubtle: 'rgba(58, 123, 200, 0.04)',
  statusActiveExtraSubtle: 'rgba(45, 138, 110, 0.04)',

  // Additional status variants
  statusInfoBright: '#4A9EE8',
  statusWarning: '#D97706',
  statusWarningSubtle: 'rgba(217, 119, 6, 0.06)',
  statusSuccess: '#166534',
  statusSuccessSubtle: 'rgba(22, 101, 52, 0.06)',

  // Chart / Accent palette
  chartGreen: '#A3E635',
  chartCyan: '#06B6D4',
  chartAmber: '#FB923C',
  chartPurple: '#7C3AED',
  chartPink: '#E07070',
  chartRed: '#E05252',

  // Neutral grays (for icons, dividers, disabled states)
  gray300: '#D0D0D0',
  gray400: '#B0B0B0',
  gray500: '#8B8680',
  gray600: '#6B6560',
  gray700: '#5C5550',

  // Error banner
  errorBannerBg: 'rgba(201, 59, 59, 0.06)',
  warningBannerBg: 'rgba(196, 133, 12, 0.06)',
  infoBannerBg: 'rgba(58, 123, 200, 0.06)',

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
} as const;

// ── Visualization Colors ───────────────────────────────
// Colors for drawing viewers, annotations, and data visualizations.

export const vizColors = {
  dark: '#1a1a2e',
  darkText: '#1A1613',
  success: '#00ff88',
  success2: '#6BBF59',
  neutral: '#B0B0B0',
  gridLine: '#e0e0e0',
  annotation: '#ff4444',
  highlight: '#ffff00',
} as const;

// ── PDF Export Colors ──────────────────────────────────
// Colors for PDF/print export templates.

export const pdfColors = {
  text: '#333333',
  border: '#cccccc',
  background: '#f9f9f9',
  pageNumber: '#666666',
} as const;

// ── Trade Colors ────────────────────────────────────────
// Construction trade-specific colors for crew pages, daily logs, etc.

export const tradeColors: Record<string, string> = {
  carpentry: '#8B5E3C',
  electrical: '#D97706',
  plumbing: '#3A7BC8',
  concrete: '#8C8580',
  structural: '#C93B3B',
  mechanical: '#06B6D4',
  fire_protection: '#E05252',
  finishing: '#7C5DC7',
  general: '#5C5550',
  roofing: '#4F46E5',
  glazing: '#2D8A6E',
  painting: '#FB923C',
  excavation: '#A04808',
  landscaping: '#166534',
} as const;

// ── Dark Mode Colors ─────────────────────────────────────

export const darkColors = {
  surfacePage: '#0C0D0F',
  surfaceSidebar: '#111214',
  surfaceRaised: '#1A1B1E',
  surfaceInset: '#141518',
  surfaceHover: '#1F2024',
  surfaceSelected: '#2A1F16',
  surfaceFlat: '#171819',
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  borderDefault: 'rgba(255, 255, 255, 0.1)',
  borderLight: 'rgba(255, 255, 255, 0.06)',
  textPrimary: 'rgba(255, 255, 255, 0.92)',
  textSecondary: 'rgba(255, 255, 255, 0.6)',
  textTertiary: 'rgba(255, 255, 255, 0.38)',
  cardBackground: '#1A1B1E',
  lightBackground: '#0C0D0F',
  // Status colors stay the same in dark mode (high contrast on dark bg)
} as const;

// CSS custom property names for dark mode theming
export const colorVars = {
  surfacePage: 'var(--color-surfacePage, #FAFAF8)',
  surfaceSidebar: 'var(--color-surfaceSidebar, #F6F3F0)',
  surfaceRaised: 'var(--color-surfaceRaised, #FFFFFF)',
  surfaceInset: 'var(--color-surfaceInset, #F3EFEC)',
  surfaceHover: 'var(--color-surfaceHover, #F0EDE8)',
  surfaceSelected: 'var(--color-surfaceSelected, #FEF7F2)',
  surfaceFlat: 'var(--color-surfaceFlat, #F6F3F0)',
  borderSubtle: 'var(--color-borderSubtle, #F0EDE9)',
  borderDefault: 'var(--color-borderDefault, #E5E1DC)',
  borderLight: 'var(--color-borderLight, #F0EDE9)',
  textPrimary: 'var(--color-textPrimary, #1A1613)',
  textSecondary: 'var(--color-textSecondary, #5C5550)',
  textTertiary: 'var(--color-textTertiary, #9A9490)',
} as const;

// ── Spacing ──────────────────────────────────────────────

// 4px base grid — the backbone of visual coherence
export const spacing = {
  '0': '0',
  '0.5': '2px',
  '1': '4px',
  '1.5': '6px',
  '2': '8px',
  '2.5': '10px',
  '3': '12px',
  '3.5': '14px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '7': '28px',
  '8': '32px',
  '9': '36px',
  '10': '40px',
  '11': '44px',
  '12': '48px',
  '14': '56px',
  '16': '64px',
  '20': '80px',
  '24': '96px',
  // Legacy aliases
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
  '2xl': '40px',
  '3xl': '56px',
  px: '1px',
} as const;

// ── Typography ───────────────────────────────────────────

export const typography = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontFamilyMono: '"JetBrains Mono", "Fira Code", monospace',
  fontSize: {
    caption: '11px',
    label: '12px',
    sm: '13px',
    body: '14px',
    title: '16px',
    subtitle: '18px',
    medium: '20px',
    large: '24px',
    heading: '28px',
    display: '36px',
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
    bold: 700,
    // Legacy aliases
    light: 300,
  },
  lineHeight: {
    none: 1,
    tight: 1.2,
    snug: 1.35,
    normal: 1.55,
    relaxed: 1.7,
  },
  letterSpacing: {
    tighter: '-0.03em',
    tight: '-0.02em',
    normal: '-0.011em',
    wide: '0.01em',
    wider: '0.04em',
    widest: '0.08em',
  },
} as const;

// ── Shadows ──────────────────────────────────────────────

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
} as const;

// ── Border Radius ────────────────────────────────────────

export const borderRadius = {
  none: '0',
  sm: '4px',
  base: '6px',
  md: '8px',
  lg: '10px',
  xl: '12px',
  '2xl': '16px',
  full: '9999px',
} as const;

// ── Z-Index ──────────────────────────────────────────────

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
  toast: 1080,
} as const;

// ── Transitions ──────────────────────────────────────────

export const transitions = {
  instant: '80ms ease-out',
  quick: '160ms cubic-bezier(0.25, 0.1, 0.25, 1)',
  smooth: '300ms cubic-bezier(0.32, 0.72, 0, 1)',
  // Legacy aliases
  fast: '80ms ease-out',
  base: '160ms cubic-bezier(0.25, 0.1, 0.25, 1)',
  slow: '300ms cubic-bezier(0.32, 0.72, 0, 1)',
  spring: '300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

// ── Layout ───────────────────────────────────────────────

export const layout = {
  sidebarWidth: '252px',
  sidebarCollapsed: '72px',
  topbarHeight: '64px',
  contentMaxWidth: '1140px',
  contentPaddingX: '36px',
  contentPaddingY: '36px',
  mobileBreak: '768px',
  tabletBreak: '1024px',
  searchWidth: '320px',
  metricCardHeight: '120px',
  tableRowHeight: '52px',
  // Legacy aliases
  pageMaxWidth: '1140px',
  pagePaddingX: '36px',
  pagePaddingY: '36px',
} as const;

// ── Touch Targets ────────────────────────────────────────

export const touchTarget = {
  min: '44px',
  comfortable: '48px',
  field: '56px',
} as const;

// ── Semantic Color Helpers ───────────────────────────────

// Status color map (construction industry standard)
const statusColorMap: Record<string, { fg: string; bg: string }> = {
  open: { fg: colors.statusInfo, bg: colors.statusInfoSubtle },
  pending: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
  under_review: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
  approved: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
  rejected: { fg: colors.statusCritical, bg: colors.statusCriticalSubtle },
  closed: { fg: colors.statusNeutral, bg: colors.statusNeutralSubtle },
  draft: { fg: colors.textTertiary, bg: colors.statusNeutralSubtle },
  in_progress: { fg: colors.statusInfo, bg: colors.statusInfoSubtle },
  todo: { fg: colors.textTertiary, bg: colors.statusNeutralSubtle },
  in_review: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
  done: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
  complete: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
  active: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
  resolved: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
  verified: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
  at_risk: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
  behind: { fg: colors.statusCritical, bg: colors.statusCriticalSubtle },
  on_track: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
  answered: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
  resubmit: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
  void: { fg: colors.statusNeutral, bg: colors.statusNeutralSubtle },
  submitted: { fg: colors.statusInfo, bg: colors.statusInfoSubtle },
};

export function getStatusColor(status: string): { fg: string; bg: string } {
  return statusColorMap[status] ?? { fg: colors.textTertiary, bg: colors.statusNeutralSubtle };
}

// Priority color map
const priorityColorMap: Record<string, { fg: string; bg: string }> = {
  critical: { fg: colors.statusCritical, bg: colors.statusCriticalSubtle },
  high: { fg: colors.primaryOrange, bg: colors.orangeSubtle },
  medium: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
  low: { fg: colors.statusInfo, bg: colors.statusInfoSubtle },
};

export function getPriorityColor(priority: string): { fg: string; bg: string } {
  return priorityColorMap[priority] ?? priorityColorMap.medium;
}

// Severity color map
export function getSeverityColor(severity: string): { fg: string; bg: string } {
  const map: Record<string, { fg: string; bg: string }> = {
    critical: { fg: colors.statusCritical, bg: colors.statusCriticalSubtle },
    warning: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
    info: { fg: colors.statusInfo, bg: colors.statusInfoSubtle },
    success: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
  };
  return map[severity] ?? map.info;
}

// ── Focus Ring Styles ────────────────────────────────────

export const focusRing = {
  outline: `2px solid ${colors.borderFocus}`,
  outlineOffset: '2px',
} as const;

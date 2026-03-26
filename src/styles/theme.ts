// SiteSync AI — Design System v2
// Philosophy: Clarity is luxury. Restraint is power. Hierarchy creates confidence.

export const colors = {
  // Foundation
  canvas: '#0C0D0F',          // Near-black canvas — not pure black, materially considered
  surface: '#111214',         // Primary surface — cards, panels
  surfaceElevated: '#16181C', // Slightly lifted surfaces
  surfaceHover: '#1C1E23',    // Hover state
  surfaceBorder: '#1F2128',   // Subtle structural border

  // Borders
  borderFaint: 'rgba(255,255,255,0.05)',   // Hairline — barely visible
  borderSubtle: 'rgba(255,255,255,0.08)',  // Subtle structural
  borderModerate: 'rgba(255,255,255,0.12)', // Visible separation
  borderStrong: 'rgba(255,255,255,0.20)',  // Emphatic edge

  // Text
  textPrimary: '#F0F1F3',     // Near-white — primary copy
  textSecondary: '#8A8F9C',   // Secondary / labels
  textTertiary: '#555A66',    // Metadata / timestamps
  textDisabled: '#3A3D47',    // Disabled
  textInverse: '#0C0D0F',     // Text on light surfaces

  // Signal — one precise accent used with restraint
  signal: '#E8804A',          // SiteSync amber-orange — refined, not aggressive
  signalDim: 'rgba(232,128,74,0.12)',
  signalGlow: 'rgba(232,128,74,0.20)',
  signalHover: '#D4723F',

  // Status — precise, not loud
  positive: '#3EC87A',        // Healthy / complete / on track
  positiveDim: 'rgba(62,200,122,0.12)',
  caution: '#E8A83A',         // Watch / at risk
  cautionDim: 'rgba(232,168,58,0.12)',
  critical: '#E05252',        // Immediate attention
  criticalDim: 'rgba(224,82,82,0.12)',
  info: '#4A9EE8',            // Informational
  infoDim: 'rgba(74,158,232,0.12)',
  purple: '#8B6FE8',          // Intelligence / AI
  purpleDim: 'rgba(139,111,232,0.12)',

  // Structural
  white: '#FFFFFF',
  black: '#000000',
};

export const spacing = {
  px: '1px',
  '0': '0px',
  '1': '4px',
  '2': '8px',
  '3': '12px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '7': '28px',
  '8': '32px',
  '10': '40px',
  '12': '48px',
  '14': '56px',
  '16': '64px',
  // Legacy aliases
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
  xxxl: '48px',
};

export const typography = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontFamilyMono: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  fontSize: {
    xs: '11px',
    sm: '12px',
    base: '13px',
    md: '14px',
    lg: '15px',
    xl: '17px',
    '2xl': '20px',
    '3xl': '24px',
    '4xl': '30px',
    '5xl': '38px',
    '6xl': '48px',
  },
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    none: 1,
    tight: 1.2,
    snug: 1.35,
    normal: 1.5,
    relaxed: 1.65,
  },
  letterSpacing: {
    tighter: '-0.04em',
    tight: '-0.02em',
    normal: '0em',
    wide: '0.04em',
    wider: '0.08em',
    widest: '0.12em',
  },
};

export const shadows = {
  none: 'none',
  xs: '0 1px 2px rgba(0,0,0,0.4)',
  sm: '0 2px 8px rgba(0,0,0,0.4)',
  base: '0 4px 16px rgba(0,0,0,0.5)',
  md: '0 8px 32px rgba(0,0,0,0.5)',
  lg: '0 16px 48px rgba(0,0,0,0.6)',
  xl: '0 32px 80px rgba(0,0,0,0.7)',
  signal: '0 0 0 1px rgba(232,128,74,0.3), 0 4px 16px rgba(232,128,74,0.15)',
  glow: '0 0 32px rgba(232,128,74,0.12)',
};

export const borderRadius = {
  none: '0',
  sm: '3px',
  base: '5px',
  md: '7px',
  lg: '10px',
  xl: '14px',
  '2xl': '18px',
  full: '9999px',
};

export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  raised: 10,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modal: 1040,
  popover: 1050,
  tooltip: 1060,
};

export const transitions = {
  instant: '80ms ease',
  fast: '140ms cubic-bezier(0.16, 1, 0.3, 1)',
  base: '200ms cubic-bezier(0.16, 1, 0.3, 1)',
  slow: '350ms cubic-bezier(0.16, 1, 0.3, 1)',
  spring: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
};

export const layout = {
  sidebarWidth: '240px',
  topbarHeight: '52px',
  contentPadding: '32px',
};

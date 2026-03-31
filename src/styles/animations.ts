// SiteSync AI — Unified Motion System
// Every animation in the app is defined here. No magic numbers in components.

import { shadows } from './theme'

// ── Easing Curves (perceptually tuned) ───────────────────

export const easing = {
  // Standard movements (entering, resizing, repositioning)
  standard: 'cubic-bezier(0.32, 0.72, 0, 1)',
  // Entering from off-screen or appearing
  enter: 'cubic-bezier(0, 0, 0.2, 1)',
  // Leaving screen or disappearing
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  // Bouncy/spring (for confirmations, success states, playful moments)
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  // Linear (only for progress bars, loading spinners)
  linear: 'linear',
  // Apple style (for modals, drawers, large surface transitions)
  apple: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
} as const;

// As number arrays for framer-motion
export const easingArray = {
  standard: [0.32, 0.72, 0, 1] as [number, number, number, number],
  enter: [0, 0, 0.2, 1] as [number, number, number, number],
  exit: [0.4, 0, 1, 1] as [number, number, number, number],
  spring: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
  apple: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
} as const;

// ── Duration Scale (perceptually consistent) ─────────────

export const duration = {
  instant: 80,     // Hover color changes, icon swaps
  fast: 120,       // Button press feedback, toggles
  normal: 200,     // Card hovers, dropdown opens
  smooth: 300,     // Modal/drawer enter, page transitions
  slow: 500,       // Complex layout shifts, dashboard widget reorganization
  glacial: 800,    // Onboarding, first-time animations
} as const;

// ── Pre-built CSS Transition Strings ─────────────────────

export const motion = {
  // Hover effects (background, border, shadow changes)
  hover: `all ${duration.instant}ms ${easing.standard}`,
  // Button press/active state
  press: `transform ${duration.fast}ms ${easing.spring}`,
  // Card lift on hover
  cardLift: `transform ${duration.normal}ms ${easing.standard}, box-shadow ${duration.normal}ms ${easing.standard}`,
  // Dropdown/popover open
  dropdownOpen: `opacity ${duration.normal}ms ${easing.enter}, transform ${duration.normal}ms ${easing.enter}`,
  // Modal/drawer enter
  modalEnter: `opacity ${duration.smooth}ms ${easing.apple}, transform ${duration.smooth}ms ${easing.apple}`,
  // Page content fade in
  pageFade: `opacity ${duration.smooth}ms ${easing.enter}`,
  // Tab content switch
  tabSwitch: `opacity ${duration.fast}ms ${easing.standard}`,
  // Toast enter
  toastEnter: `transform ${duration.smooth}ms ${easing.spring}, opacity ${duration.smooth}ms ${easing.enter}`,
  // Sidebar expand/collapse
  sidebarResize: `width ${duration.smooth}ms ${easing.standard}, padding ${duration.smooth}ms ${easing.standard}`,
  // Focus ring appear
  focusRing: `box-shadow ${duration.fast}ms ${easing.standard}`,
} as const;

// ── Framer Motion Variants ──────────────────────────────

export const variants = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: duration.smooth / 1000, ease: easingArray.standard },
  },
  slideUp: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
    transition: { duration: duration.smooth / 1000, ease: easingArray.standard },
  },
  slideDown: {
    initial: { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 8 },
    transition: { duration: duration.normal / 1000, ease: easingArray.standard },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
    transition: { duration: duration.smooth / 1000, ease: easingArray.standard },
  },
  cardHover: {
    rest: { y: 0, boxShadow: shadows.card },
    hover: { y: -2, boxShadow: shadows.cardHover },
    tap: { y: 0, scale: 0.995 },
  },
  staggerChildren: {
    animate: { transition: { staggerChildren: 0.04 } },
  },
  listItem: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: duration.normal / 1000, ease: easingArray.standard },
  },
  modalOverlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: duration.normal / 1000 },
  },
  modalContent: {
    initial: { opacity: 0, scale: 0.96, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.98, y: 5 },
    transition: { duration: duration.smooth / 1000, ease: easingArray.apple },
  },
  tooltip: {
    initial: { opacity: 0, scale: 0.96, y: 4 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.96 },
    transition: { duration: duration.fast / 1000, ease: easingArray.standard },
  },
  kpiStagger: {
    container: {
      animate: { transition: { staggerChildren: 0.06 } },
    },
    item: {
      initial: { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: duration.smooth / 1000, ease: easingArray.apple },
    },
  },
} as const;

// ── CSS Keyframes ────────────────────────────────────────
// Additional keyframes beyond what index.css provides

export const keyframes = `
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes ripple {
  0% { transform: scale(0); opacity: 0.4; }
  100% { transform: scale(4); opacity: 0; }
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes modalIn {
  from { opacity: 0; transform: scale(0.96) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes modalOut {
  from { opacity: 1; transform: scale(1) translateY(0); }
  to { opacity: 0; transform: scale(0.98) translateY(5px); }
}
`;

// ── Skeleton Shimmer ─────────────────────────────────────

export const skeletonStyle = {
  background: `linear-gradient(90deg, var(--color-surfaceInset, #F3EFEC) 25%, var(--color-surfaceHover, #F0EDE8) 50%, var(--color-surfaceInset, #F3EFEC) 75%)`,
  backgroundSize: '800px 100%',
  animation: 'shimmer 1.5s linear infinite',
} as const;

// SiteSync AI — Apple HIG Animation System
// Every animation: transform + opacity only, ≤ 500ms, 60fps, respects prefers-reduced-motion.
// Usage: <motion.div {...animations.pageSlide} /> or spread individual props.

import type { Variants, Transition } from 'framer-motion'
import { colors } from '../styles/theme'

// ── Shared Easings ──────────────────────────────────────

/** Apple system ease-out (decelerating) */
export const easeOut = [0.25, 0.1, 0.25, 1] as const

/** Apple system ease-in-out (smooth) */
export const easeInOut = [0.32, 0.72, 0, 1] as const

/** Snappy spring for interactive elements */
export const springSnappy = { type: 'spring' as const, stiffness: 300, damping: 30 }

/** Responsive spring for modals/overlays */
export const springModal = { type: 'spring' as const, stiffness: 400, damping: 30 }

/** Bouncy spring for badges/counters */
export const springBouncy = { type: 'spring' as const, stiffness: 500, damping: 25 }

// ── Page Transitions ────────────────────────────────────
// Slide + fade, 200ms, ease-out

export const pageSlide: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
}

export const pageSlideTransition: Transition = {
  duration: 0.2,
  ease: [...easeOut],
}

// ── Modal Entry ─────────────────────────────────────────
// Scale from 0.95 + fade, 250ms, spring

export const modalEntry: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
}

export const modalEntryTransition: Transition = {
  ...springModal,
}

export const backdrop: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export const backdropTransition: Transition = {
  duration: 0.2,
}

// ── List Item Stagger ───────────────────────────────────
// Children stagger by 30ms on mount

export const listContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.02,
    },
  },
}

export const listItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
}

export const listItemTransition: Transition = {
  duration: 0.15,
  ease: [...easeOut],
}

// ── KPI / Metric Stagger ────────────────────────────────
// Slightly slower stagger for hero metrics

export const kpiContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
}

export const kpiItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
}

export const kpiItemTransition: Transition = {
  duration: 0.3,
  ease: [...easeOut],
}

// ── Status Change ───────────────────────────────────────
// Color crossfade 300ms with subtle scale pulse (1.0 → 1.02 → 1.0)

export const statusChange: Variants = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.02, 1],
    transition: { duration: 0.3, ease: [...easeInOut] },
  },
}

// ── Delete / Collapse ───────────────────────────────────
// Fade out + scale to 0 height, 200ms

export const deleteCollapse: Variants = {
  initial: { opacity: 1, scale: 1 },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2, ease: [...easeOut] },
  },
}

// ── Skeleton Shimmer ────────────────────────────────────
// CSS keyframe shimmer (gradient sweep). Use as className or inline.

export const shimmerStyle: React.CSSProperties = {
  background: `linear-gradient(90deg, transparent 0%, ${colors.overlayBlackLight} 50%, transparent 100%)`,
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
}

// ── Toast Notifications ─────────────────────────────────
// Slide in from top-right, 300ms spring

export const toastSlide: Variants = {
  initial: { opacity: 0, x: 80, scale: 0.95 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: 80, scale: 0.95 },
}

export const toastTransition: Transition = {
  ...springSnappy,
}

// ── Sidebar Expand/Collapse ─────────────────────────────
// Width transition 200ms ease-in-out (CSS, not Framer — avoids layout thrash)

export const sidebarTransition = '200ms cubic-bezier(0.32, 0.72, 0, 1)'

// ── Drawer (slide from right) ───────────────────────────

export const drawerSlide: Variants = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
}

export const drawerTransition: Transition = {
  ...springSnappy,
}

// ── Micro-interactions ──────────────────────────────────

/** Button press: scale down 0.98 for 100ms */
export const buttonPress = {
  whileTap: { scale: 0.98 },
  transition: { duration: 0.1 },
}

/** Card hover: 2px lift + shadow increase */
export const cardHover = {
  whileHover: { y: -2 },
  transition: { duration: 0.15, ease: [...easeOut] },
}

/** Badge count bounce when number changes */
export const badgeBounce: Variants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
}

export const badgeBounceTransition: Transition = {
  ...springBouncy,
}

/** Checkbox spring check mark */
export const checkMark: Variants = {
  initial: { pathLength: 0, opacity: 0 },
  animate: { pathLength: 1, opacity: 1 },
}

export const checkMarkTransition: Transition = {
  duration: 0.2,
  ease: 'easeOut',
}

/** Progress bar fill */
export const progressFill: Variants = {
  initial: { scaleX: 0, originX: 0 },
  animate: (pct: number) => ({
    scaleX: pct / 100,
    originX: 0,
    transition: { duration: 0.5, ease: [...easeInOut] },
  }),
}

// ── Reduced Motion Helper ───────────────────────────────

const instantTransition: Transition = { duration: 0 }

/**
 * Wraps any Framer Motion props to respect prefers-reduced-motion.
 * Zeroes transforms, keeps opacity for graceful degradation, kills hover/tap.
 */
export function withReducedMotion<T extends Record<string, unknown>>(
  props: T,
  prefersReduced: boolean,
): T {
  if (!prefersReduced) return props

  const safe = { ...props } as Record<string, unknown>

  if ('transition' in safe) safe.transition = instantTransition
  if (safe.initial && typeof safe.initial === 'object') safe.initial = { opacity: 0 }
  if (safe.animate && typeof safe.animate === 'object') safe.animate = { opacity: 1 }
  if (safe.exit && typeof safe.exit === 'object') safe.exit = { opacity: 0 }
  if ('whileHover' in safe) safe.whileHover = {}
  if ('whileTap' in safe) safe.whileTap = {}

  return safe as T
}

/**
 * Returns a safe transition (instant if reduced motion preferred).
 */
export function motionSafe(prefersReduced: boolean, transition: Transition): Transition {
  return prefersReduced ? instantTransition : transition
}

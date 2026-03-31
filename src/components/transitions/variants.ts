// Reusable Framer Motion transition variants
// All variants support reduced motion via the helper at the bottom.

import type { Transition, Variant } from 'framer-motion'
import { duration, easingArray } from '../../styles/animations'

// ── Page Transitions ─────────────────────────────────────

export const pageTransition = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: duration.smooth / 1000, ease: easingArray.apple },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 },
};

export const slideInRight = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
  transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] },
};

export const slideInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
  transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
};

// ── Stagger Patterns ─────────────────────────────────────

export const staggerChildren = {
  animate: { transition: { staggerChildren: 0.04 } },
};

export const staggerItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

export const listStagger = {
  container: {
    animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
  },
  item: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.15 },
  },
};

export const kpiStagger = {
  container: {
    animate: { transition: { staggerChildren: 0.06 } },
  },
  item: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
  },
};

// ── Overlay & Modal ──────────────────────────────────────

export const backdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};

export const modalScale = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { type: 'spring', stiffness: 400, damping: 30 },
};

export const drawerSlide = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
  transition: { type: 'spring', stiffness: 300, damping: 30 },
};

// ── Micro-interactions ───────────────────────────────────

export const cardHover = {
  whileHover: { y: -2, boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)' },
  transition: { duration: 0.15 },
};

export const buttonPress = {
  whileTap: { scale: 0.97 },
  whileHover: { scale: 1.02 },
  transition: { duration: 0.1 },
};

export const badgePulse = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { type: 'spring', stiffness: 500, damping: 25 },
};

export const checkboxCheck = {
  initial: { pathLength: 0, opacity: 0 },
  animate: { pathLength: 1, opacity: 1 },
  transition: { duration: 0.2, ease: 'easeOut' },
};

export const progressFill = {
  initial: { scaleX: 0 },
  animate: (width: number) => ({ scaleX: width / 100 }),
  transition: { duration: 0.6, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] },
};

// ── Reduced Motion Helper ────────────────────────────────

/**
 * Returns instant (no-motion) variants when user prefers reduced motion.
 * Usage: <motion.div {...withReducedMotion(pageTransition, reducedMotion)} />
 */
export function withReducedMotion<T extends Record<string, unknown>>(
  variants: T,
  prefersReduced: boolean
): T {
  if (!prefersReduced) return variants;

  const reduced = { ...variants } as Record<string, unknown>;

  // Replace all transitions with instant ones
  if ('transition' in reduced) {
    reduced.transition = { duration: 0 };
  }

  // Zero out transforms but keep opacity for graceful degradation
  if (reduced.initial && typeof reduced.initial === 'object') {
    reduced.initial = { opacity: 0 };
  }
  if (reduced.animate && typeof reduced.animate === 'object') {
    reduced.animate = { opacity: 1 };
  }
  if (reduced.exit && typeof reduced.exit === 'object') {
    reduced.exit = { opacity: 0 };
  }

  // Remove hover/tap effects
  if ('whileHover' in reduced) reduced.whileHover = {};
  if ('whileTap' in reduced) reduced.whileTap = {};

  return reduced as T;
}

/**
 * Returns a transition object that respects reduced motion.
 * Usage: transition={motionSafe(prefersReduced, { duration: 0.3 })}
 */
export function motionSafe(prefersReduced: boolean, transition: Transition): Transition {
  if (prefersReduced) return { duration: 0 };
  return transition;
}

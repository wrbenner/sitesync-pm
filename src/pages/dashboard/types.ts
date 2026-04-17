import type { ProjectMetrics } from '../../types/api';

export type { ProjectMetrics };

// ── Number Formatting ───────────────────────────────────

export function compactDollars(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 10_000) return `$${Math.round(amount / 1000)}K`;
  return `$${amount.toLocaleString()}`;
}

export function formatPct(value: number): string {
  if (value === Math.floor(value)) return `${value}%`;
  return `${value.toFixed(1)}%`;
}

// ── Stagger Variants ────────────────────────────────────

export const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.03 } },
};

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

export const staggerTransition = { type: 'spring' as const, stiffness: 350, damping: 30 };

export interface ScheduleHealth {
  days: number;
  label: string;
  positive: boolean;
}

export interface BudgetData {
  spent: number;
  total: number;
  pct: number;
}

export interface RfiData {
  open: number;
  overdue: number;
}

export interface PunchData {
  open: number;
  total: number;
  resolved: number;
}

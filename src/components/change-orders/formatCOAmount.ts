/**
 * Financial formatting utilities for change orders.
 *
 * Financial note: estimated_cost, submitted_cost, approved_cost, and
 * approved_amount are stored as NUMERIC (arbitrary precision) in PostgreSQL
 * and surface as number in JavaScript. Always round to 2 decimal places
 * before display. Never use floating-point arithmetic for accumulation.
 * Use integer cents for summation (see ChangeOrderFinancialSummary).
 */

/**
 * Format a dollar amount with full precision for line-item display.
 * Returns $0.00 for null/undefined.
 */
export function formatCOAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Compact format for metric cards where screen space is limited.
 * $1,234,567 -> $1.2M, $45,000 -> $45K, $999 -> $999
 */
export function formatCOAmountCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return '$0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toLocaleString()}`;
}

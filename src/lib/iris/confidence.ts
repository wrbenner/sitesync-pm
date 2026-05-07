// ── Iris confidence helper ──────────────────────────────────────────────
// Single source of truth for the auto-apply / suggest / draft-only
// branching logic across the P2b Iris surface. Mirrors ADR-007.

export type IrisConfidenceBand = 'high' | 'medium' | 'low'

export const CONFIDENCE_THRESHOLDS = {
  high: 0.85,
  medium: 0.6,
} as const

export function bandFromScore(score: number | null | undefined): IrisConfidenceBand {
  if (score == null || !Number.isFinite(score)) return 'low'
  if (score >= CONFIDENCE_THRESHOLDS.high) return 'high'
  if (score >= CONFIDENCE_THRESHOLDS.medium) return 'medium'
  return 'low'
}

export function shouldAutoApply(band: IrisConfidenceBand): boolean {
  return band === 'high'
}

export function shouldSuggest(band: IrisConfidenceBand): boolean {
  return band === 'medium'
}

export function bandColor(band: IrisConfidenceBand): { bg: string; fg: string } {
  switch (band) {
    case 'high':
      return { bg: '#DCFCE7', fg: '#15803D' }
    case 'medium':
      return { bg: '#FEF3C7', fg: '#92400E' }
    case 'low':
      return { bg: '#FEE2E2', fg: '#991B1B' }
  }
}

/**
 * Status tone palette + status-string → tone resolver.
 *
 * Lives in its own file (not `StatusPill.tsx`) so react-refresh stays clean:
 * the component file exports only components, this one exports only helpers
 * and types.
 *
 * Palette is the DESIGN-RESET 5-color status set plus an indigo "iris" tone
 * for AI-related state and a neutral gray fallback. The single source of
 * truth for visual rules is `specs/homepage-redesign/DESIGN-RESET.md`.
 */

export type StatusTone =
  | 'success'   // #2D8A6E  on track, resolved, approved, complete
  | 'warning'   // #C4850C  medium, pending, in review
  | 'danger'    // #C93B3B  critical, overdue, blocked
  | 'high'      // #B8472E  high severity, at risk (earthier than danger)
  | 'info'      // #3A7BC8  info, in progress, draft (legacy)
  | 'iris'      // #4F46E5  AI-related (Iris drafted, etc.)
  | 'neutral'   // #5C5550  closed, void, archived

export interface ToneStyle {
  dot: string
  text: string
  bg: string // for `tinted` mode
}

export const TONES: Record<StatusTone, ToneStyle> = {
  success: { dot: '#2D8A6E', text: '#2D8A6E', bg: 'rgba(45, 138, 110, 0.10)' },
  warning: { dot: '#C4850C', text: '#C4850C', bg: 'rgba(196, 133, 12, 0.12)' },
  danger:  { dot: '#C93B3B', text: '#C93B3B', bg: 'rgba(201, 59, 59, 0.10)' },
  high:    { dot: '#B8472E', text: '#B8472E', bg: 'rgba(184, 71, 46, 0.10)' },
  info:    { dot: '#3A7BC8', text: '#3A7BC8', bg: 'rgba(58, 123, 200, 0.10)' },
  iris:    { dot: '#4F46E5', text: '#4F46E5', bg: 'rgba(79, 70, 229, 0.10)' },
  neutral: { dot: '#8C857E', text: '#5C5550', bg: 'rgba(140, 133, 126, 0.10)' },
}

/**
 * Map a free-form status string to a canonical tone. Useful when migrating
 * pages that hand the status straight from the DB.
 */
export function toneForStatus(raw: string | null | undefined): StatusTone {
  const k = (raw ?? '').toString().toLowerCase().trim()
  if (!k) return 'neutral'
  // success
  if (['approved', 'closed_approved', 'complete', 'completed', 'resolved', 'on_track', 'on-track', 'distribute', 'paid', 'answered'].includes(k)) return 'success'
  // warning
  if (['pending', 'awaiting', 'submitted', 'returned', 'resubmit', 'in_review', 'under_review', 'review_in_progress', 'medium'].includes(k)) return 'warning'
  // danger
  if (['overdue', 'rejected', 'critical', 'blocked', 'failed', 'error', 'late'].includes(k)) return 'danger'
  // high
  if (['high', 'at_risk', 'at-risk', 'slip_risk', 'warning'].includes(k)) return 'high'
  // iris / AI
  if (['draft', 'iris_drafted', 'iris', 'gc_review', 'sent_to_reviewer', 'architect_review', 'preflight'].includes(k)) return 'iris'
  // info
  if (['in_progress', 'in-progress', 'open', 'active', 'started'].includes(k)) return 'info'
  // neutral fallback (closed, void, archived, draft-of-removed-type, etc.)
  return 'neutral'
}

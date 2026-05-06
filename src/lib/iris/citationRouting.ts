/**
 * Citation routing table — kind → deep link + side-panel component.
 *
 * Single source of truth for the IRIS_CITATIONS_SPEC. Both the
 * server-side resolver and the client-side renderer read from this
 * table. New citation kind = new row here = both ends pick it up.
 *
 * Reference: docs/audits/IRIS_CITATIONS_SPEC_2026-05-04.md § Phase 1
 *            docs/audits/ADR_004_CITATION_SIDE_PANEL_2026-05-04.md
 */

import type { DraftedActionCitation } from '../../types/draftedActions'

export type CitationKind = DraftedActionCitation['kind']

export interface CitationRoute {
  /** Human-readable label for the kind (used in panel headers and a11y). */
  label: string
  /**
   * Build a full-page deep link for "open in full page" inside the panel.
   * Receives the citation's `ref` and any additional payload (drawing
   * coords, spec anchor, etc.).
   */
  buildDeepLink: (ref: string, citation: DraftedActionCitation) => string
}

export const CITATION_ROUTES: Record<CitationKind, CitationRoute> = {
  rfi_reference: {
    label: 'RFI',
    buildDeepLink: (ref) => `/rfis/${ref}`,
  },
  daily_log_excerpt: {
    label: 'Daily log',
    buildDeepLink: (ref) => `/daily-logs/${ref}`,
  },
  drawing_coordinate: {
    label: 'Drawing',
    buildDeepLink: (ref, c) => {
      if (typeof c.x === 'number' && typeof c.y === 'number') {
        return `/drawings/${ref}?pin=${c.x},${c.y}`
      }
      return `/drawings/${ref}`
    },
  },
  photo_observation: {
    label: 'Photo',
    buildDeepLink: (ref) => `/photos/${ref}`,
  },
  spec_reference: {
    label: 'Spec',
    buildDeepLink: (ref) => `/specs/${ref}`,
  },
  schedule_phase: {
    label: 'Schedule',
    buildDeepLink: (ref) => `/schedule?phase=${ref}`,
  },
  budget_line: {
    label: 'Budget line',
    buildDeepLink: (ref) => `/budget?line=${ref}`,
  },
  change_order: {
    label: 'Change order',
    buildDeepLink: (ref) => `/change-orders/${ref}`,
  },
}

/** Compile-time exhaustiveness check — fails to typecheck if a kind is missing. */
const ALL_KINDS: ReadonlyArray<CitationKind> = [
  'rfi_reference',
  'daily_log_excerpt',
  'drawing_coordinate',
  'photo_observation',
  'spec_reference',
  'schedule_phase',
  'budget_line',
  'change_order',
]

export function isCitationKind(value: string): value is CitationKind {
  return (ALL_KINDS as readonly string[]).includes(value)
}

export function citationLabel(kind: CitationKind): string {
  return CITATION_ROUTES[kind].label
}

export function citationDeepLink(c: DraftedActionCitation): string | null {
  if (!c.ref) return null
  return CITATION_ROUTES[c.kind].buildDeepLink(c.ref, c)
}

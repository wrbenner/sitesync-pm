// Phase 5 — Spec-section entry handler.
//
// When a user clicks a spec section (in the spec book viewer or in any
// component that surfaces a spec citation), this handler builds a draft
// pre-filled from the section number / paragraph / pdf page / inferred
// kind, then opens the unified create modal.
//
// Phase 5 ships the handler shape; the spec-book viewer wiring (the click
// target) lands as part of the spec importer work in Phase 5b. The handler
// is exported as a pure function so any caller (page, voice, command-K)
// can seed the modal the same way.

import { buildDraftFromSpec, type SubmittalDraft } from '../../../../services/iris/submittalDraft'
import type { SubmittalKind } from '../../../../types/submittal'

export interface SpecEntryInput {
  csi_section: string
  spec_section_paragraph?: string | null
  spec_pdf_page?: number | null
  /** When the spec heading text mentions a known kind, pre-fill it. */
  inferred_kind?: SubmittalKind | null
  /** First 80 chars of the spec heading (used as the default title). */
  inferred_title?: string | null
}

/**
 * Pure-function entry-method seed. Returns the draft the caller passes to
 * `<UnifiedCreateModal initialDraft={...} initialTier="full" />`.
 */
export function seedDraftFromSpec(input: SpecEntryInput): SubmittalDraft {
  return buildDraftFromSpec(input)
}

/** Best-effort inference of a SubmittalKind from a spec heading text.
 *  Used when the caller doesn't explicitly know the kind. */
export function inferKindFromSpecHeading(heading: string): SubmittalKind | null {
  const h = heading.toLowerCase()
  if (h.includes('shop drawing') || h.includes('drawings')) return 'shop_drawing'
  if (h.includes('product data') || h.includes('cut sheet')) return 'product_data'
  if (h.includes('sample')) return 'sample'
  if (h.includes('mock-up') || h.includes('mockup')) return 'mockup'
  if (h.includes('test report') || h.includes('test data')) return 'test_report'
  if (h.includes('certification') || h.includes('certificate')) return 'certification'
  if (h.includes('warranty')) return 'warranty'
  if (h.includes('closeout') || h.includes('close-out')) return 'closeout'
  if (h.includes('coordination drawing')) return 'coordination_drawing'
  if (h.includes('maintenance')) return 'maintenance'
  if (h.includes('leed')) return 'leed_credit'
  return null
}

/**
 * Spec PDF extractor — pure interfaces.
 *
 * The actual LLM call lives in supabase/functions/extract-spec-pdf. This
 * module declares the result schema and a no-op shaper so unit tests can
 * verify the gate without hitting an LLM.
 */

import type { ExtractionResult, GatedResult } from './confidenceGate'
import { gate } from './confidenceGate'

export interface SpecPdfPayload {
  spec_section: string
  title: string
  reference_standards: string[]
  product_substitutions_allowed: boolean
  acceptance_criteria: string[]
}

export type SpecPdfExtractionResult = ExtractionResult<SpecPdfPayload>
export type GatedSpecPdfResult = GatedResult<SpecPdfPayload>

export function processSpecPdfExtraction(raw: SpecPdfExtractionResult): GatedSpecPdfResult {
  return gate(raw)
}

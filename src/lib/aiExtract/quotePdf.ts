/**
 * Quote PDF extractor — pure interfaces.
 */

import type { ExtractionResult, GatedResult } from './confidenceGate'
import { gate } from './confidenceGate'

export interface QuotePdfPayload {
  vendor: string
  date: string
  total_amount: number
  line_items: Array<{ description: string; qty: number; unit_price: number; subtotal: number }>
  validity_days?: number
}

export type QuotePdfExtractionResult = ExtractionResult<QuotePdfPayload>
export type GatedQuotePdfResult = GatedResult<QuotePdfPayload>

export function processQuotePdfExtraction(raw: QuotePdfExtractionResult): GatedQuotePdfResult {
  return gate(raw)
}

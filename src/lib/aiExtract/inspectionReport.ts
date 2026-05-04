/**
 * Inspection report extractor — pure interfaces.
 */

import type { ExtractionResult, GatedResult } from './confidenceGate'
import { gate } from './confidenceGate'

export interface InspectionReportPayload {
  inspection_type: string
  date: string
  inspector_name: string
  result: 'pass' | 'fail' | 'conditional'
  deficiencies: Array<{ description: string; location?: string; severity: 'low' | 'medium' | 'high' }>
}

export type InspectionReportExtractionResult = ExtractionResult<InspectionReportPayload>
export type GatedInspectionReportResult = GatedResult<InspectionReportPayload>

export function processInspectionReportExtraction(
  raw: InspectionReportExtractionResult,
): GatedInspectionReportResult {
  return gate(raw)
}

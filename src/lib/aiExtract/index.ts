/**
 * Public surface of the AI extract lib.
 */
export { gate, GATE_THRESHOLDS } from './confidenceGate'
export type { GateStatus, ExtractionResult, GatedResult } from './confidenceGate'
export { processSpecPdfExtraction } from './specPdf'
export type { SpecPdfPayload, SpecPdfExtractionResult, GatedSpecPdfResult } from './specPdf'
export { processInspectionReportExtraction } from './inspectionReport'
export type {
  InspectionReportPayload,
  InspectionReportExtractionResult,
  GatedInspectionReportResult,
} from './inspectionReport'
export { processQuotePdfExtraction } from './quotePdf'
export type { QuotePdfPayload, QuotePdfExtractionResult, GatedQuotePdfResult } from './quotePdf'

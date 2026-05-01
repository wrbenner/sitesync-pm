/**
 * Walk-Through Mode — public lib surface.
 *
 * Re-exports only. Components import from this barrel so we can refactor
 * internals without churning callsites.
 */

export {
  classifySeverity,
} from './severityClassifier'
export type { SeverityClassification } from './severityClassifier'

export {
  parseTranscriptToCapture,
  transcribeAudio,
} from './voiceParser'
export type {
  ParseTranscriptOptions,
  ParseTranscriptResult,
  TranscribeAudioOptions,
  TranscribeAudioResult,
} from './voiceParser'

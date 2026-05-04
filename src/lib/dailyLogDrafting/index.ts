// ── Daily Log Drafting — public surface ────────────────────────────────────
// One import per consumer. The edge function imports `assembleDailyLogDraft`
// and `inferCostCode` directly from sub-modules; the SPA imports from here.

export { assembleDailyLogDraft, stripPii, type AssembleOptions } from './sections';
export { inferCostCode, type CostCodeInference } from './costCodeInferer';
export { captionPhotos, type PhotoToCaption, type CaptionResult } from './photoCaption';

/**
 * evals/iris/types.ts — shared types for the Iris promptfoo eval pipeline.
 *
 * Why this file exists: promptfoo's custom-provider + custom-assert hooks
 * receive untyped JS values, so we route everything through these types
 * to keep the corpus, the provider response, and the per-row assertions
 * type-safe. When the corpus shape changes, this file is the single
 * place that breaks the build.
 *
 * Reference: docs/audits/IRIS_EVAL_PIPELINE_SPEC_2026-05-08.md
 */

import type { DraftedActionType, DraftedActionCitation } from '../../src/types/draftedActions'

/** Citation kinds the corpus may declare as expected for a row. */
export type ExpectedCitationKind = DraftedActionCitation['kind']

/**
 * One row of the eval corpus. Either synthetic (generated from voice rules
 * and citation kinds) or hand-edited (from the Days 43–49 cycle). The
 * schema is stable across both — promotion from synthetic → hand-edited
 * means filling in `groundTruthOutput` with a real PM-edited string.
 */
export interface EvalCorpusRow {
  /** Stable, human-meaningful row id. e.g. "rfi.draft__no-em-dash__01" */
  id: string
  /** The action_type the iris-call should produce. */
  actionType: DraftedActionType
  /**
   * Source — `synthetic` rows are built by `scripts/build-iris-corpus.ts`
   * from the voice rules. `hand_edit` rows come from real Iris drafts
   * that a PM corrected. Both go through the same asserts.
   */
  source: 'synthetic' | 'hand_edit'
  /**
   * Confidence band the synthetic row simulates (0=lowest..4=highest).
   * Drives prompt difficulty so the corpus stratifies coverage. Real
   * hand-edit rows record the original draft's `confidence` here.
   */
  confidenceBucket: 0 | 1 | 2 | 3 | 4
  /** Free-text user prompt sent to iris-call. */
  prompt: string
  /** Optional system prompt override. */
  system?: string
  /**
   * Project + entity context — synthetic rows leave this undefined so
   * the eval doesn't require a populated project. Hand-edit rows
   * include the original draft's project/entity for full-fidelity replay.
   */
  projectId?: string
  entityType?: string
  entityId?: string
  /** Expected output behavior. */
  expected: {
    /**
     * Voice rules that MUST pass. The voice assert calls `lintVoice()`
     * with the row's actionType; if any of these rules fires, the
     * assert fails for that row. Empty array means "all rules must
     * pass" (the strict mode used for hand-edit rows).
     */
    voiceRuleIds: string[]
    /**
     * Citation kinds that should appear in the response (when the
     * response shape supports citations). Synthetic rows assert
     * "at least one of these kinds present"; the citations assert
     * skips the check when this list is empty.
     */
    citationKinds: ExpectedCitationKind[]
    /**
     * Action-shape constraints. Each is checked by the action assert
     * against the parsed structured response. Constraints are AND-ed.
     */
    actionShape: ActionShapeAssertion
  }
  /**
   * Hand-edit-only: the PM-corrected text. When present, the action
   * assert can compute a per-row similarity score; when absent, only
   * structural shape and voice are checked.
   */
  groundTruthOutput?: string
}

/**
 * Structural assertions on the iris-call response. Each maps to a check
 * in `evals/iris/asserts/action.ts`; missing keys mean "skip that check
 * for this row." Two-shape design: the response is either a free-text
 * draft (action_type drives length cap) or a structured action payload
 * (the executor expects it).
 */
export interface ActionShapeAssertion {
  /** Word-count caps. min defaults to 1 when undefined. */
  maxWords?: number
  minWords?: number
  /** Substrings the output MUST contain (case-insensitive). */
  mustContain?: string[]
  /** Substrings the output MUST NOT contain (case-insensitive). */
  mustNotContain?: string[]
  /**
   * Daily-log-only: number of bullet sections expected. The G701
   * 5-section convention (manpower / weather / activities / issues /
   * tomorrow) lives in `project_tab_a_daily_log_draft` per memory.
   */
  bulletSectionCount?: number
}

/** Shape produced by the promptfoo custom provider. */
export interface IrisProviderOutput {
  /** Final text after voice linting (the user-visible text). */
  output: string
  /** Optional structured payload for action_types that produce JSON. */
  actionPayload?: unknown
  /** Citations the model emitted (when available). */
  citations: DraftedActionCitation[]
  /** Tokens / latency / model from the iris-call done event. */
  meta: {
    inputTokens: number
    outputTokens: number
    latencyMs: number
    provider: string
    model: string
    auditId: string
  }
}

/** Aggregated metrics produced by `scripts/check-iris-eval.ts`. */
export interface IrisEvalSummary {
  totalRows: number
  passedRows: number
  irisEvalPassRate: number
  irisVoiceLintPassRate: number
  irisCitationResolveRate: number
  perRowResults: Array<{
    id: string
    passed: boolean
    voicePassed: boolean
    citationsPassed: boolean
    actionPassed: boolean
    failureReasons: string[]
  }>
}

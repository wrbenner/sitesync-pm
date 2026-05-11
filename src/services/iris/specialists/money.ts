// ────────────────────────────────────────────────────────────────────────────
// Money specialist — Phase 2b, ADR-018 conformant
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md (Money §)
// ADR: docs/audits/ADR_018_SPECIALIST_BOUNDARY_CONTRACT_2026-05-08.md
// Sprint invariant #2: all money math through src/types/money.ts.
//
// The Money specialist owns dollar-aware drafts (CO narratives, pay-app
// cover letters, lien-waiver explainers). The LLM scope is `narrative_only`:
// the model writes prose around facts the deterministic check produced.
// The model NEVER computes or restates a dollar value that wasn't fed in.
//
// Boundary (per ADR-018):
//   - Deterministic check: all amounts are Cents (integer), source rows
//     exist, claimed totals reconcile against the priceChangeOrder()
//     calculation.
//   - LLM scope: narrative_only — Haiku model tier (cheap, fast).
//   - Write scope: NONE. The co_pricing_attach_executor (Phase 2e or
//     follow-up) ratifies.
//   - Tool allow-list: verify_money_math + cite_change_order + cite_budget_line.
//   - Audit fields: BASE + co_id + claimed_total_cents + calculated_total_cents +
//     reconciliation_matches.

import type { Cents } from '../../../types/money'
import type { IrisContext } from '../types/context'
import {
  priceChangeOrder,
  reconcileTotal,
  type CoPricingBreakdownCents,
  type CoPricingInputCents,
  type LineItemCents,
} from '../co-pricing'

import {
  assertAuditFieldsComplete,
  BASE_AUDIT_FIELDS,
  type DeterministicResult,
  type SpecialistDecl,
} from './types'

export interface MoneyInput {
  /** Change-order identifier (for audit-row + citation linkage). */
  co_id: string
  /** Pricing inputs in cents (already validated as integers). */
  pricing: CoPricingInputCents
  /** Optional claimed total (when reconciling against a sub's submission). */
  claimed_total_cents?: Cents
}

const MONEY_VERSION = '0.1.0' as const
const MONEY_PROMPT_VERSION = 'phase-2b.0' as const

function isIntegerCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)
}

function validateLineItemCents(item: LineItemCents, idx: number, blockers: string[]): void {
  if (!isIntegerCents(item.unit_cost)) {
    blockers.push(`line_items[${idx}].unit_cost must be integer Cents (got ${typeof item.unit_cost})`)
  }
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
    blockers.push(`line_items[${idx}].quantity must be > 0 (got ${item.quantity})`)
  }
  if (item.markup_rate != null && (item.markup_rate < 0 || item.markup_rate > 5)) {
    blockers.push(
      `line_items[${idx}].markup_rate ${item.markup_rate} outside sane bounds [0, 5]`,
    )
  }
}

export function moneyDeterministicCheck(
  input: MoneyInput,
  _ctx: IrisContext,
): DeterministicResult {
  const blockers: string[] = []
  const warnings: string[] = []

  if (!input.co_id) blockers.push('co_id is required (audit linkage)')

  if (!input.pricing || !Array.isArray(input.pricing.line_items)) {
    blockers.push('pricing.line_items must be an array')
  } else if (input.pricing.line_items.length === 0) {
    blockers.push('pricing.line_items cannot be empty — at least one line required')
  } else {
    input.pricing.line_items.forEach((item, i) => validateLineItemCents(item, i, blockers))
  }

  const rateChecks: Array<[string, number | undefined]> = [
    ['overhead_rate', input.pricing?.overhead_rate],
    ['bond_rate', input.pricing?.bond_rate],
    ['insurance_rate', input.pricing?.insurance_rate],
    ['sub_fee_rate', input.pricing?.sub_fee_rate],
    ['gc_fee_rate', input.pricing?.gc_fee_rate],
  ]
  for (const [field, value] of rateChecks) {
    if (value != null && (value < 0 || value > 1)) {
      blockers.push(`pricing.${field} ${value} outside sane bounds [0, 1]`)
    }
  }

  if (input.claimed_total_cents != null && !isIntegerCents(input.claimed_total_cents)) {
    blockers.push('claimed_total_cents must be integer Cents when provided')
  }

  // If everything passes structural checks AND a claimed total was provided,
  // reconcile against the deterministic calculation. A mismatch is a WARNING
  // rather than a blocker: the Money specialist's job is to surface the
  // mismatch in the narrative — but only if it has clean inputs to compute.
  if (blockers.length === 0 && input.claimed_total_cents != null && input.pricing) {
    const breakdown = priceChangeOrder(input.pricing)
    const { matches, diff } = reconcileTotal(input.claimed_total_cents, breakdown)
    if (!matches) {
      warnings.push(
        `Claimed total ${input.claimed_total_cents}¢ differs from calculation ${breakdown.total}¢ by ${diff}¢`,
      )
    }
  }

  return {
    ok: blockers.length === 0,
    blockers: blockers.length ? blockers : undefined,
    warnings: warnings.length ? warnings : undefined,
  }
}

/**
 * Compute the full CO breakdown for a Money invocation. The Money specialist's
 * dispatch path calls this BEFORE handing off to the LLM, then passes the
 * resulting numbers into the prompt as deterministic facts.
 */
export function computeMoneyFacts(input: MoneyInput): CoPricingBreakdownCents {
  return priceChangeOrder(input.pricing)
}

export const MONEY_DECL: SpecialistDecl<MoneyInput> = {
  name: 'money',
  version: MONEY_VERSION,
  deterministicCheck: moneyDeterministicCheck,
  llmScope: 'narrative_only',
  modelTier: 'haiku',
  promptVersion: MONEY_PROMPT_VERSION,
  // Money is read-only here. co_pricing_attach_executor ratifies (Phase 2e).
  writeScope: [],
  latencyBudgetMs: { p50: 2000, p95: 4000 },
  auditFields: [
    ...BASE_AUDIT_FIELDS,
    'co_id',
    'claimed_total_cents',
    'calculated_total_cents',
    'reconciliation_matches',
  ],
  toolAllowList: ['verify_money_math', 'cite_change_order', 'cite_budget_line'],
}

assertAuditFieldsComplete(MONEY_DECL)

export function moneyShouldRun(input: MoneyInput, ctx: IrisContext): DeterministicResult {
  return moneyDeterministicCheck(input, ctx)
}

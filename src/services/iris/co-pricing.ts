// ────────────────────────────────────────────────────────────────────────────
// co-pricing — deterministic change-order math for the Money specialist
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md (Money §)
// Sprint invariant #2 (CLAUDE.md): all money math through src/types/money.ts.
//
// This module is intentionally pure (no DB, no LLM). The Money specialist
// supplies these primitives as the deterministic check + the source-of-truth
// numbers the narrative-only LLM wraps prose around. Every operation accepts
// Cents and returns Cents; the LLM never sees floats.

import {
  addCents,
  applyRateCents,
  multiplyCents,
  subtractCents,
  toCents,
  type Cents,
} from '../../types/money'

export interface LineItemCents {
  description: string
  unit_cost: Cents
  quantity: number
  // Optional markup as a decimal — 0.15 = 15% above unit_cost*quantity.
  markup_rate?: number
}

export interface CoPricingInputCents {
  // Direct labor + materials lines (sub T&M, GC self-perform, etc.).
  line_items: readonly LineItemCents[]
  // Optional bond/insurance/overhead applied AFTER line subtotal.
  overhead_rate?: number
  bond_rate?: number
  insurance_rate?: number
  // Optional sub fee on top of subtotal (e.g. 5% sub markup on a flow-through CO).
  sub_fee_rate?: number
  // Optional GC fee on top of (subtotal + overhead + bond + insurance + sub_fee).
  gc_fee_rate?: number
}

export interface CoPricingBreakdownCents {
  line_subtotal: Cents
  overhead: Cents
  bond: Cents
  insurance: Cents
  sub_fee: Cents
  gc_fee: Cents
  total: Cents
}

export function priceChangeOrder(input: CoPricingInputCents): CoPricingBreakdownCents {
  const lineSubtotal = input.line_items.reduce((acc, item) => {
    const baseLine = multiplyCents(item.unit_cost, item.quantity)
    const lineWithMarkup =
      item.markup_rate && item.markup_rate > 0
        ? addCents(baseLine, applyRateCents(baseLine, item.markup_rate))
        : baseLine
    return addCents(acc, lineWithMarkup)
  }, toCents(0))

  const overhead = input.overhead_rate
    ? applyRateCents(lineSubtotal, input.overhead_rate)
    : toCents(0)
  const bond = input.bond_rate ? applyRateCents(lineSubtotal, input.bond_rate) : toCents(0)
  const insurance = input.insurance_rate
    ? applyRateCents(lineSubtotal, input.insurance_rate)
    : toCents(0)
  const subFee = input.sub_fee_rate
    ? applyRateCents(lineSubtotal, input.sub_fee_rate)
    : toCents(0)

  const beforeGc = addCents(
    addCents(addCents(addCents(lineSubtotal, overhead), bond), insurance),
    subFee,
  )
  const gcFee = input.gc_fee_rate ? applyRateCents(beforeGc, input.gc_fee_rate) : toCents(0)
  const total = addCents(beforeGc, gcFee)

  return {
    line_subtotal: lineSubtotal,
    overhead,
    bond,
    insurance,
    sub_fee: subFee,
    gc_fee: gcFee,
    total,
  }
}

/**
 * Reconcile a claimed CO total against a deterministic re-calculation.
 * Used by the Money specialist's deterministic check to verify the LLM
 * narrative cites the correct number. Returns the difference in cents
 * (positive = claim exceeds calculation).
 */
export function reconcileTotal(claimedTotalCents: Cents, breakdown: CoPricingBreakdownCents): {
  matches: boolean
  diff: Cents
} {
  const diff = subtractCents(claimedTotalCents, breakdown.total)
  return { matches: diff === 0, diff }
}

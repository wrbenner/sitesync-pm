// ────────────────────────────────────────────────────────────────────────────
// Money specialist tests — Phase 2b
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md (Money §)
// ADR-018 — Money has 100% deterministic-check coverage.
// Sprint invariant #2 — all math through src/types/money.ts (Cents).

import { describe, expect, it } from 'vitest'

import { toCents } from '../../../../types/money'
import { priceChangeOrder, reconcileTotal } from '../../co-pricing'
import {
  MONEY_DECL,
  computeMoneyFacts,
  moneyDeterministicCheck,
  type MoneyInput,
} from '../money'
import { buildContext } from '../../contextFabric'

function emptyContext() {
  const { context } = buildContext({
    user_id: 'u',
    org_id: 'org',
    project_id: 'project-avery-oaks',
    current_page: '/change-orders/CO-007',
    entity_type: 'change_order',
    entity_id: 'CO-007',
    invocation_intent: 'verify_math',
  })
  return context
}

function healthyInput(overrides: Partial<MoneyInput> = {}): MoneyInput {
  return {
    co_id: 'CO-007',
    pricing: {
      line_items: [
        { description: 'T&M crew', unit_cost: toCents(8500), quantity: 16 },
        { description: 'Materials', unit_cost: toCents(120000), quantity: 1 },
      ],
      overhead_rate: 0.1,
      bond_rate: 0.012,
      sub_fee_rate: 0.05,
    },
    ...overrides,
  }
}

describe('MONEY_DECL — ADR-018 boundary conformance', () => {
  it('declares the canonical specialist shape', () => {
    expect(MONEY_DECL.name).toBe('money')
    expect(MONEY_DECL.llmScope).toBe('narrative_only')
    expect(MONEY_DECL.modelTier).toBe('haiku')
    expect(MONEY_DECL.writeScope).toEqual([])
  })

  it('audit fields include co_id, claimed_total_cents, calculated_total_cents, reconciliation_matches', () => {
    const declared = new Set(MONEY_DECL.auditFields)
    expect(declared.has('co_id')).toBe(true)
    expect(declared.has('claimed_total_cents')).toBe(true)
    expect(declared.has('calculated_total_cents')).toBe(true)
    expect(declared.has('reconciliation_matches')).toBe(true)
  })

  it('tool allow-list is narrow (3 entries)', () => {
    expect(MONEY_DECL.toolAllowList).toHaveLength(3)
    expect(MONEY_DECL.toolAllowList).toContain('verify_money_math')
  })

  it('latency budget is tighter than Drafter (Haiku is fast)', () => {
    expect(MONEY_DECL.latencyBudgetMs.p95).toBeLessThan(5000)
  })
})

describe('moneyDeterministicCheck — gate decisions', () => {
  const ctx = emptyContext()

  it('passes a healthy CO input', () => {
    const result = moneyDeterministicCheck(healthyInput(), ctx)
    expect(result.ok).toBe(true)
    expect(result.blockers).toBeUndefined()
  })

  it('blocks when co_id is missing', () => {
    const result = moneyDeterministicCheck(healthyInput({ co_id: '' }), ctx)
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b: string) => b.includes('co_id'))).toBe(true)
  })

  it('blocks empty line_items', () => {
    const input = healthyInput({
      pricing: { line_items: [] },
    })
    const result = moneyDeterministicCheck(input, ctx)
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b: string) => b.includes('empty'))).toBe(true)
  })

  it('blocks line item with non-integer unit_cost (Sprint Invariant #2)', () => {
    const input = healthyInput({
      pricing: {
        // intentionally float; bypassing the brand to simulate dirty input
        line_items: [
          { description: 'X', unit_cost: 19.99 as unknown as ReturnType<typeof toCents>, quantity: 1 },
        ],
      },
    })
    const result = moneyDeterministicCheck(input, ctx)
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b: string) => b.includes('integer Cents'))).toBe(true)
  })

  it('blocks line item with quantity <= 0', () => {
    const input = healthyInput({
      pricing: {
        line_items: [{ description: 'X', unit_cost: toCents(100), quantity: 0 }],
      },
    })
    const result = moneyDeterministicCheck(input, ctx)
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b: string) => b.includes('quantity'))).toBe(true)
  })

  it('blocks markup_rate outside [0, 5]', () => {
    const input = healthyInput({
      pricing: {
        line_items: [
          { description: 'X', unit_cost: toCents(100), quantity: 1, markup_rate: 99 },
        ],
      },
    })
    const result = moneyDeterministicCheck(input, ctx)
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b: string) => b.includes('markup_rate'))).toBe(true)
  })

  it('blocks overhead_rate outside [0, 1]', () => {
    const input = healthyInput({
      pricing: {
        line_items: [{ description: 'X', unit_cost: toCents(100), quantity: 1 }],
        overhead_rate: 1.5,
      },
    })
    const result = moneyDeterministicCheck(input, ctx)
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b: string) => b.includes('overhead_rate'))).toBe(true)
  })

  it('blocks non-integer claimed_total_cents', () => {
    const input = healthyInput({
      // intentionally float; cast via unknown to test the gate
      claimed_total_cents: 199.99 as unknown as ReturnType<typeof toCents>,
    })
    const result = moneyDeterministicCheck(input, ctx)
    expect(result.ok).toBe(false)
    expect(result.blockers?.some((b: string) => b.includes('claimed_total_cents'))).toBe(true)
  })

  it('emits a warning when claimed total mismatches calculation (not a blocker)', () => {
    const input = healthyInput({ claimed_total_cents: toCents(1) })
    const result = moneyDeterministicCheck(input, ctx)
    expect(result.ok).toBe(true)
    expect(result.warnings?.some((w: string) => w.includes('Claimed total'))).toBe(true)
  })

  it('emits no warning when claimed total matches calculation', () => {
    const facts = computeMoneyFacts(healthyInput())
    const result = moneyDeterministicCheck(
      healthyInput({ claimed_total_cents: facts.total }),
      ctx,
    )
    expect(result.ok).toBe(true)
    expect(result.warnings).toBeUndefined()
  })
})

describe('priceChangeOrder + reconcileTotal — deterministic math', () => {
  it('computes a CO with overhead + bond + sub_fee', () => {
    // T&M: 8500¢ × 16 = 136,000¢ ; Materials: 120,000¢ ; Subtotal: 256,000¢
    // overhead 10%: 25,600¢ ; bond 1.2%: 3,072¢ ; sub_fee 5%: 12,800¢
    // Total: 256,000 + 25,600 + 3,072 + 12,800 = 297,472¢
    const result = priceChangeOrder({
      line_items: [
        { description: 'T&M crew', unit_cost: toCents(8500), quantity: 16 },
        { description: 'Materials', unit_cost: toCents(120000), quantity: 1 },
      ],
      overhead_rate: 0.1,
      bond_rate: 0.012,
      sub_fee_rate: 0.05,
    })
    expect(result.line_subtotal).toBe(256_000)
    expect(result.overhead).toBe(25_600)
    expect(result.bond).toBe(3_072)
    expect(result.sub_fee).toBe(12_800)
    expect(result.total).toBe(297_472)
  })

  it('compounds gc_fee on top of (subtotal + overhead + bond + insurance + sub_fee)', () => {
    const result = priceChangeOrder({
      line_items: [{ description: 'flat', unit_cost: toCents(100_000), quantity: 1 }],
      gc_fee_rate: 0.05,
    })
    expect(result.line_subtotal).toBe(100_000)
    expect(result.gc_fee).toBe(5_000)
    expect(result.total).toBe(105_000)
  })

  it('applies line-item markup before line_subtotal aggregation', () => {
    const result = priceChangeOrder({
      line_items: [
        { description: 'with-markup', unit_cost: toCents(1000), quantity: 10, markup_rate: 0.15 },
      ],
    })
    expect(result.line_subtotal).toBe(11_500) // 10000 * 1.15
  })

  it('reconcileTotal returns matches=true on equal cents', () => {
    const breakdown = priceChangeOrder({
      line_items: [{ description: 'x', unit_cost: toCents(500), quantity: 2 }],
    })
    const { matches, diff } = reconcileTotal(toCents(1000), breakdown)
    expect(matches).toBe(true)
    expect(diff).toBe(0)
  })

  it('reconcileTotal returns diff when amounts differ', () => {
    const breakdown = priceChangeOrder({
      line_items: [{ description: 'x', unit_cost: toCents(500), quantity: 2 }],
    })
    const { matches, diff } = reconcileTotal(toCents(1500), breakdown)
    expect(matches).toBe(false)
    expect(diff).toBe(500)
  })
})

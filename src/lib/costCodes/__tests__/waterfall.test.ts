/**
 * Cost-code waterfall tests.
 *
 * Verify the budget → CO → committed → invoiced → paid → balance lineage
 * is exact in integer cents, and that each over-committed/over-billed flag
 * trips at the correct gate.
 */

import { describe, it, expect } from 'vitest';
import {
  computeCostCodeWaterfall,
  computeCostCodeWaterfallBatch,
  totalsForWaterfall,
  type WaterfallInput,
} from '../waterfall';

const HAPPY_PATH: WaterfallInput = {
  costCode: '03-30',
  description: 'Concrete',
  originalBudget: 100_000,
  approvedChangeOrders: 5_000,
  committed: 95_000,
  invoiced: 50_000,
  paid: 45_000,
};

describe('computeCostCodeWaterfall', () => {
  it('produces the canonical 7-step lineage', () => {
    const out = computeCostCodeWaterfall(HAPPY_PATH);
    expect(out.steps.map(s => s.kind)).toEqual([
      'budget_origin',
      'change_order',
      'budget_revised',
      'committed',
      'invoiced',
      'paid',
      'balance',
    ]);
  });

  it('computes revisedBudget = original + approvedCO', () => {
    const out = computeCostCodeWaterfall(HAPPY_PATH);
    const revised = out.steps.find(s => s.kind === 'budget_revised')!;
    expect(revised.cents).toBe(10_500_000); // $105,000
  });

  it('balanceToPay = committed - paid', () => {
    const out = computeCostCodeWaterfall(HAPPY_PATH);
    expect(out.balanceToPayCents).toBe(5_000_000); // $95,000 − $45,000 = $50,000
  });

  it('uncommitted = revised - committed', () => {
    const out = computeCostCodeWaterfall(HAPPY_PATH);
    expect(out.uncommittedCents).toBe(1_000_000); // $105,000 − $95,000 = $10,000
  });

  it('unbilled = committed - invoiced', () => {
    const out = computeCostCodeWaterfall(HAPPY_PATH);
    expect(out.unbilledCents).toBe(4_500_000); // $95,000 − $50,000 = $45,000
  });

  it('receivable = invoiced - paid', () => {
    const out = computeCostCodeWaterfall(HAPPY_PATH);
    expect(out.receivableCents).toBe(500_000); // $50,000 − $45,000 = $5,000
  });

  it('flags isOverCommitted when committed > revised budget', () => {
    const out = computeCostCodeWaterfall({
      ...HAPPY_PATH,
      committed: 200_000, // > $105,000 revised
    });
    expect(out.isOverCommitted).toBe(true);
  });

  it('flags isOverBilled when invoiced > committed', () => {
    const out = computeCostCodeWaterfall({
      ...HAPPY_PATH,
      invoiced: 100_000, // > $95,000 committed
    });
    expect(out.isOverBilled).toBe(true);
  });

  it('handles a deductive change order (negative approvedCO)', () => {
    const out = computeCostCodeWaterfall({
      ...HAPPY_PATH,
      approvedChangeOrders: -10_000,
    });
    const revised = out.steps.find(s => s.kind === 'budget_revised')!;
    expect(revised.cents).toBe(9_000_000); // $90,000
  });

  it('idempotency — same input twice produces equal output', () => {
    const a = computeCostCodeWaterfall(HAPPY_PATH);
    const b = computeCostCodeWaterfall(HAPPY_PATH);
    expect(a).toEqual(b);
  });
});

describe('computeCostCodeWaterfallBatch + totalsForWaterfall', () => {
  it('aggregates across cost codes exactly', () => {
    const rows = computeCostCodeWaterfallBatch([
      HAPPY_PATH,
      { ...HAPPY_PATH, costCode: '04-20', description: 'Masonry' },
    ]);
    const t = totalsForWaterfall(rows);
    expect(t.originalBudgetCents).toBe(20_000_000);
    expect(t.approvedChangeOrdersCents).toBe(1_000_000);
    expect(t.revisedBudgetCents).toBe(21_000_000);
    expect(t.committedCents).toBe(19_000_000);
    expect(t.invoicedCents).toBe(10_000_000);
    expect(t.paidCents).toBe(9_000_000);
    expect(t.balanceToPayCents).toBe(10_000_000);
  });

  it('handles empty input cleanly', () => {
    const t = totalsForWaterfall([]);
    expect(t.originalBudgetCents).toBe(0);
    expect(t.balanceToPayCents).toBe(0);
  });
});

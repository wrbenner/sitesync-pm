/**
 * AIA G702/G703 Formula Conformance Tests.
 *
 * These tests pin the audited calculator against the AIA-published formula
 * contract. Each describe-block cites the spec section it verifies.
 *
 * SPEC SOURCE: AIA Document G702-2017 / G703-2017. The "synthetic example"
 * used as the end-to-end fixture is documented inline in
 * `it('matches the synthetic Application No. 5 worksheet exactly')` —
 * each line shows the math step-by-step so any auditor can replay it.
 */

import { describe, it, expect } from 'vitest';
import {
  computeG702Audited,
  type G702Input,
  type G703InputLine,
} from '../g702Audited';
import { computeG703Line, computeG703Lines } from '../g703Audited';

// ── Helpers ──────────────────────────────────────────────────

function line(
  id: string,
  sv: number,
  pct: number,
  prev: number,
  stored = 0,
  lineRetainagePct?: number,
): G703InputLine {
  return {
    id,
    itemNumber: id,
    description: `Line ${id}`,
    scheduledValue: sv,
    pctCompleteThisPeriod: pct,
    previouslyCompleted: prev,
    storedMaterials: stored,
    lineRetainagePct,
  };
}

function baseInput(lineItems: G703InputLine[], opts: Partial<G702Input> = {}): G702Input {
  return {
    applicationNumber: 1,
    periodTo: '2026-04-30',
    projectName: 'Test Project',
    contractorName: 'Test GC',
    originalContractSum: lineItems.reduce((s, l) => s + l.scheduledValue, 0),
    netChangeOrders: 0,
    retainagePct: 10,
    lessPreviousCertificates: 0,
    asOfDate: '2026-04-30',
    lineItems,
    ...opts,
  };
}

// ── 1. G703 line item formula (spec col G = SV × pct/100) ────

describe('G703 line item — work_completed_to_date = scheduled_value × (pct/100)', () => {
  it('computes work completed for a 50% line', () => {
    // SPEC: G703 col G with pct in col H. SV $100,000 × 50% = $50,000 = 5,000,000 cents.
    const r = computeG703Line(line('1', 100_000, 50, 0), 10);
    expect(r.workCompletedToDateCents).toBe(5_000_000);
  });

  it('rounds the line before summing into the rollup', () => {
    // SPEC: AIA requires line-level rounding. SV $33.33 × 33.33% = $11.10989 → $11.11.
    const r = computeG703Line(line('1', 33.33, 33.33, 0), 10);
    expect(r.workCompletedToDateCents).toBe(1111);
  });

  it('clamps pct < 0 to 0 and pct > 100 to 100', () => {
    const lo = computeG703Line(line('1', 100, -5, 0), 10);
    const hi = computeG703Line(line('2', 100, 105, 0), 10);
    expect(lo.workCompletedToDateCents).toBe(0);
    expect(hi.workCompletedToDateCents).toBe(10_000); // $100
  });
});

// ── 2. G703 stored materials separate column ─────────────────

describe('G703 stored materials — never multiplied by pct (spec col F)', () => {
  it('keeps stored as-is, then sums into "total completed and stored"', () => {
    // SPEC: G703 col F (stored) is independent of col D+E (work). Col G = D+E+F.
    const r = computeG703Line(line('1', 1000, 0, 0, 250), 10);
    expect(r.workCompletedToDateCents).toBe(0);
    expect(r.storedMaterialsCents).toBe(25_000);
    expect(r.totalCompletedAndStoredCents).toBe(25_000);
  });

  it('combines work-in-place and stored materials at 100%', () => {
    // 100% × $1000 = $1000 work; plus $200 stored = $1200 total.
    const r = computeG703Line(line('1', 1000, 100, 500, 200), 10);
    expect(r.totalCompletedAndStoredCents).toBe(120_000);
  });
});

// ── 3. G702 total earned to date (line 4) ────────────────────

describe('G702 line 4 — total completed and stored = Σ G703 col G', () => {
  it('sums rounded line totals exactly with no floating drift', () => {
    // SPEC: G702 line 4 must equal Σ of G703 col G to the cent.
    const lines = [
      line('1', 33.33, 33.33, 0), // → 1111¢
      line('2', 33.33, 33.33, 0), // → 1111¢
      line('3', 33.33, 33.33, 0), // → 1111¢
    ];
    const out = computeG702Audited(baseInput(lines));
    expect(out.totalCompletedAndStoredCents).toBe(3333);
    // If we summed floats first: 33.33*0.3333*3 = 33.32667 → drifts.
  });
});

// ── 4. G702 retainage (line 5) — flat rate ───────────────────

describe('G702 line 5 — retainage = (retainage_pct/100) × total_earned_to_date', () => {
  it('applies a 10% flat retainage on all completed work', () => {
    // SPEC: G702 line 5 = line 4 × retainage rate. $50,000 × 10% = $5000.
    const lines = [line('1', 100_000, 50, 0)];
    const out = computeG702Audited(baseInput(lines));
    expect(out.retainageCents).toBe(500_000);
  });

  it('honors per-line retainage when any line specifies one', () => {
    // SPEC: per-line retainage permitted (G703 col J). When set, sum the lines.
    const lines = [
      line('1', 1000, 100, 0, 0, 5),  // $1000 × 5% = $50
      line('2', 1000, 100, 0, 0, 10), // $1000 × 10% = $100
    ];
    const out = computeG702Audited(baseInput(lines));
    expect(out.retainageCents).toBe(15_000); // $150
  });
});

// ── 5. G702 retainage release on final pay app ───────────────

describe('G702 retainage release on final pay app', () => {
  it('zeros retainage when isFinalPayApp = true', () => {
    // SPEC: final pay app releases retainage — line 5 = 0.
    const lines = [line('1', 100_000, 100, 0)];
    const out = computeG702Audited(
      baseInput(lines, { isFinalPayApp: true, lessPreviousCertificates: 90_000 }),
    );
    expect(out.retainageCents).toBe(0);
    expect(out.totalEarnedLessRetainageCents).toBe(10_000_000);
    // $100k earned − $0 retainage − $90k previously paid = $10k due.
    expect(out.currentPaymentDueCents).toBe(1_000_000);
  });
});

// ── 6. G702 line 6 — total earned less retainage ─────────────

describe('G702 line 6 — total earned less retainage = line 4 − line 5', () => {
  it('subtracts retainage from total completed', () => {
    // SPEC: G702 line 6 = line 4 − line 5. $50,000 − $5,000 = $45,000.
    const lines = [line('1', 100_000, 50, 0)];
    const out = computeG702Audited(baseInput(lines));
    expect(out.totalEarnedLessRetainageCents).toBe(4_500_000);
  });
});

// ── 7. G702 line 7 — less previous certificates ──────────────

describe('G702 line 7 — sum of prior approved pay-app current_payment_due', () => {
  it('subtracts cumulative prior payments', () => {
    // SPEC: line 7 = Σ(prior pay app line 8). 3 prior pay apps at $10k each = $30k.
    const lines = [line('1', 100_000, 80, 70_000)];
    const out = computeG702Audited(
      baseInput(lines, { lessPreviousCertificates: 30_000 }),
    );
    expect(out.lessPreviousCertificatesCents).toBe(3_000_000);
  });
});

// ── 8. G702 line 8 — current payment due ─────────────────────

describe('G702 line 8 — current payment due = line 6 − line 7', () => {
  it('computes net payment from line 6 and line 7', () => {
    // $50k earned, 10% retainage = $5k, prior $30k → $50k − $5k − $30k = $15k.
    const lines = [line('1', 100_000, 50, 0)];
    const out = computeG702Audited(
      baseInput(lines, { lessPreviousCertificates: 30_000 }),
    );
    expect(out.currentPaymentDueCents).toBe(1_500_000);
  });
});

// ── 9. Idempotency ───────────────────────────────────────────

describe('idempotency — same input → same output, twice', () => {
  it('returns deeply equal output across two invocations', () => {
    const input = baseInput([
      line('1', 100_000, 50, 25_000, 5000),
      line('2', 50_000, 75, 30_000, 0),
    ], { lessPreviousCertificates: 50_000, retainagePct: 10 });
    const a = computeG702Audited(input);
    const b = computeG702Audited(input);
    expect(a).toEqual(b);
  });
});

// ── 10. Zero-pct lines ───────────────────────────────────────

describe('zero-percent lines', () => {
  it('emits zero work and zero retainage for unstarted lines', () => {
    const out = computeG702Audited(baseInput([line('1', 50_000, 0, 0)]));
    expect(out.totalCompletedAndStoredCents).toBe(0);
    expect(out.retainageCents).toBe(0);
    expect(out.totalEarnedLessRetainageCents).toBe(0);
    expect(out.currentPaymentDueCents).toBe(0);
  });
});

// ── 11. 100%-complete lines with stored materials ────────────

describe('100%-complete with stored materials', () => {
  it('totals work + stored together for the line', () => {
    // 100% × $1000 = $1000 work; $250 stored; total $1250.
    const lines = [line('1', 1000, 100, 750, 250)];
    const out = computeG702Audited(baseInput(lines));
    expect(out.lineItems[0].totalCompletedAndStoredCents).toBe(125_000);
    expect(out.totalCompletedAndStoredCents).toBe(125_000);
  });
});

// ── 12. Multi-pay-app history sum (line 7 cumulative) ────────

describe('cumulative line 7 across multiple historical pay apps', () => {
  it('correctly subtracts the running cumulative paid amount', () => {
    // Pay App 6: $200k earned, 10% retainage = $20k → $180k earned less ret.
    // Prior pay apps 1–5 cumulative net payment = $150k → due now = $30k.
    const lines = [line('1', 400_000, 50, 150_000, 0)];
    const out = computeG702Audited(
      baseInput(lines, {
        applicationNumber: 6,
        lessPreviousCertificates: 150_000,
        retainagePct: 10,
      }),
    );
    expect(out.totalEarnedLessRetainageCents).toBe(18_000_000);
    expect(out.currentPaymentDueCents).toBe(3_000_000);
  });
});

// ── 13. Net change orders (line 2) flow into line 3 ──────────

describe('G702 line 2 + line 3 — net change orders adjust contract sum', () => {
  it('adds approved CO total to original contract sum', () => {
    // Original $100k + net CO $25k = $125k contract sum to date.
    const lines = [line('1', 125_000, 0, 0)];
    const out = computeG702Audited(
      baseInput(lines, { originalContractSum: 100_000, netChangeOrders: 25_000 }),
    );
    expect(out.originalContractSumCents).toBe(10_000_000);
    expect(out.netChangeOrdersCents).toBe(2_500_000);
    expect(out.contractSumToDateCents).toBe(12_500_000);
  });

  it('handles a net deductive change order (negative)', () => {
    // Original $100k + net CO −$10k = $90k contract sum to date.
    const lines = [line('1', 90_000, 0, 0)];
    const out = computeG702Audited(
      baseInput(lines, { originalContractSum: 100_000, netChangeOrders: -10_000 }),
    );
    expect(out.contractSumToDateCents).toBe(9_000_000);
  });
});

// ── 14. Balance to finish (line 9) ───────────────────────────

describe('G702 line 9 — balance to finish including retainage', () => {
  it('= contract sum to date − total earned less retainage', () => {
    // SPEC: G702 line 9 = line 3 − line 6.
    // $100k contract − $45k earned-less-retainage = $55k balance.
    const lines = [line('1', 100_000, 50, 0)];
    const out = computeG702Audited(baseInput(lines));
    expect(out.balanceToFinishIncludingRetainageCents).toBe(5_500_000);
  });
});

// ── 15. Synthetic Application No. 5 worksheet — END-TO-END ──

describe('synthetic Application No. 5 worksheet (G702 + G703)', () => {
  /**
   * Defensible synthetic example. Math step-by-step:
   *
   * Schedule of Values (3 lines):
   *   Line A — Sitework         SV $200,000
   *   Line B — Concrete         SV $500,000
   *   Line C — Steel            SV $300,000
   *
   * Pay App #5 percent complete reported by GC:
   *   A — 100%   prev 95%   stored $0
   *   B —  60%   prev 50%   stored $25,000
   *   C —  40%   prev 25%   stored $0
   *
   * Original contract sum:  $1,000,000
   * Net CO to date:         +$50,000  (one approved CO)
   * Contract sum to date:   $1,050,000
   * Retainage:              10% flat
   * Less previous certs:    $300,000  (sum of pay apps 1–4 net payments)
   *
   * Line-by-line G703 calc (each rounded once):
   *   A: $200k × 100% = $200,000.00 work + $0 stored = $200,000.00 total
   *      retainage = $200,000 × 10% = $20,000.00
   *   B: $500k × 60%  = $300,000.00 work + $25,000.00 stored = $325,000.00
   *      retainage = $325,000 × 10% = $32,500.00
   *   C: $300k × 40%  = $120,000.00 work + $0 stored = $120,000.00
   *      retainage = $120,000 × 10% = $12,000.00
   *
   * G702 rollups:
   *   Line 4 — total completed & stored = 200,000 + 325,000 + 120,000 = $645,000
   *   Line 5 — retainage (flat 10% on $645,000)                       = $64,500
   *   Line 6 — total earned less retainage  = 645,000 − 64,500        = $580,500
   *   Line 7 — less previous certificates                             = $300,000
   *   Line 8 — current payment due          = 580,500 − 300,000       = $280,500
   *   Line 9 — balance to finish incl ret   = 1,050,000 − 580,500     = $469,500
   */
  const input = baseInput(
    [
      line('A', 200_000, 100, 190_000, 0),
      line('B', 500_000, 60, 250_000, 25_000),
      line('C', 300_000, 40, 75_000, 0),
    ],
    {
      applicationNumber: 5,
      originalContractSum: 1_000_000,
      netChangeOrders: 50_000,
      retainagePct: 10,
      lessPreviousCertificates: 300_000,
    },
  );
  const out = computeG702Audited(input);

  it('matches all G703 line totals', () => {
    expect(out.lineItems[0].totalCompletedAndStoredCents).toBe(20_000_000);
    expect(out.lineItems[1].totalCompletedAndStoredCents).toBe(32_500_000);
    expect(out.lineItems[2].totalCompletedAndStoredCents).toBe(12_000_000);
  });

  it('matches G702 line 4 — total completed and stored', () => {
    expect(out.totalCompletedAndStoredCents).toBe(64_500_000);
  });

  it('matches G702 line 5 — retainage', () => {
    expect(out.retainageCents).toBe(6_450_000);
  });

  it('matches G702 line 6 — total earned less retainage', () => {
    expect(out.totalEarnedLessRetainageCents).toBe(58_050_000);
  });

  it('matches G702 line 7 — less previous certificates', () => {
    expect(out.lessPreviousCertificatesCents).toBe(30_000_000);
  });

  it('matches G702 line 8 — current payment due', () => {
    expect(out.currentPaymentDueCents).toBe(28_050_000);
  });

  it('matches G702 line 9 — balance to finish including retainage', () => {
    expect(out.balanceToFinishIncludingRetainageCents).toBe(46_950_000);
  });
});

// ── 16. computeG703Lines wraps line iteration ────────────────

describe('computeG703Lines — convenience wrapper', () => {
  it('returns one row per input line, in order', () => {
    const out = computeG703Lines(
      [line('1', 100, 50, 0), line('2', 200, 25, 0)],
      10,
    );
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe('1');
    expect(out[1].id).toBe('2');
  });

  it('passes through isFinalPayApp to zero retainage', () => {
    const out = computeG703Lines([line('1', 1000, 100, 0, 0)], 10, true);
    expect(out[0].retainageCents).toBe(0);
  });
});

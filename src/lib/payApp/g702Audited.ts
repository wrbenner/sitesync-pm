/**
 * AIA G702 Audited Calculator — penny-exact, idempotent, deterministic.
 *
 * The G702 is the "summary" application form. Its line totals must equal the
 * sum of the underlying G703 line items, to the cent. This module contains
 * pure functions only — no I/O, no React, no Date.now(). Round-half-to-even
 * (banker's rounding) is used throughout to match AIA-published examples.
 *
 * SPEC SOURCE: AIA Document G702-2017 / G703-2017 — Application and Certificate
 * for Payment + Continuation Sheet. Each formula in this file is annotated
 * with the line number on the form it implements (e.g. G702 line 6 = retainage).
 *
 * Money discipline: amounts cross the I/O boundary as `number` (dollars), but
 * are converted to integer cents via `roundHalfEvenCents` immediately. All
 * internal arithmetic is in integer cents — never sum floats then round.
 */

// ── Money primitives ─────────────────────────────────────────

/**
 * Round-half-to-even (banker's rounding) of a dollar amount to integer cents.
 *
 * Default `Math.round` rounds half AWAY from zero, which produces .5-case
 * mismatches against AIA-published worked examples. This implementation:
 *   roundHalfEvenCents(0.005) === 0     (0 cents — round down to even)
 *   roundHalfEvenCents(0.015) === 0.02  (2 cents — round up to even)
 *   roundHalfEvenCents(0.025) === 0.02  (2 cents — round down to even)
 *   roundHalfEvenCents(0.035) === 0.04  (4 cents — round up to even)
 *
 * Returns the value as a dollar amount (e.g. 0.02), but the cents are exact.
 * Internal callers usually want `roundHalfEvenToCentsInt` instead.
 */
export function roundHalfEvenCents(value: number): number {
  return roundHalfEvenToCentsInt(value) / 100;
}

/** Round to integer cents using banker's rounding. */
export function roundHalfEvenToCentsInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  // Multiply by 100, then bank-round to the nearest integer.
  // Add a tiny epsilon to compensate for IEEE-754 representation drift on
  // values that should be exactly .5 in decimal but aren't in binary
  // (e.g. 0.015 * 100 = 1.4999999999999998 in JS).
  const scaled = value * 100;
  // Recover the "intended" half-cent boundary by checking proximity.
  const rounded = Math.round(scaled);
  const fracPart = scaled - Math.floor(scaled);
  // Only apply banker's tweak when we're at a .5 boundary (within float error).
  const isHalf =
    Math.abs(fracPart - 0.5) < 1e-9 ||
    Math.abs(scaled * 1e9 - Math.round(scaled * 1e9)) < 1 &&
      Math.abs(scaled - Math.floor(scaled) - 0.5) < 1e-9;
  if (isHalf) {
    const floor = Math.floor(scaled);
    // round to even
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return rounded;
}

/** Convert a dollar number into integer cents (banker-rounded once). */
export function dollarsToCents(value: number): number {
  return roundHalfEvenToCentsInt(value);
}

/** Convert integer cents back to dollar number. */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/** Sum integer-cent values exactly — no floats, no rounding drift. */
export function sumCents(values: number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

// ── G703 input shape ─────────────────────────────────────────

export interface G703InputLine {
  /** Stable per-line id; carried into output for traceability. */
  id: string;
  /** Item number on the SOV — usually a CSI code or sequential. */
  itemNumber: string;
  description: string;
  /** Original scheduled value, in dollars. */
  scheduledValue: number;
  /** Cumulative percent complete this period (0–100). */
  pctCompleteThisPeriod: number;
  /** Stored materials, in dollars (NOT multiplied by pct — separate column). */
  storedMaterials: number;
  /** Previously completed work, in dollars (cumulative through prior pay app). */
  previouslyCompleted: number;
  /** Optional per-line retainage rate 0–100; falls back to flat rate at G702 level. */
  lineRetainagePct?: number;
}

// ── G702 input shape ─────────────────────────────────────────

export interface G702Input {
  applicationNumber: number;
  /** ISO date — period through. */
  periodTo: string;
  projectName: string;
  contractorName: string;
  ownerName?: string;
  /** Original contract sum, dollars. */
  originalContractSum: number;
  /** Net change orders to date, dollars (signed). */
  netChangeOrders: number;
  /** Flat retainage rate 0–100; per-line lineRetainagePct overrides this. */
  retainagePct: number;
  /**
   * Sum of "current payment due" from all PRIOR APPROVED pay apps, in dollars.
   * The current pay app excludes itself.
   */
  lessPreviousCertificates: number;
  /** True only on the final pay app. When true, retainage = 0 (release). */
  isFinalPayApp?: boolean;
  /** ISO date string passed in for traceability — never read from system clock. */
  asOfDate: string;
  lineItems: G703InputLine[];
}

// ── Audited output shapes ────────────────────────────────────

export interface G703AuditedLine {
  id: string;
  itemNumber: string;
  description: string;
  scheduledValueCents: number;
  /** workCompletedToDate = scheduledValue × (pct / 100), bank-rounded. */
  workCompletedToDateCents: number;
  /** workThisPeriod = workCompletedToDate − previouslyCompleted (cents). */
  workThisPeriodCents: number;
  previouslyCompletedCents: number;
  storedMaterialsCents: number;
  /** Total completed and stored = workCompletedToDate + storedMaterials. */
  totalCompletedAndStoredCents: number;
  /** % complete recomputed from cents to keep a single source of truth. */
  pctComplete: number;
  /** Balance to finish (scheduledValue − totalCompletedAndStored), in cents. */
  balanceToFinishCents: number;
  /** Per-line retainage in cents. */
  retainageCents: number;
}

export interface G702Audited {
  applicationNumber: number;
  periodTo: string;
  projectName: string;
  contractorName: string;
  ownerName: string | null;
  asOfDate: string;
  /** G702 line 1 — Original contract sum. */
  originalContractSumCents: number;
  /** G702 line 2 — Net change by Change Orders. */
  netChangeOrdersCents: number;
  /** G702 line 3 — Contract sum to date = line 1 + line 2. */
  contractSumToDateCents: number;
  /** G702 line 4 — Total completed and stored to date (Σ G703 column G+F). */
  totalCompletedAndStoredCents: number;
  /** G702 line 5 — Retainage. */
  retainageCents: number;
  /** G702 line 6 — Total earned less retainage = line 4 − line 5. */
  totalEarnedLessRetainageCents: number;
  /** G702 line 7 — Less previous certificates. */
  lessPreviousCertificatesCents: number;
  /** G702 line 8 — Current payment due = line 6 − line 7. */
  currentPaymentDueCents: number;
  /** G702 line 9 — Balance to finish, including retainage. */
  balanceToFinishIncludingRetainageCents: number;
  retainagePctApplied: number;
  isFinalPayApp: boolean;
  lineItems: G703AuditedLine[];
}

// ── G702 audit calculator ────────────────────────────────────

/**
 * Compute the audited G702 from raw inputs. Pure function: same inputs → same
 * output. Idempotent: running twice returns the identical object structure.
 *
 * The contract:
 *   1. Round at the line level (one rounding op per number stored).
 *   2. Sum the rounded values for rollups.
 *   3. Never sum floats then round at the end — that produces drift.
 */
export function computeG702Audited(input: G702Input): G702Audited {
  const lineRetainageDefault = input.retainagePct;

  // STEP 1 — line-by-line G703 calc, all cents-rounded once.
  const lines: G703AuditedLine[] = input.lineItems.map(li => {
    const sv = dollarsToCents(li.scheduledValue);
    // workCompletedToDate = SV * (pct/100), rounded once.
    const workCompletedToDate = dollarsToCents(
      li.scheduledValue * (clampPct(li.pctCompleteThisPeriod) / 100),
    );
    const previouslyCompleted = dollarsToCents(li.previouslyCompleted);
    const workThisPeriod = workCompletedToDate - previouslyCompleted;
    const stored = dollarsToCents(li.storedMaterials);
    const totalCompletedAndStored = workCompletedToDate + stored;
    const balance = sv - totalCompletedAndStored;
    const lineRetainagePct = li.lineRetainagePct ?? lineRetainageDefault;
    const lineRetainagePctEffective = input.isFinalPayApp ? 0 : lineRetainagePct;
    // totalCompletedAndStored is already in CENTS — multiply by rate then bank-round.
    const retainage = bankRoundCents(
      totalCompletedAndStored * (lineRetainagePctEffective / 100),
    );
    // pctComplete recomputed from cents (so it survives the round-trip):
    const pctComplete = sv > 0
      ? (totalCompletedAndStored / sv) * 100
      : 0;
    return {
      id: li.id,
      itemNumber: li.itemNumber,
      description: li.description,
      scheduledValueCents: sv,
      workCompletedToDateCents: workCompletedToDate,
      workThisPeriodCents: workThisPeriod,
      previouslyCompletedCents: previouslyCompleted,
      storedMaterialsCents: stored,
      totalCompletedAndStoredCents: totalCompletedAndStored,
      pctComplete,
      balanceToFinishCents: balance,
      retainageCents: retainage,
    };
  });

  // STEP 2 — G702 rollups from the rounded line values.
  const originalContractSumCents = dollarsToCents(input.originalContractSum);
  const netChangeOrdersCents = dollarsToCents(input.netChangeOrders);
  const contractSumToDateCents = originalContractSumCents + netChangeOrdersCents;
  const totalCompletedAndStoredCents = sumCents(
    lines.map(l => l.totalCompletedAndStoredCents),
  );

  // Retainage: sum of per-line retainage IF any line specified its own rate;
  // otherwise apply flat rate at the rollup. Both are equivalent if rates match.
  const anyPerLineRate = input.lineItems.some(li => li.lineRetainagePct != null);
  let retainageCents: number;
  if (input.isFinalPayApp) {
    retainageCents = 0;
  } else if (anyPerLineRate) {
    retainageCents = sumCents(lines.map(l => l.retainageCents));
  } else {
    // Flat-rate retainage: totalCompletedAndStoredCents × pct/100, bank-rounded.
    retainageCents = bankRoundCents(
      totalCompletedAndStoredCents * (input.retainagePct / 100),
    );
  }

  const totalEarnedLessRetainageCents =
    totalCompletedAndStoredCents - retainageCents;
  const lessPreviousCertificatesCents = dollarsToCents(
    input.lessPreviousCertificates,
  );
  const currentPaymentDueCents =
    totalEarnedLessRetainageCents - lessPreviousCertificatesCents;
  const balanceToFinishIncludingRetainageCents =
    contractSumToDateCents - totalEarnedLessRetainageCents;

  return {
    applicationNumber: input.applicationNumber,
    periodTo: input.periodTo,
    projectName: input.projectName,
    contractorName: input.contractorName,
    ownerName: input.ownerName ?? null,
    asOfDate: input.asOfDate,
    originalContractSumCents,
    netChangeOrdersCents,
    contractSumToDateCents,
    totalCompletedAndStoredCents,
    retainageCents,
    totalEarnedLessRetainageCents,
    lessPreviousCertificatesCents,
    currentPaymentDueCents,
    balanceToFinishIncludingRetainageCents,
    retainagePctApplied: input.isFinalPayApp ? 0 : input.retainagePct,
    isFinalPayApp: !!input.isFinalPayApp,
    lineItems: lines,
  };
}

// ── helpers ──────────────────────────────────────────────────

/** Bank-round an already-cent-scaled value. Inputs are cents (possibly fractional). */
export function bankRoundCents(centsLike: number): number {
  if (!Number.isFinite(centsLike)) return 0;
  const floor = Math.floor(centsLike);
  const diff = centsLike - floor;
  if (Math.abs(diff - 0.5) < 1e-9) {
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(centsLike);
}

function clampPct(p: number): number {
  if (!Number.isFinite(p)) return 0;
  if (p < 0) return 0;
  if (p > 100) return 100;
  return p;
}

/** Format cents → dollar display string. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs - dollars * 100;
  return `${sign}$${dollars.toLocaleString('en-US')}.${remainder.toString().padStart(2, '0')}`;
}

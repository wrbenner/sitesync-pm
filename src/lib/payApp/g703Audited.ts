/**
 * AIA G703 Audited Calculator (Continuation Sheet).
 *
 * The G703 is the line-by-line breakdown of work completed against the
 * Schedule of Values (SOV). Each row maps to a contract line item; columns
 * are scheduled value, work completed (this period + prior), stored
 * materials, % complete, balance to finish, retainage.
 *
 * This module exports line-level helpers for callers that only need the
 * G703 (e.g. the UI table). The full G702+G703 audited rollup is computed
 * by `computeG702Audited` in `g702Audited.ts`. Both share the same line
 * shape so the reconciliation between sheet and summary stays exact.
 *
 * SPEC SOURCE: AIA Document G703-2017 — Continuation Sheet.
 */

import {
  bankRoundCents,
  dollarsToCents,
  type G703InputLine,
  type G703AuditedLine,
} from './g702Audited';

/**
 * Compute a single audited G703 line from raw input. Pure, deterministic.
 *
 * Spec mapping (G703 column letters):
 *   A — Item No.                              → itemNumber
 *   B — Description of Work                   → description
 *   C — Scheduled Value                       → scheduledValueCents
 *   D — Work Completed: From Previous Application
 *   E — Work Completed: This Period
 *   F — Materials Presently Stored            → storedMaterialsCents
 *   G — Total Completed and Stored to Date    = D + E + F
 *   H — % (G / C)                             → pctComplete
 *   I — Balance to Finish (C − G)             → balanceToFinishCents
 *   J — Retainage                             → retainageCents
 */
export function computeG703Line(
  input: G703InputLine,
  defaultRetainagePct: number,
  isFinalPayApp = false,
): G703AuditedLine {
  const sv = dollarsToCents(input.scheduledValue);
  const previouslyCompleted = dollarsToCents(input.previouslyCompleted);
  const stored = dollarsToCents(input.storedMaterials);

  // Spec contract: workCompletedToDate is the cumulative figure (G703 col D+E),
  // computed once from pct × scheduledValue and bank-rounded to cents.
  const pct = clampPct(input.pctCompleteThisPeriod);
  const workCompletedToDate = dollarsToCents(input.scheduledValue * (pct / 100));
  const workThisPeriod = workCompletedToDate - previouslyCompleted;

  const totalCompletedAndStored = workCompletedToDate + stored;
  const balance = sv - totalCompletedAndStored;

  const lineRetainagePct = input.lineRetainagePct ?? defaultRetainagePct;
  const effectivePct = isFinalPayApp ? 0 : lineRetainagePct;
  const retainage = bankRoundCents(totalCompletedAndStored * (effectivePct / 100));

  // pctComplete is recomputed from the rounded cents — the value stored on
  // the audited row must be reproducible from the other stored fields.
  const pctComplete = sv > 0 ? (totalCompletedAndStored / sv) * 100 : 0;

  return {
    id: input.id,
    itemNumber: input.itemNumber,
    description: input.description,
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
}

/** Compute all G703 lines for a pay app. */
export function computeG703Lines(
  lines: G703InputLine[],
  defaultRetainagePct: number,
  isFinalPayApp = false,
): G703AuditedLine[] {
  return lines.map(li => computeG703Line(li, defaultRetainagePct, isFinalPayApp));
}

function clampPct(p: number): number {
  if (!Number.isFinite(p)) return 0;
  if (p < 0) return 0;
  if (p > 100) return 100;
  return p;
}

export type { G703InputLine, G703AuditedLine };

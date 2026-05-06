/**
 * Cost-code waterfall computation.
 *
 * Pure function. For each cost code, walks left → right:
 *   originalBudget → approvedCOs → revisedBudget → committed → invoiced → paid → balance
 *
 * Each step is exact integer cents. Tracks where money is at each gate so
 * the auditor can see a single number's lineage from contract to bank.
 *
 * Used by the Reconciliation tab (CostCodeWaterfall.tsx) and by the audit
 * report PDF. Not coupled to Supabase — input shape is the SQL view's
 * normalized projection, output is identical regardless of source.
 */

import { dollarsToCents } from '../payApp/g702Audited';

export interface WaterfallInput {
  costCode: string;
  description: string;
  /** Original budgeted amount, in dollars. */
  originalBudget: number;
  /** Approved CO net change, in dollars (signed). */
  approvedChangeOrders: number;
  /** Committed contract amount, in dollars. */
  committed: number;
  /** Invoiced (billed) to date, in dollars. */
  invoiced: number;
  /** Paid (cash out the door) to date, in dollars. */
  paid: number;
}

export interface WaterfallStep {
  label: string;
  /** This step's value in cents (signed). */
  cents: number;
  /** Cumulative running figure at this point, in cents. */
  runningCents: number;
  /** Stage classification — drives UI color. */
  kind:
    | 'budget_origin'
    | 'change_order'
    | 'budget_revised'
    | 'committed'
    | 'invoiced'
    | 'paid'
    | 'balance';
}

export interface WaterfallRow {
  costCode: string;
  description: string;
  steps: WaterfallStep[];
  /** Final balance to pay = committed − paid (cents). */
  balanceToPayCents: number;
  /** Uncommitted balance = revisedBudget − committed (cents). */
  uncommittedCents: number;
  /** Unbilled-but-committed = committed − invoiced (cents). */
  unbilledCents: number;
  /** Receivable in transit = invoiced − paid (cents). */
  receivableCents: number;
  /** True iff committed > revisedBudget (over-committed). */
  isOverCommitted: boolean;
  /** True iff invoiced > committed (over-billed). */
  isOverBilled: boolean;
}

export function computeCostCodeWaterfall(input: WaterfallInput): WaterfallRow {
  const original = dollarsToCents(input.originalBudget);
  const approvedCO = dollarsToCents(input.approvedChangeOrders);
  const revised = original + approvedCO;
  const committed = dollarsToCents(input.committed);
  const invoiced = dollarsToCents(input.invoiced);
  const paid = dollarsToCents(input.paid);

  const balanceToPay = committed - paid;
  const uncommitted = revised - committed;
  const unbilled = committed - invoiced;
  const receivable = invoiced - paid;

  const steps: WaterfallStep[] = [
    {
      label: 'Original budget',
      cents: original,
      runningCents: original,
      kind: 'budget_origin',
    },
    {
      label: 'Approved CO',
      cents: approvedCO,
      runningCents: revised,
      kind: 'change_order',
    },
    {
      label: 'Revised budget',
      cents: revised,
      runningCents: revised,
      kind: 'budget_revised',
    },
    {
      label: 'Committed',
      cents: committed,
      runningCents: committed,
      kind: 'committed',
    },
    {
      label: 'Invoiced',
      cents: invoiced,
      runningCents: invoiced,
      kind: 'invoiced',
    },
    {
      label: 'Paid',
      cents: paid,
      runningCents: paid,
      kind: 'paid',
    },
    {
      label: 'Balance to pay',
      cents: balanceToPay,
      runningCents: balanceToPay,
      kind: 'balance',
    },
  ];

  return {
    costCode: input.costCode,
    description: input.description,
    steps,
    balanceToPayCents: balanceToPay,
    uncommittedCents: uncommitted,
    unbilledCents: unbilled,
    receivableCents: receivable,
    isOverCommitted: committed > revised,
    isOverBilled: invoiced > committed,
  };
}

/** Compute the waterfall for many cost codes; preserves input order. */
export function computeCostCodeWaterfallBatch(
  inputs: WaterfallInput[],
): WaterfallRow[] {
  return inputs.map(computeCostCodeWaterfall);
}

/** Aggregate the waterfall across all cost codes. Cents-exact. */
export interface WaterfallTotals {
  originalBudgetCents: number;
  approvedChangeOrdersCents: number;
  revisedBudgetCents: number;
  committedCents: number;
  invoicedCents: number;
  paidCents: number;
  balanceToPayCents: number;
  uncommittedCents: number;
  unbilledCents: number;
  receivableCents: number;
}

export function totalsForWaterfall(rows: WaterfallRow[]): WaterfallTotals {
  let original = 0,
    co = 0,
    revised = 0,
    committed = 0,
    invoiced = 0,
    paid = 0;
  for (const r of rows) {
    original += r.steps.find(s => s.kind === 'budget_origin')?.cents ?? 0;
    co += r.steps.find(s => s.kind === 'change_order')?.cents ?? 0;
    revised += r.steps.find(s => s.kind === 'budget_revised')?.cents ?? 0;
    committed += r.steps.find(s => s.kind === 'committed')?.cents ?? 0;
    invoiced += r.steps.find(s => s.kind === 'invoiced')?.cents ?? 0;
    paid += r.steps.find(s => s.kind === 'paid')?.cents ?? 0;
  }
  return {
    originalBudgetCents: original,
    approvedChangeOrdersCents: co,
    revisedBudgetCents: revised,
    committedCents: committed,
    invoicedCents: invoiced,
    paidCents: paid,
    balanceToPayCents: committed - paid,
    uncommittedCents: revised - committed,
    unbilledCents: committed - invoiced,
    receivableCents: invoiced - paid,
  };
}

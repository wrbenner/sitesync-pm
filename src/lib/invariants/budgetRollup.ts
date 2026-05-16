import { addCents, type Cents } from '../../types/money'

export interface DivisionBudgetSnapshot {
  divisionId: string
  originalBudgetCents: Cents
  approvedChangeOrderAmountsCents: readonly Cents[]
  revisedBudgetCents: Cents
}

export class BudgetRollupViolation extends Error {
  readonly divisionId: string
  readonly expected: Cents
  readonly actual: Cents

  constructor(divisionId: string, expected: Cents, actual: Cents) {
    super(`budget_rollup_sum violated for division ${divisionId}: expected ${expected}, got ${actual}`)
    this.name = 'BudgetRollupViolation'
    this.divisionId = divisionId
    this.expected = expected
    this.actual = actual
  }
}

export function computeRevisedBudgetCents(
  originalCents: Cents,
  approvedChangeOrderAmountsCents: readonly Cents[],
): Cents {
  return approvedChangeOrderAmountsCents.reduce(
    (acc, amount) => addCents(acc, amount),
    originalCents,
  )
}

export function assertBudgetRollup(snapshot: DivisionBudgetSnapshot): void {
  const expected = computeRevisedBudgetCents(
    snapshot.originalBudgetCents,
    snapshot.approvedChangeOrderAmountsCents,
  )
  if (expected !== snapshot.revisedBudgetCents) {
    throw new BudgetRollupViolation(snapshot.divisionId, expected, snapshot.revisedBudgetCents)
  }
}

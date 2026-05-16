import { type Cents } from '../../types/money'

export interface RetainageState {
  payAppId: string
  cumulativeWithheldCents: Cents
  cumulativeReleasedCents: Cents
}

export class RetainageReleaseViolation extends Error {
  readonly payAppId: string
  readonly withheld: Cents
  readonly released: Cents

  constructor(payAppId: string, withheld: Cents, released: Cents) {
    super(`retainage_release_cap violated for pay app ${payAppId}: released ${released} > withheld ${withheld}`)
    this.name = 'RetainageReleaseViolation'
    this.payAppId = payAppId
    this.withheld = withheld
    this.released = released
  }
}

export function assertRetainageReleaseValid(state: RetainageState): void {
  if (state.cumulativeReleasedCents > state.cumulativeWithheldCents) {
    throw new RetainageReleaseViolation(
      state.payAppId,
      state.cumulativeWithheldCents,
      state.cumulativeReleasedCents,
    )
  }
}

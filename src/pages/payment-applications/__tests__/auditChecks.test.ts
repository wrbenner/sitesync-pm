import { describe, it, expect } from 'vitest'
import {
  runAudit,
  checkLienWaivers,
  checkCoiCoverage,
  checkG702G703Reconcile,
  checkSovPercents,
  checkRetainageMath,
  namesMatch,
  type AuditInput,
  type AuditPayApp,
  type AuditLineItem,
  type AuditPeriodContractor,
} from '../auditChecks'

// ── Fixture helpers ──────────────────────────────────────

function basePayApp(overrides: Partial<AuditPayApp> = {}): AuditPayApp {
  return {
    id: 'pa-1',
    application_number: 6,
    period_to: '2026-04-30',
    period_from: '2026-04-01',
    original_contract_sum: 1_000_000,
    net_change_orders: 0,
    total_completed_and_stored: 412_000,
    retainage_percent: 10,
    retainage_amount: 41_200,
    less_previous_certificates: 200_000,
    current_payment_due: 170_800,
    ...overrides,
  }
}

function baseLineItem(
  overrides: Partial<AuditLineItem> = {},
): AuditLineItem {
  return {
    id: 'li-1',
    item_number: '01000',
    description: 'General conditions',
    scheduled_value: 100_000,
    previous_completed: 50_000,
    this_period: 20_000,
    materials_stored: 0,
    percent_complete: 70,
    ...overrides,
  }
}

function baseInput(overrides: Partial<AuditInput> = {}): AuditInput {
  const payApp = overrides.payApp ?? basePayApp()
  const lineItems: AuditLineItem[] = overrides.lineItems ?? [
    baseLineItem({
      id: 'li-1',
      item_number: '01000',
      scheduled_value: 412_000,
      previous_completed: 0,
      this_period: 412_000,
      materials_stored: 0,
      percent_complete: 100,
    }),
  ]
  const subA: AuditPeriodContractor = {
    contractor_id: 'sub-a',
    contractor_name: 'Acme Drywall',
    billed_amount_this_period: 200_000,
  }
  return {
    payApp,
    lineItems,
    waivers: [
      {
        id: 'lw-a',
        contractor_name: 'Acme Drywall',
        application_id: payApp.id,
        amount: 200_000,
        status: 'conditional',
        through_date: '2026-04-30',
      },
    ],
    insurance: [
      {
        id: 'ic-a',
        company: 'Acme Drywall',
        policy_type: 'general_liability',
        effective_date: '2026-01-01',
        expiration_date: '2026-12-31',
        verified: true,
      },
    ],
    contractorsThisPeriod: [subA],
    ...overrides,
  }
}

// ── namesMatch ───────────────────────────────────────────

describe('namesMatch', () => {
  it('matches identical names case-insensitively', () => {
    expect(namesMatch('Acme Drywall', 'acme drywall')).toBe(true)
  })
  it('matches substrings in either direction', () => {
    expect(namesMatch('Acme', 'Acme Drywall LLC')).toBe(true)
    expect(namesMatch('Acme Drywall LLC', 'Acme')).toBe(true)
  })
  it('does not match unrelated names', () => {
    expect(namesMatch('Acme', 'Bolt Electric')).toBe(false)
  })
  it('handles empty strings safely', () => {
    expect(namesMatch('', 'Acme')).toBe(false)
    expect(namesMatch('Acme', '')).toBe(false)
  })
})

// ── checkLienWaivers ─────────────────────────────────────

describe('checkLienWaivers', () => {
  it('passes when every billing sub has a non-pending waiver', () => {
    const r = checkLienWaivers(baseInput())
    expect(r.status).toBe('pass')
  })

  it('fails when a sub has no waiver at all', () => {
    const input = baseInput({
      contractorsThisPeriod: [
        { contractor_id: 'a', contractor_name: 'Acme', billed_amount_this_period: 100 },
        { contractor_id: 'b', contractor_name: 'Bolt Electric', billed_amount_this_period: 100 },
      ],
    })
    const r = checkLienWaivers(input)
    expect(r.status).toBe('fail')
    expect(r.detail).toMatch(/Bolt Electric/)
  })

  it('fails when waiver exists but is still pending', () => {
    const input = baseInput()
    input.waivers[0].status = 'pending'
    const r = checkLienWaivers(input)
    expect(r.status).toBe('fail')
  })

  it('ignores subs with $0 billed this period', () => {
    const input = baseInput({
      contractorsThisPeriod: [
        { contractor_id: 'a', contractor_name: 'Acme Drywall', billed_amount_this_period: 200_000 },
        { contractor_id: 'c', contractor_name: 'No Work Co', billed_amount_this_period: 0 },
      ],
    })
    const r = checkLienWaivers(input)
    expect(r.status).toBe('pass')
  })
})

// ── checkCoiCoverage ─────────────────────────────────────

describe('checkCoiCoverage', () => {
  it('passes when COI is verified and covers full period', () => {
    const r = checkCoiCoverage(baseInput())
    expect(r.status).toBe('pass')
  })

  it('fails when COI expires mid-period', () => {
    const input = baseInput()
    input.insurance[0].expiration_date = '2026-04-15' // mid-period
    const r = checkCoiCoverage(input)
    expect(r.status).toBe('fail')
    expect(r.detail).toMatch(/Acme Drywall/)
  })

  it('fails when sub has no COI on file', () => {
    const input = baseInput({ insurance: [] })
    const r = checkCoiCoverage(input)
    expect(r.status).toBe('fail')
    expect(r.detail).toMatch(/no COI/)
  })

  it('fails when cert exists but is not verified', () => {
    const input = baseInput()
    input.insurance[0].verified = false
    const r = checkCoiCoverage(input)
    expect(r.status).toBe('fail')
  })
})

// ── checkG702G703Reconcile ──────────────────────────────

describe('checkG702G703Reconcile', () => {
  it('passes when totals match within tolerance', () => {
    const r = checkG702G703Reconcile(baseInput())
    expect(r.status).toBe('pass')
  })

  it('fails when line-item sum drifts past the $1 tolerance', () => {
    const input = baseInput()
    input.payApp.total_completed_and_stored = 411_500 // line items total 412_000
    const r = checkG702G703Reconcile(input)
    expect(r.status).toBe('fail')
    expect(r.detail).toMatch(/\$500/)
  })
})

// ── checkSovPercents ────────────────────────────────────

describe('checkSovPercents', () => {
  it('passes when no line bills over 100%', () => {
    const r = checkSovPercents(baseInput())
    expect(r.status).toBe('pass')
  })

  it('fails when any line bills over 100%', () => {
    const input = baseInput({
      lineItems: [
        baseLineItem({
          item_number: '03000',
          description: 'Concrete',
          scheduled_value: 100_000,
          previous_completed: 80_000,
          this_period: 30_000,
          materials_stored: 0,
        }),
      ],
    })
    const r = checkSovPercents(input)
    expect(r.status).toBe('fail')
    expect(r.detail).toMatch(/Concrete/)
  })
})

// ── checkRetainageMath ──────────────────────────────────

describe('checkRetainageMath', () => {
  it('passes when retainage = total * pct', () => {
    const r = checkRetainageMath(baseInput())
    expect(r.status).toBe('pass')
  })

  it('fails when retainage is wrong by more than $1', () => {
    const input = baseInput()
    input.payApp.retainage_amount = 35_000 // expected 41_200
    const r = checkRetainageMath(input)
    expect(r.status).toBe('fail')
  })
})

// ── runAudit ────────────────────────────────────────────

describe('runAudit', () => {
  it('returns pass + canSubmit=true when all checks pass', () => {
    const summary = runAudit(baseInput())
    expect(summary.status).toBe('pass')
    expect(summary.canSubmit).toBe(true)
    expect(summary.failed).toBe(0)
  })

  it('returns fail + canSubmit=false with failedCheckIds populated', () => {
    const input = baseInput({ insurance: [] }) // breaks COI check
    const summary = runAudit(input)
    expect(summary.status).toBe('fail')
    expect(summary.canSubmit).toBe(false)
    expect(summary.failedCheckIds).toContain('coi_active_for_period')
  })

  it('reports stable counts (5 total checks)', () => {
    const summary = runAudit(baseInput())
    expect(summary.total).toBe(5)
  })
})

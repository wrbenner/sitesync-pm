/**
 * PayAppDetail audit-gate tests
 *
 * Covers the four acceptance criteria for the pre-submission audit wiring:
 *  1. Renders PreSubmissionAudit when status is 'draft'
 *  2. Generate G702 button is disabled when audit fails AND no override
 *  3. Override path writes to payapp_audit_overrides
 *  4. Audit log entry is created with action='submit_with_override'
 *
 * Patterns intentionally lifted from src/test/hooks/mutations/_helpers.ts —
 * hoisted vi.mock factories for any module the component pulls in.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ── Hoisted mock spies (must stay literal so vi.hoisted finds them) ────
const mocks = vi.hoisted(() => ({
  logAuditEntry: vi.fn().mockResolvedValue(undefined),
  insuranceData: [] as unknown[],
  // sovData supplies a passing audit fixture by default; tests override it
  // before render to drive the failing-audit branches.
  sovData: {
    payAppId: 'pa-1',
    contractId: 'contract-1',
    projectId: 'proj-1',
    projectName: 'Test Project',
    contractorName: 'Acme Drywall',
    applicationNumber: 6,
    periodTo: '2026-04-30',
    originalContractSum: 1_000_000,
    netChangeOrders: 0,
    lessPreviousCertificates: 0,
    retainageRate: 0.1,
    lineItems: [
      {
        id: 'li-1',
        item_number: '01000',
        description: 'General conditions',
        scheduled_value: 100_000,
        prev_pct_complete: 50,
        current_pct_complete: 20,
        stored_materials: 0,
        retainage_rate: 0.1,
        cost_code: null,
      },
    ],
  },
  insertedOverride: null as null | { reason: string; check_ids: string[]; project_id: string; pay_app_id: string },
}))

// Mock the supabase client. The audit-override insert reads `.from(...).insert(...).select().single()`,
// the only path the audit panel exercises end-to-end.
vi.mock('../../../lib/supabase', () => {
  const chain = {
    insert: vi.fn(function (this: unknown, payload: Record<string, unknown>) {
      mocks.insertedOverride = {
        project_id: payload.project_id as string,
        pay_app_id: payload.pay_app_id as string,
        reason: payload.reason as string,
        check_ids: (payload.check_ids as string[]) ?? [],
      }
      return chain
    }),
    select: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: { id: 'override-1' }, error: null })),
  }
  // SOVEditor opens a realtime channel — stub the surface area enough that
  // its effect doesn't crash; we don't assert on it.
  const realtime = {
    on: vi.fn(function (this: unknown) { return realtime }),
    subscribe: vi.fn(function (this: unknown) { return realtime }),
    unsubscribe: vi.fn(),
  }
  return {
    supabase: {
      from: vi.fn(() => chain),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'u@example.com' } } }),
      },
      channel: vi.fn(() => realtime),
      removeChannel: vi.fn(),
    },
    fromTable: vi.fn(() => chain),
  }
})

vi.mock('../../../lib/auditLogger', () => ({
  logAuditEntry: mocks.logAuditEntry,
}))

vi.mock('../../../hooks/queries', () => ({
  usePayAppSOV: () => ({ data: mocks.sovData, isLoading: false }),
}))

vi.mock('../../../hooks/queries/insurance-certificates', () => ({
  useInsuranceCertificates: () => ({ data: mocks.insuranceData }),
  // getCOIStatus is not used by PayAppDetail directly, but kept to satisfy
  // any transitive imports.
  getCOIStatus: () => ({ label: 'Current', severity: 'current', daysUntil: 999 }),
}))

vi.mock('../../../components/auth/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// G702Preview pulls in @react-pdf/renderer which crashes in jsdom; the audit
// gate sits above it in the tree, so a stub is fine here.
vi.mock('../G702Preview', () => ({
  G702Preview: () => <div data-testid="g702-preview-stub" />,
}))

// SOVEditor opens supabase realtime channels and other heavy plumbing —
// stubbed for the same reason. The audit gate doesn't depend on it.
vi.mock('../SOVEditor', () => ({
  SOVEditorPanel: () => <div data-testid="sov-editor-stub" />,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

// Now import the unit under test, AFTER mocks are wired.
import { PayAppDetail } from '../PayAppDetail'
import type { LienWaiverRow } from '../../../types/api'

// ── Fixtures ───────────────────────────────────────────────────────────

function basePayApp(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  // Build a row that matches what auditChecks will see: line item totals
  // (prev 50% + this 20% of 100k = 70k) reconcile with header total_completed_and_stored,
  // retainage = 10% of 70k = 7k.
  return {
    id: 'pa-1',
    application_number: 6,
    status: 'draft',
    period_to: '2026-04-30',
    period_from: '2026-04-01',
    original_contract_sum: 1_000_000,
    net_change_orders: 0,
    total_completed_and_stored: 70_000,
    retainage_percent: 10,
    retainage_amount: 7_000,
    less_previous_certificates: 0,
    current_payment_due: 63_000,
    ...overrides,
  }
}

const passingInsurance = [
  {
    id: 'ic-1',
    project_id: 'proj-1',
    company: 'Acme Drywall',
    subcontractor_id: 'sub-1',
    policy_type: 'general_liability' as const,
    carrier: 'Carrier',
    policy_number: 'P1',
    coverage_amount: 1_000_000,
    aggregate_limit: 2_000_000,
    effective_date: '2026-01-01',
    expiration_date: '2026-12-31',
    additional_insured: true,
    waiver_of_subrogation: true,
    document_url: null,
    verified: true,
    verified_by: 'u1',
    verified_at: '2026-01-01',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
]

const passingWaivers: LienWaiverRow[] = [
  {
    id: 'lw-1',
    project_id: 'proj-1',
    subcontractor_id: 'sub-1',
    payment_period: '2026-04-30',
    waiver_type: 'conditional_progress',
    amount: 70_000,
    status: 'received',
    is_missing: false,
    pay_application_id: 'pa-1',
    waiver_date: '2026-04-30',
    submitted_at: null,
    received_at: '2026-04-30',
    created_at: '2026-04-30',
  },
]

const passingContracts = [
  { id: 'sub-1', counterparty: 'Acme Drywall' },
]

function renderDetail(overrides: {
  app?: Record<string, unknown>
  waivers?: LienWaiverRow[]
  insurance?: typeof passingInsurance
  contracts?: typeof passingContracts
} = {}) {
  const onApprove = vi.fn()
  const onMarkReceived = vi.fn()
  const onMarkExecuted = vi.fn()
  mocks.insuranceData = overrides.insurance ?? passingInsurance

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  const utils = render(
    <QueryClientProvider client={qc}>
      <PayAppDetail
        app={overrides.app ?? basePayApp()}
        projectId="proj-1"
        waivers={overrides.waivers ?? passingWaivers}
        contracts={overrides.contracts ?? passingContracts}
        onApprove={onApprove}
        isApproving={false}
        onMarkReceived={onMarkReceived}
        onMarkExecuted={onMarkExecuted}
        markingWaiverId={null}
      />
    </QueryClientProvider>,
  )

  return { ...utils, onApprove, onMarkReceived, onMarkExecuted }
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('PayAppDetail audit gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insertedOverride = null
    mocks.insuranceData = passingInsurance
  })

  it('renders PreSubmissionAudit when status is "draft"', () => {
    renderDetail()
    // The PreSubmissionAudit's <section aria-label="Pre-submission audit"> root
    // is the stable selector regardless of summary state.
    expect(screen.getByRole('region', { name: /pre-submission audit/i })).toBeInTheDocument()
  })

  it('hides Generate G702 button entirely on draft (current behavior preserved)', () => {
    renderDetail()
    // The print button only shows for submitted/approved — proving the gate
    // doesn't accidentally surface it for drafts.
    expect(screen.queryByTestId('generate-g702-btn')).not.toBeInTheDocument()
  })

  it('disables Generate G702 button when audit fails AND no override accepted', () => {
    // Status=submitted to surface the print button; insurance empty fails COI check.
    renderDetail({
      app: basePayApp({ status: 'submitted' }),
      insurance: [],
    })
    const btn = screen.getByTestId('generate-g702-btn') as HTMLButtonElement
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute(
      'title',
      expect.stringContaining('audit failed'),
    )
  })

  it('writes to payapp_audit_overrides + logs submit_with_override on override', async () => {
    // Force a failure: empty insurance trips the COI check.
    const { onApprove } = renderDetail({
      app: basePayApp({ status: 'submitted' }),
      insurance: [],
    })

    // Tick the "I accept these gaps" checkbox.
    const auditRegion = screen.getByRole('region', { name: /pre-submission audit/i })
    const checkbox = within(auditRegion).getByRole('checkbox')
    fireEvent.click(checkbox)

    // Type a 12+ char reason (textarea is rendered after checkbox toggles).
    const textarea = await within(auditRegion).findByRole('textbox', { name: /override reason/i })
    fireEvent.change(textarea, { target: { value: 'COI renewal in progress, owner approved gap' } })

    // Click Submit.
    const submit = within(auditRegion).getByRole('button', { name: /submit to owner/i })
    fireEvent.click(submit)

    // Override row reaches Supabase.
    await waitFor(() => {
      expect(mocks.insertedOverride).not.toBeNull()
    })
    expect(mocks.insertedOverride).toMatchObject({
      project_id: 'proj-1',
      pay_app_id: 'pa-1',
      reason: 'COI renewal in progress, owner approved gap',
    })
    expect(mocks.insertedOverride!.check_ids).toContain('coi_active_for_period')

    // Audit log entry created with submit_with_override action.
    await waitFor(() => {
      expect(mocks.logAuditEntry).toHaveBeenCalled()
    })
    expect(mocks.logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-1',
        entityType: 'pay_app',
        entityId: 'pa-1',
        action: 'submit_with_override',
      }),
    )

    // The parent's submit handler is invoked once the override is recorded.
    await waitFor(() => {
      expect(onApprove).toHaveBeenCalled()
    })
  })
})

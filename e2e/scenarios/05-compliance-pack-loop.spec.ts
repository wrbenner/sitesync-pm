/**
 * Scenario 5 — The compliance pack loop
 *
 *   Generate WH-347
 *     → DOL-format PDF produced
 *     → e-sign
 *     → archive in compliance_archive
 *     → admin downloads sealed pack
 *     → hash chain verified
 *     → audit log shows the chain.
 *
 * STATUS: PARTIAL — the WH-347 generation half is fully shipped this
 * session (compliance pack stream). The compliance_archive table +
 * sealed-pack download UI are not.
 *
 * What this spec runs:
 *   ✓ Calls generateWh347 with the fixture roster
 *   ✓ Asserts content_hash is deterministic (re-run produces same hash)
 *   ✓ Asserts the PDF renders without throwing
 *   ✓ Asserts gap report is empty for clean inputs
 *
 * What this spec skips:
 *   • compliance_archive insert + sealed-pack PDF aggregator (deferred)
 *   • hash-chain verifier integration with audit_chain_checkpoints
 *     (the verifier exists in dailyLog/signing.ts; the cross-form
 *     compliance chain is a separate deferral)
 */

import { test, expect } from '@playwright/test'
import { setupScenario } from '../helpers/scenarioRunner'

test('compliance pack — WH-347 generate + deterministic hash', async ({ page }) => {
  const { ctx, teardown } = await setupScenario(page, {
    name: '05-compliance-pack',
    aiResponses: {},
  })
  try {
    const fixture = ctx.fixture as Record<string, unknown>
    const { generateWh347 } = await import('../../src/lib/compliance/wh347')
    const { renderPdf } = await import('../../src/lib/compliance/wh347/render')

    const decisions = [{
      id: 'r1', state_code: 'TX', county: 'Travis', trade: 'Electrician',
      apprentice_level: null,
      base_rate: 38.50, fringe_rate: 9.20, overtime_multiplier: 1.5,
      wage_decision_number: 'TX20260001',
      effective_from: '2026-01-01', effective_to: null,
    }]

    type WorkerInput = Parameters<typeof generateWh347>[0]['workers'][number]
    const workers = (fixture.workers as Array<{
      name: string; ssnLast4: string; classification: string; apprenticeLevel: number | null;
      hoursPerDay: number[]; hourlyRatePaid: number;
      fringeAllocation: 'cash' | 'plan' | 'mixed'; fringePerHourCash: number; fringePerHourPlan: number;
      deductions: Array<{ label: string; amount: number }>;
    }>).map((w): WorkerInput => ({
      workerName: w.name,
      ssnLast4: w.ssnLast4,
      classification: w.classification,
      apprenticeLevel: w.apprenticeLevel,
      hoursPerDay: w.hoursPerDay,
      straightHours: w.hoursPerDay.reduce((s, h) => s + (h <= 8 ? h : 8), 0),
      overtimeHours: w.hoursPerDay.reduce((s, h) => s + (h > 8 ? h - 8 : 0), 0),
      doubleTimeHours: 0,
      hourlyRatePaid: w.hourlyRatePaid,
      fringeAllocation: w.fringeAllocation,
      fringePerHourCash: w.fringePerHourCash,
      fringePerHourPlan: w.fringePerHourPlan,
      deductions: w.deductions,
    }))

    const inputs: Parameters<typeof generateWh347>[0] = {
      header: {
        contractorName: 'E2E Test Contractor',
        contractorAddress: '100 Test St, Austin, TX',
        payrollNumber: fixture.payrollNumber as number,
        weekEnding: fixture.weekEnding as string,
        projectName: 'E2E Mid Project',
        projectLocation: 'Austin, TX',
        projectNumber: 'E2E-001',
        stateCode: 'TX',
        county: 'Travis',
      },
      workers,
      statement: {
        signerName: 'E2E Compliance Officer',
        signerTitle: 'Compliance Officer',
        payerType: 'contractor',
        periodFrom: '2026-04-19',
        periodTo: fixture.weekEnding as string,
        fringeBenefits: 'paid_to_plans',
        exceptions: [],
      },
      decisions,
    }

    // 1. Generate twice — must be deterministic.
    const a = await generateWh347(inputs)
    const b = await generateWh347(inputs)
    expect(a.contentHash).toBe(b.contentHash)
    expect(a.contentHash).toMatch(new RegExp(fixture.expectedContentHashShape as string))

    // 2. Net pay matches the fixture's expectation.
    expect(a.workers[0].netPay).toBeCloseTo(fixture.expectedNetPay as number, 2)

    // 3. Gap report is empty for clean inputs.
    expect(a.gaps).toEqual([])

    // 4. PDF renders without throwing — non-empty bytes.
    const pdfBytes = await renderPdf(a)
    expect(pdfBytes.length).toBeGreaterThan(1000)
    // PDF magic bytes
    expect(pdfBytes[0]).toBe(0x25)  // '%'
    expect(pdfBytes[1]).toBe(0x50)  // 'P'

    // The page reference avoids unused-param lint; not navigated this scenario.
    void page
  } finally {
    await teardown()
  }
})

test.skip('compliance pack — archive + sealed-pack PDF (deferred)', async () => {
  // Lands when compliance_archive table + sealed-pack aggregator ship.
})

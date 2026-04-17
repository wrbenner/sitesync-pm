import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock computeCurrentPaymentDue to avoid Supabase imports in payApplications
// ---------------------------------------------------------------------------
vi.mock('../../api/endpoints/payApplications', () => ({
  computeCurrentPaymentDue: vi.fn().mockReturnValue({
    workThisPeriod: 50000,
    totalCompletedAndStored: 150000,
    line5: 150000,
    line5a: 15000,
    line5b: 0,
    line6: 135000,
    retainageAmount: 15000,
    retainageOnStored: 0,
    currentPaymentDue: 135000,
  }),
}))

import {
  generatePayAppPdfFromData,
  generatePayAppPdf,
  generateG702Pdf,
  generateG703Pdf,
  type PayAppPdfData,
  type G702Params,
  type G703Params,
  type PaymentLineItem,
} from './paymentAppPdf'
import type { PayApplication } from '../../types/api'

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------
const BASE_DATA: PayAppPdfData = {
  applicationNumber: 3,
  periodFrom: '2024-05-01',
  periodTo: '2024-05-31',
  status: 'submitted',
  projectName: 'Harbor Bridge Renovation',
  contractorName: 'Summit Builders',
  ownerName: 'City of Springfield',
  architectName: 'DesignCo',
  originalContractSum: 1000000,
  netChangeOrders: 25000,
  contractSumToDate: 1025000,
  totalCompletedAndStored: 600000,
  retainagePercent: 10,
  retainageAmount: 60000,
  totalEarnedLessRetainage: 540000,
  lessPreviousCertificates: 400000,
  currentPaymentDue: 140000,
  balanceToFinish: 485000,
}

const G702_PARAMS: G702Params = {
  projectName: 'Test Project',
  contractorName: 'Test Contractor',
  architectName: 'Test Architect',
  applicationNumber: 1,
  periodFrom: '2024-01-01',
  periodTo: '2024-01-31',
  originalContractSum: 500000,
  netChangeByChangeOrders: 10000,
  contractSumToDate: 510000,
  totalCompletedAndStored: 300000,
  retainagePercent: 10,
  retainageAmount: 30000,
  totalEarnedLessRetainage: 270000,
  lessPreviousCertificates: 200000,
  currentPaymentDue: 70000,
  balanceToFinish: 240000,
}

const SOV_LINE_ITEM = {
  itemNumber: '1',
  description: 'Site Work',
  scheduledValue: 100000,
  workCompletedPrevious: 50000,
  workCompletedThisPeriod: 20000,
  materialsStored: 0,
  totalCompletedAndStored: 70000,
  percentComplete: 70,
  balanceToFinish: 30000,
  retainage: 7000,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('paymentAppPdf', () => {
  // ── generatePayAppPdfFromData ─────────────────────────────────────────────
  describe('generatePayAppPdfFromData', () => {
    it('returns a Blob with PDF content type', async () => {
      const blob = await generatePayAppPdfFromData(BASE_DATA)

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('application/pdf')
      expect(blob.size).toBeGreaterThan(0)
    })

    it('produces larger output when SOV lines are included', async () => {
      const withLines = await generatePayAppPdfFromData({
        ...BASE_DATA,
        sovLines: [SOV_LINE_ITEM, { ...SOV_LINE_ITEM, itemNumber: '2', description: 'Framing' }],
      })
      const withoutLines = await generatePayAppPdfFromData(BASE_DATA)

      expect(withLines.size).toBeGreaterThan(withoutLines.size)
    })

    it('handles zero-value financials without throwing', async () => {
      const zeroData: PayAppPdfData = {
        ...BASE_DATA,
        originalContractSum: 0,
        netChangeOrders: 0,
        contractSumToDate: 0,
        totalCompletedAndStored: 0,
        retainageAmount: 0,
        totalEarnedLessRetainage: 0,
        lessPreviousCertificates: 0,
        currentPaymentDue: 0,
        balanceToFinish: 0,
      }

      await expect(generatePayAppPdfFromData(zeroData)).resolves.toBeInstanceOf(Blob)
    })

    it('handles missing optional fields gracefully', async () => {
      const minimalData: PayAppPdfData = {
        applicationNumber: 1,
        periodTo: '2024-01-31',
        status: 'draft',
        projectName: 'Minimal Project',
        originalContractSum: 100000,
        netChangeOrders: 0,
        contractSumToDate: 100000,
        totalCompletedAndStored: 0,
        retainagePercent: 10,
        retainageAmount: 0,
        totalEarnedLessRetainage: 0,
        lessPreviousCertificates: 0,
        currentPaymentDue: 0,
        balanceToFinish: 100000,
      }

      await expect(generatePayAppPdfFromData(minimalData)).resolves.toBeInstanceOf(Blob)
    })
  })

  // ── generatePayAppPdf ─────────────────────────────────────────────────────
  describe('generatePayAppPdf', () => {
    const payApp: PayApplication = {
      id: 'app-1',
      project_id: 'proj-1',
      application_number: 3,
      period_from: '2024-05-01',
      period_to: '2024-05-31',
      status: 'submitted',
      original_contract_sum: 1000000,
      net_change_orders: 25000,
      total_completed_and_stored: 600000,
      retainage: 60000,
      total_earned_less_retainage: 540000,
      less_previous_certificates: 400000,
      current_payment_due: 140000,
      created_at: '2024-01-01T00:00:00Z',
    } as unknown as PayApplication

    const lineItems: PaymentLineItem[] = [
      {
        itemNumber: '1',
        description: 'Site Work',
        scheduledValue: 100000,
        prevPctComplete: 0.5,
        currentPctComplete: 0.7,
        storedMaterials: 0,
        retainageRate: 0.1,
      },
    ]

    it('returns a Blob for pay app with line items', async () => {
      const blob = await generatePayAppPdf(payApp, lineItems, 'Harbor Bridge')

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('application/pdf')
      expect(blob.size).toBeGreaterThan(0)
    })

    it('returns a Blob for pay app with no line items', async () => {
      const blob = await generatePayAppPdf(payApp, [], 'Harbor Bridge')

      expect(blob).toBeInstanceOf(Blob)
    })
  })

  // ── generateG702Pdf ───────────────────────────────────────────────────────
  describe('generateG702Pdf', () => {
    it('returns Uint8Array bytes starting with PDF header', async () => {
      const bytes = await generateG702Pdf(G702_PARAMS)

      expect(bytes).toBeInstanceOf(Uint8Array)
      expect(bytes.length).toBeGreaterThan(0)
      // PDF files start with "%PDF"
      const header = String.fromCharCode(...bytes.slice(0, 4))
      expect(header).toBe('%PDF')
    })

    it('handles zero retainage percent', async () => {
      const params = { ...G702_PARAMS, retainagePercent: 0, retainageAmount: 0 }
      await expect(generateG702Pdf(params)).resolves.toBeInstanceOf(Uint8Array)
    })

    it('handles negative net change by change orders', async () => {
      const params = { ...G702_PARAMS, netChangeByChangeOrders: -5000 }
      await expect(generateG702Pdf(params)).resolves.toBeInstanceOf(Uint8Array)
    })
  })

  // ── generateG703Pdf ───────────────────────────────────────────────────────
  describe('generateG703Pdf', () => {
    it('returns Uint8Array bytes for single line item', async () => {
      const params: G703Params = {
        applicationNumber: 1,
        lineItems: [SOV_LINE_ITEM],
      }

      const bytes = await generateG703Pdf(params)

      expect(bytes).toBeInstanceOf(Uint8Array)
      expect(bytes.length).toBeGreaterThan(0)
    })

    it('handles empty line items without crashing', async () => {
      const params: G703Params = { applicationNumber: 1, lineItems: [] }

      await expect(generateG703Pdf(params)).resolves.toBeInstanceOf(Uint8Array)
    })

    it('produces more pages for many line items', async () => {
      // Create enough items to require multiple pages (~30 rows per page)
      const manyItems = Array.from({ length: 40 }, (_, i) => ({
        ...SOV_LINE_ITEM,
        itemNumber: String(i + 1),
        description: `Work Item ${i + 1}`,
      }))

      const small = await generateG703Pdf({ applicationNumber: 1, lineItems: [SOV_LINE_ITEM] })
      const large = await generateG703Pdf({ applicationNumber: 1, lineItems: manyItems })

      expect(large.length).toBeGreaterThan(small.length)
    })
  })
})

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import type { PayApplication } from '../../types/api'
import { computeCurrentPaymentDue } from '../../api/endpoints/payApplications'

// ---------------------------------------------------------------------------
// PaymentLineItem — public interface for generatePayAppPdf
// ---------------------------------------------------------------------------

export interface PaymentLineItem {
  /** Display item number, e.g. "1", "2A" */
  itemNumber: string
  description: string
  /** Scheduled value in dollars */
  scheduledValue: number
  /** Previous percent complete as a decimal (0.0 to 1.0) */
  prevPctComplete: number
  /** Current period percent complete as a decimal (0.0 to 1.0) */
  currentPctComplete: number
  /** Stored materials in dollars */
  storedMaterials: number
  /** Retainage rate on work as a decimal (e.g. 0.10 for 10%) */
  retainageRate: number
  /** Retainage rate on stored materials as a decimal (defaults to 0) */
  storedMaterialRetainageRate?: number
  /** Previous certificates for payment in dollars (defaults to 0) */
  previousCertificates?: number
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PayAppLineItem {
  /** Display item number, e.g. "1", "2A" */
  itemNumber: string
  description: string
  /** Scheduled value in dollars */
  scheduledValue: number
  /** Previous percent complete as a decimal (0.0 to 1.0) */
  prevPctComplete: number
  /** Current period percent complete as a decimal (0.0 to 1.0) */
  currentPctComplete: number
  /** Stored materials in dollars */
  storedMaterials: number
  /** Retainage rate on work as a decimal (e.g. 0.10 for 10%) */
  retainageRate: number
  /** Retainage rate on stored materials as a decimal (defaults to 0) */
  storedMaterialRetainageRate?: number
  /** Previous certificates for payment in dollars (defaults to 0) */
  previousCertificates?: number
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Format dollar amount from cents integer to "$ 1,234.56" string */
function fmtDollars(cents: number): string {
  const dollars = cents / 100
  return '$' + dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Format decimal fraction to "45.00%" */
function fmtPct(fraction: number): string {
  return (fraction * 100).toFixed(2) + '%'
}

/** Convert dollar value to integer cents, rounding half-up */
function toCents(dollars: number): number {
  return Math.round(dollars * 100)
}

/** Draw a horizontal rule */
function drawHRule(page: PDFPage, x: number, y: number, width: number, thickness = 0.5): void {
  page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness,
    color: rgb(0, 0, 0),
  })
}

/** Draw text, truncated to fit maxWidth using the given font+size */
async function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  maxWidth?: number,
  color = rgb(0, 0, 0),
): Promise<void> {
  let t = text
  if (maxWidth !== undefined) {
    while (t.length > 1 && font.widthOfTextAtSize(t, size) > maxWidth) {
      t = t.slice(0, -1)
    }
  }
  page.drawText(t, { x, y, font, size, color })
}

// ---------------------------------------------------------------------------
// G702 Summary Page
// ---------------------------------------------------------------------------

/**
 * Generates an AIA G702 Application and Certificate for Payment summary page.
 * Returns a valid PDF as a Uint8Array suitable for download.
 *
 * All monetary arithmetic uses integer cents to avoid floating-point drift.

,
  sovLines: PayAppLineItem[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792]) // US Letter portrait

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const LEFT = 40
  const RIGHT = 572
  const WIDTH = RIGHT - LEFT
  let y = 750

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------
  await drawText(page, 'AIA DOCUMENT G702', LEFT, y, fontBold, 11)
  await drawText(page, 'APPLICATION AND CERTIFICATE FOR PAYMENT', LEFT + 170, y, fontReg, 11)
  y -= 14
  drawHRule(page, LEFT, y, WIDTH, 1)
  y -= 16

  // Project info block (left column)
  const labelSize = 7
  const valueSize = 9
  const col2 = LEFT + 240

  const infoRows: Array<[string, string]> = [
    ['PROJECT:', project.name],
    ['ADDRESS:', project.address],
    ['OWNER:', project.owner],
    ['ARCHITECT:', project.architect],
    ['CONTRACTOR:', project.contractor],
  ]

  for (const [label, value] of infoRows) {
    await drawText(page, label, LEFT, y, fontBold, labelSize)
    await drawText(page, value, LEFT + 70, y, fontReg, valueSize, 160)
    y -= 13
  }

  // Application info (right column) — reset y to top of block
  let ry = 750 - 14 - 16
  const appRows: Array<[string, string]> = [
    ['APPLICATION NO:', String(payApp.application_number ?? '')],
    ['PERIOD FROM:', payApp.period_from ?? ''],
    ['PERIOD TO:', payApp.period_to ?? ''],
    ['CONTRACT DATE:', payApp.created_at ? payApp.created_at.slice(0, 10) : ''],
    ['STATUS:', (payApp.status ?? '').toUpperCase()],
  ]

  for (const [label, value] of appRows) {
    await drawText(page, label, col2, ry, fontBold, labelSize)
    await drawText(page, value, col2 + 100, ry, fontReg, valueSize, 130)
    ry -= 13
  }

  y -= 8
  drawHRule(page, LEFT, y, WIDTH, 0.75)
  y -= 16

  // ---------------------------------------------------------------------------
  // Compute summary totals from SOV lines (all in cents)
  // ---------------------------------------------------------------------------
  let totalScheduledCents = 0
  let totalCompletedAndStoredCents = 0
  let totalRetainageCents = 0
  let totalEarnedLessRetainageCents = 0
  let totalPreviousCertificatesCents = 0
  let totalCurrentPaymentDueCents = 0

  for (const line of sovLines) {
    const result = computeCurrentPaymentDue({
      scheduledValue: line.scheduledValue,
      prevPctComplete: line.prevPctComplete,
      currentPctComplete: line.currentPctComplete,
      storedMaterials: line.storedMaterials,
      retainageRate: line.retainageRate,
      previousCertificates: line.previousCertificates ?? 0,
      storedMaterialRetainageRate: line.storedMaterialRetainageRate ?? 0,
    })
    totalScheduledCents += toCents(line.scheduledValue)
    totalCompletedAndStoredCents += toCents(result.totalCompletedAndStored)
    totalRetainageCents += toCents(result.retainageAmount + result.retainageOnStored)
    totalEarnedLessRetainageCents += toCents(result.line6)
    totalPreviousCertificatesCents += toCents(line.previousCertificates ?? 0)
    totalCurrentPaymentDueCents += toCents(result.currentPaymentDue)
  }

  // Override totals with payApp stored values if SOV lines are empty
  const originalContractCents = toCents(payApp.original_contract_sum ?? totalScheduledCents / 100)
  const netChangeCents = toCents(payApp.net_change_orders ?? 0)
  const contractSumToDateCents = originalContractCents + netChangeCents

  if (sovLines.length === 0) {
    totalCompletedAndStoredCents = toCents(payApp.total_completed_and_stored ?? 0)
    totalRetainageCents = toCents(payApp.retainage ?? 0)
    totalEarnedLessRetainageCents = toCents(payApp.total_earned_less_retainage ?? 0)
    totalPreviousCertificatesCents = toCents(payApp.less_previous_certificates ?? 0)
    totalCurrentPaymentDueCents = toCents(payApp.current_payment_due ?? 0)
  }

  const balanceToFinishCents = contractSumToDateCents - totalEarnedLessRetainageCents

  // ---------------------------------------------------------------------------
  // G702 Line Items Table
  // ---------------------------------------------------------------------------
  await drawText(page, 'CONTRACTOR\'S APPLICATION FOR PAYMENT', LEFT, y, fontBold, 10)
  y -= 14

  interface SummaryRow {
    lineNum: string
    label: string
    value: number
    bold?: boolean
    indent?: number
  }

  const summaryRows: SummaryRow[] = [
    { lineNum: '1.', label: 'ORIGINAL CONTRACT SUM', value: originalContractCents },
    { lineNum: '2.', label: 'NET CHANGE BY CHANGE ORDERS', value: netChangeCents },
    { lineNum: '3.', label: 'CONTRACT SUM TO DATE (Line 1 + or - 2)', value: contractSumToDateCents, bold: true },
    { lineNum: '4.', label: 'TOTAL COMPLETED AND STORED TO DATE', value: totalCompletedAndStoredCents },
    { lineNum: '5.', label: 'RETAINAGE HELD', value: totalRetainageCents, indent: 1 },
    { lineNum: '6.', label: 'TOTAL EARNED LESS RETAINAGE (Line 4 - Line 5)', value: totalEarnedLessRetainageCents },
    { lineNum: '7.', label: 'LESS PREVIOUS CERTIFICATES FOR PAYMENT', value: totalPreviousCertificatesCents },
    { lineNum: '8.', label: 'CURRENT PAYMENT DUE (Line 6 - Line 7)', value: totalCurrentPaymentDueCents, bold: true },
    { lineNum: '9.', label: 'BALANCE TO FINISH (Line 3 - Line 6)', value: balanceToFinishCents },
  ]

  // Column positions
  const numX = LEFT
  const labelX = LEFT + 22
  const valueX = RIGHT - 110
  const valueWidth = 105

  // Draw header rule
  drawHRule(page, LEFT, y, WIDTH, 0.5)
  y -= 2

  for (const row of summaryRows) {
    y -= 16
    const font = row.bold ? fontBold : fontReg
    const indentX = labelX + (row.indent ? 12 : 0)
    await drawText(page, row.lineNum, numX, y, fontBold, 8)
    await drawText(page, row.label, indentX, y, font, 8, valueX - indentX - 8)

    // Right-align value
    const valStr = fmtDollars(row.value)
    const valW = fontReg.widthOfTextAtSize(valStr, 9)
    await drawText(page, valStr, valueX + valueWidth - valW, y, font, 9)

    // Underline for totals
    if (row.bold) {
      drawHRule(page, valueX, y - 2, valueWidth, 0.75)
    }
  }

  y -= 8
  drawHRule(page, LEFT, y, WIDTH, 1)
  y -= 24

  // ---------------------------------------------------------------------------
  // Signature Blocks
  // ---------------------------------------------------------------------------
  await drawText(page, 'CONTRACTOR CERTIFICATION', LEFT, y, fontBold, 9)
  await drawText(page, 'ARCHITECT\'S CERTIFICATE FOR PAYMENT', col2, y, fontBold, 9)
  y -= 12

  const certText =
    'The undersigned Contractor certifies that to the best of the Contractor\'s ' +
    'knowledge, information and belief the Work covered by this Application for ' +
    'Payment has been completed in accordance with the Contract Documents, that all ' +
    'amounts have been paid by the Contractor for Work for which previous Certificates ' +
    'for Payment were issued and payments received from the Owner, and that current ' +
    'payment shown herein is now due.'

  // Word-wrap certification text in left column
  const wrapWidth = col2 - LEFT - 20
  const words = certText.split(' ')
  let line = ''
  let certY = y
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (fontReg.widthOfTextAtSize(test, 7) > wrapWidth && line) {
      await drawText(page, line, LEFT, certY, fontReg, 7)
      certY -= 10
      line = word
    } else {
      line = test
    }
  }
  if (line) {
    await drawText(page, line, LEFT, certY, fontReg, 7)
    certY -= 10
  }

  // Contractor signature area
  certY -= 10
  await drawText(page, 'CONTRACTOR:', LEFT, certY, fontBold, 8)
  await drawText(page, project.contractor, LEFT + 70, certY, fontReg, 8)
  certY -= 20
  drawHRule(page, LEFT, certY, 180, 0.5)
  certY -= 10
  await drawText(page, 'Signature', LEFT, certY, fontReg, 7)
  certY -= 20
  drawHRule(page, LEFT, certY, 100, 0.5)
  await drawText(page, LEFT + 110, certY, fontReg, 7)
  certY -= 10
  await drawText(page, 'Date', LEFT, certY, fontReg, 7)

  // Architect certification block (right column)
  let archY = y - 10
  await drawText(page, 'In accordance with the Contract Documents, based on on-site', col2, archY, fontReg, 7, RIGHT - col2)
  archY -= 10
  await drawText(page, 'observations and the data comprising the above application,', col2, archY, fontReg, 7, RIGHT - col2)
  archY -= 10
  await drawText(page, 'the Architect certifies to the Owner that to the best of the', col2, archY, fontReg, 7, RIGHT - col2)
  archY -= 10
  await drawText(page, 'Architect\'s knowledge, information and belief the Work has', col2, archY, fontReg, 7, RIGHT - col2)
  archY -= 10
  await drawText(page, 'progressed as indicated, the quality of Work is in accordance', col2, archY, fontReg, 7, RIGHT - col2)
  archY -= 10
  await drawText(page, 'with the Contract Documents, and the amount certified is', col2, archY, fontReg, 7, RIGHT - col2)
  archY -= 10
  await drawText(page, 'as noted below.', col2, archY, fontReg, 7, RIGHT - col2)
  archY -= 20
  await drawText(page, 'AMOUNT CERTIFIED:', col2, archY, fontBold, 9)
  const certAmt = fmtDollars(totalCurrentPaymentDueCents)
  await drawText(page, certAmt, col2 + 110, archY, fontBold, 9)
  archY -= 20
  await drawText(page, 'ARCHITECT:', col2, archY, fontBold, 8)
  await drawText(page, project.architect, col2 + 65, archY, fontReg, 8)
  archY -= 20
  drawHRule(page, col2, archY, 170, 0.5)
  archY -= 10
  await drawText(page, 'Signature', col2, archY, fontReg, 7)
  archY -= 20
  drawHRule(page, col2, archY, 100, 0.5)
  archY -= 10
  await drawText(page, 'Date', col2, archY, fontReg, 7)

  // Footer
  const footerY = 28
  drawHRule(page, LEFT, footerY + 10, WIDTH, 0.5)
  await drawText(
    page,
    'AIA Document G702 - Application and Certificate for Payment. Generated by SiteSync AI.',
    LEFT,
    footerY,
    fontReg,
    7,
    WIDTH,
  )

  return pdfDoc.save()
}

// ---------------------------------------------------------------------------
// Combined G702 + G703 export
// ---------------------------------------------------------------------------

/**
 * Pre-computed data shape accepted by generatePayAppPdf.
 * Designed to be constructed directly from G702Data and G703LineItem[]
 * already computed by the payment machine, avoiding re-computation drift.
 */
export interface PayAppPdfData {
  applicationNumber: number
  periodTo: string
  periodFrom?: string | null
  status: string
  projectName: string
  contractorName?: string
  ownerName?: string
  architectName?: string
  originalContractSum: number
  netChangeOrders: number
  contractSumToDate: number
  totalCompletedAndStored: number
  retainagePercent: number
  retainageAmount: number
  totalEarnedLessRetainage: number
  lessPreviousCertificates: number
  currentPaymentDue: number
  balanceToFinish: number
  sovLines?: Array<{
    itemNumber: string
    description: string
    scheduledValue: number
    previousCompleted: number
    thisPeroid: number
    materialsStored: number
    totalCompletedAndStored: number
    percentComplete: number
    balanceToFinish: number
    retainage: number
  }>
}

/**
 * Generates a combined AIA G702 + G703 PDF from pre-computed pay application data.
 * G702 summary is page 1; G703 continuation sheet follows on subsequent pages.
 * Returns a Blob suitable for browser download via URL.createObjectURL.
 */
export async function generatePayAppPdfFromData(data: PayAppPdfData): Promise<Blob> {
  const pdfDoc = await PDFDocument.create()
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // ── G702 Summary Page (US Letter portrait 612x792) ──────────────────────
  const g702Page = pdfDoc.addPage([612, 792])
  const L = 40
  const R = 572
  const W = R - L
  let y = 750

  await drawText(g702Page, 'AIA DOCUMENT G702', L, y, fontBold, 11)
  await drawText(g702Page, 'APPLICATION AND CERTIFICATE FOR PAYMENT', L + 170, y, fontReg, 11)
  y -= 14
  drawHRule(g702Page, L, y, W, 1)
  y -= 16

  const lbSz = 7
  const valSz = 9
  const col2 = L + 240

  const infoRows: Array<[string, string]> = [
    ['PROJECT:', data.projectName],
    ['OWNER:', data.ownerName ?? ''],
    ['ARCHITECT:', data.architectName ?? ''],
    ['CONTRACTOR:', data.contractorName ?? ''],
  ]
  for (const [lbl, val] of infoRows) {
    await drawText(g702Page, lbl, L, y, fontBold, lbSz)
    await drawText(g702Page, val, L + 70, y, fontReg, valSz, 160)
    y -= 13
  }

  let ry = 750 - 14 - 16
  const appRows: Array<[string, string]> = [
    ['APPLICATION NO:', String(data.applicationNumber)],
    ['PERIOD FROM:', data.periodFrom ?? ''],
    ['PERIOD TO:', data.periodTo],
    ['STATUS:', data.status.toUpperCase()],
  ]
  for (const [lbl, val] of appRows) {
    await drawText(g702Page, lbl, col2, ry, fontBold, lbSz)
    await drawText(g702Page, val, col2 + 100, ry, fontReg, valSz, 130)
    ry -= 13
  }

  y -= 8
  drawHRule(g702Page, L, y, W, 0.75)
  y -= 16
  await drawText(g702Page, "CONTRACTOR'S APPLICATION FOR PAYMENT", L, y, fontBold, 10)
  y -= 14

  interface SummaryRowDef { lineNum: string; label: string; value: number; bold?: boolean; indent?: boolean }
  const summaryRows: SummaryRowDef[] = [
    { lineNum: '1.', label: 'ORIGINAL CONTRACT SUM', value: toCents(data.originalContractSum) },
    { lineNum: '2.', label: 'NET CHANGE BY CHANGE ORDERS', value: toCents(data.netChangeOrders) },
    { lineNum: '3.', label: 'CONTRACT SUM TO DATE (Line 1 + or - 2)', value: toCents(data.contractSumToDate), bold: true },
    { lineNum: '4.', label: 'TOTAL COMPLETED AND STORED TO DATE', value: toCents(data.totalCompletedAndStored) },
    { lineNum: '5.', label: `RETAINAGE HELD (${data.retainagePercent.toFixed(0)}%)`, value: toCents(data.retainageAmount), indent: true },
    { lineNum: '6.', label: 'TOTAL EARNED LESS RETAINAGE (Line 4 - Line 5)', value: toCents(data.totalEarnedLessRetainage) },
    { lineNum: '7.', label: 'LESS PREVIOUS CERTIFICATES FOR PAYMENT', value: toCents(data.lessPreviousCertificates) },
    { lineNum: '8.', label: 'CURRENT PAYMENT DUE (Line 6 - Line 7)', value: toCents(data.currentPaymentDue), bold: true },
    { lineNum: '9.', label: 'BALANCE TO FINISH (Line 3 - Line 6)', value: toCents(data.balanceToFinish) },
  ]

  const numX = L
  const labelX = L + 22
  const valueX = R - 110
  const valueWidth = 105

  drawHRule(g702Page, L, y, W, 0.5)
  y -= 2
  for (const row of summaryRows) {
    y -= 16
    const font = row.bold ? fontBold : fontReg
    const indX = labelX + (row.indent ? 12 : 0)
    await drawText(g702Page, row.lineNum, numX, y, fontBold, 8)
    await drawText(g702Page, row.label, indX, y, font, 8, valueX - indX - 8)
    const valStr = fmtDollars(row.value)
    const valW = fontReg.widthOfTextAtSize(valStr, 9)
    await drawText(g702Page, valStr, valueX + valueWidth - valW, y, font, 9)
    if (row.bold) drawHRule(g702Page, valueX, y - 2, valueWidth, 0.75)
  }

  y -= 8
  drawHRule(g702Page, L, y, W, 1)
  y -= 24

  await drawText(g702Page, 'CONTRACTOR CERTIFICATION', L, y, fontBold, 9)
  await drawText(g702Page, "ARCHITECT'S CERTIFICATE FOR PAYMENT", col2, y, fontBold, 9)
  y -= 40
  drawHRule(g702Page, L, y, 180, 0.5)
  await drawText(g702Page, 'Contractor Signature', L, y - 10, fontReg, 7)
  drawHRule(g702Page, col2, y, 180, 0.5)
  await drawText(g702Page, 'Architect Signature', col2, y - 10, fontReg, 7)

  const footerY = 28
  drawHRule(g702Page, L, footerY + 10, W, 0.5)
  await drawText(
    g702Page,
    'AIA Document G702 - Application and Certificate for Payment. Generated by SiteSync AI.',
    L, footerY, fontReg, 7, W,
  )

  // ── G703 Continuation Pages (landscape 792x612) ──────────────────────────
  const sovLines = data.sovLines ?? []
  if (sovLines.length > 0) {
    const PW = 792
    const PH = 612
    const MG = 28
    const TW = PW - MG * 2

    interface G703ColDef { label1: string; label2: string; width: number; align: 'left' | 'right' }
    const cols: G703ColDef[] = [
      { label1: 'ITEM', label2: '#', width: 30, align: 'left' },
      { label1: 'DESCRIPTION', label2: 'OF WORK', width: 140, align: 'left' },
      { label1: 'SCHEDULED', label2: 'VALUE', width: 72, align: 'right' },
      { label1: 'WORK COMPLETED', label2: 'PREVIOUS', width: 72, align: 'right' },
      { label1: 'WORK COMPLETED', label2: 'THIS PERIOD', width: 72, align: 'right' },
      { label1: 'MATERIALS', label2: 'STORED', width: 68, align: 'right' },
      { label1: 'TOTAL COMPLETED', label2: '& STORED', width: 72, align: 'right' },
      { label1: '%', label2: 'COMPLETE', width: 50, align: 'right' },
      { label1: 'BALANCE TO', label2: 'FINISH', width: 70, align: 'right' },
      { label1: 'RETAINAGE', label2: '', width: 70, align: 'right' },
    ]
    const sumW = cols.reduce((s, c) => s + c.width, 0)
    cols[cols.length - 1].width += TW - sumW

    const HEADER_H = 32
    const ROW_H = 16
    const ROWS_PER_PAGE = Math.floor((PH - MG * 2 - HEADER_H - 30) / ROW_H)
    const totalPages = Math.max(1, Math.ceil((sovLines.length + 1) / ROWS_PER_PAGE))

    const totSV = sovLines.reduce((s, l) => s + l.scheduledValue, 0)
    const totPrev = sovLines.reduce((s, l) => s + l.previousCompleted, 0)
    const totThis = sovLines.reduce((s, l) => s + l.thisPeroid, 0)
    const totStored = sovLines.reduce((s, l) => s + l.materialsStored, 0)
    const totTotal = sovLines.reduce((s, l) => s + l.totalCompletedAndStored, 0)
    const totBal = sovLines.reduce((s, l) => s + l.balanceToFinish, 0)
    const totRet = sovLines.reduce((s, l) => s + l.retainage, 0)
    const totPct = totSV > 0 ? totTotal / totSV : 0

    for (let pi = 0; pi < totalPages; pi++) {
      const pg = pdfDoc.addPage([PW, PH])
      let py = PH - MG

      await drawText(pg, 'AIA DOCUMENT G703 - CONTINUATION SHEET', MG, py, fontBold, 11)
      const pgLabel = 'Page ' + (pi + 1) + ' of ' + totalPages
      const pgLW = fontReg.widthOfTextAtSize(pgLabel, 9)
      await drawText(pg, pgLabel, PW - MG - pgLW, py, fontReg, 9)
      py -= 14

      let cx = MG
      drawHRule(pg, MG, py, TW, 0.75)
      py -= 1
      for (const col of cols) {
        const l1W = fontBold.widthOfTextAtSize(col.label1, 7)
        const l2W = fontBold.widthOfTextAtSize(col.label2, 7)
        const x1 = col.align === 'right' ? cx + col.width - l1W - 2 : cx + 2
        const x2 = col.align === 'right' ? cx + col.width - l2W - 2 : cx + 2
        await drawText(pg, col.label1, x1, py - 10, fontBold, 7)
        await drawText(pg, col.label2, x2, py - 20, fontBold, 7)
        cx += col.width
      }
      py -= HEADER_H
      drawHRule(pg, MG, py, TW, 0.75)

      const startIdx = pi * ROWS_PER_PAGE
      const endIdx = Math.min(startIdx + ROWS_PER_PAGE, sovLines.length)

      for (let i = startIdx; i < endIdx; i++) {
        const sl = sovLines[i]
        py -= ROW_H
        const cells: string[] = [
          sl.itemNumber,
          sl.description,
          fmtDollars(toCents(sl.scheduledValue)),
          fmtDollars(toCents(sl.previousCompleted)),
          fmtDollars(toCents(sl.thisPeroid)),
          fmtDollars(toCents(sl.materialsStored)),
          fmtDollars(toCents(sl.totalCompletedAndStored)),
          fmtPct(sl.percentComplete),
          fmtDollars(toCents(sl.balanceToFinish)),
          fmtDollars(toCents(sl.retainage)),
        ]
        let cellX = MG
        for (let c = 0; c < cols.length; c++) {
          const col = cols[c]
          const s = cells[c] ?? ''
          const mxW = col.width - 4
          if (col.align === 'right') {
            const tw = fontReg.widthOfTextAtSize(s, 8)
            await drawText(pg, s, cellX + col.width - tw - 2, py, fontReg, 8, mxW)
          } else {
            await drawText(pg, s, cellX + 2, py, fontReg, 8, mxW)
          }
          cellX += col.width
        }
        if (i < endIdx - 1) drawHRule(pg, MG, py - 3, TW, 0.25)
      }

      if (endIdx === sovLines.length) {
        py -= ROW_H
        drawHRule(pg, MG, py + ROW_H - 2, TW, 1)
        const totCells: string[] = [
          '', 'TOTALS',
          fmtDollars(toCents(totSV)),
          fmtDollars(toCents(totPrev)),
          fmtDollars(toCents(totThis)),
          fmtDollars(toCents(totStored)),
          fmtDollars(toCents(totTotal)),
          fmtPct(totPct),
          fmtDollars(toCents(totBal)),
          fmtDollars(toCents(totRet)),
        ]
        let totX = MG
        for (let c = 0; c < cols.length; c++) {
          const col = cols[c]
          const s = totCells[c] ?? ''
          const mxW = col.width - 4
          if (col.align === 'right') {
            const tw = fontBold.widthOfTextAtSize(s, 8)
            await drawText(pg, s, totX + col.width - tw - 2, py, fontBold, 8, mxW)
          } else {
            await drawText(pg, s, totX + 2, py, fontBold, 8, mxW)
          }
          totX += col.width
        }
        drawHRule(pg, MG, py - 4, TW, 1)
      }

      const fY = MG - 10
      await drawText(pg, 'AIA Document G703 - Continuation Sheet. Generated by SiteSync AI.', MG, fY, fontReg, 7, TW)
    }
  }

  const bytes = await pdfDoc.save()
  return new Blob([bytes], { type: 'application/pdf' })
}

// ---------------------------------------------------------------------------
// G703 Continuation Sheet
// ---------------------------------------------------------------------------

/**
 * Generates an AIA G703 Continuation Sheet showing all SOV line items.
 * Returns a valid PDF as a Uint8Array suitable for download.
 *
 * Columns: Item #, Description, Scheduled Value, Work Completed Previous,
 * Work Completed This Period, Materials Stored, Total Completed & Stored,
 * % Complete, Balance to Finish, Retainage.

// ---------------------------------------------------------------------------
// Public convenience API: generatePayAppPdf
// ---------------------------------------------------------------------------

/**
 * Generates a combined AIA G702 + G703 PDF for a pay application.
 *
 * Accepts raw PayApplication and PaymentLineItem[] records and derives all
 * G702 summary figures by summing per-line computations via
 * computeCurrentPaymentDue. Returns a Blob suitable for browser download.
 *
 * All monetary arithmetic uses integer cents internally to avoid
 * floating-point drift (inputs are dollars; outputs are formatted dollars).
 */
export async function generatePayAppPdf(
  payApp: PayApplication,
  lineItems: PaymentLineItem[],
  projectName: string,
): Promise<Blob> {
  // Compute per-line values and aggregate G702 totals
  let totalCompletedAndStoredCents = 0
  let totalRetainageCents = 0
  let totalEarnedLessRetainageCents = 0
  let totalPrevCertCents = 0
  let totalCurrentDueCents = 0

  const sovLines: PayAppPdfData['sovLines'] = lineItems.map((item) => {
    const result = computeCurrentPaymentDue({
      scheduledValue: item.scheduledValue,
      prevPctComplete: item.prevPctComplete,
      currentPctComplete: item.currentPctComplete,
      storedMaterials: item.storedMaterials,
      retainageRate: item.retainageRate,
      previousCertificates: item.previousCertificates ?? 0,
      storedMaterialRetainageRate: item.storedMaterialRetainageRate ?? 0,
    })

    const scheduledCents = toCents(item.scheduledValue)
    const prevCents = toCents(item.scheduledValue * item.prevPctComplete)
    const totalCents = toCents(result.totalCompletedAndStored)
    const retainageCents = toCents(result.retainageAmount + result.retainageOnStored)
    const balanceCents = scheduledCents - totalCents
    const pctComplete = item.scheduledValue > 0
      ? result.totalCompletedAndStored / item.scheduledValue
      : item.currentPctComplete

    totalCompletedAndStoredCents += totalCents
    totalRetainageCents += retainageCents
    totalEarnedLessRetainageCents += toCents(result.line6)
    totalPrevCertCents += toCents(item.previousCertificates ?? 0)
    totalCurrentDueCents += toCents(result.currentPaymentDue)

    return {
      itemNumber: item.itemNumber,
      description: item.description,
      scheduledValue: item.scheduledValue,
      previousCompleted: prevCents / 100,
      thisPeroid: result.workThisPeriod,
      materialsStored: item.storedMaterials,
      totalCompletedAndStored: result.totalCompletedAndStored,
      percentComplete: pctComplete,
      balanceToFinish: balanceCents / 100,
      retainage: result.retainageAmount + result.retainageOnStored,
    }
  })

  const originalContractCents = toCents(payApp.original_contract_sum ?? 0)
  const netChangeCents = toCents(payApp.net_change_orders ?? 0)
  const contractSumToDateCents = originalContractCents + netChangeCents
  const retainagePct = lineItems.length > 0
    ? (lineItems.reduce((s, l) => s + l.retainageRate, 0) / lineItems.length) * 100
    : 0
  const balanceToFinishCents = contractSumToDateCents - totalEarnedLessRetainageCents

  const data: PayAppPdfData = {
    applicationNumber: payApp.application_number,
    periodTo: payApp.period_to,
    periodFrom: payApp.period_from,
    status: payApp.status,
    projectName,
    originalContractSum: originalContractCents / 100,
    netChangeOrders: netChangeCents / 100,
    contractSumToDate: contractSumToDateCents / 100,
    totalCompletedAndStored: totalCompletedAndStoredCents / 100,
    retainagePercent: retainagePct,
    retainageAmount: totalRetainageCents / 100,
    totalEarnedLessRetainage: totalEarnedLessRetainageCents / 100,
    lessPreviousCertificates: totalPrevCertCents / 100,
    currentPaymentDue: totalCurrentDueCents / 100,
    balanceToFinish: balanceToFinishCents / 100,
    sovLines: sovLines.length > 0 ? sovLines : undefined,
  }

  return generatePayAppPdfFromData(data)
}

// ---------------------------------------------------------------------------
// Simple flat-param exports (task-specified API)
// ---------------------------------------------------------------------------

export interface G702Params {
  projectName: string
  contractorName: string
  architectName: string
  applicationNumber: number
  periodFrom: string
  periodTo: string
  originalContractSum: number
  netChangeByChangeOrders: number
  contractSumToDate: number
  totalCompletedAndStored: number
  retainagePercent: number
  retainageAmount: number
  totalEarnedLessRetainage: number
  lessPreviousCertificates: number
  currentPaymentDue: number
  balanceToFinish: number
}

export interface G703LineItemParam {
  itemNumber: string
  description: string
  scheduledValue: number
  workCompletedPrevious: number
  workCompletedThisPeriod: number
  materialsStored: number
  totalCompletedAndStored: number
  percentComplete: number
  balanceToFinish: number
  retainage: number
}

export interface G703Params {
  applicationNumber: number
  lineItems: G703LineItemParam[]
}

/**
 * Generates an AIA G702 Application and Certificate for Payment.
 * All monetary values should be in dollars. Returns PDF bytes as Uint8Array.
 */
export async function generateG702Pdf(params: G702Params): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const page = pdfDoc.addPage([612, 792]) // US Letter portrait
  const L = 40
  const R = 572
  const W = R - L
  let y = 750

  // Header
  await drawText(page, 'AIA DOCUMENT G702', L, y, fontBold, 11)
  await drawText(page, 'APPLICATION AND CERTIFICATE FOR PAYMENT', L + 170, y, fontReg, 11)
  y -= 14
  drawHRule(page, L, y, W, 1)
  y -= 16

  const lbSz = 7
  const valSz = 9
  const col2 = L + 240

  // Left column: project info
  const infoRows: Array<[string, string]> = [
    ['PROJECT:', params.projectName],
    ['CONTRACTOR:', params.contractorName],
    ['ARCHITECT:', params.architectName],
  ]
  for (const [lbl, val] of infoRows) {
    await drawText(page, lbl, L, y, fontBold, lbSz)
    await drawText(page, val, L + 70, y, fontReg, valSz, 160)
    y -= 13
  }

  // Right column: application info
  let ry = 750 - 14 - 16
  const appRows: Array<[string, string]> = [
    ['APPLICATION NO:', String(params.applicationNumber)],
    ['PERIOD FROM:', params.periodFrom],
    ['PERIOD TO:', params.periodTo],
  ]
  for (const [lbl, val] of appRows) {
    await drawText(page, lbl, col2, ry, fontBold, lbSz)
    await drawText(page, val, col2 + 100, ry, fontReg, valSz, 130)
    ry -= 13
  }

  y -= 8
  drawHRule(page, L, y, W, 0.75)
  y -= 16
  await drawText(page, "CONTRACTOR'S APPLICATION FOR PAYMENT", L, y, fontBold, 10)
  y -= 14

  interface SRow { lineNum: string; label: string; valueCents: number; bold?: boolean; indent?: boolean }
  const summaryRows: SRow[] = [
    { lineNum: '1.', label: 'ORIGINAL CONTRACT SUM', valueCents: toCents(params.originalContractSum) },
    { lineNum: '2.', label: 'NET CHANGE BY CHANGE ORDERS', valueCents: toCents(params.netChangeByChangeOrders) },
    { lineNum: '3.', label: 'CONTRACT SUM TO DATE (Line 1 + or - 2)', valueCents: toCents(params.contractSumToDate), bold: true },
    { lineNum: '4.', label: 'TOTAL COMPLETED AND STORED TO DATE', valueCents: toCents(params.totalCompletedAndStored) },
    { lineNum: '5.', label: `RETAINAGE HELD (${params.retainagePercent.toFixed(0)}%)`, valueCents: toCents(params.retainageAmount), indent: true },
    { lineNum: '6.', label: 'TOTAL EARNED LESS RETAINAGE (Line 4 - Line 5)', valueCents: toCents(params.totalEarnedLessRetainage) },
    { lineNum: '7.', label: 'LESS PREVIOUS CERTIFICATES FOR PAYMENT', valueCents: toCents(params.lessPreviousCertificates) },
    { lineNum: '8.', label: 'CURRENT PAYMENT DUE (Line 6 - Line 7)', valueCents: toCents(params.currentPaymentDue), bold: true },
    { lineNum: '9.', label: 'BALANCE TO FINISH INCLUDING RETAINAGE', valueCents: toCents(params.balanceToFinish) },
  ]

  const numX = L
  const labelX = L + 22
  const valueX = R - 110
  const valueWidth = 105

  drawHRule(page, L, y, W, 0.5)
  y -= 2
  for (const row of summaryRows) {
    y -= 16
    const font = row.bold ? fontBold : fontReg
    const indX = labelX + (row.indent ? 12 : 0)
    await drawText(page, row.lineNum, numX, y, fontBold, 8)
    await drawText(page, row.label, indX, y, font, 8, valueX - indX - 8)
    const valStr = fmtDollars(row.valueCents)
    const valW = fontReg.widthOfTextAtSize(valStr, 9)
    await drawText(page, valStr, valueX + valueWidth - valW, y, font, 9)
    if (row.bold) drawHRule(page, valueX, y - 2, valueWidth, 0.75)
  }

  y -= 8
  drawHRule(page, L, y, W, 1)
  y -= 24

  // Signature blocks
  await drawText(page, 'CONTRACTOR CERTIFICATION', L, y, fontBold, 9)
  await drawText(page, "ARCHITECT'S CERTIFICATE FOR PAYMENT", col2, y, fontBold, 9)
  y -= 16

  // Contractor certification text (word-wrapped)
  const certText =
    "The undersigned Contractor certifies that to the best of the Contractor's " +
    'knowledge, information and belief the Work covered by this Application for ' +
    'Payment has been completed in accordance with the Contract Documents.'
  const wrapWidth = col2 - L - 20
  const words = certText.split(' ')
  let certLine = ''
  let certY = y
  for (const word of words) {
    const test = certLine ? certLine + ' ' + word : word
    if (fontReg.widthOfTextAtSize(test, 7) > wrapWidth && certLine) {
      await drawText(page, certLine, L, certY, fontReg, 7)
      certY -= 10
      certLine = word
    } else {
      certLine = test
    }
  }
  if (certLine) {
    await drawText(page, certLine, L, certY, fontReg, 7)
    certY -= 10
  }

  certY -= 8
  await drawText(page, 'CONTRACTOR:', L, certY, fontBold, 8)
  await drawText(page, params.contractorName, L + 70, certY, fontReg, 8, 140)
  certY -= 20
  drawHRule(page, L, certY, 180, 0.5)
  certY -= 10
  await drawText(page, 'Signature', L, certY, fontReg, 7)
  certY -= 18
  drawHRule(page, L, certY, 100, 0.5)
  certY -= 10
  await drawText(page, 'Date', L, certY, fontReg, 7)

  // Architect block
  let archY = y - 4
  const archLines = [
    'In accordance with the Contract Documents, based on on-site',
    'observations and the data comprising the above application,',
    'the Architect certifies to the Owner that the Work has',
    'progressed as indicated.',
  ]
  for (const line of archLines) {
    await drawText(page, line, col2, archY, fontReg, 7, R - col2)
    archY -= 10
  }
  archY -= 10
  await drawText(page, 'AMOUNT CERTIFIED:', col2, archY, fontBold, 9)
  const certAmt = fmtDollars(toCents(params.currentPaymentDue))
  await drawText(page, certAmt, col2 + 110, archY, fontBold, 9)
  archY -= 20
  await drawText(page, 'ARCHITECT:', col2, archY, fontBold, 8)
  await drawText(page, params.architectName, col2 + 65, archY, fontReg, 8, R - col2 - 65)
  archY -= 20
  drawHRule(page, col2, archY, 170, 0.5)
  archY -= 10
  await drawText(page, 'Signature', col2, archY, fontReg, 7)
  archY -= 18
  drawHRule(page, col2, archY, 100, 0.5)
  archY -= 10
  await drawText(page, 'Date', col2, archY, fontReg, 7)

  // Footer
  const footerY = 28
  drawHRule(page, L, footerY + 10, W, 0.5)
  await drawText(
    page,
    'AIA Document G702. Application Number ' + params.applicationNumber + '. Generated by SiteSync AI.',
    L, footerY, fontReg, 7, W,
  )

  return pdfDoc.save()
}

/**
 * Generates an AIA G703 Continuation Sheet with SOV line items.
 * All monetary values should be in dollars. Returns PDF bytes as Uint8Array.
 * Produces multiple landscape pages if needed, with running totals on the last page.
 */
export async function generateG703Pdf(params: G703Params): Promise<Uint8Array> {
  const { applicationNumber, lineItems } = params
  const pdfDoc = await PDFDocument.create()
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const PAGE_W = 792
  const PAGE_H = 612
  const MARGIN = 28
  const TABLE_W = PAGE_W - MARGIN * 2

  interface ColDef { label1: string; label2: string; width: number; align: 'left' | 'right' }
  const cols: ColDef[] = [
    { label1: 'ITEM', label2: '#', width: 30, align: 'left' },
    { label1: 'DESCRIPTION', label2: 'OF WORK', width: 140, align: 'left' },
    { label1: 'SCHEDULED', label2: 'VALUE', width: 72, align: 'right' },
    { label1: 'WORK COMPLETED', label2: 'PREVIOUS', width: 72, align: 'right' },
    { label1: 'WORK COMPLETED', label2: 'THIS PERIOD', width: 72, align: 'right' },
    { label1: 'MATERIALS', label2: 'STORED', width: 68, align: 'right' },
    { label1: 'TOTAL COMPLETED', label2: '& STORED', width: 72, align: 'right' },
    { label1: '%', label2: 'COMPLETE', width: 50, align: 'right' },
    { label1: 'BALANCE TO', label2: 'FINISH', width: 70, align: 'right' },
    { label1: 'RETAINAGE', label2: '', width: 70, align: 'right' },
  ]
  const sumW = cols.reduce((s, c) => s + c.width, 0)
  cols[cols.length - 1].width += TABLE_W - sumW

  const HEADER_H = 32
  const ROW_H = 16
  const ROWS_PER_PAGE = Math.floor((PAGE_H - MARGIN * 2 - HEADER_H - 30) / ROW_H)
  const totalPages = Math.max(1, Math.ceil((lineItems.length + 1) / ROWS_PER_PAGE))

  // Running totals (cents)
  const totSV = lineItems.reduce((s, l) => s + toCents(l.scheduledValue), 0)
  const totPrev = lineItems.reduce((s, l) => s + toCents(l.workCompletedPrevious), 0)
  const totThis = lineItems.reduce((s, l) => s + toCents(l.workCompletedThisPeriod), 0)
  const totStored = lineItems.reduce((s, l) => s + toCents(l.materialsStored), 0)
  const totTotal = lineItems.reduce((s, l) => s + toCents(l.totalCompletedAndStored), 0)
  const totBal = lineItems.reduce((s, l) => s + toCents(l.balanceToFinish), 0)
  const totRet = lineItems.reduce((s, l) => s + toCents(l.retainage), 0)
  const totPct = totSV > 0 ? totTotal / totSV : 0

  for (let pi = 0; pi < totalPages; pi++) {
    const pg = pdfDoc.addPage([PAGE_W, PAGE_H])
    let py = PAGE_H - MARGIN

    // Page header
    await drawText(pg, 'AIA DOCUMENT G703 - CONTINUATION SHEET', MARGIN, py, fontBold, 11)
    await drawText(pg, 'Application No: ' + applicationNumber, MARGIN + 340, py, fontReg, 9)
    const pgLabel = 'Page ' + (pi + 1) + ' of ' + totalPages
    const pgLW = fontReg.widthOfTextAtSize(pgLabel, 9)
    await drawText(pg, pgLabel, PAGE_W - MARGIN - pgLW, py, fontReg, 9)
    py -= 14

    // Column headers
    let cx = MARGIN
    drawHRule(pg, MARGIN, py, TABLE_W, 0.75)
    py -= 1
    for (const col of cols) {
      const l1W = fontBold.widthOfTextAtSize(col.label1, 7)
      const l2W = fontBold.widthOfTextAtSize(col.label2, 7)
      const x1 = col.align === 'right' ? cx + col.width - l1W - 2 : cx + 2
      const x2 = col.align === 'right' ? cx + col.width - l2W - 2 : cx + 2
      await drawText(pg, col.label1, x1, py - 10, fontBold, 7)
      await drawText(pg, col.label2, x2, py - 20, fontBold, 7)
      cx += col.width
    }
    py -= HEADER_H
    drawHRule(pg, MARGIN, py, TABLE_W, 0.75)

    const startIdx = pi * ROWS_PER_PAGE
    const endIdx = Math.min(startIdx + ROWS_PER_PAGE, lineItems.length)

    for (let i = startIdx; i < endIdx; i++) {
      const item = lineItems[i]
      py -= ROW_H
      const cells: string[] = [
        item.itemNumber,
        item.description,
        fmtDollars(toCents(item.scheduledValue)),
        fmtDollars(toCents(item.workCompletedPrevious)),
        fmtDollars(toCents(item.workCompletedThisPeriod)),
        fmtDollars(toCents(item.materialsStored)),
        fmtDollars(toCents(item.totalCompletedAndStored)),
        fmtPct(item.percentComplete / 100),
        fmtDollars(toCents(item.balanceToFinish)),
        fmtDollars(toCents(item.retainage)),
      ]
      let cellX = MARGIN
      for (let c = 0; c < cols.length; c++) {
        const col = cols[c]
        const s = cells[c] ?? ''
        const mxW = col.width - 4
        if (col.align === 'right') {
          const tw = fontReg.widthOfTextAtSize(s, 8)
          await drawText(pg, s, cellX + col.width - tw - 2, py, fontReg, 8, mxW)
        } else {
          await drawText(pg, s, cellX + 2, py, fontReg, 8, mxW)
        }
        cellX += col.width
      }
      if (i < endIdx - 1) drawHRule(pg, MARGIN, py - 3, TABLE_W, 0.25)
    }

    // Totals row on last page
    if (endIdx === lineItems.length) {
      py -= ROW_H
      drawHRule(pg, MARGIN, py + ROW_H - 2, TABLE_W, 1)
      const totCells: string[] = [
        '', 'TOTALS',
        fmtDollars(totSV),
        fmtDollars(totPrev),
        fmtDollars(totThis),
        fmtDollars(totStored),
        fmtDollars(totTotal),
        fmtPct(totPct),
        fmtDollars(totBal),
        fmtDollars(totRet),
      ]
      let totX = MARGIN
      for (let c = 0; c < cols.length; c++) {
        const col = cols[c]
        const s = totCells[c] ?? ''
        const mxW = col.width - 4
        if (col.align === 'right') {
          const tw = fontBold.widthOfTextAtSize(s, 8)
          await drawText(pg, s, totX + col.width - tw - 2, py, fontBold, 8, mxW)
        } else {
          await drawText(pg, s, totX + 2, py, fontBold, 8, mxW)
        }
        totX += col.width
      }
      drawHRule(pg, MARGIN, py - 4, TABLE_W, 1)
    }

    const fY = MARGIN - 10
    await drawText(
      pg,
      'AIA Document G703 - Continuation Sheet. Application No ' + applicationNumber + '. Generated by SiteSync AI.',
      MARGIN, fY, fontReg, 7, TABLE_W,
    )
  }

  return pdfDoc.save()
}

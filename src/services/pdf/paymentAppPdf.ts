import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import type { PayApplication } from '../../types/api'
import { computeCurrentPaymentDue } from '../../api/endpoints/payApplications'

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
 */
export async function generateG702Pdf(
  payApp: PayApplication,
  project: {
    name: string
    address: string
    owner: string
    architect: string
    contractor: string
  },
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
// G703 Continuation Sheet
// ---------------------------------------------------------------------------

/**
 * Generates an AIA G703 Continuation Sheet showing all SOV line items.
 * Returns a valid PDF as a Uint8Array suitable for download.
 *
 * Columns: Item #, Description, Scheduled Value, Work Completed Previous,
 * Work Completed This Period, Materials Stored, Total Completed & Stored,
 * % Complete, Balance to Finish, Retainage.
 */
export async function generateG703Pdf(sovLines: PayAppLineItem[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // Column layout (landscape letter: 792 x 612)
  const PAGE_W = 792
  const PAGE_H = 612
  const MARGIN = 28
  const TABLE_W = PAGE_W - MARGIN * 2

  // Column definitions: [label (two lines), width, align]
  interface ColDef {
    label1: string
    label2: string
    width: number
    align: 'left' | 'right'
  }

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

  // Verify column widths sum to TABLE_W (adjust last col if needed)
  const sumWidths = cols.reduce((s, c) => s + c.width, 0)
  cols[cols.length - 1].width += TABLE_W - sumWidths

  const HEADER_H = 32
  const ROW_H = 16
  const ROWS_PER_PAGE = Math.floor((PAGE_H - MARGIN * 2 - HEADER_H - 30) / ROW_H)

  // ---------------------------------------------------------------------------
  // Compute line-level values
  // ---------------------------------------------------------------------------
  interface ComputedLine {
    itemNumber: string
    description: string
    scheduledCents: number
    prevWorkCents: number
    thisWorkCents: number
    storedCents: number
    totalCents: number
    pctComplete: number
    balanceCents: number
    retainageCents: number
  }

  const computed: ComputedLine[] = sovLines.map((line) => {
    const result = computeCurrentPaymentDue({
      scheduledValue: line.scheduledValue,
      prevPctComplete: line.prevPctComplete,
      currentPctComplete: line.currentPctComplete,
      storedMaterials: line.storedMaterials,
      retainageRate: line.retainageRate,
      previousCertificates: line.previousCertificates ?? 0,
      storedMaterialRetainageRate: line.storedMaterialRetainageRate ?? 0,
    })
    const scheduledCents = toCents(line.scheduledValue)
    const prevWorkCents = toCents(line.scheduledValue * line.prevPctComplete)
    const thisWorkCents = toCents(result.workThisPeriod)
    const storedCents = toCents(line.storedMaterials)
    const totalCents = toCents(result.totalCompletedAndStored)
    const retainageCents = toCents(result.retainageAmount + result.retainageOnStored)
    const balanceCents = scheduledCents - toCents(result.line6)
    const pctComplete = line.scheduledValue > 0
      ? result.totalCompletedAndStored / line.scheduledValue
      : 0

    return {
      itemNumber: line.itemNumber,
      description: line.description,
      scheduledCents,
      prevWorkCents,
      thisWorkCents,
      storedCents,
      totalCents,
      pctComplete,
      balanceCents,
      retainageCents,
    }
  })

  // Running totals
  const totals: Omit<ComputedLine, 'itemNumber' | 'description' | 'pctComplete'> & { pctComplete: number } = {
    scheduledCents: computed.reduce((s, r) => s + r.scheduledCents, 0),
    prevWorkCents: computed.reduce((s, r) => s + r.prevWorkCents, 0),
    thisWorkCents: computed.reduce((s, r) => s + r.thisWorkCents, 0),
    storedCents: computed.reduce((s, r) => s + r.storedCents, 0),
    totalCents: computed.reduce((s, r) => s + r.totalCents, 0),
    pctComplete: 0,
    balanceCents: computed.reduce((s, r) => s + r.balanceCents, 0),
    retainageCents: computed.reduce((s, r) => s + r.retainageCents, 0),
  }
  totals.pctComplete = totals.scheduledCents > 0
    ? (totals.totalCents / totals.scheduledCents)
    : 0

  // ---------------------------------------------------------------------------
  // Draw pages
  // ---------------------------------------------------------------------------
  const totalPages = Math.max(1, Math.ceil((computed.length + 1) / ROWS_PER_PAGE)) // +1 for totals row

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H])
    let y = PAGE_H - MARGIN

    // Page header
    await drawText(page, 'AIA DOCUMENT G703 - CONTINUATION SHEET', MARGIN, y, fontBold, 11)
    const pageLabel = 'Page ' + (pageIdx + 1) + ' of ' + totalPages
    const pageLabelW = fontReg.widthOfTextAtSize(pageLabel, 9)
    await drawText(page, pageLabel, PAGE_W - MARGIN - pageLabelW, y, fontReg, 9)
    y -= 14

    // Column headers (two-line)
    let cx = MARGIN
    drawHRule(page, MARGIN, y, TABLE_W, 0.75)
    y -= 1

    for (const col of cols) {
      const l1W = fontBold.widthOfTextAtSize(col.label1, 7)
      const l2W = fontBold.widthOfTextAtSize(col.label2, 7)
      const x1 = col.align === 'right' ? cx + col.width - l1W - 2 : cx + 2
      const x2 = col.align === 'right' ? cx + col.width - l2W - 2 : cx + 2
      await drawText(page, col.label1, x1, y - 10, fontBold, 7)
      await drawText(page, col.label2, x2, y - 20, fontBold, 7)
      cx += col.width
    }
    y -= HEADER_H
    drawHRule(page, MARGIN, y, TABLE_W, 0.75)

    // Data rows
    const startIdx = pageIdx * ROWS_PER_PAGE
    const endIdx = Math.min(startIdx + ROWS_PER_PAGE, computed.length)

    for (let i = startIdx; i < endIdx; i++) {
      const row = computed[i]
      y -= ROW_H

      const cells: string[] = [
        row.itemNumber,
        row.description,
        fmtDollars(row.scheduledCents),
        fmtDollars(row.prevWorkCents),
        fmtDollars(row.thisWorkCents),
        fmtDollars(row.storedCents),
        fmtDollars(row.totalCents),
        fmtPct(row.pctComplete),
        fmtDollars(row.balanceCents),
        fmtDollars(row.retainageCents),
      ]

      let cellX = MARGIN
      for (let c = 0; c < cols.length; c++) {
        const col = cols[c]
        const cellStr = cells[c] ?? ''
        const maxW = col.width - 4
        if (col.align === 'right') {
          const tw = fontReg.widthOfTextAtSize(cellStr, 8)
          await drawText(page, cellStr, cellX + col.width - tw - 2, y, fontReg, 8, maxW)
        } else {
          await drawText(page, cellStr, cellX + 2, y, fontReg, 8, maxW)
        }
        cellX += col.width
      }

      // Light row separator
      if (i < endIdx - 1) {
        drawHRule(page, MARGIN, y - 3, TABLE_W, 0.25)
      }
    }

    // Totals row on last page
    const isLastPage = pageIdx === totalPages - 1
    const hasRoomForTotals = endIdx === computed.length
    if (isLastPage || hasRoomForTotals) {
      if (endIdx === computed.length) {
        y -= ROW_H
        drawHRule(page, MARGIN, y + ROW_H - 2, TABLE_W, 1)

        const totalCells: string[] = [
          '',
          'TOTALS',
          fmtDollars(totals.scheduledCents),
          fmtDollars(totals.prevWorkCents),
          fmtDollars(totals.thisWorkCents),
          fmtDollars(totals.storedCents),
          fmtDollars(totals.totalCents),
          fmtPct(totals.pctComplete),
          fmtDollars(totals.balanceCents),
          fmtDollars(totals.retainageCents),
        ]

        let totalX = MARGIN
        for (let c = 0; c < cols.length; c++) {
          const col = cols[c]
          const cellStr = totalCells[c] ?? ''
          const maxW = col.width - 4
          if (col.align === 'right') {
            const tw = fontBold.widthOfTextAtSize(cellStr, 8)
            await drawText(page, cellStr, totalX + col.width - tw - 2, y, fontBold, 8, maxW)
          } else {
            await drawText(page, cellStr, totalX + 2, y, fontBold, 8, maxW)
          }
          totalX += col.width
        }

        drawHRule(page, MARGIN, y - 4, TABLE_W, 1)
      }
    }

    // Footer
    const footerY = MARGIN - 10
    await drawText(
      page,
      'AIA Document G703 - Continuation Sheet. Generated by SiteSync AI.',
      MARGIN,
      footerY,
      fontReg,
      7,
      TABLE_W,
    )
  }

  return pdfDoc.save()
}

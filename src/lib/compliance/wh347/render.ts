// =============================================================================
// WH-347 renderer — text + PDF
// =============================================================================
// Two outputs:
//   1. renderText() — deterministic plain-text (the legal-review copy and
//      what we test against; same approach Tab C uses for AIA forms).
//   2. renderPdf() — pdf-lib output matching DOL form layout (see notes
//      below). Identical content from the same input.
//
// PDF layout philosophy (matching the DOL printed form 1:1):
//   • Page 1 — Header band, then a 13-column table per worker:
//       Name/SSN | Classification | Day-of-week (7 cols) | Total Hours |
//       Rate | Gross Earned | Deductions | Net Earned
//     Worker rows alternate "this week" and "Project (if applicable)".
//   • Page 2 — Statement of Compliance with checkboxes + signature block.
//
// pdf-lib doesn't ship a high-level "table" — we draw lines and place text
// at fixed coordinates. Coordinates are tuned to the DOL printed-form
// dimensions (8.5" × 11" landscape for page 1, portrait for page 2).
// =============================================================================

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Wh347Generated } from './types'

// ── Plain-text renderer ──────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function renderText(form: Wh347Generated): string {
  const lines: string[] = []
  const h = form.header
  lines.push('U.S. DEPARTMENT OF LABOR — STATEMENT OF COMPLIANCE / FORM WH-347')
  lines.push('')
  lines.push(`Contractor: ${h.contractorName}`)
  lines.push(`Address:    ${h.contractorAddress}`)
  lines.push(`Project:    ${h.projectName} (${h.projectLocation})`)
  if (h.projectNumber) lines.push(`Project #:  ${h.projectNumber}`)
  lines.push(`Payroll #:  ${h.payrollNumber}`)
  lines.push(`Week ending: ${h.weekEnding}`)
  lines.push(`Jurisdiction: ${h.stateCode} / ${h.county}`)
  lines.push('')
  lines.push('─── WORKERS ───────────────────────────────────────────────────────────')
  for (const w of form.workers) {
    lines.push('')
    lines.push(`${w.workerName}` + (w.ssnLast4 ? ` (SSN xxx-xx-${w.ssnLast4})` : ''))
    lines.push(`  Classification: ${w.classification}` + (w.apprenticeLevel ? ` [Apprentice L${w.apprenticeLevel}]` : ''))
    if (w.decision) {
      lines.push(`  Wage decision:  ${w.decision.wage_decision_number ?? '(none)'} — base $${w.decision.base_rate.toFixed(2)}/hr + $${w.decision.fringe_rate.toFixed(2)}/hr fringe`)
    } else {
      lines.push(`  Wage decision:  *** UNRESOLVED *** — ${w.decisionMatchNote}`)
    }
    lines.push(`  Hours: ${DAY_LABELS.map((d, i) => `${d}=${w.hoursPerDay[i] ?? 0}`).join('  ')}`)
    lines.push(`         straight=${w.straightHours}  OT=${w.overtimeHours}  DT=${w.doubleTimeHours}  total=${w.totalHours}`)
    lines.push(`  Pay:   gross=$${w.grossPay.toFixed(2)}  fringes=$${w.fringePay.toFixed(2)}  deductions=$${w.deductionsTotal.toFixed(2)}  net=$${w.netPay.toFixed(2)}`)
    if (w.deductions.length > 0) {
      lines.push(`         deductions: ` +
        w.deductions.map(d => `${d.label}=$${d.amount.toFixed(2)}`).join(', '))
    }
    if (w.rateViolation) {
      lines.push(`  *** RATE VIOLATION: ${w.rateViolation.basis} (short $${w.rateViolation.shortBy.toFixed(2)}/hr)`)
    }
  }
  lines.push('')
  lines.push('─── STATEMENT OF COMPLIANCE ─────────────────────────────────────────')
  lines.push(`Period: ${form.statement.periodFrom} → ${form.statement.periodTo}`)
  lines.push(`Fringe benefits: ${form.statement.fringeBenefits}`)
  if (form.statement.exceptions.length > 0) {
    lines.push('Exceptions:')
    for (const ex of form.statement.exceptions) {
      lines.push(`  • ${ex.classification}: ${ex.explanation}`)
    }
  }
  lines.push('')
  lines.push(`Signed by: ${form.statement.signerName}, ${form.statement.signerTitle}`)
  lines.push(`Payer type: ${form.statement.payerType}`)
  lines.push('')
  if (form.gaps.length > 0) {
    lines.push('─── GAP REPORT (must be resolved before submission) ────────────────')
    for (const g of form.gaps) lines.push(`  [${g.kind}] ${g.detail}`)
  } else {
    lines.push('Gap report: clean.')
  }
  lines.push('')
  lines.push(`Content hash: ${form.contentHash}`)
  return lines.join('\n')
}

// ── PDF renderer ──────────────────────────────────────────────

export async function renderPdf(form: Wh347Generated): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const helv = await doc.embedFont(StandardFonts.Helvetica)
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold)

  // Page 1: payroll table (landscape Letter)
  const p1 = doc.addPage([792, 612])  // 11" × 8.5" landscape
  const ink = rgb(0.10, 0.09, 0.08)

  const headerY = 580
  p1.drawText('U.S. DEPARTMENT OF LABOR — PAYROLL', { x: 30, y: headerY, size: 12, font: helvB, color: ink })
  p1.drawText('Form WH-347 (revised)', { x: 30, y: headerY - 14, size: 8, font: helv, color: ink })

  const h = form.header
  const colMeta1 = [
    `Contractor: ${h.contractorName}`,
    `Address: ${h.contractorAddress}`,
    `Project: ${h.projectName}`,
    `Location: ${h.projectLocation}`,
  ]
  const colMeta2 = [
    `Project #: ${h.projectNumber ?? '—'}`,
    `Payroll #: ${h.payrollNumber}`,
    `Week ending: ${h.weekEnding}`,
    `Jurisdiction: ${h.stateCode} / ${h.county}`,
  ]
  colMeta1.forEach((line, i) => p1.drawText(line, { x: 30, y: headerY - 32 - i * 12, size: 9, font: helv, color: ink }))
  colMeta2.forEach((line, i) => p1.drawText(line, { x: 420, y: headerY - 32 - i * 12, size: 9, font: helv, color: ink }))

  // Table header
  let y = 480
  const colXs = [30, 110, 220, 250, 280, 310, 340, 370, 400, 430, 470, 540, 620, 690, 750]
  const headers = ['Name/SSN', 'Class.', 'M', 'T', 'W', 'T', 'F', 'S', 'S', 'Total', 'Rate', 'Gross', 'Deduct', 'Net']
  headers.forEach((label, i) => p1.drawText(label, { x: colXs[i], y, size: 8, font: helvB, color: ink }))
  p1.drawLine({ start: { x: 25, y: y - 3 }, end: { x: 770, y: y - 3 }, thickness: 0.5, color: ink })

  y -= 16
  for (const w of form.workers) {
    const nameLine = `${w.workerName}${w.ssnLast4 ? ` xx-${w.ssnLast4}` : ''}`
    p1.drawText(nameLine.slice(0, 22), { x: colXs[0], y, size: 8, font: helv, color: ink })
    p1.drawText(`${w.classification.slice(0, 16)}${w.apprenticeLevel ? `/A${w.apprenticeLevel}` : ''}`,
      { x: colXs[1], y, size: 8, font: helv, color: ink })
    for (let i = 0; i < 7; i++) {
      const hours = w.hoursPerDay[i] ?? 0
      p1.drawText(hours === 0 ? '' : hours.toFixed(1), { x: colXs[2 + i], y, size: 8, font: helv, color: ink })
    }
    p1.drawText(w.totalHours.toFixed(1), { x: colXs[9], y, size: 8, font: helv, color: ink })
    p1.drawText(w.decision ? `$${w.decision.base_rate.toFixed(2)}` : '—', { x: colXs[10], y, size: 8, font: helv, color: ink })
    p1.drawText(`$${w.grossPay.toFixed(2)}`, { x: colXs[11], y, size: 8, font: helv, color: ink })
    p1.drawText(`$${w.deductionsTotal.toFixed(2)}`, { x: colXs[12], y, size: 8, font: helv, color: ink })
    p1.drawText(`$${w.netPay.toFixed(2)}`, { x: colXs[13], y, size: 8, font: helvB, color: ink })
    if (w.rateViolation) {
      p1.drawText('*RATE VIOLATION', { x: colXs[0], y: y - 9, size: 7, font: helvB, color: rgb(0.78, 0.27, 0.18) })
      y -= 9
    }
    y -= 14
    if (y < 60) break  // overflow protection — multi-page TODO
  }

  // Page 2: Statement of Compliance (portrait)
  const p2 = doc.addPage([612, 792])
  p2.drawText('STATEMENT OF COMPLIANCE', { x: 50, y: 740, size: 14, font: helvB, color: ink })
  p2.drawText(`Period: ${form.statement.periodFrom} through ${form.statement.periodTo}`, { x: 50, y: 712, size: 10, font: helv, color: ink })

  const checkLine = (label: string, checked: boolean, y2: number) => {
    p2.drawRectangle({ x: 50, y: y2 - 3, width: 10, height: 10, borderWidth: 0.6, borderColor: ink })
    if (checked) p2.drawText('X', { x: 52, y: y2 - 1, size: 9, font: helvB, color: ink })
    p2.drawText(label, { x: 66, y: y2, size: 9, font: helv, color: ink })
  }
  let y2 = 680
  checkLine('Fringe benefits paid in cash to each worker', form.statement.fringeBenefits === 'paid_in_cash', y2); y2 -= 18
  checkLine('Fringe benefits paid to approved plans, funds, or programs', form.statement.fringeBenefits === 'paid_to_plans', y2); y2 -= 18
  checkLine('Partial fringe benefits — see exceptions', form.statement.fringeBenefits === 'partial', y2); y2 -= 18
  checkLine('No fringe benefits paid (all wages above prevailing rate)', form.statement.fringeBenefits === 'none', y2); y2 -= 28

  if (form.statement.exceptions.length > 0) {
    p2.drawText('EXCEPTIONS:', { x: 50, y: y2, size: 10, font: helvB, color: ink }); y2 -= 16
    for (const ex of form.statement.exceptions) {
      p2.drawText(`• ${ex.classification}: ${ex.explanation}`.slice(0, 90), { x: 50, y: y2, size: 9, font: helv, color: ink })
      y2 -= 14
    }
    y2 -= 8
  }

  p2.drawText('I certify that:', { x: 50, y: y2, size: 10, font: helvB, color: ink }); y2 -= 14
  const certBody = [
    `1. The payroll for the period from ${form.statement.periodFrom} to ${form.statement.periodTo} is correct and complete; all`,
    '   classifications conform to the wage determination of the Secretary of Labor.',
    '2. No rebates have been or will be received from any laborer or mechanic.',
    '3. Wages have been paid to each worker without rebate other than permissible deductions.',
    '4. Apprentices and trainees have been paid not less than the rate determined by the Secretary of Labor.',
  ]
  for (const line of certBody) {
    p2.drawText(line, { x: 50, y: y2, size: 9, font: helv, color: ink }); y2 -= 12
  }
  y2 -= 24
  p2.drawLine({ start: { x: 50, y: y2 }, end: { x: 320, y: y2 }, thickness: 0.7, color: ink })
  p2.drawText(form.statement.signerName, { x: 50, y: y2 + 2, size: 9, font: helv, color: ink })
  p2.drawText(form.statement.signerTitle, { x: 50, y: y2 - 12, size: 9, font: helv, color: ink })
  p2.drawText(`Payer type: ${form.statement.payerType}`, { x: 50, y: y2 - 24, size: 8, font: helv, color: ink })

  p2.drawText(`Content hash: ${form.contentHash.slice(0, 32)}...`, { x: 50, y: 50, size: 7, font: helv, color: rgb(0.55, 0.5, 0.45) })

  return await doc.save()
}

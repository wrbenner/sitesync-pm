import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export interface WH347Header {
  contractor: string
  address: string
  payrollNo: string
  weekEnding: string
  projectName: string
  projectLocation: string
  contractNo: string
}

export interface WH347Employee {
  name: string
  trade: string
  hours: number[] // Mon-Sun (7 values)
  totalHours: number
  rate: number
  gross: number
}

/**
 * Generate a real WH-347 Certified Payroll PDF using pdf-lib.
 * Downloads the file to the browser.
 */
export async function generateWH347PDF(
  header: WH347Header,
  employees: WH347Employee[],
): Promise<void> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([792, 612]) // Landscape letter
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.85, 0.85, 0.85)

  const LEFT = 40
  const RIGHT = 752
  let y = 580

  // --- Title ---
  page.drawText('U.S. Department of Labor', { x: LEFT, y, font: fontBold, size: 11, color: black })
  page.drawText('PAYROLL', { x: 320, y, font: fontBold, size: 14, color: black })
  page.drawText('(WH-347)', { x: 395, y, font, size: 10, color: gray })
  y -= 18

  // --- Header fields ---
  const drawField = (label: string, value: string, x: number, yPos: number, width: number) => {
    page.drawText(label, { x, y: yPos + 10, font, size: 7, color: gray })
    page.drawText(value, { x, y: yPos, font: fontBold, size: 9, color: black })
    page.drawLine({ start: { x, y: yPos - 2 }, end: { x: x + width, y: yPos - 2 }, thickness: 0.5, color: lightGray })
  }

  drawField('NAME OF CONTRACTOR OR SUBCONTRACTOR', header.contractor, LEFT, y, 280)
  drawField('PAYROLL NO.', header.payrollNo, 340, y, 100)
  drawField('FOR WEEK ENDING', header.weekEnding, 460, y, 140)
  y -= 28
  drawField('ADDRESS', header.address, LEFT, y, 280)
  drawField('PROJECT AND LOCATION', `${header.projectName} — ${header.projectLocation}`, 340, y, 260)
  y -= 28
  drawField('PROJECT OR CONTRACT NO.', header.contractNo, LEFT, y, 280)
  y -= 20

  // --- Column headers ---
  const colX = [LEFT, 130, 210, 260, 290, 320, 350, 380, 410, 440, 490, 540, 600, 660]
  const colHeaders = ['Name', 'Classification', 'M', 'T', 'W', 'Th', 'F', 'S', 'Su', 'Total', 'Rate', 'Gross Pay', 'Ded.', 'Net Pay']

  page.drawRectangle({ x: LEFT - 2, y: y - 2, width: RIGHT - LEFT + 4, height: 16, color: rgb(0.95, 0.95, 0.95) })
  colHeaders.forEach((h, i) => {
    page.drawText(h, { x: colX[i], y, font: fontBold, size: 7, color: black })
  })
  y -= 4
  page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 1, color: black })
  y -= 14

  // --- Employee rows ---
  let totalGross = 0
  let totalHours = 0
  for (const emp of employees) {
    if (y < 60) {
      // Add a new page if running out of space
      break
    }
    page.drawText(emp.name.slice(0, 20), { x: colX[0], y, font, size: 8, color: black })
    page.drawText(emp.trade.slice(0, 16), { x: colX[1], y, font, size: 8, color: black })
    emp.hours.forEach((h, i) => {
      page.drawText(h > 0 ? h.toFixed(1) : '—', { x: colX[i + 2], y, font, size: 8, color: h > 0 ? black : gray })
    })
    page.drawText(emp.totalHours.toFixed(1), { x: colX[9], y, font: fontBold, size: 8, color: black })
    page.drawText(`$${emp.rate.toFixed(2)}`, { x: colX[10], y, font, size: 8, color: black })
    page.drawText(`$${emp.gross.toFixed(2)}`, { x: colX[11], y, font: fontBold, size: 8, color: black })
    page.drawText('—', { x: colX[12], y, font, size: 8, color: gray })
    page.drawText(`$${emp.gross.toFixed(2)}`, { x: colX[13], y, font, size: 8, color: black })

    totalGross += emp.gross
    totalHours += emp.totalHours

    y -= 14
    page.drawLine({ start: { x: LEFT, y: y + 4 }, end: { x: RIGHT, y: y + 4 }, thickness: 0.3, color: lightGray })
  }

  // --- Totals row ---
  y -= 4
  page.drawLine({ start: { x: LEFT, y: y + 12 }, end: { x: RIGHT, y: y + 12 }, thickness: 1, color: black })
  page.drawText('TOTALS', { x: LEFT, y, font: fontBold, size: 9, color: black })
  page.drawText(totalHours.toFixed(1), { x: colX[9], y, font: fontBold, size: 9, color: black })
  page.drawText(`$${totalGross.toFixed(2)}`, { x: colX[11], y, font: fontBold, size: 9, color: black })
  page.drawText(`$${totalGross.toFixed(2)}`, { x: colX[13], y, font: fontBold, size: 9, color: black })

  // --- Statement of compliance (bottom) ---
  y -= 30
  page.drawText('STATEMENT OF COMPLIANCE', { x: LEFT, y, font: fontBold, size: 8, color: black })
  y -= 12
  const complianceText =
    `I, the undersigned, do hereby state that I pay or supervise the payment of the persons employed by ` +
    `${header.contractor} on the ${header.projectName} project; that during the payroll period commencing on the ` +
    `first day and ending the last day of the week covered by this payroll, all persons employed on said project ` +
    `have been paid the full weekly wages earned, that no rebates have been or will be made.`
  // Simple word wrap
  const words = complianceText.split(' ')
  let line = ''
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (font.widthOfTextAtSize(test, 7) > RIGHT - LEFT) {
      page.drawText(line, { x: LEFT, y, font, size: 7, color: gray })
      y -= 10
      line = word
    } else {
      line = test
    }
  }
  if (line) {
    page.drawText(line, { x: LEFT, y, font, size: 7, color: gray })
  }

  // --- Signature lines ---
  y -= 25
  page.drawLine({ start: { x: LEFT, y }, end: { x: 250, y }, thickness: 0.5, color: black })
  page.drawText('Signature', { x: LEFT, y: y - 10, font, size: 7, color: gray })
  page.drawLine({ start: { x: 300, y }, end: { x: 500, y }, thickness: 0.5, color: black })
  page.drawText('Title', { x: 300, y: y - 10, font, size: 7, color: gray })
  page.drawLine({ start: { x: 550, y }, end: { x: RIGHT, y }, thickness: 0.5, color: black })
  page.drawText('Date', { x: 550, y: y - 10, font, size: 7, color: gray })

  // --- Download ---
  const bytes = await pdf.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `WH-347_${header.weekEnding}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Export payroll data as a downloadable CSV.
 */
export function exportPayrollCSV(
  employees: WH347Employee[],
  header: WH347Header,
  format: string = 'csv',
): void {
  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const rows: string[][] = [
    ['Employee', 'Trade/Classification', ...dayHeaders, 'Total Hours', 'Hourly Rate', 'Gross Pay'],
  ]

  for (const emp of employees) {
    rows.push([
      emp.name,
      emp.trade,
      ...emp.hours.map((h) => h.toFixed(1)),
      emp.totalHours.toFixed(1),
      emp.rate.toFixed(2),
      emp.gross.toFixed(2),
    ])
  }

  // Add totals
  const totalHours = employees.reduce((s, e) => s + e.totalHours, 0)
  const totalGross = employees.reduce((s, e) => s + e.gross, 0)
  rows.push([
    'TOTALS', '',
    ...employees.reduce((sums, emp) => emp.hours.map((h, i) => (sums[i] || 0) + h), Array(7).fill(0) as number[]).map((h: number) => h.toFixed(1)),
    totalHours.toFixed(1),
    '',
    totalGross.toFixed(2),
  ])

  const csvContent = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Payroll_${format.toUpperCase()}_${header.weekEnding}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

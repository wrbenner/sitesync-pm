// XLSX export utility for all report types.
// Generates professional Excel workbooks with formatted headers and typed columns.
//
// xlsx is loaded lazily — the ~140 KB gzipped vendor bundle is fetched the first
// time an export is triggered, not on any route that imports this module.

// ── Types ────────────────────────────────────────────────

interface SheetConfig {
  name: string
  headers: string[]
  rows: (string | number)[][]
  columnWidths?: number[]
}

interface ExportOptions {
  filename: string
  sheets: SheetConfig[]
  projectName?: string
}

// ── Core Export ──────────────────────────────────────────

export async function exportToXlsx(options: ExportOptions) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  for (const sheet of options.sheets) {
    const data = [sheet.headers, ...sheet.rows]
    const ws = XLSX.utils.aoa_to_sheet(data)

    // Column widths
    if (sheet.columnWidths) {
      ws['!cols'] = sheet.columnWidths.map((w) => ({ wch: w }))
    } else {
      // Auto-width based on header length
      ws['!cols'] = sheet.headers.map((h) => ({ wch: Math.max(h.length + 4, 12) }))
    }

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31)) // Excel 31 char sheet name limit
  }

  const dateStr = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${options.filename}_${dateStr}.xlsx`)
}

// ── Report-Specific Exporters ────────────────────────────

export function exportRFILogXlsx(projectName: string, rfis: Array<{
  number: string; title: string; priority: string; status: string;
  from: string; assignedTo: string; dueDate: string; createdAt: string;
}>) {
  exportToXlsx({
    filename: `${projectName}_RFI_Log`,
    sheets: [{
      name: 'RFI Log',
      headers: ['RFI #', 'Title', 'Priority', 'Status', 'From', 'Assigned To', 'Due Date', 'Created'],
      rows: rfis.map((r) => [r.number, r.title, r.priority, r.status, r.from, r.assignedTo, r.dueDate, r.createdAt]),
      columnWidths: [10, 40, 10, 14, 20, 20, 14, 14],
    }],
  })
}

export function exportSubmittalLogXlsx(projectName: string, submittals: Array<{
  number: string; title: string; specSection: string; subcontractor: string;
  status: string; revision: string; leadTime: string; dueDate: string;
}>) {
  exportToXlsx({
    filename: `${projectName}_Submittal_Log`,
    sheets: [{
      name: 'Submittal Log',
      headers: ['Sub #', 'Title', 'Spec Section', 'Subcontractor', 'Status', 'Rev', 'Lead Time', 'Due Date'],
      rows: submittals.map((s) => [s.number, s.title, s.specSection, s.subcontractor, s.status, s.revision, s.leadTime, s.dueDate]),
      columnWidths: [10, 40, 14, 20, 14, 6, 10, 14],
    }],
  })
}

export function exportPunchListXlsx(projectName: string, items: Array<{
  number: string; area: string; description: string; assignedTo: string;
  priority: string; status: string; dueDate: string;
}>) {
  exportToXlsx({
    filename: `${projectName}_Punch_List`,
    sheets: [{
      name: 'Punch List',
      headers: ['Item #', 'Area', 'Description', 'Assigned To', 'Priority', 'Status', 'Due Date'],
      rows: items.map((p) => [p.number, p.area, p.description, p.assignedTo, p.priority, p.status, p.dueDate]),
      columnWidths: [10, 20, 40, 20, 10, 12, 14],
    }],
  })
}

export function exportBudgetXlsx(projectName: string, data: {
  divisions: Array<{ division: string; budget: number; spent: number; committed: number; percentComplete: number }>;
  changeOrders: Array<{ number: string; description: string; amount: number; status: string }>;
}) {
  exportToXlsx({
    filename: `${projectName}_Budget_Report`,
    sheets: [
      {
        name: 'Cost Breakdown',
        headers: ['Division', 'Budget', 'Spent', 'Committed', '% Complete'],
        rows: data.divisions.map((d) => [d.division, d.budget, d.spent, d.committed, d.percentComplete]),
        columnWidths: [30, 16, 16, 16, 12],
      },
      {
        name: 'Change Orders',
        headers: ['CO #', 'Description', 'Amount', 'Status'],
        rows: data.changeOrders.map((co) => [co.number, co.description, co.amount, co.status]),
        columnWidths: [10, 40, 16, 14],
      },
    ],
  })
}

export function exportDailyLogXlsx(projectName: string, entries: Array<{
  date: string; workers: number; manHours: number; incidents: number;
  weather: string; summary: string;
}>) {
  exportToXlsx({
    filename: `${projectName}_Daily_Log_Summary`,
    sheets: [{
      name: 'Daily Logs',
      headers: ['Date', 'Workers', 'Man Hours', 'Incidents', 'Weather', 'Summary'],
      rows: entries.map((e) => [e.date, e.workers, e.manHours, e.incidents, e.weather, e.summary]),
      columnWidths: [14, 10, 12, 10, 16, 40],
    }],
  })
}

// ── CSV Export (simple single-sheet fallback) ────────────

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => {
        const str = String(cell)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(',')
    ),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

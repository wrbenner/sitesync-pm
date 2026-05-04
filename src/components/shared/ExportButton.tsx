import React, { useState, lazy, Suspense } from 'react'
import { Download, ChevronDown, FileText, Table2, Sheet } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, transitions, touchTarget } from '../../styles/theme'

// Lazy load PDF rendering
const PDFDownloadLink = lazy(() => import('@react-pdf/renderer').then(m => ({ default: m.PDFDownloadLink })))

interface ExportButtonProps {
  onExportCSV?: () => void
  onExportXLSX?: () => void
  pdfDocument?: React.ReactElement
  pdfFilename?: string
  csvFilename?: string
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  onExportCSV,
  onExportXLSX,
  pdfDocument,
  pdfFilename = 'SiteSync_Report',
}) => {
  const [open, setOpen] = useState(false)
  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = `${pdfFilename}_${dateStr}`

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['1'],
          padding: `0 ${spacing['3']}`,
          minHeight: touchTarget.field,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: borderRadius.md,
          backgroundColor: colors.surfaceRaised,
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.medium,
          fontFamily: typography.fontFamily,
          color: colors.textPrimary,
          cursor: 'pointer',
          transition: `all ${transitions.instant}`,
        }}
      >
        <Download size={14} aria-hidden="true" />
        Export
        <ChevronDown size={12} aria-hidden="true" />
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setOpen(false)} role="presentation" aria-hidden="true" />
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: spacing['1'],
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.md,
            boxShadow: shadows.dropdown,
            border: `1px solid ${colors.borderSubtle}`,
            padding: spacing['1'],
            minWidth: '160px',
            zIndex: 51,
          }}>
            {pdfDocument && (
              <Suspense fallback={
                <div style={menuItemStyle}>
                  <FileText size={14} /> Generating PDF...
                </div>
              }>
                <PDFDownloadLink document={pdfDocument as never} fileName={`${filename}.pdf`}>
                  {({ loading }: { loading: boolean }) => (
                    <button onClick={() => setOpen(false)} style={menuItemStyle}>
                      <FileText size={14} /> {loading ? 'Preparing...' : 'Export PDF'}
                    </button>
                  )}
                </PDFDownloadLink>
              </Suspense>
            )}
            {onExportCSV && (
              <button onClick={() => { onExportCSV(); setOpen(false); }} style={menuItemStyle}>
                <Table2 size={14} /> Export CSV
              </button>
            )}
            {onExportXLSX && (
              <button onClick={() => { onExportXLSX(); setOpen(false); }} style={menuItemStyle}>
                <Sheet size={14} /> Export XLSX
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing['2'],
  width: '100%',
  padding: `0 ${spacing['3']}`,
  minHeight: touchTarget.field,
  border: 'none',
  borderRadius: borderRadius.sm,
  backgroundColor: 'transparent',
  fontSize: typography.fontSize.sm,
  fontFamily: typography.fontFamily,
  color: colors.textPrimary,
  cursor: 'pointer',
  textAlign: 'left' as const,
  textDecoration: 'none',
}

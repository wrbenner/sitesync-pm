import React, { useState } from 'react'
import { X, FileText, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  zIndex,
} from '../../styles/theme'
import { Btn } from '../Primitives'
import { generateDiscrepancyReport } from './DiscrepancyReport'
import { generateDrawingAnalysisReport } from './DrawingAnalysisReport'
import { generateScaleAuditReport } from './ScaleAuditReport'

// Adapted from SiteSync PM:
//   sitesyncai-web/app/components/ReportGenerationModal/ReportGenerationModal.tsx
// Rewritten to use SiteSync PM's inline theme system and to wire into the PDF
// components we already have (DiscrepancyReport, DrawingAnalysisReport,
// ScaleAuditReport).

export type ReportType =
  | 'discrepancy'
  | 'classification'
  | 'scale_audit'
  | 'full_analysis'

export interface ReportGenerationOptions {
  reportType: ReportType
  dateRange: {
    start: string | null
    end: string | null
  }
  drawingIds: string[] | 'all'
  includeImages: boolean
  preparedBy?: string
}

interface DrawingSummary {
  id: string
  sheet_number: string | null
  discipline: string | null
}

interface ReportGenerationModalProps {
  open: boolean
  projectName: string
  drawings: DrawingSummary[]
  onClose: () => void
  /**
   * Optional custom generator. When omitted, the modal uses built-in
   * generators (requires `projectId`). When provided, this overrides
   * the default and receives the user's selections.
   */
  onGenerate?: (opts: ReportGenerationOptions) => Promise<void> | void
  /**
   * Required when `onGenerate` is not provided — used by the built-in
   * generators to query Supabase for the project's data.
   */
  projectId?: string
  defaultPreparedBy?: string
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function runBuiltInGenerator(
  projectId: string,
  opts: ReportGenerationOptions,
): Promise<{ blob: Blob; filename: string }> {
  const drawingIds = opts.drawingIds
  const preparedBy = opts.preparedBy
  switch (opts.reportType) {
    case 'discrepancy':
      return generateDiscrepancyReport(projectId, { drawingIds, preparedBy })
    case 'classification':
      return generateDrawingAnalysisReport(projectId, { drawingIds, preparedBy })
    case 'scale_audit':
      return generateScaleAuditReport(projectId, { drawingIds, preparedBy })
    case 'full_analysis': {
      // Full analysis = classification + discrepancies + scale audit.
      // Produce three downloads in sequence so the user gets everything.
      const [cls, disc, sa] = await Promise.all([
        generateDrawingAnalysisReport(projectId, { drawingIds, preparedBy }),
        generateDiscrepancyReport(projectId, { drawingIds, preparedBy }),
        generateScaleAuditReport(projectId, { drawingIds, preparedBy }),
      ])
      triggerDownload(cls.blob, cls.filename)
      triggerDownload(disc.blob, disc.filename)
      return sa
    }
  }
}

const REPORT_TYPES: Array<{ value: ReportType; label: string; description: string }> = [
  {
    value: 'discrepancy',
    label: 'Discrepancy Report',
    description: 'All detected dimensional mismatches across pairs with severity.',
  },
  {
    value: 'classification',
    label: 'Classification Summary',
    description: 'Sheet-level classification: discipline, plan type, confidence.',
  },
  {
    value: 'scale_audit',
    label: 'Scale Audit',
    description: 'Compare scales across paired drawings — flags mismatches.',
  },
  {
    value: 'full_analysis',
    label: 'Full Analysis',
    description: 'Cover sheet + classification + discrepancies + scale audit.',
  },
]

export const ReportGenerationModal: React.FC<ReportGenerationModalProps> = ({
  open,
  projectName,
  drawings,
  onClose,
  onGenerate,
  projectId,
  defaultPreparedBy,
}) => {
  const [reportType, setReportType] = useState<ReportType>('discrepancy')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string> | 'all'>('all')
  const [includeImages, setIncludeImages] = useState(true)
  const [preparedBy, setPreparedBy] = useState(defaultPreparedBy ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const toggleDrawing = (id: string) => {
    setSelectedIds((prev) => {
      if (prev === 'all') {
        const next = new Set(drawings.map((d) => d.id))
        next.delete(id)
        return next
      }
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = selectedIds === 'all'
  const selectedCount = allSelected ? drawings.length : selectedIds.size

  const handleGenerate = async () => {
    setBusy(true)
    setError(null)
    const options: ReportGenerationOptions = {
      reportType,
      dateRange: {
        start: startDate || null,
        end: endDate || null,
      },
      drawingIds: allSelected ? 'all' : Array.from(selectedIds),
      includeImages,
      preparedBy: preparedBy || undefined,
    }

    const toastId = toast.loading('Generating report PDF…')
    try {
      if (onGenerate) {
        await onGenerate(options)
      } else {
        if (!projectId) {
          throw new Error('projectId is required to generate a report')
        }
        const { blob, filename } = await runBuiltInGenerator(projectId, options)
        triggerDownload(blob, filename)
      }
      toast.success('Report PDF downloaded', { id: toastId })
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Report generation failed'
      setError(msg)
      toast.error(`Report generation failed: ${msg}`, { id: toastId })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-gen-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: zIndex.modal,
        padding: spacing['4'],
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          width: 'min(640px, 100%)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: shadows.lg,
          border: `1px solid ${colors.borderSubtle}`,
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing['4'],
            borderBottom: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <FileText size={18} color={colors.primaryOrange} />
            <h2
              id="report-gen-title"
              style={{
                margin: 0,
                fontSize: typography.fontSize.title,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
              }}
            >
              Generate Report — {projectName}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close report generator"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: colors.textSecondary,
              padding: spacing['2'],
            }}
          >
            <X size={18} />
          </button>
        </header>

        <div
          style={{
            padding: spacing['4'],
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: spacing['4'],
          }}
        >
          {/* Report type picker */}
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend
              style={{
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: spacing['2'],
              }}
            >
              Report Type
            </legend>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: spacing['2'],
              }}
            >
              {REPORT_TYPES.map((rt) => {
                const selected = reportType === rt.value
                return (
                  <label
                    key={rt.value}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      padding: spacing['3'],
                      border: `2px solid ${selected ? colors.primaryOrange : colors.borderSubtle}`,
                      borderRadius: borderRadius.md,
                      cursor: 'pointer',
                      background: selected ? colors.orangeSubtle : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="report_type"
                      value={rt.value}
                      checked={selected}
                      onChange={() => setReportType(rt.value)}
                      style={{ display: 'none' }}
                    />
                    <span
                      style={{
                        fontSize: typography.fontSize.body,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.textPrimary,
                      }}
                    >
                      {rt.label}
                    </span>
                    <span
                      style={{
                        fontSize: typography.fontSize.caption,
                        color: colors.textSecondary,
                        lineHeight: 1.4,
                      }}
                    >
                      {rt.description}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {/* Date range */}
          <div style={{ display: 'flex', gap: spacing['3'] }}>
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                From
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: spacing['2'],
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: borderRadius.sm,
                  fontSize: typography.fontSize.body,
                  background: colors.surfaceInset,
                  color: colors.textPrimary,
                }}
              />
            </label>
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                To
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: spacing['2'],
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: borderRadius.sm,
                  fontSize: typography.fontSize.body,
                  background: colors.surfaceInset,
                  color: colors.textPrimary,
                }}
              />
            </label>
          </div>

          {/* Drawing picker */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing['2'],
              }}
            >
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Drawings ({selectedCount}/{drawings.length})
              </span>
              <button
                onClick={() => setSelectedIds(allSelected ? new Set() : 'all')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: colors.primaryOrange,
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.semibold,
                  cursor: 'pointer',
                }}
              >
                {allSelected ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div
              style={{
                maxHeight: 200,
                overflowY: 'auto',
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.sm,
                background: colors.surfaceInset,
              }}
            >
              {drawings.length === 0 ? (
                <div
                  style={{
                    padding: spacing['3'],
                    color: colors.textTertiary,
                    fontSize: typography.fontSize.caption,
                    textAlign: 'center',
                  }}
                >
                  No drawings available
                </div>
              ) : (
                drawings.map((d) => {
                  const checked =
                    allSelected || (typeof selectedIds !== 'string' && selectedIds.has(d.id))
                  return (
                    <label
                      key={d.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing['2'],
                        padding: `${spacing['2']} ${spacing['3']}`,
                        borderBottom: `1px solid ${colors.borderSubtle}`,
                        cursor: 'pointer',
                        fontSize: typography.fontSize.caption,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDrawing(d.id)}
                      />
                      <span style={{ fontFamily: typography.fontFamilyMono }}>
                        {d.sheet_number ?? '(no sheet #)'}
                      </span>
                      <span style={{ color: colors.textTertiary }}>
                        {d.discipline ?? '—'}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          {/* Options */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
              fontSize: typography.fontSize.body,
              color: colors.textPrimary,
            }}
          >
            <input
              type="checkbox"
              checked={includeImages}
              onChange={(e) => setIncludeImages(e.target.checked)}
            />
            Include drawing images (longer PDF, higher quality)
          </label>

          <label
            style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            <span
              style={{
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Prepared by
            </span>
            <input
              type="text"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              placeholder="e.g. Jane Smith, PM"
              style={{
                padding: spacing['2'],
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.sm,
                fontSize: typography.fontSize.body,
                background: colors.surfaceInset,
                color: colors.textPrimary,
              }}
            />
          </label>

          {error && (
            <div
              role="alert"
              style={{
                padding: spacing['3'],
                background: `${colors.statusCritical}11`,
                border: `1px solid ${colors.statusCritical}55`,
                borderRadius: borderRadius.md,
                fontSize: typography.fontSize.body,
                color: colors.statusCritical,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <footer
          style={{
            padding: spacing['4'],
            borderTop: `1px solid ${colors.borderSubtle}`,
            display: 'flex',
            gap: spacing['2'],
            justifyContent: 'flex-end',
          }}
        >
          <Btn variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            size="md"
            icon={busy ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
            onClick={handleGenerate}
            disabled={busy}
          >
            {busy ? 'Generating…' : 'Generate Report'}
          </Btn>
        </footer>
      </div>
    </div>
  )
}

export default ReportGenerationModal

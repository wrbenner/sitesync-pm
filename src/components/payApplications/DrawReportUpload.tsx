// DrawReportUpload — 3-step modal for ingesting AIA G702/G703 draw reports.
//
//   Step 1 (upload)   → drop a PDF or .xlsx file.
//   Step 2 (review)   → editable grid of extracted line items. Low-confidence
//                       cells flagged with an amber dot so the PM can spot-fix
//                       misreads before any DB write.
//   Step 3 (done)     → toast + close. Pay app + line items committed, budget
//                       actuals updated, RAG index refreshed.
//
// Follows the visual pattern of src/components/budget/BudgetUpload.tsx.

import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  Upload, X, FileText, AlertCircle, ArrowLeft, Sparkles, CheckCircle, AlertTriangle, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  colors, spacing, typography, borderRadius, shadows, transitions, touchTarget,
} from '../../styles/theme'
import { Btn } from '../Primitives'
import {
  useExtractDrawReport,
  useCommitDrawReport,
  type DrawReportExtraction,
  type DrawReportLineItem,
} from '../../hooks/mutations/draw-reports'

interface DrawReportUploadProps {
  open: boolean
  onClose: () => void
  projectId: string
  onSuccess?: (payAppId: string) => void
}

type Step = 'upload' | 'extracting' | 'review' | 'committing' | 'done'

interface StagedExtraction {
  documentId: string
  documentName: string
  extraction: DrawReportExtraction
  rawText: string
  model: string
  filename: string
  sheetHint?: { name: string; score: number; reason: string }
}

const CONFIDENCE_THRESHOLD = 0.85

export function DrawReportUpload({ open, onClose, projectId, onSuccess }: DrawReportUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [staged, setStaged] = useState<StagedExtraction | null>(null)
  const [editedLines, setEditedLines] = useState<DrawReportLineItem[]>([])
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set())
  const [overrideGuard, setOverrideGuard] = useState(false)
  const [error, setError] = useState('')
  const [extractElapsedSec, setExtractElapsedSec] = useState(0)

  // Live elapsed-time counter during extraction so the user sees progress.
  // setExtractElapsedSec(0) only runs inside setInterval's tick to avoid
  // the "synchronous setState in effect" lint rule; we reset the counter
  // by scheduling the first increment after a tick.
  React.useEffect(() => {
    if (step !== 'extracting') return
    const startedAt = Date.now()
    const t = setInterval(() => {
      setExtractElapsedSec(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [step])

  const extractMutation = useExtractDrawReport()
  const commitMutation = useCommitDrawReport()

  const reset = useCallback(() => {
    setStep('upload')
    setStaged(null)
    setEditedLines([])
    setSelectedIdx(new Set())
    setOverrideGuard(false)
    setError('')
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  const handleFile = useCallback(async (file: File) => {
    setError('')
    setStep('extracting')
    try {
      const result = await extractMutation.mutateAsync({ projectId, file })
      setStaged({
        documentId: result.documentId,
        documentName: result.documentName,
        extraction: result.extraction,
        rawText: result.rawText,
        model: result.model,
        filename: file.name,
        sheetHint: result.sheetHint,
      })
      setEditedLines(result.extraction.line_items.map((l) => ({ ...l })))
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
      setStep('upload')
    }
  }, [extractMutation, projectId])

  const handleCommit = useCallback(async () => {
    if (!staged) return
    setStep('committing')
    setError('')
    try {
      // Recompute reconciliation against the *edited* line items so the
      // guard reflects user edits (not the original Gemini output).
      const sumOfLines = editedLines.reduce((s, l) => s + l.scheduled_value, 0)
      const statedContractSum = staged.extraction.reconciliation?.stated_contract_sum
        ?? staged.extraction.contract_sum
        ?? sumOfLines
      const deviationDollars = sumOfLines - statedContractSum
      const deviationPct = statedContractSum > 0
        ? Math.abs(deviationDollars) / statedContractSum * 100
        : 0
      const liveRecon = {
        sum_of_lines: Math.round(sumOfLines * 100) / 100,
        stated_contract_sum: Math.round(statedContractSum * 100) / 100,
        deviation_dollars: Math.round(deviationDollars * 100) / 100,
        deviation_pct: Math.round(deviationPct * 100) / 100,
        reconciled: deviationPct < 0.5,
        dropped_subtotal_count: staged.extraction.reconciliation?.dropped_subtotal_count ?? 0,
      }
      const result = await commitMutation.mutateAsync({
        projectId,
        documentId: staged.documentId,
        extraction: { ...staged.extraction, line_items: editedLines, reconciliation: liveRecon },
        rawText: staged.rawText,
        overrideReconciliationGuard: overrideGuard,
      })
      setStep('done')
      if (result.budgetRowsUpdated > 0) {
        toast.success(
          `Draw report saved — ${result.lineItemCount} line items, ${result.budgetRowsUpdated} budget row${result.budgetRowsUpdated !== 1 ? 's' : ''} updated.`,
          { duration: 5000 },
        )
      } else {
        toast.success(
          `Draw report saved — ${result.lineItemCount} line items. Budget actuals unchanged (no CSI-division match in the current budget). Pay app + Construction Brain updated.`,
          { duration: 7000 },
        )
      }
      setTimeout(() => {
        onSuccess?.(result.payApplicationId)
        handleClose()
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commit failed')
      setStep('review')
    }
  }, [commitMutation, editedLines, handleClose, onSuccess, overrideGuard, projectId, staged])

  const toggleRow = useCallback((idx: number) => {
    setSelectedIdx((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }, [])

  const toggleAllRows = useCallback(() => {
    setSelectedIdx((prev) => {
      if (prev.size === editedLines.length) return new Set()
      return new Set(editedLines.map((_, i) => i))
    })
  }, [editedLines])

  const deleteSelected = useCallback(() => {
    if (selectedIdx.size === 0) return
    setEditedLines((prev) => prev.filter((_, i) => !selectedIdx.has(i)))
    setSelectedIdx(new Set())
  }, [selectedIdx])

  /**
   * "Keep detail rows only" helper: looks for rows whose scheduled_value
   * ≈ sum of a run of prior rows (a subtotal signature). Flags them for
   * one-click removal when the reconciliation banner is red.
   */
  const detectedSubtotalIdx = useMemo(() => {
    const out = new Set<number>()
    for (let i = 2; i < editedLines.length; i++) {
      for (let w = 2; w <= Math.min(8, i); w++) {
        const sum = editedLines.slice(i - w, i).reduce((s, r) => s + r.scheduled_value, 0)
        const target = editedLines[i].scheduled_value
        if (target === 0) continue
        if (Math.abs(sum - target) < Math.max(100, target * 0.005)) {
          out.add(i)
          break
        }
      }
    }
    return out
  }, [editedLines])

  const removeDetectedSubtotals = useCallback(() => {
    if (detectedSubtotalIdx.size === 0) return
    setEditedLines((prev) => prev.filter((_, i) => !detectedSubtotalIdx.has(i)))
    setSelectedIdx(new Set())
  }, [detectedSubtotalIdx])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const updateLine = useCallback((idx: number, patch: Partial<DrawReportLineItem>) => {
    setEditedLines((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch, confidence: 1 } // user-edited → full confidence
      return next
    })
  }, [])

  const totals = useMemo(() => {
    const scheduled = editedLines.reduce((s, l) => s + l.scheduled_value, 0)
    const prev = editedLines.reduce((s, l) => s + l.previous_completed, 0)
    const thisPeriod = editedLines.reduce((s, l) => s + l.this_period, 0)
    const materials = editedLines.reduce((s, l) => s + l.materials_stored, 0)
    const retainage = editedLines.reduce((s, l) => s + l.retainage, 0)
    const completed = prev + thisPeriod + materials
    return { scheduled, prev, thisPeriod, materials, completed, retainage }
  }, [editedLines])

  // Live reconciliation: sum-of-lines vs stated contract sum, recalculated
  // as the user edits. Used to drive the green/red banner and the commit
  // guard. statedContractSum comes from the extraction when available —
  // falls back to 0 (banner stays neutral) for blank-slate draws.
  const liveRecon = useMemo(() => {
    if (!staged) return null
    const statedContractSum = staged.extraction.reconciliation?.stated_contract_sum
      ?? staged.extraction.contract_sum
      ?? 0
    if (statedContractSum <= 0) return null
    const sumOfLines = totals.scheduled
    const deviationDollars = sumOfLines - statedContractSum
    const deviationPct = Math.abs(deviationDollars) / statedContractSum * 100
    return {
      sumOfLines,
      statedContractSum,
      deviationDollars,
      deviationPct,
      reconciled: deviationPct < 0.5,
      severelyOff: deviationPct > 5,
    }
  }, [staged, totals.scheduled])

  const lowConfidenceCount = useMemo(
    () => editedLines.filter((l) => l.confidence < CONFIDENCE_THRESHOLD).length,
    [editedLines],
  )

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          boxShadow: shadows.panel,
          width: step === 'review' ? '1100px' : '640px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          fontFamily: typography.fontFamily,
          transition: `width ${transitions.base}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: `${spacing['4']} ${spacing['6']}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            {step === 'review' && (
              <button
                onClick={reset}
                aria-label="Back"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, border: 'none', borderRadius: borderRadius.base,
                  backgroundColor: colors.surfaceHover, cursor: 'pointer', color: colors.textSecondary,
                  flexShrink: 0,
                }}
              >
                <ArrowLeft size={14} />
              </button>
            )}
            <FileText size={18} color={colors.primaryOrange} />
            <h2 style={{
              margin: 0, fontSize: typography.fontSize.title,
              fontWeight: typography.fontWeight.semibold, color: colors.textPrimary,
            }}>
              {step === 'upload' ? 'Upload Draw Report' :
               step === 'extracting' ? 'Reading Draw Report…' :
               step === 'review' ? 'Review Extracted Line Items' :
               step === 'committing' ? 'Saving…' :
               'Draw Report Saved'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, border: 'none', borderRadius: borderRadius.base,
              backgroundColor: 'transparent', cursor: 'pointer', color: colors.textTertiary,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div style={{ padding: `${spacing['5']} ${spacing['6']}`, overflow: 'auto', flex: 1 }}>
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: spacing['2'],
              padding: spacing['3'], backgroundColor: colors.statusCriticalSubtle,
              borderRadius: borderRadius.base, color: colors.statusCritical,
              fontSize: typography.fontSize.sm, marginBottom: spacing['4'],
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}

          {/* ── Step: Upload ───────────────────────────────── */}
          {step === 'upload' && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.xlsx,.xls"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <div
                onClick={() => inputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                style={{
                  border: `2px dashed ${colors.borderDefault}`,
                  borderRadius: borderRadius.lg,
                  padding: `${spacing['8']} ${spacing['6']}`,
                  textAlign: 'center',
                  cursor: 'pointer',
                  minHeight: touchTarget.field,
                  transition: `all ${transitions.quick}`,
                }}
              >
                <Upload size={32} color={colors.textTertiary} style={{ marginBottom: spacing['3'] }} />
                <p style={{
                  margin: 0, fontSize: typography.fontSize.title,
                  fontWeight: typography.fontWeight.medium, color: colors.textPrimary,
                  marginBottom: spacing['1'],
                }}>
                  Drop your draw report here
                </p>
                <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                  AIA G702/G703 (PDF) or Excel (.xlsx) — any format, any layout
                </p>
              </div>

              <div style={{
                marginTop: spacing['4'], padding: spacing['4'],
                backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
                  <Sparkles size={14} color={colors.primaryOrange} />
                  <span style={{
                    fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                    color: colors.textPrimary,
                  }}>
                    AI reads the full G703 continuation sheet
                  </span>
                </div>
                <div style={{
                  fontSize: typography.fontSize.caption, color: colors.textSecondary, lineHeight: 1.6,
                }}>
                  <p style={{ margin: `0 0 ${spacing['1']}` }}>
                    Extracts every line item: scheduled value, work completed this period,
                    materials stored, % complete, retainage, balance to finish.
                  </p>
                  <p style={{ margin: 0 }}>
                    You'll review every row before anything is saved. Low-confidence reads
                    are flagged so you can spot-fix misreads.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ── Step: Extracting ───────────────────────────── */}
          {step === 'extracting' && (
            <div style={{
              textAlign: 'center', padding: `${spacing['8']} ${spacing['4']}`,
            }}>
              <Sparkles size={32} color={colors.primaryOrange} className="pulse" />
              <p style={{
                marginTop: spacing['4'], fontSize: typography.fontSize.title,
                fontWeight: typography.fontWeight.medium, color: colors.textPrimary,
              }}>
                Extracting line items…
              </p>
              <p style={{
                margin: `${spacing['2']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textTertiary,
              }}>
                AI is reading every line item. Takes 20–60 seconds for a typical G702/G703.
              </p>
              <p style={{
                marginTop: spacing['3'],
                fontSize: typography.fontSize.title,
                fontFamily: typography.fontFamilyMono,
                fontWeight: typography.fontWeight.semibold,
                color: colors.primaryOrange,
              }}>
                {Math.floor(extractElapsedSec / 60)}:{String(extractElapsedSec % 60).padStart(2, '0')}
              </p>
            </div>
          )}

          {/* ── Step: Review ───────────────────────────────── */}
          {step === 'review' && staged && (
            <>
              {/* Summary header */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['3'],
                marginBottom: spacing['4'],
              }}>
                <SummaryCard
                  label="Application"
                  value={staged.extraction.application_number ? `#${staged.extraction.application_number}` : '—'}
                />
                <SummaryCard
                  label="Period To"
                  value={staged.extraction.period_to || '—'}
                />
                <SummaryCard
                  label="Line Items"
                  value={String(editedLines.length)}
                />
                <SummaryCard
                  label="Contract Sum"
                  value={fmtCurrency(staged.extraction.contract_sum ?? totals.scheduled)}
                />
              </div>

              {/* Reconciliation banner — green when sum(line items) ≈ contract sum, red otherwise */}
              {liveRecon && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: spacing['2'],
                  padding: `${spacing['3']} ${spacing['3']}`,
                  backgroundColor: liveRecon.reconciled
                    ? `${colors.statusActive}12`
                    : liveRecon.severelyOff
                      ? `${colors.statusCritical}12`
                      : `${colors.statusPending}12`,
                  border: `1px solid ${(liveRecon.reconciled
                    ? colors.statusActive
                    : liveRecon.severelyOff
                      ? colors.statusCritical
                      : colors.statusPending) + '40'}`,
                  borderRadius: borderRadius.base, marginBottom: spacing['3'],
                  fontSize: typography.fontSize.caption,
                  color: liveRecon.reconciled
                    ? colors.statusActive
                    : liveRecon.severelyOff
                      ? colors.statusCritical
                      : colors.statusPending,
                }}>
                  {liveRecon.reconciled ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: typography.fontWeight.semibold, marginBottom: 2 }}>
                      {liveRecon.reconciled
                        ? `Reconciled: ${fmtCurrency(liveRecon.sumOfLines)} matches contract sum`
                        : `Off by ${fmtCurrency(Math.abs(liveRecon.deviationDollars))} (${liveRecon.deviationPct.toFixed(1)}%)`}
                    </div>
                    {!liveRecon.reconciled && (
                      <div style={{ fontWeight: typography.fontWeight.normal }}>
                        Sum of line items: {fmtCurrency(liveRecon.sumOfLines)} · Stated contract sum: {fmtCurrency(liveRecon.statedContractSum)}
                        {detectedSubtotalIdx.size > 0 && (
                          <>
                            {' · '}
                            <button
                              onClick={removeDetectedSubtotals}
                              style={{
                                border: 'none', background: 'transparent',
                                color: 'inherit', textDecoration: 'underline',
                                fontSize: 'inherit', cursor: 'pointer', padding: 0,
                                fontWeight: typography.fontWeight.semibold,
                              }}
                            >
                              Remove {detectedSubtotalIdx.size} detected subtotal row{detectedSubtotalIdx.size !== 1 ? 's' : ''}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {lowConfidenceCount > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                  padding: `${spacing['2']} ${spacing['3']}`,
                  backgroundColor: `${colors.statusPending}12`,
                  border: `1px solid ${colors.statusPending}40`,
                  borderRadius: borderRadius.base, marginBottom: spacing['3'],
                  fontSize: typography.fontSize.caption, color: colors.statusPending,
                }}>
                  <AlertTriangle size={12} />
                  <span>
                    {lowConfidenceCount} row{lowConfidenceCount !== 1 ? 's' : ''} flagged as low confidence —
                    verify the numbers in rows marked with an amber dot.
                  </span>
                </div>
              )}

              {staged.extraction.warnings.length > 0 && (() => {
                // Truncation / safety / incomplete-response warnings deserve
                // the red critical banner. Other warnings (dropped subtotals,
                // missing columns) stay in the muted info banner.
                const critical = staged.extraction.warnings.filter((w) =>
                  /truncated|incomplete|finishReason/i.test(w),
                )
                const infoOnly = staged.extraction.warnings.filter((w) =>
                  !/truncated|incomplete|finishReason/i.test(w),
                )
                return (
                  <>
                    {critical.length > 0 && (
                      <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: spacing['2'],
                        padding: `${spacing['3']} ${spacing['3']}`,
                        backgroundColor: `${colors.statusCritical}12`,
                        border: `1px solid ${colors.statusCritical}50`,
                        borderRadius: borderRadius.base,
                        marginBottom: spacing['3'],
                        fontSize: typography.fontSize.caption,
                        color: colors.statusCritical,
                        fontWeight: typography.fontWeight.medium,
                      }}>
                        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                          {critical.map((w, i) => <div key={i}>{w}</div>)}
                        </div>
                      </div>
                    )}
                    {infoOnly.length > 0 && (
                      <div style={{
                        padding: `${spacing['2']} ${spacing['3']}`,
                        backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base,
                        marginBottom: spacing['3'], fontSize: typography.fontSize.caption,
                        color: colors.textSecondary,
                      }}>
                        {infoOnly.map((w, i) => <div key={i}>{w}</div>)}
                      </div>
                    )}
                  </>
                )
              })()}

              {/* Bulk actions toolbar — appears when ≥1 row selected */}
              {selectedIdx.size > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  backgroundColor: colors.surfaceInset,
                  borderRadius: borderRadius.base, marginBottom: spacing['2'],
                  fontSize: typography.fontSize.caption, color: colors.textSecondary,
                }}>
                  <span>{selectedIdx.size} row{selectedIdx.size !== 1 ? 's' : ''} selected</span>
                  <button
                    onClick={deleteSelected}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                      padding: `${spacing['1']} ${spacing['3']}`,
                      border: `1px solid ${colors.statusCritical}40`, borderRadius: borderRadius.base,
                      backgroundColor: `${colors.statusCritical}10`, color: colors.statusCritical,
                      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                      cursor: 'pointer', fontFamily: typography.fontFamily,
                    }}
                  >
                    <Trash2 size={12} /> Delete selected ({selectedIdx.size})
                  </button>
                </div>
              )}

              {/* Editable grid */}
              <div style={{
                overflowX: 'auto', border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.md,
              }}>
                <div style={{ minWidth: 1010 }}>
                  {/* Header row */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 50px 2fr 110px 110px 110px 100px 70px 100px 100px 24px',
                    gap: spacing['2'],
                    padding: `${spacing['2']} ${spacing['3']}`,
                    backgroundColor: colors.surfaceInset,
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                    alignItems: 'center',
                  }}>
                    <input
                      type="checkbox"
                      checked={editedLines.length > 0 && selectedIdx.size === editedLines.length}
                      ref={(el) => {
                        if (el) el.indeterminate = selectedIdx.size > 0 && selectedIdx.size < editedLines.length
                      }}
                      onChange={toggleAllRows}
                      aria-label="Select all rows"
                      style={{ cursor: 'pointer', width: 16, height: 16 }}
                    />
                    {['#', 'Description', 'Sched. Value', 'Previous', 'This Period', 'Stored', '%', 'Retainage', 'Balance', ''].map((h) => (
                      <span key={h} style={{
                        fontSize: typography.fontSize.caption,
                        color: colors.textSecondary,
                        fontWeight: typography.fontWeight.semibold,
                        textAlign: h === 'Description' || h === '#' ? 'left' : 'right',
                      }}>
                        {h}
                      </span>
                    ))}
                  </div>
                  {editedLines.map((line, idx) => {
                    const low = line.confidence < CONFIDENCE_THRESHOLD
                    const isSelected = selectedIdx.has(idx)
                    const isDetectedSubtotal = detectedSubtotalIdx.has(idx)
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '28px 50px 2fr 110px 110px 110px 100px 70px 100px 100px 24px',
                          gap: spacing['2'],
                          padding: `${spacing['2']} ${spacing['3']}`,
                          alignItems: 'center',
                          borderBottom: `1px solid ${colors.borderSubtle}`,
                          backgroundColor: isSelected
                            ? `${colors.statusInfo}10`
                            : isDetectedSubtotal
                              ? `${colors.statusPending}08`
                              : idx % 2 === 0 ? colors.white : colors.surfacePage,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(idx)}
                          aria-label={`Select row ${line.item_number}`}
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                        />
                        <span style={{
                          fontSize: typography.fontSize.sm,
                          fontFamily: typography.fontFamilyMono,
                          color: colors.textTertiary,
                        }}>
                          {line.item_number}
                        </span>
                        <CellInput
                          value={line.description}
                          onChange={(v) => updateLine(idx, { description: v })}
                          align="left"
                        />
                        <CellInput
                          value={String(line.scheduled_value)}
                          onChange={(v) => updateLine(idx, { scheduled_value: parseNum(v) })}
                          align="right"
                          numeric
                        />
                        <CellInput
                          value={String(line.previous_completed)}
                          onChange={(v) => updateLine(idx, { previous_completed: parseNum(v) })}
                          align="right"
                          numeric
                        />
                        <CellInput
                          value={String(line.this_period)}
                          onChange={(v) => updateLine(idx, { this_period: parseNum(v) })}
                          align="right"
                          numeric
                          highlight
                        />
                        <CellInput
                          value={String(line.materials_stored)}
                          onChange={(v) => updateLine(idx, { materials_stored: parseNum(v) })}
                          align="right"
                          numeric
                        />
                        <CellInput
                          value={String(line.percent_complete)}
                          onChange={(v) => updateLine(idx, { percent_complete: parseNum(v) })}
                          align="right"
                          numeric
                          suffix="%"
                        />
                        <CellInput
                          value={String(line.retainage)}
                          onChange={(v) => updateLine(idx, { retainage: parseNum(v) })}
                          align="right"
                          numeric
                        />
                        <CellInput
                          value={String(line.balance_to_finish)}
                          onChange={(v) => updateLine(idx, { balance_to_finish: parseNum(v) })}
                          align="right"
                          numeric
                        />
                        <div
                          title={low ? `Low confidence (${Math.round(line.confidence * 100)}%) — verify values` : `Confidence ${Math.round(line.confidence * 100)}%`}
                          style={{
                            width: 10, height: 10, borderRadius: '50%',
                            backgroundColor: low ? colors.statusPending : colors.statusActive,
                            justifySelf: 'center',
                          }}
                        />
                      </div>
                    )
                  })}
                  {/* Totals row */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 50px 2fr 110px 110px 110px 100px 70px 100px 100px 24px',
                    gap: spacing['2'],
                    padding: `${spacing['3']} ${spacing['3']}`,
                    backgroundColor: colors.darkNavy,
                    color: colors.white,
                  }}>
                    <span />
                    <span />
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold }}>TOTAL</span>
                    <TotalCell value={totals.scheduled} />
                    <TotalCell value={totals.prev} />
                    <TotalCell value={totals.thisPeriod} highlight />
                    <TotalCell value={totals.materials} />
                    <span style={{
                      fontSize: typography.fontSize.sm,
                      fontFamily: typography.fontFamilyMono,
                      textAlign: 'right',
                    }}>
                      {totals.scheduled > 0
                        ? `${((totals.completed / totals.scheduled) * 100).toFixed(1)}%`
                        : '0%'}
                    </span>
                    <TotalCell value={totals.retainage} color={colors.statusPending} />
                    <TotalCell value={totals.scheduled - totals.completed} />
                    <span />
                  </div>
                </div>
              </div>

              {/* Override checkbox — appears ONLY when reconciliation would block commit. */}
              {liveRecon && liveRecon.severelyOff && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                  marginTop: spacing['3'],
                  padding: `${spacing['2']} ${spacing['3']}`,
                  backgroundColor: `${colors.statusCritical}08`,
                  border: `1px solid ${colors.statusCritical}30`,
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.caption, color: colors.textPrimary,
                }}>
                  <input
                    type="checkbox"
                    id="recon-override"
                    checked={overrideGuard}
                    onChange={(e) => setOverrideGuard(e.target.checked)}
                    style={{ cursor: 'pointer', width: 16, height: 16 }}
                  />
                  <label htmlFor="recon-override" style={{ cursor: 'pointer' }}>
                    Save anyway — I've verified the numbers are correct despite the mismatch
                  </label>
                </div>
              )}

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: spacing['4'], gap: spacing['3'],
              }}>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  Source: {staged.filename}
                  {staged.sheetHint ? ` · sheet "${staged.sheetHint.name}"` : ''}
                  {` · model ${staged.model}`}
                </span>
                <div style={{ display: 'flex', gap: spacing['2'] }}>
                  <Btn variant="ghost" onClick={handleClose}>Cancel</Btn>
                  <Btn
                    variant="primary"
                    onClick={handleCommit}
                    disabled={editedLines.length === 0 || (liveRecon?.severelyOff && !overrideGuard)}
                  >
                    Save {editedLines.length} line item{editedLines.length !== 1 ? 's' : ''}
                  </Btn>
                </div>
              </div>
            </>
          )}

          {/* ── Step: Committing ───────────────────────────── */}
          {step === 'committing' && (
            <div style={{ textAlign: 'center', padding: `${spacing['8']} ${spacing['4']}` }}>
              <Sparkles size={32} color={colors.primaryOrange} />
              <p style={{
                marginTop: spacing['4'], fontSize: typography.fontSize.title,
                fontWeight: typography.fontWeight.medium, color: colors.textPrimary,
              }}>
                Saving pay app + updating budget…
              </p>
            </div>
          )}

          {/* ── Step: Done ─────────────────────────────────── */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: `${spacing['8']} ${spacing['4']}` }}>
              <CheckCircle size={48} color={colors.statusActive} />
              <p style={{
                marginTop: spacing['4'], fontSize: typography.fontSize.title,
                fontWeight: typography.fontWeight.semibold, color: colors.textPrimary,
              }}>
                Draw report saved
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  if (!Number.isFinite(n)) return '$0'
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function parseNum(v: string): number {
  const cleaned = v.replace(/[$,\s%]/g, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

// ── Presentational subcomponents ──────────────────────────

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: `${spacing['2']} ${spacing['3']}`,
      backgroundColor: colors.surfaceInset,
      borderRadius: borderRadius.base,
    }}>
      <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{
        marginTop: 2, fontSize: typography.fontSize.title,
        fontWeight: typography.fontWeight.semibold, color: colors.textPrimary,
        fontFamily: typography.fontFamilyMono,
      }}>
        {value}
      </div>
    </div>
  )
}

function CellInput({
  value, onChange, align, numeric, suffix, highlight,
}: {
  value: string
  onChange: (v: string) => void
  align: 'left' | 'right'
  numeric?: boolean
  suffix?: string
  highlight?: boolean
}) {
  return (
    <input
      value={suffix && value.endsWith(suffix) ? value : value}
      onChange={(e) => onChange(e.target.value)}
      inputMode={numeric ? 'decimal' : 'text'}
      style={{
        width: '100%',
        padding: `${spacing['1']} ${spacing['2']}`,
        border: `1px solid transparent`,
        borderRadius: borderRadius.base,
        backgroundColor: 'transparent',
        fontSize: typography.fontSize.sm,
        fontFamily: numeric ? typography.fontFamilyMono : typography.fontFamily,
        color: highlight ? colors.primaryOrange : colors.textPrimary,
        textAlign: align,
        fontWeight: highlight ? typography.fontWeight.semibold : typography.fontWeight.normal,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = colors.borderDefault }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent' }}
    />
  )
}

function TotalCell({ value, highlight, color }: { value: number; highlight?: boolean; color?: string }) {
  return (
    <span style={{
      fontSize: typography.fontSize.sm,
      fontFamily: typography.fontFamilyMono,
      fontWeight: typography.fontWeight.bold,
      textAlign: 'right',
      color: color ?? (highlight ? colors.primaryOrange : colors.white),
    }}>
      {fmtCurrency(value)}
    </span>
  )
}

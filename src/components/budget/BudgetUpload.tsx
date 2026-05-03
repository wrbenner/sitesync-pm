import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Upload, X, FileSpreadsheet, CheckCircle, Sparkles, AlertCircle, ChevronRight, ChevronDown, ArrowLeft, Layers, Eye, Zap } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { useProjectContext } from '../../stores/projectContextStore';
import {
  detectBudgetSheets,
  parseBudgetWorkbook,
  groupByCSIDivision,
  toImportPayload,
  type SheetCandidate,
  type ParseResult,
} from '../../lib/budgetParser';
import { budgetService } from '../../services/budgetService';

interface BudgetUploadProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ImportStep = 'upload' | 'select_sheet' | 'preview' | 'importing' | 'done';

export function BudgetUpload({ open, onClose, onSuccess }: BudgetUploadProps) {
  const queryClient = useQueryClient();
  const { activeProject } = useProjectContext();
  const inputRef = useRef<HTMLInputElement>(null);

  // State
  const [step, setStep] = useState<ImportStep>('upload');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [_fileName, setFileName] = useState('');
  const [sheetCandidates, setSheetCandidates] = useState<SheetCandidate[]>([]);
  const [_selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [includeNIC, setIncludeNIC] = useState(false);
  const [error, setError] = useState('');
  const [importProgress, setImportProgress] = useState(0);

  // ── File handling ──────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    setError('');
    setFileName(file.name);
    setStep('upload'); // show loading state

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary', cellStyles: true });
        setWorkbook(wb);

        const candidates = detectBudgetSheets(wb);
        setSheetCandidates(candidates);

        // If multiple sheets with decent scores, show sheet picker
        const goodCandidates = candidates.filter(c => c.score >= 15);
        if (goodCandidates.length > 1) {
          setSelectedSheetIndex(candidates[0].index);
          setStep('select_sheet');
        } else {
          // Auto-select best sheet and parse
          const bestIndex = candidates[0]?.index ?? 0;
          setSelectedSheetIndex(bestIndex);
          const result = parseBudgetWorkbook(wb, bestIndex);
          setParseResult(result);
          setStep('preview');
        }
      } catch (err) {
        setError(`Failed to read file: ${(err as Error).message}`);
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const handleSelectSheet = useCallback((sheetIndex: number) => {
    if (!workbook) return;
    setSelectedSheetIndex(sheetIndex);
    try {
      const result = parseBudgetWorkbook(workbook, sheetIndex);
      setParseResult(result);
      setStep('preview');
    } catch (err) {
      setError(`Failed to parse sheet: ${(err as Error).message}`);
    }
  }, [workbook]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Import ─────────────────────────────────────────────────

  const activeRows = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.rows.filter(r => {
      if (excludedRows.has(r.sourceRow)) return false;
      if (r.isNIC && !includeNIC) return false;
      return true;
    });
  }, [parseResult, excludedRows, includeNIC]);

  const grouped = useMemo(() => groupByCSIDivision(activeRows), [activeRows]);

  const totalBudget = useMemo(
    () => activeRows.reduce((s, r) => s + r.budgetAmount, 0),
    [activeRows],
  );

  const handleImport = async () => {
    if (!activeProject || activeRows.length === 0) return;
    setStep('importing');
    setImportProgress(0);

    try {
      const payload = toImportPayload(activeRows);
      setImportProgress(30);

      const result = await budgetService.importDivisionRows(activeProject.id, payload);
      setImportProgress(80);

      if (!result.ok) {
        setError(result.error?.message || 'Import failed');
        setStep('preview');
        return;
      }

      setImportProgress(100);

      await queryClient.invalidateQueries({ queryKey: ['budget_divisions', activeProject.id] });
      await queryClient.invalidateQueries({ queryKey: ['budget_items', activeProject.id] });

      setStep('done');
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1500);
    } catch (err) {
      setError((err as Error).message);
      setStep('preview');
    }
  };

  // ── Reset ──────────────────────────────────────────────────

  const handleClose = () => {
    setStep('upload');
    setWorkbook(null);
    setFileName('');
    setSheetCandidates([]);
    setParseResult(null);
    setExpandedSections(new Set());
    setExcludedRows(new Set());
    setIncludeNIC(false);
    setError('');
    setImportProgress(0);
    onClose();
  };

  const handleBack = () => {
    if (step === 'preview' && sheetCandidates.filter(c => c.score >= 15).length > 1) {
      setStep('select_sheet');
    } else {
      setStep('upload');
      setWorkbook(null);
      setParseResult(null);
    }
  };

  if (!open) return null;

  // ── Formatting helpers ─────────────────────────────────────

  const fmt = (n: number): string => {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toLocaleString()}`;
  };

  const fmtFull = (n: number): string => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  // ── Render ─────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          boxShadow: shadows.panel,
          width: step === 'preview' ? '860px' : '640px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: typography.fontFamily,
          transition: `width ${transitions.normal}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: `${spacing['4']} ${spacing['6']}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            {step !== 'upload' && step !== 'importing' && step !== 'done' && (
              <button
                onClick={handleBack}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', borderRadius: borderRadius.base, backgroundColor: colors.surfaceHover, cursor: 'pointer', color: colors.textSecondary, flexShrink: 0 }}
              >
                <ArrowLeft size={14} />
              </button>
            )}
            <FileSpreadsheet size={18} color={colors.primaryOrange} />
            <h2 style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              {step === 'upload' ? 'Import Budget' :
               step === 'select_sheet' ? 'Select Budget Sheet' :
               step === 'preview' ? 'Review & Import' :
               step === 'importing' ? 'Importing...' :
               'Import Complete'}
            </h2>
          </div>
          <button onClick={handleClose} aria-label="Close" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: 'none', borderRadius: borderRadius.base, backgroundColor: 'transparent', cursor: 'pointer', color: colors.textTertiary }}>
            <X size={18} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────── */}
        <div style={{ padding: `${spacing['5']} ${spacing['6']}`, overflow: 'auto', flex: 1 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'], padding: spacing['3'], backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.base, color: colors.statusCritical, fontSize: typography.fontSize.sm, marginBottom: spacing['4'] }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}

          {/* ── Step: Upload ──────────────────────────── */}
          {step === 'upload' && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <div
                onClick={() => inputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                style={{
                  border: `2px dashed ${colors.borderDefault}`,
                  borderRadius: borderRadius.lg,
                  padding: `${spacing['8']} ${spacing['6']}`,
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: `all ${transitions.quick}`,
                }}
              >
                <Upload size={32} color={colors.textTertiary} style={{ marginBottom: spacing['3'] }} />
                <p style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                  Drop your budget file here
                </p>
                <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                  Excel (.xlsx, .xls) or CSV — any format, any layout
                </p>
              </div>

              <div style={{ marginTop: spacing['4'], padding: spacing['4'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
                  <Zap size={14} color={colors.primaryOrange} />
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Handles real-world budgets</span>
                </div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, lineHeight: 1.6 }}>
                  <p style={{ margin: `0 0 ${spacing['1']}` }}>Works with messy spreadsheets — the kind GCs actually use. Multi-sheet workbooks, custom cost codes, merged cells, section totals, NIC values, metadata rows, subcontractor notes.</p>
                  <p style={{ margin: 0 }}>Auto-detects the budget sheet, finds headers wherever they are, maps your cost codes to CSI divisions, and skips the noise.</p>
                </div>
              </div>
            </>
          )}

          {/* ── Step: Sheet Selection ─────────────────── */}
          {step === 'select_sheet' && (
            <>
              <p style={{ margin: `0 0 ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                This workbook has {sheetCandidates.length} sheets. Select the one containing your budget data.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                {sheetCandidates.map((candidate) => {
                  const isRecommended = candidate.index === sheetCandidates[0]?.index;
                  return (
                    <button
                      key={candidate.index}
                      onClick={() => handleSelectSheet(candidate.index)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: spacing['3'],
                        padding: `${spacing['3']} ${spacing['4']}`,
                        border: `1px solid ${isRecommended ? colors.primaryOrange : colors.borderDefault}`,
                        borderRadius: borderRadius.md,
                        backgroundColor: isRecommended ? colors.orangeSubtle : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: typography.fontFamily,
                        transition: `all ${transitions.quick}`,
                        width: '100%',
                      }}
                    >
                      <Layers size={16} color={isRecommended ? colors.primaryOrange : colors.textTertiary} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{candidate.name}</span>
                          {isRecommended && (
                            <span style={{ fontSize: '10px', fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recommended</span>
                          )}
                        </div>
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                          {candidate.rowCount} rows · {candidate.dollarValues} dollar values · {candidate.reason}
                        </span>
                      </div>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: candidate.score >= 50 ? `${colors.statusActive}18` : candidate.score >= 20 ? `${colors.statusPending}18` : `${colors.textTertiary}18`,
                        fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                        color: candidate.score >= 50 ? colors.statusActive : candidate.score >= 20 ? colors.statusPending : colors.textTertiary,
                      }}>
                        {candidate.score}
                      </div>
                      <ChevronRight size={14} color={colors.textTertiary} />
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Step: Preview ─────────────────────────── */}
          {step === 'preview' && parseResult && (
            <>
              {/* Summary bar */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['3'],
                marginBottom: spacing['4'],
              }}>
                <SummaryCard label="Line Items" value={String(activeRows.length)} />
                <SummaryCard label="Total Budget" value={fmt(totalBudget)} />
                <SummaryCard label="Divisions" value={String(grouped.size)} />
                <SummaryCard label="AI Mapped" value={`${activeRows.filter(r => r.aiMapped).length}`} icon={<Sparkles size={10} color={colors.primaryOrange} />} />
              </div>

              {/* Verification */}
              {parseResult.grandTotal !== null && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                  padding: `${spacing['2']} ${spacing['3']}`,
                  backgroundColor: Math.abs(totalBudget - parseResult.grandTotal) < 2
                    ? `${colors.statusActive}10`
                    : `${colors.statusPending}10`,
                  borderRadius: borderRadius.base,
                  marginBottom: spacing['3'],
                  fontSize: typography.fontSize.caption,
                  color: Math.abs(totalBudget - parseResult.grandTotal) < 2 ? colors.statusActive : colors.statusPending,
                }}>
                  <CheckCircle size={12} />
                  <span>
                    Spreadsheet total: {fmtFull(parseResult.grandTotal)}
                    {Math.abs(totalBudget - parseResult.grandTotal) < 2
                      ? ' — matches parsed total'
                      : ` — parsed total: ${fmtFull(totalBudget)} (${parseResult.sectionTotals.length} section totals excluded)`}
                  </span>
                </div>
              )}

              {/* Warnings */}
              {parseResult.warnings.length > 0 && (
                <div style={{
                  padding: `${spacing['2']} ${spacing['3']}`,
                  backgroundColor: `${colors.statusPending}10`,
                  border: `1px solid ${colors.statusPending}30`,
                  borderRadius: borderRadius.base,
                  marginBottom: spacing['3'],
                }}>
                  {parseResult.warnings.map((w, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'], fontSize: typography.fontSize.caption, color: colors.textSecondary, lineHeight: 1.5, marginBottom: i < parseResult.warnings.length - 1 ? spacing['1'] : 0 }}>
                      <AlertCircle size={11} color={colors.statusPending} style={{ flexShrink: 0, marginTop: 3 }} />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* NIC toggle */}
              {parseResult.rows.some(r => r.isNIC) && (
                <label style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'], fontSize: typography.fontSize.caption, color: colors.textSecondary, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={includeNIC}
                    onChange={(e) => setIncludeNIC(e.target.checked)}
                    style={{ accentColor: colors.primaryOrange }}
                  />
                  Include NIC (Not In Contract) items ({parseResult.rows.filter(r => r.isNIC).length} items, $0 budget)
                </label>
              )}

              {/* Grouped preview table */}
              <div style={{
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.md,
                overflow: 'hidden',
                maxHeight: '400px',
                overflowY: 'auto',
              }}>
                {/* Table header */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '60px 1fr 110px 90px',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  backgroundColor: colors.surfaceInset,
                  borderBottom: `1px solid ${colors.borderDefault}`,
                  position: 'sticky', top: 0, zIndex: 1,
                }}>
                  <span style={{ ...captionStyle }}>Code</span>
                  <span style={{ ...captionStyle }}>Description</span>
                  <span style={{ ...captionStyle, textAlign: 'right' }}>Budget</span>
                  <span style={{ ...captionStyle, textAlign: 'center' }}>Source</span>
                </div>

                {/* Grouped rows */}
                {Array.from(grouped.entries()).map(([sectionKey, sectionRows]) => {
                  const isExpanded = expandedSections.has(sectionKey);
                  const sectionTotal = sectionRows.reduce((s, r) => s + r.budgetAmount, 0);

                  return (
                    <div key={sectionKey}>
                      {/* Section header */}
                      <button
                        onClick={() => {
                          setExpandedSections(prev => {
                            const next = new Set(prev);
                            if (next.has(sectionKey)) next.delete(sectionKey);
                            else next.add(sectionKey);
                            return next;
                          });
                        }}
                        style={{
                          display: 'grid', gridTemplateColumns: '60px 1fr 110px 90px',
                          padding: `${spacing['2']} ${spacing['3']}`,
                          width: '100%',
                          border: 'none',
                          borderBottom: `1px solid ${colors.borderSubtle}`,
                          backgroundColor: colors.surfaceHover,
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: typography.fontFamily,
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.primaryOrange, fontFamily: 'monospace', fontWeight: typography.fontWeight.semibold }}>
                          {sectionRows[0].csiCode}
                        </span>
                        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          {sectionRows[0].csiName}
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.normal }}>
                            ({sectionRows.length})
                          </span>
                        </span>
                        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(sectionTotal)}
                        </span>
                        <span />
                      </button>

                      {/* Expanded rows */}
                      {isExpanded && sectionRows.map((row, i) => (
                        <div
                          key={`${row.sourceRow}-${i}`}
                          style={{
                            display: 'grid', gridTemplateColumns: '60px 1fr 110px 90px',
                            padding: `${spacing['1']} ${spacing['3']} ${spacing['1']} ${spacing['6']}`,
                            borderBottom: `1px solid ${colors.borderSubtle}`,
                            alignItems: 'center',
                            opacity: row.isNIC ? 0.5 : 1,
                          }}
                        >
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontFamily: 'monospace' }}>
                            {row.rawCode || '—'}
                          </span>
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.description}
                            {row.isNIC && <span style={{ marginLeft: spacing['1'], fontSize: '10px', color: colors.statusPending, fontWeight: typography.fontWeight.semibold }}>NIC</span>}
                          </span>
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textPrimary, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {row.isNIC ? 'NIC' : fmtFull(row.budgetAmount)}
                          </span>
                          <span style={{ textAlign: 'center' }}>
                            {row.aiMapped ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '10px', color: colors.primaryOrange }}>
                                <Sparkles size={9} /> mapped
                              </span>
                            ) : (
                              <span style={{ fontSize: '10px', color: colors.statusActive }}>direct</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Metadata */}
              {parseResult.metadata && Object.keys(parseResult.metadata).length > 0 && (
                <div style={{ marginTop: spacing['3'], padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginBottom: spacing['1'] }}>
                    <Eye size={11} color={colors.textTertiary} />
                    <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary }}>Detected Metadata</span>
                  </div>
                  <div style={{ display: 'flex', gap: spacing['4'], flexWrap: 'wrap' }}>
                    {Object.entries(parseResult.metadata).map(([key, val]) => (
                      <span key={key} style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                        <span style={{ color: colors.textTertiary }}>{key}:</span> {val}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step: Importing ───────────────────────── */}
          {step === 'importing' && (
            <div style={{ textAlign: 'center', padding: `${spacing['8']} 0` }}>
              <div style={{ width: '100%', height: 4, backgroundColor: colors.surfaceInset, borderRadius: 2, overflow: 'hidden', marginBottom: spacing['4'] }}>
                <div style={{ width: `${importProgress}%`, height: '100%', backgroundColor: colors.primaryOrange, borderRadius: 2, transition: `width ${transitions.normal}` }} />
              </div>
              <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                Importing {activeRows.length} line items into {grouped.size} divisions...
              </p>
            </div>
          )}

          {/* ── Step: Done ────────────────────────────── */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: `${spacing['8']} 0` }}>
              <CheckCircle size={40} color={colors.statusActive} style={{ marginBottom: spacing['3'] }} />
              <p style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                Budget imported successfully
              </p>
              <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                {activeRows.length} line items · {fmt(totalBudget)} total budget
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────── */}
        {step === 'preview' && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: `${spacing['3']} ${spacing['6']}`,
            borderTop: `1px solid ${colors.borderSubtle}`,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              {activeRows.length} items · {grouped.size} divisions · {fmt(totalBudget)}
            </span>
            <div style={{ display: 'flex', gap: spacing['2'] }}>
              <button onClick={handleClose} style={{ ...btnBase, border: `1px solid ${colors.borderDefault}`, color: colors.textSecondary }}>
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={activeRows.length === 0}
                style={{
                  ...btnBase,
                  backgroundColor: colors.primaryOrange,
                  color: '#fff',
                  fontWeight: typography.fontWeight.medium,
                  opacity: activeRows.length === 0 ? 0.5 : 1,
                  cursor: activeRows.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                Import {activeRows.length} Items
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function SummaryCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      padding: `${spacing['2']} ${spacing['3']}`,
      backgroundColor: colors.surfaceInset,
      borderRadius: borderRadius.base,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['1'] }}>
        {value}
        {icon}
      </div>
      <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Shared styles ────────────────────────────────────────────

const captionStyle: React.CSSProperties = {
  fontSize: typography.fontSize.caption,
  fontWeight: typography.fontWeight.medium,
  color: colors.textTertiary,
};

const btnBase: React.CSSProperties = {
  padding: `${spacing['2']} ${spacing['4']}`,
  border: 'none',
  borderRadius: borderRadius.md,
  backgroundColor: 'transparent',
  fontSize: typography.fontSize.sm,
  cursor: 'pointer',
  fontFamily: typography.fontFamily,
};

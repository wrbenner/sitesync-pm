import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileSpreadsheet, CheckCircle, Sparkles, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { useBudgetStore } from '../../stores/budgetStore';
import { useProjectContext } from '../../stores/projectContextStore';

interface ParsedRow {
  name: string;
  code: string;
  budgeted_amount: number;
  spent: number;
  committed: number;
  aiAssigned: boolean;
}

interface BudgetUploadProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// AI-powered mapping of common budget categories to CSI division codes
const AI_CATEGORY_MAP: Record<string, { code: string; name: string }> = {
  'general conditions': { code: '01', name: 'General Conditions' },
  'general requirements': { code: '01', name: 'General Conditions' },
  'site work': { code: '31', name: 'Site Work' },
  'earthwork': { code: '31', name: 'Site Work' },
  'excavation': { code: '31', name: 'Site Work' },
  'concrete': { code: '03', name: 'Concrete' },
  'masonry': { code: '04', name: 'Masonry' },
  'metals': { code: '05', name: 'Metals' },
  'steel': { code: '05', name: 'Structural Steel' },
  'structural steel': { code: '05', name: 'Structural Steel' },
  'wood': { code: '06', name: 'Wood and Plastics' },
  'carpentry': { code: '06', name: 'Carpentry' },
  'thermal': { code: '07', name: 'Thermal and Moisture' },
  'roofing': { code: '07', name: 'Roofing' },
  'waterproofing': { code: '07', name: 'Waterproofing' },
  'doors': { code: '08', name: 'Doors and Windows' },
  'windows': { code: '08', name: 'Doors and Windows' },
  'hardware': { code: '08', name: 'Hardware' },
  'finishes': { code: '09', name: 'Finishes' },
  'drywall': { code: '09', name: 'Drywall' },
  'painting': { code: '09', name: 'Painting' },
  'flooring': { code: '09', name: 'Flooring' },
  'tile': { code: '09', name: 'Tile' },
  'interior': { code: '12', name: 'Interior Finishes' },
  'specialties': { code: '10', name: 'Specialties' },
  'equipment': { code: '11', name: 'Equipment' },
  'furnishings': { code: '12', name: 'Furnishings' },
  'conveying': { code: '14', name: 'Conveying Systems' },
  'elevator': { code: '14', name: 'Elevator' },
  'mechanical': { code: '23', name: 'Mechanical' },
  'hvac': { code: '23', name: 'HVAC' },
  'plumbing': { code: '22', name: 'Plumbing' },
  'fire protection': { code: '21', name: 'Fire Protection' },
  'sprinkler': { code: '21', name: 'Fire Sprinkler' },
  'electrical': { code: '26', name: 'Electrical' },
  'low voltage': { code: '27', name: 'Communications' },
  'fire alarm': { code: '28', name: 'Fire Alarm' },
  'landscape': { code: '32', name: 'Landscape' },
  'paving': { code: '32', name: 'Paving' },
  'utilities': { code: '33', name: 'Utilities' },
};

function aiAssignDivisionCode(rawName: string): { code: string; name: string } | null {
  const lower = rawName.toLowerCase().trim();
  // Direct match
  if (AI_CATEGORY_MAP[lower]) return AI_CATEGORY_MAP[lower];
  // Partial match
  for (const [key, val] of Object.entries(AI_CATEGORY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  return null;
}

function parseNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[$,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

export function BudgetUpload({ open, onClose, onSuccess }: BudgetUploadProps) {
  const { importDivisions } = useBudgetStore();
  const { activeProject } = useProjectContext();
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFile = useCallback((file: File) => {
    setParsing(true);
    setError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);

        if (json.length === 0) {
          setError('No data found in the spreadsheet');
          setParsing(false);
          return;
        }

        // Auto-detect columns
        const nameCol = Object.keys(json[0]).find((k) => {
          const l = k.toLowerCase();
          return l.includes('name') || l.includes('description') || l.includes('division') || l.includes('category') || l.includes('item');
        }) || Object.keys(json[0])[0];

        const budgetCol = Object.keys(json[0]).find((k) => {
          const l = k.toLowerCase();
          return l.includes('budget') || l.includes('amount') || l.includes('value') || l.includes('total') || l.includes('cost');
        });

        const spentCol = Object.keys(json[0]).find((k) => {
          const l = k.toLowerCase();
          return l.includes('spent') || l.includes('actual') || l.includes('paid');
        });

        const committedCol = Object.keys(json[0]).find((k) => {
          const l = k.toLowerCase();
          return l.includes('committed') || l.includes('encumbered') || l.includes('contract');
        });

        const codeCol = Object.keys(json[0]).find((k) => {
          const l = k.toLowerCase();
          return l.includes('code') || l.includes('csi') || l.includes('division');
        });

        const rows: ParsedRow[] = json
          .map((row) => {
            const rawName = String(row[nameCol!] ?? '').trim();
            if (!rawName) return null;

            const budgetAmount = budgetCol ? parseNumber(row[budgetCol]) : 0;
            const spentAmount = spentCol ? parseNumber(row[spentCol]) : 0;
            const committedAmount = committedCol ? parseNumber(row[committedCol]) : 0;

            let code = codeCol ? String(row[codeCol] ?? '').trim() : '';
            let name = rawName;
            let aiAssigned = false;

            // AI assignment if no code found
            if (!code) {
              const aiResult = aiAssignDivisionCode(rawName);
              if (aiResult) {
                code = aiResult.code;
                name = aiResult.name;
                aiAssigned = true;
              } else {
                code = '00';
                aiAssigned = true;
              }
            }

            return {
              name,
              code,
              budgeted_amount: budgetAmount,
              spent: spentAmount,
              committed: committedAmount,
              aiAssigned,
            };
          })
          .filter(Boolean) as ParsedRow[];

        setParsedRows(rows);
        setParsing(false);
      } catch (err) {
        setError(`Failed to parse file: ${(err as Error).message}`);
        setParsing(false);
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = async () => {
    if (!activeProject || parsedRows.length === 0) return;
    setImporting(true);

    const divisions = parsedRows.map((row) => ({
      project_id: activeProject.id,
      name: row.name,
      code: row.code,
      budgeted_amount: row.budgeted_amount,
      spent: row.spent,
      committed: row.committed,
    }));

    const { error: importError } = await importDivisions(activeProject.id, divisions);

    if (importError) {
      setError(importError);
    } else {
      onSuccess?.();
      handleClose();
    }
    setImporting(false);
  };

  const handleClose = () => {
    setParsedRows([]);
    setError('');
    setFileName('');
    onClose();
  };

  const fmt = (n: number): string => {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toLocaleString()}`;
  };

  const totalBudget = parsedRows.reduce((s, r) => s + r.budgeted_amount, 0);
  const aiCount = parsedRows.filter((r) => r.aiAssigned).length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.4)',
    }} onClick={handleClose}>
      <div
        style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          boxShadow: shadows.panel,
          width: '720px',
          maxHeight: '90vh',
          overflow: 'auto',
          fontFamily: typography.fontFamily,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: `${spacing['5']} ${spacing['6']}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <FileSpreadsheet size={18} color={colors.primaryOrange} />
            <h2 style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Import Budget
            </h2>
          </div>
          <button onClick={handleClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: 'none', borderRadius: borderRadius.base, backgroundColor: 'transparent', cursor: 'pointer', color: colors.textTertiary }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: `${spacing['5']} ${spacing['6']}` }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: spacing['3'], backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.base, color: colors.statusCritical, fontSize: typography.fontSize.sm, marginBottom: spacing['4'] }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {parsedRows.length === 0 ? (
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
                  {parsing ? 'Parsing file...' : 'Drop your budget file here'}
                </p>
                <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                  Excel (.xlsx, .xls) or CSV. We will auto detect columns and AI assign division codes.
                </p>
              </div>

              <div style={{ marginTop: spacing['4'], padding: spacing['3'], backgroundColor: `${colors.statusReview}06`, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusReview}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
                  <Sparkles size={12} color={colors.statusReview} />
                  <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusReview, textTransform: 'uppercase', letterSpacing: '0.4px' }}>AI Powered Import</span>
                </div>
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>
                  Upload any budget format. Our AI will automatically detect division names, amounts, and assign CSI codes. Works with owner budgets, GC schedules of values, and subcontractor breakdowns.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Parsed results */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['4'] }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                    <CheckCircle size={16} color={colors.statusActive} />
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                      Parsed {parsedRows.length} divisions from {fileName}
                    </span>
                  </div>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: spacing['6'] }}>
                    Total: {fmt(totalBudget)}
                    {aiCount > 0 && ` · ${aiCount} AI assigned codes`}
                  </span>
                </div>
                <button
                  onClick={() => { setParsedRows([]); setFileName(''); }}
                  style={{ padding: `${spacing['1']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, backgroundColor: 'transparent', fontSize: typography.fontSize.caption, color: colors.textSecondary, cursor: 'pointer', fontFamily: typography.fontFamily }}
                >
                  Upload Different File
                </button>
              </div>

              {/* Preview table */}
              <div style={{ border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, overflow: 'hidden', maxHeight: '340px', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 100px 100px 100px', padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.surfaceFlat, borderBottom: `1px solid ${colors.borderDefault}`, position: 'sticky', top: 0 }}>
                  <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>Code</span>
                  <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>Division</span>
                  <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary, textAlign: 'right' }}>Budget</span>
                  <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary, textAlign: 'right' }}>Spent</span>
                  <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary, textAlign: 'right' }}>Committed</span>
                </div>
                {parsedRows.map((row, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 100px 100px 100px', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: i < parsedRows.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none', alignItems: 'center' }}>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, fontFamily: 'monospace' }}>{row.code}</span>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                      {row.name}
                      {row.aiAssigned && (
                        <Sparkles size={10} color={colors.statusReview} />
                      )}
                    </span>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.budgeted_amount)}</span>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.spent)}</span>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.committed)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {parsedRows.length > 0 && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: spacing['3'],
            padding: `${spacing['4']} ${spacing['6']}`,
            borderTop: `1px solid ${colors.borderSubtle}`,
          }}>
            <button onClick={handleClose} style={{ padding: `${spacing['2']} ${spacing['4']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, backgroundColor: 'transparent', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, cursor: 'pointer', fontFamily: typography.fontFamily }}>
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['5']}`,
                border: 'none', borderRadius: borderRadius.md,
                backgroundColor: colors.primaryOrange,
                fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
                color: '#fff', cursor: importing ? 'not-allowed' : 'pointer',
                fontFamily: typography.fontFamily,
              }}
            >
              {importing ? 'Importing...' : `Import ${parsedRows.length} Divisions`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

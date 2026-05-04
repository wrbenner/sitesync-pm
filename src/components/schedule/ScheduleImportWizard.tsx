// SiteSync PM — Schedule Import/Export Wizard
// Multi-step wizard for importing P6 (.xer), MS Project (.xml), CSV, and PDF Gantt files.
// Also provides export dropdown for all formats.

import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  Upload, FileText, AlertTriangle, CheckCircle, ChevronRight, ChevronLeft,
  ChevronDown, Download, X, Search, ArrowRightLeft, Loader, Calendar,
  Clock, Link2, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageContainer, Card, Btn } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../../styles/theme';
import {
  detectFormat,
  parseXER,
  parseMSProjectXML,
  parseCSV,
  exportToMSProjectXML,
} from '../../lib/scheduleImport';
import type { ImportedActivity, ImportResult } from '../../lib/scheduleImport';
import { parsePdfSchedule } from '../../lib/schedulePdfImport';
import { exportToXER, exportToCSV, downloadFile } from '../../lib/scheduleExport';
import { supabase } from '../../lib/supabase';

// Valid schedule_phases.status values per the DB CHECK constraint
// (see migrations 00001_initial_schema.sql and 20260418000019_schedule_dependencies.sql).
type SchedulePhaseStatus = 'completed' | 'active' | 'upcoming' | 'at_risk' | 'delayed' | 'on_track';

function statusForActivity(act: ImportedActivity): SchedulePhaseStatus {
  if (act.percentComplete >= 100) return 'completed';
  if (act.isBehind) return 'delayed';
  if (act.percentComplete > 0) return 'active';
  return 'upcoming';
}

function activityToPhaseRow(projectId: string, act: ImportedActivity): Record<string, unknown> {
  // Only write columns that exist in the schedule_phases table.
  // Note: 'wbs' does NOT exist as a DB column — it must not be included.
  return {
    project_id: projectId,
    name: act.name,
    start_date: act.startDate || null,
    end_date: act.endDate || null,
    percent_complete: act.percentComplete ?? 0,
    status: statusForActivity(act),
    is_critical_path: act.isCritical ?? false,
    is_milestone: act.isMilestone ?? false,
    float_days: act.totalFloat ?? 0,
  };
}

// ── Types ───────────────────────────────────────────────────

interface FieldMapping {
  sourceField: string;
  targetField: string;
  auto: boolean;
}

type WizardStep = 'upload' | 'preview' | 'map' | 'review';

const STEPS: { key: WizardStep; label: string; number: number }[] = [
  { key: 'upload', label: 'Upload', number: 1 },
  { key: 'preview', label: 'Preview', number: 2 },
  { key: 'map', label: 'Map Fields', number: 3 },
  { key: 'review', label: 'Review & Import', number: 4 },
];

const SITESYNC_FIELDS = [
  'Activity Name',
  'WBS Code',
  'Start Date',
  'End Date',
  'Duration',
  'Percent Complete',
  'Predecessors',
  'Resources',
  'Calendar',
  'Critical Path',
  'Milestone',
  'Total Float',
  'Free Float',
  '-- Skip --',
];

const DEFAULT_FIELD_MAP: FieldMapping[] = [
  { sourceField: 'Name', targetField: 'Activity Name', auto: true },
  { sourceField: 'WBS', targetField: 'WBS Code', auto: true },
  { sourceField: 'Start Date', targetField: 'Start Date', auto: true },
  { sourceField: 'End Date', targetField: 'End Date', auto: true },
  { sourceField: 'Duration', targetField: 'Duration', auto: true },
  { sourceField: 'Percent Complete', targetField: 'Percent Complete', auto: true },
  { sourceField: 'Predecessors', targetField: 'Predecessors', auto: true },
  { sourceField: 'Resources', targetField: 'Resources', auto: true },
  { sourceField: 'Calendar', targetField: 'Calendar', auto: true },
  { sourceField: 'Critical', targetField: 'Critical Path', auto: true },
  { sourceField: 'Milestone', targetField: 'Milestone', auto: true },
  { sourceField: 'Total Float', targetField: 'Total Float', auto: true },
  { sourceField: 'Free Float', targetField: 'Free Float', auto: true },
];

// ── Accepted file extensions ────────────────────────────────

const ACCEPTED_EXTENSIONS = ['.xer', '.xml', '.csv', '.mpp', '.pdf'];

// ── Component ───────────────────────────────────────────────

interface ScheduleImportWizardProps {
  /** Activities currently in the schedule (for export) */
  existingActivities?: ImportedActivity[];
  projectName?: string;
  /** Project to write schedule_phases rows into. Required for real persistence. */
  projectId?: string;
  /** Called after rows are successfully inserted; parent invalidates caches here. */
  onImportComplete?: (result: ImportResult) => void;
  /** Called to close the wizard */
  onClose?: () => void;
  /** Whether wizard is open (modal mode only). */
  open?: boolean;
  /** Render inside a full-screen modal overlay instead of a PageContainer. */
  isModal?: boolean;
  /** Legacy callback kept for backwards compat; called alongside onImportComplete. */
  onImport?: (result: ImportResult) => void;
}

export const ScheduleImportWizard: React.FC<ScheduleImportWizardProps> = ({
  existingActivities = [],
  projectName = 'SiteSync Project',
  projectId,
  onImportComplete,
  onImport,
  onClose,
  open = true,
  isModal = false,
}) => {
  // Wizard state
  const [step, setStep] = useState<WizardStep>('upload');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>(DEFAULT_FIELD_MAP);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importComplete, setImportComplete] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportBtnRef = useRef<HTMLDivElement>(null);

  // ── File handling ───────────────────────────────────────

  const [pdfParsing, setPdfParsing] = useState(false);

  const processFile = useCallback((file: File) => {
    setFileError(null);

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (ext === '.mpp') {
      setFileError(
        'Binary .mpp files cannot be parsed in the browser. Please export your schedule from MS Project as XML (.xml) format, then import the XML file here.'
      );
      return;
    }

    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setFileError(`Unsupported file type: ${ext}. Please use .xer, .xml, .csv, or .pdf files.`);
      return;
    }

    // ── PDF files: use the AI-powered PDF parser ────────────
    if (ext === '.pdf') {
      setPdfParsing(true);
      parsePdfSchedule(file, projectId)
        .then((result) => {
          setImportResult(result);
          setStep('preview');
          setPdfParsing(false);
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : 'Unknown parsing error';
          setFileError(`Failed to parse PDF: ${msg}`);
          setPdfParsing(false);
        });
      return;
    }

    // ── Text-based files: XER, XML, CSV ─────────────────────
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        setFileError('File appears to be empty.');
        return;
      }

      try {
        const format = detectFormat(content);
        let result: ImportResult;

        switch (format) {
          case 'xer':
            result = parseXER(content);
            break;
          case 'msp_xml':
            result = parseMSProjectXML(content);
            break;
          case 'csv':
            result = parseCSV(content);
            break;
          default:
            result = parseCSV(content);
        }

        setImportResult(result);
        setStep('preview');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown parsing error';
        setFileError(`Failed to parse file: ${msg}`);
      }
    };
    reader.onerror = () => {
      setFileError('Failed to read file.');
    };
    reader.readAsText(file);
  }, [projectId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  // ── Real batched persistence ───────────────────────────
  // Inserts each activity as a row in schedule_phases. Batches keep the
  // request size reasonable and let us report incremental progress.

  const handleImport = useCallback(async () => {
    if (!importResult) return;
    if (!projectId) {
      toast.error('No project selected. Choose a project before importing.');
      return;
    }

    setImporting(true);
    setImportProgress(0);

    const activities = importResult.activities;
    const BATCH_SIZE = 50;
    let inserted = 0;

    try {
      for (let i = 0; i < activities.length; i += BATCH_SIZE) {
        const slice = activities.slice(i, i + BATCH_SIZE);
        const rows = slice.map((a) => activityToPhaseRow(projectId, a));

        const { error } = await (fromTable('schedule_phases') as unknown as {
          insert: (rows: Array<Record<string, unknown>>) => Promise<{ error: { message: string } | null }>;
        }).insert(rows as never);
        if (error) {
          toast.error(`Import failed at row ${inserted + 1}: ${error.message}`);
          setImporting(false);
          return;
        }

        inserted += slice.length;
        setImportProgress(Math.round((inserted / activities.length) * 100));
      }

      setImportProgress(100);
      setImporting(false);
      setImportComplete(true);
      toast.success(`Imported ${inserted} activit${inserted === 1 ? 'y' : 'ies'} into the schedule.`);
      onImportComplete?.(importResult);
      onImport?.(importResult);
    } catch (err) {
      setImporting(false);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Import failed: ${msg}`);
    }
  }, [importResult, projectId, onImportComplete, onImport]);

  // ── Export handlers ───────────────────────────────────

  const handleExportXER = useCallback(() => {
    const content = exportToXER(existingActivities, projectName);
    downloadFile(content, `${projectName.replace(/\s+/g, '_')}.xer`, 'text/plain');
    setExportDropdownOpen(false);
  }, [existingActivities, projectName]);

  const handleExportXML = useCallback(() => {
    const content = exportToMSProjectXML(existingActivities, projectName);
    downloadFile(content, `${projectName.replace(/\s+/g, '_')}.xml`, 'application/xml');
    setExportDropdownOpen(false);
  }, [existingActivities, projectName]);

  const handleExportCSV = useCallback(() => {
    const content = exportToCSV(existingActivities);
    downloadFile(content, `${projectName.replace(/\s+/g, '_')}.csv`, 'text/csv');
    setExportDropdownOpen(false);
  }, [existingActivities, projectName]);

  // ── Field mapping ─────────────────────────────────────

  const updateMapping = useCallback((index: number, targetField: string) => {
    setFieldMappings((prev) => prev.map((m, i) =>
      i === index ? { ...m, targetField, auto: false } : m
    ));
  }, []);

  // ── Stats computation ─────────────────────────────────

  const stats = useMemo(() => {
    if (!importResult) return null;
    const acts = importResult.activities;
    const predCount = acts.reduce((sum, a) => sum + a.predecessors.length, 0);
    const milestones = acts.filter((a) => a.isMilestone).length;
    const criticalCount = acts.filter((a) => a.isCritical).length;
    return {
      activities: acts.length,
      dependencies: predCount,
      calendars: importResult.calendars.length,
      milestones,
      critical: criticalCount,
    };
  }, [importResult]);

  // ── Filtered activities for preview ───────────────────

  const filteredActivities = useMemo(() => {
    if (!importResult) return [];
    if (!searchQuery) return importResult.activities.slice(0, 100);
    const q = searchQuery.toLowerCase();
    return importResult.activities
      .filter((a) =>
        a.name.toLowerCase().includes(q) ||
        (a.wbs && a.wbs.toLowerCase().includes(q)) ||
        a.id.toLowerCase().includes(q)
      )
      .slice(0, 100);
  }, [importResult, searchQuery]);

  // ── Format label ──────────────────────────────────────

  const formatLabel = importResult?.format === 'xer'
    ? 'Primavera P6 (.xer)'
    : importResult?.format === 'msp_xml'
      ? 'MS Project XML (.xml)'
      : 'CSV (.csv)';

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  // ── Render ────────────────────────────────────────────

  const headerActions = (
    <div style={{ display: 'flex', gap: spacing['3'], alignItems: 'center' }}>
      {/* Export dropdown — hidden in modal mode (schedule page has its own export button) */}
      {!isModal && (
        <div ref={exportBtnRef} style={{ position: 'relative' }}>
          <Btn
            variant="secondary"
            size="sm"
            icon={<Download size={16} />}
            onClick={() => setExportDropdownOpen((v) => !v)}
          >
            Export
            <ChevronDown size={14} style={{ marginLeft: 4 }} />
          </Btn>

          {exportDropdownOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: zIndex.dropdown as number }}
                onClick={() => setExportDropdownOpen(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: spacing['1'],
                  backgroundColor: colors.surfaceRaised,
                  borderRadius: borderRadius.lg,
                  boxShadow: shadows.dropdown,
                  minWidth: 220,
                  zIndex: (zIndex.dropdown as number) + 1,
                  overflow: 'hidden',
                }}
              >
                <ExportOption
                  label="Export as P6 (.xer)"
                  subtitle="Primavera P6 format"
                  onClick={handleExportXER}
                />
                <ExportOption
                  label="Export as MS Project (.xml)"
                  subtitle="Microsoft Project XML"
                  onClick={handleExportXML}
                />
                <ExportOption
                  label="Export as CSV"
                  subtitle="Comma-separated values"
                  onClick={handleExportCSV}
                />
              </div>
            </>
          )}
        </div>
      )}

      {onClose && (
        <Btn variant="ghost" size="sm" icon={<X size={16} />} onClick={onClose}>
          Close
        </Btn>
      )}
    </div>
  );

  const wizardBody = (
    <>
      {/* Step indicator */}
      <Card padding={spacing['4']}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          {STEPS.map((s, idx) => {
            const isActive = s.key === step;
            const isComplete = idx < currentStepIndex;
            return (
              <React.Fragment key={s.key}>
                {idx > 0 && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      backgroundColor: isComplete ? colors.primaryOrange : colors.borderSubtle,
                      transition: `background-color ${transitions.smooth}`,
                    }}
                  />
                )}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing['2'],
                    cursor: isComplete ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (isComplete) setStep(s.key);
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: borderRadius.full,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: typography.fontSize.label,
                      fontWeight: typography.fontWeight.semibold,
                      backgroundColor: isActive
                        ? colors.primaryOrange
                        : isComplete
                          ? colors.statusActive
                          : colors.surfaceInset,
                      color: isActive || isComplete ? colors.white : colors.textTertiary,
                      transition: `all ${transitions.smooth}`,
                    }}
                  >
                    {isComplete ? <CheckCircle size={14} /> : s.number}
                  </div>
                  <span
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.medium,
                      color: isActive ? colors.textPrimary : colors.textTertiary,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </Card>

      <div style={{ marginTop: spacing['5'] }}>
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <Card>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? colors.primaryOrange : colors.borderDefault}`,
                borderRadius: borderRadius.lg,
                padding: spacing['16'],
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backgroundColor: dragOver ? colors.orangeSubtle : colors.surfaceInset,
                transition: `all ${transitions.smooth}`,
                minHeight: 280,
              }}
            >
              <Upload
                size={40}
                color={dragOver ? colors.primaryOrange : colors.textTertiary}
                style={{ marginBottom: spacing['4'] }}
              />
              <p
                style={{
                  fontSize: typography.fontSize.title,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary,
                  margin: 0,
                  marginBottom: spacing['2'],
                }}
              >
                Drop your schedule file here
              </p>
              <p
                style={{
                  fontSize: typography.fontSize.body,
                  color: colors.textSecondary,
                  margin: 0,
                  marginBottom: spacing['4'],
                }}
              >
                or click to browse files
              </p>
              <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap', justifyContent: 'center' }}>
                <FormatBadge label=".xer" description="Primavera P6" />
                <FormatBadge label=".xml" description="MS Project" />
                <FormatBadge label=".csv" description="CSV" />
                <FormatBadge label=".pdf" description="Gantt PDF (AI)" />
                <FormatBadge label=".mpp" description="MS Project (limited)" warning />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xer,.xml,.csv,.mpp,.pdf"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>

            {/* PDF parsing in progress */}
            {pdfParsing && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing['3'],
                  padding: spacing['4'],
                  marginTop: spacing['4'],
                  backgroundColor: colors.statusInfoSubtle,
                  borderRadius: borderRadius.md,
                  border: `1px solid ${colors.statusInfo}`,
                }}
              >
                <Loader size={18} color={colors.statusInfo} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusInfo, margin: 0 }}>
                    Analyzing PDF schedule...
                  </p>
                  <p style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, margin: `${spacing['1']} 0 0` }}>
                    AI is analyzing the schedule — this can take up to a minute for dense PDFs. Each page is processed in parallel.
                  </p>
                </div>
              </div>
            )}

            {fileError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: spacing['3'],
                  padding: spacing['4'],
                  marginTop: spacing['4'],
                  backgroundColor: colors.statusCriticalSubtle,
                  borderRadius: borderRadius.md,
                  border: `1px solid ${colors.statusCritical}`,
                }}
              >
                <AlertTriangle size={18} color={colors.statusCritical} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, margin: 0 }}>
                    Import Error
                  </p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, marginTop: spacing['1'] }}>
                    {fileError}
                  </p>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && importResult && stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
            {/* Stats bar */}
            <Card padding={spacing['4']}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['6'], flexWrap: 'wrap' }}>
                <StatChip icon={<FileText size={14} />} label="Format" value={formatLabel} />
                <StatChip icon={<Calendar size={14} />} label="Activities" value={String(stats.activities)} accent />
                <StatChip icon={<Link2 size={14} />} label="Dependencies" value={String(stats.dependencies)} />
                <StatChip icon={<Clock size={14} />} label="Calendars" value={String(stats.calendars)} />
                <StatChip icon={<CheckCircle size={14} />} label="Milestones" value={String(stats.milestones)} />
                {stats.critical > 0 && (
                  <StatChip icon={<AlertTriangle size={14} />} label="Critical" value={String(stats.critical)} critical />
                )}
              </div>
            </Card>

            {/* Warnings */}
            {importResult.warnings.length > 0 && (
              <Card padding={spacing['4']}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                  {importResult.warnings.map((w, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                      <AlertTriangle size={14} color={colors.statusPending} />
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{w}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Search */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['3']}`,
                backgroundColor: colors.surfaceInset,
                borderRadius: borderRadius.md,
                border: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <Search size={16} color={colors.textTertiary} />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  border: 'none',
                  backgroundColor: 'transparent',
                  outline: 'none',
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  color: colors.textPrimary,
                }}
              />
            </div>

            {/* Activities table */}
            <Card padding="0">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: typography.fontFamily }}>
                  <thead>
                    <tr style={{ backgroundColor: colors.surfaceInset }}>
                      {['Name', 'WBS', 'Start', 'End', 'Duration', 'Progress', 'Predecessors'].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: `${spacing['3']} ${spacing['4']}`,
                            fontSize: typography.fontSize.label,
                            fontWeight: typography.fontWeight.medium,
                            color: colors.textTertiary,
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                            letterSpacing: typography.letterSpacing.wide,
                            borderBottom: `1px solid ${colors.borderDefault}`,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActivities.map((act) => (
                      <tr
                        key={act.id}
                        style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.backgroundColor = colors.surfaceHover;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent';
                        }}
                      >
                        <td style={{ ...cellStyle, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                            {act.isMilestone && (
                              <span style={{ color: colors.primaryOrange, display: 'flex' }} title="Milestone">
                                <CheckCircle size={12} />
                              </span>
                            )}
                            {act.isCritical && (
                              <span style={{ color: colors.statusCritical, display: 'flex' }} title="Critical Path">
                                <AlertTriangle size={12} />
                              </span>
                            )}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                              {act.name}
                            </span>
                          </div>
                        </td>
                        <td style={{ ...cellStyle, color: colors.textTertiary, fontFamily: typography.fontFamilyMono, fontSize: typography.fontSize.label }}>
                          {act.wbs || '-'}
                        </td>
                        <td style={cellStyle}>{act.startDate || '-'}</td>
                        <td style={cellStyle}>{act.endDate || '-'}</td>
                        <td style={cellStyle}>{act.duration}d</td>
                        <td style={cellStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                            <div
                              style={{
                                width: 40,
                                height: 4,
                                borderRadius: borderRadius.full,
                                backgroundColor: colors.surfaceInset,
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(act.percentComplete, 100)}%`,
                                  height: '100%',
                                  backgroundColor: act.percentComplete >= 100 ? colors.statusActive : colors.primaryOrange,
                                  borderRadius: borderRadius.full,
                                }}
                              />
                            </div>
                            <span style={{ fontSize: typography.fontSize.label, color: colors.textSecondary }}>
                              {act.percentComplete}%
                            </span>
                          </div>
                        </td>
                        <td style={{ ...cellStyle, fontFamily: typography.fontFamilyMono, fontSize: typography.fontSize.label, color: colors.textTertiary }}>
                          {act.predecessors.length > 0
                            ? act.predecessors.map((p) => `${p.activityId}${p.type !== 'FS' ? p.type : ''}${p.lag ? (p.lag > 0 ? `+${p.lag}d` : `${p.lag}d`) : ''}`).join(', ')
                            : '-'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importResult.activities.length > 100 && (
                <div style={{ padding: spacing['3'], textAlign: 'center', borderTop: `1px solid ${colors.borderSubtle}` }}>
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                    Showing {filteredActivities.length} of {importResult.activities.length} activities
                  </span>
                </div>
              )}
            </Card>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Btn variant="ghost" icon={<ChevronLeft size={16} />} onClick={() => { setStep('upload'); setImportResult(null); }}>
                Back
              </Btn>
              <Btn variant="primary" icon={<ChevronRight size={16} />} iconPosition="right" onClick={() => setStep('map')}>
                Next: Map Fields
              </Btn>
            </div>
          </div>
        )}

        {/* Step 3: Map Fields */}
        {step === 'map' && importResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
            <Card>
              <div style={{ marginBottom: spacing['4'] }}>
                <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
                  Field Mapping
                </p>
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, marginTop: spacing['1'] }}>
                  Map imported fields to SiteSync fields. Auto-mapped fields are marked with a checkmark.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                {/* Header row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 40px 1fr 30px',
                    gap: spacing['3'],
                    padding: `${spacing['2']} ${spacing['3']}`,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, color: colors.textTertiary, letterSpacing: typography.letterSpacing.wider, textTransform: 'uppercase' as const }}>
                    Source Field
                  </span>
                  <span />
                  <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, color: colors.textTertiary, letterSpacing: typography.letterSpacing.wider, textTransform: 'uppercase' as const }}>
                    SiteSync Field
                  </span>
                  <span />
                </div>

                {fieldMappings.map((mapping, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 40px 1fr 30px',
                      gap: spacing['3'],
                      padding: `${spacing['3']} ${spacing['3']}`,
                      backgroundColor: colors.surfaceInset,
                      borderRadius: borderRadius.md,
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        padding: `${spacing['2']} ${spacing['3']}`,
                        backgroundColor: colors.surfaceRaised,
                        borderRadius: borderRadius.sm,
                        fontSize: typography.fontSize.sm,
                        fontWeight: typography.fontWeight.medium,
                        color: colors.textPrimary,
                      }}
                    >
                      {mapping.sourceField}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <ArrowRightLeft size={16} color={colors.textTertiary} />
                    </div>

                    <select
                      value={mapping.targetField}
                      onChange={(e) => updateMapping(idx, e.target.value)}
                      style={{
                        padding: `${spacing['2']} ${spacing['3']}`,
                        backgroundColor: colors.surfaceRaised,
                        border: `1px solid ${colors.borderSubtle}`,
                        borderRadius: borderRadius.sm,
                        fontSize: typography.fontSize.sm,
                        fontFamily: typography.fontFamily,
                        color: colors.textPrimary,
                        cursor: 'pointer',
                        outline: 'none',
                        appearance: 'auto' as const,
                      }}
                    >
                      {SITESYNC_FIELDS.map((field) => (
                        <option key={field} value={field}>{field}</option>
                      ))}
                    </select>

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      {mapping.auto && (
                        <CheckCircle size={14} color={colors.statusActive} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Btn variant="ghost" icon={<ChevronLeft size={16} />} onClick={() => setStep('preview')}>
                Back
              </Btn>
              <Btn variant="primary" icon={<ChevronRight size={16} />} iconPosition="right" onClick={() => setStep('review')}>
                Next: Review
              </Btn>
            </div>
          </div>
        )}

        {/* Step 4: Review & Import */}
        {step === 'review' && importResult && stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
            <Card>
              <div style={{ marginBottom: spacing['5'] }}>
                <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
                  Import Summary
                </p>
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, marginTop: spacing['1'] }}>
                  Review the import details below before proceeding.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'] }}>
                <SummaryCard
                  icon={<FileText size={20} color={colors.primaryOrange} />}
                  label="Project"
                  value={importResult.projectName}
                />
                <SummaryCard
                  icon={<Calendar size={20} color={colors.statusInfo} />}
                  label="Data Date"
                  value={importResult.dataDate}
                />
                <SummaryCard
                  icon={<Users size={20} color={colors.statusActive} />}
                  label="Activities"
                  value={String(stats.activities)}
                />
                <SummaryCard
                  icon={<Link2 size={20} color={colors.statusPending} />}
                  label="Dependencies"
                  value={String(stats.dependencies)}
                />
              </div>

              {/* Mapped fields summary */}
              <div style={{ marginTop: spacing['5'] }}>
                <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>
                  Field Mappings
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'] }}>
                  {fieldMappings
                    .filter((m) => m.targetField !== '-- Skip --')
                    .map((m, i) => (
                      <span
                        key={i}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: spacing['1'],
                          padding: `${spacing['1']} ${spacing['2']}`,
                          backgroundColor: colors.surfaceInset,
                          borderRadius: borderRadius.sm,
                          fontSize: typography.fontSize.label,
                          color: colors.textSecondary,
                        }}
                      >
                        {m.sourceField}
                        <ChevronRight size={10} />
                        {m.targetField}
                      </span>
                    ))
                  }
                </div>
              </div>

              {/* Import progress / button */}
              <div style={{ marginTop: spacing['6'] }}>
                {!importing && !importComplete && (
                  <Btn
                    variant="primary"
                    fullWidth
                    icon={<Upload size={18} />}
                    onClick={handleImport}
                  >
                    Import {stats.activities} Activities
                  </Btn>
                )}

                {importing && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                        <Loader size={16} color={colors.primaryOrange} style={{ animation: 'spin 1s linear infinite' }} />
                        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                          Importing activities...
                        </span>
                      </div>
                      <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>
                        {importProgress}%
                      </span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: 6,
                        borderRadius: borderRadius.full,
                        backgroundColor: colors.surfaceInset,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${importProgress}%`,
                          height: '100%',
                          backgroundColor: colors.primaryOrange,
                          borderRadius: borderRadius.full,
                          transition: `width ${transitions.smooth}`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {importComplete && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing['3'],
                      padding: spacing['4'],
                      backgroundColor: colors.statusActiveSubtle,
                      borderRadius: borderRadius.md,
                      border: `1px solid ${colors.statusActive}`,
                    }}
                  >
                    <CheckCircle size={20} color={colors.statusActive} />
                    <div>
                      <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusActive, margin: 0 }}>
                        Import Complete
                      </p>
                      <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, marginTop: spacing['1'] }}>
                        Successfully imported {stats.activities} activities with {stats.dependencies} dependencies.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Btn
                variant="ghost"
                icon={<ChevronLeft size={16} />}
                onClick={() => { setStep('map'); setImportComplete(false); setImporting(false); }}
                disabled={importing}
              >
                Back
              </Btn>
              {importComplete && onClose && (
                <Btn variant="primary" onClick={onClose}>
                  Done
                </Btn>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );

  if (isModal) {
    if (!open) return null;
    return (
      <div
        role="presentation"
        onClick={(e) => { if (e.target === e.currentTarget && !importing) onClose?.(); }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: zIndex.modal as number,
          backgroundColor: colors.overlayBackdrop,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing['6'],
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Import schedule"
          style={{
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.xl,
            boxShadow: shadows.panel,
            width: 'min(1100px, 95vw)',
            height: 'min(90vh, 900px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${spacing['4']} ${spacing['6']}`,
              borderBottom: `1px solid ${colors.borderSubtle}`,
              flexShrink: 0,
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                Import Schedule
              </p>
              <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                Primavera P6, MS Project, CSV, or Gantt PDF (AI-extracted).
              </p>
            </div>
            {headerActions}
          </div>
          <div style={{ padding: spacing['6'], overflowY: 'auto', flex: 1 }}>
            {wizardBody}
          </div>
        </div>
      </div>
    );
  }

  return (
    <PageContainer
      title="Schedule Import / Export"
      subtitle="Import from Primavera P6, MS Project, CSV, or Gantt PDF. Export your schedule in any format."
      actions={headerActions}
    >
      {wizardBody}
    </PageContainer>
  );
};

// ── Shared cell style ───────────────────────────────────────

const cellStyle: React.CSSProperties = {
  padding: `${spacing['3']} ${spacing['4']}`,
  fontSize: typography.fontSize.sm,
  color: colors.textSecondary,
  whiteSpace: 'nowrap',
};

// ── Sub-components ──────────────────────────────────────────

const FormatBadge: React.FC<{ label: string; description: string; warning?: boolean }> = ({ label, description, warning }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: spacing['1.5'],
      padding: `${spacing['1']} ${spacing['3']}`,
      backgroundColor: warning ? colors.statusPendingSubtle : colors.surfaceRaised,
      borderRadius: borderRadius.full,
      border: `1px solid ${warning ? colors.statusPending : colors.borderSubtle}`,
    }}
  >
    <FileText size={12} color={warning ? colors.statusPending : colors.textTertiary} />
    <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: warning ? colors.statusPending : colors.textPrimary }}>
      {label}
    </span>
    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
      {description}
    </span>
  </div>
);

const StatChip: React.FC<{ icon: React.ReactNode; label: string; value: string; accent?: boolean; critical?: boolean }> = ({
  icon,
  label,
  value,
  accent,
  critical,
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
    <span style={{ color: critical ? colors.statusCritical : accent ? colors.primaryOrange : colors.textTertiary, display: 'flex' }}>
      {icon}
    </span>
    <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>{label}:</span>
    <span
      style={{
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: critical ? colors.statusCritical : accent ? colors.primaryOrange : colors.textPrimary,
      }}
    >
      {value}
    </span>
  </div>
);

const SummaryCard: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div
    style={{
      padding: spacing['4'],
      backgroundColor: colors.surfaceInset,
      borderRadius: borderRadius.md,
      display: 'flex',
      flexDirection: 'column',
      gap: spacing['2'],
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
      {icon}
      <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary, fontWeight: typography.fontWeight.medium, textTransform: 'uppercase' as const, letterSpacing: typography.letterSpacing.wider }}>
        {label}
      </span>
    </div>
    <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {value}
    </span>
  </div>
);

const ExportOption: React.FC<{ label: string; subtitle: string; onClick: () => void }> = ({ label, subtitle, onClick }) => (
  <button
    onClick={onClick}
    style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: spacing['0.5'],
      padding: `${spacing['3']} ${spacing['4']}`,
      backgroundColor: 'transparent',
      border: 'none',
      cursor: 'pointer',
      textAlign: 'left',
      fontFamily: typography.fontFamily,
      transition: `background-color ${transitions.quick}`,
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceHover; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
  >
    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
      {label}
    </span>
    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
      {subtitle}
    </span>
  </button>
);

export default ScheduleImportWizard;

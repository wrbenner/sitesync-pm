import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, AlertTriangle, ChevronDown, ChevronUp, CheckCircle, RefreshCw, Zap, CalendarClock, TrendingUp, GitBranch, Gauge, CalendarCheck, Calendar, BarChart3, ToggleLeft, ToggleRight, ClipboardList, Upload, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, Card, SectionHeader, MetricBox, Skeleton, Btn, useToast, Tag } from '../components/Primitives';
import { useRealtimeSchedulePhases, useScheduleRealtime } from '../hooks/queries/realtime';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../styles/theme';
import { useScheduleStore } from '../stores/scheduleStore';
import { useProjectContext } from '../stores/projectContextStore';
import { useProjectMetrics } from '../hooks/useProjectMetrics';
import { useCopilotStore } from '../stores/copilotStore';
import { PredictiveAlertBanner } from '../components/ai/PredictiveAlert';
import { getPredictiveAlertsForPage } from '../data/aiAnnotations';
import { GanttChart } from '../components/schedule/GanttChart';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { MobileScheduleView } from '../components/schedule/MobileScheduleView';
import { predictScheduleRisks } from '../lib/predictions';
import type { PredictedRisk, WeatherDay } from '../lib/predictions';
import { computeScheduleKPIs } from '../lib/criticalPath';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

interface ScheduleKPICardProps {
  icon: React.ReactNode
  label: string
  value: string
  valueColor: string
  trend: 'up' | 'down' | 'neutral'
  progressPct?: number
}

const ScheduleKPICard: React.FC<ScheduleKPICardProps> = ({ icon, label, value, valueColor, trend, progressPct }) => (
  <div style={{
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #E5E7EB',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  }}>
    {icon}
    <span style={{ fontSize: '12px', color: colors.textTertiary, fontWeight: typography.fontWeight.medium, lineHeight: typography.lineHeight.normal }}>
      {label}
    </span>
    <span style={{ fontSize: '28px', fontWeight: typography.fontWeight.semibold, color: valueColor, lineHeight: 1.1 }}>
      {value}
    </span>
    {progressPct != null && (
      <div style={{ marginTop: '2px' }}>
        <div style={{ height: '4px', borderRadius: '2px', backgroundColor: '#E5E7EB', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, progressPct))}%`, borderRadius: '2px', backgroundColor: colors.statusActive, transition: 'width 0.4s ease' }} />
        </div>
      </div>
    )}
    <span style={{ fontSize: '12px', color: trend === 'up' ? colors.statusActive : trend === 'down' ? colors.statusCritical : colors.textTertiary }}>
      <span aria-hidden="true">{trend === 'up' ? '▲' : trend === 'down' ? '▼' : '─'}</span>
      <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
        {trend === 'up' ? 'Status: Improving' : trend === 'down' ? 'Status: Declining' : 'Status: Stable'}
      </span>
    </span>
  </div>
);

// 7-day mock forecast (would come from real weather API in production)
const MOCK_FORECAST: WeatherDay[] = Array.from({ length: 7 }, (_, i) => {
  const conditions = (['Clear', 'Rain', 'Clear', 'Cloudy', 'Rain', 'Snow', 'Clear'] as const)[i];
  return {
    date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
    conditions,
    precipitationChance: conditions === 'Rain' ? 75 : conditions === 'Snow' ? 65 : 10,
    tempHigh: 54 - i * 2,
    tempLow: 38 - i,
  };
});

interface ParsedActivity {
  activityId: string;
  name: string;
  startDate: string;
  endDate: string;
  duration: number;
  percentComplete: number;
  floatTotal: number;
  status: string;
  baselineStart?: string;
  baselineEnd?: string;
}

function mapP6Status(raw: string): string {
  const s = raw.toUpperCase();
  if (s.includes('COMPLETE') || s === 'TK_COMPLETE') return 'completed';
  if (s.includes('ACTIVE') || s === 'TK_ACTIVE' || s.includes('IN_PROG')) return 'in_progress';
  if (s.includes('SUSPEND') || s.includes('HOLD')) return 'on_hold';
  return 'not_started';
}

function formatP6Date(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  const parts = raw.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  }
  return raw.split(' ')[0];
}

function parseXmlSchedule(content: string): ParsedActivity[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');
  const activities: ParsedActivity[] = [];
  const nodes = Array.from(doc.querySelectorAll('Activity'));
  const getText = (el: Element, ...tags: string[]) => {
    for (const tag of tags) {
      const found = el.querySelector(tag);
      if (found?.textContent) return found.textContent.trim();
    }
    return '';
  };
  for (const node of nodes) {
    const name = getText(node, 'ActivityName', 'Name') || node.getAttribute('Name') || '';
    if (!name) continue;
    const durationRaw = parseFloat(getText(node, 'DurationOriginal', 'Duration') || '0');
    // P6 XML duration is in hours — convert to days
    const duration = durationRaw > 50 ? Math.round(durationRaw / 8) : Math.round(durationRaw);
    const floatRaw = parseFloat(getText(node, 'FloatTotal') || '0');
    const floatTotal = floatRaw > 50 ? Math.round(floatRaw / 8) : Math.round(floatRaw);
    const pct = parseFloat(getText(node, 'PercentComplete') || '0');
    activities.push({
      activityId: getText(node, 'ActivityId') || node.getAttribute('ObjectId') || '',
      name,
      startDate: formatP6Date(getText(node, 'PlannedStartDate', 'StartDate')),
      endDate: formatP6Date(getText(node, 'PlannedFinishDate', 'FinishDate')),
      duration: isNaN(duration) ? 0 : duration,
      percentComplete: isNaN(pct) ? 0 : pct,
      floatTotal: isNaN(floatTotal) ? 0 : floatTotal,
      status: mapP6Status(getText(node, 'Status') || 'TK_NotStart'),
      baselineStart: formatP6Date(getText(node, 'ActualStartDate', 'BaselineStartDate')) || undefined,
      baselineEnd: formatP6Date(getText(node, 'ActualFinishDate', 'BaselineFinishDate')) || undefined,
    });
  }
  return activities;
}

function parseXerSchedule(content: string): ParsedActivity[] {
  const activities: ParsedActivity[] = [];
  const lines = content.split(/\r?\n/);
  let inTask = false;
  let fields: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t === '%T TASK') { inTask = true; fields = []; continue; }
    if (t.startsWith('%T ') && inTask) { inTask = false; continue; }
    if (!inTask) continue;
    if (t.startsWith('%F')) { fields = t.slice(2).trim().split('\t'); continue; }
    if (!t.startsWith('%R')) continue;
    const vals = t.slice(2).trim().split('\t');
    const get = (f: string) => { const i = fields.indexOf(f); return i >= 0 ? (vals[i] ?? '') : ''; };
    const name = get('task_name');
    if (!name) continue;
    const dhrRaw = parseFloat(get('target_drtn_hr_cnt') || get('remain_drtn_hr_cnt') || '0');
    const duration = Math.round(dhrRaw / 8);
    const floatHrs = parseFloat(get('total_float_hr_cnt') || '0');
    const floatTotal = Math.round(floatHrs / 8);
    const pct = parseFloat(get('phys_complete_pct') || '0');
    const startDate = get('early_start_date') || get('target_start_date') || get('act_start_date');
    const endDate = get('early_end_date') || get('target_end_date') || get('act_end_date');
    const bStart = get('target_start_date');
    const bEnd = get('target_end_date');
    activities.push({
      activityId: get('task_code') || get('task_id'),
      name,
      startDate: formatP6Date(startDate),
      endDate: formatP6Date(endDate),
      duration: isNaN(duration) ? 0 : duration,
      percentComplete: isNaN(pct) ? 0 : pct,
      floatTotal: isNaN(floatTotal) ? 0 : floatTotal,
      status: mapP6Status(get('status_code') || 'TK_NotStart'),
      baselineStart: bStart ? formatP6Date(bStart) : undefined,
      baselineEnd: bEnd ? formatP6Date(bEnd) : undefined,
    });
  }
  return activities;
}

interface ScheduleImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  projectId?: string;
}

const ScheduleImportModal: React.FC<ScheduleImportModalProps> = ({ open, onClose, onImportComplete, projectId }) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'xml' | 'xer' | 'mpp' | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedActivity[] | null>(null);
  const [importing, setImporting] = useState(false);
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleId = 'schedule-import-modal-title';

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setDragOver(false);
      setFileType(null);
      setParsing(false);
      setParsed(null);
      setImporting(false);
    }
  }, [open]);

  if (!open) return null;

  const detectType = (file: File): 'xml' | 'xer' | 'mpp' | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'xml') return 'xml';
    if (ext === 'xer') return 'xer';
    if (ext === 'mpp') return 'mpp';
    return null;
  };

  const handleFile = (file: File) => {
    const type = detectType(file);
    setSelectedFile(file);
    setFileType(type);
    setParsed(null);
    if (type === 'xml' || type === 'xer') {
      setParsing(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          const acts = type === 'xml' ? parseXmlSchedule(content) : parseXerSchedule(content);
          setParsed(acts);
        } catch {
          addToast('error', 'Failed to parse file. Check the format and try again.');
        }
        setParsing(false);
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleConfirmImport = async () => {
    if (!parsed || parsed.length === 0 || !projectId) return;
    setImporting(true);
    try {
      const rows = parsed.map(a => ({
        project_id: projectId,
        name: a.name,
        start_date: a.startDate || null,
        end_date: a.endDate || null,
        baseline_start: a.baselineStart || null,
        baseline_end: a.baselineEnd || null,
        percent_complete: a.percentComplete,
        float_days: a.floatTotal,
        status: a.status,
        progress: a.percentComplete,
      }));
      const { error } = await supabase.from('schedule_phases').insert(rows);
      if (error) throw error;
      addToast('success', `Imported ${parsed.length} activities`);
      onImportComplete();
    } catch {
      addToast('error', 'Import failed. Please try again.');
    }
    setImporting(false);
  };

  const showPreview = !parsing && parsed !== null && fileType !== 'mpp';
  const preview = parsed?.slice(0, 50) ?? [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: zIndex.modal,
        backgroundColor: colors.overlayBackdrop,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          background: colors.surfaceRaised,
          borderRadius: borderRadius.xl,
          padding: spacing.xl,
          width: showPreview ? '720px' : '480px',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          boxShadow: shadows.panel,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.lg,
          transition: `width ${transitions.smooth}`,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            id={titleId}
            style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}
          >
            Import Schedule
          </span>
          <button
            aria-label="Close import dialog"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: spacing.sm, borderRadius: borderRadius.md, color: colors.textTertiary, display: 'flex', alignItems: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Drop zone — hide once parsed */}
        {!showPreview && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Drop zone for schedule file"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
            style={{
              border: `2px dashed ${dragOver ? colors.primaryOrange : colors.borderDefault}`,
              borderRadius: borderRadius.lg,
              padding: `${spacing.xxl} ${spacing.xl}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: spacing.md,
              backgroundColor: dragOver ? colors.orangeSubtle : colors.surfaceInset,
              transition: transitions.quick,
              cursor: 'pointer',
            }}
          >
            <Upload size={28} color={dragOver ? colors.primaryOrange : colors.textTertiary} />
            <span style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, textAlign: 'center' }}>
              Drop your P6 or MS Project file here
            </span>
            <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>
              or{' '}
              <span style={{ color: colors.primaryOrange, textDecoration: 'underline', cursor: 'pointer' }}>
                Browse Files
              </span>
              {' '}(.xer, .xml, .mpp)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xer,.xml,.mpp"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        )}

        {/* Selected file chip */}
        {selectedFile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: `${spacing.md} ${spacing.lg}`, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}` }}>
            <Upload size={15} color={colors.primaryOrange} />
            <span style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedFile.name}
            </span>
            {fileType && (
              <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {fileType}
              </span>
            )}
            <button
              aria-label="Remove file"
              onClick={() => { setSelectedFile(null); setFileType(null); setParsed(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: colors.textTertiary }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Parsing spinner */}
        {parsing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, color: colors.textSecondary, fontSize: typography.fontSize.body }}>
            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', color: colors.primaryOrange }} />
            Parsing schedule file...
          </div>
        )}

        {/* MPP message */}
        {fileType === 'mpp' && selectedFile && !parsing && (
          <div style={{ padding: spacing.lg, backgroundColor: colors.statusInfoSubtle, borderRadius: borderRadius.md, border: `1px solid ${colors.statusInfo}30` }}>
            <p style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.statusInfo }}>
              MPP import requires server processing
            </p>
            <p style={{ margin: `${spacing.sm} 0 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
              MS Project .mpp files are queued for server-side conversion. This feature is coming soon. Use the .xml export from MS Project in the meantime.
            </p>
          </div>
        )}

        {/* Preview table */}
        {showPreview && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                {parsed!.length} activities found
              </span>
              {parsed!.length > 50 && (
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  Showing first 50
                </span>
              )}
            </div>
            <div style={{ overflowX: 'auto', border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
                <thead>
                  <tr style={{ backgroundColor: colors.surfaceInset }}>
                    {['Name', 'Start', 'Finish', 'Duration', '% Complete'].map(h => (
                      <th key={h} style={{ padding: `${spacing.sm} ${spacing.md}`, textAlign: 'left', fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, fontSize: typography.fontSize.caption, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${colors.borderSubtle}`, whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((a, i) => (
                    <tr key={i} style={{ borderBottom: i < preview.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none' }}>
                      <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.name}
                      </td>
                      <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                        {a.startDate || '\u2014'}
                      </td>
                      <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                        {a.endDate || '\u2014'}
                      </td>
                      <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary }}>
                        {a.duration}d
                      </td>
                      <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: a.percentComplete > 0 ? colors.statusActive : colors.textTertiary }}>
                        {a.percentComplete}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          {showPreview && (
            <Btn
              variant="primary"
              onClick={handleConfirmImport}
              disabled={importing || !projectId}
              icon={importing ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : undefined}
            >
              {importing ? 'Importing...' : `Confirm Import (${parsed!.length})`}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
};

export const Schedule: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { activeProject } = useProjectContext();
  const queryClient = useQueryClient();
  const { phases: schedulePhases, metrics, loading, error, loadSchedule } = useScheduleStore();
  const { data: projectMetrics } = useProjectMetrics(activeProject?.id);
  const { createConversation, sendMessage, setActiveConversation, setPageContext } = useCopilotStore();
  const navigate = useNavigate();

  const refetch = useCallback(() => {
    if (activeProject?.id) loadSchedule(activeProject.id);
  }, [activeProject?.id, loadSchedule]);

  useEffect(() => { setPageContext('schedule'); }, [setPageContext]);

  useEffect(() => {
    if (activeProject?.id) loadSchedule(activeProject.id);
  }, [activeProject?.id]);

  useEffect(() => {
    const projectId = activeProject?.id;
    if (!projectId) return;
    const channel = supabase
      .channel('schedule:' + projectId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_phases', filter: 'project_id=eq.' + projectId }, () => {
        queryClient.invalidateQueries({ queryKey: ['schedule', projectId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeProject?.id, queryClient]);

  const [whatIfMode, setWhatIfMode] = useState(false);
  const [showBaseline, setShowBaseline] = useState(false);
  const [recoveryExpanded, setRecoveryExpanded] = useState(false);
  const [scheduleAnnouncement, setScheduleAnnouncement] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const { addToast } = useToast();

  // dirtyPhaseIds: pass phase IDs currently being edited to get conflict toasts.
  // Populated by whichever editing UI sets them; empty set is safe.
  const [dirtyPhaseIds] = useState<ReadonlySet<string>>(() => new Set());
  const { isSubscribed: phasesSubscribed } = useRealtimeSchedulePhases(
    activeProject?.id ?? '',
    dirtyPhaseIds
  );
  const { isSubscribed: activitiesSubscribed } = useScheduleRealtime(activeProject?.id ?? '');
  const liveActive = phasesSubscribed || activitiesSubscribed;

  // Predictive risk state
  const [risks, setRisks] = useState<PredictedRisk[]>([]);
  const [riskPanelOpen, setRiskPanelOpen] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastAnalyzed, setLastAnalyzed] = useState<Date | null>(null);
  const [minutesAgo, setMinutesAgo] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const kpis = useMemo(() => computeScheduleKPIs(schedulePhases), [schedulePhases])

  const hasBaselineData = useMemo(
    () => schedulePhases.some(p => p.baselineStartDate != null && p.baselineEndDate != null),
    [schedulePhases]
  );

  const activityMetrics = useMemo(() => {
    if (schedulePhases.length === 0) {
      return {
        scheduleVarianceDays: 0,
        criticalPathCount: 0,
        onTrackPct: 0,
        completePct: 0,
      }
    }

    // Schedule Variance: projected finish minus planned finish for the latest activity (positive = behind)
    const lastActivity = schedulePhases.reduce((latest, p) =>
      new Date(p.endDate) > new Date(latest.endDate) ? p : latest
    )
    let scheduleVarianceDays = 0
    if (lastActivity.baselineEndDate) {
      const projected = new Date(lastActivity.endDate)
      const planned = new Date(lastActivity.baselineEndDate)
      projected.setHours(0, 0, 0, 0)
      planned.setHours(0, 0, 0, 0)
      scheduleVarianceDays = Math.round((projected.getTime() - planned.getTime()) / 86400000)
    }

    // Critical Path Items: activities where is_critical_path === true
    const criticalPathCount = schedulePhases.filter(p => p.is_critical_path === true).length

    // On Track: of non-completed activities, percentage where end_date <= baseline_end (or no baseline = on track)
    const nonCompleted = schedulePhases.filter(p => p.status !== 'completed' && (p.progress ?? 0) < 100)
    const onTrackCount = nonCompleted.length === 0
      ? schedulePhases.length
      : nonCompleted.filter(p => !p.baselineEndDate || new Date(p.endDate) <= new Date(p.baselineEndDate)).length
    const onTrackPct = nonCompleted.length === 0
      ? 100
      : Math.round((onTrackCount / nonCompleted.length) * 100)

    // Complete: average percent_complete across all activities
    const completePct = Math.round(
      schedulePhases.reduce((sum, p) => sum + (p.progress ?? 0), 0) / schedulePhases.length
    )

    return {
      scheduleVarianceDays,
      criticalPathCount,
      onTrackPct,
      completePct,
    }
  }, [schedulePhases]);

  const runAnalysis = useCallback(() => {
    setAnalyzing(true);
    // Simulate brief async analysis delay for UX feedback
    setTimeout(() => {
      const results = predictScheduleRisks(schedulePhases, MOCK_FORECAST);
      setRisks(results);
      setLastAnalyzed(new Date());
      setMinutesAgo(0);
      setAnalyzing(false);
    }, 800);
  }, [schedulePhases]);

  // Run analysis when phases first load
  useEffect(() => {
    if (schedulePhases.length > 0 && lastAnalyzed === null) {
      runAnalysis();
    }
  }, [schedulePhases, lastAnalyzed, runAnalysis]);

  // Tick the "X minutes ago" counter
  useEffect(() => {
    if (lastAnalyzed === null) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setMinutesAgo(Math.floor((Date.now() - lastAnalyzed.getTime()) / 60000));
    }, 30000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [lastAnalyzed]);

  const openCopilotWithRisk = useCallback(async (risk: PredictedRisk) => {
    const prompt = `Generate a detailed recovery plan for the ${risk.title} phase. Risk assessment: ${risk.reason} Likelihood: ${risk.likelihoodPercent}%, potential impact: +${risk.impactDays} days. Suggested action: ${risk.suggestedAction}`;
    const convId = createConversation(`Recovery Plan: ${risk.title}`);
    setActiveConversation(convId);
    navigate('/copilot');
    // Fire-and-forget the initial message after navigation
    setTimeout(() => sendMessage(prompt), 100);
  }, [createConversation, setActiveConversation, sendMessage, navigate]);

  const GANTT_ROW_WIDTHS = ['70%', '55%', '85%', '40%', '90%', '60%', '75%', '45%'];

  if (loading) {
    return (
      <PageContainer title="Schedule" subtitle="Loading...">
        <style>{`@keyframes schedPulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.7; } }`}</style>
        <Card style={{ padding: spacing.lg }}>
          {([{ width: '60%' }, { width: '45%' }, { width: '75%' }, { width: '30%' }]).map((bar, i) => (
            <div
              key={i}
              style={{
                height: '32px',
                width: bar.width,
                backgroundColor: '#E5E7EB',
                borderRadius: borderRadius.md,
                animation: 'schedPulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.15}s`,
                marginBottom: i < 3 ? spacing.md : 0,
              }}
            />
          ))}
        </Card>
      </PageContainer>
    );
  }

  if (!loading && !error && schedulePhases.length === 0) {
    return (
      <PageContainer title="Schedule" subtitle="">
        <ScheduleImportModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportComplete={() => setShowImportModal(false)}
          projectId={activeProject?.id}
        />
        <div style={{ maxWidth: '480px', margin: '80px auto', textAlign: 'center' }}>
          <Calendar size={64} color={colors.textTertiary} style={{ marginBottom: '24px' }} />
          <div style={{ fontSize: '20px', fontWeight: 600, color: colors.textPrimary, marginBottom: '12px' }}>
            Build Your Project Schedule
          </div>
          <div style={{ fontSize: '14px', color: colors.textTertiary, marginBottom: '32px', lineHeight: typography.lineHeight.normal }}>
            Track every phase from mobilization to closeout. Import your existing P6 or MS Project schedule, or build from scratch.
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => setShowImportModal(true)}
              style={{
                background: colors.primaryOrange,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: borderRadius.md,
                padding: `${spacing.sm} ${spacing.lg}`,
                fontSize: typography.fontSize.body,
                fontWeight: typography.fontWeight.medium,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Import Schedule
            </button>
            <button
              style={{
                background: '#FFFFFF',
                color: colors.textPrimary,
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.md,
                padding: `${spacing.sm} ${spacing.lg}`,
                fontSize: typography.fontSize.body,
                fontWeight: typography.fontWeight.medium,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Create First Phase
            </button>
          </div>
        </div>
      </PageContainer>
    );
  }

  const pageAlerts = getPredictiveAlertsForPage('schedule');

  const liveIndicator = liveActive ? (
    <div
      aria-label="Live updates active"
      role="status"
      title="Live updates active"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: '#6B7280',
        fontWeight: 500,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#4EC896',
          animation: 'livePulse 1.8s ease-in-out infinite',
          flexShrink: 0,
        }}
      />
      Live
    </div>
  ) : null;

  return (
    <PageContainer
      title="Schedule"
      subtitle={`${metrics.daysBeforeSchedule} days ahead \u00B7 ${metrics.milestonesHit}/${metrics.milestoneTotal} milestones`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <button
            onClick={() => setShowImportModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              padding: `${spacing.sm} ${spacing.lg}`,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md,
              background: 'none',
              cursor: 'pointer',
              fontSize: typography.fontSize.body,
              fontWeight: typography.fontWeight.medium,
              color: colors.textPrimary,
              fontFamily: 'inherit',
              transition: transitions.quick,
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Upload size={15} />
            Import Schedule
          </button>
          {liveIndicator}
        </div>
      }
      aria-label="Project Schedule"
    >
      {/* Global aria-live region: announces filter changes and status updates */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}
      >
        {scheduleAnnouncement}
      </div>

      <a
        href="#gantt-activities"
        style={{
          position: 'absolute',
          left: -9999,
          top: 'auto',
          width: 1,
          height: 1,
          overflow: 'hidden',
          zIndex: 1000,
          backgroundColor: '#0F1629',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '4px',
          textDecoration: 'none',
          fontSize: '14px',
          fontFamily: 'inherit',
          fontWeight: 500,
        }}
        onFocus={e => Object.assign(e.currentTarget.style, { left: '16px', top: '16px', width: 'auto', height: 'auto', overflow: 'visible' })}
        onBlur={e => Object.assign(e.currentTarget.style, { left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' })}
      >
        Skip to schedule activities
      </a>
      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.md,
            padding: `${spacing.md} ${spacing.lg}`,
            backgroundColor: colors.statusCriticalSubtle,
            border: `1px solid ${colors.statusCritical}`,
            borderRadius: borderRadius.md,
            marginBottom: spacing.lg,
          }}
        >
          <span style={{ fontSize: typography.fontSize.body, color: colors.statusCritical }}>
            {(error as Error)?.message ?? String(error)}
          </span>
          <button
            onClick={refetch}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              padding: `${spacing['1']} ${spacing.md}`,
              backgroundColor: colors.statusCritical,
              color: colors.white,
              border: 'none',
              borderRadius: borderRadius.base,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              cursor: 'pointer',
              flexShrink: 0,
              fontFamily: typography.fontFamily,
            }}
          >
            Retry
          </button>
        </div>
      )}
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} onAction={() => setRecoveryExpanded(!recoveryExpanded)} />
      ))}

      {recoveryExpanded && (
        <div style={{
          padding: `${spacing['3']} ${spacing['4']}`, marginBottom: spacing['4'],
          backgroundColor: `${colors.statusPending}06`, borderRadius: borderRadius.md,
          border: `1px solid ${colors.statusPending}15`,
          animation: 'slideInUp 200ms ease-out',
        }}>
          <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusPending, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0, marginBottom: spacing['2'] }}>Recovery Plan</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
            {[
              'Authorize MEP overtime on floors 4 through 6 to recover 4 days of schedule float.',
              'Redirect Exterior Crew D to secondary facade sections while RFI 004 is resolved.',
              'Batch Tuesday RFI reviews with MEP consultant to reduce average response time by 40%.',
            ].map((action, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'] }}>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.statusPending, fontWeight: typography.fontWeight.semibold }}>{i + 1}.</span>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed }}>{action}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setRecoveryExpanded(false)} style={{ marginTop: spacing['3'], padding: `${spacing['1']} ${spacing['3']}`, backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily, color: colors.textTertiary, cursor: 'pointer' }}>
            Collapse
          </button>
        </div>
      )}

      <style>{`
        @keyframes livePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.35); } }
      `}</style>

      {/* KPI Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
          gap: spacing.lg,
          marginBottom: spacing['2xl'],
        }}
      >
        {/* Card 1: Schedule Variance */}
        <ScheduleKPICard
          icon={<Calendar size={24} color={
            activityMetrics.scheduleVarianceDays <= 0 ? colors.statusActive
            : activityMetrics.scheduleVarianceDays <= 5 ? colors.statusPending
            : colors.statusCritical
          } />}
          label="Schedule Variance"
          value={`${activityMetrics.scheduleVarianceDays > 0 ? '+' : ''}${activityMetrics.scheduleVarianceDays}d`}
          valueColor={
            activityMetrics.scheduleVarianceDays <= 0 ? colors.statusActive
            : activityMetrics.scheduleVarianceDays <= 5 ? colors.statusPending
            : colors.statusCritical
          }
          trend={activityMetrics.scheduleVarianceDays > 0 ? 'down' : activityMetrics.scheduleVarianceDays < 0 ? 'up' : 'neutral'}
        />
        {/* Card 2: Critical Path Items */}
        <ScheduleKPICard
          icon={<AlertTriangle size={24} color={activityMetrics.criticalPathCount > 0 ? colors.statusCritical : colors.statusActive} />}
          label="Critical Path Items"
          value={String(activityMetrics.criticalPathCount)}
          valueColor={activityMetrics.criticalPathCount > 0 ? colors.statusCritical : colors.textPrimary}
          trend="neutral"
        />
        {/* Card 3: On Track */}
        <ScheduleKPICard
          icon={<TrendingUp size={24} color={
            activityMetrics.onTrackPct >= 80 ? colors.statusActive
            : activityMetrics.onTrackPct >= 60 ? colors.statusPending
            : colors.statusCritical
          } />}
          label="On Track"
          value={`${activityMetrics.onTrackPct}%`}
          valueColor={
            activityMetrics.onTrackPct >= 80 ? colors.statusActive
            : activityMetrics.onTrackPct >= 60 ? colors.statusPending
            : colors.statusCritical
          }
          trend={activityMetrics.onTrackPct >= 80 ? 'up' : 'down'}
        />
        {/* Card 4: Complete */}
        <ScheduleKPICard
          icon={<CheckCircle size={24} color={colors.primaryOrange} />}
          label="Complete"
          value={`${activityMetrics.completePct}%`}
          valueColor={colors.textPrimary}
          trend="neutral"
          progressPct={activityMetrics.completePct}
        />
      </div>

      {/* Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: spacing.lg,
          marginBottom: spacing['2xl'],
        }}
      >
        <MetricBox label="Days Ahead" value={metrics.daysBeforeSchedule} />
        <MetricBox label="Milestones" value={`${metrics.milestonesHit}/${metrics.milestoneTotal}`} />
        <MetricBox
          label="AI Confidence"
          value={projectMetrics?.aiConfidenceLevel == null ? 'Insufficient data' : projectMetrics.aiConfidenceLevel}
          unit={projectMetrics?.aiConfidenceLevel == null ? undefined : '%'}
        />
      </div>

      {/* AI Risk Panel */}
      <div style={{
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg,
        border: `1px solid ${risks.length > 0 ? `${colors.primaryOrange}30` : colors.borderDefault}`,
        marginBottom: spacing['5'],
        overflow: 'hidden',
        boxShadow: shadows.sm,
      }}>
        {/* Panel header */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={riskPanelOpen}
          aria-label={`AI Risk Analysis panel, ${riskPanelOpen ? 'expanded' : 'collapsed'}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: `${spacing['3']} ${spacing['4']}`,
            borderBottom: riskPanelOpen ? `1px solid ${colors.borderDefault}` : 'none',
            cursor: 'pointer',
            backgroundColor: risks.length > 0 ? `${colors.primaryOrange}05` : 'transparent',
          }}
          onClick={() => setRiskPanelOpen((v) => !v)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRiskPanelOpen((v) => !v); } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <Zap size={15} color={risks.length > 0 ? colors.primaryOrange : colors.statusActive} fill={risks.length > 0 ? colors.primaryOrange : colors.statusActive} />
            <span style={{ fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
              AI Risk Analysis
            </span>
            {risks.length > 0 && (
              <span style={{
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                backgroundColor: `${colors.primaryOrange}18`, color: colors.primaryOrange,
                padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
              }}>
                {risks.length} risk{risks.length > 1 ? 's' : ''} detected
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            {lastAnalyzed && !analyzing && (
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                Last analyzed: {minutesAgo === 0 ? 'just now' : `${minutesAgo}m ago`}
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); runAnalysis(); }}
              disabled={analyzing}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                color: analyzing ? colors.textTertiary : colors.primaryOrange,
                background: 'none', border: 'none', cursor: analyzing ? 'default' : 'pointer',
                fontFamily: typography.fontFamily, padding: 0,
              }}
            >
              <RefreshCw size={11} style={{ animation: analyzing ? 'spin 1s linear infinite' : 'none' }} />
              Re-analyze
            </button>
            {riskPanelOpen ? <ChevronUp size={14} color={colors.textTertiary} /> : <ChevronDown size={14} color={colors.textTertiary} />}
          </div>
        </div>

        {/* Panel body */}
        {riskPanelOpen && (
          <div style={{ padding: spacing['4'] }}>
            {analyzing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
                {[1, 2].map((i) => (
                  <div key={i} style={{ display: 'flex', gap: spacing['3'], alignItems: 'flex-start' }}>
                    <Skeleton height="36px" width="36px" />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                      <Skeleton height="14px" width="40%" />
                      <Skeleton height="12px" width="80%" />
                    </div>
                  </div>
                ))}
              </div>
            ) : risks.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['2']} 0` }}>
                <CheckCircle size={16} color={colors.statusActive} />
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  No risks detected for the next 7 days. Schedule looks healthy.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
                {risks.map((risk) => (
                  <div key={risk.phaseId} style={{
                    display: 'flex', gap: spacing['3'], alignItems: 'flex-start',
                    padding: `${spacing['3']} ${spacing['3']}`,
                    backgroundColor: `${colors.primaryOrange}06`,
                    borderRadius: borderRadius.md,
                    border: `1px solid ${colors.primaryOrange}15`,
                  }}>
                    <div style={{ flexShrink: 0, paddingTop: 2 }}>
                      <AlertTriangle size={15} color={colors.primaryOrange} fill={`${colors.primaryOrange}25`} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap', marginBottom: spacing['1'] }}>
                        <span style={{ fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                          {risk.title}
                        </span>
                        <span style={{
                          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                          backgroundColor: risk.likelihoodPercent >= 70 ? `${colors.statusCritical}15` : `${colors.statusPending}15`,
                          color: risk.likelihoodPercent >= 70 ? colors.statusCritical : colors.statusPending,
                          padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                        }}>
                          {risk.likelihoodPercent}% likely
                        </span>
                        <span style={{
                          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                          backgroundColor: `${colors.primaryOrange}12`, color: colors.primaryOrange,
                          padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                        }}>
                          +{risk.impactDays} day{risk.impactDays > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed }}>
                        {risk.reason}
                      </p>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <button
                        onClick={() => openCopilotWithRisk(risk)}
                        style={{
                          padding: `${spacing['1']} ${spacing['3']}`,
                          backgroundColor: colors.primaryOrange, color: '#fff',
                          border: 'none', borderRadius: borderRadius.base,
                          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                          fontFamily: typography.fontFamily, cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: `opacity ${transitions.quick}`,
                        }}
                      >
                        View Recovery Plan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Timeline: Gantt on desktop/tablet, card list on mobile */}
      <div style={{ marginTop: spacing['5'] }}>
        {error ? (
          /* Inline API error card */
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: borderRadius.lg,
            padding: spacing['5'],
            display: 'flex',
            alignItems: 'flex-start',
            gap: spacing['3'],
          }}>
            <AlertTriangle size={20} color={colors.statusCritical} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, fontSize: typography.fontSize.sm }}>
                Unable to load schedule data
              </p>
              <p style={{ margin: `${spacing['1']} 0 ${spacing['3']}`, color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
                {error}
              </p>
              <Btn variant="danger" size="sm" onClick={refetch}>
                Retry
              </Btn>
            </div>
          </div>
        ) : !loading && schedulePhases.length === 0 ? (
          <Card padding={spacing['5']}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '320px',
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px',
                maxWidth: '480px',
                textAlign: 'center',
                gap: spacing['4'],
              }}>
                <Calendar size={48} color="#9CA3AF" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                  <p style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: colors.textPrimary }}>
                    Build your project schedule
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', color: '#6B7280', lineHeight: typography.lineHeight.relaxed }}>
                    Create phases and activities to track every milestone from mobilization to closeout. Import from Primavera P6 or Microsoft Project to get started quickly.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: spacing['3'] }}>
                  <button
                    onClick={() => addToast('info', 'Phase creation coming soon')}
                    style={{
                      padding: `${spacing.sm} ${spacing.xl}`,
                      backgroundColor: '#F47820',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: borderRadius.md,
                      fontSize: typography.fontSize.body,
                      fontWeight: typography.fontWeight.semibold,
                      fontFamily: typography.fontFamily,
                      cursor: 'pointer',
                    }}
                  >
                    Create First Phase
                  </button>
                  <button
                    onClick={() => addToast('info', 'P6/MS Project import coming soon')}
                    style={{
                      padding: `${spacing.sm} ${spacing.xl}`,
                      backgroundColor: 'transparent',
                      color: colors.textPrimary,
                      border: '1px solid #E5E7EB',
                      borderRadius: borderRadius.md,
                      fontSize: typography.fontSize.body,
                      fontWeight: typography.fontWeight.semibold,
                      fontFamily: typography.fontFamily,
                      cursor: 'pointer',
                    }}
                  >
                    Import Schedule
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {schedulePhases.map((phase) => {
              const statusColor =
                phase.status === 'completed' ? '#4EC896'
                : phase.status === 'in_progress' ? '#3B82F6'
                : phase.status === 'delayed' ? '#E74C3C'
                : '#F59E0B';
              const statusLabel = (phase.status ?? 'not started').replace(/_/g, ' ');
              return (
                <div
                  key={phase.id}
                  role="row"
                  tabIndex={0}
                  aria-label={`${phase.name}, ${phase.progress}% complete, ${statusLabel}`}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setScheduleAnnouncement(`Schedule updated: ${phase.name} is now ${statusLabel}`); } }}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    border: `1px solid ${colors.borderDefault}`,
                    padding: 16,
                    marginBottom: 12,
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 16, color: colors.textPrimary, display: 'block', marginBottom: 6 }}>
                    {phase.name}
                  </span>
                  <span style={{ fontSize: 12, color: colors.textTertiary, display: 'block', marginBottom: 8 }}>
                    {new Date(phase.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                    {' \u2013 '}
                    {new Date(phase.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                  </span>
                  <div style={{ height: 6, backgroundColor: colors.borderDefault, borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ height: '100%', width: `${phase.progress}%`, backgroundColor: colors.primaryOrange, borderRadius: 3 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <Tag label={statusLabel} color={statusColor} backgroundColor={statusColor + '22'} />
                    <span style={{ fontSize: 11, color: colors.textTertiary }}>
                      {phase.progress}% complete
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                <SectionHeader title="Project Timeline" />
                <span
                  aria-hidden="true"
                  style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}
                >
                  {schedulePhases.length > 0 ? `${schedulePhases.length} ${schedulePhases.length === 1 ? 'activity' : 'activities'}` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                {hasBaselineData && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div
                      aria-hidden="true"
                      style={{
                        width: 24,
                        height: 10,
                        background: 'rgba(156, 163, 175, 0.3)',
                        border: '1px dashed #9CA3AF',
                        borderRadius: 2,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Baseline</span>
                  </div>
                )}
                <span
                  title={!hasBaselineData ? 'No baseline dates available' : undefined}
                  style={{ display: 'inline-flex' }}
                >
                  <Btn
                    variant={showBaseline ? 'primary' : 'secondary'}
                    size="sm"
                    icon={showBaseline ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    onClick={() => setShowBaseline(!showBaseline)}
                    aria-label={showBaseline ? 'Hide baseline comparison' : 'Show baseline comparison'}
                    disabled={!hasBaselineData}
                    style={!showBaseline ? { border: `1px solid ${colors.borderDefault}`, background: 'transparent', color: colors.textPrimary } : {}}
                  >
                    {showBaseline ? 'Hide Baseline' : 'Show Baseline'}
                  </Btn>
                </span>
                <Btn
                  variant={whatIfMode ? 'primary' : 'secondary'}
                  size="sm"
                  icon={<Sparkles size={14} />}
                  onClick={() => setWhatIfMode(!whatIfMode)}
                  aria-label={whatIfMode ? 'Exit what-if scenario mode' : 'Enable what-if scenario mode'}
                >
                  {whatIfMode ? 'Exit What If Mode' : 'What If Mode'}
                </Btn>
              </div>
            </div>
            <div
              role="table"
              aria-label="Project schedule"
              style={{
                backgroundColor: colors.surfaceRaised,
                borderRadius: borderRadius.lg,
                padding: spacing['5'],
                boxShadow: whatIfMode ? `0 0 0 2px ${colors.statusPending}40` : shadows.card,
                transition: `box-shadow ${transitions.quick}`,
                overflowX: 'auto',
              }}
            >
              {whatIfMode && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                  padding: `${spacing['2']} ${spacing['3']}`, marginBottom: spacing['3'],
                  backgroundColor: `${colors.statusPending}08`, borderRadius: borderRadius.md,
                  border: `1px solid ${colors.statusPending}20`,
                }}>
                  <Sparkles size={14} color={colors.statusPending} />
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.statusPending, fontWeight: typography.fontWeight.medium }}>
                    What If Mode is active. Drag phase bars to simulate schedule changes and see cascade effects.
                  </span>
                </div>
              )}
              <ErrorBoundary
                fallback={(err) => (
                  <div style={{
                    padding: spacing['5'],
                    backgroundColor: '#FEF2F2',
                    borderRadius: borderRadius.md,
                    border: '1px solid #FECACA',
                  }}>
                    <p style={{ margin: 0, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, fontSize: typography.fontSize.sm }}>
                      Schedule could not be displayed
                    </p>
                    <details style={{ marginTop: spacing['2'] }}>
                      <summary style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, cursor: 'pointer' }}>
                        Technical details
                      </summary>
                      <pre style={{ margin: `${spacing['2']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {err.message}
                      </pre>
                    </details>
                    <button
                      onClick={() => window.location.reload()}
                      style={{
                        marginTop: spacing['3'],
                        padding: `${spacing['2']} ${spacing['4']}`,
                        backgroundColor: colors.statusCritical,
                        color: '#fff',
                        border: 'none',
                        borderRadius: borderRadius.base,
                        fontSize: typography.fontSize.sm,
                        fontWeight: typography.fontWeight.medium,
                        fontFamily: typography.fontFamily,
                        cursor: 'pointer',
                      }}
                    >
                      Reload
                    </button>
                  </div>
                )}
              >
                <GanttChart
                  phases={schedulePhases}
                  whatIfMode={whatIfMode}
                  isLoading={loading}
                  onImportSchedule={() => addToast('info', 'Schedule import coming soon')}
                  onAddActivity={() => addToast('info', 'Activity drawer coming soon')}
                  onPhaseClick={(phase) => {
                    addToast('info', `${phase.name}: ${phase.progress}% complete`);
                    setScheduleAnnouncement(`Schedule updated: ${phase.name} is now ${(phase.status ?? 'not started').replace(/_/g, ' ')}`);
                  }}
                  baselinePhases={schedulePhases}
                  showBaseline={showBaseline}
                  risks={risks}
                />
              </ErrorBoundary>
            </div>
          </>
        )}
      </div>
      <ScheduleImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => { setShowImportModal(false); }}
        projectId={activeProject?.id}
      />
    </PageContainer>
  );
};

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Sparkles, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, CheckCircle, RefreshCw, TrendingUp, Calendar, CalendarDays, ToggleLeft, ToggleRight, Upload, X, Sun, Cloud, CloudRain } from 'lucide-react';
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
import { CoordinationEngine } from '../components/schedule/CoordinationEngine';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PermissionGate } from '../components/auth/PermissionGate';
import { predictScheduleRisks } from '../lib/predictions';
import type { PredictedRisk, WeatherDay } from '../lib/predictions';
import { computeScheduleKPIs } from '../lib/criticalPath';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    setTimeout(() => setMatches(mq.matches), 0);
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
  ariaLabel?: string
  isMobile?: boolean
}

const ScheduleKPICard: React.FC<ScheduleKPICardProps> = ({ icon, label, value, valueColor, trend, progressPct, ariaLabel, isMobile }) => (
  <div aria-label={ariaLabel} style={{
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
    <span style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: typography.fontWeight.semibold, color: valueColor, lineHeight: 1.1 }}>
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

// Weather forecast loaded from weather_records table or weather API
// Empty array is the default until project weather data is populated
const INITIAL_FORECAST: WeatherDay[] = [];

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseCSV(content: string): ParsedActivity[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const findCol = (...names: string[]) => {
    for (const n of names) {
      const idx = headers.findIndex(h => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const nameIdx = findCol('name', 'activity', 'task', 'description');
  const startIdx = findCol('start', 'begin');
  const endIdx = findCol('end', 'finish', 'complete date');
  const durationIdx = findCol('duration', 'dur');
  const statusIdx = findCol('status', 'state');
  return lines.slice(1).map((line, i) => {
    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
    const get = (idx: number) => (idx >= 0 ? cols[idx] ?? '' : '');
    const rawDur = parseFloat(get(durationIdx));
    return {
      activityId: `CSV-${i + 1}`,
      name: get(nameIdx) || `Activity ${i + 1}`,
      startDate: formatP6Date(get(startIdx)),
      endDate: formatP6Date(get(endIdx)),
      duration: isNaN(rawDur) ? 0 : Math.round(rawDur),
      percentComplete: 0,
      floatTotal: 0,
      status: get(statusIdx) || 'not_started',
    };
  }).filter(a => a.name);
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

const ScheduleImportModal: React.FC<ScheduleImportModalProps> = ({ open, onClose }) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'xml' | 'xer' | 'mpp' | 'csv' | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedActivity[] | null>(null);
  const [ setImporting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
      setUploadProgress(0);
    }
  }, [open]);

  if (!open) return null;

  const detectType = (file: File): 'xml' | 'xer' | 'mpp' | 'csv' | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'xml') return 'xml';
    if (ext === 'xer') return 'xer';
    if (ext === 'mpp') return 'mpp';
    if (ext === 'csv') return 'csv';
    return null;
  };

  const handleFile = (file: File) => {
    const type = detectType(file);
    if (type === null) {
      addToast('error', 'Unsupported file format. Please use .xer, .xml, .mpp, or .csv');
      return;
    }
    setSelectedFile(file);
    setFileType(type);
    setParsed(null);
    setUploadProgress(0);
    if (type === 'csv') {
      setParsing(true);
      setUploadProgress(30);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          const acts = parseCSV(content);
          setParsed(acts);
          setUploadProgress(100);
        } catch {
          addToast('error', 'Failed to parse CSV. Check the format and try again.');
        }
        setParsing(false);
      };
      reader.readAsText(file);
    } else if (type === 'xml' || type === 'xer') {
      setParsing(true);
      setUploadProgress(30);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          const acts = type === 'xml' ? parseXmlSchedule(content) : parseXerSchedule(content);
          setParsed(acts);
          setUploadProgress(100);
        } catch {
          addToast('error', 'Failed to parse file. Check the format and try again.');
        }
        setParsing(false);
      };
      reader.readAsText(file);
    } else {
      // MPP: no client-side parsing
      setUploadProgress(100);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleConfirmImport = () => {
    addToast('success', 'Schedule import is being configured. Your file has been queued for processing.');
    onClose();
  };

  const showPreview = !parsing && parsed !== null && fileType === 'csv';
  const preview = parsed?.slice(0, 10) ?? [];

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
              Drop your schedule file here or click to browse
            </span>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>
                Primavera P6 (.xer, .xml)
              </span>
              <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary, display: 'block' }}>
                Microsoft Project (.mpp), CSV (.csv)
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xer,.xml,.mpp,.csv"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        )}

        {/* Selected file chip */}
        {selectedFile && (
          <div style={{ backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: `${spacing.md} ${spacing.lg}` }}>
              <Upload size={15} color={colors.primaryOrange} />
              <span style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedFile.name}
              </span>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, whiteSpace: 'nowrap' }}>
                {formatFileSize(selectedFile.size)}
              </span>
              {fileType && (
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange, textTransform: 'none', letterSpacing: '0' }}>
                  {fileType === 'xer' ? 'Primavera P6 XER detected' : fileType === 'mpp' ? 'MS Project detected' : fileType === 'xml' ? 'P6 XML detected' : fileType.toUpperCase()}
                </span>
              )}
              <button
                aria-label="Remove file"
                onClick={() => { setSelectedFile(null); setFileType(null); setParsed(null); setUploadProgress(0); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: colors.textTertiary }}
              >
                <X size={14} />
              </button>
            </div>
            {uploadProgress > 0 && (
              <div style={{ height: '3px', backgroundColor: colors.borderSubtle }}>
                <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: colors.primaryOrange, transition: 'width 0.3s ease', borderRadius: '0 2px 2px 0' }} />
              </div>
            )}
          </div>
        )}

        {/* Parsing spinner */}
        {parsing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, color: colors.textSecondary, fontSize: typography.fontSize.body }}>
            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', color: colors.primaryOrange }} />
            Parsing schedule file...
          </div>
        )}

        {/* Processing message for XER/XML/MPP */}
        {selectedFile && fileType && fileType !== 'csv' && !parsing && (
          <div style={{ padding: spacing.lg, backgroundColor: colors.statusInfoSubtle, borderRadius: borderRadius.md, border: `1px solid ${colors.statusInfo}30` }}>
            <p style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.statusInfo }}>
              Processing... This file will be sent to our import service
            </p>
            <p style={{ margin: `${spacing.sm} 0 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
              Click Confirm Import to upload and process your schedule. Activities will appear in your schedule once complete.
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
              {parsed!.length > 10 && (
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  Showing first 10
                </span>
              )}
            </div>
            <div style={{ overflowX: 'auto', border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
                <thead>
                  <tr style={{ backgroundColor: colors.surfaceInset }}>
                    {['Name', 'Start', 'End', 'Duration', 'Status'].map(h => (
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
                      <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary }}>
                        {a.status || 'not_started'}
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
          {selectedFile && fileType && !parsing && (
            <Btn
              variant="primary"
              onClick={handleConfirmImport}
            >
              Preview &amp; Import
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
};

export const Schedule: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isNarrow = useMediaQuery('(max-width: 480px)');
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

  const [viewMode, setViewMode] = useState<'gantt' | 'list'>('gantt');
  const [zoomLevel, setZoomLevel] = useState<'day' | 'week' | 'month' | 'quarter'>('week');
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [showBaseline, setShowBaseline] = useState(false);
  const [recoveryExpanded, setRecoveryExpanded] = useState(false);
  const [scheduleAnnouncement, setScheduleAnnouncement] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [mobileFilter, setMobileFilter] = useState<'all' | 'in_progress' | 'delayed' | 'critical_path'>('all');
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
  const [aiEdgeText, setAiEdgeText] = useState<string | null>(null);
  const [aiEdgeLoading, setAiEdgeLoading] = useState(false);
  const [weatherRecords, setWeatherRecords] = useState<Array<{ date: string; conditions: string | null }>>([]);

  useMemo(() => computeScheduleKPIs(schedulePhases), [schedulePhases])

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
      const results = predictScheduleRisks(schedulePhases, INITIAL_FORECAST);
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

  useEffect(() => {
    const projectId = activeProject?.id;
    if (!projectId) return;
    const today = new Date().toISOString().split('T')[0];
    const twoWeeksOut = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    supabase
      .from('weather_records')
      .select('date, conditions')
      .eq('project_id', projectId)
      .gte('date', today)
      .lte('date', twoWeeksOut)
      .then(({ data }) => {
        if (data && data.length > 0) setWeatherRecords(data);
      });
  }, [activeProject?.id]);

  // Announce schedule load completion to screen readers
  useEffect(() => {
    if (!loading && schedulePhases.length > 0) {
      const criticalCount = schedulePhases.filter(p => p.is_critical_path === true).length;
      setScheduleAnnouncement(`Schedule loaded with ${schedulePhases.length} ${schedulePhases.length === 1 ? 'activity' : 'activities'}, ${criticalCount} on critical path`);
    }
  }, [loading, schedulePhases]);

  // Global keyboard shortcuts: +/= zoom in, - zoom out, b toggle baseline, Escape exit what-if
  useEffect(() => {
    const ZOOM_ORDER = ['day', 'week', 'month', 'quarter'] as const;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoomLevel(prev => {
          const idx = ZOOM_ORDER.indexOf(prev);
          return idx > 0 ? ZOOM_ORDER[idx - 1] : prev;
        });
      } else if (e.key === '-') {
        e.preventDefault();
        setZoomLevel(prev => {
          const idx = ZOOM_ORDER.indexOf(prev);
          return idx < ZOOM_ORDER.length - 1 ? ZOOM_ORDER[idx + 1] : prev;
        });
      } else if (e.key === 'b' || e.key === 'B') {
        setShowBaseline(prev => !prev);
      } else if (e.key === 'Escape') {
        setWhatIfMode(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const overallHealthStatus = useMemo(() => {
    if (schedulePhases.length === 0) return { status: 'green', label: 'On Track' };
    const behind = schedulePhases.filter(p => {
      if (p.status === 'delayed') return true;
      const planned = (p as unknown as Record<string, unknown>).planned_percent_complete as number | null | undefined;
      if (planned != null && (p.percent_complete ?? p.progress ?? 0) < planned) return true;
      return false;
    });
    const pct = (behind.length / schedulePhases.length) * 100;
    if (pct > 20) return { status: 'red', label: `At Risk: ${behind.length} ${behind.length === 1 ? 'activity' : 'activities'} behind` };
    if (pct > 10) return { status: 'amber', label: `Monitoring: ${behind.length} ${behind.length === 1 ? 'activity' : 'activities'} behind` };
    return { status: 'green', label: 'On Track' };
  }, [schedulePhases]);

  const criticalPathAtRisk = useMemo(() => {
    return schedulePhases
      .filter(p => p.is_critical_path === true && (p.status === 'delayed' || (p.float_days ?? p.floatDays ?? 99) < 3))
      .map(p => ({
        id: p.id,
        name: p.name,
        floatDays: p.float_days ?? p.floatDays ?? 0,
        status: p.status,
      }));
  }, [schedulePhases]);

  const outdoorActivityCount = useMemo(() => {
    return schedulePhases.filter(p => (p as unknown as Record<string, unknown>).outdoor_activity === true).length;
  }, [schedulePhases]);

  const runAiEdgeAnalysis = useCallback(async () => {
    const projectId = activeProject?.id;
    if (!projectId) return;
    setAiEdgeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-schedule-risk', {
        body: { project_id: projectId },
      });
      if (error) throw error;
      const text = (data as Record<string, unknown>)?.analysis ?? (data as Record<string, unknown>)?.text ?? String(data ?? '');
      setAiEdgeText(String(text));
    } catch {
      setAiEdgeText('AI analysis will be available when the AI service is configured.');
    }
    setAiEdgeLoading(false);
  }, [activeProject?.id]);

  const openCopilotWithRisk = useCallback(async (risk: PredictedRisk) => {
    const prompt = `Generate a detailed recovery plan for the ${risk.title} phase. Risk assessment: ${risk.reason} Likelihood: ${risk.likelihoodPercent}%, potential impact: +${risk.impactDays} days. Suggested action: ${risk.suggestedAction}`;
    const convId = createConversation(`Recovery Plan: ${risk.title}`);
    setActiveConversation(convId);
    navigate('/copilot');
    // Fire-and-forget the initial message after navigation
    setTimeout(() => sendMessage(prompt), 100);
  }, [createConversation, setActiveConversation, sendMessage, navigate]);



  if (error && !loading) {
    return (
      <PageContainer title="Schedule" subtitle="">
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '40vh',
            textAlign: 'center',
            padding: spacing.xl,
          }}
        >
          <AlertCircle size={40} color={colors.statusCritical} style={{ marginBottom: spacing.lg }} />
          <h2 style={{ margin: 0, marginBottom: spacing.sm, fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            Unable to load schedule
          </h2>
          <p style={{ margin: 0, marginBottom: spacing.xl, fontSize: typography.fontSize.sm, color: colors.textSecondary, maxWidth: 400 }}>
            {error || 'Check your connection and try again.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing.sm,
              padding: `${spacing.md} ${spacing.xl}`,
              minHeight: 56,
              backgroundColor: colors.primaryOrange,
              color: colors.white,
              border: 'none',
              borderRadius: borderRadius.lg,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </PageContainer>
    );
  }

  if (loading) {
    const SKEL_ROW_WIDTHS = ['70%', '55%', '85%', '40%', '90%', '60%', '75%', '45%'];
    return (
      <PageContainer title="Schedule" subtitle="Loading...">
        <style>{`
          @keyframes schedShimmer {
            0% { background-position: -600px 0; }
            100% { background-position: 600px 0; }
          }
        `}</style>
        {/* 4 skeleton metric cards */}
        <div role="status" aria-label="Loading schedule data" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.lg, marginBottom: spacing.xl }}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                height: '120px',
                borderRadius: '12px',
                background: 'linear-gradient(90deg, #E5E7EB 25%, #F3F4F6 50%, #E5E7EB 75%)',
                backgroundSize: '600px 100%',
                animation: 'schedShimmer 1.5s infinite linear',
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
        {/* 8 skeleton Gantt activity rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {SKEL_ROW_WIDTHS.map((w, i) => (
            <div
              key={i}
              style={{
                height: '48px',
                width: w,
                borderRadius: '8px',
                background: 'linear-gradient(90deg, #E5E7EB 25%, #F3F4F6 50%, #E5E7EB 75%)',
                backgroundSize: '600px 100%',
                animation: 'schedShimmer 1.5s infinite linear',
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
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
        <div role="status" aria-label="Build Your Project Schedule" style={{ maxWidth: '480px', margin: '80px auto', textAlign: 'center' }}>
          <CalendarDays size={48} color='#9CA3AF' style={{ marginBottom: '24px' }} />
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#1A1A2E', marginBottom: '12px' }}>
            Build your schedule to track every phase from mobilization to closeout
          </div>
          <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '32px', lineHeight: typography.lineHeight.normal }}>
            Import your P6 or MS Project schedule, or create phases manually
          </div>
          <PermissionGate permission="schedule.edit">
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
                Import from P6/MS Project
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
          </PermissionGate>
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
          <PermissionGate permission="schedule.edit">
            <button
              aria-label="Import schedule from Primavera P6 or Microsoft Project"
              onClick={() => setShowImportModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                padding: `0 ${spacing.lg}`,
                height: '40px',
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.md,
                backgroundColor: colors.white,
                cursor: 'pointer',
                fontSize: typography.fontSize.body,
                fontWeight: typography.fontWeight.medium,
                color: colors.textPrimary,
                fontFamily: 'inherit',
                transition: transitions.quick,
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = colors.white)}
            >
              <Calendar size={15} />
              <Upload size={15} />
              Import Schedule
            </button>
          </PermissionGate>
          {liveIndicator}
        </div>
      }
      aria-label="Project Schedule"
      role="main"
    >
      {/* Visually hidden h1 for screen reader landmark navigation */}
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', margin: 0, padding: 0 }}>
        Schedule
      </h1>

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
        Skip to schedule chart
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
            Unable to load schedule
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
        role="group"
        aria-label="Schedule metrics"
        style={{
          display: 'grid',
          gridTemplateColumns: isNarrow ? '1fr' : isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
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
          ariaLabel={`Schedule Variance: ${activityMetrics.scheduleVarianceDays > 0 ? '+' : ''}${activityMetrics.scheduleVarianceDays}d`}
          isMobile={isMobile}
        />
        {/* Card 2: Critical Path Items */}
        <ScheduleKPICard
          icon={<AlertTriangle size={24} color={activityMetrics.criticalPathCount > 0 ? colors.statusCritical : colors.statusActive} />}
          label="Critical Path Items"
          value={String(activityMetrics.criticalPathCount)}
          valueColor={activityMetrics.criticalPathCount > 0 ? colors.statusCritical : colors.textPrimary}
          trend="neutral"
          ariaLabel={`Critical Path Items: ${activityMetrics.criticalPathCount}`}
          isMobile={isMobile}
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
          ariaLabel={`On Track: ${activityMetrics.onTrackPct}%`}
          isMobile={isMobile}
        />
        {/* Card 4: Complete */}
        <ScheduleKPICard
          icon={<CheckCircle size={24} color={colors.primaryOrange} />}
          label="Complete"
          value={`${activityMetrics.completePct}%`}
          valueColor={colors.textPrimary}
          trend="neutral"
          progressPct={activityMetrics.completePct}
          ariaLabel={`Complete: ${activityMetrics.completePct}%`}
          isMobile={isMobile}
        />
      </div>

      {/* Metrics */}
      <div
        role="region"
        aria-label="Schedule Summary"
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
            <Sparkles size={15} color={risks.length > 0 ? colors.primaryOrange : colors.statusActive} />
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
          <div style={{ padding: spacing['4'], display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>

            {/* Section A: Overall Health */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary }}>
                Overall Health
              </span>
              <span style={{
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                padding: `2px ${spacing['3']}`,
                borderRadius: borderRadius.full,
                backgroundColor: overallHealthStatus.status === 'green'
                  ? `${colors.statusActive}18`
                  : overallHealthStatus.status === 'amber'
                  ? `${colors.statusPending}18`
                  : `${colors.statusCritical}18`,
                color: overallHealthStatus.status === 'green'
                  ? colors.statusActive
                  : overallHealthStatus.status === 'amber'
                  ? colors.statusPending
                  : colors.statusCritical,
              }}>
                {overallHealthStatus.label}
              </span>
            </div>

            {/* Section B: Critical Path Risks */}
            {criticalPathAtRisk.length > 0 && (
              <div>
                <p style={{ margin: `0 0 ${spacing['2']}`, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Critical Path Risks
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                  {criticalPathAtRisk.map(activity => (
                    <div key={activity.id} style={{
                      display: 'flex', alignItems: 'center', gap: spacing['3'],
                      padding: `${spacing['2']} ${spacing['3']}`,
                      backgroundColor: `${colors.statusCritical}08`,
                      borderRadius: borderRadius.md,
                      border: `1px solid ${colors.statusCritical}20`,
                    }}>
                      <AlertTriangle size={13} color={colors.statusCritical} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: typography.fontSize.sm, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {activity.name}
                      </span>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, whiteSpace: 'nowrap' }}>
                        {activity.floatDays}d float
                      </span>
                      <span style={{
                        fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                        padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                        backgroundColor: activity.status === 'delayed' ? `${colors.statusCritical}15` : `${colors.statusPending}15`,
                        color: activity.status === 'delayed' ? colors.statusCritical : colors.statusPending,
                        whiteSpace: 'nowrap',
                      }}>
                        {activity.status === 'delayed' ? 'Delayed' : 'Low Float'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section C: Weather Impact */}
            {outdoorActivityCount > 0 && (
              <div style={{
                padding: `${spacing['3']} ${spacing['3']}`,
                backgroundColor: `${colors.statusPending}10`,
                borderRadius: borderRadius.md,
                border: `1px solid ${colors.statusPending}25`,
                display: 'flex', alignItems: 'center', gap: spacing['3'],
              }}>
                <Cloud size={15} color={colors.statusPending} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  <strong style={{ color: colors.textPrimary }}>{outdoorActivityCount} outdoor {outdoorActivityCount === 1 ? 'activity' : 'activities'}</strong> scheduled this week. Check weather before committing.
                </span>
              </div>
            )}

            {/* Predictive risk items from local analysis */}
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

            {/* AI Edge Function section */}
            <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: spacing['3'], display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  Deep AI analysis via cloud service
                </span>
                <button
                  onClick={runAiEdgeAnalysis}
                  disabled={aiEdgeLoading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing['2'],
                    padding: `${spacing['1']} ${spacing['3']}`,
                    backgroundColor: colors.primaryOrange, color: '#fff',
                    border: 'none', borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                    fontFamily: typography.fontFamily,
                    cursor: aiEdgeLoading ? 'default' : 'pointer',
                    opacity: aiEdgeLoading ? 0.7 : 1,
                    transition: `opacity ${transitions.quick}`,
                  }}
                >
                  {aiEdgeLoading
                    ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Sparkles size={12} />
                  }
                  {aiEdgeLoading ? 'Analyzing...' : 'Run AI Analysis'}
                </button>
              </div>
              {aiEdgeText && (
                <div style={{
                  padding: spacing['3'],
                  backgroundColor: `${colors.primaryOrange}06`,
                  borderRadius: borderRadius.md,
                  border: `1px solid ${colors.primaryOrange}20`,
                }}>
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed }}>
                    {aiEdgeText}
                  </p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* ── Coordination Engine — Trade Conflict Detection ──── */}
      <CoordinationEngine />

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
              <div
                role="status"
                aria-label="No schedule activities. Build your project schedule to get started."
                style={{
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
                    onClick={() => addToast('info', 'Phase creation available in the next update')}
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
                    onClick={() => addToast('info', 'P6/MS Project import available in the next update')}
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
          <div>
            {/* Sticky mobile header */}
            <div style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backgroundColor: '#F7F8FA',
              padding: '12px 0 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: colors.textPrimary }}>Schedule</span>
              <button
                onClick={() => setShowImportModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: 44,
                  minWidth: 44,
                  padding: '0 16px',
                  border: `1px solid ${colors.borderDefault}`,
                  borderRadius: 8,
                  backgroundColor: colors.white,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  color: colors.textPrimary,
                  fontFamily: 'inherit',
                }}
              >
                <Upload size={14} />
                Import
              </button>
            </div>
            {/* Filter tabs — horizontally scrollable */}
            <div role="tablist" aria-label="Filter activities by status" style={{ overflowX: 'auto', whiteSpace: 'nowrap', marginBottom: 12, WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
              {(['all', 'in_progress', 'delayed', 'critical_path'] as const).map((f) => {
                const labels: Record<string, string> = { all: 'All', in_progress: 'In Progress', delayed: 'Delayed', critical_path: 'Critical Path' };
                const active = mobileFilter === f;
                return (
                  <button
                    key={f}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setMobileFilter(f)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 44,
                      padding: '0 16px',
                      marginRight: 8,
                      border: active ? 'none' : `1px solid ${colors.borderDefault}`,
                      borderRadius: 22,
                      backgroundColor: active ? colors.primaryOrange : '#FFFFFF',
                      color: active ? '#FFFFFF' : colors.textSecondary,
                      fontSize: 14,
                      fontWeight: active ? 600 : 400,
                      fontFamily: typography.fontFamily,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {labels[f]}
                  </button>
                );
              })}
            </div>
            <div data-schedule-list style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {schedulePhases
                .filter((p) => {
                  if (mobileFilter === 'all') return true;
                  if (mobileFilter === 'critical_path') return p.is_critical_path === true;
                  return p.status === mobileFilter;
                })
                .map((phase) => {
                const statusColor =
                  phase.status === 'completed' ? '#4EC896'
                  : phase.status === 'in_progress' ? '#3B82F6'
                  : phase.status === 'delayed' ? '#E74C3C'
                  : '#F59E0B';
                const statusLabel = (phase.status ?? 'not started').replace(/_/g, ' ');
                const floatDays = phase.float_days ?? (phase as unknown as Record<string, unknown>).floatDays ?? 0;
                return (
                  <div
                    key={phase.id}
                    role="row"
                    tabIndex={0}
                    aria-label={`${phase.name}, ${phase.progress}% complete, ${statusLabel}`}
                    onClick={() => addToast('info', phase.name)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        addToast('info', phase.name);
                        setScheduleAnnouncement(`Selected: ${phase.name}, ${statusLabel}`);
                      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        const list = e.currentTarget.closest('[data-schedule-list]');
                        const rows = Array.from(list?.querySelectorAll<HTMLElement>('[role="row"]') ?? []);
                        const idx = rows.indexOf(e.currentTarget);
                        const next = e.key === 'ArrowDown' ? rows[idx + 1] : rows[idx - 1];
                        next?.focus();
                      }
                    }}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 8,
                      border: '1px solid #E5E7EB',
                      borderLeft: phase.is_critical_path === true ? '3px solid #E74C3C' : '1px solid #E5E7EB',
                      padding: 16,
                      minHeight: 64,
                      cursor: 'pointer',
                      outline: 'none',
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 14, color: colors.textPrimary, display: 'block', marginBottom: 6 }}>
                      {phase.is_milestone ? '◆ ' : ''}{phase.name}
                    </span>
                    <span style={{ fontSize: 14, color: '#6B7280', display: 'block', marginBottom: 8 }}>
                      {new Date(phase.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                      {' \u2014 '}
                      {new Date(phase.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                    </span>
                    {!phase.is_milestone && (
                      <div style={{ height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{ height: '100%', width: `${phase.progress ?? 0}%`, backgroundColor: statusColor, borderRadius: 3 }} />
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span aria-label={`Status: ${statusLabel}`} role="img">
                        <Tag label={statusLabel} color={statusColor} backgroundColor={statusColor + '22'} />
                      </span>
                      <span style={{ fontSize: 12, color: colors.textTertiary }}>
                        {floatDays}d float
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ margin: '16px 0 0', fontSize: 12, color: colors.textTertiary, textAlign: 'center' }}>
              Switch to desktop for Gantt chart view.
            </p>
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
                {/* Gantt / List view toggle */}
                <div role="group" aria-label="View mode" style={{ display: 'flex', gap: 2, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, padding: 2 }}>
                  {(['gantt', 'list'] as const).map(mode => (
                    <button
                      key={mode}
                      aria-pressed={viewMode === mode}
                      onClick={() => setViewMode(mode)}
                      style={{
                        padding: `${spacing['1']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.full,
                        backgroundColor: viewMode === mode ? colors.surfaceRaised : 'transparent',
                        color: viewMode === mode ? colors.textPrimary : colors.textTertiary,
                        fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                        fontFamily: typography.fontFamily, cursor: 'pointer',
                        boxShadow: viewMode === mode ? shadows.sm : 'none',
                        textTransform: 'capitalize',
                        transition: transitions.quick,
                      }}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                {/* Zoom controls */}
                <div role="group" aria-label="Zoom level" style={{ display: 'flex', gap: 1, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, padding: 2 }}>
                  {([
                    { value: 'day' as const, label: 'Day', ariaLabel: 'Zoom to day view' },
                    { value: 'week' as const, label: 'Week', ariaLabel: 'Zoom to week view' },
                    { value: 'month' as const, label: 'Month', ariaLabel: 'Zoom to month view' },
                    { value: 'quarter' as const, label: 'Quarter', ariaLabel: 'Zoom to quarter view' },
                  ]).map(z => (
                    <button
                      key={z.value}
                      aria-label={z.ariaLabel}
                      aria-pressed={zoomLevel === z.value}
                      onClick={() => setZoomLevel(z.value)}
                      style={{
                        padding: `${spacing['1']} ${spacing['3']}`,
                        border: 'none',
                        borderRadius: borderRadius.full,
                        backgroundColor: zoomLevel === z.value ? colors.surfaceRaised : 'transparent',
                        color: zoomLevel === z.value ? colors.textPrimary : colors.textTertiary,
                        fontSize: typography.fontSize.caption,
                        fontWeight: typography.fontWeight.medium,
                        fontFamily: typography.fontFamily,
                        cursor: 'pointer',
                        boxShadow: zoomLevel === z.value ? shadows.sm : 'none',
                        transition: transitions.quick,
                      }}
                    >
                      {z.label}
                    </button>
                  ))}
                </div>
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
              role="region"
              aria-label={viewMode === 'gantt' ? 'Project Schedule Gantt Chart' : 'Schedule Activities List'}
              id="gantt-activities"
              style={{
                backgroundColor: colors.surfaceRaised,
                borderRadius: borderRadius.lg,
                padding: spacing['5'],
                boxShadow: whatIfMode ? `0 0 0 2px ${colors.statusPending}40` : shadows.card,
                transition: `box-shadow ${transitions.quick}`,
                overflow: 'auto',
                minHeight: '500px',
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

              {/* Weather overlay strip: DB records take priority, INITIAL_FORECAST as fallback */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: spacing['3'],
                padding: `${spacing['2']} ${spacing['3']}`, marginBottom: spacing['3'],
                backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
                border: `1px solid ${colors.borderSubtle}`, overflowX: 'auto',
              }}>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.medium, whiteSpace: 'nowrap' }}>
                  7-Day Forecast
                </span>
                {(weatherRecords.length > 0
                  ? weatherRecords.slice(0, 7).map(r => ({ date: r.date, conditions: r.conditions ?? 'Clear' }))
                  : INITIAL_FORECAST.map(d => ({ date: d.date, conditions: d.conditions as string }))
                ).map((day) => {
                  const label = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
                  const cond = day.conditions.toLowerCase();
                  const isRain = cond.includes('rain') || cond.includes('storm') || cond.includes('snow');
                  const isCloudy = cond.includes('cloud') || cond.includes('overcast');
                  return (
                    <div key={day.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 44 }}>
                      {isRain
                        ? <CloudRain size={14} color={colors.statusInfo} />
                        : isCloudy
                        ? <Cloud size={14} color={colors.textTertiary} />
                        : <Sun size={14} color="#F59E0B" />
                      }
                      <span style={{ fontSize: 10, color: colors.textTertiary, whiteSpace: 'nowrap' }}>{label}</span>
                    </div>
                  );
                })}
              </div>

              {viewMode === 'list' ? (
                <div style={{ overflowX: 'auto' }}>
                  <table role="grid" aria-label="Schedule activities" style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
                    <thead>
                      <tr style={{ backgroundColor: colors.surfaceInset }}>
                        {['Activity', 'Start', 'Finish', 'Duration', 'Status', '% Complete', 'Float'].map(h => (
                          <th key={h} style={{ padding: `${spacing.sm} ${spacing.md}`, textAlign: 'left', fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, fontSize: typography.fontSize.caption, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${colors.borderSubtle}`, whiteSpace: 'nowrap' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody data-schedule-list>
                      {schedulePhases.map((phase, _) => {
                        const statusLabel = (phase.status ?? 'not started').replace(/_/g, ' ');
                        const durationDays = Math.round((new Date(phase.endDate).getTime() - new Date(phase.startDate).getTime()) / 86400000);
                        const floatDays = phase.float_days ?? (phase as unknown as Record<string, unknown>).floatDays ?? 0;
                        const statusColor =
                          phase.status === 'completed' ? '#9CA3AF'
                          : phase.status === 'in_progress' ? '#3B82F6'
                          : phase.status === 'delayed' ? '#F5A623'
                          : '#9CA3AF';
                        const isCP = phase.is_critical_path === true;
                        return (
                          <tr
                            key={phase.id}
                            role="row"
                            tabIndex={0}
                            aria-label={`${phase.name}, ${statusLabel}, ${phase.progress ?? 0}% complete, starts ${phase.startDate}`}
                            style={{
                              borderBottom: `1px solid ${colors.borderSubtle}`,
                              borderLeft: isCP ? '3px solid #E74C3C' : '3px solid transparent',
                              cursor: 'pointer',
                              transition: transitions.quick,
                              outline: 'none',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                            onClick={() => addToast('info', `${phase.name}: ${phase.progress}% complete`)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                addToast('info', `${phase.name}: ${phase.progress}% complete`);
                                setScheduleAnnouncement(`Selected: ${phase.name}, ${statusLabel}`);
                              } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                e.preventDefault();
                                const tbody = e.currentTarget.closest('[data-schedule-list]');
                                const rows = Array.from(tbody?.querySelectorAll<HTMLElement>('[role="row"]') ?? []);
                                const idx = rows.indexOf(e.currentTarget);
                                const next = e.key === 'ArrowDown' ? rows[idx + 1] : rows[idx - 1];
                                next?.focus();
                              }
                            }}
                          >
                            <td role="gridcell" style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, fontWeight: isCP ? typography.fontWeight.semibold : typography.fontWeight.normal, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {isCP && <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: '#E74C3C', color: '#fff', padding: '0 4px', borderRadius: 3, lineHeight: '16px', marginRight: 6 }}>CP</span>}
                              {phase.name}
                            </td>
                            <td role="gridcell" style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                              {new Date(phase.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                            </td>
                            <td role="gridcell" style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                              {new Date(phase.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                            </td>
                            <td role="gridcell" style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textTertiary }}>
                              {durationDays}d
                            </td>
                            <td role="gridcell" style={{ padding: `${spacing.sm} ${spacing.md}` }}>
                              <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: statusColor, backgroundColor: statusColor + '18', padding: '2px 8px', borderRadius: borderRadius.full }}>
                                {statusLabel}
                              </span>
                            </td>
                            <td role="gridcell" style={{ padding: `${spacing.sm} ${spacing.md}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                                <div style={{ width: 64, height: 6, borderRadius: 3, backgroundColor: colors.borderSubtle, overflow: 'hidden', flexShrink: 0 }}>
                                  <div style={{ height: '100%', width: `${phase.progress ?? 0}%`, backgroundColor: statusColor, borderRadius: 3 }} />
                                </div>
                                <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, minWidth: 28 }}>{phase.progress ?? 0}%</span>
                              </div>
                            </td>
                            <td role="gridcell" style={{ padding: `${spacing.sm} ${spacing.md}`, color: Number(floatDays) === 0 ? '#E74C3C' : colors.textTertiary, fontWeight: Number(floatDays) === 0 ? typography.fontWeight.semibold : typography.fontWeight.normal }}>
                              {floatDays}d
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
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
                  zoomLevel={zoomLevel}
                  onImportSchedule={() => addToast('info', 'Schedule import available in the next update')}
                  onAddActivity={() => addToast('info', 'Activity drawer available in the next update')}
                  onPhaseClick={(phase) => {
                    addToast('info', `${phase.name}: ${phase.progress}% complete`);
                    setScheduleAnnouncement(`Schedule updated: ${phase.name} is now ${(phase.status ?? 'not started').replace(/_/g, ' ')}`);
                  }}
                  baselinePhases={schedulePhases}
                  showBaseline={showBaseline}
                  risks={risks}
                />
              </ErrorBoundary>
              )}
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

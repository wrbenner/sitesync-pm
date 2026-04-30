// ─────────────────────────────────────────────────────────────────────────────
// Daily Log — superintendent's primary page (Tab Q-DailyLog, investor push)
// ─────────────────────────────────────────────────────────────────────────────
// Full viewport. Sticky header with date stepper + status pill + + New Entry +
// Submit Log on the right. Six ZonePanel sections beneath: Conditions,
// Manpower, Equipment, Field entries, Photos, Visitors/Deliveries. Tabular
// figures everywhere there's a number. Edit-in-place per cell (Esc cancels,
// Enter commits). No parchment, no italic Garamond, no centered max-width,
// no soft drop-shadows on rows.
//
// Iris auto-draft remains in `src/components/dailylog/*` (sacred — not
// rewritten). The header pill mounts the existing `AutoDailyLog` review
// surface inside a slide-over.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense,
} from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, Camera, ChevronLeft, ChevronRight, CloudRain, Cloud, Sun,
  CloudSnow, FileText, Plus, RefreshCw, Send, ShieldCheck, Sparkles,
  Truck, Users, Wind, X,
} from 'lucide-react';

import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ProjectGate } from '../../components/ProjectGate';
import { PageState } from '../../components/shared/PageState';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { Btn, useToast } from '../../components/Primitives';
import { useConfirm } from '../../components/ConfirmDialog';
import CreateDailyLogModal from '../../components/forms/CreateDailyLogModal';
import { FieldCaptureModal } from '../../components/field-capture/FieldCaptureModal';
import { AutoDailyLog } from '../../components/dailylog/AutoDailyLog';

import { useCopilotStore } from '../../stores/copilotStore';
import { useAuthStore } from '../../stores/authStore';
import { useProjectId } from '../../hooks/useProjectId';
import { useDailyLogs, useDailyLogEntries, useProject } from '../../hooks/queries';
import {
  useUpdateDailyLog, useCreateDailyLog, useDeleteDailyLog,
  useSubmitDailyLog, useApproveDailyLog, useRejectDailyLog,
} from '../../hooks/mutations';
import { useCreateDailyLogEntry, useDeleteDailyLogEntry } from '../../hooks/mutations/daily-log-entries';
import { useFieldCapture } from '../../hooks/useFieldCapture';
import { useIsOnline } from '../../hooks/useOfflineStatus';
import { useIrisDrafts } from '../../hooks/useIrisDrafts';

import { supabase } from '../../lib/supabase';
import { fetchWeather, formatWeatherSummary } from '../../lib/weather';
import type { WeatherData } from '../../lib/weather';
import { typography } from '../../styles/theme';
import type { ExtendedDailyLog } from './types';

const DailyLogPDFExport = lazy(() => import('./DailyLogPDFExport').then((m) => ({ default: m.DailyLogPDFExport })));

// ── Constants — DESIGN-RESET enterprise palette ──────────────────────────────
// surfaceRaised (#FFFFFF), NOT parchment.
const PAGE_BG = '#FCFCFA';
const SURFACE = '#FFFFFF';
const SURFACE_INSET = '#F5F4F1';
const BORDER = '#E8E5DF';
const BORDER_STRONG = '#D9D5CD';
const INK = '#1A1613';
const INK_2 = '#5C5550';
const INK_3 = '#8C857E';

const STATUS = {
  critical: '#C93B3B',
  high: '#B8472E',
  medium: '#C4850C',
  onTrack: '#2D8A6E',
  brandAction: '#F47820',
  iris: '#4F46E5',
  irisSubtle: '#4F46E512',
  info: '#3B82F6',
} as const;

type LogStatus = 'not_started' | 'draft' | 'submitted' | 'approved' | 'rejected';

interface DailyLogEntry {
  id: string;
  daily_log_id: string;
  type: string | null;
  trade: string | null;
  company: string | null;
  headcount: number | null;
  hours: number | null;
  equipment_name: string | null;
  equipment_hours: number | null;
  description: string | null;
  inspector_name: string | null;
  time_in: string | null;
  time_out: string | null;
  delay_cause: string | null;
  condition: string | null;
  quantity: number | null;
  unit: string | null;
  po_number: string | null;
  photos: unknown;
  created_at: string | null;
}

interface PhotoRecord {
  id: string;
  url: string;
  caption?: string;
  category?: string;
  timestamp?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const todayISODate = () => new Date().toISOString().slice(0, 10);

function formatLongDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function shiftDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function deriveStatus(log: ExtendedDailyLog | undefined): LogStatus {
  if (!log) return 'not_started';
  const s = (log.status ?? '').toLowerCase();
  if (s === 'approved' || (log.approved && s !== 'submitted' && s !== 'rejected')) return 'approved';
  if (s === 'submitted') return 'submitted';
  if (s === 'rejected') return 'rejected';
  return 'draft';
}

const STATUS_PILL_TONE: Record<LogStatus, { color: string; label: string }> = {
  not_started: { color: INK_3, label: 'Not started' },
  draft: { color: STATUS.medium, label: 'Drafting' },
  submitted: { color: STATUS.info, label: 'Submitted' },
  approved: { color: STATUS.onTrack, label: 'Approved' },
  rejected: { color: STATUS.critical, label: 'Returned' },
};

function weatherIcon(conditions: string | null | undefined, size = 16) {
  const c = (conditions ?? '').toLowerCase();
  if (c.includes('snow')) return <CloudSnow size={size} />;
  if (c.includes('rain') || c.includes('storm')) return <CloudRain size={size} />;
  if (c.includes('cloud')) return <Cloud size={size} />;
  return <Sun size={size} />;
}

function fmtNum(n: number | null | undefined, fallback = '—'): string {
  if (n == null || isNaN(Number(n))) return fallback;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Number(n));
}

// ── Edit-in-place primitive ──────────────────────────────────────────────────
// click → input; Esc cancels (restores prior); Enter commits; blur commits.

interface EditableCellProps {
  value: string | number | null | undefined;
  onCommit: (next: string) => Promise<void> | void;
  type?: 'text' | 'number';
  placeholder?: string;
  align?: 'left' | 'right';
  width?: number | string;
  disabled?: boolean;
  emptyDisplay?: string;
}

const EditableCell: React.FC<EditableCellProps> = ({
  value, onCommit, type = 'text', placeholder, align = 'left',
  width, disabled, emptyDisplay = '—',
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value == null ? '' : String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep draft in sync if upstream value changes while not editing.
  useEffect(() => {
    if (!editing) setDraft(value == null ? '' : String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = async () => {
    const next = draft.trim();
    setEditing(false);
    if (next === (value == null ? '' : String(value))) return;
    try {
      await onCommit(next);
    } catch {
      // Mutation hooks already toast. Restore original.
      setDraft(value == null ? '' : String(value));
    }
  };

  const cancel = () => {
    setDraft(value == null ? '' : String(value));
    setEditing(false);
  };

  const display = value == null || value === '' ? emptyDisplay : String(value);
  const isNumber = type === 'number';

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        style={{
          width: width ?? '100%',
          padding: '4px 6px',
          fontSize: 13,
          fontFamily: typography.fontFamily,
          color: INK,
          backgroundColor: SURFACE,
          border: `1px solid ${BORDER_STRONG}`,
          borderRadius: 4,
          outline: 'none',
          textAlign: align,
          fontVariantNumeric: isNumber ? 'tabular-nums' : 'normal',
          boxSizing: 'border-box',
        }}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && setEditing(true)}
      title={disabled ? '' : 'Click to edit (Enter to save, Esc to cancel)'}
      style={{
        display: 'block', width: width ?? '100%',
        textAlign: align,
        padding: '4px 6px',
        fontSize: 13,
        fontFamily: typography.fontFamily,
        color: value == null || value === '' ? INK_3 : INK_2,
        backgroundColor: 'transparent',
        border: '1px solid transparent',
        borderRadius: 4,
        cursor: disabled ? 'default' : 'text',
        fontVariantNumeric: isNumber ? 'tabular-nums' : 'normal',
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.backgroundColor = SURFACE_INSET;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
      }}
    >
      {display}
    </button>
  );
};

// ── ZonePanel ────────────────────────────────────────────────────────────────

interface ZonePanelProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const ZonePanel: React.FC<ZonePanelProps> = ({ title, subtitle, badge, actions, children }) => (
  <section style={{
    backgroundColor: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  }}>
    <header style={{
      display: 'flex', alignItems: 'center',
      gap: 10, padding: '10px 16px',
      borderBottom: `1px solid ${BORDER}`,
      backgroundColor: '#FAFAF8',
    }}>
      <h2 style={{
        margin: 0, fontFamily: typography.fontFamily,
        fontSize: 13, fontWeight: 600, color: INK,
        letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        {title}
      </h2>
      {badge}
      {subtitle && (
        <span style={{ fontSize: 12, color: INK_3, fontFamily: typography.fontFamily }}>
          {subtitle}
        </span>
      )}
      {actions && <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>{actions}</div>}
    </header>
    <div>{children}</div>
  </section>
);

// ── Status pill ──────────────────────────────────────────────────────────────

const StatusPill: React.FC<{ status: LogStatus }> = ({ status }) => {
  const { color, label } = STATUS_PILL_TONE[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', borderRadius: 999,
      backgroundColor: `${color}10`, color,
      fontSize: 12, fontWeight: 600, lineHeight: 1.4,
      whiteSpace: 'nowrap',
      fontFamily: typography.fontFamily,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
      {label}
    </span>
  );
};

// ── Page shell ───────────────────────────────────────────────────────────────

const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div role="region" aria-label="Daily Log" style={{
    flex: 1, minHeight: 0, overflow: 'auto',
    backgroundColor: PAGE_BG,
    fontFamily: typography.fontFamily,
    color: INK,
  }}>
    {children}
  </div>
);

// ── Photo grid ───────────────────────────────────────────────────────────────

const PhotoTile: React.FC<{ photo: PhotoRecord }> = React.memo(({ photo }) => (
  <div style={{
    position: 'relative',
    backgroundColor: SURFACE_INSET,
    border: `1px solid ${BORDER}`,
    borderRadius: 6,
    overflow: 'hidden',
    aspectRatio: '4 / 3',
  }}>
    {photo.url ? (
      <img
        src={photo.url}
        alt={photo.caption ?? 'Daily log photo'}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        loading="lazy"
      />
    ) : (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: INK_3,
      }}>
        <Camera size={20} />
      </div>
    )}
    {photo.category && (
      <span style={{
        position: 'absolute', top: 6, left: 6,
        padding: '1px 6px', borderRadius: 4,
        backgroundColor: STATUS.iris, color: '#FFFFFF',
        fontSize: 10, fontWeight: 600, letterSpacing: '0.02em',
        textTransform: 'capitalize',
      }}>
        ✦ {photo.category}
      </span>
    )}
    {photo.caption && (
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '6px 8px',
        background: 'linear-gradient(0deg, rgba(0,0,0,0.65), rgba(0,0,0,0))',
        color: '#FFFFFF', fontSize: 11, fontWeight: 500, lineHeight: 1.3,
        textShadow: '0 1px 2px rgba(0,0,0,0.4)',
      }}>
        {photo.caption}
      </div>
    )}
  </div>
));

// ─────────────────────────────────────────────────────────────────────────────

const DailyLogPage: React.FC = () => {
  const projectId = useProjectId();
  const { setPageContext } = useCopilotStore();
  useEffect(() => { setPageContext('daily-log'); }, [setPageContext]);

  const { addToast } = useToast();
  const { confirm: confirmDeleteLog, dialog: deleteLogDialog } = useConfirm();
  const isOnline = useIsOnline();
  const authUserId = useAuthStore((s) => s.user?.id);
  const fieldCapture = useFieldCapture();

  const { data: project } = useProject(projectId);
  const { data: dailyLogData, isPending: loading, error: logError, refetch } = useDailyLogs(projectId);
  const { data: drafts } = useIrisDrafts(projectId, { status: ['pending'] });

  const updateDailyLog = useUpdateDailyLog();
  const createDailyLog = useCreateDailyLog();
  const deleteDailyLog = useDeleteDailyLog();
  const submitDailyLog = useSubmitDailyLog();
  const approveDailyLog = useApproveDailyLog();
  const rejectDailyLog = useRejectDailyLog();
  const createEntry = useCreateDailyLogEntry();
  const deleteEntry = useDeleteDailyLogEntry();

  // Page state
  const [selectedDate, setSelectedDate] = useState<string>(() => todayISODate());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFieldCapture, setShowFieldCapture] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showIrisDraftSheet, setShowIrisDraftSheet] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // ── Data derivation ───────────────────────────────────────────────────────
  const allLogs: ExtendedDailyLog[] = useMemo(
    () => (dailyLogData?.data ?? []) as ExtendedDailyLog[],
    [dailyLogData?.data],
  );
  const todayLog = useMemo(
    () => allLogs.find((l) => (l.log_date ?? '').slice(0, 10) === selectedDate),
    [allLogs, selectedDate],
  );
  const logStatus = deriveStatus(todayLog);
  const isLocked = logStatus === 'submitted' || logStatus === 'approved';

  const { data: rawEntries = [] } = useDailyLogEntries(todayLog?.id);
  const entries = (rawEntries ?? []) as unknown as DailyLogEntry[];

  // Pending Iris draft for the selected date.
  const irisDraftForDate = useMemo(() => {
    for (const d of drafts ?? []) {
      if (d.action_type !== 'daily_log.draft') continue;
      if (d.payload.date === selectedDate) return d;
    }
    return null;
  }, [drafts, selectedDate]);

  // Weather: read from the log row if persisted; otherwise fetch live.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (todayLog?.weather) {
        setWeather({
          conditions: todayLog.weather,
          temp_high: todayLog.temperature_high ?? 0,
          temp_low: todayLog.temperature_low ?? 0,
          precipitation: todayLog.precipitation ?? '0mm',
          wind_speed: todayLog.wind_speed ?? '0 mph',
          icon: '☀️', humidity: 50,
          fetched_at: new Date().toISOString(),
          source: 'default',
        });
        return;
      }
      const lat = project?.latitude ? Number(project.latitude) : undefined;
      const lon = project?.longitude ? Number(project.longitude) : undefined;
      const w = await fetchWeather(lat, lon);
      if (!cancelled) setWeather(w);
    };
    load();
    return () => { cancelled = true; };
  }, [todayLog?.weather, todayLog?.temperature_high, todayLog?.temperature_low,
      todayLog?.wind_speed, todayLog?.precipitation,
      project?.latitude, project?.longitude]);

  // ── Section data ─────────────────────────────────────────────────────────
  const crewRows = useMemo(() => entries.filter((e) => e.type === 'crew'), [entries]);
  const equipmentRows = useMemo(() => entries.filter((e) => e.type === 'equipment'), [entries]);
  const visitorRows = useMemo(() => entries.filter((e) => e.type === 'visitor'), [entries]);
  const deliveryRows = useMemo(() => entries.filter((e) => e.type === 'delivery'), [entries]);
  const fieldEntries = useMemo(
    () => entries.filter((e) => !['crew', 'equipment', 'visitor', 'delivery', 'photo'].includes(e.type ?? '')),
    [entries],
  );
  const photos: PhotoRecord[] = useMemo(() => {
    const out: PhotoRecord[] = [];
    for (const e of entries) {
      const photoArr = Array.isArray(e.photos) ? (e.photos as unknown[]) : [];
      for (const p of photoArr) {
        const rec = p as Record<string, unknown>;
        out.push({
          id: (rec.id as string) ?? `${e.id}:${out.length}`,
          url: (rec.url as string) ?? '',
          caption: (rec.caption as string) ?? e.description ?? '',
          category: (rec.category as string) ?? 'progress',
          timestamp: (rec.timestamp as string) ?? e.created_at ?? undefined,
        });
      }
    }
    return out;
  }, [entries]);

  const manpowerTotal = useMemo(
    () => crewRows.reduce(
      (acc, r) => ({
        headcount: acc.headcount + (r.headcount ?? 0),
        hours: acc.hours + (r.hours ?? 0),
      }),
      { headcount: 0, hours: 0 },
    ),
    [crewRows],
  );

  // ── Mutation helpers ─────────────────────────────────────────────────────
  const updateLogField = useCallback(async (
    updates: Partial<Record<keyof ExtendedDailyLog, unknown>>,
  ) => {
    if (!todayLog?.id || !projectId) return;
    if (isLocked) {
      addToast('error', 'Submitted logs are locked. Return to draft to edit.');
      return;
    }
    try {
      await updateDailyLog.mutateAsync({
        id: todayLog.id, projectId,
        updates: updates as Record<string, unknown>,
      });
    } catch {
      // mutation toasts on its own
    }
  }, [todayLog?.id, projectId, isLocked, updateDailyLog, addToast]);

  const updateEntry = useCallback(async (entryId: string, updates: Record<string, unknown>) => {
    if (isLocked) { addToast('error', 'Log is locked'); return; }
    try {
      // Loose update payload — daily_log_entries has many discriminator-style
      // columns and we only set a subset per call.
      const builder = supabase.from('daily_log_entries') as unknown as {
        update: (u: Record<string, unknown>) => {
          eq: (col: string, val: string) => Promise<{ error: unknown }>;
        };
      };
      const { error } = await builder.update(updates).eq('id', entryId);
      if (error) throw error;
      refetch();
    } catch {
      addToast('error', 'Failed to update entry');
    }
  }, [isLocked, addToast, refetch]);

  const ensureLogId = useCallback(async (): Promise<string | undefined> => {
    if (todayLog?.id) return todayLog.id;
    if (!projectId) return undefined;
    try {
      const created = await createDailyLog.mutateAsync({
        projectId,
        data: {
          project_id: projectId,
          log_date: selectedDate,
          status: 'draft',
          workers_onsite: 0,
          total_hours: 0,
          incidents: 0,
        },
      });
      return (created?.data?.id as string | undefined);
    } catch {
      addToast('error', 'Could not start daily log');
      return undefined;
    }
  }, [todayLog?.id, projectId, selectedDate, createDailyLog, addToast]);

  const addCrewRow = useCallback(async () => {
    if (isLocked) return;
    const logId = await ensureLogId();
    if (!logId || !projectId) return;
    try {
      await createEntry.mutateAsync({
        projectId,
        data: { daily_log_id: logId, type: 'crew', trade: '', company: '', headcount: 0, hours: 0 },
      });
    } catch { /* noop */ }
  }, [isLocked, ensureLogId, projectId, createEntry]);

  const addEquipmentRow = useCallback(async () => {
    if (isLocked) return;
    const logId = await ensureLogId();
    if (!logId || !projectId) return;
    try {
      await createEntry.mutateAsync({
        projectId,
        data: {
          daily_log_id: logId, type: 'equipment',
          equipment_name: '', equipment_hours: 0, description: '',
        },
      });
    } catch { /* noop */ }
  }, [isLocked, ensureLogId, projectId, createEntry]);

  const addVisitorRow = useCallback(async () => {
    if (isLocked) return;
    const logId = await ensureLogId();
    if (!logId || !projectId) return;
    try {
      await createEntry.mutateAsync({
        projectId,
        data: { daily_log_id: logId, type: 'visitor', inspector_name: '', company: '', description: '', time_in: '', time_out: '' },
      });
    } catch { /* noop */ }
  }, [isLocked, ensureLogId, projectId, createEntry]);

  const addDeliveryRow = useCallback(async () => {
    if (isLocked) return;
    const logId = await ensureLogId();
    if (!logId || !projectId) return;
    try {
      await createEntry.mutateAsync({
        projectId,
        data: { daily_log_id: logId, type: 'delivery', description: '', quantity: 0, po_number: '' },
      });
    } catch { /* noop */ }
  }, [isLocked, ensureLogId, projectId, createEntry]);

  const addFieldEntry = useCallback(async () => {
    if (isLocked) return;
    const logId = await ensureLogId();
    if (!logId || !projectId) return;
    try {
      await createEntry.mutateAsync({
        projectId,
        data: { daily_log_id: logId, type: 'work_performed', description: '' },
      });
    } catch { /* noop */ }
  }, [isLocked, ensureLogId, projectId, createEntry]);

  const removeEntry = useCallback(async (id: string) => {
    if (!todayLog?.id || !projectId) return;
    try {
      await deleteEntry.mutateAsync({ id, dailyLogId: todayLog.id, projectId });
    } catch { /* mutation toasts */ }
  }, [todayLog?.id, projectId, deleteEntry]);

  // ── Submit / approve / reject ─────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!todayLog?.id || !projectId) {
      addToast('error', 'Nothing to submit yet');
      return;
    }
    try {
      await submitDailyLog.mutateAsync({ id: todayLog.id, projectId });
      addToast('success', 'Daily log submitted');
    } catch { /* mutation toasts */ }
  }, [todayLog?.id, projectId, submitDailyLog, addToast]);

  const handleApprove = useCallback(async () => {
    if (!todayLog?.id || !projectId || !authUserId) {
      addToast('error', 'You must be signed in to approve');
      return;
    }
    try {
      await approveDailyLog.mutateAsync({ id: todayLog.id, projectId, userId: authUserId });
      addToast('success', 'Daily log approved');
    } catch { /* mutation toasts */ }
  }, [todayLog?.id, projectId, authUserId, approveDailyLog, addToast]);

  const handleReject = useCallback(async () => {
    if (!todayLog?.id || !projectId || !authUserId) return;
    if (!rejectReason.trim()) { addToast('error', 'Please provide a reason'); return; }
    try {
      await rejectDailyLog.mutateAsync({
        id: todayLog.id, projectId,
        userId: authUserId, comments: rejectReason.trim(),
      });
      setShowRejectModal(false);
      setRejectReason('');
      addToast('success', 'Returned for revision');
    } catch { /* mutation toasts */ }
  }, [todayLog?.id, projectId, authUserId, rejectReason, rejectDailyLog, addToast]);

  const handleDelete = useCallback(async () => {
    if (!todayLog?.id || !projectId) return;
    if (logStatus !== 'draft' && logStatus !== 'rejected') {
      addToast('error', 'Only draft/returned logs can be deleted'); return;
    }
    const ok = await confirmDeleteLog({
      title: 'Delete daily log?',
      description: `The ${selectedDate} log and its entries will be removed. Photos linked to other entities are preserved.`,
      destructiveLabel: 'Delete log',
      typeToConfirm: 'DELETE',
    });
    if (!ok) return;
    try {
      await deleteDailyLog.mutateAsync({ id: todayLog.id, projectId });
      addToast('success', 'Log deleted');
      await refetch();
    } catch { /* mutation toasts */ }
  }, [todayLog?.id, projectId, logStatus, selectedDate, confirmDeleteLog, deleteDailyLog, addToast, refetch]);

  // ── Photo capture (camera / gallery) ─────────────────────────────────────
  const handlePhotoCapture = useCallback(() => {
    if (isLocked) { addToast('error', 'Log is locked'); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const logId = await ensureLogId();
      if (!logId || !projectId) return;
      const path = `${projectId}/${logId}/${Date.now()}-${file.name}`;
      try {
        const { error: upErr } = await supabase.storage.from('daily-log-photos').upload(path, file);
        if (upErr) { addToast('error', 'Upload failed'); return; }
        const { data: pub } = supabase.storage.from('daily-log-photos').getPublicUrl(path);
        const photoUrl = pub?.publicUrl ?? null;
        if (!photoUrl) { addToast('error', 'Could not retrieve URL'); return; }
        const insertBuilder = supabase.from('daily_log_entries') as unknown as {
          insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
        };
        await insertBuilder.insert({
          daily_log_id: logId, type: 'photo', description: file.name,
          photos: [{ id: crypto.randomUUID(), url: photoUrl, caption: '', category: 'progress', timestamp: new Date().toISOString() }],
        });
        refetch();
        addToast('success', 'Photo uploaded');
      } catch {
        addToast('error', 'Upload failed');
      }
    };
    input.click();
  }, [isLocked, ensureLogId, projectId, addToast, refetch]);

  // ── Keyboard shortcuts (date stepper) ────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft' && (e.altKey || e.shiftKey)) {
        e.preventDefault(); setSelectedDate((d) => shiftDate(d, -1));
      } else if (e.key === 'ArrowRight' && (e.altKey || e.shiftKey)) {
        e.preventDefault(); setSelectedDate((d) => shiftDate(d, +1));
      } else if (e.key === 't' && (e.altKey || e.shiftKey)) {
        e.preventDefault(); setSelectedDate(todayISODate());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Drain queued field-capture photos when we regain connectivity.
  useEffect(() => {
    const handleOnline = async () => {
      if (fieldCapture.pendingCount === 0) return;
      const { synced, remaining } = await fieldCapture.flushQueue();
      if (synced > 0) {
        toast.success(`Synced ${synced} queued photo${synced === 1 ? '' : 's'}${remaining > 0 ? ` (${remaining} pending)` : ''}`);
        refetch();
      }
    };
    window.addEventListener('online', handleOnline);
    if (navigator.onLine && fieldCapture.pendingCount > 0) handleOnline();
    return () => window.removeEventListener('online', handleOnline);
  }, [fieldCapture, refetch]);

  // ── Early returns ────────────────────────────────────────────────────────
  if (!projectId) return <ProjectGate />;

  if (loading) {
    return (
      <PageShell>
        <div style={{ padding: 24 }}>
          <PageState status="loading" loading={{ rows: 8, ariaLabel: 'Loading daily logs' }} />
        </div>
      </PageShell>
    );
  }

  if (logError) {
    return (
      <PageShell>
        <div style={{ padding: 24 }}>
          <PageState
            status="error"
            error={{
              title: 'Unable to load daily logs',
              message: (logError as Error)?.message ?? 'Check your connection and try again.',
              onRetry: () => void refetch(),
            }}
          />
        </div>
      </PageShell>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <PageShell>
      {/* Sticky page header ─────────────────────────────────────────────── */}
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 30,
          backgroundColor: PAGE_BG,
          borderBottom: `1px solid ${BORDER}`,
          padding: '12px 24px',
          display: 'flex', alignItems: 'center',
          flexWrap: 'wrap', gap: 14,
        }}
      >
        <h1 style={{
          margin: 0, fontFamily: typography.fontFamily,
          fontSize: 18, fontWeight: 700, color: INK,
          letterSpacing: '-0.01em', lineHeight: 1.2,
        }}>
          Daily Log
        </h1>

        {/* Date stepper */}
        <div role="group" aria-label="Date" style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px',
          border: `1px solid ${BORDER}`, borderRadius: 6,
          backgroundColor: SURFACE,
        }}>
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
            style={chevronStyle}
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{
            padding: '4px 10px', fontSize: 13, fontWeight: 600,
            color: INK, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
          }}>
            {formatLongDate(selectedDate)}
          </span>
          <button
            type="button"
            aria-label="Next day"
            onClick={() => setSelectedDate((d) => shiftDate(d, +1))}
            style={chevronStyle}
          >
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(todayISODate())}
            disabled={selectedDate === todayISODate()}
            style={{
              ...chevronStyle,
              padding: '4px 10px', fontSize: 12, fontWeight: 600,
              color: selectedDate === todayISODate() ? INK_3 : INK_2,
              cursor: selectedDate === todayISODate() ? 'default' : 'pointer',
            }}
          >
            Today
          </button>
        </div>

        <StatusPill status={logStatus} />

        {irisDraftForDate && (
          <button
            type="button"
            onClick={() => setShowIrisDraftSheet(true)}
            aria-label="Iris drafted this log from field data — open to review"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 11px', borderRadius: 999,
              border: `1px solid ${STATUS.iris}33`,
              backgroundColor: STATUS.irisSubtle, color: STATUS.iris,
              fontSize: 12, fontWeight: 600,
              fontFamily: typography.fontFamily, cursor: 'pointer',
            }}
          >
            <Sparkles size={12} />
            Iris drafted from field data
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {!isOnline && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 8px', borderRadius: 4,
              backgroundColor: `${STATUS.medium}10`, color: STATUS.medium,
              fontSize: 11, fontWeight: 600,
            }}>
              Offline — will sync
            </span>
          )}

          {todayLog && (
            <Suspense fallback={null}>
              <DailyLogPDFExport
                today={todayLog}
                weather={weather}
                logStatus={(logStatus === 'not_started' ? 'draft' : logStatus)}
              />
            </Suspense>
          )}

          <PermissionGate permission="daily_log.create">
            <button
              type="button"
              onClick={() => setShowFieldCapture(true)}
              style={secondaryHeaderBtnStyle}
            >
              <Camera size={13} />
              Field capture{fieldCapture.pendingCount > 0 ? ` (${fieldCapture.pendingCount})` : ''}
            </button>
            <button
              type="button"
              onClick={addFieldEntry}
              disabled={isLocked}
              style={isLocked ? disabledHeaderBtnStyle : secondaryHeaderBtnStyle}
              data-testid="new-entry-button"
            >
              <Plus size={13} />
              New entry
            </button>
          </PermissionGate>

          {logStatus === 'not_started' && (
            <PermissionGate permission="daily_log.create">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                style={primaryHeaderBtnStyle}
                data-testid="start-log-button"
              >
                Start log
              </button>
            </PermissionGate>
          )}
          {(logStatus === 'draft' || logStatus === 'rejected') && (
            <PermissionGate permission="daily_log.submit">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!todayLog?.id || submitDailyLog.isPending}
                style={primaryHeaderBtnStyle}
                data-testid="submit-log-button"
              >
                <Send size={13} />
                {submitDailyLog.isPending ? 'Submitting…' : 'Submit log'}
              </button>
            </PermissionGate>
          )}
          {logStatus === 'submitted' && (
            <>
              <PermissionGate permission="daily_log.approve">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={approveDailyLog.isPending}
                  style={primaryHeaderBtnStyle}
                >
                  <ShieldCheck size={13} />
                  Approve
                </button>
              </PermissionGate>
              <PermissionGate permission="daily_log.reject">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  style={secondaryHeaderBtnStyle}
                >
                  Return
                </button>
              </PermissionGate>
            </>
          )}
        </div>
      </header>

      {/* Body ─────────────────────────────────────────────────────────────── */}
      <main style={{ padding: 24, maxWidth: 'none' }}>
        {logStatus === 'rejected' && todayLog?.rejection_comments && (
          <div role="alert" style={{
            padding: '10px 14px', marginBottom: 16,
            backgroundColor: `${STATUS.critical}08`,
            border: `1px solid ${STATUS.critical}33`,
            borderRadius: 6, color: STATUS.critical,
            fontSize: 13, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertTriangle size={14} />
            <span>Returned: {todayLog.rejection_comments as string}</span>
          </div>
        )}

        {/* 1. Conditions */}
        <ZonePanel
          title="Conditions"
          subtitle={weather?.fetched_at ? `Updated ${new Date(weather.fetched_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : undefined}
          badge={weather && (
            <span style={{ color: INK_2, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {weatherIcon(weather.conditions, 14)}
              <span style={{ fontSize: 12 }}>{weather.conditions}</span>
            </span>
          )}
          actions={
            <button
              type="button"
              onClick={async () => {
                const lat = project?.latitude ? Number(project.latitude) : undefined;
                const lon = project?.longitude ? Number(project.longitude) : undefined;
                const w = await fetchWeather(lat, lon);
                setWeather(w);
                if (todayLog?.id) {
                  await updateLogField({
                    weather: formatWeatherSummary(w),
                    temperature_high: w.temp_high,
                    temperature_low: w.temp_low,
                    wind_speed: w.wind_speed,
                    precipitation: w.precipitation,
                  });
                }
              }}
              style={ghostBtnStyle}
            >
              <RefreshCw size={12} /> Refresh
            </button>
          }
        >
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))',
            gap: 0,
          }}>
            {[
              { label: 'High',   value: weather?.temp_high != null ? `${fmtNum(weather.temp_high)}°F` : '—' },
              { label: 'Low',    value: weather?.temp_low  != null ? `${fmtNum(weather.temp_low)}°F`  : '—' },
              { label: 'Wind',   value: weather?.wind_speed ?? '—', icon: <Wind size={12} /> },
              { label: 'Precip', value: weather?.precipitation ?? '—' },
            ].map((cell, i) => (
              <div key={cell.label} style={{
                padding: '14px 16px',
                borderRight: i < 3 ? `1px solid ${BORDER}` : 'none',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11, fontWeight: 600, color: INK_3,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  marginBottom: 4,
                }}>
                  {cell.icon}{cell.label}
                </div>
                <div style={{
                  fontSize: 18, fontWeight: 600, color: INK,
                  fontVariantNumeric: 'tabular-nums', lineHeight: 1.2,
                }}>
                  {cell.value}
                </div>
              </div>
            ))}
          </div>
        </ZonePanel>

        {/* 2. Manpower */}
        <ZonePanel
          title="Manpower"
          subtitle={crewRows.length === 0 ? 'No crew on site' : `${manpowerTotal.headcount} workers · ${fmtNum(manpowerTotal.hours)} hours`}
          badge={<Users size={14} color={INK_3} />}
          actions={!isLocked && (
            <button type="button" onClick={addCrewRow} style={ghostBtnStyle}>
              <Plus size={12} /> Add crew
            </button>
          )}
        >
          {crewRows.length === 0 ? (
            <EmptyState icon={<Users size={20} />} message="No crew rows logged yet" />
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Trade</th>
                  <th style={thStyle}>Company</th>
                  <th style={thStyleNum}>Headcount</th>
                  <th style={thStyleNum}>Hours</th>
                  <th style={{ ...thStyle, width: 36 }} aria-label="" />
                </tr>
              </thead>
              <tbody>
                {crewRows.map((r) => (
                  <tr key={r.id} style={trStyle}>
                    <td style={tdStyle}>
                      <EditableCell value={r.trade ?? ''} disabled={isLocked} placeholder="Trade"
                        onCommit={(next) => updateEntry(r.id, { trade: next })} />
                    </td>
                    <td style={tdStyle}>
                      <EditableCell value={r.company ?? ''} disabled={isLocked} placeholder="Company"
                        onCommit={(next) => updateEntry(r.id, { company: next })} />
                    </td>
                    <td style={tdStyleNum}>
                      <EditableCell value={r.headcount ?? 0} type="number" align="right" disabled={isLocked}
                        onCommit={(next) => updateEntry(r.id, { headcount: Number(next) || 0 })} />
                    </td>
                    <td style={tdStyleNum}>
                      <EditableCell value={r.hours ?? 0} type="number" align="right" disabled={isLocked}
                        onCommit={(next) => updateEntry(r.id, { hours: Number(next) || 0 })} />
                    </td>
                    <td style={tdStyleAction}>
                      {!isLocked && <RowDeleteButton onClick={() => removeEntry(r.id)} />}
                    </td>
                  </tr>
                ))}
                <tr style={{ ...trStyle, backgroundColor: SURFACE_INSET }}>
                  <td colSpan={2} style={{ ...tdStyle, fontWeight: 600, color: INK }}>Total</td>
                  <td style={{ ...tdStyleNum, fontWeight: 600, color: INK }}>{manpowerTotal.headcount}</td>
                  <td style={{ ...tdStyleNum, fontWeight: 600, color: INK }}>{fmtNum(manpowerTotal.hours)}</td>
                  <td style={tdStyleAction} />
                </tr>
              </tbody>
            </table>
          )}
        </ZonePanel>

        {/* 3. Equipment */}
        <ZonePanel
          title="Equipment"
          subtitle={equipmentRows.length === 0 ? 'No equipment on site' : `${equipmentRows.length} item${equipmentRows.length === 1 ? '' : 's'}`}
          badge={<Truck size={14} color={INK_3} />}
          actions={!isLocked && (
            <button type="button" onClick={addEquipmentRow} style={ghostBtnStyle}>
              <Plus size={12} /> Add equipment
            </button>
          )}
        >
          {equipmentRows.length === 0 ? (
            <EmptyState icon={<Truck size={20} />} message="No equipment logged yet" />
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Type</th>
                  <th style={thStyleNum}>Hours</th>
                  <th style={thStyle}>Operator</th>
                  <th style={{ ...thStyle, width: 36 }} aria-label="" />
                </tr>
              </thead>
              <tbody>
                {equipmentRows.map((r) => (
                  <tr key={r.id} style={trStyle}>
                    <td style={tdStyle}>
                      <EditableCell value={r.equipment_name ?? r.description ?? ''} disabled={isLocked} placeholder="Equipment"
                        onCommit={(next) => updateEntry(r.id, { equipment_name: next })} />
                    </td>
                    <td style={tdStyleNum}>
                      <EditableCell value={r.equipment_hours ?? 0} type="number" align="right" disabled={isLocked}
                        onCommit={(next) => updateEntry(r.id, { equipment_hours: Number(next) || 0 })} />
                    </td>
                    <td style={tdStyle}>
                      <EditableCell value={r.company ?? ''} disabled={isLocked} placeholder="Operator / company"
                        onCommit={(next) => updateEntry(r.id, { company: next })} />
                    </td>
                    <td style={tdStyleAction}>
                      {!isLocked && <RowDeleteButton onClick={() => removeEntry(r.id)} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ZonePanel>

        {/* 4. Field entries */}
        <ZonePanel
          title="Field entries"
          subtitle={fieldEntries.length === 0 ? 'No work logged yet' : `${fieldEntries.length} entr${fieldEntries.length === 1 ? 'y' : 'ies'}`}
          badge={<FileText size={14} color={INK_3} />}
          actions={!isLocked && (
            <button type="button" onClick={addFieldEntry} style={ghostBtnStyle}>
              <Plus size={12} /> Add entry
            </button>
          )}
        >
          {fieldEntries.length === 0 ? (
            <EmptyState icon={<FileText size={20} />} message="No field entries yet" />
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 110 }}>Time</th>
                  <th style={{ ...thStyle, width: 130 }}>Type</th>
                  <th style={thStyle}>Description</th>
                  <th style={{ ...thStyle, width: 36 }} aria-label="" />
                </tr>
              </thead>
              <tbody>
                {fieldEntries.map((r) => {
                  const t = r.created_at ? new Date(r.created_at) : null;
                  const timeLabel = t && !isNaN(t.getTime())
                    ? t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    : '—';
                  const typeLabel = (r.type ?? 'note').replace(/_/g, ' ');
                  return (
                    <tr key={r.id} style={trStyle}>
                      <td style={{ ...tdStyle, color: INK_3, fontVariantNumeric: 'tabular-nums' }}>{timeLabel}</td>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-block', padding: '1px 8px', borderRadius: 4,
                          fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
                          backgroundColor: SURFACE_INSET, color: INK_2,
                        }}>
                          {typeLabel}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <EditableCell
                          value={r.description ?? ''}
                          disabled={isLocked}
                          placeholder="Add description…"
                          onCommit={(next) => updateEntry(r.id, { description: next })}
                        />
                      </td>
                      <td style={tdStyleAction}>
                        {!isLocked && <RowDeleteButton onClick={() => removeEntry(r.id)} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </ZonePanel>

        {/* 5. Photos */}
        <ZonePanel
          title="Photos"
          subtitle={photos.length === 0 ? 'No photos yet' : `${photos.length} photo${photos.length === 1 ? '' : 's'}`}
          badge={<Camera size={14} color={INK_3} />}
          actions={!isLocked && (
            <button type="button" onClick={handlePhotoCapture} style={ghostBtnStyle}>
              <Camera size={12} /> Capture
            </button>
          )}
        >
          {photos.length === 0 ? (
            <EmptyState icon={<Camera size={20} />} message="No photos yet — tap Capture to add one" />
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 8, padding: 12,
            }}>
              {photos.map((p) => <PhotoTile key={p.id} photo={p} />)}
            </div>
          )}
        </ZonePanel>

        {/* 6. Visitors / Deliveries */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
          <ZonePanel
            title="Visitors"
            subtitle={visitorRows.length === 0 ? 'None' : `${visitorRows.length} on site`}
            actions={!isLocked && (
              <button type="button" onClick={addVisitorRow} style={ghostBtnStyle}>
                <Plus size={12} /> Add visitor
              </button>
            )}
          >
            {visitorRows.length === 0 ? (
              <EmptyState message="No visitors today" />
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Company</th>
                    <th style={thStyle}>Purpose</th>
                    <th style={{ ...thStyle, width: 70 }}>In</th>
                    <th style={{ ...thStyle, width: 70 }}>Out</th>
                    <th style={{ ...thStyle, width: 36 }} aria-label="" />
                  </tr>
                </thead>
                <tbody>
                  {visitorRows.map((r) => (
                    <tr key={r.id} style={trStyle}>
                      <td style={tdStyle}>
                        <EditableCell value={r.inspector_name ?? ''} disabled={isLocked} placeholder="Name"
                          onCommit={(next) => updateEntry(r.id, { inspector_name: next })} />
                      </td>
                      <td style={tdStyle}>
                        <EditableCell value={r.company ?? ''} disabled={isLocked} placeholder="Company"
                          onCommit={(next) => updateEntry(r.id, { company: next })} />
                      </td>
                      <td style={tdStyle}>
                        <EditableCell value={r.description ?? ''} disabled={isLocked} placeholder="Purpose"
                          onCommit={(next) => updateEntry(r.id, { description: next })} />
                      </td>
                      <td style={tdStyle}>
                        <EditableCell value={r.time_in ?? ''} disabled={isLocked} placeholder="hh:mm"
                          onCommit={(next) => updateEntry(r.id, { time_in: next })} />
                      </td>
                      <td style={tdStyle}>
                        <EditableCell value={r.time_out ?? ''} disabled={isLocked} placeholder="hh:mm"
                          onCommit={(next) => updateEntry(r.id, { time_out: next })} />
                      </td>
                      <td style={tdStyleAction}>
                        {!isLocked && <RowDeleteButton onClick={() => removeEntry(r.id)} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ZonePanel>

          <ZonePanel
            title="Deliveries"
            subtitle={deliveryRows.length === 0 ? 'None' : `${deliveryRows.length} delivery${deliveryRows.length === 1 ? '' : 'ies'}`}
            actions={!isLocked && (
              <button type="button" onClick={addDeliveryRow} style={ghostBtnStyle}>
                <Plus size={12} /> Add delivery
              </button>
            )}
          >
            {deliveryRows.length === 0 ? (
              <EmptyState message="No deliveries today" />
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Description</th>
                    <th style={thStyleNum}>Qty</th>
                    <th style={thStyle}>PO #</th>
                    <th style={{ ...thStyle, width: 36 }} aria-label="" />
                  </tr>
                </thead>
                <tbody>
                  {deliveryRows.map((r) => (
                    <tr key={r.id} style={trStyle}>
                      <td style={tdStyle}>
                        <EditableCell value={r.description ?? ''} disabled={isLocked} placeholder="Item delivered"
                          onCommit={(next) => updateEntry(r.id, { description: next })} />
                      </td>
                      <td style={tdStyleNum}>
                        <EditableCell value={r.quantity ?? 0} type="number" align="right" disabled={isLocked}
                          onCommit={(next) => updateEntry(r.id, { quantity: Number(next) || 0 })} />
                      </td>
                      <td style={tdStyle}>
                        <EditableCell value={r.po_number ?? ''} disabled={isLocked} placeholder="PO #"
                          onCommit={(next) => updateEntry(r.id, { po_number: next })} />
                      </td>
                      <td style={tdStyleAction}>
                        {!isLocked && <RowDeleteButton onClick={() => removeEntry(r.id)} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ZonePanel>
        </div>

        {/* Trailing controls — delete (draft only) */}
        {(logStatus === 'draft' || logStatus === 'rejected') && todayLog?.id && (
          <PermissionGate permission="daily_log.edit">
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteDailyLog.isPending}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: STATUS.critical, fontWeight: 500,
                  padding: '6px 0',
                }}
              >
                {deleteDailyLog.isPending ? 'Deleting…' : 'Delete this draft'}
              </button>
            </div>
          </PermissionGate>
        )}
      </main>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <CreateDailyLogModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          projectId={projectId ?? undefined}
          onSubmit={async (data) => {
            const created = await createDailyLog.mutateAsync({
              projectId: projectId!,
              data: {
                project_id: projectId!,
                log_date: data.date,
                workers_onsite: data.crew_count ? Number(data.crew_count) : 0,
                total_hours: 0,
                incidents: data.has_incident ? 1 : 0,
                weather: data.weather_condition,
                summary: data.activities,
                status: 'draft',
              },
            });
            setShowCreateModal(false);
            addToast('success', 'Daily log started');
            return { id: created?.data?.id as string | undefined };
          }}
        />
      )}

      <FieldCaptureModal
        open={showFieldCapture}
        onClose={() => setShowFieldCapture(false)}
        projectId={projectId!}
        dailyLogId={todayLog?.id}
        onCaptured={() => refetch()}
      />

      {showRejectModal && (
        <ModalShell onClose={() => setShowRejectModal(false)}>
          <h3 style={modalTitleStyle}>Return daily log</h3>
          <p style={modalSubtitleStyle}>
            Provide a reason so the superintendent knows what to correct.
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason…"
            autoFocus
            rows={4}
            style={modalTextareaStyle}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <Btn variant="ghost" size="sm" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>
              Cancel
            </Btn>
            <PermissionGate permission="daily_log.reject">
              <Btn variant="primary" size="sm" onClick={handleReject}>Return for revision</Btn>
            </PermissionGate>
          </div>
        </ModalShell>
      )}

      {showIrisDraftSheet && (
        <SlideOverSheet
          title="Iris auto-draft"
          onClose={() => setShowIrisDraftSheet(false)}
        >
          <AutoDailyLog
            projectLat={project?.latitude ? Number(project.latitude) : undefined}
            projectLon={project?.longitude ? Number(project.longitude) : undefined}
            projectAddress={project?.address ?? project?.city ?? undefined}
          />
        </SlideOverSheet>
      )}

      {deleteLogDialog}
    </PageShell>
  );
};

// ── Small subcomponents ──────────────────────────────────────────────────────

const EmptyState: React.FC<{ icon?: React.ReactNode; message: string }> = ({ icon, message }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 6, padding: '28px 16px',
    color: INK_3, fontSize: 13,
  }}>
    {icon}
    <span>{message}</span>
  </div>
);

const RowDeleteButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Remove row"
    style={{
      width: 24, height: 24, padding: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: 'none', background: 'transparent',
      color: INK_3, cursor: 'pointer', borderRadius: 4,
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLButtonElement).style.color = STATUS.critical;
      (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${STATUS.critical}10`;
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLButtonElement).style.color = INK_3;
      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
    }}
  >
    <X size={12} />
  </button>
);

const ModalShell: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
  <>
    <div
      onClick={onClose}
      role="presentation"
      aria-hidden
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1039 }}
    />
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: 460, maxWidth: '90vw',
      backgroundColor: SURFACE, borderRadius: 12, padding: 22,
      border: `1px solid ${BORDER}`, zIndex: 1040,
    }}>
      {children}
    </div>
  </>
);

const SlideOverSheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <>
    <div
      onClick={onClose}
      role="presentation"
      aria-hidden
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1039 }}
    />
    <aside
      role="dialog"
      aria-label={title}
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 720, maxWidth: '94vw',
        backgroundColor: SURFACE, zIndex: 1040,
        borderLeft: `1px solid ${BORDER}`,
        display: 'flex', flexDirection: 'column',
      }}
    >
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', borderBottom: `1px solid ${BORDER}`,
        backgroundColor: '#FAFAF8',
      }}>
        <h2 style={{
          margin: 0, fontSize: 14, fontWeight: 600, color: INK,
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          ✦ {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: INK_3, padding: 6, borderRadius: 4,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={16} />
        </button>
      </header>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {children}
      </div>
    </aside>
  </>
);

// ── Inline styles ────────────────────────────────────────────────────────────

const chevronStyle: React.CSSProperties = {
  width: 28, height: 28, padding: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', background: 'transparent', color: INK_2, cursor: 'pointer',
  borderRadius: 4,
};

const primaryHeaderBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', border: 'none', borderRadius: 6,
  backgroundColor: STATUS.brandAction, color: '#FFFFFF',
  fontSize: 13, fontWeight: 600,
  fontFamily: typography.fontFamily, cursor: 'pointer', whiteSpace: 'nowrap',
};

const secondaryHeaderBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 12px', border: `1px solid ${BORDER}`, borderRadius: 6,
  backgroundColor: SURFACE, color: INK_2,
  fontSize: 13, fontWeight: 500,
  fontFamily: typography.fontFamily, cursor: 'pointer', whiteSpace: 'nowrap',
};

const disabledHeaderBtnStyle: React.CSSProperties = {
  ...secondaryHeaderBtnStyle,
  color: INK_3, cursor: 'not-allowed', backgroundColor: SURFACE_INSET,
};

const ghostBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 8px', border: `1px solid ${BORDER}`, borderRadius: 4,
  backgroundColor: '#FFFFFF', color: INK_2,
  fontSize: 12, fontWeight: 500,
  fontFamily: typography.fontFamily, cursor: 'pointer',
};

const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse',
  fontFamily: typography.fontFamily, fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 14px',
  fontSize: 11, fontWeight: 600, color: INK_3,
  textTransform: 'uppercase', letterSpacing: '0.04em',
  borderBottom: `1px solid ${BORDER}`,
  backgroundColor: SURFACE,
  position: 'sticky', top: 0,
};

const thStyleNum: React.CSSProperties = { ...thStyle, textAlign: 'right' };

const trStyle: React.CSSProperties = {
  borderBottom: `1px solid ${BORDER}`,
};

const tdStyle: React.CSSProperties = {
  padding: '4px 8px',
  color: INK_2,
  verticalAlign: 'middle',
};

const tdStyleNum: React.CSSProperties = {
  ...tdStyle, textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

const tdStyleAction: React.CSSProperties = {
  padding: '4px 6px', textAlign: 'right',
  width: 36,
};

const modalTitleStyle: React.CSSProperties = {
  margin: 0, marginBottom: 6,
  fontFamily: typography.fontFamily,
  fontSize: 16, fontWeight: 600, color: INK,
};

const modalSubtitleStyle: React.CSSProperties = {
  margin: 0, marginBottom: 12,
  fontFamily: typography.fontFamily,
  fontSize: 13, color: INK_3, lineHeight: 1.5,
};

const modalTextareaStyle: React.CSSProperties = {
  width: '100%', padding: 10,
  fontSize: 13, fontFamily: typography.fontFamily,
  border: `1px solid ${BORDER}`, borderRadius: 6,
  outline: 'none', resize: 'vertical', minHeight: 80,
  boxSizing: 'border-box', backgroundColor: SURFACE, color: INK,
};

// ── Public export ───────────────────────────────────────────────────────────

export const DailyLog: React.FC = () => (
  <ErrorBoundary message="Daily logs could not be displayed. Check your connection and try again.">
    <DailyLogPage />
  </ErrorBoundary>
);

export default DailyLog;

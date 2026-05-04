/**
 * The Field — "What happened on site today?"
 *
 * Shape: Stream — a river of entries, date as the spine.
 * Absorbs: Daily Log, Punch List, Safety, Photos, Deliveries.
 *
 * The Field is mobile-first. The phone is the primary instrument;
 * the desktop is the archive. Structured views inside one stream:
 * punch items are checklists, safety logs are OSHA forms,
 * daily reports are signable documents.
 *
 * The orange dot is on the entry waiting on you.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ProjectGate } from '../../components/ProjectGate';
import { PageState } from '../../components/shared/PageState';
import { useCopilotStore } from '../../stores/copilotStore';
import { useProjectId } from '../../hooks/useProjectId';
import { useProject, useDailyLogs, usePunchItems, useFieldCaptures, useIncidents } from '../../hooks/queries';

import { useIsOnline } from '../../hooks/useOfflineStatus';
import { useIsMobile } from '../../hooks/useWindowSize';
import { colors, typography, transitions } from '../../styles/theme';
import {
  OrangeDot,
  Eyebrow,
} from '../../components/atoms';
import { CalendarNav } from '../../components/dailylog/CalendarNav';
import {
  BookOpen, CheckSquare, Shield, Image, Truck,
  WifiOff, Plus, ChevronRight, Users, Clock, AlertTriangle,
  MapPin, Calendar,
} from 'lucide-react';
import { FieldCaptureModal } from '../../components/field-capture/FieldCaptureModal';

import { useUpdatePunchItem } from '../../hooks/mutations/punch-items';

// ── View Types ──────────────────────────────────────────────

type FieldView = 'stream' | 'daily-log' | 'punch' | 'safety' | 'photos';

interface ViewTab {
  id: FieldView;
  label: string;
  icon: React.ElementType;
}

const VIEW_TABS: ViewTab[] = [
  { id: 'stream', label: 'All', icon: BookOpen },
  { id: 'daily-log', label: 'Daily Log', icon: BookOpen },
  { id: 'punch', label: 'Punch', icon: CheckSquare },
  { id: 'safety', label: 'Safety', icon: Shield },
  { id: 'photos', label: 'Photos', icon: Image },
];

// ── Stream Entry ────────────────────────────────────────────
// A unified shape for every entry in the river.

interface StreamEntry {
  id: string;
  type: 'daily-log' | 'punch' | 'safety' | 'photo' | 'delivery';
  timestamp: string;
  title: string;
  subtitle?: string;
  status?: string;
  needsAttention?: boolean;
  assignee?: string;
  data: Record<string, unknown>;
}

// ── The Field Page ──────────────────────────────────────────

const FieldPage: React.FC = () => {
  const projectId = useProjectId();
  const { data: project } = useProject(projectId);
  const { setPageContext } = useCopilotStore();
  const isMobile = useIsMobile();
  const isOnline = useIsOnline();


  useEffect(() => { setPageContext('field'); }, [setPageContext]);

  const [activeView, setActiveView] = useState<FieldView>('stream');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [showCapture, setShowCapture] = useState(false);

  // ── Data ────────────────────────────────────────────────
  const { data: dailyLogData, isPending: logsLoading } = useDailyLogs(projectId);
  const { data: punchData, isPending: punchLoading } = usePunchItems(projectId);
  const { data: fieldCaptures, isPending: capturesLoading } = useFieldCaptures(projectId);
  const { data: incidents, isPending: incidentsLoading } = useIncidents(projectId);

  const dailyLogs = useMemo(() => (dailyLogData?.data ?? []) as unknown as Record<string, unknown>[], [dailyLogData]);
  const punchItems = useMemo(() => (punchData?.data ?? []) as unknown as Record<string, unknown>[], [punchData]);
  const photos = useMemo(() => (fieldCaptures ?? []) as unknown as Record<string, unknown>[], [fieldCaptures]);
  const safetyIncidents = useMemo(() => (incidents ?? []) as unknown as Record<string, unknown>[], [incidents]);

  // ── Build unified stream ────────────────────────────────
  const streamEntries = useMemo<StreamEntry[]>(() => {
    const entries: StreamEntry[] = [];

    // Daily logs → stream entries
    for (const log of dailyLogs) {
      entries.push({
        id: `dl-${log.id}`,
        type: 'daily-log',
        timestamp: (log.log_date as string) ?? (log.date as string) ?? '',
        title: 'Daily Log',
        subtitle: (log.summary as string) ?? (log.work_performed as string) ?? 'No summary',
        status: (log.status as string) ?? 'draft',
        needsAttention: (log.status as string) === 'draft',
        data: log,
      });
    }

    // Punch items → stream entries
    for (const item of punchItems) {
      const needsAttention =
        (item.verification_status as string) === 'open' ||
        (item.verification_status as string) === 'in_progress';
      entries.push({
        id: `pi-${item.id}`,
        type: 'punch',
        timestamp: (item.createdDate as string) ?? (item.created_at as string) ?? '',
        title: `${item.itemNumber ?? 'PL'} — ${item.area ?? 'No area'}`,
        subtitle: item.description as string,
        status: item.verification_status as string,
        needsAttention,
        assignee: item.assigned as string,
        data: item,
      });
    }

    // Safety incidents → stream entries
    for (const inc of safetyIncidents) {
      entries.push({
        id: `si-${inc.id}`,
        type: 'safety',
        timestamp: (inc.date as string) ?? (inc.created_at as string) ?? '',
        title: (inc.title as string) ?? (inc.type as string) ?? 'Safety Incident',
        subtitle: (inc.description as string) ?? '',
        status: (inc.status as string) ?? (inc.severity as string) ?? 'reported',
        needsAttention: (inc.status as string) === 'open' || (inc.severity as string) === 'critical',
        data: inc,
      });
    }

    // Field captures (photos) → stream entries
    for (const cap of photos) {
      entries.push({
        id: `fc-${cap.id}`,
        type: 'photo',
        timestamp: (cap.created_at as string) ?? '',
        title: (cap.caption as string) ?? (cap.label as string) ?? 'Field Photo',
        subtitle: (cap.location_description as string) ?? (cap.area as string) ?? '',
        status: (cap.status as string),
        needsAttention: false,
        data: cap,
      });
    }

    // Sort by timestamp descending (most recent first)
    entries.sort((a, b) => {
      const da = new Date(a.timestamp).getTime() || 0;
      const db = new Date(b.timestamp).getTime() || 0;
      return db - da;
    });

    return entries;
  }, [dailyLogs, punchItems, safetyIncidents, photos]);

  // ── Filter by active view ───────────────────────────────
  const filteredEntries = useMemo(() => {
    if (activeView === 'stream') return streamEntries;
    return streamEntries.filter((e) => {
      if (activeView === 'daily-log') return e.type === 'daily-log';
      if (activeView === 'punch') return e.type === 'punch';
      if (activeView === 'safety') return e.type === 'safety';
      if (activeView === 'photos') return e.type === 'photo';
      return true;
    });
  }, [streamEntries, activeView]);

  // ── Group entries by date ───────────────────────────────
  const groupedByDate = useMemo(() => {
    const groups: Record<string, StreamEntry[]> = {};
    for (const entry of filteredEntries) {
      const dateKey = entry.timestamp?.split('T')[0] ?? 'unknown';
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(entry);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredEntries]);

  const isLoading = logsLoading || punchLoading || capturesLoading || incidentsLoading;

  // ── Count items needing attention ───────────────────────
  const attentionCount = useMemo(
    () => streamEntries.filter((e) => e.needsAttention).length,
    [streamEntries]
  );

  // No project selected → show the shared project picker
  if (!projectId) return <ProjectGate />;

  return (
      <ErrorBoundary>
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            minHeight: 0,
            backgroundColor: colors.parchment,
          }}
        >
          <div
            style={{
              maxWidth: 1080,
              margin: '0 auto',
              padding: isMobile ? '16px 16px 0' : '36px 36px 0',
            }}
          >
            {/* ── Compact Header ──────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: typography.fontFamilySerif, fontSize: isMobile ? '20px' : '24px', color: colors.ink, lineHeight: 1.2 }}>
                  The Field
                </span>
                <span style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink4 }}>
                  {project?.name ?? 'Project'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '12px', fontFamily: typography.fontFamily, color: colors.ink4 }}>
                {!isOnline && <WifiOff size={11} />}
                {attentionCount > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: colors.ink2 }}>
                    <OrangeDot size={6} haloSpread={2} />
                    {attentionCount} need attention
                  </span>
                )}
              </div>
            </div>

            {/* ── View Tabs ───────────────────────────── */}
            <div
              style={{
                display: 'flex',
                gap: isMobile ? 0 : 8,
                marginBottom: 16,
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {VIEW_TABS.map((tab) => {
                const isActive = activeView === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveView(tab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: isMobile ? '10px 14px' : '8px 16px',
                      minHeight: 44,
                      border: 'none',
                      borderBottom: isActive
                        ? '2px solid #F47820'
                        : '2px solid transparent',
                      background: 'none',
                      cursor: 'pointer',
                      fontFamily: typography.fontFamily,
                      fontSize: '13px',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? colors.ink : colors.ink3,
                      letterSpacing: typography.letterSpacing.normal,
                      whiteSpace: 'nowrap',
                      transition: transitions.quick,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ── View Content ─────────────────────────── */}
            {isLoading ? (
              <PageState status="loading" />
            ) : activeView === 'daily-log' ? (
              <DailyLogView logs={dailyLogs} selectedDate={selectedDate} onDateChange={setSelectedDate} />
            ) : activeView === 'punch' ? (
              <PunchView items={punchItems} projectId={projectId} />
            ) : activeView === 'safety' ? (
              <SafetyView incidents={safetyIncidents} />
            ) : activeView === 'photos' ? (
              <PhotosView captures={photos} />
            ) : filteredEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: colors.ink4, fontFamily: typography.fontFamily, fontSize: '13px' }}>
                No entries yet. Tap + to capture.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {groupedByDate.map(([dateKey, entries]) => (
                  <div key={dateKey}>
                    {/* Date spine marker */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '16px 0 12px',
                      }}
                    >
                      <Eyebrow color={dateKey === selectedDate ? 'orange' : 'default'}>
                        {formatDateSpine(dateKey)}
                      </Eyebrow>
                      <div style={{ flex: 1, height: 1, background: 'var(--hairline-2)' }} />
                    </div>

                    {/* Entries for this date */}
                    {entries.map((entry) => (
                      <StreamEntryRow key={entry.id} entry={entry} />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Bottom spacer for FAB */}
            <div style={{ height: 96 }} />
          </div>

          {/* ── Capture FAB ─────────────────────────────── */}
          <button
            onClick={() => setShowCapture(true)}
            aria-label="Capture field entry"
            style={{
              position: 'fixed',
              bottom: isMobile ? 24 : 32,
              right: isMobile ? 24 : 32,
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: '#F47820',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 24px rgba(244, 120, 32, 0.35), 0 0 0 4px rgba(244, 120, 32, 0.12)',
              transition: transitions.quick,
              zIndex: 100,
            }}
          >
            <Plus size={24} />
          </button>

          {/* ── Field Capture Modal ─────────────────────── */}
          {showCapture && (
            <FieldCaptureModal
              open={showCapture}
              onClose={() => setShowCapture(false)}
              projectId={projectId ?? ''}
              dailyLogId={null}
            />
          )}
        </div>
      </ErrorBoundary>
  );
};

// ── Route Mapping ───────────────────────────────────────

function getEntryHref(entry: StreamEntry): string {
  switch (entry.type) {
    case 'daily-log': return '#/daily-log';
    case 'punch': {
      const rawId = entry.id.replace('pi-', '');
      return `#/punch-list/${rawId}`;
    }
    case 'safety': return '#/safety';
    case 'photo': return '#/field-capture';
    case 'delivery': return '#/procurement';
    default: return '#/field';
  }
}

// ── Stream Entry Row ──────────────────────────────────────

const StreamEntryRow: React.FC<{ entry: StreamEntry }> = ({ entry }) => {
  const typeConfig = ENTRY_TYPE_CONFIG[entry.type] ?? ENTRY_TYPE_CONFIG['daily-log'];
  const href = getEntryHref(entry);

  return (
    <a
      href={href}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '14px 0',
        borderBottom: '1px solid var(--hairline-2)',
        cursor: 'pointer',
        transition: transitions.quick,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      {/* Attention indicator or type icon */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          backgroundColor: typeConfig.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 2,
          position: 'relative',
        }}
      >
        <typeConfig.icon size={16} style={{ color: typeConfig.fg }} />
        {entry.needsAttention && (
          <OrangeDot
            size={7}
            haloSpread={2}
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
            }}
          />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            marginBottom: 2,
          }}
        >
          <span
            style={{
              fontFamily: typography.fontFamily,
              fontSize: '14px',
              fontWeight: 500,
              color: colors.ink,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.title}
          </span>
          {entry.status && (
            <Eyebrow color="muted" style={{ fontSize: '10px', flexShrink: 0 }}>
              {entry.status.replace(/_/g, ' ')}
            </Eyebrow>
          )}
        </div>
        {entry.subtitle && (
          <p
            style={{
              fontFamily: typography.fontFamilySerif,
              fontSize: '14px',
              lineHeight: 1.5,
              color: colors.ink2,
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {entry.subtitle}
          </p>
        )}
        {entry.assignee && (
          <span
            style={{
              fontFamily: typography.fontFamily,
              fontSize: '12px',
              color: colors.ink3,
              marginTop: 4,
              display: 'block',
            }}
          >
            → {entry.assignee}
          </span>
        )}
      </div>

      {/* Timestamp + chevron */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginTop: 4 }}>
        <Eyebrow color="muted" style={{ fontSize: '10px' }}>
          {formatTime(entry.timestamp)}
        </Eyebrow>
        <ChevronRight size={14} style={{ color: colors.ink4 }} />
      </div>
    </a>
  );
};

// ── Entry Type Config ─────────────────────────────────────

const ENTRY_TYPE_CONFIG: Record<string, { icon: React.ElementType; fg: string; bg: string }> = {
  'daily-log': { icon: BookOpen, fg: '#3A7BC8', bg: 'rgba(58, 123, 200, 0.08)' },
  punch: { icon: CheckSquare, fg: '#C4850C', bg: 'rgba(196, 133, 12, 0.08)' },
  safety: { icon: Shield, fg: '#C93B3B', bg: 'rgba(201, 59, 59, 0.08)' },
  photo: { icon: Image, fg: '#2D8A6E', bg: 'rgba(45, 138, 110, 0.08)' },
  delivery: { icon: Truck, fg: '#5C5550', bg: 'rgba(92, 85, 80, 0.08)' },
};

// ── Helpers ───────────────────────────────────────────────

function formatDateSpine(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatTime(timestamp: string): string {
  if (!timestamp) return '';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

// ── Structured View: Daily Log ───────────────────────────

const DailyLogView: React.FC<{
  logs: Record<string, unknown>[];
  selectedDate: string;
  onDateChange: (date: string) => void;
}> = ({ logs, selectedDate, onDateChange }) => {
  const sortedLogs = useMemo(
    () =>
      [...logs].sort((a, b) => {
        const da = (b.log_date as string) ?? (b.date as string) ?? '';
        const db = (a.log_date as string) ?? (a.date as string) ?? '';
        return da.localeCompare(db);
      }),
    [logs]
  );

  const statusColor = (s: string) => {
    if (s === 'approved' || s === 'signed') return colors.statusActive;
    if (s === 'submitted' || s === 'pending_review') return colors.statusPending;
    if (s === 'rejected') return colors.statusCritical;
    return colors.statusInfo;
  };

  return (
    <div>
      <ViewHeader href="#/daily-log" label="Open Daily Log" count={sortedLogs.length} />
      {sortedLogs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: colors.ink4, fontFamily: typography.fontFamily, fontSize: '13px' }}>
          No daily logs yet.
        </div>
      ) : (
      <>
      <div style={{ marginBottom: 20 }}>
        <CalendarNav
          selectedDate={selectedDate}
          onSelectDate={onDateChange}
          draftDates={new Set(
            logs
              .filter((l) => (l.status as string) === 'draft')
              .map((l) => ((l.log_date as string) ?? (l.date as string) ?? '').split('T')[0])
          )}
          approvedDates={new Set(
            logs
              .filter((l) => (l.status as string) === 'approved' || (l.status as string) === 'signed')
              .map((l) => ((l.log_date as string) ?? (l.date as string) ?? '').split('T')[0])
          )}
          submittedDates={new Set(
            logs
              .filter((l) => (l.status as string) === 'submitted' || (l.status as string) === 'pending_review')
              .map((l) => ((l.log_date as string) ?? (l.date as string) ?? '').split('T')[0])
          )}
        />
      </div>
      {sortedLogs.map((log) => {
        const date = (log.log_date as string) ?? (log.date as string) ?? '';
        const dateStr = date.split('T')[0];
        const status = (log.status as string) ?? 'draft';
        const workers = Number(log.workers_onsite ?? log.total_workers ?? 0);
        const hours = Number(log.man_hours ?? 0);
        const summary = (log.summary as string) ?? (log.work_performed as string) ?? '';
        const isSelected = dateStr === selectedDate;

        return (
          <div
            key={String(log.id)}
            onClick={() => onDateChange(dateStr)}
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--hairline-2)',
              cursor: 'pointer',
              backgroundColor: isSelected ? 'var(--color-surfaceSelected)' : 'transparent',
              transition: transitions.quick,
            }}
            role="button"
            tabIndex={0}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Eyebrow color={isSelected ? 'orange' : 'default'}>
                  {formatDateSpine(dateStr)}
                </Eyebrow>
                <span
                  style={{
                    fontFamily: typography.fontFamily,
                    fontSize: '11px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: statusColor(status),
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: `${statusColor(status)}11`,
                  }}
                >
                  {status.replace(/_/g, ' ')}
                </span>
              </div>
              {status === 'draft' && <OrangeDot size={7} haloSpread={2} label="Needs completion" />}
            </div>

            {summary && (
              <p style={{
                fontFamily: typography.fontFamilySerif,
                fontSize: '14px',
                lineHeight: 1.5,
                color: colors.ink2,
                margin: '0 0 8px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}>
                {summary}
              </p>
            )}

            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              {workers > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink3 }}>
                  <Users size={12} /> {workers} workers
                </span>
              )}
              {hours > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink3 }}>
                  <Clock size={12} /> {hours}h
                </span>
              )}
            </div>
          </div>
        );
      })}
      </>
      )}
    </div>
  );
};

// ── Structured View: Punch List ─────────────────────────

const PUNCH_STATUS_ORDER = ['open', 'in_progress', 'completed', 'verified', 'rejected'];

const PunchView: React.FC<{ items: Record<string, unknown>[]; projectId: string }> = ({ items, projectId }) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const updatePunch = useUpdatePunchItem();

  const filtered = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const ai = PUNCH_STATUS_ORDER.indexOf((a.verification_status as string) ?? '');
      const bi = PUNCH_STATUS_ORDER.indexOf((b.verification_status as string) ?? '');
      return ai - bi;
    });
    if (filterStatus === 'all') return sorted;
    return sorted.filter((i) => (i.verification_status as string) === filterStatus);
  }, [items, filterStatus]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const item of items) {
      const s = (item.verification_status as string) ?? 'open';
      c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [items]);

  const punchStatusColor = (s: string) => {
    if (s === 'verified' || s === 'completed') return colors.statusActive;
    if (s === 'in_progress') return colors.statusPending;
    if (s === 'rejected') return colors.statusCritical;
    return colors.statusInfo;
  };

  /** Cycle punch item through statuses inline */
  const handleStatusToggle = useCallback((item: Record<string, unknown>, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const current = (item.verification_status as string) ?? 'open';
    const nextMap: Record<string, string> = {
      open: 'in_progress',
      in_progress: 'completed',
      completed: 'verified',
      verified: 'open', // cycle back
    };
    const next = nextMap[current] ?? 'in_progress';
    updatePunch.mutate({
      id: String(item.id),
      updates: { verification_status: next },
      projectId,
    });
  }, [updatePunch, projectId]);

  return (
    <div>
      <ViewHeader href="#/punch-list" label="Open Punch List" count={items.length} />
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: colors.ink4, fontFamily: typography.fontFamily, fontSize: '13px' }}>
          Punch list is clear.
        </div>
      ) : (
      <>
      {/* Quick filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'open', 'in_progress', 'completed', 'verified'].map((s) => {
          const isActive = filterStatus === s;
          const count = counts[s] ?? 0;
          if (s !== 'all' && count === 0) return null;
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                fontFamily: typography.fontFamily,
                fontSize: '12px',
                fontWeight: isActive ? 600 : 400,
                padding: '6px 12px',
                borderRadius: '6px',
                border: isActive ? `1px solid ${colors.primaryOrange}` : '1px solid var(--hairline)',
                background: isActive ? 'rgba(244, 120, 32, 0.08)' : 'transparent',
                color: isActive ? colors.primaryOrange : colors.ink2,
                cursor: 'pointer',
                transition: transitions.quick,
                minHeight: 32,
              }}
            >
              {s === 'all' ? 'All' : s.replace(/_/g, ' ')} ({count})
            </button>
          );
        })}
      </div>

      {/* Punch items as checklist rows */}
      {filtered.map((item) => {
        const status = (item.verification_status as string) ?? 'open';
        const isDone = status === 'verified' || status === 'completed';
        return (
          <div
            key={String(item.id)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '14px 0',
              borderBottom: '1px solid var(--hairline-2)',
              opacity: isDone ? 0.55 : 1,
            }}
          >
            {/* Status checkbox — CLICKABLE for inline status change */}
            <button
              onClick={(e) => handleStatusToggle(item, e)}
              title={`Mark as ${status === 'open' ? 'in progress' : status === 'in_progress' ? 'completed' : status === 'completed' ? 'verified' : 'open'}`}
              style={{
                width: 24,
                height: 24,
                borderRadius: '6px',
                border: isDone ? `2px solid ${colors.statusActive}` : '2px solid var(--hairline)',
                backgroundColor: isDone ? colors.statusActive : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 2,
                cursor: 'pointer',
                transition: transitions.quick,
                padding: 0,
              }}
              onMouseEnter={(e) => {
                if (!isDone) e.currentTarget.style.borderColor = '#F47820';
              }}
              onMouseLeave={(e) => {
                if (!isDone) e.currentTarget.style.borderColor = 'var(--hairline)';
              }}
            >
              {isDone && (
                <CheckSquare size={14} style={{ color: '#fff' }} />
              )}
            </button>

            {/* Content — link to detail */}
            <a
              href={`#/punch-list/${item.id}`}
              style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                <span style={{
                  fontFamily: typography.fontFamily,
                  fontSize: '14px',
                  fontWeight: 500,
                  color: isDone ? colors.ink3 : colors.ink,
                  textDecoration: isDone ? 'line-through' : 'none',
                }}>
                  {String(item.itemNumber ?? 'PL')} — {(item.description as string) ?? 'No description'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                {item.area ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink3 }}>
                    <MapPin size={11} /> {item.area as string}
                  </span>
                ) : null}
                {item.assigned ? (
                  <span style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink3 }}>
                    → {item.assigned as string}
                  </span>
                ) : null}
                {item.dueDate ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: typography.fontFamily, fontSize: '12px', color: isOverdue(item.dueDate as string) ? colors.statusCritical : colors.ink3 }}>
                    <Calendar size={11} /> {formatShortDate(item.dueDate as string)}
                  </span>
                ) : null}
              </div>
            </a>

            {/* Clickable status badge */}
            <button
              onClick={(e) => handleStatusToggle(item, e)}
              title="Click to advance status"
              style={{
                fontFamily: typography.fontFamily,
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: punchStatusColor(status),
                backgroundColor: `${punchStatusColor(status)}12`,
                border: `1px solid ${punchStatusColor(status)}30`,
                padding: '3px 10px',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: transitions.quick,
                flexShrink: 0,
                marginTop: 4,
                whiteSpace: 'nowrap',
              }}
            >
              {status.replace(/_/g, ' ')}
            </button>

            {/* Attention dot */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginTop: 6 }}>
              {status === 'open' && (
                <OrangeDot size={7} haloSpread={2} />
              )}
            </div>
          </div>
        );
      })}
      </>
      )}
    </div>
  );
};

// ── Structured View: Safety ─────────────────────────────

const SafetyView: React.FC<{ incidents: Record<string, unknown>[] }> = ({ incidents }) => {
  const severityColor = (s: string) => {
    if (s === 'critical' || s === 'high') return colors.statusCritical;
    if (s === 'medium') return colors.statusPending;
    return colors.statusInfo;
  };

  return (
    <div>
      <ViewHeader href="#/safety" label="Open Safety" count={incidents.length} />
      {incidents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: colors.ink4, fontFamily: typography.fontFamily, fontSize: '13px' }}>
          No incidents reported.
        </div>
      ) : (
        <>
      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 20, padding: '12px 16px', backgroundColor: 'var(--color-surfaceInset)', borderRadius: '8px' }}>
        <div>
          <Eyebrow>Total</Eyebrow>
          <div style={{ fontFamily: typography.fontFamilySerif, fontSize: '24px', color: colors.ink, marginTop: 2 }}>
            {incidents.length}
          </div>
        </div>
        <div>
          <Eyebrow>Open</Eyebrow>
          <div style={{ fontFamily: typography.fontFamilySerif, fontSize: '24px', color: colors.statusCritical, marginTop: 2 }}>
            {incidents.filter((i) => (i.status as string) === 'open').length}
          </div>
        </div>
        <div>
          <Eyebrow>Resolved</Eyebrow>
          <div style={{ fontFamily: typography.fontFamilySerif, fontSize: '24px', color: colors.statusActive, marginTop: 2 }}>
            {incidents.filter((i) => (i.status as string) === 'resolved' || (i.status as string) === 'closed').length}
          </div>
        </div>
      </div>

      {incidents.map((inc) => {
        const severity = (inc.severity as string) ?? 'low';
        const status = (inc.status as string) ?? 'open';
        const isOpen = status === 'open';
        return (
          <div
            key={String(inc.id)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              padding: '14px 0',
              borderBottom: '1px solid var(--hairline-2)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: `${severityColor(severity)}11`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              {severity === 'critical' || severity === 'high' ? (
                <AlertTriangle size={16} style={{ color: severityColor(severity) }} />
              ) : (
                <Shield size={16} style={{ color: severityColor(severity) }} />
              )}
              {isOpen && <OrangeDot size={6} haloSpread={2} style={{ position: 'absolute', top: -1, right: -1 }} />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                <span style={{ fontFamily: typography.fontFamily, fontSize: '14px', fontWeight: 500, color: colors.ink }}>
                  {(inc.title as string) ?? (inc.type as string) ?? 'Incident'}
                </span>
                <span
                  style={{
                    fontFamily: typography.fontFamily,
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: severityColor(severity),
                  }}
                >
                  {severity}
                </span>
              </div>
              {inc.description ? (
                <p style={{
                  fontFamily: typography.fontFamilySerif,
                  fontSize: '14px',
                  lineHeight: 1.5,
                  color: colors.ink2,
                  margin: '0 0 4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {inc.description as string}
                </p>
              ) : null}
              <Eyebrow color="muted" style={{ fontSize: '10px' }}>
                {formatDateSpine((inc.date as string)?.split('T')[0] ?? '')} · {status.replace(/_/g, ' ')}
              </Eyebrow>
            </div>
          </div>
        );
      })}
        </>
      )}
    </div>
  );
};

// ── Structured View: Photos ─────────────────────────────

const PhotosView: React.FC<{ captures: Record<string, unknown>[] }> = ({ captures }) => {
  return (
    <div>
      <ViewHeader href="#/field-capture" label="Open Photos" count={captures.length} />
      {captures.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: colors.ink4, fontFamily: typography.fontFamily, fontSize: '13px' }}>
          No photos yet. Tap + to capture.
        </div>
      ) : (

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        {captures.map((cap) => {
          const url = (cap.photo_url as string) ?? (cap.thumbnail_url as string) ?? (cap.url as string) ?? '';
          const caption = (cap.caption as string) ?? (cap.label as string) ?? '';
          const timestamp = (cap.created_at as string) ?? '';
          const area = (cap.location_description as string) ?? (cap.area as string) ?? '';

          return (
            <div
              key={String(cap.id)}
              style={{
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid var(--hairline)',
                backgroundColor: '#fff',
              }}
            >
              {url ? (
                <div
                  style={{
                    width: '100%',
                    paddingBottom: '75%',
                    backgroundColor: colors.parchment2,
                    backgroundImage: `url(${url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                  }}
                >
                  {cap.gps_lat ? (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 4,
                        left: 4,
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        borderRadius: '3px',
                        padding: '2px 5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <MapPin size={9} style={{ color: '#fff' }} />
                      <span style={{ fontFamily: typography.fontFamily, fontSize: '9px', color: '#fff' }}>GPS</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div
                  style={{
                    width: '100%',
                    paddingBottom: '75%',
                    backgroundColor: colors.parchment2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  <Image size={24} style={{ color: colors.ink4, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                </div>
              )}
              <div style={{ padding: '8px 10px' }}>
                {caption && (
                  <p style={{
                    fontFamily: typography.fontFamily,
                    fontSize: '12px',
                    fontWeight: 500,
                    color: colors.ink,
                    margin: '0 0 2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {caption}
                  </p>
                )}
                {(area || timestamp) && (
                  <Eyebrow color="muted" style={{ fontSize: '9px' }}>
                    {area}{area && timestamp ? ' · ' : ''}{timestamp ? formatTime(timestamp) : ''}
                  </Eyebrow>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};

// ── View Header — prominent link to the full page ───────

const ViewHeader: React.FC<{ href: string; label: string; count?: number }> = ({ href, label, count }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  }}>
    <span style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink4 }}>
      {count !== undefined ? `${count} items` : ''}
    </span>
    <a
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: typography.fontFamily,
        fontSize: '12px',
        fontWeight: 500,
        color: colors.ink3,
        textDecoration: 'none',
        transition: transitions.quick,
      }}
    >
      {label} <ChevronRight size={12} />
    </a>
  </div>
);

function isOverdue(dateStr: string): boolean {
  if (!dateStr) return false;
  try {
    return new Date(dateStr) < new Date(new Date().toISOString().split('T')[0]);
  } catch {
    return false;
  }
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ── Export ─────────────────────────────────────────────────

export default FieldPage;

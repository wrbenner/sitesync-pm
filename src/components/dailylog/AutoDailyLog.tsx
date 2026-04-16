// ── AutoDailyLog ─────────────────────────────────────────────
// The daily log that writes itself throughout the day.
// Aggregates weather, workforce, activities, visitors, safety, and photos
// into a live timeline. At end of day: review in 2 minutes, tap approve.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud, Users, Activity, UserCheck, ShieldCheck, Camera,
  Check, Edit3, Clock, RefreshCw, ChevronDown, ChevronUp,
  FileText, AlertTriangle, Loader2,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions, touchTarget } from '../../styles/theme';
import { dailyLogService } from '../../services/dailyLogService';
import type { CompiledLog } from '../../services/dailyLogService';
import { useProjectId } from '../../hooks/useProjectId';
import { toast } from 'sonner';
import type { DailyLog, DailyLogEntry } from '../../types/entities';

// ── Types ────────────────────────────────────────────────────

type ViewMode = 'live' | 'review';

interface TimelineEntry {
  id: string;
  type: string;
  time: string;
  label: string;
  detail: string;
  icon: React.ReactNode;
  color: string;
}

interface AutoDailyLogProps {
  onCapturePress?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────

function formatTimeShort(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

function getEntryIcon(type: string): { icon: React.ReactNode; color: string } {
  switch (type) {
    case 'crew': return { icon: <Users size={16} />, color: colors.statusInfo };
    case 'photo': return { icon: <Camera size={16} />, color: colors.primaryOrange };
    case 'voice': return { icon: <Activity size={16} />, color: colors.statusReview };
    case 'safety': return { icon: <ShieldCheck size={16} />, color: colors.statusCritical };
    case 'visitor': return { icon: <UserCheck size={16} />, color: colors.statusActive };
    case 'note': return { icon: <FileText size={16} />, color: colors.textSecondary };
    default: return { icon: <Activity size={16} />, color: colors.textTertiary };
  }
}

function entryToTimeline(entry: DailyLogEntry): TimelineEntry {
  const { icon, color } = getEntryIcon(entry.type ?? 'note');
  const time = entry.created_at ? formatTimeShort(entry.created_at) : '';

  let label = '';
  let detail = '';

  switch (entry.type) {
    case 'crew':
      label = entry.company ?? entry.trade ?? 'Crew';
      detail = [
        entry.headcount ? `${entry.headcount} workers` : null,
        entry.hours ? `${entry.hours}h` : null,
      ].filter(Boolean).join(', ');
      break;
    case 'photo':
      label = 'Photo captured';
      detail = entry.description ?? entry.location ?? '';
      break;
    case 'voice':
      label = 'Voice note';
      detail = entry.description ?? '';
      break;
    case 'safety':
      label = 'Safety observation';
      detail = entry.description ?? '';
      break;
    case 'visitor':
      label = entry.inspector_name ?? entry.company ?? 'Visitor';
      detail = entry.description ?? '';
      break;
    default:
      label = 'Note';
      detail = entry.description ?? '';
  }

  return { id: entry.id, type: entry.type ?? 'note', time, label, detail, icon, color };
}

// ── Section Card ─────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  count,
  color,
  children,
  defaultExpanded = true,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  color: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      style={{
        background: colors.surfaceRaised,
        borderRadius: borderRadius.lg,
        border: `1px solid ${colors.borderSubtle}`,
        overflow: 'hidden',
        marginBottom: spacing['3'],
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['3'],
          width: '100%',
          padding: `${spacing['3']} ${spacing['4']}`,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: typography.fontFamily,
          minHeight: touchTarget.comfortable,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: borderRadius.md,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: color,
            color: colors.white,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <span
          style={{
            flex: 1,
            textAlign: 'left',
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
          }}
        >
          {title}
        </span>
        {count !== undefined && (
          <span
            style={{
              fontSize: typography.fontSize.label,
              color: colors.textTertiary,
              backgroundColor: colors.surfaceInset,
              borderRadius: borderRadius.full,
              padding: `${spacing['0.5']} ${spacing['2']}`,
              minWidth: 24,
              textAlign: 'center',
            }}
          >
            {count}
          </span>
        )}
        {expanded ? <ChevronUp size={16} color={colors.textTertiary} /> : <ChevronDown size={16} color={colors.textTertiary} />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: `0 ${spacing['4']} ${spacing['3']}` }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Timeline Entry ───────────────────────────────────────────

function TimelineItem({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
  return (
    <div style={{ display: 'flex', gap: spacing['3'], position: 'relative' }}>
      {/* Timeline line */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: borderRadius.full,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${entry.color}18`,
            color: entry.color,
            flexShrink: 0,
          }}
        >
          {entry.icon}
        </div>
        {!isLast && (
          <div style={{ width: 2, flex: 1, backgroundColor: colors.borderSubtle, minHeight: 16 }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : spacing['3'] }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing['2'] }}>
          <span
            style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              color: colors.textPrimary,
            }}
          >
            {entry.label}
          </span>
          <span
            style={{
              fontSize: typography.fontSize.caption,
              color: colors.textTertiary,
              marginLeft: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.time}
          </span>
        </div>
        {entry.detail && (
          <p
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textSecondary,
              margin: `${spacing['1']} 0 0`,
              lineHeight: typography.lineHeight.normal,
            }}
          >
            {entry.detail}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Review Screen ────────────────────────────────────────────

function ReviewScreen({
  compiled,
  onApprove,
  onEdit,
  approving,
}: {
  compiled: CompiledLog;
  onApprove: () => void;
  onEdit: () => void;
  approving: boolean;
}) {
  const sections = [
    { label: 'WEATHER', text: compiled.weather },
    { label: 'WORKFORCE', text: compiled.workforce },
    { label: 'WORK PERFORMED', text: compiled.activities },
    { label: 'VISITORS & INSPECTIONS', text: compiled.visitors },
    { label: 'SAFETY', text: compiled.safety },
    { label: 'PHOTOS', text: compiled.photos },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['3'],
          marginBottom: spacing['4'],
          padding: `${spacing['3']} ${spacing['4']}`,
          backgroundColor: colors.statusActiveSubtle,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.statusActive}`,
        }}
      >
        <FileText size={20} color={colors.statusActive} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: typography.fontSize.body,
              fontWeight: typography.fontWeight.semibold,
              color: colors.statusActive,
            }}
          >
            Daily Log Ready for Review
          </div>
          <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
            Review the compiled log below, then approve to finalize.
          </div>
        </div>
      </div>

      {/* Compiled sections */}
      <div
        style={{
          background: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.borderSubtle}`,
          padding: spacing['4'],
          marginBottom: spacing['4'],
        }}
      >
        {sections.map((section, i) => (
          <div
            key={section.label}
            style={{
              paddingBottom: i < sections.length - 1 ? spacing['3'] : 0,
              marginBottom: i < sections.length - 1 ? spacing['3'] : 0,
              borderBottom: i < sections.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
            }}
          >
            <div
              style={{
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textTertiary,
                letterSpacing: typography.letterSpacing.wider,
                marginBottom: spacing['1'],
                textTransform: 'uppercase' as const,
              }}
            >
              {section.label}
            </div>
            <div
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.textPrimary,
                lineHeight: typography.lineHeight.relaxed,
                whiteSpace: 'pre-wrap',
              }}
            >
              {section.text}
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: spacing['3'] }}>
        <button
          onClick={onEdit}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing['2'],
            padding: `${spacing['3']} ${spacing['4']}`,
            minHeight: touchTarget.comfortable,
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.md,
            cursor: 'pointer',
            fontFamily: typography.fontFamily,
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.medium,
            color: colors.textPrimary,
            transition: transitions.quick,
          }}
        >
          <Edit3 size={18} />
          Edit
        </button>
        <button
          onClick={onApprove}
          disabled={approving}
          style={{
            flex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing['2'],
            padding: `${spacing['3']} ${spacing['4']}`,
            minHeight: touchTarget.comfortable,
            backgroundColor: approving ? colors.surfaceDisabled : colors.statusActive,
            border: 'none',
            borderRadius: borderRadius.md,
            cursor: approving ? 'not-allowed' : 'pointer',
            fontFamily: typography.fontFamily,
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.semibold,
            color: colors.white,
            transition: transitions.quick,
          }}
        >
          {approving ? (
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Check size={18} />
          )}
          {approving ? 'Approving...' : 'Approve & Finalize'}
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
}

// ── Main Component ───────────────────────────────────────────

export function AutoDailyLog({ onCapturePress }: AutoDailyLogProps) {
  const projectId = useProjectId();

  const [log, setLog] = useState<DailyLog | null>(null);
  const [entries, setEntries] = useState<DailyLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('live');
  const [compiled, setCompiled] = useState<CompiledLog | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [approving, setApproving] = useState(false);
  const [lastWeatherRefresh, setLastWeatherRefresh] = useState<string | null>(null);

  // Load today's log
  const loadLog = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const result = await dailyLogService.loadTodayLog(projectId);
    if (result.data) {
      setLog(result.data);
      // Load entries
      const entriesResult = await dailyLogService.loadEntries(result.data.id);
      if (entriesResult.data) setEntries(entriesResult.data);
    } else if (result.error) {
      toast.error(`Failed to load daily log: ${result.error}`);
    }
    setLoading(false);
  }, [projectId]);

  // Load log on mount / project change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!projectId) return;
      if (cancelled) return;
      setLoading(true);
      const result = await dailyLogService.loadTodayLog(projectId);
      if (cancelled) return;
      if (result.data) {
        setLog(result.data);
        const entriesResult = await dailyLogService.loadEntries(result.data.id);
        if (!cancelled && entriesResult.data) setEntries(entriesResult.data);
      } else if (result.error) {
        toast.error(`Failed to load daily log: ${result.error}`);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  // Auto-refresh weather every 2 hours
  const logId = log?.id;
  useEffect(() => {
    if (!logId || !projectId) return;

    const refreshWeather = async () => {
      const now = new Date();
      if (lastWeatherRefresh) {
        const lastRefresh = new Date(lastWeatherRefresh);
        const hoursSince = (now.getTime() - lastRefresh.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 2) return;
      }

      const result = await dailyLogService.refreshWeather(logId, projectId);
      if (result.data) {
        setLog((prev) => prev ? {
          ...prev,
          weather: result.data!.conditions,
          temperature_high: result.data!.temperature_high,
          temperature_low: result.data!.temperature_low,
          wind_speed: `${result.data!.wind_speed} mph`,
          precipitation: `${result.data!.precipitation_probability}%`,
        } : prev);
        setLastWeatherRefresh(now.toISOString());
      }
    };

    refreshWeather();
    const interval = setInterval(refreshWeather, 2 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [logId, projectId, lastWeatherRefresh]);

  // Build timeline
  const timeline = useMemo(() => {
    return entries.map(entryToTimeline).reverse(); // most recent first
  }, [entries]);

  // Group entries by type for section counts
  const counts = useMemo(() => ({
    crews: entries.filter((e) => e.type === 'crew').length,
    photos: entries.filter((e) => e.type === 'photo').length,
    safety: entries.filter((e) => e.type === 'safety').length,
    visitors: entries.filter((e) => e.type === 'visitor').length,
    notes: entries.filter((e) => e.type === 'voice' || e.type === 'note').length,
  }), [entries]);

  const totalWorkers = useMemo(() => {
    return entries
      .filter((e) => e.type === 'crew')
      .reduce((sum, e) => sum + (e.headcount ?? 0), 0);
  }, [entries]);

  // Compile log for review
  const handleCompile = useCallback(async () => {
    if (!log) return;
    setCompiling(true);
    const result = await dailyLogService.compileLog(log.id);
    if (result.data) {
      setCompiled(result.data);
      setViewMode('review');
    } else {
      toast.error('Failed to compile log');
    }
    setCompiling(false);
  }, [log]);

  // Approve log
  const handleApprove = useCallback(async () => {
    if (!log) return;
    setApproving(true);

    // Save compiled narrative
    if (compiled) {
      await dailyLogService.updateSummary(log.id, compiled.narrative);
    }

    const result = await dailyLogService.approveLog(log.id);
    if (result.error) {
      toast.error(`Failed to approve: ${result.error}`);
    } else {
      toast.success('Daily log approved and finalized');
      setLog((prev) => prev ? { ...prev, status: 'approved', approved: true } : prev);
    }
    setApproving(false);
  }, [log, compiled]);

  // Refresh entries (called after capture)
  const refreshEntries = useCallback(async () => {
    if (!log) return;
    const result = await dailyLogService.loadEntries(log.id);
    if (result.data) setEntries(result.data);
  }, [log]);

  // Expose refresh for parent components
  useEffect(() => {
    (window as Record<string, unknown>).__refreshDailyLogEntries = refreshEntries;
    return () => { delete (window as Record<string, unknown>).__refreshDailyLogEntries; };
  }, [refreshEntries]);

  if (loading) {
    return (
      <div style={{ padding: spacing['4'] }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 80,
              borderRadius: borderRadius.lg,
              backgroundColor: colors.surfaceInset,
              marginBottom: spacing['3'],
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        ))}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.7; } }`}</style>
      </div>
    );
  }

  if (!log) {
    return (
      <div style={{ padding: spacing['6'], textAlign: 'center' }}>
        <AlertTriangle size={32} color={colors.statusPending} />
        <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, marginTop: spacing['3'] }}>
          No project selected. Select a project to view the daily log.
        </p>
      </div>
    );
  }

  const isApproved = log.status === 'approved';
  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div>
      {/* Date header + status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing['4'],
        }}
      >
        <div>
          <h2
            style={{
              fontSize: typography.fontSize.title,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              margin: 0,
            }}
          >
            {todayStr}
          </h2>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
              marginTop: spacing['1'],
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: borderRadius.full,
                backgroundColor: isApproved ? colors.statusActive : colors.statusInfo,
              }}
            />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
              {isApproved ? 'Approved' : 'Building throughout the day'}
            </span>
          </div>
        </div>

        {!isApproved && viewMode === 'live' && (
          <div style={{ display: 'flex', gap: spacing['2'] }}>
            <button
              onClick={() => loadLog()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['2']} ${spacing['3']}`,
                minHeight: touchTarget.min,
                backgroundColor: colors.surfaceRaised,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.md,
                cursor: 'pointer',
                fontFamily: typography.fontFamily,
                fontSize: typography.fontSize.sm,
                color: colors.textSecondary,
                transition: transitions.quick,
              }}
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={handleCompile}
              disabled={compiling}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['4']}`,
                minHeight: touchTarget.min,
                backgroundColor: colors.primaryOrange,
                border: 'none',
                borderRadius: borderRadius.md,
                cursor: compiling ? 'not-allowed' : 'pointer',
                fontFamily: typography.fontFamily,
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                color: colors.white,
                transition: transitions.quick,
              }}
            >
              {compiling ? (
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <FileText size={14} />
              )}
              {compiling ? 'Compiling...' : 'Review & Approve'}
            </button>
          </div>
        )}

        {viewMode === 'review' && (
          <button
            onClick={() => setViewMode('live')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['1'],
              padding: `${spacing['2']} ${spacing['3']}`,
              minHeight: touchTarget.min,
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.md,
              cursor: 'pointer',
              fontFamily: typography.fontFamily,
              fontSize: typography.fontSize.sm,
              color: colors.textSecondary,
              transition: transitions.quick,
            }}
          >
            Back to Live View
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'review' && compiled ? (
          <ReviewScreen
            key="review"
            compiled={compiled}
            onApprove={handleApprove}
            onEdit={() => setViewMode('live')}
            approving={approving}
          />
        ) : (
          <motion.div
            key="live"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Weather section */}
            <SectionCard
              icon={<Cloud size={16} />}
              title="Weather"
              color={colors.statusInfo}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['3'] }}>
                {log.weather && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                    <span style={{ fontSize: typography.fontSize.large, lineHeight: 1 }}>
                      {log.weather === 'Clear' ? '☀️' : log.weather === 'Cloudy' ? '☁️' : log.weather === 'Rain' ? '🌧️' : '🌤️'}
                    </span>
                    <div>
                      <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                        {log.weather}
                      </div>
                      <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                        Auto-updated every 2h
                      </div>
                    </div>
                  </div>
                )}
                {(log.temperature_high || log.temperature_low) && (
                  <div style={{ padding: `${spacing['1']} ${spacing['3']}`, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
                    <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Temp</div>
                    <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                      {log.temperature_low ?? '—'}°F – {log.temperature_high ?? '—'}°F
                    </div>
                  </div>
                )}
                {log.wind_speed && (
                  <div style={{ padding: `${spacing['1']} ${spacing['3']}`, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
                    <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Wind</div>
                    <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                      {log.wind_speed}
                    </div>
                  </div>
                )}
                {log.precipitation && (
                  <div style={{ padding: `${spacing['1']} ${spacing['3']}`, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
                    <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Precip</div>
                    <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                      {log.precipitation}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Workforce section */}
            <SectionCard
              icon={<Users size={16} />}
              title="Workforce"
              count={totalWorkers}
              color={colors.statusInfo}
            >
              {counts.crews > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                  {entries.filter((e) => e.type === 'crew').map((crew) => (
                    <div
                      key={crew.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing['3'],
                        padding: `${spacing['2']} ${spacing['3']}`,
                        backgroundColor: colors.surfaceInset,
                        borderRadius: borderRadius.md,
                      }}
                    >
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, flex: 1 }}>
                        {crew.company ?? crew.trade ?? 'Unknown'}
                      </span>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                        {crew.headcount ?? 0} workers
                      </span>
                      {crew.hours && (
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                          {crew.hours}h
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>
                  No crews logged yet. Tap the + Crew button to add.
                </p>
              )}
            </SectionCard>

            {/* Activity Timeline */}
            <SectionCard
              icon={<Activity size={16} />}
              title="Activity Timeline"
              count={entries.length}
              color={colors.primaryOrange}
            >
              {timeline.length > 0 ? (
                <div>
                  {timeline.map((item, i) => (
                    <TimelineItem
                      key={item.id}
                      entry={item}
                      isLast={i === timeline.length - 1}
                    />
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: `${spacing['6']} 0`,
                  }}
                >
                  <Clock size={24} color={colors.textTertiary} style={{ marginBottom: spacing['2'] }} />
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>
                    No entries yet. The log builds as you capture throughout the day.
                  </p>
                  {onCapturePress && (
                    <button
                      onClick={onCapturePress}
                      style={{
                        marginTop: spacing['3'],
                        padding: `${spacing['2']} ${spacing['4']}`,
                        minHeight: touchTarget.min,
                        backgroundColor: colors.primaryOrange,
                        border: 'none',
                        borderRadius: borderRadius.md,
                        cursor: 'pointer',
                        fontFamily: typography.fontFamily,
                        fontSize: typography.fontSize.sm,
                        fontWeight: typography.fontWeight.medium,
                        color: colors.white,
                        transition: transitions.quick,
                      }}
                    >
                      Start Capturing
                    </button>
                  )}
                </div>
              )}
            </SectionCard>

            {/* Safety section */}
            <SectionCard
              icon={<ShieldCheck size={16} />}
              title="Safety"
              count={counts.safety}
              color={colors.statusActive}
              defaultExpanded={counts.safety > 0}
            >
              {counts.safety > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                  {entries.filter((e) => e.type === 'safety').map((s) => (
                    <div
                      key={s.id}
                      style={{
                        padding: `${spacing['2']} ${spacing['3']}`,
                        backgroundColor: colors.surfaceInset,
                        borderRadius: borderRadius.md,
                      }}
                    >
                      <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                        {s.description}
                      </div>
                      {s.created_at && (
                        <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: spacing['1'] }}>
                          {formatTimeShort(s.created_at)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: typography.fontSize.sm, color: colors.statusActive, margin: 0 }}>
                  No incidents reported. Looking good!
                </p>
              )}
            </SectionCard>

            {/* Visitors section */}
            <SectionCard
              icon={<UserCheck size={16} />}
              title="Visitors & Inspections"
              count={counts.visitors}
              color={colors.statusReview}
              defaultExpanded={counts.visitors > 0}
            >
              {counts.visitors > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                  {entries.filter((e) => e.type === 'visitor').map((v) => (
                    <div
                      key={v.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing['3'],
                        padding: `${spacing['2']} ${spacing['3']}`,
                        backgroundColor: colors.surfaceInset,
                        borderRadius: borderRadius.md,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                          {v.inspector_name ?? v.company ?? 'Visitor'}
                        </div>
                        {v.description && (
                          <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                            {v.description}
                          </div>
                        )}
                      </div>
                      {v.time_in && (
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                          {formatTimeShort(v.time_in)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>
                  No visitors logged today.
                </p>
              )}
            </SectionCard>

            {/* Photos section */}
            {counts.photos > 0 && (
              <SectionCard
                icon={<Camera size={16} />}
                title="Photos"
                count={counts.photos}
                color={colors.primaryOrange}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'] }}>
                  {entries.filter((e) => e.type === 'photo').map((photo) => {
                    const photoUrl = Array.isArray(photo.photos) ? (photo.photos as string[])[0] : null;
                    return (
                      <div
                        key={photo.id}
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: borderRadius.md,
                          overflow: 'hidden',
                          backgroundColor: colors.surfaceInset,
                          position: 'relative',
                        }}
                      >
                        {photoUrl ? (
                          <img loading="lazy"
                            src={photoUrl}
                            alt={photo.description ?? 'Site photo'}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Camera size={20} color={colors.textTertiary} />
                          </div>
                        )}
                        {photo.created_at && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                              padding: `${spacing['1']} ${spacing['1']}`,
                              fontSize: '9px',
                              color: colors.white,
                              textAlign: 'center',
                            }}
                          >
                            {formatTimeShort(photo.created_at)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

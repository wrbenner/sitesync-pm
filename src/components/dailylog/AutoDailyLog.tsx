// ── AutoDailyLog ─────────────────────────────────────────────
// "The log that builds itself."
// Designed with radical simplicity — one scroll tells you everything.
// A superintendent opens this once in the morning, glances throughout
// the day, and hits one button at end of day.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud, Sun, CloudRain, CloudSnow,
  Users, ShieldCheck, AlertTriangle, Camera,
  Clock, Check, RefreshCw, Loader2, Send,
  X,
  FileText, Wrench, Truck, HardHat, Mic,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { dailyLogService } from '../../services/dailyLogService';
import type { CompiledLog } from '../../services/dailyLogService';
import { useProjectId } from '../../hooks/useProjectId';
import { fetchWeatherForDate } from '../../lib/weather';
import { toast } from 'sonner';
import type { DailyLog, DailyLogEntry } from '../../types/entities';

// ── Props ───────────────────────────────────────────────────

interface AutoDailyLogProps {
  projectLat?: number;
  projectLon?: number;
  projectAddress?: string;
}

// ── Helpers ─────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch { return ''; }
}

const WEATHER_ICONS: Record<string, React.ReactNode> = {
  Clear: <Sun size={32} />,
  Cloudy: <Cloud size={32} />,
  'Partly Cloudy': <Cloud size={32} />,
  Rain: <CloudRain size={32} />,
  'Light Rain': <CloudRain size={32} />,
  Thunderstorm: <CloudRain size={32} />,
  Snow: <CloudSnow size={32} />,
  Fog: <Cloud size={32} />,
};

function getWeatherIcon(conditions: string | null | undefined) {
  if (!conditions) return <Sun size={32} />;
  for (const [key, icon] of Object.entries(WEATHER_ICONS)) {
    if (conditions.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return <Sun size={32} />;
}

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; accent: string }> = {
  work_performed:    { label: 'Work',       icon: <Wrench size={14} />,         accent: colors.statusActive },
  crew:              { label: 'Crew',        icon: <Users size={14} />,          accent: colors.statusInfo },
  manpower:          { label: 'Crew',        icon: <Users size={14} />,          accent: colors.statusInfo },
  equipment:         { label: 'Equipment',   icon: <Truck size={14} />,          accent: colors.statusPending },
  material_received: { label: 'Material',    icon: <Truck size={14} />,          accent: colors.primaryOrange },
  delay:             { label: 'Delay',       icon: <AlertTriangle size={14} />,  accent: colors.statusCritical },
  incident:          { label: 'Incident',    icon: <AlertTriangle size={14} />,  accent: colors.statusCritical },
  visitor:           { label: 'Visitor',     icon: <HardHat size={14} />,        accent: colors.statusReview },
  inspection:        { label: 'Inspection',  icon: <FileText size={14} />,       accent: colors.statusReview },
  safety:            { label: 'Safety',      icon: <ShieldCheck size={14} />,    accent: colors.statusActive },
  photo:             { label: 'Photo',       icon: <Camera size={14} />,         accent: colors.primaryOrange },
  voice:             { label: 'Voice',       icon: <Mic size={14} />,            accent: colors.statusInfo },
  note:              { label: 'Note',        icon: <FileText size={14} />,       accent: colors.textTertiary },
};

function typeMeta(t: string) {
  return TYPE_META[t] ?? { label: t.replace(/_/g, ' '), icon: <FileText size={14} />, accent: colors.textTertiary };
}

// ── Main Component ──────────────────────────────────────────

export function AutoDailyLog({ projectLat, projectLon, projectAddress }: AutoDailyLogProps) {
  const projectId = useProjectId();

  // State
  const [log, setLog] = useState<DailyLog | null>(null);
  const [entries, setEntries] = useState<DailyLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [compiled, setCompiled] = useState<CompiledLog | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [approving, setApproving] = useState(false);
  const [liveWeather, setLiveWeather] = useState<{
    conditions: string; temp_high: number; temp_low: number;
    wind_speed: number; precipitation_inches: number;
  } | null>(null);
  const weatherFetched = useRef(false);

  // ── Load today's log ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!projectId) return;
      setLoading(true);
      const result = await dailyLogService.loadTodayLog(projectId);
      if (cancelled) return;
      if (result.data) {
        setLog(result.data);
        const er = await dailyLogService.loadEntries(result.data.id);
        if (!cancelled && er.data) setEntries(er.data);
      } else if (result.error) {
        toast.error(`Failed to load log: ${result.error}`);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  // ── Live weather from project coordinates (Open-Meteo, free, no key) ──
  useEffect(() => {
    if (weatherFetched.current) return;
    const lat = projectLat ?? undefined;
    const lon = projectLon ?? undefined;
    if (!lat || !lon) return;
    weatherFetched.current = true;
    const today = new Date().toISOString().split('T')[0];
    fetchWeatherForDate(lat, lon, today).then(w => {
      if (w.source !== 'default') setLiveWeather(w);
    }).catch(() => {});
  }, [projectLat, projectLon]);

  // Also refresh weather on the daily_log record
  const logId = log?.id;
  useEffect(() => {
    if (!logId || !projectId) return;
    dailyLogService.refreshWeather(logId, projectId, projectLat, projectLon).then(r => {
      if (r.data) {
        setLog(prev => prev ? {
          ...prev,
          weather: r.data!.conditions,
          temperature_high: r.data!.temperature_high,
          temperature_low: r.data!.temperature_low,
          wind_speed: `${r.data!.wind_speed} mph`,
          precipitation: `${r.data!.precipitation_probability}%`,
        } : prev);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logId, projectId]);

  // ── Computed ──
  const crewEntries = useMemo(() => entries.filter(e => e.type === 'crew' || e.type === 'manpower'), [entries]);
  const totalWorkers = useMemo(() => crewEntries.reduce((s, e) => s + (e.headcount ?? 0), 0), [crewEntries]);
  const totalHours = useMemo(() => crewEntries.reduce((s, e) => s + (e.hours ?? 0), 0), [crewEntries]);
  const incidentCount = useMemo(() => entries.filter(e => e.type === 'incident' || e.type === 'safety').length, [entries]);
  const timeline = useMemo(() => [...entries].sort((a, b) =>
    new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  ), [entries]);

  // Weather display values
  const wx = liveWeather ?? (log ? {
    conditions: log.weather ?? 'Clear',
    temp_high: log.temperature_high ?? 75,
    temp_low: log.temperature_low ?? 55,
    wind_speed: typeof log.wind_speed === 'string' ? parseInt(log.wind_speed) || 0 : (log.wind_speed ?? 0),
    precipitation_inches: 0,
  } : null);

  // ── Actions ──
  const refresh = useCallback(async () => {
    if (!log) return;
    const er = await dailyLogService.loadEntries(log.id);
    if (er.data) setEntries(er.data);
  }, [log]);

  const handleCompile = useCallback(async () => {
    if (!log) return;
    setCompiling(true);
    const result = await dailyLogService.compileLog(log.id);
    if (result.data) { setCompiled(result.data); setReviewing(true); }
    else toast.error('Failed to compile log');
    setCompiling(false);
  }, [log]);

  const handleApprove = useCallback(async () => {
    if (!log) return;
    setApproving(true);
    if (compiled) await dailyLogService.updateSummary(log.id, compiled.narrative);
    const result = await dailyLogService.approveLog(log.id);
    if (result.error) toast.error(`Failed to approve: ${result.error}`);
    else {
      toast.success('Daily log approved');
      setLog(prev => prev ? { ...prev, status: 'approved' } : prev);
      setReviewing(false);
    }
    setApproving(false);
  }, [log, compiled]);

  // Expose refresh for external capture components
  useEffect(() => {
    (window as Record<string, unknown>).__refreshDailyLogEntries = refresh;
    return () => { delete (window as Record<string, unknown>).__refreshDailyLogEntries; };
  }, [refresh]);

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div style={{ padding: spacing['4'] }}>
        <div style={{ height: 120, borderRadius: borderRadius.xl, backgroundColor: colors.surfaceInset, marginBottom: spacing['4'], animation: 'autolog-pulse 1.5s ease-in-out infinite' }} />
        <div style={{ display: 'flex', gap: spacing['3'], marginBottom: spacing['4'] }}>
          {[1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: 64, borderRadius: borderRadius.lg, backgroundColor: colors.surfaceInset, animation: 'autolog-pulse 1.5s ease-in-out infinite' }} />)}
        </div>
        <style>{`@keyframes autolog-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }`}</style>
      </div>
    );
  }

  // ── Empty state ──
  if (!log) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['12']} ${spacing['6']}`, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: borderRadius.full, backgroundColor: colors.orangeSubtle, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: spacing['4'] }}>
          <FileText size={28} color={colors.primaryOrange} />
        </div>
        <p style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: `0 0 ${spacing['1']}` }}>
          No log for today
        </p>
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, maxWidth: 280 }}>
          Select a project to start today's daily log.
        </p>
      </div>
    );
  }

  const isApproved = log.status === 'approved';
  const isSubmitted = log.status === 'submitted';
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // ────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      gap: 0,
      paddingBottom: spacing['8'],
    }}>

      {/* ═══════════════════════════════════════════════════════
          WEATHER HERO — the first thing you see
          ═══════════════════════════════════════════════════════ */}
      <div style={{
        background: `linear-gradient(135deg, ${colors.surfaceRaised} 0%, ${colors.surfaceInset} 100%)`,
        borderRadius: borderRadius.xl,
        padding: `${spacing['5']} ${spacing['5']}`,
        marginBottom: spacing['4'],
        border: `1px solid ${colors.borderSubtle}`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Date & Status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
          <div>
            <h2 style={{
              fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold,
              color: colors.textPrimary, margin: 0, lineHeight: 1.2,
            }}>
              {todayLabel}
            </h2>
            {projectAddress && (
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: `${spacing['0.5']} 0 0` }}>
                {projectAddress}
              </p>
            )}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: spacing['1.5'],
            padding: `${spacing['1']} ${spacing['2.5']}`,
            borderRadius: borderRadius.full,
            backgroundColor: isApproved ? colors.statusActiveSubtle : isSubmitted ? colors.statusInfoSubtle : colors.orangeSubtle,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: borderRadius.full,
              backgroundColor: isApproved ? colors.statusActive : isSubmitted ? colors.statusInfo : colors.primaryOrange,
              animation: !isApproved && !isSubmitted ? 'liveDot 2s ease-in-out infinite' : 'none',
            }} />
            <span style={{
              fontSize: '11px', fontWeight: typography.fontWeight.semibold,
              color: isApproved ? colors.statusActive : isSubmitted ? colors.statusInfo : colors.primaryOrange,
              textTransform: 'uppercase', letterSpacing: '0.3px',
            }}>
              {isApproved ? 'Approved' : isSubmitted ? 'Submitted' : 'Live'}
            </span>
          </div>
        </div>

        {/* Weather row */}
        {wx && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'] }}>
            <div style={{ color: colors.textSecondary, opacity: 0.7, flexShrink: 0 }}>
              {getWeatherIcon(wx.conditions)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing['2'] }}>
                <span style={{ fontSize: '28px', fontWeight: typography.fontWeight.bold, color: colors.textPrimary, lineHeight: 1 }}>
                  {wx.temp_high}°
                </span>
                <span style={{ fontSize: typography.fontSize.body, color: colors.textTertiary }}>
                  / {wx.temp_low}°
                </span>
              </div>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: `${spacing['0.5']} 0 0` }}>
                {wx.conditions}
                {wx.wind_speed > 0 && ` · ${wx.wind_speed} mph wind`}
                {wx.precipitation_inches > 0 && ` · ${wx.precipitation_inches}" precip`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          THREE BIG NUMBERS — Workers / Hours / Safety
          ═══════════════════════════════════════════════════════ */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: spacing['3'], marginBottom: spacing['4'],
      }}>
        <NumberCard value={totalWorkers} label="Workers" icon={<Users size={16} />} accent={colors.statusInfo} />
        <NumberCard value={totalHours} label="Hours" icon={<Clock size={16} />} accent={colors.primaryOrange} />
        <NumberCard
          value={incidentCount === 0 ? '✓' : incidentCount}
          label={incidentCount === 0 ? 'All Clear' : 'Incidents'}
          icon={<ShieldCheck size={16} />}
          accent={incidentCount === 0 ? colors.statusActive : colors.statusCritical}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════
          REVIEW MODE
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {reviewing && compiled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', marginBottom: spacing['4'] }}
          >
            <div style={{
              backgroundColor: colors.surfaceRaised,
              borderRadius: borderRadius.xl,
              border: `1px solid ${colors.statusActive}`,
              overflow: 'hidden',
            }}>
              {/* Banner */}
              <div style={{
                padding: `${spacing['3']} ${spacing['4']}`,
                backgroundColor: colors.statusActiveSubtle,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusActive }}>
                  Review & Approve
                </span>
                <button onClick={() => setReviewing(false)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: spacing['1'],
                  color: colors.textTertiary, display: 'flex',
                }}>
                  <X size={16} />
                </button>
              </div>
              {/* Narrative */}
              <div style={{ padding: spacing['4'] }}>
                {[
                  { heading: 'Weather', text: compiled.weather },
                  { heading: 'Workforce', text: compiled.workforce },
                  { heading: 'Work Performed', text: compiled.activities },
                  { heading: 'Safety', text: compiled.safety },
                ].filter(s => s.text).map((s, i) => (
                  <div key={s.heading} style={{ marginBottom: i < 3 ? spacing['3'] : 0 }}>
                    <p style={{
                      fontSize: '10px', fontWeight: typography.fontWeight.semibold,
                      color: colors.textTertiary, textTransform: 'uppercase',
                      letterSpacing: '0.5px', margin: `0 0 ${spacing['1']}`,
                    }}>{s.heading}</p>
                    <p style={{
                      fontSize: typography.fontSize.sm, color: colors.textPrimary,
                      lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap',
                    }}>{s.text}</p>
                  </div>
                ))}
              </div>
              {/* Approve button */}
              <div style={{ padding: `0 ${spacing['4']} ${spacing['4']}` }}>
                <button onClick={handleApprove} disabled={approving} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: spacing['2'], padding: `${spacing['3']} ${spacing['4']}`,
                  backgroundColor: approving ? colors.surfaceDisabled : colors.statusActive,
                  color: colors.white, border: 'none', borderRadius: borderRadius.lg,
                  fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily, cursor: approving ? 'not-allowed' : 'pointer',
                  transition: `background-color ${transitions.quick}`,
                }}>
                  {approving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={16} />}
                  {approving ? 'Approving…' : 'Approve & Finalize'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          TIMELINE — the heart of the log
          ═══════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: spacing['4'] }}>
        {/* Section header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: spacing['3'],
        }}>
          <span style={{
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
            color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            Today's Activity
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
            {!isApproved && (
              <button onClick={refresh} title="Refresh" style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: spacing['1'], display: 'flex', color: colors.textTertiary,
              }}>
                <RefreshCw size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Entries */}
        {timeline.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
            {timeline.map(entry => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: `${spacing['8']} ${spacing['4']}`,
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.xl,
            border: `1px solid ${colors.borderSubtle}`,
          }}>
            <p style={{ fontSize: typography.fontSize.body, color: colors.textTertiary, margin: 0 }}>
              No entries yet — the log fills as you go.
            </p>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          END-OF-DAY ACTION
          ═══════════════════════════════════════════════════════ */}
      {!isApproved && !reviewing && entries.length > 0 && (
        <button onClick={handleCompile} disabled={compiling} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: spacing['2'], padding: `${spacing['3.5']} ${spacing['4']}`,
          backgroundColor: compiling ? colors.surfaceDisabled : colors.primaryOrange,
          color: colors.white, border: 'none', borderRadius: borderRadius.xl,
          fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold,
          fontFamily: typography.fontFamily, cursor: compiling ? 'not-allowed' : 'pointer',
          transition: `background-color ${transitions.quick}`,
          boxShadow: compiling ? 'none' : `0 2px 8px rgba(244,120,32,0.25)`,
        }}>
          {compiling ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} />}
          {compiling ? 'Compiling…' : 'Review & Approve'}
        </button>
      )}

      {isApproved && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: spacing['2'], padding: `${spacing['3']} ${spacing['4']}`,
          backgroundColor: colors.statusActiveSubtle,
          borderRadius: borderRadius.xl,
          border: `1px solid ${colors.statusActive}`,
        }}>
          <Check size={16} color={colors.statusActive} />
          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusActive }}>
            Today's log is approved and finalized
          </span>
        </div>
      )}

      {/* Keyframes */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes liveDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }
      `}</style>
    </div>
  );
}

// ── NumberCard ───────────────────────────────────────────────

function NumberCard({ value, label, icon, accent }: {
  value: string | number; label: string; icon: React.ReactNode; accent: string;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: spacing['1'],
      padding: `${spacing['3.5']} ${spacing['2']}`,
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.xl,
      border: `1px solid ${colors.borderSubtle}`,
      textAlign: 'center',
    }}>
      <div style={{ color: accent, opacity: 0.7, marginBottom: spacing['0.5'] }}>{icon}</div>
      <span style={{
        fontSize: '24px', fontWeight: typography.fontWeight.bold,
        color: accent, lineHeight: 1,
      }}>
        {value}
      </span>
      <span style={{
        fontSize: '10px', fontWeight: typography.fontWeight.medium,
        color: colors.textTertiary, textTransform: 'uppercase',
        letterSpacing: '0.3px',
      }}>
        {label}
      </span>
    </div>
  );
}

// ── EntryRow — one line per entry ───────────────────────────

function EntryRow({ entry }: { entry: DailyLogEntry }) {
  const meta = typeMeta(entry.type ?? 'note');

  let primary = entry.description ?? '';
  let secondary = '';
  if (entry.type === 'crew' || entry.type === 'manpower') {
    primary = entry.company ?? entry.trade ?? 'Crew';
    const parts: string[] = [];
    if (entry.headcount) parts.push(`${entry.headcount} workers`);
    if (entry.hours) parts.push(`${entry.hours}h`);
    secondary = parts.join(' · ');
  } else if (entry.type === 'visitor') {
    primary = entry.inspector_name ?? entry.company ?? 'Visitor';
    secondary = entry.description ?? '';
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
      padding: `${spacing['3']} ${spacing['4']}`,
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.lg,
      border: `1px solid ${colors.borderSubtle}`,
      transition: `background-color ${transitions.quick}`,
    }}>
      {/* Icon */}
      <div style={{
        width: 28, height: 28, borderRadius: borderRadius.full,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: `${meta.accent}15`, color: meta.accent, flexShrink: 0,
        marginTop: 1,
      }}>
        {meta.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <span style={{
            fontSize: '10px', fontWeight: typography.fontWeight.semibold,
            color: meta.accent, textTransform: 'uppercase', letterSpacing: '0.3px',
          }}>
            {meta.label}
          </span>
          <span style={{
            fontSize: typography.fontSize.caption, color: colors.textTertiary,
            marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {entry.created_at ? formatTime(entry.created_at) : ''}
          </span>
        </div>
        {primary && (
          <p style={{
            fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
            color: colors.textPrimary, margin: `3px 0 0`, lineHeight: 1.4,
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {primary}
          </p>
        )}
        {secondary && (
          <p style={{
            fontSize: typography.fontSize.caption, color: colors.textSecondary,
            margin: `2px 0 0`, lineHeight: 1.4,
          }}>
            {secondary}
          </p>
        )}
      </div>
    </div>
  );
}

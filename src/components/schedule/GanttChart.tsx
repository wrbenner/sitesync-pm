import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { CalendarDays, ChevronRight, ChevronDown, GripVertical, X, Clock, Users, MapPin, Flag, AlertTriangle } from 'lucide-react';
import type { PredictedRisk } from '../../lib/predictions';
import type { MappedSchedulePhase } from '../../types/entities';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';

export type TimeScale = 'day' | 'week' | 'month' | 'quarter';
export type GanttPhase = MappedSchedulePhase;

// ── Props ────────────────────────────────────────────────
interface GanttChartProps {
  phases: GanttPhase[];
  isLoading?: boolean;
  onImportSchedule?: () => void;
  onAddActivity?: () => void;
  onPhaseClick?: (phase: GanttPhase) => void;
  onPhaseUpdate?: (id: string, updates: { start_date?: string; end_date?: string; percent_complete?: number }) => void;
  onLinkCreate?: (sourceId: string, targetId: string, type: string) => void;
  onLinkDelete?: (linkId: string) => void;
  baselinePhases?: GanttPhase[];
  showBaseline?: boolean;
  zoomLevel?: TimeScale;
  whatIfMode?: boolean;
  risks?: PredictedRisk[];
}

const DAY_MS = 86_400_000;
const ROW_H = 44;
const HEADER_H = 56;
const BAR_H = 32;
const BAR_TOP = (ROW_H - BAR_H) / 2;

// ── Date helpers ─────────────────────────────────────────
function parseDate(d: string | null | undefined): Date {
  if (!d) return new Date();
  const date = new Date(d + 'T00:00:00');
  return isNaN(date.getTime()) ? new Date() : date;
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function durationDays(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function formatDateShort(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateFull(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Cell width by zoom ──────────────────────────────────
function getCellWidth(zoom: TimeScale): number {
  switch (zoom) {
    case 'day': return 40;
    case 'week': return 140;
    case 'month': return 180;
    case 'quarter': return 220;
  }
}

function getDaysPerCell(zoom: TimeScale): number {
  switch (zoom) {
    case 'day': return 1;
    case 'week': return 7;
    case 'month': return 30;
    case 'quarter': return 91;
  }
}

// ── Header label generators ─────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function generateHeaderCells(start: Date, end: Date, zoom: TimeScale): Array<{ label: string; width: number; key: string; isWeekend?: boolean }> {
  const cells: Array<{ label: string; width: number; key: string; isWeekend?: boolean }> = [];
  const cellW = getCellWidth(zoom);
  const dpc = getDaysPerCell(zoom);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / DAY_MS);
  const cellCount = Math.ceil(totalDays / dpc);

  for (let i = 0; i < cellCount; i++) {
    const cellDate = addDays(start, i * dpc);
    const dayOfWeek = cellDate.getDay();
    const isWeekend = zoom === 'day' && (dayOfWeek === 0 || dayOfWeek === 6);
    let label: string;
    switch (zoom) {
      case 'day': {
        const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        label = `${dayNames[dayOfWeek]} ${cellDate.getDate()}`;
        break;
      }
      case 'week': {
        const weekEnd = addDays(cellDate, 6);
        label = `${MONTHS[cellDate.getMonth()]} ${cellDate.getDate()}–${weekEnd.getDate()}`;
        break;
      }
      case 'month':
        label = `${MONTHS[cellDate.getMonth()]} ${cellDate.getFullYear()}`;
        break;
      case 'quarter': {
        const q = Math.floor(cellDate.getMonth() / 3) + 1;
        label = `Q${q} ${cellDate.getFullYear()}`;
        break;
      }
    }
    cells.push({ label, width: cellW, key: `${i}-${cellDate.getTime()}`, isWeekend });
  }
  return cells;
}

function generateMonthHeaders(start: Date, end: Date, zoom: TimeScale): Array<{ label: string; width: number; key: string }> {
  if (zoom === 'month' || zoom === 'quarter') {
    const cells: Array<{ label: string; width: number; key: string }> = [];
    const cellW = getCellWidth(zoom);
    const dpc = getDaysPerCell(zoom);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / DAY_MS);
    const cellCount = Math.ceil(totalDays / dpc);
    let currentYear = -1;
    let accumWidth = 0;
    let startKey = '';
    for (let i = 0; i < cellCount; i++) {
      const cellDate = addDays(start, i * dpc);
      const year = cellDate.getFullYear();
      if (year !== currentYear) {
        if (currentYear !== -1) cells.push({ label: String(currentYear), width: accumWidth, key: startKey });
        currentYear = year;
        accumWidth = cellW;
        startKey = `y-${year}`;
      } else {
        accumWidth += cellW;
      }
    }
    if (currentYear !== -1) cells.push({ label: String(currentYear), width: accumWidth, key: startKey });
    return cells;
  }

  const cells: Array<{ label: string; width: number; key: string }> = [];
  const cellW = getCellWidth(zoom);
  const dpc = getDaysPerCell(zoom);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / DAY_MS);
  const cellCount = Math.ceil(totalDays / dpc);
  let currentMonth = -1;
  let currentYear = -1;
  let accumWidth = 0;
  let startKey = '';
  for (let i = 0; i < cellCount; i++) {
    const cellDate = addDays(start, i * dpc);
    const m = cellDate.getMonth();
    const y = cellDate.getFullYear();
    if (m !== currentMonth || y !== currentYear) {
      if (currentMonth !== -1) cells.push({ label: `${MONTHS[currentMonth]} ${currentYear}`, width: accumWidth, key: startKey });
      currentMonth = m;
      currentYear = y;
      accumWidth = cellW;
      startKey = `m-${y}-${m}`;
    } else {
      accumWidth += cellW;
    }
  }
  if (currentMonth !== -1) cells.push({ label: `${MONTHS[currentMonth]} ${currentYear}`, width: accumWidth, key: startKey });
  return cells;
}

// ── Color mapping — bold, unmistakable palette ──────────
// Every bar must be clearly visible even at 0% progress.
// Steve Jobs rule: if you squint and can't see it, it's wrong.
function barColor(phase: GanttPhase): { bg: string; border: string; progress: string; text: string } {
  if (phase.is_critical_path || phase.critical) {
    return { bg: '#FEE2E2', border: '#F87171', progress: '#EF4444', text: '#991B1B' };
  }
  if (phase.status === 'completed') {
    return { bg: '#DCFCE7', border: '#86EFAC', progress: '#22C55E', text: '#166534' };
  }
  if (phase.status === 'delayed') {
    return { bg: '#FEF3C7', border: '#FCD34D', progress: '#F59E0B', text: '#92400E' };
  }
  if (phase.status === 'active' || phase.status === 'in_progress' || phase.status === 'on_track') {
    return { bg: '#DBEAFE', border: '#93C5FD', progress: '#3B82F6', text: '#1E40AF' };
  }
  if (phase.status === 'at_risk') {
    return { bg: '#FEF3C7', border: '#FCD34D', progress: '#F59E0B', text: '#92400E' };
  }
  // "upcoming" / unknown — warm neutral
  return { bg: '#E8E5E0', border: '#C4BFB8', progress: '#8D8680', text: '#4B4539' };
}

// ── Skeleton Loading ────────────────────────────────────
const SKELETON_WIDTHS = ['70%', '55%', '85%', '40%', '90%', '60%', '75%', '45%'];

function GanttSkeleton() {
  return (
    <div style={{ padding: spacing['5'] }}>
      <style>{`
        @keyframes ganttShimmer {
          0% { background-position: -600px 0; }
          100% { background-position: 600px 0; }
        }
      `}</style>
      {SKELETON_WIDTHS.map((w, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: spacing['4'], padding: `${spacing['3']} 0`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <div style={{
            width: 220, height: 16,
            borderRadius: borderRadius.base,
            background: 'linear-gradient(90deg, #E5E7EB 25%, #F3F4F6 50%, #E5E7EB 75%)',
            backgroundSize: '600px 100%',
            animation: 'ganttShimmer 1.5s infinite linear',
            animationDelay: `${i * 0.08}s`,
          }} />
          <div style={{
            width: w, height: BAR_H,
            borderRadius: borderRadius.md,
            background: 'linear-gradient(90deg, #E5E7EB 25%, #F3F4F6 50%, #E5E7EB 75%)',
            backgroundSize: '600px 100%',
            animation: 'ganttShimmer 1.5s infinite linear',
            animationDelay: `${i * 0.08 + 0.04}s`,
          }} />
        </div>
      ))}
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────
function GanttEmpty({ onImportSchedule, onAddActivity }: { onImportSchedule?: () => void; onAddActivity?: () => void }) {
  return (
    <div role="status" aria-label="No schedule data" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '80px 24px', gap: spacing['5'], minHeight: 400,
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: borderRadius['2xl'],
        background: `linear-gradient(135deg, ${colors.orangeSubtle}, ${colors.brand50})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <CalendarDays size={36} color={colors.primaryOrange} strokeWidth={1.5} />
      </div>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <p style={{ margin: 0, fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight }}>
          Build your project schedule
        </p>
        <p style={{ margin: `${spacing['3']} 0 0`, fontSize: typography.fontSize.body, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed }}>
          Create activities and milestones to track every phase from mobilization to closeout. Import from Primavera P6 or Microsoft Project.
        </p>
      </div>
      <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['2'] }}>
        <button onClick={onAddActivity} style={{
          padding: `${spacing['3']} ${spacing['6']}`, backgroundColor: colors.primaryOrange, color: '#fff',
          border: 'none', borderRadius: borderRadius.lg, fontSize: typography.fontSize.body,
          fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily, cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(244,120,32,0.3)', transition: transitions.quick,
        }}>
          Create First Phase
        </button>
        <button onClick={onImportSchedule} style={{
          padding: `${spacing['3']} ${spacing['6']}`, backgroundColor: 'transparent', color: colors.textPrimary,
          border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.lg,
          fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium,
          fontFamily: typography.fontFamily, cursor: 'pointer', transition: transitions.quick,
        }}>
          Import Schedule
        </button>
      </div>
    </div>
  );
}

// ── Phase Detail Panel (slide-in from right) ────────────
interface DetailPanelProps {
  phase: GanttPhase | null;
  onClose: () => void;
  risks: PredictedRisk[];
}

const PhaseDetailPanel: React.FC<DetailPanelProps> = ({ phase, onClose, risks }) => {
  if (!phase) return null;

  const clr = barColor(phase);
  const start = parseDate(phase.startDate || phase.start_date);
  const end = parseDate(phase.endDate || phase.end_date);
  const dur = durationDays(start, end);
  const progress = phase.progress ?? phase.percent_complete ?? 0;
  const isMilestone = dur <= 1 && start.getTime() === end.getTime();
  const risk = risks.find(r => r.phaseId === phase.id);
  const statusLabel = (phase.status ?? 'upcoming').replace(/_/g, ' ');

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 360,
      backgroundColor: colors.white, borderLeft: `1px solid ${colors.borderDefault}`,
      boxShadow: '-8px 0 32px rgba(0,0,0,0.08)', zIndex: 20,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      animation: 'slideInRight 200ms cubic-bezier(0.32,0.72,0,1)',
    }}>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: `${spacing['5']} ${spacing['5']} ${spacing['4']}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing['3'] }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {isMilestone && (
              <span style={{
                display: 'inline-block', fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange,
                backgroundColor: colors.orangeSubtle, padding: `1px ${spacing['2']}`,
                borderRadius: borderRadius.full, marginBottom: spacing['2'],
              }}>
                Milestone
              </span>
            )}
            <h3 style={{
              margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary, lineHeight: typography.lineHeight.snug,
            }}>
              {phase.name}
            </h3>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: colors.surfaceInset, borderRadius: borderRadius.md,
            cursor: 'pointer', color: colors.textTertiary, flexShrink: 0, transition: transitions.quick,
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginTop: spacing['3'] }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
            fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold,
            color: clr.text, backgroundColor: clr.bg, border: `1px solid ${clr.border}`,
            padding: `2px ${spacing['3']}`, borderRadius: borderRadius.full,
            textTransform: 'capitalize' as const,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: clr.progress }} />
            {statusLabel}
          </span>
          {(phase.is_critical_path || phase.critical) && (
            <span style={{
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.bold,
              color: '#991B1B', backgroundColor: '#FEE2E2',
              padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full,
            }}>
              Critical Path
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: spacing['5'] }}>
        {/* Progress */}
        {!isMilestone && (
          <div style={{ marginBottom: spacing['6'] }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary }}>Progress</span>
              <span style={{ fontSize: typography.fontSize.medium, fontWeight: typography.fontWeight.bold, color: clr.progress }}>{progress}%</span>
            </div>
            <div style={{
              height: 8, borderRadius: borderRadius.full,
              backgroundColor: colors.surfaceInset, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${Math.min(100, progress)}%`,
                borderRadius: borderRadius.full, backgroundColor: clr.progress,
                transition: `width ${transitions.smooth}`,
              }} />
            </div>
          </div>
        )}

        {/* Details grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <DetailRow icon={<Clock size={15} />} label="Start" value={formatDateFull(phase.startDate || phase.start_date || '')} />
          <DetailRow icon={<Flag size={15} />} label="Finish" value={formatDateFull(phase.endDate || phase.end_date || '')} />
          {!isMilestone && <DetailRow icon={<CalendarDays size={15} />} label="Duration" value={`${dur} day${dur !== 1 ? 's' : ''}`} />}
          {phase.float_days != null && (
            <DetailRow
              icon={<Clock size={15} />}
              label="Total Float"
              value={`${phase.float_days}d`}
              valueColor={phase.float_days === 0 ? '#DC2626' : phase.float_days <= 3 ? '#D97706' : undefined}
            />
          )}
          {phase.assigned_trade && (
            <DetailRow icon={<Users size={15} />} label="Trade" value={phase.assigned_trade} />
          )}
          {phase.location && (
            <DetailRow icon={<MapPin size={15} />} label="Location" value={phase.location} />
          )}
        </div>

        {/* Baseline comparison */}
        {phase.baselineEndDate && (
          <div style={{
            marginTop: spacing['5'], padding: spacing['4'],
            backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg,
          }}>
            <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase' as const, letterSpacing: typography.letterSpacing.wider }}>
              Baseline Comparison
            </span>
            <div style={{ marginTop: spacing['3'], display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: typography.fontSize.sm }}>
                <span style={{ color: colors.textSecondary }}>Planned Finish</span>
                <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{formatDateShort(phase.baselineEndDate)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: typography.fontSize.sm }}>
                <span style={{ color: colors.textSecondary }}>Current Finish</span>
                <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{formatDateShort(phase.endDate || phase.end_date || '')}</span>
              </div>
              {phase.slippageDays !== 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                  color: phase.slippageDays > 0 ? '#DC2626' : '#16A34A',
                }}>
                  <span>Variance</span>
                  <span>{phase.slippageDays > 0 ? '+' : ''}{phase.slippageDays}d</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Risk alert */}
        {risk && (
          <div style={{
            marginTop: spacing['5'], padding: spacing['4'],
            backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2',
            borderRadius: borderRadius.lg,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
              <AlertTriangle size={14} color="#DC2626" />
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: '#991B1B' }}>
                Risk Detected
              </span>
              <span style={{
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                color: '#DC2626', backgroundColor: '#FEE2E2',
                padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full, marginLeft: 'auto',
              }}>
                {risk.likelihoodPercent}% likely
              </span>
            </div>
            <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: '#7F1D1D', lineHeight: typography.lineHeight.relaxed }}>
              {risk.reason}
            </p>
            {risk.suggestedAction && (
              <p style={{ margin: `${spacing['2']} 0 0`, fontSize: typography.fontSize.sm, color: '#991B1B', fontWeight: typography.fontWeight.medium }}>
                Suggested: {risk.suggestedAction}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function DetailRow({ icon, label, value, valueColor }: { icon: React.ReactNode; label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
      <span style={{ color: colors.textTertiary, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, minWidth: 80 }}>{label}</span>
      <span style={{ fontSize: typography.fontSize.sm, color: valueColor || colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{value}</span>
    </div>
  );
}

// ── Dependency arrows ──────────────────────────────────
function DependencyArrows({ phases, chartStart, pxPerDay }: { phases: GanttPhase[]; chartStart: Date; pxPerDay: number }) {
  const phaseMap = useMemo(() => {
    const map = new Map<string, { index: number; phase: GanttPhase }>();
    phases.forEach((p, i) => map.set(p.id, { index: i, phase: p }));
    return map;
  }, [phases]);

  const arrows = useMemo(() => {
    const result: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (const phase of phases) {
      const deps = phase.dependencies || (phase.depends_on ? [phase.depends_on] : []);
      for (const depId of deps) {
        const source = phaseMap.get(depId);
        const target = phaseMap.get(phase.id);
        if (!source || !target) continue;

        const sourceEnd = parseDate(source.phase.endDate || source.phase.end_date);
        const targetStart = parseDate(target.phase.startDate || target.phase.start_date);

        const x1 = ((sourceEnd.getTime() - chartStart.getTime()) / DAY_MS) * pxPerDay;
        const y1 = source.index * ROW_H + ROW_H / 2;
        const x2 = ((targetStart.getTime() - chartStart.getTime()) / DAY_MS) * pxPerDay;
        const y2 = target.index * ROW_H + ROW_H / 2;

        result.push({ x1, y1, x2, y2 });
      }
    }
    return result;
  }, [phases, phaseMap, chartStart, pxPerDay]);

  if (arrows.length === 0) return null;

  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 3 }}>
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={colors.textTertiary} opacity="0.5" />
        </marker>
      </defs>
      {arrows.map((a, i) => {
        const midX = a.x1 + 12;
        const path = a.y1 === a.y2
          ? `M ${a.x1} ${a.y1} L ${a.x2} ${a.y2}`
          : `M ${a.x1} ${a.y1} L ${midX} ${a.y1} L ${midX} ${a.y2} L ${a.x2} ${a.y2}`;
        return (
          <path
            key={i}
            d={path}
            fill="none"
            stroke={colors.textTertiary}
            strokeWidth="1.5"
            strokeOpacity="0.35"
            markerEnd="url(#arrowhead)"
            strokeDasharray="4 3"
          />
        );
      })}
    </svg>
  );
}

// ── Today marker ────────────────────────────────────────
function TodayMarker({ chartStart, pxPerDay, totalHeight }: { chartStart: Date; pxPerDay: number; totalHeight: number }) {
  const today = startOfDay(new Date());
  const offset = (today.getTime() - chartStart.getTime()) / DAY_MS;
  const left = offset * pxPerDay;
  if (left < 0) return null;
  return (
    <>
      <style>{`
        @keyframes todayPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(244,120,32,0.4); }
          50% { box-shadow: 0 0 0 4px rgba(244,120,32,0.1); }
        }
      `}</style>
      <div style={{
        position: 'absolute', left, top: 0, bottom: 0, width: 2,
        background: `linear-gradient(180deg, ${colors.primaryOrange}, ${colors.primaryOrange}40)`,
        zIndex: 6, pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute', top: -3, left: -5,
          width: 12, height: 12, borderRadius: '50%',
          background: colors.primaryOrange,
          border: '2px solid white',
          boxShadow: '0 0 0 0 rgba(244,120,32,0.4)',
          animation: 'todayPulse 2s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)',
          fontSize: 10, fontWeight: 700, color: colors.primaryOrange,
          whiteSpace: 'nowrap', letterSpacing: '0.02em',
        }}>
          TODAY
        </div>
      </div>
    </>
  );
}

// ── Baseline bar overlay ────────────────────────────────
function BaselineBar({ phase, chartStart, pxPerDay }: { phase: GanttPhase; chartStart: Date; pxPerDay: number }) {
  if (!phase.baselineStartDate || !phase.baselineEndDate) return null;
  const start = parseDate(phase.baselineStartDate);
  const end = parseDate(phase.baselineEndDate);
  const dur = durationDays(start, end);
  const offsetDays = (start.getTime() - chartStart.getTime()) / DAY_MS;
  const left = offsetDays * pxPerDay;
  const width = Math.max(dur * pxPerDay, 4);

  return (
    <div
      title="Baseline"
      style={{
        position: 'absolute', left, top: BAR_TOP + BAR_H - 4,
        width, height: 4,
        backgroundColor: 'rgba(156,163,175,0.3)',
        borderRadius: 2,
        border: '1px dashed rgba(156,163,175,0.5)',
        zIndex: 1,
      }}
    />
  );
}

// ── Row component ───────────────────────────────────────
interface GanttRowProps {
  phase: GanttPhase;
  chartStart: Date;
  pxPerDay: number;
  rowIndex: number;
  onSelect: (id: string) => void;
  selected: boolean;
  showBaseline?: boolean;
  hasRisk: boolean;
  onDragStart?: (id: string, e: React.MouseEvent) => void;
}

const GanttRow: React.FC<GanttRowProps> = React.memo(({ phase, chartStart, pxPerDay, rowIndex, onSelect, selected, showBaseline, hasRisk, onDragStart }) => {
  const start = parseDate(phase.startDate || phase.start_date);
  const end = parseDate(phase.endDate || phase.end_date);
  const dur = durationDays(start, end);
  const isMilestone = dur <= 1 && start.getTime() === end.getTime();
  const progress = phase.progress ?? phase.percent_complete ?? 0;
  const clr = barColor(phase);

  const offsetDays = (start.getTime() - chartStart.getTime()) / DAY_MS;
  const left = offsetDays * pxPerDay;
  const width = Math.max(isMilestone ? 0 : dur * pxPerDay, 6);
  const top = rowIndex * ROW_H;

  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="row"
      aria-label={`${phase.name}: ${phase.status ?? 'upcoming'}, ${progress}% complete`}
      onClick={() => onSelect(phase.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute', top, left: 0, right: 0, height: ROW_H,
        cursor: 'pointer',
        backgroundColor: selected
          ? `${colors.primaryOrange}08`
          : hovered
          ? colors.surfaceHover
          : rowIndex % 2 === 1
          ? 'rgba(0,0,0,0.016)'
          : 'transparent',
        borderBottom: `1px solid ${colors.borderSubtle}`,
        transition: 'background-color 120ms ease',
      }}
    >
      {/* Baseline bar */}
      {showBaseline && <BaselineBar phase={phase} chartStart={chartStart} pxPerDay={pxPerDay} />}

      {isMilestone ? (
        /* ── Milestone diamond ── */
        <div style={{ position: 'absolute', left: left - 10, top: ROW_H / 2 - 10 }}>
          <div
            title={`${phase.name} (Milestone)`}
            style={{
              width: 20, height: 20,
              transform: 'rotate(45deg)',
              background: `linear-gradient(135deg, ${colors.primaryOrange}, #FF9C42)`,
              borderRadius: 3,
              boxShadow: hovered
                ? `0 2px 8px rgba(244,120,32,0.4)`
                : '0 1px 3px rgba(244,120,32,0.2)',
              transition: 'box-shadow 150ms ease, transform 150ms ease',
            }}
          />
          {/* Milestone label */}
          <span style={{
            position: 'absolute', left: 28, top: 2,
            fontSize: 12, fontWeight: 600, color: colors.textPrimary,
            whiteSpace: 'nowrap',
          }}>
            {phase.name}
          </span>
        </div>
      ) : (
        /* ── Activity bar ── */
        <div
          title={`${phase.name} — ${progress}% (${toDateStr(start)} → ${toDateStr(end)})`}
          onMouseDown={(e) => onDragStart?.(phase.id, e)}
          style={{
            position: 'absolute', left, top: BAR_TOP, width, height: BAR_H,
            backgroundColor: clr.bg,
            border: `1.5px solid ${clr.border}`,
            borderRadius: borderRadius.md,
            overflow: 'hidden',
            zIndex: 4,
            boxShadow: selected
              ? `0 0 0 2px ${clr.progress}50, 0 3px 10px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.6)`
              : hovered
              ? `0 3px 10px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.6)`
              : `0 1px 3px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5)`,
            transition: 'box-shadow 150ms ease, transform 150ms ease',
            transform: hovered ? 'translateY(-0.5px)' : 'none',
          }}
        >
          {/* Bottom edge gradient — gives depth even at 0% */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%',
            background: `linear-gradient(to top, ${clr.progress}10, transparent)`,
            pointerEvents: 'none',
          }} />
          {/* Progress fill */}
          {progress > 0 && (
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${Math.min(100, progress)}%`,
              backgroundColor: clr.progress,
              opacity: 0.35,
              borderRadius: `${borderRadius.md} 0 0 ${borderRadius.md}`,
              transition: `width ${transitions.smooth}`,
            }} />
          )}
          {/* Progress indicator line */}
          {progress > 0 && progress < 100 && (
            <div style={{
              position: 'absolute', left: `${Math.min(100, progress)}%`, top: 0, bottom: 0,
              width: 2, backgroundColor: clr.progress, opacity: 0.6,
            }} />
          )}
          {/* Label inside bar */}
          {width > 80 && (
            <div style={{
              position: 'absolute', left: 10, right: 10, top: '50%', transform: 'translateY(-50%)',
              display: 'flex', alignItems: 'center', gap: 6,
              zIndex: 2,
            }}>
              <span style={{
                fontSize: 12.5, fontWeight: 600, color: clr.text,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                flex: 1, letterSpacing: '-0.01em',
              }}>
                {phase.name}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, color: clr.text,
                opacity: 0.7, flexShrink: 0,
              }}>
                {progress}%
              </span>
            </div>
          )}
          {/* Drag handle on right edge */}
          {hovered && (
            <div style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 8,
              cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: `${clr.progress}20`,
              borderLeft: `1px solid ${clr.progress}30`,
            }}>
              <GripVertical size={10} color={clr.progress} style={{ opacity: 0.6 }} />
            </div>
          )}
          {/* Risk indicator dot */}
          {hasRisk && (
            <div style={{
              position: 'absolute', top: -3, right: -3,
              width: 8, height: 8, borderRadius: '50%',
              backgroundColor: '#EF4444', border: '1.5px solid white',
              zIndex: 5,
            }} />
          )}
        </div>
      )}

      {/* ── Float visualization — translucent buffer zone ── */}
      {!isMilestone && (phase.floatDays ?? 0) > 0 && pxPerDay > 0 && (
        <div
          title={`${phase.floatDays} days of float`}
          style={{
            position: 'absolute',
            left: left + width,
            top: BAR_TOP + 8,
            width: Math.min((phase.floatDays ?? 0) * pxPerDay, 300), // cap at 300px
            height: BAR_H - 16,
            background: `repeating-linear-gradient(
              90deg,
              ${clr.progress}18,
              ${clr.progress}18 4px,
              transparent 4px,
              transparent 8px
            )`,
            borderRadius: `0 ${borderRadius.sm} ${borderRadius.sm} 0`,
            borderRight: `2px solid ${clr.progress}25`,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      )}

      {/* Right-side label when bar is too narrow */}
      {!isMilestone && width <= 80 && (
        <span style={{
          position: 'absolute', left: left + width + 10, top: BAR_TOP + 7,
          fontSize: 12.5, fontWeight: 600, color: colors.textPrimary,
          whiteSpace: 'nowrap', letterSpacing: '-0.01em',
        }}>
          {phase.name}
          <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: colors.textTertiary }}>{progress}%</span>
        </span>
      )}
    </div>
  );
});
GanttRow.displayName = 'GanttRow';

// ── Table panel (left side) ─────────────────────────────
const TABLE_W_DEFAULT = 340;
const TABLE_W_MIN = 220;
const TABLE_W_MAX = 560;

// ── WBS Hierarchy helpers ──────────────────────────────
// Determines indent level from WBS code (e.g. "1.2.3" → level 2) or parent_id chain
function getWbsLevel(phase: GanttPhase, phaseMap: Map<string, GanttPhase>): number {
  // Try WBS code first (e.g. "1.2.3" means level 2)
  const wbs = (phase as unknown as Record<string, unknown>).wbs_code ?? (phase as unknown as Record<string, unknown>).wbs;
  if (typeof wbs === 'string' && wbs.includes('.')) {
    return wbs.split('.').length - 1;
  }
  // Fall back to parent_id chain
  const parentId = (phase as unknown as Record<string, unknown>).parent_id as string | null;
  if (!parentId) return 0;
  let level = 0;
  let currentId: string | null = parentId;
  while (currentId && level < 5) {
    level++;
    const parent = phaseMap.get(currentId);
    currentId = parent ? ((parent as unknown as Record<string, unknown>).parent_id as string | null) : null;
  }
  return level;
}

// Check if a phase has children
function hasChildren(phaseId: string, phases: GanttPhase[]): boolean {
  return phases.some(p => (p as unknown as Record<string, unknown>).parent_id === phaseId);
}

function TablePanel({ phases, selectedId, onSelect, risks, width }: { phases: GanttPhase[]; selectedId: string | null; onSelect: (id: string) => void; risks: PredictedRisk[]; width: number }) {
  const riskIds = useMemo(() => new Set(risks.map(r => r.phaseId)), [risks]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const phaseMap = useMemo(() => new Map(phases.map(p => [p.id, p])), [phases]);

  const toggleGroup = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Determine which phases are visible (not hidden by collapsed parent)
  const visiblePhases = useMemo(() => {
    return phases.filter(p => {
      let currentId = (p as unknown as Record<string, unknown>).parent_id as string | null;
      while (currentId) {
        if (collapsedGroups.has(currentId)) return false;
        const parent = phaseMap.get(currentId);
        currentId = parent ? ((parent as unknown as Record<string, unknown>).parent_id as string | null) : null;
      }
      return true;
    });
  }, [phases, collapsedGroups, phaseMap]);

  return (
    <div style={{
      width, flexShrink: 0, borderRight: `1px solid ${colors.borderDefault}`,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      backgroundColor: colors.white,
    }}>
      {/* Header */}
      <div style={{
        height: HEADER_H, display: 'flex', alignItems: 'center', padding: `0 ${spacing['4']}`,
        borderBottom: `1px solid ${colors.borderDefault}`, background: colors.surfaceInset,
        gap: spacing['1'],
      }}>
        {(() => {
          const colStyle: React.CSSProperties = {
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
            color: colors.textTertiary, textTransform: 'uppercase' as const,
            letterSpacing: typography.letterSpacing.wider, whiteSpace: 'nowrap',
          };
          const showDates = width >= 400;
          return (
            <>
              <span style={{ ...colStyle, flex: 1 }}>Activity</span>
              {showDates && <span style={{ ...colStyle, width: 64, textAlign: 'center' }}>Start</span>}
              {showDates && <span style={{ ...colStyle, width: 64, textAlign: 'center' }}>Finish</span>}
              <span style={{ ...colStyle, width: 44, textAlign: 'center' }}>Days</span>
              <span style={{ ...colStyle, width: 56, textAlign: 'right' }}>Progress</span>
            </>
          );
        })()}
      </div>
      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {visiblePhases.map((p, idx) => {
          const start = parseDate(p.startDate || p.start_date);
          const end = parseDate(p.endDate || p.end_date);
          const dur = durationDays(start, end);
          const progress = p.progress ?? p.percent_complete ?? 0;
          const isSelected = p.id === selectedId;
          const isMilestone = dur <= 1 && start.getTime() === end.getTime();
          const clr = barColor(p);
          const hasRisk = riskIds.has(p.id);
          const indentLevel = getWbsLevel(p, phaseMap);
          const isParent = hasChildren(p.id, phases);
          const isCollapsed = collapsedGroups.has(p.id);

          return (
            <div
              key={p.id}
              role="row"
              onClick={() => onSelect(p.id)}
              style={{
                height: ROW_H, display: 'flex', alignItems: 'center',
                padding: `0 ${spacing['4']}`, gap: spacing['2'],
                borderBottom: `1px solid ${colors.borderSubtle}`,
                cursor: 'pointer',
                backgroundColor: isSelected
                  ? `${colors.primaryOrange}08`
                  : idx % 2 === 1
                  ? 'rgba(0,0,0,0.016)'
                  : 'transparent',
                transition: 'background-color 120ms ease',
              }}
              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = isSelected ? `${colors.primaryOrange}08` : idx % 2 === 1 ? 'rgba(0,0,0,0.016)' : 'transparent'; }}
            >
              {/* Status indicator */}
              <div style={{
                width: 3.5, height: 22, borderRadius: 2, flexShrink: 0,
                backgroundColor: clr.progress,
                opacity: p.status === 'completed' ? 0.5 : 1,
              }} />

              {/* Name with WBS indent and expand/collapse */}
              <div style={{
                flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: spacing['1'],
                paddingLeft: indentLevel * 16,
              }}>
                {/* Expand/collapse toggle for parent items */}
                {isParent ? (
                  <button
                    onClick={(e) => toggleGroup(p.id, e)}
                    style={{
                      width: 16, height: 16, border: 'none', backgroundColor: 'transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0, flexShrink: 0, borderRadius: 2,
                      color: colors.textTertiary,
                    }}
                    aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
                  >
                    {isCollapsed
                      ? <ChevronRight size={12} />
                      : <ChevronDown size={12} />
                    }
                  </button>
                ) : (
                  <span style={{ width: 16, flexShrink: 0 }} />
                )}
                {isMilestone && (
                  <span style={{ color: colors.primaryOrange, fontSize: 10, flexShrink: 0 }}>◆</span>
                )}
                <span style={{
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontSize: typography.fontSize.sm, color: colors.textPrimary,
                  fontWeight: isParent
                    ? typography.fontWeight.semibold
                    : isSelected
                    ? typography.fontWeight.semibold
                    : typography.fontWeight.normal,
                  opacity: p.status === 'completed' ? 0.55 : 1,
                }}>
                  {p.name}
                </span>
                {hasRisk && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    backgroundColor: '#EF4444', flexShrink: 0,
                  }} />
                )}
              </div>

              {/* Start / Finish — shown when panel is wide enough */}
              {width >= 400 && (
                <span style={{
                  width: 64, textAlign: 'center',
                  fontSize: typography.fontSize.caption, color: colors.textTertiary,
                  fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                }}>
                  {formatDateShort(p.startDate || p.start_date || '')}
                </span>
              )}
              {width >= 400 && (
                <span style={{
                  width: 64, textAlign: 'center',
                  fontSize: typography.fontSize.caption, color: colors.textTertiary,
                  fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                }}>
                  {formatDateShort(p.endDate || p.end_date || '')}
                </span>
              )}

              {/* Duration */}
              <span style={{
                width: 44, textAlign: 'center',
                fontSize: typography.fontSize.caption, color: colors.textTertiary,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {isMilestone ? '—' : `${dur}d`}
              </span>

              {/* Progress mini bar */}
              <div style={{ width: 56, display: 'flex', alignItems: 'center', gap: spacing['1'], justifyContent: 'flex-end' }}>
                <div style={{
                  width: 32, height: 4, borderRadius: 2,
                  backgroundColor: colors.surfaceInset, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${Math.min(100, progress)}%`,
                    borderRadius: 2, backgroundColor: clr.progress,
                    transition: `width ${transitions.smooth}`,
                  }} />
                </div>
                <span style={{
                  fontSize: 10, color: progress >= 100 ? clr.progress : colors.textTertiary,
                  fontWeight: progress >= 100 ? typography.fontWeight.semibold : typography.fontWeight.normal,
                  fontVariantNumeric: 'tabular-nums', minWidth: 22, textAlign: 'right',
                }}>
                  {progress}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main GanttChart Component ───────────────────────────
export const GanttChart: React.FC<GanttChartProps> = ({
  phases,
  isLoading = false,
  onImportSchedule,
  onAddActivity,
  onPhaseClick,
  onPhaseUpdate,
  baselinePhases,
  showBaseline: showBaselineProp,
  zoomLevel: zoomLevelProp,
  whatIfMode = false,
  risks = [],
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailPhase, setDetailPhase] = useState<GanttPhase | null>(null);
  const [tableWidth, setTableWidth] = useState(TABLE_W_DEFAULT);

  const zoom = zoomLevelProp ?? 'week';
  const cellW = getCellWidth(zoom);
  const dpc = getDaysPerCell(zoom);
  const pxPerDay = cellW / dpc;

  const riskIds = useMemo(() => new Set(risks.map(r => r.phaseId)), [risks]);

  // ── Calculate date range ───────────────────────────────
  const { chartStart, chartEnd, totalDays } = useMemo(() => {
    if (!phases || phases.length === 0) {
      const now = startOfDay(new Date());
      return { chartStart: addDays(now, -7), chartEnd: addDays(now, 90), totalDays: 97 };
    }
    let minMs = Infinity, maxMs = -Infinity;
    for (const p of phases) {
      const s = parseDate(p.startDate || p.start_date).getTime();
      const e = parseDate(p.endDate || p.end_date).getTime();
      if (s < minMs) minMs = s;
      if (e > maxMs) maxMs = e;
    }
    const pad = zoom === 'day' ? 7 : zoom === 'week' ? 14 : 30;
    const start = addDays(new Date(minMs), -pad);
    const end = addDays(new Date(maxMs), pad);
    return { chartStart: startOfDay(start), chartEnd: startOfDay(end), totalDays: Math.ceil((end.getTime() - start.getTime()) / DAY_MS) };
  }, [phases, zoom]);

  const totalWidth = totalDays * pxPerDay;
  const totalHeight = (phases?.length ?? 0) * ROW_H;

  // Header cells
  const monthHeaders = useMemo(() => generateMonthHeaders(chartStart, chartEnd, zoom), [chartStart, chartEnd, zoom]);
  const cellHeaders = useMemo(() => generateHeaderCells(chartStart, chartEnd, zoom), [chartStart, chartEnd, zoom]);

  // ── Click handler ─────────────────────────────────────
  const handleSelect = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id);
    const phase = phases.find(p => p.id === id);
    if (phase) {
      setDetailPhase(prev => prev?.id === id ? null : phase);
      onPhaseClick?.(phase);
    }
  }, [phases, onPhaseClick]);

  const closeDetail = useCallback(() => {
    setDetailPhase(null);
    setSelectedId(null);
  }, []);

  // ── Drag to reschedule ────────────────────────────────
  const handleDragStart = useCallback((id: string, e: React.MouseEvent) => {
    if (!onPhaseUpdate) return;
    const phase = phases.find(p => p.id === id);
    if (!phase) return;

    const startX = e.clientX;
    const origStart = parseDate(phase.startDate || phase.start_date);
    const origEnd = parseDate(phase.endDate || phase.end_date);

    const handleMove = (me: MouseEvent) => {
      const dx = me.clientX - startX;
      const daysDelta = Math.round(dx / pxPerDay);
      if (daysDelta === 0) return;
      const newStart = addDays(origStart, daysDelta);
      const newEnd = addDays(origEnd, daysDelta);
      onPhaseUpdate(id, { start_date: toDateStr(newStart), end_date: toDateStr(newEnd) });
    };

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [phases, onPhaseUpdate, pxPerDay]);

  // ── Resize table panel ────────────────────────────────
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = tableWidth;
    const handleMove = (me: MouseEvent) => {
      const newW = Math.max(TABLE_W_MIN, Math.min(TABLE_W_MAX, startW + (me.clientX - startX)));
      setTableWidth(newW);
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [tableWidth]);

  // ── Scroll to today on mount ──────────────────────────
  useEffect(() => {
    if (!timelineRef.current) return;
    const today = startOfDay(new Date());
    const offset = (today.getTime() - chartStart.getTime()) / DAY_MS;
    const scrollX = Math.max(0, offset * pxPerDay - 300);
    timelineRef.current.scrollTo({ left: scrollX, behavior: 'smooth' });
  }, [chartStart, pxPerDay]);

  // Scroll sync is handled by the virtual scrolling effect above

  // ── Virtual scrolling: only render visible rows ──────
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(800);

  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    const syncScroll = () => {
      setScrollTop(timeline.scrollTop);
      if (tableScrollRef.current) {
        tableScrollRef.current.scrollTop = timeline.scrollTop;
      }
    };
    const syncSize = () => setViewportH(timeline.clientHeight);
    syncSize();
    timeline.addEventListener('scroll', syncScroll, { passive: true });
    const ro = new ResizeObserver(syncSize);
    ro.observe(timeline);
    return () => {
      timeline.removeEventListener('scroll', syncScroll);
      ro.disconnect();
    };
  }, []);

  const overscan = 5; // render extra rows above/below viewport for smooth scrolling
  const visibleStartIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - overscan);
  const visibleEndIdx = Math.min(
    (phases?.length ?? 0) - 1,
    Math.ceil((scrollTop + viewportH) / ROW_H) + overscan
  );

  // ── Loading ───────────────────────────────────────────
  if (isLoading) return <GanttSkeleton />;

  // ── Empty state ───────────────────────────────────────
  if (!phases || phases.length === 0) {
    return <GanttEmpty onImportSchedule={onImportSchedule} onAddActivity={onAddActivity} />;
  }

  // The Gantt IS the product — it should fill the viewport.
  // Use calc(100vh - offset) so it dominates regardless of content.
  // For large schedules (20+ rows), let content drive height.
  // minHeight ensures it never looks like a widget.
  const viewportChartH = 'calc(100vh - 340px)'; // leaves room for header + KPIs + toolbar
  const contentDrivenH = HEADER_H + totalHeight + 20;
  // We'll use the CSS value for the container and a numeric fallback for calculations
  const chartHNumeric = Math.max(420, contentDrivenH);

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      {/* Main Gantt container */}
      <div
        style={{
          display: 'flex', position: 'relative',
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: borderRadius.xl,
          overflow: 'hidden',
          background: colors.white,
          height: viewportChartH,
          minHeight: 420,
          maxHeight: Math.max(800, contentDrivenH),
          boxShadow: whatIfMode
            ? `0 0 0 2px rgba(124,58,237,0.15), ${shadows.card}`
            : shadows.card,
          transition: `box-shadow ${transitions.quick}`,
        }}
      >
        {/* Left table */}
        <TablePanel phases={phases} selectedId={selectedId} onSelect={handleSelect} risks={risks} width={tableWidth} />

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          style={{
            width: 6, cursor: 'col-resize', flexShrink: 0,
            backgroundColor: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 11, position: 'relative',
            transition: 'background-color 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${colors.primaryOrange}15`; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <div style={{
            width: 2, height: 32, borderRadius: 1,
            backgroundColor: colors.borderDefault,
            transition: 'background-color 150ms ease',
          }} />
        </div>

        {/* Right timeline */}
        <div
          ref={timelineRef}
          style={{
            flex: 1, overflow: 'auto', position: 'relative',
            scrollBehavior: 'smooth',
          }}
        >
          {/* Sticky header */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 10,
            background: colors.surfaceInset,
            borderBottom: `1px solid ${colors.borderDefault}`,
          }}>
            {/* Top row: months/years */}
            <div style={{ display: 'flex', height: HEADER_H / 2, borderBottom: `1px solid ${colors.borderSubtle}` }}>
              {monthHeaders.map(h => (
                <div key={h.key} style={{
                  width: h.width, minWidth: h.width,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: typography.fontWeight.semibold,
                  color: colors.textSecondary,
                  borderRight: `1px solid ${colors.borderSubtle}`,
                  letterSpacing: typography.letterSpacing.wide,
                }}>
                  {h.label}
                </div>
              ))}
            </div>
            {/* Bottom row: days/weeks */}
            <div style={{ display: 'flex', height: HEADER_H / 2 }}>
              {cellHeaders.map(h => (
                <div key={h.key} style={{
                  width: h.width, minWidth: h.width,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: typography.fontWeight.medium,
                  color: h.isWeekend ? `${colors.textTertiary}80` : colors.textTertiary,
                  borderRight: `1px solid ${colors.borderSubtle}`,
                  backgroundColor: h.isWeekend ? `${colors.surfaceInset}` : 'transparent',
                }}>
                  {h.label}
                </div>
              ))}
            </div>
          </div>

          {/* Timeline body */}
          <div style={{ position: 'relative', width: totalWidth, minHeight: Math.max(totalHeight, chartHNumeric - HEADER_H) }}>
            {/* Row zebra striping — extends full visible height */}
            {Array.from({ length: Math.max(phases.length + 8, Math.ceil((chartHNumeric - HEADER_H) / ROW_H)) }, (_, i) => i).filter(i => i % 2 === 1).map(i => (
              <div key={`zs-${i}`} style={{
                position: 'absolute', left: 0, right: 0, top: i * ROW_H, height: ROW_H,
                backgroundColor: 'rgba(0,0,0,0.016)', pointerEvents: 'none',
              }} />
            ))}

            {/* Weekend shading (day zoom only) */}
            {zoom === 'day' && cellHeaders.filter(h => h.isWeekend).map((h, i) => {
              const idx = cellHeaders.indexOf(h);
              return (
                <div key={`we-${h.key}`} style={{
                  position: 'absolute', left: idx * cellW, top: 0, bottom: 0,
                  width: cellW, backgroundColor: 'rgba(0,0,0,0.015)',
                  pointerEvents: 'none',
                }} />
              );
            })}

            {/* Grid lines */}
            {cellHeaders.map((h, i) => (
              <div key={`gl-${h.key}`} style={{
                position: 'absolute', left: i * cellW, top: 0, bottom: 0,
                width: 1, background: `${colors.borderSubtle}40`,
                pointerEvents: 'none',
              }} />
            ))}

            {/* Dependency arrows */}
            <DependencyArrows phases={phases} chartStart={chartStart} pxPerDay={pxPerDay} />

            {/* Today marker */}
            <TodayMarker chartStart={chartStart} pxPerDay={pxPerDay} totalHeight={totalHeight} />

            {/* Phase bars — virtualized: only visible rows rendered */}
            {phases.map((phase, i) => {
              if (i < visibleStartIdx || i > visibleEndIdx) return null;
              return (
                <GanttRow
                  key={phase.id}
                  phase={phase}
                  chartStart={chartStart}
                  pxPerDay={pxPerDay}
                  rowIndex={i}
                  onSelect={handleSelect}
                  selected={phase.id === selectedId}
                  showBaseline={showBaselineProp}
                  hasRisk={riskIds.has(phase.id)}
                  onDragStart={handleDragStart}
                />
              );
            })}
          </div>
        </div>

        {/* Phase detail panel */}
        {detailPhase && (
          <PhaseDetailPanel phase={detailPhase} onClose={closeDetail} risks={risks} />
        )}
      </div>

      {/* Footer summary */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${spacing['3']} ${spacing['1']}`,
        fontSize: typography.fontSize.caption, color: colors.textTertiary,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'] }}>
          <span>{phases.length} {phases.length === 1 ? 'activity' : 'activities'}</span>
          {phases.some(p => p.is_critical_path || p.critical) && (
            <>
              <span style={{ width: 1, height: 12, backgroundColor: colors.borderDefault }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                <span style={{ width: 8, height: 4, backgroundColor: '#FCA5A5', borderRadius: 1 }} />
                {phases.filter(p => p.is_critical_path || p.critical).length} critical path
              </span>
            </>
          )}
          {risks.length > 0 && (
            <>
              <span style={{ width: 1, height: 12, backgroundColor: colors.borderDefault }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#EF4444' }} />
                {risks.length} risk{risks.length !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(phases.reduce((s, p) => s + (p.progress ?? 0), 0) / phases.length)}% overall
        </span>
      </div>
    </div>
  );
};

export default GanttChart;

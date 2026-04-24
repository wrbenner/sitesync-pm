// SiteSync PM — Schedule Canvas
// A world-class construction schedule view.
//
// Design tenets:
//   - One row per activity NAME within a building. Multiple zone-runs → multiple
//     bars on the same row, each with a tiny section chip. This takes 385
//     imported per-zone rows and renders ~60-120 clean rows grouped under
//     their buildings.
//   - Buildings are the organizing axis — rendered as collapsible horizontal
//     sections with an accent rail and a compact progress summary.
//   - Palette is restrained: five status tones in the same saturation band,
//     plus one orange accent for the Today line. No Easter-basket greens.
//   - 32px rows, 13px tabular numerals. Dense enough to actually read a
//     schedule on a 15" laptop.
//   - No decorations that don't carry information.

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronDown, ChevronRight, AlertTriangle, Circle,
  CheckCircle2, Clock, Building2,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import type { SchedulePhase } from '../../stores/scheduleStore';
import { buildingOf, UNGROUPED_LABEL } from './BuildingOverview';

// ── Types ───────────────────────────────────────────────────

type ZoomLevel = 'day' | 'week' | 'month' | 'quarter';

type RowStatus = 'completed' | 'active' | 'behind' | 'upcoming';

interface Segment {
  id: string;
  sectionLabel: string;
  startDate: string;
  endDate: string;
  percentComplete: number;
  status: RowStatus;
  isMilestone: boolean;
  raw: SchedulePhase;
}

interface ActivityRow {
  key: string;
  name: string;
  building: string;
  segments: Segment[];
  minStart: string;
  maxEnd: string;
  aggregateProgress: number;
}

interface BuildingGroup {
  key: string;
  label: string;
  rows: ActivityRow[];
  totalSegments: number;
  completed: number;
  behind: number;
  active: number;
  progress: number;
  status: RowStatus;
}

// ── Constants ──────────────────────────────────────────────

const ROW_H = 32;
const GROUP_HEADER_H = 44;
const TIMELINE_H = 52;
const LEFT_RAIL_W = 320;
const BAR_H = 18;
const BAR_TOP = (ROW_H - BAR_H) / 2;

const CELL_WIDTH: Record<ZoomLevel, number> = {
  day: 36,
  week: 88,
  month: 120,
  quarter: 180,
};

const CELL_DAYS: Record<ZoomLevel, number> = {
  day: 1,
  week: 7,
  month: 30,
  quarter: 91,
};

// Muted, saturation-matched status palette. Used for left-rail status dots
// and group-header rails, and as the override for `behind` segments (red
// is a universally understood alarm that should override building color).
const STATUS_BAR: Record<RowStatus, { fill: string; text: string; progressFill: string }> = {
  completed: { fill: '#CFE2D6', progressFill: '#65A57D', text: '#1F4A34' },
  active:    { fill: '#C9DBF4', progressFill: '#2F6EDC', text: '#1B3F7E' },
  behind:    { fill: '#F5CCCC', progressFill: '#C23232', text: '#7A1F1F' },
  upcoming:  { fill: '#E9E6E1', progressFill: '#9E9A92', text: '#5F5A51' },
};

// Per-building color families. Each building gets a distinct hue; sections
// within that building step through shades (section 1 = lightest, section 5
// = darkest). This lets you see at a glance which bars belong to which
// building on a row that spans multiple zones.
//
// All palettes share a common saturation + lightness curve so no single
// building shouts louder than another. Behind-schedule segments override
// with red regardless — urgency trumps grouping.
type BuildingPalette = {
  /** Four tints from lightest to darkest, indexed by section number. */
  fills: [string, string, string, string];
  /** Matching progress-fill (darker/more saturated) shades. */
  progress: [string, string, string, string];
  text: string;
  /** Solid accent used in the left-rail group header. */
  accent: string;
};

const BUILDING_PALETTES: Record<string, BuildingPalette> = {
  // Sitework / General — neutral warm tan. Intentionally desaturated so it
  // reads as "common/site-wide" rather than any building.
  _sitework: {
    fills:    ['#E6E2D8', '#D6D1C3', '#C6BFAE', '#B5AC98'],
    progress: ['#9E9688', '#857D6E', '#6D6659', '#565045'],
    text:     '#4A453B',
    accent:   '#9E9688',
  },
  // Building A — slate blue.
  A: {
    fills:    ['#D9E6F2', '#B7CFE6', '#94B8D6', '#739FC3'],
    progress: ['#4B7DB4', '#3C6AA0', '#2E588B', '#234775'],
    text:     '#1C3A5E',
    accent:   '#4B7DB4',
  },
  // Building B — warm plum.
  B: {
    fills:    ['#E8D6E4', '#D6B4D0', '#BE92B6', '#A5729B'],
    progress: ['#7E4E79', '#6B4168', '#583457', '#452945'],
    text:     '#3F233D',
    accent:   '#7E4E79',
  },
  // Building C — sea teal.
  C: {
    fills:    ['#D1EBE3', '#A8D8CB', '#80C2B1', '#5BA894'],
    progress: ['#3D8777', '#327166', '#275C53', '#1E4841'],
    text:     '#1B3D36',
    accent:   '#3D8777',
  },
  // Building D — dusty rose.
  D: {
    fills:    ['#EED9D2', '#DDB5AC', '#C79187', '#AE7165'],
    progress: ['#905149', '#7A423B', '#62342E', '#4B2722'],
    text:     '#432521',
    accent:   '#905149',
  },
  // Clubhouse — warm amber. Same curve, different hue.
  CL: {
    fills:    ['#F1E2BE', '#E6CC8D', '#D2AE59', '#B3902F'],
    progress: ['#8D6F1D', '#765B16', '#5F4910', '#483709'],
    text:     '#3F300A',
    accent:   '#8D6F1D',
  },
  // Fallback for unrecognized building keys.
  _other: {
    fills:    ['#E3E0DB', '#CCC7BE', '#B5AEA0', '#9C9383'],
    progress: ['#7A7363', '#625C4F', '#4B463C', '#363229'],
    text:     '#302C24',
    accent:   '#7A7363',
  },
};

// Parse building letter + section number from wbs like "Building A / Section 3".
function buildingKey(raw: string | null | undefined): { key: string; section: number } {
  if (!raw) return { key: '_sitework', section: 1 };
  const trimmed = raw.trim();
  if (/clubhouse/i.test(trimmed)) {
    const sMatch = /section\s*(\d+)/i.exec(trimmed);
    return { key: 'CL', section: sMatch ? Math.max(1, Math.min(4, parseInt(sMatch[1], 10))) : 1 };
  }
  const bMatch = /Building\s+([A-Z])/i.exec(trimmed);
  const sMatch = /Section\s*(\d+)/i.exec(trimmed);
  if (bMatch) {
    const letter = bMatch[1].toUpperCase();
    const key = BUILDING_PALETTES[letter] ? letter : '_other';
    return { key, section: sMatch ? Math.max(1, Math.min(4, parseInt(sMatch[1], 10))) : 1 };
  }
  return { key: '_other', section: 1 };
}

function paletteFor(segment: { raw: { wbs?: string | null; }; status: RowStatus }): {
  fill: string; progressFill: string; text: string;
} {
  // Behind trumps everything — red is the alarm color.
  if (segment.status === 'behind') {
    return { fill: STATUS_BAR.behind.fill, progressFill: STATUS_BAR.behind.progressFill, text: STATUS_BAR.behind.text };
  }
  const { key, section } = buildingKey(segment.raw?.wbs);
  const palette = BUILDING_PALETTES[key] ?? BUILDING_PALETTES._other;
  const idx = Math.max(0, Math.min(3, section - 1));
  return { fill: palette.fills[idx], progressFill: palette.progress[idx], text: palette.text };
}

function groupAccent(buildingKey: string): string {
  const palette = BUILDING_PALETTES[buildingKey];
  if (palette) return palette.accent;
  return BUILDING_PALETTES._other.accent;
}

const STATUS_ICON: Record<RowStatus, React.ComponentType<{ size?: number; color?: string }>> = {
  completed: CheckCircle2,
  active:    Clock,
  behind:    AlertTriangle,
  upcoming:  Circle,
};

// ── Pure helpers ───────────────────────────────────────────

function sectionLabelFor(wbs: string | null | undefined): string {
  if (!wbs) return '';
  const parts = wbs.split('/').map((s) => s.trim());
  if (parts.length >= 2) {
    // "Building A / Section 1" → "A1"
    const building = parts[0];
    const section = parts[1];
    const bMatch = /Building\s+([A-Z])/i.exec(building);
    const sMatch = /Section\s+(\d+)/i.exec(section);
    if (bMatch && sMatch) return `${bMatch[1].toUpperCase()}${sMatch[1]}`;
    // "Clubhouse"
    if (/clubhouse/i.test(building)) return 'CL';
  }
  // Fallback: initials or first 3 chars
  return parts[parts.length - 1].slice(0, 3).toUpperCase();
}

function statusOf(p: SchedulePhase): RowStatus {
  if (p.status === 'completed') return 'completed';
  if (p.status === 'delayed' || p.status === 'at_risk') return 'behind';
  if (p.status === 'active' || p.status === 'on_track' || p.status === 'in_progress') return 'active';
  return 'upcoming';
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function buildingSortOrder(b: string): number {
  if (b === UNGROUPED_LABEL) return 0;
  if (b === 'Clubhouse') return 900;
  if (b.startsWith('Building ')) return 100 + b.charCodeAt(9);
  return 800;
}

function groupPhases(phases: SchedulePhase[]): BuildingGroup[] {
  const byBuilding = new Map<string, SchedulePhase[]>();
  for (const p of phases) {
    const b = buildingOf(p);
    (byBuilding.get(b) ?? byBuilding.set(b, []).get(b)!).push(p);
  }

  const groups: BuildingGroup[] = [];

  for (const [building, buildingPhases] of byBuilding) {
    // Group by activity name within this building.
    const byName = new Map<string, SchedulePhase[]>();
    for (const p of buildingPhases) {
      const name = (p.name ?? '').trim() || '(unnamed)';
      (byName.get(name) ?? byName.set(name, []).get(name)!).push(p);
    }

    const rows: ActivityRow[] = [];
    for (const [name, rowPhases] of byName) {
      const segments: Segment[] = rowPhases
        .filter((p) => p.startDate && p.endDate)
        .map((p): Segment => ({
          id: p.id,
          sectionLabel: sectionLabelFor((p as { wbs?: string | null }).wbs ?? null),
          startDate: p.startDate,
          endDate: p.endDate,
          percentComplete: Math.max(0, Math.min(100, Math.round(p.percent_complete ?? 0))),
          status: statusOf(p),
          isMilestone: (p as { is_milestone?: boolean }).is_milestone === true,
          raw: p,
        }))
        .sort((a, b) => a.startDate.localeCompare(b.startDate));

      if (segments.length === 0) continue;

      const minStart = segments.reduce((m, s) => (s.startDate < m ? s.startDate : m), segments[0].startDate);
      const maxEnd = segments.reduce((m, s) => (s.endDate > m ? s.endDate : m), segments[0].endDate);
      const aggregateProgress = Math.round(
        segments.reduce((sum, s) => sum + s.percentComplete, 0) / segments.length,
      );

      rows.push({
        key: `${building}::${name}`,
        name,
        building,
        segments,
        minStart,
        maxEnd,
        aggregateProgress,
      });
    }

    rows.sort((a, b) => {
      if (a.minStart !== b.minStart) return a.minStart.localeCompare(b.minStart);
      return a.name.localeCompare(b.name);
    });

    const totalSegments = rows.reduce((n, r) => n + r.segments.length, 0);
    const completed = rows.reduce((n, r) => n + r.segments.filter((s) => s.status === 'completed').length, 0);
    const behind = rows.reduce((n, r) => n + r.segments.filter((s) => s.status === 'behind').length, 0);
    const active = rows.reduce((n, r) => n + r.segments.filter((s) => s.status === 'active').length, 0);
    const progress = totalSegments > 0
      ? Math.round((rows.reduce((sum, r) => sum + r.segments.reduce((s2, seg) => s2 + seg.percentComplete, 0), 0)) / totalSegments)
      : 0;
    const status: RowStatus = (() => {
      if (totalSegments > 0 && completed === totalSegments) return 'completed';
      if (behind > 0) return 'behind';
      if (active > 0) return 'active';
      return 'upcoming';
    })();

    groups.push({
      key: building,
      label: building,
      rows,
      totalSegments,
      completed,
      behind,
      active,
      progress,
      status,
    });
  }

  groups.sort((a, b) => buildingSortOrder(a.key) - buildingSortOrder(b.key) || a.label.localeCompare(b.label));
  return groups;
}

// ── Timeline ───────────────────────────────────────────────

interface TimelineBounds {
  min: string;    // earliest date
  max: string;    // latest date
  days: number;   // days between
  pxPerDay: number;
  width: number;  // total timeline width in px
}

function computeBounds(phases: SchedulePhase[], zoom: ZoomLevel): TimelineBounds | null {
  const starts: number[] = [];
  const ends: number[] = [];
  for (const p of phases) {
    if (p.startDate) starts.push(new Date(p.startDate).getTime());
    if (p.endDate) ends.push(new Date(p.endDate).getTime());
  }
  if (starts.length === 0 || ends.length === 0) return null;

  // Pad by 1 week before + 2 weeks after so today-line and hover tooltips
  // have room to breathe.
  const minMs = Math.min(...starts) - 7 * 86_400_000;
  const maxMs = Math.max(...ends) + 14 * 86_400_000;
  const min = new Date(minMs).toISOString().split('T')[0];
  const max = new Date(maxMs).toISOString().split('T')[0];
  const days = Math.max(1, Math.round((maxMs - minMs) / 86_400_000));
  const pxPerDay = CELL_WIDTH[zoom] / CELL_DAYS[zoom];
  return { min, max, days, pxPerDay, width: days * pxPerDay };
}

function xOf(date: string, bounds: TimelineBounds): number {
  return daysBetween(bounds.min, date) * bounds.pxPerDay;
}

// Month labels and week / quarter grid ticks.
function buildTicks(bounds: TimelineBounds, zoom: ZoomLevel): { date: string; x: number; major: boolean; label: string }[] {
  const ticks: { date: string; x: number; major: boolean; label: string }[] = [];
  const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' });
  const weekFmt = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric' });

  // Walk month boundaries always; plus finer ticks depending on zoom.
  const start = new Date(bounds.min);
  start.setUTCDate(1);
  const end = new Date(bounds.max);

  const cur = new Date(start);
  while (cur <= end) {
    const iso = cur.toISOString().split('T')[0];
    ticks.push({
      date: iso,
      x: xOf(iso, bounds),
      major: true,
      label: monthFmt.format(cur).replace(' ', ' ').toUpperCase(),
    });
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }

  if (zoom === 'day' || zoom === 'week') {
    // Add week ticks (Mondays).
    const w = new Date(bounds.min);
    const dow = w.getUTCDay();
    const toMonday = (8 - dow) % 7;
    w.setUTCDate(w.getUTCDate() + toMonday);
    while (w <= end) {
      const iso = w.toISOString().split('T')[0];
      ticks.push({
        date: iso,
        x: xOf(iso, bounds),
        major: false,
        label: weekFmt.format(w),
      });
      w.setUTCDate(w.getUTCDate() + 7);
    }
  }

  return ticks;
}

// ── Component ──────────────────────────────────────────────

interface ScheduleCanvasProps {
  phases: SchedulePhase[];
  zoom: ZoomLevel;
  showBaseline?: boolean;
  onSelectPhase?: (phase: SchedulePhase) => void;
  onPhaseUpdate?: (id: string, updates: { start_date?: string; end_date?: string }) => void;
}

export const ScheduleCanvas: React.FC<ScheduleCanvasProps> = ({ phases, zoom, showBaseline = false, onSelectPhase, onPhaseUpdate }) => {
  const groups = useMemo(() => groupPhases(phases), [phases]);
  const bounds = useMemo(() => computeBounds(phases, zoom), [phases, zoom]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggleGroup = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Tooltip state
  const [tooltip, setTooltip] = useState<{ x: number; y: number; seg: Segment; row: ActivityRow } | null>(null);

  // Build a lookup: phaseId → { rowIndex, segIndex, y position } for dependency arrows.
  const segmentPositions = useMemo(() => {
    const map = new Map<string, { x: number; xEnd: number; y: number }>();
    if (!bounds) return map;
    let y = 0;
    for (const g of groups) {
      y += GROUP_HEADER_H;
      if (!collapsed.has(g.key)) {
        for (const r of g.rows) {
          for (const seg of r.segments) {
            const sx = xOf(seg.startDate, bounds);
            const ex = xOf(addDays(seg.endDate, 1), bounds);
            map.set(seg.id, { x: sx, xEnd: Math.max(sx + 6, ex), y: y + ROW_H / 2 });
          }
          y += ROW_H;
        }
      }
    }
    return map;
  }, [groups, bounds, collapsed]);

  // Build dependency edges: predecessor → successor
  const depEdges = useMemo(() => {
    const edges: Array<{ fromId: string; toId: string }> = [];
    for (const p of phases) {
      const preds = p.predecessorIds ?? p.predecessor_ids ?? [];
      if (preds && preds.length > 0) {
        for (const predId of preds) {
          if (predId) edges.push({ fromId: predId, toId: p.id });
        }
      }
    }
    return edges;
  }, [phases]);

  // Scroll container ref (the right-hand timeline body) + sticky header refs.
  const bodyRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);

  // Sync header horizontal scroll with body; sync left column vertical scroll with body.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const onScroll = () => {
      if (headerRef.current) headerRef.current.scrollLeft = body.scrollLeft;
      if (leftRef.current) leftRef.current.scrollTop = body.scrollTop;
    };
    body.addEventListener('scroll', onScroll, { passive: true });
    return () => body.removeEventListener('scroll', onScroll);
  }, []);

  // On first render with valid bounds, jump horizontal scroll to show "today"
  // (or earliest upcoming work if today is out of range).
  useEffect(() => {
    if (!bounds || !bodyRef.current) return;
    const today = new Date().toISOString().split('T')[0];
    const target = today >= bounds.min && today <= bounds.max ? today : bounds.min;
    const x = xOf(target, bounds);
    const el = bodyRef.current;
    el.scrollLeft = Math.max(0, x - el.clientWidth / 2);
  }, [bounds]);

  if (!bounds) {
    return (
      <div style={{
        height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: colors.textTertiary, fontFamily: typography.fontFamily,
      }}>
        No activities with dates yet.
      </div>
    );
  }

  const ticks = buildTicks(bounds, zoom);
  const today = new Date().toISOString().split('T')[0];
  const todayX = today >= bounds.min && today <= bounds.max ? xOf(today, bounds) : null;

  // Total body height = sum of group heights.
  const groupHeightOf = (g: BuildingGroup): number =>
    GROUP_HEADER_H + (collapsed.has(g.key) ? 0 : g.rows.length * ROW_H);
  const totalBodyH = groups.reduce((h, g) => h + groupHeightOf(g), 0);

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `${LEFT_RAIL_W}px 1fr`,
      gridTemplateRows: `${TIMELINE_H}px 1fr`,
      border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.xl,
      overflow: 'hidden', backgroundColor: colors.white,
      height: 'calc(100vh - 220px)', minHeight: 520,
      fontFamily: typography.fontFamily,
      position: 'relative',
    }}>
      {/* ── Corner (top-left, above rail) ── */}
      <div style={{
        gridColumn: '1', gridRow: '1',
        borderRight: `1px solid ${colors.borderSubtle}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
        display: 'flex', alignItems: 'center', padding: `0 ${spacing['5']}`,
        backgroundColor: colors.surfaceRaised,
      }}>
        <span style={{
          fontSize: typography.fontSize.caption, letterSpacing: typography.letterSpacing.wider,
          color: colors.textTertiary, fontWeight: typography.fontWeight.semibold,
          textTransform: 'uppercase',
        }}>
          Activity
        </span>
      </div>

      {/* ── Timeline header (scrollable horizontally, synced with body) ── */}
      <div
        ref={headerRef}
        style={{
          gridColumn: '2', gridRow: '1',
          borderBottom: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.surfaceRaised,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div style={{ width: bounds.width, height: '100%', position: 'relative' }}>
          {ticks.filter((t) => t.major).map((t) => (
            <div key={`m-${t.date}`} style={{
              position: 'absolute', left: t.x, top: 0, bottom: 0,
              borderLeft: `1px solid ${colors.borderSubtle}`,
              paddingLeft: 8, display: 'flex', alignItems: 'center',
            }}>
              <span style={{
                fontSize: typography.fontSize.caption,
                letterSpacing: typography.letterSpacing.wider,
                color: colors.textSecondary,
                fontWeight: typography.fontWeight.semibold,
                textTransform: 'uppercase',
              }}>
                {t.label}
              </span>
            </div>
          ))}
          {(zoom === 'day' || zoom === 'week') && ticks.filter((t) => !t.major).map((t) => (
            <div key={`w-${t.date}`} style={{
              position: 'absolute', left: t.x, bottom: 4,
              fontSize: 10, color: colors.textTertiary, fontVariantNumeric: 'tabular-nums',
              paddingLeft: 4,
            }}>
              {t.label}
            </div>
          ))}
          {todayX !== null && (
            <div style={{
              position: 'absolute', left: todayX - 1, top: 0, bottom: 0, width: 2,
              backgroundColor: '#F97316',
            }}>
              <div style={{
                position: 'absolute', top: 6, left: 4,
                backgroundColor: '#F97316', color: 'white',
                padding: '2px 6px', borderRadius: borderRadius.full,
                fontSize: 9, fontWeight: typography.fontWeight.bold,
                letterSpacing: typography.letterSpacing.wider, textTransform: 'uppercase',
              }}>
                Today
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Left column (activity names, synced with body vertical scroll) ── */}
      <div
        ref={leftRef}
        style={{
          gridColumn: '1', gridRow: '2',
          borderRight: `1px solid ${colors.borderSubtle}`,
          overflow: 'hidden',
          backgroundColor: colors.white,
        }}
      >
        <div style={{ height: totalBodyH }}>
          {groups.map((g) => (
            <React.Fragment key={g.key}>
              <GroupHeader
                group={g}
                collapsed={collapsed.has(g.key)}
                onToggle={() => toggleGroup(g.key)}
              />
              {!collapsed.has(g.key) && g.rows.map((r) => (
                <LeftRow key={r.key} row={r} />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Body: timeline with bars ── */}
      <div
        ref={bodyRef}
        style={{
          gridColumn: '2', gridRow: '2',
          overflow: 'auto',
          position: 'relative',
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <div style={{ width: bounds.width, height: Math.max(totalBodyH, 400), position: 'relative' }}>
          {/* Weekend shading — subtle columns for Sat/Sun in day & week zoom */}
          {(zoom === 'day' || zoom === 'week') && (() => {
            const weekends: React.ReactNode[] = [];
            const startDate = new Date(bounds.min);
            const endDate = new Date(bounds.max);
            const cur = new Date(startDate);
            while (cur <= endDate) {
              const dow = cur.getUTCDay();
              if (dow === 0 || dow === 6) {
                const iso = cur.toISOString().split('T')[0];
                const wx = xOf(iso, bounds);
                weekends.push(
                  <div key={`we-${iso}`} style={{
                    position: 'absolute', left: wx, top: 0,
                    width: bounds.pxPerDay, height: '100%',
                    backgroundColor: '#F8F6F4',
                    opacity: 0.5,
                    pointerEvents: 'none',
                  }} />,
                );
              }
              cur.setUTCDate(cur.getUTCDate() + 1);
            }
            return weekends;
          })()}

          {/* Alternating row stripes for readability */}
          {(() => {
            let y = 0;
            const stripes: React.ReactNode[] = [];
            let rowIdx = 0;
            for (const g of groups) {
              y += GROUP_HEADER_H;
              if (!collapsed.has(g.key)) {
                for (const r of g.rows) {
                  if (rowIdx % 2 === 1) {
                    stripes.push(
                      <div key={`stripe-${r.key}`} style={{
                        position: 'absolute', left: 0, top: y, width: '100%', height: ROW_H,
                        backgroundColor: colors.surfaceInset, opacity: 0.3, pointerEvents: 'none',
                      }} />,
                    );
                  }
                  y += ROW_H;
                  rowIdx++;
                }
              }
            }
            return stripes;
          })()}

          {/* Vertical month gridlines */}
          {ticks.filter((t) => t.major).map((t) => (
            <div key={`gl-${t.date}`} style={{
              position: 'absolute', left: t.x, top: 0, bottom: 0, width: 1,
              backgroundColor: colors.borderSubtle, opacity: 0.4, pointerEvents: 'none',
            }} />
          ))}

          {/* Today line — prominent orange with soft gradient glow */}
          {todayX !== null && (
            <>
              {/* Glow halo */}
              <div style={{
                position: 'absolute', left: todayX - 12, top: 0, bottom: 0, width: 24,
                background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.08), transparent)',
                pointerEvents: 'none',
              }} />
              {/* Crisp line */}
              <div style={{
                position: 'absolute', left: todayX - 1, top: 0, bottom: 0, width: 2,
                backgroundColor: '#F97316', pointerEvents: 'none',
                boxShadow: '0 0 6px rgba(249,115,22,0.3)',
              }} />
            </>
          )}

          {/* Rows with baseline + actual bars */}
          {(() => {
            let y = 0;
            const nodes: React.ReactNode[] = [];
            for (const g of groups) {
              nodes.push(
                <BodyGroupHeader key={`gh-${g.key}`} y={y} width={bounds.width} />,
              );
              y += GROUP_HEADER_H;
              if (!collapsed.has(g.key)) {
                for (const r of g.rows) {
                  nodes.push(
                    <BodyRow
                      key={`br-${r.key}`}
                      row={r}
                      y={y}
                      bounds={bounds}
                      width={bounds.width}
                      showBaseline={showBaseline}
                      onSelect={onSelectPhase}
                      onPhaseUpdate={onPhaseUpdate}
                      onHover={(seg, rect) => {
                        if (seg && rect) {
                          setTooltip({ x: rect.x, y: rect.y, seg, row: r });
                        } else {
                          setTooltip(null);
                        }
                      }}
                    />,
                  );
                  y += ROW_H;
                }
              }
            }
            return nodes;
          })()}

          {/* ── Dependency arrows (SVG overlay) ── */}
          <svg
            style={{
              position: 'absolute', top: 0, left: 0,
              width: bounds.width, height: Math.max(totalBodyH, 400),
              pointerEvents: 'none', overflow: 'visible',
            }}
          >
            <defs>
              <marker
                id="dep-arrow"
                viewBox="0 0 10 10"
                refX="8" refY="5"
                markerWidth="5" markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M2 1L8 5L2 9" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
              <marker
                id="dep-arrow-critical"
                viewBox="0 0 10 10"
                refX="8" refY="5"
                markerWidth="5" markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M2 1L8 5L2 9" fill="none" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>
            {depEdges.map((edge) => {
              const from = segmentPositions.get(edge.fromId);
              const to = segmentPositions.get(edge.toId);
              if (!from || !to) return null;

              // Check if both source and target are on the critical path
              const fromPhase = phases.find(p => p.id === edge.fromId);
              const toPhase = phases.find(p => p.id === edge.toId);
              const isCriticalEdge = fromPhase?.is_critical_path && toPhase?.is_critical_path;

              // L-shaped connector: from right edge of predecessor → left edge of successor
              const x1 = from.xEnd;
              const y1 = from.y;
              const x2 = to.x;
              const y2 = to.y;
              const midX = x1 + Math.max(8, (x2 - x1) * 0.3);

              return (
                <path
                  key={`dep-${edge.fromId}-${edge.toId}`}
                  d={y1 === y2
                    ? `M${x1} ${y1} L${x2} ${y2}`
                    : `M${x1} ${y1} L${midX} ${y1} L${midX} ${y2} L${x2} ${y2}`
                  }
                  fill="none"
                  stroke={isCriticalEdge ? '#DC2626' : '#9CA3AF'}
                  strokeWidth={isCriticalEdge ? 1.5 : 1}
                  strokeDasharray={isCriticalEdge ? 'none' : '4 3'}
                  opacity={isCriticalEdge ? 0.7 : 0.45}
                  markerEnd={isCriticalEdge ? 'url(#dep-arrow-critical)' : 'url(#dep-arrow)'}
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* ── Hover tooltip ── */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x + 12,
          top: tooltip.y - 8,
          zIndex: 50,
          backgroundColor: colors.surfaceRaised,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: borderRadius.lg,
          padding: `${spacing['3']} ${spacing['4']}`,
          minWidth: 220, maxWidth: 320,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
          fontFamily: typography.fontFamily,
          pointerEvents: 'none',
        }}>
          <div style={{
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            marginBottom: spacing['1'],
          }}>
            {tooltip.row.name}
          </div>
          {tooltip.seg.sectionLabel && (
            <div style={{
              fontSize: typography.fontSize.caption,
              color: colors.textTertiary,
              marginBottom: spacing['2'],
            }}>
              {tooltip.seg.sectionLabel}
            </div>
          )}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: `${spacing['1']} ${spacing['4']}`,
            fontSize: typography.fontSize.sm,
          }}>
            <div>
              <span style={{ color: colors.textTertiary }}>Start</span>
              <div style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
                {new Date(tooltip.seg.startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
              </div>
            </div>
            <div>
              <span style={{ color: colors.textTertiary }}>Finish</span>
              <div style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
                {new Date(tooltip.seg.endDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
              </div>
            </div>
            <div>
              <span style={{ color: colors.textTertiary }}>Duration</span>
              <div style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                {daysBetween(tooltip.seg.startDate, tooltip.seg.endDate)}d
              </div>
            </div>
            <div>
              <span style={{ color: colors.textTertiary }}>Progress</span>
              <div style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                {tooltip.seg.percentComplete}%
              </div>
            </div>
          </div>
          {/* Progress micro-bar */}
          <div style={{
            marginTop: spacing['2'],
            height: 4, borderRadius: 2, backgroundColor: colors.surfaceInset,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${tooltip.seg.percentComplete}%`,
              backgroundColor: paletteFor(tooltip.seg).progressFill,
              transition: 'width 0.3s ease',
            }} />
          </div>
          {/* Critical path / float info */}
          {tooltip.seg.raw.is_critical_path && (
            <div style={{
              marginTop: spacing['2'],
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: borderRadius.full,
              backgroundColor: '#FEF2F2', color: '#DC2626',
              fontSize: 10, fontWeight: typography.fontWeight.bold,
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              <AlertTriangle size={10} /> Critical path · {tooltip.seg.raw.floatDays ?? 0}d float
            </div>
          )}
          {/* Baseline variance */}
          {tooltip.seg.raw.baselineEndDate && tooltip.seg.raw.endDate && (
            <div style={{
              marginTop: spacing['1'],
              fontSize: typography.fontSize.caption,
              color: tooltip.seg.raw.slippageDays > 0 ? '#DC2626' : '#16A34A',
              fontWeight: typography.fontWeight.medium,
            }}>
              {tooltip.seg.raw.slippageDays > 0
                ? `${tooltip.seg.raw.slippageDays}d behind baseline`
                : tooltip.seg.raw.slippageDays < 0
                  ? `${Math.abs(tooltip.seg.raw.slippageDays)}d ahead of baseline`
                  : 'On baseline'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Left rail pieces ────────────────────────────────────────

const GroupHeader: React.FC<{
  group: BuildingGroup;
  collapsed: boolean;
  onToggle: () => void;
}> = ({ group, collapsed, onToggle }) => {
  // Building family color drives the left rail + icon tint; status pill
  // still uses the red alarm when anything in the group is behind.
  const buildingPaletteKey = (() => {
    if (group.key === UNGROUPED_LABEL) return '_sitework';
    if (/clubhouse/i.test(group.key)) return 'CL';
    const m = /Building\s+([A-Z])/i.exec(group.key);
    return m ? m[1].toUpperCase() : '_other';
  })();
  const accent = groupAccent(buildingPaletteKey);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      style={{
        width: '100%', height: GROUP_HEADER_H, textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: spacing['2'],
        padding: `0 ${spacing['4']}`,
        backgroundColor: colors.surfaceInset,
        borderTop: `1px solid ${colors.borderSubtle}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
        border: 'none',
        borderLeft: `3px solid ${accent}`,
        cursor: 'pointer', fontFamily: typography.fontFamily,
      }}
    >
      {collapsed
        ? <ChevronRight size={14} color={colors.textSecondary} />
        : <ChevronDown size={14} color={colors.textSecondary} />}
      <Building2 size={14} color={accent} />
      <span style={{
        fontSize: typography.fontSize.body,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
        letterSpacing: typography.letterSpacing.normal,
      }}>
        {group.label}
      </span>
      <span style={{ flex: 1 }} />
      <span style={{
        fontSize: typography.fontSize.caption, color: colors.textTertiary,
        fontVariantNumeric: 'tabular-nums', fontWeight: typography.fontWeight.medium,
      }}>
        {group.rows.length} tasks · {group.totalSegments} runs · {group.progress}%
      </span>
      {group.behind > 0 && (
        <span style={{
          padding: '1px 8px', borderRadius: borderRadius.full,
          backgroundColor: STATUS_BAR.behind.fill, color: STATUS_BAR.behind.text,
          fontSize: 10, fontWeight: typography.fontWeight.bold,
          letterSpacing: typography.letterSpacing.wider, textTransform: 'uppercase',
        }}>
          {group.behind} behind
        </span>
      )}
    </button>
  );
};

const LeftRow: React.FC<{ row: ActivityRow }> = ({ row }) => {
  const overallStatus: RowStatus = (() => {
    if (row.segments.every((s) => s.status === 'completed')) return 'completed';
    if (row.segments.some((s) => s.status === 'behind')) return 'behind';
    if (row.segments.some((s) => s.status === 'active')) return 'active';
    return 'upcoming';
  })();
  const Icon = STATUS_ICON[overallStatus];
  const color = STATUS_BAR[overallStatus].progressFill;
  const isCritical = row.segments.some(s => s.raw.is_critical_path === true);
  const floatDays = row.segments[0]?.raw.floatDays ?? null;

  return (
    <div style={{
      height: ROW_H, display: 'flex', alignItems: 'center', gap: spacing['2'],
      padding: `0 ${spacing['4']}`,
      borderBottom: `1px solid ${colors.borderSubtle}40`,
      fontFamily: typography.fontFamily,
      borderLeft: isCritical ? '2px solid #DC2626' : '2px solid transparent',
      transition: `background-color ${transitions.quick}`,
    }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <Icon size={12} color={color} />
      <span style={{
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        color: colors.textPrimary,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
      }}>
        {row.name}
      </span>
      {row.segments.length > 1 && (
        <span style={{
          fontSize: 10, color: colors.textTertiary,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {row.segments.length}×
        </span>
      )}
      {/* Float indicator — only show when meaningful */}
      {floatDays !== null && floatDays >= 0 && overallStatus !== 'completed' && (
        <span style={{
          fontSize: 10,
          fontVariantNumeric: 'tabular-nums',
          fontWeight: typography.fontWeight.medium,
          color: floatDays === 0 ? '#DC2626' : floatDays <= 5 ? '#D97706' : colors.textTertiary,
          minWidth: 20, textAlign: 'right',
        }}>
          {floatDays}d
        </span>
      )}
      <span style={{
        fontSize: typography.fontSize.caption, color: colors.textSecondary,
        fontVariantNumeric: 'tabular-nums',
        fontWeight: typography.fontWeight.medium, minWidth: 32, textAlign: 'right',
      }}>
        {row.aggregateProgress}%
      </span>
    </div>
  );
};

// ── Body pieces ─────────────────────────────────────────────

const BodyGroupHeader: React.FC<{ y: number; width: number }> = ({ y, width }) => (
  <div style={{
    position: 'absolute', top: y, left: 0, width, height: GROUP_HEADER_H,
    backgroundColor: colors.surfaceInset,
    borderTop: `1px solid ${colors.borderSubtle}`,
    borderBottom: `1px solid ${colors.borderSubtle}`,
    pointerEvents: 'none',
  }} />
);

const BASELINE_H = 6;

const BodyRow: React.FC<{
  row: ActivityRow;
  y: number;
  bounds: TimelineBounds;
  width: number;
  showBaseline?: boolean;
  onSelect?: (p: SchedulePhase) => void;
  onPhaseUpdate?: (id: string, updates: { start_date?: string; end_date?: string }) => void;
  onHover?: (seg: Segment | null, rect: { x: number; y: number } | null) => void;
}> = ({ row, y, bounds, width, showBaseline, onSelect, onPhaseUpdate, onHover }) => {
  const [dragDx, setDragDx] = useState<Record<string, number>>({});

  const handleBarMouseDown = (seg: Segment, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!onPhaseUpdate) {
      onSelect?.(seg.raw);
      return;
    }
    e.preventDefault();
    const startX = e.clientX;
    const pxPerDay = bounds.pxPerDay;
    let lastDelta = 0;
    let moved = false;

    const onMove = (me: MouseEvent) => {
      const dx = me.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      lastDelta = dx;
      setDragDx((prev) => ({ ...prev, [seg.id]: dx }));
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setDragDx((prev) => {
        const next = { ...prev };
        delete next[seg.id];
        return next;
      });
      if (!moved) {
        onSelect?.(seg.raw);
        return;
      }
      const daysDelta = Math.round(lastDelta / pxPerDay);
      if (daysDelta === 0) return;
      const newStart = addDays(seg.startDate, daysDelta);
      const newEnd = addDays(seg.endDate, daysDelta);
      onPhaseUpdate(seg.id, { start_date: newStart, end_date: newEnd });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
  <div style={{
    position: 'absolute', top: y, left: 0, width, height: ROW_H,
    borderBottom: `1px solid ${colors.borderSubtle}30`,
  }}>
    {row.segments.map((seg) => {
      const baseX = xOf(seg.startDate, bounds);
      const offsetPx = dragDx[seg.id] ?? 0;
      const x = baseX + offsetPx;
      const w = Math.max(6, xOf(addDays(seg.endDate, 1), bounds) - baseX);
      const tokens = paletteFor(seg);
      const showChip = w >= 44 && seg.sectionLabel.length > 0;
      const barOpacity = seg.status === 'completed' ? 0.85 : 1;
      const isCritical = seg.raw.is_critical_path === true;
      const showPercentText = w >= 60 && seg.percentComplete > 0;

      // Baseline ghost bar (shown beneath the actual bar when enabled)
      const hasBaseline = showBaseline && seg.raw.baselineStartDate && seg.raw.baselineEndDate;
      const baselineX = hasBaseline ? xOf(seg.raw.baselineStartDate!, bounds) : 0;
      const baselineW = hasBaseline ? Math.max(6, xOf(addDays(seg.raw.baselineEndDate!, 1), bounds) - baselineX) : 0;

      if (seg.isMilestone) {
        return (
          <div
            key={seg.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect?.(seg.raw)}
            aria-label={`${row.name} milestone`}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = 'rotate(45deg) scale(1.25)';
              el.style.boxShadow = isCritical
                ? '0 0 10px rgba(220,38,38,0.5)'
                : `0 0 8px ${tokens.progressFill}60`;
              const rect = el.getBoundingClientRect();
              onHover?.(seg, { x: rect.right, y: rect.top });
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = 'rotate(45deg)';
              el.style.boxShadow = isCritical ? '0 0 6px rgba(220,38,38,0.4)' : 'none';
              onHover?.(null, null);
            }}
            style={{
              position: 'absolute', left: x - 8, top: (ROW_H - 16) / 2, width: 16, height: 16,
              backgroundColor: isCritical ? '#DC2626' : tokens.progressFill,
              transform: 'rotate(45deg)', cursor: 'pointer',
              transition: `transform 200ms cubic-bezier(0.16,1,0.3,1), box-shadow 200ms ease`,
              boxShadow: isCritical ? '0 0 6px rgba(220,38,38,0.4)' : 'none',
              border: isCritical ? '1.5px solid #DC2626' : 'none',
            }}
          />
        );
      }

      return (
        <React.Fragment key={seg.id}>
          {/* ── Baseline ghost bar ── */}
          {hasBaseline && (
            <div
              style={{
                position: 'absolute',
                left: baselineX,
                top: BAR_TOP + BAR_H - 2,
                width: baselineW,
                height: BASELINE_H,
                backgroundColor: '#9CA3AF',
                borderRadius: 3,
                opacity: 0.35,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* ── Actual bar ── */}
          <div
            role="button"
            tabIndex={0}
            onMouseDown={(e) => handleBarMouseDown(seg, e)}
            aria-label={`${row.name} — ${seg.startDate} to ${seg.endDate} — ${seg.percentComplete}%`}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.filter = 'brightness(0.96)';
              el.style.transform = 'scaleY(1.12)';
              el.style.boxShadow = isCritical
                ? '0 2px 8px rgba(220,38,38,0.25), inset 0 0 0 1px rgba(220,38,38,0.15)'
                : '0 2px 8px rgba(0,0,0,0.1)';
              el.style.zIndex = '5';
              const rect = el.getBoundingClientRect();
              onHover?.(seg, { x: rect.right, y: rect.top });
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.filter = 'none';
              el.style.transform = 'none';
              el.style.boxShadow = isCritical
                ? '0 0 0 1px rgba(220,38,38,0.2), inset 0 0 0 1px rgba(220,38,38,0.1)'
                : '0 1px 2px rgba(0,0,0,0.04)';
              el.style.zIndex = '0';
              onHover?.(null, null);
            }}
            style={{
              position: 'absolute', left: x, top: BAR_TOP, width: w, height: BAR_H,
              backgroundColor: tokens.fill,
              borderRadius: 5,
              cursor: 'pointer', overflow: 'hidden', opacity: barOpacity,
              transition: `filter ${transitions.quick}, transform ${transitions.quick}, box-shadow ${transitions.quick}`,
              // Critical path bars get a left accent + subtle glow
              borderLeft: isCritical ? '3px solid #DC2626' : 'none',
              boxShadow: isCritical
                ? '0 0 0 1px rgba(220,38,38,0.2), inset 0 0 0 1px rgba(220,38,38,0.1)'
                : `0 1px 2px rgba(0,0,0,0.04)`,
              transformOrigin: 'center',
            }}
          >
            {/* Progress fill inside the bar */}
            {seg.percentComplete > 0 && (
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${seg.percentComplete}%`,
                backgroundColor: tokens.progressFill, opacity: 0.7,
                borderRadius: seg.percentComplete >= 100 ? 5 : '5px 0 0 5px',
                transition: `width ${transitions.smooth}`,
              }} />
            )}
            {/* Section chip */}
            {showChip && (
              <span style={{
                position: 'absolute', left: isCritical ? 8 : 6, top: '50%', transform: 'translateY(-50%)',
                fontSize: 9, fontWeight: typography.fontWeight.bold,
                letterSpacing: typography.letterSpacing.wider,
                color: tokens.text, zIndex: 2,
                textTransform: 'uppercase',
              }}>
                {seg.sectionLabel}
              </span>
            )}
            {/* Percent text inside bar (right-aligned) */}
            {showPercentText && (
              <span style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                fontSize: 10, fontWeight: typography.fontWeight.semibold,
                color: seg.percentComplete >= 50 ? 'rgba(255,255,255,0.85)' : tokens.text,
                zIndex: 2, fontVariantNumeric: 'tabular-nums',
              }}>
                {seg.percentComplete}%
              </span>
            )}
          </div>
        </React.Fragment>
      );
    })}
  </div>
  );
};

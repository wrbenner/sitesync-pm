import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, SkipForward, Columns, Flag, DollarSign, Users, HelpCircle, Camera, Calendar, Sparkles, AlertCircle } from 'lucide-react';
import { PageContainer, Card, Btn, ProgressBar, Skeleton, EmptyState } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { useProjectId } from '../hooks/useProjectId';
import { useProjectSnapshots } from '../hooks/queries';
import type { ProjectSnapshot, Json } from '../types/database';

interface TimeSnapshot {
  date: string;
  label: string;
  progress: number;
  budgetSpent: number;
  budgetTotal: number;
  openRfis: number;
  crewCount: number;
  workersOnSite: number;
  photos: number;
  milestone?: string;
  event?: string;
  eventType?: 'milestone' | 'change_order' | 'incident';
  keyEvents?: { title: string; type: string }[];
}

function formatSnapshotLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) {
    return 'Today';
  }
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function safeNum(val: unknown, fallback: number = 0): number {
  return typeof val === 'number' ? val : fallback;
}

function safeStr(val: unknown, fallback: string = ''): string {
  return typeof val === 'string' ? val : fallback;
}

function mapKeyEvents(raw: Json | null): { title: string; type: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => !!e && typeof e === 'object' && !Array.isArray(e))
    .map((e) => {
      const obj = e as Record<string, unknown>;
      return {
        title: safeStr(obj.title, 'Event'),
        type: safeStr(obj.type, 'info'),
      };
    });
}

function mapSnapshot(s: ProjectSnapshot): TimeSnapshot {
  const d = (s.data ?? {}) as Record<string, unknown>;
  const milestone = safeStr(d.milestone) || undefined;
  const event = safeStr(d.event) || undefined;
  const rawEventType = safeStr(d.event_type);
  const eventType = (['milestone', 'change_order', 'incident'].includes(rawEventType)
    ? rawEventType
    : milestone ? 'milestone' : undefined) as TimeSnapshot['eventType'];

  return {
    date: s.snapshot_date,
    label: formatSnapshotLabel(s.snapshot_date),
    progress: safeNum(d.progress),
    budgetSpent: safeNum(d.budget_spent),
    budgetTotal: safeNum(d.budget_total, 47.5),
    openRfis: safeNum(d.open_rfis),
    crewCount: safeNum(d.crew_count),
    workersOnSite: safeNum(d.workers_on_site),
    photos: safeNum(d.photos),
    milestone,
    event,
    eventType,
    keyEvents: mapKeyEvents(s.key_events),
  };
}

const snapshotPhotos = [
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=200',
  'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=200',
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=200',
  'https://images.unsplash.com/photo-1590644365607-1c5e8a1b6e07?w=200',
];

export const TimeMachine: React.FC = () => {
  const projectId = useProjectId();
  const { data: rawSnapshots, isLoading: loadingSnapshots, isError: errorSnapshots } = useProjectSnapshots(projectId);

  const snapshots = useMemo(() => {
    const mapped = (rawSnapshots ?? [])
      .slice()
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
      .map(mapSnapshot);
    return mapped.length > 0 ? mapped : [];
  }, [rawSnapshots]);

  // null = auto (show latest); number = user selection
  const [manualIndex, setManualIndex] = useState<number | null>(null);
  const currentIndex = manualIndex !== null
    ? Math.min(manualIndex, Math.max(0, snapshots.length - 1))
    : Math.max(0, snapshots.length - 1);
  // Sync ref after each render so interval callback reads latest value
  const currentIndexRef = useRef(0);
  useEffect(() => { currentIndexRef.current = currentIndex; });

  const [playing, setPlaying] = useState(false);
  const [compareIndex, setCompareIndex] = useState<number | null>(null);
  const intervalRef = useRef<number | undefined>(undefined);

  const snap = snapshots[currentIndex] ?? {
    date: '', label: 'Loading', progress: 0, budgetSpent: 0, budgetTotal: 1,
    openRfis: 0, crewCount: 0, workersOnSite: 0, photos: 0,
  };
  const compareSnap = compareIndex !== null ? snapshots[compareIndex] ?? null : null;

  const animBudget = useAnimatedNumber(snap.budgetSpent, 600);
  const animWorkers = useAnimatedNumber(snap.workersOnSite, 600);

  // Auto play
  useEffect(() => {
    if (!playing) return;
    intervalRef.current = window.setInterval(() => {
      const next = currentIndexRef.current + 1;
      if (next >= snapshots.length) {
        setPlaying(false);
        return;
      }
      setManualIndex(next);
    }, 550);
    return () => clearInterval(intervalRef.current);
  }, [playing, snapshots.length]);

  const handleSpeedRun = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setManualIndex(0);
    setTimeout(() => setPlaying(true), 200);
  };

  const rfiColor = snap.openRfis > 5 ? colors.statusCritical : snap.openRfis > 3 ? colors.statusPending : colors.statusActive;

  if (loadingSnapshots) {
    return (
      <PageContainer title="Time Machine" subtitle="Scrub through your project history">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <Skeleton width="100%" height="80px" />
          <Skeleton width="100%" height="200px" />
          <Skeleton width="100%" height="400px" />
        </div>
      </PageContainer>
    );
  }

  if (errorSnapshots) {
    return (
      <PageContainer title="Time Machine" subtitle="Scrub through your project history">
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: spacing['4'], color: colors.statusCritical }}>
            <AlertCircle size={20} />
            <span style={{ fontSize: typography.fontSize.body, color: colors.textSecondary }}>
              Unable to load project snapshots. Check your connection and try again.
            </span>
          </div>
        </Card>
      </PageContainer>
    );
  }

  if (snapshots.length === 0) {
    return (
      <PageContainer title="Time Machine" subtitle="Scrub through your project history">
        <Card padding={spacing['6']}>
          <EmptyState
            icon={<Calendar size={32} color={colors.textTertiary} />}
            title="No snapshots yet"
            description="Project snapshots are created automatically as your project progresses. Check back once work has been recorded."
          />
        </Card>
      </PageContainer>
    );
  }

  const currentEvents = (snap as TimeSnapshot).keyEvents ?? [];

  return (
    <PageContainer title="Time Machine" subtitle="Scrub through your project history">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, marginBottom: spacing['4'], backgroundColor: colors.statusReviewSubtle, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusReview}` }}>
        <Sparkles size={14} color={colors.statusReview} style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0, lineHeight: 1.5 }}>
          AI detected 3 periods of accelerated progress. Patterns suggest weather and crew size are the primary drivers.
        </p>
      </div>
      {/* Metrics for current snapshot */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: spacing['3'], marginBottom: spacing['5'] }}>
        {[
          { icon: <Flag size={16} />, label: 'Progress', value: `${snap.progress}%`, color: colors.primaryOrange },
          { icon: <DollarSign size={16} />, label: 'Spent', value: `$${animBudget.toFixed(1)}M`, color: colors.statusInfo },
          { icon: <HelpCircle size={16} />, label: 'Open RFIs', value: `${snap.openRfis}`, color: snap.openRfis > 5 ? colors.statusPending : colors.textPrimary },
          { icon: <Users size={16} />, label: 'On Site', value: `${Math.round(animWorkers)}`, color: colors.statusActive },
          { icon: <Camera size={16} />, label: 'Photos', value: `${snap.photos}`, color: colors.textSecondary },
        ].map((m) => (
          <Card key={m.label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
              <span style={{ color: colors.textTertiary }}>{m.icon}</span>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>{m.label}</span>
            </div>
            <span style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: m.color }}>{m.value}</span>
          </Card>
        ))}
      </div>

      {/* Progress bar */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['3'] }}>
          <Calendar size={16} color={colors.textTertiary} />
          <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{snap.label}</span>
          {snap.milestone && (
            <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.orangeText, backgroundColor: colors.orangeSubtle, padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.full }}>
              {snap.milestone}
            </span>
          )}
          {snap.event && (
            <span style={{
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
              color: snap.eventType === 'incident' ? colors.statusCritical : colors.statusPending,
              backgroundColor: snap.eventType === 'incident' ? colors.statusCriticalSubtle : colors.statusPendingSubtle,
              padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.full,
            }}>
              {snap.event}
            </span>
          )}
        </div>
        <ProgressBar value={snap.progress} height={8} color={colors.primaryOrange} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing['1'] }}>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>0%</span>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.orangeText, fontWeight: typography.fontWeight.semibold }}>{snap.progress}% complete</span>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>100%</span>
        </div>
      </Card>

      {/* Compare mode */}
      {compareSnap && (
        <Card padding={spacing['4']}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
            <Columns size={14} color={colors.statusReview} />
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusReview }}>Comparing: {compareSnap.label} vs {snap.label}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['3'] }}>
            {[
              { label: 'Progress', a: `${compareSnap.progress}%`, b: `${snap.progress}%`, diff: snap.progress - compareSnap.progress },
              { label: 'Budget', a: `$${compareSnap.budgetSpent}M`, b: `$${snap.budgetSpent}M`, diff: snap.budgetSpent - compareSnap.budgetSpent },
              { label: 'Workers', a: `${compareSnap.workersOnSite}`, b: `${snap.workersOnSite}`, diff: snap.workersOnSite - compareSnap.workersOnSite },
              { label: 'RFIs', a: `${compareSnap.openRfis}`, b: `${snap.openRfis}`, diff: snap.openRfis - compareSnap.openRfis },
            ].map((c) => (
              <div key={c.label} style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, textAlign: 'center' }}>
                <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginBottom: spacing['1'] }}>{c.label}</p>
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>{c.a} → {c.b}</p>
                <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: c.diff > 0 ? colors.statusActive : c.diff < 0 ? colors.statusCritical : colors.textTertiary, margin: 0, marginTop: 2 }}>
                  {c.diff > 0 ? '+' : ''}{typeof c.diff === 'number' && c.label === 'Budget' ? `$${c.diff.toFixed(1)}M` : c.diff}
                </p>
              </div>
            ))}
          </div>

          {/* What Changed table */}
          <div style={{ marginTop: spacing['3'] }}>
            <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0, marginBottom: spacing['2'] }}>What Changed</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: spacing['2'], fontSize: typography.fontSize.caption, color: colors.textTertiary, borderBottom: `1px solid ${colors.borderSubtle}` }}>Metric</th>
                  <th style={{ textAlign: 'right', padding: spacing['2'], fontSize: typography.fontSize.caption, color: colors.textTertiary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{compareSnap.label}</th>
                  <th style={{ textAlign: 'right', padding: spacing['2'], fontSize: typography.fontSize.caption, color: colors.textTertiary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{snap.label}</th>
                  <th style={{ textAlign: 'right', padding: spacing['2'], fontSize: typography.fontSize.caption, color: colors.textTertiary, borderBottom: `1px solid ${colors.borderSubtle}` }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { metric: 'Progress', from: `${compareSnap.progress}%`, to: `${snap.progress}%`, diff: snap.progress - compareSnap.progress, suffix: '%', positive: true },
                  { metric: 'Budget Spent', from: `$${compareSnap.budgetSpent}M`, to: `$${snap.budgetSpent}M`, diff: snap.budgetSpent - compareSnap.budgetSpent, isBudget: true, positive: false },
                  { metric: 'Open RFIs', from: `${compareSnap.openRfis}`, to: `${snap.openRfis}`, diff: snap.openRfis - compareSnap.openRfis, suffix: '', positive: false },
                  { metric: 'Crew Count', from: `${compareSnap.crewCount}`, to: `${snap.crewCount}`, diff: snap.crewCount - compareSnap.crewCount, suffix: '', positive: true },
                  { metric: 'Workers', from: `${compareSnap.workersOnSite}`, to: `${snap.workersOnSite}`, diff: snap.workersOnSite - compareSnap.workersOnSite, suffix: '', positive: true },
                  { metric: 'Photos', from: `${compareSnap.photos}`, to: `${snap.photos}`, diff: snap.photos - compareSnap.photos, suffix: '', positive: true },
                ].map((row) => {
                  const diffVal = row.isBudget ? `$${Math.abs(row.diff).toFixed(1)}M` : `${Math.abs(row.diff)}${row.suffix || ''}`;
                  const isGood = row.positive ? row.diff > 0 : row.diff < 0;
                  const isBad = row.positive ? row.diff < 0 : row.diff > 0;
                  const changeColor = row.diff === 0 ? colors.textTertiary : isGood ? colors.statusActive : isBad ? colors.statusCritical : colors.textTertiary;
                  const prefix = row.diff > 0 ? '+' : row.diff < 0 ? '\u2212' : '';
                  return (
                    <tr key={row.metric}>
                      <td style={{ textAlign: 'left', padding: spacing['2'], fontSize: typography.fontSize.sm, color: colors.textPrimary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{row.metric}</td>
                      <td style={{ textAlign: 'right', padding: spacing['2'], fontSize: typography.fontSize.sm, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{row.from}</td>
                      <td style={{ textAlign: 'right', padding: spacing['2'], fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, borderBottom: `1px solid ${colors.borderSubtle}` }}>{row.to}</td>
                      <td style={{ textAlign: 'right', padding: spacing['2'], fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: changeColor, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        {row.diff === 0 ? 'No change' : `${prefix}${diffVal}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Timeline scrubber */}
      <Card padding={spacing['4']}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['3'] }}>
          <button
            onClick={() => setPlaying(!playing)}
            aria-label={playing ? 'Pause timeline playback' : 'Play timeline'}
            style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryOrange, color: 'white', border: 'none', borderRadius: borderRadius.full, cursor: 'pointer' }}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          {playing && <span style={{ fontSize: typography.fontSize.caption, color: colors.orangeText, fontWeight: typography.fontWeight.semibold }}>Playing...</span>}
          <Btn variant="secondary" size="sm" icon={<SkipForward size={14} />} onClick={handleSpeedRun}>{playing ? 'Stop' : 'Speed Run'}</Btn>
          <Btn
            variant={compareIndex !== null ? 'primary' : 'secondary'}
            size="sm"
            icon={<Columns size={14} />}
            onClick={() => setCompareIndex(compareIndex !== null ? null : 0)}
          >
            {compareIndex !== null ? 'Exit Compare' : 'Compare'}
          </Btn>
        </div>

        {/* Timeline bar */}
        <div style={{ position: 'relative', padding: `${spacing['3']} 0` }}>
          {/* Clean tick marks only */}
          <div style={{ position: 'relative', height: 6, marginBottom: 2 }}>
            {snapshots.map((s, i) => {
              const left = snapshots.length > 1 ? (i / (snapshots.length - 1)) * 100 : 50;
              const hasEvent = s.milestone || s.event;
              if (!hasEvent) return null;
              const eventColor = s.eventType === 'milestone' ? colors.primaryOrange : s.eventType === 'change_order' ? colors.statusPending : s.eventType === 'incident' ? colors.statusCritical : colors.textTertiary;
              return (
                <div
                  key={`tick-${s.date}`}
                  title={s.milestone || s.event || ''}
                  style={{
                    position: 'absolute',
                    left: `${left}%`,
                    transform: 'translateX(-50%)',
                    bottom: 0,
                    width: 2,
                    height: 6,
                    backgroundColor: eventColor,
                    borderRadius: 1,
                    opacity: 0.6,
                  }}
                />
              );
            })}
          </div>

          {/* Track */}
          <div style={{ height: 4, backgroundColor: colors.borderSubtle, borderRadius: 2, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${snapshots.length > 1 ? (currentIndex / (snapshots.length - 1)) * 100 : 100}%`, backgroundColor: colors.primaryOrange, borderRadius: 2, transition: `width ${transitions.quick}` }} />
          </div>

          {/* Event markers */}
          <div style={{ position: 'relative', height: 56, marginTop: -2 }}>
            {snapshots.map((s, i) => {
              const left = snapshots.length > 1 ? (i / (snapshots.length - 1)) * 100 : 50;
              const isCurrent = i === currentIndex;
              const isEvent = s.milestone || s.event;
              const eventColor = s.eventType === 'milestone' ? colors.primaryOrange : s.eventType === 'change_order' ? colors.statusPending : s.eventType === 'incident' ? colors.statusCritical : colors.textTertiary;

              return (
                <button
                  key={s.date}
                  onClick={() => setManualIndex(i)}
                  aria-label={`Go to ${s.label}${s.milestone ? ': ' + s.milestone : s.event ? ': ' + s.event : ''}`}
                  aria-current={isCurrent ? 'true' : undefined}
                  style={{
                    position: 'absolute', left: `${left}%`, top: 0, transform: 'translateX(-50%)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 2,
                    minWidth: 56, minHeight: 56,
                    backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: `${spacing['2']} 0`,
                  }}
                >
                  <div style={{
                    width: isCurrent ? 14 : isEvent ? 10 : 6,
                    height: isCurrent ? 14 : isEvent ? 10 : 6,
                    borderRadius: isEvent ? 2 : '50%',
                    backgroundColor: isCurrent ? colors.primaryOrange : isEvent ? eventColor : colors.borderDefault,
                    border: isCurrent ? '2px solid white' : 'none',
                    boxShadow: isCurrent ? '0 0 0 2px ' + colors.primaryOrange : 'none',
                    transform: isEvent && !isCurrent ? 'rotate(45deg)' : 'none',
                    transition: `all ${transitions.instant}`,
                  }} />
                  <span style={{
                    fontSize: typography.fontSize.caption, color: isCurrent ? colors.orangeText : colors.textTertiary,
                    fontWeight: isCurrent ? typography.fontWeight.semibold : typography.fontWeight.normal,
                    whiteSpace: 'nowrap',
                  }}>
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Compare slider */}
        {compareIndex !== null && (
          <div style={{ marginTop: spacing['2'] }}>
            <label htmlFor="compare-snapshot" style={{ fontSize: typography.fontSize.caption, color: colors.statusReview, fontWeight: typography.fontWeight.medium }}>Compare to: {snapshots[compareIndex]?.label ?? ''}</label>
            <input
              id="compare-snapshot"
              type="range"
              min={0}
              max={snapshots.length - 1}
              value={compareIndex}
              onChange={(e) => setCompareIndex(Number(e.target.value))}
              style={{ width: '100%', accentColor: colors.statusReview, marginTop: spacing['1'] }}
            />
          </div>
        )}
      </Card>

      {/* Project Snapshot section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'], marginTop: spacing['4'] }}>
        {/* Left: Snapshot metric cards in 2x2 grid */}
        <Card padding={spacing['4']}>
          <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0, marginBottom: spacing['3'] }}>Project Snapshot</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            {/* Schedule Progress */}
            <div style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginBottom: spacing['1'] }}>Schedule Progress</p>
              <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.orangeText, margin: 0, marginBottom: spacing['2'] }}>{snap.progress}%</p>
              <div style={{ height: 4, backgroundColor: colors.borderSubtle, borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${snap.progress}%`, backgroundColor: colors.primaryOrange, borderRadius: 2, transition: `width ${transitions.quick}` }} />
              </div>
            </div>

            {/* Budget Spent */}
            <div style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginBottom: spacing['1'] }}>Budget Spent</p>
              <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.statusInfo, margin: 0, marginBottom: spacing['1'] }}>${snap.budgetSpent}M</p>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginBottom: spacing['1'] }}>of ${snap.budgetTotal}M</p>
              <div style={{ height: 4, backgroundColor: colors.borderSubtle, borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${snap.budgetTotal > 0 ? (snap.budgetSpent / snap.budgetTotal) * 100 : 0}%`, backgroundColor: colors.statusInfo, borderRadius: 2, transition: `width ${transitions.quick}` }} />
              </div>
            </div>

            {/* Active RFIs */}
            <div style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginBottom: spacing['1'] }}>Active RFIs</p>
              <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: rfiColor, margin: 0 }}>{snap.openRfis}</p>
            </div>

            {/* Workers on Site */}
            <div style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginBottom: spacing['1'] }}>Workers on Site</p>
              <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{snap.workersOnSite}</p>
            </div>
          </div>
        </Card>

        {/* Right: Events + Photos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          {/* Key Events This Period */}
          <Card padding={spacing['4']}>
            <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0, marginBottom: spacing['3'] }}>Key Events This Period</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              {currentEvents.length === 0 && (
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>No key events recorded for this period.</span>
              )}
              {currentEvents.map((evt, idx) => {
                const dotColor = evt.type === 'milestone' ? colors.primaryOrange : evt.type === 'warning' ? colors.statusPending : colors.statusInfo;
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{evt.title}</span>
                    <span style={{
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.medium,
                      color: evt.type === 'milestone' ? colors.primaryOrange : evt.type === 'warning' ? colors.statusPending : colors.statusInfo,
                      backgroundColor: evt.type === 'milestone' ? colors.orangeSubtle : evt.type === 'warning' ? colors.statusPendingSubtle : colors.statusInfoSubtle,
                      padding: `2px ${spacing['1']}`,
                      borderRadius: borderRadius.full,
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                    }}>
                      {evt.type}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Site Photos */}
          <Card padding={spacing['4']}>
            <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0, marginBottom: spacing['3'] }}>Site Photos</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['2'] }}>
              {snapshotPhotos.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Construction site snapshot ${idx + 1}`}
                  style={{
                    width: '100%',
                    height: 80,
                    objectFit: 'cover',
                    borderRadius: borderRadius.md,
                    backgroundColor: colors.surfaceInset,
                  }}
                />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
};

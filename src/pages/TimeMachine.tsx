import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, Columns, Flag, DollarSign, Users, HelpCircle, Camera, Calendar, Sparkles } from 'lucide-react';
import { PageContainer, Card, Btn, ProgressBar, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';

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
}

const snapshots: TimeSnapshot[] = [
  { date: '2023-06-15', label: 'Jun 2023', progress: 0, budgetSpent: 0, budgetTotal: 47.5, openRfis: 0, crewCount: 2, workersOnSite: 24, photos: 0, milestone: 'Project Start', eventType: 'milestone' },
  { date: '2023-09-01', label: 'Sep 2023', progress: 8, budgetSpent: 3.2, budgetTotal: 47.5, openRfis: 2, crewCount: 4, workersOnSite: 52, photos: 34, milestone: 'Demolition Complete', eventType: 'milestone' },
  { date: '2023-12-15', label: 'Dec 2023', progress: 18, budgetSpent: 8.4, budgetTotal: 47.5, openRfis: 5, crewCount: 6, workersOnSite: 78, photos: 112, milestone: 'Foundation Complete', eventType: 'milestone' },
  { date: '2024-04-01', label: 'Apr 2024', progress: 30, budgetSpent: 14.2, budgetTotal: 47.5, openRfis: 8, crewCount: 8, workersOnSite: 120, photos: 245 },
  { date: '2024-08-15', label: 'Aug 2024', progress: 42, budgetSpent: 20.1, budgetTotal: 47.5, openRfis: 6, crewCount: 10, workersOnSite: 156, photos: 410, milestone: 'Structure Topped Out', eventType: 'milestone' },
  { date: '2024-10-01', label: 'Oct 2024', progress: 48, budgetSpent: 23.8, budgetTotal: 47.5, openRfis: 9, crewCount: 12, workersOnSite: 172, photos: 520, event: 'CO 001: Additional Bracing', eventType: 'change_order' },
  { date: '2025-01-01', label: 'Jan 2025', progress: 55, budgetSpent: 28.4, budgetTotal: 47.5, openRfis: 4, crewCount: 13, workersOnSite: 180, photos: 680, milestone: 'MEP 50% Complete', eventType: 'milestone' },
  { date: '2025-03-01', label: 'Mar 2025', progress: 60, budgetSpent: 30.5, budgetTotal: 47.5, openRfis: 3, crewCount: 14, workersOnSite: 187, photos: 820, event: 'Safety Incident (Resolved)', eventType: 'incident' },
  { date: '2025-03-27', label: 'Today', progress: 62, budgetSpent: 31.2, budgetTotal: 47.5, openRfis: 3, crewCount: 14, workersOnSite: 187, photos: 856 },
];

const periodEvents: Record<number, {title: string; type: string}[]> = {
  0: [{title: 'Ground breaking ceremony', type: 'milestone'}, {title: 'Demolition permits approved', type: 'info'}],
  1: [{title: 'Demolition 100% complete', type: 'milestone'}, {title: 'Foundation excavation started', type: 'info'}],
  2: [{title: 'Foundation pour completed', type: 'milestone'}, {title: 'Structural steel order placed', type: 'info'}, {title: 'First RFI submitted', type: 'info'}],
  3: [{title: 'Steel erection began', type: 'info'}, {title: 'MEP subcontractor mobilized', type: 'info'}],
  4: [{title: 'Structure topped out', type: 'milestone'}, {title: 'Curtain wall panels delivered', type: 'info'}],
  5: [{title: 'Change order CO 001 approved', type: 'warning'}, {title: 'Exterior work started', type: 'info'}],
  6: [{title: 'MEP rough in 50%', type: 'milestone'}, {title: 'Interior framing began', type: 'info'}],
  7: [{title: 'Safety incident reported (resolved)', type: 'warning'}, {title: 'Finishing crew mobilized', type: 'info'}],
  8: [{title: 'Current state', type: 'info'}, {title: '3 critical tasks due this week', type: 'warning'}],
};

const snapshotPhotos = [
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=200',
  'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=200',
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=200',
  'https://images.unsplash.com/photo-1590644365607-1c5e8a1b6e07?w=200',
];

export const TimeMachine: React.FC = () => {
  const { addToast: _addToast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(snapshots.length - 1);
  const [playing, setPlaying] = useState(false);
  const [compareIndex, setCompareIndex] = useState<number | null>(null);
  const intervalRef = useRef<number | undefined>(undefined);

  const snap = snapshots[currentIndex];
  const compareSnap = compareIndex !== null ? snapshots[compareIndex] : null;

  const animBudget = useAnimatedNumber(snap.budgetSpent, 600);
  const animWorkers = useAnimatedNumber(snap.workersOnSite, 600);

  // Auto play
  useEffect(() => {
    if (!playing) return;
    intervalRef.current = window.setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= snapshots.length - 1) { setPlaying(false); return prev; }
        return prev + 1;
      });
    }, 550);
    return () => clearInterval(intervalRef.current);
  }, [playing]);

  const handleSpeedRun = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setCurrentIndex(0);
    setTimeout(() => setPlaying(true), 200);
  };

  const rfiColor = snap.openRfis > 5 ? colors.statusCritical : snap.openRfis > 3 ? colors.statusPending : colors.statusActive;

  return (
    <PageContainer title="Time Machine" subtitle="Scrub through your project history">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', marginBottom: '16px', backgroundColor: 'rgba(124, 93, 199, 0.04)', borderRadius: '8px', borderLeft: '3px solid #7C5DC7' }}>
        <Sparkles size={14} color="#7C5DC7" style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: '13px', color: '#1A1613', margin: 0, lineHeight: 1.5 }}>
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
            <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange, backgroundColor: colors.orangeSubtle, padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.full }}>
              {snap.milestone}
            </span>
          )}
          {snap.event && (
            <span style={{
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
              color: snap.eventType === 'incident' ? colors.statusCritical : colors.statusPending,
              backgroundColor: snap.eventType === 'incident' ? `${colors.statusCritical}08` : `${colors.statusPending}08`,
              padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.full,
            }}>
              {snap.event}
            </span>
          )}
        </div>
        <ProgressBar value={snap.progress} height={8} color={colors.primaryOrange} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing['1'] }}>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>0%</span>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.primaryOrange, fontWeight: typography.fontWeight.semibold }}>{snap.progress}% complete</span>
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
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryOrange, color: 'white', border: 'none', borderRadius: borderRadius.full, cursor: 'pointer' }}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          {playing && <span style={{ fontSize: typography.fontSize.caption, color: colors.primaryOrange, fontWeight: typography.fontWeight.semibold }}>Playing...</span>}
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
          {/* Clean tick marks only — labels shown via the date buttons below */}
          <div style={{ position: 'relative', height: 6, marginBottom: 2 }}>
            {snapshots.map((s, i) => {
              const left = (i / (snapshots.length - 1)) * 100;
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
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(currentIndex / (snapshots.length - 1)) * 100}%`, backgroundColor: colors.primaryOrange, borderRadius: 2, transition: `width ${transitions.quick}` }} />
          </div>

          {/* Event markers */}
          <div style={{ position: 'relative', height: 40, marginTop: -2 }}>
            {snapshots.map((s, i) => {
              const left = (i / (snapshots.length - 1)) * 100;
              const isCurrent = i === currentIndex;
              const isEvent = s.milestone || s.event;
              const eventColor = s.eventType === 'milestone' ? colors.primaryOrange : s.eventType === 'change_order' ? colors.statusPending : s.eventType === 'incident' ? colors.statusCritical : colors.textTertiary;

              return (
                <button
                  key={s.date}
                  onClick={() => setCurrentIndex(i)}
                  style={{
                    position: 'absolute', left: `${left}%`, top: 0, transform: 'translateX(-50%)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
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
                    fontSize: '9px', color: isCurrent ? colors.primaryOrange : colors.textTertiary,
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
            <label style={{ fontSize: typography.fontSize.caption, color: colors.statusReview, fontWeight: typography.fontWeight.medium }}>Compare to: {snapshots[compareIndex].label}</label>
            <input
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
              <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange, margin: 0, marginBottom: spacing['2'] }}>{snap.progress}%</p>
              <div style={{ height: 4, backgroundColor: colors.borderSubtle, borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${snap.progress}%`, backgroundColor: colors.primaryOrange, borderRadius: 2, transition: `width ${transitions.quick}` }} />
              </div>
            </div>

            {/* Budget Spent */}
            <div style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginBottom: spacing['1'] }}>Budget Spent</p>
              <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.statusInfo, margin: 0, marginBottom: spacing['1'] }}>${snap.budgetSpent}M</p>
              <p style={{ fontSize: '9px', color: colors.textTertiary, margin: 0, marginBottom: spacing['1'] }}>of ${snap.budgetTotal}M</p>
              <div style={{ height: 4, backgroundColor: colors.borderSubtle, borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${(snap.budgetSpent / snap.budgetTotal) * 100}%`, backgroundColor: colors.statusInfo, borderRadius: 2, transition: `width ${transitions.quick}` }} />
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
              {(periodEvents[currentIndex] || []).map((evt, idx) => {
                const dotColor = evt.type === 'milestone' ? colors.primaryOrange : evt.type === 'warning' ? colors.statusPending : colors.statusInfo;
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{evt.title}</span>
                    <span style={{
                      fontSize: '9px',
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
                  alt={`Site photo ${idx + 1}`}
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

import React, { useState } from 'react';
import {
  TrendingUp,
  CircleDollarSign,
  Users2,
  MessageSquareWarning,
  CheckSquare2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Info,
  Plus,
  FileText,
  DollarSign,
  Flag,
  ArrowUpRight,
  ChevronRight,
  Clock,
  Activity,
} from 'lucide-react';
import { Card, MetricBox, SectionHeader, Btn, Avatar, Tag, Dot } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions, layout } from '../styles/theme';
import { projectData, metrics, aiInsights, upcomingMeetings } from '../data/mockData';

const activityLog = [
  { initials: 'TR', color: colors.positive, name: 'Thomas Rodriguez', action: 'completed', target: 'Install fire stopping at floor penetrations', time: '46m' },
  { initials: 'DK', color: colors.info, name: 'David Kumar', action: 'commented on', target: 'Resolve curtain wall interface detail', time: '1h' },
  { initials: 'MP', color: colors.signal, name: 'Mike Patterson', action: 'submitted', target: 'RFI-004: Structural connection at curtain wall', time: '2h' },
  { initials: 'KW', color: colors.caution, name: 'Karen Williams', action: 'moved to In Review', target: 'Review CO-002 HVAC upgrade scope', time: '3h' },
  { initials: 'JS', color: colors.purple, name: 'John Smith', action: 'uploaded photos to', target: 'Floor 7 Steel Connection', time: '4h' },
];

const phases = [
  { label: 'MEP', pct: 62, color: colors.info },
  { label: 'Exterior', pct: 55, color: colors.signal },
  { label: 'Interior', pct: 25, color: colors.purple },
  { label: 'Structural', pct: 88, color: colors.positive },
];

export const Dashboard: React.FC = () => {
  const [expandedInsight, setExpandedInsight] = useState<number | null>(null);

  const getSeverityMeta = (severity: string) => ({
    critical: { color: colors.critical, dim: colors.criticalDim, icon: <AlertTriangle size={13} /> },
    warning:  { color: colors.caution,  dim: colors.cautionDim,  icon: <AlertTriangle size={13} /> },
    info:     { color: colors.info,     dim: colors.infoDim,     icon: <Info size={13} /> },
    success:  { color: colors.positive, dim: colors.positiveDim, icon: <CheckCircle2 size={13} /> },
  }[severity] || { color: colors.info, dim: colors.infoDim, icon: <Info size={13} /> });

  return (
    <main
      className="page-content"
      style={{
        flex: 1,
        overflowY: 'auto',
        background: colors.canvas,
        marginLeft: layout.sidebarWidth,
        marginTop: layout.topbarHeight,
        minHeight: `calc(100vh - ${layout.topbarHeight})`,
        padding: `${spacing['8']} ${spacing['8']}`,
      }}
    >
      {/* ── Project Identity Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: spacing['8'],
          paddingBottom: spacing['6'],
          borderBottom: `1px solid ${colors.borderFaint}`,
        }}
      >
        <div>
          <p
            style={{
              fontSize: typography.fontSize.xs,
              fontWeight: typography.fontWeight.medium,
              color: colors.signal,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              margin: `0 0 ${spacing['2']}`,
            }}
          >
            Active Project
          </p>
          <h1
            style={{
              fontSize: typography.fontSize['5xl'],
              fontWeight: typography.fontWeight.bold,
              color: colors.textPrimary,
              margin: 0,
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            {projectData.name}
          </h1>
          <p
            style={{
              fontSize: typography.fontSize.base,
              color: colors.textTertiary,
              margin: `${spacing['2']} 0 0`,
              letterSpacing: '-0.01em',
            }}
          >
            {projectData.address} &nbsp;·&nbsp; {projectData.type} &nbsp;·&nbsp; {projectData.daysRemaining} days remaining
          </p>
        </div>
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <Btn variant="ghost" size="sm" icon={<Flag size={13} />}>
            Flag Issue
          </Btn>
          <Btn variant="secondary" size="sm" icon={<Plus size={13} />}>
            Quick Action
          </Btn>
          <Btn variant="primary" size="sm" icon={<FileText size={13} />}>
            Daily Log
          </Btn>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: spacing['3'],
          marginBottom: spacing['8'],
        }}
      >
        <MetricBox label="Progress" value="62" unit="%" icon={<TrendingUp size={15} />} status="positive" accent />
        <MetricBox label="Spent" value="$31.2" unit="M of $47.5M" icon={<CircleDollarSign size={15} />} status="neutral" />
        <MetricBox label="Crew" value={metrics.crewsActive} unit="active" icon={<Users2 size={15} />} status="positive" />
        <MetricBox label="RFIs" value={metrics.rfiOpen} unit="open" change={1} changeLabel="this week" icon={<MessageSquareWarning size={15} />} status="caution" />
        <MetricBox label="Punch" value={metrics.punchListOpen} unit="items" icon={<CheckSquare2 size={15} />} status="critical" />
        <MetricBox label="AI Score" value={metrics.aiHealthScore} icon={<Sparkles size={15} />} status="positive" />
      </div>

      {/* ── Main 3-column grid ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 360px',
          gap: spacing['5'],
          marginBottom: spacing['8'],
        }}
      >
        {/* — AI Intelligence — */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          <SectionHeader
            eyebrow="Intelligence"
            title="Active Signals"
            subtitle="Ambient project awareness"
            action={
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: colors.textTertiary,
                  cursor: 'pointer',
                  fontSize: typography.fontSize.xs,
                  fontFamily: typography.fontFamily,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: `color ${transitions.fast}`,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = colors.textSecondary)}
                onMouseLeave={(e) => (e.currentTarget.style.color = colors.textTertiary)}
              >
                View all <ChevronRight size={12} />
              </button>
            }
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
            {aiInsights.map((insight) => {
              const meta = getSeverityMeta(insight.severity);
              const expanded = expandedInsight === insight.id;
              return (
                <div
                  key={insight.id}
                  onClick={() => setExpandedInsight(expanded ? null : insight.id)}
                  style={{
                    background: colors.surface,
                    border: `1px solid ${expanded ? meta.dim : colors.borderFaint}`,
                    borderRadius: borderRadius.xl,
                    padding: spacing['4'],
                    cursor: 'pointer',
                    transition: `all ${transitions.fast}`,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = meta.dim;
                    (e.currentTarget as HTMLDivElement).style.background = colors.surfaceElevated;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = expanded ? meta.dim : colors.borderFaint;
                    (e.currentTarget as HTMLDivElement).style.background = colors.surface;
                  }}
                >
                  {/* Left accent line */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '2px',
                      background: meta.color,
                      borderRadius: '0 1px 1px 0',
                      opacity: 0.7,
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'] }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: borderRadius.md,
                        background: meta.dim,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: meta.color,
                        flexShrink: 0,
                      }}
                    >
                      {meta.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <h3
                          style={{
                            fontSize: typography.fontSize.base,
                            fontWeight: typography.fontWeight.medium,
                            color: colors.textPrimary,
                            margin: 0,
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {insight.title}
                        </h3>
                        <span
                          style={{
                            fontSize: typography.fontSize.xs,
                            color: colors.textTertiary,
                            flexShrink: 0,
                            marginLeft: spacing['2'],
                          }}
                        >
                          {Math.floor((Date.now() - insight.timestamp.getTime()) / 3600000)}h
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: typography.fontSize.sm,
                          color: colors.textSecondary,
                          margin: 0,
                          letterSpacing: '-0.01em',
                          lineHeight: 1.5,
                          display: expanded ? 'block' : '-webkit-box',
                          WebkitLineClamp: expanded ? 'unset' : 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        } as React.CSSProperties}
                      >
                        {insight.description}
                      </p>
                      {expanded && (
                        <div style={{ marginTop: spacing['3'] }}>
                          <button
                            style={{
                              background: meta.dim,
                              border: `1px solid ${meta.color}40`,
                              color: meta.color,
                              padding: `4px ${spacing['3']}`,
                              borderRadius: borderRadius.md,
                              cursor: 'pointer',
                              fontSize: typography.fontSize.xs,
                              fontFamily: typography.fontFamily,
                              fontWeight: typography.fontWeight.medium,
                              letterSpacing: '-0.01em',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {insight.actionButton} <ArrowUpRight size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* — Phase Progress + Activity — */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['5'] }}>
          {/* Phases */}
          <div>
            <SectionHeader eyebrow="Execution" title="Phase Status" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
              {phases.map((phase) => (
                <div key={phase.label}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: spacing['1'],
                    }}
                  >
                    <span
                      style={{
                        fontSize: typography.fontSize.sm,
                        color: colors.textSecondary,
                        fontWeight: typography.fontWeight.medium,
                      }}
                    >
                      {phase.label}
                    </span>
                    <span
                      style={{
                        fontSize: typography.fontSize.xs,
                        color: colors.textTertiary,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {phase.pct}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: '3px',
                      background: colors.borderFaint,
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${phase.pct}%`,
                        background: phase.color,
                        borderRadius: '2px',
                        transition: `width ${transitions.slow}`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div>
            <SectionHeader
              eyebrow="Field"
              title="Recent Activity"
              action={
                <button
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: colors.textTertiary,
                    cursor: 'pointer',
                    fontSize: typography.fontSize.xs,
                    fontFamily: typography.fontFamily,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: `color ${transitions.fast}`,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = colors.textSecondary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = colors.textTertiary)}
                >
                  Full log <ChevronRight size={12} />
                </button>
              }
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {activityLog.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: spacing['3'],
                    padding: `${spacing['3']} 0`,
                    borderBottom: i < activityLog.length - 1 ? `1px solid ${colors.borderFaint}` : 'none',
                  }}
                >
                  <Avatar initials={item.initials} color={item.color} size={26} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: typography.fontSize.sm,
                        color: colors.textSecondary,
                        margin: 0,
                        letterSpacing: '-0.01em',
                        lineHeight: 1.4,
                      }}
                    >
                      <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{item.name}</span>
                      {' '}{item.action}{' '}
                      <span style={{ color: colors.textSecondary }}>{item.target}</span>
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      color: colors.textTertiary,
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* — Today's Agenda — */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['5'] }}>
          <div>
            <SectionHeader eyebrow="Schedule" title="Today" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              {upcomingMeetings.map((meeting) => {
                const typeColor = {
                  oac: colors.info,
                  safety: colors.critical,
                  mep: colors.positive,
                }[meeting.type] || colors.signal;

                return (
                  <div
                    key={meeting.id}
                    style={{
                      background: colors.surface,
                      border: `1px solid ${colors.borderFaint}`,
                      borderRadius: borderRadius.lg,
                      padding: `${spacing['3']} ${spacing['4']}`,
                      cursor: 'pointer',
                      transition: `all ${transitions.fast}`,
                      display: 'flex',
                      gap: spacing['3'],
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.borderColor = colors.borderSubtle;
                      el.style.background = colors.surfaceElevated;
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.borderColor = colors.borderFaint;
                      el.style.background = colors.surface;
                    }}
                  >
                    <div
                      style={{
                        width: '3px',
                        borderRadius: '2px',
                        background: typeColor,
                        flexShrink: 0,
                        alignSelf: 'stretch',
                        opacity: 0.8,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: typography.fontSize.sm,
                          fontWeight: typography.fontWeight.medium,
                          color: colors.textPrimary,
                          margin: 0,
                          letterSpacing: '-0.01em',
                          marginBottom: '3px',
                        }}
                      >
                        {meeting.title}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                        <Clock size={11} color={colors.textTertiary} />
                        <span style={{ fontSize: '11px', color: colors.textTertiary }}>
                          {meeting.time} · {meeting.attendees} attendees
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions — minimal, purposeful */}
          <div>
            <SectionHeader eyebrow="Actions" title="Quick Create" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['2'] }}>
              {[
                { label: 'RFI', icon: <MessageSquareWarning size={13} /> },
                { label: 'Daily Log', icon: <FileText size={13} /> },
                { label: 'Change Order', icon: <DollarSign size={13} /> },
                { label: 'Flag Issue', icon: <Flag size={13} /> },
              ].map((action) => (
                <button
                  key={action.label}
                  style={{
                    background: colors.surfaceElevated,
                    border: `1px solid ${colors.borderFaint}`,
                    borderRadius: borderRadius.lg,
                    padding: `${spacing['3']} ${spacing['3']}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing['2'],
                    color: colors.textSecondary,
                    fontSize: typography.fontSize.sm,
                    fontFamily: typography.fontFamily,
                    fontWeight: typography.fontWeight.medium,
                    letterSpacing: '-0.01em',
                    transition: `all ${transitions.fast}`,
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = colors.borderSubtle;
                    el.style.color = colors.textPrimary;
                    el.style.background = colors.surfaceHover;
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = colors.borderFaint;
                    el.style.color = colors.textSecondary;
                    el.style.background = colors.surfaceElevated;
                  }}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Critical Path Tasks ── */}
      <div>
        <SectionHeader
          eyebrow="Critical Path"
          title="Blocking Tasks"
          subtitle="Items that affect schedule completion"
          action={
            <Btn variant="ghost" size="sm" icon={<Activity size={13} />}>
              View all tasks
            </Btn>
          }
        />
        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.borderFaint}`,
            borderRadius: borderRadius.xl,
            overflow: 'hidden',
          }}
        >
          {[
            { initials: 'MP', color: colors.signal, title: 'Complete Floor 7 steel erection', progress: '4/6 subtasks', priority: 'critical' as const, due: 'Due today' },
            { initials: 'DK', color: colors.info, title: 'Resolve curtain wall interface detail', progress: '2/3 subtasks', priority: 'high' as const, due: '2d remaining' },
            { initials: 'LZ', color: colors.purple, title: 'Procure secondary steel supplier quote', progress: '1/2 subtasks', priority: 'medium' as const, due: '5d remaining' },
          ].map((task, i, arr) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '28px 1fr auto auto',
                gap: spacing['4'],
                alignItems: 'center',
                padding: `${spacing['4']} ${spacing['5']}`,
                borderBottom: i < arr.length - 1 ? `1px solid ${colors.borderFaint}` : 'none',
                cursor: 'pointer',
                transition: `background ${transitions.fast}`,
              }}
              onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.background = colors.surfaceElevated}
              onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
            >
              <Avatar initials={task.initials} color={task.color} size={28} />
              <div>
                <p
                  style={{
                    fontSize: typography.fontSize.sm,
                    fontWeight: typography.fontWeight.medium,
                    color: colors.textPrimary,
                    margin: `0 0 2px`,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {task.title}
                </p>
                <p
                  style={{
                    fontSize: '11px',
                    color: colors.textTertiary,
                    margin: 0,
                  }}
                >
                  {task.progress}
                </p>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  color: task.priority === 'critical' ? colors.critical : colors.textTertiary,
                  background: task.priority === 'critical' ? colors.criticalDim : colors.surfaceElevated,
                  padding: `2px ${spacing['2']}`,
                  borderRadius: borderRadius.sm,
                  fontWeight: typography.fontWeight.medium,
                }}
              >
                {task.due}
              </span>
              <ChevronRight size={14} color={colors.textTertiary} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
};

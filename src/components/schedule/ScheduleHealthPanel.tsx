// ── Schedule Health Panel ────────────────────────────────────────────────────
// Beautiful inspector panel that displays the Schedule Health Engine results.
// Animated score ring, clickable findings with severity indicators,
// and metrics dashboard. Steve Jobs would approve of the clarity.

import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, AlertTriangle, AlertCircle, Info, ChevronDown, ChevronRight, X, Activity, Link2, Zap, Target } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import type { HealthReport, HealthFinding, Severity } from '../../lib/scheduleHealth';

// ── Props ───────────────────────────────────────────────────────────────────

interface ScheduleHealthPanelProps {
  report: HealthReport;
  onFindingClick?: (taskIds: string[]) => void;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

// ── Severity styling ────────────────────────────────────────────────────────

const severityConfig: Record<Severity, { color: string; bg: string; icon: typeof AlertTriangle; label: string }> = {
  critical: { color: '#DC2626', bg: '#FEF2F2', icon: AlertCircle, label: 'Critical' },
  warning: { color: '#D97706', bg: '#FFFBEB', icon: AlertTriangle, label: 'Warning' },
  info: { color: '#2563EB', bg: '#EFF6FF', icon: Info, label: 'Info' },
};

// ── Score ring colors ───────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 90) return '#16A34A';
  if (score >= 75) return '#2563EB';
  if (score >= 60) return '#D97706';
  return '#DC2626';
}

function gradeColor(grade: string): string {
  if (grade === 'A') return '#16A34A';
  if (grade === 'B') return '#2563EB';
  if (grade === 'C') return '#D97706';
  return '#DC2626';
}

// ── Animated Score Ring ─────────────────────────────────────────────────────

const ScoreRing: React.FC<{ score: number; grade: string; size?: number }> = ({ score, grade, size = 120 }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [animatedPct, setAnimatedPct] = useState(0);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const startTime = Date.now();
    const duration = 1200; // ms
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3); // cubic ease-out

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOut(progress);

      setAnimatedScore(Math.round(eased * score));
      setAnimatedPct(eased * score);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [score]);

  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedPct / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={colors.surfaceInset}
          strokeWidth={strokeWidth}
        />
        {/* Score arc */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke 300ms ease' }}
        />
      </svg>
      {/* Center text */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: size * 0.3, fontWeight: 800, color,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}>
          {animatedScore}
        </span>
        <span style={{
          fontSize: size * 0.11, fontWeight: 700,
          color: gradeColor(grade),
          letterSpacing: '0.05em',
          marginTop: 2,
        }}>
          {grade}
        </span>
      </div>
    </div>
  );
};

// ── Finding Card ────────────────────────────────────────────────────────────

const FindingCard: React.FC<{
  finding: HealthFinding;
  onClickTasks?: (taskIds: string[]) => void;
}> = ({ finding, onClickTasks }) => {
  const [expanded, setExpanded] = useState(false);
  const config = severityConfig[finding.severity];
  const Icon = config.icon;

  return (
    <div
      style={{
        borderRadius: borderRadius.lg,
        border: `1px solid ${config.color}20`,
        backgroundColor: config.bg,
        overflow: 'hidden',
        transition: `all ${transitions.quick}`,
      }}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
          padding: `${spacing['3']} ${spacing['4']}`,
          border: 'none', backgroundColor: 'transparent',
          cursor: 'pointer', textAlign: 'left',
          fontFamily: typography.fontFamily,
        }}
      >
        <Icon size={16} color={config.color} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <span style={{
              fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary, lineHeight: 1.4,
            }}>
              {finding.title}
            </span>
          </div>
          {finding.affectedTaskIds.length > 0 && (
            <span style={{
              fontSize: typography.fontSize.caption, color: config.color,
              fontWeight: typography.fontWeight.medium, marginTop: 2, display: 'block',
            }}>
              {finding.affectedTaskIds.length} affected · −{finding.scoreImpact} pts
            </span>
          )}
        </div>
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          {expanded ? <ChevronDown size={14} color={colors.textTertiary} /> : <ChevronRight size={14} color={colors.textTertiary} />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          padding: `0 ${spacing['4']} ${spacing['4']}`,
          paddingLeft: `calc(${spacing['4']} + 16px + ${spacing['3']})`, // align with text
        }}>
          <p style={{
            margin: 0, fontSize: typography.fontSize.sm,
            color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed,
          }}>
            {finding.description}
          </p>
          <div style={{
            marginTop: spacing['3'], padding: `${spacing['2.5']} ${spacing['3']}`,
            backgroundColor: `${colors.white}90`, borderRadius: borderRadius.md,
            border: `1px solid ${config.color}15`,
          }}>
            <span style={{
              fontSize: 10, fontWeight: typography.fontWeight.semibold,
              color: config.color, textTransform: 'uppercase' as const,
              letterSpacing: typography.letterSpacing.wider,
            }}>
              Suggestion
            </span>
            <p style={{
              margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm,
              color: colors.textPrimary, lineHeight: typography.lineHeight.relaxed,
            }}>
              {finding.suggestion}
            </p>
          </div>
          {finding.affectedTaskIds.length > 0 && onClickTasks && (
            <button
              onClick={(e) => { e.stopPropagation(); onClickTasks(finding.affectedTaskIds); }}
              style={{
                marginTop: spacing['3'], padding: `${spacing['1.5']} ${spacing['3']}`,
                border: `1px solid ${config.color}30`, borderRadius: borderRadius.md,
                backgroundColor: 'transparent', color: config.color,
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                fontFamily: typography.fontFamily, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: spacing['1'],
                transition: transitions.quick,
              }}
            >
              <Target size={12} />
              Highlight {finding.affectedTaskIds.length} affected activit{finding.affectedTaskIds.length === 1 ? 'y' : 'ies'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Metric Pill ─────────────────────────────────────────────────────────────

const MetricPill: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}> = ({ icon, label, value, color }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: spacing['2'],
    padding: `${spacing['2']} ${spacing['3']}`,
    backgroundColor: colors.surfaceInset,
    borderRadius: borderRadius.md,
    flex: '1 1 auto', minWidth: 100,
  }}>
    {icon}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 10, color: colors.textTertiary,
        fontWeight: typography.fontWeight.medium,
        textTransform: 'uppercase' as const,
        letterSpacing: typography.letterSpacing.wider,
        lineHeight: 1,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.bold,
        color: color ?? colors.textPrimary,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.3,
        marginTop: 2,
      }}>
        {value}
      </div>
    </div>
  </div>
);

// ── Main Component ──────────────────────────────────────────────────────────

export const ScheduleHealthPanel: React.FC<ScheduleHealthPanelProps> = ({
  report,
  onFindingClick,
  onClose,
  collapsed = false,
  onToggleCollapsed,
}) => {
  const { score, grade, summary, findings, metrics } = report;

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapsed}
        style={{
          display: 'flex', alignItems: 'center', gap: spacing['3'],
          padding: `${spacing['3']} ${spacing['4']}`,
          backgroundColor: colors.surfaceRaised,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: borderRadius.xl,
          cursor: 'pointer', width: '100%',
          boxShadow: shadows.card,
          fontFamily: typography.fontFamily,
          transition: transitions.quick,
        }}
      >
        <ShieldCheck size={20} color={scoreColor(score)} />
        <span style={{
          fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
        }}>
          Schedule Logic Quality
        </span>
        <span style={{
          fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.bold,
          color: scoreColor(score),
          marginLeft: 'auto',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {score}/100 ({grade})
        </span>
        {report.criticalCount > 0 && (
          <span style={{
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.bold,
            color: '#DC2626', backgroundColor: '#FEF2F2',
            padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
          }}>
            {report.criticalCount} critical
          </span>
        )}
        <ChevronRight size={16} color={colors.textTertiary} />
      </button>
    );
  }

  return (
    <div style={{
      backgroundColor: colors.surfaceRaised,
      border: `1px solid ${colors.borderDefault}`,
      borderRadius: borderRadius.xl,
      overflow: 'hidden',
      boxShadow: shadows.card,
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${spacing['4']} ${spacing['5']}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <ShieldCheck size={20} color={scoreColor(score)} />
          <span style={{
            fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight,
          }}>
            Schedule Health
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <span style={{
            fontSize: typography.fontSize.caption, color: colors.textTertiary,
          }}>
            {new Date(report.analyzedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close health panel"
              style={{
                width: 28, height: 28, borderRadius: borderRadius.md,
                border: 'none', backgroundColor: 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: transitions.quick,
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = colors.surfaceInset; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <X size={16} color={colors.textTertiary} />
            </button>
          )}
        </div>
      </div>

      {/* ── Score Section ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing['6'],
        padding: `${spacing['5']} ${spacing['5']}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
      }}>
        <ScoreRing score={score} grade={grade} size={110} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: typography.fontSize.sm,
            color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed,
          }}>
            {summary}
          </p>
          {/* Severity counts */}
          <div style={{ display: 'flex', gap: spacing['3'], marginTop: spacing['3'] }}>
            {report.criticalCount > 0 && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                color: severityConfig.critical.color,
              }}>
                <AlertCircle size={12} />
                {report.criticalCount} Critical
              </span>
            )}
            {report.warningCount > 0 && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                color: severityConfig.warning.color,
              }}>
                <AlertTriangle size={12} />
                {report.warningCount} Warning{report.warningCount > 1 ? 's' : ''}
              </span>
            )}
            {report.infoCount > 0 && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                color: severityConfig.info.color,
              }}>
                <Info size={12} />
                {report.infoCount} Info
              </span>
            )}
            {findings.length === 0 && (
              <span style={{
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                color: '#16A34A',
              }}>
                No issues found
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Metrics Grid ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: spacing['2'],
        padding: `${spacing['4']} ${spacing['5']}`,
        borderBottom: findings.length > 0 ? `1px solid ${colors.borderSubtle}` : 'none',
      }}>
        <MetricPill
          icon={<Activity size={14} color={colors.textTertiary} />}
          label="Activities"
          value={metrics.totalActivities}
        />
        <MetricPill
          icon={<Link2 size={14} color={metrics.logicDensityPct >= 1.5 ? '#16A34A' : '#D97706'} />}
          label="Logic Density"
          value={`${metrics.logicDensityPct}/act`}
          color={metrics.logicDensityPct >= 1.5 ? '#16A34A' : metrics.logicDensityPct >= 1.0 ? '#D97706' : '#DC2626'}
        />
        <MetricPill
          icon={<Zap size={14} color={metrics.criticalPathPct > 50 ? '#DC2626' : colors.textTertiary} />}
          label="Critical Path"
          value={`${metrics.criticalPathPct}%`}
          color={metrics.criticalPathPct > 50 ? '#DC2626' : undefined}
        />
        <MetricPill
          icon={<Target size={14} color={colors.textTertiary} />}
          label="Avg Float"
          value={`${metrics.avgFloatDays}d`}
        />
      </div>

      {/* ── Findings ── */}
      {findings.length > 0 && (
        <div style={{
          padding: `${spacing['4']} ${spacing['5']}`,
          display: 'flex', flexDirection: 'column', gap: spacing['2'],
          maxHeight: 400, overflowY: 'auto',
        }}>
          {findings.map(finding => (
            <FindingCard
              key={finding.id}
              finding={finding}
              onClickTasks={onFindingClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ScheduleHealthPanel;

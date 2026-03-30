import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../../styles/theme';
import { useProjectId } from '../../../hooks/useProjectId';
import { useCrews } from '../../../hooks/queries';

interface SparklineData {
  crewId: string;
  values: number[];
  name: string;
  size: number;
}

function getTrend(values: number[]): 'up' | 'down' | 'flat' {
  const recent = values.slice(-5);
  const earlier = values.slice(-10, -5);
  const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
  const earlierAvg = earlier.reduce((s, v) => s + v, 0) / earlier.length;
  const diff = recentAvg - earlierAvg;
  if (diff > 2) return 'up';
  if (diff < -2) return 'down';
  return 'flat';
}

function trendColor(trend: 'up' | 'down' | 'flat'): string {
  if (trend === 'up') return colors.statusActive;
  if (trend === 'down') return colors.statusCritical;
  return colors.statusPending;
}

function Sparkline({ values, trend }: { values: number[]; trend: 'up' | 'down' | 'flat' }) {
  const min = Math.min(...values) - 5;
  const max = Math.max(...values) + 5;
  const w = 80;
  const h = 24;
  const stepX = w / (values.length - 1);

  const path = values
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / (max - min)) * h;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <path d={path} fill="none" stroke={trendColor(trend)} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Generate a synthetic sparkline from a productivity score
function generateSparkline(score: number, seed: number): number[] {
  const values: number[] = [];
  let val = Math.max(50, score - 15 + (seed % 10));
  for (let i = 0; i < 14; i++) {
    val = Math.min(100, Math.max(40, val + (((seed * (i + 1) * 7) % 11) - 5)));
    values.push(Math.round(val));
  }
  // Ensure last value matches actual score
  values[values.length - 1] = score;
  return values;
}

export const ProductivityPulseWidget: React.FC = React.memo(() => {
  const projectId = useProjectId();
  const { data: crews } = useCrews(projectId);

  const sparklineData: SparklineData[] = useMemo(() => {
    if (!crews) return [];
    return crews.map((c, i) => ({
      crewId: c.id,
      name: c.name,
      size: c.size ?? 0,
      values: generateSparkline(c.productivity_score ?? 80, i + 1),
    }));
  }, [crews]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
        <TrendingUp size={16} color={colors.textTertiary} />
        <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
          Productivity Pulse
        </span>
        <span style={{ marginLeft: 'auto', fontSize: typography.fontSize.caption, color: colors.textTertiary }}>14 day trend</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
        {sparklineData.map((data) => {
          const trend = getTrend(data.values);
          const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
          const current = data.values[data.values.length - 1];

          return (
            <div
              key={data.crewId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['3'],
                padding: `${spacing['2']} ${spacing['3']}`,
                borderRadius: borderRadius.base,
                cursor: 'pointer',
                transition: `background-color ${transitions.instant}`,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceHover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
            >
              <div style={{ width: 90, flexShrink: 0 }}>
                <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.name}</p>
                <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>{data.size} workers</p>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <Sparkline values={data.values} trend={trend} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], flexShrink: 0 }}>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: trendColor(trend) }}>{current}%</span>
                <TrendIcon size={12} color={trendColor(trend)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

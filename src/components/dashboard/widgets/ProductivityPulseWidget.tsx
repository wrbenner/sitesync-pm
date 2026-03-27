import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../../styles/theme';
import { useQuery } from '../../../hooks/useQuery';
import { getCrews } from '../../../api/endpoints/people';

interface SparklineData {
  crewId: number;
  values: number[];
}

const sparklineData: SparklineData[] = [
  { crewId: 1, values: [85, 88, 91, 87, 93, 90, 95, 92, 96, 94, 97, 96, 98, 98] },
  { crewId: 2, values: [78, 80, 82, 81, 83, 84, 85, 83, 86, 84, 85, 85, 85, 85] },
  { crewId: 3, values: [90, 88, 92, 91, 93, 90, 92, 91, 92, 92, 92, 92, 92, 92] },
  { crewId: 4, values: [82, 80, 78, 80, 77, 79, 76, 78, 75, 77, 76, 78, 78, 78] },
  { crewId: 5, values: [75, 78, 80, 82, 83, 85, 84, 86, 87, 86, 88, 88, 88, 88] },
  { crewId: 6, values: [85, 84, 83, 82, 83, 82, 81, 82, 82, 81, 82, 82, 82, 82] },
];

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

export const ProductivityPulseWidget: React.FC = () => {
  const { data: crews } = useQuery('crews', getCrews);

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
          const crew = (crews || []).find((c) => c.id === data.crewId);
          if (!crew) return null;
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
                <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{crew.name}</p>
                <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>{crew.size} workers</p>
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
};

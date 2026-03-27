import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { colors, spacing, typography } from '../../styles/theme';

interface DayData {
  label: string;
  workers: number;
  hours: number;
  incidents: number;
}

interface DayComparisonProps {
  today: DayData;
  yesterday: DayData;
  lastWeek: DayData;
}

function TrendIndicator({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  const pct = previous > 0 ? ((diff / previous) * 100).toFixed(0) : '0';
  if (diff > 0) return <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: typography.fontSize.caption, color: colors.statusActive }}><TrendingUp size={10} /> +{pct}%</span>;
  if (diff < 0) return <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: typography.fontSize.caption, color: colors.statusCritical }}><TrendingDown size={10} /> {pct}%</span>;
  return <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: typography.fontSize.caption, color: colors.textTertiary }}><Minus size={10} /> 0%</span>;
}

export const DayComparison: React.FC<DayComparisonProps> = ({ today, yesterday, lastWeek }) => {
  const days = [today, yesterday, lastWeek];
  const metrics = ['workers', 'hours', 'incidents'] as const;
  const metricLabels = { workers: 'Workers', hours: 'Man Hours', incidents: 'Incidents' };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}></th>
            {days.map((d) => (
              <th key={d.label} style={{ textAlign: 'right', padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary }}>{d.label}</th>
            ))}
            <th style={{ textAlign: 'right', padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>vs Yesterday</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric} style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
              <td style={{ padding: `${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{metricLabels[metric]}</td>
              {days.map((d) => (
                <td key={d.label} style={{ textAlign: 'right', padding: `${spacing['3']}`, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: metric === 'incidents' && d[metric] > 0 ? colors.statusCritical : colors.textPrimary }}>
                  {d[metric].toLocaleString()}
                </td>
              ))}
              <td style={{ textAlign: 'right', padding: `${spacing['3']}` }}>
                <TrendIndicator current={today[metric]} previous={yesterday[metric]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

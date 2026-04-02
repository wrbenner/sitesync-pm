import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';

interface TreemapItem {
  id: string | number;
  name: string;
  budget: number;
  spent: number;
  committed: number;
  children?: { name: string; amount: number; pct: number }[];
}

interface TreemapProps {
  divisions: TreemapItem[];
}

const divisionColors = [
  colors.statusInfo,
  colors.statusActive,
  colors.statusPending,
  colors.statusReview,
  colors.primaryOrange,
];

// Child breakdown is derived from the division's children prop or from budget line items

const fmt = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;

export const Treemap: React.FC<TreemapProps> = ({ divisions }) => {
  const [drillDown, setDrillDown] = useState<string | number | null>(null);

  const total = divisions.reduce((s, d) => s + d.budget, 0);

  if (drillDown !== null) {
    const div = divisions.find((d) => d.id === drillDown);
    const children = div?.children || [];
    const ddIndex = divisions.findIndex(d => d.id === drillDown);
    const divColor = divisionColors[Math.max(0, ddIndex) % divisionColors.length];

    const backButton = (
      <button
        onClick={() => setDrillDown(null)}
        style={{
          display: 'flex', alignItems: 'center', gap: spacing['1'],
          marginBottom: spacing['3'], padding: `${spacing['1']} ${spacing['2']}`,
          backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
          color: colors.textTertiary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
        }}
      >
        <ChevronLeft size={14} /> Back to all divisions
      </button>
    );

    if (children.length === 0) {
      return (
        <div>
          {backButton}
          <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['3'] }}>
            {div?.name} · {fmt(div?.budget || 0)}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: spacing['8'], color: colors.textTertiary, gap: spacing['2'] }}>
            <ChevronLeft size={32} style={{ opacity: 0.3, transform: 'rotate(90deg)' }} />
            <span style={{ fontSize: typography.fontSize.body }}>No cost breakdown available for this division</span>
          </div>
        </div>
      );
    }

    return (
      <div>
        {backButton}
        <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['3'] }}>
          {div?.name} · {fmt(div?.budget || 0)}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: spacing['2'] }}>
          {children.map((child: { name: string; amount: number; pct: number }, i: number) => (
            <div
              key={child.name}
              style={{
                padding: spacing['3'], borderRadius: borderRadius.md,
                backgroundColor: `${divColor}${(15 - i * 3).toString(16).padStart(2, '0')}`,
                border: `1px solid ${divColor}20`,
                cursor: 'pointer', transition: `transform ${transitions.instant}`,
                aspectRatio: child.pct > 30 ? '2/1' : '1',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.02)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}
            >
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{child.name}</span>
              <div>
                <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(child.amount)}</span>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: spacing['1'] }}>{child.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'] }}>
      {divisions.map((div, i) => {
        const pct = (div.budget / total) * 100;
        const spentPct = Math.round((div.spent / div.budget) * 100);
        const divColor = divisionColors[i % divisionColors.length];
        // Width proportional to budget share, minimum 18%
        const flexBasis = Math.max(18, pct * 0.8);

        return (
          <div
            key={div.id}
            onClick={() => setDrillDown(div.id)}
            style={{
              flex: `1 1 ${flexBasis}%`,
              minWidth: '140px',
              padding: spacing['4'], borderRadius: borderRadius.lg,
              backgroundColor: `${divColor}0A`,
              border: `1px solid ${divColor}18`,
              cursor: 'pointer', transition: `all ${transitions.instant}`,
              position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.01)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 12px ${divColor}15`; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
          >
            {/* Spent fill indicator */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${spentPct}%`, backgroundColor: `${divColor}08`, transition: `height ${transitions.smooth}` }} />

            <div style={{ position: 'relative' }}>
              <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{div.name}</p>
              <p style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginTop: spacing['2'] }}>
                {fmt(div.budget)}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginTop: spacing['2'] }}>
                <span style={{ fontSize: typography.fontSize.caption, color: spentPct >= 90 ? colors.statusCritical : colors.textTertiary }}>
                  {spentPct}% spent
                </span>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  {Math.round(pct)}% of total
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

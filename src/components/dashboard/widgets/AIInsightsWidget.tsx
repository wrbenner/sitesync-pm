import React, { useState } from 'react';
import { Sparkles, ChevronRight, AlertTriangle, TrendingDown, Shield, CheckCircle } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../../styles/theme';
import { useProjectId } from '../../../hooks/useProjectId';
import { useAIInsights } from '../../../hooks/queries';
import { useAppNavigate } from '../../../utils/connections';

type Category = 'all' | 'schedule' | 'budget' | 'safety' | 'quality';

const categoryConfig: Record<Category, { label: string; icon: React.ReactNode; color: string }> = {
  all: { label: 'All', icon: <Sparkles size={12} />, color: colors.textSecondary },
  schedule: { label: 'Schedule', icon: <TrendingDown size={12} />, color: colors.statusPending },
  budget: { label: 'Budget', icon: <AlertTriangle size={12} />, color: colors.statusCritical },
  safety: { label: 'Safety', icon: <Shield size={12} />, color: colors.statusInfo },
  quality: { label: 'Quality', icon: <CheckCircle size={12} />, color: colors.statusActive },
};

function pageToCategory(page: string | null | undefined): Category {
  if (!page) return 'schedule';
  const p = page.toLowerCase();
  if (p === 'budget') return 'budget';
  if (p === 'safety' || p === 'daily-log') return 'safety';
  if (p === 'quality' || p === 'punch-list') return 'quality';
  return 'schedule';
}

export const AIInsightsWidget: React.FC = React.memo(() => {
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const dismissInsight = (id: string) => setDismissedIds((prev) => new Set([...prev, id]));
  const projectId = useProjectId();
  const { data: rawInsights } = useAIInsights(projectId);
  const navigate = useAppNavigate();

  const allInsights = (rawInsights || [])
    .filter((i) => !dismissedIds.has(i.id))
    .map((i) => ({
      id: i.id,
      severity: (i.severity || 'info') as 'warning' | 'info' | 'success' | 'critical',
      title: i.message,
      description: i.expanded_content || '',
      category: pageToCategory(i.page),
      route: i.action_link || 'dashboard',
    }));

  const filtered = activeCategory === 'all'
    ? allInsights
    : allInsights.filter((i) => i.category === activeCategory);

  const severityColor = (s: string) => {
    if (s === 'warning') return colors.statusPending;
    if (s === 'success') return colors.statusActive;
    if (s === 'critical') return colors.statusCritical;
    return colors.statusInfo;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
        <Sparkles size={16} color={colors.primaryOrange} />
        <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
          AI Insights
        </span>
        <span style={{ marginLeft: 'auto', fontSize: typography.fontSize.caption, color: colors.white, fontWeight: typography.fontWeight.semibold, backgroundColor: colors.primaryOrange, borderRadius: borderRadius.full, minWidth: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: `0 ${spacing['1.5']}`, flexShrink: 0 }}>{allInsights.length}</span>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: spacing['1'], marginBottom: spacing['3'], flexWrap: 'wrap' }}>
        {(Object.keys(categoryConfig) as Category[]).map((cat) => {
          const cfg = categoryConfig[cat];
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `2px ${spacing['2']}`,
                border: 'none',
                borderRadius: borderRadius.full,
                backgroundColor: isActive ? colors.orangeSubtle : 'transparent',
                color: isActive ? colors.orangeText : colors.textTertiary,
                fontSize: typography.fontSize.caption,
                fontFamily: typography.fontFamily,
                fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.medium,
                cursor: 'pointer',
                transition: `all ${transitions.instant}`,
              }}
            >
              {cfg.icon}
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Insights feed */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
        {filtered.map((insight) => (
          <div
            key={insight.id}
            onClick={() => navigate(insight.route)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: spacing['3'],
              padding: `${spacing['2']} ${spacing['3']}`,
              borderRadius: borderRadius.base,
              cursor: 'pointer',
              transition: `background-color ${transitions.instant}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceHover; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: severityColor(insight.severity), marginTop: 6, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.snug }}>{insight.title}</p>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{insight.description}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); dismissInsight(insight.id); }}
              title="Dismiss"
              style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: colors.textTertiary, flexShrink: 0, marginTop: 2, opacity: 0.5 }}
            >
              ×
            </button>
            <ChevronRight size={14} color={colors.textTertiary} style={{ marginTop: 4, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
});

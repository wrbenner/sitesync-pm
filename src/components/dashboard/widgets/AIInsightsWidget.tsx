import React, { useState } from 'react';
import { Sparkles, ChevronRight, AlertTriangle, TrendingDown, Shield, CheckCircle, RefreshCw, Clock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius, transitions } from '../../../styles/theme';
import { useProjectId } from '../../../hooks/useProjectId';
import { useAiInsightsMeta } from '../../../hooks/queries';
import { useAppNavigate } from '../../../utils/connections';

type Category = 'all' | 'schedule' | 'budget' | 'safety' | 'quality';

const categoryConfig: Record<Category, { label: string; icon: React.ReactNode; color: string }> = {
  all: { label: 'All', icon: <Sparkles size={12} />, color: colors.textSecondary },
  schedule: { label: 'Schedule', icon: <TrendingDown size={12} />, color: colors.statusPending },
  budget: { label: 'Budget', icon: <AlertTriangle size={12} />, color: colors.statusCritical },
  safety: { label: 'Safety', icon: <Shield size={12} />, color: colors.statusInfo },
  quality: { label: 'Quality', icon: <CheckCircle size={12} />, color: colors.statusActive },
};

const STALENESS_THRESHOLD_MS = 24 * 60 * 60 * 1000;

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
  const queryClient = useQueryClient();
  const { data: insightsResponse, isFetching, refetch } = useAiInsightsMeta(projectId);
  const navigate = useAppNavigate();

  const rawInsights = insightsResponse?.insights || [];
  const hasCachedInsights = rawInsights.some((i) => i.source !== 'live');

  const mostRecentCreatedAt = rawInsights.length > 0
    ? rawInsights.reduce((latest, i) => (i.createdAt > latest ? i.createdAt : latest), rawInsights[0].createdAt)
    : null;
  const isStale = mostRecentCreatedAt
    ? Date.now() - new Date(mostRecentCreatedAt).getTime() > STALENESS_THRESHOLD_MS
    : false;

  const relativeTime = (iso: string): string => {
    const ms = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  };

  const handleRetry = () => {
    queryClient.removeQueries({ queryKey: ['ai_insights_meta', projectId] });
    refetch();
  };

  const allInsights = rawInsights
    .filter((i) => !dismissedIds.has(i.id))
    .map((i) => ({
      id: i.id,
      severity: (i.severity || 'info') as 'warning' | 'info' | 'success' | 'critical',
      title: i.title,
      description: i.description || '',
      category: pageToCategory((i as unknown as { page?: string }).page),
      route: (i as unknown as { action_link?: string }).action_link || 'dashboard',
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

      {/* Cached data banner */}
      {hasCachedInsights && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['2'],
          padding: `${spacing['2']} ${spacing['3']}`,
          marginBottom: spacing['2'],
          backgroundColor: '#FFF7ED',
          border: '1px solid #FED7AA',
          borderRadius: borderRadius.base,
        }}>
          <AlertTriangle size={13} color={colors.statusPending} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: typography.fontSize.caption, color: '#92400E' }}>
            {mostRecentCreatedAt
              ? `AI insights updated ${relativeTime(mostRecentCreatedAt)} — live analysis unavailable.`
              : 'AI insights are showing cached data. Live analysis unavailable.'}
          </span>
          <button
            onClick={handleRetry}
            disabled={isFetching}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: `2px ${spacing['2']}`,
              border: '1px solid #FED7AA',
              borderRadius: borderRadius.base,
              backgroundColor: 'transparent',
              color: '#92400E',
              fontSize: typography.fontSize.caption,
              fontFamily: typography.fontFamily,
              fontWeight: typography.fontWeight.medium,
              cursor: isFetching ? 'not-allowed' : 'pointer',
              opacity: isFetching ? 0.6 : 1,
              flexShrink: 0,
            }}
          >
            <RefreshCw size={11} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
            Retry
          </button>
        </div>
      )}

      {/* Staleness warning */}
      {isStale && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['2'],
          padding: `${spacing['1.5']} ${spacing['3']}`,
          marginBottom: spacing['2'],
          backgroundColor: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: borderRadius.base,
        }}>
          <Clock size={12} color={colors.statusPending} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: typography.fontSize.caption, color: '#78350F' }}>
            Insights are more than 24 hours old.
          </span>
        </div>
      )}

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
            role="button"
            tabIndex={0}
            onClick={() => navigate(insight.route)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(insight.route); } }}
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
              aria-label="Dismiss insight"
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

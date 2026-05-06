import React from 'react';
import { Sparkles, X, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../../styles/theme';
import { useAIAnnotationStore } from '../../stores';

interface AIContextPanelProps {
  currentPage: string;
}

const severityColors: Record<string, string> = {
  critical: colors.statusCritical,
  warning: colors.statusPending,
  info: colors.statusInfo,
  positive: colors.statusActive,
};

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

export const AIContextPanel: React.FC<AIContextPanelProps> = ({ currentPage }) => {
  const { contextPanelOpen, setContextPanelOpen } = useAIAnnotationStore();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <AnimatePresence>
      {contextPanelOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setContextPanelOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.15)', /* light scrim, between overlayBlackHeavy(0.12) and overlayDark(0.4) */
              backdropFilter: 'blur(2px)',
              zIndex: zIndex.modal as number - 1,
            }}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: isMobile ? '100%' : '360px',
              maxWidth: isMobile ? '100vw' : '85vw',
              backgroundColor: colors.surfaceRaised,
              boxShadow: shadows.panel,
              zIndex: zIndex.modal as number,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Drag handle for mobile bottom-sheet affordance */}
            {isMobile && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: `${spacing['2']} 0`, flexShrink: 0 }}>
                <div style={{ width: 40, height: 8, borderRadius: borderRadius.full ?? '9999px', backgroundColor: colors.borderDefault }} />
              </div>
            )}
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['4']} ${spacing['5']}`, borderBottom: `1px solid ${colors.borderSubtle}`, flexShrink: 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${colors.statusReview} 0%, #9B8ADB 100%)` /* decorative AI gradient */, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={14} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>AI Analysis</p>
                <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, textTransform: 'capitalize' }}>{currentPage.replace('-', ' ')} context</p>
              </div>
              <button
                onClick={() => setContextPanelOpen(false)}
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textTertiary, transition: `background-color ${transitions.instant}` }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceHover; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: `${spacing['4']} ${spacing['5']}` }}>
              {(() => {
                type Insight = { label: string; value: string | number; trend?: 'up' | 'down' | 'flat'; severity?: keyof typeof severityColors };
                type Annotation = { id: string; severity: string; title: string; insight: string };
                type Analysis = { summary: string; insights: Insight[]; recommendation: string };
                // Wired by future AI-context fetch — null-typed stub keeps the
                // panel rendering its empty state without removing the markup.
                let analysis: Analysis | null = null;
                analysis = analysis as Analysis | null;
                const annotations: Annotation[] = [];
                return analysis ? (
                <>
                  {/* Summary */}
                  <p style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, margin: 0, marginBottom: spacing['5'], lineHeight: typography.lineHeight.relaxed }}>
                    {analysis.summary}
                  </p>

                  {/* Metrics */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginBottom: spacing['5'] }}>
                    {analysis.insights.map((insight, i) => {
                      const TrendIcon = insight.trend ? trendIcons[insight.trend] : null;
                      const valueColor = insight.severity ? (severityColors[insight.severity] || colors.textPrimary) : colors.textPrimary;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base }}>
                          <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{insight.label}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: valueColor }}>{insight.value}</span>
                            {TrendIcon && <TrendIcon size={12} color={valueColor} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Recommendation */}
                  <div style={{ padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: `${colors.statusReview}08`, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusReview}`, marginBottom: spacing['5'] }}>
                    <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusReview, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, margin: 0, marginBottom: spacing['1'] }}>Recommendation</p>
                    <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.relaxed }}>{analysis.recommendation}</p>
                  </div>

                  {/* Annotations for this page */}
                  {annotations.length > 0 && (
                    <>
                      <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, margin: 0, marginBottom: spacing['3'] }}>
                        Active Annotations ({annotations.length})
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                        {annotations.map((ann) => (
                          <div
                            key={ann.id}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
                              padding: `${spacing['2']} ${spacing['3']}`, borderRadius: borderRadius.base,
                              cursor: 'pointer', transition: `background-color ${transitions.instant}`,
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceHover; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
                          >
                            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: severityColors[ann.severity] || colors.statusInfo, marginTop: 6, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>{ann.title}</p>
                              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ann.insight}</p>
                            </div>
                            <ChevronRight size={14} color={colors.textTertiary} style={{ marginTop: 4, flexShrink: 0 }} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: spacing['8'] }}>
                  <Sparkles size={32} color={colors.textTertiary} style={{ marginBottom: spacing['3'] }} />
                  <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0 }}>No AI analysis available for this page yet.</p>
                </div>
              )
              })()}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

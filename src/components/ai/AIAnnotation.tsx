import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../../styles/theme';
import type { AIAnnotation as AIAnnotationType } from '../../data/aiAnnotations';
import { useAIAnnotationStore } from '../../stores';

interface AIAnnotationIndicatorProps {
  annotation: AIAnnotationType;
  inline?: boolean;
}

const severityColors: Record<string, string> = {
  critical: colors.statusCritical,
  warning: colors.statusPending,
  info: colors.statusInfo,
  positive: colors.statusActive,
};

export const AIAnnotationIndicator: React.FC<AIAnnotationIndicatorProps> = ({ annotation, inline = false }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const { dismissedAnnotations, dismissAnnotation } = useAIAnnotationStore();

  if (dismissedAnnotations.has(annotation.id)) return null;

  const dotColor = severityColors[annotation.severity] || colors.statusInfo;

  return (
    <>
      <div
        style={{
          display: inline ? 'inline-flex' : 'flex',
          alignItems: 'center',
          position: 'relative',
          cursor: 'pointer',
          verticalAlign: 'middle',
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => { e.stopPropagation(); setShowDetail(true); setShowTooltip(false); }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: `${colors.statusReview}14`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Sparkles size={9} color={colors.statusReview} />
        </div>

        {/* Hover tooltip */}
        {showTooltip && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: 6,
              padding: `${spacing['2']} ${spacing['3']}`,
              backgroundColor: colors.surfaceRaised,
              borderRadius: borderRadius.md,
              boxShadow: shadows.dropdown,
              whiteSpace: 'nowrap',
              maxWidth: '280px',
              zIndex: zIndex.tooltip as number,
              animation: 'fadeIn 100ms ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{annotation.title}</span>
            </div>
            <p style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, margin: 0, whiteSpace: 'normal', lineHeight: typography.lineHeight.normal }}>{annotation.insight}</p>
            <p style={{ fontSize: '10px', color: colors.statusReview, margin: 0, marginTop: spacing['1'] }}>Click for details</p>
          </div>
        )}
      </div>

      {/* Detail panel overlay */}
      {showDetail && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: zIndex.modal as number,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowDetail(false)}
        >
          <div
            style={{
              width: '440px', maxWidth: '90vw',
              backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl,
              boxShadow: shadows.panel, overflow: 'hidden',
              animation: 'scaleIn 150ms ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['4']} ${spacing['5']}`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: `${colors.statusReview}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={14} color={colors.statusReview} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{annotation.title}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginTop: 2 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dotColor }} />
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'capitalize' }}>{annotation.severity} · {annotation.category}</span>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.statusReview }}>{annotation.confidence}% confidence</span>
                </div>
              </div>
              <button onClick={() => setShowDetail(false)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textTertiary }}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: `${spacing['4']} ${spacing['5']}`, display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
              <div>
                <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, margin: 0, marginBottom: spacing['1'] }}>Insight</p>
                <p style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.relaxed }}>{annotation.insight}</p>
              </div>

              <div>
                <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, margin: 0, marginBottom: spacing['1'] }}>AI Reasoning</p>
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, lineHeight: typography.lineHeight.relaxed }}>{annotation.reasoning}</p>
              </div>

              <div style={{ padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: `${colors.statusReview}08`, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusReview}` }}>
                <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusReview, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, margin: 0, marginBottom: spacing['1'] }}>Suggested Action</p>
                <p style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.relaxed }}>{annotation.suggestedAction}</p>
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', gap: spacing['2'], padding: `${spacing['3']} ${spacing['5']}`, borderTop: `1px solid ${colors.borderSubtle}` }}>
              <button
                onClick={() => { setShowDetail(false); dismissAnnotation(annotation.id); }}
                style={{
                  padding: `${spacing['2']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.base,
                  backgroundColor: 'transparent', color: colors.textTertiary, fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily, cursor: 'pointer', transition: `color ${transitions.instant}`,
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

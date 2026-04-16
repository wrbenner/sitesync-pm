import React from 'react';
import { Sparkles, X, Loader2, CheckCircle2 } from 'lucide-react';
import { Btn } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../../styles/theme';

interface ConflictItem {
  severity: 'high' | 'medium' | 'low';
  description: string;
  sheets: string[];
}

interface AiInsightsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  analyzed: boolean;
  conflicts: ConflictItem[];
  hasSelectedDrawing: boolean;
  onAnalyze: () => void;
}

export const AiInsightsPanel: React.FC<AiInsightsPanelProps> = ({
  isOpen,
  onClose,
  loading,
  error,
  analyzed,
  conflicts,
  hasSelectedDrawing,
  onAnalyze,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="complementary"
      aria-label="AI coordination insights"
      style={{
        position: 'fixed', right: 0, top: 64, bottom: 0, width: 320,
        backgroundColor: colors.surfaceRaised,
        borderLeft: `1px solid ${colors.borderSubtle}`,
        boxShadow: shadows.panel,
        zIndex: zIndex.sticky,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'slideInRight 0.22s cubic-bezier(0.32,0.72,0,1)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['4']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, flexShrink: 0 }}>
        <Sparkles size={16} color={colors.statusReview} />
        <span style={{ flex: 1, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>AI Insights</span>
        <button
          onClick={onClose}
          aria-label="Close AI insights panel"
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textTertiary }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: spacing['4'], display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
        <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>Detected Conflicts</p>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['3']} 0` }}>
            <Loader2 size={16} color={colors.statusReview} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Analyzing...</span>
          </div>
        ) : error ? (
          <div style={{ padding: spacing['3'], backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.base, border: `1px solid ${colors.statusCritical}30` }}>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical, margin: 0 }}>{error}</p>
          </div>
        ) : !analyzed ? (
          <div style={{ padding: `${spacing['5']} ${spacing['3']}`, textAlign: 'center' }}>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, lineHeight: typography.lineHeight.normal }}>
              Select a drawing and click Analyze to detect coordination conflicts.
            </p>
          </div>
        ) : conflicts.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['3']} 0` }}>
            <CheckCircle2 size={16} color={colors.statusActive} />
            <p style={{ fontSize: typography.fontSize.sm, color: colors.statusActive, margin: 0 }}>No conflicts detected.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
            {conflicts.map((conflict, i) => {
              const severityColor =
                conflict.severity === 'high' ? colors.statusCritical :
                conflict.severity === 'medium' ? colors.statusPending :
                colors.statusInfo;
              const severityBg =
                conflict.severity === 'high' ? colors.statusCriticalSubtle :
                conflict.severity === 'medium' ? colors.statusPendingSubtle :
                colors.statusInfoSubtle;
              return (
                <div key={i} style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base, border: `1px solid ${colors.borderSubtle}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
                    <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: severityColor, backgroundColor: severityBg, padding: '2px 8px', borderRadius: borderRadius.full }}>
                      {conflict.severity.charAt(0).toUpperCase() + conflict.severity.slice(1)}
                    </span>
                    {conflict.sheets.length > 0 && <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{conflict.sheets.join(', ')}</span>}
                  </div>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.normal }}>{conflict.description}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: spacing['4'], borderTop: `1px solid ${colors.borderSubtle}`, flexShrink: 0 }}>
        <Btn variant="primary" size="md" fullWidth icon={<Sparkles size={14} />} onClick={onAnalyze} disabled={!hasSelectedDrawing || loading} aria-label="Analyze drawing for coordination conflicts">
          {loading ? 'Analyzing...' : 'Analyze Drawing'}
        </Btn>
        {!hasSelectedDrawing && (
          <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: spacing['2'], textAlign: 'center' }}>Select a drawing from the list first.</p>
        )}
      </div>
    </div>
  );
};

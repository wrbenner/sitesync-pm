import React, { useState, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Skeleton } from '../../Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../../../styles/theme';
import { useProjectId } from '../../../hooks/useProjectId';
import { useAIInsights } from '../../../hooks/queries';

interface Risk {
  id: number;
  title: string;
  description: string;
  likelihood: number; // 1-5
  impact: number; // 1-5
  category: string;
  owner: string;
  route: string;
}

function getRiskColor(likelihood: number, impact: number): string {
  const score = likelihood * impact;
  if (score >= 16) return colors.statusCritical;
  if (score >= 9) return colors.statusPending;
  if (score >= 4) return colors.statusInfo;
  return colors.statusActive;
}

export const RiskHeatmapWidget: React.FC = React.memo(() => {
  const projectId = useProjectId();
  const { data: insights = [], isPending: loading } = useAIInsights(projectId, 'dashboard');
  const [hoveredRisk, setHoveredRisk] = useState<Risk | null>(null);
  const gridSize = 5;

  // Derive risks from AI insights with severity/confidence mapped to likelihood/impact
  const risks: Risk[] = useMemo(() => insights
    .filter((i: Record<string, unknown>) => i.category === 'risk' || i.severity === 'critical' || i.severity === 'high')
    .map((i: Record<string, unknown>, idx: number) => ({
      id: idx + 1,
      title: String(i.title || i.insight || ''),
      description: String(i.description || i.recommendation || ''),
      likelihood: i.severity === 'critical' ? 5 : i.severity === 'high' ? 4 : i.severity === 'medium' ? 3 : 2,
      impact: Math.min(5, Math.max(1, Math.round((i.confidence as number) * 5 || 3))),
      category: String(i.category || 'General'),
      owner: String(i.entity_type || ''),
      route: String(i.page || 'dashboard'),
    })), [insights]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], padding: spacing['2'] }}>
        <Skeleton width="60%" height="16px" />
        <Skeleton width="100%" height="120px" />
      </div>
    );
  }

  if (risks.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: spacing['4'], textAlign: 'center' }}>
        <AlertTriangle size={24} color={colors.textTertiary} />
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginTop: spacing['2'] }}>No risks identified</p>
        <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>AI will surface risks as project data accumulates.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
        <AlertTriangle size={16} color={colors.textTertiary} />
        <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
          Risk Matrix
        </span>
        <span style={{ marginLeft: 'auto', fontSize: typography.fontSize.caption, color: colors.statusCritical, fontWeight: typography.fontWeight.semibold }}>
          {risks.filter((r) => r.likelihood * r.impact >= 16).length} critical
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
        {/* Y-axis title */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, paddingRight: 2 }}>
          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Impact</span>
        </div>
        {/* Y-axis tick labels */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingRight: spacing['1'], paddingTop: 2, paddingBottom: 2, flexShrink: 0, minWidth: '32px' }}>
          {['High', '', 'Med', '', 'Low'].map((label, i) => (
            <span key={i} style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: label ? typography.fontWeight.medium : undefined, textAlign: 'right', lineHeight: 1 }}>{label}</span>
          ))}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Grid */}
          <div
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
              gridTemplateRows: `repeat(${gridSize}, 1fr)`,
              gap: 2,
              position: 'relative',
            }}
          >
            {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
              const col = idx % gridSize; // likelihood (1-5, left to right)
              const row = Math.floor(idx / gridSize); // impact (5 at top, 1 at bottom)
              const likelihood = col + 1;
              const impact = gridSize - row;
              const score = likelihood * impact;

              const bgOpacity = score >= 16 ? 0.15 : score >= 9 ? 0.08 : score >= 4 ? 0.04 : 0.02;
              const bgColor = score >= 16 ? colors.statusCritical : score >= 9 ? colors.statusPending : score >= 4 ? colors.statusInfo : colors.statusActive;

              const cellRisks = risks.filter((r) => r.likelihood === likelihood && r.impact === impact);

              return (
                <div
                  key={idx}
                  style={{
                    backgroundColor: `${bgColor}${Math.round(bgOpacity * 255).toString(16).padStart(2, '0')}`,
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    flexWrap: 'wrap',
                    padding: 2,
                    position: 'relative',
                  }}
                >
                  {cellRisks.map((risk) => (
                    <div
                      key={risk.id}
                      onMouseEnter={() => setHoveredRisk(risk)}
                      onMouseLeave={() => setHoveredRisk(null)}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: getRiskColor(risk.likelihood, risk.impact),
                        border: `1.5px solid ${colors.surfaceRaised}`,
                        cursor: 'pointer',
                        transition: `transform ${transitions.instant}`,
                        transform: hoveredRisk?.id === risk.id ? 'scale(1.4)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          {/* X-axis tick labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing['1'], padding: '0 2px' }}>
            {['Low', '', 'Med', '', 'High'].map((label, i) => (
              <span key={i} style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: label ? typography.fontWeight.medium : undefined, flex: 1, textAlign: 'center' }}>{label}</span>
            ))}
          </div>
          {/* X-axis title */}
          <div style={{ textAlign: 'center', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, marginTop: spacing['1'] }}>
            Likelihood
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredRisk && (
        <div
          style={{
            marginTop: spacing['2'],
            padding: `${spacing['2']} ${spacing['3']}`,
            backgroundColor: colors.surfaceInset,
            borderRadius: borderRadius.base,
            borderLeft: `3px solid ${getRiskColor(hoveredRisk.likelihood, hoveredRisk.impact)}`,
          }}
        >
          <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{hoveredRisk.title}</p>
          <p style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, margin: 0, marginTop: 2 }}>{hoveredRisk.description}</p>
          <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 2 }}>{hoveredRisk.category} · {hoveredRisk.owner}</p>
        </div>
      )}
    </div>
  );
});

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../../styles/theme';

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

const risks: Risk[] = [
  { id: 1, title: 'Steel delivery delay', description: 'Phoenix supplier 2 weeks behind on structural steel', likelihood: 4, impact: 5, category: 'Schedule', owner: 'Mike Patterson', route: 'tasks' },
  { id: 2, title: 'Exterior crew weather exposure', description: 'Curtain wall team losing 2+ days per month to weather', likelihood: 3, impact: 3, category: 'Schedule', owner: 'Lisa Zhang', route: 'crews' },
  { id: 3, title: 'Structural budget overrun', description: 'Division at 97% spend with CO-001 approved', likelihood: 4, impact: 4, category: 'Budget', owner: 'Robert Anderson', route: 'budget' },
  { id: 4, title: 'MEP coordination conflicts', description: 'Elevator shaft routing unresolved between 3 trades', likelihood: 3, impact: 4, category: 'Quality', owner: 'Robert Anderson', route: 'rfis' },
  { id: 5, title: 'Safety audit findings', description: '3 open items from last quarterly inspection', likelihood: 2, impact: 4, category: 'Safety', owner: 'Mike Patterson', route: 'daily-log' },
  { id: 6, title: 'Submittal review backlog', description: '4 submittals pending review past due date', likelihood: 3, impact: 2, category: 'Schedule', owner: 'Jennifer Lee', route: 'submittals' },
  { id: 7, title: 'Concrete cure temperature', description: 'Cold weather concrete procedures needed Q4', likelihood: 2, impact: 2, category: 'Quality', owner: 'David Kumar', route: 'daily-log' },
];

function getRiskColor(likelihood: number, impact: number): string {
  const score = likelihood * impact;
  if (score >= 16) return colors.statusCritical;
  if (score >= 9) return colors.statusPending;
  if (score >= 4) return colors.statusInfo;
  return colors.statusActive;
}

export const RiskHeatmapWidget: React.FC = React.memo(() => {
  const [hoveredRisk, setHoveredRisk] = useState<Risk | null>(null);
  const gridSize = 5;

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

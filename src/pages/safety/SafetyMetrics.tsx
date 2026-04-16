import React from 'react';
import { MetricBox } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

interface SafetyMetricsProps {
  isLoading: boolean;
  isMobile: boolean;
  daysSinceIncident: number | null;
  daysColor: 'success' | 'warning' | 'danger' | undefined;
  trir: string | null;
  trirColor: 'success' | 'warning' | 'danger' | undefined;
  openCorrectiveActions: number;
  caColor: 'success' | 'warning' | 'danger' | undefined;
  expiringCerts: number;
  certColor: 'success' | 'warning' | 'danger' | undefined;
  inspectionsThisWeek: number;
}

export const SafetyMetrics: React.FC<SafetyMetricsProps> = ({
  isLoading,
  isMobile,
  daysSinceIncident,
  daysColor,
  trir,
  trirColor,
  openCorrectiveActions,
  caColor,
  expiringCerts,
  certColor,
  inspectionsThisWeek,
}) => {
  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ width: '100%', minWidth: 180, height: 100, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, animation: 'safety-pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: spacing.lg, marginBottom: spacing['2xl'] }}>
      <MetricBox
        label="Days Since Last Incident"
        value={daysSinceIncident ?? 0}
        colorOverride={daysColor}
        changeLabel="Medical treatment or above"
      />
      <div>
        <MetricBox label="TRIR" value={trir ?? 'N/A'} colorOverride={trirColor} />
        <p style={{ margin: '4px 0 0', fontSize: typography.fontSize.caption, color: colors.textTertiary, paddingLeft: spacing['1'] }}>Industry avg: 2.8</p>
      </div>
      <MetricBox label="Open Corrective Actions" value={openCorrectiveActions} colorOverride={caColor} />
      <MetricBox label="Certifications Expiring Soon" value={expiringCerts} colorOverride={certColor} changeLabel="Within 30 days" />
      <MetricBox label="Inspections This Week" value={inspectionsThisWeek} colorOverride={inspectionsThisWeek > 0 ? 'success' : undefined} />
    </div>
  );
};

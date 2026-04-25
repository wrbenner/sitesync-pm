import React from 'react';
import { MetricBox } from '../../components/Primitives';
import { spacing, colors, borderRadius } from '../../styles/theme';

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
}) => {
  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: spacing['3'], marginBottom: spacing.lg }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ width: '100%', height: 88, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, animation: 'safety-pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
      gap: spacing['3'],
      marginBottom: spacing.lg,
    }}>
      <MetricBox label="Days Without Incident" value={daysSinceIncident ?? 0} colorOverride={daysColor} />
      <MetricBox label="TRIR" value={trir ?? 'N/A'} colorOverride={trirColor} />
      <MetricBox label="Open Actions" value={openCorrectiveActions} colorOverride={caColor} />
      <MetricBox label="Expiring Certs" value={expiringCerts} colorOverride={certColor} />
    </div>
  );
};

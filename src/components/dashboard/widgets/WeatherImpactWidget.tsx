import React, { useMemo } from 'react';
import { CloudRain, Sun, Cloud, CloudSun, Droplets } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../../styles/theme';
import { useProjectId } from '../../../hooks/useProjectId';
import { useSchedulePhases } from '../../../hooks/queries';

interface DayForecast {
  day: string;
  icon: 'sun' | 'cloud-sun' | 'cloud' | 'rain' | 'storm';
  high: number;
  low: number;
  precipitation: number;
  outdoorWork: string;
  impactScore: number; // 0-100, 100 = no impact
  conflict: string | null;
}

// Weather data stays hardcoded (no external API available)
const baseForecast: Omit<DayForecast, 'outdoorWork' | 'conflict'>[] = [
  { day: 'Mon', icon: 'sun', high: 82, low: 65, precipitation: 0, impactScore: 95 },
  { day: 'Tue', icon: 'cloud-sun', high: 78, low: 62, precipitation: 10, impactScore: 88 },
  { day: 'Wed', icon: 'cloud', high: 71, low: 58, precipitation: 30, impactScore: 65 },
  { day: 'Thu', icon: 'rain', high: 66, low: 54, precipitation: 85, impactScore: 12 },
  { day: 'Fri', icon: 'cloud-sun', high: 74, low: 60, precipitation: 15, impactScore: 82 },
];

const weatherIcons = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  rain: CloudRain,
  storm: Droplets,
};

function getImpactColor(score: number): string {
  if (score >= 80) return colors.statusActive;
  if (score >= 50) return colors.statusPending;
  return colors.statusCritical;
}

export const WeatherImpactWidget: React.FC = React.memo(() => {
  const projectId = useProjectId();
  const { data: phases } = useSchedulePhases(projectId);

  // Merge real phase names into the weather forecast as "outdoor work" labels and conflicts
  const forecast: DayForecast[] = useMemo(() => {
    const activePhases = (phases || []).filter((p) => (p.status || '').toLowerCase() !== 'complete' && (p.percent_complete ?? 0) < 100);
    const defaultLabels = ['Exterior work', 'Steel erection', 'Exterior painting', 'Concrete pour', 'Roofing'];

    return baseForecast.map((day, i) => {
      const phaseName = activePhases[i % activePhases.length]?.name || defaultLabels[i];
      let conflict: string | null = null;
      if (day.impactScore < 50) {
        conflict = `Rain forecast. ${phaseName} scheduled. 87% chance of delay.`;
      } else if (day.impactScore < 70) {
        conflict = `Wind advisory, ${phaseName} at risk`;
      }
      return { ...day, outdoorWork: phaseName, conflict };
    });
  }, [phases]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['4'] }}>
        <CloudSun size={16} color={colors.textTertiary} />
        <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
          Weather Impact
        </span>
        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: 'auto' }}>Dallas, TX</span>
      </div>

      {/* 5-day bar */}
      <div style={{ display: 'flex', gap: spacing['2'], flex: 1, minHeight: 0 }}>
        {forecast.map((day) => {
          const Icon = weatherIcons[day.icon];
          const impactColor = getImpactColor(day.impactScore);
          return (
            <div
              key={day.day}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: spacing['2'],
                padding: `${spacing['3']} ${spacing['1']}`,
                borderRadius: borderRadius.md,
                backgroundColor: day.conflict ? 'rgba(201, 59, 59, 0.04)' : 'transparent',
                border: day.conflict ? `1px solid rgba(201, 59, 59, 0.12)` : '1px solid transparent',
                cursor: day.conflict ? 'pointer' : 'default',
                transition: `background-color ${transitions.instant}`,
              }}
            >
              <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{day.day}</span>
              <Icon size={20} color={day.icon === 'rain' || day.icon === 'storm' ? colors.statusCritical : colors.textSecondary} />
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textPrimary }}>{day.high}°</span>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{day.low}°</span>

              {/* Impact bar */}
              <div style={{ width: '100%', height: 4, backgroundColor: colors.surfaceInset, borderRadius: 2, marginTop: 'auto' }}>
                <div style={{ width: `${day.impactScore}%`, height: '100%', backgroundColor: impactColor, borderRadius: 2, transition: 'width 0.6s ease-out' }} />
              </div>
              {day.precipitation > 0 && (
                <span style={{ fontSize: '9px', color: colors.statusInfo }}>{day.precipitation}%</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Conflict alert */}
      {forecast.some((d) => d.conflict && d.impactScore < 50) && (
        <div
          style={{
            marginTop: spacing['3'],
            padding: `${spacing['2']} ${spacing['3']}`,
            backgroundColor: 'rgba(201, 59, 59, 0.06)',
            borderRadius: borderRadius.base,
            borderLeft: `3px solid ${colors.statusCritical}`,
          }}
        >
          <p style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical, fontWeight: typography.fontWeight.medium, margin: 0 }}>
            {forecast.find((d) => d.conflict && d.impactScore < 50)?.conflict}
          </p>
        </div>
      )}
    </div>
  );
});

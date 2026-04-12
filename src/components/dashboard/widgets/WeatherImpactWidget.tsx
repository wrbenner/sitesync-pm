import React, { useMemo } from 'react';
import { CloudRain, Sun, Cloud, CloudSun, Droplets } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius, transitions } from '../../../styles/theme';
import { useProjectId } from '../../../hooks/useProjectId';
import { useSchedulePhases, useProject } from '../../../hooks/queries';
import { fetchWeatherForecast5Day } from '../../../lib/weather';
import type { WeatherDay } from '../../../lib/weather';

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

const weatherIcons = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  rain: CloudRain,
  storm: Droplets,
};

function conditionsToIcon(conditions: string): DayForecast['icon'] {
  const c = conditions.toLowerCase();
  if (c.includes('thunder') || c.includes('storm')) return 'storm';
  if (c.includes('rain') || c.includes('drizzle')) return 'rain';
  if (c.includes('cloud') || c.includes('fog') || c.includes('overcast')) return 'cloud';
  if (c.includes('partly')) return 'cloud-sun';
  return 'sun';
}

function precipToImpact(precip: number, conditions: string): number {
  if (conditions.toLowerCase().includes('thunder')) return 5;
  if (precip >= 80) return 10;
  if (precip >= 60) return 30;
  if (precip >= 40) return 55;
  if (precip >= 20) return 75;
  return 95;
}

function getImpactColor(score: number): string {
  if (score >= 80) return colors.statusActive;
  if (score >= 50) return colors.statusPending;
  return colors.statusCritical;
}

export const WeatherImpactWidget: React.FC = React.memo(() => {
  const projectId = useProjectId();
  const { data: project } = useProject(projectId);
  const { data: phases } = useSchedulePhases(projectId);

  const lat = project?.latitude ?? 40.7128;
  const lon = project?.longitude ?? -74.0060;
  const projectCity = [project?.city, project?.state].filter(Boolean).join(', ') || 'Project Site';

  const { data: weatherDays } = useQuery<WeatherDay[]>({
    queryKey: ['weather_forecast_widget', projectId, lat, lon],
    queryFn: () => fetchWeatherForecast5Day(lat, lon),
    enabled: !!projectId,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const forecast: DayForecast[] = useMemo(() => {
    const activePhases = (phases || []).filter((p) => (p.status || '').toLowerCase() !== 'complete' && (p.percent_complete ?? 0) < 100);
    const defaultLabels = ['Exterior work', 'Steel erection', 'Exterior painting', 'Concrete pour', 'Roofing'];

    if (!weatherDays || weatherDays.length === 0) {
      // Fallback: show default labels with neutral weather
      return defaultLabels.slice(0, 5).map((label, i) => ({
        day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i],
        icon: 'sun' as const,
        high: 75,
        low: 55,
        precipitation: 0,
        outdoorWork: activePhases[i % Math.max(activePhases.length, 1)]?.name || label,
        impactScore: 95,
        conflict: null,
      }));
    }

    return weatherDays.slice(0, 5).map((day, i) => {
      const dayLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
      const phaseName = activePhases[i % Math.max(activePhases.length, 1)]?.name || defaultLabels[i];
      const icon = conditionsToIcon(day.conditions);
      const impactScore = precipToImpact(day.precip_probability, day.conditions);
      let conflict: string | null = null;
      if (impactScore < 50) {
        conflict = `${day.conditions} forecast. ${phaseName} scheduled. ${day.precip_probability}% chance of precipitation.`;
      } else if (impactScore < 70) {
        conflict = `${day.conditions} expected, ${phaseName} at risk`;
      }
      return { day: dayLabel, icon, high: day.temp_high, low: day.temp_low, precipitation: day.precip_probability, outdoorWork: phaseName, impactScore, conflict };
    });
  }, [phases, weatherDays]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['4'] }}>
        <CloudSun size={16} color={colors.textTertiary} />
        <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
          Weather Impact
        </span>
        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: 'auto' }}>{projectCity}</span>
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
                backgroundColor: day.conflict ? colors.statusCriticalSubtle : 'transparent',
                border: day.conflict ? `1px solid ${colors.statusCritical}20` : '1px solid transparent',
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
                <div style={{ width: `${day.impactScore}%`, height: '100%', backgroundColor: impactColor, borderRadius: 2, transition: `width ${transitions.smooth}` }} />
              </div>
              {day.precipitation > 0 && (
                <span style={{ fontSize: typography.fontSize.caption, color: colors.statusInfo }}>{day.precipitation}%</span>
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
            backgroundColor: colors.statusCriticalSubtle,
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

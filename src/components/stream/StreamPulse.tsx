import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Hairline, Eyebrow } from '../atoms';
import { colors, typography, spacing } from '../../styles/theme';
import { useProjectId } from '../../hooks/useProjectId';
import { useProject, useWorkforceMembers } from '../../hooks/queries';
import { useScheduleActivities } from '../../hooks/useScheduleActivities';
import { useBudgetData } from '../../hooks/useBudgetData';
import { fetchWeatherForProject, type WeatherSnapshot } from '../../lib/weather';
import { useIsMobile } from '../../hooks/useWindowSize';

interface PulseEntry {
  label: string;
  value: string;
  tone: 'positive' | 'negative' | 'neutral';
  href?: string;
}

function PulseCell({ entry, onClick }: { entry: PulseEntry; onClick?: () => void }) {
  const tone =
    entry.tone === 'positive'
      ? colors.moss
      : entry.tone === 'negative'
        ? colors.rust
        : colors.ink2;

  const Wrap: React.ElementType = entry.href ? 'button' : 'div';

  return (
    <Wrap
      type={entry.href ? 'button' : undefined}
      onClick={entry.href ? onClick : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        padding: 0,
        background: 'transparent',
        border: 'none',
        cursor: entry.href ? 'pointer' : 'default',
        textAlign: 'left',
      }}
    >
      <Eyebrow>{entry.label}</Eyebrow>
      <span
        style={{
          fontFamily: typography.fontFamily,
          fontSize: '14px',
          fontWeight: 500,
          color: tone,
          lineHeight: 1.3,
        }}
      >
        {entry.value}
      </span>
    </Wrap>
  );
}

export const StreamPulse: React.FC = () => {
  const projectId = useProjectId();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const { data: project } = useProject(projectId);
  const { data: scheduleData } = useScheduleActivities(projectId ?? '');
  const { budgetItems } = useBudgetData();
  const { data: workforceData } = useWorkforceMembers(projectId);

  const { data: weather } = useQuery<WeatherSnapshot>({
    queryKey: ['stream_pulse_weather', projectId],
    queryFn: () =>
      fetchWeatherForProject(
        projectId!,
        project?.latitude ?? undefined,
        project?.longitude ?? undefined,
      ),
    enabled: !!projectId,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const schedule: PulseEntry = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const behind = (scheduleData ?? []).filter(
      (a) =>
        a.is_critical_path &&
        a.end_date &&
        a.end_date < today &&
        (a.percent_complete ?? 0) < 100,
    ).length;
    return {
      label: 'Schedule',
      value: behind === 0 ? 'On track' : `${behind} ${behind === 1 ? 'activity' : 'activities'} behind`,
      tone: behind === 0 ? 'positive' : 'negative',
      href: '/schedule',
    };
  }, [scheduleData]);

  const budget: PulseEntry = useMemo(() => {
    const totals = budgetItems.reduce(
      (acc, b) => {
        const approved = Number(b.original_amount ?? 0);
        const committed = Number((b as Record<string, unknown>).committed_amount ?? b.actual_amount ?? 0);
        acc.approved += approved;
        acc.committed += committed;
        return acc;
      },
      { approved: 0, committed: 0 },
    );
    const pct = totals.approved > 0 ? Math.round((totals.committed / totals.approved) * 100) : 0;
    return {
      label: 'Budget',
      value: totals.approved > 0 ? `${pct}% committed` : '—',
      tone: pct > 100 ? 'negative' : 'neutral',
      href: '/budget',
    };
  }, [budgetItems]);

  const weatherEntry: PulseEntry = useMemo(() => {
    if (!weather) return { label: 'Weather', value: '—', tone: 'neutral' };
    const icon = weather.conditions.toLowerCase().includes('rain')
      ? '🌧️'
      : weather.conditions.toLowerCase().includes('cloud')
        ? '☁️'
        : '☀️';
    return {
      label: 'Weather',
      value: `${icon} ${weather.temperature_high}°`,
      tone: 'neutral',
    };
  }, [weather]);

  const crew: PulseEntry = useMemo(
    () => ({
      label: 'Crew',
      value: `${(workforceData ?? []).length} on site`,
      tone: 'neutral',
      href: '/workforce',
    }),
    [workforceData],
  );

  const entries: PulseEntry[] = [schedule, budget, weatherEntry, crew];

  return (
    <div>
      <Hairline weight={2} spacing="tight" style={{ margin: 0 }} />
      <div
        style={{
          display: isMobile ? 'grid' : 'flex',
          gridTemplateColumns: isMobile ? '1fr 1fr' : undefined,
          gap: isMobile ? spacing[4] : spacing[6],
          paddingTop: spacing[5],
          paddingBottom: spacing[5],
          paddingLeft: spacing[5],
          paddingRight: spacing[5],
          alignItems: 'flex-start',
          justifyContent: isMobile ? 'flex-start' : 'space-between',
        }}
      >
        {entries.map((entry) => (
          <PulseCell
            key={entry.label}
            entry={entry}
            onClick={entry.href ? () => navigate(entry.href!) : undefined}
          />
        ))}
      </div>
    </div>
  );
};

export default StreamPulse;

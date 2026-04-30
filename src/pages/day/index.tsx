/**
 * The Day — Command stream homepage.
 *
 * "What matters, what do I owe, who owes me, what changed, what is blocked,
 * and what should happen next?"
 *
 * Single prioritized stream answering those six questions, role-filtered.
 * The action stream is the page; everything else (Pulse, Nav) supports it.
 */

import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ProjectGate } from '../../components/ProjectGate';
import { useCopilotStore } from '../../stores/copilotStore';
import { useProjectId } from '../../hooks/useProjectId';
import { useProject } from '../../hooks/queries';
import { useActionStream } from '../../hooks/useActionStream';
import { usePermissions } from '../../hooks/usePermissions';
import { useIsOnline } from '../../hooks/useOfflineStatus';
import { useIsMobile } from '../../hooks/useWindowSize';
import { colors, typography, spacing } from '../../styles/theme';
import { Eyebrow, Hairline } from '../../components/atoms';
import { ActionStream } from '../../components/stream/ActionStream';
import { StreamEmpty } from '../../components/stream/StreamEmpty';
import { StreamPulse } from '../../components/stream/StreamPulse';
import { StreamNav } from '../../components/stream/StreamNav';
import { fetchWeatherForProject, type WeatherSnapshot } from '../../lib/weather';
import { toStreamRole } from '../../types/stream';
import type {
  StreamItem,
  StreamAction,
  SourceReference,
} from '../../types/stream';
import { WifiOff } from 'lucide-react';

// ── Header — project name, date, weather ──────────────────────

function StreamHeader({ projectName }: { projectName: string }) {
  const projectId = useProjectId();
  const { data: project } = useProject(projectId);
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

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const weatherIcon = weather
    ? weather.conditions.toLowerCase().includes('rain')
      ? '🌧️'
      : weather.conditions.toLowerCase().includes('cloud')
        ? '☁️'
        : '☀️'
    : null;

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: spacing[4],
        paddingTop: spacing[6],
        paddingBottom: spacing[4],
        paddingLeft: spacing[5],
        paddingRight: spacing[5],
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <Eyebrow>{projectName}</Eyebrow>
        <span
          style={{
            fontFamily: typography.fontFamily,
            fontSize: 14,
            fontWeight: 400,
            color: colors.ink2,
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {dateLabel}
        </span>
      </div>
      {weather && weatherIcon && (
        <div
          aria-label={`Weather: ${weather.conditions}, ${weather.temperature_high}°F`}
          style={{
            fontFamily: typography.fontFamily,
            fontSize: 14,
            color: colors.ink3,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span aria-hidden="true">{weatherIcon}</span>
          <span>{weather.temperature_high}°</span>
        </div>
      )}
    </header>
  );
}

// ── Offline banner ─────────────────────────────────────────────

function OfflineHairlineBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing[2],
        paddingTop: spacing[2],
        paddingBottom: spacing[2],
        paddingLeft: spacing[5],
        paddingRight: spacing[5],
        fontFamily: typography.fontFamily,
        fontSize: 12,
        fontWeight: 500,
        color: colors.statusPending,
        background: 'var(--color-warningBannerBg)',
      }}
    >
      <WifiOff size={12} aria-hidden="true" />
      <span>Showing cached items — offline</span>
    </div>
  );
}

const TYPE_ROUTE: Record<StreamItem['type'], string> = {
  rfi: '/rfis',
  submittal: '/submittals',
  punch: '/punch-list',
  change_order: '/change-orders',
  task: '/tasks',
  daily_log: '/daily-log',
  incident: '/safety',
  schedule: '/schedule',
  commitment: '/day',
};

// ── Page ───────────────────────────────────────────────────────

const DayPage: React.FC = () => {
  const projectId = useProjectId();
  const { data: project } = useProject(projectId);
  const { setPageContext } = useCopilotStore();
  const isMobile = useIsMobile();
  const isOnline = useIsOnline();
  const navigate = useNavigate();
  const { role: projectRole } = usePermissions();
  const streamRole = toStreamRole(projectRole);

  const stream = useActionStream(streamRole);

  useEffect(() => {
    setPageContext('day');
  }, [setPageContext]);

  const handleSourceOpen = useCallback(
    (source: SourceReference) => {
      if (source.url) navigate(source.url);
    },
    [navigate],
  );

  const handleAction = useCallback(
    (action: StreamAction, item: StreamItem) => {
      if (action.handler === 'dismiss') {
        stream.dismiss(item.id);
        return;
      }
      const first = item.sourceTrail[0];
      navigate(first?.url ?? TYPE_ROUTE[item.type]);
    },
    [navigate, stream],
  );

  // Wave 1: only dismiss-draft is wired here. Send/edit flow lands when Tab D
  // merges the Iris service; until then those buttons are no-ops at this layer.
  const handleIrisAction = useCallback(
    (handler: 'send_draft' | 'edit_draft' | 'dismiss_draft', item: StreamItem) => {
      if (handler === 'dismiss_draft') stream.dismiss(item.id);
    },
    [stream],
  );

  if (!projectId) return <ProjectGate />;

  const projectName = project?.name?.toUpperCase() ?? 'PROJECT';

  return (
    <ErrorBoundary>
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          minHeight: '100vh',
          background: 'var(--color-surfacePage)',
          paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : 0,
        }}
      >
        {!isOnline && <OfflineHairlineBanner />}

        <StreamHeader projectName={projectName} />
        <Hairline weight={3} spacing="tight" style={{ margin: 0 }} />

        {stream.isLoading && stream.items.length === 0 ? (
          <div
            role="status"
            style={{
              padding: spacing[8],
              textAlign: 'center',
              fontFamily: typography.fontFamily,
              fontSize: 13,
              color: colors.ink3,
            }}
          >
            Loading…
          </div>
        ) : stream.items.length === 0 ? (
          <StreamEmpty />
        ) : (
          <ActionStream
            items={stream.items}
            isMobile={isMobile}
            onAction={handleAction}
            onDismiss={stream.dismiss}
            onSnooze={stream.snooze}
            onSourceOpen={handleSourceOpen}
            onIrisAction={handleIrisAction}
            onRefresh={stream.refetch}
          />
        )}

        <StreamPulse />
        <StreamNav role={streamRole} items={stream.items} />
      </div>
    </ErrorBoundary>
  );
};

export default DayPage;

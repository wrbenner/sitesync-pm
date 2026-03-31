import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Users } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows } from '../../../styles/theme';
import { useProjectId } from '../../../hooks/useProjectId';
import { useCrews } from '../../../hooks/queries';

interface CrewDot {
  id: string;
  name: string;
  trade: string;
  x: number;
  y: number;
  count: number;
  color: string;
  status: 'active' | 'idle';
}

const dotColors = [colors.statusInfo, colors.statusActive, colors.statusPending, colors.statusReview, colors.primaryOrange, colors.statusNeutral];

function buildCrewDots(data: ReturnType<typeof useCrews>['data']): CrewDot[] {
  if (!data) return [];
  return data.map((c, i) => ({
    id: c.id,
    name: c.name,
    trade: c.trade || 'General',
    x: 20 + ((i * 37) % 65),
    y: 15 + ((i * 29) % 70),
    count: c.size ?? 0,
    color: dotColors[i % dotColors.length],
    status: (c.status === 'idle' ? 'idle' : 'active') as 'active' | 'idle',
  }));
}

export const LiveSiteWidget: React.FC = React.memo(() => {
  const projectId = useProjectId();
  const { data: crewData } = useCrews(projectId);
  const initialCrews = useMemo(() => buildCrewDots(crewData), [crewData]);
  const [crews, setCrews] = useState<CrewDot[]>([]);

  // Sync when DB data arrives or changes
  useEffect(() => {
    if (initialCrews.length > 0) setCrews(initialCrews);
  }, [initialCrews]);

  const arrivals = useMemo(() => {
    if (!crewData) return [];
    const times = ['6:45 AM', '6:52 AM', '7:00 AM', '7:10 AM', '7:20 AM', '7:30 AM'];
    return crewData
      .filter((c) => c.status !== 'idle')
      .slice(0, 6)
      .map((c, i) => ({ time: times[i] || '7:30 AM', name: c.name, count: c.size ?? 0 }));
  }, [crewData]);
  const [hoveredCrew, setHoveredCrew] = useState<string | null>(null);

  // Simulated movement
  useEffect(() => {
    const interval = setInterval(() => {
      setCrews((prev) =>
        prev.map((c) => ({
          ...c,
          x: Math.max(8, Math.min(92, c.x + (Math.random() - 0.5) * 3)),
          y: Math.max(8, Math.min(92, c.y + (Math.random() - 0.5) * 3)),
        }))
      );
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const totalOnSite = crews.reduce((sum, c) => sum + c.count, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
        <MapPin size={16} color={colors.textTertiary} />
        <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
          Live Site
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.statusActive, animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusActive }}>{totalOnSite}</span>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>on site</span>
        </span>
      </div>

      {/* Site map */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.md,
          overflow: 'hidden',
          border: `1px solid ${colors.borderSubtle}`,
        }}
      >
        {/* Grid lines */}
        {[25, 50, 75].map((p) => (
          <React.Fragment key={p}>
            <div style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 1, backgroundColor: colors.borderSubtle, opacity: 0.5 }} />
            <div style={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, height: 1, backgroundColor: colors.borderSubtle, opacity: 0.5 }} />
          </React.Fragment>
        ))}

        {/* Building outline */}
        <div style={{ position: 'absolute', left: '15%', top: '10%', width: '70%', height: '80%', border: `1.5px dashed ${colors.borderDefault}`, borderRadius: borderRadius.sm }} />

        {/* Crew dots */}
        {crews.map((crew) => (
          <div
            key={crew.id}
            onMouseEnter={() => setHoveredCrew(crew.id)}
            onMouseLeave={() => setHoveredCrew(null)}
            style={{
              position: 'absolute',
              left: `${crew.x}%`,
              top: `${crew.y}%`,
              transform: 'translate(-50%, -50%)',
              transition: 'left 2s ease-in-out, top 2s ease-in-out',
              cursor: 'pointer',
              zIndex: hoveredCrew === crew.id ? 10 : 1,
            }}
          >
            <div
              style={{
                width: crew.status === 'active' ? 14 : 10,
                height: crew.status === 'active' ? 14 : 10,
                borderRadius: '50%',
                backgroundColor: crew.color,
                border: `2px solid ${colors.surfaceRaised}`,
                boxShadow: `0 0 0 ${crew.status === 'active' ? '3px' : '0'} ${crew.color}33`,
                animation: crew.status === 'active' ? 'pulse 3s infinite' : 'none',
              }}
            />
            {hoveredCrew === crew.id && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 4,
                  padding: `${spacing['1']} ${spacing['2']}`,
                  backgroundColor: colors.surfaceRaised,
                  borderRadius: borderRadius.sm,
                  boxShadow: shadows.cardHover,
                  whiteSpace: 'nowrap',
                  fontSize: typography.fontSize.caption,
                }}
              >
                <span style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{crew.name}</span>
                <span style={{ color: colors.textTertiary }}> · {crew.count} workers</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Arrival timeline */}
      <div style={{ marginTop: spacing['3'] }}>
        <div style={{ display: 'flex', gap: spacing['3'], overflowX: 'auto' }}>
          {arrivals.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], flexShrink: 0 }}>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{a.time}</span>
              <Users size={10} color={colors.textTertiary} />
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>{a.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

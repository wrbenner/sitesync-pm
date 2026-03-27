import React, { useState, useEffect } from 'react';
import { MapPin, Users } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../../styles/theme';

interface CrewDot {
  id: number;
  name: string;
  trade: string;
  x: number;
  y: number;
  count: number;
  color: string;
  status: 'active' | 'idle';
}

const initialCrews: CrewDot[] = [
  { id: 1, name: 'Steel Crew A', trade: 'Structural', x: 72, y: 22, count: 14, color: colors.statusInfo, status: 'active' },
  { id: 2, name: 'MEP Crew B', trade: 'Mechanical', x: 35, y: 48, count: 12, color: colors.statusActive, status: 'active' },
  { id: 3, name: 'Electrical C', trade: 'Electrical', x: 55, y: 72, count: 8, color: colors.statusPending, status: 'active' },
  { id: 4, name: 'Exterior D', trade: 'Exterior', x: 88, y: 55, count: 16, color: colors.statusReview, status: 'active' },
  { id: 5, name: 'Framing E', trade: 'Interior', x: 25, y: 28, count: 11, color: colors.primaryOrange, status: 'active' },
  { id: 6, name: 'Finishing F', trade: 'Finishes', x: 48, y: 85, count: 9, color: colors.statusNeutral, status: 'idle' },
];

const arrivals = [
  { time: '6:45 AM', name: 'Steel Crew A', count: 14 },
  { time: '6:52 AM', name: 'MEP Crew B', count: 12 },
  { time: '7:00 AM', name: 'Exterior Crew D', count: 16 },
  { time: '7:10 AM', name: 'Framing Crew E', count: 11 },
];

export const LiveSiteWidget: React.FC = () => {
  const [crews, setCrews] = useState(initialCrews);
  const [hoveredCrew, setHoveredCrew] = useState<number | null>(null);

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
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
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
};

import React, { useState } from 'react';
import { HelpCircle, CheckSquare, Sparkles } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';

export type IssuePinType = 'rfi' | 'punch' | 'ai';

export interface IssuePin {
  id: string;
  type: IssuePinType;
  x: number;
  y: number;
  label: string;
  detail: string;
  severity: 'critical' | 'warning' | 'info';
}

interface IssueOverlayProps {
  pins: IssuePin[];
  visibleTypes: Set<IssuePinType>;
  onToggleType: (type: IssuePinType) => void;
}

const pinConfig: Record<IssuePinType, { icon: React.ReactNode; color: string; label: string }> = {
  rfi: { icon: <HelpCircle size={10} />, color: colors.statusInfo, label: 'RFIs' },
  punch: { icon: <CheckSquare size={10} />, color: colors.statusPending, label: 'Punch Items' },
  ai: { icon: <Sparkles size={10} />, color: colors.statusReview, label: 'AI Flags' },
};

export const IssueOverlay: React.FC<IssueOverlayProps> = ({ pins, visibleTypes, onToggleType }) => {
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);

  const visiblePins = pins.filter((p) => visibleTypes.has(p.type));

  return (
    <>
      {/* Filter toggles */}
      <div style={{ display: 'flex', gap: spacing['2'], position: 'absolute', top: spacing['2'], right: spacing['2'], zIndex: 5 }}>
        {(Object.keys(pinConfig) as unknown as IssuePinType[]).map((type) => {
          const cfg = pinConfig[type];
          const isActive = visibleTypes.has(type);
          const count = pins.filter((p) => p.type === type).length;
          return (
            <button
              key={type}
              onClick={() => onToggleType(type)}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['1'],
                padding: `2px ${spacing['2']}`, border: 'none', borderRadius: borderRadius.full,
                backgroundColor: isActive ? `${cfg.color}18` : colors.surfaceRaised,
                color: isActive ? cfg.color : colors.textTertiary,
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                fontFamily: typography.fontFamily, cursor: 'pointer',
                boxShadow: shadows.card,
                opacity: isActive ? 1 : 0.6, transition: `all ${transitions.instant}`,
              }}
            >
              {cfg.icon} {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Pins */}
      {visiblePins.map((pin) => {
        const cfg = pinConfig[pin.type];
        const isHovered = hoveredPin === pin.id;
        return (
          <div
            key={pin.id}
            onMouseEnter={() => setHoveredPin(pin.id)}
            onMouseLeave={() => setHoveredPin(null)}
            style={{
              position: 'absolute', left: `${pin.x}%`, top: `${pin.y}%`,
              transform: 'translate(-50%, -100%)', zIndex: isHovered ? 10 : 2, cursor: 'pointer',
            }}
          >
            {/* Pin marker */}
            <div style={{
              width: 24, height: 24, borderRadius: '50% 50% 50% 0',
              backgroundColor: cfg.color, transform: 'rotate(-45deg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 2px 6px ${cfg.color}40`,
            }}>
              <div style={{ transform: 'rotate(45deg)', color: colors.white, display: 'flex' }}>{cfg.icon}</div>
            </div>

            {/* Tooltip */}
            {isHovered && (
              <div style={{
                position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                marginBottom: 4, padding: `${spacing['2']} ${spacing['3']}`,
                backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.md,
                boxShadow: shadows.dropdown, whiteSpace: 'nowrap', minWidth: '160px',
                animation: 'fadeIn 100ms ease-out',
              }}>
                <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{pin.label}</p>
                <p style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, margin: 0, marginTop: 2, whiteSpace: 'normal', maxWidth: '200px' }}>{pin.detail}</p>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

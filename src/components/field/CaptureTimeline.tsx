import React from 'react';
import { Camera, Mic, FileText, AlertTriangle } from 'lucide-react';
import { colors, spacing, typography } from '../../styles/theme';

interface CaptureEvent {
  id: number;
  type: 'photo' | 'voice' | 'text' | 'issue';
  title: string;
  time: string;
  capturedBy: string;
  preview?: string;
}

interface CaptureTimelineProps {
  events: CaptureEvent[];
  onSelect?: (event: CaptureEvent) => void;
}

const typeIcons = {
  photo: Camera,
  voice: Mic,
  text: FileText,
  issue: AlertTriangle,
};

const typeColors = {
  photo: colors.statusInfo,
  voice: colors.statusReview,
  text: colors.textSecondary,
  issue: colors.statusCritical,
};

export const CaptureTimeline: React.FC<CaptureTimelineProps> = ({ events, onSelect }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Timeline line */}
      <div style={{ position: 'absolute', left: 15, top: 8, bottom: 8, width: 2, backgroundColor: colors.borderSubtle }} />

      {events.map((event) => {
        const Icon = typeIcons[event.type];
        const dotColor = typeColors[event.type];
        return (
          <div
            key={event.id}
            onClick={() => onSelect?.(event)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: spacing['4'],
              padding: `${spacing['3']} 0`, cursor: onSelect ? 'pointer' : 'default',
              position: 'relative',
            }}
          >
            {/* Dot */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              backgroundColor: `${dotColor}14`, display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              zIndex: 1, border: `2px solid ${colors.surfaceRaised}`,
            }}>
              <Icon size={14} color={dotColor} />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>{event.title}</p>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, flexShrink: 0 }}>{event.time}</span>
              </div>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 2 }}>{event.capturedBy}</p>
              {event.preview && (
                <p style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, margin: 0, marginTop: spacing['1'], fontStyle: 'italic' }}>&quot;{event.preview}&quot;</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

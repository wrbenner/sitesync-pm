import React, { useState } from 'react';
import { Camera, MapPin, Sparkles, Map as MapIcon, CheckSquare, Square } from 'lucide-react';
import { Card } from '../../components/Primitives';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import type { FieldCapture } from '../../types/database';
import { TAG_COLORS, formatTimestamp } from './types';

// ── Photo card (grid tile) ─────────────────────────────────

interface PhotoCardProps {
  capture: FieldCapture;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

const PhotoCard: React.FC<PhotoCardProps> = ({ capture, isSelected = false, onSelect }) => {
  const [hovered, setHovered] = useState(false);
  const tags = Array.isArray(capture.ai_tags) ? (capture.ai_tags as string[]) : [];
  const hasAiFlag = !!capture.ai_category;

  return (
    <div
      role="article"
      aria-label={`Field capture: ${capture.content || 'Photo'}`}
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect && onSelect(capture.id)}
      style={{
        position: 'relative',
        backgroundColor: colors.white,
        borderRadius: borderRadius.xl,
        boxShadow: hovered ? shadows.cardHover : shadows.card,
        overflow: 'hidden',
        cursor: onSelect ? 'pointer' : 'default',
        transition: `box-shadow ${transitions.quick}, outline ${transitions.quick}`,
        outline: isSelected ? `2px solid ${colors.primaryOrange}` : '2px solid transparent',
        outlineOffset: '2px',
      }}
    >
      {/* Selection checkbox */}
      {onSelect && (
        <div style={{ position: 'absolute', top: spacing['2'], left: spacing['2'], zIndex: 10 }}>
          {isSelected
            ? <CheckSquare size={20} color={colors.primaryOrange} fill={colors.white} />
            : <Square size={20} color="rgba(255,255,255,0.85)" />
          }
        </div>
      )}
      {/* Thumbnail */}
      {capture.file_url ? (
        <img
          src={capture.file_url}
          alt={capture.content || 'Field capture'}
          style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
          loading="lazy"
        />
      ) : (
        <div
          style={{
            width: '100%',
            aspectRatio: '4/3',
            backgroundColor: colors.surfaceInset,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Camera size={28} color={colors.textTertiary} />
        </div>
      )}

      {/* Weather tag badge */}
      {tags.includes('weather') && (
        <div
          style={{
            position: 'absolute',
            bottom: spacing['2'],
            left: spacing['2'],
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderRadius: borderRadius.full,
            padding: `${spacing['1']} ${spacing['2']}`,
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <span style={{ fontSize: '10px', color: colors.white, fontWeight: typography.fontWeight.medium }}>weather</span>
        </div>
      )}

      {/* AI sparkle badge */}
      {hasAiFlag && (
        <div
          style={{
            position: 'absolute',
            top: spacing['2'],
            right: spacing['2'],
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderRadius: borderRadius.full,
            padding: `${spacing['1']} ${spacing['2']}`,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Sparkles size={11} color="#fff" />
          <span style={{ fontSize: '10px', color: colors.white, fontWeight: typography.fontWeight.semibold }}>
            {capture.ai_category}
          </span>
        </div>
      )}

      {/* GPS badge */}
      {capture.location && (
        <div
          style={{
            position: 'absolute',
            top: spacing['2'],
            left: spacing['2'],
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderRadius: borderRadius.full,
            padding: `${spacing['1']} ${spacing['2']}`,
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <MapPin size={10} color="#fff" />
          <span style={{ fontSize: '10px', color: colors.white }}>{capture.location}</span>
        </div>
      )}

      {/* Info footer */}
      <div style={{ padding: `${spacing['2']} ${spacing['3']} ${spacing['3']}` }}>
        {capture.content && (
          <p
            style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              color: colors.textPrimary,
              margin: 0,
              marginBottom: '2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {capture.content}
          </p>
        )}
        <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>
          {formatTimestamp(capture.created_at)}
        </p>

        {/* Tag pills */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: spacing['1'] }}>
            {tags.slice(0, 3).map((tag: string) => {
              const tc = TAG_COLORS[tag] ?? { bg: `${colors.primaryOrange}14`, text: colors.primaryOrange };
              return (
                <span
                  key={tag}
                  style={{
                    padding: '1px 6px',
                    backgroundColor: tc.bg,
                    color: tc.text,
                    borderRadius: borderRadius.full,
                    fontSize: '10px',
                    fontWeight: typography.fontWeight.medium,
                  }}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        )}

        {/* Linked item badge */}
        {capture.linked_drawing_id && (
          <div style={{ marginTop: spacing['1'] }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '1px 6px',
                backgroundColor: `${colors.statusInfo}14`,
                color: colors.statusInfo,
                borderRadius: borderRadius.full,
                fontSize: '10px',
                fontWeight: typography.fontWeight.medium,
              }}
            >
              Drawing linked
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Map view placeholder ────────────────────────────────────

export const MapViewContainer: React.FC<{ captures: FieldCapture[] }> = ({ captures }) => {
  const withLocation = captures.filter(c => c.location);
  return (
    <div
      style={{
        backgroundColor: colors.surfaceInset,
        borderRadius: borderRadius.xl,
        border: `1px dashed ${colors.borderDefault}`,
        padding: spacing['10'],
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '320px',
        gap: spacing['4'],
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: `${colors.statusInfo}14`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MapIcon size={28} color={colors.statusInfo} />
      </div>
      <div>
        <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['1'] }}>
          Map view
        </p>
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>
          Mapbox is not configured. {withLocation.length} capture{withLocation.length !== 1 ? 's' : ''} have location data.
        </p>
      </div>
      {withLocation.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'], justifyContent: 'center', maxWidth: '400px' }}>
          {withLocation.slice(0, 8).map(c => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['1.5']} ${spacing['3']}`,
                backgroundColor: colors.white,
                borderRadius: borderRadius.full,
                boxShadow: shadows.card,
                fontSize: typography.fontSize.caption,
                color: colors.textSecondary,
              }}
            >
              <MapPin size={10} color={colors.primaryOrange} />
              {c.location}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Empty state ──────────────────────────────────────────────

export const EmptyState: React.FC<{ onCaptureClick: () => void }> = ({ onCaptureClick }) => (
  <Card padding={spacing['10']}>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing['4'],
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          backgroundColor: `${colors.primaryOrange}12`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Camera size={36} color={colors.primaryOrange} />
      </div>
      <div>
        <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>
          No field captures yet
        </p>
        <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0, lineHeight: typography.lineHeight.normal }}>
          Start documenting site conditions with photos.
        </p>
      </div>
      <PermissionGate permission="field_capture.create">
        <button
          aria-label="Open camera to capture"
          onClick={onCaptureClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
            padding: `${spacing['3']} ${spacing['6']}`,
            backgroundColor: colors.primaryOrange,
            color: colors.white,
            border: 'none',
            borderRadius: borderRadius.lg,
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily,
            cursor: 'pointer',
            minHeight: '56px',
          }}
        >
          <Camera size={18} />
          Open Camera
        </button>
      </PermissionGate>
    </div>
  </Card>
);

// ── Photo grid ───────────────────────────────────────────────

interface PhotoGridProps {
  captures: FieldCapture[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
}

export const PhotoGrid: React.FC<PhotoGridProps> = ({ captures, selectedIds, onSelect }) => (
  <>
    <style>{`
      @media (max-width: 640px) {
        .fc-grid { grid-template-columns: repeat(1, 1fr) !important; }
      }
      @media (min-width: 641px) and (max-width: 1023px) {
        .fc-grid { grid-template-columns: repeat(2, 1fr) !important; }
      }
    `}</style>
    <div
      className="fc-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: spacing['3'],
      }}
    >
      {captures.map(capture => (
        <PhotoCard
          key={capture.id}
          capture={capture}
          isSelected={selectedIds.has(capture.id)}
          onSelect={onSelect}
        />
      ))}
    </div>
  </>
);

import React, { useState } from 'react';
import { Camera, MapPin, X, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';

export type PhotoCategory = 'progress' | 'safety' | 'quality' | 'weather';

export interface DailyLogPhoto {
  id: string;
  url: string;
  thumbnail?: string;
  caption: string;
  category: PhotoCategory;
  timestamp: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface PhotoGridProps {
  photos: DailyLogPhoto[];
  onCapture?: () => void;
}

const categoryConfig: Record<PhotoCategory, { label: string; color: string }> = {
  progress: { label: 'Progress', color: colors.statusInfo },
  safety: { label: 'Safety', color: colors.statusCritical },
  quality: { label: 'Quality', color: colors.statusActive },
  weather: { label: 'Weather', color: colors.statusPending },
};

export const PhotoGrid: React.FC<PhotoGridProps> = ({ photos, onCapture }) => {
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const viewing = viewIndex !== null ? photos[viewIndex] : null;

  const next = () => {
    if (viewIndex !== null && viewIndex < photos.length - 1) setViewIndex(viewIndex + 1);
  };
  const prev = () => {
    if (viewIndex !== null && viewIndex > 0) setViewIndex(viewIndex - 1);
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: spacing['2'] }}>
        {photos.map((photo, idx) => {
          const cat = categoryConfig[photo.category];
          return (
            <div
              key={photo.id}
              onClick={() => setViewIndex(idx)}
              style={{
                position: 'relative', aspectRatio: '1', borderRadius: borderRadius.md,
                overflow: 'hidden', cursor: 'pointer',
                backgroundColor: colors.surfaceInset,
                transition: `transform ${transitions.instant}`,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.03)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}
            >
              {photo.url ? (
                <img src={photo.url} alt={photo.caption} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${cat.color}22, ${cat.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={24} color={cat.color} />
                </div>
              )}
              {/* Category badge */}
              <span style={{
                position: 'absolute', top: spacing['1'], left: spacing['1'],
                fontSize: '9px', fontWeight: typography.fontWeight.semibold,
                color: colors.white, backgroundColor: cat.color,
                padding: `1px ${spacing['1']}`, borderRadius: borderRadius.sm,
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>{cat.label}</span>
              {/* Caption overlay */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.6))', padding: `${spacing['3']} ${spacing['2']} ${spacing['1']}` }}>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.3 }}>{photo.caption}</p>
                {photo.latitude && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
                    <MapPin size={8} color="rgba(255,255,255,0.6)" />
                    <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.6)' }}>GPS tagged</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {/* Capture button */}
        {onCapture && (
          <div
            onClick={onCapture}
            style={{
              aspectRatio: '1', borderRadius: borderRadius.md,
              border: `2px dashed ${colors.borderDefault}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: spacing['2'], cursor: 'pointer',
              transition: `border-color ${transitions.quick}, background-color ${transitions.quick}`,
              minHeight: 140,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.borderColor = colors.primaryOrange;
              (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.orangeSubtle;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.borderColor = colors.borderDefault;
              (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
            }}
          >
            <Camera size={24} color={colors.textTertiary} />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>Add Photo</span>
          </div>
        )}
      </div>

      {/* Full-screen lightbox */}
      {viewing && viewIndex !== null && (
        <div
          onClick={() => setViewIndex(null)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)',
            zIndex: 1060, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {/* Close */}
          <button onClick={() => setViewIndex(null)} style={{ position: 'absolute', top: spacing['4'], right: spacing['4'], padding: spacing['2'], backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: borderRadius.full, cursor: 'pointer', color: colors.white, zIndex: 2 }}>
            <X size={20} />
          </button>

          {/* Prev */}
          {viewIndex > 0 && (
            <button onClick={e => { e.stopPropagation(); prev(); }} style={{ position: 'absolute', left: spacing['4'], padding: spacing['3'], backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: borderRadius.full, cursor: 'pointer', color: colors.white, zIndex: 2 }}>
              <ChevronLeft size={24} />
            </button>
          )}

          {/* Image */}
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '80vh', position: 'relative' }}>
            {viewing.url ? (
              <img src={viewing.url} alt={viewing.caption} style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: borderRadius.lg }} />
            ) : (
              <div style={{ width: 400, height: 300, background: `linear-gradient(135deg, ${categoryConfig[viewing.category].color}22, ${categoryConfig[viewing.category].color}44)`, borderRadius: borderRadius.lg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={48} color={categoryConfig[viewing.category].color} />
              </div>
            )}
            {/* Info bar */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', padding: `${spacing['6']} ${spacing['4']} ${spacing['4']}`, borderRadius: `0 0 ${borderRadius.lg} ${borderRadius.lg}` }}>
              <p style={{ fontSize: typography.fontSize.title, color: colors.white, margin: 0, fontWeight: typography.fontWeight.medium }}>{viewing.caption}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'], marginTop: spacing['2'] }}>
                <span style={{ fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                  <Tag size={12} /> {categoryConfig[viewing.category].label}
                </span>
                <span style={{ fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.6)' }}>
                  {new Date(viewing.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
                {viewing.latitude && (
                  <span style={{ fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                    <MapPin size={12} /> {viewing.latitude.toFixed(4)}, {viewing.longitude?.toFixed(4)}
                  </span>
                )}
              </div>
              <span style={{ fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.4)', marginTop: spacing['1'], display: 'block' }}>
                {viewIndex + 1} of {photos.length}
              </span>
            </div>
          </div>

          {/* Next */}
          {viewIndex < photos.length - 1 && (
            <button onClick={e => { e.stopPropagation(); next(); }} style={{ position: 'absolute', right: spacing['4'], padding: spacing['3'], backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: borderRadius.full, cursor: 'pointer', color: colors.white, zIndex: 2 }}>
              <ChevronRight size={24} />
            </button>
          )}
        </div>
      )}
    </>
  );
};

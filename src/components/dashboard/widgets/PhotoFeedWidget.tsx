import React, { useState } from 'react';
import { Camera, Tag, Clock, User, X } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions, zIndex } from '../../../styles/theme';

interface SitePhoto {
  id: number;
  imageUrl: string;
  title: string;
  capturedBy: string;
  timestamp: string;
  location: string;
  aiTags: string[];
}

const photos: SitePhoto[] = [
  { id: 1, imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400', title: 'Floor 7 Steel Connection', capturedBy: 'John Smith', timestamp: '2h ago', location: 'Floor 7, Grid B4', aiTags: ['structural', 'connection', 'progress'] },
  { id: 2, imageUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400', title: 'Safety Gear Inspection', capturedBy: 'Maria Garcia', timestamp: '4h ago', location: 'North Entrance', aiTags: ['safety', 'PPE', 'inspection'] },
  { id: 3, imageUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400', title: 'Drywall Progress L3', capturedBy: 'Robert Chen', timestamp: '6h ago', location: 'Floor 3, Unit 301', aiTags: ['interior', 'drywall', 'progress'] },
  { id: 4, imageUrl: 'https://images.unsplash.com/photo-1590644365607-1c5e8a1b6e07?w=400', title: 'MEP Coordination Point', capturedBy: 'James Wilson', timestamp: '8h ago', location: 'Floor 5, Mech Room', aiTags: ['MEP', 'coordination', 'issue'] },
  { id: 5, imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=80', title: 'Curtain Wall Panel 12', capturedBy: 'Lisa Zhang', timestamp: '1d ago', location: 'South Face, Level 6', aiTags: ['exterior', 'curtain wall', 'progress'] },
  { id: 6, imageUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&q=80', title: 'Concrete Cure Check', capturedBy: 'David Kumar', timestamp: '1d ago', location: 'Floor 1, Slab B', aiTags: ['structural', 'concrete', 'quality'] },
];

export const PhotoFeedWidget: React.FC = () => {
  const [selectedPhoto, setSelectedPhoto] = useState<SitePhoto | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
        <Camera size={16} color={colors.textTertiary} />
        <span style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>
          Site Photos
        </span>
        <span style={{ marginLeft: 'auto', fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{photos.length} today</span>
      </div>

      {/* Photo grid */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['2'], overflow: 'hidden' }}>
        {photos.map((photo) => (
          <div
            key={photo.id}
            onClick={() => setSelectedPhoto(photo)}
            style={{
              borderRadius: borderRadius.md,
              backgroundImage: `url(${photo.imageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundColor: colors.surfaceInset,
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              aspectRatio: '1',
              transition: `transform ${transitions.instant}, box-shadow ${transitions.instant}`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.03)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
            }}
          >
            {/* AI tag badge */}
            <div style={{
              position: 'absolute', top: 4, right: 4,
              padding: '1px 5px', borderRadius: borderRadius.full,
              backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
              fontSize: '8px', color: 'white', fontWeight: typography.fontWeight.semibold,
            }}>
              {photo.aiTags[0]}
            </div>

            {/* Bottom overlay */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
              padding: `${spacing['3']} ${spacing['2']} ${spacing['1']}`,
            }}>
              <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.9)', margin: 0, fontWeight: typography.fontWeight.medium, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {photo.title}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Expanded photo detail */}
      {selectedPhoto && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: zIndex.modal as number,
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            style={{
              width: '480px', maxWidth: '90vw',
              backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl,
              overflow: 'hidden', animation: 'scaleIn 150ms ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ height: '240px', backgroundImage: `url(${selectedPhoto.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: colors.surfaceInset, position: 'relative' }}>
              <button
                onClick={() => setSelectedPhoto(null)}
                style={{
                  position: 'absolute', top: 12, right: 12,
                  width: 32, height: 32, borderRadius: borderRadius.full,
                  backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white',
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: spacing['5'] }}>
              <h3 style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{selectedPhoto.title}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginTop: spacing['3'] }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  <User size={14} color={colors.textTertiary} />
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{selectedPhoto.capturedBy}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  <Clock size={14} color={colors.textTertiary} />
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{selectedPhoto.timestamp}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  <Tag size={14} color={colors.textTertiary} />
                  <div style={{ display: 'flex', gap: spacing['1'], flexWrap: 'wrap' }}>
                    {selectedPhoto.aiTags.map((tag) => (
                      <span key={tag} style={{ fontSize: typography.fontSize.caption, color: colors.primaryOrange, backgroundColor: colors.orangeSubtle, padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full, fontWeight: typography.fontWeight.medium }}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { Camera, Tag, Clock, User, X } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions, zIndex } from '../../../styles/theme';
import { useProjectId } from '../../../hooks/useProjectId';
import { useFieldCaptures } from '../../../hooks/queries';
import type { Json } from '../../../types/database';

interface SitePhoto {
  id: string;
  imageUrl: string;
  title: string;
  capturedBy: string;
  timestamp: string;
  location: string;
  aiTags: string[];
}

const defaultImage = 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400';

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function parseAiTags(raw: Json | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === 'string');
  return [];
}

export const PhotoFeedWidget: React.FC = React.memo(() => {
  const projectId = useProjectId();
  const { data: captures } = useFieldCaptures(projectId);

  const photos: SitePhoto[] = useMemo(() => {
    if (!captures) return [];
    return captures
      .filter((c) => c.type === 'photo')
      .slice(0, 6)
      .map((c) => ({
        id: c.id,
        imageUrl: c.file_url || defaultImage,
        title: c.content || 'Site Photo',
        capturedBy: c.created_by || 'Field Team',
        timestamp: formatTimeAgo(c.created_at),
        location: c.location || '',
        aiTags: parseAiTags(c.ai_tags),
      }));
  }, [captures]);

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
                      <span key={tag} style={{ fontSize: typography.fontSize.caption, color: colors.orangeText, backgroundColor: colors.orangeSubtle, padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full, fontWeight: typography.fontWeight.medium }}>{tag}</span>
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
});

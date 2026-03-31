import React, { useState, useMemo, useCallback } from 'react'
import { MapPin, ZoomIn, X } from 'lucide-react'
import { Card, ProgressBar } from '../../Primitives'
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../../../styles/theme'
import type { PhotoGridBlock, PhotoGridItem } from './types'

interface GenPhotoGridProps {
  block: PhotoGridBlock
  onAction?: (action: string, data: Record<string, unknown>) => void
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export const GenPhotoGrid: React.FC<GenPhotoGridProps> = React.memo(({ block, onAction }) => {
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoGridItem | null>(null)

  const handleClose = useCallback(() => setSelectedPhoto(null), [])

  // Separate before/after pairs from single photos
  const { pairs, singles } = useMemo(() => {
    const pairMap = new Map<string, PhotoGridItem[]>()
    const solos: PhotoGridItem[] = []

    for (const photo of block.photos) {
      if (photo.before_after_pair_id) {
        const key = [photo.id, photo.before_after_pair_id].sort().join(':')
        if (!pairMap.has(key)) pairMap.set(key, [])
        pairMap.get(key)!.push(photo)
      } else {
        solos.push(photo)
      }
    }

    return { pairs: Array.from(pairMap.values()), singles: solos }
  }, [block.photos])

  return (
    <Card padding={spacing['4']}>
      {/* Header */}
      <div style={{ marginBottom: spacing['3'], paddingBottom: spacing['3'], borderBottom: `1px solid ${colors.borderSubtle}` }}>
        <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>
          {block.title}
        </p>
        <div style={{ display: 'flex', gap: spacing['4'], fontSize: typography.fontSize.caption, color: colors.textTertiary, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <MapPin size={12} /> {block.location}
          </span>
          {block.project_phase && <span>Phase: <strong style={{ color: colors.textSecondary }}>{block.project_phase}</strong></span>}
          {block.progress_percent != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flex: 1, maxWidth: 160 }}>
              {block.progress_percent}%
              <ProgressBar value={block.progress_percent} max={100} height={3} />
            </span>
          )}
        </div>
      </div>

      {/* Before/After Pairs */}
      {pairs.length > 0 && (
        <div style={{ marginBottom: spacing['4'] }}>
          <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['3'] }}>
            Before / After
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: spacing['3'] }}>
            {pairs.map((pair, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['2'] }}>
                {pair.slice(0, 2).map((photo, i) => (
                  <PhotoThumbnail
                    key={photo.id}
                    photo={photo}
                    label={i === 0 ? 'BEFORE' : 'AFTER'}
                    labelColor={i === 0 ? colors.statusActive : colors.statusInfo}
                    onClick={() => setSelectedPhoto(photo)}
                    height={160}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Single Photos */}
      {singles.length > 0 && (
        <div>
          <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['3'] }}>
            Progress Photos ({singles.length})
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: spacing['2'] }}>
            {singles.map((photo) => (
              <PhotoThumbnail key={photo.id} photo={photo} onClick={() => setSelectedPhoto(photo)} height={120} />
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <Lightbox photo={selectedPhoto} onClose={handleClose} onAction={onAction} />
      )}
    </Card>
  )
})
GenPhotoGrid.displayName = 'GenPhotoGrid'

// ── Thumbnail ────────────────────────────────────────────

interface PhotoThumbnailProps {
  photo: PhotoGridItem
  onClick: () => void
  height: number
  label?: string
  labelColor?: string
}

const PhotoThumbnail: React.FC<PhotoThumbnailProps> = React.memo(({ photo, onClick, height, label, labelColor }) => (
  <button
    onClick={onClick}
    aria-label={photo.caption || 'View photo'}
    style={{
      position: 'relative', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base,
      overflow: 'hidden', cursor: 'pointer', padding: 0, background: 'none',
    }}
  >
    <img
      src={photo.url}
      alt={photo.caption || 'Construction progress photo'}
      loading="lazy"
      style={{ width: '100%', height, objectFit: 'cover', display: 'block' }}
    />
    {label && (
      <span style={{
        position: 'absolute', top: spacing['1'], left: spacing['1'],
        fontSize: '10px', fontWeight: typography.fontWeight.bold, color: 'white',
        backgroundColor: labelColor || colors.statusInfo, padding: `1px ${spacing['2']}`,
        borderRadius: borderRadius.sm,
      }}>
        {label}
      </span>
    )}
    <span style={{
      position: 'absolute', bottom: spacing['1'], right: spacing['1'],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 24, height: 24, borderRadius: borderRadius.full,
      backgroundColor: 'rgba(0,0,0,0.5)', color: 'white',
    }}>
      <ZoomIn size={12} />
    </span>
  </button>
))
PhotoThumbnail.displayName = 'PhotoThumbnail'

// ── Lightbox ─────────────────────────────────────────────

interface LightboxProps {
  photo: PhotoGridItem
  onClose: () => void
  onAction?: (action: string, data: Record<string, unknown>) => void
}

const Lightbox: React.FC<LightboxProps> = React.memo(({ photo, onClose, onAction }) => (
  <>
    <div
      onClick={onClose}
      role="presentation"
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
        zIndex: zIndex.modal as number,
      }}
    />
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo detail"
      style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg,
        maxWidth: 600, maxHeight: '90vh', overflow: 'auto', padding: spacing['5'],
        boxShadow: shadows.lg, zIndex: (zIndex.modal as number) + 1,
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close photo"
        style={{
          position: 'absolute', top: spacing['3'], right: spacing['3'],
          width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary,
        }}
      >
        <X size={16} />
      </button>

      <img
        src={photo.url}
        alt={photo.caption || 'Construction progress photo'}
        style={{ width: '100%', borderRadius: borderRadius.base, marginBottom: spacing['3'] }}
      />

      {photo.caption && (
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>
          {photo.caption}
        </p>
      )}

      <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginBottom: spacing['3'] }}>
        {photo.captured_by} \u00b7 {fmtDate(photo.captured_date)}
      </p>

      {photo.tags && photo.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['1'], marginBottom: spacing['3'] }}>
          {photo.tags.map((tag) => (
            <span key={tag} style={{
              fontSize: typography.fontSize.caption, color: colors.textSecondary,
              backgroundColor: colors.surfaceInset, padding: `${spacing['1']} ${spacing['2']}`,
              borderRadius: borderRadius.sm,
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {onAction && (
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <button
            onClick={() => onAction('annotate_photo', { photo_id: photo.id })}
            style={{
              padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.primaryOrange,
              border: 'none', borderRadius: borderRadius.base, fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.semibold, cursor: 'pointer', color: 'white',
              fontFamily: typography.fontFamily,
            }}
          >
            Add Annotation
          </button>
        </div>
      )}
    </div>
  </>
))
Lightbox.displayName = 'Lightbox'

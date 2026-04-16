// PhotoComparison — Before/after progress photo slider for the Owner Report.
// Side-by-side or slider comparison with date labels.

import React, { useState, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Camera, Calendar } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme'
import type { ProgressPhoto } from '../../services/reportService'

interface PhotoComparisonProps {
  photos: ProgressPhoto[]
}

export const PhotoComparison: React.FC<PhotoComparisonProps> = ({ photos }) => {
  const [leftIdx, setLeftIdx] = useState(Math.min(1, photos.length - 1))
  const [rightIdx, setRightIdx] = useState(0)
  const [sliderPos, setSliderPos] = useState(50)
  const [mode, setMode] = useState<'slider' | 'side-by-side'>('side-by-side')
  const sliderRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const handleMouseDown = useCallback(() => {
    isDragging.current = true
  }, [])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    setSliderPos(Math.max(5, Math.min(95, x)))
  }, [])

  if (photos.length === 0) {
    return (
      <div style={{
        padding: spacing['8'], textAlign: 'center',
        backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg,
      }}>
        <Camera size={32} style={{ color: colors.textTertiary, marginBottom: spacing['3'] }} />
        <p style={{ fontSize: typography.fontSize.body, color: colors.textTertiary, margin: 0 }}>
          No progress photos available yet
        </p>
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>
          Upload photos from the field to enable visual comparisons
        </p>
      </div>
    )
  }

  if (photos.length === 1) {
    const photo = photos[0]
    return (
      <div style={{ borderRadius: borderRadius.lg, overflow: 'hidden' }}>
        <PhotoCard photo={photo} />
      </div>
    )
  }

  const leftPhoto = photos[leftIdx]
  const rightPhoto = photos[rightIdx]

  return (
    <div>
      {/* Mode toggle + navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: spacing['3'],
      }}>
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <button
            onClick={() => setMode('side-by-side')}
            style={{
              padding: `${spacing['1.5']} ${spacing['3']}`,
              fontSize: typography.fontSize.caption,
              fontWeight: mode === 'side-by-side' ? typography.fontWeight.semibold : typography.fontWeight.medium,
              color: mode === 'side-by-side' ? colors.primaryOrange : colors.textTertiary,
              backgroundColor: mode === 'side-by-side' ? colors.orangeSubtle : 'transparent',
              border: 'none',
              borderRadius: borderRadius.sm,
              cursor: 'pointer',
              fontFamily: typography.fontFamily,
            }}
          >
            Side by Side
          </button>
          <button
            onClick={() => setMode('slider')}
            style={{
              padding: `${spacing['1.5']} ${spacing['3']}`,
              fontSize: typography.fontSize.caption,
              fontWeight: mode === 'slider' ? typography.fontWeight.semibold : typography.fontWeight.medium,
              color: mode === 'slider' ? colors.primaryOrange : colors.textTertiary,
              backgroundColor: mode === 'slider' ? colors.orangeSubtle : 'transparent',
              border: 'none',
              borderRadius: borderRadius.sm,
              cursor: 'pointer',
              fontFamily: typography.fontFamily,
            }}
          >
            Slider
          </button>
        </div>

        {/* Photo selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <button
            onClick={() => {
              const newRight = Math.max(0, rightIdx - 1)
              setRightIdx(newRight)
              setLeftIdx(Math.min(photos.length - 1, newRight + 1))
            }}
            disabled={rightIdx === 0}
            style={{
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: colors.surfaceInset, border: 'none',
              borderRadius: borderRadius.sm, cursor: rightIdx === 0 ? 'not-allowed' : 'pointer',
              opacity: rightIdx === 0 ? 0.3 : 1,
              color: colors.textSecondary,
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{
            fontSize: typography.fontSize.caption, color: colors.textTertiary,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {rightIdx + 1} / {photos.length}
          </span>
          <button
            onClick={() => {
              const newRight = Math.min(photos.length - 2, rightIdx + 1)
              setRightIdx(newRight)
              setLeftIdx(Math.min(photos.length - 1, newRight + 1))
            }}
            disabled={rightIdx >= photos.length - 2}
            style={{
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: colors.surfaceInset, border: 'none',
              borderRadius: borderRadius.sm, cursor: rightIdx >= photos.length - 2 ? 'not-allowed' : 'pointer',
              opacity: rightIdx >= photos.length - 2 ? 0.3 : 1,
              color: colors.textSecondary,
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Comparison view */}
      {mode === 'side-by-side' ? (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'],
          borderRadius: borderRadius.lg, overflow: 'hidden',
        }}>
          <div>
            <div style={{
              padding: `${spacing['2']} ${spacing['3']}`,
              backgroundColor: colors.surfaceInset,
              display: 'flex', alignItems: 'center', gap: spacing['1.5'],
              borderRadius: `${borderRadius.md} ${borderRadius.md} 0 0`,
            }}>
              <Calendar size={12} color={colors.textTertiary} />
              <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textSecondary }}>
                {leftPhoto?.capturedAt || 'Earlier'}
              </span>
            </div>
            <PhotoCard photo={leftPhoto} />
          </div>
          <div>
            <div style={{
              padding: `${spacing['2']} ${spacing['3']}`,
              backgroundColor: colors.surfaceInset,
              display: 'flex', alignItems: 'center', gap: spacing['1.5'],
              borderRadius: `${borderRadius.md} ${borderRadius.md} 0 0`,
            }}>
              <Calendar size={12} color={colors.textTertiary} />
              <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textSecondary }}>
                {rightPhoto?.capturedAt || 'Latest'}
              </span>
            </div>
            <PhotoCard photo={rightPhoto} />
          </div>
        </div>
      ) : (
        /* Slider mode */
        <div
          ref={sliderRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            position: 'relative',
            borderRadius: borderRadius.lg,
            overflow: 'hidden',
            height: 320,
            cursor: isDragging.current ? 'col-resize' : 'default',
            userSelect: 'none',
          }}
        >
          {/* Right photo (full) */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: rightPhoto?.url ? `url(${rightPhoto.url})` : undefined,
            backgroundColor: colors.surfaceInset,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }} />

          {/* Left photo (clipped) */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: leftPhoto?.url ? `url(${leftPhoto.url})` : undefined,
            backgroundColor: colors.surfaceHover,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
          }} />

          {/* Slider handle */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: 'absolute',
              top: 0, bottom: 0,
              left: `${sliderPos}%`,
              width: 4,
              backgroundColor: colors.white,
              boxShadow: '0 0 8px rgba(0,0,0,0.3)',
              cursor: 'col-resize',
              zIndex: 2,
              transform: 'translateX(-50%)',
            }}
          >
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 32, height: 32,
              borderRadius: '50%',
              backgroundColor: colors.white,
              boxShadow: shadows.dropdown,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{ display: 'flex', gap: 2 }}>
                <ChevronLeft size={12} color={colors.textSecondary} />
                <ChevronRight size={12} color={colors.textSecondary} />
              </div>
            </div>
          </div>

          {/* Date labels */}
          <div style={{
            position: 'absolute', bottom: spacing['3'], left: spacing['3'],
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: colors.white,
            padding: `${spacing['1']} ${spacing['2']}`,
            borderRadius: borderRadius.sm,
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.medium,
            zIndex: 3,
          }}>
            {leftPhoto?.capturedAt || 'Earlier'}
          </div>
          <div style={{
            position: 'absolute', bottom: spacing['3'], right: spacing['3'],
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: colors.white,
            padding: `${spacing['1']} ${spacing['2']}`,
            borderRadius: borderRadius.sm,
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.medium,
            zIndex: 3,
          }}>
            {rightPhoto?.capturedAt || 'Latest'}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Photo Card ───────────────────────────────────────────

const PhotoCard: React.FC<{ photo: ProgressPhoto | undefined }> = ({ photo }) => {
  if (!photo) {
    return (
      <div style={{
        height: 200, backgroundColor: colors.surfaceInset,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Camera size={24} color={colors.textTertiary} />
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      {photo.url ? (
        <img
          src={photo.url}
          alt={photo.caption || 'Progress photo'}
          style={{
            width: '100%', height: 200, objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <div style={{
          height: 200, backgroundColor: colors.surfaceInset,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: spacing['2'],
        }}>
          <Camera size={24} color={colors.textTertiary} />
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            No image available
          </span>
        </div>
      )}
      {photo.caption && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
          padding: `${spacing['4']} ${spacing['3']} ${spacing['2']}`,
        }}>
          <p style={{
            fontSize: typography.fontSize.caption,
            color: colors.white, margin: 0,
            lineHeight: typography.lineHeight.normal,
          }}>
            {photo.caption}
          </p>
        </div>
      )}
    </div>
  )
}

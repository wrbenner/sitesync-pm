/**
 * Thumbnail service for construction photos and documents.
 * Inspired by Thumbor's URL-based transformation patterns.
 * Uses Supabase Storage image transformation when available,
 * falls back to client-side canvas resizing.
 */

export interface ThumbnailOptions {
  width: number
  height: number
  mode: 'cover' | 'contain' | 'fill'
  quality?: number // 1-100, default 80
  format?: 'webp' | 'jpeg' | 'png'
}

const DEFAULT_SIZES = {
  xs: { width: 40, height: 40 },
  sm: { width: 80, height: 80 },
  md: { width: 200, height: 200 },
  lg: { width: 400, height: 400 },
  xl: { width: 800, height: 600 },
} as const

export type ThumbnailSize = keyof typeof DEFAULT_SIZES

/**
 * Generate a Supabase Storage transformation URL for thumbnails.
 * Supabase supports on-the-fly image transforms via query params.
 */
export function getSupabaseThumbnailUrl(
  publicUrl: string,
  size: ThumbnailSize | ThumbnailOptions = 'md'
): string {
  const opts =
    typeof size === 'string'
      ? { ...DEFAULT_SIZES[size], mode: 'cover' as const, quality: 80 }
      : { quality: 80, ...size }

  // Supabase storage transform URL pattern
  const url = new URL(publicUrl)
  url.searchParams.set('width', String(opts.width))
  url.searchParams.set('height', String(opts.height))
  url.searchParams.set('resize', opts.mode === 'cover' ? 'cover' : 'contain')
  if (opts.quality) url.searchParams.set('quality', String(opts.quality))
  if (opts.format) url.searchParams.set('format', opts.format)

  return url.toString()
}

/**
 * Client-side thumbnail generation using Canvas API.
 * Useful when Supabase transforms aren't available (e.g., non-image files).
 */
export async function generateClientThumbnail(
  file: File,
  options: ThumbnailOptions = { width: 200, height: 200, mode: 'cover', quality: 80 }
): Promise<Blob | null> {
  if (!file.type.startsWith('image/')) return null

  return new Promise((resolve) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    img.onload = () => {
      if (!ctx) {
        resolve(null)
        return
      }

      let sw: number, sh: number, sx: number, sy: number
      const aspectSrc = img.width / img.height
      const aspectDst = options.width / options.height

      if (options.mode === 'cover') {
        if (aspectSrc > aspectDst) {
          sh = img.height
          sw = sh * aspectDst
          sx = (img.width - sw) / 2
          sy = 0
        } else {
          sw = img.width
          sh = sw / aspectDst
          sx = 0
          sy = (img.height - sh) / 2
        }
      } else {
        sx = 0
        sy = 0
        sw = img.width
        sh = img.height
      }

      canvas.width = options.width
      canvas.height = options.height
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, options.width, options.height)

      const format =
        options.format === 'png'
          ? 'image/png'
          : options.format === 'webp'
            ? 'image/webp'
            : 'image/jpeg'
      canvas.toBlob((blob) => resolve(blob), format, (options.quality || 80) / 100)
      URL.revokeObjectURL(img.src)
    }

    img.onerror = () => {
      resolve(null)
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Get placeholder thumbnail for non-image file types
 */
export function getFileTypeThumbnailIcon(contentType: string, filename: string): string {
  if (contentType === 'application/pdf' || filename.endsWith('.pdf')) return 'file-text'
  if (contentType.includes('word') || filename.endsWith('.docx') || filename.endsWith('.doc'))
    return 'file-text'
  if (contentType.includes('sheet') || contentType.includes('excel') || filename.endsWith('.xlsx'))
    return 'table'
  if (contentType.includes('presentation') || filename.endsWith('.pptx')) return 'presentation'
  if (contentType.includes('dwg') || contentType.includes('dxf')) return 'ruler'
  if (contentType.includes('ifc') || filename.endsWith('.ifc')) return 'box'
  if (contentType.startsWith('video/')) return 'video'
  if (contentType.startsWith('text/')) return 'file-text'
  return 'file'
}

export { DEFAULT_SIZES }

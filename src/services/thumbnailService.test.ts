import { describe, it, expect } from 'vitest'
import {
  getSupabaseThumbnailUrl,
  getFileTypeThumbnailIcon,
  DEFAULT_SIZES,
} from './thumbnailService'

describe('thumbnailService — getSupabaseThumbnailUrl', () => {
  const URL_BASE = 'https://example.supabase.co/storage/v1/object/public/photos/foo.jpg'

  it('appends width / height / resize for the named "md" preset', () => {
    const u = new URL(getSupabaseThumbnailUrl(URL_BASE, 'md'))
    expect(u.searchParams.get('width')).toBe('200')
    expect(u.searchParams.get('height')).toBe('200')
    expect(u.searchParams.get('resize')).toBe('cover')
    expect(u.searchParams.get('quality')).toBe('80')
  })

  it.each([
    ['xs', 40, 40],
    ['sm', 80, 80],
    ['md', 200, 200],
    ['lg', 400, 400],
    ['xl', 800, 600],
  ] as const)('preset "%s" → %ix%i', (preset, w, h) => {
    const u = new URL(getSupabaseThumbnailUrl(URL_BASE, preset))
    expect(u.searchParams.get('width')).toBe(String(w))
    expect(u.searchParams.get('height')).toBe(String(h))
  })

  it('honours an explicit ThumbnailOptions object', () => {
    const u = new URL(
      getSupabaseThumbnailUrl(URL_BASE, {
        width: 320, height: 180, mode: 'contain', quality: 90, format: 'webp',
      }),
    )
    expect(u.searchParams.get('width')).toBe('320')
    expect(u.searchParams.get('height')).toBe('180')
    expect(u.searchParams.get('resize')).toBe('contain')
    expect(u.searchParams.get('quality')).toBe('90')
    expect(u.searchParams.get('format')).toBe('webp')
  })

  it('"fill" mode falls through to "contain" (Supabase has no fill)', () => {
    const u = new URL(
      getSupabaseThumbnailUrl(URL_BASE, { width: 200, height: 200, mode: 'fill' }),
    )
    expect(u.searchParams.get('resize')).toBe('contain')
  })

  it('preserves existing query params on the input URL', () => {
    const u = new URL(getSupabaseThumbnailUrl(URL_BASE + '?cache=1', 'md'))
    expect(u.searchParams.get('cache')).toBe('1')
    expect(u.searchParams.get('width')).toBe('200')
  })
})

describe('thumbnailService — getFileTypeThumbnailIcon', () => {
  it.each([
    ['application/pdf', 'doc.pdf', 'file-text'],
    ['', 'doc.pdf', 'file-text'],                           // extension fallback
    ['application/msword', 'note.doc', 'file-text'],
    ['', 'note.docx', 'file-text'],
    ['application/vnd.ms-excel', 'sheet.xlsx', 'table'],
    ['', 'sheet.xlsx', 'table'],
    ['application/vnd.ms-powerpoint', 'deck.pptx', 'presentation'],
    ['application/dwg', 'plan.dwg', 'ruler'],
    ['application/dxf', 'plan.dxf', 'ruler'],
    ['', 'model.ifc', 'box'],
    ['video/mp4', 'clip.mp4', 'video'],
    ['text/plain', 'README.txt', 'file-text'],
  ] as const)('%s + %s → "%s"', (mime, name, expected) => {
    expect(getFileTypeThumbnailIcon(mime, name)).toBe(expected)
  })

  it('returns "file" as the catch-all default', () => {
    expect(getFileTypeThumbnailIcon('application/x-mystery', 'thing.bin')).toBe('file')
  })
})

describe('thumbnailService — DEFAULT_SIZES export', () => {
  it('exposes the documented preset table', () => {
    expect(DEFAULT_SIZES.xs).toEqual({ width: 40, height: 40 })
    expect(DEFAULT_SIZES.xl).toEqual({ width: 800, height: 600 })
  })

  it('every preset has a positive width and height', () => {
    for (const preset of Object.values(DEFAULT_SIZES)) {
      expect(preset.width).toBeGreaterThan(0)
      expect(preset.height).toBeGreaterThan(0)
    }
  })
})

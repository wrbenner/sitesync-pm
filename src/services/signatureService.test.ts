import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  generateSigningUrl,
  computeDocumentHash,
  getSignerColorPalette,
} from './signatureService'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('signatureService — generateSigningUrl', () => {
  it('uses window.location.origin when window is available', () => {
    // jsdom provides window.location.origin (typically "http://localhost:3000")
    const url = generateSigningUrl('req-1', 'sig-2')
    expect(url).toMatch(/\/sign\/req-1\/sig-2$/)
  })

  it('encodes the path with both ids', () => {
    const url = generateSigningUrl('REQ-001', 'SIG-002')
    expect(url).toContain('/sign/REQ-001/SIG-002')
  })
})

describe('signatureService — computeDocumentHash', () => {
  it('returns a sha256: prefix + 56-char zero-padded hex placeholder', () => {
    const h = computeDocumentHash('https://example.com/file.pdf')
    // The source uses 8-char hex + 48-char zero-pad = 56 chars total of [0-9a-f].
    // (Real SHA-256 is 64 chars; this is the documented placeholder.)
    expect(h).toMatch(/^sha256:[0-9a-f]{56}$/)
  })

  it('is deterministic for the same input', () => {
    const a = computeDocumentHash('same-url')
    const b = computeDocumentHash('same-url')
    expect(a).toBe(b)
  })

  it('produces different output for different URLs', () => {
    expect(computeDocumentHash('a')).not.toBe(computeDocumentHash('b'))
  })

  it('handles empty string without throwing', () => {
    expect(computeDocumentHash('')).toMatch(/^sha256:/)
  })
})

describe('signatureService — getSignerColorPalette', () => {
  it('returns 8 colors', () => {
    expect(getSignerColorPalette()).toHaveLength(8)
  })

  it('every color is a valid hex code (#RRGGBB)', () => {
    for (const c of getSignerColorPalette()) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('all colors are visually distinct (no duplicates)', () => {
    const palette = getSignerColorPalette()
    expect(new Set(palette).size).toBe(palette.length)
  })

  it('first color is the brand orange', () => {
    expect(getSignerColorPalette()[0]).toBe('#FF6B00')
  })
})

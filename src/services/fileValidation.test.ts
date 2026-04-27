import { describe, it, expect } from 'vitest'
import {
  detectFileCategory,
  getFileExtension,
  formatFileSize,
  validateFile,
  validateFiles,
  isImageFile,
  isPdfFile,
} from './fileValidation'

// Build a File-like object via the global File constructor (jsdom provides it).
function file(name: string, type: string, size: number): File {
  // Repeat 'a' to hit the requested size; for very large sizes we don't need
  // real bytes, just a File object with the right .size value. Use a minimal
  // body and cheat by patching size where needed.
  const body = new Blob([new Uint8Array(Math.min(size, 1024))], { type })
  const f = new File([body], name, { type })
  Object.defineProperty(f, 'size', { value: size, configurable: true })
  return f
}

describe('fileValidation — getFileExtension', () => {
  it.each([
    ['photo.jpg', '.jpg'],
    ['Drawing.PDF', '.pdf'],     // lowercased
    ['archive.tar.gz', '.gz'],   // last dot wins
    ['noext', ''],
    ['.gitignore', '.gitignore'],
  ])('%s → %s', (name, ext) => {
    expect(getFileExtension(name)).toBe(ext)
  })
})

describe('fileValidation — formatFileSize', () => {
  it.each([
    [0, '0 B'],
    [500, '500 B'],
    [1024, '1.0 KB'],
    [1_500_000, '1.4 MB'],
    [1_073_741_824, '1.0 GB'],
  ])('%i bytes → "%s"', (bytes, label) => {
    expect(formatFileSize(bytes)).toBe(label)
  })
})

describe('fileValidation — detectFileCategory', () => {
  it.each([
    ['application/pdf', 'documents'],
    ['image/jpeg', 'images'],
    ['image/svg+xml', 'images'],
    ['video/mp4', 'video'],
    ['model/gltf-binary', 'models'],
  ] as const)('%s → %s', (mime, cat) => {
    expect(detectFileCategory(mime)).toBe(cat)
  })

  it('returns null for unknown MIME types', () => {
    expect(detectFileCategory('application/x-mystery')).toBeNull()
    expect(detectFileCategory('')).toBeNull()
  })
})

describe('fileValidation — validateFile', () => {
  it('valid PDF in documents category passes', () => {
    const r = validateFile(file('spec.pdf', 'application/pdf', 1024))
    expect(r.valid).toBe(true)
    expect(r.errors).toEqual([])
    expect(r.fileInfo.category).toBe('documents')
  })

  it('blocks dangerous extensions even with safe MIME type', () => {
    const r = validateFile(file('virus.exe', 'application/octet-stream', 100))
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/security/)
  })

  it('flags zero-byte files as invalid', () => {
    const r = validateFile(file('empty.pdf', 'application/pdf', 0))
    expect(r.valid).toBe(false)
    expect(r.errors).toEqual(expect.arrayContaining([expect.stringMatching(/empty/i)]))
  })

  it('warns on large files but does not invalidate', () => {
    // 60 MB — under 100MB doc limit but past 50MB warning threshold
    const r = validateFile(file('huge.pdf', 'application/pdf', 60 * 1024 * 1024))
    expect(r.valid).toBe(true)
    expect(r.warnings.some((w) => /Large file/.test(w))).toBe(true)
  })

  it('rejects files exceeding the category max size', () => {
    // 60 MB image, max is 50 MB
    const r = validateFile(file('big.jpg', 'image/jpeg', 60 * 1024 * 1024))
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/exceeds maximum/)
  })

  it('honours maxSizeOverride', () => {
    const r = validateFile(file('tiny.pdf', 'application/pdf', 5_000), { maxSizeOverride: 1_000 })
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/exceeds maximum/)
  })

  it('honours allowedTypesOverride', () => {
    const r = validateFile(file('a.txt', 'text/plain', 100), {
      allowedTypesOverride: ['text/csv'],
    })
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/not allowed/)
  })

  it('warns when file lacks an extension (default)', () => {
    const r = validateFile(file('README', 'text/plain', 100))
    expect(r.warnings.some((w) => /no extension/i.test(w))).toBe(true)
  })

  it('skips no-extension warning when requireExtension=false', () => {
    const r = validateFile(file('README', 'text/plain', 100), { requireExtension: false })
    expect(r.warnings.every((w) => !/no extension/i.test(w))).toBe(true)
  })

  it('explicit category overrides MIME-based detection', () => {
    const r = validateFile(file('doc.pdf', 'application/pdf', 100), { category: 'drawings' })
    // drawings allows PDF, so still valid; but category in fileInfo should be drawings.
    expect(r.fileInfo.category).toBe('drawings')
  })

  it('fileInfo includes name + size + type + extension', () => {
    const r = validateFile(file('photo.jpg', 'image/jpeg', 12_345))
    expect(r.fileInfo).toEqual({
      name: 'photo.jpg',
      size: 12_345,
      type: 'image/jpeg',
      extension: '.jpg',
      category: 'images',
    })
  })
})

describe('fileValidation — validateFiles (batch)', () => {
  it('summary describes "ready to upload" when all valid', () => {
    const r = validateFiles([
      file('a.pdf', 'application/pdf', 1000),
      file('b.pdf', 'application/pdf', 2000),
    ])
    expect(r.allValid).toBe(true)
    expect(r.totalSize).toBe(3000)
    expect(r.summary).toMatch(/ready to upload/)
  })

  it('summary counts invalid files when some fail', () => {
    const r = validateFiles([
      file('ok.pdf', 'application/pdf', 1000),
      file('bad.exe', 'application/octet-stream', 100),
    ])
    expect(r.allValid).toBe(false)
    expect(r.summary).toMatch(/1 of 2 file\(s\) have validation errors/)
  })

  it('totalSize sums all file sizes regardless of validity', () => {
    const r = validateFiles([
      file('a.pdf', 'application/pdf', 1000),
      file('bad.exe', 'application/octet-stream', 500),
    ])
    expect(r.totalSize).toBe(1500)
  })
})

describe('fileValidation — isImageFile / isPdfFile', () => {
  it('isImageFile detects via MIME type', () => {
    expect(isImageFile({ type: 'image/jpeg', name: 'noext' })).toBe(true)
    expect(isImageFile({ type: 'image/png', name: 'x.png' })).toBe(true)
  })

  it('isImageFile detects via extension when MIME is missing', () => {
    expect(isImageFile({ type: '', name: 'photo.jpg' })).toBe(true)
    expect(isImageFile({ type: '', name: 'photo.tiff' })).toBe(true)
  })

  it('isImageFile returns false for non-image files', () => {
    expect(isImageFile({ type: 'application/pdf', name: 'doc.pdf' })).toBe(false)
  })

  it('isPdfFile detects via MIME type', () => {
    expect(isPdfFile({ type: 'application/pdf', name: 'doc' })).toBe(true)
  })

  it('isPdfFile detects via .pdf extension (case-insensitive)', () => {
    expect(isPdfFile({ type: '', name: 'doc.PDF' })).toBe(true)
    expect(isPdfFile({ type: '', name: 'doc.pdf' })).toBe(true)
  })

  it('isPdfFile returns false for non-PDF files', () => {
    expect(isPdfFile({ type: 'image/jpeg', name: 'photo.jpg' })).toBe(false)
  })
})

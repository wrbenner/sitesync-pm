import { describe, it, expect } from 'vitest'
import { isPdf } from './pdfPageSplitter'

// Helper that produces a File-like object with the right type/name without
// allocating real bytes (the isPdf check looks at type + filename only).
function fileLike(name: string, type: string): File {
  return new File([''], name, { type })
}

describe('pdfPageSplitter — isPdf', () => {
  it('accepts files with application/pdf MIME type', () => {
    expect(isPdf(fileLike('doc.pdf', 'application/pdf'))).toBe(true)
  })

  it('accepts files with .pdf extension regardless of MIME', () => {
    expect(isPdf(fileLike('doc.pdf', ''))).toBe(true)
    expect(isPdf(fileLike('doc.pdf', 'application/octet-stream'))).toBe(true)
  })

  it('case-insensitive on the .pdf extension', () => {
    expect(isPdf(fileLike('doc.PDF', ''))).toBe(true)
    expect(isPdf(fileLike('doc.Pdf', ''))).toBe(true)
  })

  it('rejects non-PDF files (no PDF extension and wrong MIME)', () => {
    expect(isPdf(fileLike('photo.jpg', 'image/jpeg'))).toBe(false)
    expect(isPdf(fileLike('doc.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBe(false)
  })

  it('rejects files where .pdf appears mid-name (extension check is end-anchored)', () => {
    expect(isPdf(fileLike('something.pdf.txt', 'text/plain'))).toBe(false)
  })

  it('handles files with no extension', () => {
    expect(isPdf(fileLike('README', ''))).toBe(false)
  })
})

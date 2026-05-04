/**
 * Client-side PDF page splitting using pdf.js.
 *
 * Mirrors the production pdf-to-image Lambda that converts each page
 * of a construction drawing PDF to a 200 DPI PNG. Since we run in the
 * browser, we render to canvas and export as PNG blobs.
 *
 * This enables per-page classification (the Gemini File API receives
 * individual page images, not entire 80MB PDFs) and provides thumbnails
 * for the drawing card grid.
 */
import type { PDFDocumentProxy as _PDFDocumentProxy } from 'pdfjs-dist'
import { detectTitleBlockRegion, type TitleBlockRegion } from './titleBlockDetector'

/**
 * Lazy-load pdfjs-dist to avoid pulling the heavy CJS bundle into the
 * initial chunk graph.  The top-level `import * as pdfjs` was executed at
 * module-evaluation time, which caused "Failed to fetch dynamically
 * imported module" errors on pages that transitively import this file
 * (e.g. the Drawings page) because the bundler couldn't resolve the
 * `new URL('pdfjs-dist/cmaps/', import.meta.url)` reference at build time.
 */
let _pdfjs: typeof import('pdfjs-dist') | null = null
async function getPdfjs() {
  if (_pdfjs) return _pdfjs
  _pdfjs = await import('pdfjs-dist')
  _pdfjs.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.js', import.meta.url).href
  return _pdfjs
}

export interface PageTextItem {
  str: string
  /** X coordinate (PDF user space, 0 at left) */
  x: number
  /** Y coordinate (PDF user space, 0 at BOTTOM in pdfjs convention) */
  y: number
  /** Approximate font size */
  fontSize: number
}

export interface PageImage {
  /** 0-indexed page number */
  pageIndex: number
  /** 1-indexed page number */
  pageNumber: number
  /** Full-resolution PNG blob (200 DPI) */
  blob: Blob
  /** Thumbnail PNG blob (~300px wide) */
  thumbnailBlob: Blob
  /** Natural width of the full-res image */
  width: number
  /** Natural height of the full-res image */
  height: number
  /**
   * Concatenated text from the page (empty for scanned PDFs).
   * Useful for quick text searches and title-block parsing fallback.
   */
  text: string
  /**
   * Per-item positioned text. Use for finding the title block —
   * on ARCH/ANSI sheets it's usually at the bottom-right corner.
   */
  textItems: PageTextItem[]
  /** Page width in PDF points (for relative positioning of textItems) */
  pageWidth: number
  /** Page height in PDF points */
  pageHeight: number
  /**
   * Vector-detected title-block rectangle, if found. Coordinates are
   * in the same pdfjs bottom-up space as `textItems`. `null` when no
   * vector borders were detected — caller should fall back to
   * full-page parsing or a default region crop.
   */
  titleBlockRegion: TitleBlockRegion | null
}

export interface SplitProgress {
  current: number
  total: number
  status: string
}

/**
 * Target DPI for page rendering. 200 DPI matches the reference
 * production microservice. Construction drawings are typically
 * 24"x36" (ARCH D) which at 200 DPI = 4800x7200 px per page.
 *
 * For memory safety in the browser, we cap at 150 DPI for sheets
 * larger than 18"x24" and fall back to 100 DPI for very large sheets.
 */
const TARGET_DPI = 150
const THUMBNAIL_WIDTH = 400

/**
 * Split a PDF into individual page PNG images.
 * Returns an array of PageImage objects ready for upload.
 *
 * Memory-conscious: releases each canvas immediately after blob export,
 * and reduces DPI for very large sheets to avoid OOM in the browser.
 */
export async function splitPdfToPages(
  file: File,
  onProgress?: (progress: SplitProgress) => void,
): Promise<PageImage[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfjs = await getPdfjs()
  let pdf;
  try {
    pdf = await pdfjs.getDocument({
      data: arrayBuffer,
      cMapUrl: new URL('pdfjs-dist/cmaps/', import.meta.url).toString(),
      cMapPacked: true,
    }).promise
  } catch (err) {
    throw new Error(`Could not parse PDF: ${err instanceof Error ? err.message : 'corrupted or encrypted file'}`)
  }
  const totalPages = pdf.numPages
  const pages: PageImage[] = []

  for (let i = 1; i <= totalPages; i++) {
    onProgress?.({ current: i, total: totalPages, status: `Rendering page ${i} of ${totalPages}...` })

    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.0 })

    // Calculate scale to hit target DPI. PDF default is 72 DPI.
    // For very large pages (>24" in any dimension), reduce DPI to avoid OOM.
    const pageWidthInches = viewport.width / 72
    const pageHeightInches = viewport.height / 72
    const maxDimInches = Math.max(pageWidthInches, pageHeightInches)
    let dpi = TARGET_DPI
    if (maxDimInches > 36) dpi = 72  // huge sheets: stay at 72 DPI
    else if (maxDimInches > 24) dpi = 100  // large sheets: 100 DPI

    const scale = dpi / 72
    const scaledViewport = page.getViewport({ scale })

    const w = Math.floor(scaledViewport.width)
    const h = Math.floor(scaledViewport.height)

    // Safety check: bail if canvas would be enormous (>100MP)
    const megapixels = (w * h) / 1e6
    if (megapixels > 100) {
      console.warn(`[pdf] Page ${i} would be ${megapixels.toFixed(0)} MP at ${dpi} DPI — skipping to avoid OOM`)
      page.cleanup()
      continue
    }

    // Render full-res to canvas
    let blob: Blob
    let thumbnailBlob: Blob
    try {
      const canvas = new OffscreenCanvas(w, h)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get 2D context for page rendering')

      await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport: scaledViewport }).promise

      // Export full-res as PNG
      blob = await canvas.convertToBlob({ type: 'image/png' })

      // Generate thumbnail (scaled down to ~400px wide)
      const thumbScale = THUMBNAIL_WIDTH / w
      const thumbWidth = THUMBNAIL_WIDTH
      const thumbHeight = Math.floor(h * thumbScale)
      const thumbCanvas = new OffscreenCanvas(thumbWidth, thumbHeight)
      const thumbCtx = thumbCanvas.getContext('2d')
      if (!thumbCtx) throw new Error('Failed to get 2D context for thumbnail')
      thumbCtx.drawImage(canvas, 0, 0, thumbWidth, thumbHeight)
      thumbnailBlob = await thumbCanvas.convertToBlob({ type: 'image/png', quality: 0.85 })

      // Explicitly release canvas memory — OffscreenCanvas doesn't auto-GC in all browsers
      canvas.width = 0
      canvas.height = 0
      thumbCanvas.width = 0
      thumbCanvas.height = 0
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[pdf] Failed to render page ${i}:`, err)
      page.cleanup()
      // If it looks like an OOM, skip this page but continue others
      if (msg.includes('memory') || msg.includes('RangeError') || msg.includes('allocation')) {
        console.warn(`[pdf] Likely OOM on page ${i} — skipping`)
        continue
      }
      throw err
    }

    // Extract embedded text (cheap when the PDF isn't scanned). We get
    // positioned items here so the caller can locate the title block.
    let text = ''
    let textItems: PageTextItem[] = []
    try {
      const content = await page.getTextContent()
      type Item = { str: string; transform: number[]; height?: number }
      const items = content.items as Item[]
      textItems = items
        .filter((it) => typeof it.str === 'string' && it.str.trim().length > 0)
        .map((it) => ({
          str: it.str,
          x: it.transform[4],
          y: it.transform[5],
          fontSize: Math.abs(it.transform[3] || it.height || 0),
        }))
      text = textItems.map((it) => it.str).join('\n')
    } catch {
      // Text layer can fail on weird PDFs — we still keep the image.
    }

    // Stage 1: detect the title-block region by looking at vector
    // rectangle primitives drawn on the page. Cheap — just parses the
    // op-list we'd otherwise ignore. Returns null for scanned PDFs.
    let titleBlockRegion: TitleBlockRegion | null = null
    try {
      titleBlockRegion = await detectTitleBlockRegion(page, viewport, textItems)
    } catch (err) {
      console.warn(`[pdf] title-block detection failed on page ${i}:`, err)
    }

    pages.push({
      pageIndex: i - 1,
      pageNumber: i,
      blob,
      thumbnailBlob,
      width: w,
      height: h,
      text,
      textItems,
      pageWidth: viewport.width,
      pageHeight: viewport.height,
      titleBlockRegion,
    })

    // Release page resources
    page.cleanup()
  }

  pdf.destroy()
  return pages
}

/**
 * Check if a file is a PDF.
 */
export function isPdf(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  )
}

/**
 * Get page count from a PDF without rendering all pages.
 */
export async function getPdfPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfjs = await getPdfjs()
  const pdf = await pdfjs.getDocument({
    data: arrayBuffer,
    cMapUrl: new URL('pdfjs-dist/cmaps/', import.meta.url).toString(),
    cMapPacked: true,
  }).promise
  const count = pdf.numPages
  pdf.destroy()
  return count
}

/**
 * Extract text content from page 1 of a PDF without rendering.
 * Useful for cover sheets (project name, address, consultants).
 * Returns empty string if the page has no embedded text (e.g. scanned PDFs).
 */
export async function extractPdfFirstPageText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfjs = await getPdfjs()
  const pdf = await pdfjs.getDocument({
    data: arrayBuffer,
    cMapUrl: new URL('pdfjs-dist/cmaps/', import.meta.url).toString(),
    cMapPacked: true,
  }).promise
  try {
    if (pdf.numPages < 1) return ''
    const page = await pdf.getPage(1)
    const content = await page.getTextContent()
    const text = content.items
      .map((it) => ('str' in it ? (it as { str: string }).str : ''))
      .join('\n')
    page.cleanup()
    return text
  } finally {
    pdf.destroy()
  }
}

/**
 * Extract text from the first N pages of a PDF without rendering.
 * Used for covers + project-data sheets, which often span 2–3 pages
 * (page 1 = title/consultants, page 2 = code summary, page 3 = sheet index).
 * Pages are returned joined with a page separator so downstream parsers
 * can stay layout-agnostic.
 */
export async function extractPdfTextFromPages(file: File, maxPages = 5): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfjs = await getPdfjs()
  const pdf = await pdfjs.getDocument({
    data: arrayBuffer,
    cMapUrl: new URL('pdfjs-dist/cmaps/', import.meta.url).toString(),
    cMapPacked: true,
  }).promise
  try {
    const pageCount = Math.min(pdf.numPages, maxPages)
    const chunks: string[] = []
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const text = content.items
        .map((it) => ('str' in it ? (it as { str: string }).str : ''))
        .join('\n')
      chunks.push(`── PAGE ${i} ──\n${text}`)
      page.cleanup()
    }
    return chunks.join('\n\n')
  } finally {
    pdf.destroy()
  }
}

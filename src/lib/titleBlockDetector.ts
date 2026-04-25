/**
 * Title-block region detector — finds the rectangle on a PDF page that
 * contains the sheet number and drawing title.
 *
 * Strategy: CAD-exported construction PDFs draw the title block as an
 * explicit rectangle primitive in the PDF content stream. We parse
 * `page.getOperatorList()` for rectangle operations, filter to
 * candidates that LOOK like a title block (size, aspect ratio, position
 * near an edge), and pick the one that contains the most large-font
 * text.
 *
 * Operator-list parsing pattern borrowed from src/lib/schedulePdfImport.ts
 * (which uses the same approach to find colored bars in schedule PDFs).
 *
 * Coordinate system: pdfjs uses a bottom-up y-axis (y=0 at the bottom of
 * the page). We keep that convention throughout — text items from
 * pdfPageSplitter.ts are stored with pdfjs coords, and the parser
 * operates on them. Returning regions in the same space avoids a flip.
 */

import type { PDFPageProxy, PageViewport } from 'pdfjs-dist';
import type { PageTextItem } from './pdfPageSplitter';

export interface TitleBlockRegion {
  /** Lower-left X in pdfjs coords (0 at page left) */
  x: number;
  /** Lower-left Y in pdfjs coords (0 at page BOTTOM) */
  y: number;
  /** Width in pdfjs user-space units */
  w: number;
  /** Height in pdfjs user-space units */
  h: number;
}

// pdfjs operator codes. Not exported from the library type defs, so we
// hard-code them; they've been stable since pdfjs 2.x.
const OP_SET_FILL_RGB = 31;
const OP_CONSTRUCT_PATH = 91;
const SUB_OP_RECT = 19;
const SUB_OP_MOVE_TO = 13;
const SUB_OP_LINE_TO = 14;

interface RawRect {
  x: number;     // lower-left (pdfjs coords)
  y: number;
  w: number;
  h: number;
}

// Sheet-number regex — loose enough for anything that looks like an AIA
// sheet number. The parser has a stricter version; this is just for
// "is there a plausible sheet number inside this rectangle?"
const PLAUSIBLE_SHEET_RE = /\b[A-Z]{1,2}\s*[-.]?\s*\d{1,3}(?:\s*[.\-]\s*\d{1,3})?\b/;

/**
 * Extract raw rectangles from the page content stream. Handles the
 * constructPath sub-op list exactly like schedulePdfImport.ts does.
 */
async function extractRectanglesFromOperatorList(page: PDFPageProxy): Promise<RawRect[]> {
  const ops = await page.getOperatorList();
  const rects: RawRect[] = [];

  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] !== OP_CONSTRUCT_PATH) continue;

    const args = ops.argsArray[i];
    if (!args || !Array.isArray(args) || args.length < 2) continue;

    const opCodes = args[0] as number[];
    const opArgs = args[1] as number[];
    if (!opCodes || !opArgs) continue;

    let argIdx = 0;
    for (const op of opCodes) {
      if (op === SUB_OP_RECT && argIdx + 3 < opArgs.length) {
        const rx = opArgs[argIdx];
        const ry = opArgs[argIdx + 1];
        const rw = opArgs[argIdx + 2];
        const rh = opArgs[argIdx + 3];
        // pdfjs rectangles may be stored with negative width/height for
        // direction; normalize so lower-left + positive extents.
        rects.push({
          x: Math.min(rx, rx + rw),
          y: Math.min(ry, ry + rh),
          w: Math.abs(rw),
          h: Math.abs(rh),
        });
        argIdx += 4;
      } else if (op === SUB_OP_MOVE_TO || op === SUB_OP_LINE_TO) {
        argIdx += 2;
      } else {
        // Unknown sub-op — skip conservatively with the same stride the
        // schedule importer uses.
        argIdx += 2;
      }
    }
  }

  return rects;
}

/**
 * Score a rectangle as a title-block candidate. Returns 0 if it fails
 * the basic shape filters; otherwise a positive score where higher is
 * more likely to be the real title block.
 */
function scoreCandidate(
  rect: RawRect,
  pageWidth: number,
  pageHeight: number,
  textItems: PageTextItem[],
  medianFont: number,
): number {
  const area = rect.w * rect.h;
  const pageArea = pageWidth * pageHeight;
  const areaPct = area / pageArea;

  // Size: between 5% and 45% of the page. Tiny rectangles are note
  // bubbles; huge ones are the sheet border itself.
  if (areaPct < 0.05 || areaPct > 0.45) return 0;

  // Aspect ratio: 1:1 to 5:1 in either orientation
  const aspect = Math.max(rect.w / rect.h, rect.h / rect.w);
  if (aspect > 5) return 0;

  // Must touch or lie within 8% of at least one page edge
  const edgeTolerance = Math.min(pageWidth, pageHeight) * 0.08;
  const nearLeft = rect.x <= edgeTolerance;
  const nearRight = rect.x + rect.w >= pageWidth - edgeTolerance;
  const nearBottom = rect.y <= edgeTolerance;
  const nearTop = rect.y + rect.h >= pageHeight - edgeTolerance;
  if (!(nearLeft || nearRight || nearBottom || nearTop)) return 0;

  // Content check: how much large-font text is inside? This is the
  // decisive signal — a title block is wherever the big text lives.
  let bigTextInside = 0;
  let hasPlausibleSheet = false;
  for (const it of textItems) {
    if (it.x < rect.x || it.x > rect.x + rect.w) continue;
    if (it.y < rect.y || it.y > rect.y + rect.h) continue;
    if (it.fontSize >= medianFont * 1.5) bigTextInside++;
    if (PLAUSIBLE_SHEET_RE.test(it.str)) hasPlausibleSheet = true;
  }

  // Must contain at least one sheet-number-ish pattern to be the title
  // block — otherwise it's probably some other framed callout.
  if (!hasPlausibleSheet) return 0;

  // Base score from content density
  let score = bigTextInside;

  // Corner bonuses — real title blocks cluster in canonical positions
  if (nearBottom && nearRight) score += 4;          // ARCH-D standard
  else if (nearRight && !nearTop && !nearBottom) score += 2; // right-vertical strip
  else if (nearBottom && !nearLeft && !nearRight) score += 2; // bottom-horizontal
  else if (nearTop && nearRight) score += 1;        // top-right (rare)
  else if (nearBottom && nearLeft) score -= 1;      // bottom-left (uncommon)

  // Small bonus for canonical size range (typical title blocks are
  // 10-25% of page area)
  if (areaPct >= 0.10 && areaPct <= 0.25) score += 1;

  return score;
}

/**
 * Main entry point. Returns `null` when no plausible title block can be
 * found — for scanned PDFs or unusual layouts, the caller falls back to
 * full-page parsing.
 *
 * @param page     pdfjs page proxy
 * @param viewport page viewport (used for dimensions)
 * @param textItems text items already extracted from the page — required
 *                  so we can score rectangles by their text content
 */
export async function detectTitleBlockRegion(
  page: PDFPageProxy,
  viewport: PageViewport,
  textItems: PageTextItem[],
): Promise<TitleBlockRegion | null> {
  if (textItems.length === 0) return null;

  let rects: RawRect[];
  try {
    rects = await extractRectanglesFromOperatorList(page);
  } catch (err) {
    console.warn('[title-block-detector] getOperatorList failed', err);
    return null;
  }

  if (rects.length === 0) return null;

  // Median font size of body text — our reference for "big" text.
  const fonts = [...textItems.map((it) => it.fontSize)].sort((a, b) => a - b);
  const medianFont = fonts[Math.floor(fonts.length / 2)] || 10;

  let best: { rect: RawRect; score: number } | null = null;
  for (const r of rects) {
    const s = scoreCandidate(r, viewport.width, viewport.height, textItems, medianFont);
    if (s <= 0) continue;
    if (!best || s > best.score) best = { rect: r, score: s };
  }

  if (!best) return null;

  return {
    x: best.rect.x,
    y: best.rect.y,
    w: best.rect.w,
    h: best.rect.h,
  };
}

/**
 * When no vector-border detection succeeds, this returns a reasonable
 * default region (bottom-right 35%×30%) that catches the ARCH-D
 * standard layout. Used as a fallback for Stage 2 AI cropping when
 * Stage 1 didn't find a region.
 */
export function defaultTitleBlockRegion(
  pageWidth: number,
  pageHeight: number,
): TitleBlockRegion {
  const w = pageWidth * 0.35;
  const h = pageHeight * 0.30;
  return {
    x: pageWidth - w,
    y: 0,
    w,
    h,
  };
}

/**
 * Right-edge vertical strip — right 20% of the page, full height.
 *
 * Covers both common layouts in one crop:
 *   - Traditional bottom-right title block (ARCH-D landscape)
 *   - Right-edge vertical strip (common on multifamily residential
 *     drawings like those from Cross Architects — the title block is
 *     a full-height strip with the sheet number at the bottom and
 *     rotated project name in the middle)
 *
 * 20% is the sweet spot: wide enough to include logo + firm details +
 * revisions block + sheet number + date; narrow enough that the main
 * drawing body and detail callouts (e.g. "06/ID4.0", "08/ID4.0") are
 * excluded entirely. Vision AI on this crop sees ONLY title-block text.
 */
export function rightEdgeStripRegion(
  pageWidth: number,
  pageHeight: number,
): TitleBlockRegion {
  const w = pageWidth * 0.20;
  return {
    x: pageWidth - w,
    y: 0,
    w,
    h: pageHeight,
  };
}

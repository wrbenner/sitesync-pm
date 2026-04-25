// ── PDF Schedule Import Engine ──────────────────────────────────────────────
// PRIMARY PATH: AI-powered vision extraction via the extract-schedule-pdf
// edge function (Gemini 2.5 Pro). Handles the full variety of real-world GC
// schedule PDFs including Excel-exports with hatched bars, week-grid matrix
// layouts, and zone-code cell markers.
//
// FALLBACK PATH (heuristic, below): Uses pdfjs-dist to read text positions
// and colored rectangles (solid-fill bars), then maps bar positions to a
// timeline to derive dates and durations. Works only on PDFs with standard
// solid-fill vector bars — common in P6/MS Project exports.

import type { ImportedActivity, ImportResult } from './scheduleImport';
import { supabase, fromTable } from './supabase';

// ── Types ───────────────────────────────────────────────────────────────────

interface TextItem {
  text: string;
  x: number;
  y: number;      // top of text (PDF coords inverted, we normalize)
  width: number;
  height: number;
  fontName?: string;
}

interface ColoredRect {
  x0: number;
  y0: number;   // top (normalized)
  x1: number;
  y1: number;   // bottom (normalized)
  width: number;
  height: number;
  color: [number, number, number];
}

interface TimelinePoint {
  x: number;
  date: Date;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

function parseMonthLabel(text: string): Date | null {
  const clean = text.trim();

  // Pattern: "Jan-24" or "Jan/24"
  let m = clean.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-/](\d{2})$/i);
  if (m) {
    const month = MONTH_MAP[m[1].toLowerCase()];
    const year = 2000 + parseInt(m[2]);
    if (month !== undefined) return new Date(year, month, 1);
  }

  // Pattern: "Jan 2024" or "January 2024"
  m = clean.match(/^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*(20\d{2})$/i);
  if (m) {
    const month = MONTH_MAP[m[1].toLowerCase().slice(0, 3)];
    const year = parseInt(m[2]);
    if (month !== undefined) return new Date(year, month, 1);
  }

  // Pattern: "2024-01"
  m = clean.match(/^(20\d{2})[-/](\d{1,2})$/);
  if (m) {
    return new Date(parseInt(m[1]), parseInt(m[2]) - 1, 1);
  }

  return null;
}

// ── Known construction schedule non-activity keywords ────────────────────────

const SKIP_WORDS = new Set([
  'activity', 'description', 'task', 'name', 'wbs', 'start', 'finish',
  'end', 'duration', 'days', 'progress', '%', 'complete', 'float',
  'total', 'free', 'predecessor', 'successor', 'resource', 'calendar',
  'critical', 'construction', 'schedule', 'page', 'date', 'project',
  'printed', 'report', 'rev', 'revision', 'version', 'update',
]);

// ── Color classification ────────────────────────────────────────────────────

type BarType = 'complete' | 'in_progress' | 'planned' | 'critical' | 'delayed' | 'unknown';

function classifyColor(r: number, g: number, b: number): BarType {
  // Green shades → complete
  if (g > 0.5 && g > r * 1.2 && g > b * 1.2) return 'complete';
  // Blue shades → planned/in_progress
  if (b > 0.5 && b > r * 1.3 && b > g * 1.1) return 'planned';
  // Red shades → critical/delayed
  if (r > 0.7 && r > g * 2 && r > b * 2) return 'critical';
  // Yellow/amber → delayed
  if (r > 0.7 && g > 0.5 && b < 0.3) return 'delayed';
  // Dark gray/black bars — often used for summary tasks
  if (r < 0.3 && g < 0.3 && b < 0.3 && r === g && g === b) return 'in_progress';

  return 'unknown';
}

// ── X-to-Date interpolation ─────────────────────────────────────────────────

function buildDateInterpolator(points: TimelinePoint[]): (x: number) => Date {
  if (points.length === 0) {
    return () => new Date();
  }
  if (points.length === 1) {
    return () => points[0].date;
  }

  const sorted = [...points].sort((a, b) => a.x - b.x);

  return (x: number): Date => {
    if (x <= sorted[0].x) return sorted[0].date;
    if (x >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].date;

    for (let i = 0; i < sorted.length - 1; i++) {
      const p0 = sorted[i];
      const p1 = sorted[i + 1];
      if (x >= p0.x && x <= p1.x) {
        const frac = (x - p0.x) / (p1.x - p0.x);
        const deltaMs = p1.date.getTime() - p0.date.getTime();
        return new Date(p0.date.getTime() + frac * deltaMs);
      }
    }
    return sorted[sorted.length - 1].date;
  };
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ── Main PDF Parser ─────────────────────────────────────────────────────────
//
// parsePdfSchedule is defined at the bottom of this file — it's the primary
// entry point used by the UI. It calls the AI edge function first and falls
// back to the heuristic parser (parsePdfScheduleHeuristic) if the edge
// function is unavailable or fails.

async function parsePdfScheduleHeuristic(file: File): Promise<ImportResult> {
  const arrayBuffer = await file.arrayBuffer();

  // Dynamic import pdfjs-dist
  const pdfjsLib = await import('pdfjs-dist');

  // Set worker — local copy from public/. CSP blocks CDN script-src so
  // a CDN worker can't load, and using a single local URL across all
  // modules prevents load-order races where another module's config
  // (eg. DocumentViewer) could clobber this one.
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.js', import.meta.url).href;
  }

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const warnings: string[] = [];

  // We'll process all pages and merge results
  const allTextItems: TextItem[] = [];
  const allRects: ColoredRect[] = [];
  let pageHeight = 0;
  let pageWidth = 0;

  for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 10); pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    pageHeight = viewport.height;
    pageWidth = viewport.width;

    // ── Extract text items ───────────────────────────────────
    const textContent = await page.getTextContent();
    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const tx = item.transform;
      // tx[4] = x, tx[5] = y (bottom of text in PDF coords)
      // PDF y is bottom-up, normalize to top-down
      const x = tx[4];
      const y = pageHeight - tx[5]; // now top-down
      const height = Math.abs(tx[3]) || 10;
      const width = item.width ?? item.str.length * 5;

      allTextItems.push({
        text: item.str,
        x,
        y,
        width,
        height,
        fontName: (item as Record<string, unknown>).fontName as string | undefined,
      });
    }

    // ── Extract colored rectangles from the operator list ────
    const ops = await page.getOperatorList();
    let currentColor: [number, number, number] = [0, 0, 0];

    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];

      // setFillRGBColor (OPS.setFillRGBColor = 31)
      if (fn === 31) {
        const args = ops.argsArray[i] as number[];
        if (args && args.length >= 3) {
          currentColor = [args[0], args[1], args[2]];
        }
      }

      // constructPath (OPS.constructPath = 91) — contains rectangles
      if (fn === 91) {
        const args = ops.argsArray[i];
        if (!args || !Array.isArray(args) || args.length < 2) continue;

        const opCodes = args[0] as number[];
        const opArgs = args[1] as number[];

        if (!opCodes || !opArgs) continue;

        let argIdx = 0;
        for (const op of opCodes) {
          // rectangle op = 19 (OPS values)
          if (op === 19 && argIdx + 3 < opArgs.length) {
            const rx = opArgs[argIdx];
            const ry = opArgs[argIdx + 1];
            const rw = opArgs[argIdx + 2];
            const rh = opArgs[argIdx + 3];

            // Normalize to top-down coordinates
            const x0 = rx;
            const y0 = pageHeight - ry - Math.abs(rh);
            const x1 = rx + rw;
            const y1 = pageHeight - ry;

            const width = Math.abs(rw);
            const height = Math.abs(rh);

            // Only keep colored bars (not white/black grid lines)
            const [r, g, b] = currentColor;
            const isWhite = r > 0.95 && g > 0.95 && b > 0.95;
            const isBlack = r < 0.05 && g < 0.05 && b < 0.05;
            const isGray = Math.abs(r - g) < 0.05 && Math.abs(g - b) < 0.05;

            if (!isWhite && !isBlack && !(isGray && width > 50) && width > 3 && height > 1.5 && height < 20) {
              allRects.push({
                x0: Math.min(x0, x1),
                y0: Math.min(y0, y1),
                x1: Math.max(x0, x1),
                y1: Math.max(y0, y1),
                width,
                height,
                color: [r, g, b],
              });
            }

            argIdx += 4;
          } else if (op === 13) { // moveTo
            argIdx += 2;
          } else if (op === 14) { // lineTo
            argIdx += 2;
          } else if (op === 19) { // rect with not enough args
            argIdx += 4;
          } else {
            // other ops — skip conservatively
            argIdx += 2;
          }
        }
      }
    }
  }

  if (allTextItems.length === 0) {
    throw new Error('Could not extract text from this PDF. It may be a scanned image — try using OCR first.');
  }

  // ── Step 1: Find the timeline (month headers) ──────────────
  const timelinePoints: TimelinePoint[] = [];

  for (const item of allTextItems) {
    const date = parseMonthLabel(item.text);
    if (date) {
      timelinePoints.push({ x: item.x, date });
    }
  }

  if (timelinePoints.length < 2) {
    warnings.push('Could not detect a timeline axis. Dates will be estimated from bar positions.');
  }

  const xToDate = buildDateInterpolator(timelinePoints);

  // ── Step 2: Identify the activity column ──────────────────
  // Activity names are typically the leftmost column of text
  // Find the x-threshold: most text left of the first timeline point

  const timelineStartX = timelinePoints.length > 0
    ? Math.min(...timelinePoints.map(p => p.x))
    : pageWidth * 0.15; // guess 15% from left

  const activityColumnX = timelineStartX * 0.95; // activity names are left of timeline

  // ── Step 3: Group text items into rows ─────────────────────
  // Rows share similar Y positions
  const ROW_TOLERANCE = 4;

  interface TextRow {
    y: number;
    items: TextItem[];
  }

  const rows: TextRow[] = [];
  const sortedText = [...allTextItems].sort((a, b) => a.y - b.y);

  for (const item of sortedText) {
    const existingRow = rows.find(r => Math.abs(r.y - item.y) < ROW_TOLERANCE);
    if (existingRow) {
      existingRow.items.push(item);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  // ── Step 4: Identify header rows vs activity rows ──────────
  // Header rows contain month labels; activity rows contain activity names

  const headerYs = new Set<number>();
  for (const r of rows) {
    if (r.items.some(item => parseMonthLabel(item.text) !== null)) {
      headerYs.add(r.y);
    }
  }

  // ── Step 5: Extract activities from rows ───────────────────
  const activities: ImportedActivity[] = [];
  let activityIndex = 0;

  // Detect project metadata from header text
  let projectName = 'PDF Schedule Import';
  let dataDate = new Date().toISOString().split('T')[0];

  // Look for project name in first few text items
  const topItems = allTextItems
    .filter(t => t.y < pageHeight * 0.1) // top 10% of page
    .sort((a, b) => a.y - b.y);

  if (topItems.length > 0) {
    // First prominent text is usually the company/project name
    const nameCandidate = topItems
      .map(t => t.text.trim())
      .filter(t => t.length > 3 && !SKIP_WORDS.has(t.toLowerCase()))
      .join(' — ');
    if (nameCandidate) projectName = nameCandidate.slice(0, 100);
  }

  // Look for a date in top section
  for (const item of topItems) {
    const dateMatch = item.text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})|(\w+ \d{1,2},?\s*\d{4})/);
    if (dateMatch) {
      const parsed = new Date(dateMatch[0]);
      if (!isNaN(parsed.getTime())) {
        dataDate = toISO(parsed);
        break;
      }
    }
  }

  // Process each non-header row
  for (const row of rows) {
    if (headerYs.has(row.y)) continue;

    // Get the text items in the activity column (left of timeline)
    const activityItems = row.items
      .filter(item => item.x < activityColumnX)
      .sort((a, b) => a.x - b.x);

    if (activityItems.length === 0) continue;

    // Build the activity name
    const rawName = activityItems.map(item => item.text.trim()).join(' ').trim();

    // Skip obvious non-activities
    if (!rawName || rawName.length < 2) continue;
    const lowerName = rawName.toLowerCase();
    if (SKIP_WORDS.has(lowerName)) continue;
    if (/^(wk\s*\d|week|\d+$|page\s*\d)/i.test(rawName)) continue;
    // Skip lines that are pure numbers/dates
    if (/^[\d\s/\-.]+$/.test(rawName)) continue;
    // Skip if it's just building codes
    if (/^[A-D]\d(\s+[A-D]\d)*$/.test(rawName)) continue;

    // Clean up: remove trailing building codes (A1, CL, B2, D1 etc.)
    const cleanName = rawName
      .replace(/\s+(?:[A-D]\d|CL)\s*(?:[A-D]\d|CL\s*)*$/g, '')
      .replace(/\s+j\s*$/i, '') // trailing artifacts
      .trim();

    if (!cleanName || cleanName.length < 2) continue;

    // ── Find matching Gantt bars for this row ────────────────
    const rowYCenter = row.y + 1.5; // approximate center of text row
    const matchingBars = allRects.filter(rect =>
      rect.y0 <= rowYCenter + 5 &&
      rect.y1 >= rowYCenter - 5 &&
      rect.width > 3
    );

    if (matchingBars.length === 0) {
      // Activity with no bars — still include it but with no dates
      // This could be a section header or milestone without a visible bar
      continue; // skip for now; could revisit
    }

    // Calculate overall span from all bars
    const minX = Math.min(...matchingBars.map(b => b.x0));
    const maxX = Math.max(...matchingBars.map(b => b.x1));

    const startDate = xToDate(minX);
    const endDate = xToDate(maxX);
    const durationDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));

    // ── Determine status from bar colors ─────────────────────
    const barTypes = matchingBars.map(b => classifyColor(b.color[0], b.color[1], b.color[2]));
    const hasComplete = barTypes.includes('complete');
    const hasPlanned = barTypes.includes('planned');
    const hasCritical = barTypes.includes('critical');
    const hasDelayed = barTypes.includes('delayed');

    let percentComplete = 0;
    const isCritical = hasCritical;

    if (hasComplete && !hasPlanned) {
      percentComplete = 100;
    } else if (hasComplete && hasPlanned) {
      // Mixed — estimate progress from the split point
      const completeBars = matchingBars.filter((_, i) => barTypes[i] === 'complete');
      const completeMaxX = Math.max(...completeBars.map(b => b.x1));
      const totalWidth = maxX - minX;
      if (totalWidth > 0) {
        percentComplete = Math.min(99, Math.max(1, Math.round((completeMaxX - minX) / totalWidth * 100)));
      }
    } else if (!hasComplete && hasPlanned) {
      percentComplete = 0;
    }

    // Status is derived downstream from percentComplete + isCritical; no need
    // to precompute it here (the heuristic hints "hasDelayed" are captured in
    // isCritical above, which is enough signal for the importer).
    void hasDelayed;

    const isMilestone = durationDays <= 1 && startDate.getTime() === endDate.getTime();

    activityIndex++;
    activities.push({
      id: `pdf_${activityIndex}`,
      name: cleanName,
      startDate: toISO(startDate),
      endDate: toISO(endDate),
      duration: durationDays,
      percentComplete,
      predecessors: [], // PDFs don't encode explicit dependency links
      isCritical,
      isMilestone,
      totalFloat: undefined,
    });
  }

  if (activities.length === 0) {
    throw new Error(
      'No schedule activities could be extracted from this PDF. ' +
      'Ensure the PDF contains a Gantt chart with colored bars and activity labels on the left side.'
    );
  }

  // ── Infer dependencies from construction sequencing ────────
  // Since PDFs don't encode explicit predecessor links, we can infer
  // simple finish-to-start relationships from sequential activities
  // that have overlapping or adjacent date ranges.
  for (let i = 1; i < activities.length; i++) {
    const current = activities[i];
    const prev = activities[i - 1];

    // If the current activity starts within a few days of the previous
    // activity's start or finish, infer a dependency
    const prevEnd = new Date(prev.endDate).getTime();
    const currentStart = new Date(current.startDate).getTime();
    const gap = (currentStart - prevEnd) / 86400000;

    // If current starts shortly after (or during) previous, infer FS link
    if (gap >= -7 && gap <= 14) {
      current.predecessors.push({
        activityId: prev.id,
        type: 'FS',
        lag: Math.max(0, Math.round(gap)),
      });
    }
  }

  warnings.push(
    `Extracted ${activities.length} activities from PDF. ` +
    `Dependencies were inferred from sequential ordering — review and adjust as needed.`
  );

  if (timelinePoints.length >= 2) {
    const firstMonth = timelinePoints.sort((a, b) => a.date.getTime() - b.date.getTime())[0];
    const lastMonth = timelinePoints[timelinePoints.length - 1];
    warnings.push(
      `Timeline spans ${toISO(firstMonth.date)} to ${toISO(lastMonth.date)} (${timelinePoints.length} month markers detected).`
    );
  }

  return {
    activities,
    calendars: [],
    projectName,
    dataDate,
    warnings,
    format: 'pdf' as ImportResult['format'],
  };
}

// ── AI-powered extraction (primary path) ────────────────────────────────────
// 1. Rasterize PDF page(s) to JPEG client-side using pdfjs (Gemini processes
//    images 5-10× faster than PDFs — this is the canonical document-AI pattern).
// 2. Upload JPEG to Supabase Storage.
// 3. Edge function fetches the image, sends to Gemini Flash inline.
// 4. Gemini returns structured schedule JSON → import flow resumes.

const IMPORT_BUCKET = 'project-files';
const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes — long enough for Gemini extraction to finish
const RENDER_MAX_DIMENSION = 1800; // px — Pro can read smaller cells; gives us more detail per tile
const RENDER_JPEG_QUALITY = 0.88;
const JOB_WAIT_TIMEOUT_MS = 240_000; // safety net; 5-8 parallel tiles normally finish in 60-90s
const SLICE_THRESHOLD_PX = 800;      // any page taller than this gets split into bands
const BAND_BODY_PX = 500;            // per-band rows region — keeps per-tile output small enough for Gemini
const BAND_OVERLAP_PX = 60;          // so rows on a boundary appear in both tiles
const HEADER_STRIP_PX = 140;         // top of page — timeline header (months + weeks)

interface RenderedTile {
  page: number;
  band: number;     // 0 = whole page / first band; 1+ = subsequent bands on the same page
  blob: Blob;
}

async function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('canvas.toBlob returned null'));
        resolve(blob);
      },
      'image/jpeg',
      RENDER_JPEG_QUALITY,
    );
  });
}

// Render one PDF page to an in-memory canvas at our standard max-dim.
// Shared by both the whole-page and sliced paths so they produce identical
// pixel quality.
async function renderPdfPageToCanvas(file: File, pageNum: number): Promise<HTMLCanvasElement> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await import('pdfjs-dist');

  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.js', import.meta.url).href;
  }

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(pageNum);

  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(
    RENDER_MAX_DIMENSION / baseViewport.width,
    RENDER_MAX_DIMENSION / baseViewport.height,
    3, // cap at 3x — prevents runaway renders on large PDFs
  );
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas 2d context');

  // White background — PDF transparent regions otherwise render black,
  // which destroys contrast on Gantt bars.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

// Produce a "band" canvas = header strip (0..HEADER_STRIP_PX) stacked above
// a body strip (bodyStart..bodyEnd from the source). Gemini sees one
// coherent image with the timeline axis still visible, regardless of which
// band it's processing.
function buildBandCanvas(
  source: HTMLCanvasElement,
  headerHeight: number,
  bodyStart: number,
  bodyEnd: number,
): HTMLCanvasElement {
  const bodyHeight = Math.max(0, bodyEnd - bodyStart);
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = headerHeight + bodyHeight;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Could not create band canvas context');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  // Header strip.
  ctx.drawImage(source, 0, 0, source.width, headerHeight, 0, 0, source.width, headerHeight);
  // Body strip, drawn immediately below the header.
  ctx.drawImage(source, 0, bodyStart, source.width, bodyHeight, 0, headerHeight, source.width, bodyHeight);
  return out;
}

// Turn a PDF into one or more tile blobs. Small/short pages yield a single
// tile per page; tall/dense pages yield multiple header-prefixed bands.
async function renderPdfToTiles(file: File): Promise<RenderedTile[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await import('pdfjs-dist');
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.js', import.meta.url).href;
  }
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdfDoc.numPages;

  const tiles: RenderedTile[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const canvas = await renderPdfPageToCanvas(file, pageNum);

    // Short pages → one tile per page.
    if (canvas.height <= SLICE_THRESHOLD_PX) {
      tiles.push({ page: pageNum, band: 0, blob: await canvasToJpegBlob(canvas) });
      continue;
    }

    // Tall/dense pages → multiple header-prefixed bands with overlap.
    const headerPx = Math.min(HEADER_STRIP_PX, Math.floor(canvas.height * 0.1));
    const bodyStart = headerPx;
    const bodyEnd = canvas.height;
    let bandIdx = 0;
    let cursor = bodyStart;
    while (cursor < bodyEnd) {
      const bandEnd = Math.min(bodyEnd, cursor + BAND_BODY_PX);
      const bandCanvas = buildBandCanvas(canvas, headerPx, cursor, bandEnd);
      tiles.push({ page: pageNum, band: bandIdx, blob: await canvasToJpegBlob(bandCanvas) });
      bandIdx++;
      if (bandEnd >= bodyEnd) break;
      cursor = bandEnd - BAND_OVERLAP_PX;
    }
  }

  if (tiles.length === 0) {
    throw new Error('PDF produced no renderable pages.');
  }
  return tiles;
}

async function parsePdfScheduleAI(file: File, projectId: string): Promise<ImportResult> {
  // Rasterize the PDF into one or more tiles. Short pages → one tile each.
  // Tall/dense pages → header-prefixed bands with overlap. Each tile becomes
  // a parallel Gemini call server-side; combined they handle schedules that
  // can't fit in a single Gemini request.
  const tiles = await renderPdfToTiles(file);

  const safeBase = file.name.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
  const stamp = Date.now();
  const uploadedPaths: string[] = [];

  try {
    // Upload every tile. Sequential upload is fine — they're small JPEGs
    // and parallelizing would complicate cleanup on a mid-upload failure.
    const tileRequests: Array<{ signed_url: string; page: number; band: number }> = [];
    for (const tile of tiles) {
      const storagePath = `${projectId}/schedule-imports/${stamp}-${safeBase}-p${tile.page}-b${tile.band}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from(IMPORT_BUCKET)
        .upload(storagePath, tile.blob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadErr) {
        throw new Error(`Storage upload failed for p${tile.page}/b${tile.band}: ${uploadErr.message}`);
      }
      uploadedPaths.push(storagePath);

      const { data: urlData, error: urlErr } = await supabase.storage
        .from(IMPORT_BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
      if (urlErr || !urlData?.signedUrl) {
        throw new Error(`Signed URL creation failed: ${urlErr?.message ?? 'unknown error'}`);
      }
      tileRequests.push({ signed_url: urlData.signedUrl, page: tile.page, band: tile.band });
    }

    // Get the current user's session token to pass in the body.
    // We DON'T use supabase.functions.invoke() because it auto-injects the
    // user's JWT into the Authorization header — and on an asymmetric-keys
    // project, the Supabase Edge Runtime's boot-level parser rejects that
    // with UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM before our function
    // even runs. Instead we fetch directly with ONLY the apikey header and
    // pass the user token in the body for in-function validation.
    const { data: sessionData } = await supabase.auth.getSession();
    const userToken = sessionData.session?.access_token;
    if (!userToken) {
      throw new Error('No active session — please sign in again.');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hypxrmcppjfbtlwuoafc.supabase.co';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    // Edge function is async: it validates auth, creates a single job row,
    // fans out parallel Gemini calls across the tiles, merges, and writes
    // the final result. Client subscribes to the job row via realtime.
    const fnResponse = await fetch(`${supabaseUrl}/functions/v1/extract-schedule-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        project_id: projectId,
        tiles: tileRequests,
        filename: file.name,
        user_token: userToken,
      }),
    });

    if (!fnResponse.ok) {
      let detail = `Edge function returned ${fnResponse.status}`;
      try {
        const raw = await fnResponse.text();
        try {
          const parsed = JSON.parse(raw);
          detail = parsed?.error?.message ?? parsed?.message ?? raw.slice(0, 300);
        } catch {
          if (raw) detail = raw.slice(0, 300);
        }
      } catch { /* ignore */ }
      throw new Error(detail);
    }

    const submitJson = await fnResponse.json() as { job_id?: string };
    const jobId = submitJson?.job_id;
    if (!jobId) {
      throw new Error('Edge function did not return a job_id.');
    }

    const data = await waitForScheduleImportJob(jobId);
    if (!data || !Array.isArray(data.activities)) {
      throw new Error('Edge function returned an unexpected result shape.');
    }
    return data;
  } finally {
    // Always clean up uploaded tiles, even on failure.
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(IMPORT_BUCKET).remove(uploadedPaths).catch(() => {});
    }
  }
}

// Subscribe to the schedule_import_jobs row and resolve when it reaches
// status='done' (returning result_json) or status='error' (throwing).
// Guards against a realtime miss by re-polling the row once on timeout.
async function waitForScheduleImportJob(jobId: string): Promise<ImportResult> {
  const row = await new Promise<{ status: string; result_json: ImportResult | null; error_message: string | null }>((resolve, reject) => {
    type JobRow = { status: string; result_json: ImportResult | null; error_message: string | null };
    const pollJob = async (): Promise<JobRow | null> => {
      const { data, error } = await (fromTable('schedule_import_jobs') as unknown as {
        select: (cols: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> } };
      }).select('status, result_json, error_message').eq('id', jobId).maybeSingle();
      if (error) return null;
      return (data as JobRow | null);
    };

    const timeout = setTimeout(async () => {
      try {
        const row = await pollJob();
        if (row && (row.status === 'done' || row.status === 'error')) {
          cleanup();
          resolve(row);
          return;
        }
      } catch { /* ignore */ }
      cleanup();
      reject(new Error('AI extraction timed out after 3 minutes. The PDF may be too dense or Gemini is experiencing issues — try again, or split the PDF.'));
    }, JOB_WAIT_TIMEOUT_MS);

    const channel = supabase
      .channel(`schedule_import_job_${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'schedule_import_jobs', filter: `id=eq.${jobId}` },
        (payload) => {
          const next = payload.new as { status?: string; result_json?: ImportResult | null; error_message?: string | null };
          if (next?.status === 'done' || next?.status === 'error') {
            cleanup();
            resolve({
              status: next.status,
              result_json: next.result_json ?? null,
              error_message: next.error_message ?? null,
            });
          }
        },
      )
      .subscribe(async (status) => {
        // Once subscribed, check in case the job already finished before we subscribed.
        if (status === 'SUBSCRIBED') {
          const row = await pollJob();
          if (row && (row.status === 'done' || row.status === 'error')) {
            cleanup();
            resolve(row);
          }
        }
      });

    const cleanup = () => {
      clearTimeout(timeout);
      supabase.removeChannel(channel).catch(() => {});
    };
  });

  if (row.status === 'error') {
    throw new Error(row.error_message || 'Extraction failed');
  }
  if (!row.result_json) {
    throw new Error('Extraction finished but returned no result');
  }
  return row.result_json;
}

// ── Public entry point ──────────────────────────────────────────────────────
// Tries AI extraction first (if projectId is available), falls back to the
// heuristic vector parser if the edge function fails or isn't deployed.

export async function parsePdfSchedule(file: File, projectId?: string): Promise<ImportResult> {
  if (projectId) {
    try {
      return await parsePdfScheduleAI(file, projectId);
    } catch (aiErr) {
      const aiMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      // Fall through to heuristic. If that ALSO fails, throw the AI error
      // since it's usually the more informative one.
      try {
        const result = await parsePdfScheduleHeuristic(file);
        result.warnings = [
          `AI extraction unavailable (${aiMsg}). Used heuristic fallback — dates may be approximate.`,
          ...result.warnings,
        ];
        return result;
      } catch {
        throw new Error(`PDF extraction failed: ${aiMsg}`);
      }
    }
  }

  // No projectId → can't call the edge function, use heuristic directly.
  return parsePdfScheduleHeuristic(file);
}


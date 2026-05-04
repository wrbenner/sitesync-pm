/**
 * Parse sheet number + drawing title out of a construction PDF page's
 * embedded text layer.
 *
 * Key correctness invariant: pdfjs's text layer splits strings at font,
 * color, or spacing boundaries, so "ID-2.0" often comes back as TWO items
 * (`"ID-2"` and `".0"`). Running regex per-item truncates sheet numbers.
 * We cluster items into lines first, concatenate, THEN regex — so
 * `ID-2.0` / `A-1.01` / `C0.02` survive.
 */

import type { PageTextItem } from './pdfPageSplitter';
import type { TitleBlockRegion } from './titleBlockDetector';

export interface TitleBlockExtraction {
  sheetNumber?: string;
  title?: string;
  /** Revision label extracted from the title block, e.g. "5", "A", "B". */
  revision?: string;
  /** 0–1: how confident we are this came from a real title block */
  confidence: number;
  /** True if a vector-detected region was used to scope extraction */
  regionScoped?: boolean;
  /**
   * Which title-extraction strategy matched. Lower numbers are more
   * reliable (deterministic patterns); higher numbers are heuristic.
   *   0 — "SHEET NUMBER" labeled block (Cross-style layout)
   *   1 — Drawing-caption pattern ("NN TITLE" + "SCALE:") or explicit label
   *   2 — Largest-font line in cluster
   *   3 — Closest line heuristic
   *  -1 — No title found
   * The caller can use this to decide whether to trust the parser title
   * over a filename-derived fallback.
   */
  titleStrategy?: number;
}

// Sheet number: 1–3 letter prefix, optional separator, 1–3 digit whole,
// optional `.NN` or `-NN` decimal. The `\s*` around the decimal separator
// is essential: pdfjs often emits "ID-2" and ".0" as separate text items,
// and our clustering joins them with a space — so the regex must tolerate
// whitespace between the int and decimal parts.
//
// Widened from {1,2} to {1,3} to catch non-AIA prefixes that shops use:
// DWG-001, SK-01, CD-A01, PID-001. Scoring still gates most false matches
// because unknown prefixes don't get the +3 VALID_PREFIXES bonus.
const SHEET_NUMBER_RE = /\b([A-Z]{1,3})[-.\s]?(\d{1,3}(?:\s*[.-]\s*\d{1,3})?)\b/g;

// "SHEET N OF M" pattern — used as a last-resort when no regex match hits.
// Captures N (position in set) which we treat as the sheet number.
const SHEET_OF_RE = /\bsheet\s+(\d{1,3})\s+of\s+\d{1,3}\b/i;

// Revision: "REV 5", "REV: A", "REVISION B", "ISSUE 2", "R05" (labeled only).
// Bare `R\d+` unlabeled is too ambiguous — we require the word.
const REVISION_RE = /\b(?:rev(?:ision)?|issue)\.?\s*[:=]?\s*([A-Z0-9]{1,3})\b/i;

// Common construction-drawing title abbreviations. Expanded on the final
// title only. Conservative list — ambiguous ones (ELEV could mean
// elevation OR elevator) are intentionally omitted.
const TITLE_ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bBLDG\b/gi, 'BUILDING'],
  [/\bDWG\b/gi, 'DRAWING'],
  [/\bFLR\b/gi, 'FLOOR'],
  [/\bFND\b/gi, 'FOUNDATION'],
  [/\bSECT\b/gi, 'SECTION'],
  [/\bSCHED\b/gi, 'SCHEDULE'],
  [/\bDET\b/gi, 'DETAIL'],
  [/\bSPEC\b/gi, 'SPECIFICATION'],
  [/\bENLRG\b/gi, 'ENLARGED'],
  [/\bPART\b(?=\s+PLAN)/gi, 'PARTIAL'],
  [/\bRCP\b/gi, 'REFLECTED CEILING PLAN'],
  [/\bDEMO\b/gi, 'DEMOLITION'],
  [/\bTYP\b/gi, 'TYPICAL'],
  [/\bREQD\b/gi, 'REQUIRED'],
  [/\bEXIST\b/gi, 'EXISTING'],
  [/\bEQUIP\b/gi, 'EQUIPMENT'],
  [/\bMECH\b/gi, 'MECHANICAL'],
  [/\bELEC\b/gi, 'ELECTRICAL'],
  [/\bPLMB\b/gi, 'PLUMBING'],
  [/\bSTRUCT\b/gi, 'STRUCTURAL'],
  [/\bARCH\b(?!ITECT)/gi, 'ARCHITECTURAL'],
];

// AIA-standard plus common non-AIA discipline prefixes. Matches bump score.
const VALID_PREFIXES = new Set([
  'A', 'AD', 'AE', 'AS', 'AI', 'AV',
  'B',
  'C', 'CS', 'CD',   // CD = Construction Documents (some shops)
  'DM', 'DWG',
  'E', 'EP', 'EL',
  'F', 'FA', 'FP',
  'G', 'GT', 'GN',   // GN = General Notes
  'H',
  'I', 'ID', 'IN',
  'L', 'LS', 'LV',
  'M', 'ME',
  'P', 'PF', 'PL', 'PID',  // PID = Process & Instrumentation Diagram
  'Q',
  'R',
  'S', 'SD', 'SE', 'SK', 'SP',  // SK = Sketch, SP = Specifications
  'T',
  'V',
]);

// Prefixes that look like sheet numbers but almost never are:
//   X — grid references ("X-5"), detail callouts ("SEE X-29")
//   Z — contractor / shop drawing tag, rarely a real sheet number
//   D — ambiguous (process vs demolition); require word match instead
const AMBIGUOUS_PREFIXES = new Set(['X', 'Z', 'D']);

// Words that typically appear AS sheet-block content but shouldn't be
// mistaken for sheet numbers even if the regex matches them.
const NOT_A_SHEET_CONTEXT = /\b(grid|detail|section|elev|elevation|key|note)\s*$/i;

/**
 * Normalize a candidate using the EXACT raw match — preserves whatever
 * formatting the sheet's title block actually printed (A-101, A1.01,
 * ID-2.0, C0.02). We only strip whitespace introduced by cluster-joining
 * (e.g. "ID-2 .0" → "ID-2.0").
 */
function normalizeSheetNumber(rawMatch: string): string {
  return rawMatch.replace(/\s+/g, '');
}

/**
 * Apply the abbreviation table to a title string. Whole-word matches only.
 */
function expandTitleAbbreviations(title: string): string {
  let out = title;
  for (const [pattern, expansion] of TITLE_ABBREVIATIONS) {
    out = out.replace(pattern, expansion);
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Extract a revision string from the page text. Returns the first labeled
 * revision found (REV/REVISION/ISSUE) — unlabeled `R\d` is too ambiguous.
 */
function extractRevision(text: string): string | undefined {
  const m = text.match(REVISION_RE);
  if (!m) return undefined;
  const raw = m[1].trim();
  // Strip leading zeros on purely numeric revisions ("05" → "5")
  if (/^\d+$/.test(raw)) return raw.replace(/^0+(?=\d)/, '');
  return raw.toUpperCase();
}

/**
 * Cluster text items into y-bands (lines). pdfjs can split one visual line
 * into multiple items; reassembling them is what makes regex reliable.
 *
 * Returns lines sorted from top of page to bottom (high y to low y in pdfjs).
 */
function clusterIntoLines(items: PageTextItem[]): Array<{
  y: number;
  minX: number;
  maxX: number;
  avgFont: number;
  text: string;
  contributingItems: PageTextItem[];
}> {
  if (items.length === 0) return [];
  const avgFont =
    items.reduce((s, it) => s + it.fontSize, 0) / items.length || 10;
  const yTolerance = Math.max(avgFont * 0.4, 2);

  // Sort by y desc so top-of-page lines come first
  const sortedY = [...items].sort((a, b) => b.y - a.y);
  const buckets: PageTextItem[][] = [];
  let current: PageTextItem[] = [sortedY[0]];
  for (let i = 1; i < sortedY.length; i++) {
    const it = sortedY[i];
    const ref = current[current.length - 1];
    if (Math.abs(it.y - ref.y) <= yTolerance) {
      current.push(it);
    } else {
      buckets.push(current);
      current = [it];
    }
  }
  buckets.push(current);

  return buckets.map((group) => {
    const sortedX = [...group].sort((a, b) => a.x - b.x);
    const text = sortedX.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim();
    const fonts = group.map((it) => it.fontSize);
    return {
      y: group.reduce((s, it) => s + it.y, 0) / group.length,
      minX: Math.min(...group.map((it) => it.x)),
      maxX: Math.max(...group.map((it) => it.x + (it.str.length * it.fontSize * 0.5))),
      avgFont: fonts.reduce((s, f) => s + f, 0) / fonts.length,
      text,
      contributingItems: group,
    };
  });
}

/**
 * Distance (0–1, 0 = at edge, 1 = center) from the nearest page edge.
 * Title blocks live near edges regardless of which edge. A sheet number
 * at y=0.05 (bottom 5%) or x=0.95 (right 5%) returns a low number.
 */
function edgeDistance(
  x: number,
  y: number,
  pageWidth: number,
  pageHeight: number,
): number {
  const fromLeft = x / pageWidth;
  const fromRight = 1 - (x / pageWidth);
  const fromBottom = y / pageHeight;
  const fromTop = 1 - (y / pageHeight);
  return Math.min(fromLeft, fromRight, fromBottom, fromTop);
}

/**
 * Score how "title-block-like" a location is. Multiple real-world layouts:
 *   • Bottom-right (most common, ARCH-D)
 *   • Right-edge vertical strip (MEP firms)
 *   • Bottom-edge horizontal strip (smaller sheets)
 *   • Top-right corner (rare, some existing-conditions sheets)
 *   • Bottom-left (rare, some CAD defaults)
 *
 * Instead of hardcoding one region, we measure edge proximity. Any point
 * within 30% of the nearest edge counts as "near edge" — with a bonus
 * if it hits one of the canonical corners.
 */
function titleBlockLocationScore(
  x: number,
  y: number,
  pageWidth: number,
  pageHeight: number,
): number {
  const edge = edgeDistance(x, y, pageWidth, pageHeight);
  // Not near any edge → score 0
  if (edge > 0.30) return 0;

  // Base: linear ramp — closer to edge = higher score (0 → 3)
  let score = Math.round((1 - edge / 0.30) * 3);

  // Corner bonuses — real title blocks cluster in corners
  const nearBottom = y / pageHeight < 0.30;
  const nearTop = y / pageHeight > 0.70;
  const nearRight = x / pageWidth > 0.55;
  const nearLeft = x / pageWidth < 0.30;

  if (nearBottom && nearRight) score += 2;       // ARCH-D standard
  else if (nearRight && !nearTop && !nearBottom) score += 1;  // right-vertical strip
  else if (nearBottom && !nearLeft && !nearRight) score += 1; // bottom-horizontal
  else if (nearTop && nearRight) score += 1;     // top-right corner
  else if (nearBottom && nearLeft) score += 0;   // bottom-left (neutral)

  return score;
}

/**
 * Test whether a text item lies inside the vector-detected title-block
 * region. pdfjs coordinates are bottom-up: an item at y=0 is at the
 * bottom of the page; region.y is the rectangle's lower edge.
 */
function itemInsideRegion(it: PageTextItem, region: TitleBlockRegion): boolean {
  return (
    it.x >= region.x &&
    it.x <= region.x + region.w &&
    it.y >= region.y &&
    it.y <= region.y + region.h
  );
}

export function extractSheetTitleBlock(
  text: string,
  textItems: PageTextItem[],
  pageWidth: number,
  pageHeight: number,
  region?: TitleBlockRegion,
): TitleBlockExtraction {
  if (!text.trim() || textItems.length === 0) {
    return { confidence: 0 };
  }

  // ── Region handling: HINT, not hard filter ──────────────────
  // Earlier versions filtered text items to only those inside the
  // vector-detected region. That broke titles on any page where the
  // detector was wrong or the region was too tight. Now the region is
  // an additive SIGNAL: items inside it get a bonus during scoring,
  // but extraction still sees the full page. This is strictly safer —
  // when the detector helps we get a boost; when it's wrong we're no
  // worse than the no-region baseline.
  const avgFontSize =
    textItems.reduce((s, it) => s + it.fontSize, 0) / textItems.length || 1;
  const lines = clusterIntoLines(textItems);
  const wasRegionScoped = region !== undefined;

  type Candidate = {
    canonical: string;
    prefix: string;
    number: string;
    rawMatch: string;
    locationScore: number;
    fontRatio: number;
    line: (typeof lines)[number];
    score: number;
  };
  const candidates: Candidate[] = [];

  for (const line of lines) {
    SHEET_NUMBER_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SHEET_NUMBER_RE.exec(line.text)) !== null) {
      const prefix = m[1].toUpperCase();
      const number = m[2];
      const canonical = normalizeSheetNumber(m[0]).toUpperCase();

      // Context check: skip grid/detail references ("SEE X-5", "GRID A-1")
      const before = line.text.slice(Math.max(0, m.index - 20), m.index);
      if (NOT_A_SHEET_CONTEXT.test(before)) continue;
      // Skip detail-callout bubbles where the match is preceded by "N/"
      // — e.g. "08/ID3.12" means "detail 8 on sheet ID3.12", not that
      // this page IS ID3.12.
      if (/\d+\s*\/\s*$/.test(before)) continue;

      const locationScore = titleBlockLocationScore(
        line.minX,
        line.y,
        pageWidth,
        pageHeight,
      );

      candidates.push({
        canonical,
        prefix,
        number,
        rawMatch: m[0],
        locationScore,
        fontRatio: line.avgFont / avgFontSize,
        line,
        score: 0,
      });
    }
  }

  // ── Last-resort: "SHEET N OF M" pattern ──
  // When no prefix-based candidates matched, fall back to scanning for
  // sheet-position text. Gives us a usable ordinal sheet number on sets
  // that use plain "SHEET 1 OF 12" labeling instead of AIA codes.
  if (candidates.length === 0) {
    const sheetOfMatch = text.match(SHEET_OF_RE);
    if (sheetOfMatch) {
      const n = sheetOfMatch[1].replace(/^0+(?=\d)/, '');
      const rev = extractRevision(text);
      return {
        sheetNumber: n,
        revision: rev,
        confidence: 0.35,          // low — purely positional, not a real sheet code
        regionScoped: wasRegionScoped,
      };
    }
    return { confidence: 0, regionScoped: wasRegionScoped };
  }

  // Occurrence count — sheet index cross-references appear on sheets that
  // list out the full set, so the real sheet number shows up 2+ times.
  const occurrences = new Map<string, number>();
  for (const c of candidates) {
    occurrences.set(c.canonical, (occurrences.get(c.canonical) ?? 0) + 1);
  }

  // ── Scoring ──
  // Font size is the single strongest signal: sheet numbers are typically
  // 2–4× the body text. Location is a strong secondary signal but we now
  // accept ANY edge, not just bottom-right.
  for (const c of candidates) {
    let score = 0;
    if (VALID_PREFIXES.has(c.prefix)) score += 3;
    if (AMBIGUOUS_PREFIXES.has(c.prefix)) score -= 3;
    score += c.locationScore;                              // 0–5 depending on edge
    if (c.fontRatio >= 2.0) score += 4;                    // huge font → strong signal
    else if (c.fontRatio >= 1.5) score += 2;
    else if (c.fontRatio >= 1.2) score += 1;
    if ((occurrences.get(c.canonical) ?? 1) > 1) score += 1;
    // Longer numbers (A-1.01) are more likely real than short (A-1)
    if (c.number.includes('.') || c.number.includes('-')) score += 1;
    c.score = score;
  }

  // Deduplicate by canonical, keep highest-scoring
  const bestByKey = new Map<string, Candidate>();
  for (const c of candidates) {
    const cur = bestByKey.get(c.canonical);
    if (!cur || c.score > cur.score) bestByKey.set(c.canonical, c);
  }

  const ranked = [...bestByKey.values()].sort((a, b) => b.score - a.score);
  const best = ranked[0];

  // Score threshold. Region-scoped searches can be more permissive
  // because the region itself rules out false positives — anything that
  // matches inside the title-block rectangle is very likely real.
  const minScore = wasRegionScoped ? 3 : 5;
  if (!best || best.score < minScore) return { confidence: 0, regionScoped: wasRegionScoped };

  // ── Title extraction: aggressive multi-strategy ──
  //
  //   Strategy 0 — "SHEET NUMBER" labeled block. Many firms (Cross
  //                Architects among them) put the sheet number
  //                immediately below a literal "SHEET NUMBER" label,
  //                followed by the drawing title on multiple lines
  //                until a boilerplate line (COPYRIGHT, etc). This is
  //                the single most reliable pattern when present.
  //   Strategy 1a — Drawing caption pattern: "NN TITLE-TEXT" followed
  //                by a "SCALE:" line somewhere on the page. The
  //                caption text IS the drawing title.
  //   Strategy 1b — Labeled title: "DRAWING TITLE:", "SHEET TITLE:".
  //   Strategy 2 — Largest-font non-garbage line in title-block cluster.
  //   Strategy 3 — Proximity: closest content-bearing line.
  //
  // We accept the FIRST strategy that returns a plausible result.
  // Confidence decreases with strategy index.

  const sheetLine = best.line;
  let title: string | undefined;
  let titleStrategy: number = -1;

  // Define the title-block cluster. In region-scoped mode we already
  // know everything in `lines` is inside the title block — use all of
  // it. In full-page mode, stay close to the sheet number since we'd
  // otherwise pull in body text.
  const cluster = wasRegionScoped
    ? lines.filter((l) => l !== sheetLine)
    : lines.filter((l) => {
        if (l === sheetLine) return false;
        return (
          Math.abs(l.y - sheetLine.y) <= pageHeight * 0.28 &&
          Math.abs(l.minX - sheetLine.minX) <= pageWidth * 0.40
        );
      });

  // Minimal rejection filter — ONLY kick out hard negatives; we'd rather
  // pick something reasonable than nothing. This is the opposite of the
  // earlier pass: aggressive extraction > conservative blanks.
  const isObviousGarbage = (text: string): boolean => {
    const t = text.trim();
    if (t.length < 3 || t.length > 120) return true;
    // Pure numeric / punctuation
    if (!/[A-Za-z]/.test(t)) return true;
    // Feet-inches dimensions: "12'-7\" X 28'-5\""
    if (/\d+\s*'\s*-?\s*\d+\s*"?\s*(x|X|×)?\s*\d+\s*'\s*-?\s*\d+\s*"/.test(t)) return true;
    // Detail-callout strings: "08/ID3.12 06/ID3.12"
    if (/\d+\s*\/\s*[A-Z]{1,4}[-.]?\d/.test(t)) return true;
    // Pure scale / date / drawn-by boilerplate lines
    if (/^(scale|date|drawn|checked|plot\s*date|file|job|project\s+no|sheet\s*of|sheet\s+\d+\s+of)\b/i.test(t)) return true;
    // Copyright / legal boilerplate — "ALL RIGHTS RESERVED", "DO NOT SCALE"
    if (/\b(all\s+rights\s+reserved|do\s+not\s+scale|not\s+for\s+construction|unauthorized\s+(copy|use|reproduction)|property\s+of|©|\(c\))\b/i.test(t)) return true;
    // Dates in common formats: 03/15/2026, 2026-03-15, 15.03.26
    if (/^\d{1,4}[-./]\d{1,2}[-./]\d{1,4}$/.test(t)) return true;
    // Phone numbers: (555) 123-4567, 555.123.4567
    if (/\(?\d{3}\)?\s*[.-]\s*\d{3}\s*[.-]\s*\d{4}/.test(t)) return true;
    // URLs and email addresses (firm contact boilerplate)
    if (/\b(https?:|www\.|\.com|\.net|\.org|@[a-z]+\.)/i.test(t)) return true;
    // Firm-identifier lines — standalone "ARCHITECTS", "ENGINEERS", "LLP", "LLC", "INC"
    if (/^(architects?|engineers?|designers?|consultants?|associates)\s*(,?\s*(llp|llc|inc|pc|pa|ltd))?\.?\s*$/i.test(t)) return true;
    // The sheet number itself (self-reference)
    if (t.toUpperCase() === best.canonical) return true;
    // Starts with the sheet number + space (callout "ID4.0 02 12'-7...")
    if (new RegExp(`^${best.canonical.replace(/[.-]/g, '\\$&')}\\b`, 'i').test(t)) return true;
    return false;
  };

  // ── Strategy 0: "SHEET NUMBER" labeled block ──
  // Layout: sheet-number label → sheet number → title lines → boilerplate.
  // Find a line that says "SHEET NUMBER" (case-insensitive), then the
  // lines that come AFTER it in y-descending order (going down the page
  // in image terms = decreasing pdfjs y) are: the sheet number itself,
  // then the drawing title (possibly multi-line), then boilerplate.
  //
  // In pdfjs y is bottom-up, so "lines below" in visual terms = lines
  // with LOWER y values.
  {
    const allLinesSortedTopDown = [...lines].sort((a, b) => b.y - a.y);
    const labelIdx = allLinesSortedTopDown.findIndex((l) =>
      /^\s*sheet\s*(number|no\.?)\s*$/i.test(l.text.trim()),
    );
    if (labelIdx >= 0) {
      // Find the sheet-number line that follows (in visual order = lower y)
      const following = allLinesSortedTopDown.slice(labelIdx + 1);
      // Skip down until we find the line that matches our detected
      // sheetNumber (or any sheet-number-pattern). Everything AFTER that
      // until a boilerplate line is the title.
      const sheetIdxInFollowing = following.findIndex((l) =>
        l.text.toUpperCase().includes(best.canonical),
      );
      if (sheetIdxInFollowing >= 0) {
        const titleParts: string[] = [];
        for (const l of following.slice(sheetIdxInFollowing + 1)) {
          const t = l.text.trim();
          // Stop at boilerplate
          if (/^(copyright|©|\(c\)|all rights|rights reserved)\b/i.test(t)) break;
          if (/^(scale|date|drawn|checked|rev|issued|project)/i.test(t)) break;
          if (isObviousGarbage(t)) continue;
          // Title lines are short, mostly letters
          if (!/[A-Za-z]{3,}/.test(t)) continue;
          const letters = t.replace(/[^A-Za-z]/g, '');
          const upperRatio = letters.replace(/[^A-Z]/g, '').length / (letters.length || 1);
          if (letters.length < 3 || upperRatio < 0.55) continue;
          titleParts.push(t);
          // Stop once we have ~40+ chars of title — usually enough
          if (titleParts.join(' ').length > 60) break;
          if (titleParts.length >= 4) break;
        }
        if (titleParts.length > 0) {
          title = titleParts.join(' ').replace(/\s+/g, ' ');
          titleStrategy = 0;
        }
      }
    }
  }

  // ── Strategy 1a: drawing-caption pattern ("NN TITLE" + "SCALE: ...") ──
  // In the drawing body, the title often appears as a caption below the
  // drawing itself: a circle-numbered detail reference followed by the
  // title in caps, with a SCALE line immediately below.
  //    01  CLUBHOUSE - FLOORING PLAN
  //    SCALE: 3/16" = 1'-0"    BLDG A - FIRST FLOOR
  if (!title) {
    const linesTopDown = [...lines].sort((a, b) => b.y - a.y);
    for (let i = 0; i < linesTopDown.length - 1; i++) {
      const cur = linesTopDown[i].text.trim();
      const next = linesTopDown[i + 1].text.trim();
      // Caption line: starts with 1-3 digit number then big uppercase text
      const capMatch = cur.match(/^\d{1,3}\s+([A-Z][A-Z0-9\s–,/.&'-]{6,80})$/);
      if (!capMatch) continue;
      // Must be followed by a SCALE line for confidence
      if (!/^scale\s*[:=]/i.test(next)) continue;
      const candidate = capMatch[1].trim();
      if (isObviousGarbage(candidate)) continue;
      title = candidate.replace(/\s+/g, ' ');
      titleStrategy = 1;
      break;
    }
  }

  // ── Strategy 1b: labeled title ──
  if (!title) {
    for (const l of cluster) {
      const m = l.text.match(/\b(drawing|sheet|plan)\s*title\s*[:-]?\s*(.{3,100})$/i);
      if (m && m[2] && !isObviousGarbage(m[2])) {
        title = m[2].trim().replace(/\s+/g, ' ');
        titleStrategy = 1;
        break;
      }
    }
  }

  // ── Strategy 2: largest-font non-garbage line in the cluster ──
  if (!title) {
    const byFont = [...cluster]
      .filter((l) => !isObviousGarbage(l.text))
      // Must have at least 4 letters in a row to look title-ish
      .filter((l) => /[A-Za-z]{4,}/.test(l.text.replace(/\s+/g, '')))
      // Drop obvious boilerplate column headers
      .filter((l) => !/^(description|remarks|notes|legend|symbols|revisions?|no\.?)\s*$/i.test(l.text.trim()))
      // Sort: largest font first, then closest to sheet number, then longest text
      .sort((a, b) => {
        if (Math.abs(b.avgFont - a.avgFont) > 0.5) return b.avgFont - a.avgFont;
        const dA = Math.abs(a.y - sheetLine.y);
        const dB = Math.abs(b.y - sheetLine.y);
        if (Math.abs(dA - dB) > pageHeight * 0.02) return dA - dB;
        return b.text.length - a.text.length;
      });
    if (byFont.length > 0) {
      title = byFont[0].text.trim();
      titleStrategy = 2;
    }
  }

  // ── Strategy 3: closest line to the sheet number (above OR below) ──
  // Some firms place the drawing title BELOW the sheet number in the
  // title block (common in MEP sets and some architects' layouts).
  // Others place it above. Search both directions equally.
  if (!title) {
    const nearby = cluster
      .filter((l) => !isObviousGarbage(l.text))
      .filter((l) => /[A-Za-z]{3,}/.test(l.text))
      .filter((l) => !/^(description|remarks|notes|legend|symbols|revisions?|no\.?)\s*$/i.test(l.text.trim()))
      .sort((a, b) => Math.abs(a.y - sheetLine.y) - Math.abs(b.y - sheetLine.y));
    if (nearby.length > 0) {
      title = nearby[0].text.trim();
      titleStrategy = 3;
    }
  }

  // Confidence blends the sheet-number match score with whether we got
  // a title. Region-scoped matches get a significant confidence boost
  // because a vector-detected title block is strong prior evidence.
  const baseConf = Math.min(1, best.score / 10) * (title ? 1 : 0.5);
  const confidence = wasRegionScoped ? Math.min(1, baseConf + 0.2) : baseConf;

  // Expand common abbreviations in the final title (BLDG → BUILDING etc).
  // Safe because the abbreviation table only covers unambiguous terms.
  const expandedTitle = title ? expandTitleAbbreviations(title) : undefined;
  const revision = extractRevision(text);

  return {
    sheetNumber: best.canonical,
    title: expandedTitle,
    revision,
    confidence,
    regionScoped: wasRegionScoped,
    titleStrategy: title ? titleStrategy : -1,
  };
}

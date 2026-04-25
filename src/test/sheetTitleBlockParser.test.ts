import { describe, it, expect } from 'vitest';
import { extractSheetTitleBlock } from '../lib/sheetTitleBlockParser';
import type { PageTextItem } from '../lib/pdfPageSplitter';

// Helper: build a text-item stream that simulates a construction drawing
// PDF's text layer. `titleBlock` items are placed in the bottom-right corner
// (low y, high x). Page size defaults to ARCH D (36"x24") at 72 DPI.
function mkItem(str: string, x: number, y: number, fontSize = 10): PageTextItem {
  return { str, x, y, fontSize };
}

const ARCH_D = { w: 36 * 72, h: 24 * 72 };

describe('extractSheetTitleBlock — region-scoped extraction (Stage 1)', () => {
  // When a vector-detected region is passed, false positives OUTSIDE
  // the region become invisible. This is how we kill the detail-callout
  // garbage problem from real-world interior design sheets.
  it('region scoping hides callout-bubble garbage entirely', () => {
    const items: PageTextItem[] = [
      // Real sheet number inside the title-block rectangle
      mkItem('ID4.0', ARCH_D.w * 0.92, ARCH_D.h * 0.07, 22),
      mkItem('FLOOR PLAN', ARCH_D.w * 0.78, ARCH_D.h * 0.14, 14),
      // Detail callout bubbles OUTSIDE the title-block region — these
      // previously polluted the title extraction.
      mkItem('08/ID3.12 06/ID3.12', ARCH_D.w * 0.45, ARCH_D.h * 0.50, 10),
      mkItem('12\'-7" X 28\'-5"', ARCH_D.w * 0.45, ARCH_D.h * 0.48, 10),
    ];
    // Title block is the bottom-right 30% × 20% of the page
    const region = {
      x: ARCH_D.w * 0.70,
      y: 0,
      w: ARCH_D.w * 0.30,
      h: ARCH_D.h * 0.20,
    };
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
      region,
    );
    expect(result.sheetNumber).toBe('ID4.0');
    expect(result.title).toBe('FLOOR PLAN');
    expect(result.regionScoped).toBe(true);
    // Region-scoped confidence should be higher than a non-scoped equivalent
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('region-scoped match wins even when a larger-font false positive exists outside the region', () => {
    const items: PageTextItem[] = [
      // Real sheet number in title block: moderate font
      mkItem('M-201', ARCH_D.w * 0.92, ARCH_D.h * 0.07, 18),
      mkItem('MECHANICAL PLAN', ARCH_D.w * 0.75, ARCH_D.h * 0.14, 12),
      // FAKE sheet number outside the region, HUGE font (a project name
      // like "Project X-1234" might look like a sheet number). Without
      // region scoping, this would win on font size.
      mkItem('X-1234', ARCH_D.w * 0.40, ARCH_D.h * 0.92, 48),
    ];
    const region = {
      x: ARCH_D.w * 0.70,
      y: 0,
      w: ARCH_D.w * 0.30,
      h: ARCH_D.h * 0.25,
    };
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
      region,
    );
    expect(result.sheetNumber).toBe('M-201');
    expect(result.regionScoped).toBe(true);
  });

  it('still finds sheet number when the detected region is over empty space', () => {
    // Edge case: the vector-detected border rectangle covered an area
    // with no text (detector picked up a logo box, say). Region is now
    // a HINT not a hard filter, so extraction still works using the
    // full page. This was the regression we hit when the region
    // filter was too strict — rolled back in favor of hint semantics.
    const items: PageTextItem[] = [
      mkItem('A-101', ARCH_D.w * 0.92, ARCH_D.h * 0.07, 22),
      mkItem('FIRST FLOOR', ARCH_D.w * 0.75, ARCH_D.h * 0.14, 12),
    ];
    // Region positioned over an empty part of the page — nothing inside
    const region = {
      x: ARCH_D.w * 0.10,
      y: ARCH_D.h * 0.40,
      w: ARCH_D.w * 0.15,
      h: ARCH_D.h * 0.10,
    };
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
      region,
    );
    // Should still find A-101 via full-page extraction (the hint
    // didn't help but didn't hurt either — exactly the contract we
    // want after backing off from hard filtering).
    expect(result.sheetNumber).toBe('A-101');
    expect(result.regionScoped).toBe(true);
  });

  it('no region supplied → behaves exactly as before', () => {
    const items: PageTextItem[] = [
      mkItem('C-101', ARCH_D.w * 0.92, ARCH_D.h * 0.07, 22),
      mkItem('SITE PLAN', ARCH_D.w * 0.75, ARCH_D.h * 0.14, 12),
    ];
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
      // no region arg
    );
    expect(result.sheetNumber).toBe('C-101');
    expect(result.regionScoped).toBe(false);
  });
});

describe('extractSheetTitleBlock', () => {
  it('extracts a clean architectural title block', () => {
    const items: PageTextItem[] = [
      mkItem('FIRST FLOOR PLAN', ARCH_D.w * 0.70, ARCH_D.h * 0.18, 12),
      mkItem('A-101', ARCH_D.w * 0.90, ARCH_D.h * 0.08, 24),
      mkItem('SCALE: 1/8" = 1\'-0"', ARCH_D.w * 0.70, ARCH_D.h * 0.12, 8),
      mkItem('Random body text in the middle', ARCH_D.w * 0.3, ARCH_D.h * 0.5, 9),
    ];
    const text = items.map((i) => i.str).join('\n');
    const result = extractSheetTitleBlock(text, items, ARCH_D.w, ARCH_D.h);
    expect(result.sheetNumber).toBe('A-101');
    expect(result.title).toBe('FIRST FLOOR PLAN');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('extracts a civil sheet number with decimal format', () => {
    const items: PageTextItem[] = [
      mkItem('GRADING PLAN', ARCH_D.w * 0.75, ARCH_D.h * 0.16, 12),
      mkItem('C0.01', ARCH_D.w * 0.92, ARCH_D.h * 0.07, 22),
      mkItem('DATE: 2026-04-22', ARCH_D.w * 0.75, ARCH_D.h * 0.10, 8),
    ];
    const text = items.map((i) => i.str).join('\n');
    const result = extractSheetTitleBlock(text, items, ARCH_D.w, ARCH_D.h);
    expect(result.sheetNumber).toBe('C0.01');
    expect(result.title).toBe('GRADING PLAN');
  });

  it('extracts with two-letter prefix (CS, ID, LV)', () => {
    const items: PageTextItem[] = [
      mkItem('COVER SHEET', ARCH_D.w * 0.78, ARCH_D.h * 0.18, 14),
      mkItem('CS-001', ARCH_D.w * 0.90, ARCH_D.h * 0.07, 22),
    ];
    const text = items.map((i) => i.str).join('\n');
    const result = extractSheetTitleBlock(text, items, ARCH_D.w, ARCH_D.h);
    expect(result.sheetNumber).toBe('CS-001');
    expect(result.title).toBe('COVER SHEET');
  });

  it('prefers title-block location over body matches', () => {
    // A sheet number appearing in body text (sheet-index list) should lose
    // to the one in the title block corner.
    const items: PageTextItem[] = [
      mkItem('See sheet A-101 for details', ARCH_D.w * 0.3, ARCH_D.h * 0.5, 9),
      mkItem('LEVEL 2 PLAN', ARCH_D.w * 0.72, ARCH_D.h * 0.16, 12),
      mkItem('A-102', ARCH_D.w * 0.90, ARCH_D.h * 0.07, 22),
    ];
    const text = items.map((i) => i.str).join('\n');
    const result = extractSheetTitleBlock(text, items, ARCH_D.w, ARCH_D.h);
    expect(result.sheetNumber).toBe('A-102');
    expect(result.title).toBe('LEVEL 2 PLAN');
  });

  it('skips boilerplate (scale/date/drawn/rev) when picking title', () => {
    const items: PageTextItem[] = [
      mkItem('DATE: 2026-04-22', ARCH_D.w * 0.70, ARCH_D.h * 0.16, 8),
      mkItem('SCALE: 1"=20\'', ARCH_D.w * 0.70, ARCH_D.h * 0.14, 8),
      mkItem('DRAWN BY: JC', ARCH_D.w * 0.70, ARCH_D.h * 0.12, 8),
      mkItem('SITE LAYOUT', ARCH_D.w * 0.72, ARCH_D.h * 0.20, 14),
      mkItem('C-101', ARCH_D.w * 0.92, ARCH_D.h * 0.07, 22),
    ];
    const text = items.map((i) => i.str).join('\n');
    const result = extractSheetTitleBlock(text, items, ARCH_D.w, ARCH_D.h);
    expect(result.sheetNumber).toBe('C-101');
    expect(result.title).toBe('SITE LAYOUT');
  });

  it('returns low confidence when no text layer', () => {
    const result = extractSheetTitleBlock('', [], ARCH_D.w, ARCH_D.h);
    expect(result.confidence).toBe(0);
    expect(result.sheetNumber).toBeUndefined();
  });

  it('returns low confidence when nothing looks like a sheet number', () => {
    const items: PageTextItem[] = [
      mkItem('Random notes about the project', ARCH_D.w * 0.5, ARCH_D.h * 0.5, 10),
      mkItem('More random text', ARCH_D.w * 0.3, ARCH_D.h * 0.3, 10),
    ];
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
    );
    expect(result.confidence).toBe(0);
  });

  it('rejects matches with invalid prefix letters', () => {
    // "ZZ-99" has an invalid prefix — should NOT be selected even though it
    // matches the sheet-number regex pattern.
    const items: PageTextItem[] = [
      mkItem('ZZ-99', ARCH_D.w * 0.90, ARCH_D.h * 0.07, 22),
    ];
    const result = extractSheetTitleBlock(
      'ZZ-99',
      items,
      ARCH_D.w,
      ARCH_D.h,
    );
    // Valid-prefix bonus didn't fire → score is below threshold
    expect(result.confidence).toBe(0);
  });

  it('extracts from a bottom-right title block (ARCH-D standard)', () => {
    const items: PageTextItem[] = [
      mkItem('FLOOR PLAN', ARCH_D.w * 0.75, ARCH_D.h * 0.18, 12),
      mkItem('A-101', ARCH_D.w * 0.92, ARCH_D.h * 0.07, 22),
      mkItem('random body', ARCH_D.w * 0.3, ARCH_D.h * 0.5, 9),
    ];
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
    );
    expect(result.sheetNumber).toBe('A-101');
  });

  it('extracts from a RIGHT-EDGE vertical strip (MEP firms)', () => {
    // Title block runs floor-to-ceiling down the right edge
    const items: PageTextItem[] = [
      mkItem('MECHANICAL PLAN', ARCH_D.w * 0.88, ARCH_D.h * 0.70, 12),
      mkItem('M-201', ARCH_D.w * 0.93, ARCH_D.h * 0.55, 22),
      mkItem('SCALE 1/4"=1\'-0"', ARCH_D.w * 0.88, ARCH_D.h * 0.50, 8),
      mkItem('floor plan body', ARCH_D.w * 0.3, ARCH_D.h * 0.5, 9),
    ];
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
    );
    expect(result.sheetNumber).toBe('M-201');
  });

  it('extracts from a BOTTOM-EDGE horizontal strip (smaller sheets)', () => {
    // Title block spans bottom of page, full width
    const items: PageTextItem[] = [
      mkItem('S-301', ARCH_D.w * 0.45, ARCH_D.h * 0.05, 22),
      mkItem('FOUNDATION DETAILS', ARCH_D.w * 0.15, ARCH_D.h * 0.08, 12),
      mkItem('structural diagram', ARCH_D.w * 0.5, ARCH_D.h * 0.5, 9),
    ];
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
    );
    expect(result.sheetNumber).toBe('S-301');
  });

  it('extracts from a TOP-RIGHT title block (rare existing-conditions layout)', () => {
    const items: PageTextItem[] = [
      mkItem('EX-101', ARCH_D.w * 0.92, ARCH_D.h * 0.92, 22),
      mkItem('EXISTING CONDITIONS', ARCH_D.w * 0.72, ARCH_D.h * 0.87, 12),
      mkItem('plan content', ARCH_D.w * 0.3, ARCH_D.h * 0.5, 9),
    ];
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
    );
    // "EX" isn't in VALID_PREFIXES but "E" is, so it scores the discipline
    // bonus. Position + font should carry it over threshold.
    expect(result.sheetNumber).toBeDefined();
  });

  it('line clustering reassembles split pdfjs tokens — "ID-2" + ".0" → "ID-2.0"', () => {
    // pdfjs often splits "ID-2.0" into two text items with slightly different
    // font rendering. Our clustering merges adjacent-y items before regex.
    const items: PageTextItem[] = [
      mkItem('ROOM FINISH', ARCH_D.w * 0.75, ARCH_D.h * 0.18, 12),
      mkItem('ID-2', ARCH_D.w * 0.90, ARCH_D.h * 0.07, 22),
      mkItem('.0', ARCH_D.w * 0.93, ARCH_D.h * 0.07, 22),  // SAME y as "ID-2"
      mkItem('layout', ARCH_D.w * 0.3, ARCH_D.h * 0.5, 9),
    ];
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
    );
    expect(result.sheetNumber).toBe('ID-2.0');  // NOT "ID-2"
  });

  it('rejects callout-bubble garbage as title, leaves title undefined for human review', () => {
    // Real-world ID interior sheet: sheet number surrounded by elevation
    // callouts and dimensions. No real title = undefined (not garbage).
    const items: PageTextItem[] = [
      mkItem('ID4.0', ARCH_D.w * 0.92, ARCH_D.h * 0.07, 22),
      mkItem('02', ARCH_D.w * 0.45, ARCH_D.h * 0.18, 11),
      mkItem('12\'-7" X 28\'-5"', ARCH_D.w * 0.45, ARCH_D.h * 0.15, 10),
      mkItem('08/ID3.12', ARCH_D.w * 0.50, ARCH_D.h * 0.18, 10),
      mkItem('06/ID3.12', ARCH_D.w * 0.55, ARCH_D.h * 0.18, 10),
    ];
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
    );
    expect(result.sheetNumber).toBe('ID4.0');
    expect(result.title).toBeUndefined();
  });

  it('extracts the Cross Architects "SHEET NUMBER" labeled layout (Strategy 0)', () => {
    // Real-world layout from user screenshot. Right-vertical title strip:
    //   ...
    //   ISSUED FOR
    //   CONSTRUCTION
    //   SHEET NUMBER
    //   ID-3.2              <- sheet number printed huge
    //   CLUBHOUSE           <- title line 1
    //   FLOORING            <- title line 2
    //   PLAN                <- title line 3
    //   COPYRIGHT © 2023    <- boilerplate, stop here
    //
    // In pdfjs coords (bottom-up), the LABEL "SHEET NUMBER" has HIGHER
    // y than "ID-3.2", which has HIGHER y than "CLUBHOUSE", etc.
    const items: PageTextItem[] = [
      mkItem('ISSUED FOR',        ARCH_D.w * 0.95, ARCH_D.h * 0.35, 8),
      mkItem('CONSTRUCTION',      ARCH_D.w * 0.95, ARCH_D.h * 0.32, 10),
      mkItem('SHEET NUMBER',      ARCH_D.w * 0.95, ARCH_D.h * 0.25, 8),
      mkItem('ID-3.2',            ARCH_D.w * 0.95, ARCH_D.h * 0.20, 32),
      mkItem('CLUBHOUSE',         ARCH_D.w * 0.95, ARCH_D.h * 0.13, 12),
      mkItem('FLOORING',          ARCH_D.w * 0.95, ARCH_D.h * 0.10, 12),
      mkItem('PLAN',              ARCH_D.w * 0.95, ARCH_D.h * 0.07, 12),
      mkItem('COPYRIGHT © 2023',  ARCH_D.w * 0.95, ARCH_D.h * 0.03, 7),
      // Body content
      mkItem('floor plan drawing', ARCH_D.w * 0.3, ARCH_D.h * 0.5, 9),
    ];
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
    );
    expect(result.sheetNumber).toBe('ID-3.2');
    expect(result.title).toBe('CLUBHOUSE FLOORING PLAN');
    expect(result.titleStrategy).toBe(0);   // matched Strategy 0
  });

  it('extracts the drawing-caption pattern (Strategy 1)', () => {
    // Many drawings have "NN TITLE / SCALE: ..." under the drawing area
    //    01  CLUBHOUSE - FLOORING PLAN
    //    SCALE: 3/16" = 1'-0"
    const items: PageTextItem[] = [
      mkItem('A-3.2', ARCH_D.w * 0.95, ARCH_D.h * 0.05, 22),
      // Caption with circle-numbered detail
      mkItem('01 CLUBHOUSE - FLOORING PLAN', ARCH_D.w * 0.35, ARCH_D.h * 0.08, 12),
      mkItem('SCALE: 3/16" = 1\'-0"', ARCH_D.w * 0.35, ARCH_D.h * 0.05, 8),
    ];
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
    );
    expect(result.title).toBe('CLUBHOUSE - FLOORING PLAN');
    expect(result.titleStrategy).toBe(1);
  });

  it('aggressively picks up a labeled title: "DRAWING TITLE: FLOOR PLAN"', () => {
    const items: PageTextItem[] = [
      mkItem('DRAWING TITLE: FLOOR PLAN', ARCH_D.w * 0.75, ARCH_D.h * 0.14, 10),
      mkItem('A-101', ARCH_D.w * 0.92, ARCH_D.h * 0.07, 22),
    ];
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
    );
    expect(result.sheetNumber).toBe('A-101');
    expect(result.title).toBe('FLOOR PLAN');
  });

  it('picks the largest-font non-boilerplate line in the title-block cluster', () => {
    // Title block with multiple items — the BIG one should be picked even
    // if it's not the closest to the sheet number.
    const items: PageTextItem[] = [
      mkItem('SCALE: 1/4"=1\'-0"', ARCH_D.w * 0.75, ARCH_D.h * 0.18, 8),
      mkItem('ENLARGED INTERIOR ELEVATIONS', ARCH_D.w * 0.70, ARCH_D.h * 0.14, 16),
      mkItem('DATE: 2026-04-22', ARCH_D.w * 0.75, ARCH_D.h * 0.11, 8),
      mkItem('ID4.0', ARCH_D.w * 0.92, ARCH_D.h * 0.07, 22),
    ];
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
    );
    expect(result.sheetNumber).toBe('ID4.0');
    expect(result.title).toBe('ENLARGED INTERIOR ELEVATIONS');
  });

  it('accepts a real sheet title even on an interior-design sheet', () => {
    const items: PageTextItem[] = [
      mkItem('ENLARGED INTERIOR ELEVATIONS', ARCH_D.w * 0.75, ARCH_D.h * 0.14, 14),
      mkItem('ID4.0', ARCH_D.w * 0.92, ARCH_D.h * 0.07, 22),
      mkItem('drawing body content', ARCH_D.w * 0.3, ARCH_D.h * 0.5, 9),
    ];
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
    );
    expect(result.sheetNumber).toBe('ID4.0');
    expect(result.title).toBe('ENLARGED INTERIOR ELEVATIONS');
  });

  it('rejects feet-inches dimensions as titles', () => {
    const items: PageTextItem[] = [
      mkItem('10\'-6" X 12\'-4"', ARCH_D.w * 0.75, ARCH_D.h * 0.14, 14),
      mkItem('A-201', ARCH_D.w * 0.92, ARCH_D.h * 0.07, 22),
    ];
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
    );
    expect(result.sheetNumber).toBe('A-201');
    expect(result.title).toBeUndefined();
  });

  it('picks up a title BELOW the sheet number (MEP/some architects layout)', () => {
    // Some firms put the sheet number first and the title underneath it.
    // In pdfjs y-coordinates, "below" means lower y.
    const items: PageTextItem[] = [
      mkItem('M-201', ARCH_D.w * 0.92, ARCH_D.h * 0.18, 22),
      mkItem('HVAC DUCTWORK PLAN', ARCH_D.w * 0.75, ARCH_D.h * 0.12, 12),
      mkItem('SCALE: 1/4"=1\'-0"', ARCH_D.w * 0.75, ARCH_D.h * 0.08, 8),
    ];
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
    );
    expect(result.sheetNumber).toBe('M-201');
    expect(result.title).toBe('HVAC DUCTWORK PLAN');
  });

  it('rejects detail-callout bubbles as titles', () => {
    const items: PageTextItem[] = [
      mkItem('04/ID3.12 05/ID3.12', ARCH_D.w * 0.75, ARCH_D.h * 0.14, 14),
      mkItem('ID4.1', ARCH_D.w * 0.92, ARCH_D.h * 0.07, 22),
    ];
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
    );
    expect(result.sheetNumber).toBe('ID4.1');
    expect(result.title).toBeUndefined();
  });

  it('rejects X- grid references ("SEE X-5")', () => {
    const items: PageTextItem[] = [
      // Real sheet number in title block
      mkItem('C-101', ARCH_D.w * 0.92, ARCH_D.h * 0.07, 22),
      mkItem('SITE PLAN', ARCH_D.w * 0.75, ARCH_D.h * 0.15, 12),
      // Grid reference in body — same font, low edge score, ambiguous prefix
      mkItem('SEE X-5 FOR DETAILS', ARCH_D.w * 0.4, ARCH_D.h * 0.5, 9),
    ];
    const result = extractSheetTitleBlock(
      items.map((i) => i.str).join('\n'),
      items,
      ARCH_D.w,
      ARCH_D.h,
    );
    expect(result.sheetNumber).toBe('C-101');   // NOT X-5
  });
});

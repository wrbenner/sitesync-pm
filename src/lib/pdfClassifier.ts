/**
 * Filename-based routing + cover/project-data metadata extraction.
 *
 * Two responsibilities:
 *   1. `classifyPdfByFilename` — fast, deterministic routing at upload time
 *      so a zip of 12 PDFs lands in the right places (Drawings, Specs, Cover).
 *   2. `parseCoverMetadata` / `looksLikeCoverText` — client-side parsing of
 *      extracted PDF text to pull project name, address, consultants, code
 *      summary, areas. Runs on cover sheets AND on the first page of any
 *      drawing PDF (the architectural title sheet almost always has the full
 *      consultant block even when the filename says "Arch_IFC").
 */

export type PdfRoute = 'spec' | 'cover' | 'drawing';

/**
 * Normalize a filename into lowercase space-separated tokens.
 *
 * Why: in JS regex, `_` is a word character, so `\b` does NOT fire between
 * `_` and a letter. `_Spec Book_` has no word boundary before "Spec", which
 * caused the first routing pass to misclassify every file as `drawing`.
 * Swapping separators for spaces up front means simple `\b` patterns work.
 */
function normalizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[_\-/\\.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SPEC_PATTERNS = [
  /\bspec book\b/,
  /\bspecifications?\b/,
  /\bspec(s)?\s+sheet\b/,
  /^specs?\b/,
  /\bspecs?\b.*\b(index|list|pages?)\b/,
  // CSI MasterFormat 6-digit section numbers: 017900-Demonstration…, 033000-Cast-in-Place…
  /^\d{6}\b/,
];

const COVER_PATTERNS = [
  /\b(front|rear|back)\s*covers?\b/,
  /\bcover\s*sheet\b/,
  /\btitle\s*sheet\b/,
  /\bcovers?\b/,
  // Project-data / general-series naming conventions (AIA sheet numbering):
  //   G-000, G-001, G 0-0-1, G001, T-001, T1 — the "G" and "T" series
  //   commonly host the project data page.
  /\bproject\s*data\b/,
  /\bproject\s*info(?:rmation)?\b/,
  /\bcode\s*(summary|analysis|review)\b/,
  /\bgeneral\s*(info|information|notes)\b/,
  /\b[gt]\s*[-\s]?\s*0*0*1\b/,
  /\b[gt]\s*[-\s]?\s*0*0*0\b/,
];

/**
 * Classify a PDF as drawing / spec / cover.
 *
 * Pass `fullPath` (e.g. zip-internal path like
 * "26-0421 Procore Current/Specifications/03-Concrete/033000-Cast-in-Place.pdf")
 * when available — a `/Specifications/` folder is a strong spec signal that
 * works even when filenames are CSI numbers without the word "spec".
 */
export function classifyPdfByFilename(name: string, fullPath?: string): PdfRoute {
  if (fullPath && /\/specifications?\//i.test(fullPath)) return 'spec';
  const n = normalizeFilename(name);
  if (SPEC_PATTERNS.some((r) => r.test(n))) return 'spec';
  if (COVER_PATTERNS.some((r) => r.test(n))) return 'cover';
  return 'drawing';
}

// ─── Discipline inference ──────────────────────────────────────────────
// Was duplicated in src/pages/drawings/index.tsx and src/test/pdfClassifier.test.ts.
// One source of truth now.

export type Discipline =
  | 'cover' | 'hazmat' | 'demolition' | 'survey' | 'geotechnical'
  | 'civil' | 'landscape' | 'structural' | 'architectural' | 'interior'
  | 'fire_protection' | 'plumbing' | 'mechanical' | 'electrical'
  | 'telecommunications' | 'food_service' | 'laundry' | 'vertical_transportation';

export function inferDisciplineFromFilename(name: string): Discipline | null {
  const normalized = name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[_\-/\\.]+/g, ' ')
    .replace(/\s+/g, ' ');

  // Ordering matters: more specific patterns first so "cover sheet" doesn't
  // get swallowed by another partial match, and compound terms like
  // "fire protection" are checked before anything shorter might win.
  const wordPatterns: Array<{ re: RegExp; discipline: Discipline }> = [
    // Meta / pre-construction
    { re: /\b(covers?|title\s*sheet|cover\s*sheets?|project\s*data|code\s*(summary|analysis)|general\s*(notes|info))\b/, discipline: 'cover' },
    { re: /\b(hazmat|hazardous\s*materials?|asbestos|lead\s*paint|environmental|swppp|erosion\s*control)\b/, discipline: 'hazmat' },
    { re: /\b(demo(lition)?|existing\s*conditions)\b/, discipline: 'demolition' },
    { re: /\b(survey|topo(graphic)?|alta)\b/, discipline: 'survey' },
    { re: /\b(geotechnical|geotech|soils?\s*report)\b/, discipline: 'geotechnical' },
    // Site + envelope
    { re: /\b(civil)\b/, discipline: 'civil' },
    { re: /\b(landscape)\b/, discipline: 'landscape' },
    // Building — `structure` needs its own alternation because \bstruct\b
    // doesn't match the substring inside "structure" (no word boundary
    // between the t and the u).
    { re: /\b(structural|structure|struct)\b/, discipline: 'structural' },
    { re: /\b(architectural|architecture|arch)\b/, discipline: 'architectural' },
    { re: /\b(interior(\s+design)?)\b/, discipline: 'interior' },
    { re: /\b(id)\b/, discipline: 'interior' },
    // Systems (order matters: FP before electrical/plumbing so "fire alarm" is caught correctly)
    { re: /\b(fire\s*protection|fire\s*alarm|fp)\b/, discipline: 'fire_protection' },
    { re: /\b(plumbing|plumb)\b/, discipline: 'plumbing' },
    { re: /\b(mechanical|mech|hvac)\b/, discipline: 'mechanical' },
    { re: /\b(electrical|elec)\b/, discipline: 'electrical' },
    { re: /\b(telecommunications?|telecom|low\s*voltage|lv|technology|tele\b)\b/, discipline: 'telecommunications' },
    // Special trades (FF&E + conveyance)
    { re: /\b(food\s*service|kitchen\s*equipment|cafeteria)\b/, discipline: 'food_service' },
    { re: /\blaundry\b/, discipline: 'laundry' },
    { re: /\b(vertical\s*transportation|elevators?|escalators?|conveyance)\b/, discipline: 'vertical_transportation' },
  ];
  for (const { re, discipline } of wordPatterns) {
    if (re.test(normalized)) return discipline;
  }

  // Pass 2: sheet-prefix fallback per AIA US National CAD Standard.
  // We omit `D` (ambiguous: Process/Demolition) — demolition must come from
  // a word match, not a single-letter prefix.
  const prefixMap: Record<string, Discipline> = {
    G: 'cover', H: 'hazmat', V: 'survey', B: 'geotechnical',
    C: 'civil', L: 'landscape', S: 'structural', A: 'architectural',
    I: 'interior', Q: 'interior', F: 'fire_protection', P: 'plumbing',
    M: 'mechanical', E: 'electrical', T: 'telecommunications',
  };
  const m = name.match(/^([A-Z]{1,2})-?\d/i);
  if (m) {
    const prefix = m[1].toUpperCase();
    if (prefix === 'CS') return 'cover';
    if (prefix === 'ID') return 'interior';
    if (prefix === 'PF') return 'plumbing';
    if (prefix === 'FA') return 'fire_protection';
    if (prefix === 'LV') return 'telecommunications';
    if (prefix === 'FS') return 'food_service';
    if (prefix === 'VT') return 'vertical_transportation';
    return prefixMap[prefix[0]] ?? null;
  }
  return null;
}

// ─── Revision + scale extractors (used everywhere — filename + cover + viewer) ─

/**
 * Pull a revision label out of a filename. Was duplicated across the
 * drawings page upload flow and the test fixtures; one source of truth now.
 *
 * Matches `Rev 5`, `Revision 1.0`, `R12`, `_Rev_03`. Strips leading zeros so
 * "05" comes back as "5". Returns null when the filename has no revision
 * marker — caller decides the default ('1' in the upload flow).
 */
export function extractRevisionFromFilename(name: string): string | null {
  const normalized = name.replace(/_+/g, ' ');
  const m = normalized.match(/\b(?:rev(?:ision)?|r)[\s-]?(\d{1,3}(?:\.\d{1,2})?)\b/i);
  if (!m) return null;
  return m[1].replace(/^0+(?=\d)/, '');
}

/**
 * Pull a revision label out of extracted page text. Only labeled
 * revisions count (`REV: 5`, `REVISION 1.0`, `ISSUE B`) — bare `R5` is too
 * ambiguous and would false-fire on radius callouts and shape grid labels.
 */
export function extractRevisionFromText(text: string): string | null {
  // Two traps to avoid:
  //   1. "REVIEW" — `rev` matches, captures "IEW". Fixed by \b after the
  //      keyword so the label must be a complete word.
  //   2. "REVISIONS NO. DATE…" — the "REVISIONS" title-block header is
  //      followed by column labels ("NO", "DATE", "DESC"). Multi-letter
  //      capture matches "NO" and we report it as the revision.
  // Tightened capture: real construction revisions are a digit (with
  // optional decimal like "1.0") OR a single letter (A/B/C…). Rejects
  // any 2-3 letter all-caps word ("NO", "REX", "BTU", "PT", "IEW").
  const m = text.match(
    /\b(?:rev(?:ision)?|issue)\b\.?\s*[:=]?\s*(\d{1,2}(?:\.\d{1,2})?|[A-Z])\b/i,
  );
  if (!m) return null;
  const raw = m[1].trim();
  if (/^\d/.test(raw)) return raw.replace(/^0+(?=\d)/, '');
  return raw.toUpperCase();
}

export interface ScaleExtraction {
  /** Verbatim string from the page, e.g. `1/4" = 1'-0"` or `NTS`. */
  text: string;
  /** Real-world inches per drawing inch, when computable. NTS / "as noted" → null. */
  ratio: number | null;
}

/**
 * Find the drawing scale on a sheet's text. Recognizes:
 *   - Imperial:   `1/4" = 1'-0"`, `3/16" = 1'-0"`, `1" = 20'`
 *   - Metric:     `1:100`, `1:50`
 *   - Sentinels:  `NTS`, `Not to Scale`, `As Noted`, `As Shown`
 *
 * Mirrors the parser in supabase/functions/generate-revision-diff for
 * imperial → ratio conversion so what the tester reports matches what the
 * revision-diff edge function will compute.
 */
export function extractScaleText(text: string): ScaleExtraction | null {
  const normalized = text.replace(/’/g, "'");

  // 1. Sentinels — NTS / not to scale / as noted
  const sentinel = normalized.match(/\b(NTS|not\s+to\s+scale|as\s+noted|as\s+shown)\b/i);
  if (sentinel) return { text: sentinel[0], ratio: null };

  // 2. Imperial: `1/4" = 1'-0"` (most common construction scale notation)
  const imperial = normalized.match(/([\d\s/]+)"\s*=\s*(\d+)'\s*-?\s*(\d*)"?/);
  if (imperial) {
    const drawingRaw = imperial[1].trim();
    let drawingVal: number;
    if (drawingRaw.includes('/')) {
      const [num, den] = drawingRaw.split('/').map((s) => parseFloat(s));
      drawingVal = den === 0 || !Number.isFinite(num) || !Number.isFinite(den) ? NaN : num / den;
    } else {
      drawingVal = parseFloat(drawingRaw);
    }
    const realFeet = parseFloat(imperial[2]);
    const realInches = parseFloat(imperial[3] || '0');
    let ratio: number | null = null;
    if (Number.isFinite(drawingVal) && drawingVal > 0 && Number.isFinite(realFeet)) {
      ratio = (realFeet * 12 + (Number.isFinite(realInches) ? realInches : 0)) / drawingVal;
    }
    return { text: imperial[0].trim(), ratio };
  }

  // 3. Metric: `1:100`, `1:50`. Avoid matching times ("9:30") by requiring
  // the first number to be small (1-10) — construction scales are 1:N.
  const metric = normalized.match(/\b(1)\s*:\s*(\d{2,4})\b/);
  if (metric) {
    return { text: metric[0], ratio: parseFloat(metric[2]) };
  }

  return null;
}

// ─── Cover / project-data text parsing ──────────────────────────────────────

export interface CoverMetadata {
  /** Project name (best-effort heuristic) */
  projectName?: string;
  /** Full postal address: "Street, City, ST ZIP" */
  address?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  /** Discipline key → firm name */
  consultants: Record<string, string>;
  /** Total building area in square feet */
  buildingAreaSqft?: number;
  /** Number of stories above grade */
  numFloors?: number;
  /** Occupancy classification per IBC/CBC (e.g. "R-2", "B", "A-2") */
  occupancyClassification?: string;
  /** Construction type per IBC (e.g. "Type V-A", "III-B") */
  constructionType?: string;
  /** Code edition (e.g. "2021 IBC", "2019 CBC") */
  codeEdition?: string;
  /** Raw normalized text so a reviewer can see what the parser worked from */
  rawText: string;
  /** Score 0-1 indicating how confident we are this text was cover-like */
  confidence: number;
}

const CONSULTANT_LABELS: Array<{ key: string; label: RegExp }> = [
  { key: 'owner', label: /\bowner\b/i },
  { key: 'developer', label: /\bdeveloper\b/i },
  { key: 'architect', label: /\barchitect(?:\s+of\s+record)?\b/i },
  { key: 'landscape_architect', label: /\blandscape\s+architect\b/i },
  { key: 'interior_designer', label: /\binterior\s+design(?:er)?\b/i },
  { key: 'structural_engineer', label: /\bstructural(?:\s+engineer)?\b/i },
  { key: 'mep_engineer', label: /\bm[\W_]?e[\W_]?p(?:\s+engineer)?\b|mechanical\/?electrical\/?plumbing/i },
  { key: 'mechanical_engineer', label: /\bmechanical(?:\s+engineer)?\b/i },
  { key: 'electrical_engineer', label: /\belectrical(?:\s+engineer)?\b/i },
  { key: 'plumbing_engineer', label: /\bplumbing(?:\s+engineer)?\b/i },
  { key: 'civil_engineer', label: /\bcivil(?:\s+engineer)?\b/i },
  { key: 'geotechnical_engineer', label: /\bgeotechnical(?:\s+engineer)?\b/i },
  { key: 'fire_protection', label: /\bfire\s+protection\b|\bfire\s+sprinkler\b/i },
  { key: 'surveyor', label: /\b(?:land\s+)?surveyor\b/i },
  { key: 'contractor', label: /\bgeneral\s+contractor\b|\bg\.c\.\b|\bcontractor\b/i },
];

const ADDRESS_RE =
  /(\d{1,6}\s+[A-Za-z][\w\s.,'#-]{2,80}?(?:ROAD|RD|STREET|ST|AVENUE|AVE|BLVD|BOULEVARD|DRIVE|DR|LANE|LN|WAY|COURT|CT|PLACE|PL|PARKWAY|PKWY|HIGHWAY|HWY|TERRACE|TER|CIRCLE|CIR|SQUARE|SQ)\.?)\s*,?\s*([A-Za-z][A-Za-z\s.-]+?)\s*,\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/i;

// Building area: "140,000 SF", "85,000 gsf", "42,500 square feet"
const AREA_RE = /\b(\d{1,3}(?:,\d{3})*|\d{3,7})\s*(?:sq(?:uare)?\.?\s*(?:ft|feet)|s\.?f\.?|gsf|gross\s+sf)\b/i;

// Number of stories/floors
const STORIES_RE = /\b(\d{1,2})\s*(?:-?\s*)?(?:stor(?:y|ies)|floors?|levels?)\b/i;

// Occupancy classification (IBC Group) — handle "Occupancy: R-2",
// "Occupancy Group R-2", "Occupancy Classification: B", etc.
const OCCUPANCY_RE =
  /\boccupanc(?:y|ies)\s*[:\-–]?\s*(?:group|class(?:ification)?)?\s*[:\-–]?\s*([A-Z](?:[-\s]?\d)?)\b/i;

// Construction type (Type I/II/III/IV/V with optional A/B)
const CONSTRUCTION_RE = /\btype\s+(I{1,3}V?|IV|V)(?:[-\s]?([AB]))?\b/i;

// Code edition
const CODE_RE = /\b(20\d{2})\s+(IBC|CBC|IFC|IECC|IRC|IPC|NEC|NFPA|LSC)\b/i;

/**
 * Quick check: does this text look like a cover / project-data page?
 * We want to avoid running the full parser (and spamming toasts) when we
 * accidentally read a random sheet. Presence of 2+ signals → yes.
 */
export function looksLikeCoverText(text: string): boolean {
  const t = text.toUpperCase();
  let score = 0;
  if (/ARCHITECT\b/.test(t)) score++;
  if (/OWNER\b/.test(t)) score++;
  if (/\bPROJECT\s+(DATA|INFO|INFORMATION)\b/.test(t)) score += 2;
  if (/\bCODE\s+(SUMMARY|ANALYSIS|REVIEW)\b/.test(t)) score += 2;
  if (/\bCONSULTANTS?\b/.test(t)) score++;
  if (ADDRESS_RE.test(text)) score++;
  if (/\bOCCUPANC(Y|IES)\b/.test(t)) score++;
  if (/\bTYPE\s+[IV]{1,3}/.test(t)) score++;
  return score >= 2;
}

export function parseCoverMetadata(text: string): CoverMetadata {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const result: CoverMetadata = {
    consultants: {},
    rawText: normalized,
    confidence: 0,
  };

  const lines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Address
  const addrMatch = normalized.match(ADDRESS_RE);
  if (addrMatch) {
    const [, street, city, state, zip] = addrMatch;
    result.street = street.trim();
    result.city = city.trim();
    result.state = state.toUpperCase();
    result.zip = zip.trim();
    result.address = `${result.street}, ${result.city}, ${result.state} ${result.zip}`;
  }

  // Consultants (inline "LABEL: Firm" or label-then-next-line block)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { key, label } of CONSULTANT_LABELS) {
      if (result.consultants[key]) continue;

      const inline = line.match(new RegExp(`(?:^|\\s)${label.source}\\s*[:\\-]\\s*(.{3,80})$`, 'i'));
      if (inline && inline[1]) {
        result.consultants[key] = inline[1].trim();
        continue;
      }

      if (label.test(line) && !/\d{4,}/.test(line) && line.length < 50) {
        // Look ahead up to 3 lines for the firm name (some layouts put the
        // label on its own line and the firm name after an address line)
        for (let j = 1; j <= 3 && i + j < lines.length; j++) {
          const next = lines[i + j];
          if (!next || next.length < 3 || next.length > 100) continue;
          if (/^\d+(\.\d+)?\s*(sf|gsf|stories|floors|storys|level)\b/i.test(next)) continue;
          if (ADDRESS_RE.test(next)) continue;
          // Skip ONLY pure label lines ("STRUCTURAL ENGINEER:"), not firm names
          // that happen to contain a discipline word ("Ferro Structural").
          const isPureLabel = CONSULTANT_LABELS.some((c) => {
            if (!c.label.test(next)) return false;
            const remainder = next.replace(c.label, '').replace(/[:\-\s]/g, '');
            return remainder.length < 5;
          });
          if (isPureLabel) continue;
          // Skip lines that look like phones, emails, urls
          if (/^\S+@\S+\.\S+$/.test(next)) continue;
          if (/^\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/.test(next)) continue;
          if (/^https?:\/\//i.test(next)) continue;
          result.consultants[key] = next;
          break;
        }
      }
    }
  }

  // Building area
  const areaMatch = normalized.match(AREA_RE);
  if (areaMatch) {
    const n = Number(areaMatch[1].replace(/,/g, ''));
    if (n >= 500 && n <= 10_000_000) result.buildingAreaSqft = n;
  }

  // Stories
  const storiesMatch = normalized.match(STORIES_RE);
  if (storiesMatch) {
    const n = Number(storiesMatch[1]);
    if (n >= 1 && n <= 200) result.numFloors = n;
  }

  // Occupancy
  const occMatch = normalized.match(OCCUPANCY_RE);
  if (occMatch) result.occupancyClassification = occMatch[1].toUpperCase().replace(/\s+/g, '-');

  // Construction type
  const conMatch = normalized.match(CONSTRUCTION_RE);
  if (conMatch) {
    result.constructionType = conMatch[2]
      ? `${conMatch[1].toUpperCase()}-${conMatch[2].toUpperCase()}`
      : conMatch[1].toUpperCase();
  }

  // Code
  const codeMatch = normalized.match(CODE_RE);
  if (codeMatch) result.codeEdition = `${codeMatch[1]} ${codeMatch[2].toUpperCase()}`;

  // Project name — largest mostly-uppercase line near the top, not matching
  // a label or address
  const titleCandidates = lines.slice(0, 40).filter((l) => {
    if (l.length < 4 || l.length > 100) return false;
    if (/── PAGE \d+ ──/.test(l)) return false;
    if (CONSULTANT_LABELS.some((c) => c.label.test(l))) return false;
    if (ADDRESS_RE.test(l)) return false;
    if (/^(sheet|scale|date|drawn|checked|project\s+no\.|revision|phone|fax|email|www\.)/i.test(l)) return false;
    const letters = l.replace(/[^A-Za-z]/g, '');
    if (letters.length < 4) return false;
    const upper = letters.replace(/[^A-Z]/g, '').length;
    return upper / letters.length > 0.55;
  });
  if (titleCandidates.length > 0) {
    titleCandidates.sort((a, b) => b.length - a.length);
    result.projectName = titleCandidates[0];
  }

  // Confidence: number of fields we populated vs. possible
  const extractedFieldCount = [
    result.projectName,
    result.address,
    Object.keys(result.consultants).length > 0 ? true : undefined,
    result.buildingAreaSqft,
    result.numFloors,
    result.occupancyClassification,
    result.constructionType,
    result.codeEdition,
  ].filter(Boolean).length;
  result.confidence = Math.min(1, extractedFieldCount / 5);

  return result;
}

/**
 * Merge metadata from multiple cover/data pages. Later findings fill in gaps
 * but don't overwrite existing ones — the earlier sheet in a set usually has
 * the authoritative project name, while the later data sheet has code info.
 */
export function mergeCoverMetadata(a: CoverMetadata, b: CoverMetadata): CoverMetadata {
  return {
    projectName: a.projectName ?? b.projectName,
    address: a.address ?? b.address,
    street: a.street ?? b.street,
    city: a.city ?? b.city,
    state: a.state ?? b.state,
    zip: a.zip ?? b.zip,
    consultants: { ...b.consultants, ...a.consultants },
    buildingAreaSqft: a.buildingAreaSqft ?? b.buildingAreaSqft,
    numFloors: a.numFloors ?? b.numFloors,
    occupancyClassification: a.occupancyClassification ?? b.occupancyClassification,
    constructionType: a.constructionType ?? b.constructionType,
    codeEdition: a.codeEdition ?? b.codeEdition,
    rawText: `${a.rawText}\n\n${b.rawText}`,
    confidence: Math.max(a.confidence, b.confidence),
  };
}

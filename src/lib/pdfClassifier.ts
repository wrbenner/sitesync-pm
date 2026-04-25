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

export function classifyPdfByFilename(name: string): PdfRoute {
  const n = normalizeFilename(name);
  if (SPEC_PATTERNS.some((r) => r.test(n))) return 'spec';
  if (COVER_PATTERNS.some((r) => r.test(n))) return 'cover';
  return 'drawing';
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

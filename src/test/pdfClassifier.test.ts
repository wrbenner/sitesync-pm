import { describe, it, expect } from 'vitest';
import {
  classifyPdfByFilename,
  parseCoverMetadata,
  looksLikeCoverText,
  mergeCoverMetadata,
} from '../lib/pdfClassifier';

// Duplicates of the inline helpers inside src/pages/drawings/index.tsx.
// Keep in sync until these move to a shared util.
function extractRevisionFromFilename(name: string): string | null {
  const normalized = name.replace(/_+/g, ' ');
  const m = normalized.match(/\b(?:rev(?:ision)?|r)[\s-]?(\d{1,3}(?:\.\d{1,2})?)\b/i);
  if (!m) return null;
  return m[1].replace(/^0+(?=\d)/, '');
}
function cleanFilenameTitle(name: string): string {
  let s = name
    .replace(/\.[^.]+$/, '')
    .replace(/^\d{2,4}[.\-_]\d{1,2}[.\-_]\d{1,2}[_\-\s]*/, '');
  s = s.replace(/_+/g, ' ');
  s = s
    .replace(/\brev(?:ision)?\s?\d{1,3}(?:\.\d{1,2})?\b/ig, '')
    .replace(/\bifc\b/ig, '')
    .replace(/\bfor\s+(?:construction|permit|bid|review)\b/ig, '')
    .replace(/\bstamped\b/ig, '')
    .replace(/\bupdated\b/ig, '')
    .replace(/\brtg\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

// Import the inferrer indirectly by duplicating the function logic for testing,
// since it lives inside the drawings page module. If it's exported later,
// switch to a direct import.
function inferDisciplineFromFilename(name: string): string | null {
  const normalized = name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[_\-/\\.]+/g, ' ')
    .replace(/\s+/g, ' ');
  const wordPatterns: Array<{ re: RegExp; discipline: string }> = [
    { re: /\b(covers?|title\s*sheet|cover\s*sheets?|project\s*data|code\s*(summary|analysis)|general\s*(notes|info))\b/, discipline: 'cover' },
    { re: /\b(hazmat|hazardous\s*materials?|asbestos|lead\s*paint|environmental|swppp|erosion\s*control)\b/, discipline: 'hazmat' },
    { re: /\b(demo(lition)?|existing\s*conditions)\b/, discipline: 'demolition' },
    { re: /\b(survey|topo(graphic)?|alta)\b/, discipline: 'survey' },
    { re: /\b(geotechnical|geotech|soils?\s*report)\b/, discipline: 'geotechnical' },
    { re: /\b(civil)\b/, discipline: 'civil' },
    { re: /\b(landscape)\b/, discipline: 'landscape' },
    { re: /\b(structural|struct)\b/, discipline: 'structural' },
    { re: /\b(architectural|architecture|arch)\b/, discipline: 'architectural' },
    { re: /\b(interior(\s+design)?)\b/, discipline: 'interior' },
    { re: /\b(id)\b/, discipline: 'interior' },
    { re: /\b(fire\s*protection|fire\s*alarm|fp)\b/, discipline: 'fire_protection' },
    { re: /\b(plumbing|plumb)\b/, discipline: 'plumbing' },
    { re: /\b(mechanical|mech|hvac)\b/, discipline: 'mechanical' },
    { re: /\b(electrical|elec)\b/, discipline: 'electrical' },
    { re: /\b(telecommunications?|telecom|low\s*voltage|lv|tele\b)\b/, discipline: 'telecommunications' },
  ];
  for (const { re, discipline } of wordPatterns) {
    if (re.test(normalized)) return discipline;
  }
  const prefixMap: Record<string, string> = {
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
    return prefixMap[prefix[0]] ?? null;
  }
  return null;
}

describe('inferDisciplineFromFilename — word match wins over prefix match', () => {
  it.each([
    // User's Merritt Crossing zip — discipline PDFs
    ['25.04.02_Merritt Crossing_Mechanical_IFC_stamped_Rev 05.pdf', 'mechanical'],
    ['25.04.02_Merritt Crossing_Electrical_IFC_stamped_Rev 05.pdf', 'electrical'],
    ['25.04.02_Merritt Crossing_Structural_IFC_stamped_Rev 05.pdf', 'structural'],
    ['25.06.02_Merritt Crossing_Arch_IFC_stamped_Rev 06.pdf', 'architectural'],
    ['25.06.02_Merritt Crossing_Landscape_IFC_stamped_Rev 06.pdf', 'landscape'],
    ['24.11.15_Merritt Crossing_Civil_IFC_stamped.pdf', 'civil'],
    ['24.11.15_Merritt Crossing_Plumbing_IFC_stamped.pdf', 'plumbing'],
    ['25.06.02_Merritt Crossing_ID_IFC_Rev 06.pdf', 'interior'],
    // Covers
    ['24.11.15_Merritt Crossing_Rear Cover_IFC_stamped.pdf', 'cover'],
    ['25.06.02_Merritt Crossing_Covers_IFC_stamped_Rev 06.pdf', 'cover'],
    ['G-001 Cover Sheet.pdf', 'cover'],
    ['Project Data.pdf', 'cover'],
    ['Code Summary.pdf', 'cover'],
    // New Tier 1 disciplines
    ['Merritt_Telecommunications_IFC.pdf', 'telecommunications'],
    ['LowVoltage Package.pdf', 'telecommunications'],
    ['T-101 Data Rack Layout.pdf', 'telecommunications'],
    ['ALTA Survey_2024.pdf', 'survey'],
    ['V-001 Topographic Survey.pdf', 'survey'],
    ['Merritt Crossing_Geotechnical Report.pdf', 'geotechnical'],
    ['B-001 Soils Report.pdf', 'geotechnical'],
    ['Demolition Plan.pdf', 'demolition'],
    ['Existing Conditions.pdf', 'demolition'],
    ['Asbestos Abatement Plan.pdf', 'hazmat'],
    ['SWPPP_Rev_02.pdf', 'hazmat'],
    ['H-001 Hazmat Notes.pdf', 'hazmat'],
    // Fire alarm via word and prefix
    ['Fire Alarm Riser.pdf', 'fire_protection'],
    ['FA-01.pdf', 'fire_protection'],
    // HVAC alias for mechanical
    ['HVAC Schedule.pdf', 'mechanical'],
    // Traditional sheet-number fallbacks
    ['A-101 First Floor Plan.pdf', 'architectural'],
    ['M-201.pdf', 'mechanical'],
    ['P-101.pdf', 'plumbing'],
    ['PF-01.pdf', 'plumbing'],
    ['S-100.pdf', 'structural'],
    ['E-301.pdf', 'electrical'],
    ['LV-01.pdf', 'telecommunications'],
    // Industry-standard two-letter prefixes
    ['CS-001.pdf', 'cover'],
    ['CS101.pdf', 'cover'],
    ['ID-201.pdf', 'interior'],
    // No signal
    ['Random.pdf', null],
    ['12345.pdf', null],
  ])('%s → %s', (filename, expected) => {
    expect(inferDisciplineFromFilename(filename)).toBe(expected);
  });
});

// These are the actual filenames from the user's Merritt Crossing upload.
// If any of them regress, the drawing/spec/cover routing is broken.
describe('classifyPdfByFilename — real construction-set filenames', () => {
  it.each([
    // Drawings (discipline PDFs)
    ['25.06.02_Merritt Crossing_ID_IFC_Rev 06.pdf', 'drawing'],
    ['24.11.15_Merritt Crossing_Civil_IFC_stamped.pdf', 'drawing'],
    ['24.11.15_Merritt Crossing_Plumbing_IFC_stamped.pdf', 'drawing'],
    ['25.06.02_Merritt Crossing_Arch_IFC_stamped_Rev 06.pdf', 'drawing'],
    ['25.06.02_Merritt Crossing_Landscape_IFC_stamped_Rev 06.pdf', 'drawing'],
    ['25.04.02_Merritt Crossing_Electrical_IFC_stamped_Rev 05.pdf', 'drawing'],
    ['25.04.02_Merritt Crossing_Mechanical_IFC_stamped_Rev 05.pdf', 'drawing'],
    ['25.04.02_Merritt Crossing_Structural_IFC_stamped_Rev 05.pdf', 'drawing'],
    // Spec books
    ['24.11.15_RTG_Merritt Crossing_Spec Book_IFC.pdf', 'spec'],
    ['2024.08.08_RTG_Merritt Crossing_Spec Book_Updated.pdf', 'spec'],
    // Covers
    ['24.11.15_Merritt Crossing_Rear Cover_IFC_stamped.pdf', 'cover'],
    ['25.06.02_Merritt Crossing_Covers_IFC_stamped_Rev 06.pdf', 'cover'],
    // General / project-data sheets
    ['G-001 Cover Sheet.pdf', 'cover'],
    ['G001_Project_Data.pdf', 'cover'],
    ['Project Data.pdf', 'cover'],
    ['Code Summary.pdf', 'cover'],
    ['T-001.pdf', 'cover'],
    // Non-matches
    ['A-101 First Floor Plan.pdf', 'drawing'],
    ['S-201.pdf', 'drawing'],
    ['Random.pdf', 'drawing'],
  ])('%s → %s', (filename, expectedRoute) => {
    expect(classifyPdfByFilename(filename)).toBe(expectedRoute);
  });
});

describe('parseCoverMetadata', () => {
  const sample = `
MERRITT CROSSING

123 Main Street, Oakland, CA 94607

PROJECT DATA
Building Area: 85,000 SF
5 stories above grade
Occupancy: R-2
Type V-A Construction
2021 IBC

ARCHITECT:
Acme Architects
123 Design Lane

STRUCTURAL ENGINEER:
Ferro Structural

MECHANICAL ENGINEER:
ABC MEP Group

OWNER:
BRIDGE Housing
`;

  it('extracts address, areas, codes, consultants, occupancy', () => {
    const m = parseCoverMetadata(sample);
    expect(m.address).toBe('123 Main Street, Oakland, CA 94607');
    expect(m.street).toBe('123 Main Street');
    expect(m.city).toBe('Oakland');
    expect(m.state).toBe('CA');
    expect(m.zip).toBe('94607');
    expect(m.buildingAreaSqft).toBe(85_000);
    expect(m.numFloors).toBe(5);
    expect(m.occupancyClassification).toBe('R-2');
    expect(m.constructionType).toBe('V-A');
    expect(m.codeEdition).toBe('2021 IBC');
    expect(m.consultants.architect).toBe('Acme Architects');
    expect(m.consultants.structural_engineer).toBe('Ferro Structural');
    expect(m.consultants.mechanical_engineer).toBe('ABC MEP Group');
    expect(m.consultants.owner).toBe('BRIDGE Housing');
    expect(m.confidence).toBeGreaterThan(0.6);
  });

  it('tolerates missing fields', () => {
    const m = parseCoverMetadata('Just some random text with no structure.');
    expect(m.address).toBeUndefined();
    expect(m.consultants).toEqual({});
    expect(m.confidence).toBe(0);
  });
});

describe('looksLikeCoverText', () => {
  it('detects cover-like pages by signal count', () => {
    expect(
      looksLikeCoverText('ARCHITECT: Acme\nOWNER: Bridge Housing\n123 Main St, Oakland, CA 94607'),
    ).toBe(true);
    expect(looksLikeCoverText('Random floor plan notes')).toBe(false);
  });
});

describe('extractRevisionFromFilename', () => {
  it.each([
    ['25.04.02_Merritt Crossing_Electrical_IFC_stamped_Rev 05.pdf', '5'],
    ['25.06.02_Merritt Crossing_Arch_IFC_stamped_Rev 06.pdf', '6'],
    ['Plan_R12.pdf', '12'],
    ['Drawing_Revision 1.0.pdf', '1.0'],
    ['Set_Rev_03.pdf', '3'],
    ['No revision here.pdf', null],
    ['A-101.pdf', null],
  ])('%s → %s', (name, expected) => {
    expect(extractRevisionFromFilename(name)).toBe(expected);
  });
});

describe('cleanFilenameTitle', () => {
  it.each([
    ['25.04.02_Merritt Crossing_Mechanical_IFC_stamped_Rev 05.pdf', 'Merritt Crossing Mechanical'],
    ['24.11.15_RTG_Merritt Crossing_Spec Book_IFC.pdf', 'Merritt Crossing Spec Book'],
    ['2024.08.08_RTG_Merritt Crossing_Spec Book_Updated.pdf', 'Merritt Crossing Spec Book'],
    ['A-101.pdf', 'A-101'],
    ['First Floor Plan.pdf', 'First Floor Plan'],
  ])('%s → %s', (name, expected) => {
    expect(cleanFilenameTitle(name)).toBe(expected);
  });
});

describe('mergeCoverMetadata', () => {
  it('prefers earlier finding for scalars, merges consultants', () => {
    const a = parseCoverMetadata('MERRITT CROSSING\n123 Main St, Oakland, CA 94607\nARCHITECT: A1');
    const b = parseCoverMetadata('OTHER PROJECT\n456 Other St, Other, CA 90000\nSTRUCTURAL: S1\n2021 IBC');
    const merged = mergeCoverMetadata(a, b);
    expect(merged.address).toContain('Oakland');
    expect(merged.consultants.architect).toBe('A1');
    expect(merged.consultants.structural_engineer).toBe('S1');
    expect(merged.codeEdition).toBe('2021 IBC');
  });
});

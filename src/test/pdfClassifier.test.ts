import { describe, it, expect } from 'vitest';
import {
  classifyPdfByFilename,
  inferDisciplineFromFilename,
  extractRevisionFromFilename,
  extractRevisionFromText,
  extractScaleText,
  parseCoverMetadata,
  looksLikeCoverText,
  mergeCoverMetadata,
} from '../lib/pdfClassifier';

// cleanFilenameTitle still lives in src/pages/drawings/index.tsx and isn't
// exported. If it ever moves to a shared util, swap to a direct import.
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

// Procore Current set — numbered, space-separated filenames where the
// discipline is the only signal. If any of these regress, every Procore-
// style export will land in the wrong bucket.
describe('inferDisciplineFromFilename — Procore Current set (26-0421)', () => {
  it.each([
    ['01 Civil.pdf', 'civil'],
    ['02 Landscape.pdf', 'landscape'],
    ['03 Architecture.pdf', 'architectural'],
    ['04 Interior Design.pdf', 'interior'],
    ['05 Structure.pdf', 'structural'],
    ['06 Mechanical.pdf', 'mechanical'],
    ['07 Electrical.pdf', 'electrical'],
    ['08 Fire Alarm.pdf', 'fire_protection'],
    ['09 Fire Protection.pdf', 'fire_protection'],
    ['09 Plumbing.pdf', 'plumbing'],
    ['11 Food Service.pdf', 'food_service'],
    ['12 Laundry.pdf', 'laundry'],
    ['13 Vertical Transportation.pdf', 'vertical_transportation'],
    ['14 Technology.pdf', 'telecommunications'],
  ])('%s → %s', (filename, expected) => {
    expect(inferDisciplineFromFilename(filename)).toBe(expected);
  });
});

describe('classifyPdfByFilename — Procore Current spec routing', () => {
  it('routes CSI 6-digit filenames as spec', () => {
    expect(classifyPdfByFilename('017900-Demonstration-and-Training_Rev_2.pdf')).toBe('spec');
    expect(classifyPdfByFilename('033000-Cast-in-Place-Concrete_Rev_3.pdf')).toBe('spec');
    expect(classifyPdfByFilename('260100-Electrical-General-Provisions_Rev_2.pdf')).toBe('spec');
  });

  it('routes anything inside /Specifications/ as spec, regardless of filename', () => {
    expect(
      classifyPdfByFilename(
        'Random.pdf',
        '26-0421 Procore Current/Specifications/03-Concrete/Random.pdf',
      ),
    ).toBe('spec');
    // Even a name that would normally route as 'cover' becomes 'spec' when
    // it's in the Specifications/ folder — that's the user's filing intent.
    expect(
      classifyPdfByFilename(
        '003100-Available-Project-Information_Rev_2.pdf',
        '26-0421 Procore Current/Specifications/00-Procurement-and-Contracting-Requirements/003100-Available-Project-Information_Rev_2.pdf',
      ),
    ).toBe('spec');
  });

  it('drawings outside /Specifications/ stay as drawing', () => {
    expect(
      classifyPdfByFilename('06 Mechanical.pdf', '26-0421 Procore Current/06 Mechanical.pdf'),
    ).toBe('drawing');
  });
});

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

describe('extractRevisionFromText', () => {
  it.each([
    ['Title block notes\nREV: 5\nMore', '5'],
    ['REVISION 1.0', '1.0'],
    ['Issue: B', 'B'],
    ['Rev. 03', '3'],
    ['No revision marker here', null],
    // Real-world false positives from the Procore Current set:
    //  • REV→"IEW" inside "REVIEW"
    //  • REVISIONS→"NO" inside "REVISIONS  NO.  DATE  DESCRIPTION" (column header)
    //  • NEX matched as a 3-letter capture from "NEXUS"
    //  • PT, BTU as 2-3 letter captures
    ['NOT FOR REVIEW', null],
    ['ISSUED FOR REVIEW', null],
    ['REVISIONS  NO.   DATE   DESCRIPTION', null],
    ['REVISIONS\n(no entries)', null],
    ['NEXUS DEVELOPMENT', null],
    ['Revision PT', null],
    ['Issue BTU rating', null],
  ])('%s → %s', (text, expected) => {
    expect(extractRevisionFromText(text)).toBe(expected);
  });
});

describe('extractScaleText', () => {
  it.each([
    ['Architect: Acme\nSCALE: 1/4" = 1\'-0"\n', '1/4" = 1\'-0"', 48],
    ['scale 1/8" = 1\'-0"', '1/8" = 1\'-0"', 96],
    ['SCALE: 1" = 20\'', '1" = 20\'', 240],
    ['scale 1:100', '1:100', 100],
    ['NTS', 'NTS', null],
    ['NOT TO SCALE', 'NOT TO SCALE', null],
    ['SCALE: AS NOTED', 'AS NOTED', null],
    ['No scale marker.', null, null],
  ])('%s → text="%s" ratio=%s', (input, expectedText, expectedRatio) => {
    const got = extractScaleText(input);
    if (expectedText === null) {
      expect(got).toBeNull();
    } else {
      expect(got).not.toBeNull();
      expect(got!.text.toLowerCase()).toContain(expectedText.toLowerCase());
      expect(got!.ratio).toBe(expectedRatio);
    }
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

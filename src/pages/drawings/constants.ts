// ─── Shared Drawing Constants ───────────────────────────────────────────────
// Single source of truth — no more duplicating these in 4+ files.

export const DISCIPLINE_COLORS: Record<string, string> = {
  cover: '#8B5CF6',                // violet
  hazmat: '#CA8A04',               // hazard yellow
  demolition: '#78350F',           // dark rust
  survey: '#78716C',               // stone
  geotechnical: '#92400E',         // amber-brown (earth)
  civil: '#10B981',                // emerald
  landscape: '#166534',            // dark green
  structural: '#E74C3C',           // red
  architectural: '#3B82F6',        // blue
  interior: '#DB2777',             // pink
  fire_protection: '#E05252',      // coral red
  plumbing: '#4EC896',             // green
  mechanical: '#F47820',           // orange
  electrical: '#F5A623',           // amber
  telecommunications: '#06B6D4',   // cyan
  food_service: '#A855F7',         // purple (kitchen / FF&E)
  laundry: '#0EA5E9',              // sky
  vertical_transportation: '#475569', // slate (elevators / conveyance)
  unclassified: '#6B7280',         // gray
};

export const DISCIPLINE_LABELS: Record<string, string> = {
  cover: 'Cover / General',
  hazmat: 'Hazmat / Environmental',
  demolition: 'Demolition',
  survey: 'Survey',
  geotechnical: 'Geotechnical',
  civil: 'Civil',
  landscape: 'Landscape',
  structural: 'Structural',
  architectural: 'Architectural',
  interior: 'Interior',
  fire_protection: 'Fire Protection',
  plumbing: 'Plumbing',
  mechanical: 'Mechanical',
  electrical: 'Electrical',
  telecommunications: 'Telecommunications',
  food_service: 'Food Service',
  laundry: 'Laundry',
  vertical_transportation: 'Vertical Transportation',
  unclassified: 'Unclassified',
};

export const DISCIPLINE_ABBREV: Record<string, string> = {
  cover: 'CS',          // Cover Sheet — industry convention (AIA also uses G)
  hazmat: 'H',
  demolition: 'DM',
  survey: 'V',
  geotechnical: 'GT',
  civil: 'C',
  landscape: 'L',
  structural: 'S',
  architectural: 'A',
  interior: 'ID',       // Interior Design — industry convention (AIA also uses I)
  fire_protection: 'FP',
  plumbing: 'P',
  mechanical: 'M',
  electrical: 'E',
  telecommunications: 'T',
  food_service: 'FS',
  laundry: 'LD',
  vertical_transportation: 'VT',
  unclassified: '?',
};

export type DrawingStatus = 'for_review' | 'approved' | 'published' | 'superseded' | 'archived' | 'current' | 'draft';

export const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  for_review: { bg: '#FEF3C7', color: '#92400E', label: 'For Review' },
  approved: { bg: '#D1FAE5', color: '#065F46', label: 'Approved' },
  published: { bg: '#DBEAFE', color: '#1E40AF', label: 'Published' },
  superseded: { bg: '#F3F4F6', color: '#374151', label: 'Superseded' },
  archived: { bg: '#F3F4F6', color: '#374151', label: 'Archived' },
  current: { bg: '#D1FAE5', color: '#065F46', label: 'Current' },
  draft: { bg: '#EDE9FE', color: '#5B21B6', label: 'Draft' },
};

/** Group drawings by discipline, sorted by discipline then sheet number */
export function groupByDiscipline<T extends { discipline?: string; setNumber?: string }>(
  drawings: T[],
): Array<{ discipline: string; label: string; abbrev: string; color: string; drawings: T[] }> {
  const groups = new Map<string, T[]>();
  for (const d of drawings) {
    const disc = d.discipline || 'unclassified';
    if (!groups.has(disc)) groups.set(disc, []);
    groups.get(disc)!.push(d);
  }

  // Sort order follows AIA CAD Standard discipline order: pre-construction
  // deliverables first (survey → geo → civil → landscape), then building
  // disciplines (structural → arch → interior), then systems (FP → P → M → E → T).
  // 'cover' sheets group first so the title/general info is always at the top.
  const ORDER = [
    'cover',
    'hazmat',
    'demolition',
    'survey',
    'geotechnical',
    'civil',
    'landscape',
    'structural',
    'architectural',
    'interior',
    'fire_protection',
    'plumbing',
    'mechanical',
    'electrical',
    'telecommunications',
    'food_service',
    'laundry',
    'vertical_transportation',
    'unclassified',
  ];

  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      const ai = ORDER.indexOf(a);
      const bi = ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    })
    .map(([disc, items]) => ({
      discipline: disc,
      label: DISCIPLINE_LABELS[disc] || disc.replace(/_/g, ' '),
      abbrev: DISCIPLINE_ABBREV[disc] || '?',
      color: DISCIPLINE_COLORS[disc] || DISCIPLINE_COLORS.unclassified,
      drawings: items.sort((a, b) => (a.setNumber || '').localeCompare(b.setNumber || '')),
    }));
}

// Shared types for the drawings domain

export interface DrawingItem {
  id: number;
  title: string;
  setNumber: string;
  discipline: string;
  disciplineColor?: string;
  revision: string;
  date: string;
  status?: string;
  sheetCount?: number;
  currentRevision?: { revision_number: number; issued_date: string | null; issued_by?: string };
  revisions: import('../../types/api').DrawingRevision[];
}

export const aiChanges: Record<number, number> = { 1: 3, 5: 2, 11: 4 };

export const linkedItems: Record<number, { rfis: number; submittals: number }> = {
  1: { rfis: 1, submittals: 0 },
  3: { rfis: 1, submittals: 1 },
  4: { rfis: 1, submittals: 1 },
  5: { rfis: 1, submittals: 0 },
  11: { rfis: 2, submittals: 1 },
};

export const lastViewed: Record<number, string> = {
  1: '2h ago',
  2: '1d ago',
  3: '5h ago',
  4: '3d ago',
  5: '1h ago',
  6: '2d ago',
  7: 'Never',
  8: 'Never',
  9: '4d ago',
  10: 'Never',
  11: '30m ago',
  12: '1d ago',
};

export const gridColumns = '60px 80px 1fr 120px 80px 100px 80px 70px 120px 100px 70px 90px';

export const coordinationConflicts = [
  { id: 'c1', drawing1: 'A-201', rev1: 'Rev 3', drawing2: 'S-101', location: 'Grid Line C4', discipline1: 'Architectural', discipline2: 'Structural', confidence: 0.94 },
  { id: 'c2', drawing1: 'M-301', rev1: 'Rev 2', drawing2: 'S-204', location: 'Level 3 ceiling plenum', discipline1: 'Mechanical', discipline2: 'Structural', confidence: 0.88 },
  { id: 'c3', drawing1: 'E-101', rev1: 'Rev 1', drawing2: 'P-201', location: 'Mechanical room west wall', discipline1: 'Electrical', discipline2: 'Plumbing', confidence: 0.76 },
  { id: 'c4', drawing1: 'FP-101', rev1: 'Rev 2', drawing2: 'A-301', location: 'Stairwell 3 soffit', discipline1: 'Fire Protection', discipline2: 'Architectural', confidence: 0.71 },
  { id: 'c5', drawing1: 'M-401', rev1: 'Rev 1', drawing2: 'E-202', location: 'Roof drain area B7', discipline1: 'Mechanical', discipline2: 'Electrical', confidence: 0.68 },
];

export function formatRevDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export function parseAiConflicts(text: string): Array<{ severity: 'high' | 'medium' | 'low'; description: string; sheets: string[] }> {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.conflicts && Array.isArray(parsed.conflicts)) return parsed.conflicts;
  } catch { /* not JSON */ }
  const lines = text.split(/\n+/).map((l) => l.replace(/^[-•*\d.]\s*/, '').trim()).filter((l) => l.length > 10);
  const severities: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'medium', 'low', 'low', 'low'];
  return lines.slice(0, 6).map((line, i) => ({
    severity: severities[Math.min(i, severities.length - 1)],
    description: line,
    sheets: [],
  }));
}

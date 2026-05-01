// Shared types and utilities for the drawings domain

export interface DrawingItem {
  id: string;
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
  /** Supabase storage path for the drawing file (image or PDF) */
  file_url?: string;
  /** Tile generation status: pending | processing | ready | failed */
  tile_status?: 'pending' | 'processing' | 'ready' | 'failed';
  /** Number of DZI tile levels when tile_status === 'ready' */
  tile_levels?: number;
  /** Tile format (jpeg, png) */
  tile_format?: string;
  /** Persisted real-inches-per-pixel calibration. Wins over scale_text. */
  scale_ratio?: number | null;
  /** Persisted human-readable scale (e.g. "1/4\" = 1'-0\""). */
  scale_text?: string | null;
}

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

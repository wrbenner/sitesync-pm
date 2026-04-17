import { colors } from '../../styles/theme';

export const CONSTRUCTION_TAGS = ['progress', 'safety', 'quality', 'defect', 'delivery'] as const;

export const LINK_OPTIONS = [
  { label: 'RFI #12 — Beam pocket depth', value: 'rfi:12' },
  { label: 'RFI #14 — Slab thickness', value: 'rfi:14' },
  { label: 'Punch Item #45 — Paint defect', value: 'punch:45' },
  { label: 'Punch Item #52 — Door hardware', value: 'punch:52' },
  { label: 'Daily Log — Today', value: 'daily_log:today' },
];

export const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  progress: { bg: colors.statusInfoSubtle,     text: colors.statusInfo },
  safety:   { bg: colors.statusCriticalSubtle, text: colors.statusCritical },
  quality:  { bg: colors.statusActiveSubtle,   text: colors.statusActive },
  defect:   { bg: colors.statusPendingSubtle,  text: colors.statusPending },
  delivery: { bg: colors.statusReviewSubtle,   text: colors.statusReview },
};

// ── IndexedDB helpers for offline capture queue ─────────────

const IDB_DB_NAME = 'sitesync_field';
const IDB_STORE   = 'pending_captures';

export function openCaptureDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveToIDB(capture: Record<string, unknown>): Promise<void> {
  const db = await openCaptureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(capture);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

export interface OverlayMeta {
  title: string;
  notes: string;
  tags: string[];
  linkTo: string;
  location: string | null;
}

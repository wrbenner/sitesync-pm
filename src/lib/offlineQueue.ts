/**
 * offlineQueue — IndexedDB-backed queue for offline annotation persistence.
 *
 * When the device is offline, annotations are queued in IndexedDB. When
 * connectivity returns, the queue is drained and synced to Supabase.
 *
 * Uses the raw IndexedDB API (no Dexie.js dependency) to keep the bundle light.
 * The queue is FIFO — annotations are synced in the order they were created.
 */

const DB_NAME = 'sitesync-offline';
const DB_VERSION = 1;
const STORE_ANNOTATIONS = 'pending-annotations';
const STORE_TILE_BOOKMARKS = 'tile-bookmarks';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PendingAnnotation {
  /** Auto-incremented by IndexedDB */
  id?: number;
  /** UUID of the drawing */
  drawing_id: string;
  /** UUID of the project */
  project_id: string;
  /** Page number within the drawing */
  page_number: number;
  /** Annotation type identifier */
  annotation_type: string;
  /** Geometry type (rect, line, path, cloud, etc.) */
  geometry_type: string;
  /** Normalized coordinates (the serializable geometry) */
  normalized_coords: unknown;
  /** Stroke/fill color */
  color: string;
  /** Text content (for text annotations) */
  content?: string | null;
  /** Annotation layer */
  layer: string;
  /** Visibility scope */
  visibility: string;
  /** Timestamp when created offline */
  created_at: string;
}

export interface TileBookmark {
  /** Drawing UUID */
  drawing_id: string;
  /** Number of tiles cached for this drawing */
  tile_count: number;
  /** When the tiles were last cached */
  cached_at: string;
  /** Drawing title for display */
  title: string;
  /** Drawing set number */
  set_number: string;
}

// ── Database ───────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ANNOTATIONS)) {
        const store = db.createObjectStore(STORE_ANNOTATIONS, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('drawing_id', 'drawing_id', { unique: false });
        store.createIndex('project_id', 'project_id', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_TILE_BOOKMARKS)) {
        db.createObjectStore(STORE_TILE_BOOKMARKS, { keyPath: 'drawing_id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Annotation Queue ───────────────────────────────────────────────────────

/** Enqueue an annotation for later sync. */
export async function enqueueAnnotation(ann: PendingAnnotation): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ANNOTATIONS, 'readwrite');
    tx.objectStore(STORE_ANNOTATIONS).add({
      ...ann,
      created_at: ann.created_at || new Date().toISOString(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Get all pending annotations, ordered by creation time. */
export async function getPendingAnnotations(): Promise<PendingAnnotation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ANNOTATIONS, 'readonly');
    const req = tx.objectStore(STORE_ANNOTATIONS).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Remove a specific annotation from the queue after successful sync. */
export async function removeAnnotation(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ANNOTATIONS, 'readwrite');
    tx.objectStore(STORE_ANNOTATIONS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Count pending annotations. */
export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ANNOTATIONS, 'readonly');
    const req = tx.objectStore(STORE_ANNOTATIONS).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Clear all pending annotations (e.g. after a full sync). */
export async function clearPendingAnnotations(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ANNOTATIONS, 'readwrite');
    tx.objectStore(STORE_ANNOTATIONS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Tile Bookmarks ─────────────────────────────────────────────────────────

/** Record that tiles for a drawing have been cached for offline use. */
export async function bookmarkTiles(bookmark: TileBookmark): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TILE_BOOKMARKS, 'readwrite');
    tx.objectStore(STORE_TILE_BOOKMARKS).put(bookmark);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Get all tile bookmarks (drawings available offline). */
export async function getTileBookmarks(): Promise<TileBookmark[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TILE_BOOKMARKS, 'readonly');
    const req = tx.objectStore(STORE_TILE_BOOKMARKS).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Remove a tile bookmark. */
export async function removeTileBookmark(drawingId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TILE_BOOKMARKS, 'readwrite');
    tx.objectStore(STORE_TILE_BOOKMARKS).delete(drawingId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Sync Engine ────────────────────────────────────────────────────────────

/**
 * Drain the offline queue: attempt to sync each pending annotation to Supabase.
 * Successfully synced items are removed from the queue.
 * Failed items remain for the next sync attempt.
 *
 * @param syncFn — The function that pushes an annotation to Supabase.
 *                 It should throw on failure.
 * @returns The number of successfully synced annotations.
 */
export async function drainAnnotationQueue(
  syncFn: (ann: PendingAnnotation) => Promise<void>,
): Promise<number> {
  const pending = await getPendingAnnotations();
  let synced = 0;

  for (const ann of pending) {
    try {
      await syncFn(ann);
      if (ann.id !== undefined) {
        await removeAnnotation(ann.id);
      }
      synced++;
    } catch (err) {
      // Stop on first failure — remaining items will be retried next time
      console.warn('[offlineQueue] Sync failed, will retry:', err);
      break;
    }
  }

  return synced;
}

// ── Online/Offline Detection Hook Helper ───────────────────────────────────

/** Register a callback for online/offline transitions. Returns an unsubscribe function. */
export function onConnectivityChange(
  callback: (isOnline: boolean) => void,
): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

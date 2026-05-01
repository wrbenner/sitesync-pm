// useFieldCapture — getUserMedia camera + navigator.geolocation GPS + an
// IndexedDB offline queue for photo captures that can't upload right now.
//
// Modeled on src/lib/offlineQueue.ts. Uses its own IDB store because the
// annotation queue there has a fixed schema; photos carry a Blob payload
// so they live in a separate store in the same DB.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

// ── IndexedDB queue for pending photo captures ─────────────────────────────
// Lives in a separate DB from src/lib/offlineQueue.ts to avoid the IDB
// version-collision that would happen if one module opened at v1 and the
// other at v2 on the same DB name.

const DB_NAME = 'sitesync-field-capture';
const DB_VERSION = 1;
const STORE_CAPTURES = 'pending-field-captures';

export interface PendingFieldCapture {
  id?: number;
  projectId: string;
  dailyLogId: string;
  caption: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: string;
  filename: string;
  blob: Blob;
}

function openCaptureDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CAPTURES)) {
        db.createObjectStore(STORE_CAPTURES, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueCapture(entry: Omit<PendingFieldCapture, 'id'>): Promise<void> {
  const db = await openCaptureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CAPTURES, 'readwrite');
    tx.objectStore(STORE_CAPTURES).add(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function listCaptures(): Promise<PendingFieldCapture[]> {
  const db = await openCaptureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CAPTURES, 'readonly');
    const req = tx.objectStore(STORE_CAPTURES).getAll();
    req.onsuccess = () => resolve(req.result as PendingFieldCapture[]);
    req.onerror = () => reject(req.error);
  });
}

async function removeCapture(id: number): Promise<void> {
  const db = await openCaptureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CAPTURES, 'readwrite');
    tx.objectStore(STORE_CAPTURES).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function countCaptures(): Promise<number> {
  const db = await openCaptureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CAPTURES, 'readonly');
    const req = tx.objectStore(STORE_CAPTURES).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Upload + attach helpers ────────────────────────────────────────────────

export interface CaptureMetadata {
  projectId: string;
  dailyLogId: string;
  caption: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: string;
  filename: string;
}

async function uploadAndAttach(blob: Blob, meta: CaptureMetadata): Promise<string> {
  const path = `${meta.projectId}/${meta.dailyLogId}/${Date.now()}-${meta.filename}`;
  const { error: upErr } = await supabase.storage.from('daily-log-photos').upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: false,
  });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from('daily-log-photos').getPublicUrl(path);
  const photoUrl = pub?.publicUrl;
  if (!photoUrl) throw new Error('Could not retrieve photo URL');

  const photoEntry = {
    id: crypto.randomUUID(),
    url: photoUrl,
    caption: meta.caption,
    category: 'progress' as const,
    timestamp: meta.timestamp,
    latitude: meta.latitude,
    longitude: meta.longitude,
    accuracy: meta.accuracy,
  };

  const { error: insertErr } = await supabase.from('daily_log_entries').insert({
    daily_log_id: meta.dailyLogId,
    type: 'photo',
    description: meta.caption || meta.filename,
    photos: [photoEntry],
  });
  if (insertErr) throw insertErr;

  return photoUrl;
}

// ── The hook ───────────────────────────────────────────────────────────────

export interface FieldCaptureState {
  stream: MediaStream | null;
  gps: { latitude: number; longitude: number; accuracy: number | null } | null;
  gpsError: string | null;
  cameraError: string | null;
  starting: boolean;
  uploading: boolean;
  pendingCount: number;
  isOnline: boolean;
}

export interface UseFieldCapture extends FieldCaptureState {
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  capturePhoto: () => Promise<Blob | null>;
  commitCapture: (blob: Blob, caption: string, meta: Omit<CaptureMetadata, 'caption' | 'timestamp' | 'filename' | 'projectId' | 'dailyLogId' | 'latitude' | 'longitude' | 'accuracy'> & { projectId: string; dailyLogId: string }) => Promise<{ queued: boolean; url?: string }>;
  flushQueue: () => Promise<{ synced: number; remaining: number }>;
}

function getIsOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function useFieldCapture(): UseFieldCapture {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [gps, setGps] = useState<FieldCaptureState['gps']>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState<boolean>(getIsOnline());

  // Maintain an up-to-date pending-count badge.
  const refreshPendingCount = useCallback(async () => {
    try {
      const n = await countCaptures();
      setPendingCount(n);
    } catch {
      // IDB unavailable — leave at last known value.
    }
  }, []);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  // Online/offline listeners.
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Kick off GPS as soon as the hook mounts — the modal opens faster if the
  // first location fix is already in flight before the user frames a photo.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('Geolocation not supported on this device');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        });
        setGpsError(null);
      },
      (err) => {
        setGpsError(err.message || 'Location unavailable');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const startCamera = useCallback(async () => {
    if (streamRef.current) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('This device or browser does not support camera capture. Use the Upload button to attach a photo from your library instead.');
      return;
    }
    setStarting(true);
    setCameraError(null);
    try {
      // Race getUserMedia against a 6s timeout. In some headless / locked-down
      // contexts the prompt never resolves, leaving the modal stuck on
      // "Starting camera…" indefinitely. A bounded timeout converts that
      // into a recoverable inline error.
      const cameraPromise = navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      const s = await Promise.race([
        cameraPromise,
        new Promise<MediaStream>((_, reject) =>
          setTimeout(() => reject(Object.assign(new Error('Camera did not respond. Tap "Try again" or use Upload to pick a photo from your library.'), { name: 'TimeoutError' })), 6000),
        ),
      ]);
      streamRef.current = s;
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => { /* autoplay can fail; <video> still shows frames */ });
      }
    } catch (err) {
      // Translate the raw DOMException name into actionable user copy.
      // The browser default ("Permission denied") leaves users staring at
      // a black box without knowing how to recover.
      const name = (err as { name?: string })?.name ?? '';
      let friendly: string;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        friendly = 'Camera access was blocked. Open your browser site settings and allow camera, then tap "Try again".';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        friendly = 'No camera was found on this device. Try a different device or upload a photo from your library.';
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        friendly = 'The camera is in use by another app. Close other apps using the camera and try again.';
      } else if (name === 'OverconstrainedError') {
        friendly = 'The requested camera resolution is not available. Try again — we will pick a fallback resolution.';
      } else if (name === 'SecurityError') {
        friendly = 'The camera can only run on a secure connection (HTTPS). Open SiteSync from its secure URL.';
      } else if (name === 'TimeoutError') {
        friendly = err instanceof Error ? err.message : 'Camera did not respond. Try again or use Upload.';
      } else {
        friendly = err instanceof Error ? err.message : 'Camera unavailable';
      }
      setCameraError(friendly);
    } finally {
      setStarting(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      for (const track of s.getTracks()) track.stop();
      streamRef.current = null;
      setStream(null);
      if (videoRef.current) videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      const s = streamRef.current;
      if (s) for (const track of s.getTracks()) track.stop();
    };
  }, []);

  const capturePhoto = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w === 0 || h === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
    });
  }, []);

  const commitCapture = useCallback<UseFieldCapture['commitCapture']>(async (blob, caption, baseMeta) => {
    setUploading(true);
    try {
      const meta: CaptureMetadata = {
        projectId: baseMeta.projectId,
        dailyLogId: baseMeta.dailyLogId,
        caption,
        latitude: gps?.latitude ?? null,
        longitude: gps?.longitude ?? null,
        accuracy: gps?.accuracy ?? null,
        timestamp: new Date().toISOString(),
        filename: `field-${Date.now()}.jpg`,
      };

      if (!navigator.onLine) {
        await enqueueCapture({ ...meta, blob });
        await refreshPendingCount();
        return { queued: true };
      }

      try {
        const url = await uploadAndAttach(blob, meta);
        return { queued: false, url };
      } catch {
        // Network said we were online but the upload actually failed —
        // fall back to the queue so the user doesn't lose the capture.
        await enqueueCapture({ ...meta, blob });
        await refreshPendingCount();
        return { queued: true };
      }
    } finally {
      setUploading(false);
    }
  }, [gps, refreshPendingCount]);

  const flushQueue = useCallback<UseFieldCapture['flushQueue']>(async () => {
    const pending = await listCaptures();
    let synced = 0;
    for (const entry of pending) {
      try {
        await uploadAndAttach(entry.blob, {
          projectId: entry.projectId,
          dailyLogId: entry.dailyLogId,
          caption: entry.caption,
          latitude: entry.latitude,
          longitude: entry.longitude,
          accuracy: entry.accuracy,
          timestamp: entry.timestamp,
          filename: entry.filename,
        });
        if (entry.id !== undefined) await removeCapture(entry.id);
        synced++;
      } catch {
        // Keep remaining items queued for the next retry.
        break;
      }
    }
    const remaining = await countCaptures();
    setPendingCount(remaining);
    return { synced, remaining };
  }, []);

  return {
    stream,
    gps,
    gpsError,
    cameraError,
    starting,
    uploading,
    pendingCount,
    isOnline,
    videoRef,
    startCamera,
    stopCamera,
    capturePhoto,
    commitCapture,
    flushQueue,
  };
}

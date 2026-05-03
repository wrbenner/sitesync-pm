import React, { useState, useCallback, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { Upload, File as FileIcon, CheckCircle, Sparkles, Folder, Tag, AlertCircle, RefreshCw, FileArchive } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { aiService } from '../../lib/aiService';

let _uploadSeq = 0;

const DRAWING_EXT_RE = /\.(pdf|dwg|dxf|png|jpe?g|tiff?)$/i;
const isDrawingFile = (name: string) => DRAWING_EXT_RE.test(name);
const isZipFile = (f: File) => /\.zip$/i.test(f.name) || f.type === 'application/zip' || f.type === 'application/x-zip-compressed';

// Extract drawing files (PDF/DWG/DXF/images) from a zip into flat File objects.
// Recurses into nested .zip entries up to `maxDepth` levels — sheet sets
// commonly ship as a zip-of-zips (one per discipline).
// Skips macOS metadata (__MACOSX/, .DS_Store) and directory entries.
export interface ZipExtractionProgress {
  phase: 'loading' | 'extracting';
  /** Current entry index (1-based) during extracting phase */
  current: number;
  /** Total entries to process */
  total: number;
  /** Current file being extracted */
  currentFile?: string;
  /** Zip file name */
  zipName: string;
}

export async function extractDrawingFilesFromZip(
  zipFile: File,
  depth = 0,
  maxDepth = 3,
  onProgress?: (progress: ZipExtractionProgress) => void,
): Promise<{
  files: File[];
  skipped: Array<{ name: string; reason: string }>;
  totalCandidates: number;
}> {
  let zip: JSZip;
  try {
    if (depth === 0) {
      onProgress?.({ phase: 'loading', current: 0, total: 0, zipName: zipFile.name });
    }
    zip = await JSZip.loadAsync(zipFile);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[zip] loadAsync failed for', zipFile.name, err);
    throw new Error(`Could not open zip — ${detail || 'unknown error'}. The file may be corrupted, password-protected, or not a standard zip.`);
  }

  const files: File[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  let totalCandidates = 0;
  const allEntryNames: string[] = [];

  // Filter to actionable entries only
  const entries = Object.values(zip.files).filter((e) => {
    if (e.dir) return false;
    if (e.name.startsWith('__MACOSX/') || e.name.split('/').some((p) => p === '.DS_Store')) return false;
    return true;
  });
  const entryCount = entries.length;
  let processed = 0;

  for (const entry of entries) {
    allEntryNames.push(entry.name);
    processed++;

    const baseName = entry.name.split('/').pop() || entry.name;
    if (depth === 0) {
      onProgress?.({ phase: 'extracting', current: processed, total: entryCount, currentFile: baseName, zipName: zipFile.name });
    }

    // Nested zip — recurse.
    if (/\.zip$/i.test(entry.name) && depth < maxDepth) {
      try {
        const nestedBlob = await entry.async('blob');
        const nestedFile = new File([nestedBlob], baseName);
        const nested = await extractDrawingFilesFromZip(nestedFile, depth + 1, maxDepth, onProgress);
        files.push(...nested.files);
        skipped.push(...nested.skipped);
        totalCandidates += nested.totalCandidates;
      } catch (err) {
        console.warn('[zip] Nested zip failed', entry.name, err);
        skipped.push({ name: entry.name, reason: 'nested zip could not be read' });
      }
      continue;
    }

    if (!isDrawingFile(entry.name)) {
      skipped.push({ name: entry.name, reason: 'not a supported drawing/plan file' });
      continue;
    }
    totalCandidates++;
    try {
      const blob = await entry.async('blob');
      files.push(new File([blob], baseName, { type: blob.type || 'application/octet-stream' }));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.warn('[zip] Failed to read entry', entry.name, err);
      skipped.push({ name: entry.name, reason: detail });
    }
  }

  if (depth === 0) {
    if (files.length === 0) {
      console.warn(
        `[zip] "${zipFile.name}" — no drawings extracted. ${allEntryNames.length} direct entries:`,
        allEntryNames.slice(0, 50),
        allEntryNames.length > 50 ? `(+${allEntryNames.length - 50} more)` : '',
      );
      if (skipped.length > 0) {
        console.warn('[zip] Skipped sample:', skipped.slice(0, 10));
      }
    } else {
      if (import.meta.env.DEV) console.info(`[zip] "${zipFile.name}" — extracted ${files.length} files (skipped ${skipped.length}).`);
    }
  }

  return { files, skipped, totalCandidates };
}

/**
 * Cheap manifest peek — reads the zip central directory only (no blob
 * decompression) so the UI can show "N drawings inside" without loading
 * every PDF into memory. Recurses nested zips up to `maxDepth`.
 */
export async function peekZipManifest(
  zipFile: File,
  depth = 0,
  maxDepth = 3,
): Promise<{ drawingCount: number; totalEntries: number; names: string[] }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipFile);
  } catch {
    return { drawingCount: 0, totalEntries: 0, names: [] };
  }
  let drawingCount = 0;
  let totalEntries = 0;
  const names: string[] = [];
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    if (entry.name.startsWith('__MACOSX/') || entry.name.split('/').some((p) => p === '.DS_Store')) continue;
    totalEntries++;
    names.push(entry.name);
    if (/\.zip$/i.test(entry.name) && depth < maxDepth) {
      try {
        const nestedBlob = await entry.async('blob');
        const nested = await peekZipManifest(
          new File([nestedBlob], entry.name.split('/').pop() || entry.name),
          depth + 1,
          maxDepth,
        );
        drawingCount += nested.drawingCount;
      } catch {
        /* skip */
      }
      continue;
    }
    if (isDrawingFile(entry.name)) drawingCount++;
  }
  return { drawingCount, totalEntries, names };
}

interface UploadZoneProps {
  onUpload: (fileName: string) => void;
  onTagsSuggested?: (fileName: string, tags: string[]) => void;
  onFileReady?: (file: File) => void;
  onUploadsChange?: (uploads: UploadItem[]) => void;
}

export interface UploadItem {
  id: number;
  name: string;
  progress: number;
  status: 'uploading' | 'categorizing' | 'done';
  aiCategory?: string;
  aiTags?: string[];
  isFolder?: boolean;
  fileCount?: number;
}

const aiCategories = ['Structural Drawings', 'MEP Specifications', 'Safety Documentation', 'Budget Reports', 'Meeting Minutes', 'Shop Drawings'];

async function collectEntries(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry).file((f) => resolve([f]), () => resolve([]));
    });
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const collected: File[] = [];
    const readBatch = (): Promise<void> =>
      new Promise((resolve) => {
        reader.readEntries(async (entries) => {
          if (entries.length === 0) { resolve(); return; }
          for (const e of entries) {
            const files = await collectEntries(e);
            collected.push(...files);
          }
          const more = await readBatch().then(() => undefined).catch(() => undefined);
          void more;
          resolve();
        }, () => resolve());
      });
    await readBatch();
    return collected;
  }
  return [];
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onUpload, onTagsSuggested, onFileReady, onUploadsChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingFolder, setIsDraggingFolder] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadError, setUploadError] = useState<{ fileName: string; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Set non-standard webkitdirectory attribute via ref (widely supported but not in JSX types)
  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '');
  }, []);
  const retryFilesRef = useRef<File[]>([]);

  useEffect(() => {
    onUploadsChange?.(uploads);
  }, [uploads, onUploadsChange]);

  const simulateUpload = useCallback((name: string, opts?: { isFolder?: boolean; fileCount?: number }) => {
    const id = Date.now() + (++_uploadSeq);
    const item: UploadItem = {
      id,
      name,
      progress: 0,
      status: 'uploading',
      isFolder: opts?.isFolder,
      fileCount: opts?.fileCount,
    };
    setUploads((prev) => [...prev, item]);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setUploads((prev) => prev.map((u) => u.id === id ? { ...u, progress: 100, status: 'categorizing' } : u));
        setTimeout(async () => {
          const cat = aiCategories[id % aiCategories.length];
          const suggestedTags = await aiService.tagDocumentOnUpload(String(id), name, '');
          setUploads((prev) => prev.map((u) => u.id === id ? { ...u, status: 'done', aiCategory: cat, aiTags: suggestedTags } : u));
          onUpload(name);
          setUploadError(null);
          if (suggestedTags.length > 0) onTagsSuggested?.(name, suggestedTags);
        }, 800);
      } else {
        setUploads((prev) => prev.map((u) => u.id === id ? { ...u, progress } : u));
      }
    }, 150);
  }, [onUpload]);

  const processDataTransferItems = useCallback(async (items: DataTransferItemList) => {
    const entries: FileSystemEntry[] = [];
    const rawFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) entries.push(entry);
      const rawFile = items[i].getAsFile?.();
      if (rawFile) rawFiles.push(rawFile);
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.isDirectory) {
        const files = await collectEntries(entry);
        const drawingFiles = files.filter((f) => isDrawingFile(f.name));
        drawingFiles.forEach((f) => onFileReady?.(f));
        simulateUpload(entry.name + '/', { isFolder: true, fileCount: drawingFiles.length });
      } else {
        const raw = rawFiles[i];
        if (raw && isZipFile(raw)) {
          // Hand the zip through intact — the uploader streams it entry-by-entry
          // so we never hold all decompressed PDFs in memory at once.
          try {
            const { drawingCount, totalEntries } = await peekZipManifest(raw);
            if (totalEntries === 0 || drawingCount === 0) {
              setUploadError({
                fileName: raw.name,
                message: totalEntries === 0
                  ? 'Zip appears to be empty or unreadable.'
                  : 'No .pdf, .dwg, .dxf, or image files found in this zip.',
              });
              simulateUpload(raw.name, { isFolder: true, fileCount: 0 });
            } else {
              onFileReady?.(raw);
              simulateUpload(raw.name, { isFolder: true, fileCount: drawingCount });
            }
          } catch (err) {
            console.error('[UploadZone] zip peek failed:', err);
            setUploadError({ fileName: raw.name, message: err instanceof Error ? err.message : 'Could not read zip' });
          }
        } else {
          if (raw) onFileReady?.(raw);
          simulateUpload(entry.name);
        }
      }
    }
  }, [simulateUpload, onFileReady]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setIsDraggingFolder(false);
    setUploadError(null);

    try {
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const rawFiles = Array.from(e.dataTransfer.files);
        retryFilesRef.current = rawFiles;
        await processDataTransferItems(e.dataTransfer.items);
      } else if (e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        retryFilesRef.current = files;
        files.forEach((f) => {
          onFileReady?.(f);
          simulateUpload(f.name);
        });
      }
    } catch (err) {
      const firstName = retryFilesRef.current[0]?.name ?? 'file';
      setUploadError({ fileName: firstName, message: err instanceof Error ? err.message : 'Upload failed' });
    }
  }, [processDataTransferItems, simulateUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
    // Detect if folder is being dragged
    const hasDir = Array.from(e.dataTransfer.items).some((item) => item.kind === 'file' && item.type === '');
    setIsDraggingFolder(hasDir);
  }, []);

  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploadError(null);
    const fileArr = Array.from(files);
    retryFilesRef.current = fileArr;
    for (const f of fileArr) {
      if (isZipFile(f)) {
        try {
          const { drawingCount, totalEntries } = await peekZipManifest(f);
          if (totalEntries === 0 || drawingCount === 0) {
            setUploadError({
              fileName: f.name,
              message: totalEntries === 0
                ? 'Zip appears to be empty or unreadable.'
                : 'No .pdf, .dwg, .dxf, or image files found in this zip.',
            });
            simulateUpload(f.name, { isFolder: true, fileCount: 0 });
          } else {
            onFileReady?.(f);
            simulateUpload(f.name, { isFolder: true, fileCount: drawingCount });
          }
        } catch (err) {
          console.error('[UploadZone] zip peek failed:', err);
          setUploadError({ fileName: f.name, message: err instanceof Error ? err.message : 'Could not read zip' });
        }
      } else {
        onFileReady?.(f);
        simulateUpload(f.name);
      }
    }
    e.target.value = '';
  }, [simulateUpload, onFileReady]);

  const handleFolderInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadError(null);
    try {
      const fileArr = Array.from(files);
      retryFilesRef.current = fileArr;
      // Group drawing files by top-level folder and forward each file to the caller
      const folderCounts = new Map<string, number>();
      fileArr.forEach((f) => {
        if (!isDrawingFile(f.name)) return;
        const rel = (f as File & { webkitRelativePath: string }).webkitRelativePath || f.name;
        const topFolder = rel.split('/')[0] || f.name;
        folderCounts.set(topFolder, (folderCounts.get(topFolder) || 0) + 1);
        onFileReady?.(f);
      });
      folderCounts.forEach((count, folderName) => {
        simulateUpload(folderName + '/', { isFolder: true, fileCount: count });
      });
    } catch (err) {
      const firstName = retryFilesRef.current[0]?.name ?? 'file';
      setUploadError({ fileName: firstName, message: err instanceof Error ? err.message : 'Upload failed' });
    }
    e.target.value = '';
  }, [simulateUpload, onFileReady]);

  const handleRetry = useCallback(() => {
    const files = retryFilesRef.current;
    if (!files.length) return;
    setUploadError(null);
    try {
      files.forEach((f) => {
        onFileReady?.(f);
        simulateUpload(f.name);
      });
    } catch (err) {
      const firstName = files[0]?.name ?? 'file';
      setUploadError({ fileName: firstName, message: err instanceof Error ? err.message : 'Upload failed' });
    }
  }, [simulateUpload, onFileReady]);

  const dropZoneBg = isDragging
    ? isDraggingFolder
      ? 'rgba(244, 120, 32, 0.08)'
      : 'rgba(59, 130, 246, 0.1)'
    : 'transparent';

  return (
    <div>
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.tif,.tiff,.zip"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />
      {/* webkitdirectory attribute set via ref (non-standard, see useEffect above) */}
      <input
        ref={folderInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFolderInputChange}
      />

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={() => { setIsDragging(false); setIsDraggingFolder(false); }}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragging ? colors.primaryOrange : colors.borderDefault}`,
          borderRadius: borderRadius.lg,
          padding: `${spacing['8']} ${spacing['4']}`,
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: dropZoneBg,
          transition: `all ${transitions.instant}`,
        }}
      >
        {isDraggingFolder ? (
          <Folder size={32} color={colors.primaryOrange} style={{ marginBottom: spacing['3'] }} />
        ) : (
          <Upload size={32} color={isDragging ? colors.primaryOrange : colors.textTertiary} style={{ marginBottom: spacing['3'] }} />
        )}
        <p style={{
          fontSize: typography.fontSize.body,
          fontWeight: typography.fontWeight.medium,
          color: isDragging ? colors.primaryOrange : colors.textPrimary,
          margin: 0,
          marginBottom: spacing['1'],
        }}>
          {isDraggingFolder ? 'Drop folder to upload entire tree' : isDragging ? 'Drop files here' : 'Drag and drop files or folders here'}
        </p>
        <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginBottom: spacing['3'] }}>
          PDF, DWG, DXF, PNG, JPG, TIFF, ZIP, or folders. Spec books route to Specifications; cover sheets auto-extract project metadata.
        </p>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'center' }}>
          <button
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            style={{
              padding: `${spacing['2']} ${spacing['4']}`,
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily,
              fontWeight: typography.fontWeight.medium,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md,
              backgroundColor: colors.surfaceRaised,
              color: colors.textPrimary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: spacing['1'],
              transition: `all ${transitions.instant}`,
            }}
          >
            <Upload size={13} /> Browse Files
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
            style={{
              padding: `${spacing['2']} ${spacing['4']}`,
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily,
              fontWeight: typography.fontWeight.medium,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md,
              backgroundColor: colors.surfaceRaised,
              color: colors.textPrimary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: spacing['1'],
              transition: `all ${transitions.instant}`,
            }}
          >
            <Folder size={13} /> Upload Folder
          </button>
        </div>
      </div>

      {/* Error message */}
      {uploadError && (
        <div
          aria-live="polite"
          style={{
            padding: 12,
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 8,
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing['2'],
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], minWidth: 0 }}>
            <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: typography.fontSize.sm, color: '#DC2626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {uploadError.fileName}: {uploadError.message}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexShrink: 0 }}>
            <button
              onClick={handleRetry}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['1']} ${spacing['3']}`,
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
                fontWeight: typography.fontWeight.medium,
                border: '1px solid #DC2626',
                borderRadius: borderRadius.md,
                backgroundColor: 'transparent',
                color: '#DC2626',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={12} /> Retry
            </button>
            <button
              onClick={() => setUploadError(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: 4,
                border: 'none',
                background: 'transparent',
                color: '#DC2626',
                cursor: 'pointer',
                lineHeight: 1,
              }}
              aria-label="Dismiss error"
            >
              &#x2715;
            </button>
          </div>
        </div>
      )}

      {/* Upload queue */}
      {uploads.length > 0 && (
        <div style={{ marginTop: spacing['3'], display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {uploads.map((upload) => (
            <div key={upload.id} style={{
              display: 'flex', alignItems: 'center', gap: spacing['3'],
              padding: `${spacing['2']} ${spacing['3']}`,
              backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
            }}>
              {upload.isFolder
                ? (/\.zip$/i.test(upload.name)
                    ? <FileArchive size={16} color={upload.status === 'done' ? colors.primaryOrange : colors.textTertiary} />
                    : <Folder size={16} color={upload.status === 'done' ? colors.primaryOrange : colors.textTertiary} />)
                : <FileIcon size={16} color={upload.status === 'done' ? colors.statusActive : colors.textTertiary} />
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {upload.name}
                  </p>
                  {upload.isFolder && upload.fileCount !== undefined && (
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, flexShrink: 0 }}>
                      {upload.fileCount} {upload.fileCount === 1 ? 'file' : 'files'}
                    </span>
                  )}
                </div>
                {upload.status === 'uploading' && (
                  <div style={{ marginTop: spacing['1'], height: 3, backgroundColor: colors.borderSubtle, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', backgroundColor: colors.primaryOrange, borderRadius: 2, width: `${upload.progress}%`, transition: 'width 150ms ease-out' }} />
                  </div>
                )}
                {upload.status === 'categorizing' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginTop: 2 }}>
                    <Sparkles size={10} color={colors.statusReview} style={{ animation: 'pulse 1s infinite' }} />
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.statusReview }}>AI categorizing...</span>
                  </div>
                )}
                {upload.status === 'done' && upload.aiCategory && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginTop: 2 }}>
                    <Sparkles size={10} color={colors.statusReview} />
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.statusReview }}>{upload.aiCategory}</span>
                  </div>
                )}
                {upload.status === 'done' && upload.aiTags && upload.aiTags.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginTop: 3, flexWrap: 'wrap' }}>
                    <Tag size={9} color={colors.textTertiary} />
                    {upload.aiTags.map((tag) => (
                      <span key={tag} style={{ fontSize: 10, color: colors.textSecondary, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, padding: '1px 6px', border: `1px solid ${colors.borderSubtle}` }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {upload.status === 'done' && <CheckCircle size={16} color={colors.statusActive} />}
              {upload.status === 'uploading' && (
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{Math.round(upload.progress)}%</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

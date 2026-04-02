import React, { useState, useCallback, useRef } from 'react';
import { Upload, File, CheckCircle, Sparkles, Folder, Tag, AlertCircle, RefreshCw } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { aiService } from '../../lib/aiService';

interface UploadZoneProps {
  onUpload: (fileName: string) => void;
  onTagsSuggested?: (fileName: string, tags: string[]) => void;
  onFileReady?: (file: File) => void;
}

interface UploadItem {
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

export const UploadZone: React.FC<UploadZoneProps> = ({ onUpload, onTagsSuggested, onFileReady }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingFolder, setIsDraggingFolder] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const retryFilesRef = useRef<File[]>([]);

  const simulateUpload = useCallback((name: string, opts?: { isFolder?: boolean; fileCount?: number }) => {
    const id = Date.now() + Math.random();
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
      progress += 8 + Math.random() * 12;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setUploads((prev) => prev.map((u) => u.id === id ? { ...u, progress: 100, status: 'categorizing' } : u));
        setTimeout(async () => {
          const cat = aiCategories[Math.floor(Math.random() * aiCategories.length)];
          const suggestedTags = await aiService.tagDocumentOnUpload(String(id), name, '');
          setUploads((prev) => prev.map((u) => u.id === id ? { ...u, status: 'done', aiCategory: cat, aiTags: suggestedTags } : u));
          onUpload(name);
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
        simulateUpload(entry.name + '/', { isFolder: true, fileCount: files.length });
      } else {
        if (rawFiles[i]) onFileReady?.(rawFiles[i]);
        simulateUpload(entry.name);
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
      const message = err instanceof Error ? err.message : 'Unknown error';
      setUploadError(message);
      window.alert(`Upload failed: ${message}. Please try again.`);
    }
  }, [processDataTransferItems, simulateUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
    // Detect if folder is being dragged
    const hasDir = Array.from(e.dataTransfer.items).some((item) => item.kind === 'file' && item.type === '');
    setIsDraggingFolder(hasDir);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploadError(null);
    try {
      const fileArr = Array.from(files);
      retryFilesRef.current = fileArr;
      fileArr.forEach((f) => {
        onFileReady?.(f);
        simulateUpload(f.name);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setUploadError(message);
      window.alert(`Upload failed: ${message}. Please try again.`);
    }
    e.target.value = '';
  }, [simulateUpload, onFileReady]);

  const handleFolderInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadError(null);
    try {
      retryFilesRef.current = Array.from(files);
      // Group by top-level folder
      const folderMap = new Map<string, number>();
      Array.from(files).forEach((f) => {
        const parts = (f as File & { webkitRelativePath: string }).webkitRelativePath.split('/');
        const topFolder = parts[0];
        folderMap.set(topFolder, (folderMap.get(topFolder) || 0) + 1);
      });
      folderMap.forEach((count, folderName) => {
        simulateUpload(folderName + '/', { isFolder: true, fileCount: count });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setUploadError(message);
      window.alert(`Upload failed: ${message}. Please try again.`);
    }
    e.target.value = '';
  }, [simulateUpload]);

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
      const message = err instanceof Error ? err.message : 'Unknown error';
      setUploadError(message);
      window.alert(`Upload failed: ${message}. Please try again.`);
    }
  }, [simulateUpload, onFileReady]);

  const dropZoneBg = isDragging
    ? isDraggingFolder
      ? 'rgba(244, 120, 32, 0.08)'
      : colors.orangeSubtle
    : 'transparent';

  return (
    <div>
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.dwg,.dxf,.xlsx,.xls,.docx,.doc,.jpg,.jpeg,.png,.zip"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />
      {/* webkitdirectory lets users pick an entire folder */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is non-standard but widely supported
        webkitdirectory=""
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
          PDF, DWG, XLS, DOC, images up to 100MB
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
            marginTop: spacing['3'],
            padding: `${spacing['3']} ${spacing['4']}`,
            backgroundColor: '#FEF2F2',
            border: `1px solid #FECACA`,
            borderRadius: borderRadius.md,
            display: 'flex',
            alignItems: 'center',
            gap: spacing['3'],
          }}
        >
          <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: typography.fontSize.sm, color: '#DC2626' }}>
            Upload failed: {uploadError}. Please try again.
          </span>
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
              border: `1px solid #DC2626`,
              borderRadius: borderRadius.md,
              backgroundColor: 'transparent',
              color: '#DC2626',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <RefreshCw size={12} /> Retry
          </button>
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
                ? <Folder size={16} color={upload.status === 'done' ? colors.primaryOrange : colors.textTertiary} />
                : <File size={16} color={upload.status === 'done' ? colors.statusActive : colors.textTertiary} />
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

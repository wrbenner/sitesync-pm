import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, CheckCircle, FileText, AlertCircle } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  file: File;
}

interface UppyUploaderProps {
  onFilesSelected: (files: File[]) => void;
  onUploadComplete?: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  compact?: boolean;
  label?: string;
}

const formatSize = (bytes: number): string => {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
};

export function UppyUploader({ onFilesSelected, onUploadComplete, accept, maxFiles = 20, compact = false, label }: UppyUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList).slice(0, maxFiles);
    if (files.length === 0) return;

    const newEntries: UploadedFile[] = files.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: f.name,
      size: f.size,
      type: f.type,
      progress: 0,
      status: 'uploading' as const,
      file: f,
    }));

    setUploadedFiles((prev) => [...prev, ...newEntries]);
    onFilesSelected(files);

    // Simulate upload progress for each file
    newEntries.forEach((entry) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30 + 10;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setUploadedFiles((prev) =>
            prev.map((f) => f.id === entry.id ? { ...f, progress: 100, status: 'complete' } : f)
          );
        } else {
          setUploadedFiles((prev) =>
            prev.map((f) => f.id === entry.id ? { ...f, progress: Math.min(progress, 99) } : f)
          );
        }
      }, 200 + Math.random() * 300);
    });

    onUploadComplete?.(files);
  }, [maxFiles, onFilesSelected, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  if (compact) {
    return (
      <div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          style={{ display: 'none' }}
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />
        <button
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            display: 'flex', alignItems: 'center', gap: spacing['2'],
            padding: `${spacing['2']} ${spacing['3']}`,
            border: `1px dashed ${dragOver ? colors.primaryOrange : colors.borderDefault}`,
            borderRadius: borderRadius.base,
            backgroundColor: dragOver ? colors.orangeSubtle : 'transparent',
            cursor: 'pointer', fontFamily: typography.fontFamily,
            fontSize: typography.fontSize.sm, color: colors.textTertiary,
            width: '100%', transition: `all ${transitions.quick}`,
          }}
        >
          <Upload size={14} />
          {label || 'Drop files here or click to attach'}
        </button>
        {uploadedFiles.length > 0 && (
          <div style={{ marginTop: spacing['2'], display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
            {uploadedFiles.map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['1']} ${spacing['2']}`, backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.sm, fontSize: typography.fontSize.caption }}>
                {f.status === 'complete' ? <CheckCircle size={12} color={colors.statusActive} /> : <div style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${colors.primaryOrange}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />}
                <span style={{ flex: 1, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <span style={{ color: colors.textTertiary }}>{formatSize(f.size)}</span>
                <button onClick={() => removeFile(f.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: colors.textTertiary, display: 'flex' }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => e.target.files && processFiles(e.target.files)}
      />
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          border: `2px dashed ${dragOver ? colors.primaryOrange : colors.borderDefault}`,
          borderRadius: borderRadius.lg,
          padding: `${spacing['8']} ${spacing['6']}`,
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: dragOver ? colors.orangeSubtle : colors.surfacePage,
          transition: `all ${transitions.quick}`,
        }}
      >
        <Upload size={32} color={dragOver ? colors.orangeText : colors.textTertiary} style={{ marginBottom: spacing['3'] }} />
        <p style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
          {label || 'Drop files here or click to upload'}
        </p>
        <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
          PDF, DWG, XLSX, images and more. Up to {maxFiles} files.
        </p>
      </div>

      {/* File list */}
      {uploadedFiles.length > 0 && (
        <div style={{ marginTop: spacing['4'], display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {uploadedFiles.map((f) => (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: spacing['3'],
              padding: `${spacing['3']} ${spacing['4']}`,
              backgroundColor: colors.surfaceRaised,
              borderRadius: borderRadius.base,
              border: `1px solid ${colors.borderSubtle}`,
            }}>
              <FileText size={16} color={f.status === 'complete' ? colors.statusActive : colors.textTertiary} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: f.status === 'uploading' ? spacing['1'] : 0 }}>
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name}
                  </span>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, flexShrink: 0, marginLeft: spacing['2'] }}>
                    {formatSize(f.size)}
                  </span>
                </div>
                {f.status === 'uploading' && (
                  <div style={{ height: 3, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${f.progress}%`, backgroundColor: colors.primaryOrange, borderRadius: borderRadius.full, transition: 'width 200ms ease' }} />
                  </div>
                )}
              </div>
              {f.status === 'complete' && <CheckCircle size={16} color={colors.statusActive} />}
              {f.status === 'error' && <AlertCircle size={16} color={colors.statusCritical} />}
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: spacing['1'], color: colors.textTertiary, display: 'flex', borderRadius: borderRadius.sm }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

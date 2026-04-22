import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { Grid, List, Upload as UploadIcon, FolderOpen, FileText, Image, Table, File as FileIcon, Sparkles, Search, Download, FolderInput, Trash2, Link2, Files as FilesIcon, FileImage, HardDrive } from 'lucide-react';
import { Card, Btn, useToast, PageContainer } from '../components/Primitives';
import { ErrorBoundary } from '../components/ErrorBoundary';
import EmptyState from '../components/ui/EmptyState';

import { UploadZone } from '../components/files/UploadZone';
import { FilePreview } from '../components/files/FilePreview';
import { DataTable, createColumnHelper } from '../components/shared/DataTable';
import { BulkActionBar, FolderPickerModal } from '../components/shared/BulkActionBar';
import { FolderBreadcrumbs } from '../components/Breadcrumbs';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme';
import { useProjectId } from '../hooks/useProjectId';
import { useFiles } from '../hooks/queries';
import { useCreateFile, useDeleteFile } from '../hooks/mutations';
import { supabase, fromTable } from '../lib/supabase';
import { PermissionGate } from '../components/auth/PermissionGate';
import { usePermissions } from '../hooks/usePermissions';
import { useTableKeyboardNavigation } from '../hooks/useTableKeyboardNavigation';
import { useRealtimeInvalidation } from '../hooks/useRealtimeInvalidation';
import { PageInsightBanners } from '../components/ai/PredictiveAlert';
import type { MappedFile } from '../types/api';

type ViewMode = 'list' | 'grid';

interface FileItem {
  id: string;
  name: string;
  type: string;
  size?: string;
  itemCount?: number;
  totalSize?: number;
  lastModified?: string;
  modifiedDate: string;
  parent_id?: string | null;
  parent_folder_id?: string | null;
  content_type?: string | null;
}

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

const fileGradients: Record<string, string> = {
  pdf: `linear-gradient(135deg, ${colors.statusInfo} 0%, ${colors.statusReview} 100%)`,
  xlsx: `linear-gradient(135deg, ${colors.statusActive} 0%, ${colors.chartCyan} 100%)`,
  dwg: `linear-gradient(135deg, ${colors.primaryOrange} 0%, ${colors.orangeGradientEnd} 100%)`,
  zip: `linear-gradient(135deg, ${colors.gray600} 0%, ${colors.textTertiary} 100%)`,
  default: `linear-gradient(135deg, ${colors.statusInfo} 0%, ${colors.statusReview} 100%)`,
  folder: `linear-gradient(135deg, rgba(244, 120, 32, 0.12) 0%, rgba(244, 120, 32, 0.04) 100%)`,
};

const getGradient = (file: FileItem): string => {
  if (file.type === 'folder') return fileGradients.folder;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return fileGradients[ext] || fileGradients.default;
};

const getApprovalStatus = (file: FileItem): { label: string; color: string } | null => {
  const status = (file as FileItem & { document_status?: string }).document_status;
  if (!status) return null;
  const map: Record<string, { label: string; color: string }> = {
    draft: { label: 'Draft', color: colors.textTertiary },
    submitted: { label: 'Submitted', color: colors.statusInfo },
    approved: { label: 'Approved', color: colors.statusActive },
    rejected: { label: 'Rejected', color: colors.statusCritical },
    archived: { label: 'Archived', color: colors.textTertiary },
    void: { label: 'Void', color: colors.textTertiary },
  };
  return map[status] ?? null;
};

const getFileTypeIcon = (file: FileItem, size = 16): React.ReactElement => {
  if (file.type === 'folder') return <FolderOpen size={size} color={colors.primaryOrange} />;
  const ct = (file.content_type ?? '').toLowerCase();
  if (ct.includes('pdf')) return <FileText size={size} color="#DC2626" />;
  if (ct.includes('image')) return <Image size={size} color={colors.statusInfo} />;
  if (ct.includes('spreadsheet') || ct.includes('excel') || ct.includes('csv')) return <Table size={size} color={colors.statusActive} />;
  return <FileIcon size={size} color={colors.textTertiary} />;
};

const FilesPage: React.FC = () => {
  const { addToast } = useToast();
  const projectId = useProjectId();
  const createFile = useCreateFile();
  const deleteFile = useDeleteFile();
  const { hasPermission } = usePermissions();
  const { data: rawFiles, isPending: loading, isError, error, refetch } = useFiles(projectId);
  useRealtimeInvalidation(projectId);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [nowMs] = useState(() => Date.now());

  const files = useMemo(() =>
    (rawFiles || []).map(f => ({
      ...f,
      modifiedDate: f.created_at ? new Date(f.created_at).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '',
    })),
    [rawFiles]
  );

  // ── Summary metrics ───────────────────────────────────
  const metrics = useMemo(() => {
    const all = rawFiles || [];
    const totalFiles = all.length;
    const drawings = all.filter((f: MappedFile) => (f as MappedFile & { category?: string }).category === 'drawing' || (f.content_type && String(f.content_type).includes('pdf'))).length;
    const weekAgo = nowMs - 7 * 86400000;
    const recentUploads = all.filter((f: MappedFile) => {
      const ts = (f as MappedFile & { uploaded_at?: string }).uploaded_at || f.created_at;
      return ts && new Date(ts).getTime() > weekAgo;
    }).length;
    const totalBytes = all.reduce((sum: number, f: MappedFile) => sum + ((f as MappedFile & { file_size_bytes?: number }).file_size_bytes || 0), 0);
    return { totalFiles, drawings, recentUploads, totalBytes };
  }, [rawFiles, nowMs]);

  // ── Accessibility live region ─────────────────────────
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [uploadAnnouncement, setUploadAnnouncement] = useState('');

  // ── View mode ─────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Folder navigation ─────────────────────────────────
  // Stack of { id, name } for the current folder path. Empty = root.
  const [folderStack, setFolderStack] = useState<Array<{ id: string; name: string }>>([]);
  const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : null;

  const visibleFiles = useMemo(() => {
    const filtered = files.filter((f: FileItem) => (f.parent_folder_id ?? null) === currentFolderId);
    return [...filtered].sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return 0;
    });
  }, [files, currentFolderId]);

  const displayFiles = useMemo(() => {
    if (!searchQuery.trim()) return visibleFiles;
    const q = searchQuery.toLowerCase();
    return files
      .filter((f: FileItem) => f.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return 0;
      });
  }, [files, visibleFiles, searchQuery]);

  const navigateToFolder = useCallback((id: string, name: string) => {
    setFolderStack((prev) => [...prev, { id, name }]);
    setSelectedIds([]);
  }, []);

  const navigateToBreadcrumb = useCallback((index: number) => {
    // index -1 = root
    setFolderStack((prev) => index < 0 ? [] : prev.slice(0, index + 1));
    setSelectedIds([]);
  }, []);

  // Folder drag-and-drop hierarchy reorganization
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const draggingFileIdRef = useRef<string | null>(null);

  const handleInternalDragStart = useCallback((fileId: string) => {
    draggingFileIdRef.current = fileId;
  }, []);

  const handleInternalDrop = useCallback(async (targetFolderId: string) => {
    const sourceId = draggingFileIdRef.current;
    draggingFileIdRef.current = null;
    setDragOverFolderId(null);
    if (!sourceId || sourceId === targetFolderId) return;
    const source = files.find((f: FileItem) => f.id === sourceId);
    const target = files.find((f: FileItem) => f.id === targetFolderId);
    if (source && target) {
      const { error } = await fromTable('files').update({ parent_folder_id: targetFolderId }).eq('id', sourceId);
      if (error) { addToast('error', `Failed to move "${source.name}"`); return; }
      addToast('success', `Moved "${source.name}" into "${target.name}"`);
      refetch();
    }
  }, [files, addToast, refetch]);

  // ── Folder picker modal for "Move to Folder" ─────────
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const folderPickerCallbackRef = useRef<((ids: string[]) => void) | null>(null);

  const allFolders = useMemo(() =>
    files.filter((f: FileItem) => f.type === 'folder').map((f: FileItem) => ({ id: f.id, name: f.name })),
    [files]
  );

  // ── Bulk actions ──────────────────────────────────────
  const bulkActions = useMemo(() => [
    {
      label: 'Download ZIP',
      icon: <Download size={14} />,
      variant: 'secondary' as const,
      onClick: async (ids: string[]) => {
        const zip = new JSZip();
        const selected = files.filter((f: FileItem) => ids.includes(f.id));
        for (const f of selected) {
          if (f.type === 'folder') continue;
          try {
            const raw = rawFiles?.find((rf) => rf.id === f.id);
            const fileUrl = raw?.file_url;
            if (!fileUrl) continue;
            // Supabase storage URLs contain the bucket path after /object/
            const storageMatch = fileUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/);
            let blob: Blob;
            if (storageMatch) {
              const [, bucket, path] = storageMatch;
              const { data, error } = await supabase.storage.from(bucket).download(path);
              if (error || !data) continue;
              blob = data;
            } else {
              const resp = await fetch(fileUrl);
              if (!resp.ok) continue;
              blob = await resp.blob();
            }
            zip.file(f.name, blob);
          } catch {
            // Skip files that fail to download
          }
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sitesync-documents.zip';
        a.click();
        URL.revokeObjectURL(url);
        addToast('success', `Downloaded ${selected.length} file${selected.length !== 1 ? 's' : ''} as ZIP`);
      },
    },
    ...(hasPermission('files.upload') ? [{
      label: 'Move to Folder',
      icon: <FolderInput size={14} />,
      variant: 'secondary' as const,
      onClick: async (ids: string[]) => {
        return new Promise<void>((resolve) => {
          folderPickerCallbackRef.current = async (pickedIds) => {
            const targetFolderId = pickedIds[0];
            if (targetFolderId) {
              for (const fileId of ids) {
                await fromTable('files').update({ parent_folder_id: targetFolderId } as Record<string, unknown>).eq('id', fileId);
              }
              refetch();
            }
            addToast('success', `Moved ${ids.length} item${ids.length !== 1 ? 's' : ''}`);
            resolve();
          };
          setFolderPickerOpen(true);
        });
      },
    }] : []),
    ...(hasPermission('files.delete') ? [{
      label: 'Delete',
      icon: <Trash2 size={14} />,
      variant: 'danger' as const,
      confirm: true,
      confirmMessage: `This will permanently delete the selected files. This action cannot be undone.`,
      onClick: async (ids: string[]) => {
        for (const id of ids) {
          await deleteFile.mutateAsync({ id, projectId: projectId! });
        }
        setSelectedIds([]);
        addToast('success', `Deleted ${ids.length} item${ids.length !== 1 ? 's' : ''}`);
      },
    }] : []),
    {
      label: 'Copy Link',
      icon: <Link2 size={14} />,
      variant: 'secondary' as const,
      onClick: async (ids: string[]) => {
        const links = ids.map((id) => `${window.location.origin}/files/${id}`).join('\n');
        await navigator.clipboard.writeText(links).catch(() => {});
        addToast('success', `Copied ${ids.length} link${ids.length !== 1 ? 's' : ''} to clipboard`);
      },
    },
  ], [files, rawFiles, addToast, hasPermission, deleteFile, projectId, refetch]);

  // ── Keyboard navigation for list view ────────────────
  const listRef = useRef<HTMLDivElement>(null);
  const listRows = viewMode === 'list' ? displayFiles : [];
  const { focusedIndex, handleKeyDown } = useTableKeyboardNavigation({
    rowCount: listRows.length,
    onActivate: (i) => {
      const f = listRows[i];
      if (!f) return;
      if (f.type === 'folder') navigateToFolder(f.id, f.name);
      else setSelectedFile(f);
    },
    onToggleSelect: (i) => {
      const f = listRows[i];
      if (!f) return;
      setSelectedIds((prev) =>
        prev.includes(f.id) ? prev.filter((id) => id !== f.id) : [...prev, f.id]
      );
    },
  });

  useEffect(() => {
    if (viewMode !== 'list') return;
    if (!listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(`[data-row-index="${focusedIndex}"]`);
    if (row && listRef.current.contains(document.activeElement)) {
      row.focus({ preventScroll: false });
    }
  }, [focusedIndex, viewMode]);

  // ── Announce search result counts ─────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const msg = displayFiles.length === 0
      ? 'No files match your search'
      : `${displayFiles.length} ${displayFiles.length === 1 ? 'file' : 'files'} found`;
    const timer = setTimeout(() => setLiveAnnouncement(msg), 0);
    return () => clearTimeout(timer);
  }, [searchQuery, displayFiles.length]);

  // ── File click handler ────────────────────────────────
  const handleFileClick = useCallback((file: FileItem) => {
    if (file.type === 'folder') {
      navigateToFolder(file.id, file.name);
    } else {
      setSelectedFile(file);
    }
  }, [navigateToFolder]);

  const handlePageDragEnter = useCallback((e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes('Files')) {
      setShowUpload(true);
    }
  }, []);

  const handleUpload = async (fileName: string, file?: File) => {
    try {
      let fileUrl = '';
      let contentType = 'application/octet-stream';
      if (file) {
        contentType = file.type || 'application/octet-stream';
        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${projectId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('project-files')
          .upload(storagePath, file, { contentType, upsert: false });
        if (uploadError) {
          console.warn('Storage upload failed, creating DB record without URL:', uploadError.message);
        } else {
          const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(storagePath);
          fileUrl = urlData.publicUrl;
        }
      }
      await createFile.mutateAsync({
        projectId: projectId!,
        data: {
          project_id: projectId!,
          name: fileName,
          content_type: contentType,
          ...(fileUrl ? { file_url: fileUrl } : {}),
        },
      });
      addToast('success', `Uploaded ${fileName}`);
      setUploadAnnouncement('File uploaded successfully');
    } catch { addToast('error', `Failed to upload ${fileName}`); setUploadAnnouncement('Upload failed. Please try again.'); }
  };

  const handleDeleteFile = useCallback(async (file: FileItem) => {
    if (!window.confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
    try {
      await deleteFile.mutateAsync({ id: file.id, projectId: projectId! });
      addToast('success', `Deleted ${file.name}`);
      setLiveAnnouncement('File deleted');
    } catch {
      addToast('error', `Failed to delete ${file.name}`);
    }
  }, [addToast, deleteFile, projectId]);

  // ── Columns ───────────────────────────────────────────
  const columnHelper = createColumnHelper<FileItem>();

  const fileTableColumns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (info) => {
        const file = info.row.original;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
            {getFileTypeIcon(file, 16)}
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
              {file.name}
            </span>
          </div>
        );
      },
    }),
    columnHelper.accessor('type', {
      header: 'Type',
      size: 100,
      cell: (info) => (
        <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, textTransform: 'capitalize' as const }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'sizeCount',
      header: 'Size / Count',
      size: 150,
      cell: (info) => {
        const file = info.row.original;
        if (file.type !== 'folder') {
          return <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{file.size}</span>;
        }
        const isEmpty = file.itemCount === 0;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: typography.fontSize.sm, color: isEmpty ? colors.textTertiary : colors.textSecondary, fontStyle: isEmpty ? 'italic' : 'normal' }}>
              {file.itemCount} {file.itemCount === 1 ? 'item' : 'items'}
            </span>
            {file.totalSize != null && file.totalSize > 0 && (
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{formatBytes(file.totalSize)}</span>
            )}
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'modified',
      header: 'Modified',
      size: 120,
      cell: (info) => {
        const file = info.row.original;
        const date = file.type === 'folder' && file.lastModified
          ? new Date(file.lastModified).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
          : file.modifiedDate;
        return <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>{date || '\u2014'}</span>;
      },
    }),
    columnHelper.display({
      id: 'status',
      header: 'Status',
      size: 110,
      cell: (info) => {
        const approval = getApprovalStatus(info.row.original);
        if (!approval) return <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>&mdash;</span>;
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['1'] }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: approval.color }} />
            <span style={{ fontSize: typography.fontSize.caption, color: approval.color, fontWeight: typography.fontWeight.medium }}>
              {approval.label}
            </span>
          </div>
        );
      },
    }),
  ], []);

  if (isError) {
    const message = error instanceof Error ? error.message : 'Failed to load documents';
    return (
      <PageContainer title="Files">
        <div aria-live="polite" role="status">
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['4'], padding: `${spacing['6']} ${spacing['4']}`, textAlign: 'center' }}>
              <p style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, margin: 0 }}>
                {message}
              </p>
              <Btn variant="primary" size="sm" onClick={() => refetch()}>
                Retry
              </Btn>
            </div>
          </Card>
        </div>
      </PageContainer>
    );
  }

  if (loading) {
    const skeletonPulse: React.CSSProperties = {
      backgroundColor: colors.borderLight,
      animation: 'pulse 1.5s ease-in-out infinite',
      borderRadius: 4,
      opacity: 0.6,
    };
    return (
      <PageContainer title="Files">
        <Card padding="0">
          <div aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing['4'],
                  padding: `0 ${spacing['4']}`,
                  borderBottom: '1px solid #F0EDE9',
                }}
              >
                <div style={{ ...skeletonPulse, width: 24, height: 24, borderRadius: 6, flexShrink: 0 }} />
                <div style={{ ...skeletonPulse, width: 200, height: 14 }} />
                <div style={{ ...skeletonPulse, width: 60, height: 14 }} />
                <div style={{ ...skeletonPulse, width: 80, height: 14 }} />
              </div>
            ))}
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Files"
      actions={
        <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
          {/* View mode toggle */}
          <div style={{
            display: 'flex',
            backgroundColor: colors.surfaceInset,
            borderRadius: borderRadius.md,
            padding: '2px',
          }}>
            {(['grid', 'list'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                aria-label={mode === 'grid' ? 'Grid view' : 'List view'}
                aria-pressed={viewMode === mode}
                onClick={() => setViewMode(mode)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 28,
                  border: 'none',
                  borderRadius: borderRadius.base,
                  cursor: 'pointer',
                  backgroundColor: viewMode === mode ? colors.surfaceRaised : 'transparent',
                  boxShadow: viewMode === mode ? shadows.sm : 'none',
                  color: viewMode === mode ? colors.textPrimary : colors.textTertiary,
                  transition: `all ${transitions.instant}`,
                }}
              >
                {mode === 'grid' ? <Grid size={14} /> : <List size={14} />}
              </button>
            ))}
          </div>

          <PermissionGate permission="files.upload">
            <Btn
              icon={<UploadIcon size={14} />}
              onClick={() => setShowUpload(!showUpload)}
              variant={showUpload ? 'secondary' : 'primary'}
              size="sm"
            >
              Upload
            </Btn>
          </PermissionGate>
        </div>
      }
    >
      <main role="main" aria-label="Document management" onDragEnter={handlePageDragEnter}>
      {/* Accessibility live regions */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', left: -9999, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}
      >
        {liveAnnouncement}
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        style={{ position: 'absolute', left: -9999, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}
      >
        {uploadAnnouncement}
      </div>

      {/* AI Insights */}
      <PageInsightBanners page="files" />

      {/* Summary metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing.md, marginBottom: spacing['4'] }}>
        {[
          { label: 'Total Files', value: metrics.totalFiles, icon: <FilesIcon size={20} color={colors.primaryOrange} /> },
          { label: 'Drawings', value: metrics.drawings, icon: <FileImage size={20} color={colors.statusInfo} /> },
          { label: 'This Week', value: metrics.recentUploads, icon: <UploadIcon size={20} color={colors.statusActive} /> },
          { label: 'Total Size', value: formatBytes(metrics.totalBytes), icon: <HardDrive size={20} color={colors.textSecondary} /> },
        ].map(({ label, value, icon }) => (
          <div key={label} style={{ background: colors.white, border: '1px solid #E5E7EB', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>{label}</span>
              {icon}
            </div>
            <span style={{ fontSize: 28, fontWeight: typography.fontWeight.bold, color: colors.textPrimary, lineHeight: 1 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Folder breadcrumbs */}
      <FolderBreadcrumbs stack={folderStack} onNavigate={navigateToBreadcrumb} />

      {/* Search */}
      <div style={{ marginBottom: spacing['4'], display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, border: `1px solid ${searchQuery ? colors.borderFocus : 'transparent'}`, transition: `border-color 120ms ease` }}>
        <Search size={16} color={colors.textTertiary} />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search files across all folders..."
          aria-label="Search files"
          style={{ flex: 1, border: 'none', backgroundColor: 'transparent', outline: 'none', fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, color: colors.textPrimary }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            style={{ display: 'flex', alignItems: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textTertiary, padding: 2, lineHeight: 1 }}
          >
            &#x2715;
          </button>
        )}
      </div>

      {/* Collapsible Upload Zone — shown when toggled or when current folder is empty */}
      {(showUpload || (visibleFiles.length === 0 && !searchQuery)) && (
        <div style={{ marginBottom: spacing['5'] }}>
          <Card>
            <UploadZone onUpload={handleUpload} />
          </Card>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div role="grid" aria-label="Project files" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'] }}>
          {displayFiles.map((file: FileItem) => {
            const approval = getApprovalStatus(file);
            const isDropTarget = file.type === 'folder' && dragOverFolderId === file.id;
            return (
              <div
                key={file.id}
                role="row"
                tabIndex={0}
                draggable
                onDragStart={() => handleInternalDragStart(file.id)}
                onDragEnd={() => { draggingFileIdRef.current = null; setDragOverFolderId(null); }}
                onDragOver={file.type === 'folder' ? (e) => { e.preventDefault(); setDragOverFolderId(file.id); } : undefined}
                onDragLeave={file.type === 'folder' ? () => setDragOverFolderId(null) : undefined}
                onDrop={file.type === 'folder' ? (e) => { e.preventDefault(); handleInternalDrop(file.id); } : undefined}
                onClick={() => handleFileClick(file)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleFileClick(file);
                  } else if (e.key === 'Delete' && hasPermission('files.delete')) {
                    e.preventDefault();
                    handleDeleteFile(file);
                  }
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLDivElement).style.outline = `2px solid ${colors.primaryOrange}`;
                  (e.currentTarget as HTMLDivElement).style.outlineOffset = '2px';
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLDivElement).style.outline = selectedIds.includes(file.id) ? `2px solid ${colors.primaryOrange}` : 'none';
                  (e.currentTarget as HTMLDivElement).style.outlineOffset = '1px';
                }}
                style={{
                  backgroundColor: colors.surfaceRaised,
                  borderRadius: borderRadius.lg,
                  boxShadow: isDropTarget ? `0 0 0 2px ${colors.primaryOrange}` : shadows.card,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: `box-shadow ${transitions.quick}, transform ${transitions.quick}`,
                  outline: selectedIds.includes(file.id) ? `2px solid ${colors.primaryOrange}` : 'none',
                  outlineOffset: 1,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = isDropTarget ? `0 0 0 2px ${colors.primaryOrange}` : shadows.cardHover;
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = isDropTarget ? `0 0 0 2px ${colors.primaryOrange}` : shadows.card;
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                }}
              >
                {/* Thumbnail cell */}
                <div role="gridcell" style={{ height: '120px', background: getGradient(file), display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {getFileTypeIcon(file, 36)}
                  {/* Checkbox overlay */}
                  <div
                    role="checkbox"
                    aria-checked={selectedIds.includes(file.id)}
                    aria-label={`Select ${file.name}`}
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIds((prev) =>
                        prev.includes(file.id) ? prev.filter((id) => id !== file.id) : [...prev, file.id]
                      );
                    }}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedIds((prev) =>
                          prev.includes(file.id) ? prev.filter((id) => id !== file.id) : [...prev, file.id]
                        );
                      }
                    }}
                    onFocus={(e) => { e.stopPropagation(); (e.currentTarget as HTMLDivElement).style.outline = `2px solid ${colors.primaryOrange}`; }}
                    onBlur={(e) => { (e.currentTarget as HTMLDivElement).style.outline = 'none'; }}
                    style={{
                      position: 'absolute', top: spacing['2'], left: spacing['2'],
                      width: 20, height: 20,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: selectedIds.includes(file.id) ? colors.primaryOrange : 'rgba(255,255,255,0.8)',
                      borderRadius: borderRadius.sm,
                      border: `1.5px solid ${selectedIds.includes(file.id) ? colors.primaryOrange : colors.borderDefault}`,
                      cursor: 'pointer',
                      transition: `all ${transitions.instant}`,
                      outline: 'none',
                    }}
                  >
                    {selectedIds.includes(file.id) && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  {/* Approval dot */}
                  {approval && (
                    <div style={{
                      position: 'absolute', top: spacing['2'], right: spacing['2'],
                      width: 8, height: 8,
                      borderRadius: '50%',
                      backgroundColor: approval.color,
                      border: `2px solid ${file.type === 'folder' ? colors.surfaceRaised : 'rgba(255,255,255,0.4)'}`,
                    }} />
                  )}
                </div>

                {/* Info cell */}
                <div role="gridcell" style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                  <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing['2'] }}>
                    {file.type === 'folder' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: typography.fontSize.caption, color: file.itemCount === 0 ? colors.textTertiary : colors.primaryOrange, fontStyle: file.itemCount === 0 ? 'italic' : 'normal' }}>
                          {file.itemCount} {file.itemCount === 1 ? 'item' : 'items'}
                        </span>
                        {file.totalSize != null && file.totalSize > 0 && (
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{formatBytes(file.totalSize)}</span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{file.size}</span>
                    )}
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                      {file.type === 'folder' && file.lastModified
                        ? new Date(file.lastModified).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
                        : file.modifiedDate}
                    </span>
                  </div>
                </div>

                {/* Actions cell */}
                {file.type !== 'folder' && (
                  <div role="gridcell" style={{ display: 'flex', gap: spacing['1'], padding: `0 ${spacing['3']} ${spacing['3']}`, justifyContent: 'flex-end' }}>
                    {[
                      { icon: <Sparkles size={13} />, label: `Preview ${file.name}`, action: () => { setSelectedFile(file); } },
                      { icon: <Download size={13} />, label: `Download ${file.name}`, action: async () => {
                        try {
                          const raw = rawFiles?.find((rf) => rf.id === file.id);
                          const fileUrl = raw?.file_url;
                          if (!fileUrl) { addToast('error', 'No file URL available'); return; }
                          const storageMatch = fileUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/);
                          let blob: Blob;
                          if (storageMatch) {
                            const [, bucket, path] = storageMatch;
                            const { data, error } = await supabase.storage.from(bucket).download(path);
                            if (error || !data) { addToast('error', `Download failed: ${error?.message ?? 'unknown error'}`); return; }
                            blob = data;
                          } else {
                            const resp = await fetch(fileUrl);
                            if (!resp.ok) { addToast('error', `Download failed: ${resp.statusText}`); return; }
                            blob = await resp.blob();
                          }
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = file.name;
                          a.click();
                          URL.revokeObjectURL(url);
                          addToast('success', `Downloaded ${file.name}`);
                        } catch { addToast('error', `Failed to download ${file.name}`); }
                      } },
                      ...(hasPermission('files.delete') ? [{ icon: <Trash2 size={13} />, label: `Delete ${file.name}`, action: () => handleDeleteFile(file), danger: true }] : []),
                    ].map(({ icon, label, action, danger }) => (
                      <button
                        key={label}
                        aria-label={label}
                        onClick={(e) => { e.stopPropagation(); action(); }}
                        onFocus={(e) => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).style.outline = `2px solid ${colors.primaryOrange}`; (e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'; }}
                        onBlur={(e) => { (e.currentTarget as HTMLButtonElement).style.outline = 'none'; }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 26, height: 26,
                          border: 'none', borderRadius: borderRadius.sm,
                          backgroundColor: 'transparent', cursor: 'pointer',
                          color: danger ? colors.statusCritical : colors.textTertiary,
                          transition: `background-color ${transitions.instant}, color ${transitions.instant}`,
                          outline: 'none',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = danger ? 'rgba(239,68,68,0.08)' : colors.surfaceHover; (e.currentTarget as HTMLButtonElement).style.color = danger ? colors.statusCritical : colors.textPrimary; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = danger ? colors.statusCritical : colors.textTertiary; }}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {displayFiles.length === 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              {searchQuery ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['6']} ${spacing['4']}`, textAlign: 'center' }}>
                  <Search size={32} color={colors.textTertiary} style={{ marginBottom: spacing['3'] }} />
                  <p style={{ fontSize: typography.fontSize.body, fontWeight: 500, color: colors.textPrimary, margin: 0, marginBottom: spacing['1'] }}>
                    No files match your search
                  </p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.gray600, margin: 0 }}>
                    Try a different name or clear the search
                  </p>
                </div>
              ) : currentFolderId ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['6']} ${spacing['4']}`, textAlign: 'center' }}>
                  <Search size={32} color={colors.textTertiary} style={{ marginBottom: spacing['3'] }} />
                  <p style={{ fontSize: typography.fontSize.body, fontWeight: 500, color: colors.textPrimary, margin: 0, marginBottom: spacing['1'] }}>
                    This folder is empty
                  </p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.gray600, margin: 0 }}>
                    Drop files here or use the Upload button
                  </p>
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No files uploaded yet"
                  description="Upload project documents, drawings, and photos to keep everything organized in one place."
                  action={hasPermission('files.upload') ? { label: 'Upload Files', onClick: () => setShowUpload(true) } : undefined}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* List View with keyboard navigation */}
      {viewMode === 'list' && (
        <Card padding="0">
          <>
              {displayFiles.length === 0 && !currentFolderId && !searchQuery ? (
                <EmptyState
                  icon={FileText}
                  title="No files uploaded yet"
                  description="Upload project documents, drawings, and photos to keep everything organized in one place."
                  action={hasPermission('files.upload') ? { label: 'Upload Files', onClick: () => setShowUpload(true) } : undefined}
                />
              ) : (
                <div
                  ref={listRef}
                  tabIndex={0}
                  onKeyDown={handleKeyDown}
                  role="list"
                  aria-label="Project files"
                  style={{ outline: 'none' }}
                >
                  <DataTable
                    data={displayFiles}
                    columns={fileTableColumns}
                    enableSorting
                    selectable
                    onSelectionChange={setSelectedIds}
                    onRowClick={handleFileClick}
                    emptyMessage={searchQuery ? 'No files match your search' : 'This folder is empty'}
                  />
                </div>
              )}
            </>
        </Card>
      )}

      {/* File Preview Drawer */}
      <FilePreview file={selectedFile} onClose={() => setSelectedFile(null)} />

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
        actions={bulkActions}
        entityLabel="files"
      />

      {/* Folder Picker Modal (for Move to Folder) */}
      <FolderPickerModal
        open={folderPickerOpen}
        onOpenChange={setFolderPickerOpen}
        folders={allFolders}
        onSelect={(folder) => {
          folderPickerCallbackRef.current?.([folder.id]);
          folderPickerCallbackRef.current = null;
        }}
        title="Move to Folder"
      />
      </main>
    </PageContainer>
  );
};

export const Files: React.FC = () => (
  <ErrorBoundary message="Failed to load documents. Retry">
    <FilesPage />
  </ErrorBoundary>
);

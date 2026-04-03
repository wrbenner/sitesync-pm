import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { Grid, List, Upload as UploadIcon, FolderOpen, FileText, Sparkles, Search, Download, FolderInput, Trash2, Link2, Files as FilesIcon, FileImage, HardDrive } from 'lucide-react';
import { Card, Btn, useToast, PageContainer } from '../components/Primitives';
import { ErrorBoundary } from '../components/ErrorBoundary';
import EmptyState from '../components/ui/EmptyState';
import { TableSkeleton } from '../components/ui/Skeletons';
import { UploadZone } from '../components/files/UploadZone';
import { DocumentSearch } from '../components/files/DocumentSearch';
import { FilePreview } from '../components/files/FilePreview';
import { DataTable, createColumnHelper } from '../components/shared/DataTable';
import { BulkActionBar, FolderPickerModal } from '../components/shared/BulkActionBar';
import { FolderBreadcrumbs } from '../components/Breadcrumbs';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme';
import { useProjectId } from '../hooks/useProjectId';
import { useFiles } from '../hooks/queries';
import { useCreateFile } from '../hooks/mutations';
import { PermissionGate } from '../components/auth/PermissionGate';
import { useTableKeyboardNavigation } from '../hooks/useTableKeyboardNavigation';

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
  if (file.type === 'folder') return null;
  if (file.name.includes('Structural') || file.name.includes('Calculations'))
    return { label: 'Approved', color: colors.statusActive };
  if (file.name.includes('MEP') || file.name.includes('Spec'))
    return { label: 'Pending Review', color: colors.statusPending };
  return { label: 'Draft', color: colors.textTertiary };
};

const _FilesPage: React.FC = () => {
  const { addToast } = useToast();
  const projectId = useProjectId();
  const createFile = useCreateFile();
  const { data: rawFiles, isPending: loading, isError, error, refetch } = useFiles(projectId);

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
    const drawings = all.filter((f: any) => f.category === 'drawing' || (f.file_type && String(f.file_type).includes('pdf'))).length;
    const weekAgo = Date.now() - 7 * 86400000;
    const recentUploads = all.filter((f: any) => {
      const ts = f.uploaded_at || f.created_at;
      return ts && new Date(ts).getTime() > weekAgo;
    }).length;
    const totalBytes = all.reduce((sum: number, f: any) => sum + (f.file_size_bytes || 0), 0);
    return { totalFiles, drawings, recentUploads, totalBytes };
  }, [rawFiles]);

  // ── Accessibility live region ─────────────────────────
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  // ── View mode ─────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  // ── Folder navigation ─────────────────────────────────
  // Stack of { id, name } for the current folder path. Empty = root.
  const [folderStack, setFolderStack] = useState<Array<{ id: string; name: string }>>([]);
  const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : null;

  const visibleFiles = useMemo(() => {
    return files.filter((f: FileItem) => (f.parent_id ?? null) === currentFolderId);
  }, [files, currentFolderId]);

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

  const handleInternalDrop = useCallback((targetFolderId: string) => {
    const sourceId = draggingFileIdRef.current;
    draggingFileIdRef.current = null;
    setDragOverFolderId(null);
    if (!sourceId || sourceId === targetFolderId) return;
    // In a real app, call an API to reparent the file. Here we just toast.
    const source = files.find((f: FileItem) => f.id === sourceId);
    const target = files.find((f: FileItem) => f.id === targetFolderId);
    if (source && target) {
      addToast('success', `Moved "${source.name}" into "${target.name}"`);
    }
  }, [files, addToast]);

  // ── Row selection ─────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
        selected.forEach((f: FileItem) => {
          if (f.type !== 'folder') {
            // In a real app, fetch blob from storage URL. Stub placeholder content here.
            zip.file(f.name, `Placeholder content for ${f.name}`);
          }
        });
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sitesync-documents.zip';
        a.click();
        URL.revokeObjectURL(url);
        addToast('success', `Downloaded ${selected.length} file${selected.length !== 1 ? 's' : ''} as ZIP`);
      },
    },
    {
      label: 'Move to Folder',
      icon: <FolderInput size={14} />,
      variant: 'secondary' as const,
      onClick: async (ids: string[]) => {
        return new Promise<void>((resolve) => {
          folderPickerCallbackRef.current = async (pickedIds) => {
            void pickedIds;
            // In a real app, call API to reparent files to selectedFolder.id
            addToast('success', `Moved ${ids.length} item${ids.length !== 1 ? 's' : ''}`);
            resolve();
          };
          setFolderPickerOpen(true);
        });
      },
    },
    {
      label: 'Delete',
      icon: <Trash2 size={14} />,
      variant: 'danger' as const,
      confirm: true,
      confirmMessage: `This will permanently delete the selected files. This action cannot be undone.`,
      onClick: async (ids: string[]) => {
        // In a real app, call API to delete each file.
        addToast('success', `Deleted ${ids.length} item${ids.length !== 1 ? 's' : ''}`);
      },
    },
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
  ], [files, addToast]);

  // ── Keyboard navigation for list view ────────────────
  const listRef = useRef<HTMLDivElement>(null);
  const listRows = viewMode === 'list' ? visibleFiles : [];
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

  const handleUpload = async (fileName: string) => {
    try {
      await createFile.mutateAsync({ projectId: projectId!, data: { project_id: projectId!, name: fileName, content_type: 'application/octet-stream' } });
      addToast('success', `Uploaded ${fileName}`);
      setLiveAnnouncement('File uploaded successfully');
    } catch { addToast('error', `Failed to upload ${fileName}`); }
  };

  const handleDeleteFile = useCallback((file: FileItem) => {
    if (!window.confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
    // In a real app, call delete API here.
    addToast('success', `Deleted ${file.name}`);
    setLiveAnnouncement('File deleted');
  }, [addToast]);

  // ── Columns ───────────────────────────────────────────
  const columnHelper = createColumnHelper<FileItem>();

  const fileTableColumns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (info) => {
        const file = info.row.original;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
            {file.type === 'folder' ? (
              <FolderOpen size={16} color={colors.primaryOrange} />
            ) : (
              <FileText size={16} color={colors.textTertiary} />
            )}
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
      backgroundColor: '#E5E7EB',
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
      <div onDragEnter={handlePageDragEnter}>
      {/* Accessibility live region */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', left: -9999, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}
      >
        {liveAnnouncement}
      </div>

      {/* Summary metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing.md, marginBottom: spacing['4'] }}>
        {[
          { label: 'Total Files', value: metrics.totalFiles, icon: <FilesIcon size={20} color={colors.primaryOrange} /> },
          { label: 'Drawings', value: metrics.drawings, icon: <FileImage size={20} color={colors.statusInfo} /> },
          { label: 'This Week', value: metrics.recentUploads, icon: <UploadIcon size={20} color={colors.statusActive} /> },
          { label: 'Total Size', value: formatBytes(metrics.totalBytes), icon: <HardDrive size={20} color={colors.textSecondary} /> },
        ].map(({ label, value, icon }) => (
          <div key={label} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>{label}</span>
              {icon}
            </div>
            <span style={{ fontSize: 28, fontWeight: typography.fontWeight.bold, color: colors.textPrimary, lineHeight: 1 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* AI insight banner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, marginBottom: spacing['4'], backgroundColor: colors.statusReviewSubtle, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusReview}` }}>
        <Sparkles size={14} color={colors.statusReview} style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0, lineHeight: 1.5 }}>
          Documentation coverage at 84%. Missing: updated MEP coordination drawings and revised fire protection submittals.
        </p>
      </div>

      {/* Folder breadcrumbs */}
      <FolderBreadcrumbs stack={folderStack} onNavigate={navigateToBreadcrumb} />

      {/* Document Search */}
      <div style={{ marginBottom: spacing['4'] }}>
        <DocumentSearch
          inputId="file-search-input"
          ariaLabel="Search files"
          ariaControls="file-search-results"
          onSelect={(result) => {
            const match = files.find((f: FileItem) => f.name === result.name);
            if (match) {
              setSelectedFile(match);
              setLiveAnnouncement(`Opening ${result.name}`);
            } else {
              addToast('info', `Opening ${result.name}`);
            }
          }}
        />
      </div>

      {/* Collapsible Upload Zone */}
      {showUpload && (
        <div style={{ marginBottom: spacing['5'] }}>
          <Card>
            <UploadZone onUpload={handleUpload} />
          </Card>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div role="grid" aria-label="Project files" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'] }}>
          {visibleFiles.map((file: FileItem) => {
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
                  } else if (e.key === 'Delete') {
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
                  {file.type === 'folder'
                    ? <FolderOpen size={36} color={colors.primaryOrange} />
                    : <FileText size={36} color="rgba(255,255,255,0.6)" />
                  }
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
                      { icon: <Download size={13} />, label: `Download ${file.name}`, action: () => { addToast('info', `Downloading ${file.name}`); } },
                      { icon: <Trash2 size={13} />, label: `Delete ${file.name}`, action: () => handleDeleteFile(file), danger: true },
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
          {visibleFiles.length === 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              {currentFolderId ? (
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
                  action={{ label: 'Upload Files', onClick: () => setShowUpload(true) }}
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
              {visibleFiles.length === 0 && !currentFolderId ? (
                <EmptyState
                  icon={FileText}
                  title="No files uploaded yet"
                  description="Upload project documents, drawings, and photos to keep everything organized in one place."
                  action={{ label: 'Upload Files', onClick: () => setShowUpload(true) }}
                />
              ) : (
                <div
                  ref={listRef}
                  tabIndex={0}
                  onKeyDown={handleKeyDown}
                  style={{ outline: 'none' }}
                >
                  <DataTable
                    data={visibleFiles}
                    columns={fileTableColumns}
                    enableSorting
                    selectable
                    onSelectionChange={setSelectedIds}
                    onRowClick={handleFileClick}
                    emptyMessage="This folder is empty"
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
      </div>
    </PageContainer>
  );
};

export const Files: React.FC = () => (
  <ErrorBoundary message="Failed to load documents. Retry">
    <_FilesPage />
  </ErrorBoundary>
);

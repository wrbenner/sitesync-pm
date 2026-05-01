import React, { useRef } from 'react';
import { Grid, List, Search, Download, FolderInput, Trash2, Link2, Sparkles } from 'lucide-react';
import { Card } from '../../components/Primitives';
import { DataTable, createColumnHelper } from '../../components/shared/DataTable';
import { BulkActionBar, FolderPickerModal } from '../../components/shared/BulkActionBar';
import { FolderBreadcrumbs } from '../../components/Breadcrumbs';
import EmptyState from '../../components/ui/EmptyState';
import { FileText } from 'lucide-react';
import JSZip from 'jszip';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { usePermissions } from '../../hooks/usePermissions';
import { useTableKeyboardNavigation } from '../../hooks/useTableKeyboardNavigation';
import { type FileItem, getGradient, getApprovalStatus, getFileTypeIcon, formatBytes } from './fileTypes';

type ViewMode = 'list' | 'grid';

interface FileGridProps {
  displayFiles: FileItem[];
  visibleFiles: FileItem[];
  files: FileItem[];
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  folderStack: Array<{ id: string; name: string }>;
  currentFolderId: string | null;
  navigateToFolder: (id: string, name: string) => void;
  navigateToBreadcrumb: (index: number) => void;
  handleFileClick: (file: FileItem) => void;
  handleDeleteFile: (file: FileItem) => void;
  addToast: (type: string, message: string) => void;
  showUpload: boolean;
  setShowUpload: (v: boolean) => void;
  handleInternalDragStart: (id: string) => void;
  handleInternalDrop: (targetId: string) => void;
  dragOverFolderId: string | null;
  setDragOverFolderId: (id: string | null) => void;
  draggingFileIdRef: React.MutableRefObject<string | null>;
  liveAnnouncement: string;
  uploadAnnouncement: string;
  uploadZoneNode: React.ReactNode;
}

export const FileGrid: React.FC<FileGridProps> = ({
  displayFiles,
  visibleFiles,
  files,
  viewMode,
  setViewMode,
  searchQuery,
  setSearchQuery,
  folderStack,
  currentFolderId,
  navigateToFolder,
  navigateToBreadcrumb,
  handleFileClick,
  handleDeleteFile,
  addToast,
  showUpload,
  setShowUpload,
  handleInternalDragStart,
  handleInternalDrop,
  dragOverFolderId,
  setDragOverFolderId,
  draggingFileIdRef,
  liveAnnouncement,
  uploadAnnouncement,
  uploadZoneNode,
}) => {
  const { hasPermission } = usePermissions();
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [folderPickerOpen, setFolderPickerOpen] = React.useState(false);
  const folderPickerCallbackRef = useRef<((ids: string[]) => void) | null>(null);

  const allFolders = files.filter((f) => f.type === 'folder').map((f) => ({ id: f.id, name: f.name }));

  const bulkActions = React.useMemo(() => [
    {
      label: 'Download ZIP',
      icon: <Download size={14} />,
      variant: 'secondary' as const,
      onClick: async (ids: string[]) => {
        const zip = new JSZip();
        const selected = files.filter((f) => ids.includes(f.id));
        selected.forEach((f) => { if (f.type !== 'folder') zip.file(f.name, `Placeholder content for ${f.name}`); });
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'sitesync-documents.zip'; a.click();
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
          folderPickerCallbackRef.current = async () => {
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
      confirmMessage: 'This will permanently delete the selected files. This action cannot be undone.',
      onClick: async (ids: string[]) => {
        addToast('success', `Deleted ${ids.length} item${ids.length !== 1 ? 's' : ''}`);
      },
    },
    {
      label: 'Copy Link',
      icon: <Link2 size={14} />,
      variant: 'secondary' as const,
      onClick: async (ids: string[]) => {
        const links = ids.map((id) => `${window.location.origin}/files/${id}`).join('\n');
        try {
          await navigator.clipboard.writeText(links);
          addToast('success', `Copied ${ids.length} link${ids.length !== 1 ? 's' : ''} to clipboard`);
        } catch {
          addToast('error', 'Could not access clipboard. Tap a link to copy manually.');
        }
      },
    },
  ], [files, addToast]);

  // List view keyboard nav
  const listRef = useRef<HTMLDivElement>(null);
  const listRows = viewMode === 'list' ? displayFiles : [];
  const { focusedIndex, handleKeyDown } = useTableKeyboardNavigation({
    rowCount: listRows.length,
    onActivate: (i) => {
      const f = listRows[i];
      if (!f) return;
      if (f.type === 'folder') navigateToFolder(f.id, f.name);
      else handleFileClick(f);
    },
    onToggleSelect: (i) => {
      const f = listRows[i];
      if (!f) return;
      setSelectedIds((prev) => prev.includes(f.id) ? prev.filter((id) => id !== f.id) : [...prev, f.id]);
    },
  });

  React.useEffect(() => {
    if (viewMode !== 'list') return;
    if (!listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(`[data-row-index="${focusedIndex}"]`);
    if (row && listRef.current.contains(document.activeElement)) row.focus({ preventScroll: false });
  }, [focusedIndex, viewMode]);

  // Column helper for list view
  const columnHelper = createColumnHelper<FileItem>();
  const fileTableColumns = React.useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (info) => {
        const file = info.row.original;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
            {getFileTypeIcon(file, 16)}
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{file.name}</span>
          </div>
        );
      },
    }),
    columnHelper.accessor('type', {
      header: 'Type',
      size: 100,
      cell: (info) => <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, textTransform: 'capitalize' }}>{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: 'sizeCount',
      header: 'Size / Count',
      size: 150,
      cell: (info) => {
        const file = info.row.original;
        if (file.type !== 'folder') return <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{file.size}</span>;
        const isEmpty = file.itemCount === 0;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: typography.fontSize.sm, color: isEmpty ? colors.textTertiary : colors.textSecondary, fontStyle: isEmpty ? 'italic' : 'normal' }}>{file.itemCount} {file.itemCount === 1 ? 'item' : 'items'}</span>
            {file.totalSize != null && file.totalSize > 0 && <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{formatBytes(file.totalSize)}</span>}
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
        const date = file.type === 'folder' && file.lastModified ? new Date(file.lastModified).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : file.modifiedDate;
        return <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>{date || '—'}</span>;
      },
    }),
    columnHelper.display({
      id: 'status',
      header: 'Status',
      size: 110,
      cell: (info) => {
        const approval = getApprovalStatus(info.row.original);
        if (!approval) return <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>—</span>;
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['1'] }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: approval.color }} />
            <span style={{ fontSize: typography.fontSize.caption, color: approval.color, fontWeight: typography.fontWeight.medium }}>{approval.label}</span>
          </div>
        );
      },
    }),
  ], []);

  return (
    <>
      {/* Accessibility live regions */}
      <div aria-live="polite" aria-atomic="true" style={{ position: 'absolute', left: -9999, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>{liveAnnouncement}</div>
      <div aria-live="assertive" aria-atomic="true" style={{ position: 'absolute', left: -9999, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>{uploadAnnouncement}</div>

      {/* View mode toggle — rendered here for layout, buttons are in parent PageContainer actions */}
      <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', marginBottom: spacing['4'], justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, padding: '2px' }}>
          {(['grid', 'list'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              aria-label={mode === 'grid' ? 'Grid view' : 'List view'}
              aria-pressed={viewMode === mode}
              onClick={() => setViewMode(mode)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 28, border: 'none', borderRadius: borderRadius.base, cursor: 'pointer', backgroundColor: viewMode === mode ? colors.surfaceRaised : 'transparent', boxShadow: viewMode === mode ? shadows.sm : 'none', color: viewMode === mode ? colors.textPrimary : colors.textTertiary, transition: `all ${transitions.instant}` }}
            >
              {mode === 'grid' ? <Grid size={14} /> : <List size={14} />}
            </button>
          ))}
        </div>
      </div>

      <FolderBreadcrumbs stack={folderStack} onNavigate={navigateToBreadcrumb} />

      {/* Search */}
      <div style={{ marginBottom: spacing['4'], display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, border: `1px solid ${searchQuery ? colors.borderFocus : 'transparent'}`, transition: 'border-color 120ms ease' }}>
        <Search size={16} color={colors.textTertiary} />
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search files across all folders..." aria-label="Search files" style={{ flex: 1, border: 'none', backgroundColor: 'transparent', outline: 'none', fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, color: colors.textPrimary }} />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} aria-label="Clear search" style={{ display: 'flex', alignItems: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textTertiary, padding: 2, lineHeight: 1 }}>&#x2715;</button>
        )}
      </div>

      {/* Upload zone */}
      {(showUpload || (visibleFiles.length === 0 && !searchQuery)) && (
        <div style={{ marginBottom: spacing['5'] }}>
          <Card>{uploadZoneNode}</Card>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div role="grid" aria-label="Project files" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'] }}>
          {displayFiles.map((file) => {
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
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFileClick(file); }
                  else if (e.key === 'Delete' && hasPermission('files.delete')) { e.preventDefault(); handleDeleteFile(file); }
                }}
                onFocus={(e) => { (e.currentTarget as HTMLDivElement).style.outline = `2px solid ${colors.primaryOrange}`; (e.currentTarget as HTMLDivElement).style.outlineOffset = '2px'; }}
                onBlur={(e) => { (e.currentTarget as HTMLDivElement).style.outline = selectedIds.includes(file.id) ? `2px solid ${colors.primaryOrange}` : 'none'; (e.currentTarget as HTMLDivElement).style.outlineOffset = '1px'; }}
                style={{ backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg, boxShadow: isDropTarget ? `0 0 0 2px ${colors.primaryOrange}` : shadows.card, cursor: 'pointer', overflow: 'hidden', transition: `box-shadow ${transitions.quick}, transform ${transitions.quick}`, outline: selectedIds.includes(file.id) ? `2px solid ${colors.primaryOrange}` : 'none', outlineOffset: 1 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = isDropTarget ? `0 0 0 2px ${colors.primaryOrange}` : shadows.cardHover; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = isDropTarget ? `0 0 0 2px ${colors.primaryOrange}` : shadows.card; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
              >
                {/* Thumbnail */}
                <div role="gridcell" style={{ height: '120px', background: getGradient(file), display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {getFileTypeIcon(file, 36)}
                  {/* Checkbox */}
                  <div role="checkbox" aria-checked={selectedIds.includes(file.id)} aria-label={`Select ${file.name}`} tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setSelectedIds((prev) => prev.includes(file.id) ? prev.filter((id) => id !== file.id) : [...prev, file.id]); }}
                    onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); setSelectedIds((prev) => prev.includes(file.id) ? prev.filter((id) => id !== file.id) : [...prev, file.id]); } }}
                    onFocus={(e) => { e.stopPropagation(); (e.currentTarget as HTMLDivElement).style.outline = `2px solid ${colors.primaryOrange}`; }}
                    onBlur={(e) => { (e.currentTarget as HTMLDivElement).style.outline = 'none'; }}
                    style={{ position: 'absolute', top: spacing['2'], left: spacing['2'], width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: selectedIds.includes(file.id) ? colors.primaryOrange : 'rgba(255,255,255,0.8)', borderRadius: borderRadius.sm, border: `1.5px solid ${selectedIds.includes(file.id) ? colors.primaryOrange : colors.borderDefault}`, cursor: 'pointer', transition: `all ${transitions.instant}`, outline: 'none' }}
                  >
                    {selectedIds.includes(file.id) && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  {approval && <div style={{ position: 'absolute', top: spacing['2'], right: spacing['2'], width: 8, height: 8, borderRadius: '50%', backgroundColor: approval.color, border: `2px solid ${file.type === 'folder' ? colors.surfaceRaised : 'rgba(255,255,255,0.4)'}` }} />}
                </div>

                {/* Info */}
                <div role="gridcell" style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                  <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing['2'] }}>
                    {file.type === 'folder' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: typography.fontSize.caption, color: file.itemCount === 0 ? colors.textTertiary : colors.primaryOrange, fontStyle: file.itemCount === 0 ? 'italic' : 'normal' }}>{file.itemCount} {file.itemCount === 1 ? 'item' : 'items'}</span>
                        {file.totalSize != null && file.totalSize > 0 && <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{formatBytes(file.totalSize)}</span>}
                      </div>
                    ) : (
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{file.size}</span>
                    )}
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                      {file.type === 'folder' && file.lastModified ? new Date(file.lastModified).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : file.modifiedDate}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {file.type !== 'folder' && (
                  <div role="gridcell" style={{ display: 'flex', gap: spacing['1'], padding: `0 ${spacing['3']} ${spacing['3']}`, justifyContent: 'flex-end' }}>
                    {[
                      { icon: <Sparkles size={13} />, label: `Preview ${file.name}`, action: () => handleFileClick(file) },
                      { icon: <Download size={13} />, label: `Download ${file.name}`, action: () => addToast('info', `Downloading ${file.name}`) },
                      ...(hasPermission('files.delete') ? [{ icon: <Trash2 size={13} />, label: `Delete ${file.name}`, action: () => handleDeleteFile(file), danger: true }] : []),
                    ].map(({ icon, label, action, danger }) => (
                      <button key={label} aria-label={label} onClick={(e) => { e.stopPropagation(); action(); }}
                        onFocus={(e) => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).style.outline = `2px solid ${colors.primaryOrange}`; (e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px'; }}
                        onBlur={(e) => { (e.currentTarget as HTMLButtonElement).style.outline = 'none'; }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, border: 'none', borderRadius: borderRadius.sm, backgroundColor: 'transparent', cursor: 'pointer', color: danger ? colors.statusCritical : colors.textTertiary, transition: `background-color ${transitions.instant}, color ${transitions.instant}`, outline: 'none' }}
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
                  <p style={{ fontSize: typography.fontSize.body, fontWeight: 500, color: colors.textPrimary, margin: 0, marginBottom: spacing['1'] }}>No files match your search</p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.gray600, margin: 0 }}>Try a different name or clear the search</p>
                </div>
              ) : currentFolderId ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['6']} ${spacing['4']}`, textAlign: 'center' }}>
                  <Search size={32} color={colors.textTertiary} style={{ marginBottom: spacing['3'] }} />
                  <p style={{ fontSize: typography.fontSize.body, fontWeight: 500, color: colors.textPrimary, margin: 0, marginBottom: spacing['1'] }}>This folder is empty</p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.gray600, margin: 0 }}>Drop files here or use the Upload button</p>
                </div>
              ) : (
                <EmptyState icon={FileText} title="No files uploaded yet" description="Upload project documents, drawings, and photos to keep everything organized in one place." action={{ label: 'Upload Files', onClick: () => setShowUpload(true) }} />
              )}
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <Card padding="0">
          <>
            {displayFiles.length === 0 && !currentFolderId && !searchQuery ? (
              <EmptyState icon={FileText} title="No files uploaded yet" description="Upload project documents, drawings, and photos to keep everything organized in one place." action={{ label: 'Upload Files', onClick: () => setShowUpload(true) }} />
            ) : (
              <div ref={listRef} tabIndex={0} onKeyDown={handleKeyDown} role="list" aria-label="Project files" style={{ outline: 'none' }}>
                <DataTable data={displayFiles} columns={fileTableColumns} enableSorting selectable onSelectionChange={setSelectedIds} onRowClick={handleFileClick} emptyMessage={searchQuery ? 'No files match your search' : 'This folder is empty'} />
              </div>
            )}
          </>
        </Card>
      )}

      <BulkActionBar selectedIds={selectedIds} onClearSelection={() => setSelectedIds([])} actions={bulkActions} entityLabel="files" />

      <FolderPickerModal
        open={folderPickerOpen}
        onOpenChange={setFolderPickerOpen}
        folders={allFolders}
        onSelect={(folder) => { folderPickerCallbackRef.current?.([folder.id]); folderPickerCallbackRef.current = null; }}
        title="Move to Folder"
      />
    </>
  );
};

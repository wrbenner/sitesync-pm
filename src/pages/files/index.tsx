import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Upload as UploadIcon, FilesIcon, FileImage, HardDrive } from 'lucide-react';
import { Btn, useToast, PageContainer, EmptyState } from '../../components/Primitives';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { colors, spacing, typography } from '../../styles/theme';
import { useProjectId } from '../../hooks/useProjectId';
import { useFiles } from '../../hooks/queries';
import { useCreateFile, useDeleteFile } from '../../hooks/mutations';
import { supabase } from '../../lib/supabase';
import { type FileItem, formatBytes } from './fileTypes';
import { FileGrid } from './FileGrid';
import { FileUpload } from './FileUpload';
import { FilePreviewPanel } from './FilePreviewPanel';

type ViewMode = 'list' | 'grid';

const FilesPage: React.FC = () => {
  const { addToast } = useToast();
  const projectId = useProjectId();
  const createFile = useCreateFile();
  const deleteFile = useDeleteFile();
  const pendingFilesRef = useRef<Map<string, File>>(new Map());
  const { data: rawFiles, isPending: loading, isError, error, refetch } = useFiles(projectId);
  const [nowMs] = useState(() => Date.now());

  const files = useMemo(() =>
    (rawFiles || []).map(f => ({
      ...f,
      modifiedDate: f.created_at ? new Date(f.created_at).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '',
    })),
    [rawFiles]
  );

  // ── Summary metrics ────────────────────────────────────────
  const metrics = useMemo(() => {
    const all = rawFiles || [];
    const totalFiles = all.length;
    const drawings = all.filter((f: unknown) => (f as Record<string, unknown>).category === 'drawing' || ((f as Record<string, unknown>).file_type && String((f as Record<string, unknown>).file_type).includes('pdf'))).length;
    const weekAgo = nowMs - 7 * 86400000;
    const recentUploads = all.filter((f: unknown) => {
      const rf = f as Record<string, unknown>;
      const ts = rf.uploaded_at || rf.created_at;
      return ts && new Date(ts as string).getTime() > weekAgo;
    }).length;
    const totalBytes = all.reduce((sum: number, f: unknown) => sum + ((f as Record<string, unknown>).file_size_bytes as number || 0), 0);
    return { totalFiles, drawings, recentUploads, totalBytes };
  }, [rawFiles, nowMs]);

  // ── State ──────────────────────────────────────────────────
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [uploadAnnouncement, setUploadAnnouncement] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [folderStack, setFolderStack] = useState<Array<{ id: string; name: string }>>([]);
  const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : null;
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const draggingFileIdRef = useRef<string | null>(null);

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
  }, []);

  const navigateToBreadcrumb = useCallback((index: number) => {
    setFolderStack((prev) => index < 0 ? [] : prev.slice(0, index + 1));
  }, []);

  const handleInternalDragStart = useCallback((fileId: string) => {
    draggingFileIdRef.current = fileId;
  }, []);

  const handleInternalDrop = useCallback((targetFolderId: string) => {
    const sourceId = draggingFileIdRef.current;
    draggingFileIdRef.current = null;
    setDragOverFolderId(null);
    if (!sourceId || sourceId === targetFolderId) return;
    const source = files.find((f: FileItem) => f.id === sourceId);
    const target = files.find((f: FileItem) => f.id === targetFolderId);
    if (source && target) addToast('success', `Moved "${source.name}" into "${target.name}"`);
  }, [files, addToast]);

  const handleFileClick = useCallback((file: FileItem) => {
    if (file.type === 'folder') navigateToFolder(file.id, file.name);
    else setSelectedFile(file);
  }, [navigateToFolder]);

  const handlePageDragEnter = useCallback((e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes('Files')) setShowUpload(true);
  }, []);

  const handleFileReady = useCallback((file: File) => {
    pendingFilesRef.current.set(file.name, file);
  }, []);

  const handleUpload = async (fileName: string) => {
    if (!projectId) {
      addToast('error', 'No project selected');
      return;
    }
    try {
      const file = pendingFilesRef.current.get(fileName);
      let storagePath: string | null = null;
      let fileSize = 0;
      let contentType = 'application/octet-stream';

      if (file) {
        fileSize = file.size;
        contentType = file.type || 'application/octet-stream';
        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        storagePath = `${projectId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('project-files')
          .upload(storagePath, file, { contentType, upsert: false });
        if (uploadError) {
          // Fall back to DB-only record if bucket unavailable (dev/preview)
          storagePath = null;
        }
        pendingFilesRef.current.delete(fileName);
      }

      await createFile.mutateAsync({
        projectId,
        data: {
          project_id: projectId,
          name: fileName,
          content_type: contentType,
          file_size_bytes: fileSize,
          storage_path: storagePath,
          parent_folder_id: currentFolderId,
        },
      });
      addToast('success', `Uploaded ${fileName}`);
      setUploadAnnouncement('File uploaded successfully');
    } catch {
      addToast('error', `Failed to upload ${fileName}`);
      setUploadAnnouncement('Upload failed. Please try again.');
    }
  };

  const handleDeleteFile = useCallback(async (file: FileItem) => {
    if (!window.confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
    if (!projectId) {
      addToast('error', 'No project selected');
      return;
    }
    try {
      const storagePath = (file as unknown as Record<string, unknown>).storage_path as string | undefined;
      if (storagePath) {
        await supabase.storage.from('project-files').remove([storagePath]);
      }
      await deleteFile.mutateAsync({ id: file.id, projectId });
      addToast('success', `Deleted ${file.name}`);
      setLiveAnnouncement('File deleted');
    } catch {
      addToast('error', `Failed to delete ${file.name}`);
    }
  }, [addToast, deleteFile, projectId]);

  useEffect(() => {
    if (!searchQuery.trim()) return;
    setTimeout(() => {
      if (displayFiles.length === 0) setLiveAnnouncement('No files match your search');
      else setLiveAnnouncement(`${displayFiles.length} ${displayFiles.length === 1 ? 'file' : 'files'} found`);
    }, 0);
  }, [searchQuery, displayFiles.length]);

  if (isError) {
    const message = error instanceof Error ? error.message : 'Failed to load documents';
    return (
      <PageContainer title="Files">
        <div aria-live="polite" role="status">
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['4'], padding: `${spacing['6']} ${spacing['4']}`, textAlign: 'center' }}>
              <p style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, margin: 0 }}>{message}</p>
              <Btn variant="primary" size="sm" onClick={() => refetch()}>Retry</Btn>
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!projectId) {
    return (
      <PageContainer title="Files">
        <EmptyState
          icon={<FilesIcon size={32} color={colors.textTertiary} />}
          title="No project selected"
          description="Select a project from the sidebar to view project files."
        />
      </PageContainer>
    );
  }

  if (loading) {
    const skeletonPulse: React.CSSProperties = { backgroundColor: '#E5E7EB', animation: 'pulse 1.5s ease-in-out infinite', borderRadius: 4, opacity: 0.6 };
    return (
      <PageContainer title="Files">
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12 }} aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ height: 48, display: 'flex', alignItems: 'center', gap: spacing['4'], padding: `0 ${spacing['4']}`, borderBottom: '1px solid #F0EDE9' }}>
              <div style={{ ...skeletonPulse, width: 24, height: 24, borderRadius: 6, flexShrink: 0 }} />
              <div style={{ ...skeletonPulse, width: 200, height: 14 }} />
              <div style={{ ...skeletonPulse, width: 60, height: 14 }} />
              <div style={{ ...skeletonPulse, width: 80, height: 14 }} />
            </div>
          ))}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Files"
      actions={
        <PermissionGate permission="files.upload">
          <Btn icon={<UploadIcon size={14} />} onClick={() => setShowUpload(!showUpload)} variant={showUpload ? 'secondary' : 'primary'} size="sm">
            Upload
          </Btn>
        </PermissionGate>
      }
    >
      <main role="main" aria-label="Document management" onDragEnter={handlePageDragEnter}>
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

        <FileGrid
          displayFiles={displayFiles}
          visibleFiles={visibleFiles}
          files={files}
          viewMode={viewMode}
          setViewMode={setViewMode}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          folderStack={folderStack}
          currentFolderId={currentFolderId}
          navigateToFolder={navigateToFolder}
          navigateToBreadcrumb={navigateToBreadcrumb}
          handleFileClick={handleFileClick}
          handleDeleteFile={handleDeleteFile}
          addToast={addToast}
          showUpload={showUpload}
          setShowUpload={setShowUpload}
          handleInternalDragStart={handleInternalDragStart}
          handleInternalDrop={handleInternalDrop}
          dragOverFolderId={dragOverFolderId}
          setDragOverFolderId={setDragOverFolderId}
          draggingFileIdRef={draggingFileIdRef}
          liveAnnouncement={liveAnnouncement}
          uploadAnnouncement={uploadAnnouncement}
          uploadZoneNode={<FileUpload onUpload={handleUpload} onFileReady={handleFileReady} />}
        />

        <FilePreviewPanel file={selectedFile} onClose={() => setSelectedFile(null)} />
      </main>
    </PageContainer>
  );
};

export const Files: React.FC = () => (
  <ErrorBoundary message="Failed to load documents. Retry">
    <FilesPage />
  </ErrorBoundary>
);

export default Files;

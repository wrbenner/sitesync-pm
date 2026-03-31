import React, { useState, useMemo } from 'react';
import { Grid, List, Upload as UploadIcon, FolderOpen, FileText, Sparkles, Search } from 'lucide-react';
import { Card, Btn, Skeleton, useToast, PageContainer } from '../components/Primitives';
import { UploadZone } from '../components/files/UploadZone';
import { DocumentSearch } from '../components/files/DocumentSearch';
import { FilePreview } from '../components/files/FilePreview';
import { DataTable, createColumnHelper } from '../components/shared/DataTable';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme';
import { useProjectId } from '../hooks/useProjectId';
import { useFiles } from '../hooks/queries';
import { useCreateFile } from '../hooks/mutations';
import { PermissionGate } from '../components/auth/PermissionGate';

type ViewMode = 'list' | 'grid';

interface FileItem {
  id: string;
  name: string;
  type: string;
  size?: string;
  itemCount?: number;
  modifiedDate: string;
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

export const Files: React.FC = () => {
  const { addToast } = useToast();
  const projectId = useProjectId();
  const createFile = useCreateFile();
  const { data: rawFiles, isPending: loading } = useFiles(projectId);

  const files = useMemo(() =>
    (rawFiles || []).map(f => ({
      ...f,
      type: f.folder ? 'folder' : (f.content_type || 'file'),
      size: f.file_size ? `${(f.file_size / (1024 * 1024)).toFixed(1)} MB` : undefined,
      itemCount: f.folder ? undefined : undefined,
      modifiedDate: f.created_at ? new Date(f.created_at).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '',
    })),
    [rawFiles]
  );

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  const handleFileClick = (file: FileItem) => {
    setSelectedFile(file);
  };

  const handleUpload = async (fileName: string) => {
    try {
      await createFile.mutateAsync({ projectId: projectId!, data: { project_id: projectId!, name: fileName, content_type: 'application/octet-stream' } })
      addToast('success', `Uploaded ${fileName}`)
    } catch { addToast('error', `Failed to upload ${fileName}`) }
  };

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
            <span
              style={{
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.medium,
                color: colors.textPrimary,
              }}
            >
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
        <span
          style={{
            fontSize: typography.fontSize.sm,
            color: colors.textSecondary,
            textTransform: 'capitalize' as const,
          }}
        >
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'sizeCount',
      header: 'Size / Count',
      size: 130,
      cell: (info) => {
        const file = info.row.original;
        return (
          <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
            {file.type === 'folder' ? `${file.itemCount} items` : file.size}
          </span>
        );
      },
    }),
    columnHelper.accessor('modifiedDate', {
      header: 'Modified',
      size: 120,
      cell: (info) => (
        <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'status',
      header: 'Status',
      size: 110,
      cell: (info) => {
        const approval = getApprovalStatus(info.row.original);
        if (!approval) {
          return (
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              &mdash;
            </span>
          );
        }
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['1'] }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: approval.color,
              }}
            />
            <span style={{ fontSize: typography.fontSize.caption, color: approval.color, fontWeight: typography.fontWeight.medium }}>
              {approval.label}
            </span>
          </div>
        );
      },
    }),
  ], []);

  // Loading state
  if (loading || !files) {
    return (
      <PageContainer
        title="Files"
        actions={
          <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
            <Skeleton width="72px" height="32px" />
            <Skeleton width="100px" height="32px" />
          </div>
        }
      >
        <div style={{ marginBottom: spacing['5'] }}>
          <Skeleton width="100%" height="44px" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'] }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <Skeleton width="100%" height="120px" />
              <div style={{ marginTop: spacing['3'] }}>
                <Skeleton width="70%" height="14px" />
              </div>
              <div style={{ marginTop: spacing['2'], display: 'flex', justifyContent: 'space-between' }}>
                <Skeleton width="40%" height="12px" />
                <Skeleton width="30%" height="12px" />
              </div>
            </Card>
          ))}
        </div>
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
            <button
              onClick={() => setViewMode('grid')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 28,
                border: 'none',
                borderRadius: borderRadius.base,
                cursor: 'pointer',
                backgroundColor: viewMode === 'grid' ? colors.surfaceRaised : 'transparent',
                boxShadow: viewMode === 'grid' ? shadows.sm : 'none',
                color: viewMode === 'grid' ? colors.textPrimary : colors.textTertiary,
                transition: `all ${transitions.instant}`,
              }}
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 28,
                border: 'none',
                borderRadius: borderRadius.base,
                cursor: 'pointer',
                backgroundColor: viewMode === 'list' ? colors.surfaceRaised : 'transparent',
                boxShadow: viewMode === 'list' ? shadows.sm : 'none',
                color: viewMode === 'list' ? colors.textPrimary : colors.textTertiary,
                transition: `all ${transitions.instant}`,
              }}
            >
              <List size={14} />
            </button>
          </div>

          {/* Upload button */}
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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, marginBottom: spacing['4'], backgroundColor: colors.statusReviewSubtle, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusReview}` }}>
        <Sparkles size={14} color={colors.statusReview} style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0, lineHeight: 1.5 }}>
          Documentation coverage at 84%. Missing: updated MEP coordination drawings and revised fire protection submittals.
        </p>
      </div>
      {/* Document Search */}
      <div style={{ marginBottom: spacing['4'] }}>
        <DocumentSearch
          onSelect={(result) => {
            const match = files.find((f: FileItem) => f.name === result.name);
            if (match) setSelectedFile(match);
            else addToast('info', `Opening ${result.name}`);
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'] }}>
          {files.map((file: FileItem) => {
            const approval = getApprovalStatus(file);
            return (
              <div
                key={file.id}
                onClick={() => handleFileClick(file)}
                style={{
                  backgroundColor: colors.surfaceRaised,
                  borderRadius: borderRadius.lg,
                  boxShadow: shadows.card,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: `box-shadow ${transitions.quick}, transform ${transitions.quick}`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = shadows.cardHover;
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = shadows.card;
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                }}
              >
                {/* Gradient Thumbnail */}
                <div
                  style={{
                    height: '120px',
                    background: getGradient(file),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  {file.type === 'folder' ? (
                    <FolderOpen size={36} color={colors.primaryOrange} />
                  ) : (
                    <FileText size={36} color="rgba(255,255,255,0.6)" />
                  )}
                  {/* Approval dot */}
                  {approval && (
                    <div
                      style={{
                        position: 'absolute',
                        top: spacing['2'],
                        right: spacing['2'],
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: approval.color,
                        border: `2px solid ${file.type === 'folder' ? colors.surfaceRaised : 'rgba(255,255,255,0.4)'}`,
                      }}
                    />
                  )}
                </div>

                {/* Card Content */}
                <div style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                  <p
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.medium,
                      color: colors.textPrimary,
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {file.name}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: spacing['2'],
                    }}
                  >
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                      {file.type === 'folder' ? `${file.itemCount} items` : file.size}
                    </span>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                      {file.modifiedDate}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {files.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['6']} ${spacing['4']}`, textAlign: 'center' }}>
              <Search size={32} color={colors.textTertiary} style={{ marginBottom: spacing['3'] }} />
              <p style={{ fontSize: typography.fontSize.body, fontWeight: 500, color: colors.textPrimary, margin: 0, marginBottom: spacing['1'] }}>No files match your search</p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.gray600, margin: 0, marginBottom: spacing['4'] }}>Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <Card padding="0">
          <DataTable
            data={files}
            columns={fileTableColumns}
            enableSorting
            onRowClick={(file: FileItem) => handleFileClick(file)}
            emptyMessage="No files found"
          />
        </Card>
      )}

      {/* File Preview Drawer */}
      <FilePreview file={selectedFile} onClose={() => setSelectedFile(null)} />
    </PageContainer>
  );
};

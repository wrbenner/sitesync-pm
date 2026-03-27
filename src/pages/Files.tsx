import React, { useState } from 'react';
import { Grid, List, Upload as UploadIcon, FolderOpen, FileText, Sparkles, Search } from 'lucide-react';
import { Card, Btn, Skeleton, useToast, PageContainer } from '../components/Primitives';
import { UploadZone } from '../components/files/UploadZone';
import { DocumentSearch } from '../components/files/DocumentSearch';
import { FilePreview } from '../components/files/FilePreview';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme';
import { getFiles } from '../api/endpoints/documents';
import { useQuery } from '../hooks/useQuery';
import { TableHeader, TableRow } from '../components/Primitives';

type ViewMode = 'list' | 'grid';

interface FileItem {
  id: number;
  name: string;
  type: string;
  size?: string;
  itemCount?: number;
  modifiedDate: string;
}

const fileGradients: Record<string, string> = {
  pdf: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  xlsx: 'linear-gradient(135deg, #2D8A6E 0%, #06B6D4 100%)',
  dwg: 'linear-gradient(135deg, #F47820 0%, #FF9C42 100%)',
  zip: 'linear-gradient(135deg, #6B6560 0%, #A09890 100%)',
  default: 'linear-gradient(135deg, #3A7BC8 0%, #7C5DC7 100%)',
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
  const { data: files, loading } = useQuery('files', getFiles);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  const handleFileClick = (file: FileItem) => {
    setSelectedFile(file);
  };

  const handleUpload = (fileName: string) => {
    addToast('success', `Uploaded ${fileName}`);
  };

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
          <Btn
            icon={<UploadIcon size={14} />}
            onClick={() => setShowUpload(!showUpload)}
            variant={showUpload ? 'secondary' : 'primary'}
            size="sm"
          >
            Upload
          </Btn>
        </div>
      }
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', marginBottom: '16px', backgroundColor: 'rgba(124, 93, 199, 0.04)', borderRadius: '8px', borderLeft: '3px solid #7C5DC7' }}>
        <Sparkles size={14} color="#7C5DC7" style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: '13px', color: '#1A1613', margin: 0, lineHeight: 1.5 }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
              <Search size={32} color="#A09890" style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', fontWeight: 500, color: '#1A1613', margin: 0, marginBottom: '4px' }}>No files match your search</p>
              <p style={{ fontSize: '13px', color: '#6B6560', margin: 0, marginBottom: '16px' }}>Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <Card padding="0">
          <TableHeader
            columns={[
              { label: 'Name', width: '1fr' },
              { label: 'Type', width: '100px' },
              { label: 'Size / Count', width: '130px' },
              { label: 'Modified', width: '120px' },
              { label: 'Status', width: '110px' },
            ]}
          />
          {files.map((file: FileItem, index: number) => {
            const approval = getApprovalStatus(file);
            return (
              <TableRow
                key={file.id}
                divider={index < files.length - 1}
                onClick={() => handleFileClick(file)}
                columns={[
                  {
                    width: '1fr',
                    content: (
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
                    ),
                  },
                  {
                    width: '100px',
                    content: (
                      <span
                        style={{
                          fontSize: typography.fontSize.sm,
                          color: colors.textSecondary,
                          textTransform: 'capitalize' as const,
                        }}
                      >
                        {file.type}
                      </span>
                    ),
                  },
                  {
                    width: '130px',
                    content: (
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                        {file.type === 'folder' ? `${file.itemCount} items` : file.size}
                      </span>
                    ),
                  },
                  {
                    width: '120px',
                    content: (
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                        {file.modifiedDate}
                      </span>
                    ),
                  },
                  {
                    width: '110px',
                    content: approval ? (
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
                    ) : (
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                        &mdash;
                      </span>
                    ),
                  },
                ]}
              />
            );
          })}
          {files.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
              <Search size={32} color="#A09890" style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', fontWeight: 500, color: '#1A1613', margin: 0, marginBottom: '4px' }}>No files match your search</p>
              <p style={{ fontSize: '13px', color: '#6B6560', margin: 0, marginBottom: '16px' }}>Try adjusting your search or filter criteria</p>
            </div>
          )}
        </Card>
      )}

      {/* File Preview Drawer */}
      <FilePreview file={selectedFile} onClose={() => setSelectedFile(null)} />
    </PageContainer>
  );
};

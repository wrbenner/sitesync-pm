import React, { useState, useEffect } from 'react';
import { Grid, List, Upload as UploadIcon, FileText, Sparkles, Search, Trash2, Eye } from 'lucide-react';
import { Card, Btn, Skeleton, useToast, PageContainer, TableHeader, TableRow } from '../components/Primitives';
import { UppyUploader } from '../components/files/UppyUploader';
import { PdfViewer } from '../components/drawings/PdfViewer';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme';
import { useFileStore, formatFileSize } from '../stores/fileStore';
import { useProjectContext } from '../stores/projectContextStore';
import { useAuthStore } from '../stores/authStore';
import type { LocalFile } from '../stores/fileStore';

type ViewMode = 'list' | 'grid';

const fileGradients: Record<string, string> = {
  pdf: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  xlsx: 'linear-gradient(135deg, #2D8A6E 0%, #06B6D4 100%)',
  dwg: 'linear-gradient(135deg, #F47820 0%, #FF9C42 100%)',
  zip: 'linear-gradient(135deg, #6B6560 0%, #A09890 100%)',
  default: 'linear-gradient(135deg, #3A7BC8 0%, #7C5DC7 100%)',
};

const getGradient = (fileType: string): string => {
  return fileGradients[fileType] || fileGradients.default;
};

export const Files: React.FC = () => {
  const { addToast } = useToast();
  const { files, loading, loadFiles, uploadFile, deleteFile } = useFileStore();
  const { activeProject } = useProjectContext();
  const { profile } = useAuthStore();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showUpload, setShowUpload] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pdfFile, setPdfFile] = useState<{ file: string | File; title: string } | null>(null);

  useEffect(() => {
    if (activeProject?.id) {
      loadFiles(activeProject.id);
    }
  }, [activeProject?.id]);

  const filteredFiles = searchTerm
    ? files.filter((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.folder_path.toLowerCase().includes(searchTerm.toLowerCase()))
    : files;

  const handleUpload = async (uploadedFiles: File[]) => {
    if (!activeProject || !profile) return;
    for (const file of uploadedFiles) {
      const { error } = await uploadFile(activeProject.id, profile.id, file);
      if (error) {
        addToast('error', `Failed to upload ${file.name}: ${error}`);
      } else {
        addToast('success', `Uploaded ${file.name}`);
      }
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    const { error } = await deleteFile(fileId);
    if (error) {
      addToast('error', error);
    } else {
      addToast('success', `${fileName} deleted`);
    }
  };

  const handleFileClick = (file: LocalFile) => {
    if (file.file_type === 'pdf') {
      if (file.localUrl) {
        setPdfFile({ file: file.localUrl, title: file.name });
      } else {
        addToast('info', `Opening ${file.name}`);
      }
    } else {
      addToast('info', `Preview for ${file.file_type.toUpperCase()} files coming soon`);
    }
  };

  if (loading || !activeProject) {
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
            </Card>
          ))}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Files"
      subtitle={`${files.length} files`}
      actions={
        <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
          <div style={{
            display: 'flex',
            backgroundColor: colors.surfaceInset,
            borderRadius: borderRadius.md,
            padding: '2px',
          }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 28, border: 'none', borderRadius: borderRadius.base,
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
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 28, border: 'none', borderRadius: borderRadius.base,
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
      {/* AI Banner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', marginBottom: '16px', backgroundColor: 'rgba(124, 93, 199, 0.04)', borderRadius: '8px', borderLeft: '3px solid #7C5DC7' }}>
        <Sparkles size={14} color="#7C5DC7" style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: '13px', color: '#1A1613', margin: 0, lineHeight: 1.5 }}>
          Documentation coverage at {Math.round((files.length / 12) * 100)}%. Upload additional documents to improve project documentation.
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: spacing['4'] }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: colors.textTertiary }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search files by name or folder..."
            style={{
              width: '100%',
              padding: `${spacing['2']} ${spacing['3']} ${spacing['2']} 36px`,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md,
              fontSize: typography.fontSize.sm,
              color: colors.textPrimary,
              backgroundColor: colors.surfaceRaised,
              outline: 'none',
              fontFamily: typography.fontFamily,
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Upload Zone */}
      {showUpload && (
        <div style={{ marginBottom: spacing['5'] }}>
          <Card>
            <UppyUploader
              onFilesSelected={handleUpload}
              label="Drop files here to upload to this project"
            />
          </Card>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'] }}>
          {filteredFiles.map((file) => (
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
              <div
                style={{
                  height: '120px',
                  background: getGradient(file.file_type),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <FileText size={36} color="rgba(255,255,255,0.6)" />
                <span style={{
                  position: 'absolute', top: spacing['2'], right: spacing['2'],
                  padding: '2px 6px', backgroundColor: 'rgba(0,0,0,0.3)',
                  borderRadius: borderRadius.sm, fontSize: typography.fontSize.caption,
                  color: '#fff', fontWeight: typography.fontWeight.medium,
                  textTransform: 'uppercase',
                }}>
                  {file.file_type}
                </span>
              </div>
              <div style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
                <p style={{
                  fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
                  color: colors.textPrimary, margin: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {file.name}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing['2'] }}>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    {formatFileSize(file.size)}
                  </span>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    {new Date(file.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div style={{ marginTop: spacing['1'] }}>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    {file.folder_path}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {filteredFiles.length === 0 && (
            <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
              <Search size={32} color="#A09890" style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', fontWeight: 500, color: '#1A1613', margin: 0, marginBottom: '4px' }}>
                {searchTerm ? 'No files match your search' : 'No files uploaded yet'}
              </p>
              <p style={{ fontSize: '13px', color: '#6B6560', margin: 0, marginBottom: '16px' }}>
                {searchTerm ? 'Try adjusting your search criteria' : 'Upload your first file to get started'}
              </p>
              {!searchTerm && (
                <button onClick={() => setShowUpload(true)} style={{ padding: '6px 16px', backgroundColor: colors.primaryOrange, border: 'none', borderRadius: '6px', fontSize: '13px', fontFamily: typography.fontFamily, color: '#fff', cursor: 'pointer' }}>
                  Upload Files
                </button>
              )}
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
              { label: 'Type', width: '80px' },
              { label: 'Size', width: '100px' },
              { label: 'Folder', width: '160px' },
              { label: 'Uploaded', width: '100px' },
              { label: '', width: '80px' },
            ]}
          />
          {filteredFiles.map((file, index) => (
            <TableRow
              key={file.id}
              divider={index < filteredFiles.length - 1}
              onClick={() => handleFileClick(file)}
              columns={[
                {
                  width: '1fr',
                  content: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                      <FileText size={16} color={colors.textTertiary} />
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                        {file.name}
                      </span>
                    </div>
                  ),
                },
                {
                  width: '80px',
                  content: (
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: typography.fontWeight.medium }}>
                      {file.file_type}
                    </span>
                  ),
                },
                {
                  width: '100px',
                  content: (
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                      {formatFileSize(file.size)}
                    </span>
                  ),
                },
                {
                  width: '160px',
                  content: (
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                      {file.folder_path}
                    </span>
                  ),
                },
                {
                  width: '100px',
                  content: (
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                      {new Date(file.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  ),
                },
                {
                  width: '80px',
                  content: (
                    <div style={{ display: 'flex', gap: spacing['1'] }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleFileClick(file); }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: spacing['1'], color: colors.textTertiary, display: 'flex', borderRadius: borderRadius.sm }}
                        title="Preview"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(file.id, file.name); }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: spacing['1'], color: colors.textTertiary, display: 'flex', borderRadius: borderRadius.sm }}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          ))}
          {filteredFiles.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
              <Search size={32} color="#A09890" style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', fontWeight: 500, color: '#1A1613', margin: 0, marginBottom: '4px' }}>
                {searchTerm ? 'No files match your search' : 'No files uploaded yet'}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* PDF Viewer */}
      {pdfFile && (
        <PdfViewer
          file={pdfFile.file}
          title={pdfFile.title}
          onClose={() => setPdfFile(null)}
        />
      )}
    </PageContainer>
  );
};

/**
 * The File — "Where is that document?"
 *
 * Shape: Place — a map you can explore.
 * Files organized by category, sortable by recency.
 * The orange dot marks the file uploaded most recently.
 *
 * This is how the team finds anything the project has produced.
 */

import React, { useEffect, useMemo } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ProjectGate } from '../../components/ProjectGate';
import { PageState } from '../../components/shared/PageState';
import { useCopilotStore } from '../../stores/copilotStore';
import { useProjectId } from '../../hooks/useProjectId';
import { useProject, useFiles } from '../../hooks/queries';
import { useIsOnline } from '../../hooks/useOfflineStatus';
import { useIsMobile } from '../../hooks/useWindowSize';
import { colors, typography, transitions } from '../../styles/theme';
import {
  OrangeDot,
  Hairline,
  Eyebrow,
  SectionHeading,
} from '../../components/atoms';
import {

  ChevronRight,
  FileText,
  File,
  FolderOpen,
  Image,
  Film,
  Archive,
  FileSpreadsheet,

  Clock,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────

interface ProjectFile {
  id: string;
  name: string;
  file_type?: string | null;
  category?: string | null;
  size?: number | null;
  uploaded_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// ── Helpers ──────────────────────────────────────────────

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

function isRecentlyUploaded(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return d >= sevenDaysAgo;
}

function categoryColor(category: string | null | undefined): string {
  if (!category) return colors.ink4;
  const c = category.toLowerCase();
  if (c.includes('contract') || c.includes('legal')) return '#3A7BC8';
  if (c.includes('drawing') || c.includes('plan')) return '#7C5DC7';
  if (c.includes('report') || c.includes('inspection')) return '#2A9D8F';
  if (c.includes('photo') || c.includes('image')) return '#E76F51';
  if (c.includes('specification') || c.includes('spec')) return '#57A77A';
  if (c.includes('permit') || c.includes('compliance')) return '#E9C46A';
  return colors.ink4;
}

function categoryBg(category: string | null | undefined): string {
  if (!category) return 'rgba(0,0,0,0.04)';
  const c = category.toLowerCase();
  if (c.includes('contract') || c.includes('legal')) return 'rgba(58, 123, 200, 0.08)';
  if (c.includes('drawing') || c.includes('plan')) return 'rgba(124, 93, 199, 0.08)';
  if (c.includes('report') || c.includes('inspection')) return 'rgba(42, 157, 143, 0.08)';
  if (c.includes('photo') || c.includes('image')) return 'rgba(231, 111, 81, 0.08)';
  if (c.includes('specification') || c.includes('spec')) return 'rgba(87, 167, 122, 0.08)';
  if (c.includes('permit') || c.includes('compliance')) return 'rgba(233, 196, 106, 0.12)';
  return 'rgba(0,0,0,0.04)';
}

function categoryIcon(category: string | null | undefined): React.ReactNode {
  if (!category) return <File size={14} style={{ color: colors.ink4 }} />;
  const c = category.toLowerCase();
  if (c.includes('photo') || c.includes('image')) return <Image size={14} style={{ color: categoryColor(category) }} />;
  if (c.includes('video')) return <Film size={14} style={{ color: categoryColor(category) }} />;
  if (c.includes('archive') || c.includes('zip')) return <Archive size={14} style={{ color: categoryColor(category) }} />;
  if (c.includes('sheet') || c.includes('spread') || c.includes('excel')) return <FileSpreadsheet size={14} style={{ color: categoryColor(category) }} />;
  if (c.includes('drawing') || c.includes('plan')) return <FolderOpen size={14} style={{ color: categoryColor(category) }} />;
  return <FileText size={14} style={{ color: categoryColor(category) }} />;
}

function fileTypeLabel(fileType: string | null | undefined): string {
  if (!fileType) return '';
  return fileType.toUpperCase().replace(/^\./, '');
}

// ── The File Page ─────────────────────────────────────────

const FilePage: React.FC = () => {
  const projectId = useProjectId();
  const { data: project } = useProject(projectId);
  const { setPageContext } = useCopilotStore();
  const isMobile = useIsMobile();
  const isOnline = useIsOnline();

  useEffect(() => { setPageContext('file'); }, [setPageContext]);

  // ── Data ────────────────────────────────────────────────
  const { data: fileData, isPending: filesLoading } = useFiles(projectId);
  const files = useMemo(
    () => (fileData ?? []) as unknown as ProjectFile[],
    [fileData],
  );

  // ── Derived data ────────────────────────────────────────

  // Count by category
  const byCategory = useMemo(() => {
    const map = new Map<string, ProjectFile[]>();
    for (const f of files) {
      const key = f.category ?? 'Uncategorized';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([category, items]) => ({
        category,
        count: items.length,
        latestUploaded: items
          .map((i) => i.created_at ?? '')
          .filter(Boolean)
          .sort()
          .reverse()[0] ?? null,
      }));
  }, [files]);

  // Recently added: last 10 sorted by created_at desc
  const recentFiles = useMemo(() => {
    return [...files]
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      .slice(0, 10);
  }, [files]);

  const recentCount = useMemo(
    () => files.filter((f) => isRecentlyUploaded(f.created_at)).length,
    [files],
  );

  // No project selected
  if (!projectId) return <ProjectGate />;

  return (
    <ErrorBoundary>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
          backgroundColor: colors.parchment,
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: '0 auto',
            padding: isMobile ? '16px 16px 0' : '36px 36px 0',
          }}
        >
          {/* ── Compact Header ──────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: typography.fontFamilySerif, fontSize: isMobile ? '20px' : '24px', color: colors.ink, lineHeight: 1.2 }}>
                The File
              </span>
              <span style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink4 }}>
                {project?.name ?? 'Project'}
              </span>
            </div>
            <span style={{ fontFamily: typography.fontFamily, fontSize: '12px', color: colors.ink4 }}>
              {!isOnline ? 'Offline' : 'Documents'}
            </span>
          </div>

          {/* ── Content ──────────────────────────────── */}
          {filesLoading ? (
            <PageState status="loading" />
          ) : (
            <>
              {/* ── Count Strip ──────────────────────── */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? 12 : 28,
                  flexWrap: 'wrap',
                  marginTop: 20,
                  marginBottom: 28,
                  padding: '16px 20px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--hairline)',
                  borderRadius: 10,
                }}
              >
                {/* Total files */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={16} style={{ color: colors.ink4, flexShrink: 0 }} />
                  <div>
                    <Eyebrow style={{ display: 'block', marginBottom: 2 }}>Total Files</Eyebrow>
                    <span
                      style={{
                        fontFamily: typography.fontFamilySerif,
                        fontSize: '28px',
                        fontWeight: 400,
                        color: colors.ink,
                        lineHeight: 1,
                      }}
                    >
                      {files.length}
                    </span>
                  </div>
                </div>

                {byCategory.length > 0 && (
                  <div
                    style={{
                      width: 1,
                      height: 40,
                      backgroundColor: 'var(--hairline)',
                      flexShrink: 0,
                    }}
                  />
                )}

                {/* Category counts — show up to 4 */}
                {byCategory.slice(0, 4).map(({ category, count }) => (
                  <div key={category} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: categoryColor(category),
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <Eyebrow style={{ display: 'block', marginBottom: 2 }}>
                        {category}
                      </Eyebrow>
                      <span
                        style={{
                          fontFamily: typography.fontFamilySerif,
                          fontSize: '18px',
                          fontWeight: 400,
                          color: colors.ink,
                          lineHeight: 1,
                        }}
                      >
                        {count}
                      </span>
                    </div>
                  </div>
                ))}

                {recentCount > 0 && (
                  <>
                    <div
                      style={{
                        width: 1,
                        height: 40,
                        backgroundColor: 'var(--hairline)',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <OrangeDot size={7} haloSpread={3} />
                      <div>
                        <Eyebrow style={{ display: 'block', marginBottom: 2 }}>Uploaded This Week</Eyebrow>
                        <span
                          style={{
                            fontFamily: typography.fontFamilySerif,
                            fontSize: '18px',
                            fontWeight: 400,
                            color: colors.primaryOrange,
                            lineHeight: 1,
                          }}
                        >
                          {recentCount}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <Hairline weight={2} spacing="tight" />

              {/* ── By Category ──────────────────────── */}
              <div style={{ marginTop: 24, marginBottom: 32 }}>
                <SectionHeading level={3} style={{ marginBottom: 16 }}>
                  By <em>Category</em>
                </SectionHeading>

                {byCategory.length === 0 ? (
                  <div
                    style={{
                      padding: '20px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--hairline)',
                      borderRadius: 10,
                      textAlign: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: typography.fontFamilySerif,
                        fontStyle: 'italic',
                        fontSize: '15px',
                        color: colors.ink3,
                      }}
                    >
                      No files uploaded yet.
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
                      gap: 12,
                    }}
                  >
                    {byCategory.map(({ category, count, latestUploaded }) => (
                      <CategoryCard
                        key={category}
                        category={category}
                        count={count}
                        latestUploaded={latestUploaded}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Hairline weight={1} spacing="tight" />

              {/* ── Recently Added ────────────────────── */}
              <div style={{ marginTop: 24, marginBottom: 32 }}>
                <SectionHeading level={3} style={{ marginBottom: 16 }}>
                  Recently <em>Added</em>
                  <span
                    style={{
                      fontFamily: typography.fontFamily,
                      fontSize: '13px',
                      fontWeight: 400,
                      color: colors.ink4,
                      marginLeft: 12,
                      letterSpacing: 0,
                    }}
                  >
                    last 10 files
                  </span>
                </SectionHeading>

                {recentFiles.length === 0 ? (
                  <div
                    style={{
                      padding: '20px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--hairline)',
                      borderRadius: 10,
                      textAlign: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: typography.fontFamilySerif,
                        fontStyle: 'italic',
                        fontSize: '15px',
                        color: colors.ink3,
                      }}
                    >
                      No files to show.
                    </span>
                  </div>
                ) : (
                  <div>
                    {recentFiles.map((file) => (
                      <FileRow key={file.id} file={file} />
                    ))}
                  </div>
                )}
              </div>

              <Hairline weight={2} spacing="tight" />

              {/* ── Quick Links ───────────────────────── */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 24, marginBottom: 48 }}>
                {[
                  { href: '#/files', label: 'Files' },
                  { href: '#/reports', label: 'Reports' },
                  { href: '#/closeout', label: 'Closeout' },
                ].map(({ href, label }) => (
                  <a key={href} href={href} style={{
                    fontFamily: typography.fontFamily, fontSize: '12px', fontWeight: 500,
                    color: colors.ink3, textDecoration: 'none', padding: '6px 14px',
                    borderRadius: 100, border: '1px solid var(--hairline)',
                    transition: transitions.quick,
                  }}>{label}</a>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

// ── Category Card ─────────────────────────────────────────

const CategoryCard: React.FC<{
  category: string;
  count: number;
  latestUploaded: string | null;
}> = ({ category, count, latestUploaded }) => (
  <a
    href="#/files"
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      padding: '16px',
      backgroundColor: '#FFFFFF',
      border: '1px solid var(--hairline)',
      borderRadius: 10,
      textDecoration: 'none',
      color: 'inherit',
      transition: transitions.quick,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 8px',
          borderRadius: 100,
          backgroundColor: categoryBg(category),
        }}
      >
        {categoryIcon(category)}
        <Eyebrow style={{ color: categoryColor(category) }}>
          {category}
        </Eyebrow>
      </div>
      <ChevronRight size={13} style={{ color: colors.ink4, flexShrink: 0 }} />
    </div>
    <div
      style={{
        fontFamily: typography.fontFamilySerif,
        fontSize: '32px',
        fontWeight: 400,
        color: colors.ink,
        lineHeight: 1.1,
      }}
    >
      {count}
    </div>
    {latestUploaded && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Clock size={10} style={{ color: colors.ink4 }} />
        <span
          style={{
            fontFamily: typography.fontFamily,
            fontSize: '11px',
            color: colors.ink4,
          }}
        >
          {formatShortDate(latestUploaded)}
        </span>
      </div>
    )}
  </a>
);

// ── File Row ──────────────────────────────────────────────

const FileRow: React.FC<{ file: ProjectFile }> = ({ file }) => {
  const isRecent = isRecentlyUploaded(file.created_at);
  return (
    <a
      href="#/files"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '14px 0',
        borderBottom: '1px solid var(--hairline-2)',
        textDecoration: 'none',
        color: 'inherit',
        transition: transitions.quick,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          backgroundColor: categoryBg(file.category),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 2,
          position: 'relative',
        }}
      >
        {categoryIcon(file.category)}
        {isRecent && (
          <OrangeDot size={6} haloSpread={2} style={{ position: 'absolute', top: -2, right: -2 }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
          {file.category && (
            <Eyebrow style={{ flexShrink: 0 }}>
              {file.category}
            </Eyebrow>
          )}
          <span
            style={{
              fontFamily: typography.fontFamily,
              fontSize: '14px',
              fontWeight: 500,
              color: colors.ink,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {file.name}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {file.file_type && (
            <span
              style={{
                fontFamily: typography.fontFamily,
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: colors.ink3,
                backgroundColor: 'rgba(0,0,0,0.05)',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              {fileTypeLabel(file.file_type)}
            </span>
          )}
          {file.size != null && file.size > 0 && (
            <span
              style={{
                fontFamily: typography.fontFamily,
                fontSize: '12px',
                color: colors.ink4,
              }}
            >
              {formatFileSize(file.size)}
            </span>
          )}
          {file.created_at && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                fontFamily: typography.fontFamily,
                fontSize: '12px',
                color: isRecent ? colors.primaryOrange : colors.ink4,
              }}
            >
              <Clock size={10} />
              {formatShortDate(file.created_at)}
            </span>
          )}
          {file.uploaded_by && (
            <span
              style={{
                fontFamily: typography.fontFamily,
                fontSize: '12px',
                color: colors.ink4,
              }}
            >
              {file.uploaded_by}
            </span>
          )}
        </div>
      </div>

      <ChevronRight size={14} style={{ color: colors.ink4, flexShrink: 0, marginTop: 8 }} />
    </a>
  );
};

// ── Export ──────────────────────────────────────────────

export default FilePage;

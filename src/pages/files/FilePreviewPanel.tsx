import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Clock, History, ExternalLink, FileText, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Btn } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../../styles/theme';
import { useFileVersions, resolveFileUrl, type FileVersion } from '../../hooks/queries/file-versions';
import type { FileItem } from './fileTypes';
import { formatBytes } from './fileTypes';

interface FilePreviewPanelProps {
  file: FileItem | null;
  onClose: () => void;
}

type Tab = 'details' | 'versions';

export const FilePreviewPanel: React.FC<FilePreviewPanelProps> = ({ file, onClose }) => {
  const fileId = file && !file.id.startsWith('v:') ? file.id : undefined;
  const { data: versions, isPending: loadingVersions, isError } = useFileVersions(fileId);
  const [tab, setTab] = useState<Tab>('details');
  const [activeVersion, setActiveVersion] = useState<FileVersion | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const lastFileIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!file) return;
    if (lastFileIdRef.current !== file.id) {
      lastFileIdRef.current = file.id;
      setTab('details');
      setActiveVersion(null);
      setPreviewUrl(null);
    }
  }, [file]);

  // Resolve preview URL for the active version (or the current file when no version selected)
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!file || file.type === 'folder') {
        setPreviewUrl(null);
        return;
      }
      setResolving(true);
      const sourceUrl = activeVersion?.file_url
        ?? ((file as unknown as Record<string, unknown>).storage_path as string | null | undefined)
        ?? ((file as unknown as Record<string, unknown>).file_url as string | null | undefined);
      const resolved = await resolveFileUrl(sourceUrl ?? null);
      if (!cancelled) {
        setPreviewUrl(resolved);
        setResolving(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [file, activeVersion]);

  if (!file) return null;

  const contentType = ((file as unknown as Record<string, unknown>).content_type as string | null | undefined) ?? '';
  const isImage = contentType.startsWith('image/');
  const isPdf = contentType.includes('pdf');
  const isText = contentType.startsWith('text/') || contentType.includes('json');

  const versionList = versions ?? [];

  return (
    <AnimatePresence>
      {file && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(2px)', zIndex: (zIndex.modal as number) - 1 }}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width: '520px', maxWidth: '95vw',
              backgroundColor: colors.surfaceRaised, boxShadow: shadows.panel,
              zIndex: zIndex.modal as number, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['4']} ${spacing['5']}`, borderBottom: `1px solid ${colors.borderSubtle}`, flexShrink: 0 }}>
              <h3 style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</h3>
              <button onClick={onClose} aria-label="Close preview" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textTertiary }}>
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div role="tablist" style={{ display: 'flex', gap: spacing['2'], padding: `${spacing['2']} ${spacing['5']}`, borderBottom: `1px solid ${colors.borderSubtle}`, flexShrink: 0 }}>
              {(['details', 'versions'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  style={{
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    padding: `${spacing['2']} ${spacing['3']}`,
                    fontSize: typography.fontSize.sm,
                    fontFamily: typography.fontFamily,
                    fontWeight: tab === t ? typography.fontWeight.semibold : typography.fontWeight.medium,
                    color: tab === t ? colors.textPrimary : colors.textSecondary,
                    borderBottom: `2px solid ${tab === t ? colors.primaryOrange : 'transparent'}`,
                    marginBottom: -2,
                    textTransform: 'capitalize',
                    display: 'flex', alignItems: 'center', gap: spacing['1'],
                  }}
                >
                  {t === 'versions' && <History size={13} />}
                  {t === 'details' && <FileText size={13} />}
                  {t === 'versions' ? `Versions${versionList.length ? ` (${versionList.length})` : ''}` : 'Details'}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: `${spacing['4']} ${spacing['5']}` }}>
              {tab === 'details' && (
                <DetailsView
                  file={file}
                  previewUrl={previewUrl}
                  resolving={resolving}
                  isImage={isImage}
                  isPdf={isPdf}
                  isText={isText}
                  activeVersion={activeVersion}
                />
              )}
              {tab === 'versions' && (
                <VersionList
                  versions={versionList}
                  loading={loadingVersions}
                  error={isError}
                  activeId={activeVersion?.id ?? null}
                  onSelect={(v) => {
                    setActiveVersion(v);
                    setTab('details');
                  }}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

interface DetailsViewProps {
  file: FileItem;
  previewUrl: string | null;
  resolving: boolean;
  isImage: boolean;
  isPdf: boolean;
  isText: boolean;
  activeVersion: FileVersion | null;
}

const DetailsView: React.FC<DetailsViewProps> = ({ file, previewUrl, resolving, isImage, isPdf, isText, activeVersion }) => {
  const [textBody, setTextBody] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived state or loading state; no external system sync
    if (!isText || !previewUrl) { setTextBody(null); return; }
    fetch(previewUrl).then(r => r.text()).then(body => {
      if (!cancelled) setTextBody(body.slice(0, 20_000));
    }).catch(() => { if (!cancelled) setTextBody(null); });
    return () => { cancelled = true; };
  }, [previewUrl, isText]);

  const size = (file as unknown as Record<string, unknown>).file_size_bytes as number
    ?? (file as unknown as Record<string, unknown>).file_size as number
    ?? 0;

  return (
    <div>
      {activeVersion && (
        <div style={{
          marginBottom: spacing['3'], padding: spacing['3'],
          backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
          fontSize: typography.fontSize.sm, color: colors.textSecondary,
          display: 'flex', alignItems: 'center', gap: spacing['2'],
        }}>
          <History size={14} color={colors.primaryOrange} />
          <span>Previewing <strong>v{activeVersion.version_number}</strong> · {new Date(activeVersion.created_at).toLocaleString()}</span>
        </div>
      )}

      {/* Preview area */}
      <div style={{
        width: '100%', minHeight: 200, borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceInset, marginBottom: spacing['4'],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {file.type === 'folder' ? (
          <FolderOpen size={48} color={colors.primaryOrange} />
        ) : resolving ? (
          <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Loading preview…</span>
        ) : previewUrl && isImage ? (
          <img src={previewUrl} alt={file.name} style={{ maxWidth: '100%', maxHeight: 320, objectFit: 'contain' }} />
        ) : previewUrl && isPdf ? (
          <iframe src={previewUrl} title={file.name} style={{ width: '100%', height: 360, border: 'none' }} />
        ) : previewUrl && isText ? (
          <pre style={{
            width: '100%', maxHeight: 320, overflow: 'auto', margin: 0, padding: spacing['3'],
            fontSize: typography.fontSize.caption, fontFamily: 'ui-monospace, monospace',
            color: colors.textPrimary, backgroundColor: colors.surfaceRaised, whiteSpace: 'pre-wrap',
          }}>{textBody ?? 'Loading…'}</pre>
        ) : previewUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['2'] }}>
            <FileText size={48} color={colors.textTertiary} />
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: typography.fontSize.sm, color: colors.primaryOrange, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
              Open in new tab <ExternalLink size={12} />
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['2'] }}>
            <FileText size={48} color={colors.textTertiary} />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Preview unavailable</span>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginBottom: spacing['4'] }}>
        <Meta label="Size" value={size > 0 ? formatBytes(size) : '—'} />
        <Meta label="Type" value={(file as unknown as Record<string, unknown>).content_type as string || file.type} />
        <Meta label="Modified" value={file.modifiedDate || '—'} icon={<Clock size={12} />} />
      </div>

      {/* Actions */}
      {previewUrl && file.type !== 'folder' && (
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <Btn icon={<Download size={14} />} onClick={() => { window.open(previewUrl, '_blank', 'noopener,noreferrer'); }}>Download</Btn>
          <Btn variant="secondary" icon={<ExternalLink size={14} />} onClick={() => { window.open(previewUrl, '_blank', 'noopener,noreferrer'); }}>Open</Btn>
        </div>
      )}
    </div>
  );
};

const Meta: React.FC<{ label: string; value: string; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: typography.fontSize.sm }}>
    <span style={{ color: colors.textTertiary, display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
      {icon}{label}
    </span>
    <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{value}</span>
  </div>
);

interface VersionListProps {
  versions: FileVersion[];
  loading: boolean;
  error: boolean;
  activeId: string | null;
  onSelect: (v: FileVersion) => void;
}

const VersionList: React.FC<VersionListProps> = ({ versions, loading, error, activeId, onSelect }) => {
  if (loading) return <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Loading versions…</p>;
  if (error) return <p style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical }}>Failed to load versions.</p>;
  if (versions.length === 0) {
    return (
      <div style={{ padding: `${spacing['6']} 0`, textAlign: 'center' }}>
        <History size={28} color={colors.textTertiary} style={{ marginBottom: spacing['2'] }} />
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>No prior versions recorded.</p>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
      {versions.map((v, i) => {
        const isActive = activeId === v.id;
        const isLatest = i === 0;
        return (
          <button
            key={v.id}
            onClick={() => onSelect(v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing['3'],
              padding: spacing['3'],
              backgroundColor: isActive ? colors.surfaceInset : 'transparent',
              border: `1px solid ${isActive ? colors.primaryOrange : colors.borderSubtle}`,
              borderRadius: borderRadius.md,
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: typography.fontFamily,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: 2 }}>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: isLatest ? colors.primaryOrange : colors.textPrimary }}>
                  v{v.version_number}
                </span>
                {isLatest && (
                  <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusActive, backgroundColor: `${colors.statusActive}12`, padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full }}>Current</span>
                )}
              </div>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {v.change_description || 'No description'}
              </p>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 1 }}>
                {new Date(v.created_at).toLocaleString()}{v.file_size ? ` · ${formatBytes(v.file_size)}` : ''}
              </p>
            </div>
            <ExternalLink size={14} color={colors.textTertiary} />
          </button>
        );
      })}
    </div>
  );
};

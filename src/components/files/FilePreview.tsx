import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Share2, Clock, User, Tag, FileText, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Btn } from '../Primitives';
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../../styles/theme';

const pulseStyle: React.CSSProperties = {
  backgroundColor: '#E5E7EB',
  animation: 'pulse 1.5s ease-in-out infinite',
  borderRadius: borderRadius.base,
  opacity: 0.6,
};

interface FileItem {
  id: string | number;
  name: string;
  type: string;
  size?: string;
  itemCount?: number;
  modifiedDate: string;
}

interface FilePreviewProps {
  file: FileItem | null;
  onClose: () => void;
}

// Version history will be populated from file_versions table when available
const versionHistory: Array<{ version: string; date: string; author: string; note: string }> = [];

const approvalStates: Record<string, { label: string; color: string }> = {
  approved: { label: 'Approved', color: colors.statusActive },
  pending: { label: 'Pending Review', color: colors.statusPending },
  draft: { label: 'Draft', color: colors.textTertiary },
};

export const FilePreview: React.FC<FilePreviewProps> = ({ file, onClose }) => {
  const [previewLoading, setPreviewLoading] = useState(false);
  const prevFileIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (file && file.id !== prevFileIdRef.current) {
      prevFileIdRef.current = file.id;
      setPreviewLoading(true);
      const timer = setTimeout(() => setPreviewLoading(false), 600);
      return () => clearTimeout(timer);
    }
  }, [file]);

  if (!file) return null;

  const approval = file.name.includes('Structural') ? approvalStates.approved
    : file.name.includes('MEP') ? approvalStates.pending
    : approvalStates.draft;

  return (
    <AnimatePresence>
      {file && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(2px)', zIndex: zIndex.modal as number - 1 }}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', maxWidth: '90vw',
              backgroundColor: colors.surfaceRaised, boxShadow: shadows.panel,
              zIndex: zIndex.modal as number, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['4']} ${spacing['5']}`, borderBottom: `1px solid ${colors.borderSubtle}`, flexShrink: 0 }}>
              <h3 style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>Document Details</h3>
              <button onClick={onClose} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textTertiary }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: `${spacing['4']} ${spacing['5']}` }}>
              {/* Preview thumbnail with loading shimmer */}
              {previewLoading ? (
                <div
                  aria-hidden="true"
                  style={{
                    width: '100%',
                    height: '160px',
                    borderRadius: borderRadius.md,
                    marginBottom: spacing['5'],
                    ...pulseStyle,
                  }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '160px', borderRadius: borderRadius.md,
                  background: file.type === 'folder' ? `linear-gradient(135deg, ${colors.orangeSubtle} 0%, ${colors.surfaceInset} 100%)` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: spacing['5'],
                }}>
                  {file.type === 'folder' ? <FolderOpen size={48} color={colors.primaryOrange} /> : <FileText size={48} color="rgba(255,255,255,0.5)" />}
                </div>
              )}

              {/* File info */}
              {previewLoading ? (
                <div aria-hidden="true" style={{ marginBottom: spacing['5'] }}>
                  <div style={{ ...pulseStyle, width: '75%', height: 18, marginBottom: spacing['3'] }} />
                  <div style={{ ...pulseStyle, width: '40%', height: 20, borderRadius: borderRadius.full, marginBottom: spacing['4'] }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
                    <div style={{ ...pulseStyle, width: '55%', height: 14 }} />
                    <div style={{ ...pulseStyle, width: '65%', height: 14 }} />
                    <div style={{ ...pulseStyle, width: '45%', height: 14 }} />
                  </div>
                </div>
              ) : (
                <>
                  <h4 style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['3'] }}>{file.name}</h4>

                  {/* Approval status */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['1'], padding: `${spacing['1']} ${spacing['2']}`, backgroundColor: `${approval.color}12`, borderRadius: borderRadius.full, marginBottom: spacing['4'] }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: approval.color }} />
                    <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: approval.color }}>{approval.label}</span>
                  </div>
                </>
              )}

              {/* Metadata */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'], marginBottom: spacing['5'] }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  <Tag size={14} color={colors.textTertiary} />
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{file.type === 'folder' ? `${file.itemCount} items` : file.size}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  <Clock size={14} color={colors.textTertiary} />
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Modified {file.modifiedDate}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  <User size={14} color={colors.textTertiary} />
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Owner</span>
                </div>
              </div>

              {/* Version history */}
              <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, margin: 0, marginBottom: spacing['3'] }}>Version History</p>
              {versionHistory.length === 0 ? (
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>No version history available</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {versionHistory.map((v, i) => (
                    <div key={v.version} style={{
                      display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
                      padding: `${spacing['2']} 0`,
                      borderBottom: i < versionHistory.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                    }}>
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: i === 0 ? colors.orangeText : colors.textTertiary, minWidth: '24px' }}>{v.version}</span>
                      <div>
                        <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>{v.note}</p>
                        <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 1 }}>{v.author} · {v.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: spacing['2'], marginTop: spacing['5'] }}>
                <Btn icon={<Download size={14} />}>Download</Btn>
                <Btn variant="secondary" icon={<Share2 size={14} />}>Share</Btn>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

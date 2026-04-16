import React from 'react';
import { Upload, Loader2, X } from 'lucide-react';
import { Btn, useToast } from '../../components/Primitives';
import { UploadZone } from '../../components/files/UploadZone';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';

interface DrawingUploadProps {
  pendingFiles: File[];
  uploadDiscipline: string;
  setUploadDiscipline: (d: string) => void;
  isUploading: boolean;
  uploadProgressText: string;
  onClose: () => void;
  onFileReady: (file: File) => void;
  onUpload: () => void;
}

export const DrawingUpload: React.FC<DrawingUploadProps> = ({
  pendingFiles,
  uploadDiscipline,
  setUploadDiscipline,
  isUploading,
  uploadProgressText,
  onClose,
  onFileReady,
  onUpload,
}) => {
  const { addToast } = useToast();
  void addToast;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Upload drawings"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 22, 41, 0.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{ backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg, border: `1px solid ${colors.borderSubtle}`, padding: spacing['6'], width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['5'] }}>
          <h2 style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>Upload Drawings</h2>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textTertiary }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceInset; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            aria-label="Close upload modal"
          >
            <X size={16} />
          </button>
        </div>

        <UploadZone onUpload={() => {}} onFileReady={onFileReady} />

        {/* Discipline selector */}
        <div style={{ marginTop: spacing['4'] }}>
          <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>Discipline</p>
          <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap' }}>
            {['Architectural', 'Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire Protection', 'Civil'].map((disc) => (
              <button
                key={disc}
                onClick={() => setUploadDiscipline(disc)}
                style={{
                  padding: `${spacing['1']} ${spacing['3']}`,
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.medium,
                  border: `1.5px solid ${uploadDiscipline === disc ? colors.primaryOrange : colors.borderDefault}`,
                  borderRadius: borderRadius.full,
                  backgroundColor: uploadDiscipline === disc ? `${colors.primaryOrange}12` : 'transparent',
                  color: uploadDiscipline === disc ? colors.primaryOrange : colors.textSecondary,
                  cursor: 'pointer', transition: `all ${transitions.instant}`,
                }}
              >
                {disc}
              </button>
            ))}
          </div>
        </div>

        {/* Upload progress */}
        {(isUploading || uploadProgressText) && (
          <div style={{ marginTop: spacing['4'], padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: `${colors.primaryOrange}0D`, border: `1px solid ${colors.primaryOrange}30`, borderRadius: borderRadius.base, display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <Loader2 size={14} color={colors.primaryOrange} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <p style={{ fontSize: typography.fontSize.sm, color: colors.orangeText, margin: 0 }}>{uploadProgressText}</p>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'], marginTop: spacing['5'] }}>
          <Btn variant="secondary" size="md" onClick={onClose}>Cancel</Btn>
          <Btn
            variant="primary"
            size="md"
            icon={<Upload size={16} />}
            aria-label="Upload drawings"
            disabled={pendingFiles.length === 0 || isUploading}
            onClick={onUpload}
          >
            {isUploading ? 'Uploading...' : `Upload${pendingFiles.length > 0 ? ` (${pendingFiles.length})` : ''}`}
          </Btn>
        </div>
      </div>
    </div>
  );
};

interface RevisionUploadProps {
  drawingTitle: string;
  drawingSetNumber: string;
  revUploadNum: string;
  setRevUploadNum: (v: string) => void;
  revUploadDesc: string;
  setRevUploadDesc: (v: string) => void;
  revUploadFile: File | null;
  setRevUploadFile: (f: File | null) => void;
  isRevUploading: boolean;
  onClose: () => void;
  onUpload: () => void;
}

export const RevisionUpload: React.FC<RevisionUploadProps> = ({
  drawingTitle,
  drawingSetNumber,
  revUploadNum,
  setRevUploadNum,
  revUploadDesc,
  setRevUploadDesc,
  revUploadFile,
  setRevUploadFile,
  isRevUploading,
  onClose,
  onUpload,
}) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label={`Upload revision for ${drawingTitle}`}
    style={{ position: 'fixed', inset: 0, zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 22, 41, 0.55)' }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    <div
      style={{ backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg, border: `1px solid ${colors.borderSubtle}`, padding: spacing['6'], width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['5'] }}>
        <div>
          <h2 style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>Upload New Revision</h2>
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginTop: 2 }}>{drawingSetNumber} — {drawingTitle}</p>
        </div>
        <button onClick={onClose} aria-label="Close upload revision modal" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textTertiary }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceInset; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
        <div>
          <label htmlFor="rev-upload-num" style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>Revision Number</label>
          <input id="rev-upload-num" type="number" min={1} value={revUploadNum} onChange={(e) => setRevUploadNum(e.target.value)} style={{ width: '100%', padding: `${spacing['2']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary, backgroundColor: colors.surfaceRaised, boxSizing: 'border-box' as const }} />
        </div>
        <div>
          <label htmlFor="rev-upload-desc" style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>Change Description</label>
          <textarea id="rev-upload-desc" value={revUploadDesc} onChange={(e) => setRevUploadDesc(e.target.value)} placeholder="What changed in this revision?" rows={3} style={{ width: '100%', padding: `${spacing['2']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary, backgroundColor: colors.surfaceRaised, resize: 'vertical', boxSizing: 'border-box' as const }} />
        </div>
        <div>
          <label htmlFor="rev-upload-file" style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
            Drawing File <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.normal, marginLeft: spacing['2'] }}>.pdf, .dwg, .dxf</span>
          </label>
          <label htmlFor="rev-upload-file" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: spacing['2'], padding: `${spacing['4']} ${spacing['3']}`, border: `1.5px dashed ${revUploadFile ? colors.primaryOrange : colors.borderDefault}`, borderRadius: borderRadius.md, cursor: 'pointer', backgroundColor: revUploadFile ? `${colors.primaryOrange}06` : colors.surfaceInset, transition: `all ${transitions.quick}` }}>
            <Upload size={20} color={revUploadFile ? colors.primaryOrange : colors.textTertiary} />
            <span style={{ fontSize: typography.fontSize.sm, color: revUploadFile ? colors.primaryOrange : colors.textTertiary, fontWeight: typography.fontWeight.medium, textAlign: 'center' }}>
              {revUploadFile ? revUploadFile.name : 'Click to select or drag a file'}
            </span>
            {revUploadFile && <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{(revUploadFile.size / 1024 / 1024).toFixed(1)} MB</span>}
          </label>
          <input id="rev-upload-file" type="file" accept=".pdf,.dwg,.dxf" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} onChange={(e) => { if (e.target.files?.[0]) setRevUploadFile(e.target.files[0]); }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'], marginTop: spacing['5'] }}>
        <Btn variant="secondary" size="md" onClick={onClose}>Cancel</Btn>
        <Btn
          variant="primary"
          size="md"
          icon={isRevUploading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={16} />}
          disabled={!revUploadNum || isRevUploading}
          onClick={onUpload}
        >
          {isRevUploading ? 'Uploading...' : `Upload Rev ${revUploadNum}`}
        </Btn>
      </div>
    </div>
  </div>
);

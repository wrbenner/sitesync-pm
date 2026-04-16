import React, { useRef, useState } from 'react';
import { Camera, Upload, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { colors, spacing, typography, borderRadius, touchTarget, transitions } from '../../styles/theme';
import { usePunchItemStore } from '../../stores/punchItemStore';

interface PunchPhotoUploadProps {
  itemId: string;
  projectId: string;
  /** 'before' = deficiency photo, 'after' = completed work photo */
  type: 'before' | 'after';
  /** Existing photo URL (if already uploaded) */
  existingUrl?: string | null;
  /** Called after a successful upload with the public URL */
  onUploaded?: (url: string) => void;
  /** Whether the upload zone is disabled (e.g. after photo locked until in-progress) */
  disabled?: boolean;
  disabledReason?: string;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

/**
 * Photo upload component for punch items.
 * Supports file picker and direct camera capture on mobile.
 * 48px minimum touch targets throughout.
 * All colors from theme tokens.
 */
export const PunchPhotoUpload = React.memo<PunchPhotoUploadProps>(({
  itemId,
  projectId,
  type,
  existingUrl,
  onUploaded,
  disabled = false,
  disabledReason,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { uploadPhoto } = usePunchItemStore();

  const label = type === 'before' ? 'Before' : 'After';
  const displayUrl = previewUrl ?? existingUrl ?? null;

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Only image files are supported');
      setUploadState('error');
      return;
    }

    // Show immediate preview
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setUploadState('uploading');
    setErrorMsg(null);

    const { error, url } = await uploadPhoto(itemId, projectId, file, type);

    if (error) {
      setUploadState('error');
      setErrorMsg(error);
      setPreviewUrl(null);
      URL.revokeObjectURL(localUrl);
    } else {
      setUploadState('success');
      if (url) onUploaded?.(url);
      URL.revokeObjectURL(localUrl);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so the same file can be re-selected after an error
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleRemove() {
    setPreviewUrl(null);
    setUploadState('idle');
    setErrorMsg(null);
  }

  const isUploading = uploadState === 'uploading';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
      {/* Label */}
      <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label} Photo
      </span>

      {/* Upload zone */}
      <div
        role={disabled ? undefined : 'button'}
        tabIndex={disabled ? -1 : 0}
        aria-label={disabled ? `${label} photo unavailable: ${disabledReason ?? 'disabled'}` : `Upload ${label.toLowerCase()} photo`}
        aria-disabled={disabled}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onClick={() => {
          if (!disabled && !isUploading) fileInputRef.current?.click();
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          position: 'relative',
          minHeight: '120px',
          borderRadius: borderRadius.lg,
          border: `2px dashed ${uploadState === 'error' ? colors.statusCritical : uploadState === 'success' ? colors.statusActive : colors.borderDefault}`,
          backgroundColor: disabled ? colors.surfaceDisabled : colors.surfaceInset,
          cursor: disabled ? 'not-allowed' : isUploading ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          opacity: disabled ? 0.5 : 1,
          transition: `border-color ${transitions.quick}`,
        }}
      >
        {/* Preview image */}
        {displayUrl && (
          <img
            src={displayUrl}
            alt={label}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}

        {/* Overlay when uploading */}
        {isUploading && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: colors.overlayScrim, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: spacing['2'] }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${colors.white}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: typography.fontSize.caption, color: colors.white, fontWeight: typography.fontWeight.medium }}>Uploading...</span>
          </div>
        )}

        {/* Success overlay */}
        {uploadState === 'success' && displayUrl && (
          <div style={{ position: 'absolute', top: spacing['2'], right: spacing['2'] }}>
            <CheckCircle size={20} color={colors.statusActive} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />
          </div>
        )}

        {/* Remove button */}
        {displayUrl && uploadState !== 'uploading' && (
          <button
            onClick={(e) => { e.stopPropagation(); handleRemove(); }}
            aria-label="Remove photo"
            style={{
              position: 'absolute',
              top: spacing['2'],
              left: spacing['2'],
              width: touchTarget.min,
              height: touchTarget.min,
              borderRadius: borderRadius.full,
              backgroundColor: colors.overlayBlackLight,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={14} color={colors.white} />
          </button>
        )}

        {/* Empty state: prompt */}
        {!displayUrl && !isUploading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['2'], padding: spacing['4'] }}>
            {disabled ? (
              <>
                <Camera size={24} color={colors.textTertiary} />
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textAlign: 'center' }}>
                  {disabledReason ?? 'Unavailable'}
                </span>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', gap: spacing['2'] }}>
                  <Camera size={20} color={colors.textTertiary} />
                  <Upload size={20} color={colors.textTertiary} />
                </div>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, textAlign: 'center', lineHeight: typography.lineHeight.normal }}>
                  Tap to take or upload a photo
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {uploadState === 'error' && errorMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.md, border: `1px solid ${colors.statusCritical}30` }}>
          <AlertTriangle size={14} color={colors.statusCritical} />
          <span style={{ fontSize: typography.fontSize.caption, color: colors.statusCritical }}>{errorMsg}</span>
        </div>
      )}

      {/* Hidden file input: accept images, enable camera on mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleInputChange}
        aria-hidden="true"
      />
    </div>
  );
});

PunchPhotoUpload.displayName = 'PunchPhotoUpload';

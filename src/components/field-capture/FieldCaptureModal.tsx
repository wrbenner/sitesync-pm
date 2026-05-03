// FieldCaptureModal — full-screen camera UI for on-site photo capture.
// Consumes useFieldCapture for camera + GPS + offline-queue behavior.

import React, { useEffect, useState } from 'react';
import { Camera, MapPin, X, WifiOff, CloudUpload, AlertTriangle, Loader2 } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { useFieldCapture } from '../../hooks/useFieldCapture';
import { toast } from 'sonner';

interface FieldCaptureModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  dailyLogId: string | null | undefined;
  onCaptured?: () => void;
}

export const FieldCaptureModal: React.FC<FieldCaptureModalProps> = ({
  open,
  onClose,
  projectId,
  dailyLogId,
  onCaptured,
}) => {
  const {
    videoRef,
    stream,
    gps,
    gpsError,
    cameraError,
    starting,
    uploading,
    pendingCaptures,
    isOnline,
    startCamera,
    stopCamera,
    capturePhoto,
    commitCapture,
  } = useFieldCapture();

  const [caption, setCaption] = useState('');
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    startCamera();
    return () => {
      stopCamera();
    };
  }, [open, startCamera, stopCamera]);

  useEffect(() => {
    if (!preview) return;
    return () => {
      URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const handleCapture = async () => {
    const blob = await capturePhoto();
    if (!blob) {
      toast.error('Capture failed — try again');
      return;
    }
    const url = URL.createObjectURL(blob);
    setPreview({ blob, url });
  };

  const handleRetake = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const handleSave = async () => {
    if (!preview) return;
    if (!dailyLogId) {
      toast.error('No daily log for today — create one first');
      return;
    }
    try {
      const result = await commitCapture(preview.blob, caption.trim(), {
        projectId,
        dailyLogId,
      });
      if (result.queued) {
        toast.info(`Saved offline — will sync when connected (${pendingCaptures + 1} queued)`);
      } else {
        toast.success('Photo captured and attached to today\'s log');
      }
      onCaptured?.();
      handleRetake();
      setCaption('');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save photo';
      toast.error(msg);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        role="presentation"
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
          zIndex: 1049,
        }}
      />
      <div
        role="dialog"
        aria-label="Field Capture"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(720px, 96vw)',
          maxHeight: '96vh',
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.xl,
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          zIndex: 1050,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing['4']} ${spacing['5']}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <div style={{
              width: 36, height: 36, borderRadius: borderRadius.md,
              backgroundColor: colors.orangeSubtle,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Camera size={18} color={colors.primaryOrange} />
            </div>
            <div>
              <h3 style={{
                margin: 0, fontSize: typography.fontSize.title,
                fontWeight: typography.fontWeight.semibold, color: colors.textPrimary,
              }}>
                Field Capture
              </h3>
              <div style={{
                fontSize: typography.fontSize.caption, color: colors.textTertiary,
                display: 'flex', alignItems: 'center', gap: spacing['2'], marginTop: 2,
              }}>
                {isOnline ? (
                  <>
                    <CloudUpload size={12} />
                    <span>Online — photos upload immediately</span>
                  </>
                ) : (
                  <>
                    <WifiOff size={12} color={colors.statusPending} />
                    <span style={{ color: colors.statusPending }}>
                      Offline — photos queue for sync
                    </span>
                  </>
                )}
                {pendingCaptures > 0 && (
                  <span style={{
                    backgroundColor: colors.statusPending, color: colors.white,
                    padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                    fontSize: 10, fontWeight: typography.fontWeight.bold,
                  }}>
                    {pendingCaptures} queued
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Field Capture"
            style={{
              width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', backgroundColor: colors.surfaceInset,
              borderRadius: borderRadius.md, cursor: 'pointer',
              color: colors.textSecondary,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: spacing['4'],
          display: 'flex', flexDirection: 'column', gap: spacing['4'],
        }}>
          {/* Camera preview / Captured preview */}
          <div style={{
            position: 'relative',
            backgroundColor: '#000',
            borderRadius: borderRadius.lg,
            overflow: 'hidden',
            aspectRatio: '4 / 3',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 240,
          }}>
            {preview ? (
              // eslint-disable-next-line jsx-a11y/img-redundant-alt
              <img
                src={preview.url}
                alt="Captured photo preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : cameraError ? (
              <div style={{
                color: colors.white, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: spacing['3'], padding: spacing['6'], textAlign: 'center',
              }}>
                <AlertTriangle size={32} color={colors.statusCritical} />
                <div style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium }}>
                  Camera unavailable
                </div>
                <div style={{ fontSize: typography.fontSize.sm, color: colors.overlayWhiteMedium, maxWidth: 320, lineHeight: 1.5 }}>
                  {cameraError}
                </div>
                <button
                  type="button"
                  onClick={() => startCamera()}
                  style={{
                    marginTop: spacing['1'],
                    padding: `${spacing['2']} ${spacing['4']}`,
                    backgroundColor: colors.primaryOrange,
                    color: colors.white,
                    border: 'none',
                    borderRadius: borderRadius.md,
                    fontSize: typography.fontSize.sm,
                    fontWeight: typography.fontWeight.semibold,
                    fontFamily: typography.fontFamily,
                    cursor: 'pointer',
                  }}
                >
                  Try again
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {(!stream || starting) && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.6)', color: colors.white,
                    gap: spacing['2'],
                  }}>
                    <Loader2 size={20} style={{ animation: 'fieldCaptureSpin 1s linear infinite' }} />
                    <span style={{ fontSize: typography.fontSize.sm }}>Starting camera…</span>
                  </div>
                )}
              </>
            )}

            {/* GPS overlay */}
            <div style={{
              position: 'absolute', top: spacing['2'], left: spacing['2'],
              padding: `${spacing['1']} ${spacing['2']}`,
              backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
              color: colors.white, borderRadius: borderRadius.md,
              fontSize: typography.fontSize.caption,
              display: 'flex', alignItems: 'center', gap: spacing['1'],
            }}>
              <MapPin size={12} color={gps ? '#4ade80' : colors.statusPending} />
              {gps ? (
                <>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}
                  </span>
                  {gps.accuracy != null && (
                    <span style={{ opacity: 0.7 }}>· ±{Math.round(gps.accuracy)}m</span>
                  )}
                </>
              ) : gpsError ? (
                <span>{gpsError}</span>
              ) : (
                <span>Locating…</span>
              )}
            </div>
          </div>

          <style>{`@keyframes fieldCaptureSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

          {/* Caption input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
            <label style={{
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
              color: colors.textTertiary, textTransform: 'uppercase',
              letterSpacing: typography.letterSpacing.wider,
            }}>
              Caption (optional)
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What's happening in this photo?"
              rows={2}
              style={{
                width: '100%',
                padding: spacing['3'],
                fontSize: typography.fontSize.body,
                fontFamily: typography.fontFamily,
                border: 'none',
                backgroundColor: colors.surfaceInset,
                borderRadius: borderRadius.md,
                outline: 'none',
                resize: 'vertical',
                minHeight: 56,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['2'],
          padding: `${spacing['3']} ${spacing['4']}`,
          borderTop: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.surfaceRaised, flexShrink: 0,
        }}>
          {preview ? (
            <>
              <button
                onClick={handleRetake}
                disabled={uploading}
                style={{
                  flex: 1, minHeight: 56,
                  padding: `${spacing['3']} ${spacing['4']}`,
                  border: `1px solid ${colors.borderDefault}`,
                  backgroundColor: 'transparent',
                  color: colors.textPrimary,
                  borderRadius: borderRadius.md,
                  fontSize: typography.fontSize.body,
                  fontWeight: typography.fontWeight.medium,
                  fontFamily: typography.fontFamily,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.6 : 1,
                  transition: `all ${transitions.quick}`,
                }}
              >
                Retake
              </button>
              <button
                onClick={handleSave}
                disabled={uploading || !dailyLogId}
                style={{
                  flex: 2, minHeight: 56,
                  padding: `${spacing['3']} ${spacing['4']}`,
                  border: 'none',
                  backgroundColor: dailyLogId ? colors.primaryOrange : colors.surfaceInset,
                  color: dailyLogId ? colors.white : colors.textTertiary,
                  borderRadius: borderRadius.md,
                  fontSize: typography.fontSize.body,
                  fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily,
                  cursor: uploading || !dailyLogId ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: spacing['2'],
                  opacity: uploading ? 0.75 : 1,
                  transition: `all ${transitions.quick}`,
                }}
              >
                {uploading ? (
                  <><Loader2 size={16} style={{ animation: 'fieldCaptureSpin 1s linear infinite' }} /> Saving…</>
                ) : !dailyLogId ? (
                  'Create a log first'
                ) : isOnline ? (
                  <><CloudUpload size={16} /> Save to Today's Log</>
                ) : (
                  <><WifiOff size={16} /> Queue for Sync</>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                style={{
                  flex: 1, minHeight: 56,
                  padding: `${spacing['3']} ${spacing['4']}`,
                  border: `1px solid ${colors.borderDefault}`,
                  backgroundColor: 'transparent',
                  color: colors.textPrimary,
                  borderRadius: borderRadius.md,
                  fontSize: typography.fontSize.body,
                  fontWeight: typography.fontWeight.medium,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                  transition: `all ${transitions.quick}`,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCapture}
                disabled={!stream || !!cameraError}
                style={{
                  flex: 2, minHeight: 56,
                  padding: `${spacing['3']} ${spacing['4']}`,
                  border: 'none',
                  backgroundColor: stream && !cameraError ? colors.primaryOrange : colors.surfaceInset,
                  color: stream && !cameraError ? colors.white : colors.textTertiary,
                  borderRadius: borderRadius.md,
                  fontSize: typography.fontSize.body,
                  fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily,
                  cursor: stream && !cameraError ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: spacing['2'],
                  transition: `all ${transitions.quick}`,
                }}
              >
                <Camera size={18} /> Capture
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default FieldCaptureModal;

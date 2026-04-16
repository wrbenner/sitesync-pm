import React, { useState, useEffect, useMemo} from 'react';
import { Columns, Layers, Sparkles, Clock, AlertTriangle, ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import type { DrawingRevision } from '../../types/api';

const DIFF_THRESHOLD = 30;
const RECENT_MS = 48 * 60 * 60 * 1000;

// RevisionBadge: amber when revision > 0, red when issued within 48h
export const RevisionBadge: React.FC<{ revision: DrawingRevision }> = ({ revision }) => {
  const [nowMs] = useState(() => Date.now());
  const isRecent = useMemo(() =>
    revision.issued_date
      ? nowMs - new Date(revision.issued_date).getTime() < RECENT_MS
      : false,
  [revision.issued_date, nowMs]);

  const bg = isRecent
    ? colors.statusCriticalSubtle
    : revision.revision_number > 0
    ? colors.statusPendingSubtle
    : colors.statusNeutralSubtle;
  const fg = isRecent
    ? colors.statusCritical
    : revision.revision_number > 0
    ? colors.statusPending
    : colors.statusNeutral;

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
        padding: `${spacing['0.5']} ${spacing['2']}`,
        backgroundColor: bg, color: fg,
        fontSize: typography.fontSize.caption,
        fontWeight: typography.fontWeight.semibold,
        borderRadius: borderRadius.full,
        fontFamily: typography.fontFamily,
        whiteSpace: 'nowrap',
      }}
    >
      {isRecent && <AlertTriangle size={10} />}
      Rev {revision.revision_number}
    </span>
  );
};

// Canvas pixel diff: loads two image URLs, computes per-pixel delta > threshold,
// renders changed pixels as red with alpha proportional to delta magnitude.
function useDiffDataUrl(prevUrl: string | null, currUrl: string | null) {
  const [diffDataUrl, setDiffDataUrl] = useState<string | null>(null);
  const [changePixels, setChangePixels] = useState(0);

  useEffect(() => {
    if (!prevUrl || !currUrl) {
      setDiffDataUrl(null);
      setChangePixels(0);
      return;
    }

    let cancelled = false;
    const prevImg = new Image();
    const currImg = new Image();
    prevImg.crossOrigin = 'anonymous';
    currImg.crossOrigin = 'anonymous';

    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded < 2 || cancelled) return;

      const w = Math.max(prevImg.naturalWidth, currImg.naturalWidth) || 800;
      const h = Math.max(prevImg.naturalHeight, currImg.naturalHeight) || 1000;

      const offA = document.createElement('canvas');
      offA.width = w; offA.height = h;
      const ctxA = offA.getContext('2d')!;
      ctxA.drawImage(prevImg, 0, 0, w, h);

      const offB = document.createElement('canvas');
      offB.width = w; offB.height = h;
      const ctxB = offB.getContext('2d')!;
      ctxB.drawImage(currImg, 0, 0, w, h);

      const dataA = ctxA.getImageData(0, 0, w, h).data;
      const dataB = ctxB.getImageData(0, 0, w, h).data;

      const diffCanvas = document.createElement('canvas');
      diffCanvas.width = w; diffCanvas.height = h;
      const diffCtx = diffCanvas.getContext('2d')!;
      const diffImg = diffCtx.createImageData(w, h);
      const out = diffImg.data;

      let changed = 0;
      for (let i = 0; i < dataA.length; i += 4) {
        const dr = dataA[i] - dataB[i];
        const dg = dataA[i + 1] - dataB[i + 1];
        const db = dataA[i + 2] - dataB[i + 2];
        const delta = Math.sqrt((dr * dr + dg * dg + db * db) / 3);
        if (delta > DIFF_THRESHOLD) {
          out[i] = 220; out[i + 1] = 38; out[i + 2] = 38;
          out[i + 3] = Math.min(255, Math.round(delta * 1.8));
          changed++;
        }
      }

      diffCtx.putImageData(diffImg, 0, 0);
      if (!cancelled) {
        setDiffDataUrl(diffCanvas.toDataURL());
        setChangePixels(changed);
      }
    };

    const onError = () => {
      if (!cancelled) { setDiffDataUrl(null); setChangePixels(0); }
    };

    prevImg.onload = onLoad;
    currImg.onload = onLoad;
    prevImg.onerror = onError;
    currImg.onerror = onError;
    prevImg.src = prevUrl;
    currImg.src = currUrl;

    return () => { cancelled = true; };
  }, [prevUrl, currUrl]);

  return { diffDataUrl, changePixels };
}

export type CompareMode = 'side-by-side' | 'overlay' | 'slider';

interface VersionCompareProps {
  currentRev: string;
  previousRev: string;
  drawingTitle: string;
  currentRevision?: DrawingRevision | null;
  previousRevision?: DrawingRevision | null;
  revisionHistory?: DrawingRevision[];
  mode?: CompareMode;
  onModeChange?: (mode: CompareMode) => void;
}

export const VersionCompare: React.FC<VersionCompareProps> = ({
  currentRev,
  previousRev,

  currentRevision = null,
  previousRevision = null,
  revisionHistory = [],
  mode: controlledMode,
  onModeChange,
}) => {
  const [internalMode, setInternalMode] = useState<CompareMode>(controlledMode ?? 'overlay');
  const mode = controlledMode ?? internalMode;
  const setMode = (m: CompareMode) => {
    if (onModeChange) onModeChange(m);
    else setInternalMode(m);
  };
  const [sliderPos, setSliderPos] = useState(50);
  const [opacity, setOpacity] = useState(50);
  const [showDiff, setShowDiff] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const prevUrl = previousRevision?.file_url ?? null;
  const currUrl = currentRevision?.file_url ?? null;
  const hasImages = !!(prevUrl && currUrl);
  const { diffDataUrl, changePixels } = useDiffDataUrl(showDiff ? prevUrl : null, showDiff ? currUrl : null);

  const renderPlaceholder = (label: string, style: React.CSSProperties) => (
    <div style={{
      position: 'absolute', inset: 0, ...style,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: typography.fontSize.heading, color: colors.overlayBlackLight,
      fontWeight: typography.fontWeight.semibold,
    }}>
      {label}
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100%', gap: spacing['3'] }}>
      {/* Main comparison area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Controls */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['3'],
          padding: `${spacing['3']} 0`, flexShrink: 0, flexWrap: 'wrap',
        }}>
          {!controlledMode && (
            <div style={{
              display: 'flex', gap: spacing['1'],
              backgroundColor: colors.surfaceInset,
              borderRadius: borderRadius.full, padding: 2,
            }}>
              {(['overlay', 'side-by-side', 'slider'] as CompareMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing['1'],
                    padding: `${spacing['1']} ${spacing['3']}`, border: 'none',
                    borderRadius: borderRadius.full,
                    backgroundColor: mode === m ? colors.surfaceRaised : 'transparent',
                    color: mode === m ? colors.textPrimary : colors.textTertiary,
                    fontSize: typography.fontSize.caption,
                    fontWeight: typography.fontWeight.medium,
                    fontFamily: typography.fontFamily, cursor: 'pointer',
                    boxShadow: mode === m ? shadows.sm : 'none',
                    transition: `all ${transitions.instant}`,
                  }}
                >
                  {m === 'overlay' ? <Layers size={12} /> : m === 'side-by-side' ? <Columns size={12} /> : <SlidersHorizontal size={12} />}
                  {m === 'overlay' ? 'Overlay' : m === 'side-by-side' ? 'Side by Side' : 'Slider'}
                </button>
              ))}
            </div>
          )}

          {mode === 'overlay' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flex: 1, minWidth: 160 }}>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, whiteSpace: 'nowrap' }}>
                Rev {previousRev}
              </span>
              <input
                type="range" min={0} max={100} value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                style={{ flex: 1, accentColor: colors.primaryOrange }}
              />
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, whiteSpace: 'nowrap' }}>
                Rev {currentRev}
              </span>
            </div>
          )}

          <button
            onClick={() => setShowDiff(!showDiff)}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing['1'],
              padding: `${spacing['1']} ${spacing['3']}`, border: 'none',
              borderRadius: borderRadius.full,
              backgroundColor: showDiff ? `${colors.statusCritical}14` : 'transparent',
              color: showDiff ? colors.statusCritical : colors.textTertiary,
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily, cursor: 'pointer',
            }}
          >
            <Sparkles size={12} />
            {hasImages && changePixels > 0
              ? `Changes (~${(changePixels / 1000).toFixed(0)}k px)`
              : 'Changes (0)'}
          </button>

          {revisionHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['1'],
                padding: `${spacing['1']} ${spacing['3']}`, border: 'none',
                borderRadius: borderRadius.full,
                backgroundColor: showHistory ? colors.statusInfoSubtle : 'transparent',
                color: showHistory ? colors.statusInfo : colors.textTertiary,
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.semibold,
                fontFamily: typography.fontFamily, cursor: 'pointer',
              }}
            >
              <Clock size={12} />
              History ({revisionHistory.length})
              {showHistory ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
            </button>
          )}
        </div>

        {/* Compare viewport */}
        {mode === 'overlay' ? (
          <div style={{
            flex: 1, position: 'relative', borderRadius: borderRadius.md,
            overflow: 'hidden', border: `1px solid ${colors.borderSubtle}`,
          }}>
            {hasImages ? (
              <img
                src={prevUrl!} alt={`Rev ${previousRev}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : renderPlaceholder(`Rev ${previousRev}`, {
              background: `linear-gradient(135deg, ${colors.surfaceHover} 0%, ${colors.borderDefault} 100%)`,
            })}

            <div style={{ position: 'absolute', inset: 0, opacity: opacity / 100 }}>
              {hasImages ? (
                <img
                  src={currUrl!} alt={`Rev ${currentRev}`}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : renderPlaceholder(`Rev ${currentRev}`, {
                background: `linear-gradient(135deg, ${colors.surfaceInset} 0%, ${colors.surfaceHover} 100%)`,
              })}
            </div>

            {showDiff && diffDataUrl && (
              <img
                src={diffDataUrl} alt="Pixel diff overlay"
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%', objectFit: 'contain',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        ) : mode === 'side-by-side' ? (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['2'] }}>
            {/* Previous panel */}
            <div style={{
              position: 'relative', borderRadius: borderRadius.md,
              overflow: 'hidden', border: `1px solid ${colors.borderSubtle}`,
            }}>
              {hasImages ? (
                <img src={prevUrl!} alt={`Rev ${previousRev}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  background: `linear-gradient(135deg, ${colors.surfaceHover} 0%, ${colors.borderDefault} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: typography.fontSize.title, color: colors.overlayBlackMedium, fontWeight: typography.fontWeight.semibold }}>
                    Rev {previousRev}
                  </span>
                </div>
              )}
              <div style={{
                position: 'absolute', top: spacing['2'], left: spacing['2'],
                padding: `${spacing['1']} ${spacing['2']}`,
                backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.sm,
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                color: colors.textSecondary,
              }}>
                Previous: Rev {previousRev}
              </div>
            </div>

            {/* Current panel with diff overlay */}
            <div style={{
              position: 'relative', borderRadius: borderRadius.md,
              overflow: 'hidden', border: `1px solid ${colors.borderSubtle}`,
            }}>
              {hasImages ? (
                <img src={currUrl!} alt={`Rev ${currentRev}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  background: `linear-gradient(135deg, ${colors.surfaceInset} 0%, ${colors.surfaceHover} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: typography.fontSize.title, color: colors.overlayBlackMedium, fontWeight: typography.fontWeight.semibold }}>
                    Rev {currentRev}
                  </span>
                </div>
              )}
              {showDiff && diffDataUrl && (
                <img
                  src={diffDataUrl} alt="Pixel diff overlay"
                  style={{
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%', objectFit: 'contain',
                    pointerEvents: 'none',
                  }}
                />
              )}
              <div style={{
                position: 'absolute', top: spacing['2'], left: spacing['2'],
                padding: `${spacing['1']} ${spacing['2']}`,
                backgroundColor: colors.primaryOrange, borderRadius: borderRadius.sm,
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                color: colors.white,
              }}>
                Current: Rev {currentRev}
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            flex: 1, position: 'relative', borderRadius: borderRadius.md,
            overflow: 'hidden', border: `1px solid ${colors.borderSubtle}`,
            userSelect: 'none',
          }}>
            {hasImages ? (
              <img src={prevUrl!} alt={`Rev ${previousRev}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : renderPlaceholder(`Rev ${previousRev}`, {
              background: `linear-gradient(135deg, ${colors.surfaceHover} 0%, ${colors.borderDefault} 100%)`,
            })}
            <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
              {hasImages ? (
                <img src={currUrl!} alt={`Rev ${currentRev}`}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : renderPlaceholder(`Rev ${currentRev}`, {
                background: `linear-gradient(135deg, ${colors.surfaceInset} 0%, ${colors.surfaceHover} 100%)`,
              })}
            </div>
            {showDiff && diffDataUrl && (
              <img src={diffDataUrl} alt="Pixel diff overlay"
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
                  pointerEvents: 'none', clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
                }} />
            )}
            <div style={{
              position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`,
              width: 2, backgroundColor: colors.primaryOrange,
              transform: 'translateX(-50%)', pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 28, height: 28, borderRadius: '50%',
                backgroundColor: colors.primaryOrange,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              }}>
                <SlidersHorizontal size={14} color="white" />
              </div>
            </div>
            <input
              type="range" min={0} max={100} value={sliderPos}
              onChange={(e) => setSliderPos(Number(e.target.value))}
              aria-label="Comparison slider position"
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                opacity: 0, cursor: 'ew-resize', margin: 0, padding: 0,
              }}
            />
            <div style={{
              position: 'absolute', top: spacing['2'], left: spacing['2'],
              padding: `${spacing['1']} ${spacing['2']}`,
              backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.sm,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
              color: colors.textSecondary, pointerEvents: 'none',
            }}>
              Rev {previousRev}
            </div>
            <div style={{
              position: 'absolute', top: spacing['2'], right: spacing['2'],
              padding: `${spacing['1']} ${spacing['2']}`,
              backgroundColor: colors.primaryOrange, borderRadius: borderRadius.sm,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
              color: colors.white, pointerEvents: 'none',
            }}>
              Rev {currentRev}
            </div>
          </div>
        )}
      </div>

      {/* Revision history panel */}
      {showHistory && revisionHistory.length > 0 && (
        <div style={{
          width: 264, flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderLeft: `1px solid ${colors.borderSubtle}`, paddingLeft: spacing['4'],
        }}>
          <p style={{
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
            color: colors.textTertiary, textTransform: 'uppercase',
            letterSpacing: '0.06em', margin: 0, marginBottom: spacing['3'],
          }}>
            Revision History
          </p>
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
            {revisionHistory.map((rev) => {
              const isSuperseded = !!rev.superseded_at;
              const isCurrent = currentRevision?.id === rev.id;
              return (
                <div
                  key={rev.id}
                  style={{
                    padding: spacing['3'],
                    backgroundColor: isSuperseded ? colors.surfaceInset : colors.surfaceRaised,
                    borderRadius: borderRadius.md,
                    border: `1px solid ${isCurrent ? `${colors.primaryOrange}40` : colors.borderSubtle}`,
                    opacity: isSuperseded ? 0.6 : 1,
                  }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', marginBottom: spacing['1'],
                  }}>
                    <RevisionBadge revision={rev} />
                    {isSuperseded && (
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontStyle: 'italic' }}>
                        superseded
                      </span>
                    )}
                  </div>
                  {rev.issued_date && (
                    <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing['1'] }}>
                      {rev.issued_date.slice(0, 10)}{rev.issued_by ? ` by ${rev.issued_by}` : ''}
                    </div>
                  )}
                  {rev.change_description && (
                    <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, lineHeight: '1.45' }}>
                      {rev.change_description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

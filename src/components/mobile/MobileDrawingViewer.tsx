import React, { useState, useRef, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, Maximize2, Layers, Edit3 } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, zIndex, vizColors } from '../../styles/theme';
import { useHaptics } from '../../hooks/useMobileCapture';

// ── Types ────────────────────────────────────────────────

interface DrawingViewerProps {
  drawing: {
    setNumber: string;
    title: string;
    discipline: string;
    revision: string;
  };
  onClose: () => void;
  onAddPin?: (x: number, y: number) => void;
}

interface MarkupItem {
  id: number;
  type: 'pin' | 'circle' | 'text';
  x: number;
  y: number;
  endX?: number;
  endY?: number;
  text?: string;
}

// ── Component ────────────────────────────────────────────

export const MobileDrawingViewer: React.FC<DrawingViewerProps> = ({ drawing, onClose, onAddPin }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [markups, setMarkups] = useState<MarkupItem[]>([]);
  const [markupMode, setMarkupMode] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [activeLayers, setActiveLayers] = useState(new Set(['architectural', 'structural', 'mep', 'electrical']));

  const { impact } = useHaptics();
  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Pinch-to-Zoom & Pan ─────────────────────────────

  const touchesRef = useRef<{ id: number; x: number; y: number }[]>([]);
  const initialDistRef = useRef(0);
  const initialZoomRef = useRef(1);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const longPressTimer = useRef<number>(0);

  const getDistance = (t1: { x: number; y: number }, t2: { x: number; y: number }) =>
    Math.sqrt((t2.x - t1.x) ** 2 + (t2.y - t1.y) ** 2);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touches = Array.from(e.touches).map((t) => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
    touchesRef.current = touches;

    if (touches.length === 2) {
      // Pinch start
      initialDistRef.current = getDistance(touches[0], touches[1]);
      initialZoomRef.current = zoom;
    } else if (touches.length === 1) {
      // Pan start or long-press for annotation
      panStartRef.current = { x: touches[0].x, y: touches[0].y, panX: pan.x, panY: pan.y };

      if (markupMode) {
        longPressTimer.current = window.setTimeout(() => {
          impact('medium');
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          const relX = ((touches[0].x - rect.left - pan.x) / (rect.width * zoom)) * 100;
          const relY = ((touches[0].y - rect.top - pan.y) / (rect.height * zoom)) * 100;
          setMarkups((prev) => [...prev, { id: Date.now(), type: 'pin', x: relX, y: relY }]);
          onAddPin?.(relX, relY);
        }, 500);
      }
    }
  }, [zoom, pan, markupMode, impact, onAddPin]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    clearTimeout(longPressTimer.current);
    const touches = Array.from(e.touches).map((t) => ({ id: t.identifier, x: t.clientX, y: t.clientY }));

    if (touches.length === 2 && touchesRef.current.length === 2) {
      // Pinch zoom
      e.preventDefault();
      const newDist = getDistance(touches[0], touches[1]);
      const scale = newDist / initialDistRef.current;
      setZoom(Math.max(0.5, Math.min(5, initialZoomRef.current * scale)));
    } else if (touches.length === 1) {
      // Pan
      const dx = touches[0].x - panStartRef.current.x;
      const dy = touches[0].y - panStartRef.current.y;
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
    }

    touchesRef.current = touches;
  }, []);

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
    touchesRef.current = [];
  }, []);

  // ── Zoom Controls ──────────────────────────────────

  const zoomIn = () => { impact('light'); setZoom((z) => Math.min(5, z + 0.5)); };
  const zoomOut = () => { impact('light'); setZoom((z) => Math.max(0.5, z - 0.5)); };
  const resetView = () => { impact('light'); setZoom(1); setPan({ x: 0, y: 0 }); };

  const toggleLayer = (id: string) => {
    impact('light');
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const layers = [
    { id: 'architectural', label: 'Arch', color: colors.statusReview },
    { id: 'structural', label: 'Struct', color: colors.statusInfo },
    { id: 'mep', label: 'MEP', color: colors.statusActive },
    { id: 'electrical', label: 'Elec', color: colors.statusPending },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: zIndex.modal as number,
      backgroundColor: vizColors.dark, display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${spacing['2']} ${spacing['3']}`, flexShrink: 0,
        backgroundColor: colors.overlayDark, zIndex: zIndex.base as number + 5,
      }}>
        <button onClick={onClose} aria-label="Close drawing" style={{
          width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: colors.overlayWhiteThin, border: 'none', borderRadius: borderRadius.full,
          cursor: 'pointer',
        }}>
          <X size={20} color={colors.white} />
        </button>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.white, margin: 0 }}>
            {drawing.setNumber}: {drawing.title}
          </p>
          <p style={{ fontSize: typography.fontSize.caption, color: colors.darkMutedText, margin: 0 }}>
            Rev {drawing.revision} · {drawing.discipline}
          </p>
        </div>
        <div style={{ display: 'flex', gap: spacing['1'] }}>
          <button
            onClick={() => { impact('light'); setMarkupMode(!markupMode); }}
            style={{
              width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: markupMode ? colors.primaryOrange : colors.overlayWhiteThin,
              border: 'none', borderRadius: borderRadius.full, cursor: 'pointer',
            }}
          >
            <Edit3 size={18} color={colors.white} />
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={canvasRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          touchAction: 'none', // prevent browser handling of gestures
        }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
        }}>
          {/* Drawing placeholder */}
          <div style={{
            position: 'absolute', left: '5%', top: '5%', width: '90%', height: '90%',
            background: `linear-gradient(135deg, ${vizColors.dark} 0%, ${vizColors.dark} 100%)`,
            borderRadius: borderRadius.md, border: `1px solid ${colors.overlayWhiteThin}`,
          }}>
            {/* Grid */}
            {Array.from({ length: 8 }).map((_, i) => (
              <React.Fragment key={i}>
                <div style={{ position: 'absolute', left: `${(i + 1) * 11.1}%`, top: 0, bottom: 0, width: 1, backgroundColor: colors.overlayBlackThin }} />
                <div style={{ position: 'absolute', top: `${(i + 1) * 11.1}%`, left: 0, right: 0, height: 1, backgroundColor: colors.overlayBlackThin }} />
              </React.Fragment>
            ))}

            {/* Layer representations */}
            {activeLayers.has('structural') && (
              <div style={{ position: 'absolute', left: '10%', top: '10%', width: '80%', height: '80%', border: `1px solid ${colors.statusInfo}33`, borderRadius: 2 }} />
            )}
            {activeLayers.has('architectural') && (
              <>
                <div style={{ position: 'absolute', left: '15%', top: '15%', width: '30%', height: '25%', border: `1px solid ${colors.statusReview}26`, borderRadius: 2 }} />
                <div style={{ position: 'absolute', left: '50%', top: '15%', width: '35%', height: '35%', border: `1px solid ${colors.statusReview}26`, borderRadius: 2 }} />
              </>
            )}
            {activeLayers.has('mep') && (
              <div style={{ position: 'absolute', left: '20%', top: '45%', width: '60%', height: '2px', backgroundColor: `${colors.statusActive}33` }} />
            )}

            {/* Set number watermark */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.overlayBlackThin, fontSize: spacing['16'], fontWeight: typography.fontWeight.bold }}>
              {drawing.setNumber}
            </div>
          </div>

          {/* Markup pins */}
          {markups.map((m) => (
            <div
              key={m.id}
              style={{
                position: 'absolute', left: `${m.x}%`, top: `${m.y}%`,
                width: 16, height: 16, borderRadius: '50%',
                backgroundColor: colors.primaryOrange, border: `2px solid ${colors.white}`,
                transform: 'translate(-50%, -50%)',
                boxShadow: shadows.card,
              }}
            />
          ))}
        </div>

        {/* Markup mode hint */}
        {markupMode && (
          <div style={{
            position: 'absolute', top: spacing['3'], left: '50%', transform: 'translateX(-50%)',
            padding: `${spacing['2']} ${spacing['4']}`, backgroundColor: colors.overlayHeavy,
            borderRadius: borderRadius.full, zIndex: zIndex.base as number + 5,
          }}>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.white }}>
              Long press to add pin
            </span>
          </div>
        )}

        {/* Zoom controls */}
        <div style={{
          position: 'absolute', bottom: spacing['5'], left: spacing['4'],
          display: 'flex', flexDirection: 'column', gap: spacing['2'], zIndex: zIndex.base as number + 5,
        }}>
          <ZoomButton icon={<ZoomIn size={18} />} onClick={zoomIn} />
          <ZoomButton icon={<ZoomOut size={18} />} onClick={zoomOut} />
          <ZoomButton icon={<Maximize2 size={18} />} onClick={resetView} />
          <div style={{
            textAlign: 'center', fontSize: typography.fontSize.caption,
            color: colors.darkMutedText, fontFeatureSettings: '"tnum"',
          }}>
            {Math.round(zoom * 100)}%
          </div>
        </div>

        {/* Layer toggle */}
        <div style={{
          position: 'absolute', bottom: spacing['5'], right: spacing['4'],
          display: 'flex', flexDirection: 'column', gap: spacing['2'], zIndex: zIndex.base as number + 5,
        }}>
          <ZoomButton
            icon={<Layers size={18} />}
            onClick={() => setShowLayers(!showLayers)}
            active={showLayers}
          />
          {showLayers && (
            <div style={{
              position: 'absolute', bottom: '52px', right: 0, width: '140px',
              backgroundColor: colors.overlayHeavy, borderRadius: borderRadius.md,
              padding: spacing['2'], boxShadow: shadows.dropdown,
            }}>
              {layers.map((layer) => {
                const active = activeLayers.has(layer.id);
                return (
                  <button
                    key={layer.id}
                    onClick={() => toggleLayer(layer.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: spacing['2'],
                      padding: `${spacing['2']} ${spacing['2']}`, minHeight: '40px',
                      backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.sm,
                      cursor: 'pointer', color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
                      fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: active ? layer.color : 'rgba(255,255,255,0.15)' }} />
                    {layer.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Sub-components ───────────────────────────────────────

const ZoomButton: React.FC<{ icon: React.ReactNode; onClick: () => void; active?: boolean }> = ({ icon, onClick, active }) => (
  <button
    onClick={onClick}
    style={{
      width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: active ? colors.primaryOrange : 'rgba(0,0,0,0.6)',
      border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: 'white',
      boxShadow: shadows.card,
    }}
  >
    {icon}
  </button>
);

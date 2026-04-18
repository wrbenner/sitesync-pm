import React, { useState, useRef, useCallback } from 'react';
import { Eye, EyeOff, RotateCw, Layers, ZoomIn, ZoomOut } from 'lucide-react';
import { colors, spacing, borderRadius, shadows, vizColors } from '../../styles/theme';

export interface PDFLayer {
  url: string | null;
  label: string;
  opacity: number;
  position: { x: number; y: number };
  rotation: number;
  scale: number;
  visible: boolean;
  color: string;
}

interface RevisionOverlayProps {
  oldRevisionUrl: string | null;
  newRevisionUrl: string | null;
  oldLabel?: string;
  newLabel?: string;
  onClose?: () => void;
}

const MIN_TOUCH = 56;

const REV_CYAN = '#00D5FF';
const REV_RED = vizColors.annotation;

export const RevisionOverlay: React.FC<RevisionOverlayProps> = ({
  oldRevisionUrl,
  newRevisionUrl,
  oldLabel = 'Old Revision',
  newLabel = 'New Revision',
}) => {
  const [oldLayer, setOldLayer] = useState<PDFLayer>({
    url: oldRevisionUrl,
    label: oldLabel,
    opacity: 0.7,
    position: { x: 0, y: 0 },
    rotation: 0,
    scale: 1,
    visible: true,
    color: REV_CYAN,
  });
  const [newLayer, setNewLayer] = useState<PDFLayer>({
    url: newRevisionUrl,
    label: newLabel,
    opacity: 0.7,
    position: { x: 0, y: 0 },
    rotation: 0,
    scale: 1,
    visible: true,
    color: REV_RED,
  });

  const [canvasZoom, setCanvasZoom] = useState(1);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setCanvasZoom((z) => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setCanvasZoom((z) => Math.max(z / 1.2, 0.3));
  const handleReset = () => {
    setCanvasZoom(1);
    setCanvasPan({ x: 0, y: 0 });
    setOldLayer((p) => ({ ...p, position: { x: 0, y: 0 }, rotation: 0, scale: 1 }));
    setNewLayer((p) => ({ ...p, position: { x: 0, y: 0 }, rotation: 0, scale: 1 }));
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - canvasPan.x, y: e.clientY - canvasPan.y };
  }, [canvasPan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setCanvasPan({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const hasFiles = !!oldLayer.url || !!newLayer.url;

  return (
    <div style={{ width: '100%', backgroundColor: colors.surfacePage, padding: spacing.lg, borderRadius: borderRadius.lg }}>
      {/* Controls bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: spacing.md,
          marginBottom: spacing.md,
          padding: spacing.sm,
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.md,
          boxShadow: shadows.cardHover,
        }}
      >
        <Layers size={20} color={colors.primaryOrange} />
        <span style={{ fontWeight: 600, color: colors.textPrimary }}>Revision Overlay</span>

        {oldLayer.url && (
          <LayerControls layer={oldLayer} labelColor={REV_CYAN} onToggle={() => setOldLayer((p) => ({ ...p, visible: !p.visible }))} onOpacity={(v) => setOldLayer((p) => ({ ...p, opacity: v }))} />
        )}
        {newLayer.url && (
          <LayerControls layer={newLayer} labelColor={REV_RED} onToggle={() => setNewLayer((p) => ({ ...p, visible: !p.visible }))} onOpacity={(v) => setNewLayer((p) => ({ ...p, opacity: v }))} />
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: spacing.xs }}>
          <IconBtn onClick={handleZoomOut} label="Zoom out" icon={<ZoomOut size={18} />} />
          <span style={{ minWidth: 56, textAlign: 'center', color: colors.textSecondary, fontSize: 13, alignSelf: 'center' }}>
            {Math.round(canvasZoom * 100)}%
          </span>
          <IconBtn onClick={handleZoomIn} label="Zoom in" icon={<ZoomIn size={18} />} />
          <IconBtn onClick={handleReset} label="Reset view" icon={<RotateCw size={18} />} />
        </div>
      </div>

      {/* Canvas area */}
      <div
        style={{
          position: 'relative',
          backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.md,
          border: `1px solid ${colors.borderSubtle}`,
          minHeight: 600,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!hasFiles ? (
          <div style={{ textAlign: 'center', padding: spacing.xl }}>
            <Layers size={64} color={colors.primaryOrange} style={{ marginBottom: spacing.md }} />
            <p style={{ color: colors.textPrimary, fontWeight: 600, marginBottom: spacing.xs }}>Select two revisions to compare</p>
            <p style={{ color: colors.textTertiary, fontSize: 14 }}>
              Cyan shows elements only in the old revision, red shows elements only in the new revision.
            </p>
          </div>
        ) : (
          <div
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              position: 'relative',
              cursor: isDragging ? 'grabbing' : 'grab',
              transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`,
              transformOrigin: 'center',
            }}
          >
            {oldLayer.url && oldLayer.visible && (
              <LayerImage layer={oldLayer} zIndex={1} overlayColor={REV_CYAN} />
            )}
            {newLayer.url && newLayer.visible && (
              <LayerImage layer={newLayer} zIndex={2} overlayColor={REV_RED} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const IconBtn: React.FC<{ onClick: () => void; icon: React.ReactNode; label: string }> = ({ onClick, icon, label }) => (
  <button
    onClick={onClick}
    aria-label={label}
    title={label}
    style={{
      minWidth: MIN_TOUCH,
      minHeight: MIN_TOUCH,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: 'none',
      background: colors.surfaceRaised,
      color: colors.textSecondary,
      borderRadius: borderRadius.md,
      cursor: 'pointer',
    }}
  >
    {icon}
  </button>
);

const LayerControls: React.FC<{ layer: PDFLayer; labelColor: string; onToggle: () => void; onOpacity: (v: number) => void }> = ({ layer, labelColor, onToggle, onOpacity }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
    <span style={{ color: labelColor, fontWeight: 600, fontSize: 13 }}>{layer.label}</span>
    <button
      onClick={onToggle}
      aria-label={layer.visible ? `Hide ${layer.label}` : `Show ${layer.label}`}
      style={{
        minWidth: MIN_TOUCH,
        minHeight: MIN_TOUCH,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: layer.visible ? labelColor : colors.surfaceInset,
        color: layer.visible ? colors.white : colors.textSecondary,
        borderRadius: borderRadius.md,
        cursor: 'pointer',
      }}
    >
      {layer.visible ? <Eye size={18} /> : <EyeOff size={18} />}
    </button>
    <label style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, fontSize: 12, color: colors.textTertiary }}>
      Opacity
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={layer.opacity}
        onChange={(e) => onOpacity(parseFloat(e.target.value))}
        style={{ width: 100 }}
        aria-label={`${layer.label} opacity`}
      />
      <span style={{ minWidth: 32 }}>{Math.round(layer.opacity * 100)}%</span>
    </label>
  </div>
);

const LayerImage: React.FC<{ layer: PDFLayer; zIndex: number; overlayColor: string }> = ({ layer, zIndex, overlayColor }) => (
  <div
    style={{
      position: 'absolute',
      opacity: layer.opacity,
      transform: `translate(${layer.position.x}px, ${layer.position.y}px) rotate(${layer.rotation}deg) scale(${layer.scale})`,
      transformOrigin: 'center',
      zIndex,
    }}
  >
    <div style={{ position: 'relative' }}>
      <img
        src={layer.url || ''}
        alt={layer.label}
        style={{ maxWidth: 600, display: 'block', borderRadius: borderRadius.md }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: overlayColor,
          mixBlendMode: 'screen',
          filter: 'contrast(2) brightness(0.5)',
          pointerEvents: 'none',
          borderRadius: borderRadius.md,
        }}
      />
    </div>
  </div>
);

export default RevisionOverlay;

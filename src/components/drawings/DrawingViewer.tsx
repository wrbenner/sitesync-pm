import React, { useState, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, X, Eye, EyeOff, Maximize2 } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex, vizColors } from '../../styles/theme';
import { MarkupToolbar } from './MarkupToolbar';
import type { MarkupTool } from './MarkupToolbar';
import { IssueOverlay } from './IssueOverlay';
import type { IssuePin, IssuePinType } from './IssueOverlay';
import { VersionCompare } from './VersionCompare';

interface DrawingViewerProps {
  drawing: { setNumber: string; title: string; discipline: string; revision: string };
  onClose: () => void;
}

interface MarkupItem {
  id: number;
  tool: MarkupTool;
  x: number;
  y: number;
  endX?: number;
  endY?: number;
  text?: string;
}

const disciplineLayers = [
  { id: 'architectural', label: 'Architectural', color: colors.statusReview },
  { id: 'structural', label: 'Structural', color: colors.statusInfo },
  { id: 'mep', label: 'MEP', color: colors.statusActive },
  { id: 'electrical', label: 'Electrical', color: colors.statusPending },
];

// Issue pins loaded from drawing_markups table via parent page
const issuePins: IssuePin[] = [];

export const DrawingViewer: React.FC<DrawingViewerProps> = ({ drawing, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [activeTool, setActiveTool] = useState<MarkupTool>('select');
  const [markups, setMarkups] = useState<MarkupItem[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [activeLayers, setActiveLayers] = useState(new Set(disciplineLayers.map((l) => l.id)));
  const [visiblePinTypes, setVisiblePinTypes] = useState<Set<IssuePinType>>(new Set(['rfi', 'punch', 'ai']));
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const drawStart = useRef({ x: 0, y: 0 });

  const getRelPos = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'select') {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }
    const pos = getRelPos(e);
    if (activeTool === 'text') {
      setTextPos(pos);
      return;
    }
    setIsDrawing(true);
    drawStart.current = pos;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsPanning(false);
    if (!isDrawing) return;
    setIsDrawing(false);
    const endPos = getRelPos(e);
    setMarkups((prev) => [...prev, {
      id: Date.now(), tool: activeTool,
      x: drawStart.current.x, y: drawStart.current.y,
      endX: endPos.x, endY: endPos.y,
    }]);
  };

  const handleTextSubmit = () => {
    if (!textPos || !textInput.trim()) { setTextPos(null); return; }
    setMarkups((prev) => [...prev, { id: Date.now(), tool: 'text', x: textPos.x, y: textPos.y, text: textInput }]);
    setTextInput('');
    setTextPos(null);
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.max(0.25, Math.min(4, prev - e.deltaY * 0.001)));
  }, []);

  const toggleLayer = (id: string) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const togglePinType = (type: IssuePinType) => {
    setVisiblePinTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: zIndex.modal as number, backgroundColor: vizColors.dark, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: colors.toolbarBg, flexShrink: 0 }}>
        <div>
          <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.white }}>{drawing.setNumber}: {drawing.title}</span>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textOnDarkMuted, marginLeft: spacing['3'] }}>Rev {drawing.revision} · {drawing.discipline}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <button
            onClick={() => setShowCompare(!showCompare)}
            style={{
              padding: `${spacing['1']} ${spacing['3']}`, border: 'none', borderRadius: borderRadius.base,
              backgroundColor: showCompare ? colors.primaryOrange : colors.overlayWhiteThin,
              color: colors.white, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily, cursor: 'pointer',
            }}
          >
            {showCompare ? 'Exit Compare' : 'Compare Versions'}
          </button>
          <button onClick={onClose} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlayWhiteThin, border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.white }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {showCompare ? (
        <div style={{ flex: 1, padding: spacing['4'], minHeight: 0 }}>
          <VersionCompare currentRev={drawing.revision} previousRev={String.fromCharCode(drawing.revision.charCodeAt(0) - 1)} drawingTitle={drawing.title} />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Layer panel */}
          <div style={{ width: '180px', backgroundColor: 'rgba(0, 0, 0, 0.2)', padding: spacing['3'], flexShrink: 0, overflowY: 'auto' }}>
            <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.darkMutedText, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, margin: 0, marginBottom: spacing['3'] }}>Layers</p>
            {disciplineLayers.map((layer) => {
              const isActive = activeLayers.has(layer.id);
              return (
                <button
                  key={layer.id}
                  onClick={() => toggleLayer(layer.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: spacing['2'],
                    padding: `${spacing['2']} ${spacing['2']}`, border: 'none', borderRadius: borderRadius.sm,
                    backgroundColor: isActive ? colors.overlayBlackLight : 'transparent',
                    color: isActive ? colors.textOnDark : 'rgba(255, 255, 255, 0.3)',
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, cursor: 'pointer',
                    textAlign: 'left', marginBottom: spacing['1'], transition: `all ${transitions.instant}`,
                  }}
                >
                  {isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: isActive ? layer.color : colors.overlayWhiteThin }} />
                  {layer.label}
                </button>
              );
            })}
          </div>

          {/* Canvas */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <div
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onWheel={handleWheel}
              style={{
                position: 'absolute', inset: 0,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                cursor: activeTool === 'select' ? (isPanning ? 'grabbing' : 'grab') : 'crosshair',
                transition: isPanning ? 'none' : `transform ${transitions.instant}`,
              }}
            >
              {/* Drawing placeholder */}
              <div style={{
                position: 'absolute', left: '5%', top: '5%', width: '90%', height: '90%',
                background: `linear-gradient(135deg, ${vizColors.dark} 0%, #1e1e3a 100%)`,
                borderRadius: borderRadius.md, border: `1px solid rgba(255, 255, 255, 0.05)`,
              }}>
                {/* Grid */}
                {Array.from({ length: 8 }).map((_, i) => (
                  <React.Fragment key={i}>
                    <div style={{ position: 'absolute', left: `${(i + 1) * 11.1}%`, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255, 255, 255, 0.03)' }} />
                    <div style={{ position: 'absolute', top: `${(i + 1) * 11.1}%`, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.03)' }} />
                  </React.Fragment>
                ))}
                {/* Layer outlines */}
                {activeLayers.has('structural') && (
                  <div style={{ position: 'absolute', left: '10%', top: '10%', width: '80%', height: '80%', border: `1px solid ${colors.statusInfo}30`, borderRadius: 2 }} />
                )}
                {activeLayers.has('architectural') && (
                  <>
                    <div style={{ position: 'absolute', left: '15%', top: '15%', width: '30%', height: '25%', border: `1px solid ${colors.statusReview}25`, borderRadius: 2 }} />
                    <div style={{ position: 'absolute', left: '50%', top: '15%', width: '35%', height: '35%', border: `1px solid ${colors.statusReview}25`, borderRadius: 2 }} />
                  </>
                )}
                {activeLayers.has('mep') && (
                  <div style={{ position: 'absolute', left: '20%', top: '45%', width: '60%', height: '2px', backgroundColor: `${colors.statusActive}30` }} />
                )}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255, 255, 255, 0.06)', fontSize: typography.fontSize.display, fontWeight: typography.fontWeight.bold }}>
                  {drawing.setNumber}
                </div>
              </div>

              {/* Issue pins */}
              <IssueOverlay pins={issuePins} visibleTypes={visiblePinTypes} onToggleType={togglePinType} />

              {/* Markups */}
              {markups.map((m) => {
                if (m.tool === 'pin') {
                  return <div key={m.id} style={{ position: 'absolute', left: `${m.x}%`, top: `${m.y}%`, width: 12, height: 12, borderRadius: '50%', backgroundColor: colors.primaryOrange, border: `2px solid ${colors.white}`, transform: 'translate(-50%, -50%)', boxShadow: shadows.card }} />;
                }
                if (m.tool === 'highlight' && m.endX !== undefined && m.endY !== undefined) {
                  return <div key={m.id} style={{ position: 'absolute', left: `${Math.min(m.x, m.endX)}%`, top: `${Math.min(m.y, m.endY)}%`, width: `${Math.abs(m.endX - m.x)}%`, height: `${Math.abs(m.endY - m.y)}%`, border: `2px solid ${colors.primaryOrange}`, borderRadius: '50%', backgroundColor: `${colors.primaryOrange}15` }} />;
                }
                if (m.tool === 'measure' && m.endX !== undefined && m.endY !== undefined) {
                  const dx = m.endX - m.x;
                  const dy = m.endY - m.y;
                  const len = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                  return (
                    <React.Fragment key={m.id}>
                      <div style={{ position: 'absolute', left: `${m.x}%`, top: `${m.y}%`, width: `${len}%`, height: '2px', backgroundColor: vizColors.success, transform: `rotate(${angle}deg)`, transformOrigin: '0 50%' }} />
                      <div style={{ position: 'absolute', left: `${(m.x + m.endX) / 2}%`, top: `${(m.y + m.endY) / 2}%`, transform: 'translate(-50%, -100%)', padding: `${spacing['0.5']} ${spacing['1']}`, backgroundColor: vizColors.success, color: colors.black, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, borderRadius: borderRadius.sm, whiteSpace: 'nowrap' }}>
                        {(len * 0.3).toFixed(1)} ft
                      </div>
                    </React.Fragment>
                  );
                }
                if (m.tool === 'text' && m.text) {
                  return <div key={m.id} style={{ position: 'absolute', left: `${m.x}%`, top: `${m.y}%`, padding: `${spacing['0.5']} ${spacing['1.5']}`, backgroundColor: colors.primaryOrange, color: colors.white, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, borderRadius: borderRadius.sm, whiteSpace: 'nowrap' }}>{m.text}</div>;
                }
                return null;
              })}

              {/* Text input */}
              {textPos && (
                <div style={{ position: 'absolute', left: `${textPos.x}%`, top: `${textPos.y}%`, zIndex: 20 }}>
                  <input autoFocus value={textInput} onChange={(e) => setTextInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleTextSubmit(); if (e.key === 'Escape') setTextPos(null); }} onBlur={handleTextSubmit} placeholder="Add note..." style={{ padding: `${spacing['0.5']} ${spacing['1.5']}`, backgroundColor: colors.primaryOrange, color: colors.white, border: 'none', borderRadius: borderRadius.sm, outline: 'none', fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.semibold, minWidth: '80px' }} />
                </div>
              )}
            </div>

            {/* Zoom controls */}
            <div style={{ position: 'absolute', bottom: spacing['4'], left: spacing['4'], display: 'flex', flexDirection: 'column', gap: spacing['1'], zIndex: 5 }}>
              <button onClick={() => setZoom((z) => Math.min(4, z + 0.25))} aria-label="Zoom in" title="Zoom in" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised, border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textSecondary, boxShadow: shadows.card }}><ZoomIn size={16} /></button>
              <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} aria-label="Zoom out" title="Zoom out" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised, border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textSecondary, boxShadow: shadows.card }}><ZoomOut size={16} /></button>
              <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label="Reset zoom and pan" title="Reset zoom and pan" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised, border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textSecondary, boxShadow: shadows.card }}><Maximize2 size={16} /></button>
              <div style={{ padding: `${spacing['1']} 0`, textAlign: 'center', fontSize: typography.fontSize.caption, color: colors.textOnDarkMuted }}>{Math.round(zoom * 100)}%</div>
            </div>

            {/* Markup toolbar */}
            <div style={{ position: 'absolute', bottom: spacing['4'], left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
              <MarkupToolbar activeTool={activeTool} onToolChange={setActiveTool} onUndo={() => setMarkups((p) => p.slice(0, -1))} canUndo={markups.length > 0} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, X, Eye, EyeOff, Maximize2 } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex, vizColors } from '../../styles/theme';
import { MarkupToolbar } from './MarkupToolbar';
import type { MarkupTool } from './MarkupToolbar';
import { IssueOverlay } from './IssueOverlay';
import type { IssuePin, IssuePinType } from './IssueOverlay';
import { VersionCompare } from './VersionCompare';
import {
  RoomProvider,
  useOthers,
  useUpdateMyPresence,
  useBroadcastEvent,
  useEventListener,
} from '../../lib/liveblocks';
import { DrawingPresenceBar } from '../collaboration/PresenceBar';
import { supabase } from '../../api/client';
import { useUiStore } from '../../stores';

interface DrawingViewerProps {
  drawing: { id?: string; setNumber: string; title: string; discipline: string; revision: string };
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

// Demo user info persisted within a browser session so the same tab always
// appears as the same person during collaborative testing.
const DEMO_USERS = [
  { name: 'Alex Chen', initials: 'AC', color: '#4EC896' },
  { name: 'Jordan Lee', initials: 'JL', color: '#F47820' },
  { name: 'Sam Rivera', initials: 'SR', color: '#3B82F6' },
  { name: 'Casey Kim', initials: 'CK', color: '#8B5CF6' },
  { name: 'Morgan Park', initials: 'MP', color: '#EC4899' },
];

function getDemoUser() {
  const stored = sessionStorage.getItem('sitesync_demo_user_idx');
  const idx = stored !== null
    ? parseInt(stored, 10)
    : Math.floor(Math.random() * DEMO_USERS.length);
  if (stored === null) sessionStorage.setItem('sitesync_demo_user_idx', String(idx));
  return DEMO_USERS[idx % DEMO_USERS.length];
}

const disciplineLayers = [
  { id: 'architectural', label: 'Architectural', color: colors.statusReview },
  { id: 'structural', label: 'Structural', color: colors.statusInfo },
  { id: 'mep', label: 'MEP', color: colors.statusActive },
  { id: 'electrical', label: 'Electrical', color: colors.statusPending },
];

// Issue pins loaded from drawing_markups table via parent page
const issuePins: IssuePin[] = [];

// ── Outer wrapper: provides the Liveblocks room ─────────────────────────────

export const DrawingViewer: React.FC<DrawingViewerProps> = (props) => {
  const demoUser = getDemoUser();
  const roomId = `drawing:${props.drawing.id || props.drawing.setNumber}`;

  return (
    <RoomProvider
      id={roomId}
      initialPresence={{
        cursor: null,
        page: 'drawing',
        name: demoUser.name,
        initials: demoUser.initials,
        avatar: null,
        color: demoUser.color,
      }}
    >
      <DrawingViewerInner {...props} demoUser={demoUser} />
    </RoomProvider>
  );
};

// ── Inner component: uses Liveblocks hooks ───────────────────────────────────

interface DrawingViewerInnerProps extends DrawingViewerProps {
  demoUser: { name: string; initials: string; color: string };
}

const DrawingViewerInner: React.FC<DrawingViewerInnerProps> = ({ drawing, onClose, demoUser }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [activeTool, setActiveTool] = useState<MarkupTool>('select');
  const [markups, setMarkups] = useState<MarkupItem[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [activeLayers, setActiveLayers] = useState(new Set(disciplineLayers.map((l) => l.id)));
  const [visiblePinTypes, setVisiblePinTypes] = useState<Set<IssuePinType>>(new Set(['rfi', 'punch', 'ai']));
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasOuterRef = useRef<HTMLDivElement>(null);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const drawStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const announceStatus = useUiStore((s) => s.announceStatus);

  // ── Liveblocks hooks ──────────────────────────────────────────────────────
  const updateMyPresence = useUpdateMyPresence();
  const others = useOthers();
  const broadcastEvent = useBroadcastEvent();

  // Update presence name/color once on mount
  useEffect(() => {
    updateMyPresence({ name: demoUser.name, initials: demoUser.initials, color: demoUser.color });
  }, [demoUser.name, demoUser.initials, demoUser.color, updateMyPresence]);

  // Receive remote markup events and apply to local state
  useEventListener(({ event }) => {
    if (event.type === 'MARKUP_ADD') {
      setMarkups((prev) => {
        // Ignore if already applied (duplicate event guard)
        if (prev.some((m) => m.id === event.markup.id)) return prev;
        return [...prev, event.markup as MarkupItem];
      });
    } else if (event.type === 'MARKUP_DELETE') {
      setMarkups((prev) => prev.filter((m) => m.id !== event.id));
    }
  });

  // ── Coordinate helpers ────────────────────────────────────────────────────

  // Position relative to the canvas inner div (drawing coordinates)
  const getRelPos = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  // Position relative to the outer container (for cursor sharing across zoom levels)
  const getOuterRelPos = useCallback((e: React.MouseEvent) => {
    const rect = canvasOuterRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  // ── Mouse handlers ────────────────────────────────────────────────────────

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
    // Broadcast cursor position (outer container coordinates)
    updateMyPresence({ cursor: getOuterRelPos(e) });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsPanning(false);
    if (!isDrawing) return;
    setIsDrawing(false);
    const endPos = getRelPos(e);
    const newMarkup: MarkupItem = {
      id: Date.now(), tool: activeTool,
      x: drawStart.current.x, y: drawStart.current.y,
      endX: endPos.x, endY: endPos.y,
    };
    setMarkups((prev) => [...prev, newMarkup]);
    announceStatus('Annotation added');
    // Broadcast so other users see this markup within ~500ms
    broadcastEvent({ type: 'MARKUP_ADD', markup: newMarkup });
  };

  const handleMouseLeave = () => {
    updateMyPresence({ cursor: null });
  };

  // Touch handler stubs: prevent toolbar from blocking the viewport on mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  const handleTextSubmit = () => {
    if (!textPos || !textInput.trim()) { setTextPos(null); return; }
    const newMarkup: MarkupItem = { id: Date.now(), tool: 'text', x: textPos.x, y: textPos.y, text: textInput };
    setMarkups((prev) => [...prev, newMarkup]);
    announceStatus('Text annotation added');
    broadcastEvent({ type: 'MARKUP_ADD', markup: newMarkup });
    setTextInput('');
    setTextPos(null);
  };

  const handleUndo = () => {
    setMarkups((prev) => {
      if (prev.length === 0) return prev;
      const removed = prev[prev.length - 1];
      broadcastEvent({ type: 'MARKUP_DELETE', id: removed.id });
      return prev.slice(0, -1);
    });
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.max(0.25, Math.min(4, prev - e.deltaY * 0.001)));
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const PAN_STEP = 50;
    const ZOOM_STEP = 0.1;
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setPan((prev) => ({ ...prev, y: prev.y + PAN_STEP }));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setPan((prev) => ({ ...prev, y: prev.y - PAN_STEP }));
        break;
      case 'ArrowLeft':
        e.preventDefault();
        setPan((prev) => ({ ...prev, x: prev.x + PAN_STEP }));
        break;
      case 'ArrowRight':
        e.preventDefault();
        setPan((prev) => ({ ...prev, x: prev.x - PAN_STEP }));
        break;
      case '+':
      case '=':
        e.preventDefault();
        setZoom((prev) => {
          const next = Math.min(4, parseFloat((prev + ZOOM_STEP).toFixed(2)));
          announceStatus(`Zoomed to ${Math.round(next * 100)}%`);
          return next;
        });
        break;
      case '-':
        e.preventDefault();
        setZoom((prev) => {
          const next = Math.max(0.25, parseFloat((prev - ZOOM_STEP).toFixed(2)));
          announceStatus(`Zoomed to ${Math.round(next * 100)}%`);
          return next;
        });
        break;
      case 'Home':
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
        announceStatus('View reset to fit');
        break;
      default:
        break;
    }
  }, [announceStatus]);

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

  // ── Supabase persistence ──────────────────────────────────────────────────

  const handleSaveMarkups = async () => {
    if (markups.length === 0) return;
    setIsSaving(true);
    try {
      const drawingId = drawing.id || drawing.setNumber;
      const records = markups.map((m) => ({
        drawing_id: drawingId,
        revision_id: drawing.revision,
        markup_type: m.tool,
        coordinates: JSON.stringify({ x: m.x, y: m.y, endX: m.endX, endY: m.endY }),
        color: colors.primaryOrange,
        text: m.text || null,
        created_by: demoUser.name,
        created_at: new Date().toISOString(),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('drawing_markups').insert(records);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: zIndex.modal as number, backgroundColor: vizColors.dark, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100vw', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: colors.toolbarBg, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'] }}>
          <div>
            <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.white }}>{drawing.setNumber}: {drawing.title}</span>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textOnDarkMuted, marginLeft: spacing['3'] }}>Rev {drawing.revision} · {drawing.discipline}</span>
          </div>
          {/* Presence bar showing other active viewers */}
          <DrawingPresenceBar />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          {/* Self indicator */}
          <div
            title={`You (${demoUser.name})`}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              backgroundColor: demoUser.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: typography.fontWeight.bold, color: colors.white,
              border: `2px solid rgba(255, 255, 255, 0.3)`,
            }}
          >
            {demoUser.initials}
          </div>
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

          {/* Canvas area */}
          <div
            ref={canvasOuterRef}
            role="application"
            aria-label="Drawing viewer - use arrow keys to pan, plus/minus to zoom"
            tabIndex={0}
            style={{ flex: 1, position: 'relative', overflow: 'hidden', touchAction: 'none', width: '100%', height: 'calc(100vh - 120px)' }}
            onMouseLeave={handleMouseLeave}
            onKeyDown={handleKeyDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
          >
            {/* Remote cursors rendered in outer container (stable coordinate space) */}
            {others.map((other) => {
              if (!other.presence.cursor) return null;
              return (
                <div
                  key={other.connectionId}
                  style={{
                    position: 'absolute',
                    left: `${other.presence.cursor.x}%`,
                    top: `${other.presence.cursor.y}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 20,
                    pointerEvents: 'none',
                  }}
                >
                  <div style={{
                    width: 22, height: 22,
                    borderRadius: '50%',
                    backgroundColor: other.presence.color || colors.statusInfo,
                    border: '2px solid rgba(255, 255, 255, 0.9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '8px', fontWeight: 700, color: colors.white,
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
                  }}>
                    {other.presence.initials || '?'}
                  </div>
                  {/* Name label */}
                  <div style={{
                    position: 'absolute', left: '100%', top: 0, marginLeft: 6,
                    backgroundColor: other.presence.color || colors.statusInfo,
                    color: colors.white,
                    padding: '2px 6px', borderRadius: borderRadius.sm,
                    fontSize: '10px', fontWeight: typography.fontWeight.semibold,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                    opacity: 0.95,
                  }}>
                    {other.presence.name || 'Someone'}
                  </div>
                </div>
              );
            })}

            {/* Canvas inner (transformed) */}
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

              {/* Markups (local + received from remote) */}
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
              <button onClick={() => setZoom((z) => { const next = Math.min(4, parseFloat((z + 0.25).toFixed(2))); announceStatus(`Zoomed to ${Math.round(next * 100)}%`); return next; })} aria-label="Zoom in" title="Zoom in" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised, border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textSecondary, boxShadow: shadows.card }}><ZoomIn size={16} /></button>
              <button onClick={() => setZoom((z) => { const next = Math.max(0.25, parseFloat((z - 0.25).toFixed(2))); announceStatus(`Zoomed to ${Math.round(next * 100)}%`); return next; })} aria-label="Zoom out" title="Zoom out" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised, border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textSecondary, boxShadow: shadows.card }}><ZoomOut size={16} /></button>
              <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); announceStatus('View reset to fit'); }} aria-label="Reset zoom and pan" title="Reset zoom and pan" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised, border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textSecondary, boxShadow: shadows.card }}><Maximize2 size={16} /></button>
              <div style={{ padding: `${spacing['1']} 0`, textAlign: 'center', fontSize: typography.fontSize.caption, color: colors.textOnDarkMuted }}>{Math.round(zoom * 100)}%</div>
            </div>

            {/* Markup toolbar with Save */}
            <div style={{ position: 'absolute', bottom: spacing['4'], left: '50%', transform: 'translateX(-50%)', zIndex: 5, display: 'flex', ...(isMobile ? { flexWrap: 'wrap' as const, padding: '8px' } : {}) }}>
              <MarkupToolbar
                activeTool={activeTool}
                onToolChange={setActiveTool}
                onUndo={handleUndo}
                canUndo={markups.length > 0}
                onSave={handleSaveMarkups}
                isSaving={isSaving}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

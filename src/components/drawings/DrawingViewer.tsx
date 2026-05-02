import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Canvas as FabricCanvas, PencilBrush, Circle as FabricCircle, Line as FabricLine, IText as FabricIText, Rect as FabricRect } from 'fabric';
import { ZoomIn, ZoomOut, X, Eye, EyeOff, Maximize2, ChevronUp, ChevronDown } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions, vizColors } from '../../styles/theme';
import { useMediaQuery } from '../../hooks/useMediaQuery';
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
import type { Database } from '../../types/database';
import { useUiStore } from '../../stores';
import { useAuthStore } from '../../stores/authStore';
import { useDrawingAnnotations, useCreateDrawingAnnotation } from '../../hooks/queries/drawing-annotations';

// Fabric tool type for annotation canvas
type FabricTool = 'pen' | 'highlighter' | 'text' | 'rectangle' | 'circle' | 'arrow' | 'cloud' | null;

interface DrawingViewerProps {
  drawing: { id?: string; setNumber: string; title: string; discipline: string; revision: string };
  onClose: () => void;
  onSave?: (json: object) => void;
  onCreateRFI?: () => void;
  annotations?: object;
  isEditable?: boolean;
  projectId?: string;
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

// Derive presence identity from the authenticated user profile.
// Falls back to a generic label when no session is available.
const PRESENCE_FALLBACK = { name: 'Current User', initials: 'CU', color: '#4EC896' };

function getPresenceUser(profile: { full_name?: string | null } | null, userEmail?: string | null): { name: string; initials: string; color: string } {
  const fullName = profile?.full_name || userEmail || PRESENCE_FALLBACK.name;
  const parts = fullName.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : fullName.slice(0, 2).toUpperCase();
  return { name: fullName, initials, color: PRESENCE_FALLBACK.color };
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

// Check if Liveblocks is properly configured (not a placeholder key)
const LIVEBLOCKS_CONFIGURED = !!(
  import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY &&
  !import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY.includes('placeholder')
) || !!import.meta.env.VITE_LIVEBLOCKS_AUTH_ENDPOINT;

export const DrawingViewer: React.FC<DrawingViewerProps> = (props) => {
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const presenceUser = getPresenceUser(profile, user?.email);
  const roomId = `drawing:${props.drawing.id || props.drawing.setNumber}`;

  // Load annotations from DB for this drawing
  const drawingId = props.drawing.id;
  const { data: dbAnnotations } = useDrawingAnnotations(drawingId);
  const createAnnotation = useCreateDrawingAnnotation();

  // Convert DB annotations to a fabric-compatible object if no explicit annotations prop
  const resolvedAnnotations = props.annotations ?? (dbAnnotations && dbAnnotations.length > 0
    ? { objects: dbAnnotations.map((a: Record<string, unknown>) => a.shape_data).filter(Boolean) }
    : undefined);

  const innerProps = {
    ...props,
    presenceUser,
    annotations: resolvedAnnotations,
    createAnnotationMutate: props.projectId && drawingId ? (shapeData: Record<string, unknown>) => {
      createAnnotation.mutate({
        project_id: props.projectId!,
        drawing_id: drawingId!,
        page_number: 1,
        annotation_type: 'markup',
        shape_data: shapeData,
        color: '#F47820',
      });
    } : undefined,
  };

  // Skip Liveblocks wrapper if not configured — viewer works fine without collaboration
  if (!LIVEBLOCKS_CONFIGURED) {
    return <DrawingViewerInner {...innerProps} />;
  }

  return (
    <RoomProvider
      id={roomId}
      initialPresence={{
        cursor: null,
        page: 'drawing',
        name: presenceUser.name,
        initials: presenceUser.initials,
        avatar: null,
        color: presenceUser.color,
      }}
    >
      <DrawingViewerInner {...innerProps} />
    </RoomProvider>
  );
};

// ── Inner component: uses Liveblocks hooks ───────────────────────────────────

interface DrawingViewerInnerProps extends DrawingViewerProps {
  presenceUser: { name: string; initials: string; color: string };
  createAnnotationMutate?: (shapeData: Record<string, unknown>) => void;
}

const DrawingViewerInner: React.FC<DrawingViewerInnerProps> = ({
  drawing,
  onClose,
  presenceUser,
  onSave,
  onCreateRFI,
  annotations,
  isEditable = false,
  createAnnotationMutate,
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState<MarkupTool>('select');
  const [activeColor] = useState('#E74C3C');
  const [strokeWidth] = useState(2);
  const [markups, setMarkups] = useState<MarkupItem[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [activeLayers, setActiveLayers] = useState(new Set(disciplineLayers.map((l) => l.id)));
  const [visiblePinTypes, setVisiblePinTypes] = useState<Set<IssuePinType>>(new Set(['rfi', 'punch', 'ai']));
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fabricContainerRef = useRef<HTMLDivElement>(null);
  const fabricInst = useRef<InstanceType<typeof FabricCanvas> | null>(null);
  const [fabricObjectCount, setFabricObjectCount] = useState(0);

  // Undo/redo stacks hold canvas JSON snapshots (max 20 levels each)
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);

  // Track whether a fabric shape is being drawn interactively
  const shapeInProgress = useRef<InstanceType<typeof FabricRect> | InstanceType<typeof FabricCircle> | InstanceType<typeof FabricLine> | null>(null);
  const shapeOrigin = useRef<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasOuterRef = useRef<HTMLDivElement>(null);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const drawStart = useRef({ x: 0, y: 0 });

  const announceStatus = useUiStore((s) => s.announceStatus);

  // ── Liveblocks hooks (no-op when not configured) ──────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const _updatePresence = LIVEBLOCKS_CONFIGURED ? useUpdateMyPresence() : null;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const others = LIVEBLOCKS_CONFIGURED ? useOthers() : [];
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const _broadcastEvent = LIVEBLOCKS_CONFIGURED ? useBroadcastEvent() : null;
  const updateMyPresence = _updatePresence ?? (() => {});
  const broadcastEvent = _broadcastEvent ?? (() => {});

  // Update presence name/color once on mount
  useEffect(() => {
    if (LIVEBLOCKS_CONFIGURED) {
      updateMyPresence({ name: presenceUser.name, initials: presenceUser.initials, color: presenceUser.color });
    }
  }, [presenceUser.name, presenceUser.initials, presenceUser.color, updateMyPresence]);

  // Receive remote markup events and apply to local state
  if (LIVEBLOCKS_CONFIGURED) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEventListener(({ event }) => {
      if (event.type === 'MARKUP_ADD') {
        setMarkups((prev) => {
          if (prev.some((m) => m.id === event.markup.id)) return prev;
          return [...prev, event.markup as MarkupItem];
        });
      } else if (event.type === 'MARKUP_DELETE') {
        setMarkups((prev) => prev.filter((m) => m.id !== event.id));
      }
    });
  }

  // ── Fabric.js annotation canvas ──────────────────────────────────────────

  useEffect(() => {
    const container = fabricContainerRef.current;
    const outer = canvasOuterRef.current;
    if (!container || !outer) return;
    const w = outer.offsetWidth || 800;
    const h = outer.offsetHeight || 600;
    const canvasEl = document.createElement('canvas');
    canvasEl.width = w;
    canvasEl.height = h;
    container.appendChild(canvasEl);
    const fc = new FabricCanvas(canvasEl, { selection: false });
    const wrapper = canvasEl.parentElement;
    if (wrapper) {
      wrapper.style.position = 'absolute';
      wrapper.style.inset = '0';
    }

    // Push a JSON snapshot to the undo stack on every annotation change
    const pushUndo = () => {
      const json = JSON.stringify(fc.toJSON());
      undoStack.current = [...undoStack.current.slice(-19), json];
      redoStack.current = [];
      setFabricObjectCount(fc.getObjects().length);
    };

    fc.on('path:created', pushUndo);
    fc.on('object:modified', pushUndo);
    fc.on('object:removed', () => setFabricObjectCount((c) => Math.max(0, c - 1)));

    fabricInst.current = fc;

    // Load persisted annotations if provided
    if (annotations) {
      fc.loadFromJSON(annotations).then(() => {
        fc.renderAll();
        setFabricObjectCount(fc.getObjects().length);
        // Lock all objects when not editable
        if (!isEditable) {
          fc.forEachObject((obj) => {
            obj.selectable = false;
            obj.evented = false;
          });
        }
      });
    }

    return () => {
      fc.dispose();
      fabricInst.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ResizeObserver: keep fabric canvas sized to its container ────────────

  useEffect(() => {
    const outer = canvasOuterRef.current;
    if (!outer) return;
    const ro = new ResizeObserver(() => {
      const fc = fabricInst.current;
      if (!fc) return;
      fc.setDimensions({ width: outer.offsetWidth, height: outer.offsetHeight });
      fc.renderAll();
    });
    ro.observe(outer);
    return () => ro.disconnect();
  }, []);

  // ── Map MarkupTool to FabricTool ─────────────────────────────────────────

  const toFabricTool = (tool: MarkupTool): FabricTool => {
    switch (tool) {
      case 'draw': return 'pen';
      case 'highlight': return 'highlighter';
      case 'text': return 'text';
      default: return null;
    }
  };

  // ── Configure fabric canvas when tool, color, or strokeWidth changes ──────

  useEffect(() => {
    const fc = fabricInst.current;
    if (!fc) return;

    // Remove all previously registered per-tool mouse handlers
    fc.off('mouse:down');
    fc.off('mouse:move');
    fc.off('mouse:up');
    shapeInProgress.current = null;
    shapeOrigin.current = null;

    const fabricTool = toFabricTool(activeTool);

    if (!isEditable || fabricTool === null) {
      fc.isDrawingMode = false;
      return;
    }

    if (fabricTool === 'pen') {
      fc.isDrawingMode = true;
      const brush = new PencilBrush(fc);
      brush.width = strokeWidth;
      brush.color = activeColor;
      fc.freeDrawingBrush = brush;
    } else if (fabricTool === 'highlighter') {
      fc.isDrawingMode = true;
      const brush = new PencilBrush(fc);
      brush.width = strokeWidth * 8;
      // Semi-transparent highlighter stroke
      brush.color = activeColor + '55';
      fc.freeDrawingBrush = brush;
    } else if (fabricTool === 'text') {
      fc.isDrawingMode = false;
      fc.on('mouse:down', (opt) => {
        const pointer = fc.getScenePoint(opt.e as MouseEvent);
        const itext = new FabricIText('Type here', {
          left: pointer.x,
          top: pointer.y,
          fill: activeColor,
          fontSize: 16,
          fontFamily: 'sans-serif',
        });
        fc.add(itext);
        fc.setActiveObject(itext);
        itext.enterEditing();
        fc.renderAll();
      });
    } else if (fabricTool === 'rectangle') {
      fc.isDrawingMode = false;
      fc.on('mouse:down', (opt) => {
        const pointer = fc.getScenePoint(opt.e as MouseEvent);
        shapeOrigin.current = { x: pointer.x, y: pointer.y };
        const rect = new FabricRect({
          left: pointer.x, top: pointer.y,
          width: 0, height: 0,
          fill: 'transparent',
          stroke: activeColor,
          strokeWidth,
          selectable: false,
        });
        fc.add(rect);
        shapeInProgress.current = rect;
      });
      fc.on('mouse:move', (opt) => {
        if (!shapeInProgress.current || !shapeOrigin.current) return;
        const pointer = fc.getScenePoint(opt.e as MouseEvent);
        const rect = shapeInProgress.current as InstanceType<typeof FabricRect>;
        const x = Math.min(pointer.x, shapeOrigin.current.x);
        const y = Math.min(pointer.y, shapeOrigin.current.y);
        rect.set({ left: x, top: y, width: Math.abs(pointer.x - shapeOrigin.current.x), height: Math.abs(pointer.y - shapeOrigin.current.y) });
        fc.renderAll();
      });
      fc.on('mouse:up', () => {
        if (shapeInProgress.current) {
          shapeInProgress.current.selectable = true;
          fc.renderAll();
          shapeInProgress.current = null;
          shapeOrigin.current = null;
          const json = JSON.stringify(fc.toJSON());
          undoStack.current = [...undoStack.current.slice(-19), json];
          redoStack.current = [];
          setFabricObjectCount(fc.getObjects().length);
        }
      });
    } else if (fabricTool === 'circle') {
      fc.isDrawingMode = false;
      fc.on('mouse:down', (opt) => {
        const pointer = fc.getScenePoint(opt.e as MouseEvent);
        shapeOrigin.current = { x: pointer.x, y: pointer.y };
        const circle = new FabricCircle({
          left: pointer.x, top: pointer.y,
          radius: 0,
          fill: 'transparent',
          stroke: activeColor,
          strokeWidth,
          selectable: false,
        });
        fc.add(circle);
        shapeInProgress.current = circle;
      });
      fc.on('mouse:move', (opt) => {
        if (!shapeInProgress.current || !shapeOrigin.current) return;
        const pointer = fc.getScenePoint(opt.e as MouseEvent);
        const dx = pointer.x - shapeOrigin.current.x;
        const dy = pointer.y - shapeOrigin.current.y;
        const radius = Math.sqrt(dx * dx + dy * dy) / 2;
        const circle = shapeInProgress.current as InstanceType<typeof FabricCircle>;
        circle.set({ radius, left: shapeOrigin.current.x - radius, top: shapeOrigin.current.y - radius });
        fc.renderAll();
      });
      fc.on('mouse:up', () => {
        if (shapeInProgress.current) {
          shapeInProgress.current.selectable = true;
          fc.renderAll();
          shapeInProgress.current = null;
          shapeOrigin.current = null;
          const json = JSON.stringify(fc.toJSON());
          undoStack.current = [...undoStack.current.slice(-19), json];
          redoStack.current = [];
          setFabricObjectCount(fc.getObjects().length);
        }
      });
    } else if (fabricTool === 'arrow') {
      fc.isDrawingMode = false;
      fc.on('mouse:down', (opt) => {
        const pointer = fc.getScenePoint(opt.e as MouseEvent);
        shapeOrigin.current = { x: pointer.x, y: pointer.y };
        const line = new FabricLine([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: activeColor,
          strokeWidth,
          selectable: false,
        });
        fc.add(line);
        shapeInProgress.current = line;
      });
      fc.on('mouse:move', (opt) => {
        if (!shapeInProgress.current || !shapeOrigin.current) return;
        const pointer = fc.getScenePoint(opt.e as MouseEvent);
        const line = shapeInProgress.current as InstanceType<typeof FabricLine>;
        line.set({ x2: pointer.x, y2: pointer.y });
        fc.renderAll();
      });
      fc.on('mouse:up', () => {
        if (shapeInProgress.current) {
          shapeInProgress.current.selectable = true;
          fc.renderAll();
          shapeInProgress.current = null;
          shapeOrigin.current = null;
          const json = JSON.stringify(fc.toJSON());
          undoStack.current = [...undoStack.current.slice(-19), json];
          redoStack.current = [];
          setFabricObjectCount(fc.getObjects().length);
        }
      });
    } else if (fabricTool === 'cloud') {
      // Cloud renders as a rounded rectangle with dashed stroke
      fc.isDrawingMode = false;
      fc.on('mouse:down', (opt) => {
        const pointer = fc.getScenePoint(opt.e as MouseEvent);
        shapeOrigin.current = { x: pointer.x, y: pointer.y };
        const rect = new FabricRect({
          left: pointer.x, top: pointer.y,
          width: 0, height: 0,
          fill: 'transparent',
          stroke: activeColor,
          strokeWidth,
          rx: 20, ry: 20,
          strokeDashArray: [8, 4],
          selectable: false,
        });
        fc.add(rect);
        shapeInProgress.current = rect;
      });
      fc.on('mouse:move', (opt) => {
        if (!shapeInProgress.current || !shapeOrigin.current) return;
        const pointer = fc.getScenePoint(opt.e as MouseEvent);
        const rect = shapeInProgress.current as InstanceType<typeof FabricRect>;
        const x = Math.min(pointer.x, shapeOrigin.current.x);
        const y = Math.min(pointer.y, shapeOrigin.current.y);
        rect.set({ left: x, top: y, width: Math.abs(pointer.x - shapeOrigin.current.x), height: Math.abs(pointer.y - shapeOrigin.current.y) });
        fc.renderAll();
      });
      fc.on('mouse:up', () => {
        if (shapeInProgress.current) {
          shapeInProgress.current.selectable = true;
          fc.renderAll();
          shapeInProgress.current = null;
          shapeOrigin.current = null;
          const json = JSON.stringify(fc.toJSON());
          undoStack.current = [...undoStack.current.slice(-19), json];
          redoStack.current = [];
          setFabricObjectCount(fc.getObjects().length);
        }
      });
    }
   
  }, [activeTool, activeColor, strokeWidth, isEditable]);

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
    // Text annotation via React overlay only when fabric is not handling it
    if (activeTool === 'text' && !isEditable) {
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
    const fc = fabricInst.current;
    if (fc && undoStack.current.length > 0) {
      const currentJson = JSON.stringify(fc.toJSON());
      redoStack.current = [...redoStack.current.slice(-19), currentJson];
      const prevJson = undoStack.current[undoStack.current.length - 1];
      undoStack.current = undoStack.current.slice(0, -1);
      fc.loadFromJSON(JSON.parse(prevJson)).then(() => {
        fc.renderAll();
        setFabricObjectCount(fc.getObjects().length);
      });
      return;
    }
    setMarkups((prev) => {
      if (prev.length === 0) return prev;
      const removed = prev[prev.length - 1];
      broadcastEvent({ type: 'MARKUP_DELETE', id: removed.id });
      return prev.slice(0, -1);
    });
  };

  // Wheel zoom — must use native listener to prevent scroll (React wheel is passive)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((prev) => Math.max(0.25, Math.min(4, prev - e.deltaY * 0.001)));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
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

  // ── Persistence ───────────────────────────────────────────────────────────

  const handleSaveMarkups = async () => {
    const fc = fabricInst.current;
    // Prefer serializing the fabric canvas to JSON for the parent to persist
    if (fc && onSave) {
      onSave(fc.toJSON() as object);
      return;
    }

    // Persist each fabric object as a drawing_annotation via the mutation hook
    if (fc && createAnnotationMutate) {
      setIsSaving(true);
      try {
        const objects = fc.toJSON().objects as Record<string, unknown>[];
        for (const obj of objects) {
          createAnnotationMutate(obj);
        }
      } finally {
        setIsSaving(false);
      }
      return;
    }

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
        created_by: presenceUser.name,
        created_at: new Date().toISOString(),
      }));
      await supabase.from('drawing_markups').insert(records as Database['public']['Tables']['drawing_markups']['Insert'][]);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Determine whether fabric canvas should capture pointer events ─────────

  const fabricToolActive = isEditable && ['draw', 'highlight', 'text'].includes(activeTool);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '100vw', height: '100%', backgroundColor: vizColors.dark, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${spacing['5']}`, height: 48, backgroundColor: 'rgba(10,10,10,0.97)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <span style={{ fontSize: '14px', fontWeight: 500, letterSpacing: '-0.01em', color: 'rgba(255,255,255,0.92)' }}>{drawing.setNumber}: {drawing.title}</span>
            <span style={{ fontSize: '11px', fontWeight: 500, fontFamily: typography.fontFamilyMono, color: 'rgba(255,255,255,0.4)' }}>Rev {drawing.revision} · {drawing.discipline}</span>
          </div>
          {/* Presence bar showing other active viewers */}
          <DrawingPresenceBar />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          {/* Self indicator */}
          <div
            title={`You (${presenceUser.name})`}
            style={{
              width: 24, height: 24, borderRadius: '50%',
              backgroundColor: presenceUser.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px', fontWeight: 700, color: colors.white,
              border: '2px solid rgba(10,10,10,0.97)',
            }}
          >
            {presenceUser.initials}
          </div>
          <button
            onClick={() => setShowCompare(!showCompare)}
            style={{
              padding: '4px 12px', border: 'none', borderRadius: '6px',
              backgroundColor: showCompare ? 'rgba(244,120,32,0.2)' : 'rgba(255,255,255,0.07)',
              color: showCompare ? colors.primaryOrange : 'rgba(255,255,255,0.6)',
              fontSize: '11px', fontWeight: 500,
              fontFamily: typography.fontFamily, cursor: 'pointer',
              transition: `all ${transitions.fast}`,
            }}
          >
            {showCompare ? 'Exit Compare' : 'Compare'}
          </button>
          <button onClick={onClose} aria-label="Close drawing viewer" style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', transition: `all ${transitions.fast}` }}>
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
          <div style={{ width: '180px', backgroundColor: 'rgba(0, 0, 0, 0.15)', padding: spacing['3'], flexShrink: 0, overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, marginBottom: spacing['3'] }}>Layers</p>
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
            style={{ flex: 1, position: 'relative', overflow: 'hidden', touchAction: 'manipulation', width: '100%' }}
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

              {/* Text input overlay (non-fabric fallback when isEditable is false) */}
              {textPos && (
                <div style={{ position: 'absolute', left: `${textPos.x}%`, top: `${textPos.y}%`, zIndex: 20 }}>
                  <input autoFocus value={textInput} onChange={(e) => setTextInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleTextSubmit(); if (e.key === 'Escape') setTextPos(null); }} onBlur={handleTextSubmit} placeholder="Add note..." style={{ padding: `${spacing['0.5']} ${spacing['1.5']}`, backgroundColor: colors.primaryOrange, color: colors.white, border: 'none', borderRadius: borderRadius.sm, outline: 'none', fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.semibold, minWidth: '80px' }} />
                </div>
              )}

              {/* Fabric.js annotation canvas — layered over the drawing */}
              <div
                ref={fabricContainerRef}
                aria-label="Drawing markup canvas"
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: fabricToolActive ? 'auto' : 'none',
                  zIndex: 10,
                }}
              />
            </div>

            {/* Zoom controls */}
            <div style={{ position: 'absolute', bottom: 14, left: 14, display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 5 }}>
              <button onClick={() => setZoom((z) => { const next = Math.min(4, parseFloat((z + 0.25).toFixed(2))); announceStatus(`Zoomed to ${Math.round(next * 100)}%`); return next; })} aria-label="Zoom in" title="Zoom in" style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,10,10,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}><ZoomIn size={15} /></button>
              <button onClick={() => setZoom((z) => { const next = Math.max(0.25, parseFloat((z - 0.25).toFixed(2))); announceStatus(`Zoomed to ${Math.round(next * 100)}%`); return next; })} aria-label="Zoom out" title="Zoom out" style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,10,10,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}><ZoomOut size={15} /></button>
              <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); announceStatus('View reset to fit'); }} aria-label="Reset zoom and pan" title="Reset zoom and pan" style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,10,10,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}><Maximize2 size={15} /></button>
              <div style={{ padding: '4px 0', textAlign: 'center', fontSize: '11px', fontWeight: 500, fontFamily: typography.fontFamilyMono, color: 'rgba(255,255,255,0.35)' }}>{Math.round(zoom * 100)}%</div>
            </div>

            {/* Markup toolbar with Save */}
            {isMobile ? (
              <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, backgroundColor: colors.toolbarBg, borderTop: `1px solid rgba(255,255,255,0.1)` }}>
                <button
                  onClick={() => setToolbarCollapsed((c) => !c)}
                  aria-label={toolbarCollapsed ? 'Expand toolbar' : 'Collapse toolbar'}
                  style={{ minWidth: 44, minHeight: 44, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.textOnDarkMuted }}
                >
                  {toolbarCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {!toolbarCollapsed && (
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, padding: '8px', justifyContent: 'center', gap: '4px' }}>
                    <MarkupToolbar
                      activeTool={activeTool}
                      onToolChange={setActiveTool}
                      onUndo={handleUndo}
                      canUndo={markups.length > 0 || fabricObjectCount > 0}
                      onSave={handleSaveMarkups}
                      isSaving={isSaving}
                      onCreateRFI={onCreateRFI}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div style={{ position: 'absolute', bottom: spacing['4'], left: '50%', transform: 'translateX(-50%)', zIndex: 5, display: 'flex' }}>
                <MarkupToolbar
                  activeTool={activeTool}
                  onToolChange={setActiveTool}
                  onUndo={handleUndo}
                  canUndo={markups.length > 0 || fabricObjectCount > 0}
                  onSave={handleSaveMarkups}
                  isSaving={isSaving}
                  onCreateRFI={onCreateRFI}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

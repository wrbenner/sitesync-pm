import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, PencilBrush, Circle as FabricCircle, Line as FabricLine, IText as FabricIText, Rect as FabricRect, Polygon as FabricPolygon, Polyline as FabricPolyline, Group as FabricGroup, Path as FabricPath, Shadow as FabricShadow } from 'fabric';
import { parseScaleRatio, formatFeetInches } from './measurementUtils';
import { colors, vizColors } from '../../styles/theme';
import type { AnnotationShape } from './AnnotationHistory';

export type AnnotationTool = 'select' | 'pin' | 'highlight' | 'measure' | 'text' | 'draw' | 'area' | 'count' | 'calibrate' | 'path';

interface AnnotationCanvasProps {
  width: number;
  height: number;
  pageNumber: number;
  annotations: AnnotationShape[];
  activeTool: AnnotationTool;
  activeColor: string;
  scale?: number;
  /** Drawing scale ratio string (e.g. "1/4\"=1'-0\"" or "1:100"). Used to compute real-world dimensions. */
  scaleRatio?: string | null;
  /** Manual calibration override: real inches per canvas pixel. Takes precedence over scaleRatio when set. */
  scaleOverride?: number | null;
  /** Pixels-per-inch of the rendered PDF page (defaults to 72 — standard PDF at 1x zoom). */
  pdfDpi?: number;
  isEditable?: boolean;
  currentUserId?: string;
  selectedId?: string | null;
  /** Current count-tool label (e.g. "Receptacles"). Each click drops a numbered marker in this group. */
  countLabel?: string;
  onAnnotationAdd?: (annotation: AnnotationShape) => void;
  onAnnotationSelect?: (id: string | null) => void;
  /** Called when the user completes a 2-point calibration. Pixel distance + prompted real inches. */
  onCalibrate?: (pxDistance: number) => void;
  onError?: (msg: string) => void;
}

const genId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `anno_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({
  width,
  height,
  pageNumber,
  annotations,
  activeTool,
  activeColor,
  scale = 1,
  scaleRatio = null,
  scaleOverride = null,
  pdfDpi = 72,
  isEditable = true,
  currentUserId = 'anonymous',
  selectedId = null,
  countLabel = 'Count',
  onAnnotationAdd,
  onAnnotationSelect,
  onCalibrate,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const shapeInProgress = useRef<FabricRect | FabricCircle | FabricLine | null>(null);
  const measureLabel = useRef<FabricIText | null>(null);
  const shapeOrigin = useRef<{ x: number; y: number } | null>(null);
  const measureCleanup = useRef<(() => void) | null>(null);
  // Area tool: accumulated vertices of the in-progress polygon
  const areaPoints = useRef<Array<{ x: number; y: number }>>([]);
  const areaPreview = useRef<FabricPolyline | null>(null);
  const areaLabel = useRef<FabricIText | null>(null);
  // Visual indicator at the starting vertex; highlights when cursor is near so the user knows they can click to close.
  const areaStartDot = useRef<FabricCircle | null>(null);
  const areaCleanup = useRef<(() => void) | null>(null);
  // Path tool: multi-segment non-straight distance measurement (pipe runs, curved paths, etc.).
  const pathPoints = useRef<Array<{ x: number; y: number }>>([]);
  const pathPreview = useRef<FabricPolyline | null>(null);
  const pathLabel = useRef<FabricIText | null>(null);
  const pathCleanup = useRef<(() => void) | null>(null);
  // Calibrate tool: first click point
  const calibrateFirst = useRef<{ x: number; y: number } | null>(null);
  const calibratePreview = useRef<FabricLine | null>(null);
  const [hasError, setHasError] = useState(false);

  const scaleParsed = parseScaleRatio(scaleRatio);
  const hasScale = !!scaleParsed || (!!scaleOverride && scaleOverride > 0);
  // Pure derivation of px→real-inches converter; recomputed per render. Stored in a ref only so
  // event handlers set up in tool-switch effects see the latest function without needing to re-subscribe.
  const pixelsToInchesRef = useRef<(px: number) => number>(() => 0);
  const currentPxToInches = useCallback((px: number) => {
    if (scaleOverride && scaleOverride > 0) return px * scaleOverride;
    if (!scaleParsed) return 0;
    const paperInches = px / (pdfDpi * scale);
    return paperInches * scaleParsed.realPerPaper;
  }, [scaleOverride, scaleParsed, pdfDpi, scale]);
  useEffect(() => { pixelsToInchesRef.current = currentPxToInches; }, [currentPxToInches]);

  // Stabilize callback + data refs so the tool-wiring effect doesn't tear down handlers
  // every time the parent re-renders (e.g. the loupe's onMouseMove state updates).
  const onAnnotationAddRef = useRef(onAnnotationAdd);
  useEffect(() => { onAnnotationAddRef.current = onAnnotationAdd; }, [onAnnotationAdd]);
  const onCalibrateRef = useRef(onCalibrate);
  useEffect(() => { onCalibrateRef.current = onCalibrate; }, [onCalibrate]);
  const annotationsRef = useRef(annotations);
  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);

  const reportError = useCallback((msg: string) => {
    setHasError(true);
    onError?.(msg);
  }, [onError]);

  // Initialize fabric canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    try {
      const canvasEl = document.createElement('canvas');
      canvasEl.width = width;
      canvasEl.height = height;
      container.appendChild(canvasEl);
      const fc = new FabricCanvas(canvasEl, { selection: activeTool === 'select' });
      const wrapper = canvasEl.parentElement;
      if (wrapper) {
        wrapper.style.position = 'absolute';
        wrapper.style.inset = '0';
      }
      fabricRef.current = fc;

      fc.on('selection:created', (e) => {
        const obj = e.selected?.[0];
        const id = (obj as unknown as { annotationId?: string })?.annotationId;
        onAnnotationSelect?.(id || null);
      });
      fc.on('selection:cleared', () => onAnnotationSelect?.(null));

      return () => {
        try {
          fc.dispose();
        } catch {
          // noop — already disposed
        }
        fabricRef.current = null;
      };
    } catch {
      // Defer error report past the current render cycle
      queueMicrotask(() => reportError('Failed to initialize annotation canvas'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep canvas sized
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    fc.setDimensions({ width, height });
    fc.renderAll();
  }, [width, height]);

  // Reconcile annotations with fabric canvas — don't clobber in-progress fabric objects.
  // Objects without an `annotationId` tag are ephemeral (tool previews) and are left alone.
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    const pageAnnos = annotations.filter((a) => a.pageNumber === pageNumber);
    const expectedIds = new Set(pageAnnos.map((a) => a.id));
    const existingIds = new Set<string>();

    fc.getObjects().slice().forEach((o) => {
      const id = (o as unknown as { annotationId?: string }).annotationId;
      if (!id) return;
      if (expectedIds.has(id)) existingIds.add(id);
      else fc.remove(o);
    });

    pageAnnos.forEach((a) => {
      if (existingIds.has(a.id)) return;
      const obj = buildFabricObject(a, scale);
      if (obj) {
        (obj as unknown as { annotationId: string }).annotationId = a.id;
        fc.add(obj);
      }
    });
    fc.renderAll();
  }, [annotations, pageNumber, scale]);

  // Wire tool handlers
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    fc.off('mouse:down');
    fc.off('mouse:move');
    fc.off('mouse:up');
    fc.off('mouse:dblclick');
    if (measureCleanup.current) { measureCleanup.current(); measureCleanup.current = null; }
    if (areaCleanup.current) { areaCleanup.current(); areaCleanup.current = null; }
    if (pathCleanup.current) { pathCleanup.current(); pathCleanup.current = null; }
    shapeInProgress.current = null;
    shapeOrigin.current = null;
    // Clean up any in-progress area polygon when switching tools
    if (areaPreview.current) { fc.remove(areaPreview.current); areaPreview.current = null; }
    if (areaLabel.current) { fc.remove(areaLabel.current); areaLabel.current = null; }
    if (areaStartDot.current) { fc.remove(areaStartDot.current); areaStartDot.current = null; }
    areaPoints.current = [];
    // Path tool cleanup
    if (pathPreview.current) { fc.remove(pathPreview.current); pathPreview.current = null; }
    if (pathLabel.current) { fc.remove(pathLabel.current); pathLabel.current = null; }
    pathPoints.current = [];
    // Clean up any in-progress calibration
    if (calibratePreview.current) { fc.remove(calibratePreview.current); calibratePreview.current = null; }
    calibrateFirst.current = null;

    if (!isEditable || activeTool === 'select') {
      fc.isDrawingMode = false;
      fc.selection = activeTool === 'select';
      fc.forEachObject((o) => {
        o.selectable = activeTool === 'select';
        o.evented = activeTool === 'select';
      });
      return;
    }

    fc.selection = false;
    fc.forEachObject((o) => {
      o.selectable = false;
      o.evented = false;
    });

    const addShape = (shape: AnnotationShape) => {
      onAnnotationAddRef.current?.(shape);
    };

    // Direct scene-coord computation that sidesteps fabric's getScenePoint. Accounts for any
    // ancestor CSS transform (e.g. scale(zoomLevel) wrapper) by comparing the canvas's declared
    // CSS size (offsetWidth) against its transformed client rect. Keeps tool cursors honest.
    const canvasPoint = (e: MouseEvent): { x: number; y: number } => {
      const canvas = (fc as unknown as { upperCanvasEl?: HTMLCanvasElement; lowerCanvasEl?: HTMLCanvasElement }).upperCanvasEl
        ?? (fc as unknown as { lowerCanvasEl?: HTMLCanvasElement }).lowerCanvasEl;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.offsetWidth / rect.width;
      const sy = canvas.offsetHeight / rect.height;
      return {
        x: (e.clientX - rect.left) * sx,
        y: (e.clientY - rect.top) * sy,
      };
    };

    if (activeTool === 'draw') {
      fc.isDrawingMode = true;
      const brush = new PencilBrush(fc);
      brush.width = 2.5;
      brush.color = activeColor;
      fc.freeDrawingBrush = brush;
      fc.on('path:created', (ev) => {
        const path = (ev as unknown as {
          path?: { left?: number; top?: number; width?: number; height?: number; path?: unknown; annotationId?: string; strokeLineCap?: string; strokeLineJoin?: string; fill?: unknown; dirty?: boolean; set?: (opts: Record<string, unknown>) => void };
        }).path;
        const id = genId();
        if (path) {
          path.annotationId = id;
          // Fabric's PencilBrush may emit a path with a solid fill, which renders as a darker core
          // along the centerline of the stroke. Null it out, mark dirty, and force a re-render.
          path.fill = null;
          path.strokeLineCap = 'round';
          path.strokeLineJoin = 'round';
          path.set?.({ fill: null, strokeLineCap: 'round', strokeLineJoin: 'round' });
          path.dirty = true;
          // Clear the upper canvas to remove any interactive-overlay residue from the drag.
          const fcAny = fc as unknown as { contextTop?: CanvasRenderingContext2D; clearContext?: (ctx: CanvasRenderingContext2D) => void };
          if (fcAny.clearContext && fcAny.contextTop) fcAny.clearContext(fcAny.contextTop);
          fc.requestRenderAll();
        }
        addShape({
          id,
          type: 'draw',
          coordinates: {
            x: path?.left ?? 0,
            y: path?.top ?? 0,
            width: path?.width ?? 0,
            height: path?.height ?? 0,
            // Preserve the actual brush path so reload rebuilds as a real stroke, not a bounding rect.
            pathData: (path as unknown as { path?: unknown })?.path,
          },
          color: activeColor,
          pageNumber,
          createdBy: currentUserId,
          createdAt: new Date().toISOString(),
        });
      });
      return;
    }

    if (activeTool === 'highlight') {
      fc.isDrawingMode = true;
      const brush = new PencilBrush(fc);
      brush.width = 20;
      // Slightly lower alpha so overlaps don't accumulate into solid orange; normal blend (no multiply)
      // avoids the centerline darkening that shows up on complex paths.
      brush.color = activeColor + '40';
      fc.freeDrawingBrush = brush;
      fc.on('path:created', (ev) => {
        const path = (ev as unknown as {
          path?: { left?: number; top?: number; width?: number; height?: number; path?: unknown; annotationId?: string; fill?: unknown; strokeLineCap?: string; strokeLineJoin?: string; dirty?: boolean; set?: (opts: Record<string, unknown>) => void };
        }).path;
        const id = genId();
        if (path) {
          path.annotationId = id;
          // Kill the default filled interior so highlighter reads as a translucent band, not a dark core.
          path.fill = null;
          path.strokeLineCap = 'butt';
          path.strokeLineJoin = 'round';
          path.set?.({ fill: null, strokeLineCap: 'butt', strokeLineJoin: 'round' });
          path.dirty = true;
          const fcAny = fc as unknown as { contextTop?: CanvasRenderingContext2D; clearContext?: (ctx: CanvasRenderingContext2D) => void };
          if (fcAny.clearContext && fcAny.contextTop) fcAny.clearContext(fcAny.contextTop);
          fc.requestRenderAll();
        }
        addShape({
          id,
          type: 'highlight',
          coordinates: {
            x: path?.left ?? 0,
            y: path?.top ?? 0,
            width: path?.width ?? 0,
            height: path?.height ?? 0,
            pathData: (path as unknown as { path?: unknown })?.path,
          },
          color: activeColor,
          pageNumber,
          createdBy: currentUserId,
          createdAt: new Date().toISOString(),
        });
      });
      return;
    }

    fc.isDrawingMode = false;

    if (activeTool === 'text') {
      // Make existing text objects clickable/editable while this tool is active.
      // Without this the forEachObject call above would have disabled their events.
      fc.selection = true;
      fc.forEachObject((o) => {
        const isText = (o as unknown as { type?: string }).type === 'i-text';
        o.selectable = isText;
        o.evented = isText;
      });

      fc.on('mouse:down', (opt) => {
        // If the click landed on an existing text annotation, enter editing instead of creating.
        const target = (opt as unknown as { target?: { enterEditing?: () => void; annotationId?: string } }).target;
        if (target && typeof target.enterEditing === 'function') {
          fc.setActiveObject(target as unknown as FabricIText);
          target.enterEditing();
          fc.renderAll();
          return;
        }
        const p = canvasPoint(opt.e as MouseEvent);
        const it = new FabricIText('Type here', {
          left: p.x,
          top: p.y,
          fill: activeColor,
          fontSize: 16,
          fontFamily: 'sans-serif',
        });
        const id = genId();
        (it as unknown as { annotationId: string }).annotationId = id;
        fc.add(it);
        fc.setActiveObject(it);
        it.enterEditing();
        // Select the placeholder so typing immediately replaces it.
        it.selectAll();
        fc.renderAll();
        addShape({
          id,
          type: 'text',
          coordinates: { x: p.x, y: p.y },
          text: 'Type here',
          color: activeColor,
          pageNumber,
          createdBy: currentUserId,
          createdAt: new Date().toISOString(),
        });
      });
      return;
    }

    if (activeTool === 'pin') {
      fc.on('mouse:down', (opt) => {
        const p = canvasPoint(opt.e as MouseEvent);
        const circle = new FabricCircle({
          left: p.x - 10,
          top: p.y - 10,
          radius: 10,
          fill: activeColor,
          stroke: colors.white,
          strokeWidth: 2.5,
          shadow: new FabricShadow({ color: 'rgba(0,0,0,0.25)', blur: 6, offsetX: 0, offsetY: 2 }),
        });
        const id = genId();
        (circle as unknown as { annotationId: string }).annotationId = id;
        fc.add(circle);
        fc.renderAll();
        addShape({
          id,
          type: 'pin',
          coordinates: { x: p.x, y: p.y },
          color: activeColor,
          pageNumber,
          createdBy: currentUserId,
          createdAt: new Date().toISOString(),
        });
      });
      return;
    }

    if (activeTool === 'measure') {
      // Snap the endpoint to the nearest 0° / 45° / 90° axis when Shift is held.
      const applyOrthoSnap = (origin: { x: number; y: number }, p: { x: number; y: number }, shift: boolean) => {
        if (!shift) return p;
        const dx = p.x - origin.x;
        const dy = p.y - origin.y;
        if (Math.abs(dx) > Math.abs(dy) * 2) return { x: p.x, y: origin.y }; // horizontal
        if (Math.abs(dy) > Math.abs(dx) * 2) return { x: origin.x, y: p.y }; // vertical
        // 45° diagonal: equalize magnitudes, preserve signs
        const mag = Math.max(Math.abs(dx), Math.abs(dy));
        return { x: origin.x + Math.sign(dx) * mag, y: origin.y + Math.sign(dy) * mag };
      };

      const abortMeasure = () => {
        if (shapeInProgress.current) fc.remove(shapeInProgress.current);
        if (measureLabel.current) fc.remove(measureLabel.current);
        shapeInProgress.current = null;
        measureLabel.current = null;
        shapeOrigin.current = null;
        fc.renderAll();
      };

      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape' && shapeOrigin.current) {
          ev.preventDefault();
          abortMeasure();
        }
      };
      window.addEventListener('keydown', onKeyDown);
      measureCleanup.current = () => window.removeEventListener('keydown', onKeyDown);

      fc.on('mouse:down', (opt) => {
        const p = canvasPoint(opt.e as MouseEvent);
        shapeOrigin.current = { x: p.x, y: p.y };
        const line = new FabricLine([p.x, p.y, p.x, p.y], {
          stroke: activeColor,
          strokeWidth: 2,
          selectable: false,
          evented: false,
        });
        shapeInProgress.current = line;
        fc.add(line);
        // Label starts hidden — shown only once the user has actually dragged far enough
        // to show a meaningful number. Prevents an empty white pill stuck at the origin.
        const label = new FabricIText(hasScale ? '0"' : 'calibrate first', {
          left: p.x,
          top: p.y,
          fill: hasScale ? '#111111' : '#B00020',
          fontSize: 14,
          fontWeight: 'bold',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          backgroundColor: 'rgba(255,255,255,0.95)',
          padding: 6,
          selectable: false,
          evented: false,
          originX: 'center',
          originY: 'center',
          opacity: 0,
        });
        measureLabel.current = label;
        fc.add(label);
      });
      fc.on('mouse:move', (opt) => {
        if (!shapeInProgress.current || !shapeOrigin.current) return;
        const e = opt.e as MouseEvent;
        const raw = canvasPoint(e);
        const end = applyOrthoSnap(shapeOrigin.current, raw, e.shiftKey);
        (shapeInProgress.current as FabricLine).set({ x2: end.x, y2: end.y });
        if (measureLabel.current) {
          const dx = end.x - shapeOrigin.current.x;
          const dy = end.y - shapeOrigin.current.y;
          const pxDist = Math.sqrt(dx * dx + dy * dy);
          const midX = (shapeOrigin.current.x + end.x) / 2;
          const midY = (shapeOrigin.current.y + end.y) / 2;
          const text = hasScale ? formatFeetInches(pixelsToInchesRef.current(pxDist)) : 'calibrate first';
          measureLabel.current.set({ text, left: midX, top: midY, opacity: pxDist > 5 ? 1 : 0 });
        }
        fc.renderAll();
      });
      fc.on('mouse:up', (opt) => {
        if (!shapeOrigin.current) { abortMeasure(); return; }
        const e = opt.e as MouseEvent;
        const raw = canvasPoint(e);
        const end = applyOrthoSnap(shapeOrigin.current, raw, e.shiftKey);
        const dx = end.x - shapeOrigin.current.x;
        const dy = end.y - shapeOrigin.current.y;
        const pxDist = Math.sqrt(dx * dx + dy * dy);
        // Reject accidental clicks (<5px) so we don't litter the canvas with specks
        if (pxDist < 5) { abortMeasure(); return; }
        const realInches = hasScale ? pixelsToInchesRef.current(pxDist) : 0;
        // Remove the ephemeral preview — reconcile will rebuild the final group from the stored annotation
        if (shapeInProgress.current) fc.remove(shapeInProgress.current);
        if (measureLabel.current) fc.remove(measureLabel.current);
        addShape({
          id: genId(),
          type: 'measure',
          coordinates: {
            x: shapeOrigin.current.x,
            y: shapeOrigin.current.y,
            endX: end.x,
            endY: end.y,
          },
          color: activeColor,
          pageNumber,
          createdBy: currentUserId,
          createdAt: new Date().toISOString(),
          text: hasScale ? formatFeetInches(realInches) : 'uncalibrated',
        });
        shapeInProgress.current = null;
        shapeOrigin.current = null;
        measureLabel.current = null;
      });
      return;
    }

    if (activeTool === 'area') {
      // Polygon builder.
      // Primary close: click the starting dot (it highlights when cursor is within snap range).
      // Secondary close: double-click anywhere.
      // Cancel: Escape.
      const SNAP_RADIUS = 12; // pixels — how close to the starting point counts as "snapped"

      const isNearStart = (p: { x: number; y: number }) => {
        const s = areaPoints.current[0];
        if (!s || areaPoints.current.length < 3) return false;
        return Math.hypot(p.x - s.x, p.y - s.y) < SNAP_RADIUS;
      };

      const redrawPreview = () => {
        if (areaPreview.current) { fc.remove(areaPreview.current); areaPreview.current = null; }
        if (areaPoints.current.length >= 2) {
          const poly = new FabricPolyline(areaPoints.current.map((pt) => ({ x: pt.x, y: pt.y })), {
            stroke: activeColor,
            strokeWidth: 2,
            fill: null,
            selectable: false,
            evented: false,
          });
          areaPreview.current = poly;
          fc.add(poly);
        }
        fc.renderAll();
      };

      const updateLabel = (cursor: { x: number; y: number } | null, snapActive: boolean) => {
        if (!areaLabel.current) return;
        const pts = cursor ? [...areaPoints.current, cursor] : areaPoints.current;
        let readout: string;
        if (snapActive) {
          readout = 'Click to close';
        } else if (hasScale && pts.length >= 2) {
          readout = formatAreaReadout(pts, pixelsToInchesRef.current);
        } else {
          readout = pts.length < 3
            ? `${pts.length} pt${pts.length === 1 ? '' : 's'} — keep clicking vertices`
            : `${pts.length} pts — click start dot to close`;
        }
        const anchor = pts[pts.length - 1] ?? { x: 0, y: 0 };
        areaLabel.current.set({ text: readout, left: anchor.x + 10, top: anchor.y + 10 });
      };

      const abortArea = () => {
        if (areaPreview.current) fc.remove(areaPreview.current);
        if (areaLabel.current) fc.remove(areaLabel.current);
        if (areaStartDot.current) fc.remove(areaStartDot.current);
        areaPoints.current = [];
        areaPreview.current = null;
        areaLabel.current = null;
        areaStartDot.current = null;
        fc.renderAll();
      };

      const finalizeArea = () => {
        const pts = areaPoints.current;
        if (pts.length < 3) { abortArea(); return; }
        // closed=true so the perimeter accounts for the segment from the last vertex back to the first.
        const text = hasScale ? formatAreaReadout(pts, pixelsToInchesRef.current, true) : undefined;
        addShape({
          id: genId(),
          type: 'area',
          coordinates: {
            x: pts[0].x,
            y: pts[0].y,
            points: pts.map((p) => [p.x, p.y] as [number, number]),
          },
          color: activeColor,
          text,
          pageNumber,
          createdBy: currentUserId,
          createdAt: new Date().toISOString(),
        });
        abortArea();
      };

      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape' && areaPoints.current.length > 0) {
          ev.preventDefault();
          abortArea();
        } else if ((ev.key === 'Enter' || ev.key === 'Return') && areaPoints.current.length >= 3) {
          ev.preventDefault();
          finalizeArea();
        }
      };
      window.addEventListener('keydown', onKeyDown);
      areaCleanup.current = () => window.removeEventListener('keydown', onKeyDown);

      fc.on('mouse:down', (opt) => {
        const p = canvasPoint(opt.e as MouseEvent);
        // Click on the start dot (when 3+ points) closes the polygon.
        if (isNearStart(p)) { finalizeArea(); return; }
        areaPoints.current.push({ x: p.x, y: p.y });
        if (!areaLabel.current) {
          const lbl = new FabricIText('', {
            left: p.x + 10, top: p.y + 10,
            fill: activeColor, fontSize: 13, fontWeight: 'bold',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            backgroundColor: 'rgba(255,255,255,0.95)',
            padding: 5,
            selectable: false, evented: false,
          });
          areaLabel.current = lbl;
          fc.add(lbl);
        }
        if (!areaStartDot.current) {
          // First vertex — drop a visible starting dot the user can click later to close.
          const dot = new FabricCircle({
            left: p.x - 5, top: p.y - 5, radius: 5,
            fill: activeColor, stroke: '#FFFFFF', strokeWidth: 2,
            selectable: false, evented: false,
          });
          areaStartDot.current = dot;
          fc.add(dot);
        }
        redrawPreview();
        updateLabel(null, false);
        fc.renderAll();
      });

      fc.on('mouse:move', (opt) => {
        if (areaPoints.current.length === 0) return;
        const p = canvasPoint(opt.e as MouseEvent);
        const snap = isNearStart(p);
        // Visually amplify the starting dot when the cursor is in snap range.
        if (areaStartDot.current) {
          areaStartDot.current.set({
            radius: snap ? 9 : 5,
            left: areaPoints.current[0].x - (snap ? 9 : 5),
            top: areaPoints.current[0].y - (snap ? 9 : 5),
            fill: snap ? '#FFFFFF' : activeColor,
            stroke: snap ? activeColor : '#FFFFFF',
          });
        }
        updateLabel({ x: p.x, y: p.y }, snap);
        fc.renderAll();
      });

      // Power-user backup: double-click anywhere also closes.
      fc.on('mouse:dblclick', () => { finalizeArea(); });

      return;
    }

    if (activeTool === 'path') {
      // Multi-segment distance: click vertices to build the path, Enter or double-click finalizes,
      // Escape cancels. Tracks non-straight runs (pipe, baseboard, etc.) as a polyline.
      const totalLengthPx = (pts: Array<{ x: number; y: number }>): number => {
        let sum = 0;
        for (let i = 0; i < pts.length - 1; i++) sum += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
        return sum;
      };

      const redrawPathPreview = () => {
        if (pathPreview.current) { fc.remove(pathPreview.current); pathPreview.current = null; }
        if (pathPoints.current.length >= 2) {
          const line = new FabricPolyline(pathPoints.current.map((pt) => ({ x: pt.x, y: pt.y })), {
            stroke: activeColor,
            strokeWidth: 2.5,
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
            fill: null,
            selectable: false,
            evented: false,
          });
          pathPreview.current = line;
          fc.add(line);
        }
        fc.renderAll();
      };

      const updatePathLabel = (cursor: { x: number; y: number } | null) => {
        if (!pathLabel.current) return;
        const pts = cursor ? [...pathPoints.current, cursor] : pathPoints.current;
        const lenPx = totalLengthPx(pts);
        const text = hasScale
          ? `${formatFeetInches(pixelsToInchesRef.current(lenPx))}${pts.length > 2 ? ` · ${pts.length - 1} segs` : ''}`
          : pts.length < 2 ? 'click to add vertices' : 'calibrate first';
        const last = pts[pts.length - 1] ?? { x: 0, y: 0 };
        pathLabel.current.set({ text, left: last.x + 12, top: last.y - 20 });
      };

      const abortPath = () => {
        if (pathPreview.current) fc.remove(pathPreview.current);
        if (pathLabel.current) fc.remove(pathLabel.current);
        pathPoints.current = [];
        pathPreview.current = null;
        pathLabel.current = null;
        fc.renderAll();
      };

      const finalizePath = () => {
        const pts = pathPoints.current;
        if (pts.length < 2) { abortPath(); return; }
        const lenPx = totalLengthPx(pts);
        const text = hasScale ? formatFeetInches(pixelsToInchesRef.current(lenPx)) : 'uncalibrated';
        addShape({
          id: genId(),
          type: 'path',
          coordinates: {
            x: pts[0].x,
            y: pts[0].y,
            points: pts.map((p) => [p.x, p.y] as [number, number]),
          },
          color: activeColor,
          text,
          pageNumber,
          createdBy: currentUserId,
          createdAt: new Date().toISOString(),
        });
        abortPath();
      };

      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape' && pathPoints.current.length > 0) {
          ev.preventDefault();
          abortPath();
        } else if ((ev.key === 'Enter' || ev.key === 'Return') && pathPoints.current.length >= 2) {
          ev.preventDefault();
          finalizePath();
        }
      };
      window.addEventListener('keydown', onKeyDown);
      pathCleanup.current = () => window.removeEventListener('keydown', onKeyDown);

      fc.on('mouse:down', (opt) => {
        const p = canvasPoint(opt.e as MouseEvent);
        pathPoints.current.push({ x: p.x, y: p.y });
        if (!pathLabel.current) {
          const lbl = new FabricIText('', {
            left: p.x + 12, top: p.y - 20,
            fill: '#111111',
            fontSize: 13,
            fontWeight: '700',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            backgroundColor: 'rgba(255,255,255,0.97)',
            padding: 5,
            selectable: false, evented: false,
          });
          pathLabel.current = lbl;
          fc.add(lbl);
        }
        redrawPathPreview();
        updatePathLabel(null);
        fc.renderAll();
      });

      fc.on('mouse:move', (opt) => {
        if (pathPoints.current.length === 0) return;
        const p = canvasPoint(opt.e as MouseEvent);
        updatePathLabel({ x: p.x, y: p.y });
        fc.renderAll();
      });

      // Double-click finalizes.
      fc.on('mouse:dblclick', () => { finalizePath(); });

      return;
    }

    if (activeTool === 'count') {
      // Each click drops a numbered marker. Index is computed from existing count annotations in the same label group.
      fc.on('mouse:down', (opt) => {
        const p = canvasPoint(opt.e as MouseEvent);
        const existing = annotationsRef.current.filter((a) => a.type === 'count' && (a.countLabel ?? 'Count') === countLabel);
        const nextIndex = existing.length + 1;
        const group = makeCountMarker(p.x, p.y, nextIndex, activeColor);
        const id = genId();
        (group as unknown as { annotationId: string }).annotationId = id;
        fc.add(group);
        fc.renderAll();
        addShape({
          id,
          type: 'count',
          coordinates: { x: p.x, y: p.y },
          color: activeColor,
          countLabel,
          countIndex: nextIndex,
          pageNumber,
          createdBy: currentUserId,
          createdAt: new Date().toISOString(),
          text: `${countLabel} #${nextIndex}`,
        });
      });
      return;
    }

    if (activeTool === 'calibrate') {
      fc.on('mouse:down', (opt) => {
        const p = canvasPoint(opt.e as MouseEvent);
        if (!calibrateFirst.current) {
          calibrateFirst.current = { x: p.x, y: p.y };
          const line = new FabricLine([p.x, p.y, p.x, p.y], {
            stroke: '#F47820',
            strokeWidth: 3,
            strokeDashArray: [6, 4],
            selectable: false,
            evented: false,
          });
          calibratePreview.current = line;
          fc.add(line);
        } else {
          const dx = p.x - calibrateFirst.current.x;
          const dy = p.y - calibrateFirst.current.y;
          const pxDist = Math.sqrt(dx * dx + dy * dy);
          if (calibratePreview.current) {
            fc.remove(calibratePreview.current);
            calibratePreview.current = null;
          }
          calibrateFirst.current = null;
          fc.renderAll();
          onCalibrateRef.current?.(pxDist);
        }
      });
      fc.on('mouse:move', (opt) => {
        if (!calibrateFirst.current || !calibratePreview.current) return;
        const p = canvasPoint(opt.e as MouseEvent);
        (calibratePreview.current as FabricLine).set({ x2: p.x, y2: p.y });
        fc.renderAll();
      });
      return;
    }
  }, [activeTool, activeColor, isEditable, pageNumber, currentUserId, countLabel, hasScale]);

  // Highlight selected
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    fc.forEachObject((obj) => {
      const id = (obj as unknown as { annotationId?: string }).annotationId;
      if (id && id === selectedId) {
        obj.set({ stroke: vizColors.highlight, strokeWidth: 3 });
      }
    });
    fc.renderAll();
  }, [selectedId]);

  if (hasError) {
    return (
      <div
        role="alert"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceInset,
          color: colors.statusCritical,
          fontSize: 14,
        }}
      >
        Annotation layer failed to load. Reload the page to retry.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: isEditable ? 'auto' : 'none',
        touchAction: 'none',
      }}
      aria-label={`Annotation canvas for page ${pageNumber}`}
    />
  );
};

function buildFabricObject(a: AnnotationShape, _scale: number): FabricRect | FabricCircle | FabricLine | FabricIText | FabricPolygon | FabricGroup | FabricPath | null {
  const { coordinates: c, color, type } = a;
  switch (type) {
    case 'rectangle':
      return new FabricRect({
        left: c.x,
        top: c.y,
        width: c.width ?? 0,
        height: c.height ?? 0,
        fill: 'transparent',
        stroke: color,
        strokeWidth: 2,
      });
    case 'highlight': {
      // Prefer the real stroke path if it was serialized at creation; fall back to a faint band for legacy rows.
      if (c.pathData) {
        try {
          return new FabricPath(c.pathData as never, {
            stroke: color + '55',
            strokeWidth: 18,
            fill: null,
            strokeLineCap: 'butt',
            strokeLineJoin: 'round',
            globalCompositeOperation: 'multiply',
            selectable: false,
            evented: false,
          });
        } catch { /* fall through to legacy rect */ }
      }
      return new FabricRect({
        left: c.x, top: c.y, width: c.width ?? 0, height: c.height ?? 0,
        fill: color + '22', stroke: '', selectable: false, evented: false,
      });
    }
    case 'pin':
      return new FabricCircle({
        left: c.x - 10,
        top: c.y - 10,
        radius: 10,
        fill: color,
        stroke: '#FFFFFF',
        strokeWidth: 2.5,
        shadow: new FabricShadow({ color: 'rgba(0,0,0,0.25)', blur: 6, offsetX: 0, offsetY: 2 }),
      });
    case 'measure':
      return makeMeasureAnnotation(c.x, c.y, c.endX ?? c.x, c.endY ?? c.y, color, a.text ?? '');
    case 'text':
      return new FabricIText(a.text ?? '', {
        left: c.x,
        top: c.y,
        fill: color,
        fontSize: 16,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      });
    case 'area': {
      const pts = (c.points ?? []).map(([x, y]) => ({ x, y }));
      if (pts.length < 3) return null;
      return makeAreaAnnotation(pts, color, a.text ?? '');
    }
    case 'path': {
      const pts = (c.points ?? []).map(([x, y]) => ({ x, y }));
      if (pts.length < 2) return null;
      return makePathAnnotation(pts, color, a.text ?? '');
    }
    case 'count': {
      return makeCountMarker(c.x, c.y, a.countIndex ?? 1, color);
    }
    case 'draw': {
      // Prefer the real serialized stroke; legacy rows (bounding box only) render nothing visible
      // since the actual stroke data is lost.
      if (c.pathData) {
        try {
          return new FabricPath(c.pathData as never, {
            stroke: color,
            strokeWidth: 2.5,
            fill: null,
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
            selectable: false,
            evented: false,
          });
        } catch { /* fall through */ }
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Composite path annotation: open polyline + length pill near the mid-segment.
 * Used for multi-segment distances (pipe runs, baseboard, irregular walls).
 */
function makePathAnnotation(pts: Array<{ x: number; y: number }>, color: string, text: string): FabricGroup {
  const line = new FabricPolyline(pts, {
    stroke: color,
    strokeWidth: 2.5,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    fill: null,
    originX: 'left',
    originY: 'top',
  });
  const endpointShadow = new FabricShadow({ color: 'rgba(0,0,0,0.2)', blur: 4, offsetX: 0, offsetY: 1 });
  const first = pts[0];
  const last = pts[pts.length - 1];
  const dotStart = new FabricCircle({
    left: first.x - 4.5, top: first.y - 4.5, radius: 4.5,
    fill: color, stroke: '#FFFFFF', strokeWidth: 1.75,
    originX: 'left', originY: 'top',
    shadow: endpointShadow,
  });
  const dotEnd = new FabricCircle({
    left: last.x - 4.5, top: last.y - 4.5, radius: 4.5,
    fill: color, stroke: '#FFFFFF', strokeWidth: 1.75,
    originX: 'left', originY: 'top',
    shadow: endpointShadow,
  });
  // Anchor the label near the mid-segment for readability on winding paths.
  const midIdx = Math.floor((pts.length - 1) / 2);
  const a = pts[midIdx];
  const b = pts[midIdx + 1] ?? a;
  const label = new FabricIText(text || '', {
    left: (a.x + b.x) / 2, top: (a.y + b.y) / 2,
    fill: '#111111',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    backgroundColor: 'rgba(255,255,255,0.97)',
    padding: 6,
    originX: 'center', originY: 'center',
    shadow: new FabricShadow({ color: 'rgba(0,0,0,0.15)', blur: 6, offsetX: 0, offsetY: 1 }),
  });
  return new FabricGroup([line, dotStart, dotEnd, label], { selectable: false, evented: false });
}

/**
 * Composite area annotation: filled polygon + centered readout pill (e.g., "240 sq ft").
 * Label is placed at the polygon's centroid so the user always sees the measurement.
 */
function makeAreaAnnotation(pts: Array<{ x: number; y: number }>, color: string, text: string): FabricGroup {
  const polygon = new FabricPolygon(pts, {
    fill: color + '33',
    stroke: color,
    strokeWidth: 2.5,
    strokeLineJoin: 'round',
    originX: 'left',
    originY: 'top',
  });
  // Centroid of the polygon — mean of the vertices is good enough for a label anchor.
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const label = new FabricIText(text || '', {
    left: cx, top: cy,
    fill: '#111111',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    backgroundColor: 'rgba(255,255,255,0.97)',
    padding: 6,
    originX: 'center',
    originY: 'center',
    shadow: new FabricShadow({ color: 'rgba(0,0,0,0.15)', blur: 6, offsetX: 0, offsetY: 1 }),
  });
  return new FabricGroup([polygon, label], { selectable: false, evented: false });
}

/**
 * Composite measurement annotation: line + endpoint dots + centered dimension pill.
 * Stays on the drawing after the user releases so the reading is always visible.
 */
function makeMeasureAnnotation(x1: number, y1: number, x2: number, y2: number, color: string, text: string): FabricGroup {
  const line = new FabricLine([x1, y1, x2, y2], {
    stroke: color,
    strokeWidth: 2,
    strokeLineCap: 'round',
    originX: 'left',
    originY: 'top',
  });
  const endpointShadow = new FabricShadow({ color: 'rgba(0,0,0,0.2)', blur: 4, offsetX: 0, offsetY: 1 });
  const dotStart = new FabricCircle({
    left: x1 - 4.5, top: y1 - 4.5, radius: 4.5,
    fill: color, stroke: '#FFFFFF', strokeWidth: 1.75,
    originX: 'left', originY: 'top',
    shadow: endpointShadow,
  });
  const dotEnd = new FabricCircle({
    left: x2 - 4.5, top: y2 - 4.5, radius: 4.5,
    fill: color, stroke: '#FFFFFF', strokeWidth: 1.75,
    originX: 'left', originY: 'top',
    shadow: endpointShadow,
  });
  const label = new FabricIText(text || '', {
    left: (x1 + x2) / 2, top: (y1 + y2) / 2,
    fill: '#111111',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    backgroundColor: 'rgba(255,255,255,0.97)',
    padding: 6,
    originX: 'center', originY: 'center',
    shadow: new FabricShadow({ color: 'rgba(0,0,0,0.15)', blur: 6, offsetX: 0, offsetY: 1 }),
  });
  return new FabricGroup([line, dotStart, dotEnd, label], { selectable: false, evented: false });
}

/**
 * Composite marker for the count tool: orange circle with a white number inside.
 * Kept in sync with live-drop rendering in the 'count' tool handler.
 */
function makeCountMarker(x: number, y: number, index: number, color: string): FabricGroup {
  const radius = 14;
  const circle = new FabricCircle({
    left: -radius, top: -radius,
    radius, fill: color, stroke: '#FFFFFF', strokeWidth: 2.5,
    originX: 'left', originY: 'top',
    shadow: new FabricShadow({ color: 'rgba(0,0,0,0.25)', blur: 6, offsetX: 0, offsetY: 2 }),
  });
  const label = new FabricIText(String(index), {
    fill: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    originX: 'center', originY: 'center',
    left: 0, top: 0,
  });
  return new FabricGroup([circle, label], { left: x - radius, top: y - radius, selectable: false });
}

/**
 * Compute an area + perimeter readout for a polygon defined by canvas-pixel points.
 * Uses the shoelace formula for area; uses the provided px→inches converter for real units.
 */
function formatAreaReadout(pts: Array<{ x: number; y: number }>, pxToInches: (px: number) => number, closed = false): string {
  if (pts.length < 2) return '0 ft²';
  // Shoelace area in px²
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  const pxArea = Math.abs(sum) / 2;
  // Convert px² → in² via pxToInches applied to sqrt (linear) then squared
  const inchesPerPx = pxToInches(1); // real inches per px
  const sqInches = pxArea * inchesPerPx * inchesPerPx;
  const sqFeet = sqInches / 144;
  // Perimeter — include closing segment only once the polygon is finalized.
  let perimPx = 0;
  const segCount = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < segCount; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    perimPx += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const perimFt = pxToInches(perimPx) / 12;
  if (sqFeet === 0 && perimFt === 0) return `${pts.length} pts`;
  return `${sqFeet.toFixed(1)} ft² · ${perimFt.toFixed(1)} ft perim`;
}

export default AnnotationCanvas;

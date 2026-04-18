import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, PencilBrush, Circle as FabricCircle, Line as FabricLine, IText as FabricIText, Rect as FabricRect } from 'fabric';
import { parseScaleRatio, formatFeetInches } from './measurementUtils';
import { colors, vizColors } from '../../styles/theme';
import type { AnnotationShape } from './AnnotationHistory';

export type AnnotationTool = 'select' | 'pin' | 'highlight' | 'measure' | 'text' | 'draw';

interface AnnotationCanvasProps {
  width: number;
  height: number;
  pageNumber: number;
  annotations: AnnotationShape[];
  activeTool: AnnotationTool;
  activeColor: string;
  scale?: number;
  /** Drawing scale ratio string (e.g. "1/4\"=1'-0\"" or "1:100"). Used to compute real-world dimensions for the measure tool. */
  scaleRatio?: string | null;
  /** Pixels-per-inch of the rendered PDF page (defaults to 72 — standard PDF at 1x zoom). */
  pdfDpi?: number;
  isEditable?: boolean;
  currentUserId?: string;
  selectedId?: string | null;
  onAnnotationAdd?: (annotation: AnnotationShape) => void;
  onAnnotationSelect?: (id: string | null) => void;
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
  pdfDpi = 72,
  isEditable = true,
  currentUserId = 'anonymous',
  selectedId = null,
  onAnnotationAdd,
  onAnnotationSelect,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const shapeInProgress = useRef<FabricRect | FabricCircle | FabricLine | null>(null);
  const measureLabel = useRef<FabricIText | null>(null);
  const shapeOrigin = useRef<{ x: number; y: number } | null>(null);
  const [hasError, setHasError] = useState(false);

  const scaleParsed = parseScaleRatio(scaleRatio);
  const pixelsToInchesRef = useRef<(px: number) => number>(() => 0);
  pixelsToInchesRef.current = (px: number) => {
    if (!scaleParsed) return 0;
    const paperInches = px / (pdfDpi * scale);
    return paperInches * scaleParsed.realPerPaper;
  };

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
      reportError('Failed to initialize annotation canvas');
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

  // Render annotations for current page
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    fc.clear();
    const pageAnnos = annotations.filter((a) => a.pageNumber === pageNumber);
    pageAnnos.forEach((a) => {
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
    shapeInProgress.current = null;
    shapeOrigin.current = null;

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
      onAnnotationAdd?.(shape);
    };

    if (activeTool === 'draw') {
      fc.isDrawingMode = true;
      const brush = new PencilBrush(fc);
      brush.width = 2;
      brush.color = activeColor;
      fc.freeDrawingBrush = brush;
      fc.on('path:created', (ev) => {
        const path = (ev as unknown as { path?: { left?: number; top?: number; width?: number; height?: number } }).path;
        addShape({
          id: genId(),
          type: 'draw',
          coordinates: {
            x: path?.left ?? 0,
            y: path?.top ?? 0,
            width: path?.width ?? 0,
            height: path?.height ?? 0,
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
      brush.width = 16;
      brush.color = activeColor + '55';
      fc.freeDrawingBrush = brush;
      fc.on('path:created', (ev) => {
        const path = (ev as unknown as { path?: { left?: number; top?: number; width?: number; height?: number } }).path;
        addShape({
          id: genId(),
          type: 'highlight',
          coordinates: {
            x: path?.left ?? 0,
            y: path?.top ?? 0,
            width: path?.width ?? 0,
            height: path?.height ?? 0,
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
      fc.on('mouse:down', (opt) => {
        const p = fc.getPointer(opt.e as MouseEvent);
        const it = new FabricIText('Type here', {
          left: p.x,
          top: p.y,
          fill: activeColor,
          fontSize: 16,
          fontFamily: 'sans-serif',
        });
        fc.add(it);
        fc.setActiveObject(it);
        it.enterEditing();
        fc.renderAll();
        addShape({
          id: genId(),
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
        const p = fc.getPointer(opt.e as MouseEvent);
        const circle = new FabricCircle({
          left: p.x - 10,
          top: p.y - 10,
          radius: 10,
          fill: activeColor,
          stroke: colors.white,
          strokeWidth: 2,
        });
        fc.add(circle);
        fc.renderAll();
        addShape({
          id: genId(),
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
      fc.on('mouse:down', (opt) => {
        const p = fc.getPointer(opt.e as MouseEvent);
        shapeOrigin.current = { x: p.x, y: p.y };
        const line = new FabricLine([p.x, p.y, p.x, p.y], {
          stroke: activeColor,
          strokeWidth: 2,
          selectable: false,
          evented: false,
        });
        shapeInProgress.current = line;
        fc.add(line);
        if (scaleParsed) {
          const label = new FabricIText('', {
            left: p.x + 8,
            top: p.y - 20,
            fill: activeColor,
            fontSize: 13,
            fontWeight: 'bold',
            fontFamily: 'sans-serif',
            backgroundColor: 'rgba(255,255,255,0.9)',
            selectable: false,
            evented: false,
          });
          measureLabel.current = label;
          fc.add(label);
        }
      });
      fc.on('mouse:move', (opt) => {
        if (!shapeInProgress.current || !shapeOrigin.current) return;
        const p = fc.getPointer(opt.e as MouseEvent);
        (shapeInProgress.current as FabricLine).set({ x2: p.x, y2: p.y });
        if (measureLabel.current && scaleParsed) {
          const dx = p.x - shapeOrigin.current.x;
          const dy = p.y - shapeOrigin.current.y;
          const pxDist = Math.sqrt(dx * dx + dy * dy);
          const inches = pixelsToInchesRef.current(pxDist);
          measureLabel.current.set({ text: formatFeetInches(inches) + ' (measured)', left: p.x + 8, top: p.y - 20 });
        }
        fc.renderAll();
      });
      fc.on('mouse:up', (opt) => {
        if (!shapeOrigin.current) return;
        const p = fc.getPointer(opt.e as MouseEvent);
        const dx = p.x - shapeOrigin.current.x;
        const dy = p.y - shapeOrigin.current.y;
        const pxDist = Math.sqrt(dx * dx + dy * dy);
        const realInches = scaleParsed ? pixelsToInchesRef.current(pxDist) : 0;
        addShape({
          id: genId(),
          type: 'measure',
          coordinates: {
            x: shapeOrigin.current.x,
            y: shapeOrigin.current.y,
            endX: p.x,
            endY: p.y,
          },
          color: activeColor,
          pageNumber,
          createdBy: currentUserId,
          createdAt: new Date().toISOString(),
          text: scaleParsed ? formatFeetInches(realInches) : undefined,
        });
        shapeInProgress.current = null;
        shapeOrigin.current = null;
        measureLabel.current = null;
      });
    }
  }, [activeTool, activeColor, isEditable, pageNumber, currentUserId, onAnnotationAdd]);

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

function buildFabricObject(a: AnnotationShape, _scale: number): FabricRect | FabricCircle | FabricLine | FabricIText | null {
  const { coordinates: c, color, type } = a;
  switch (type) {
    case 'rectangle':
    case 'highlight':
      return new FabricRect({
        left: c.x,
        top: c.y,
        width: c.width ?? 0,
        height: c.height ?? 0,
        fill: 'transparent',
        stroke: color,
        strokeWidth: 2,
      });
    case 'pin':
      return new FabricCircle({
        left: c.x - 10,
        top: c.y - 10,
        radius: 10,
        fill: color,
        stroke: '#FFFFFF',
        strokeWidth: 2,
      });
    case 'measure':
      return new FabricLine([c.x, c.y, c.endX ?? c.x, c.endY ?? c.y], {
        stroke: color,
        strokeWidth: 2,
      });
    case 'text':
      return new FabricIText(a.text ?? '', {
        left: c.x,
        top: c.y,
        fill: color,
        fontSize: 16,
        fontFamily: 'sans-serif',
      });
    case 'draw':
      return new FabricRect({
        left: c.x,
        top: c.y,
        width: c.width ?? 0,
        height: c.height ?? 0,
        fill: 'transparent',
        stroke: color,
        strokeWidth: 2,
      });
    default:
      return null;
  }
}

export default AnnotationCanvas;

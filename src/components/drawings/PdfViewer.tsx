import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Document, Page, pdfjs, Thumbnail } from 'react-pdf';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, Pencil, Plus, Layers, Bookmark, BookmarkPlus } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, vizColors, zIndex, transitions } from '../../styles/theme';
import { useUiStore } from '../../stores';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import CreateRFIModal from '../forms/CreateRFIModal';
import { AnnotationCanvas } from './AnnotationCanvas';
import { MarkupToolbar, type MarkupTool } from './MarkupToolbar';
import type { AnnotationShape } from './AnnotationHistory';
import { useDrawingMarkups } from '../../hooks/queries/document-management';
import { useCreateDrawingMarkup } from '../../hooks/mutations/documents';
import { formatFeetInches } from './measurementUtils';

// Configure PDF.js worker — local copy from public/. CSP blocks CDN
// script-src so a CDN worker can never load, and using a single local
// URL across all modules prevents load-order races where one module's
// config clobbers another's.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.js', import.meta.url).href;

const PDF_OPTIONS = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
};

interface PdfViewerProps {
  /** URL or File object to render */
  file: string | File | null;
  /** Title shown in the header */
  title?: string;
  /** Called when the viewer is closed */
  onClose: () => void;
  /** Navigate to next drawing in the set */
  onNextDrawing?: () => void;
  /** Navigate to previous drawing in the set */
  onPrevDrawing?: () => void;
  /** Whether there's a next drawing available */
  hasNextDrawing?: boolean;
  /** Whether there's a previous drawing available */
  hasPrevDrawing?: boolean;
  /** Label for the current drawing position e.g. "3 of 24" */
  drawingPositionLabel?: string;
  /** Drawing id — enables persistence of markups to `drawing_markups`. */
  drawingId?: string;
  /** Project id — required by `drawing_markups` insert. */
  projectId?: string;
  /** Scale ratio string from AI classification (e.g. "1/4\"=1'-0\""). Enables measurement + area tools. */
  scaleRatioText?: string | null;
}

interface SavedViewport {
  id: string;
  name: string;
  page: number;
  zoom: number;
  tx: number;
  ty: number;
}

/**
 * Convert an AnnotationShape back from a persisted `drawing_markups` row.
 * Row shape: { id, type, data: {...rest of shape}, ... }
 */
function rowToShape(row: { id: string; type: string | null; annotation_type?: string | null; coordinates?: unknown; color?: string | null; page_number?: number | null; data: unknown }): AnnotationShape | null {
  const d = (row.data && typeof row.data === 'object' ? row.data : {}) as Partial<AnnotationShape> & { uiType?: AnnotationShape['type'] };
  const coordinates = (row.coordinates && typeof row.coordinates === 'object')
    ? (row.coordinates as AnnotationShape['coordinates'])
    : d.coordinates;
  if (!coordinates) return null;
  const pageNumber = typeof row.page_number === 'number' ? row.page_number : d.pageNumber;
  if (typeof pageNumber !== 'number') return null;
  return {
    id: row.id,
    // Prefer the UI type stored in data.uiType; fall back to annotation_type column (newer schemas) or the legacy `type` column.
    type: d.uiType || (row.annotation_type as AnnotationShape['type']) || (row.type as AnnotationShape['type']) || 'draw',
    coordinates,
    color: row.color || d.color || '#F47820',
    text: d.text,
    countLabel: d.countLabel,
    countIndex: d.countIndex,
    pageNumber,
    createdBy: d.createdBy || 'anonymous',
    createdAt: d.createdAt || new Date().toISOString(),
    linkedRfiId: d.linkedRfiId,
    linkedPunchItemId: d.linkedPunchItemId,
  };
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 5.0;
const DOUBLE_TAP_MS = 300;

function getDistance(touches: React.TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/** True if the file URL/name looks like a raster image — PDF-split pages land here as PNGs. */
function isImageFile(f: string | File | null): boolean {
  if (!f) return false;
  const name = typeof f === 'string' ? f : f.name;
  return /\.(png|jpg|jpeg|webp|tiff?|gif|bmp)(\?|$)/i.test(name);
}

export function PdfViewer({ file, title, onClose, onNextDrawing, onPrevDrawing, hasNextDrawing, hasPrevDrawing, drawingPositionLabel, drawingId, projectId, scaleRatioText }: PdfViewerProps) {
  const isImage = isImageFile(file);
  const [numPages, setNumPages] = useState<number>(isImage ? 1 : 0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfPageWidth, setPdfPageWidth] = useState(612); // default letter width in pts
  const [pdfPageHeight, setPdfPageHeight] = useState(792); // default letter height in pts
  const [baseScale, setBaseScale] = useState(1.0);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  const [showRFIModal, setShowRFIModal] = useState(false);
  const [rfiScreenshot, setRfiScreenshot] = useState<string | null>(null);

  // Markup state
  const [activeTool, setActiveTool] = useState<MarkupTool>('select');
  const [activeColor] = useState('#F47820');
  const [annotations, setAnnotations] = useState<AnnotationShape[]>([]);
  const [scaleOverride, setScaleOverride] = useState<number | null>(null); // real inches per canvas pixel
  const [countLabel, setCountLabel] = useState('Count');
  const [pendingCalibratePx, setPendingCalibratePx] = useState<number | null>(null);
  const [loupePos, setLoupePos] = useState<{ x: number; y: number } | null>(null);
  const [showMinimap, setShowMinimap] = useState(false);
  const [viewports, setViewports] = useState<SavedViewport[]>([]);
  const [viewportsOpen, setViewportsOpen] = useState(false);

  const isMobile = useMediaQuery('(max-width: 767px)');
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfPageRef = useRef<HTMLDivElement>(null);

  // Persistence
  const { data: markupRows } = useDrawingMarkups(drawingId);
  const createMarkup = useCreateDrawingMarkup();

  // Load persisted markups into local state. Syncing from react-query cache is a legitimate effect use.
  useEffect(() => {
    if (!markupRows) return;
    const shapes = markupRows
      .map((r) => rowToShape(r as { id: string; type: string | null; annotation_type?: string | null; coordinates?: unknown; color?: string | null; page_number?: number | null; data: unknown }))
      .filter((s): s is AnnotationShape => !!s);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnnotations(shapes);
  }, [markupRows]);

  // Load saved viewports from localStorage (keyed per drawing).
  useEffect(() => {
    if (!drawingId) return;
    try {
      const raw = localStorage.getItem(`drawing:${drawingId}:viewports`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setViewports(JSON.parse(raw));
    } catch { /* noop */ }
  }, [drawingId]);
  const persistViewports = useCallback((vs: SavedViewport[]) => {
    if (!drawingId) return;
    try { localStorage.setItem(`drawing:${drawingId}:viewports`, JSON.stringify(vs)); } catch { /* noop */ }
  }, [drawingId]);

  // Dimensions of the rendered PDF canvas at baseScale — annotation overlay is sized to match.
  const overlayWidth = pdfPageWidth * baseScale;
  const overlayHeight = pdfPageHeight * baseScale;

  // Count HUD totals by label
  const countTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const a of annotations) {
      if (a.type === 'count' && a.pageNumber === pageNumber) {
        const k = a.countLabel ?? 'Count';
        totals.set(k, (totals.get(k) ?? 0) + 1);
      }
    }
    return totals;
  }, [annotations, pageNumber]);

  // Touch gesture refs
  const initialPinchDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1.0);
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const currentZoomRef = useRef<number>(zoomLevel);

  // Keep currentZoomRef in sync with zoomLevel state
  useEffect(() => { currentZoomRef.current = zoomLevel; }, [zoomLevel]);

  // Recalculate baseScale when container width or pdfPageWidth changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth;
      if (w > 0 && pdfPageWidth > 0) {
        setBaseScale(w / pdfPageWidth);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pdfPageWidth]);

  const announceStatus = useUiStore((s) => s.announceStatus);

  const onDocumentLoadSuccess = useCallback(({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    setLoading(false);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message);
    setLoading(false);
  }, []);

  // Capture natural page dimensions from the loaded PDF page (view = [minX, minY, maxX, maxY] in pts)
  const onPageLoadSuccess = useCallback((page: unknown) => {
    const p = page as { view?: number[] };
    if (p.view && p.view[2] > 0) {
      setPdfPageWidth(p.view[2]);
      if (p.view[3] > 0) setPdfPageHeight(p.view[3]);
    }
  }, []);

  // ── Markup persistence ───────────────────────────────────────────────────
  // Map UI shape types to the legacy `type` column's CHECK constraint values.
  // The full UI type is preserved in `annotation_type`, which was added later without CHECK restrictions.
  const legacyType = (t: AnnotationShape['type']): string => {
    switch (t) {
      case 'draw': return 'pen';
      case 'highlight': return 'highlighter';
      case 'measure': return 'dimension';
      case 'path': return 'dimension'; // path is just a multi-segment measurement
      case 'area':
      case 'rectangle':
      case 'polygon': return 'shape';
      case 'count': return 'pin';
      case 'pin': return 'pin';
      case 'text': return 'text';
      default: return 'shape';
    }
  };
  const handleShapeAdd = useCallback((shape: AnnotationShape) => {
    setAnnotations((prev) => [...prev, shape]);
    if (!drawingId || !projectId) return;
    const { id: _id, type, ...rest } = shape;
    void _id;
    // Only write the columns guaranteed by the base schema (00019). Everything else —
    // including the full UI type — is stuffed into the `data` jsonb blob. This keeps the
    // insert working across all migration vintages; rowToShape already reads type from data.
    createMarkup.mutate({
      drawingId,
      data: {
        drawing_id: drawingId,
        project_id: projectId,
        type: legacyType(type),
        data: { ...rest, uiType: type },
      },
    });
  }, [createMarkup, drawingId, projectId]);

  const handleUndo = useCallback(() => {
    // Local-only undo of the most recent markup. Persisted rows remain in DB.
    setAnnotations((prev) => prev.slice(0, -1));
  }, []);

  // ── Calibration ──────────────────────────────────────────────────────────
  const handleCalibrate = useCallback((pxDistance: number) => {
    setPendingCalibratePx(pxDistance);
  }, []);

  const submitCalibration = useCallback((realInches: number) => {
    if (!pendingCalibratePx || pendingCalibratePx <= 0 || realInches <= 0) {
      setPendingCalibratePx(null);
      return;
    }
    // scaleOverride = real inches per canvas pixel
    setScaleOverride(realInches / pendingCalibratePx);
    setPendingCalibratePx(null);
    setActiveTool('measure');
  }, [pendingCalibratePx]);

  const zoomIn = useCallback(() => setZoomLevel((z) => Math.min(z + 0.25, MAX_SCALE)), []);
  const zoomOut = useCallback(() => setZoomLevel((z) => Math.max(z - 0.25, MIN_SCALE)), []);
  const resetZoom = useCallback(() => {
    setZoomLevel(1.0);
    setTranslateX(0);
    setTranslateY(0);
  }, []);
  const prevPage = useCallback(() => setPageNumber((p) => {
    const next = Math.max(p - 1, 1);
    if (next !== p) announceStatus(`Page ${next} of ${numPages}`);
    return next;
  }), [numPages, announceStatus]);
  const nextPage = useCallback(() => setPageNumber((p) => {
    const next = Math.min(p + 1, numPages);
    if (next !== p) announceStatus(`Page ${next} of ${numPages}`);
    return next;
  }), [numPages, announceStatus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PageUp') { e.preventDefault(); prevPage(); }
      if (e.key === 'PageDown') { e.preventDefault(); nextPage(); }
      // Arrow keys: navigate between drawings when at first/last page
      if (e.key === 'ArrowLeft') {
        if (pageNumber <= 1 && onPrevDrawing && hasPrevDrawing) { e.preventDefault(); onPrevDrawing(); }
        else if (pageNumber > 1) { e.preventDefault(); prevPage(); }
      }
      if (e.key === 'ArrowRight') {
        if (pageNumber >= numPages && onNextDrawing && hasNextDrawing) { e.preventDefault(); onNextDrawing(); }
        else if (pageNumber < numPages) { e.preventDefault(); nextPage(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages, pageNumber, onPrevDrawing, onNextDrawing, hasPrevDrawing, hasNextDrawing, prevPage, nextPage]);

  if (!file) return null;

  // --- Touch handlers ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      initialPinchDistanceRef.current = getDistance(e.touches);
      pinchStartZoomRef.current = currentZoomRef.current;
      panStartRef.current = null;
    } else if (e.touches.length === 1) {
      // Double-tap: reset zoom to fit
      const now = Date.now();
      if (now - lastTapRef.current < DOUBLE_TAP_MS) {
        resetZoom();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
      // Pan start
      panStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        tx: translateX,
        ty: translateY,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && initialPinchDistanceRef.current !== null) {
      // Pinch zoom adjusts zoomLevel
      const newDist = getDistance(e.touches);
      const ratio = newDist / initialPinchDistanceRef.current;
      const newZoom = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchStartZoomRef.current * ratio));
      setZoomLevel(newZoom);
    } else if (e.touches.length === 1 && panStartRef.current) {
      // Pan
      const dx = e.touches[0].clientX - panStartRef.current.x;
      const dy = e.touches[0].clientY - panStartRef.current.y;
      setTranslateX(panStartRef.current.tx + dx);
      setTranslateY(panStartRef.current.ty + dy);
    }
  };

  const handleTouchEnd = () => {
    initialPinchDistanceRef.current = null;
    panStartRef.current = null;
  };

  // --- Create RFI with composed screenshot (PDF page or image + annotation overlay) ---
  const handleCreateRFI = () => {
    const pdfCanvas = pdfPageRef.current?.querySelector<HTMLCanvasElement>('.react-pdf__Page canvas');
    const imgEl = pdfPageRef.current?.querySelector<HTMLImageElement>('img.react-pdf__Page');
    const fabricCanvas = pdfPageRef.current?.querySelector<HTMLCanvasElement>('.pdf-markup-layer canvas');
    const source = pdfCanvas || imgEl;
    if (!source) {
      setRfiScreenshot(null);
      setShowRFIModal(true);
      return;
    }
    const w = pdfCanvas ? pdfCanvas.width : (imgEl?.naturalWidth ?? 0);
    const h = pdfCanvas ? pdfCanvas.height : (imgEl?.naturalHeight ?? 0);
    if (w === 0 || h === 0) {
      setRfiScreenshot(null);
      setShowRFIModal(true);
      return;
    }
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const ctx = out.getContext('2d');
    if (ctx) {
      try { ctx.drawImage(source, 0, 0, w, h); } catch { /* tainted source — skip */ }
      if (fabricCanvas) {
        try { ctx.drawImage(fabricCanvas, 0, 0, w, h); } catch { /* ignore */ }
      }
    }
    // toDataURL throws SecurityError if the canvas was tainted (cross-origin image without CORS).
    // Open the RFI modal regardless so the user isn't blocked; screenshot stays null.
    try {
      setRfiScreenshot(out.toDataURL('image/png'));
    } catch {
      setRfiScreenshot(null);
    }
    setShowRFIModal(true);
  };

  // --- Saved viewports ---
  const saveCurrentViewport = () => {
    const name = window.prompt('Name this view (e.g., "Unit 3B kitchen"):');
    if (!name) return;
    const vp: SavedViewport = {
      id: `vp_${Date.now()}`,
      name,
      page: pageNumber,
      zoom: zoomLevel,
      tx: translateX,
      ty: translateY,
    };
    const next = [...viewports, vp];
    setViewports(next);
    persistViewports(next);
  };
  const restoreViewport = (vp: SavedViewport) => {
    setPageNumber(vp.page);
    setZoomLevel(vp.zoom);
    setTranslateX(vp.tx);
    setTranslateY(vp.ty);
    setViewportsOpen(false);
    announceStatus(`Restored view: ${vp.name}`);
  };
  const deleteViewport = (id: string) => {
    const next = viewports.filter((v) => v.id !== id);
    setViewports(next);
    persistViewports(next);
  };

  // (keyboard nav effect moved before early return)

  // 44x44 minimum touch target for all toolbar buttons
  const toolbarBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 44, minHeight: 44, width: 44, height: 44,
    border: 'none', padding: 0,
    borderRadius: borderRadius.base, backgroundColor: colors.overlayWhiteThin,
    color: colors.white, cursor: 'pointer', transition: `background-color ${transitions.quick}`,
    flexShrink: 0,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: zIndex.toast as number,
      display: 'flex', flexDirection: 'column',
      backgroundColor: vizColors.dark,
    }}>
      {/* Top toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `0 ${spacing['4']}`,
        backgroundColor: colors.overlayDark,
        borderBottom: `1px solid ${colors.darkBorder}`,
        flexShrink: 0,
        minHeight: 56,
        height: 56,
      }}>
        {/* Left: close + drawing nav + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], minWidth: 0 }}>
          <button onClick={onClose} aria-label="Close document viewer" style={toolbarBtnStyle}>
            <X size={18} />
          </button>
          {/* Drawing-level navigation (prev/next sheet) */}
          {(hasPrevDrawing || hasNextDrawing) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
              <button
                onClick={onPrevDrawing}
                disabled={!hasPrevDrawing}
                aria-label="Previous drawing"
                style={{ ...toolbarBtnStyle, width: 36, minWidth: 36, height: 36, minHeight: 36, opacity: hasPrevDrawing ? 1 : 0.3 }}
              >
                <ChevronLeft size={16} />
              </button>
              {drawingPositionLabel && (
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', minWidth: '44px', textAlign: 'center', fontFamily: typography.fontFamilyMono }}>
                  {drawingPositionLabel}
                </span>
              )}
              <button
                onClick={onNextDrawing}
                disabled={!hasNextDrawing}
                aria-label="Next drawing"
                style={{ ...toolbarBtnStyle, width: 36, minWidth: 36, height: 36, minHeight: 36, opacity: hasNextDrawing ? 1 : 0.3 }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.medium, color: colors.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title || 'Document Viewer'}
          </span>
        </div>

        {/* Desktop: page controls + zoom controls */}
        {!isMobile && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
              <button
                onClick={prevPage}
                disabled={pageNumber <= 1}
                aria-label={`Previous page, currently page ${pageNumber} of ${numPages}`}
                style={{ ...toolbarBtnStyle, opacity: pageNumber <= 1 ? 0.3 : 1 }}
              >
                <ChevronLeft size={18} />
              </button>
              <span
                aria-live="polite"
                aria-atomic="true"
                style={{ fontSize: typography.fontSize.sm, color: colors.white, minWidth: '80px', textAlign: 'center' }}
              >
                {loading ? '...' : `Page ${pageNumber} of ${numPages}`}
              </span>
              <button
                onClick={nextPage}
                disabled={pageNumber >= numPages}
                aria-label={`Next page, currently page ${pageNumber} of ${numPages}`}
                style={{ ...toolbarBtnStyle, opacity: pageNumber >= numPages ? 0.3 : 1 }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
              <button onClick={zoomOut} aria-label="Zoom out" style={toolbarBtnStyle}>
                <ZoomOut size={16} />
              </button>
              <button
                onClick={resetZoom}
                aria-label={`Current zoom ${Math.round(zoomLevel * 100)}%, click to reset`}
                style={{ ...toolbarBtnStyle, width: 'auto', minWidth: 60, padding: `0 ${spacing['2']}`, fontSize: typography.fontSize.sm }}
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button onClick={zoomIn} aria-label="Zoom in" style={toolbarBtnStyle}>
                <ZoomIn size={16} />
              </button>
              <button onClick={resetZoom} aria-label="Fit to width" title="Fit to width" style={toolbarBtnStyle}>
                <Maximize2 size={16} />
              </button>
            </div>
          </>
        )}

        {/* Mobile: compact page indicator */}
        {isMobile && !loading && numPages > 0 && (
          <span
            aria-live="polite"
            aria-atomic="true"
            style={{ fontSize: typography.fontSize.sm, color: colors.white }}
          >
            {pageNumber} / {numPages}
          </span>
        )}
      </div>

      {/* Document area */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: isMobile ? 'flex-start' : 'center',
          alignItems: 'flex-start',
          paddingTop: isMobile ? 0 : spacing['6'],
          paddingLeft: isMobile ? 0 : spacing['6'],
          paddingRight: isMobile ? 0 : spacing['6'],
          paddingBottom: isMobile ? 56 : spacing['6'],
          touchAction: 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {error ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: spacing['8'], color: colors.white, textAlign: 'center',
          }}>
            <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.medium, marginBottom: spacing['2'] }}>
              Unable to load document
            </p>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.overlayWhiteMedium }}>
              {error}
            </p>
          </div>
        ) : (
          /* Measuring container: fills available width, measures offsetWidth for baseScale */
          <div
            ref={containerRef}
            style={{
              position: 'relative',
              overflow: 'hidden',
              width: '100%',
            }}
          >
            <div style={{ transform: `translate(${translateX}px, ${translateY}px)` }}>
              {/* Canvas wrapper: zoomLevel CSS transform applied here */}
              <div style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: '0 0',
                willChange: 'transform',
                display: 'inline-block',
              }}>
                <div
                  ref={pdfPageRef}
                  style={{ boxShadow: shadows.panel, borderRadius: borderRadius.sm, overflow: 'hidden', position: 'relative' }}
                  onMouseMove={(e) => {
                    if (activeTool !== 'measure' && activeTool !== 'area' && activeTool !== 'calibrate') return;
                    const rect = pdfPageRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setLoupePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                  }}
                  onMouseLeave={() => setLoupePos(null)}
                >
                  {isImage ? (
                    <img
                      src={typeof file === 'string' ? file : ''}
                      alt={title || 'Drawing'}
                      className="react-pdf__Page"
                      crossOrigin="anonymous"
                      style={{ display: 'block', width: overlayWidth || '100%', height: overlayHeight || 'auto' }}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        setPdfPageWidth(img.naturalWidth);
                        setPdfPageHeight(img.naturalHeight);
                        setNumPages(1);
                        setLoading(false);
                      }}
                      onError={() => setError('Failed to load image')}
                    />
                  ) : (
                    <Document
                      file={file}
                      options={PDF_OPTIONS}
                      onLoadSuccess={onDocumentLoadSuccess}
                      onLoadError={onDocumentLoadError}
                      loading={
                        <div style={{ width: 600, height: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
                          <div style={{ textAlign: 'center', color: colors.textTertiary }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              border: `3px solid ${colors.borderDefault}`,
                              borderTopColor: colors.primaryOrange,
                              animation: 'spin 0.8s linear infinite',
                              margin: '0 auto 12px',
                            }} />
                            <p style={{ fontSize: typography.fontSize.sm }}>Loading document...</p>
                          </div>
                        </div>
                      }
                    >
                      <Page
                        pageNumber={pageNumber}
                        scale={baseScale}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        onLoadSuccess={onPageLoadSuccess}
                      />
                    </Document>
                  )}
                  {/* Annotation overlay layer — matches PDF canvas pixel dimensions at baseScale */}
                  {overlayWidth > 0 && overlayHeight > 0 && (
                    <div className="pdf-markup-layer" style={{ position: 'absolute', inset: 0, width: overlayWidth, height: overlayHeight, pointerEvents: activeTool === 'select' ? 'none' : 'auto' }}>
                      <AnnotationCanvas
                        width={overlayWidth}
                        height={overlayHeight}
                        pageNumber={pageNumber}
                        annotations={annotations}
                        activeTool={activeTool as never}
                        activeColor={activeColor}
                        scale={baseScale}
                        scaleRatio={scaleRatioText ?? null}
                        scaleOverride={scaleOverride}
                        countLabel={countLabel}
                        isEditable={activeTool !== 'select'}
                        onAnnotationAdd={handleShapeAdd}
                        onCalibrate={handleCalibrate}
                      />
                    </div>
                  )}
                  {/* Loupe: circular zoomed sampler of the PDF page for precise endpoint snapping */}
                  {loupePos && (activeTool === 'measure' || activeTool === 'area' || activeTool === 'calibrate') && (
                    <Loupe x={loupePos.x} y={loupePos.y} sourceRef={pdfPageRef} pageWidth={overlayWidth} pageHeight={overlayHeight} />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile: fixed bottom toolbar, 56px height, horizontally scrollable 44x44 icons */}
      {isMobile && (
        <div
          role="toolbar"
          aria-label="Document controls"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: 56,
            backgroundColor: colors.overlayDark,
            borderTop: `1px solid ${colors.darkBorder}`,
            display: 'flex',
            alignItems: 'center',
            overflowX: 'auto',
            overflowY: 'hidden',
            gap: spacing['1'],
            padding: `0 ${spacing['2']}`,
            zIndex: (zIndex.toast as number) + 1,
            flexShrink: 0,
          }}
        >
          {/* Drawing-level nav on mobile */}
          {(hasPrevDrawing || hasNextDrawing) && (
            <>
              <button onClick={onPrevDrawing} disabled={!hasPrevDrawing} aria-label="Previous drawing" style={{ ...toolbarBtnStyle, opacity: hasPrevDrawing ? 1 : 0.3, backgroundColor: 'rgba(244,120,32,0.2)' }}>
                <ChevronLeft size={20} />
              </button>
              <button onClick={onNextDrawing} disabled={!hasNextDrawing} aria-label="Next drawing" style={{ ...toolbarBtnStyle, opacity: hasNextDrawing ? 1 : 0.3, backgroundColor: 'rgba(244,120,32,0.2)' }}>
                <ChevronRight size={20} />
              </button>
              <div style={{ width: 1, height: 28, backgroundColor: colors.darkBorder, flexShrink: 0, marginLeft: spacing['1'], marginRight: spacing['1'] }} />
            </>
          )}
          <button
            onClick={prevPage}
            disabled={pageNumber <= 1}
            aria-label="Previous page"
            style={{ ...toolbarBtnStyle, opacity: pageNumber <= 1 ? 0.3 : 1 }}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={nextPage}
            disabled={pageNumber >= numPages}
            aria-label="Next page"
            style={{ ...toolbarBtnStyle, opacity: pageNumber >= numPages ? 0.3 : 1 }}
          >
            <ChevronRight size={20} />
          </button>
          <div style={{ width: 1, height: 28, backgroundColor: colors.darkBorder, flexShrink: 0, marginLeft: spacing['1'], marginRight: spacing['1'] }} />
          <button onClick={zoomOut} aria-label="Zoom out" style={toolbarBtnStyle}>
            <ZoomOut size={18} />
          </button>
          <button
            onClick={resetZoom}
            aria-label={`Zoom ${Math.round(zoomLevel * 100)}%, tap to reset`}
            style={{ ...toolbarBtnStyle, width: 'auto', minWidth: 56, padding: `0 ${spacing['2']}`, fontSize: typography.fontSize.sm }}
          >
            {Math.round(zoomLevel * 100)}%
          </button>
          <button onClick={zoomIn} aria-label="Zoom in" style={toolbarBtnStyle}>
            <ZoomIn size={18} />
          </button>
          <button onClick={resetZoom} aria-label="Fit to width" style={toolbarBtnStyle}>
            <Maximize2 size={18} />
          </button>
          <div style={{ width: 1, height: 28, backgroundColor: colors.darkBorder, flexShrink: 0, marginLeft: spacing['1'], marginRight: spacing['1'] }} />
          <button
            onClick={() => setToolbarExpanded((v) => !v)}
            aria-label={toolbarExpanded ? 'Hide markup tools' : 'Show markup tools'}
            aria-pressed={toolbarExpanded}
            style={{ ...toolbarBtnStyle, backgroundColor: toolbarExpanded ? colors.primaryOrange : colors.overlayWhiteThin }}
          >
            <Pencil size={18} />
          </button>
          <button
            onClick={handleCreateRFI}
            aria-label="Create RFI from current view"
            style={toolbarBtnStyle}
          >
            <Plus size={18} />
          </button>
        </div>
      )}

      {/* Floating markup toolbar — desktop bottom center. Explicit pointer-events to rule out inherited 'none'. */}
      {!isMobile && !error && (
        <div
          data-testid="pdf-markup-toolbar-wrapper"
          style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 99999, pointerEvents: 'auto' }}
        >
          <MarkupToolbar
            activeTool={activeTool}
            onToolChange={(t) => {
              console.log('[PdfViewer] tool change →', t);
              setActiveTool(t);
            }}
            onUndo={handleUndo}
            canUndo={annotations.length > 0}
            onCreateRFI={() => { console.log('[PdfViewer] Create RFI clicked'); handleCreateRFI(); }}
          />
        </div>
      )}

      {/* Count HUD — totals per label on current page */}
      {countTotals.size > 0 && (
        <div style={{
          position: 'fixed',
          top: 72,
          left: 16,
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          padding: `${spacing['2']} ${spacing['3']}`,
          borderRadius: borderRadius.md,
          color: colors.white,
          fontSize: typography.fontSize.sm,
          fontFamily: typography.fontFamily,
          boxShadow: shadows.panel,
          zIndex: (zIndex.toast as number) + 1,
          minWidth: 140,
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Counts (this page)</div>
          {Array.from(countTotals.entries()).map(([label, n]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>{label}</span>
              <span style={{ fontWeight: 600, fontFamily: typography.fontFamilyMono }}>{n}</span>
            </div>
          ))}
          {activeTool === 'count' && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid rgba(255,255,255,0.15)` }}>
              <button
                onClick={() => {
                  const name = window.prompt('Label for next group:', countLabel);
                  if (name) setCountLabel(name);
                }}
                style={{ background: 'none', border: 'none', color: colors.primaryOrange, cursor: 'pointer', padding: 0, fontSize: 12, fontFamily: typography.fontFamily }}
              >
                Active: {countLabel} — change
              </button>
            </div>
          )}
        </div>
      )}

      {/* Active tool indicator pill (top center when a tool is active) */}
      {activeTool !== 'select' && !error && (
        <div style={{
          position: 'fixed',
          top: 72,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: `${spacing['1']} ${spacing['3']}`,
          backgroundColor: colors.primaryOrange,
          color: colors.white,
          borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption,
          fontWeight: typography.fontWeight.semibold,
          boxShadow: shadows.cardHover,
          zIndex: (zIndex.toast as number) + 1,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {activeTool === 'measure' && (scaleOverride || scaleRatioText) && <span>Tape · drag to measure</span>}
          {activeTool === 'measure' && !scaleOverride && !scaleRatioText && <span>Tape · no scale detected — click Calibrate first</span>}
          {activeTool === 'area' && <span>Area · click vertices, double-click to close</span>}
          {activeTool === 'count' && <span>Count · click to drop ({countLabel})</span>}
          {activeTool === 'calibrate' && <span>Calibrate · click two points on a known dimension</span>}
          {(activeTool === 'pin' || activeTool === 'highlight' || activeTool === 'text' || activeTool === 'draw') && <span>{activeTool}</span>}
        </div>
      )}

      {/* Right-rail floating controls: mini-map, bookmarks */}
      {!isMobile && !error && (
        <div style={{ position: 'fixed', top: 72, right: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: (zIndex.toast as number) + 1 }}>
          {numPages > 1 && (
            <button
              onClick={() => setShowMinimap((v) => !v)}
              aria-label={showMinimap ? 'Hide sheet mini-map' : 'Show sheet mini-map'}
              style={{ ...toolbarBtnStyle, backgroundColor: showMinimap ? colors.primaryOrange : 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
              title="Page mini-map"
            >
              <Layers size={18} />
            </button>
          )}
          <button
            onClick={saveCurrentViewport}
            aria-label="Bookmark current view"
            title="Bookmark current view"
            style={{ ...toolbarBtnStyle, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          >
            <BookmarkPlus size={18} />
          </button>
          {viewports.length > 0 && (
            <button
              onClick={() => setViewportsOpen((v) => !v)}
              aria-label={`${viewports.length} saved views`}
              title={`${viewports.length} saved views`}
              style={{ ...toolbarBtnStyle, backgroundColor: viewportsOpen ? colors.primaryOrange : 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            >
              <Bookmark size={18} />
            </button>
          )}
        </div>
      )}

      {/* Saved viewports dropdown */}
      {viewportsOpen && viewports.length > 0 && (
        <div style={{
          position: 'fixed', top: 72, right: 72,
          width: 240, maxHeight: 360, overflowY: 'auto',
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.md,
          boxShadow: shadows.panel,
          padding: spacing['2'],
          zIndex: (zIndex.toast as number) + 2,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1, padding: `${spacing['1']} ${spacing['2']}` }}>Saved views</div>
          {viewports.map((vp) => (
            <div key={vp.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => restoreViewport(vp)}
                style={{
                  flex: 1, textAlign: 'left',
                  padding: `${spacing['2']} ${spacing['2']}`,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: typography.fontSize.sm, color: colors.textPrimary,
                  borderRadius: borderRadius.sm, fontFamily: typography.fontFamily,
                }}
              >
                <div style={{ fontWeight: 600 }}>{vp.name}</div>
                <div style={{ fontSize: 11, color: colors.textTertiary }}>Page {vp.page} · {Math.round(vp.zoom * 100)}%</div>
              </button>
              <button
                onClick={() => deleteViewport(vp.id)}
                aria-label={`Delete view ${vp.name}`}
                style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sheet mini-map sidebar */}
      {showMinimap && numPages > 1 && !isMobile && (
        <div style={{
          position: 'fixed', top: 56, right: 72, bottom: 0, width: 180,
          backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          borderLeft: `1px solid ${colors.darkBorder}`,
          overflowY: 'auto',
          padding: spacing['2'],
          zIndex: (zIndex.toast as number),
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, padding: `${spacing['1']} ${spacing['2']}`, marginBottom: 4 }}>Pages</div>
          <Document file={file} options={PDF_OPTIONS}>
            {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPageNumber(n)}
                style={{
                  width: '100%', padding: 6, marginBottom: 4,
                  background: n === pageNumber ? 'rgba(244,120,32,0.2)' : 'transparent',
                  border: n === pageNumber ? `2px solid ${colors.primaryOrange}` : `1px solid rgba(255,255,255,0.15)`,
                  borderRadius: borderRadius.sm, cursor: 'pointer',
                  color: colors.white, fontSize: 11, fontFamily: typography.fontFamily,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}
                aria-label={`Go to page ${n}`}
                aria-current={n === pageNumber ? 'page' : undefined}
              >
                <div style={{ pointerEvents: 'none' }}>
                  <Thumbnail pageNumber={n} width={140} />
                </div>
                <span>Page {n}</span>
              </button>
            ))}
          </Document>
        </div>
      )}

      {/* Calibration modal */}
      {pendingCalibratePx !== null && (
        <CalibrationModal
          pxDistance={pendingCalibratePx}
          onSubmit={submitCalibration}
          onCancel={() => setPendingCalibratePx(null)}
        />
      )}

      {/* Active-scale indicator bottom-left */}
      {(scaleOverride || scaleRatioText) && !error && (
        <div style={{
          position: 'fixed', bottom: isMobile ? 64 : 24, left: 16,
          padding: `${spacing['1']} ${spacing['2']}`,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          color: colors.white,
          borderRadius: borderRadius.sm,
          fontSize: 11, fontFamily: typography.fontFamilyMono,
          zIndex: (zIndex.toast as number),
        }}>
          Scale: {scaleOverride
            ? `${formatFeetInches(scaleOverride * overlayWidth)} / page width (manual)`
            : scaleRatioText}
        </div>
      )}

      {/* RFI Modal */}
      {showRFIModal && (
        <>
          {rfiScreenshot && (
            <div style={{
              position: 'fixed',
              bottom: isMobile ? 80 : 96,
              right: 24,
              width: 120,
              height: 80,
              borderRadius: borderRadius.base,
              overflow: 'hidden',
              border: `2px solid ${colors.primaryOrange}`,
              boxShadow: shadows.panel,
              zIndex: (zIndex.toast as number) + 2,
            }}>
              <img loading="lazy" src={rfiScreenshot} alt="Drawing screenshot with markups" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <CreateRFIModal
            open={showRFIModal}
            onClose={() => { setShowRFIModal(false); setRfiScreenshot(null); }}
            onSubmit={async () => { setShowRFIModal(false); setRfiScreenshot(null); }}
          />
        </>
      )}
    </div>
  );
}

// ─── Loupe: circular magnified view of the PDF canvas around the cursor ──
const Loupe: React.FC<{ x: number; y: number; sourceRef: React.RefObject<HTMLDivElement>; pageWidth: number; pageHeight: number }> = ({ x, y, sourceRef, pageWidth, pageHeight }) => {
  const LOUPE_SIZE = 140;
  const MAG = 3;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const outCanvas = canvasRef.current;
    const pdfCanvas = sourceRef.current?.querySelector<HTMLCanvasElement>('.react-pdf__Page canvas');
    const imgEl = sourceRef.current?.querySelector<HTMLImageElement>('img.react-pdf__Page');
    const src: HTMLCanvasElement | HTMLImageElement | null = pdfCanvas || imgEl || null;
    if (!outCanvas || !src || pageWidth === 0 || pageHeight === 0) return;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return;
    const srcW = pdfCanvas ? pdfCanvas.width : (imgEl?.naturalWidth ?? pageWidth);
    const srcH = pdfCanvas ? pdfCanvas.height : (imgEl?.naturalHeight ?? pageHeight);
    const srcRatioX = srcW / pageWidth;
    const srcRatioY = srcH / pageHeight;
    const sampleSize = LOUPE_SIZE / MAG;
    const sx = Math.max(0, Math.min(srcW - sampleSize * srcRatioX, (x - sampleSize / 2) * srcRatioX));
    const sy = Math.max(0, Math.min(srcH - sampleSize * srcRatioY, (y - sampleSize / 2) * srcRatioY));
    ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    ctx.drawImage(src, sx, sy, sampleSize * srcRatioX, sampleSize * srcRatioY, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
    // Crosshair
    ctx.strokeStyle = '#F47820';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LOUPE_SIZE / 2, 0); ctx.lineTo(LOUPE_SIZE / 2, LOUPE_SIZE);
    ctx.moveTo(0, LOUPE_SIZE / 2); ctx.lineTo(LOUPE_SIZE, LOUPE_SIZE / 2);
    ctx.stroke();
  }, [x, y, pageWidth, pageHeight, sourceRef]);

  // Position loupe offset from cursor so it doesn't cover the target
  const offsetX = x + 24;
  const offsetY = y + 24;
  // Clamp into page bounds
  const left = Math.min(Math.max(0, offsetX), pageWidth - LOUPE_SIZE - 4);
  const top = Math.min(Math.max(0, offsetY), pageHeight - LOUPE_SIZE - 4);

  return (
    <div style={{
      position: 'absolute', left, top, width: LOUPE_SIZE, height: LOUPE_SIZE,
      borderRadius: '50%', overflow: 'hidden',
      border: '3px solid #F47820', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      pointerEvents: 'none', backgroundColor: '#fff',
      zIndex: 100,
    }}>
      <canvas ref={canvasRef} width={LOUPE_SIZE} height={LOUPE_SIZE} style={{ display: 'block' }} />
    </div>
  );
};

// ─── Calibration modal: enter the real-world distance for the selected segment ──
const CalibrationModal: React.FC<{ pxDistance: number; onSubmit: (inches: number) => void; onCancel: () => void }> = ({ pxDistance, onSubmit, onCancel }) => {
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');
  const submit = () => {
    const totalInches = (parseFloat(feet) || 0) * 12 + (parseFloat(inches) || 0);
    if (totalInches <= 0) return;
    onSubmit(totalInches);
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="calibrate-title"
      style={{
        position: 'fixed', inset: 0, zIndex: (zIndex.toast as number) + 10,
        backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.md,
          padding: spacing['6'],
          width: 420, maxWidth: '90vw',
          boxShadow: shadows.panel,
        }}
      >
        <h3 id="calibrate-title" style={{ margin: 0, marginBottom: spacing['2'], fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
          Calibrate scale
        </h3>
        <p style={{ margin: 0, marginBottom: spacing['4'], fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
          Enter the real-world length of the segment you just drew ({pxDistance.toFixed(0)} px). Future measurements will use this scale.
        </p>
        <div style={{ display: 'flex', gap: spacing['2'], marginBottom: spacing['4'] }}>
          <label style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Feet</span>
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              value={feet}
              onChange={(e) => setFeet(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
              style={{ width: '100%', padding: spacing['2'], fontSize: typography.fontSize.body, borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, fontFamily: typography.fontFamily }}
            />
          </label>
          <label style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Inches</span>
            <input
              type="number"
              inputMode="numeric"
              value={inches}
              onChange={(e) => setInches(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
              style={{ width: '100%', padding: spacing['2'], fontSize: typography.fontSize.body, borderRadius: borderRadius.base, border: `1px solid ${colors.borderDefault}`, fontFamily: typography.fontFamily }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
          <button
            onClick={onCancel}
            style={{ padding: `${spacing['2']} ${spacing['4']}`, background: 'transparent', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            style={{ padding: `${spacing['2']} ${spacing['4']}`, backgroundColor: colors.primaryOrange, color: colors.white, border: 'none', borderRadius: borderRadius.base, cursor: 'pointer', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

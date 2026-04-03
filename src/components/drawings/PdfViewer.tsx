import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, Pencil, Plus } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, vizColors, zIndex, transitions } from '../../styles/theme';
import { useUiStore } from '../../stores';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import CreateRFIModal from '../forms/CreateRFIModal';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  /** URL or File object to render */
  file: string | File | null;
  /** Title shown in the header */
  title?: string;
  /** Called when the viewer is closed */
  onClose: () => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 5.0;
const DOUBLE_TAP_MS = 300;

function getDistance(touches: React.TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function PdfViewer({ file, title, onClose }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfPageWidth, setPdfPageWidth] = useState(612); // default letter width in pts
  const [baseScale, setBaseScale] = useState(1.0);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  const [showRFIModal, setShowRFIModal] = useState(false);
  const [rfiScreenshot, setRfiScreenshot] = useState<string | null>(null);

  const isMobile = useMediaQuery('(max-width: 767px)');
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Capture natural page width from the loaded PDF page (view[2] is width in pts at scale 1)
  const onPageLoadSuccess = useCallback((page: unknown) => {
    const p = page as { view?: number[] };
    if (p.view && p.view[2] > 0) {
      setPdfPageWidth(p.view[2]);
    }
  }, []);

  if (!file) return null;

  const zoomIn = () => setZoomLevel((z) => Math.min(z + 0.25, MAX_SCALE));
  const zoomOut = () => setZoomLevel((z) => Math.max(z - 0.25, MIN_SCALE));
  const resetZoom = () => {
    setZoomLevel(1.0);
    setTranslateX(0);
    setTranslateY(0);
  };
  const prevPage = () => setPageNumber((p) => {
    const next = Math.max(p - 1, 1);
    if (next !== p) announceStatus(`Page ${next} of ${numPages}`);
    return next;
  });
  const nextPage = () => setPageNumber((p) => {
    const next = Math.min(p + 1, numPages);
    if (next !== p) announceStatus(`Page ${next} of ${numPages}`);
    return next;
  });

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

  // --- Create RFI with screenshot ---
  const handleCreateRFI = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('.react-pdf__Page canvas');
    const screenshot = canvas ? canvas.toDataURL('image/png') : null;
    setRfiScreenshot(screenshot);
    setShowRFIModal(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PageUp') { e.preventDefault(); prevPage(); }
      if (e.key === 'PageDown') { e.preventDefault(); nextPage(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages]);

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
        {/* Left: close + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <button onClick={onClose} aria-label="Close document viewer" style={toolbarBtnStyle}>
            <X size={18} />
          </button>
          <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.medium, color: colors.white }}>
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
                <div style={{ boxShadow: shadows.panel, borderRadius: borderRadius.sm, overflow: 'hidden' }}>
                  <Document
                    file={file}
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
              <img src={rfiScreenshot} alt="Drawing screenshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

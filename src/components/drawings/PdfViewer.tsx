import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, Pencil, Plus } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, vizColors, zIndex, transitions } from '../../styles/theme';
import { useUiStore } from '../../stores';
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
  const [scale, setScale] = useState(1.0);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  const [showRFIModal, setShowRFIModal] = useState(false);
  const [rfiScreenshot, setRfiScreenshot] = useState<string | null>(null);
  const isMobile = window.innerWidth < 768;

  // Touch gesture refs
  const initialPinchDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1.0);
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const currentScaleRef = useRef<number>(scale);

  // Keep currentScaleRef in sync
  useEffect(() => { currentScaleRef.current = scale; }, [scale]);

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

  if (!file) return null;

  const zoomIn = () => setScale((s) => Math.min(s + 0.25, MAX_SCALE));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, MIN_SCALE));
  const resetZoom = () => {
    setScale(1.0);
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
      pinchStartScaleRef.current = currentScaleRef.current;
      panStartRef.current = null;
    } else if (e.touches.length === 1) {
      // Double-tap detection
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
      // Pinch zoom
      const newDist = getDistance(e.touches);
      const ratio = newDist / initialPinchDistanceRef.current;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchStartScaleRef.current * ratio));
      setScale(newScale);
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

  const toolbarBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, border: 'none',
    borderRadius: borderRadius.base, backgroundColor: colors.overlayWhiteThin,
    color: colors.white, cursor: 'pointer', transition: `background-color ${transitions.quick}`,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: zIndex.toast as number,
      display: 'flex', flexDirection: 'column',
      backgroundColor: vizColors.dark,
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${spacing['2']} ${spacing['4']}`,
        backgroundColor: colors.overlayDark,
        borderBottom: `1px solid ${colors.darkBorder}`,
        flexShrink: 0,
      }}>
        {/* Left: title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <button onClick={onClose} aria-label="Close document viewer" style={toolbarBtnStyle}>
            <X size={18} />
          </button>
          <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.medium, color: colors.white }}>
            {title || 'Document Viewer'}
          </span>
        </div>

        {/* Center: page controls */}
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

        {/* Right: zoom controls (desktop always visible, mobile collapsible) */}
        {isMobile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <button
              onClick={() => setToolbarExpanded((v) => !v)}
              aria-label={toolbarExpanded ? 'Collapse zoom controls' : 'Expand zoom controls'}
              style={toolbarBtnStyle}
            >
              <Pencil size={16} />
            </button>
            {toolbarExpanded && (
              <div style={{
                position: 'absolute', top: 56, right: 16,
                display: 'flex', flexDirection: 'column', gap: spacing['2'],
                backgroundColor: colors.overlayDark,
                borderRadius: borderRadius.base,
                padding: spacing['2'],
                border: `1px solid ${colors.darkBorder}`,
                zIndex: 10,
              }}>
                <button onClick={zoomOut} aria-label="Zoom out" style={toolbarBtnStyle}><ZoomOut size={16} /></button>
                <button
                  onClick={resetZoom}
                  aria-label={`Current zoom ${Math.round(scale * 100)}%, tap to reset`}
                  style={{ ...toolbarBtnStyle, width: 'auto', padding: `0 ${spacing['2']}`, fontSize: typography.fontSize.sm }}
                >
                  {Math.round(scale * 100)}%
                </button>
                <button onClick={zoomIn} aria-label="Zoom in" style={toolbarBtnStyle}><ZoomIn size={16} /></button>
                <button onClick={resetZoom} aria-label="Fit to width" style={toolbarBtnStyle}><Maximize2 size={16} /></button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <button onClick={zoomOut} aria-label="Zoom out" style={toolbarBtnStyle}>
              <ZoomOut size={16} />
            </button>
            <button onClick={resetZoom} aria-label={`Current zoom ${Math.round(scale * 100)}%, click to reset`} style={{ ...toolbarBtnStyle, width: 'auto', padding: `0 ${spacing['2']}`, fontSize: typography.fontSize.sm }}>
              {Math.round(scale * 100)}%
            </button>
            <button onClick={zoomIn} aria-label="Zoom in" style={toolbarBtnStyle}>
              <ZoomIn size={16} />
            </button>
            <button onClick={resetZoom} aria-label="Fit to width" title="Fit to width" style={toolbarBtnStyle}>
              <Maximize2 size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Document area */}
      <div
        style={{
          flex: 1, overflow: 'auto',
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
          padding: spacing['6'],
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
          <div style={{
            boxShadow: shadows.panel,
            borderRadius: borderRadius.sm,
            overflow: 'hidden',
            transform: `translate(${translateX}px, ${translateY}px)`,
            transformOrigin: 'top center',
            willChange: 'transform',
          }}>
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
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
          </div>
        )}
      </div>

      {/* Mobile: Create RFI floating action button */}
      {isMobile && (
        <button
          onClick={handleCreateRFI}
          aria-label="Create RFI from current view"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: '50%',
            backgroundColor: colors.primaryOrange,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: shadows.panel,
            zIndex: (zIndex.toast as number) + 1,
          }}
        >
          <Plus size={24} color={colors.white} />
        </button>
      )}

      {/* RFI Modal */}
      {showRFIModal && (
        <>
          {rfiScreenshot && (
            <div style={{
              position: 'fixed',
              bottom: 96,
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

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileText,
  RotateCw,
  Columns,
  Rows,
  Download,
} from 'lucide-react';
import { spacing, typography, borderRadius } from '../../styles/theme';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker — use the local copy in public/ (the one in
// pdfPageSplitter.ts). CSP blocks CDN script-src so a local worker is
// mandatory, and sharing one URL across all modules prevents load-order
// races where a CDN-based config clobbers the local one.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.js', import.meta.url).href;

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocumentViewerProps {
  files: Array<{ name: string; url: string; type?: string }>;
  onUpload?: (file: File) => void;
  className?: string;
  initialPage?: number;
  maxHeight?: string | number;
}

type FitMode = 'width' | 'page' | 'custom';

// ── Constants ─────────────────────────────────────────────────────────────────

const VIEWER_BG = '#1a1a1e';
const TOOLBAR_BG = 'rgba(26, 26, 30, 0.92)';
const TOOLBAR_BORDER = 'rgba(255, 255, 255, 0.08)';
const THUMBNAIL_BG = 'rgba(26, 26, 30, 0.96)';
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.15;
const TOOLBAR_HIDE_DELAY = 2000;
const THUMBNAIL_WIDTH = 120;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isImageFile(file: { name: string; type?: string }): boolean {
  if (file.type?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|svg|bmp|tiff?)$/i.test(file.name);
}

function isPdfFile(file: { name: string; type?: string }): boolean {
  if (file.type === 'application/pdf') return true;
  return /\.pdf$/i.test(file.name);
}

// ── Toolbar Button ────────────────────────────────────────────────────────────

const ToolbarButton: React.FC<{
  onClick: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ onClick, title, active, disabled, children }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '48px',
        height: '48px',
        minWidth: '48px',
        minHeight: '48px',
        border: 'none',
        borderRadius: borderRadius.md,
        background: active
          ? 'rgba(244, 120, 32, 0.2)'
          : hovered
          ? 'rgba(255, 255, 255, 0.1)'
          : 'transparent',
        color: active ? '#F47820' : disabled ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 160ms ease',
        padding: 0,
      }}
    >
      {children}
    </button>
  );
};

// ── Upload Dropzone ───────────────────────────────────────────────────────────

const UploadDropzone: React.FC<{
  onUpload?: (file: File) => void;
  maxHeight: string | number;
}> = ({ onUpload, maxHeight }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && onUpload) {
        onUpload(file);
      }
    },
    [onUpload]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && onUpload) {
        onUpload(file);
      }
    },
    [onUpload]
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
        background: VIEWER_BG,
        borderRadius: borderRadius.xl,
        border: `2px dashed ${isDragging ? '#F47820' : 'rgba(255, 255, 255, 0.15)'}`,
        cursor: 'pointer',
        transition: 'all 300ms cubic-bezier(0.32, 0.72, 0, 1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle gradient overlay when dragging */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at center, rgba(244, 120, 32, 0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      <motion.div
        animate={{ y: isDragging ? -4 : 0, scale: isDragging ? 1.05 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: spacing['4'],
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: borderRadius.full,
            background: 'rgba(244, 120, 32, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Upload size={28} color="#F47820" strokeWidth={1.5} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              margin: 0,
              fontSize: typography.fontSize.title,
              fontWeight: typography.fontWeight.medium,
              color: 'rgba(255, 255, 255, 0.9)',
              letterSpacing: typography.letterSpacing.tight,
            }}
          >
            {isDragging ? 'Drop to upload' : 'Upload document'}
          </p>
          <p
            style={{
              margin: `${spacing['2']} 0 0`,
              fontSize: typography.fontSize.sm,
              color: 'rgba(255, 255, 255, 0.45)',
              letterSpacing: typography.letterSpacing.normal,
            }}
          >
            PDF, shop drawings, or product data sheets
          </p>
        </div>
      </motion.div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.tiff,.bmp,.svg"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </motion.div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  files,
  onUpload,
  className,
  initialPage = 1,
  maxHeight = '600px',
}) => {
  // State
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState<FitMode>('width');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [_pdfLoading, setPdfLoading] = useState(true);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const toolbarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentFile = files[currentFileIndex] || null;
  const isImage = currentFile ? isImageFile(currentFile) : false;
  const isPdf = currentFile ? isPdfFile(currentFile) : false;

  // ── Resize observer ─────────────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── Toolbar auto-hide ───────────────────────────────────────────────────────

  const resetToolbarTimer = useCallback(() => {
    setShowToolbar(true);

    if (toolbarTimeoutRef.current) {
      clearTimeout(toolbarTimeoutRef.current);
    }

    toolbarTimeoutRef.current = setTimeout(() => {
      setShowToolbar(false);
    }, TOOLBAR_HIDE_DELAY);
  }, []);

  const handleMouseMove = useCallback(() => {
    resetToolbarTimer();
  }, [resetToolbarTimer]);

  useEffect(() => {
    return () => {
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current);
      }
    };
  }, []);

  // ── Zoom ────────────────────────────────────────────────────────────────────

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM));
    setFitMode('custom');
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM));
    setFitMode('custom');
  }, []);

  const handleFitWidth = useCallback(() => {
    setFitMode('width');
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handleFitPage = useCallback(() => {
    setFitMode('page');
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setZoom((z) => Math.min(Math.max(z + delta, MIN_ZOOM), MAX_ZOOM));
        setFitMode('custom');
      }
    },
    []
  );

  // ── Pan ─────────────────────────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom > 1) {
        e.preventDefault();
        setIsPanning(true);
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      }
    },
    [zoom, panOffset]
  );

  const handleMouseMovePan = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPanOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      }
    },
    [isPanning, panStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // ── Page navigation ─────────────────────────────────────────────────────────

  const handlePrevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(p - 1, 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(p + 1, numPages));
  }, [numPages]);

  const handlePageClick = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // ── Fullscreen ──────────────────────────────────────────────────────────────

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ── Rotation ────────────────────────────────────────────────────────────────

  const handleRotate = useCallback(() => {
    setRotation((r) => (r + 90) % 360);
  }, []);

  // ── PDF callbacks ───────────────────────────────────────────────────────────

  const onDocumentLoadSuccess = useCallback(({ numPages: pages }: { numPages: number }) => {
    setNumPages(pages);
    setPdfLoading(false);
  }, []);

  const onDocumentLoadError = useCallback(() => {
    setPdfLoading(false);
  }, []);

  // ── Computed page width ─────────────────────────────────────────────────────

  const pageWidth = useMemo(() => {
    const thumbnailOffset = showThumbnails ? THUMBNAIL_WIDTH + 16 : 0;
    const availableWidth = containerWidth - thumbnailOffset - 48; // padding
    const availableHeight = containerHeight - 80; // toolbar height

    if (fitMode === 'width') {
      return availableWidth * zoom;
    }
    if (fitMode === 'page') {
      // Approximate: assume standard 8.5x11 aspect
      const aspectRatio = 8.5 / 11;
      const widthFromHeight = availableHeight * aspectRatio * zoom;
      return Math.min(widthFromHeight, availableWidth * zoom);
    }
    return availableWidth * zoom;
  }, [containerWidth, containerHeight, zoom, fitMode, showThumbnails]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case 'ArrowLeft':
          handlePrevPage();
          break;
        case 'ArrowRight':
          handleNextPage();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'r':
          handleRotate();
          break;
        case '0':
          handleFitWidth();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevPage, handleNextPage, handleZoomIn, handleZoomOut, toggleFullscreen, handleRotate, handleFitWidth]);

  // ── No files — show dropzone ────────────────────────────────────────────────

  if (!files || files.length === 0) {
    return <UploadDropzone onUpload={onUpload} maxHeight={maxHeight} />;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div
      ref={containerRef}
      className={className}
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative',
        width: '100%',
        height: isFullscreen ? '100vh' : typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
        background: VIEWER_BG,
        borderRadius: isFullscreen ? 0 : borderRadius.xl,
        overflow: 'hidden',
        userSelect: 'none',
        display: 'flex',
      }}
    >
      {/* Thumbnail strip */}
      <AnimatePresence>
        {showThumbnails && isPdf && numPages > 1 && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: THUMBNAIL_WIDTH + 16, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            style={{
              height: '100%',
              background: THUMBNAIL_BG,
              borderRight: `1px solid ${TOOLBAR_BORDER}`,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: `${spacing['3']} ${spacing['2']}`,
              display: 'flex',
              flexDirection: 'column',
              gap: spacing['2'],
              flexShrink: 0,
            }}
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
              <motion.div
                key={page}
                onClick={() => handlePageClick(page)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  cursor: 'pointer',
                  border: page === currentPage ? '2px solid #F47820' : '2px solid transparent',
                  borderRadius: borderRadius.sm,
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.03)',
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                <Document file={currentFile!.url} loading="">
                  <Page
                    pageNumber={page}
                    width={THUMBNAIL_WIDTH - 8}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                  />
                </Document>
                <div
                  style={{
                    position: 'absolute',
                    bottom: '4px',
                    right: '4px',
                    fontSize: typography.fontSize.caption,
                    color: 'rgba(255,255,255,0.6)',
                    background: 'rgba(0,0,0,0.6)',
                    borderRadius: borderRadius.sm,
                    padding: '1px 4px',
                  }}
                >
                  {page}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main viewer area */}
      <div
        ref={viewerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMovePan}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          flex: 1,
          height: '100%',
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
          position: 'relative',
        }}
      >
        {/* Document content */}
        <div
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) rotate(${rotation}deg)`,
            transition: isPanning ? 'none' : 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
            transformOrigin: 'center center',
          }}
        >
          {isPdf && currentFile && (
            <Document
              file={currentFile.url}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: spacing['16'],
                  }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  >
                    <FileText size={32} color="rgba(255,255,255,0.3)" />
                  </motion.div>
                </div>
              }
            >
              <Page
                pageNumber={currentPage}
                width={pageWidth > 0 ? pageWidth : undefined}
                renderAnnotationLayer={true}
                renderTextLayer={true}
                loading=""
              />
            </Document>
          )}

          {isImage && currentFile && (
            <img
              src={currentFile.url}
              alt={currentFile.name}
              draggable={false}
              style={{
                maxWidth: fitMode === 'width' ? `${containerWidth - 48}px` : undefined,
                maxHeight: fitMode === 'page' ? `${containerHeight - 80}px` : undefined,
                width: fitMode === 'custom' ? `${zoom * 100}%` : 'auto',
                height: 'auto',
                objectFit: 'contain',
                transform: `scale(${fitMode !== 'custom' ? zoom : 1})`,
                transformOrigin: 'center center',
                transition: 'transform 200ms ease',
                borderRadius: borderRadius.sm,
              }}
            />
          )}

          {/* Non-PDF/image file fallback */}
          {currentFile && !isPdf && !isImage && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: spacing['4'],
                padding: spacing['16'],
              }}
            >
              <FileText size={48} color="rgba(255,255,255,0.4)" />
              <p
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: typography.fontSize.body,
                  margin: 0,
                }}
              >
                {currentFile.name}
              </p>
              <a
                href={currentFile.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#F47820',
                  fontSize: typography.fontSize.sm,
                  textDecoration: 'none',
                }}
              >
                Download file
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Floating toolbar */}
      <AnimatePresence>
        {showToolbar && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            style={{
              position: 'absolute',
              top: spacing['3'],
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: spacing['1'],
              padding: `${spacing['1']} ${spacing['2']}`,
              background: TOOLBAR_BG,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderRadius: borderRadius.xl,
              border: `1px solid ${TOOLBAR_BORDER}`,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              zIndex: 10,
            }}
            onMouseEnter={() => {
              if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current);
              setShowToolbar(true);
            }}
            onMouseLeave={resetToolbarTimer}
          >
            {/* Thumbnails toggle (multi-page PDF only) */}
            {isPdf && numPages > 1 && (
              <ToolbarButton
                onClick={() => setShowThumbnails((s) => !s)}
                title="Toggle thumbnails"
                active={showThumbnails}
              >
                <Columns size={18} />
              </ToolbarButton>
            )}

            {/* Page navigation */}
            {isPdf && numPages > 1 && (
              <>
                <ToolbarButton
                  onClick={handlePrevPage}
                  title="Previous page"
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft size={18} />
                </ToolbarButton>

                <span
                  style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: typography.fontSize.sm,
                    fontWeight: typography.fontWeight.medium,
                    minWidth: '60px',
                    textAlign: 'center',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {currentPage} / {numPages}
                </span>

                <ToolbarButton
                  onClick={handleNextPage}
                  title="Next page"
                  disabled={currentPage >= numPages}
                >
                  <ChevronRight size={18} />
                </ToolbarButton>

                {/* Divider */}
                <div
                  style={{
                    width: '1px',
                    height: '24px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    margin: `0 ${spacing['1']}`,
                  }}
                />
              </>
            )}

            {/* Zoom controls */}
            <ToolbarButton onClick={handleZoomOut} title="Zoom out (-)">
              <ZoomOut size={18} />
            </ToolbarButton>

            <span
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: typography.fontSize.label,
                fontWeight: typography.fontWeight.medium,
                minWidth: '42px',
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {zoomPercent}%
            </span>

            <ToolbarButton onClick={handleZoomIn} title="Zoom in (+)">
              <ZoomIn size={18} />
            </ToolbarButton>

            {/* Divider */}
            <div
              style={{
                width: '1px',
                height: '24px',
                background: 'rgba(255, 255, 255, 0.1)',
                margin: `0 ${spacing['1']}`,
              }}
            />

            {/* Fit modes */}
            <ToolbarButton
              onClick={handleFitWidth}
              title="Fit to width (0)"
              active={fitMode === 'width'}
            >
              <Columns size={18} />
            </ToolbarButton>

            <ToolbarButton
              onClick={handleFitPage}
              title="Fit to page"
              active={fitMode === 'page'}
            >
              <Rows size={18} />
            </ToolbarButton>

            {/* Rotate */}
            <ToolbarButton onClick={handleRotate} title="Rotate (R)">
              <RotateCw size={18} />
            </ToolbarButton>

            {/* Download */}
            {currentFile?.url && (
              <ToolbarButton
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = currentFile.url;
                  a.download = currentFile.name || 'document';
                  a.target = '_blank';
                  a.rel = 'noopener noreferrer';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                title="Download"
              >
                <Download size={18} />
              </ToolbarButton>
            )}

            {/* Fullscreen */}
            <ToolbarButton onClick={toggleFullscreen} title="Fullscreen (F)">
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </ToolbarButton>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File tabs (multiple files) */}
      {files.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: spacing['3'],
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: spacing['1'],
            padding: `${spacing['1']} ${spacing['2']}`,
            background: TOOLBAR_BG,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: borderRadius.lg,
            border: `1px solid ${TOOLBAR_BORDER}`,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            maxWidth: '80%',
            overflowX: 'auto',
            zIndex: 10,
          }}
        >
          {files.map((file, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentFileIndex(index);
                setCurrentPage(1);
                setNumPages(0);
                setZoom(1);
                setFitMode('width');
                setPanOffset({ x: 0, y: 0 });
                setRotation(0);
                setPdfLoading(true);
              }}
              style={{
                border: 'none',
                background: index === currentFileIndex ? 'rgba(244, 120, 32, 0.2)' : 'transparent',
                color:
                  index === currentFileIndex ? '#F47820' : 'rgba(255, 255, 255, 0.6)',
                padding: `${spacing['2']} ${spacing['3']}`,
                borderRadius: borderRadius.md,
                fontSize: typography.fontSize.label,
                fontWeight: typography.fontWeight.medium,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 160ms ease',
                minHeight: '36px',
              }}
            >
              {file.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;

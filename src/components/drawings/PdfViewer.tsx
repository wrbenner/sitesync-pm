import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, vizColors } from '../../styles/theme';

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

export function PdfViewer({ file, title, onClose }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.25));
  const resetZoom = () => setScale(1.0);
  const prevPage = () => setPageNumber((p) => Math.max(p - 1, 1));
  const nextPage = () => setPageNumber((p) => Math.min(p + 1, numPages));

  const toolbarBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, border: 'none',
    borderRadius: borderRadius.base, backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#fff', cursor: 'pointer', transition: 'background-color 150ms',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', flexDirection: 'column',
      backgroundColor: vizColors.dark,
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${spacing['2']} ${spacing['4']}`,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}>
        {/* Left: title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <button onClick={onClose} style={toolbarBtnStyle}>
            <X size={18} />
          </button>
          <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.medium, color: '#fff' }}>
            {title || 'Document Viewer'}
          </span>
        </div>

        {/* Center: page controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <button onClick={prevPage} disabled={pageNumber <= 1} style={{ ...toolbarBtnStyle, opacity: pageNumber <= 1 ? 0.3 : 1 }}>
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontSize: typography.fontSize.sm, color: '#fff', minWidth: '80px', textAlign: 'center' }}>
            {loading ? '...' : `Page ${pageNumber} of ${numPages}`}
          </span>
          <button onClick={nextPage} disabled={pageNumber >= numPages} style={{ ...toolbarBtnStyle, opacity: pageNumber >= numPages ? 0.3 : 1 }}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Right: zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <button onClick={zoomOut} style={toolbarBtnStyle}>
            <ZoomOut size={16} />
          </button>
          <button onClick={resetZoom} style={{ ...toolbarBtnStyle, width: 'auto', padding: `0 ${spacing['2']}`, fontSize: typography.fontSize.sm }}>
            {Math.round(scale * 100)}%
          </button>
          <button onClick={zoomIn} style={toolbarBtnStyle}>
            <ZoomIn size={16} />
          </button>
          <button onClick={resetZoom} style={toolbarBtnStyle} title="Fit to width">
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* Document area */}
      <div style={{
        flex: 1, overflow: 'auto',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        padding: spacing['6'],
      }}>
        {error ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: spacing['8'], color: '#fff', textAlign: 'center',
          }}>
            <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.medium, marginBottom: spacing['2'] }}>
              Unable to load document
            </p>
            <p style={{ fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.6)' }}>
              {error}
            </p>
          </div>
        ) : (
          <div style={{
            boxShadow: shadows.panel,
            borderRadius: borderRadius.sm,
            overflow: 'hidden',
          }}>
            <Document
              file={file}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div style={{ width: 600, height: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
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
    </div>
  );
}

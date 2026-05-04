/**
 * DrawingTiledViewer — THE viewer for all construction drawings.
 *
 * Powered by OpenSeadragon for buttery 60fps pan/zoom on massive ARCH E sheets.
 * Three source modes, one viewer:
 *  1. DZI tile pyramids when tile_status === 'ready' (deepest zoom, best perf)
 *  2. Single image via signed URL (PNG/JPEG pages from PDF split)
 *  3. PDF rendered to canvas on-the-fly via PDF.js
 *
 * Key features:
 *  - Smooth pan/zoom on 42"×30" sheets (tens of thousands of pixels)
 *  - SVG annotation overlay in normalized [0,1] coordinates (resolution-independent)
 *  - Steve-Jobs-level measurement tools (MeasurementOverlay)
 *  - Revision cloud and stamp tools via CloudTool / StampTool
 *  - Presence bar integration (Supabase Realtime)
 *  - Minimap navigator in bottom-right
 *  - Keyboard shortcuts (+ / - / 0 / Esc / R)
 *  - Sheet-to-sheet navigation (← / →)
 *  - Offline sync with IndexedDB queue
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import OpenSeadragon from 'openseadragon';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Pencil,
  RotateCw,
  Grid3X3,
  Wifi,
  WifiOff,
  CloudOff,
  MessageSquarePlus,
} from 'lucide-react';
import CreateRFIModal from '../forms/CreateRFIModal';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useUiStore } from '../../stores';
import { MarkupToolbar, type MarkupTool } from './MarkupToolbar';
import { STAMP_CONFIGS, type StampType } from './tools/StampTool';
import type { NormalizedGeometry, AnnotationLayer, AnnotationVisibility } from '../../lib/annotationGeometry';
import {
  toNormalized,
  fromNormalized,
  denormalizeStrokeWidth,
  generateCloudPath,
  type GeometryType,
  type NormalizedPoint,
  type PageDimensions,
} from '../../lib/annotationGeometry';
import { useDrawingMarkups } from '../../hooks/queries/document-management';
import { useCreateDrawingMarkup, useDeleteDrawingMarkup } from '../../hooks/mutations/documents';
import { drawingService } from '../../services/drawingService';
import { MeasurementOverlay, type MeasurementResult } from './MeasurementOverlay';
import { parseScaleRatio, formatFeetInches } from './measurementUtils';
import { useDrawingPresence, type DrawingPresenceUser } from '../../hooks/useDrawingPresence';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'sonner';

// ── Tool cursors — inline SVG data-URLs so each tool feels its own job.
// Keeping them here (rather than as separate files) lets us tune hotspots inline
// and avoid an extra network round-trip for a handful of tiny SVGs.
const toolCursor = (tool: MarkupTool): string => {
  const svg = (() => {
    switch (tool) {
      case 'measure':
        return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M3 3h18v8H3z' fill='none' stroke='%23F47820' stroke-width='2'/><path d='M7 3v3M11 3v5M15 3v3M19 3v5' stroke='%23F47820' stroke-width='1.5'/></svg>`;
      case 'path':
        return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M3 20c4-8 10-8 14 0' fill='none' stroke='%23F47820' stroke-width='2' stroke-linecap='round'/><circle cx='3' cy='20' r='2.5' fill='%23F47820'/><circle cx='17' cy='20' r='2.5' fill='%23F47820'/></svg>`;
      case 'area':
        return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M4 5l16 2-2 13-12-3z' fill='rgba(244,120,32,0.15)' stroke='%23F47820' stroke-width='1.75' stroke-linejoin='round'/></svg>`;
      case 'count':
        return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><circle cx='12' cy='12' r='9' fill='%23F47820' stroke='white' stroke-width='2'/><text x='12' y='16' text-anchor='middle' fill='white' font-size='10' font-weight='700' font-family='system-ui'>#</text></svg>`;
      case 'calibrate':
        return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><circle cx='12' cy='12' r='8' fill='none' stroke='%23F47820' stroke-width='1.5'/><path d='M12 2v5M12 17v5M2 12h5M17 12h5' stroke='%23F47820' stroke-width='1.5'/></svg>`;
      case 'pin':
        return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M12 2c-3.5 0-6 2.5-6 6 0 4 6 14 6 14s6-10 6-14c0-3.5-2.5-6-6-6z' fill='%23F47820' stroke='white' stroke-width='1.5'/><circle cx='12' cy='8' r='2' fill='white'/></svg>`;
      case 'highlight':
        return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M9 11l-6 6v3h9l3-3' fill='rgba(255,210,63,0.3)' stroke='%23F4C531' stroke-width='1.5' stroke-linejoin='round'/><path d='M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4' fill='%23F4C531' stroke='%23222' stroke-width='1' stroke-linejoin='round'/></svg>`;
      case 'draw':
        return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M16 3l5 5-11 11H5v-5z' fill='%23F47820' stroke='white' stroke-width='1.5' stroke-linejoin='round'/></svg>`;
      case 'text':
        return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M6 4h12M12 4v16M9 20h6' stroke='%23F47820' stroke-width='2.2' stroke-linecap='round'/></svg>`;
      default:
        return '';
    }
  })();
  if (!svg) return 'default';
  // Hotspot at (12,12) — the natural center for most of these glyphs.
  return `url("data:image/svg+xml,${svg}") 12 12, crosshair`;
};

// ── First-use tool hint — breathing coach mark shown once per session per tool ─
const ToolHint: React.FC<{ tool: MarkupTool; onDismiss: () => void }> = ({ tool, onDismiss }) => {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 3200);
    return () => window.clearTimeout(t);
  }, [onDismiss]);
  const hints: Partial<Record<MarkupTool, { title: string; body: string; keys?: string }>> = {
    measure: { title: 'Tape measure', body: 'Click two points to measure', keys: 'Shift = ortho · Esc cancel' },
    path: { title: 'Path length', body: 'Click vertices · double-click to finish', keys: 'Enter finish · Esc cancel' },
    area: { title: 'Area', body: 'Click vertices · click start dot (or double-click) to close', keys: 'Esc cancel' },
    count: { title: 'Count', body: 'Click to drop a numbered marker' },
    calibrate: { title: 'Calibrate scale', body: 'Click two points of a known distance' },
    pin: { title: 'Pin', body: 'Click to drop a pin' },
    highlight: { title: 'Highlight', body: 'Drag to paint a translucent band' },
    text: { title: 'Text', body: 'Click to place text — Enter commits · Esc cancels' },
    draw: { title: 'Draw', body: 'Drag for a freehand stroke' },
  };
  const h = hints[tool];
  if (!h) return null;
  return (
    <div style={{
      position: 'absolute',
      top: 58,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9,
      padding: '8px 14px',
      backgroundColor: 'rgba(10,10,10,0.92)',
      color: '#fff',
      borderRadius: 10,
      boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
      fontSize: 12,
      lineHeight: 1.35,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minWidth: 180,
      animation: 'fadeSlideOut 3.2s ease-in-out forwards',
      pointerEvents: 'none',
    }}>
      <span style={{ fontWeight: 700, letterSpacing: 0.2 }}>{h.title}</span>
      <span style={{ opacity: 0.85 }}>{h.body}</span>
      {h.keys && <span style={{ opacity: 0.5, fontSize: 11, fontFamily: "'SF Mono', Menlo, monospace" }}>{h.keys}</span>}
    </div>
  );
};

// ── OSD Loupe — circular precision magnifier that samples OSD's drawer canvas ──
// Shown when a measurement/path/calibrate tool is active to help users snap to edges.
const OsdLoupe: React.FC<{
  screenX: number;
  screenY: number;
  containerRef: React.RefObject<HTMLDivElement>;
  viewerRef: React.RefObject<OpenSeadragon.Viewer | null>;
  /** Optional: when scale is known, render a true-measure bar along the loupe's bottom. */
  scaleLabel?: string | null;
  pulsing?: boolean;
}> = ({ screenX, screenY, containerRef, viewerRef, scaleLabel, pulsing }) => {
  const SIZE = 108;
  const MAG = 2.5;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Throttle repaints to one per animation frame. At 60fps this matches display refresh;
  // without it, high-frequency mousemove events cause needless redraws and jank.
  const rafRef = useRef<number | null>(null);
  const lastPosRef = useRef({ x: screenX, y: screenY });
  lastPosRef.current = { x: screenX, y: screenY };

  useEffect(() => {
    const paint = () => {
      rafRef.current = null;
      const loupe = canvasRef.current;
      const viewer = viewerRef.current;
      const container = containerRef.current;
      if (!loupe || !viewer || !container) return;
      const sourceCanvas = (viewer as unknown as { drawer?: { canvas?: HTMLCanvasElement } }).drawer?.canvas;
      if (!sourceCanvas) return;
      const ctx = loupe.getContext('2d');
      if (!ctx) return;

      const { x, y } = lastPosRef.current;
      const srcSize = SIZE / MAG;
      const scaleX = sourceCanvas.width / container.clientWidth;
      const scaleY = sourceCanvas.height / container.clientHeight;
      const srcX = x * scaleX - srcSize / 2;
      const srcY = y * scaleY - srcSize / 2;

      ctx.save();
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, 2 * Math.PI);
      ctx.clip();
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, SIZE, SIZE);
      try {
        ctx.drawImage(sourceCanvas, srcX, srcY, srcSize, srcSize, 0, 0, SIZE, SIZE);
      } catch { /* tainted — skip */ }
      ctx.strokeStyle = 'rgba(244,120,32,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(SIZE / 2, SIZE / 2 - 12);
      ctx.lineTo(SIZE / 2, SIZE / 2 + 12);
      ctx.moveTo(SIZE / 2 - 12, SIZE / 2);
      ctx.lineTo(SIZE / 2 + 12, SIZE / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, 2, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(244,120,32,0.9)';
      ctx.fill();
      ctx.restore();
    };
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(paint);
    return () => {
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [screenX, screenY, viewerRef, containerRef]);

  // Position via transform (GPU-accelerated) — no CSS transition so the loupe sticks to the cursor.
  const OFFSET = 64;
  const containerEl = containerRef.current;
  const maxRight = (containerEl?.clientWidth ?? window.innerWidth) - SIZE - 16;
  const leftPos = screenX + OFFSET + SIZE > maxRight ? Math.max(16, screenX - OFFSET - SIZE) : screenX + OFFSET;
  const topPos = Math.max(16, Math.min((containerEl?.clientHeight ?? window.innerHeight) - SIZE - 16, screenY - SIZE / 2));

  return (
    <div style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width: SIZE,
      height: SIZE,
      transform: `translate3d(${leftPos}px, ${topPos}px, 0)`,
      willChange: 'transform',
      borderRadius: '50%',
      pointerEvents: 'none',
      overflow: 'hidden',
      boxShadow: pulsing
        ? '0 8px 32px rgba(0,0,0,0.45), 0 0 0 3px rgba(244,120,32,1), 0 0 24px rgba(244,120,32,0.55)'
        : '0 8px 32px rgba(0,0,0,0.45), 0 0 0 2px rgba(244,120,32,0.7)',
      zIndex: 6,
      backgroundColor: '#fff',
      // Only the shadow transitions (for the snap pulse); position snaps instantly.
      transition: 'box-shadow 120ms ease-out',
    }}>
      <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ display: 'block' }} />
      {scaleLabel && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          pointerEvents: 'none',
        }}>
          {/* Calibrated scale tick — shows true-measure span under the loupe width */}
          <div style={{ width: SIZE * 0.4, height: 4, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 1, left: 0, right: 0, height: 2, backgroundColor: 'rgba(20,20,20,0.85)', borderRadius: 1 }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: 2, height: 6, backgroundColor: 'rgba(20,20,20,0.85)' }} />
            <div style={{ position: 'absolute', top: 0, right: 0, width: 2, height: 6, backgroundColor: 'rgba(20,20,20,0.85)' }} />
          </div>
          <div style={{
            fontSize: 10, fontWeight: 600, color: '#fff',
            fontFamily: "'SF Mono', 'Menlo', monospace",
            backgroundColor: 'rgba(20,20,20,0.75)',
            padding: '1px 6px', borderRadius: 4,
            letterSpacing: 0.2,
          }}>
            {scaleLabel}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Inline text prompt — replaces the jarring window.prompt for text markups ─
const InlineTextPrompt: React.FC<{
  x: number;
  y: number;
  onCommit: (value: string) => void;
  onCancel: () => void;
}> = ({ x, y, onCommit, onCancel }) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 6px',
        backgroundColor: 'rgba(10,10,10,0.95)',
        border: `1px solid ${colors.primaryOrange}`,
        borderRadius: 6,
        boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); onCommit(value); }
          else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        }}
        placeholder="Type annotation…"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#fff',
          outline: 'none',
          fontSize: 13,
          width: 180,
        }}
      />
    </div>
  );
};

// ── ID generator ───────────────────────────────────────────────────────────
const genId = (): string => `anno_${Date.now()}_${crypto.randomUUID().slice(0, 7)}`;

// ── Types ──────────────────────────────────────────────────────────────────

export interface TiledDrawing {
  id: string;
  setNumber: string;
  title: string;
  discipline: string;
  revision: string;
  file_url?: string;
  tile_status?: 'pending' | 'processing' | 'ready' | 'failed';
  tile_levels?: number;
  tile_format?: string;
}

interface DrawingTiledViewerProps {
  drawing: TiledDrawing;
  /** All drawings in the set for prev/next navigation */
  drawings: TiledDrawing[];
  /** Supabase storage base URL for tiles */
  tileBaseUrl?: string;
  /** Pre-signed URL for the drawing image (used when tiles aren't ready) */
  signedUrl?: string | null;
  onClose: () => void;
  onNavigate: (d: TiledDrawing) => void;
  projectId?: string;
  /** Scale ratio from AI classification (e.g. "1/4\"=1'-0\""). */
  scaleRatioText?: string | null;
}

interface AnnotationOverlayItem {
  id: string;
  geometry: NormalizedGeometry;
  layer: AnnotationLayer;
  visibility: AnnotationVisibility;
  strokeColor: string;
  strokeWidth: number; // normalized
  fillColor?: string;
  opacity: number;
  text?: string;
  stampType?: string;
  /** The markup tool that produced this annotation — used to preserve styling on reload. */
  uiTool?: MarkupTool;
}

// ── Constants ──────────────────────────────────────────────────────────────

const VIEWER_ID = 'osd-tiled-viewer';
const NAVIGATOR_ID = 'osd-navigator';
const _EASING = [0.16, 1, 0.3, 1] as const; // Apple-style spring

const _TOOLBAR_HEIGHT = 52;
const HEADER_HEIGHT = 48;

// ── Styles ─────────────────────────────────────────────────────────────────

const S = {
  wrapper: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 1090,
    backgroundColor: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  } as React.CSSProperties,

  header: {
    height: HEADER_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `0 ${spacing['5']}`,
    backgroundColor: 'rgba(10,10,10,0.97)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
    zIndex: 10,
  } as React.CSSProperties,

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing['3'],
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  headerCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing['2'],
  } as React.CSSProperties,

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing['2'],
    flex: 1,
    justifyContent: 'flex-end',
  } as React.CSSProperties,

  title: {
    fontSize: '14px',
    fontWeight: 500,
    letterSpacing: '-0.01em',
    color: 'rgba(255,255,255,0.92)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,

  badge: {
    fontSize: '11px',
    fontWeight: 500,
    fontFamily: typography.fontFamilyMono,
    padding: '3px 8px',
    borderRadius: '5px',
    backgroundColor: 'rgba(255,255,255,0.07)',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.01em',
  } as React.CSSProperties,

  viewerArea: {
    flex: 1,
    position: 'relative' as const,
    overflow: 'hidden',
  } as React.CSSProperties,

  osdContainer: {
    width: '100%',
    height: '100%',
    position: 'absolute' as const,
    inset: 0,
  } as React.CSSProperties,

  navigatorContainer: {
    position: 'absolute' as const,
    bottom: 14,
    right: 14,
    width: 140,
    height: 105,
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    overflow: 'hidden',
    zIndex: 5,
    boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
    opacity: 0.8,
  } as React.CSSProperties,

  annotationSvg: {
    position: 'absolute' as const,
    inset: 0,
    pointerEvents: 'none' as const,
    zIndex: 2,
  } as React.CSSProperties,

  controls: {
    position: 'absolute' as const,
    bottom: 14,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    backgroundColor: 'rgba(10,10,10,0.88)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.06)',
    zIndex: 5,
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  } as React.CSSProperties,

  controlBtn: {
    width: 34,
    height: 34,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    transition: `all ${transitions.fast}`,
  } as React.CSSProperties,

  zoomLabel: {
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: typography.fontFamilyMono,
    color: 'rgba(255,255,255,0.45)',
    minWidth: 48,
    textAlign: 'center' as const,
    userSelect: 'none' as const,
    letterSpacing: '0.02em',
  } as React.CSSProperties,

  navBtn: {
    position: 'absolute' as const,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,10,0.65)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '50%',
    color: 'rgba(255,255,255,0.8)',
    cursor: 'pointer',
    zIndex: 6,
    transition: `all ${transitions.fast}`,
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  } as React.CSSProperties,

  posLabel: {
    fontSize: '11px',
    fontWeight: 500,
    fontFamily: typography.fontFamilyMono,
    color: 'rgba(255,255,255,0.4)',
    padding: '0 6px',
    letterSpacing: '0.02em',
  } as React.CSSProperties,

  loadingOverlay: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  } as React.CSSProperties,

  spinner: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.15)',
    borderTopColor: colors.primaryOrange,
    animation: 'spin 0.8s linear infinite',
  } as React.CSSProperties,

  presenceBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  } as React.CSSProperties,

  presenceAvatar: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 9,
    fontWeight: 700,
    color: '#fff',
    border: '2px solid rgba(10,10,10,0.97)',
    cursor: 'default',
    position: 'relative' as const,
    flexShrink: 0,
  } as React.CSSProperties,

  presenceOverflow: {
    width: 26,
    height: 26,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 9,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    border: '2px solid rgba(10,10,10,0.95)',
    flexShrink: 0,
  } as React.CSSProperties,

  presenceTooltip: {
    position: 'absolute' as const,
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: 6,
    padding: '4px 8px',
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: borderRadius.sm,
    whiteSpace: 'nowrap' as const,
    fontSize: 11,
    color: '#fff',
    pointerEvents: 'none' as const,
    zIndex: 20,
  } as React.CSSProperties,

  offlineBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 10px',
    borderRadius: borderRadius.full,
    fontSize: 11,
    fontWeight: 600,
    zIndex: 7,
    position: 'absolute' as const,
    top: 12,
    right: 12,
  } as React.CSSProperties,

  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  } as React.CSSProperties,
};

// ── Presence Cursors SVG Overlay ──────────────────────────────────────────

interface PresenceCursorsOverlayProps {
  viewers: DrawingPresenceUser[];
  viewportBounds: { x: number; y: number; width: number; height: number } | null;
  containerSize: { width: number; height: number };
}

const PresenceCursorsOverlay: React.FC<PresenceCursorsOverlayProps> = React.memo(({
  viewers,
  viewportBounds,
  containerSize,
}) => {
  if (!viewportBounds || containerSize.width === 0) return null;

  const visibleViewers = viewers.filter((v) => v.cursor !== null);
  if (visibleViewers.length === 0) return null;

  const toScreen = (nx: number, ny: number) => {
    const vpFracX = (nx - viewportBounds.x) / viewportBounds.width;
    const vpFracY = (ny - viewportBounds.y) / viewportBounds.height;
    return {
      x: vpFracX * containerSize.width,
      y: vpFracY * containerSize.height,
    };
  };

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 4,
      }}
      viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {visibleViewers.map((v) => {
        if (!v.cursor) return null;
        const pos = toScreen(v.cursor.x, v.cursor.y);
        // Only render if within visible bounds (with generous margin)
        if (pos.x < -40 || pos.x > containerSize.width + 40 || pos.y < -40 || pos.y > containerSize.height + 40) {
          return null;
        }
        return (
          <g key={v.user_id} transform={`translate(${pos.x}, ${pos.y})`}>
            {/* Cursor arrow */}
            <path
              d="M0,0 L0,14 L4.5,10.5 L8,17 L10.5,16 L7,9.5 L12,9 Z"
              fill={v.color}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={0.8}
            />
            {/* Name + tool chip — shows what the remote user is doing live. */}
            {(() => {
              const first = v.name.split(' ')[0];
              const tool = v.tool && v.tool !== 'select' ? v.tool : null;
              const toolLabel: Record<string, string> = {
                pin: 'pin', highlight: 'hilite', measure: 'tape', text: 'text',
                draw: 'draw', area: 'area', count: 'count', calibrate: 'cal', path: 'path',
              };
              const toolText = tool ? (toolLabel[tool] || tool) : null;
              const namePx = first.length * 6 + 12;
              const toolPx = toolText ? toolText.length * 5.5 + 10 : 0;
              const totalW = Math.max(namePx + toolPx + (toolText ? 4 : 0), 32);
              return (
                <g transform="translate(14, 14)">
                  <rect
                    x={0} y={0}
                    width={totalW} height={20}
                    rx={4}
                    fill={v.color}
                    opacity={0.92}
                  />
                  <text
                    x={6} y={14}
                    fill="#fff"
                    fontSize={10}
                    fontWeight={600}
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    {first}
                  </text>
                  {toolText && (
                    <>
                      <rect
                        x={namePx} y={3}
                        width={toolPx} height={14}
                        rx={3}
                        fill="rgba(0,0,0,0.25)"
                      />
                      <text
                        x={namePx + 5} y={13}
                        fill="#fff"
                        fontSize={9}
                        fontWeight={600}
                        fontFamily="'SF Mono', Menlo, monospace"
                        letterSpacing={0.2}
                      >
                        {toolText}
                      </text>
                    </>
                  )}
                </g>
              );
            })()}
          </g>
        );
      })}
    </svg>
  );
});

PresenceCursorsOverlay.displayName = 'PresenceCursorsOverlay';

// ── Presence Avatar Pill ──────────────────────────────────────────────────

interface PresenceAvatarBarProps {
  viewers: DrawingPresenceUser[];
  isConnected: boolean;
}

const PresenceAvatarBar: React.FC<PresenceAvatarBarProps> = React.memo(({ viewers, isConnected }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const MAX_SHOWN = 5;
  const shown = viewers.slice(0, MAX_SHOWN);
  const overflow = viewers.length - MAX_SHOWN;

  if (viewers.length === 0 && isConnected) return null;

  return (
    <div style={S.presenceBar}>
      {/* Connection indicator dot */}
      <div
        style={{
          ...S.connectionDot,
          backgroundColor: isConnected ? '#4EC896' : 'rgba(255,255,255,0.25)',
        }}
        title={isConnected ? 'Real-time connected' : 'Connecting...'}
      />
      {shown.map((v) => (
        <div
          key={v.user_id}
          style={{
            ...S.presenceAvatar,
            backgroundColor: v.color,
            marginLeft: shown.indexOf(v) > 0 ? -6 : 0,
          }}
          onMouseEnter={() => setHoveredId(v.user_id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          {v.initials}
          {hoveredId === v.user_id && (
            <div style={S.presenceTooltip}>
              {v.name} — {v.tool}
            </div>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div style={S.presenceOverflow}>+{overflow}</div>
      )}
    </div>
  );
});

PresenceAvatarBar.displayName = 'PresenceAvatarBar';

// ── Annotation SVG Overlay ─────────────────────────────────────────────────

interface AnnotationSvgOverlayProps {
  annotations: AnnotationOverlayItem[];
  viewportBounds: { x: number; y: number; width: number; height: number } | null;
  containerSize: { width: number; height: number };
  imageSize: { width: number; height: number };
  selectable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}

const AnnotationSvgOverlay: React.FC<AnnotationSvgOverlayProps> = React.memo(({
  annotations,
  viewportBounds,
  containerSize,
  imageSize,
  selectable,
  selectedId,
  onSelect,
}) => {
  if (!viewportBounds || annotations.length === 0) return null;

  const pageDims = imageSize;

  // Map normalized coords to SVG pixel coords relative to the container
  const toScreen = (nx: number, ny: number) => {
    // Normalized → image pixel
    const imgX = nx * pageDims.width;
    const imgY = ny * pageDims.height;
    // Image pixel → viewport fraction
    const vpFracX = (imgX / pageDims.width - viewportBounds.x) / viewportBounds.width;
    const vpFracY = (imgY / pageDims.height - viewportBounds.y) / viewportBounds.height;
    // Viewport fraction → screen pixel
    return {
      x: vpFracX * containerSize.width,
      y: vpFracY * containerSize.height,
    };
  };

  const screenStrokeWidth = (normalizedWidth: number) => {
    const pixelWidth = denormalizeStrokeWidth(normalizedWidth, pageDims);
    const scale = containerSize.width / (viewportBounds.width * pageDims.width);
    return pixelWidth * scale;
  };

  return (
    <svg
      style={{ ...S.annotationSvg, pointerEvents: selectable ? 'auto' : 'none' }}
      viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
      xmlns="http://www.w3.org/2000/svg"
      onClick={(e) => {
        // Clicking empty canvas in select mode clears the selection.
        if (selectable && e.target === e.currentTarget) onSelect?.(null);
      }}
    >
      {annotations.map((ann) => {
        const { geometry, strokeColor, strokeWidth, fillColor, opacity, id, text } = ann;
        // Measurement types are rendered by MeasurementOverlay (rich dimension lines, area cards, counts).
        // Skip them here to avoid double-render and visual noise.
        if (ann.uiTool === 'measure' || ann.uiTool === 'area' || ann.uiTool === 'path' || ann.uiTool === 'count') {
          return null;
        }
        if (geometry.type === 'measure') return null;
        const sw = screenStrokeWidth(strokeWidth);
        const pts = geometry.points.map((p) => toScreen(p.x, p.y));
        const selected = !!(selectable && selectedId === id);

        // Wrap each annotation in a clickable group; render a halo rect behind selected items.
        const wrap = (child: React.ReactNode) => {
          if (pts.length === 0) return child;
          const minX = Math.min(...pts.map((p) => p.x));
          const minY = Math.min(...pts.map((p) => p.y));
          const maxX = Math.max(...pts.map((p) => p.x));
          const maxY = Math.max(...pts.map((p) => p.y));
          const pad = Math.max(8, sw * 2);
          return (
            <g
              key={id}
              data-ann-id={id}
              onClick={selectable ? (e) => { e.stopPropagation(); onSelect?.(id); } : undefined}
              style={{ cursor: selectable ? 'pointer' : 'default' }}
            >
              {selected && (
                <rect
                  x={minX - pad} y={minY - pad}
                  width={(maxX - minX) + pad * 2} height={(maxY - minY) + pad * 2}
                  rx={6}
                  fill="rgba(244,120,32,0.10)"
                  stroke="#F47820"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  pointerEvents="none"
                />
              )}
              {child}
            </g>
          );
        };

        switch (geometry.type) {
          case 'rect': {
            if (pts.length < 2) return null;
            const [tl, br] = pts;
            return wrap(
              <rect
                x={Math.min(tl.x, br.x)}
                y={Math.min(tl.y, br.y)}
                width={Math.abs(br.x - tl.x)}
                height={Math.abs(br.y - tl.y)}
                stroke={strokeColor}
                strokeWidth={sw}
                fill={fillColor || 'none'}
                opacity={opacity}
              />
            );
          }
          case 'line':
          case 'measure': {
            if (pts.length < 2) return null;
            return wrap(
              <line
                x1={pts[0].x}
                y1={pts[0].y}
                x2={pts[1].x}
                y2={pts[1].y}
                stroke={strokeColor}
                strokeWidth={sw}
                opacity={opacity}
              />
            );
          }
          case 'polygon':
          case 'polyline': {
            const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            return wrap(
              <path
                d={geometry.type === 'polygon' ? d + ' Z' : d}
                stroke={strokeColor}
                strokeWidth={sw}
                fill={geometry.type === 'polygon' ? (fillColor || 'rgba(255,0,0,0.1)') : 'none'}
                opacity={opacity}
              />
            );
          }
          case 'path': {
            if (geometry.pathData) {
              return wrap(
                <path
                  d={geometry.pathData}
                  stroke={strokeColor}
                  strokeWidth={sw}
                  fill="none"
                  opacity={opacity}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            }
            const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            return wrap(
              <path
                d={d}
                stroke={strokeColor}
                strokeWidth={sw}
                fill="none"
                opacity={opacity}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          }
          case 'cloud': {
            if (pts.length < 2) return null;
            const [c1, c2] = pts;
            const cloudRect = {
              x: Math.min(c1.x, c2.x),
              y: Math.min(c1.y, c2.y),
              width: Math.abs(c2.x - c1.x),
              height: Math.abs(c2.y - c1.y),
            };
            const cloudD = generateCloudPath(cloudRect);
            return wrap(
              <path
                d={cloudD}
                stroke={strokeColor}
                strokeWidth={sw}
                fill="none"
                opacity={opacity}
              />
            );
          }
          case 'text': {
            if (pts.length === 0) return null;
            return wrap(
              <text
                x={pts[0].x}
                y={pts[0].y}
                fill={strokeColor}
                fontSize={sw * 6}
                fontFamily="Arial, sans-serif"
                opacity={opacity}
              >
                {text || ''}
              </text>
            );
          }
          case 'stamp': {
            if (pts.length === 0) return null;
            return wrap(
              <g opacity={opacity} transform={`translate(${pts[0].x}, ${pts[0].y})`}>
                <rect
                  x={-60} y={-24}
                  width={120} height={48}
                  rx={4}
                  fill="rgba(255,255,255,0.92)"
                  stroke={strokeColor}
                  strokeWidth={2}
                />
                <text
                  textAnchor="middle" dominantBaseline="central"
                  fill={strokeColor}
                  fontWeight="bold"
                  fontSize={14}
                  fontFamily="Arial, sans-serif"
                >
                  {ann.stampType?.toUpperCase().replace(/_/g, ' ') || 'STAMP'}
                </text>
              </g>
            );
          }
          case 'point': {
            if (pts.length === 0) return null;
            return wrap(
              <circle
                cx={pts[0].x}
                cy={pts[0].y}
                r={Math.max(sw * 2, 4)}
                fill={strokeColor}
                opacity={opacity}
              />
            );
          }
          default:
            return null;
        }
      })}
    </svg>
  );
});

AnnotationSvgOverlay.displayName = 'AnnotationSvgOverlay';

// ── Main Component ─────────────────────────────────────────────────────────

export const DrawingTiledViewer: React.FC<DrawingTiledViewerProps> = ({
  drawing,
  drawings,
  tileBaseUrl,
  signedUrl,
  onClose,
  onNavigate,
  projectId,
  scaleRatioText,
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auth
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const userName = profile?.full_name || user?.email || 'User';
  const userInitials = userName.trim().split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  // Real-time presence
  const { viewers, updateCursor, updateTool, broadcastMarkup, isConnected } = useDrawingPresence(
    drawing.id,
    user?.id,
    userName,
    userInitials,
  );

  // Offline sync
  const { isOnline, pendingCount, enqueue: enqueueOffline } = useOfflineSync();

  const [zoom, setZoom] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [activeTool, setActiveTool] = useState<MarkupTool>('select');
  // Extended tools — not part of MarkupTool union yet, rendered as a separate
  // button row. When set, short-circuits the mouse handlers before activeTool.
  const [extendedTool, setExtendedTool] = useState<'cloud' | 'stamp' | null>(null);
  const [stampTypeSel, setStampTypeSel] = useState<StampType>('reviewed');
  const [isMarkupMode, setIsMarkupMode] = useState(false);
  const [showRFIModal, setShowRFIModal] = useState(false);
  const [rfiScreenshot, setRfiScreenshot] = useState<string | null>(null);
  // Inline text prompt — replaces the jarring window.prompt for the text tool.
  const [textPrompt, setTextPrompt] = useState<{ screen: { x: number; y: number }; norm: NormalizedPoint } | null>(null);
  // Timestamp of the most recent successful save — used to trigger a brief "Saved" confirmation pulse.
  const [saveConfirmedAt, setSaveConfirmedAt] = useState<number | null>(null);
  // Cursor position within the viewer (CSS px) — drives the precision loupe for measure/path/area/calibrate.
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  // Auto-save idle timer ref so rapid edits debounce into a single save.
  const autoSaveTimerRef = useRef<number | null>(null);
  // True when the cursor is close enough to an existing measurement endpoint that we'd snap.
  // Drives the loupe's orange pulse.
  const [snapActive, setSnapActive] = useState(false);

  // Interactive drawing state
  const [drawingInProgress, setDrawingInProgress] = useState<{
    type: GeometryType;
    startNorm: NormalizedPoint;
    currentNorm: NormalizedPoint;
    points?: NormalizedPoint[]; // for freehand paths
  } | null>(null);
  const [localAnnotations, setLocalAnnotations] = useState<AnnotationOverlayItem[]>([]);
  const undoStack = useRef<AnnotationOverlayItem[][]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const activeColor = '#E05252'; // Default red for construction markups
  // Seed from the persisted drawing.scale_ratio so a previously-calibrated
  // sheet shows real measurements on first open instead of falling through
  // to "px" output. Local state can still be updated by an in-session
  // Calibrate action; that path also writes back to the row (see below).
  const [calibrationScale, setCalibrationScale] = useState<number | null>(
    () => {
      const persisted = (drawing as { scale_ratio?: number | null }).scale_ratio;
      return typeof persisted === 'number' && persisted > 0 ? persisted : null;
    },
  );
  // When the user navigates between sheets in the same viewer instance, sync
  // the local calibration to the new sheet's persisted ratio.
  useEffect(() => {
    const persisted = (drawing as { scale_ratio?: number | null }).scale_ratio;
    setCalibrationScale(typeof persisted === 'number' && persisted > 0 ? persisted : null);
  }, [drawing.id]);
  const persistCalibration = useCallback(
    (ratio: number) => {
      setCalibrationScale(ratio);
      void drawingService.updateDrawing(drawing.id, {
        scale_ratio: ratio,
      } as unknown as Partial<typeof drawing>);
    },
    [drawing.id],
  );
  const isMeasureTool = activeTool === 'measure' || activeTool === 'area' || activeTool === 'count' || activeTool === 'calibrate' || activeTool === 'path';

  // Viewport tracking for annotation overlay
  const [viewportBounds, setViewportBounds] = useState<{
    x: number; y: number; width: number; height: number;
  } | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 4200, height: 3000 }); // sensible ARCH E default

  // Navigation
  const currentIdx = useMemo(
    () => drawings.findIndex((d) => d.id === drawing.id),
    [drawings, drawing.id],
  );
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < drawings.length - 1 && currentIdx >= 0;
  const posLabel = currentIdx >= 0 ? `${currentIdx + 1} / ${drawings.length}` : '';

  // Load markups from DB
  const { data: dbMarkups } = useDrawingMarkups(drawing.id, projectId);
  const createMarkup = useCreateDrawingMarkup();
  const deleteMarkup = useDeleteDrawingMarkup();
  // Currently selected annotation (id). Click on a markup while in select tool to highlight it.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Convert DB markups to annotation overlay items.
  // Reads from top-level columns first (new schema) and falls back to the `data` jsonb blob
  // (which we write into when schema-enhancement migrations aren't applied).
  const annotations: AnnotationOverlayItem[] = useMemo(() => {
    if (!dbMarkups || !showAnnotations) return [];
    return dbMarkups
      .map((row: Record<string, unknown>) => {
        const d = (row.data && typeof row.data === 'object' ? row.data : {}) as Record<string, unknown>;
        const geometry = (row.normalized_coords as NormalizedGeometry | undefined)
          ?? (d.normalized_coords as NormalizedGeometry | undefined);
        if (!geometry) return null;
        return {
          id: row.id as string,
          geometry,
          layer: ((row.layer as AnnotationLayer | undefined) ?? (d.layer as AnnotationLayer | undefined) ?? 'default') as AnnotationLayer,
          visibility: ((row.visibility as AnnotationVisibility | undefined) ?? (d.visibility as AnnotationVisibility | undefined) ?? 'team') as AnnotationVisibility,
          strokeColor: (row.color as string | undefined) || (d.color as string | undefined) || '#E05252',
          strokeWidth: (d.strokeWidth as number | undefined) ?? 0.002,
          fillColor: d.fillColor as string | undefined,
          opacity: (d.opacity as number | undefined) ?? 0.85,
          text: (row.content as string | undefined) ?? (d.text as string | undefined),
          stampType: (row.stamp_type as string | undefined) ?? (d.stampType as string | undefined),
          uiTool: d.uiType as MarkupTool | undefined,
        };
      })
      .filter((a): a is AnnotationOverlayItem => !!a);
  }, [dbMarkups, showAnnotations]);

  // ── Tile source — DZI when tiled, simple image when not ────────────────
  const osdTileSource = useMemo((): string | Record<string, unknown> | null => {
    // Priority 1: Pre-generated deep-zoom tiles
    if (drawing.tile_status === 'ready') {
      const base = tileBaseUrl || '/storage/v1/object/public/drawing-tiles';
      return `${base}/${drawing.id}/tile.dzi`;
    }
    // Priority 2: Signed URL → OpenSeadragon simple image source
    if (signedUrl) {
      return { type: 'image', url: signedUrl };
    }
    return null;
  }, [drawing.id, drawing.tile_status, tileBaseUrl, signedUrl]);

  // ── Initialize OpenSeadragon ───────────────────────────────────────────
  useEffect(() => {
    if (!osdTileSource) return;

    const viewer = new OpenSeadragon.Viewer({
      id: VIEWER_ID,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tileSources: osdTileSource as any,
      prefixUrl: '', // We use custom controls
      showNavigationControl: false,
      showNavigator: true,
      navigatorPosition: 'ABSOLUTE',
      navigatorAutoFade: true,
      gestureSettingsMouse: {
        clickToZoom: false,
        dblClickToZoom: true,
        scrollToZoom: true,
        flickEnabled: true,
      },
      gestureSettingsTouch: {
        pinchToZoom: true,
        flickEnabled: true,
        flickMinSpeed: 120,
        flickMomentum: 0.25,
        dblClickToZoom: true,
      },
      maxZoomPixelRatio: 4,
      minZoomImageRatio: 0.8,
      visibilityRatio: 0.5,
      constrainDuringPan: false,
      animationTime: 0.35,
      springStiffness: 12,
      immediateRender: false,
      crossOriginPolicy: 'Anonymous',
      debugMode: false,
    });

    viewerRef.current = viewer;

    // Disable OSD's built-in keyboard shortcuts — we handle all keys ourselves at the window level.
    // Otherwise OSD swallows Esc (and some other keys) when the viewer container has focus.
    try {
      const tracker = (viewer as unknown as { innerTracker?: { keyHandler?: unknown; keyDownHandler?: unknown; keyPressHandler?: unknown } }).innerTracker;
      if (tracker) {
        tracker.keyHandler = null;
        tracker.keyDownHandler = null;
        tracker.keyPressHandler = null;
      }
    } catch { /* not a fatal if OSD internals change — our window handler still runs in capture phase */ }

    // Track zoom changes
    viewer.addHandler('zoom', () => {
      setZoom(viewer.viewport.getZoom());
    });

    // Track viewport for annotation overlay
    const updateViewport = () => {
      const bounds = viewer.viewport.getBounds();
      setViewportBounds({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      });
    };

    // Update viewportBounds whenever the viewport changes so annotations stay pinned
     // to their image coordinates across pan/zoom/momentum. OSD's individual events only
     // fire at specific moments; `update-viewport` fires every internal render tick.
    viewer.addHandler('animation', updateViewport);
    viewer.addHandler('animation-finish', updateViewport);
    viewer.addHandler('pan', updateViewport);
    viewer.addHandler('zoom', updateViewport);
    viewer.addHandler('update-viewport', updateViewport);
    viewer.addHandler('resize', updateViewport);

    // On open, capture image dimensions
    viewer.addHandler('open', () => {
      setIsLoaded(true);
      const tiledImage = viewer.world.getItemAt(0);
      if (tiledImage) {
        const size = tiledImage.getContentSize();
        setImageSize({ width: size.x, height: size.y });
      }
      updateViewport();
    });

    viewer.addHandler('open-failed', () => {
      setIsLoaded(true); // Show error state
    });

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [osdTileSource]);

  // Track container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Screen ↔ normalized coordinate conversion ──────────────────────────
  const screenToNormalized = useCallback(
    (screenX: number, screenY: number): NormalizedPoint | null => {
      if (!viewportBounds || containerSize.width === 0) return null;
      // Screen pixel → viewport fraction
      const vpFracX = screenX / containerSize.width;
      const vpFracY = screenY / containerSize.height;
      // Viewport fraction → image normalized [0,1]
      const normX = viewportBounds.x + vpFracX * viewportBounds.width;
      const normY = viewportBounds.y + vpFracY * viewportBounds.height;
      // Clamp to [0,1]
      return {
        x: Math.max(0, Math.min(1, normX)),
        y: Math.max(0, Math.min(1, normY)),
      };
    },
    [viewportBounds, containerSize],
  );

  // Map MarkupTool → GeometryType.
  // Highlight is a freehand path like draw, just styled as a wide translucent band.
  const toolToGeometry = (tool: MarkupTool): GeometryType | null => {
    switch (tool) {
      case 'draw': return 'path';
      case 'highlight': return 'path';
      case 'pin': return 'point';
      case 'text': return 'text';
      case 'measure': return 'line';
      case 'area': return 'polygon';
      default: return null;
    }
  };

  // ── Disable OSD mouse nav when any tool is active ────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    // `isMarkupMode` gates the draw/highlight/pin/text freehand SVG overlay specifically.
    // Measurement tools have their own overlay, so we keep isMarkupMode false for those.
    const extActive = extendedTool !== null;
    setIsMarkupMode((activeTool !== 'select' && !isMeasureTool) || extActive);
    viewer.setMouseNavEnabled(activeTool === 'select' && !extActive);
    updateTool(activeTool);
  }, [activeTool, isMeasureTool, updateTool, extendedTool]);

  // Toolbar is shown whenever the user is actively working — either a tool is selected
  // OR there are unsaved markups waiting to go to the DB.
  const isToolbarVisible = activeTool !== 'select' || localAnnotations.length > 0 || extendedTool !== null;

  // Real-world span covered by the loupe's viewing window — rendered as a calibrated scale bar.
  const loupeScaleLabel = useMemo(() => {
    if (!viewportBounds || containerSize.width === 0) return null;
    const LOUPE_SIZE = 108;
    const LOUPE_MAG = 2.5;
    const loupeCssWidth = LOUPE_SIZE / LOUPE_MAG; // CSS px of source content under the loupe
    const normUnits = loupeCssWidth * (viewportBounds.width / containerSize.width);
    const imagePx = normUnits * imageSize.width;
    let realIn: number | null = null;
    if (calibrationScale && calibrationScale > 0) {
      realIn = imagePx * calibrationScale;
    } else {
      const parsed = parseScaleRatio(scaleRatioText);
      if (parsed) realIn = (imagePx / 150) * parsed.realPerPaper;
    }
    if (realIn === null || !isFinite(realIn)) return null;
    // Loupe shows a chunk of the sheet; scale bar covers 40% of it.
    return formatFeetInches(realIn * 0.4);
  }, [viewportBounds, containerSize.width, imageSize.width, calibrationScale, scaleRatioText]);

  // Selection is only meaningful in the select tool — any other tool clears it.
  useEffect(() => {
    if (activeTool !== 'select') setSelectedId(null);
  }, [activeTool]);

  // Delete/remove the selected annotation. Handles both persisted (DB) and local unsaved items.
  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    const isLocal = localAnnotations.some((a) => a.id === selectedId);
    if (isLocal) {
      undoStack.current.push([...localAnnotations]);
      setLocalAnnotations((prev) => prev.filter((a) => a.id !== selectedId));
    } else {
      // Persisted — delete from DB; react-query invalidation will refresh the list.
      deleteMarkup.mutate({ id: selectedId, drawingId: drawing.id });
    }
    setSelectedId(null);
  }, [selectedId, localAnnotations, deleteMarkup, drawing.id]);

  // ── First-use tool hints: flash a coach mark once per tool per browser session ──
  const [hintTool, setHintTool] = useState<MarkupTool | null>(null);
  useEffect(() => {
    if (activeTool === 'select') { setHintTool(null); return; }
    try {
      const key = 'sitesync.tiledViewer.hinted';
      const raw = sessionStorage.getItem(key);
      const seen: Record<string, true> = raw ? JSON.parse(raw) : {};
      if (!seen[activeTool]) {
        seen[activeTool] = true;
        sessionStorage.setItem(key, JSON.stringify(seen));
        setHintTool(activeTool);
      } else {
        setHintTool(null);
      }
    } catch {
      setHintTool(activeTool);
    }
  }, [activeTool]);

  // ── Auto-save: debounce saves after 1.5s of inactivity ────────────────
  // Using a ref-held timer avoids recreating the timeout identity every render.
  // We intentionally don't include `handleSave` in deps to avoid re-debouncing on every render
  // (React-Query's mutate identity is stable enough for this purpose).
  useEffect(() => {
    if (localAnnotations.length === 0) return;
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      handleSave();
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localAnnotations]);

  // ── Interactive drawing event handlers ─────────────────────────────────
  const handleOverlayMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // Extended tools (cloud / stamp) take priority — they render their own
      // buttons outside the MarkupToolbar but share the same overlay handlers.
      if (extendedTool === 'stamp') {
        const rect = e.currentTarget.getBoundingClientRect();
        const pt = screenToNormalized(e.clientX - rect.left, e.clientY - rect.top);
        if (!pt) return;
        const stampColor = STAMP_CONFIGS[stampTypeSel]?.color ?? '#1565C0';
        const newAnn: AnnotationOverlayItem = {
          id: genId(),
          geometry: { type: 'stamp', points: [pt] },
          layer: 'default',
          visibility: 'team',
          strokeColor: stampColor,
          strokeWidth: 0.002,
          opacity: 1,
          uiTool: 'stamp' as unknown as MarkupTool,
          stampType: stampTypeSel,
        };
        undoStack.current.push([...localAnnotations]);
        setLocalAnnotations((prev) => [...prev, newAnn]);
        return;
      }

      if (extendedTool === 'cloud') {
        const rect = e.currentTarget.getBoundingClientRect();
        const pt = screenToNormalized(e.clientX - rect.left, e.clientY - rect.top);
        if (!pt) return;
        setDrawingInProgress({
          type: 'cloud',
          startNorm: pt,
          currentNorm: pt,
        });
        return;
      }

      if (activeTool === 'select' || activeTool === 'calibrate') return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pt = screenToNormalized(e.clientX - rect.left, e.clientY - rect.top);
      if (!pt) return;

      const geomType = toolToGeometry(activeTool);
      if (!geomType) return;

      if (geomType === 'point') {
        // Single-click tools: pin, stamp
        const newAnn: AnnotationOverlayItem = {
          id: genId(),
          geometry: { type: 'point', points: [pt] },
          layer: 'default',
          visibility: 'team',
          strokeColor: activeColor,
          strokeWidth: 0.002,
          opacity: 0.85,
          uiTool: activeTool,
        };
        undoStack.current.push([...localAnnotations]);
        setLocalAnnotations((prev) => [...prev, newAnn]);
        return;
      }

      if (geomType === 'text') {
        // Open an inline input at the click location — no native dialog.
        setTextPrompt({
          screen: { x: e.clientX - rect.left, y: e.clientY - rect.top },
          norm: pt,
        });
        return;
      }

      setDrawingInProgress({
        type: geomType,
        startNorm: pt,
        currentNorm: pt,
        points: geomType === 'path' ? [pt] : undefined,
      });
    },
    [activeTool, screenToNormalized, localAnnotations, activeColor, extendedTool, stampTypeSel],
  );

  const handleOverlayMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!drawingInProgress) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pt = screenToNormalized(e.clientX - rect.left, e.clientY - rect.top);
      if (!pt) return;

      setDrawingInProgress((prev) => {
        if (!prev) return null;
        if (prev.type === 'path' && prev.points) {
          return { ...prev, currentNorm: pt, points: [...prev.points, pt] };
        }
        return { ...prev, currentNorm: pt };
      });
    },
    [drawingInProgress, screenToNormalized],
  );

  const handleOverlayMouseUp = useCallback(
    () => {
      if (!drawingInProgress) return;
      const { type, startNorm, currentNorm, points } = drawingInProgress;

      // Minimum drag threshold (normalized space)
      const dx = Math.abs(currentNorm.x - startNorm.x);
      const dy = Math.abs(currentNorm.y - startNorm.y);
      if (type !== 'path' && dx < 0.005 && dy < 0.005) {
        setDrawingInProgress(null);
        return;
      }

      // Highlight is a thick, translucent pass; draw is a crisp pen stroke.
      const isHighlight = activeTool === 'highlight';
      const newAnn: AnnotationOverlayItem = {
        id: genId(),
        geometry: {
          type,
          points: type === 'path'
            ? (points || [startNorm, currentNorm])
            : [startNorm, currentNorm],
        },
        layer: 'default',
        visibility: 'team',
        strokeColor: isHighlight ? '#FFD23F' : activeColor, // highlighter yellow
        strokeWidth: isHighlight ? 0.014 : 0.002,
        fillColor: type === 'rect' ? 'rgba(224,82,82,0.08)' : undefined,
        opacity: isHighlight ? 0.35 : 0.9,
        uiTool: activeTool,
      };

      undoStack.current.push([...localAnnotations]);
      setLocalAnnotations((prev) => [...prev, newAnn]);
      setDrawingInProgress(null);
    },
    [drawingInProgress, localAnnotations, activeColor, activeTool],
  );

  // ── Undo ───────────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (prev) setLocalAnnotations(prev);
  }, []);

  // ── Commit the inline text prompt into a persisted annotation ─────────
  const commitTextPrompt = useCallback((value: string) => {
    const prompt = textPrompt;
    if (!prompt) return;
    const trimmed = value.trim();
    if (trimmed) {
      const newAnn: AnnotationOverlayItem = {
        id: genId(),
        geometry: { type: 'text', points: [prompt.norm] },
        layer: 'default',
        visibility: 'team',
        strokeColor: activeColor,
        strokeWidth: 0.003,
        opacity: 1,
        text: trimmed,
        uiTool: 'text',
      };
      undoStack.current.push([...localAnnotations]);
      setLocalAnnotations((prev) => [...prev, newAnn]);
    }
    setTextPrompt(null);
  }, [textPrompt, activeColor, localAnnotations]);

  // ── Persist measurements produced by the MeasurementOverlay ────────────
  // Converts a MeasurementResult into an AnnotationOverlayItem and queues it for save.
  const handleMeasurementAdd = useCallback((m: MeasurementResult) => {
    const geometry: NormalizedGeometry =
      m.type === 'linear'
        ? { type: 'measure', points: m.points }
        : m.type === 'area'
          ? { type: 'polygon', points: m.points }
          : m.type === 'path'
            ? { type: 'path', points: m.points }
            : { type: 'point', points: m.points };
    const ann: AnnotationOverlayItem = {
      id: m.id,
      geometry,
      layer: 'default',
      visibility: 'team',
      strokeColor: activeColor,
      strokeWidth: 0.002,
      fillColor: m.type === 'area' ? 'rgba(244,120,32,0.12)' : undefined,
      opacity: 0.9,
      // Pack both primary and sublabel into content so renderer can surface the reading on reload.
      text: m.sublabel ? `${m.label} · ${m.sublabel}` : m.label,
      uiTool: m.type === 'linear' ? 'measure'
        : m.type === 'area' ? 'area'
        : m.type === 'path' ? 'path'
        : 'count',
    };
    undoStack.current.push([...localAnnotations]);
    setLocalAnnotations((prev) => [...prev, ann]);
  }, [activeColor, localAnnotations]);

  // Map a geometry type to a legacy `type` value that passes the DB CHECK constraint
  // (columns: 'pen' | 'highlighter' | 'text' | 'shape' | 'dimension' | 'cloudmark' | 'pin').
  const legacyTypeFor = (g: NormalizedGeometry['type']): string => {
    switch (g) {
      case 'point': return 'pin';
      case 'path': return 'pen';
      case 'line':
      case 'measure': return 'dimension';
      case 'rect':
      case 'polygon':
      case 'polyline': return 'shape';
      case 'cloud': return 'cloudmark';
      case 'text': return 'text';
      case 'stamp': return 'shape';
      default: return 'shape';
    }
  };

  // ── Save markups to DB ─────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!projectId || !drawing.id || localAnnotations.length === 0) return;
    setIsSaving(true);
    const failedAnnotations: AnnotationOverlayItem[] = [];
    let succeeded = 0;
    try {
      for (const ann of localAnnotations) {
        // Payload satisfies the base-schema CHECK on `type`, preserves the full UI-type in
        // `annotation_type`, includes OSD-specific normalized coords, and packs a `data`
        // blob so shapes round-trip through the canvas-based viewer too.
        // Only write columns guaranteed by the base 00019 schema (drawing_id, project_id,
        // type, data). Everything else — OSD-specific normalized coords, the full UI tool,
        // styling — is packed into the `data` jsonb blob so saves work regardless of which
        // schema-enhancement migrations are applied to the user's DB.
        const baseData = {
          project_id: projectId,
          drawing_id: drawing.id,
          type: legacyTypeFor(ann.geometry.type),
          data: {
            uiType: ann.uiTool ?? ann.geometry.type,
            geometry_type: ann.geometry.type,
            normalized_coords: ann.geometry,
            color: ann.strokeColor,
            strokeWidth: ann.strokeWidth,
            fillColor: ann.fillColor,
            opacity: ann.opacity,
            text: ann.text,
            page_number: 1,
            layer: ann.layer,
            visibility: ann.visibility,
            stampType: ann.stampType,
          },
        };

        try {
          if (isOnline) {
            // Await each save so we know which specific annotations failed.
            await createMarkup.mutateAsync({ data: baseData, drawingId: drawing.id });
            broadcastMarkup(baseData);
          } else {
            await enqueueOffline({
              project_id: projectId,
              drawing_id: drawing.id,
              page_number: 1,
              annotation_type: baseData.annotation_type,
              geometry_type: ann.geometry.type,
              normalized_coords: ann.geometry,
              color: ann.strokeColor,
              content: ann.text || null,
              layer: ann.layer,
              visibility: ann.visibility,
            });
          }
          succeeded++;
        } catch {
          // Keep the failing annotation around so the user can retry. Quiet mutation
          // handler already reports the error; we surface a human-readable summary below.
          failedAnnotations.push(ann);
        }
      }
      // Drop successful ones from local state; keep failed ones so retry just means clicking Save again.
      setLocalAnnotations(failedAnnotations);
      undoStack.current = [];
      if (failedAnnotations.length === 0) {
        setSaveConfirmedAt(Date.now());
        window.setTimeout(() => setSaveConfirmedAt(null), 2200);
      } else {
        toast.error(
          `${failedAnnotations.length} markup${failedAnnotations.length === 1 ? '' : 's'} failed to save`,
          { description: succeeded > 0 ? `${succeeded} saved successfully — retry the rest with Save.` : 'Check drawing_markups RLS policy in Supabase.' },
        );
      }
    } finally {
      setIsSaving(false);
    }
  }, [projectId, drawing.id, localAnnotations, createMarkup, isOnline, enqueueOffline, broadcastMarkup]);

  // Combine DB annotations + local unsaved annotations
  const allAnnotations = useMemo(
    () => [...annotations, ...localAnnotations],
    [annotations, localAnnotations],
  );

  // All endpoints from existing measurement-like annotations — used for magnetic snap.
  // We only offer snap for geometries where endpoints are semantically meaningful.
  const snapPoints = useMemo(() => {
    const pts: NormalizedPoint[] = [];
    for (const a of allAnnotations) {
      const t = a.geometry.type;
      if (t === 'measure' || t === 'line' || t === 'path' || t === 'polygon' || t === 'polyline') {
        for (const p of a.geometry.points) pts.push(p);
      }
    }
    return pts;
  }, [allAnnotations]);

  // Convert all measurement-type annotations (fresh + DB-loaded) into MeasurementResult shape
  // so MeasurementOverlay can render them with its rich ArchDimensionLine / AreaCard / CountMarker styling.
  const externalMeasurements: MeasurementResult[] = useMemo(() => {
    const out: MeasurementResult[] = [];
    for (const a of allAnnotations) {
      const tool = a.uiTool;
      const text = a.text ?? '';
      // Split label / sublabel if the saved text packed both (e.g. "240 ft² · 62 ft perim").
      const [label, sublabel] = text.includes(' · ') ? text.split(' · ') : [text, undefined];
      if (tool === 'measure' && a.geometry.points.length >= 2) {
        out.push({ id: a.id, type: 'linear', points: a.geometry.points, label, sublabel });
      } else if (tool === 'area' && a.geometry.points.length >= 3) {
        out.push({ id: a.id, type: 'area', points: a.geometry.points, label, sublabel });
      } else if (tool === 'path' && a.geometry.points.length >= 2) {
        out.push({ id: a.id, type: 'path', points: a.geometry.points, label, sublabel });
      } else if (tool === 'count' && a.geometry.points.length >= 1) {
        out.push({ id: a.id, type: 'count', points: a.geometry.points, label: label || '1' });
      }
    }
    return out;
  }, [allAnnotations]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const viewer = viewerRef.current;
      if (!viewer) return;

      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          viewer.viewport.zoomBy(1.4);
          break;
        case '-':
          e.preventDefault();
          viewer.viewport.zoomBy(0.7);
          break;
        case '0':
          e.preventDefault();
          viewer.viewport.goHome();
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          // One key, one action — always step back one level.
          // If actively drawing: cancel the in-progress stroke.
          // Else if a tool is selected: return to select.
          // Else: close the viewer.
          if (drawingInProgress) {
            setDrawingInProgress(null);
          } else if (extendedTool !== null) {
            setExtendedTool(null);
          } else if (activeTool !== 'select') {
            setActiveTool('select');
            setSelectedId(null);
          } else {
            onClose();
          }
          break;
        case 'z':
          if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
            e.preventDefault();
            handleUndo();
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedId) {
            e.preventDefault();
            handleDeleteSelected();
          }
          break;
        case 'ArrowLeft':
          if (hasPrev) {
            e.preventDefault();
            onNavigate(drawings[currentIdx - 1]);
          }
          break;
        case 'ArrowRight':
          if (hasNext) {
            e.preventDefault();
            onNavigate(drawings[currentIdx + 1]);
          }
          break;
        case 'r':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            const newRotation = (rotation + 90) % 360;
            setRotation(newRotation);
            viewer.viewport.setRotation(newRotation);
          }
          break;
        default: {
          // Tool hotkeys — match common design-tool conventions.
          // Ignore when the user is typing in an input (avoids grabbing letters).
          const target = e.target as HTMLElement | null;
          if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) break;
          if (e.metaKey || e.ctrlKey || e.altKey) break;
          const toolKey: Record<string, MarkupTool> = {
            v: 'select',
            p: 'pin',
            t: 'text',
            h: 'highlight',
            d: 'draw',
            m: 'measure',
            a: 'area',
            c: 'count',
            g: 'path',
            k: 'calibrate',
          };
          const next = toolKey[e.key.toLowerCase()];
          if (next) {
            e.preventDefault();
            setActiveTool(next);
          } else if (e.key.toLowerCase() === 's' && localAnnotations.length > 0) {
            e.preventDefault();
            handleSave();
          }
          break;
        }
      }
    };

    // Capture phase so Escape fires before OSD or any other component can swallow it.
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onClose, hasPrev, hasNext, currentIdx, drawings, onNavigate, rotation, drawingInProgress, activeTool, extendedTool, handleUndo, handleSave, localAnnotations.length, selectedId, handleDeleteSelected]);

  // ── Control handlers ───────────────────────────────────────────────────
  const handleZoomIn = useCallback(() => {
    viewerRef.current?.viewport.zoomBy(1.5);
  }, []);

  const handleZoomOut = useCallback(() => {
    viewerRef.current?.viewport.zoomBy(0.67);
  }, []);

  const handleHome = useCallback(() => {
    viewerRef.current?.viewport.goHome();
  }, []);

  const handleRotate = useCallback(() => {
    const newRotation = (rotation + 90) % 360;
    setRotation(newRotation);
    viewerRef.current?.viewport.setRotation(newRotation);
  }, [rotation]);

  // Create-RFI — compose the OSD canvas + annotation overlay into a screenshot and open the modal.
  const handleCreateRFI = useCallback(() => {
    const openModal = (screenshot: string | null) => {
      setRfiScreenshot(screenshot);
      setShowRFIModal(true);
    };
    try {
      const viewer = viewerRef.current as unknown as { drawer?: { canvas?: HTMLCanvasElement } } | null;
      const osdCanvas = viewer?.drawer?.canvas;
      if (!osdCanvas) { openModal(null); return; }
      const w = osdCanvas.width;
      const h = osdCanvas.height;
      const out = document.createElement('canvas');
      out.width = w; out.height = h;
      const ctx = out.getContext('2d');
      if (!ctx) { openModal(null); return; }
      try { ctx.drawImage(osdCanvas, 0, 0, w, h); } catch { /* tainted — skip */ }
      // Compose the SVG annotation layer so pins/highlights appear in the screenshot.
      const svg = containerRef.current?.querySelector('svg');
      if (svg) {
        const xml = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          try { ctx.drawImage(img, 0, 0, w, h); } catch { /* ignore */ }
          URL.revokeObjectURL(url);
          try { openModal(out.toDataURL('image/png')); } catch { openModal(null); }
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          try { openModal(out.toDataURL('image/png')); } catch { openModal(null); }
        };
        img.src = url;
        return;
      }
      try { openModal(out.toDataURL('image/png')); } catch { openModal(null); }
    } catch {
      openModal(null);
    }
  }, []);

  const handlePrev = useCallback(() => {
    if (hasPrev) onNavigate(drawings[currentIdx - 1]);
  }, [hasPrev, currentIdx, drawings, onNavigate]);

  const handleNext = useCallback(() => {
    if (hasNext) onNavigate(drawings[currentIdx + 1]);
  }, [hasNext, currentIdx, drawings, onNavigate]);

  const zoomPercent = `${Math.round(zoom * 100)}%`;

  // ── If no source is available yet (URL still loading), show loading state ──
  const isSourceReady = osdTileSource !== null;

  return (
    <div style={S.wrapper}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <span style={{ ...S.badge, backgroundColor: 'rgba(244,120,32,0.12)', color: 'rgba(244,120,32,0.85)', fontWeight: 600 }}>
            {drawing.setNumber}
          </span>
          <span style={S.title}>
            {drawing.title}
          </span>
          <span style={S.badge}>Rev {drawing.revision}</span>
        </div>

        {drawings.length > 1 && (
          <div style={S.headerCenter}>
            <button
              style={{ ...S.controlBtn, opacity: hasPrev ? 1 : 0.3 }}
              onClick={handlePrev}
              disabled={!hasPrev}
              title="Previous sheet (←)"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={S.posLabel}>{posLabel}</span>
            <button
              style={{ ...S.controlBtn, opacity: hasNext ? 1 : 0.3 }}
              onClick={handleNext}
              disabled={!hasNext}
              title="Next sheet (→)"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        <div style={S.headerRight}>
          {/* Presence avatar pills */}
          <PresenceAvatarBar viewers={viewers} isConnected={isConnected} />

          <button
            style={{
              ...S.controlBtn,
              backgroundColor: isMarkupMode ? 'rgba(244,120,32,0.2)' : 'transparent',
              color: isMarkupMode ? colors.primaryOrange : 'rgba(255,255,255,0.7)',
            }}
            onClick={() => {
              if (isMarkupMode) {
                setActiveTool('select');
              } else {
                setActiveTool('draw');
              }
            }}
            title={isMarkupMode ? 'Exit markup mode' : 'Enter markup mode'}
          >
            <Pencil size={16} />
          </button>
          <button
            style={{
              ...S.controlBtn,
              backgroundColor: showAnnotations ? 'rgba(244,120,32,0.15)' : 'transparent',
              color: showAnnotations ? colors.primaryOrange : 'rgba(255,255,255,0.7)',
            }}
            onClick={() => setShowAnnotations(!showAnnotations)}
            title="Toggle annotations"
          >
            <Layers size={16} />
          </button>
          <button
            style={S.controlBtn}
            onClick={handleRotate}
            title="Rotate 90° (R)"
          >
            <RotateCw size={16} />
          </button>
          <button
            style={S.controlBtn}
            onClick={handleCreateRFI}
            title="Create RFI from current view"
          >
            <MessageSquarePlus size={16} />
          </button>
          <button
            style={S.controlBtn}
            onClick={onClose}
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Viewer area ────────────────────────────────────────────── */}
      <div
        style={S.viewerArea}
        ref={containerRef}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          setCursorPos({ x: sx, y: sy });
          // Broadcast our cursor position to other viewers
          const norm = screenToNormalized(sx, sy);
          updateCursor(norm);
        }}
        onMouseLeave={() => { updateCursor(null); setCursorPos(null); }}
      >
        {/* OpenSeadragon container */}
        <div id={VIEWER_ID} style={S.osdContainer} />

        {/* Annotation SVG overlay — click-selectable only in the select tool so
             other tools aren't interfered with. */}
        {showAnnotations && (
          <AnnotationSvgOverlay
            annotations={allAnnotations}
            viewportBounds={viewportBounds}
            containerSize={containerSize}
            imageSize={imageSize}
            selectable={activeTool === 'select'}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        )}

        {/* Live presence cursors from other viewers */}
        <PresenceCursorsOverlay
          viewers={viewers}
          viewportBounds={viewportBounds}
          containerSize={containerSize}
        />

        {/* Interactive drawing SVG overlay — captures mouse events for annotation tools */}
        {isMarkupMode && (
          <svg
            style={{
              ...S.annotationSvg,
              pointerEvents: 'all',
              cursor: toolCursor(activeTool),
              zIndex: 3,
            }}
            viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
            onMouseDown={handleOverlayMouseDown}
            onMouseMove={handleOverlayMouseMove}
            onMouseUp={handleOverlayMouseUp}
            onMouseLeave={handleOverlayMouseUp}
          >
            {/* In-progress shape preview */}
            {drawingInProgress && viewportBounds && (() => {
              const { type, startNorm, currentNorm, points } = drawingInProgress;
              const toScreen = (nx: number, ny: number) => {
                const vpFracX = (nx - viewportBounds.x) / viewportBounds.width;
                const vpFracY = (ny - viewportBounds.y) / viewportBounds.height;
                return { x: vpFracX * containerSize.width, y: vpFracY * containerSize.height };
              };
              const s = toScreen(startNorm.x, startNorm.y);
              const c = toScreen(currentNorm.x, currentNorm.y);

              if (type === 'rect') {
                return (
                  <rect
                    x={Math.min(s.x, c.x)} y={Math.min(s.y, c.y)}
                    width={Math.abs(c.x - s.x)} height={Math.abs(c.y - s.y)}
                    stroke={activeColor} strokeWidth={2} strokeDasharray="6 3"
                    fill="rgba(224,82,82,0.06)" opacity={0.8}
                  />
                );
              }
              if (type === 'line') {
                return (
                  <line
                    x1={s.x} y1={s.y} x2={c.x} y2={c.y}
                    stroke={activeColor} strokeWidth={2} strokeDasharray="6 3" opacity={0.8}
                  />
                );
              }
              if (type === 'path' && points) {
                const d = points.map((p, i) => {
                  const sp = toScreen(p.x, p.y);
                  return `${i === 0 ? 'M' : 'L'} ${sp.x} ${sp.y}`;
                }).join(' ');
                return (
                  <path
                    d={d} stroke={activeColor} strokeWidth={2}
                    fill="none" opacity={0.8} strokeLinecap="round" strokeLinejoin="round"
                  />
                );
              }
              return null;
            })()}
          </svg>
        )}

        {/* Measurement overlay — always mounted so completed measurements stay visible
             across tool switches. Clicks only register when a measure tool is active. */}
        <MeasurementOverlay
          activeTool={activeTool}
          imageSize={imageSize}
          containerSize={containerSize}
          viewportBounds={viewportBounds}
          scaleRatioText={scaleRatioText}
          calibrationScale={calibrationScale}
          onCalibrate={persistCalibration}
          onMeasurementAdd={handleMeasurementAdd}
          cursor={toolCursor(activeTool)}
          snapPoints={snapPoints}
          onSnapStateChange={setSnapActive}
          externalMeasurements={externalMeasurements}
        />

        {/* Loading indicator */}
        {(!isLoaded || !isSourceReady) && (
          <div style={S.loadingOverlay}>
            <div style={S.spinner} />
            {!isSourceReady && (
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 12 }}>Loading drawing...</p>
            )}
          </div>
        )}

        {/* Previous/Next nav arrows */}
        {hasPrev && (
          <button
            style={{ ...S.navBtn, left: 12 }}
            onClick={handlePrev}
            title="Previous sheet"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {hasNext && (
          <button
            style={{ ...S.navBtn, right: 180 }}
            onClick={handleNext}
            title="Next sheet"
          >
            <ChevronRight size={20} />
          </button>
        )}

        {/* Minimap navigator */}
        {!isMobile && (
          <div id={NAVIGATOR_ID} style={S.navigatorContainer} />
        )}

        {/* Markup toolbar — visible whenever any tool is active or there are unsaved markups */}
        {isToolbarVisible && (
          <div style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}>
            <MarkupToolbar
              activeTool={activeTool}
              onToolChange={(t) => { setExtendedTool(null); setActiveTool(t); }}
              onUndo={handleUndo}
              canUndo={undoStack.current.length > 0 || localAnnotations.length > 0}
              canSave={localAnnotations.length > 0}
              unsavedCount={localAnnotations.length}
              onSave={handleSave}
              isSaving={isSaving}
              onCreateRFI={handleCreateRFI}
            />
            {/* Cloud + Stamp extended tool row. Not part of MarkupToolbar's
                MarkupTool union yet — rendered here so the DB-backed 'cloud' /
                'stamp' geometry types that the SVG overlay already renders are
                also creatable from the UI. */}
            <div style={{
              display: 'flex',
              gap: 6,
              padding: '6px 10px',
              borderRadius: borderRadius.full,
              backgroundColor: 'rgba(20,20,20,0.85)',
              color: '#fff',
              fontSize: 12,
              alignItems: 'center',
              boxShadow: shadows.lg,
            }}>
              <button
                type="button"
                onClick={() => {
                  setActiveTool('select');
                  setExtendedTool((t) => (t === 'cloud' ? null : 'cloud'));
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: borderRadius.full,
                  border: 'none',
                  background: extendedTool === 'cloud' ? colors.primaryOrange : 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: typography.fontFamily,
                  fontSize: 12,
                  fontWeight: 600,
                }}
                title="Revision cloud — drag a rectangle to scallop its edges"
              >
                Cloud
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTool('select');
                  setExtendedTool((t) => (t === 'stamp' ? null : 'stamp'));
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: borderRadius.full,
                  border: 'none',
                  background: extendedTool === 'stamp' ? colors.primaryOrange : 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: typography.fontFamily,
                  fontSize: 12,
                  fontWeight: 600,
                }}
                title="Place an approval stamp — click on the drawing"
              >
                Stamp
              </button>
              {extendedTool === 'stamp' && (
                <select
                  value={stampTypeSel}
                  onChange={(e) => setStampTypeSel(e.target.value as StampType)}
                  aria-label="Stamp type"
                  style={{
                    padding: '4px 8px',
                    borderRadius: borderRadius.base,
                    border: `1px solid ${colors.borderSubtle}`,
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    color: colors.textPrimary,
                    fontSize: 11,
                    fontFamily: typography.fontFamily,
                  }}
                >
                  {(Object.keys(STAMP_CONFIGS) as StampType[]).map((key) => (
                    <option key={key} value={key}>{STAMP_CONFIGS[key].label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Save success confirmation — fades out automatically. */}
        {saveConfirmedAt && (
          <div key={saveConfirmedAt} style={{
            position: 'absolute',
            top: 64,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 14px',
            backgroundColor: 'rgba(78,200,150,0.95)',
            borderRadius: borderRadius.full,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            zIndex: 7,
            animation: 'fadeSlideOut 2s ease-in-out forwards',
            boxShadow: '0 6px 20px rgba(78,200,150,0.35)',
          }}>
            ✓ Saved
          </div>
        )}

        {/* Offline / pending sync badge */}
        {(!isOnline || pendingCount > 0) && (
          <div
            style={{
              ...S.offlineBadge,
              backgroundColor: !isOnline ? 'rgba(224,82,82,0.9)' : 'rgba(244,120,32,0.9)',
              color: '#fff',
            }}
          >
            {!isOnline ? <WifiOff size={12} /> : <CloudOff size={12} />}
            {!isOnline
              ? 'Offline'
              : `${pendingCount} pending sync`}
          </div>
        )}

        {/* First-use tool hint — dismisses itself after 3s. */}
        {hintTool && <ToolHint tool={hintTool} onDismiss={() => setHintTool(null)} />}

        {/* Precision loupe — shown for measure/path/area/calibrate when the cursor is inside the viewer. */}
        {cursorPos && (activeTool === 'measure' || activeTool === 'path' || activeTool === 'area' || activeTool === 'calibrate') && isLoaded && (
          <OsdLoupe
            screenX={cursorPos.x}
            screenY={cursorPos.y}
            containerRef={containerRef}
            viewerRef={viewerRef}
            scaleLabel={loupeScaleLabel}
            pulsing={snapActive}
          />
        )}

        {/* Inline text prompt — replaces the native window.prompt for text tool */}
        {textPrompt && (
          <InlineTextPrompt
            x={textPrompt.screen.x}
            y={textPrompt.screen.y}
            onCommit={commitTextPrompt}
            onCancel={() => setTextPrompt(null)}
          />
        )}

        {/* Create-RFI modal */}
        <CreateRFIModal
          open={showRFIModal}
          onClose={() => { setShowRFIModal(false); setRfiScreenshot(null); }}
          onSubmit={async () => { setShowRFIModal(false); setRfiScreenshot(null); }}
        />

        {/* Screenshot preview chip (non-interactive, fades behind modal) */}
        {showRFIModal && rfiScreenshot && (
          <div style={{
            position: 'absolute',
            top: 72,
            right: 24,
            width: 140,
            height: 100,
            borderRadius: borderRadius.md,
            overflow: 'hidden',
            border: `2px solid ${colors.primaryOrange}`,
            boxShadow: shadows.panel,
            zIndex: 9,
          }}>
            <img src={rfiScreenshot} alt="Viewer screenshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {/* Bottom zoom controls */}
        <div style={S.controls}>
          <button
            style={S.controlBtn}
            onClick={handleZoomOut}
            title="Zoom out (−)"
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <ZoomOut size={16} />
          </button>

          <span style={S.zoomLabel}>{zoomPercent}</span>

          <button
            style={S.controlBtn}
            onClick={handleZoomIn}
            title="Zoom in (+)"
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <ZoomIn size={16} />
          </button>

          <div style={{ width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />

          <button
            style={S.controlBtn}
            onClick={handleHome}
            title="Fit to view (0)"
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DrawingTiledViewer;

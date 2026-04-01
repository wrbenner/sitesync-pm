import React, { useState, useRef, useCallback } from 'react';
import { Eraser, Check } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';

interface SignaturePadProps {
  onSigned: (blob: Blob) => void;
  signerName: string;
  signerTitle: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSigned, signerName, signerTitle }) => {
  const [hasSignature, setHasSignature] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const svgRef = useRef<SVGSVGElement>(null);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    setCurrentPath(`M ${pos.x} ${pos.y}`);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    setCurrentPath((prev) => `${prev} L ${pos.x} ${pos.y}`);
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPath) {
      setPaths((prev) => [...prev, currentPath]);
      setCurrentPath('');
      setHasSignature(true);
    }
  };

  const handleClear = () => {
    setPaths([]);
    setCurrentPath('');
    setHasSignature(false);
  };

  return (
    <div style={{ border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.surfaceInset }}>
        <div>
          <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>{signerName}</p>
          <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>{signerTitle}</p>
        </div>
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <button
            onClick={handleClear}
            disabled={!hasSignature}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing['1'],
              padding: `${spacing['1']} ${spacing['2']}`, backgroundColor: 'transparent',
              border: 'none', borderRadius: borderRadius.sm, cursor: hasSignature ? 'pointer' : 'default',
              color: hasSignature ? colors.textTertiary : colors.borderDefault,
              fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily,
            }}
          >
            <Eraser size={12} /> Clear
          </button>
          <button
            onClick={() => {
              if (!svgRef.current || !hasSignature) return;
              const svgStr = new XMLSerializer().serializeToString(svgRef.current);
              const blob = new Blob([svgStr], { type: 'image/svg+xml' });
              onSigned(blob);
            }}
            disabled={!hasSignature}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing['1'],
              padding: `${spacing['1']} ${spacing['3']}`,
              backgroundColor: hasSignature ? colors.primaryOrange : colors.borderDefault,
              color: colors.white, border: 'none', borderRadius: borderRadius.sm,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily, cursor: hasSignature ? 'pointer' : 'default',
              transition: `background-color ${transitions.instant}`,
            }}
          >
            <Check size={12} /> Confirm Signature
          </button>
        </div>
      </div>

      {/* Drawing area */}
      <div style={{ backgroundColor: colors.white, position: 'relative' }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100"
          style={{ display: 'block', cursor: 'crosshair', touchAction: 'none' }}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        >
          {/* Guide line */}
          <line x1="10%" y1="75" x2="90%" y2="75" stroke={colors.borderSubtle} strokeWidth="1" strokeDasharray="4 4" />

          {/* Paths */}
          {paths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={colors.textPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {currentPath && (
            <path d={currentPath} fill="none" stroke={colors.textPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>

        {!hasSignature && !isDrawing && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Sign here</span>
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div style={{ padding: `${spacing['1']} ${spacing['3']}`, backgroundColor: colors.surfaceInset }}>
        <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
};

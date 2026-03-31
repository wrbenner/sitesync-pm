import React, { useState, useRef, useCallback } from 'react';
import { ArrowRight, Circle, Type, Undo2, Download, X } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions, vizColors } from '../../styles/theme';

type Tool = 'arrow' | 'circle' | 'text' | null;

interface Annotation {
  id: number;
  tool: Tool;
  x: number;
  y: number;
  endX?: number;
  endY?: number;
  text?: string;
  color: string;
}

interface PhotoAnnotatorProps {
  onClose: () => void;
  onSave: () => void;
}

const toolConfig: { tool: Tool; icon: React.ReactNode; label: string }[] = [
  { tool: 'arrow', icon: <ArrowRight size={16} />, label: 'Arrow' },
  { tool: 'circle', icon: <Circle size={16} />, label: 'Circle' },
  { tool: 'text', icon: <Type size={16} />, label: 'Text' },
];

const annotationColors = ['#F47820', '#C93B3B', '#2D8A6E', '#3A7BC8', '#7C5DC7'];

export const PhotoAnnotator: React.FC<PhotoAnnotatorProps> = ({ onClose, onSave }) => {
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [activeColor, setActiveColor] = useState(annotationColors[0]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const drawStart = useRef({ x: 0, y: 0 });

  const getRelativePos = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!activeTool) return;
    const pos = getRelativePos(e);

    if (activeTool === 'text') {
      setTextPos(pos);
      return;
    }

    setIsDrawing(true);
    drawStart.current = pos;
  };

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing || !activeTool) return;
    setIsDrawing(false);
    const endPos = getRelativePos(e);

    setAnnotations((prev) => [...prev, {
      id: Date.now(),
      tool: activeTool,
      x: drawStart.current.x,
      y: drawStart.current.y,
      endX: endPos.x,
      endY: endPos.y,
      color: activeColor,
    }]);
  };

  const handleTextSubmit = () => {
    if (!textPos || !textInput.trim()) return;
    setAnnotations((prev) => [...prev, {
      id: Date.now(),
      tool: 'text',
      x: textPos.x,
      y: textPos.y,
      text: textInput,
      color: activeColor,
    }]);
    setTextInput('');
    setTextPos(null);
  };

  const handleUndo = () => setAnnotations((prev) => prev.slice(0, -1));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1060, backgroundColor: vizColors.darkText, display: 'flex', flexDirection: 'column' }}>
      {/* Top toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['3']} ${spacing['4']}`, flexShrink: 0 }}>
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], backgroundColor: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily }}>
          <X size={18} /> Cancel
        </button>
        <span style={{ color: 'white', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold }}>Annotate Photo</span>
        <button onClick={() => { onSave(); onClose(); }} style={{ padding: `${spacing['2']} ${spacing['4']}`, backgroundColor: colors.primaryOrange, color: 'white', border: 'none', borderRadius: borderRadius.base, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily, cursor: 'pointer' }}>
          <Download size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />Save
        </button>
      </div>

      {/* Canvas area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: spacing['4'], minHeight: 0 }}>
        <div
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseUp={handleCanvasMouseUp}
          style={{
            position: 'relative', width: '100%', maxWidth: '720px', aspectRatio: '4/3',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: borderRadius.lg, overflow: 'hidden', cursor: activeTool ? 'crosshair' : 'default',
          }}
        >
          {/* Placeholder image content */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold }}>
            Floor 7 Steel Connection
          </div>

          {/* Render annotations */}
          {annotations.map((ann) => {
            if (ann.tool === 'arrow' && ann.endX !== undefined && ann.endY !== undefined) {
              const angle = Math.atan2(ann.endY - ann.y, ann.endX - ann.x) * (180 / Math.PI);
              const length = Math.sqrt(Math.pow(ann.endX - ann.x, 2) + Math.pow(ann.endY - ann.y, 2));
              return (
                <div key={ann.id} style={{
                  position: 'absolute', left: `${ann.x}%`, top: `${ann.y}%`,
                  width: `${length}%`, height: '3px', backgroundColor: ann.color,
                  transform: `rotate(${angle}deg)`, transformOrigin: '0 50%',
                  borderRadius: 2,
                }}>
                  <div style={{ position: 'absolute', right: -4, top: -4, width: 0, height: 0, borderLeft: `10px solid ${ann.color}`, borderTop: '5px solid transparent', borderBottom: '5px solid transparent' }} />
                </div>
              );
            }
            if (ann.tool === 'circle' && ann.endX !== undefined && ann.endY !== undefined) {
              const cx = (ann.x + ann.endX) / 2;
              const cy = (ann.y + ann.endY) / 2;
              const rx = Math.abs(ann.endX - ann.x) / 2;
              const ry = Math.abs(ann.endY - ann.y) / 2;
              return (
                <div key={ann.id} style={{
                  position: 'absolute',
                  left: `${cx - rx}%`, top: `${cy - ry}%`,
                  width: `${rx * 2}%`, height: `${ry * 2}%`,
                  border: `3px solid ${ann.color}`, borderRadius: '50%',
                  pointerEvents: 'none',
                }} />
              );
            }
            if (ann.tool === 'text') {
              return (
                <div key={ann.id} style={{
                  position: 'absolute', left: `${ann.x}%`, top: `${ann.y}%`,
                  backgroundColor: ann.color, color: 'white',
                  padding: `2px ${spacing['2']}`, borderRadius: borderRadius.sm,
                  fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                  whiteSpace: 'nowrap', pointerEvents: 'none',
                }}>
                  {ann.text}
                </div>
              );
            }
            return null;
          })}

          {/* Text input overlay */}
          {textPos && (
            <div style={{ position: 'absolute', left: `${textPos.x}%`, top: `${textPos.y}%`, zIndex: 5 }}>
              <input
                autoFocus
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleTextSubmit(); if (e.key === 'Escape') setTextPos(null); }}
                onBlur={handleTextSubmit}
                placeholder="Type here..."
                style={{
                  padding: `2px ${spacing['2']}`, backgroundColor: activeColor, color: 'white',
                  border: 'none', borderRadius: borderRadius.sm, outline: 'none',
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  fontWeight: typography.fontWeight.semibold, minWidth: '100px',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['4'], padding: `${spacing['3']} ${spacing['4']}`, flexShrink: 0 }}>
        {/* Tool selector */}
        <div style={{ display: 'flex', gap: spacing['2'], backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: borderRadius.full, padding: spacing['1'] }}>
          {toolConfig.map((t) => (
            <button
              key={t.tool}
              onClick={() => setActiveTool(activeTool === t.tool ? null : t.tool)}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['1'],
                padding: `${spacing['2']} ${spacing['3']}`,
                backgroundColor: activeTool === t.tool ? colors.primaryOrange : 'transparent',
                color: activeTool === t.tool ? 'white' : 'rgba(255,255,255,0.6)',
                border: 'none', borderRadius: borderRadius.full, cursor: 'pointer',
                fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily,
                fontWeight: typography.fontWeight.medium, transition: `all ${transitions.instant}`,
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Color picker */}
        <div style={{ display: 'flex', gap: spacing['1'] }}>
          {annotationColors.map((c) => (
            <button
              key={c}
              onClick={() => setActiveColor(c)}
              style={{
                width: 24, height: 24, borderRadius: '50%', backgroundColor: c,
                border: activeColor === c ? '2px solid white' : '2px solid transparent',
                cursor: 'pointer', transition: `border-color ${transitions.instant}`,
              }}
            />
          ))}
        </div>

        {/* Undo */}
        <button
          onClick={handleUndo}
          disabled={annotations.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: spacing['1'],
            padding: `${spacing['2']} ${spacing['3']}`,
            backgroundColor: 'rgba(255,255,255,0.08)', color: annotations.length > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
            border: 'none', borderRadius: borderRadius.full, cursor: annotations.length > 0 ? 'pointer' : 'default',
            fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily,
          }}
        >
          <Undo2 size={14} /> Undo
        </button>
      </div>
    </div>
  );
};

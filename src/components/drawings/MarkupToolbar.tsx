import React, { useState } from 'react';
import { MapPin, Highlighter, Ruler, Type, Undo2, MousePointer, Save, Pen, MessageSquarePlus, ChevronUp, ChevronDown, Square, Hash, Crosshair, Spline } from 'lucide-react';
import { colors, spacing, borderRadius, transitions, shadows } from '../../styles/theme';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export type MarkupTool = 'select' | 'pin' | 'highlight' | 'measure' | 'text' | 'draw' | 'area' | 'count' | 'calibrate' | 'path';

interface MarkupToolbarProps {
  activeTool: MarkupTool;
  onToolChange: (tool: MarkupTool) => void;
  onUndo: () => void;
  canUndo: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  /** Whether there's anything to save. Drives the Save button state independently of undo. */
  canSave?: boolean;
  /** Number of unsaved annotations — shown as a badge on the Save button. */
  unsavedCount?: number;
  onCreateRFI?: () => void;
}

const tools: { id: MarkupTool; icon: React.ReactNode; label: string; ariaLabel: string }[] = [
  { id: 'select', icon: <MousePointer size={18} />, label: 'Select', ariaLabel: 'Select and pan tool' },
  { id: 'measure', icon: <Ruler size={18} />, label: 'Tape', ariaLabel: 'Tape measure tool' },
  { id: 'path', icon: <Spline size={18} />, label: 'Path', ariaLabel: 'Measure distance along a non-straight path' },
  { id: 'area', icon: <Square size={18} />, label: 'Area', ariaLabel: 'Area and perimeter polygon tool' },
  { id: 'count', icon: <Hash size={18} />, label: 'Count', ariaLabel: 'Count tool' },
  { id: 'calibrate', icon: <Crosshair size={18} />, label: 'Calibrate', ariaLabel: 'Calibrate scale by two known points' },
  { id: 'pin', icon: <MapPin size={18} />, label: 'Pin', ariaLabel: 'Pin markup tool' },
  { id: 'highlight', icon: <Highlighter size={18} />, label: 'Highlight', ariaLabel: 'Highlight tool' },
  { id: 'text', icon: <Type size={18} />, label: 'Text', ariaLabel: 'Text annotation tool' },
  { id: 'draw', icon: <Pen size={18} />, label: 'Draw', ariaLabel: 'Pen tool' },
];

export const MarkupToolbar: React.FC<MarkupToolbarProps> = ({
  activeTool, onToolChange, onUndo, canUndo, onSave, isSaving, canSave, unsavedCount, onCreateRFI,
}) => {
  // Derive effective save enablement. If caller passes canSave explicitly, honor it;
  // otherwise fall back to canUndo (legacy callers).
  const saveEnabled = !!onSave && !isSaving && (canSave ?? canUndo);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [expanded, setExpanded] = useState(true);

  if (isMobile) {
    return (
      <div
        role="toolbar"
        aria-label="Drawing markup tools"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E5E7EB',
          padding: expanded ? '8px' : '0',
        }}
      >
        {/* Collapse/expand toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
          <button
            onClick={() => setExpanded(v => !v)}
            aria-label={expanded ? 'Collapse toolbar' : 'Expand toolbar'}
            aria-expanded={expanded}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 16, border: 'none', background: 'none',
              color: colors.textSecondary, cursor: 'pointer', padding: 0,
            }}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>

        {/* Tool buttons row */}
        {expanded && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            overflowX: 'auto', paddingBottom: 4,
          }}>
            {tools.map((tool) => {
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => onToolChange(tool.id)}
                  title={tool.label}
                  aria-label={tool.ariaLabel}
                  aria-pressed={isActive}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 44, height: 44, flexShrink: 0,
                    border: 'none', borderRadius: borderRadius.full,
                    backgroundColor: isActive ? colors.primaryOrange : 'transparent',
                    color: isActive ? colors.white : colors.textSecondary,
                    cursor: 'pointer', transition: `all ${transitions.instant}`,
                  }}
                >
                  {tool.icon}
                </button>
              );
            })}

            <div style={{ width: 1, height: 24, backgroundColor: colors.borderSubtle, margin: '0 4px', flexShrink: 0 }} />

            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo"
              aria-label="Undo last markup"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 44, height: 44, flexShrink: 0,
                border: 'none', borderRadius: borderRadius.full,
                backgroundColor: 'transparent',
                color: canUndo ? colors.textSecondary : colors.borderDefault,
                cursor: canUndo ? 'pointer' : 'default',
              }}
            >
              <Undo2 size={18} />
            </button>

            {onSave && (
              <button
                onClick={onSave}
                disabled={!saveEnabled}
                title={isSaving ? 'Saving…' : unsavedCount ? `Save ${unsavedCount}` : 'Save markups'}
                aria-label={isSaving ? 'Saving markups' : 'Save markups'}
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  minWidth: 44, height: 44, flexShrink: 0,
                  border: 'none', borderRadius: borderRadius.full,
                  backgroundColor: saveEnabled ? colors.primaryOrange : 'transparent',
                  color: saveEnabled ? colors.white : colors.borderDefault,
                  cursor: saveEnabled ? 'pointer' : 'default',
                  padding: unsavedCount ? '0 14px' : '0 10px',
                  fontSize: 13, fontWeight: 600,
                  transition: `all ${transitions.instant}`,
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                <Save size={18} />
                {!!unsavedCount && unsavedCount > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 20, height: 20, padding: '0 6px',
                    borderRadius: 10,
                    backgroundColor: 'rgba(255,255,255,0.25)',
                    color: colors.white,
                    fontSize: 11, fontWeight: 700, lineHeight: 1,
                  }}>
                    {unsavedCount}
                  </span>
                )}
              </button>
            )}

            {onCreateRFI && (
              <>
                <div style={{ width: 1, height: 24, backgroundColor: colors.borderSubtle, margin: '0 4px', flexShrink: 0 }} />
                <button
                  onClick={onCreateRFI}
                  title="Create RFI"
                  aria-label="Create RFI from markup"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    minWidth: 44, height: 44, flexShrink: 0,
                    border: 'none', borderRadius: borderRadius.md,
                    backgroundColor: colors.primaryOrange,
                    color: colors.white,
                    cursor: 'pointer', padding: '0 12px',
                    fontSize: 13, fontWeight: 600,
                    transition: `all ${transitions.instant}`,
                  }}
                >
                  <MessageSquarePlus size={18} />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div
      role="toolbar"
      aria-label="Drawing markup tools"
      style={{
        display: 'flex', alignItems: 'center', gap: spacing['1'],
        padding: spacing['1'], backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.full, boxShadow: shadows.cardHover,
      }}
    >
      {tools.map((tool) => {
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            title={tool.label}
            aria-label={tool.ariaLabel}
            aria-pressed={isActive}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, border: 'none', borderRadius: borderRadius.full,
              backgroundColor: isActive ? colors.primaryOrange : 'transparent',
              color: isActive ? colors.white : colors.textSecondary,
              cursor: 'pointer', transition: `all ${transitions.instant}`,
            }}
          >
            {tool.icon}
          </button>
        );
      })}
      <div style={{ width: 1, height: 24, backgroundColor: colors.borderSubtle, margin: `0 ${spacing['1']}` }} />
      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo"
        aria-label="Undo last markup"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, border: 'none', borderRadius: borderRadius.full,
          backgroundColor: 'transparent',
          color: canUndo ? colors.textSecondary : colors.borderDefault,
          cursor: canUndo ? 'pointer' : 'default',
        }}
      >
        <Undo2 size={16} />
      </button>
      {onSave && (
        <>
          <div style={{ width: 1, height: 24, backgroundColor: colors.borderSubtle, margin: `0 ${spacing['1']}` }} />
          <button
            onClick={onSave}
            disabled={!saveEnabled}
            title={isSaving ? 'Saving…' : unsavedCount ? `Save ${unsavedCount} markup${unsavedCount === 1 ? '' : 's'}` : 'Nothing to save'}
            aria-label={isSaving ? 'Saving markups' : 'Save markups'}
            style={{
              position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              height: 36, border: 'none', borderRadius: borderRadius.full,
              backgroundColor: saveEnabled ? colors.primaryOrange : colors.surfaceRaised,
              color: saveEnabled ? colors.white : colors.borderDefault,
              cursor: saveEnabled ? 'pointer' : 'default',
              padding: unsavedCount ? '0 14px 0 12px' : '0 10px',
              fontSize: 13, fontWeight: 600,
              transition: `all ${transitions.instant}`,
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            <Save size={16} />
            <span>{isSaving ? 'Saving…' : 'Save'}</span>
            {!!unsavedCount && unsavedCount > 0 && !isSaving && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 20, height: 20, padding: '0 6px',
                borderRadius: 10,
                backgroundColor: 'rgba(255,255,255,0.25)',
                color: colors.white,
                fontSize: 11, fontWeight: 700,
                lineHeight: 1,
              }}>
                {unsavedCount}
              </span>
            )}
          </button>
        </>
      )}
      {onCreateRFI && (
        <>
          <div style={{ width: 1, height: 24, backgroundColor: colors.borderSubtle, margin: `0 ${spacing['1']}` }} />
          <button
            onClick={onCreateRFI}
            title="Create RFI"
            aria-label="Create RFI from markup"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              height: 36, border: 'none', borderRadius: borderRadius.md,
              backgroundColor: colors.primaryOrange,
              color: colors.white,
              cursor: 'pointer', padding: '0 12px',
              fontSize: 13, fontWeight: 600,
              transition: `all ${transitions.instant}`,
            }}
          >
            <MessageSquarePlus size={16} />
            <span>Create RFI</span>
          </button>
        </>
      )}
    </div>
  );
};

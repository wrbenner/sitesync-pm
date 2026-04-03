import React, { useState } from 'react';
import { MapPin, Circle, Ruler, Type, Undo2, MousePointer, Save, Pen, MessageSquarePlus, ChevronUp, ChevronDown } from 'lucide-react';
import { colors, spacing, borderRadius, transitions, shadows } from '../../styles/theme';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export type MarkupTool = 'select' | 'pin' | 'highlight' | 'measure' | 'text' | 'draw';

interface MarkupToolbarProps {
  activeTool: MarkupTool;
  onToolChange: (tool: MarkupTool) => void;
  onUndo: () => void;
  canUndo: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  onCreateRFI?: () => void;
}

const tools: { id: MarkupTool; icon: React.ReactNode; label: string; ariaLabel: string }[] = [
  { id: 'select', icon: <MousePointer size={18} />, label: 'Select', ariaLabel: 'Select and pan tool' },
  { id: 'pin', icon: <MapPin size={18} />, label: 'Pin', ariaLabel: 'Pin markup tool' },
  { id: 'highlight', icon: <Circle size={18} />, label: 'Highlight', ariaLabel: 'Cloud markup tool' },
  { id: 'measure', icon: <Ruler size={18} />, label: 'Measure', ariaLabel: 'Measure markup tool' },
  { id: 'text', icon: <Type size={18} />, label: 'Text', ariaLabel: 'Text annotation tool' },
  { id: 'draw', icon: <Pen size={18} />, label: 'Draw', ariaLabel: 'Pen tool' },
];

export const MarkupToolbar: React.FC<MarkupToolbarProps> = ({
  activeTool, onToolChange, onUndo, canUndo, onSave, isSaving, onCreateRFI,
}) => {
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
                disabled={isSaving || !canUndo}
                title="Save markups"
                aria-label={isSaving ? 'Saving markups' : 'Save markups'}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 44, height: 44, flexShrink: 0,
                  border: 'none', borderRadius: borderRadius.full,
                  backgroundColor: (!isSaving && canUndo) ? colors.primaryOrange : 'transparent',
                  color: (!isSaving && canUndo) ? colors.white : colors.borderDefault,
                  cursor: (!isSaving && canUndo) ? 'pointer' : 'default',
                  transition: `all ${transitions.instant}`,
                }}
              >
                <Save size={18} />
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
            disabled={isSaving || !canUndo}
            title="Save markups"
            aria-label={isSaving ? 'Saving markups' : 'Save markups'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, border: 'none', borderRadius: borderRadius.full,
              backgroundColor: (!isSaving && canUndo) ? colors.primaryOrange : 'transparent',
              color: (!isSaving && canUndo) ? colors.white : colors.borderDefault,
              cursor: (!isSaving && canUndo) ? 'pointer' : 'default',
              transition: `all ${transitions.instant}`,
            }}
          >
            <Save size={16} />
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

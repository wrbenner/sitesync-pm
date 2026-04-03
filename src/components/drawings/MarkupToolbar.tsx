import React from 'react';
import { MapPin, Circle, Ruler, Type, Undo2, MousePointer, Save, Pen } from 'lucide-react';
import { colors, spacing, borderRadius, transitions, shadows } from '../../styles/theme';

export type MarkupTool = 'select' | 'pin' | 'highlight' | 'measure' | 'text' | 'draw';

interface MarkupToolbarProps {
  activeTool: MarkupTool;
  onToolChange: (tool: MarkupTool) => void;
  onUndo: () => void;
  canUndo: boolean;
  onSave?: () => void;
  isSaving?: boolean;
}

const tools: { id: MarkupTool; icon: React.ReactNode; label: string; ariaLabel: string }[] = [
  { id: 'select', icon: <MousePointer size={16} />, label: 'Select', ariaLabel: 'Select and pan tool' },
  { id: 'pin', icon: <MapPin size={16} />, label: 'Pin', ariaLabel: 'Pin markup tool' },
  { id: 'highlight', icon: <Circle size={16} />, label: 'Highlight', ariaLabel: 'Cloud markup tool' },
  { id: 'measure', icon: <Ruler size={16} />, label: 'Measure', ariaLabel: 'Measure markup tool' },
  { id: 'text', icon: <Type size={16} />, label: 'Text', ariaLabel: 'Text annotation tool' },
  { id: 'draw', icon: <Pen size={16} />, label: 'Draw', ariaLabel: 'Freehand drawing tool' },
];

export const MarkupToolbar: React.FC<MarkupToolbarProps> = ({ activeTool, onToolChange, onUndo, canUndo, onSave, isSaving }) => {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: spacing['1'],
      padding: spacing['1'], backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.full, boxShadow: shadows.cardHover,
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
    </div>
  );
};

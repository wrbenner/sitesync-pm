import React from 'react';
import { MapPin, Circle, Ruler, Type, Undo2, MousePointer } from 'lucide-react';
import { colors, spacing, borderRadius, transitions, shadows } from '../../styles/theme';

export type MarkupTool = 'select' | 'pin' | 'highlight' | 'measure' | 'text';

interface MarkupToolbarProps {
  activeTool: MarkupTool;
  onToolChange: (tool: MarkupTool) => void;
  onUndo: () => void;
  canUndo: boolean;
}

const tools: { id: MarkupTool; icon: React.ReactNode; label: string }[] = [
  { id: 'select', icon: <MousePointer size={16} />, label: 'Select' },
  { id: 'pin', icon: <MapPin size={16} />, label: 'Pin' },
  { id: 'highlight', icon: <Circle size={16} />, label: 'Highlight' },
  { id: 'measure', icon: <Ruler size={16} />, label: 'Measure' },
  { id: 'text', icon: <Type size={16} />, label: 'Text' },
];

export const MarkupToolbar: React.FC<MarkupToolbarProps> = ({ activeTool, onToolChange, onUndo, canUndo }) => {
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
    </div>
  );
};

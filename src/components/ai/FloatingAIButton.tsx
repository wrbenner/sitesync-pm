import React from 'react';
import { Sparkles } from 'lucide-react';
import { colors, borderRadius, shadows, transitions } from '../../styles/theme';
import { useAIAnnotationStore } from '../../stores';
import { useProjectId } from '../../hooks/useProjectId';
import { useAIInsights } from '../../hooks/queries';

export const FloatingAIButton: React.FC = () => {
  const { toggleContextPanel, contextPanelOpen } = useAIAnnotationStore();
  const projectId = useProjectId();
  const { data: insights } = useAIInsights(projectId);
  const insightCount = insights?.length || 0;

  return (
    <button
      onClick={toggleContextPanel}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 48,
        height: 48,
        borderRadius: borderRadius.full,
        background: contextPanelOpen
          ? colors.surfaceRaised
          : `linear-gradient(135deg, ${colors.statusReview} 0%, #9B8ADB 100%)`,
        border: contextPanelOpen ? `1px solid ${colors.borderDefault}` : 'none',
        boxShadow: contextPanelOpen ? shadows.card : shadows.glow.replace('244, 120, 32', '124, 93, 199'),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 999,
        transition: `all ${transitions.quick}`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
      }}
    >
      <Sparkles size={20} color={contextPanelOpen ? colors.statusReview : 'white'} />
      {insightCount > 0 && (
        <span style={{
          position: 'absolute',
          top: -4,
          right: -4,
          backgroundColor: colors.statusCritical,
          color: 'white',
          fontSize: '10px',
          fontWeight: 600,
          borderRadius: '50%',
          width: 18,
          height: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {insightCount}
        </span>
      )}
    </button>
  );
};

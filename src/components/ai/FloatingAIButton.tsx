import React, { useEffect } from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { colors, borderRadius, shadows, transitions, spacing, typography, zIndex as themeZIndex } from '../../styles/theme';
import { useProjectId } from '../../hooks/useProjectId';
import { useAIInsights } from '../../hooks/queries';
import { useCopilotStore } from '../../stores/copilotStore';

export const FloatingAIButton: React.FC = () => {
  const { openCopilot, isOpen } = useCopilotStore();
  const projectId = useProjectId();
  const { data: insights, isLoading, isError, refetch } = useAIInsights(projectId);
  const insightCount = insights?.length || 0;

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = '@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }';
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const titleText = isError
    ? 'AI insights could not load. Click to open copilot and retry.'
    : isLoading
      ? 'Loading AI insights...'
      : insightCount > 0
        ? `${insightCount} AI insight${insightCount !== 1 ? 's' : ''} available`
        : 'Open AI Copilot';

  return (
    <button
      onClick={isError ? async () => { const result = await refetch(); if (result.isError) { toast.error('Unable to load AI insights. Please try again.'); } else { openCopilot(); } } : openCopilot}
      title={titleText}
      aria-label={titleText}
      style={{
        position: 'fixed',
        bottom: spacing['6'],
        right: spacing['6'],
        width: spacing['12'],
        height: spacing['12'],
        borderRadius: borderRadius.full,
        background: isOpen
          ? colors.surfaceRaised
          : `linear-gradient(135deg, ${colors.statusReview} 0%, #9B8ADB 100%)` /* lighter purple for AI gradient, no token available */,
        border: isOpen ? `1px solid ${colors.borderDefault}` : 'none',
        boxShadow: isOpen ? shadows.card : shadows.glow.replace('244, 120, 32', '124, 93, 199'),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: themeZIndex.dropdown as number - 1,
        transition: `all ${transitions.quick}`,
        animation: isLoading ? 'pulse 2s ease-in-out infinite' : undefined,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
      }}
    >
      <Sparkles size={20} color={isOpen ? colors.statusReview : colors.white} />
      {isError && (
        <span aria-label="AI insights failed to load" aria-live="polite" style={{
          position: 'absolute',
          top: -4,
          right: -4,
          backgroundColor: colors.surfaceRaised,
          borderRadius: '50%',
          width: 18,
          height: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <AlertTriangle size={14} color={colors.statusPending} />
        </span>
      )}
      {!isError && insightCount > 0 && (
        <span style={{
          position: 'absolute',
          top: -4,
          right: -4,
          backgroundColor: colors.statusCritical,
          color: colors.white,
          fontSize: typography.fontSize.caption,
          fontWeight: typography.fontWeight.semibold,
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

import React, { useEffect, useState } from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { colors, borderRadius, shadows, transitions, spacing, typography, zIndex as themeZIndex } from '../../styles/theme';
import { useProjectId } from '../../hooks/useProjectId';
import { useAIInsights } from '../../hooks/queries';
import { useCopilotStore } from '../../stores/copilotStore';
import { supabase } from '../../lib/supabase';

export const FloatingAIButton: React.FC = () => {
  const { openCopilot, isOpen } = useCopilotStore();
  const projectId = useProjectId();
  const queryClient = useQueryClient();
  const { data: insights, isLoading, isError, refetch } = useAIInsights(projectId);
  const insightCount = insights?.length || 0;
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = '@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }';
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`ai-insights-${projectId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_insights', filter: `project_id=eq.${projectId}` },
        () => { queryClient.invalidateQueries({ queryKey: ['ai-insights', projectId] }); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ai_insights', filter: `project_id=eq.${projectId}` },
        () => { queryClient.invalidateQueries({ queryKey: ['ai-insights', projectId] }); }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `project_id=eq.${projectId}` },
        () => { queryClient.invalidateQueries({ queryKey: ['ai-insights', projectId] }); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, queryClient]);

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
      aria-label={insightCount > 0 ? `${insightCount} AI insight${insightCount !== 1 ? 's' : ''} available. Open AI Copilot` : 'Open AI Copilot'}
      role="button"
      tabIndex={0}
      onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)'; }}
      onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'; }}
      onTouchStart={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)'; }}
      onTouchEnd={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)'; } }}
      onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'; } }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={{
        position: 'fixed',
        bottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 80px)' : spacing['6'],
        right: isMobile ? spacing['4'] : spacing['6'],
        width: isMobile ? '64px' : spacing['12'],
        height: isMobile ? '64px' : spacing['12'],
        minWidth: '44px',
        minHeight: '44px',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
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
        zIndex: 1100,
        transition: `all ${transitions.quick}`,
        animation: isLoading ? 'pulse 2s ease-in-out infinite' : undefined,
        outline: isFocused ? '2px solid #F47820' : 'none',
        outlineOffset: isFocused ? '2px' : undefined,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
      }}
    >
      <Sparkles size={isMobile ? 28 : 20} color={isOpen ? colors.statusReview : colors.white} />
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
      <span aria-live="polite" role="status" style={{ position: 'absolute', top: -4, right: -4 }}>
        {!isError && insightCount > 0 && (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.statusCritical,
            color: colors.white,
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.semibold,
            borderRadius: '50%',
            width: 18,
            height: 18,
          }}>
            {insightCount}
          </span>
        )}
      </span>
    </button>
  );
};

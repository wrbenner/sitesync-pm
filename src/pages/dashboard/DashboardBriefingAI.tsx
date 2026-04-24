import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown, AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { supabase } from '../../lib/supabase';
import { useProjectId } from '../../hooks/useProjectId';
import { useAuth } from '../../hooks/useAuth';

// ── Types ──────────────────────────────────────────────

interface DailySummary {
  summary: string;
  highlights: string[];
  concerns: string[];
}

// ── Hook: AI Daily Summary ─────────────────────────────

function useAIDailySummary(projectId: string | undefined) {
  const { user } = useAuth();

  return useQuery<DailySummary | null>({
    queryKey: ['ai-daily-summary', projectId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      // Check cache table — silently skip if the table isn't provisioned in
      // this environment (Supabase returns 404/PGRST204).
      try {
        const { data: cached, error } = await supabase
          .from('daily_summaries')
          .select('summary, highlights, concerns')
          .eq('project_id', projectId!)
          .eq('date', today)
          .maybeSingle();

        if (!error && cached?.summary) {
          return {
            summary: cached.summary,
            highlights: cached.highlights ?? [],
            concerns: cached.concerns ?? [],
          };
        }
      } catch {
        // Table missing — proceed to edge function fallback.
      }

      // Invoke edge function. If it isn't deployed or returns 401/404/500,
      // treat the briefing as unavailable rather than propagating the error —
      // this component hides itself when data is null.
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await supabase.functions.invoke('ai-daily-summary', {
          body: { project_id: projectId, date: today },
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        });
        if (res.error) return null;
        return (res.data as DailySummary | null) ?? null;
      } catch {
        return null;
      }
    },
    enabled: !!projectId && !!user,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

// ── Component ──────────────────────────────────────────

export const DashboardBriefingAI: React.FC = React.memo(() => {
  const projectId = useProjectId();
  const { data: briefing, isLoading, isError } = useAIDailySummary(projectId);
  const [expanded, setExpanded] = useState(false);

  if (isLoading || isError || !briefing?.summary) return null;

  const hasDetails = briefing.highlights.length > 0 || briefing.concerns.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg,
        border: `1px solid ${colors.borderSubtle}`,
        marginBottom: spacing['6'],
        overflow: 'hidden',
      }}
    >
      {/* Header — click to expand */}
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
          width: '100%', padding: `${spacing['4']} ${spacing['4']}`,
          background: 'none', border: 'none',
          cursor: hasDetails ? 'pointer' : 'default',
          fontFamily: typography.fontFamily, textAlign: 'left',
        }}
      >
        {/* AI icon — small, refined */}
        <div style={{
          width: 24, height: 24, borderRadius: borderRadius.full, flexShrink: 0,
          background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, ${colors.orangeLight} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
        }}>
          <Sparkles size={12} color={colors.white} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: typography.fontSize.sm, color: colors.textPrimary,
            lineHeight: typography.lineHeight.relaxed,
          }}>
            {briefing.summary}
          </p>
        </div>

        {hasDetails && (
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ flexShrink: 0, marginTop: 2 }}
          >
            <ChevronDown size={14} color={colors.textTertiary} />
          </motion.div>
        )}
      </button>

      {/* Expandable details */}
      <AnimatePresence>
        {expanded && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: `0 ${spacing['4']} ${spacing['4']}`,
              paddingLeft: `calc(${spacing['4']} + 24px + ${spacing['3']})`,
              display: 'flex', flexDirection: 'column', gap: spacing['3'],
            }}>
              {/* Highlights */}
              {briefing.highlights.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginBottom: spacing['1.5'] }}>
                    <TrendingUp size={11} color={colors.statusActive} />
                    <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusActive }}>Highlights</span>
                  </div>
                  {briefing.highlights.map((h, i) => (
                    <p key={i} style={{
                      margin: 0, marginBottom: i < briefing.highlights.length - 1 ? 3 : 0,
                      fontSize: typography.fontSize.caption, color: colors.textSecondary,
                      lineHeight: typography.lineHeight.normal, paddingLeft: spacing['3'], position: 'relative',
                    }}>
                      <span style={{ position: 'absolute', left: spacing['0.5'], top: '0.45em', width: 3, height: 3, borderRadius: '50%', backgroundColor: colors.statusActive }} />
                      {h}
                    </p>
                  ))}
                </div>
              )}

              {/* Concerns */}
              {briefing.concerns.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginBottom: spacing['1.5'] }}>
                    <AlertTriangle size={11} color={colors.statusPending} />
                    <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusPending }}>Watch Items</span>
                  </div>
                  {briefing.concerns.map((c, i) => (
                    <p key={i} style={{
                      margin: 0, marginBottom: i < briefing.concerns.length - 1 ? 3 : 0,
                      fontSize: typography.fontSize.caption, color: colors.textSecondary,
                      lineHeight: typography.lineHeight.normal, paddingLeft: spacing['3'], position: 'relative',
                    }}>
                      <span style={{ position: 'absolute', left: spacing['0.5'], top: '0.45em', width: 3, height: 3, borderRadius: '50%', backgroundColor: colors.statusPending }} />
                      {c}
                    </p>
                  ))}
                </div>
              )}

              {/* Timestamp */}
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginTop: spacing['0.5'] }}>
                <Clock size={9} color={colors.textTertiary} />
                <span style={{ fontSize: '10px', color: colors.textTertiary }}>
                  Generated by Claude · {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
DashboardBriefingAI.displayName = 'DashboardBriefingAI';

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ChevronRight, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';
import { useProjectId } from '../../hooks/useProjectId';
import { useSchedulePhases } from '../../hooks/queries';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

// ── Types ──────────────────────────────────────────────

interface ScheduleRisk {
  task_name: string;
  risk_level: 'high' | 'medium' | 'low';
  reason: string;
  days_impact: number;
}

// ── Hook: AI Schedule Risk ─────────────────────────────

function useAIScheduleRisk(projectId: string | undefined) {
  const { user } = useAuth();

  return useQuery<ScheduleRisk[]>({
    queryKey: ['ai-schedule-risk', projectId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('ai-schedule-risk', {
        body: { project_id: projectId },
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      });
      if (res.error) throw res.error;
      return (res.data?.risks ?? []) as ScheduleRisk[];
    },
    enabled: !!projectId && !!user,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

// ── Component ──────────────────────────────────────────

export const DashboardCriticalPath: React.FC = React.memo(() => {
  const projectId = useProjectId();
  const navigate = useNavigate();
  const { data: phases } = useSchedulePhases(projectId);
  const { data: risks } = useAIScheduleRisk(projectId);

  // Top 5 critical path activities that aren't complete
  const criticalItems = useMemo(() => {
    if (!phases) return [];
    return phases
      .filter((p) => p.is_critical_path && (p.percent_complete ?? 0) < 100)
      .sort((a, b) => {
        // Sort by end_date ascending (soonest deadline first)
        const aEnd = a.end_date ?? '9999';
        const bEnd = b.end_date ?? '9999';
        return aEnd.localeCompare(bEnd);
      })
      .slice(0, 5);
  }, [phases]);

  // Build a risk map keyed by task name for quick lookup
  const riskMap = useMemo(() => {
    const map = new Map<string, ScheduleRisk>();
    for (const r of (risks ?? [])) {
      map.set(r.task_name.toLowerCase(), r);
    }
    return map;
  }, [risks]);

  if (criticalItems.length === 0) return null;

  const riskColor = (level: string) =>
    level === 'high' ? colors.statusCritical : level === 'medium' ? colors.statusPending : colors.textTertiary;
  const riskBg = (level: string) =>
    level === 'high' ? colors.statusCriticalSubtle : level === 'medium' ? colors.statusPendingSubtle : colors.surfaceInset;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.12 }}
      style={{ marginBottom: spacing['6'] }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
        <h3 style={{
          margin: 0,
          fontSize: typography.fontSize.body,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
        }}>
          Critical path
        </h3>
        <button
          onClick={() => navigate('/schedule')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['1'],
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.medium,
            color: colors.textTertiary,
            fontFamily: typography.fontFamily,
            padding: 0,
          }}
        >
          View schedule <ChevronRight size={12} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
        {criticalItems.map((phase) => {
          const risk = riskMap.get((phase.name ?? '').toLowerCase());
          const endDate = phase.end_date
            ? new Date(phase.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : null;
          const progress = phase.percent_complete ?? 0;
          const floatDays = phase.float_days;

          return (
            <button
              key={phase.id}
              onClick={() => navigate('/schedule')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['3'],
                padding: `${spacing['3']} ${spacing['4']}`,
                backgroundColor: colors.surfaceRaised,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.lg,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: typography.fontFamily,
                width: '100%',
                transition: 'box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = shadows.cardHover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
            >
              {/* Progress indicator */}
              <div style={{
                width: 36,
                height: 36,
                borderRadius: borderRadius.full,
                border: `2px solid ${progress >= 90 ? colors.statusActive : progress >= 50 ? colors.statusPending : colors.borderDefault}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.bold,
                color: progress >= 90 ? colors.statusActive : progress >= 50 ? colors.statusPending : colors.textSecondary,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {progress}%
              </div>

              {/* Name + metadata */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0,
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textPrimary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {phase.name ?? 'Unnamed phase'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginTop: 2 }}>
                  {endDate && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: typography.fontSize.caption,
                      color: colors.textTertiary,
                    }}>
                      <Clock size={10} /> {endDate}
                    </span>
                  )}
                  {typeof floatDays === 'number' && (
                    <span style={{
                      fontSize: typography.fontSize.caption,
                      color: floatDays <= 0 ? colors.statusCritical : colors.textTertiary,
                      fontWeight: floatDays <= 0 ? typography.fontWeight.semibold : typography.fontWeight.normal,
                    }}>
                      {floatDays <= 0 ? 'Zero float' : `${floatDays}d float`}
                    </span>
                  )}
                </div>
              </div>

              {/* AI risk badge */}
              {risk && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing['1'],
                  padding: `2px ${spacing['2']}`,
                  backgroundColor: riskBg(risk.risk_level),
                  borderRadius: borderRadius.full,
                  flexShrink: 0,
                }}>
                  <AlertTriangle size={10} color={riskColor(risk.risk_level)} />
                  <span style={{
                    fontSize: '10px',
                    fontWeight: typography.fontWeight.semibold,
                    color: riskColor(risk.risk_level),
                    textTransform: 'capitalize',
                  }}>
                    {risk.risk_level}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
});
DashboardCriticalPath.displayName = 'DashboardCriticalPath';

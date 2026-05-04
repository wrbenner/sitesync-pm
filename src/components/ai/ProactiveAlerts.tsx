import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Clock, TrendingUp, Award, Bell, ChevronRight } from 'lucide-react';

import { fromTable } from '../../lib/db/queries'
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { Card } from '../Primitives';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface ProactiveAlert {
  id: string;
  severity: AlertSeverity;
  icon: React.ElementType;
  title: string;
  description: string;
  navigateTo?: string;
}

interface ProactiveAlertsData {
  alerts: ProactiveAlert[];
}

// Single hook that pulls from multiple entity tables and derives alerts.
function useProactiveAlerts(projectId: string | undefined) {
  return useQuery<ProactiveAlertsData>({
    queryKey: ['proactive_alerts', projectId],
    queryFn: async () => {
      if (!projectId) return { alerts: [] };
      const now = new Date();
      const inSevenDays = new Date(now.getTime() + 7 * 86400000);
      const inThirtyDays = new Date(now.getTime() + 30 * 86400000);

      const safeRun = async <T,>(fn: () => Promise<{ data: T | null; error: unknown }>): Promise<T[]> => {
        try {
          const res = await fn();
          if (res.error) {
            if (import.meta.env.DEV) console.warn('[ProactiveAlerts] query error:', res.error);
            return [];
          }
          return Array.isArray(res.data) ? (res.data as T[]) : [];
        } catch (err) {
          if (import.meta.env.DEV) console.warn('[ProactiveAlerts] query threw:', err);
          return [];
        }
      };

      const [submittalsData, rfisData, certsData, budgetData] = await Promise.all([
        safeRun<{ id: string; title: string; due_date: string; status: string }>(() =>
          fromTable('submittals')
            .select('id, title, due_date, status')
            .eq('project_id' as never, projectId)
            .in('status' as never, ['pending', 'under_review'])
            .lte('due_date' as never, inSevenDays.toISOString())
            .gte('due_date' as never, now.toISOString())),
        safeRun<{ id: string; number: number; title: string | null; created_at: string; status: string | null }>(() =>
          fromTable('rfis')
            .select('id, number, title, created_at, status')
            .eq('project_id' as never, projectId)
            .eq('status' as never, 'open')),
        safeRun<{ id: string; certification_type: string; worker_name: string; expiration_date: string }>(() =>
          fromTable('safety_certifications')
            .select('id, certification_type, worker_name, expiration_date')
            .eq('project_id' as never, projectId)
            .lte('expiration_date' as never, inThirtyDays.toISOString().split('T')[0])
            .gte('expiration_date' as never, now.toISOString().split('T')[0])),
        safeRun<{ id: string; division?: string; original_amount?: number; actual_amount?: number }>(() =>
          fromTable('budget_items')
            .select('id, division, original_amount, actual_amount')
            .eq('project_id' as never, projectId)),
      ]);

      const alerts: ProactiveAlert[] = [];

      // Submittals due this week
      const submittalsDueSoon = submittalsData.length;
      if (submittalsDueSoon > 0) {
        alerts.push({
          id: 'submittals_due_week',
          severity: submittalsDueSoon > 3 ? 'warning' : 'info',
          icon: Clock,
          title: `${submittalsDueSoon} submittal${submittalsDueSoon === 1 ? '' : 's'} due this week`,
          description: submittalsData.slice(0, 3).map((s) => s.title).join(', ') + (submittalsDueSoon > 3 ? '…' : ''),
          navigateTo: '/submittals',
        });
      }

      // Stale open RFIs (>14 days old)
      const avgResponseDays = 7;
      const staleRfis = rfisData.filter((r) => {
        const age = (now.getTime() - new Date(r.created_at).getTime()) / 86400000;
        return age > 14;
      });
      for (const rfi of staleRfis.slice(0, 3)) {
        const age = Math.floor((now.getTime() - new Date(rfi.created_at).getTime()) / 86400000);
        const factor = Math.round(age / avgResponseDays);
        alerts.push({
          id: `stale_rfi_${rfi.id}`,
          severity: age > 30 ? 'critical' : 'warning',
          icon: AlertTriangle,
          title: `RFI #${rfi.number ?? '?'} has been open for ${age} days`,
          description: `${factor}x average response time — ${rfi.title ?? 'untitled'}`,
          navigateTo: '/rfis',
        });
      }

      // Budget variance by division
      const byDivision: Record<string, { budgeted: number; actual: number; label: string }> = {};
      for (const b of budgetData) {
        const key = b.division ?? 'Other';
        if (!byDivision[key]) byDivision[key] = { budgeted: 0, actual: 0, label: key };
        byDivision[key].budgeted += Number(b.original_amount ?? 0);
        byDivision[key].actual += Number(b.actual_amount ?? 0);
      }
      for (const key of Object.keys(byDivision)) {
        const { budgeted, actual, label } = byDivision[key];
        if (budgeted <= 0) continue;
        const variance = (actual - budgeted) / budgeted;
        if (variance > 0.15) {
          alerts.push({
            id: `budget_var_${key}`,
            severity: variance > 0.25 ? 'critical' : 'warning',
            icon: TrendingUp,
            title: `Budget variance on ${label} exceeds ${Math.round(variance * 100)}%`,
            description: `Actual $${Math.round(actual).toLocaleString()} vs budget $${Math.round(budgeted).toLocaleString()}`,
            navigateTo: '/budget',
          });
        }
      }

      // Certifications expiring
      const expiringCount = certsData.length;
      if (expiringCount > 0) {
        alerts.push({
          id: 'certs_expiring',
          severity: expiringCount > 3 ? 'warning' : 'info',
          icon: Award,
          title: `${expiringCount} certification${expiringCount === 1 ? '' : 's'} expire within 30 days`,
          description: certsData.slice(0, 3).map((c) => `${c.worker_name} — ${c.certification_type}`).join(', ') + (expiringCount > 3 ? '…' : ''),
          navigateTo: '/safety',
        });
      }

      const severityOrder = { critical: 0, warning: 1, info: 2 };
      alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      return { alerts };
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
}

function severityStyles(sev: AlertSeverity): { color: string; bg: string; border: string } {
  switch (sev) {
    case 'critical': return { color: colors.statusCritical, bg: colors.statusCriticalSubtle, border: colors.statusCritical };
    case 'warning': return { color: colors.statusPending, bg: colors.statusPendingSubtle, border: colors.statusPending };
    default: return { color: colors.statusInfo, bg: colors.statusInfoSubtle, border: colors.statusInfo };
  }
}

interface ProactiveAlertsProps {
  projectId: string | undefined;
  onNavigate?: (path: string) => void;
  maxItems?: number;
}

export const ProactiveAlerts: React.FC<ProactiveAlertsProps> = ({ projectId, onNavigate, maxItems = 6 }) => {
  const { data, isLoading } = useProactiveAlerts(projectId);
  const alerts = data?.alerts ?? [];
  const visible = alerts.slice(0, maxItems);

  if (isLoading) return null;
  if (visible.length === 0) return null;

  return (
    <Card padding={spacing['4']}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
        <Bell size={16} color={colors.orangeText} />
        <h3 style={{ margin: 0, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
          Proactive Alerts
        </h3>
        <span style={{
          padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: colors.orangeText, backgroundColor: colors.statusWarningSubtle ?? colors.surfaceInset,
        }}>{alerts.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
        {visible.map((alert) => {
          const s = severityStyles(alert.severity);
          const Icon = alert.icon;
          const clickable = !!alert.navigateTo && !!onNavigate;
          return (
            <button
              key={alert.id}
              onClick={() => clickable && onNavigate!(alert.navigateTo!)}
              disabled={!clickable}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
                padding: spacing['3'], borderRadius: borderRadius.base,
                backgroundColor: s.bg, borderLeft: `3px solid ${s.border}`,
                border: 'none', cursor: clickable ? 'pointer' : 'default',
                textAlign: 'left', width: '100%', fontFamily: typography.fontFamily,
              }}
            >
              <Icon size={18} color={s.color} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                  {alert.title}
                </p>
                <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {alert.description}
                </p>
              </div>
              {clickable && <ChevronRight size={14} color={colors.textTertiary} style={{ flexShrink: 0, marginTop: 4 }} />}
            </button>
          );
        })}
      </div>
    </Card>
  );
};

/** Floating indicator that shows a badge with the alert count. */
export const ProactiveAlertsBadge: React.FC<{ projectId: string | undefined; onClick?: () => void }> = ({ projectId, onClick }) => {
  const { data } = useProactiveAlerts(projectId);
  const count = data?.alerts.length ?? 0;
  const criticalCount = useMemo(() => data?.alerts.filter((a) => a.severity === 'critical').length ?? 0, [data]);
  if (count === 0) return null;
  const color = criticalCount > 0 ? colors.statusCritical : colors.orangeText;
  return (
    <button
      onClick={onClick}
      aria-label={`${count} proactive alerts`}
      style={{
        position: 'fixed', bottom: 84, right: 24, zIndex: 40,
        display: 'flex', alignItems: 'center', gap: spacing['2'],
        padding: `${spacing['2']} ${spacing['3']}`, borderRadius: borderRadius.full,
        backgroundColor: colors.surfaceRaised, color, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        border: `1px solid ${color}`, cursor: 'pointer', fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.medium,
      }}
    >
      <Bell size={16} />
      {count} alert{count === 1 ? '' : 's'}
    </button>
  );
};

export default ProactiveAlerts;

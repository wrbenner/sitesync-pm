/**
 * usePortfolioHealth — reads from the project_health_summary
 * materialized view and surfaces it to the portfolio dashboard.
 *
 * Lives in hooks/queries/ rather than alongside a feature page
 * because the data crosses the entire org and isn't tied to a
 * single project context.
 */

import { useQuery } from '@tanstack/react-query';

import { fromTable } from '../../lib/db/queries'
import { useAuthStore } from '../../stores/authStore';
import type { PortfolioProjectInput } from '../../types/portfolio';

export function usePortfolioHealth() {
  const { organization } = useAuthStore();
  return useQuery({
    queryKey: ['portfolio-health', organization?.id ?? null],
    enabled: Boolean(organization?.id),
    staleTime: 60_000,
    queryFn: async (): Promise<PortfolioProjectInput[]> => {
      if (!organization?.id) return [];
      const { data, error } = await fromTable('project_health_summary')
        .select('*')
        .eq('organization_id' as never, organization.id);
      if (error) {
        // Materialized view may not exist yet in older deploys —
        // graceful degradation.
        if (error.code === '42P01' || error.code === 'PGRST205') return [];
        throw error;
      }
      return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        project_id: String(r.project_id),
        project_name: String(r.project_name ?? ''),
        contract_value: Number(r.contract_value ?? 0),
        schedule_variance_days: Number(r.schedule_variance_days ?? 0),
        percent_complete: Number(r.percent_complete ?? 0),
        rfis_overdue: Number(r.rfis_overdue ?? 0),
        payapp_status: (r.payapp_status as PortfolioProjectInput['payapp_status']) ?? 'unknown',
        safety_incidents_ytd: Number(r.safety_incidents_ytd ?? 0),
        profit_margin_pct: Number(r.profit_margin_pct ?? 0),
        status: (r.status as PortfolioProjectInput['status']) ?? 'active',
      }));
    },
  });
}

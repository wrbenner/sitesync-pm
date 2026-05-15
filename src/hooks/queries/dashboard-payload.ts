import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

/**
 * FMEA P.WIDGET.1 (Wave 4) — batched dashboard payload.
 *
 * The dashboard mounts ~6 widgets, each historically running its own
 * useQuery against Supabase (≥ 6 parallel REST calls on first paint).
 * `get_dashboard_payload(p_project_id)` returns one JSONB blob with
 * widget-keyed projections so we can collapse the round-trips into a
 * single network call.
 *
 * This is a PARTIAL fix: two highest-traffic widgets (Compliance,
 * Portfolio) wire to this hook in the same patch. Remaining widgets
 * (CriticalPath, Carbon, EarnedValue, MyTasks, ActivityFeed) continue
 * running their own queries and migrate in follow-up patches.
 */

export interface DashboardPermitRow {
  id: string;
  type: string | null;
  permit_number: string | null;
  expiration_date: string | null;
}

export interface DashboardCertRow {
  id: string;
  company: string;
  policy_type: string | null;
  expiration_date: string | null;
}

export interface DashboardInspectionRow {
  id: string;
  type: string;
  date: string;
  status: string;
}

export interface DashboardComplianceShape {
  permits: DashboardPermitRow[];
  certs: DashboardCertRow[];
  inspections: DashboardInspectionRow[];
}

export interface DashboardPortfolioShape {
  project_id?: string;
  budget_total?: number | null;
  budget_spent?: number | null;
  schedule_variance_days?: number | null;
  overall_progress?: number | null;
  // Tolerated extras — the matview can grow without breaking the type.
  [key: string]: unknown;
}

export interface DashboardPayload {
  metrics: DashboardPortfolioShape;
  portfolio: DashboardPortfolioShape;
  compliance: DashboardComplianceShape;
  critical_path: Record<string, unknown>;
  carbon: Record<string, unknown>;
  earned_value: Record<string, unknown>;
}

const EMPTY_PAYLOAD: DashboardPayload = {
  metrics: {} as DashboardPortfolioShape,
  portfolio: {} as DashboardPortfolioShape,
  compliance: { permits: [], certs: [], inspections: [] },
  critical_path: {},
  carbon: {},
  earned_value: {},
};

function normalize(raw: unknown): DashboardPayload {
  if (!raw || typeof raw !== 'object') return EMPTY_PAYLOAD;
  const r = raw as Record<string, unknown>;
  const compliance = (r.compliance ?? {}) as Record<string, unknown>;
  return {
    metrics: (r.metrics ?? {}) as DashboardPortfolioShape,
    portfolio: (r.portfolio ?? {}) as DashboardPortfolioShape,
    compliance: {
      permits: Array.isArray(compliance.permits) ? (compliance.permits as DashboardPermitRow[]) : [],
      certs: Array.isArray(compliance.certs) ? (compliance.certs as DashboardCertRow[]) : [],
      inspections: Array.isArray(compliance.inspections)
        ? (compliance.inspections as DashboardInspectionRow[])
        : [],
    },
    critical_path: (r.critical_path ?? {}) as Record<string, unknown>,
    carbon: (r.carbon ?? {}) as Record<string, unknown>,
    earned_value: (r.earned_value ?? {}) as Record<string, unknown>,
  };
}

/**
 * Single TanStack query — every widget reads from this shared cache key
 * so first paint is ONE network round-trip.
 */
export function useDashboardPayload(projectId: string | undefined) {
  return useQuery<DashboardPayload>({
    queryKey: ['dashboard_payload', projectId],
    queryFn: async () => {
      if (!projectId) return EMPTY_PAYLOAD;
      const { data, error } = await supabase.rpc('get_dashboard_payload' as never, {
        p_project_id: projectId,
      } as never);
      if (error) {
        // Wrapper RPC may not exist on older deploys — degrade gracefully.
        return EMPTY_PAYLOAD;
      }
      return normalize(data);
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

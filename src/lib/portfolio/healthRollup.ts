/**
 * Portfolio health rollup. Pure function — no Supabase, no React.
 *
 * The materialized view in supabase/migrations/.../portfolio_health_view.sql
 * pre-aggregates per-project metrics. This function takes that
 * input array and produces the org-wide KPIs the dashboard renders.
 */

import type {
  PortfolioProjectInput,
  PortfolioHealth,
  RiskLevel,
} from '../../types/portfolio';
import { classifyRisk } from './riskRanker';

export function healthRollup(projects: PortfolioProjectInput[]): PortfolioHealth {
  const active = projects.filter((p) => (p.status ?? 'active') === 'active');

  const totalActiveValue = active.reduce(
    (s, p) => s + (Number.isFinite(p.contract_value) ? p.contract_value : 0),
    0,
  );
  const totalOpenRfis = active.reduce(
    (s, p) => s + (Number.isFinite(p.rfis_overdue) ? p.rfis_overdue : 0),
    0,
  );
  const totalIncidentsYtd = active.reduce(
    (s, p) => s + (Number.isFinite(p.safety_incidents_ytd) ? p.safety_incidents_ytd : 0),
    0,
  );

  const byStatus: Record<RiskLevel, number> = { green: 0, yellow: 0, red: 0 };
  for (const p of active) {
    byStatus[classifyRisk(p).riskLevel] += 1;
  }
  const projectsAtRisk = byStatus.red + byStatus.yellow;

  // Weighted % complete by contract value (so a $100M project at 50%
  // outweighs a $1M project at 90%).
  const totalValue = active.reduce((s, p) => s + Math.max(0, p.contract_value), 0);
  const weightedPercentComplete =
    totalValue > 0
      ? active.reduce(
          (s, p) => s + (p.percent_complete * Math.max(0, p.contract_value)),
          0,
        ) / totalValue
      : 0;

  return {
    totalActiveValue,
    totalOpenRfis,
    projectsAtRisk,
    totalIncidentsYtd,
    byStatus,
    totalProjects: active.length,
    weightedPercentComplete,
  };
}

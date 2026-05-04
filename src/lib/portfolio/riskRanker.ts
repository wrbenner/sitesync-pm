/**
 * Risk ranker — assigns each project a 0-100 score and a discrete
 * red / yellow / green classification with an explanatory factor list.
 *
 * Weights chosen for a typical GC operation: schedule and safety
 * dominate, with secondary signals from RFIs, payapp, and margin.
 * Tweak with caution — these affect the dashboard's "at risk" count.
 */

import type {
  PortfolioProjectInput,
  RiskRankedProject,
  RiskLevel,
} from '../../types/portfolio';

interface FactorWeight {
  weight: number;
  scorer: (p: PortfolioProjectInput) => number;
  reason: (p: PortfolioProjectInput) => string | null;
}

const FACTORS: FactorWeight[] = [
  // Schedule slip — anything past 14d slip starts to bite hard.
  {
    weight: 30,
    scorer: (p) => clamp(Math.abs(p.schedule_variance_days) / 60),
    reason: (p) =>
      p.schedule_variance_days < -7 ? `${Math.abs(p.schedule_variance_days)}d schedule slip` : null,
  },
  // Safety incidents YTD.
  {
    weight: 25,
    scorer: (p) => clamp(p.safety_incidents_ytd / 5),
    reason: (p) =>
      p.safety_incidents_ytd >= 1 ? `${p.safety_incidents_ytd} safety incidents YTD` : null,
  },
  // Overdue RFIs.
  {
    weight: 15,
    scorer: (p) => clamp(p.rfis_overdue / 20),
    reason: (p) => (p.rfis_overdue >= 5 ? `${p.rfis_overdue} RFIs overdue` : null),
  },
  // Profit margin erosion.
  {
    weight: 15,
    scorer: (p) => clamp((10 - p.profit_margin_pct) / 15),
    reason: (p) =>
      p.profit_margin_pct < 5 ? `Margin compressed to ${p.profit_margin_pct.toFixed(1)}%` : null,
  },
  // Pay app status.
  {
    weight: 10,
    scorer: (p) => (p.payapp_status === 'overdue' ? 1 : p.payapp_status === 'awaiting_review' ? 0.4 : 0),
    reason: (p) => (p.payapp_status === 'overdue' ? 'Pay app overdue' : null),
  },
  // Budget variance (if provided).
  {
    weight: 5,
    scorer: (p) => clamp(Math.abs(p.budget_variance_pct ?? 0) / 25),
    reason: (p) =>
      (p.budget_variance_pct ?? 0) > 10
        ? `Budget overrun ${(p.budget_variance_pct ?? 0).toFixed(1)}%`
        : null,
  },
];

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function classifyRisk(project: PortfolioProjectInput): RiskRankedProject {
  let score = 0;
  const factors: string[] = [];
  for (const f of FACTORS) {
    score += f.scorer(project) * f.weight;
    const r = f.reason(project);
    if (r) factors.push(r);
  }
  const riskScore = Math.round(Math.max(0, Math.min(100, score)));
  let riskLevel: RiskLevel = 'green';
  if (riskScore >= 60) riskLevel = 'red';
  else if (riskScore >= 30) riskLevel = 'yellow';
  return {
    ...project,
    riskScore,
    riskLevel,
    riskFactors: factors,
  };
}

export function riskRanker(
  projects: PortfolioProjectInput[],
): RiskRankedProject[] {
  return projects
    .map(classifyRisk)
    .sort((a, b) => b.riskScore - a.riskScore);
}

import React, { useMemo } from 'react';
import { Building2, ChevronRight } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { useProjects } from '../../hooks/queries';
import { useDashboardPayload } from '../../hooks/queries/dashboard-payload';
import { useProjectStore } from '../../stores/projectStore';
import type { Project } from '../../types/database';

// ────────────────────────────────────────────────────────────────
// Portfolio — cross-project health at a glance.
// Shown only when the user belongs to 2+ projects. Health is a
// coarse traffic-light derived from schedule variance and CPI proxy.
// ────────────────────────────────────────────────────────────────

type HealthColor = 'green' | 'yellow' | 'red';

interface ProjectHealthRow {
  id: string;
  name: string;
  health: HealthColor;
  reason: string;
  progress: number;
}

interface PortfolioMetricRow {
  project_id: string;
  budget_total: number | null;
  budget_spent: number | null;
  schedule_variance_days: number | null;
  overall_progress: number | null;
}

// FMEA P.WIDGET.1 (Wave 4): Portfolio now derives the active-project
// metrics row from the shared useDashboardPayload cache rather than
// running its own multi-project .rpc('get_project_metrics') round-trip.
// Cross-project portfolio still ultimately needs a multi-project RPC
// (P.WIDGET.1 follow-up); for now we degrade gracefully when only the
// active project's row is present.
function usePortfolioHealth(
  projects: Project[] | undefined,
  activeProjectId: string | null,
) {
  const { data: payload } = useDashboardPayload(activeProjectId ?? undefined);
  return useMemo<Record<string, PortfolioMetricRow>>(() => {
    if (!projects || projects.length === 0) return {};
    const map: Record<string, PortfolioMetricRow> = {};
    const portfolio = (payload?.portfolio ?? {}) as Partial<PortfolioMetricRow>;
    if (activeProjectId && portfolio.project_id === activeProjectId) {
      map[activeProjectId] = portfolio as PortfolioMetricRow;
    }
    return map;
  }, [projects, payload, activeProjectId]);
}

function deriveHealth(row: PortfolioMetricRow | undefined): { health: HealthColor; reason: string; progress: number } {
  if (!row) return { health: 'yellow', reason: 'No metrics yet', progress: 0 };
  const variance = row.schedule_variance_days ?? 0;
  const total = row.budget_total ?? 0;
  const spent = row.budget_spent ?? 0;
  const cpi = total > 0 ? total / Math.max(1, spent) : 1;
  // cpi > 1 is under-budget; < 1 is over-budget.

  if (variance < -14 || cpi < 0.85) {
    return { health: 'red', reason: variance < -14 ? `${Math.abs(variance)}d behind` : 'Over budget', progress: row.overall_progress ?? 0 };
  }
  if (variance < 0 || cpi < 0.95) {
    return { health: 'yellow', reason: variance < 0 ? `${Math.abs(variance)}d behind` : 'Tight budget', progress: row.overall_progress ?? 0 };
  }
  return { health: 'green', reason: variance > 0 ? `${variance}d ahead` : 'On track', progress: row.overall_progress ?? 0 };
}

const HEALTH_STYLE: Record<HealthColor, { dot: string; label: string }> = {
  green: { dot: colors.statusActive, label: 'Healthy' },
  yellow: { dot: colors.statusPending, label: 'Watch' },
  red: { dot: colors.statusCritical, label: 'At risk' },
};

export const DashboardPortfolio: React.FC = () => {
  const { data: projects } = useProjects();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const metricsMap = usePortfolioHealth(projects, activeProjectId);

  const rows = useMemo<ProjectHealthRow[]>(() => {
    return (projects ?? []).map((p) => {
      const h = deriveHealth(metricsMap[p.id]);
      return {
        id: p.id,
        name: p.name ?? 'Untitled',
        health: h.health,
        reason: h.reason,
        progress: h.progress,
      };
    }).sort((a, b) => {
      const order: Record<HealthColor, number> = { red: 0, yellow: 1, green: 2 };
      return order[a.health] - order[b.health];
    });
  }, [projects, metricsMap]);

  if (!projects || projects.length < 2) return null;

  return (
    <div style={{
      padding: spacing['4'],
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.xl,
      border: `1px solid ${colors.borderSubtle}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <Building2 size={12} color={colors.textTertiary} />
          <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Portfolio
          </span>
        </div>
        <span style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>
          {projects.length} projects
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: spacing['2'] }}>
        {rows.map((row) => {
          const style = HEALTH_STYLE[row.health];
          const isActive = row.id === activeProjectId;
          return (
            <button
              key={row.id}
              onClick={() => setActiveProject(row.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['2.5'],
                padding: `${spacing['2.5']} ${spacing['3']}`,
                backgroundColor: isActive ? colors.surfaceInset : 'transparent',
                border: `1px solid ${isActive ? colors.borderDefault : colors.borderSubtle}`,
                borderRadius: borderRadius.lg,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: typography.fontFamily,
                transition: 'background-color 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = colors.surfaceHover; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: style.dot, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1.5'], marginTop: 1 }}>
                  <span style={{ fontSize: '10px', color: style.dot, fontWeight: typography.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    {style.label}
                  </span>
                  <span style={{ fontSize: '10px', color: colors.textSecondary }}>· {row.reason}</span>
                </div>
              </div>
              <ChevronRight size={12} color={colors.textTertiary} style={{ flexShrink: 0 }} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

DashboardPortfolio.displayName = 'DashboardPortfolio';

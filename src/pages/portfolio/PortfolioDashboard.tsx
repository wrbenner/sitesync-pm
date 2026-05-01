/**
 * PortfolioDashboard — org-wide rollup of project health.
 *
 * Distinct from src/pages/Portfolio.tsx (the legacy single-file stub
 * left untouched per spec). This page reads from the
 * project_health_summary materialized view via usePortfolioHealth
 * and renders KPI tiles + a risk-ranked table.
 */

import React, { useMemo } from 'react';
import { Eyebrow, Hairline, PageQuestion, OrangeDot } from '../../components/atoms';
import { KpiTile } from '../../components/portfolio/KpiTile';
import { RiskTable } from '../../components/portfolio/RiskTable';
import { usePortfolioHealth } from '../../hooks/queries/portfolio-health';
import { healthRollup, riskRanker } from '../../lib/portfolio';
import { colors, typography } from '../../styles/theme';

export default function PortfolioDashboard() {
  const { data, isLoading, error } = usePortfolioHealth();

  const projects = useMemo(() => data ?? [], [data]);
  const rollup = useMemo(() => healthRollup(projects), [projects]);
  const ranked = useMemo(() => riskRanker(projects), [projects]);

  return (
    <main style={{ padding: '48px 64px', maxWidth: 1280, margin: '0 auto' }}>
      <Eyebrow>Portfolio</Eyebrow>
      <PageQuestion>Where does the work need attention this week?</PageQuestion>

      <Hairline spacing="normal" />

      {isLoading && (
        <div
          style={{
            fontFamily: typography.fontFamily.serif,
            fontStyle: 'italic',
            color: colors.textTertiary,
            padding: '32px 0',
          }}
        >
          Loading the rollup…
        </div>
      )}

      {!isLoading && projects.length === 0 && !error && (
        <div
          style={{
            fontFamily: typography.fontFamily.serif,
            fontStyle: 'italic',
            color: colors.textTertiary,
            padding: '32px 0',
          }}
        >
          No active projects in this organization.
        </div>
      )}

      {!isLoading && projects.length > 0 && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 0,
              borderBottom: '1px solid var(--hairline)',
            }}
          >
            <KpiTile
              label="Active value"
              value={'$' + (rollup.totalActiveValue / 1_000_000).toFixed(1) + 'M'}
              hint={`${rollup.totalProjects} active projects`}
            />
            <KpiTile
              label="Open RFIs"
              value={String(rollup.totalOpenRfis)}
            />
            <KpiTile
              label="Projects at risk"
              value={String(rollup.projectsAtRisk)}
              emphasis={rollup.projectsAtRisk > 0 ? 'attention' : 'normal'}
              hint={`${rollup.byStatus.red} red · ${rollup.byStatus.yellow} yellow`}
            />
            <KpiTile
              label="Incidents YTD"
              value={String(rollup.totalIncidentsYtd)}
            />
          </section>

          <Hairline spacing="wide" />

          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                fontFamily: typography.fontFamily.serif,
                fontSize: 22,
                fontWeight: 400,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {rollup.projectsAtRisk > 0 && <OrangeDot label="At-risk projects" />}
              <em>The risk-ranked roll call</em>
            </h2>
            <span
              style={{
                fontFamily: typography.fontFamily.sans,
                fontSize: 12,
                color: colors.textTertiary,
              }}
            >
              {ranked.length} projects
            </span>
          </header>

          <RiskTable projects={ranked} />
        </>
      )}
    </main>
  );
}

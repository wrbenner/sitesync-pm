/**
 * VarianceReport — schedule-vs-pay-app reconciliation table.
 *
 * Renders the per-line variance, color-coded by severity. Pure presentation:
 * the parent computes the report (via `reconcileScheduleVsPayApp`) and
 * passes it in. No data fetching, no Supabase.
 */

import React from 'react';
import type { ReconciliationReport } from '../../lib/reconciliation/scheduleVsPayApp';
import { colors, typography, spacing } from '../../styles/theme';
import { Eyebrow, Hairline, OrangeDot } from '../atoms';

interface VarianceReportProps {
  report: ReconciliationReport;
}

const severityColor: Record<string, string> = {
  ok: colors.statusActive,
  minor: colors.statusPending,
  material: colors.statusReview,
  critical: colors.statusCritical,
};

const severityLabel: Record<string, string> = {
  ok: 'OK',
  minor: 'Minor',
  material: 'Material',
  critical: 'Critical',
};

export const VarianceReport: React.FC<VarianceReportProps> = ({ report }) => {
  const fmtPct = (p: number | null) => (p == null ? '—' : `${p.toFixed(1)}%`);
  const fmtMoney = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <section style={{ marginTop: spacing['24'] }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <Eyebrow>Variance Report</Eyebrow>
          <div style={{ marginTop: 6, ...typography.body, color: colors.textSecondary }}>
            Schedule vs Pay App, applied tolerance ±{report.appliedTolerancePct.toFixed(0)}pp.
          </div>
        </div>
        {report.isBlocked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <OrangeDot label="Blocked" />
            <span style={{ fontFamily: typography.fontFamily, fontSize: 12, color: colors.statusCritical, fontWeight: 600 }}>
              {fmtMoney(report.blockedDollarsAtRisk)} at risk
            </span>
          </div>
        )}
      </header>

      <Hairline spacing="tight" />

      <div role="table" style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr 0.8fr 1fr 1.2fr', gap: 12 }}>
        <HeaderCell>Cost code / line</HeaderCell>
        <HeaderCell align="right">Schedule</HeaderCell>
        <HeaderCell align="right">Pay app</HeaderCell>
        <HeaderCell align="right">Δ</HeaderCell>
        <HeaderCell align="right">SOV $</HeaderCell>
        <HeaderCell>Severity / reason</HeaderCell>

        {report.lines.map(line => (
          <React.Fragment key={`${line.costCode}-${line.description}`}>
            <Cell>
              <div style={{ fontFamily: typography.fontFamily, fontWeight: 500, fontSize: 13, color: colors.textPrimary }}>
                {line.costCode}
              </div>
              <div style={{ fontFamily: typography.fontFamilySerif, fontSize: 13, color: colors.textSecondary }}>
                {line.description}
              </div>
            </Cell>
            <Cell align="right" mono>{fmtPct(line.schedulePct)}</Cell>
            <Cell align="right" mono>{fmtPct(line.payAppPct)}</Cell>
            <Cell align="right" mono>{line.variancePct == null ? '—' : `${line.variancePct > 0 ? '+' : ''}${line.variancePct.toFixed(1)}pp`}</Cell>
            <Cell align="right" mono>{fmtMoney(line.scheduledValue)}</Cell>
            <Cell>
              <div style={{ fontFamily: typography.fontFamily, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: severityColor[line.severity] }}>
                {severityLabel[line.severity]}
              </div>
              <div style={{ fontFamily: typography.fontFamilySerif, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                {line.reason}
              </div>
            </Cell>
          </React.Fragment>
        ))}
      </div>
    </section>
  );
};

const HeaderCell: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' }> = ({ children, align }) => (
  <div role="columnheader" style={{
    ...typography.eyebrow,
    fontSize: 10,
    color: colors.textTertiary,
    paddingBottom: 8,
    borderBottom: `1px solid ${colors.borderSubtle}`,
    textAlign: align ?? 'left',
  }}>
    {children}
  </div>
);

const Cell: React.FC<{ children: React.ReactNode; align?: 'left' | 'right'; mono?: boolean }> = ({ children, align, mono }) => (
  <div role="cell" style={{
    fontFamily: mono ? typography.fontFamilyMono : typography.fontFamily,
    fontSize: 13,
    color: colors.textPrimary,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottom: `1px solid ${colors.borderSubtle}`,
    textAlign: align ?? 'left',
  }}>
    {children}
  </div>
);

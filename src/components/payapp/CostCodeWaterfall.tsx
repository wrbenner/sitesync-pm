/**
 * CostCodeWaterfall — visualizes one cost code's lineage from budget to paid.
 *
 * Pure presentation. Parent passes a WaterfallRow. Each step renders a
 * dollar value, the running total, and an optional flag (over-committed,
 * over-billed, balance-to-pay highlight).
 */

import React from 'react';
import { colors, typography, spacing } from '../../styles/theme';
import type { WaterfallRow } from '../../lib/costCodes/waterfall';
import { Eyebrow } from '../atoms';

interface CostCodeWaterfallProps {
  row: WaterfallRow;
}

function fmtCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = abs - dollars * 100;
  return `${sign}$${dollars.toLocaleString('en-US')}.${rem.toString().padStart(2, '0')}`;
}

const stepColor: Record<string, string> = {
  budget_origin: colors.textSecondary,
  change_order: colors.statusInfo,
  budget_revised: colors.textPrimary,
  committed: colors.statusReview,
  invoiced: colors.statusPending,
  paid: colors.statusActive,
  balance: colors.primaryOrange,
};

export const CostCodeWaterfall: React.FC<CostCodeWaterfallProps> = ({ row }) => {
  return (
    <section style={{ marginBottom: spacing['24'] }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div>
          <Eyebrow>{row.costCode}</Eyebrow>
          <div style={{ fontFamily: typography.fontFamilySerif, fontSize: 18, color: colors.textPrimary, marginTop: 4 }}>
            {row.description}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {row.isOverCommitted && (
            <Flag color={colors.statusCritical} label="Over-committed" />
          )}
          {row.isOverBilled && (
            <Flag color={colors.statusCritical} label="Over-billed" />
          )}
        </div>
      </header>

      <div role="list" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 0,
        borderTop: `1px solid ${colors.borderSubtle}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
      }}>
        {row.steps.map((s, i) => (
          <div key={i} role="listitem" style={{
            padding: '14px 12px',
            borderRight: i < row.steps.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
          }}>
            <div style={{
              ...typography.eyebrow,
              fontSize: 9,
              color: colors.textTertiary,
              marginBottom: 6,
            }}>
              {s.label}
            </div>
            <div style={{
              fontFamily: typography.fontFamilyMono,
              fontSize: 14,
              fontWeight: 500,
              color: stepColor[s.kind] ?? colors.textPrimary,
            }}>
              {fmtCents(s.cents)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
        <Stat label="Uncommitted" cents={row.uncommittedCents} />
        <Stat label="Unbilled" cents={row.unbilledCents} />
        <Stat label="Receivable" cents={row.receivableCents} />
      </div>
    </section>
  );
};

const Flag: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span style={{
    ...typography.eyebrow,
    fontSize: 10,
    color,
    border: `1px solid ${color}`,
    padding: '4px 10px',
    borderRadius: 999,
  }}>
    {label}
  </span>
);

const Stat: React.FC<{ label: string; cents: number }> = ({ label, cents }) => (
  <div>
    <div style={{ ...typography.eyebrow, fontSize: 9, color: colors.textTertiary }}>{label}</div>
    <div style={{ fontFamily: typography.fontFamilyMono, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
      {fmtCents(cents)}
    </div>
  </div>
);

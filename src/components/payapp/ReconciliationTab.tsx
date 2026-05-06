/**
 * ReconciliationTab — top-level "Reconciled to the penny" tab for a Pay App.
 *
 * Composes the audited G702 summary, the variance report, and the cost-code
 * waterfall. Pure presentation; the parent loads pay-app data + invokes the
 * pure functions in src/lib/payApp + src/lib/reconciliation + src/lib/costCodes.
 *
 * Wiring: drop this into the existing PayAppDetail tab strip in
 * src/pages/payment-applications/PayAppDetail.tsx (see PLATINUM_FINANCIAL.md).
 */

import React from 'react';
import { colors, typography, spacing } from '../../styles/theme';
import {
  Eyebrow,
  Hairline,
  PageQuestion,
  SectionHeading,
  OrangeDot,
} from '../atoms';
import {
  computeG702Audited,
  formatCents,
  type G702Input,
} from '../../lib/payApp/g702Audited';
import {
  reconcileScheduleVsPayApp,
  type PayAppLineInput,
  type ScheduleActivityInput,
} from '../../lib/reconciliation/scheduleVsPayApp';
import {
  computeCostCodeWaterfallBatch,
  type WaterfallInput,
} from '../../lib/costCodes/waterfall';
import { VarianceReport } from './VarianceReport';
import { CostCodeWaterfall } from './CostCodeWaterfall';

interface ReconciliationTabProps {
  g702Input: G702Input;
  payAppLines: PayAppLineInput[];
  scheduleActivities: ScheduleActivityInput[];
  waterfallInputs: WaterfallInput[];
  /** Deterministic ISO date used for traceability. */
  asOfDate: string;
}

export const ReconciliationTab: React.FC<ReconciliationTabProps> = ({
  g702Input,
  payAppLines,
  scheduleActivities,
  waterfallInputs,
  asOfDate,
}) => {
  const g702 = computeG702Audited(g702Input);
  const variance = reconcileScheduleVsPayApp(payAppLines, scheduleActivities, { asOfDate });
  const waterfalls = computeCostCodeWaterfallBatch(waterfallInputs);

  return (
    <div style={{ paddingTop: spacing['24'] }}>
      <header>
        <Eyebrow>Reconciliation</Eyebrow>
        <PageQuestion size="medium">Does every dollar reconcile to the penny?</PageQuestion>
      </header>

      <Hairline />

      <section aria-labelledby="g702-summary">
        <SectionHeading level={3}>
          <span id="g702-summary">G702 audited summary</span>
        </SectionHeading>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 24,
          marginTop: spacing['16'],
        }}>
          <SummaryNumber label="Contract sum to date" value={formatCents(g702.contractSumToDateCents)} />
          <SummaryNumber label="Total completed & stored" value={formatCents(g702.totalCompletedAndStoredCents)} />
          <SummaryNumber
            label={g702.isFinalPayApp ? 'Retainage (released)' : `Retainage (${g702.retainagePctApplied}%)`}
            value={formatCents(g702.retainageCents)}
          />
          <SummaryNumber label="Earned less retainage" value={formatCents(g702.totalEarnedLessRetainageCents)} />
          <SummaryNumber label="Less previous certs" value={formatCents(g702.lessPreviousCertificatesCents)} />
          <SummaryNumber
            label="Current payment due"
            value={formatCents(g702.currentPaymentDueCents)}
            highlight
          />
        </div>
      </section>

      <Hairline />

      <VarianceReport report={variance} />

      <Hairline />

      <section aria-labelledby="waterfall">
        <SectionHeading level={3}>
          <span id="waterfall">Cost-code waterfall</span>
        </SectionHeading>
        <div style={{ marginTop: spacing['16'] }}>
          {waterfalls.map(row => (
            <CostCodeWaterfall key={row.costCode} row={row} />
          ))}
        </div>
      </section>

      <footer style={{ marginTop: spacing['24'], display: 'flex', alignItems: 'center', gap: 8 }}>
        <OrangeDot label={`As of ${asOfDate}`} />
        <span style={{
          fontFamily: typography.fontFamily,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          color: colors.textTertiary,
        }}>
          As of {asOfDate}
        </span>
      </footer>
    </div>
  );
};

const SummaryNumber: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div>
    <div style={{
      ...typography.eyebrow,
      fontSize: 10,
      color: colors.textTertiary,
    }}>
      {label}
    </div>
    <div style={{
      fontFamily: typography.fontFamilyMono,
      fontSize: highlight ? 28 : 22,
      fontWeight: highlight ? 600 : 500,
      color: highlight ? colors.primaryOrange : colors.textPrimary,
      marginTop: 6,
    }}>
      {value}
    </div>
  </div>
);

import React, { useState } from 'react';
import { PageContainer, Card, SectionHeader, MetricBox, ProgressBar, StatusTag, DetailPanel, RelatedItems, Skeleton, useToast } from '../components/Primitives';
import { Btn } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { useQuery } from '../hooks/useQuery';
import { getCostData } from '../api/endpoints/budget';
import { getProject } from '../api/endpoints/projects';
import { useAppNavigate, getRelatedItemsForChangeOrder } from '../utils/connections';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { PredictiveAlertBanner } from '../components/ai/PredictiveAlert';
import { getAnnotationsForEntity, getPredictiveAlertsForPage } from '../data/aiAnnotations';
import { Treemap } from '../components/budget/Treemap';
import { SCurve } from '../components/budget/SCurve';
import { EarnedValueDashboard } from '../components/budget/EarnedValueDashboard';
import { Download, AlertTriangle, ChevronRight } from 'lucide-react';

const fmt = (n: number): string => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

export const Budget: React.FC = () => {
  const appNavigate = useAppNavigate();
  const { addToast } = useToast();
  const { data: costData, loading: costLoading } = useQuery('costData', getCostData);
  const { data: projectData, loading: projectLoading } = useQuery('projectData', getProject);
  const [selectedCO, setSelectedCO] = useState<NonNullable<typeof costData>['changeOrders'][0] | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'earned-value'>('overview');

  if (costLoading || projectLoading || !costData || !projectData) {
    return (
      <PageContainer title="Budget" subtitle="Loading...">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.lg, marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} height="80px" />)}
        </div>
        <SectionHeader title="Cost by Division" />
        <Card padding={spacing.xl}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ marginBottom: spacing.xl }}>
              <Skeleton width="40%" height="14px" />
              <div style={{ marginTop: spacing.sm }}><Skeleton width="100%" height="6px" /></div>
            </div>
          ))}
        </Card>
        <div style={{ marginTop: spacing['2xl'] }}>
          <SectionHeader title="Change Orders" />
          <Card padding="0">
            <div style={{ padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} height="44px" />)}
            </div>
          </Card>
        </div>
      </PageContainer>
    );
  }

  const pageAlerts = getPredictiveAlertsForPage('budget');

  const committed = costData.divisions.reduce((sum, d) => sum + d.committed, 0);
  const spent = costData.divisions.reduce((sum, d) => sum + d.spent, 0);
  const remaining = projectData.totalValue - spent - committed;

  // Fix 4: Extended change orders
  const allChangeOrders = [
    ...costData.changeOrders,
    { id: 4, coNumber: 'CO-004', title: 'Lobby marble upgrade per owner request', amount: 78000, status: 'pending_approval' },
    { id: 5, coNumber: 'CO-005', title: 'Fire suppression system modifications', amount: 42000, status: 'approved' },
  ];

  const approvedTotal = allChangeOrders.filter(co => co.status === 'approved').reduce((s, co) => s + co.amount, 0);

  // Fix 5: Contingency
  const consumed = approvedTotal;
  const contingencyRemaining = 3800000 - consumed;

  const pillBase: React.CSSProperties = {
    padding: `${spacing['1']} ${spacing['3']}`,
    borderRadius: borderRadius.full,
    border: 'none',
    cursor: 'pointer',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily,
    transition: 'all 0.15s ease',
  };

  return (
    <PageContainer
      title="Budget"
      subtitle={`${fmt(spent)} spent of ${fmt(projectData.totalValue)} total`}
      actions={<Btn variant="secondary" size="sm" icon={<Download size={14} />} onClick={() => addToast('info', 'Exporting budget data to CSV...')}>Export CSV</Btn>}
    >
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} />
      ))}

      {/* Summary Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: spacing.lg,
          marginBottom: spacing['4'],
        }}
      >
        <MetricBox label="Total Project" value={fmt(projectData.totalValue)} />
        <MetricBox label="Spent to Date" value={fmt(spent)} />
        <MetricBox label="Committed" value={fmt(committed)} />
        <MetricBox label="Remaining" value={fmt(remaining)} />
      </div>

      {/* Fix 5: Contingency Drawdown */}
      <div style={{ marginBottom: spacing['4'] }}>
        <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0, marginBottom: spacing['2'] }}>Contingency Drawdown</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <div style={{ flex: 1, height: 12, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${(consumed / 3800000) * 100}%`, height: '100%', backgroundColor: colors.statusPending, borderRadius: borderRadius.full }} />
          </div>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {fmt(contingencyRemaining)} of $3.8M remaining
          </span>
        </div>
      </div>

      {/* Tab Toggle */}
      <div style={{ display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, padding: 2, marginBottom: spacing['5'] }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            ...pillBase,
            backgroundColor: activeTab === 'overview' ? colors.surfaceRaised : 'transparent',
            color: activeTab === 'overview' ? colors.textPrimary : colors.textTertiary,
            boxShadow: activeTab === 'overview' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('earned-value')}
          style={{
            ...pillBase,
            backgroundColor: activeTab === 'earned-value' ? colors.surfaceRaised : 'transparent',
            color: activeTab === 'earned-value' ? colors.textPrimary : colors.textTertiary,
            boxShadow: activeTab === 'earned-value' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          Earned Value
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Cost Distribution Treemap */}
          <SectionHeader title="Cost Distribution" action={<span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color: colors.primaryOrange, fontWeight: typography.fontWeight.medium, cursor: 'pointer' }}>Click to drill down <ChevronRight size={12} /></span>} />
          <Card padding={spacing['5']}>
            <Treemap divisions={costData.divisions} />
          </Card>

          {/* Fix 1: Division Health */}
          <div style={{ marginTop: spacing['4'] }}>
            <SectionHeader title="Division Health" />
            <Card padding={spacing['4']}>
              {costData.divisions.map((division) => {
                const pct = Math.round((division.spent / division.budget) * 100);
                const isAtRisk = pct >= 90;
                return (
                  <div key={division.id} style={{
                    display: 'flex', alignItems: 'center', gap: spacing['3'],
                    padding: `${spacing['3']} ${spacing['3']}`,
                    borderLeft: isAtRisk ? '4px solid #E05252' : '4px solid transparent',
                    backgroundColor: isAtRisk ? 'rgba(224, 82, 82, 0.04)' : 'transparent',
                    borderRadius: borderRadius.sm, marginBottom: spacing['2'],
                  }}>
                    {isAtRisk && <AlertTriangle size={16} color="#E05252" />}
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, flex: 1 }}>
                      {division.name}
                      {getAnnotationsForEntity('budget_division', division.id).map((ann) => (
                        <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                      ))}
                    </span>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: isAtRisk ? '#E05252' : colors.textSecondary }}>
                      {pct}%
                    </span>
                    <div style={{ width: '80px', flexShrink: 0 }}>
                      <ProgressBar value={pct} height={4} color={isAtRisk ? '#E05252' : pct >= 70 ? colors.statusPending : colors.statusInfo} />
                    </div>
                    {isAtRisk && (
                      <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: '#E05252', backgroundColor: 'rgba(224, 82, 82, 0.08)', padding: '2px 8px', borderRadius: borderRadius.full, whiteSpace: 'nowrap' }}>At Risk</span>
                    )}
                  </div>
                );
              })}
            </Card>
          </div>

          {/* S Curve */}
          <div style={{ marginTop: spacing['5'] }}>
            <SectionHeader title="Cumulative Cost (S Curve)" />
            <Card padding={spacing['5']}>
              <SCurve totalBudget={projectData.totalValue} spent={spent} />
            </Card>
          </div>

          {/* Change Orders */}
          <div style={{ marginTop: spacing['2xl'] }}>
            <SectionHeader title="Change Orders" />
            <Card padding="0">
              {/* Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr 120px 140px',
                  padding: `${spacing.md} ${spacing.xl}`,
                  borderBottom: `1px solid ${colors.borderLight}`,
                }}
              >
                {['CO #', 'Title', 'Amount', 'Status'].map((label) => (
                  <span
                    key={label}
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.medium,
                      color: colors.textTertiary,
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>

              {/* Rows */}
              {allChangeOrders.map((co, i) => (
                <div
                  key={co.id}
                  onClick={() => setSelectedCO(co)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 120px 140px',
                    padding: `${spacing.lg} ${spacing.xl}`,
                    borderBottom: i < allChangeOrders.length - 1 ? `1px solid ${colors.borderLight}` : 'none',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.medium,
                      color: colors.textPrimary,
                    }}
                  >
                    {co.coNumber}
                  </span>
                  <span
                    style={{
                      fontSize: typography.fontSize.sm,
                      color: colors.textPrimary,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: spacing.xs,
                    }}
                  >
                    {co.title}
                    {getAnnotationsForEntity('change_order', co.id).map((ann) => (
                      <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                    ))}
                  </span>
                  <span
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.textPrimary,
                    }}
                  >
                    {fmt(co.amount)}
                  </span>
                  <StatusTag
                    status={co.status === 'approved' ? 'approved' : 'pending_approval'}
                  />
                </div>
              ))}

              {/* Running Total */}
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 120px 140px', padding: `${spacing.md} ${spacing.xl}`, borderTop: `2px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceInset }}>
                <span></span>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Approved Total</span>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(approvedTotal)}</span>
                <span></span>
              </div>
            </Card>
          </div>
        </>
      )}

      {activeTab === 'earned-value' && (
        <>
          <SectionHeader title="Earned Value Analysis" />
          <Card padding={spacing['5']}>
            <EarnedValueDashboard totalBudget={projectData.totalValue} spent={spent} progress={Math.round((spent / projectData.totalValue) * 100)} />
          </Card>
        </>
      )}

      <DetailPanel open={!!selectedCO} onClose={() => setSelectedCO(null)} title={selectedCO?.coNumber || ''}>
        {selectedCO && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
            <div>
              <h3 style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing.md }}>
                {selectedCO.title}
              </h3>
              <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
                <StatusTag status={selectedCO.status === 'approved' ? 'approved' : 'pending_approval'} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount</div>
              <div style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(selectedCO.amount)}</div>
            </div>
            <RelatedItems items={getRelatedItemsForChangeOrder(selectedCO.id)} onNavigate={appNavigate} />
          </div>
        )}
      </DetailPanel>
    </PageContainer>
  );
};

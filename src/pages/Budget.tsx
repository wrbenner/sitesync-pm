import React, { useState, useMemo } from 'react';
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
import { WaterfallChart } from '../components/budget/WaterfallChart';
import { Download, AlertTriangle, ChevronRight, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useProjectId } from '../hooks/useProjectId';
import { useUpdateChangeOrder } from '../hooks/mutations';
import { PermissionGate } from '../components/auth/PermissionGate';
import { getCOTypeConfig, getCOStatusConfig } from '../machines/changeOrderMachine';
import type { ChangeOrderType, ChangeOrderState } from '../machines/changeOrderMachine';
import { useNavigate } from 'react-router-dom';

const fmt = (n: number): string => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

export const Budget: React.FC = () => {
  const appNavigate = useAppNavigate();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const projectId = useProjectId();
  const updateCO = useUpdateChangeOrder();
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

  const committed = useMemo(() => costData.divisions.reduce((sum, d) => sum + d.committed, 0), [costData.divisions]);
  const spent = useMemo(() => costData.divisions.reduce((sum, d) => sum + d.spent, 0), [costData.divisions]);
  const remaining = useMemo(() => projectData.totalValue - spent - committed, [projectData.totalValue, spent, committed]);

  // Change orders from real data only
  const allChangeOrders = costData.changeOrders || [];

  const approvedTotal = useMemo(() => allChangeOrders.filter(co => co.status === 'approved').reduce((s, co) => s + co.amount, 0), [allChangeOrders]);

  // Fix 5: Contingency
  const consumed = approvedTotal;
  const contingencyRemaining = useMemo(() => 3800000 - consumed, [consumed]);

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
        role="group"
        aria-label="Budget summary metrics"
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
          <div role="progressbar" aria-label="Contingency drawdown" aria-valuenow={Math.round((consumed / 3800000) * 100)} aria-valuemin={0} aria-valuemax={100} style={{ flex: 1, height: 12, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${(consumed / 3800000) * 100}%`, height: '100%', backgroundColor: colors.statusPending, borderRadius: borderRadius.full }} />
          </div>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {fmt(contingencyRemaining)} of $3.8M remaining
          </span>
        </div>
      </div>

      {/* Tab Toggle */}
      <div role="tablist" aria-label="Budget views" style={{ display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, padding: 2, marginBottom: spacing['5'] }}>
        <button
          role="tab"
          aria-selected={activeTab === 'overview'}
          aria-controls="budget-tab-overview"
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
          role="tab"
          aria-selected={activeTab === 'earned-value'}
          aria-controls="budget-tab-earned-value"
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
        <div role="tabpanel" id="budget-tab-overview" aria-label="Overview">
          {/* Cost Distribution Treemap */}
          <SectionHeader title="Cost Distribution" action={<span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color: colors.orangeText, fontWeight: typography.fontWeight.medium, cursor: 'pointer' }}>Click to drill down <ChevronRight size={12} aria-hidden="true" /></span>} />
          <Card padding={spacing['5']}>
            <div role="img" aria-label="Cost distribution treemap showing budget allocation across divisions">
              <Treemap divisions={costData.divisions} />
            </div>
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
                    borderLeft: isAtRisk ? `4px solid ${colors.chartRed}` : '4px solid transparent',
                    backgroundColor: isAtRisk ? colors.statusCriticalSubtle : 'transparent',
                    borderRadius: borderRadius.sm, marginBottom: spacing['2'],
                  }}>
                    {isAtRisk && <AlertTriangle size={16} color={colors.chartRed} />}
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, flex: 1 }}>
                      {division.name}
                      {getAnnotationsForEntity('budget_division', division.id).map((ann) => (
                        <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                      ))}
                    </span>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: isAtRisk ? colors.chartRed : colors.textSecondary }}>
                      {pct}%
                    </span>
                    <div style={{ width: '80px', flexShrink: 0 }}>
                      <ProgressBar value={pct} height={4} color={isAtRisk ? colors.chartRed : pct >= 70 ? colors.statusPending : colors.statusInfo} />
                    </div>
                    {isAtRisk && (
                      <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.chartRed, backgroundColor: colors.statusCriticalSubtle, padding: '2px 8px', borderRadius: borderRadius.full, whiteSpace: 'nowrap' }}>At Risk</span>
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
              <div role="img" aria-label="S Curve chart showing cumulative cost over time against total budget">
                <SCurve totalBudget={projectData.totalValue} spent={spent} />
              </div>
            </Card>
          </div>

          {/* CO Budget Impact */}
          <div style={{ marginTop: spacing['5'] }}>
            <SectionHeader title="Change Order Impact" />
            <Card padding={spacing['5']}>
              <div role="img" aria-label="Waterfall chart showing change order impact on budget">
              <WaterfallChart
                originalContract={projectData.totalValue}
                approvedCOs={approvedTotal}
                pendingCOs={allChangeOrders.filter(co => co.status !== 'approved' && co.status !== 'rejected' && co.status !== 'void').reduce((s, co) => s + (co.estimated_cost || co.amount), 0)}
                rejectedCOs={allChangeOrders.filter(co => co.status === 'rejected').reduce((s, co) => s + (co.estimated_cost || co.amount), 0)}
              />
              </div>
            </Card>
          </div>

          {/* Change Orders */}
          <div style={{ marginTop: spacing['2xl'] }}>
            <SectionHeader title="Change Orders" action={
              <Btn variant="ghost" size="sm" icon={<ArrowRight size={12} />} iconPosition="right" onClick={() => navigate('/change-orders')}>View Pipeline</Btn>
            } />
            <Card padding="0">
              {/* Header */}
              <div role="table" aria-label="Change orders">
              <div role="rowgroup">
              <div role="row" style={{ display: 'grid', gridTemplateColumns: '80px 60px 1fr 120px 140px', padding: `${spacing.md} ${spacing.xl}`, borderBottom: `1px solid ${colors.borderLight}` }}>
                {['Number', 'Type', 'Title', 'Amount', 'Status'].map((label) => (
                  <span role="columnheader" key={label} style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>{label}</span>
                ))}
              </div>
              </div>

              {/* Rows */}
              <div role="rowgroup">
              {allChangeOrders.slice(0, 10).map((co, i) => {
                const coType = (co as any).type as ChangeOrderType || 'co';
                const coStatus = co.status as ChangeOrderState || 'draft';
                const typeConfig = getCOTypeConfig(coType);
                const statusConfig = getCOStatusConfig(coStatus);
                return (
                  <div role="row" tabIndex={0} key={co.id} onClick={() => setSelectedCO(co as any)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCO(co as any); } }} style={{
                    display: 'grid', gridTemplateColumns: '80px 60px 1fr 120px 140px',
                    padding: `${spacing.lg} ${spacing.xl}`,
                    borderBottom: i < allChangeOrders.length - 1 ? `1px solid ${colors.borderLight}` : 'none',
                    alignItems: 'center', cursor: 'pointer',
                  }}>
                    <span role="cell" style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{co.coNumber}</span>
                    <span role="cell" style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: typeConfig.color }}>{typeConfig.shortLabel}</span>
                    <span role="cell" style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, display: 'inline-flex', alignItems: 'center', gap: spacing.xs }}>
                      {co.title}
                      {getAnnotationsForEntity('change_order', co.id).map((ann) => (
                        <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                      ))}
                    </span>
                    <span role="cell" style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(co.amount)}</span>
                    <span role="cell" style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: statusConfig.color, backgroundColor: statusConfig.bg, padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full, textAlign: 'center' }}>{statusConfig.label}</span>
                  </div>
                );
              })}
              </div>

              {/* Running Totals */}
              <div role="rowgroup">
              <div role="row" style={{ display: 'grid', gridTemplateColumns: '80px 60px 1fr 120px 140px', padding: `${spacing.md} ${spacing.xl}`, borderTop: `2px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceInset }}>
                <span role="cell"></span>
                <span role="cell"></span>
                <span role="cell" style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Approved Total</span>
                <span role="cell" style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusActive }}>{fmt(approvedTotal)}</span>
                <span role="cell"></span>
              </div>
              </div>
              </div>
              {allChangeOrders.length > 10 && (
                <div style={{ padding: `${spacing['3']} ${spacing.xl}`, textAlign: 'center' }}>
                  <Btn variant="ghost" size="sm" onClick={() => navigate('/change-orders')}>View all {allChangeOrders.length} change orders</Btn>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'earned-value' && (
        <div role="tabpanel" id="budget-tab-earned-value" aria-label="Earned Value">
          <SectionHeader title="Earned Value Analysis" />
          <Card padding={spacing['5']}>
            <div role="img" aria-label="Earned value analysis dashboard showing budget performance indicators">
              <EarnedValueDashboard totalBudget={projectData.totalValue} spent={spent} progress={Math.round((spent / projectData.totalValue) * 100)} />
            </div>
          </Card>
        </div>
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
            {selectedCO.status !== 'approved' && (
              <PermissionGate permission="change_orders.approve">
              <div style={{ paddingTop: spacing.md, borderTop: `1px solid ${colors.borderLight}` }}>
                <Btn
                  variant="primary"
                  onClick={async () => {
                    try {
                      await updateCO.mutateAsync({
                        id: String(selectedCO.id),
                        updates: { status: 'approved', approved_date: new Date().toISOString().slice(0, 10) },
                        projectId: projectId!,
                      });
                      toast.success('Change order approved');
                      setSelectedCO(null);
                    } catch {
                      toast.error('Failed to approve change order');
                    }
                  }}
                >
                  Approve Change Order
                </Btn>
              </div>
              </PermissionGate>
            )}
          </div>
        )}
      </DetailPanel>
    </PageContainer>
  );
};

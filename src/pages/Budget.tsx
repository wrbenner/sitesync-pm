import React, { useState, useMemo, useRef, useEffect, useId } from 'react';
import { PageContainer, Card, SectionHeader, MetricBox, ProgressBar, StatusTag, DetailPanel, RelatedItems, Skeleton, useToast } from '../components/Primitives';
import { MetricCardSkeleton, TableRowSkeleton } from '../components/ui/Skeletons';
import { Btn } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { useQuery } from '../hooks/useQuery';
import { getCostData, getCostCodesByDivision } from '../api/endpoints/budget';
import type { MappedDivision } from '../api/endpoints/budget';
import { getProject } from '../api/endpoints/projects';
import { Drawer } from '../components/Drawer';
import { useTableKeyboardNavigation } from '../hooks/useTableKeyboardNavigation';
import { useAppNavigate, getRelatedItemsForChangeOrder } from '../utils/connections';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { PredictiveAlertBanner } from '../components/ai/PredictiveAlert';
import { getAnnotationsForEntity, getPredictiveAlertsForPage } from '../data/aiAnnotations';
import { Treemap } from '../components/budget/Treemap';
import { SCurve } from '../components/budget/SCurve';
import { EarnedValueDashboard } from '../components/budget/EarnedValueDashboard';
import { WaterfallChart } from '../components/budget/WaterfallChart';
import { Download, AlertTriangle, ChevronRight, ArrowRight, BookOpen, Upload, Sparkles, X } from 'lucide-react';
import { computeDivisionFinancials, computeProjectFinancials, detectBudgetAnomalies } from '../lib/financialEngine';
import { BudgetUpload } from '../components/budget/BudgetUpload';
import { EmptyState } from '../components/Primitives';
import { toast } from 'sonner';
import { useProjectId } from '../hooks/useProjectId';
import { useUpdateChangeOrder } from '../hooks/mutations';
import { PermissionGate } from '../components/auth/PermissionGate';
import { getCOTypeConfig, getCOStatusConfig } from '../machines/changeOrderMachine';
import type { ChangeOrderType, ChangeOrderState } from '../machines/changeOrderMachine';
import { useNavigate } from 'react-router-dom'
import { useBudgetRealtime } from '../hooks/queries/realtime'
import { MetricFlash } from '../components/ui/RealtimeFlash';

const fmt = (n: number): string => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

const DivisionDrawerContent: React.FC<{ division: MappedDivision; projectId: string }> = ({ division, projectId }) => {
  const { data, loading } = useQuery(
    `division-detail-${division.id}`,
    () => getCostCodesByDivision(projectId, division.id),
  );

  const total = division.budget + division.committed + division.spent;
  const budgetPct = total > 0 ? (division.budget / total) * 100 : 0;
  const committedPct = total > 0 ? (division.committed / total) * 100 : 0;
  const spentPct = total > 0 ? (division.spent / total) * 100 : 0;

  const labelStyle: React.CSSProperties = {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.medium,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    marginBottom: spacing['1'],
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing['3'],
    marginTop: spacing['5'],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      {/* Header */}
      <div>
        {division.csi_division && (
          <p style={{ ...labelStyle, margin: 0, marginBottom: spacing['1'] }}>{division.csi_division}</p>
        )}
        <h3 style={{ fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
          {division.name}
        </h3>
        {division.cost_code && (
          <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>
            Cost Code: {division.cost_code}
          </p>
        )}
      </div>

      {/* Budget vs Committed vs Spent stacked bar */}
      <div>
        <p style={labelStyle}>Budget Breakdown</p>
        <div style={{ display: 'flex', height: 12, borderRadius: borderRadius.full, overflow: 'hidden', gap: 2 }}>
          <div style={{ width: `${budgetPct}%`, backgroundColor: colors.statusInfo, borderRadius: borderRadius.full, transition: 'width 0.3s ease' }} title={`Budget: ${fmt(division.budget)}`} />
          <div style={{ width: `${committedPct}%`, backgroundColor: colors.statusPending, borderRadius: borderRadius.full, transition: 'width 0.3s ease' }} title={`Committed: ${fmt(division.committed)}`} />
          <div style={{ width: `${spentPct}%`, backgroundColor: colors.statusCritical, borderRadius: borderRadius.full, transition: 'width 0.3s ease' }} title={`Spent: ${fmt(division.spent)}`} />
        </div>
        <div style={{ display: 'flex', gap: spacing['4'], marginTop: spacing['2'] }}>
          {[
            { label: 'Budget', value: division.budget, color: colors.statusInfo },
            { label: 'Committed', value: division.committed, color: colors.statusPending },
            { label: 'Spent', value: division.spent, color: colors.statusCritical },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{label}: </span>
              <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(value)}</span>
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} height="36px" />)}
        </div>
      )}

      {data && (
        <>
          {/* Cost Codes / Job Cost Entries */}
          <div>
            <p style={sectionTitleStyle}>Cost Entries ({data.costCodes.length})</p>
            {data.costCodes.length === 0 ? (
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>No cost entries recorded.</p>
            ) : (
              <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 80px 100px', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset }}>
                  {['Date', 'Description', 'Type', 'Amount'].map((h) => (
                    <span key={h} style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>{h}</span>
                  ))}
                </div>
                {data.costCodes.map((entry, i) => (
                  <div key={entry.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 80px 100px', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: i < data.costCodes.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none', alignItems: 'center' }}>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{entry.date ?? 'N/A'}</span>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{entry.description || entry.cost_code}</span>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{entry.cost_type ?? ''}</span>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(entry.amount ?? 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Change Orders */}
          <div>
            <p style={sectionTitleStyle}>Change Orders ({data.changeOrders.length})</p>
            {data.changeOrders.length === 0 ? (
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>No change orders linked to this division.</p>
            ) : (
              <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset }}>
                  {['Number', 'Title', 'Amount'].map((h) => (
                    <span key={h} style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>{h}</span>
                  ))}
                </div>
                {data.changeOrders.map((co, i) => (
                  <div key={co.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: i < data.changeOrders.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none', alignItems: 'center' }}>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{co.coNumber}</span>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{co.title}</span>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(co.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invoices */}
          <div>
            <p style={sectionTitleStyle}>Invoices to Date ({data.invoices.length})</p>
            {data.invoices.length === 0 ? (
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>No invoices recorded for this division.</p>
            ) : (
              <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset }}>
                  {['Vendor', 'Date', 'Total'].map((h) => (
                    <span key={h} style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>{h}</span>
                  ))}
                </div>
                {data.invoices.map((inv, i) => (
                  <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: i < data.invoices.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{inv.vendor}</span>
                      {inv.invoice_number && <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block' }}>#{inv.invoice_number}</span>}
                    </div>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{inv.invoice_date ?? 'N/A'}</span>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(inv.total ?? 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export const Budget: React.FC = () => {
  const appNavigate = useAppNavigate();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const projectId = useProjectId();
  const updateCO = useUpdateChangeOrder();
  const { isFlashing } = useBudgetRealtime(projectId);
  const { data: costData, loading: costLoading } = useQuery(`costData-${projectId}`, () => getCostData(projectId!), { enabled: !!projectId });
  const { data: projectData, loading: projectLoading } = useQuery(`projectData-${projectId}`, () => getProject(projectId!), { enabled: !!projectId });
  const [selectedCO, setSelectedCO] = useState<NonNullable<typeof costData>['changeOrders'][0] | null>(null);
  const [selectedDivision, setSelectedDivision] = useState<MappedDivision | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'earned-value'>('overview');
  const [uploadOpen, setUploadOpen] = useState(false);

  const divisionRows = costData?.divisions ?? [];
  const divListRef = useRef<HTMLDivElement>(null);
  const divGridId = useId();
  const { focusedIndex: divFocusedIndex, handleKeyDown: divHandleKeyDown, activeRowId: divActiveRowId } = useTableKeyboardNavigation({
    rowCount: divisionRows.length,
    onActivate: (i) => setSelectedDivision(divisionRows[i] ?? null),
    rowIdPrefix: divGridId,
  });

  useEffect(() => {
    if (divListRef.current?.contains(document.activeElement)) {
      const row = divListRef.current.querySelector<HTMLElement>(`[data-div-index="${divFocusedIndex}"]`);
      row?.focus({ preventScroll: false });
    }
  }, [divFocusedIndex]);

  if (costLoading || projectLoading || !costData || !projectData) {
    return (
      <PageContainer title="Budget" subtitle="Loading...">
        <MetricCardSkeleton />
        <Card padding="0">
          <TableRowSkeleton rows={8} />
        </Card>
      </PageContainer>
    );
  }

  const isEmpty = costData.divisions.length === 0;
  const pageAlerts = getPredictiveAlertsForPage('budget');

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const divisionFinancials = useMemo(
    () => computeDivisionFinancials(costData.divisions, costData.changeOrders),
    [costData.divisions, costData.changeOrders]
  );
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const projectFinancials = useMemo(
    () => computeProjectFinancials(costData.divisions, costData.changeOrders, projectData.totalValue),
    [costData.divisions, costData.changeOrders, projectData.totalValue]
  );
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const budgetAnomalies = useMemo(
    () => detectBudgetAnomalies(projectFinancials, divisionFinancials),
    [projectFinancials, divisionFinancials]
  );
  const criticalAnomalies = budgetAnomalies.filter(a => a.severity === 'critical');

  const committed = useMemo(() => costData.divisions.reduce((sum, d) => sum + d.committed, 0), [costData.divisions]);
  const spent = useMemo(() => costData.divisions.reduce((sum, d) => sum + d.spent, 0), [costData.divisions]);
  const remaining = useMemo(() => projectData.totalValue - spent - committed, [projectData.totalValue, spent, committed]);

  // elapsedFraction: weighted average physical progress across divisions, used as schedule proxy
  const elapsedFraction = useMemo(() => {
    const totalBudget = costData.divisions.reduce((s, d) => s + d.budget, 0);
    if (totalBudget === 0) return 0;
    return costData.divisions.reduce((s, d) => s + d.budget * (d.progress / 100), 0) / totalBudget;
  }, [costData.divisions]);

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
      <BudgetUpload open={uploadOpen} onClose={() => setUploadOpen(false)} onSuccess={() => setUploadOpen(false)} />

      {isEmpty ? (
        <Card padding={spacing['5']}>
          <EmptyState
            icon={<BookOpen size={48} />}
            title="No Budget Set Up Yet"
            description="Import your Schedule of Values or create budget line items by CSI division to unlock job costing, earned value, and cash flow forecasting."
            action={
              <div style={{ display: 'flex', gap: spacing['3'], justifyContent: 'center' }}>
                <Btn variant="primary" icon={<Upload size={14} />} onClick={() => setUploadOpen(true)}>Import Budget</Btn>
                <Btn variant="secondary" onClick={() => addToast('info', 'Manual entry form coming soon')}>Create Manually</Btn>
              </div>
            }
          />
        </Card>
      ) : (<>
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} />
      ))}

      {criticalAnomalies.length > 0 && (
        <div
          role="alert"
          onClick={() => navigate('/copilot', { state: { initialContext: 'budget', initialMessage: `Analyze budget risk: ${criticalAnomalies.map(a => a.divisionName).join(', ')} ${criticalAnomalies.length > 1 ? 'are' : 'is'} projected to overrun budget.` } })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['3'],
            padding: `${spacing['3']} ${spacing['4']}`,
            marginBottom: spacing['4'],
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: borderRadius.base,
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = '#FEE2E2'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = '#FEF2F2'; }}
        >
          <AlertTriangle size={16} color="#DC2626" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: '#991B1B' }}>
            AI detected {criticalAnomalies.length} division{criticalAnomalies.length > 1 ? 's' : ''} at risk of cost overrun. View Details.
          </span>
          <ArrowRight size={14} color="#DC2626" style={{ flexShrink: 0 }} />
        </div>
      )}

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
        <MetricFlash isFlashing={isFlashing}><MetricBox label="Total Project" value={fmt(projectData.totalValue)} /></MetricFlash>
        <MetricFlash isFlashing={isFlashing}><MetricBox label="Spent to Date" value={fmt(spent)} /></MetricFlash>
        <MetricFlash isFlashing={isFlashing}><MetricBox label="Committed" value={fmt(committed)} /></MetricFlash>
        <MetricFlash isFlashing={isFlashing}><MetricBox label="Remaining" value={fmt(remaining)} /></MetricFlash>
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
            <SectionHeader title="Division Health" action={<span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>J/K to navigate, Enter to open</span>} />
            <Card padding={spacing['4']}>
              <div
                ref={divListRef}
                role="grid"
                aria-label="Division health rows"
                aria-activedescendant={divActiveRowId}
                tabIndex={0}
                onKeyDown={divHandleKeyDown}
                onFocus={(e) => {
                  if (e.target === e.currentTarget) {
                    const first = e.currentTarget.querySelector<HTMLElement>('[data-div-index="0"]');
                    first?.focus();
                  }
                }}
                style={{ outline: 'none' }}
              >
              {costData.divisions.map((division, idx) => {
                const pct = Math.round((division.spent / division.budget) * 100);
                const isAtRisk = pct >= 90;
                const isFocused = divFocusedIndex === idx;
                return (
                  <div
                    key={division.id}
                    id={`${divGridId}-row-${idx}`}
                    role="row"
                    tabIndex={isFocused ? 0 : -1}
                    data-div-index={idx}
                    aria-selected={selectedDivision?.id === division.id}
                    onClick={() => setSelectedDivision(division)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setSelectedDivision(division); } }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = isAtRisk ? colors.statusCriticalSubtle : colors.surfaceHover; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = isAtRisk ? colors.statusCriticalSubtle : 'transparent'; }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: spacing['3'],
                      padding: `${spacing['3']} ${spacing['3']}`,
                      borderLeft: isAtRisk ? `4px solid ${colors.chartRed}` : '4px solid transparent',
                      backgroundColor: isAtRisk ? colors.statusCriticalSubtle : 'transparent',
                      borderRadius: borderRadius.sm, marginBottom: spacing['2'],
                      cursor: 'pointer',
                      outline: isFocused ? `2px solid ${colors.primaryOrange}` : 'none',
                      outlineOffset: '-2px',
                      transition: 'background-color 0.1s ease',
                    }}
                  >
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
                    <ChevronRight size={14} color={colors.textTertiary} aria-hidden="true" />
                  </div>
                );
              })}
              </div>
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

          {/* AI Budget Risk Insights */}
          {budgetAnomalies.length > 0 && (
            <div style={{ marginTop: spacing['5'] }}>
              <SectionHeader
                title="AI Budget Risk"
                action={
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                    <Sparkles size={12} color={colors.primaryOrange} />
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.primaryOrange, fontWeight: typography.fontWeight.medium }}>
                      {budgetAnomalies.length} insight{budgetAnomalies.length > 1 ? 's' : ''}
                    </span>
                  </div>
                }
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                {budgetAnomalies.map((anomaly, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: spacing['3'],
                      padding: `${spacing['3']} ${spacing['4']}`,
                      backgroundColor: anomaly.severity === 'critical' ? '#FEF2F2' : '#FFFBEB',
                      border: `1px solid ${anomaly.severity === 'critical' ? '#FECACA' : '#FDE68A'}`,
                      borderRadius: borderRadius.base,
                    }}
                  >
                    <AlertTriangle
                      size={14}
                      color={anomaly.severity === 'critical' ? '#DC2626' : colors.statusPending}
                      style={{ flexShrink: 0, marginTop: 2 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: anomaly.severity === 'critical' ? '#991B1B' : '#92400E' }}>
                        {anomaly.severity === 'critical' ? 'Cost Overrun Risk' : 'Budget Alert'}: {anomaly.divisionName}
                      </p>
                      <p style={{ margin: 0, marginTop: spacing['1'], fontSize: typography.fontSize.sm, color: anomaly.severity === 'critical' ? '#B91C1C' : '#78350F' }}>
                        {anomaly.message}
                      </p>
                    </div>
                    <span style={{
                      flexShrink: 0,
                      padding: `2px ${spacing['2']}`,
                      borderRadius: borderRadius.full,
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.semibold,
                      backgroundColor: anomaly.severity === 'critical' ? '#FEE2E2' : '#FEF3C7',
                      color: anomaly.severity === 'critical' ? '#DC2626' : '#D97706',
                    }}>
                      {anomaly.variancePct.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              <EarnedValueDashboard divisions={costData.divisions} contractValue={projectData.totalValue} elapsedFraction={elapsedFraction} />
            </div>
          </Card>
        </div>
      )}

      <Drawer open={!!selectedDivision} onClose={() => setSelectedDivision(null)} title={selectedDivision?.name ?? ''}>
        {selectedDivision && projectId && (
          <DivisionDrawerContent division={selectedDivision} projectId={projectId} />
        )}
      </Drawer>

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
      </>)}
    </PageContainer>
  );
};

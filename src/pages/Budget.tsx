import React, { useState, useMemo, useRef, useEffect, useId } from 'react';
import { useCopilotStore } from '../stores/copilotStore';
import { PageContainer, Card, SectionHeader, MetricBox, ProgressBar, StatusTag, DetailPanel, RelatedItems, Skeleton, useToast } from '../components/Primitives';
import { MetricCardSkeleton, TableRowSkeleton } from '../components/ui/Skeletons';
import { Btn } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { useQuery } from '../hooks/useQuery';
import { fetchBudgetDivisions, getCostCodesByDivision } from '../api/endpoints/budget';
import { usePayApplications } from '../hooks/queries';
import { getAiInsights } from '../api/endpoints/ai';
import { aiService } from '../lib/aiService';
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
import { Download, AlertTriangle, ChevronRight, ArrowRight, DollarSign, Upload, Sparkles, X, RefreshCw, Pencil } from 'lucide-react';
import { computeDivisionFinancials, computeProjectFinancials, detectBudgetAnomalies } from '../lib/financialEngine';
import { BudgetUpload } from '../components/budget/BudgetUpload';
import EmptyState from '../components/ui/EmptyState';
import { toast } from 'sonner';
import { useProjectId } from '../hooks/useProjectId';
import { useUpdateChangeOrder, useUpdateBudgetItem } from '../hooks/mutations';
import { PermissionGate } from '../components/auth/PermissionGate';
import { usePermissions } from '../hooks/usePermissions';
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

type DivisionDrawerTab = 'cost-codes' | 'invoices' | 'change-orders';

const DIVISION_DRAWER_TABS: { id: DivisionDrawerTab; label: string }[] = [
  { id: 'cost-codes', label: 'Cost Codes' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'change-orders', label: 'Change Orders' },
];

function invoiceStatusDot(status: string | null): string {
  switch (status?.toLowerCase()) {
    case 'paid': return colors.statusActive;
    case 'overdue': return colors.statusCritical;
    case 'pending':
    case 'open': return colors.statusPending;
    default: return colors.textTertiary;
  }
}

const DivisionDrawerContent: React.FC<{ division: MappedDivision; projectId: string }> = ({ division, projectId }) => {
  const [activeTab, setActiveTab] = useState<DivisionDrawerTab>('cost-codes');
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

  const colHead: React.CSSProperties = {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.medium,
    color: colors.textTertiary,
  };

  const cell: React.CSSProperties = {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  };

  const tabCount = (tab: DivisionDrawerTab): number => {
    if (!data) return 0;
    if (tab === 'cost-codes') return data.costCodes.length;
    if (tab === 'invoices') return data.invoices.length;
    return data.changeOrders.length;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      {/* Budget stacked bar summary */}
      <div>
        <p style={labelStyle}>Budget Breakdown</p>
        <div style={{ display: 'flex', height: 10, borderRadius: borderRadius.full, overflow: 'hidden', gap: 2 }}>
          <div style={{ width: `${budgetPct}%`, backgroundColor: colors.statusInfo, borderRadius: borderRadius.full }} title={`Budget: ${fmt(division.budget)}`} />
          <div style={{ width: `${committedPct}%`, backgroundColor: colors.statusPending, borderRadius: borderRadius.full }} title={`Committed: ${fmt(division.committed)}`} />
          <div style={{ width: `${spentPct}%`, backgroundColor: colors.statusCritical, borderRadius: borderRadius.full }} title={`Spent: ${fmt(division.spent)}`} />
        </div>
        <div style={{ display: 'flex', gap: spacing['4'], marginTop: spacing['2'] }}>
          {([
            { label: 'Budget', value: division.budget, color: colors.statusInfo },
            { label: 'Committed', value: division.committed, color: colors.statusPending },
            { label: 'Spent', value: division.spent, color: colors.statusCritical },
          ] as const).map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{label}: </span>
              <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${colors.borderSubtle}`, gap: 0 }}>
        {DIVISION_DRAWER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: `${spacing['2']} ${spacing['3']}`,
              border: 'none',
              borderBottom: activeTab === tab.id ? `2px solid ${colors.primaryOrange}` : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === tab.id ? colors.textPrimary : colors.textTertiary,
              fontSize: typography.fontSize.sm,
              fontWeight: activeTab === tab.id ? typography.fontWeight.semibold : typography.fontWeight.normal,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
              marginBottom: '-1px',
              transition: 'color 0.15s ease',
            }}
          >
            {tab.label}
            {data !== undefined && (
              <span style={{ marginLeft: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                ({tabCount(tab.id)})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} height="36px" />)}
        </div>
      )}

      {/* Cost Codes tab */}
      {data && activeTab === 'cost-codes' && (
        data.costCodes.length === 0 ? (
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>No cost entries recorded.</p>
        ) : (
          <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 80px 70px 100px 85px', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset }}>
              {['Cost Code', 'Description', 'Amount', 'Type', 'Vendor', 'Date'].map((h) => (
                <span key={h} style={colHead}>{h}</span>
              ))}
            </div>
            {data.costCodes.map((entry, i) => (
              <div
                key={entry.id}
                style={{ display: 'grid', gridTemplateColumns: '90px 1fr 80px 70px 100px 85px', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: i < data.costCodes.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none', alignItems: 'center' }}
              >
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{entry.cost_code}</span>
                <span style={cell}>{entry.description ?? ''}</span>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(entry.amount ?? 0)}</span>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{entry.cost_type ?? ''}</span>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{entry.vendor ?? ''}</span>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{entry.date ?? ''}</span>
              </div>
            ))}
          </div>
        )
      )}

      {/* Invoices tab */}
      {data && activeTab === 'invoices' && (
        data.invoices.length === 0 ? (
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>No invoices recorded for this division.</p>
        ) : (
          <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '85px 1fr 80px 80px 90px 85px', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset }}>
              {['Invoice No.', 'Vendor', 'Date', 'Total', 'Status', 'Due Date'].map((h) => (
                <span key={h} style={colHead}>{h}</span>
              ))}
            </div>
            {data.invoices.map((inv, i) => (
              <div
                key={inv.id}
                style={{ display: 'grid', gridTemplateColumns: '85px 1fr 80px 80px 90px 85px', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: i < data.invoices.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none', alignItems: 'center' }}
              >
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{inv.invoice_number ?? 'N/A'}</span>
                <span style={cell}>{inv.vendor}</span>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{inv.invoice_date ?? ''}</span>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(inv.total ?? 0)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: invoiceStatusDot(inv.status), flexShrink: 0 }} />
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, textTransform: 'capitalize' }}>{inv.status ?? 'unknown'}</span>
                </div>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{inv.due_date ?? ''}</span>
              </div>
            ))}
          </div>
        )
      )}

      {/* Change Orders tab */}
      {data && activeTab === 'change-orders' && (
        data.changeOrders.length === 0 ? (
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>No change orders linked to this division.</p>
        ) : (
          <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px 110px', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset }}>
              {['Number', 'Title', 'Amount', 'Status'].map((h) => (
                <span key={h} style={colHead}>{h}</span>
              ))}
            </div>
            {data.changeOrders.map((co, i) => {
              const statusConfig = getCOStatusConfig(co.status as ChangeOrderState);
              return (
                <div
                  key={co.id}
                  style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px 110px', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: i < data.changeOrders.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none', alignItems: 'center' }}
                >
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{co.coNumber}</span>
                  <span style={cell}>{co.title}</span>
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(co.amount)}</span>
                  <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: statusConfig.color, backgroundColor: statusConfig.bg, padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {statusConfig.label}
                  </span>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
};

export const Budget: React.FC = () => {
  const appNavigate = useAppNavigate();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const projectId = useProjectId();
  const { setPageContext } = useCopilotStore();
  useEffect(() => { setPageContext('budget'); }, [setPageContext]);
  const updateCO = useUpdateChangeOrder();
  const { isFlashing } = useBudgetRealtime(projectId);
  const { data: costData, loading: costLoading } = useQuery(`costData-${projectId}`, () => fetchBudgetDivisions(projectId!), { enabled: !!projectId });
  const { data: projectData, loading: projectLoading } = useQuery(`projectData-${projectId}`, () => getProject(projectId!), { enabled: !!projectId });
  const { data: payApps } = usePayApplications(projectId);
  const [selectedCO, setSelectedCO] = useState<NonNullable<typeof costData>['changeOrders'][0] | null>(null);
  const [selectedDivision, setSelectedDivision] = useState<MappedDivision | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'earned-value'>('overview');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [hoveredDivId, setHoveredDivId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ divId: string; field: 'spent' | 'progress'; value: string } | null>(null);
  const { hasPermission } = usePermissions();
  const canEditBudget = hasPermission('budget.edit');
  const updateBudgetItem = useUpdateBudgetItem();

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
  const allBudgetZero = !isEmpty && costData.divisions.every(d => d.budget === 0);
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

  const aiConfigured = aiService.isConfigured();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data: aiInsightsData, loading: aiInsightsLoading, refetch: refreshAiInsights } = useQuery(
    `ai-insights-budget-${projectId}`,
    () => getAiInsights(projectId!, { summary: projectFinancials, divisions: divisionFinancials }),
    { enabled: aiConfigured && !projectFinancials.isEmpty && !!projectId },
  );

  const committed = useMemo(() => costData.divisions.reduce((sum, d) => sum + d.committed, 0), [costData.divisions]);
  const spent = useMemo(() => costData.divisions.reduce((sum, d) => sum + d.spent, 0), [costData.divisions]);
  const remaining = useMemo(() => projectData.totalValue - spent - committed, [projectData.totalValue, spent, committed]);

  // Previous period spent: sum of all pay apps except the most recent (sorted by period end date).
  // Used as a prior period proxy for trend indicators. Falls back to 0 (no trend) when no history exists.
  const previousBilledToDate = useMemo(() => {
    if (!payApps || payApps.length < 2) return 0;
    const sorted = [...payApps].sort((a: any, b: any) =>
      new Date(a.period_to || 0).getTime() - new Date(b.period_to || 0).getTime()
    );
    return sorted.slice(0, -1).reduce((s: number, p: any) => s + (p.total_completed_and_stored || 0), 0);
  }, [payApps]);

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

  const handleSaveEdit = () => {
    if (!editingCell || !projectId) { setEditingCell(null); return; }
    const division = costData.divisions.find(d => d.id === editingCell.divId);
    if (!division) { setEditingCell(null); return; }
    const numVal = parseFloat(editingCell.value);
    if (isNaN(numVal)) { setEditingCell(null); return; }
    const updates = editingCell.field === 'spent'
      ? { actual_amount: numVal }
      : { percent_complete: Math.max(0, Math.min(100, numVal)) };
    updateBudgetItem.mutate({ id: division.id, projectId, updates });
    setEditingCell(null);
  };

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
        <div style={{ padding: '24px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: `1px solid ${colors.border}` }}>
          <EmptyState
            icon={DollarSign}
            title="No budget has been set up yet"
            description="Import your schedule of values or add budget line items by CSI division to start tracking costs."
            action={{ label: 'Import Budget', onClick: () => setUploadOpen(true) }}
            secondaryAction={{ label: 'Add Line Item', onClick: () => addToast('info', 'Manual entry form coming soon') }}
          />
        </div>
      ) : (<>
      {allBudgetZero && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['3'],
            padding: `${spacing['3']} ${spacing['4']}`,
            marginBottom: spacing['4'],
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: borderRadius.base,
          }}
        >
          <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: typography.fontSize.sm, color: '#92400E' }}>
            Budget line items exist but all values are $0. Update your budget to see accurate financial tracking.
          </span>
        </div>
      )}
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
      <div style={{ position: 'relative', marginBottom: spacing['4'] }}>
        {isFlashing && (
          <div
            aria-live="polite"
            aria-atomic="true"
            style={{
              position: 'absolute',
              top: -8,
              right: 0,
              display: 'flex',
              alignItems: 'center',
              gap: spacing['1'],
              padding: `2px ${spacing['2']}`,
              backgroundColor: '#F47820',
              borderRadius: borderRadius.full,
              zIndex: 10,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#FFFFFF', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
              Budget updated just now
            </span>
          </div>
        )}
        <div
          role="group"
          aria-label="Budget summary metrics"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: spacing.lg,
          }}
        >
          <MetricFlash isFlashing={isFlashing}><MetricBox label="Total Project" value={projectData.totalValue} format="currency" /></MetricFlash>
          <MetricFlash isFlashing={isFlashing}><MetricBox label="Spent to Date" value={spent} format="currency" previousValue={previousBilledToDate} /></MetricFlash>
          <MetricFlash isFlashing={isFlashing}><MetricBox label="Committed" value={committed} format="currency" /></MetricFlash>
          <MetricFlash isFlashing={isFlashing}><MetricBox label="Remaining" value={remaining} format="currency" colorOverride={remaining >= 0 ? 'success' : 'danger'} /></MetricFlash>
        </div>
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

      {/* AI Insights Panel */}
      {aiConfigured ? (
        !aiInsightsLoading && (aiInsightsData?.insights ?? []).length > 0 ? (
          <div
            style={{
              marginBottom: spacing['4'],
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.border}`,
              borderRadius: borderRadius.base,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: `${spacing['3']} ${spacing['4']}`,
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <Sparkles size={14} color={colors.primary} />
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                  AI Variance Analysis
                </span>
              </div>
              <button
                onClick={() => void refreshAiInsights()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing['1'],
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: `${spacing['1']} ${spacing['2']}`,
                  borderRadius: borderRadius.sm,
                  fontSize: typography.fontSize.caption,
                  color: colors.textTertiary,
                  fontFamily: typography.fontFamily,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = colors.textSecondary; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary; }}
              >
                <RefreshCw size={12} />
                Refresh Analysis
              </button>
            </div>
            {(aiInsightsData?.insights ?? []).slice(0, 3).map((insight) => (
              <div
                key={insight.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: spacing['3'],
                  padding: `${spacing['3']} ${spacing['4']}`,
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: insight.severity === 'critical' ? colors.statusCritical : colors.statusPending,
                    flexShrink: 0,
                    marginTop: 5,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, marginBottom: spacing['1'], fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                    {insight.title}
                  </p>
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.5 }}>
                    {insight.description}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/copilot', { state: { initialContext: 'budget', initialMessage: `Analyze: ${insight.title}` } })}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: typography.fontSize.caption,
                    color: colors.primary,
                    fontFamily: typography.fontFamily,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        ) : null
      ) : (
        <div
          style={{
            marginBottom: spacing['4'],
            padding: `${spacing['3']} ${spacing['4']}`,
            backgroundColor: colors.surfaceInset,
            borderRadius: borderRadius.base,
            fontSize: typography.fontSize.sm,
            color: colors.textTertiary,
          }}
        >
          AI analysis unavailable — configure OpenAI key in Settings
        </div>
      )}

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
            <Card padding="0">
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 2fr) 95px 140px 95px 115px 105px 24px', padding: `${spacing['2']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset }}>
                {['Division', 'Budget', 'Spent to Date', 'Committed', 'Remaining', '% Complete', ''].map((h) => (
                  <span key={h} style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>{h}</span>
                ))}
              </div>
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
                const isHovered = hoveredDivId === division.id;
                const remaining = division.budget - division.spent - division.committed;
                const isEditingSpent = editingCell?.divId === division.id && editingCell?.field === 'spent';
                const isEditingProgress = editingCell?.divId === division.id && editingCell?.field === 'progress';
                return (
                  <div
                    key={division.id}
                    id={`${divGridId}-row-${idx}`}
                    role="row"
                    tabIndex={isFocused ? 0 : -1}
                    data-div-index={idx}
                    aria-selected={selectedDivision?.id === division.id}
                    onClick={() => setSelectedDivision(division)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !isEditingSpent && !isEditingProgress) { e.preventDefault(); setSelectedDivision(division); } }}
                    onMouseEnter={() => setHoveredDivId(division.id)}
                    onMouseLeave={() => setHoveredDivId(null)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(150px, 2fr) 95px 140px 95px 115px 105px 24px',
                      alignItems: 'center',
                      padding: `${spacing['3']} ${spacing['4']}`,
                      borderLeft: isAtRisk ? `3px solid ${colors.chartRed}` : '3px solid transparent',
                      borderBottom: idx < costData.divisions.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                      backgroundColor: isAtRisk ? colors.statusCriticalSubtle : isHovered ? colors.surfaceHover : 'transparent',
                      cursor: 'pointer',
                      outline: isFocused ? `2px solid ${colors.primaryOrange}` : 'none',
                      outlineOffset: '-2px',
                      transition: 'background-color 0.1s ease',
                    }}
                  >
                    {/* Division name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], minWidth: 0 }}>
                      {isAtRisk && <AlertTriangle size={13} color={colors.chartRed} style={{ flexShrink: 0 }} />}
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {division.name}
                        {getAnnotationsForEntity('budget_division', division.id).map((ann) => (
                          <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                        ))}
                      </span>
                    </div>

                    {/* Budget (static) */}
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{fmt(division.budget)}</span>

                    {/* Spent to Date (editable) */}
                    <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
                      {isEditingSpent ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editingCell!.value}
                          onChange={(e) => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); handleSaveEdit(); }
                            if (e.key === 'Escape') { setEditingCell(null); }
                          }}
                          autoFocus
                          style={{
                            width: '110px',
                            fontSize: typography.fontSize.sm,
                            border: `1px solid ${colors.border}`,
                            borderRadius: borderRadius.sm,
                            padding: `2px ${spacing['2']}`,
                            outline: 'none',
                            boxShadow: `0 0 0 2px ${colors.primaryOrange}`,
                            fontFamily: typography.fontFamily,
                          }}
                        />
                      ) : (
                        <div
                          onClick={() => { if (canEditBudget) setEditingCell({ divId: division.id, field: 'spent', value: String(division.spent) }); }}
                          style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], cursor: canEditBudget ? 'text' : 'default', padding: `2px ${spacing['1']}`, borderRadius: borderRadius.sm }}
                        >
                          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: isAtRisk ? colors.chartRed : colors.textPrimary }}>{fmt(division.spent)}</span>
                          {canEditBudget && isHovered && <Pencil size={11} color={colors.textTertiary} style={{ flexShrink: 0 }} />}
                        </div>
                      )}
                    </div>

                    {/* Committed (static) */}
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{fmt(division.committed)}</span>

                    {/* Remaining (computed, static) */}
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: remaining < 0 ? colors.statusCritical : colors.statusActive }}>{fmt(remaining)}</span>

                    {/* % Complete (editable) */}
                    <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
                      {isEditingProgress ? (
                        <>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            value={editingCell!.value}
                            onChange={(e) => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
                            onBlur={handleSaveEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); handleSaveEdit(); }
                              if (e.key === 'Escape') { setEditingCell(null); }
                            }}
                            autoFocus
                            style={{
                              width: '70px',
                              fontSize: typography.fontSize.sm,
                              border: `1px solid ${colors.border}`,
                              borderRadius: borderRadius.sm,
                              padding: `2px ${spacing['2']}`,
                              outline: 'none',
                              boxShadow: `0 0 0 2px ${colors.primaryOrange}`,
                              fontFamily: typography.fontFamily,
                            }}
                          />
                          {(() => {
                            const newPct = parseFloat(editingCell!.value);
                            if (isNaN(newPct) || newPct <= 0 || division.spent <= 0) return null;
                            const oldProjected = division.progress > 0 ? division.spent / (division.progress / 100) : division.budget;
                            const newProjected = division.spent / (newPct / 100);
                            const delta = newProjected - oldProjected;
                            const isOver = newProjected > division.budget;
                            return (
                              <div style={{
                                position: 'absolute', top: '100%', left: 0, zIndex: 20,
                                backgroundColor: colors.surfaceRaised,
                                border: `1px solid ${colors.border}`,
                                borderRadius: borderRadius.sm,
                                padding: `${spacing['1']} ${spacing['2']}`,
                                marginTop: spacing['1'],
                                whiteSpace: 'nowrap',
                                fontSize: typography.fontSize.xs,
                                color: isOver ? colors.statusCritical : colors.statusActive,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                              }}>
                                {`Projected: ${fmt(oldProjected)} to ${fmt(newProjected)} (${delta >= 0 ? '+' : ''}${fmt(Math.abs(delta))})`}
                              </div>
                            );
                          })()}
                        </>
                      ) : (
                        <div
                          onClick={() => { if (canEditBudget) setEditingCell({ divId: division.id, field: 'progress', value: String(division.progress) }); }}
                          style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], cursor: canEditBudget ? 'text' : 'default', padding: `2px ${spacing['1']}`, borderRadius: borderRadius.sm }}
                        >
                          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: isAtRisk ? colors.chartRed : colors.textSecondary }}>{division.progress}%</span>
                          {canEditBudget && isHovered && <Pencil size={11} color={colors.textTertiary} style={{ flexShrink: 0 }} />}
                        </div>
                      )}
                    </div>

                    {/* Chevron */}
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
                const coType = co.type || 'co';
                const coStatus = co.status as ChangeOrderState || 'draft';
                const typeConfig = getCOTypeConfig(coType);
                const statusConfig = getCOStatusConfig(coStatus);
                return (
                  <div role="row" tabIndex={0} key={co.id} onClick={() => setSelectedCO(co)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCO(co); } }} style={{
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
              <EarnedValueDashboard />
            </div>
          </Card>
        </div>
      )}

      <Drawer open={!!selectedDivision} onClose={() => setSelectedDivision(null)} title={selectedDivision ? `${selectedDivision.name}${selectedDivision.csi_division ? ` · ${selectedDivision.csi_division}` : ''}` : ''}>
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

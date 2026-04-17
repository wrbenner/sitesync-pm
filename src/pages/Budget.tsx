import React, { useState, useMemo, useRef, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCopilotStore } from '../stores/copilotStore';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PageContainer, Card, SectionHeader, MetricBox, StatusTag, DetailPanel, RelatedItems, Skeleton, useToast } from '../components/Primitives';
import { MetricCardSkeleton, TableRowSkeleton } from '../components/ui/Skeletons';
import { Btn } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, touchTarget, shadows } from '../styles/theme';
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
import { Download, AlertTriangle, ChevronRight, ArrowRight, DollarSign, Sparkles, RefreshCw, Pencil } from 'lucide-react';
import { computeDivisionFinancials, computeProjectFinancials, detectBudgetAnomalies } from '../lib/financialEngine';
const BudgetUpload = React.lazy(() => import('../components/budget/BudgetUpload').then(m => ({ default: m.BudgetUpload })));
import EmptyState from '../components/ui/EmptyState';
import { toast } from 'sonner';
import { useProjectId } from '../hooks/useProjectId';
import { useUpdateChangeOrder, useUpdateBudgetItem } from '../hooks/mutations';
import { PermissionGate } from '../components/auth/PermissionGate';
import { usePermissions } from '../hooks/usePermissions';
import { getCOTypeConfig, getCOStatusConfig } from '../machines/changeOrderMachine';
import type { ChangeOrderState } from '../machines/changeOrderMachine';
import { useNavigate } from 'react-router-dom';
import { useBudgetRealtime } from '../hooks/queries/realtime';
import { MetricFlash } from '../components/ui/RealtimeFlash';

// ── Formatters ───────────────────────────────────────────

const fmt = (n: number): string => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

// ── Animation Presets ────────────────────────────────────

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const slideIn = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
};

const tabTransition = { duration: 0.15, ease: [0.25, 0.1, 0.25, 1] } as const;
const springMedium = { type: 'spring', stiffness: 350, damping: 30, mass: 0.8 } as const;

// ── Types ────────────────────────────────────────────────

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

// ── Division Drawer Content ──────────────────────────────

const DivisionDrawerContent: React.FC<{ division: MappedDivision; projectId: string }> = React.memo(({ division, projectId }) => {
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
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${budgetPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{ backgroundColor: colors.statusInfo, borderRadius: borderRadius.full }}
            title={`Budget: ${fmt(division.budget)}`}
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${committedPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
            style={{ backgroundColor: colors.statusPending, borderRadius: borderRadius.full }}
            title={`Committed: ${fmt(division.committed)}`}
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${spentPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            style={{ backgroundColor: colors.statusCritical, borderRadius: borderRadius.full }}
            title={`Spent: ${fmt(division.spent)}`}
          />
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
              padding: `0 ${spacing['3']}`,
              minHeight: touchTarget.field,
              border: 'none',
              borderBottom: activeTab === tab.id ? `2px solid ${colors.primaryOrange}` : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === tab.id ? colors.textPrimary : colors.textTertiary,
              fontSize: typography.fontSize.sm,
              fontWeight: activeTab === tab.id ? typography.fontWeight.semibold : typography.fontWeight.normal,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
              marginBottom: '-1px',
              transition: 'color 0.15s ease, border-color 0.15s ease',
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

      <AnimatePresence mode="wait">
        {/* Cost Codes tab */}
        {data && activeTab === 'cost-codes' && (
          <motion.div key="cost-codes" {...fadeUp} transition={tabTransition}>
            {data.costCodes.length === 0 ? (
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>No cost entries recorded.</p>
            ) : (
              <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 80px 70px 100px 85px', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset }}>
                  {['Cost Code', 'Description', 'Amount', 'Type', 'Vendor', 'Date'].map((h) => (
                    <span key={h} style={colHead}>{h}</span>
                  ))}
                </div>
                {data.costCodes.map((entry, i) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.12, delay: i * 0.02 }}
                    style={{ display: 'grid', gridTemplateColumns: '90px 1fr 80px 70px 100px 85px', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: i < data.costCodes.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none', alignItems: 'center' }}
                  >
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{entry.cost_code}</span>
                    <span style={cell}>{entry.description ?? ''}</span>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(entry.amount ?? 0)}</span>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{entry.cost_type ?? ''}</span>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{entry.vendor ?? ''}</span>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{entry.date ?? ''}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Invoices tab */}
        {data && activeTab === 'invoices' && (
          <motion.div key="invoices" {...fadeUp} transition={tabTransition}>
            {data.invoices.length === 0 ? (
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>No invoices recorded for this division.</p>
            ) : (
              <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '85px 1fr 80px 80px 90px 85px', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset }}>
                  {['Invoice No.', 'Vendor', 'Date', 'Total', 'Status', 'Due Date'].map((h) => (
                    <span key={h} style={colHead}>{h}</span>
                  ))}
                </div>
                {data.invoices.map((inv, i) => (
                  <motion.div
                    key={inv.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.12, delay: i * 0.02 }}
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
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Change Orders tab */}
        {data && activeTab === 'change-orders' && (
          <motion.div key="change-orders" {...fadeUp} transition={tabTransition}>
            {data.changeOrders.length === 0 ? (
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
                    <motion.div
                      key={co.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.12, delay: i * 0.02 }}
                      style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px 110px', padding: `${spacing['2']} ${spacing['3']}`, borderBottom: i < data.changeOrders.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none', alignItems: 'center' }}
                    >
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{co.coNumber}</span>
                      <span style={cell}>{co.title}</span>
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(co.amount)}</span>
                      <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: statusConfig.color, backgroundColor: statusConfig.bg, padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {statusConfig.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
DivisionDrawerContent.displayName = 'DivisionDrawerContent';

// ── Budget Page ──────────────────────────────────────────

const BudgetPage: React.FC = () => {
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

  // Mobile detection for responsive layout
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check, { passive: true });
    return () => window.removeEventListener('resize', check);
  }, []);

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

  // Hooks must be called before any early return
  const divisions = costData?.divisions ?? [];
  const changeOrders = costData?.changeOrders ?? [];
  const allChangeOrders = changeOrders;

  const divisionFinancials = useMemo(
    () => computeDivisionFinancials(divisions, changeOrders),
    [divisions, changeOrders]
  );
  const projectFinancials = useMemo(
    () => computeProjectFinancials(divisions, changeOrders, projectData?.totalValue ?? 0),
    [divisions, changeOrders, projectData?.totalValue]
  );
  const budgetAnomalies = useMemo(
    () => detectBudgetAnomalies(projectFinancials, divisionFinancials),
    [projectFinancials, divisionFinancials]
  );

  const aiConfigured = aiService.isConfigured();
  const { data: aiInsightsData, loading: aiInsightsLoading, refetch: refreshAiInsights } = useQuery(
    `ai-insights-budget-${projectId}`,
    () => getAiInsights(projectId!, { summary: projectFinancials, divisions: divisionFinancials }),
    { enabled: aiConfigured && !projectFinancials.isEmpty && !!projectId },
  );

  const committed = useMemo(() => divisions.reduce((sum, d) => sum + d.committed, 0), [divisions]);
  const spent = useMemo(() => divisions.reduce((sum, d) => sum + d.spent, 0), [divisions]);
  const remaining = useMemo(() => (projectData?.totalValue ?? 0) - spent - committed, [projectData?.totalValue, spent, committed]);

  const previousBilledToDate = useMemo(() => {
    if (!payApps || payApps.length < 2) return 0;
    const sorted = [...payApps].sort((a: unknown, b: unknown) =>
      new Date(a.period_to || 0).getTime() - new Date(b.period_to || 0).getTime()
    );
    return sorted.slice(0, -1).reduce((s: number, p: unknown) => s + (p.total_completed_and_stored || 0), 0);
  }, [payApps]);

  const approvedTotal = useMemo(() => allChangeOrders.filter(co => co.status === 'approved').reduce((s, co) => s + co.amount, 0), [allChangeOrders]);

  const consumed = approvedTotal;
  const contingencyRemaining = useMemo(() => 3800000 - consumed, [consumed]);

  if (costLoading || projectLoading || !costData || !projectData) {
    return (
      <PageContainer title="Budget" subtitle="Loading...">
        <motion.div {...fadeIn} transition={{ duration: 0.2 }}>
          <MetricCardSkeleton />
          <Card padding="0">
            <TableRowSkeleton rows={8} />
          </Card>
        </motion.div>
      </PageContainer>
    );
  }

  const isEmpty = costData.divisions.length === 0;
  const allBudgetZero = !isEmpty && costData.divisions.every(d => d.budget === 0);
  const pageAlerts = getPredictiveAlertsForPage('budget');
  const criticalAnomalies = budgetAnomalies.filter(a => a.severity === 'critical');

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
    transition: 'color 0.15s ease',
    position: 'relative',
    zIndex: 1,
    minHeight: touchTarget.min,
    display: 'flex',
    alignItems: 'center',
  };

  return (
    <PageContainer
      title="Budget"
      subtitle={`${fmt(spent)} spent of ${fmt(projectData.totalValue)} total`}
      actions={<Btn variant="secondary" size="sm" icon={<Download size={14} />} onClick={() => addToast('info', 'Exporting budget data to CSV...')}>Export CSV</Btn>}
    >
      <BudgetUpload open={uploadOpen} onClose={() => setUploadOpen(false)} onSuccess={() => setUploadOpen(false)} />

      {isEmpty ? (
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.25 }}
          style={{ padding: spacing['6'], backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl, border: `1px solid ${colors.borderDefault}` }}
        >
          <EmptyState
            icon={DollarSign}
            title="No budget has been set up yet"
            description="Import your schedule of values or add budget line items by CSI division to start tracking costs."
            action={canEditBudget ? { label: 'Import Budget', onClick: () => setUploadOpen(true) } : undefined}
            secondaryAction={canEditBudget ? { label: 'Add Line Item', onClick: () => addToast('info', 'Manual entry form available in the next update') } : undefined}
          />
        </motion.div>
      ) : (<>
      {/* Alerts — animated appear/disappear */}
      <AnimatePresence>
        {allBudgetZero && (
          <motion.div
            key="budget-zero-alert"
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: spacing['4'] }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['3'],
                padding: `${spacing['3']} ${spacing['4']}`,
                backgroundColor: colors.badgeAmberBg,
                border: `1px solid ${colors.statusPendingSubtle}`,
                borderRadius: borderRadius.base,
              }}
            >
              <AlertTriangle size={16} color={colors.statusPending} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.statusPending }}>
                Budget line items exist but all values are $0. Update your budget to see accurate financial tracking.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} />
      ))}

      <AnimatePresence>
        {criticalAnomalies.length > 0 && (
          <motion.div
            key="critical-anomalies"
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: spacing['4'] }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              role="alert"
              onClick={() => navigate('/copilot', { state: { initialContext: 'budget', initialMessage: `Analyze budget risk: ${criticalAnomalies.map(a => a.divisionName).join(', ')} ${criticalAnomalies.length > 1 ? 'are' : 'is'} projected to overrun budget.` } })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['3'],
                padding: `${spacing['3']} ${spacing['4']}`,
                backgroundColor: colors.badgeRedBg,
                border: `1px solid ${colors.statusCriticalSubtle}`,
                borderRadius: borderRadius.base,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.statusCriticalSubtle; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.badgeRedBg; }}
            >
              <AlertTriangle size={16} color={colors.statusCritical} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.statusCritical }}>
                AI detected {criticalAnomalies.length} division{criticalAnomalies.length > 1 ? 's' : ''} at risk of cost overrun. View Details.
              </span>
              <ArrowRight size={14} color={colors.statusCritical} style={{ flexShrink: 0 }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Metrics — staggered fade-up */}
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
              backgroundColor: colors.primaryOrange,
              borderRadius: borderRadius.full,
              zIndex: 10,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.white, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.white, whiteSpace: 'nowrap' }}>
              Budget updated just now
            </span>
          </div>
        )}
        <div
          role="group"
          aria-label="Budget summary metrics"
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: spacing.lg,
          }}
        >
          {([
            { delay: 0, content: <MetricFlash isFlashing={isFlashing}><MetricBox label="Total Project" value={projectData.totalValue} format="currency" /></MetricFlash> },
            { delay: 0.04, content: <MetricFlash isFlashing={isFlashing}><MetricBox label="Spent to Date" value={spent} format="currency" previousValue={previousBilledToDate} /></MetricFlash> },
            { delay: 0.08, content: <MetricFlash isFlashing={isFlashing}><MetricBox label="Committed" value={committed} format="currency" /></MetricFlash> },
            { delay: 0.12, content: <MetricFlash isFlashing={isFlashing}><MetricBox label="Remaining" value={remaining} format="currency" colorOverride={remaining >= 0 ? 'success' : 'danger'} /></MetricFlash> },
          ]).map(({ delay, content }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {content}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Contingency Drawdown — animated progress fill */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.18 }}
        style={{ marginBottom: spacing['4'] }}
      >
        <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0, marginBottom: spacing['2'] }}>Contingency Drawdown</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <div
            role="progressbar"
            aria-label="Contingency drawdown"
            aria-valuenow={Math.round((consumed / 3800000) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ flex: 1, height: 12, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, overflow: 'hidden', display: 'flex' }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(consumed / 3800000) * 100}%` }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.3 }}
              style={{ height: '100%', backgroundColor: colors.statusPending, borderRadius: borderRadius.full }}
            />
          </div>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {fmt(contingencyRemaining)} of $3.8M remaining
          </span>
        </div>
      </motion.div>

      {/* AI Insights Panel */}
      {aiConfigured ? (
        !aiInsightsLoading && (aiInsightsData?.insights ?? []).length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.22 }}
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
                <Sparkles size={14} color={colors.primaryOrange} />
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
                  minHeight: touchTarget.min,
                  borderRadius: borderRadius.sm,
                  fontSize: typography.fontSize.caption,
                  color: colors.textTertiary,
                  fontFamily: typography.fontFamily,
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = colors.textSecondary; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary; }}
              >
                <RefreshCw size={12} />
                Refresh Analysis
              </button>
            </div>
            {(aiInsightsData?.insights ?? []).slice(0, 3).map((insight, i) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15, delay: i * 0.04 }}
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
                    padding: `${spacing['1']} 0`,
                    minHeight: touchTarget.min,
                    fontSize: typography.fontSize.caption,
                    color: colors.primaryOrange,
                    fontFamily: typography.fontFamily,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  View Details
                </button>
              </motion.div>
            ))}
          </motion.div>
        ) : null
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.2 }}
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
        </motion.div>
      )}

      {/* Tab Toggle — sliding pill indicator */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.15 }}
        role="tablist"
        aria-label="Budget views"
        style={{
          display: 'flex',
          gap: spacing['1'],
          backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.full,
          padding: 2,
          marginBottom: spacing['5'],
          width: 'fit-content',
        }}
      >
        {(['overview', 'earned-value'] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`budget-tab-${tab}`}
            onClick={() => setActiveTab(tab)}
            style={{
              ...pillBase,
              color: activeTab === tab ? colors.textPrimary : colors.textTertiary,
              backgroundColor: 'transparent',
            }}
          >
            {activeTab === tab && (
              <motion.div
                layoutId="tab-pill-bg"
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: colors.surfaceRaised,
                  borderRadius: borderRadius.full,
                  boxShadow: shadows.sm,
                  zIndex: 0,
                }}
                transition={springMedium}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>
              {tab === 'overview' ? 'Overview' : 'Earned Value'}
            </span>
          </button>
        ))}
      </motion.div>

      {/* Tab Content — animated switch */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            role="tabpanel"
            id="budget-tab-overview"
            aria-label="Overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={tabTransition}
          >
            {/* Cost Distribution Treemap */}
            <SectionHeader title="Cost Distribution" action={<span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color: colors.orangeText, fontWeight: typography.fontWeight.medium, cursor: 'pointer' }}>Click to drill down <ChevronRight size={12} aria-hidden="true" /></span>} />
            <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.12 }}>
              <Card padding={spacing['5']}>
                <div role="img" aria-label="Cost distribution treemap showing budget allocation across divisions">
                  <Treemap divisions={costData.divisions} />
                </div>
              </Card>
            </motion.div>

            {/* Division Health */}
            <div style={{ marginTop: spacing['4'] }}>
              <SectionHeader title="Division Health" action={<span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>J/K to navigate, Enter to open</span>} />
              <Card padding="0">
                {/* Table header */}
                <div style={{ overflowX: isMobile ? 'auto' : 'visible' }}>
                  <div style={{ minWidth: isMobile ? 700 : 'auto' }}>
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
                      const divRemaining = division.budget - division.spent - division.committed;
                      const isEditingSpent = editingCell?.divId === division.id && editingCell?.field === 'spent';
                      const isEditingProgress = editingCell?.divId === division.id && editingCell?.field === 'progress';
                      return (
                        <motion.div
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
                          {...slideIn}
                          transition={{ duration: 0.15, delay: Math.min(idx * 0.025, 0.35), ease: [0.25, 0.1, 0.25, 1] }}
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
                                aria-label={`Spent to date for ${division.name}`}
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
                                role={canEditBudget ? 'button' : undefined}
                                tabIndex={canEditBudget ? 0 : undefined}
                                aria-label={canEditBudget ? `Edit spent for ${division.name}` : undefined}
                                onClick={() => { if (canEditBudget) setEditingCell({ divId: division.id, field: 'spent', value: String(division.spent) }); }}
                                onKeyDown={(e) => { if (canEditBudget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setEditingCell({ divId: division.id, field: 'spent', value: String(division.spent) }); } }}
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
                          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: divRemaining < 0 ? colors.statusCritical : colors.statusActive }}>{fmt(divRemaining)}</span>

                          {/* % Complete (editable) */}
                          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
                            {isEditingProgress ? (
                              <>
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  max="100"
                                  aria-label={`Percent complete for ${division.name}`}
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
                                    <motion.div
                                      initial={{ opacity: 0, y: -4 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      style={{
                                        position: 'absolute', top: '100%', left: 0, zIndex: 20,
                                        backgroundColor: colors.surfaceRaised,
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: borderRadius.sm,
                                        padding: `${spacing['1']} ${spacing['2']}`,
                                        marginTop: spacing['1'],
                                        whiteSpace: 'nowrap',
                                        fontSize: typography.fontSize.xs,
                                        color: isOver ? colors.statusCritical : colors.statusActive,
                                        boxShadow: shadows.dropdown,
                                      }}
                                    >
                                      {`Projected: ${fmt(oldProjected)} to ${fmt(newProjected)} (${delta >= 0 ? '+' : ''}${fmt(Math.abs(delta))})`}
                                    </motion.div>
                                  );
                                })()}
                              </>
                            ) : (
                              <div
                                role={canEditBudget ? 'button' : undefined}
                                tabIndex={canEditBudget ? 0 : undefined}
                                aria-label={canEditBudget ? `Edit percent complete for ${division.name}` : undefined}
                                onClick={() => { if (canEditBudget) setEditingCell({ divId: division.id, field: 'progress', value: String(division.progress) }); }}
                                onKeyDown={(e) => { if (canEditBudget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setEditingCell({ divId: division.id, field: 'progress', value: String(division.progress) }); } }}
                                style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], cursor: canEditBudget ? 'text' : 'default', padding: `2px ${spacing['1']}`, borderRadius: borderRadius.sm }}
                              >
                                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: isAtRisk ? colors.chartRed : colors.textSecondary }}>{division.progress}%</span>
                                {canEditBudget && isHovered && <Pencil size={11} color={colors.textTertiary} style={{ flexShrink: 0 }} />}
                              </div>
                            )}
                          </div>

                          {/* Chevron */}
                          <ChevronRight size={14} color={colors.textTertiary} aria-hidden="true" />
                        </motion.div>
                      );
                    })}
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* S Curve */}
            <div style={{ marginTop: spacing['5'] }}>
              <SectionHeader title="Cumulative Cost (S Curve)" />
              <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.12 }}>
                <Card padding={spacing['5']}>
                  <div role="img" aria-label="S Curve chart showing cumulative cost over time against total budget">
                    <SCurve totalBudget={projectData.totalValue} spent={spent} />
                  </div>
                </Card>
              </motion.div>
            </div>

            {/* AI Budget Risk Insights */}
            <AnimatePresence>
              {budgetAnomalies.length > 0 && (
                <motion.div
                  key="anomalies"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ marginTop: spacing['5'], overflow: 'hidden' }}
                >
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
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15, delay: i * 0.04 }}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: spacing['3'],
                          padding: `${spacing['3']} ${spacing['4']}`,
                          backgroundColor: anomaly.severity === 'critical' ? colors.badgeRedBg : colors.badgeAmberBg,
                          border: `1px solid ${anomaly.severity === 'critical' ? colors.statusCriticalSubtle : colors.statusPendingSubtle}`,
                          borderRadius: borderRadius.base,
                        }}
                      >
                        <AlertTriangle
                          size={14}
                          color={anomaly.severity === 'critical' ? colors.statusCritical : colors.statusPending}
                          style={{ flexShrink: 0, marginTop: 2 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: anomaly.severity === 'critical' ? colors.statusCritical : colors.statusPending }}>
                            {anomaly.severity === 'critical' ? 'Cost Overrun Risk' : 'Budget Alert'}: {anomaly.divisionName}
                          </p>
                          <p style={{ margin: 0, marginTop: spacing['1'], fontSize: typography.fontSize.sm, color: anomaly.severity === 'critical' ? colors.statusCritical : colors.statusPending }}>
                            {anomaly.message}
                          </p>
                        </div>
                        <span style={{
                          flexShrink: 0,
                          padding: `2px ${spacing['2']}`,
                          borderRadius: borderRadius.full,
                          fontSize: typography.fontSize.caption,
                          fontWeight: typography.fontWeight.semibold,
                          backgroundColor: anomaly.severity === 'critical' ? colors.statusCriticalSubtle : colors.statusPendingSubtle,
                          color: anomaly.severity === 'critical' ? colors.statusCritical : colors.statusPending,
                        }}>
                          {anomaly.variancePct.toFixed(0)}%
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* CO Budget Impact */}
            <div style={{ marginTop: spacing['5'] }}>
              <SectionHeader title="Change Order Impact" />
              <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.12 }}>
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
              </motion.div>
            </div>

            {/* Change Orders */}
            <div style={{ marginTop: spacing['2xl'] }}>
              <SectionHeader title="Change Orders" action={
                <Btn variant="ghost" size="sm" icon={<ArrowRight size={12} />} iconPosition="right" onClick={() => navigate('/change-orders')}>View Pipeline</Btn>
              } />
              <Card padding="0">
                <div role="table" aria-label="Change orders">
                  <div role="rowgroup">
                    <div role="row" style={{ display: 'grid', gridTemplateColumns: '80px 60px 1fr 120px 140px', padding: `${spacing.md} ${spacing.xl}`, borderBottom: `1px solid ${colors.borderLight}` }}>
                      {['Number', 'Type', 'Title', 'Amount', 'Status'].map((label) => (
                        <span role="columnheader" key={label} style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>{label}</span>
                      ))}
                    </div>
                  </div>

                  <div role="rowgroup">
                    {allChangeOrders.slice(0, 10).map((co, i) => {
                      const coType = co.type || 'co';
                      const coStatus = co.status as ChangeOrderState || 'draft';
                      const typeConfig = getCOTypeConfig(coType);
                      const statusConfig = getCOStatusConfig(coStatus);
                      return (
                        <motion.div
                          role="row"
                          tabIndex={0}
                          key={co.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.12, delay: Math.min(i * 0.025, 0.25) }}
                          onClick={() => setSelectedCO(co)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCO(co); } }}
                          style={{
                            display: 'grid', gridTemplateColumns: '80px 60px 1fr 120px 140px',
                            padding: `${spacing.lg} ${spacing.xl}`,
                            borderBottom: i < allChangeOrders.length - 1 ? `1px solid ${colors.borderLight}` : 'none',
                            alignItems: 'center', cursor: 'pointer',
                            transition: 'background-color 0.1s ease',
                          }}
                          whileHover={{ backgroundColor: colors.surfaceHover }}
                        >
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
                        </motion.div>
                      );
                    })}
                  </div>

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
          </motion.div>
        )}

        {activeTab === 'earned-value' && (
          <motion.div
            key="earned-value"
            role="tabpanel"
            id="budget-tab-earned-value"
            aria-label="Earned Value"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={tabTransition}
          >
            <SectionHeader title="Earned Value Analysis" />
            <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.12 }}>
              <Card padding={spacing['5']}>
                <div role="img" aria-label="Earned value analysis dashboard showing budget performance indicators">
                  <EarnedValueDashboard />
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Drawer open={!!selectedDivision} onClose={() => setSelectedDivision(null)} title={selectedDivision ? `${selectedDivision.name}${selectedDivision.csi_division ? ` · ${selectedDivision.csi_division}` : ''}` : ''}>
        {selectedDivision && projectId && (
          <DivisionDrawerContent division={selectedDivision} projectId={projectId} />
        )}
      </Drawer>

      <DetailPanel open={!!selectedCO} onClose={() => setSelectedCO(null)} title={selectedCO?.coNumber || ''}>
        {selectedCO && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}
          >
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
          </motion.div>
        )}
      </DetailPanel>
      </>)}
    </PageContainer>
  );
};

export const Budget: React.FC = () => (
  <ErrorBoundary message="Budget could not be displayed. Check your connection and try again.">
    <BudgetPage />
  </ErrorBoundary>
);

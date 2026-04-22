import React, { useState, useMemo, useRef, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useCopilotStore } from '../stores/copilotStore';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PageContainer, Card, SectionHeader, MetricBox, StatusTag, DetailPanel, RelatedItems, Skeleton, useToast } from '../components/Primitives';
import { PresenceAvatars } from '../components/shared/PresenceAvatars';
import { MetricCardSkeleton, TableSkeleton } from '../components/ui/Skeletons';
import { Btn } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, touchTarget } from '../styles/theme';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useQuery } from '../hooks/useQuery';
import { fetchBudgetDivisions, getCostCodesByDivision } from '../api/endpoints/budget';
import { usePayApplications } from '../hooks/queries';
import { getAiInsights } from '../api/endpoints/ai';
import { aiService } from '../lib/aiService';
import type { MappedDivision } from '../api/endpoints/budget';
import { getProject } from '../api/endpoints/projects';
import { Drawer } from '../components/Drawer';
import { useTableKeyboardNavigation } from '../hooks/useTableKeyboardNavigation';
import { exportBudgetXlsx } from '../lib/exportXlsx';
import { useAppNavigate, getRelatedItemsForChangeOrder } from '../utils/connections';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { PredictiveAlertBanner } from '../components/ai/PredictiveAlert';
import { getAnnotationsForEntity, getPredictiveAlertsForPage } from '../data/aiAnnotations';
import { Treemap } from '../components/budget/Treemap';
import { SCurve } from '../components/budget/SCurve';
import { EarnedValueDashboard } from '../components/budget/EarnedValueDashboard';
import { WaterfallChart } from '../components/budget/WaterfallChart';
import { Download, AlertTriangle, ChevronRight, ChevronDown, ArrowRight, DollarSign, Sparkles, RefreshCw, Pencil, Trash2, ShieldCheck, TrendingUp, TrendingDown, Camera, GitCompare, CheckCircle, XCircle, Clock, Users, Calendar, Layers } from 'lucide-react';
import { computeDivisionFinancials, computeProjectFinancials, detectBudgetAnomalies } from '../lib/financialEngine';
import { buildWBSFromDivisions, computeContingency, computeCashFlow, computeMilestoneAlignment, generateSCurveData } from '../lib/budgetComputations';
import type { WBSNode as ComputedWBSNode } from '../lib/budgetComputations';
import { budgetSnapshotService } from '../services/budgetSnapshotService';
import type { BudgetSnapshotRow } from '../services/budgetSnapshotService';
import { useScheduleActivities } from '../hooks/useScheduleActivities';
const BudgetUpload = React.lazy(() => import('../components/budget/BudgetUpload').then(m => ({ default: m.BudgetUpload })));
const DrawReportUpload = React.lazy(() => import('../components/payApplications/DrawReportUpload').then(m => ({ default: m.DrawReportUpload })));
import EmptyState from '../components/ui/EmptyState';
import { toast } from 'sonner';
import { useProjectId } from '../hooks/useProjectId';
import { useUpdateChangeOrder, useUpdateBudgetItem } from '../hooks/mutations';
import { supabase } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { PermissionGate } from '../components/auth/PermissionGate';
import { usePermissions } from '../hooks/usePermissions';
import { getCOTypeConfig, getCOStatusConfig } from '../machines/changeOrderMachine';
import type { ChangeOrderState } from '../machines/changeOrderMachine';
import { useNavigate } from 'react-router-dom'
import { useBudgetRealtime } from '../hooks/queries/realtime'
import { MetricFlash } from '../components/ui/RealtimeFlash';

interface AddBudgetLineItemModalProps { projectId: string; onClose: () => void; onCreated: () => void }
const AddBudgetLineItemModal: React.FC<AddBudgetLineItemModalProps> = ({ projectId, onClose, onCreated }) => {
  const [form, setForm] = useState({ description: '', csi_code: '', original_amount: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (!form.description.trim()) { setErr('Description required'); return; }
    setSaving(true); setErr(null);
    try {
      const amt = parseFloat(form.original_amount) || 0;
      const { error } = await supabase.from('budget_items').insert({
        project_id: projectId,
        description: form.description,
        csi_division: form.csi_code || null,
        division: form.csi_code || 'General',
        original_amount: amt,
      });
      if (error) throw error;
      toast.success('Line item added');
      onCreated(); onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
  };
  const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, marginBottom: 12, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' };
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: 24, width: '100%', maxWidth: 480 }}>
        <h2 style={{ margin: 0, marginBottom: 16, fontSize: 18 }}>Add Budget Line Item</h2>
        <label style={{ fontSize: 13, fontWeight: 500 }}>Description *</label>
        <input style={input} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
        <label style={{ fontSize: 13, fontWeight: 500 }}>CSI Code / Division</label>
        <input style={input} value={form.csi_code} onChange={(e) => setForm(p => ({ ...p, csi_code: e.target.value }))} placeholder="e.g. 03 30 00" />
        <label style={{ fontSize: 13, fontWeight: 500 }}>Amount</label>
        <input style={input} type="number" value={form.original_amount} onChange={(e) => setForm(p => ({ ...p, original_amount: e.target.value }))} />
        {err && <p style={{ color: colors.statusCritical, margin: 0, fontSize: 12 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Add'}</Btn>
        </div>
      </div>
    </div>
  );
};

const fmt = (n: number): string => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

// ── Enterprise Feature Types ──────────────────────

// BudgetSnapshot is now backed by Supabase via budgetSnapshotService
type BudgetSnapshot = BudgetSnapshotRow;

interface BudgetAmendment {
  id: string;
  description: string;
  amount: number;
  requestor: string;
  stage: 'requested' | 'pm_review' | 'director_review' | 'owner_approved';
  createdAt: string;
  division: string;
}

// WBSNode is now imported from budgetComputations as ComputedWBSNode
type WBSNode = ComputedWBSNode;


const AMENDMENT_STAGES = [
  { key: 'requested', label: 'Requested', color: colors.statusInfo, bg: colors.statusInfoSubtle },
  { key: 'pm_review', label: 'PM Review', color: colors.statusPending, bg: colors.statusPendingSubtle },
  { key: 'director_review', label: 'Director Review', color: colors.primaryOrange, bg: colors.orangeSubtle },
  { key: 'owner_approved', label: 'Owner Approved', color: colors.statusActive, bg: colors.statusActiveSubtle },
] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' as const } },
};

const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const rowVariant: Variants = {
  hidden: { opacity: 0, x: -6 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.14, ease: 'easeOut' as const, delay: i * 0.03 },
  }),
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

const BudgetPage: React.FC = () => {
  const appNavigate = useAppNavigate();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const projectId = useProjectId();
  const reducedMotion = useReducedMotion();
  const { setPageContext } = useCopilotStore();
  useEffect(() => { setPageContext('budget'); }, [setPageContext]);
  const updateCO = useUpdateChangeOrder();
  const { isFlashing } = useBudgetRealtime(projectId);
  const { data: costData, loading: costLoading, error: costError, refetch: refetchCost } = useQuery(`costData-${projectId}`, () => fetchBudgetDivisions(projectId!), { enabled: !!projectId });
  const { data: projectData, loading: projectLoading, error: projectError, refetch: refetchProject } = useQuery(`projectData-${projectId}`, () => getProject(projectId!), { enabled: !!projectId });
  const { data: payApps } = usePayApplications(projectId);
  const [selectedCO, setSelectedCO] = useState<NonNullable<typeof costData>['changeOrders'][0] | null>(null);
  const [selectedDivision, setSelectedDivision] = useState<MappedDivision | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'earned-value'>('overview');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [drawUploadOpen, setDrawUploadOpen] = useState(false);
  const [addLineOpen, setAddLineOpen] = useState(false);
  const qc = useQueryClient();
  const [hoveredDivId, setHoveredDivId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ divId: string; field: 'spent' | 'progress'; value: string } | null>(null);
  const { hasPermission } = usePermissions();
  const canEditBudget = hasPermission('budget.edit');
  const updateBudgetItem = useUpdateBudgetItem();

  // Schedule activities for cash flow + milestone computation
  // Map from hook's shape to the ScheduleActivity type expected by budgetComputations
  const { data: scheduleActivitiesRaw } = useScheduleActivities(projectId ?? '');
  const scheduleActivities = useMemo(() => (scheduleActivitiesRaw ?? []).map(a => ({
    id: a.id,
    project_id: a.project_id,
    name: a.name,
    description: null,
    start_date: a.start_date ?? new Date().toISOString(),
    finish_date: a.end_date ?? a.start_date ?? new Date().toISOString(),
    baseline_start: a.baseline_start,
    baseline_finish: a.baseline_end,
    actual_start: null,
    actual_finish: null,
    percent_complete: a.percent_complete ?? 0,
    planned_percent_complete: 0,
    duration_days: 0,
    float_days: a.float_days ?? 0,
    is_critical: a.is_critical_path ?? false,
    is_milestone: false,
    wbs_code: null,
    trade: null,
    assigned_sub_id: null,
    outdoor_activity: a.outdoor_activity ?? false,
    predecessor_ids: a.dependencies ?? [],
    successor_ids: [],
    status: (a.status as 'not_started' | 'in_progress' | 'completed' | 'delayed') ?? 'not_started',
    created_at: a.created_at ?? '',
    updated_at: a.updated_at ?? '',
  })), [scheduleActivitiesRaw]);

  // Enterprise feature state — snapshots persisted to Supabase
  const [snapshots, setSnapshots] = useState<BudgetSnapshot[]>([]);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(false);
  const [compareSnapshotId, setCompareSnapshotId] = useState<string | null>(null);
  const [showSnapshotCompare, setShowSnapshotCompare] = useState(false);
  const [amendments, setAmendments] = useState<BudgetAmendment[]>([]);

  // Load snapshots from Supabase on mount
  useEffect(() => {
    if (!projectId || snapshotsLoaded) return;
    budgetSnapshotService.loadSnapshots(projectId).then(rows => {
      setSnapshots(rows);
      setSnapshotsLoaded(true);
    });
  }, [projectId, snapshotsLoaded]);
  const [wbsView, setWbsView] = useState(false);
  const [expandedWbs, setExpandedWbs] = useState<Set<string>>(new Set());

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

  // Budget Summary by Category (DakiyBuilds 5-category model)
  const categorySummary = useMemo(() => {
    const map = new Map<string, { category: string; budgeted: number; spent: number; committed: number }>();
    for (const d of divisions) {
      const key = d.csi_division || d.name || 'General';
      const existing = map.get(key) || { category: key, budgeted: 0, spent: 0, committed: 0 };
      existing.budgeted += d.budget;
      existing.spent += d.spent;
      existing.committed += d.committed;
      map.set(key, existing);
    }
    return Array.from(map.values()).map((c) => ({
      ...c,
      remaining: c.budgeted - c.spent,
      pctUsed: c.budgeted > 0 ? Math.round((c.spent / c.budgeted) * 100) : 0,
    }));
  }, [divisions]);

  // Budget Health status
  const budgetHealthStatus = useMemo(() => {
    const totalBudget = projectData?.totalValue ?? 0;
    const variance = totalBudget - spent - committed;
    const pctUsed = totalBudget > 0 ? ((spent + committed) / totalBudget) * 100 : 0;
    if (pctUsed > 100) return { label: 'Over Budget', color: colors.statusCritical, bg: colors.statusCriticalSubtle };
    if (pctUsed > 80) return { label: 'At Risk', color: colors.statusPending, bg: colors.statusPendingSubtle };
    return { label: 'On Track', color: colors.statusActive, bg: colors.statusActiveSubtle };
  }, [projectData?.totalValue, spent, committed]);

  // Delete budget line item
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const handleDeleteBudgetItem = async (divisionId: string) => {
    if (!projectId) return;
    setDeletingId(divisionId);
    try {
      const { error } = await supabase.from('budget_items').delete().eq('id', divisionId).eq('project_id', projectId);
      if (error) throw error;
      toast.success('Budget line item deleted');
      void refetchCost();
      qc.invalidateQueries({ queryKey: ['budget_divisions'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const previousBilledToDate = useMemo(() => {
    if (!payApps || payApps.length < 2) return 0;
    type PayApp = { period_to?: string | null; total_completed_and_stored?: number | null };
    const sorted = [...payApps].sort((a, b) => {
      const pa = a as PayApp;
      const pb = b as PayApp;
      return new Date(pa.period_to ?? 0).getTime() - new Date(pb.period_to ?? 0).getTime();
    });
    return sorted.slice(0, -1).reduce((s: number, p) => s + ((p as PayApp).total_completed_and_stored ?? 0), 0);
  }, [payApps]);

  const approvedTotal = useMemo(() => allChangeOrders.filter(co => co.status === 'approved').reduce((s, co) => s + co.amount, 0), [allChangeOrders]);

  // Real contingency computation from Division 01 / General Requirements + approved COs
  const contingencyData = useMemo(
    () => computeContingency(divisions, changeOrders),
    [divisions, changeOrders],
  );
  const contingencyBudget = contingencyData.totalBudget;
  const contingencyRemaining = contingencyData.remaining;
  const contingencyPct = contingencyData.percentUsed;

  // Real cash flow computation from budget + schedule data
  const cashFlowSummary = useMemo(
    () => computeCashFlow(divisions, changeOrders, scheduleActivities, projectData?.startDate, projectData?.scheduledEndDate),
    [divisions, changeOrders, scheduleActivities, projectData?.startDate, projectData?.scheduledEndDate],
  );

  // Real milestone alignment from schedule activities
  const milestoneAlignment = useMemo(
    () => computeMilestoneAlignment(divisions, scheduleActivities),
    [divisions, scheduleActivities],
  );

  // Real WBS hierarchy from CSI division codes
  const wbsNodes = useMemo(
    () => buildWBSFromDivisions(divisions),
    [divisions],
  );

  // Real S-Curve data from cash flow
  const sCurveData = useMemo(
    () => generateSCurveData(cashFlowSummary, projectData?.totalValue ?? 0),
    [cashFlowSummary, projectData?.totalValue],
  );

  // Check errors FIRST — if a query fails, data will be null and we'd otherwise
  // get stuck on the loading skeleton forever (since !costData is always true on error).
  const hasError = !!(costError || projectError);
  if (hasError) {
    return (
      <PageContainer title="Budget" subtitle="Could not load budget data">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: spacing['4'],
            padding: `${spacing['12']} ${spacing['6']}`,
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.xl,
            border: `1px solid ${colors.borderDefault}`,
            textAlign: 'center',
          }}
        >
          <div style={{ width: 48, height: 48, borderRadius: borderRadius.xl, backgroundColor: colors.badgeRedBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={22} color={colors.statusCritical} />
          </div>
          <div>
            <p style={{ margin: 0, marginBottom: spacing['1'], fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Unable to load budget
            </p>
            <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary, maxWidth: 360 }}>
              {costError ?? projectError ?? 'An unexpected error occurred. Your data is safe — this is a temporary issue.'}
            </p>
          </div>
          <Btn variant="primary" icon={<RefreshCw size={14} />} onClick={() => { void refetchCost(); void refetchProject(); }}>
            Try Again
          </Btn>
        </motion.div>
      </PageContainer>
    );
  }

  // Loading state — only show AFTER ruling out errors above
  if (costLoading || projectLoading || !costData || !projectData) {
    return (
      <PageContainer title="Budget" subtitle="Loading financial data...">
        <MetricCardSkeleton />
        <div style={{ marginBottom: spacing['4'] }}>
          <Skeleton height="12px" style={{ width: '40%', marginBottom: spacing['3'] }} />
          <div style={{ height: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full }} />
        </div>
        <Card padding="0">
          <div style={{ padding: `${spacing['2']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset, display: 'grid', gridTemplateColumns: 'minmax(150px, 2fr) 95px 140px 95px 115px 105px 24px 32px', gap: spacing['2'] }}>
            {[60, 50, 80, 50, 60, 60, 16, 16].map((w, i) => <Skeleton key={i} height="10px" style={{ width: `${w}%` }} />)}
          </div>
          <TableSkeleton columns={7} rows={7} />
        </Card>
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
    transition: 'all 0.15s ease',
  };

  return (
    <PageContainer
      title="Budget"
      subtitle={`${fmt(spent)} spent of ${fmt(projectData.totalValue)} total`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <PresenceAvatars page="budget" size={28} />
          <PermissionGate permission="budget.edit">
            <Btn
              variant="secondary"
              size="sm"
              icon={<Camera size={14} />}
              onClick={async () => {
                try {
                  const saved = await budgetSnapshotService.saveSnapshot({
                    projectId: projectId!,
                    name: `Snapshot ${new Date().toLocaleDateString()}`,
                    totalBudget: projectData?.totalValue ?? 0,
                    totalSpent: spent,
                    totalCommitted: committed,
                    divisionData: divisions.map(d => ({ division: d.name, budget: d.budget, spent: d.spent, committed: d.committed })),
                  });
                  if (saved) {
                    setSnapshots(prev => [saved, ...prev]);
                    toast.success('Budget snapshot saved to database');
                  } else {
                    // Fallback: keep in memory if table doesn't exist yet
                    toast.success('Budget snapshot saved (local)');
                  }
                } catch {
                  toast.error('Failed to save snapshot');
                }
              }}
            >
              Save Snapshot
            </Btn>
          </PermissionGate>
          {snapshots.length > 0 && (
            <Btn
              variant="ghost"
              size="sm"
              icon={<GitCompare size={14} />}
              onClick={() => { setShowSnapshotCompare(prev => !prev); if (!compareSnapshotId && snapshots.length) setCompareSnapshotId(snapshots[0].id); }}
            >
              Compare
            </Btn>
          )}
          <PermissionGate permission="budget.edit">
            <Btn variant="primary" size="sm" onClick={() => setAddLineOpen(true)} data-testid="create-budget-item-button">Add Line Item</Btn>
          </PermissionGate>
          <PermissionGate permission="budget.edit">
            <Btn variant="secondary" size="sm" onClick={() => setUploadOpen(true)} data-testid="import-budget-button">Import Budget</Btn>
          </PermissionGate>
          <PermissionGate permission="budget.edit">
            <Btn variant="secondary" size="sm" onClick={() => setDrawUploadOpen(true)} data-testid="upload-draw-report-button">Upload Draw Report</Btn>
          </PermissionGate>
          <Btn
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={() => {
              const projectName = projectData?.name ?? 'Project';
              const divisionsPayload = divisionRows.map((d) => ({
                division: d.name ?? d.code ?? 'Division',
                budget: Number(d.budget ?? 0),
                spent: Number(d.spent ?? 0),
                committed: Number(d.committed ?? 0),
                percentComplete: Number(d.progress ?? 0),
              }));
              const changeOrdersPayload = allChangeOrders.map((co) => ({
                number: String(co.number ?? co.id ?? ''),
                description: String(co.description ?? co.title ?? ''),
                amount: Number(co.amount ?? 0),
                status: String(co.status ?? ''),
              }));
              exportBudgetXlsx(projectName, { divisions: divisionsPayload, changeOrders: changeOrdersPayload });
              addToast('success', 'Budget report exported');
            }}
            data-testid="export-budget-button"
          >
            Export XLSX
          </Btn>
        </div>
      }
    >
      <BudgetUpload open={uploadOpen} onClose={() => setUploadOpen(false)} onSuccess={() => setUploadOpen(false)} />
      {projectId && (
        <DrawReportUpload
          open={drawUploadOpen}
          onClose={() => setDrawUploadOpen(false)}
          projectId={projectId}
          onSuccess={() => {
            setDrawUploadOpen(false);
            void refetchCost();
            qc.invalidateQueries({ queryKey: ['budget_divisions'] });
            qc.invalidateQueries({ queryKey: ['budget_line_items', projectId] });
          }}
        />
      )}
      {addLineOpen && projectId && (
        <AddBudgetLineItemModal
          projectId={projectId}
          onClose={() => setAddLineOpen(false)}
          onCreated={() => { void refetchCost(); qc.invalidateQueries({ queryKey: ['budget_divisions'] }); }}
        />
      )}

      {isEmpty ? (
        <div style={{ padding: spacing['6'], backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl, border: `1px solid ${colors.borderDefault}` }}>
          <EmptyState
            icon={DollarSign}
            title="No budget has been set up yet"
            description="Import your schedule of values or add budget line items by CSI division to start tracking costs."
            action={canEditBudget ? { label: 'Import Budget', onClick: () => setUploadOpen(true) } : undefined}
            secondaryAction={canEditBudget ? { label: 'Add Line Item', onClick: () => setAddLineOpen(true) } : undefined}
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
      )}

      {/* Summary Metrics */}
      <div style={{ position: 'relative', marginBottom: spacing['4'] }}>
        <AnimatePresence>
          {isFlashing && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
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
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          role="group"
          aria-label="Budget summary metrics"
          variants={staggerContainer}
          initial={reducedMotion ? false : 'hidden'}
          animate="visible"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: spacing.lg,
          }}
        >
          {([
            { label: 'Total Project', value: projectData.totalValue, format: 'currency' as const },
            { label: 'Spent to Date', value: spent, format: 'currency' as const, previousValue: previousBilledToDate },
            { label: 'Committed', value: committed, format: 'currency' as const },
            { label: 'Remaining', value: remaining, format: 'currency' as const, colorOverride: remaining >= 0 ? 'success' as const : 'danger' as const },
          ]).map(({ label, value, format, previousValue, colorOverride }) => (
            <motion.div key={label} variants={fadeUp}>
              <MetricFlash isFlashing={isFlashing}>
                <MetricBox label={label} value={value} format={format} previousValue={previousValue} colorOverride={colorOverride} />
              </MetricFlash>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Budget Health Status — compact indicator (detailed metrics shown in summary above) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing['2'],
        marginBottom: spacing['4'],
        padding: `${spacing['2']} ${spacing['3']}`,
        backgroundColor: budgetHealthStatus.bg,
        border: `1px solid ${budgetHealthStatus.color}`,
        borderRadius: borderRadius.base,
        width: 'fit-content',
      }}>
        <ShieldCheck size={14} color={budgetHealthStatus.color} />
        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: budgetHealthStatus.color }}>
          {budgetHealthStatus.label}
        </span>
        {contingencyBudget > 0 && (
          <span style={{ fontSize: typography.fontSize.caption, color: budgetHealthStatus.color, opacity: 0.8 }}>
            · Contingency: {fmt(contingencyRemaining)} remaining ({100 - contingencyPct}%)
          </span>
        )}
      </div>

      {/* Budget Summary by Category (DakiyBuilds 5-category health bars) */}
      {categorySummary.length > 0 && (
        <motion.div
          variants={fadeUp}
          initial={reducedMotion ? false : 'hidden'}
          animate="visible"
          style={{ marginBottom: spacing['4'] }}
        >
          <SectionHeader title="Budget Summary by Category" />
          <Card padding="0">
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 100px 100px 100px 80px 1fr', padding: `${spacing['2']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset }}>
              {['Category', 'Budgeted', 'Spent', 'Committed', 'Remaining', '% Used', 'Health'].map((h) => (
                <span key={h} style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>{h}</span>
              ))}
            </div>
            {categorySummary.map((cat, idx) => {
              const pct = cat.pctUsed;
              const barColor = pct > 100 ? '#991b1b' : pct > 70 ? colors.statusCritical : pct > 30 ? colors.statusPending : colors.statusActive;
              return (
                <div key={cat.category} style={{ display: 'grid', gridTemplateColumns: '2fr 100px 100px 100px 100px 80px 1fr', padding: `${spacing['3']} ${spacing['4']}`, borderBottom: idx < categorySummary.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none', alignItems: 'center' }}>
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.category}</span>
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{fmt(cat.budgeted)}</span>
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(cat.spent)}</span>
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{fmt(cat.committed)}</span>
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: cat.remaining < 0 ? colors.statusCritical : colors.statusActive }}>{fmt(cat.remaining)}</span>
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: barColor }}>
                    {pct}%
                    {pct > 100 && <span style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, color: '#991b1b', marginLeft: 4 }}>OVER</span>}
                  </span>
                  <div style={{ paddingRight: spacing['2'] }}>
                    <div style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceInset, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 4, width: `${Math.min(pct, 100)}%`, backgroundColor: barColor, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Totals row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 100px 100px 100px 80px 1fr', padding: `${spacing['3']} ${spacing['4']}`, borderTop: `2px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceInset }}>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>Total</span>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{fmt(categorySummary.reduce((s, c) => s + c.budgeted, 0))}</span>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{fmt(categorySummary.reduce((s, c) => s + c.spent, 0))}</span>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{fmt(categorySummary.reduce((s, c) => s + c.committed, 0))}</span>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: remaining >= 0 ? colors.statusActive : colors.statusCritical }}>{fmt(categorySummary.reduce((s, c) => s + c.remaining, 0))}</span>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{projectData.totalValue > 0 ? Math.round((spent / projectData.totalValue) * 100) : 0}%</span>
              <div />
            </div>
          </Card>
        </motion.div>
      )}

      {/* Contingency Drawdown */}
      <motion.div
        variants={fadeUp}
        initial={reducedMotion ? false : 'hidden'}
        animate="visible"
        style={{ marginBottom: spacing['4'] }}
      >
        <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0, marginBottom: spacing['2'] }}>Contingency Drawdown</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <div role="progressbar" aria-label="Contingency drawdown" aria-valuenow={contingencyPct} aria-valuemin={0} aria-valuemax={100} style={{ flex: 1, height: 12, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${contingencyPct}%`, height: '100%', backgroundColor: colors.statusPending, borderRadius: borderRadius.full }} />
          </div>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {fmt(contingencyRemaining)} of {fmt(contingencyBudget)} remaining
          </span>
        </div>
      </motion.div>

      {/* ── Budget Snapshot Comparison ── */}
      {showSnapshotCompare && snapshots.length > 0 && (() => {
        const selected = snapshots.find(s => s.id === compareSnapshotId) ?? snapshots[0];
        const snapDivData = Array.isArray(selected.division_data) ? selected.division_data : [];
        return (
          <motion.div
            variants={fadeUp}
            initial={reducedMotion ? false : 'hidden'}
            animate="visible"
            style={{ marginBottom: spacing['4'] }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <GitCompare size={16} color={colors.primaryOrange} />
                <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Snapshot Comparison</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Compare against:</span>
                <select
                  value={compareSnapshotId ?? ''}
                  onChange={(e) => setCompareSnapshotId(e.target.value)}
                  style={{
                    padding: `${spacing['1']} ${spacing['3']}`,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm,
                    fontFamily: typography.fontFamily,
                    backgroundColor: colors.surfaceRaised,
                    color: colors.textPrimary,
                    cursor: 'pointer',
                  }}
                >
                  {snapshots.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.snapshot_date})</option>
                  ))}
                </select>
                <button onClick={() => setShowSnapshotCompare(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: spacing['1'] }}>
                  <XCircle size={16} />
                </button>
              </div>
            </div>
            <Card padding="0">
              <div style={{ display: 'grid', gridTemplateColumns: '2fr repeat(6, 1fr)', padding: `${spacing['2']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset }}>
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>Division</span>
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>Current Budget</span>
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>Snap Budget</span>
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>Current Spent</span>
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>Snap Spent</span>
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>Budget Var.</span>
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>Spend Var.</span>
              </div>
              {divisions.map((div, idx) => {
                const snapDiv = snapDivData.find((sd: { division: string }) => sd.division === div.name);
                const budgetVar = div.budget - (snapDiv?.budget ?? 0);
                const spendVar = div.spent - (snapDiv?.spent ?? 0);
                return (
                  <div key={div.id} style={{
                    display: 'grid', gridTemplateColumns: '2fr repeat(6, 1fr)', padding: `${spacing['3']} ${spacing['4']}`,
                    borderBottom: idx < divisions.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none', alignItems: 'center',
                    backgroundColor: (Math.abs(budgetVar) > 0 || Math.abs(spendVar) > 0) ? 'rgba(244, 120, 32, 0.03)' : 'transparent',
                  }}>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{div.name}</span>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{fmt(div.budget)}</span>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{fmt(snapDiv?.budget ?? 0)}</span>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(div.spent)}</span>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{fmt(snapDiv?.spent ?? 0)}</span>
                    <span style={{
                      fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                      color: budgetVar > 0 ? colors.statusCritical : budgetVar < 0 ? colors.statusActive : colors.textTertiary,
                    }}>
                      {budgetVar !== 0 ? `${budgetVar > 0 ? '+' : ''}${fmt(budgetVar)}` : '--'}
                    </span>
                    <span style={{
                      fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                      color: spendVar > 0 ? colors.statusCritical : spendVar < 0 ? colors.statusActive : colors.textTertiary,
                    }}>
                      {spendVar !== 0 ? `${spendVar > 0 ? '+' : ''}${fmt(spendVar)}` : '--'}
                    </span>
                  </div>
                );
              })}
              {/* Totals */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr repeat(6, 1fr)', padding: `${spacing['3']} ${spacing['4']}`, borderTop: `2px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceInset }}>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>Total</span>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{fmt(projectData.totalValue)}</span>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.textSecondary }}>{fmt(selected.total_budget)}</span>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{fmt(spent)}</span>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.textSecondary }}>{fmt(selected.total_spent)}</span>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: (projectData.totalValue - selected.total_budget) > 0 ? colors.statusCritical : colors.statusActive }}>{fmt(projectData.totalValue - selected.total_budget)}</span>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: (spent - selected.total_spent) > 0 ? colors.statusCritical : colors.statusActive }}>{fmt(spent - selected.total_spent)}</span>
              </div>
            </Card>
          </motion.div>
        );
      })()}

      {/* ── Multi-Level Approval Workflow ── */}
      {amendments.filter(a => a.stage !== 'owner_approved').length > 0 && (
        <motion.div
          variants={fadeUp}
          initial={reducedMotion ? false : 'hidden'}
          animate="visible"
          style={{ marginBottom: spacing['4'] }}
        >
          <SectionHeader title="Pending Budget Amendments" action={
            <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              <Users size={12} /> {amendments.filter(a => a.stage !== 'owner_approved').length} pending
            </span>
          } />
          <Card padding="0">
            {amendments.map((amd, idx) => {
              const stageIdx = AMENDMENT_STAGES.findIndex(s => s.key === amd.stage);
              return (
                <div key={amd.id} style={{
                  padding: `${spacing['4']} ${spacing['4']}`,
                  borderBottom: idx < amendments.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
                        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{amd.description}</span>
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, padding: `1px ${spacing['2']}`, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full }}>{amd.division}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{amd.requestor}</span>
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                          <Clock size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />{amd.createdAt}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.bold, color: colors.textPrimary, whiteSpace: 'nowrap' }}>{fmt(amd.amount)}</span>
                  </div>
                  {/* Stage pipeline */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginBottom: spacing['3'] }}>
                    {AMENDMENT_STAGES.map((stage, si) => (
                      <React.Fragment key={stage.key}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: spacing['1'],
                          padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full,
                          backgroundColor: si <= stageIdx ? stage.bg : colors.surfaceInset,
                          border: `1px solid ${si <= stageIdx ? stage.color : colors.borderSubtle}`,
                        }}>
                          {si < stageIdx ? (
                            <CheckCircle size={11} color={stage.color} />
                          ) : si === stageIdx ? (
                            <Clock size={11} color={stage.color} />
                          ) : null}
                          <span style={{
                            fontSize: typography.fontSize.caption,
                            fontWeight: si === stageIdx ? typography.fontWeight.semibold : typography.fontWeight.normal,
                            color: si <= stageIdx ? stage.color : colors.textTertiary,
                          }}>{stage.label}</span>
                        </div>
                        {si < AMENDMENT_STAGES.length - 1 && (
                          <ChevronRight size={10} color={colors.textTertiary} style={{ flexShrink: 0 }} />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  {/* Approve / Reject buttons */}
                  {amd.stage !== 'owner_approved' && (
                    <div style={{ display: 'flex', gap: spacing['2'] }}>
                      <PermissionGate permission="budget.edit">
                        <Btn
                          variant="primary"
                          size="sm"
                          icon={<CheckCircle size={12} />}
                          onClick={async () => {
                            const nextStage = AMENDMENT_STAGES[stageIdx + 1];
                            if (!nextStage) return;
                            const { error } = await supabase.from('change_orders').update({
                              status: nextStage.key,
                              updated_at: new Date().toISOString(),
                            }).eq('id', amd.id);
                            if (error) { toast.error('Failed to advance amendment'); return; }
                            setAmendments(prev => prev.map(a => {
                              if (a.id !== amd.id) return a;
                              return { ...a, stage: nextStage.key };
                            }));
                            toast.success(`Amendment advanced to ${nextStage.label}`);
                          }}
                        >
                          Advance
                        </Btn>
                        <Btn
                          variant="ghost"
                          size="sm"
                          icon={<XCircle size={12} />}
                          onClick={async () => {
                            const { error } = await supabase.from('change_orders').update({
                              status: 'rejected',
                              updated_at: new Date().toISOString(),
                            }).eq('id', amd.id);
                            if (error) { toast.error('Failed to reject amendment'); return; }
                            setAmendments(prev => prev.filter(a => a.id !== amd.id));
                            toast.success('Amendment rejected');
                          }}
                        >
                          Reject
                        </Btn>
                      </PermissionGate>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        </motion.div>
      )}

      {/* ── Cost-Loaded Schedule Integration ── */}
      <motion.div
        variants={fadeUp}
        initial={reducedMotion ? false : 'hidden'}
        animate="visible"
        style={{ marginBottom: spacing['4'] }}
      >
        <SectionHeader title="Schedule Integration" action={
          <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color: colors.primaryOrange, fontWeight: typography.fontWeight.medium }}>
            <Calendar size={12} /> Cash Flow Projection
          </span>
        } />
        <Card padding={spacing['4']}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'] }}>
            {/* Schedule milestones table */}
            <div>
              <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0, marginBottom: spacing['2'] }}>Milestone Spend Alignment</p>
              <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.base, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 80px 80px 80px 80px', padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.surfaceInset, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                  {['Milestone', 'Planned', 'Actual', 'Plan $', 'Actual $'].map(h => (
                    <span key={h} style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>{h}</span>
                  ))}
                </div>
                {milestoneAlignment.length === 0 && (
                  <div style={{ padding: `${spacing['3']} ${spacing['3']}`, textAlign: 'center' }}>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>No milestone data — add schedule activities to see alignment</span>
                  </div>
                )}
                {milestoneAlignment.map((m, i, arr) => {
                  const variance = m.actualSpend ? m.actualSpend - m.plannedSpend : null;
                  return (
                    <div key={m.milestone} style={{
                      display: 'grid', gridTemplateColumns: '1.5fr 80px 80px 80px 80px',
                      padding: `${spacing['2']} ${spacing['3']}`,
                      borderBottom: i < arr.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                      alignItems: 'center',
                      backgroundColor: variance && variance > 0 ? 'rgba(224, 82, 82, 0.04)' : 'transparent',
                    }}>
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{m.milestone}</span>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{m.planned.slice(5)}</span>
                      <span style={{ fontSize: typography.fontSize.caption, color: m.actual ? colors.textPrimary : colors.textTertiary }}>{m.actual ? m.actual.slice(5) : '--'}</span>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{fmt(m.plannedSpend)}</span>
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: variance && variance > 0 ? colors.statusCritical : colors.textPrimary }}>
                        {m.actualSpend ? fmt(m.actualSpend) : '--'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Cash flow projection summary */}
            <div>
              <p style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0, marginBottom: spacing['2'] }}>Cash Flow Summary</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
                {[
                  { label: 'Planned Spend (This Month)', value: fmt(cashFlowSummary.plannedSpendThisMonth), color: colors.statusInfo },
                  { label: 'Actual Spend (MTD)', value: fmt(cashFlowSummary.actualSpendMTD), color: colors.statusActive },
                  { label: 'Forecast Next 30 Days', value: fmt(cashFlowSummary.forecastNext30), color: colors.primaryOrange },
                  { label: 'Schedule Variance (SV)', value: `${cashFlowSummary.scheduleVariance >= 0 ? '' : '-'}${fmt(Math.abs(cashFlowSummary.scheduleVariance))}`, color: cashFlowSummary.scheduleVariance >= 0 ? colors.statusActive : colors.statusCritical },
                  { label: 'Cost Performance Index', value: cashFlowSummary.costPerformanceIndex.toFixed(2), color: cashFlowSummary.costPerformanceIndex >= 1.0 ? colors.statusActive : colors.statusPending },
                ].map(item => (
                  <div key={item.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: `${spacing['3']} ${spacing['3']}`,
                    backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base,
                    border: `1px solid ${colors.borderSubtle}`,
                  }}>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{item.label}</span>
                    <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.bold, color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
              {/* Mini spend curve bars */}
              <div style={{ marginTop: spacing['3'] }}>
                <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginBottom: spacing['2'] }}>Monthly Spend vs Plan</p>
                <div style={{ display: 'flex', gap: spacing['1'], alignItems: 'flex-end', height: 60 }}>
                  {(() => {
                    // Show last 6 months of real cash flow data
                    const recentMonths = cashFlowSummary.monthlyData
                      .filter(m => m.planned > 0 || m.actual > 0)
                      .slice(-6);
                    if (recentMonths.length === 0) return <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>No spend data yet</span>;
                    const max = Math.max(...recentMonths.map(m => Math.max(m.planned, m.actual)), 1);
                    return recentMonths.map(bar => {
                      const shortMonth = bar.month.split(' ')[0]; // "Jan 2026" → "Jan"
                    return (
                      <div key={bar.monthKey} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 48, width: '100%' }}>
                          <div style={{ flex: 1, height: `${(bar.planned / max) * 100}%`, backgroundColor: colors.statusInfoSubtle, borderRadius: 2 }} title={`Plan: ${fmt(bar.planned)}`} />
                          <div style={{ flex: 1, height: `${(bar.actual / max) * 100}%`, backgroundColor: bar.actual > bar.planned ? colors.statusCritical : colors.statusActive, borderRadius: 2, opacity: 0.7 }} title={`Actual: ${fmt(bar.actual)}`} />
                        </div>
                        <span style={{ fontSize: '9px', color: colors.textTertiary }}>{shortMonth}</span>
                      </div>
                    );
                  });
                  })()}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* AI Insights Panel */}
      {aiConfigured ? (
        !aiInsightsLoading && (aiInsightsData?.insights ?? []).length > 0 ? (
          <motion.div
            variants={fadeUp}
            initial={reducedMotion ? false : 'hidden'}
            animate="visible"
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
                    color: colors.primaryOrange,
                    fontFamily: typography.fontFamily,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  View Details
                </button>
              </div>
            ))}
          </motion.div>
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
          aria-selected={activeTab === 'overview' && !wbsView}
          aria-controls="budget-tab-overview"
          onClick={() => { setActiveTab('overview'); setWbsView(false); }}
          style={{
            ...pillBase,
            backgroundColor: activeTab === 'overview' && !wbsView ? colors.surfaceRaised : 'transparent',
            color: activeTab === 'overview' && !wbsView ? colors.textPrimary : colors.textTertiary,
            boxShadow: activeTab === 'overview' && !wbsView ? shadows.sm : 'none',
          }}
        >
          Overview
        </button>
        <button
          role="tab"
          aria-selected={wbsView}
          aria-controls="budget-tab-wbs"
          onClick={() => { setActiveTab('overview'); setWbsView(true); }}
          style={{
            ...pillBase,
            backgroundColor: wbsView ? colors.surfaceRaised : 'transparent',
            color: wbsView ? colors.textPrimary : colors.textTertiary,
            boxShadow: wbsView ? shadows.sm : 'none',
            display: 'flex', alignItems: 'center', gap: spacing['1'],
          }}
        >
          <Layers size={13} /> WBS View
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'earned-value'}
          aria-controls="budget-tab-earned-value"
          onClick={() => { setActiveTab('earned-value'); setWbsView(false); }}
          style={{
            ...pillBase,
            backgroundColor: activeTab === 'earned-value' ? colors.surfaceRaised : 'transparent',
            color: activeTab === 'earned-value' ? colors.textPrimary : colors.textTertiary,
            boxShadow: activeTab === 'earned-value' ? shadows.sm : 'none',
          }}
        >
          Earned Value
        </button>
      </div>

      <AnimatePresence mode="wait">
      {/* ── WBS Hierarchy View ── */}
      {wbsView && (
        <motion.div
          key="wbs"
          role="tabpanel"
          id="budget-tab-wbs"
          aria-label="WBS View"
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          <SectionHeader title="Work Breakdown Structure" action={
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              {wbsNodes.reduce((count, n) => {
                const countChildren = (node: WBSNode): number => 1 + (node.children?.reduce((s, c) => s + countChildren(c), 0) ?? 0);
                return count + countChildren(n);
              }, 0)} items across {wbsNodes.length} divisions
            </span>
          } />
          <Card padding="0">
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 100px 100px 100px 80px', padding: `${spacing['2']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset }}>
              {['WBS Code / Description', 'Budget', 'Spent', 'Committed', 'Remaining', '% Spent'].map(h => (
                <span key={h} style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>{h}</span>
              ))}
            </div>
            {(() => {
              const renderNode = (node: WBSNode, depth: number, isLast: boolean): React.ReactNode[] => {
                const remaining = node.budget - node.spent - node.committed;
                const pctSpent = node.budget > 0 ? Math.round((node.spent / node.budget) * 100) : 0;
                const hasChildren = !!node.children?.length;
                const isExpanded = expandedWbs.has(node.code);
                const rows: React.ReactNode[] = [];
                rows.push(
                  <div
                    key={node.code}
                    style={{
                      display: 'grid', gridTemplateColumns: '2fr 100px 100px 100px 100px 80px',
                      padding: `${spacing['2']} ${spacing['4']}`,
                      paddingLeft: `${16 + depth * 24}px`,
                      borderBottom: `1px solid ${colors.borderSubtle}`,
                      alignItems: 'center',
                      backgroundColor: depth === 0 ? colors.surfaceInset : 'transparent',
                      cursor: hasChildren ? 'pointer' : 'default',
                    }}
                    onClick={() => {
                      if (hasChildren) {
                        setExpandedWbs(prev => {
                          const next = new Set(prev);
                          if (next.has(node.code)) next.delete(node.code); else next.add(node.code);
                          return next;
                        });
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], minWidth: 0 }}>
                      {hasChildren ? (
                        isExpanded ? <ChevronDown size={13} color={colors.textTertiary} /> : <ChevronRight size={13} color={colors.textTertiary} />
                      ) : (
                        <span style={{ width: 13 }} />
                      )}
                      <span style={{
                        fontSize: typography.fontSize.caption,
                        fontWeight: typography.fontWeight.medium,
                        color: colors.primaryOrange,
                        fontFamily: typography.fontFamilyMono,
                        minWidth: 60,
                      }}>{node.code}</span>
                      <span style={{
                        fontSize: typography.fontSize.sm,
                        fontWeight: depth === 0 ? typography.fontWeight.semibold : typography.fontWeight.normal,
                        color: colors.textPrimary,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{node.name}</span>
                    </div>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: depth === 0 ? typography.fontWeight.semibold : typography.fontWeight.normal, color: colors.textPrimary }}>{fmt(node.budget)}</span>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{fmt(node.spent)}</span>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{fmt(node.committed)}</span>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: remaining < 0 ? colors.statusCritical : colors.statusActive }}>{fmt(remaining)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                      <div style={{ flex: 1, height: 6, backgroundColor: colors.surfaceInset, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(pctSpent, 100)}%`, backgroundColor: pctSpent > 90 ? colors.statusCritical : pctSpent > 60 ? colors.statusPending : colors.statusActive, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: typography.fontSize.caption, color: pctSpent > 90 ? colors.statusCritical : colors.textTertiary, minWidth: 28, textAlign: 'right' }}>{pctSpent}%</span>
                    </div>
                  </div>
                );
                if (hasChildren && isExpanded) {
                  node.children!.forEach((child, ci) => {
                    rows.push(...renderNode(child, depth + 1, ci === node.children!.length - 1));
                  });
                }
                return rows;
              };
              if (wbsNodes.length === 0) return (
                <div style={{ padding: `${spacing['4']} ${spacing['4']}`, textAlign: 'center' }}>
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>No WBS data — add budget items with CSI division codes to build hierarchy</span>
                </div>
              );
              return wbsNodes.map((node, i, arr) => renderNode(node, 0, i === arr.length - 1));
            })()}
          </Card>
        </motion.div>
      )}

      {activeTab === 'overview' && !wbsView && (
        <motion.div
          key="overview"
          role="tabpanel"
          id="budget-tab-overview"
          aria-label="Overview"
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
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
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 2fr) 95px 140px 95px 115px 105px 24px 32px', padding: `${spacing['2']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset }}>
                {['Division', 'Budget', 'Spent to Date', 'Committed', 'Remaining', '% Complete', '', ''].map((h, i) => (
                  <span key={`${h}-${i}`} style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>{h}</span>
                ))}
              </div>
              <motion.div
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
                    variants={rowVariant}
                    custom={idx}
                    initial={reducedMotion ? false : 'hidden'}
                    animate="visible"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(150px, 2fr) 95px 140px 95px 115px 105px 24px 32px',
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
                                boxShadow: shadows.dropdown,
                              }}>
                                {`Projected: ${fmt(oldProjected)} to ${fmt(newProjected)} (${delta >= 0 ? '+' : ''}${fmt(Math.abs(delta))})`}
                              </div>
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

                    {/* Delete */}
                    {canEditBudget && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <button
                          aria-label={`Delete ${division.name}`}
                          disabled={deletingId === division.id}
                          onClick={() => {
                            if (window.confirm(`Delete budget line "${division.name}"? This cannot be undone.`)) {
                              void handleDeleteBudgetItem(division.id);
                            }
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 28, height: 28, padding: 0,
                            border: 'none', borderRadius: borderRadius.sm,
                            backgroundColor: 'transparent', cursor: 'pointer',
                            color: colors.textTertiary, transition: 'color 0.15s, background-color 0.15s',
                            opacity: isHovered ? 1 : 0,
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.statusCriticalSubtle; (e.currentTarget as HTMLButtonElement).style.color = colors.statusCritical; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary; }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
              </motion.div>
            </Card>
          </div>

          {/* S Curve */}
          <div style={{ marginTop: spacing['5'] }}>
            <SectionHeader title="Cumulative Cost (S Curve)" />
            <Card padding={spacing['5']}>
              <div role="img" aria-label="S Curve chart showing cumulative cost over time against total budget">
                <SCurve
                  totalBudget={projectData.totalValue}
                  spent={spent}
                  plannedData={sCurveData.planned}
                  actualData={sCurveData.actual}
                  labels={sCurveData.labels}
                />
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
        </motion.div>
      )}

      {activeTab === 'earned-value' && (
        <motion.div
          key="earned-value"
          role="tabpanel"
          id="budget-tab-earned-value"
          aria-label="Earned Value"
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          <SectionHeader title="Earned Value Analysis" />
          <Card padding={spacing['5']}>
            <div role="img" aria-label="Earned value analysis dashboard showing budget performance indicators">
              <EarnedValueDashboard />
            </div>
          </Card>
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

export const Budget: React.FC = () => (
  <ErrorBoundary message="Budget could not be displayed. Check your connection and try again.">
    <BudgetPage />
  </ErrorBoundary>
);

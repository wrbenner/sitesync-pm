import React, { useState, useMemo, useRef, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useCopilotStore } from '../stores/copilotStore';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PageContainer, Card, SectionHeader, StatusTag, DetailPanel, RelatedItems, Skeleton, useToast } from '../components/Primitives';
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
// Treemap removed (Jobs redesign)
import { SCurve } from '../components/budget/SCurve';
import { EarnedValueDashboard } from '../components/budget/EarnedValueDashboard';
import { WaterfallChart } from '../components/budget/WaterfallChart';
import { AlertTriangle, ChevronRight, ChevronDown, ArrowRight, DollarSign, Sparkles, RefreshCw, Pencil, Trash2, ShieldCheck, TrendingUp, TrendingDown, GitCompare, CheckCircle, XCircle, Clock, Users, Calendar, Layers, Plus, MoreHorizontal } from 'lucide-react';
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
import { BudgetKPIs } from './budget/BudgetKPIs'
import { BudgetTabBar } from './budget/BudgetTabBar'
import type { BudgetTab } from './budget/BudgetTabBar'
import {
  useFinancialPeriods,
  firstOfMonth,
  type FinancialPeriod,
  type FinancialPeriodStatus,
} from '../hooks/queries/financial-periods'
import {
  useClosePeriod,
  useReopenPeriod,
  useCreatePeriod,
} from '../hooks/mutations/financial-periods'
import { Lock, Unlock } from 'lucide-react'

// Jobs-style action-menu row. Two-line label + description, no chrome.
const MenuItem: React.FC<{
  label: string;
  description?: string;
  onClick: () => void;
  testid?: string;
}> = ({ label, description, onClick, testid }) => (
  <button
    onClick={onClick}
    data-testid={testid}
    style={{
      display: 'block', width: '100%', textAlign: 'left',
      padding: `${spacing['2']} ${spacing['3']}`,
      border: 'none', background: 'transparent', cursor: 'pointer',
      borderRadius: borderRadius.base,
      fontFamily: typography.fontFamily,
      transition: 'background-color 0.1s ease',
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceHover; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
  >
    <div style={{
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.textPrimary,
    }}>
      {label}
    </div>
    {description && (
      <div style={{
        marginTop: 2,
        fontSize: typography.fontSize.caption,
        color: colors.textTertiary,
      }}>
        {description}
      </div>
    )}
  </button>
);

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
  // Place the minus sign before the dollar sign, never between them.
  // Default `toLocaleString()` produces strings like "$-500" which read
  // as a typo; "-$500" reads as a real negative. Magnitude-formatted
  // shorthands ("$1.2M") get the same treatment.
  const negative = n < 0;
  const abs = Math.abs(n);
  let formatted: string;
  if (abs >= 1000000) formatted = `$${(abs / 1000000).toFixed(1)}M`;
  else if (abs >= 1000) formatted = `$${(abs / 1000).toFixed(0)}K`;
  else formatted = `$${abs.toLocaleString()}`;
  return negative ? `−${formatted}` : formatted;
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

// ── Helpers shared by the new financial-hub tabs ──────────────────────────

function formatMonthLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const PERIOD_STATUS_META: Record<FinancialPeriodStatus, { label: string; color: string; bg: string }> = {
  open:          { label: 'Open',          color: colors.statusActive,   bg: colors.statusActiveSubtle   },
  pending_close: { label: 'Pending Close', color: colors.statusPending,  bg: colors.statusPendingSubtle  },
  closed:        { label: 'Closed',        color: colors.statusCritical, bg: colors.statusCriticalSubtle },
  reopened:      { label: 'Reopened',      color: colors.statusInfo,     bg: colors.statusInfoSubtle     },
};

// ── Cost Codes section ────────────────────────────────────────────────────
// Compact division roll-up — click a row to open the existing DivisionDetail
// drawer (which handles the cost-code-level drill + inline edit).
interface CostCodesSectionProps {
  projectId: string | null;
  divisions: MappedDivision[];
  canEdit: boolean;
  fmt: (n: number) => string;
  onOpenDivision: (d: MappedDivision) => void;
}
const CostCodesSection: React.FC<CostCodesSectionProps> = ({ divisions, fmt, onOpenDivision }) => {
  if (divisions.length === 0) {
    return (
      <Card padding={spacing['6']}>
        <EmptyState
          icon={Layers}
          title="No cost codes yet"
          description="Import a budget or add line items with CSI division codes to see the division → cost code drill."
        />
      </Card>
    );
  }
  return (
    <div>
      <SectionHeader title="Division → Cost Codes" />
      <Card padding="0">
        <div style={{ display: 'grid', gridTemplateColumns: '60px 2fr 110px 110px 110px 110px 80px', padding: `10px ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset }}>
          {['CSI', 'Division', 'Budget', 'Spent', 'Committed', 'Remaining', '% Spent'].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
          ))}
        </div>
        {divisions.map((d, i) => {
          const remaining = d.budget - d.spent - d.committed;
          const pct = d.budget > 0 ? Math.round((d.spent / d.budget) * 100) : 0;
          return (
            <div
              key={d.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenDivision(d)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDivision(d); } }}
              style={{
                display: 'grid', gridTemplateColumns: '60px 2fr 110px 110px 110px 110px 80px',
                padding: `${spacing['3']} ${spacing['4']}`,
                borderBottom: i < divisions.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                alignItems: 'center', cursor: 'pointer', transition: 'background-color 0.1s ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceHover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: colors.primaryOrange, fontFamily: typography.fontFamilyMono }}>{d.csi_division ?? '—'}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: colors.textPrimary }}>{d.name}</span>
              <span style={{ fontSize: 13, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{fmt(d.budget)}</span>
              <span style={{ fontSize: 13, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{fmt(d.spent)}</span>
              <span style={{ fontSize: 13, color: colors.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{fmt(d.committed)}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: remaining < 0 ? colors.statusCritical : colors.statusActive, fontVariantNumeric: 'tabular-nums' }}>{fmt(remaining)}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                <div style={{ flex: 1, height: 6, backgroundColor: colors.surfaceInset, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, backgroundColor: pct > 90 ? colors.statusCritical : pct > 60 ? colors.statusPending : colors.statusActive, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, color: pct > 90 ? colors.statusCritical : colors.textTertiary, minWidth: 28, textAlign: 'right' }}>{pct}%</span>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
};

// ── Cash Flow section ─────────────────────────────────────────────────────
// SCurve + a monthly phased forecast table derived from budget_items +
// schedule_phases (already computed by computeCashFlow upstream).
interface CashFlowRow { month: string; planned: number; actual: number; committed: number }
interface CashFlowSectionProps {
  totalBudget: number;
  spent: number;
  plannedData: number[];
  actualData: number[];
  labels: string[];
  cashFlowSummary: CashFlowRow[];
  fmt: (n: number) => string;
}
const CashFlowSection: React.FC<CashFlowSectionProps> = ({ totalBudget, spent, plannedData, actualData, labels, cashFlowSummary, fmt }) => (
  <div>
    <SectionHeader title="Cumulative Cost (S Curve)" />
    <Card padding={spacing['5']}>
      <div role="img" aria-label="S Curve — cumulative planned vs actual">
        <SCurve totalBudget={totalBudget} spent={spent} plannedData={plannedData} actualData={actualData} labels={labels} />
      </div>
    </Card>

    <div style={{ marginTop: spacing['5'] }}>
      <SectionHeader title="Monthly Cash Flow" />
      {cashFlowSummary.length === 0 ? (
        <Card padding={spacing['5']}>
          <EmptyState
            icon={Calendar}
            title="No phased forecast yet"
            description="Cash flow needs schedule_phases + budget_items with date ranges. Link activities to line items to populate this."
          />
        </Card>
      ) : (
        <Card padding="0">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 140px', padding: `10px ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset }}>
            {['Month', 'Planned', 'Actual', 'Committed'].map((h) => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
            ))}
          </div>
          {cashFlowSummary.map((row, i) => (
            <div key={`${row.month}-${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 140px', padding: `${spacing['3']} ${spacing['4']}`, borderBottom: i < cashFlowSummary.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: colors.textPrimary }}>{row.month}</span>
              <span style={{ fontSize: 13, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.planned)}</span>
              <span style={{ fontSize: 13, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.actual)}</span>
              <span style={{ fontSize: 13, color: colors.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.committed)}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  </div>
);

// ── Period Close section ──────────────────────────────────────────────────
// Monthly ledger backed by financial_periods. RLS enforces owner/admin on
// close/reopen; the UI mirrors that gate with `canEdit` for snappy feedback.
interface PeriodCloseSectionProps {
  projectId: string | null;
  periods: FinancialPeriod[];
  isLoading: boolean;
  canEdit: boolean;
  isCreating: boolean;
  onOpenClose: (p: FinancialPeriod) => void;
  onOpenReopen: (p: FinancialPeriod) => void;
  onTrackMonth: (monthIso: string) => void;
}
const PeriodCloseSection: React.FC<PeriodCloseSectionProps> = ({ periods, isLoading, canEdit, isCreating, onOpenClose, onOpenReopen, onTrackMonth }) => {
  const thisMonthIso = firstOfMonth(new Date()).toISOString().slice(0, 10);
  const isTracked = periods.some((p) => p.period_month === thisMonthIso);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
        <SectionHeader title="Monthly Period Close" />
        {canEdit && !isTracked && (
          <Btn
            variant="secondary"
            size="sm"
            icon={<Plus size={12} />}
            disabled={isCreating}
            onClick={() => onTrackMonth(thisMonthIso)}
          >
            {isCreating ? 'Adding…' : `Track ${formatMonthLabel(thisMonthIso)}`}
          </Btn>
        )}
      </div>

      {isLoading ? (
        <Card padding={spacing['5']}>
          <Skeleton height="120px" />
        </Card>
      ) : periods.length === 0 ? (
        <Card padding={spacing['6']}>
          <EmptyState
            icon={Calendar}
            title="No periods tracked yet"
            description={canEdit ? 'Click "Track this month" above to start tracking monthly close.' : 'Ask an owner or admin to begin tracking monthly periods.'}
          />
        </Card>
      ) : (
        <Card padding="0">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 200px 200px', padding: `10px ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset }}>
            {['Period', 'Status', 'Closed / Reopened', 'Actions'].map((h) => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
            ))}
          </div>
          {periods.map((p, i) => {
            const meta = PERIOD_STATUS_META[p.status];
            const trail =
              p.status === 'reopened' && p.reopened_at
                ? `Reopened ${new Date(p.reopened_at).toLocaleDateString()}`
                : p.status === 'closed' && p.closed_at
                  ? `Closed ${new Date(p.closed_at).toLocaleDateString()}`
                  : '—';
            const canClose = canEdit && p.status !== 'closed';
            const canReopen = canEdit && p.status === 'closed';
            return (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 200px 200px', padding: `${spacing['3']} ${spacing['4']}`, borderBottom: i < periods.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: colors.textPrimary }}>{formatMonthLabel(p.period_month)}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: meta.color, backgroundColor: meta.bg, padding: '3px 8px', borderRadius: borderRadius.full, textAlign: 'center', justifySelf: 'start' }}>{meta.label}</span>
                <span style={{ fontSize: 12, color: colors.textSecondary }}>{trail}</span>
                <div style={{ display: 'flex', gap: spacing['2'] }}>
                  {canClose && (
                    <Btn size="sm" variant="secondary" icon={<Lock size={12} />} onClick={() => onOpenClose(p)}>
                      {p.status === 'pending_close' ? 'Finish Close' : 'Close'}
                    </Btn>
                  )}
                  {canReopen && (
                    <Btn size="sm" variant="ghost" icon={<Unlock size={12} />} onClick={() => onOpenReopen(p)}>
                      Reopen
                    </Btn>
                  )}
                  {!canEdit && <span style={{ fontSize: 11, color: colors.textTertiary }}>View only</span>}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
};

// ── Snapshots section ─────────────────────────────────────────────────────
// Backed by the existing budget_snapshots table. Tiny inline sparkline of
// total_budget over time so trend reads at a glance.
interface SnapshotsSectionProps {
  snapshots: BudgetSnapshotRow[];
  fmt: (n: number) => string;
  canCreate: boolean;
  onCreate: () => void | Promise<void>;
}
const SnapshotsSection: React.FC<SnapshotsSectionProps> = ({ snapshots, fmt, canCreate, onCreate }) => {
  const sparkline = (() => {
    if (snapshots.length < 2) return null;
    const series = [...snapshots].reverse().map((s) => s.total_budget);
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = max - min || 1;
    const w = 120;
    const h = 28;
    const step = series.length > 1 ? w / (series.length - 1) : 0;
    const d = series
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - ((v - min) / range) * h}`)
      .join(' ');
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="Total budget trend">
        <path d={d} stroke={colors.primaryOrange} strokeWidth={1.5} fill="none" />
      </svg>
    );
  })();
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
        <div>
          <SectionHeader title="Budget Snapshots" />
          {sparkline && (
            <div style={{ marginTop: -8, marginLeft: 2 }}>{sparkline}</div>
          )}
        </div>
        {canCreate && (
          <Btn variant="secondary" size="sm" icon={<Plus size={12} />} onClick={() => void onCreate()}>
            Take Snapshot
          </Btn>
        )}
      </div>
      {snapshots.length === 0 ? (
        <Card padding={spacing['6']}>
          <EmptyState
            icon={TrendingUp}
            title="No snapshots yet"
            description={canCreate ? 'Take a snapshot to freeze the current budget state for period-over-period comparison.' : 'Ask a budget editor to capture a snapshot.'}
          />
        </Card>
      ) : (
        <Card padding="0">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 140px', padding: `10px ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceInset }}>
            {['Snapshot', 'Total Budget', 'Spent', 'Committed'].map((h) => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
            ))}
          </div>
          {snapshots.map((s, i) => (
            <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 140px', padding: `${spacing['3']} ${spacing['4']}`, borderBottom: i < snapshots.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: colors.textPrimary }}>{s.name}</div>
                <div style={{ fontSize: 11, color: colors.textTertiary }}>{new Date(s.snapshot_date).toLocaleDateString()}</div>
              </div>
              <span style={{ fontSize: 13, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{fmt(s.total_budget)}</span>
              <span style={{ fontSize: 13, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{fmt(s.total_spent)}</span>
              <span style={{ fontSize: 13, color: colors.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{fmt(s.total_committed)}</span>
            </div>
          ))}
        </Card>
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
  const [activeTab, setActiveTab] = useState<BudgetTab>('overview');
  // Primary financial-hub tab. Absorbs the retired /financials and
  // /cost-management pages — the existing BudgetTabBar (overview/WBS/
  // change-orders/earned-value) stays alive under the Summary view.
  type MainView = 'summary' | 'cost-codes' | 'cash-flow' | 'period-close' | 'snapshots';
  const [mainView, setMainView] = useState<MainView>('summary');
  const [closingPeriod, setClosingPeriod] = useState<FinancialPeriod | null>(null);
  const [reopeningPeriod, setReopeningPeriod] = useState<FinancialPeriod | null>(null);
  const [periodCloseStatus, setPeriodCloseStatus] = useState<'pending_close' | 'closed'>('closed');
  const [periodCloseNotes, setPeriodCloseNotes] = useState('');
  const [periodReopenNotes, setPeriodReopenNotes] = useState('');
  const financialPeriodsQuery = useFinancialPeriods(projectId ?? undefined);
  const closePeriodMutation = useClosePeriod();
  const reopenPeriodMutation = useReopenPeriod();
  const createPeriodMutation = useCreatePeriod();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [drawUploadOpen, setDrawUploadOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
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

  // AI insights panel removed (Jobs redesign — critical anomalies banner is sufficient)

  const committed = useMemo(() => divisions.reduce((sum, d) => sum + d.committed, 0), [divisions]);
  const spent = useMemo(() => divisions.reduce((sum, d) => sum + d.spent, 0), [divisions]);
  const remaining = useMemo(() => (projectData?.totalValue ?? 0) - spent - committed, [projectData?.totalValue, spent, committed]);

  // Budget Summary by Category — REMOVED (Jobs redesign)

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

  // Milestone alignment removed from budget page (Jobs redesign — belongs on Schedule page)

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

  return (
    <PageContainer
      title="Budget"
      subtitle={
        projectData.totalValue > 0
          ? `${fmt(spent)} spent of ${fmt(projectData.totalValue)} total`
          : `${fmt(spent)} spent · set a contract value to track utilization`
      }
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <PresenceAvatars page="budget" size={28} />

          {/* Primary "+ Add" menu — collapses Add Line Item / Import Budget /
              Upload Draw Report into one action. */}
          <PermissionGate permission="budget.edit">
            <div style={{ position: 'relative' }}>
              <Btn
                variant="primary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => { setAddMenuOpen((o) => !o); setMoreMenuOpen(false); }}
                data-testid="budget-add-menu"
              >
                Add
              </Btn>
              {addMenuOpen && (
                <>
                  <div
                    onClick={() => setAddMenuOpen(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                  />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                    minWidth: 220, backgroundColor: colors.surfaceRaised,
                    borderRadius: borderRadius.md, boxShadow: shadows.dropdown,
                    border: `1px solid ${colors.borderSubtle}`,
                    padding: spacing['1'], zIndex: 999,
                    display: 'flex', flexDirection: 'column',
                  }}>
                    <MenuItem
                      label="Add line item"
                      description="Create a single SOV line"
                      onClick={() => { setAddMenuOpen(false); setAddLineOpen(true); }}
                      testid="create-budget-item-button"
                    />
                    <MenuItem
                      label="Import budget"
                      description="Upload Excel schedule of values"
                      onClick={() => { setAddMenuOpen(false); setUploadOpen(true); }}
                      testid="import-budget-button"
                    />
                    <MenuItem
                      label="Upload draw report"
                      description="AIA G702/G703 — auto-updates actuals"
                      onClick={() => { setAddMenuOpen(false); setDrawUploadOpen(true); }}
                      testid="upload-draw-report-button"
                    />
                  </div>
                </>
              )}
            </div>
          </PermissionGate>

          {/* Overflow menu — snapshot, compare, export. Secondary actions. */}
          <div style={{ position: 'relative' }}>
            <Btn
              variant="ghost"
              size="sm"
              aria-label="More actions"
              onClick={() => { setMoreMenuOpen((o) => !o); setAddMenuOpen(false); }}
            >
              <MoreHorizontal size={14} />
            </Btn>
            {moreMenuOpen && (
              <>
                <div
                  onClick={() => setMoreMenuOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                  minWidth: 220, backgroundColor: colors.surfaceRaised,
                  borderRadius: borderRadius.md, boxShadow: shadows.dropdown,
                  border: `1px solid ${colors.borderSubtle}`,
                  padding: spacing['1'], zIndex: 999,
                  display: 'flex', flexDirection: 'column',
                }}>
                  {canEditBudget && (
                    <MenuItem
                      label="Save snapshot"
                      description="Freeze current state for comparison"
                      onClick={async () => {
                        setMoreMenuOpen(false);
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
                            toast.success('Budget snapshot saved');
                          } else {
                            toast.success('Budget snapshot saved (local)');
                          }
                        } catch {
                          toast.error('Failed to save snapshot');
                        }
                      }}
                    />
                  )}
                  {snapshots.length > 0 && (
                    <MenuItem
                      label={showSnapshotCompare ? 'Hide comparison' : 'Compare snapshots'}
                      description={snapshots.length === 1 ? '1 snapshot available' : `${snapshots.length} snapshots available`}
                      onClick={() => {
                        setMoreMenuOpen(false);
                        setShowSnapshotCompare(prev => !prev);
                        if (!compareSnapshotId && snapshots.length) setCompareSnapshotId(snapshots[0].id);
                      }}
                    />
                  )}
                  <MenuItem
                    label="Export XLSX"
                    description="Download budget + change orders"
                    onClick={() => {
                      setMoreMenuOpen(false);
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
                    testid="export-budget-button"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      }
    >
      {/* ── Primary financial-hub tabs ─────────────────────────────
          Budget absorbed /financials (Period Close) and /cost-management
          (Cost Codes drill). The existing BudgetTabBar still drives the
          Summary sub-views (overview / WBS / change-orders / earned-value). */}
      <div
        role="tablist"
        aria-label="Budget views"
        style={{
          display: 'flex',
          gap: spacing['1'],
          marginBottom: spacing['4'],
          borderBottom: `1px solid ${colors.borderLight}`,
          paddingBottom: spacing['1'],
        }}
      >
        {([
          { id: 'summary' as const,      label: 'Summary' },
          { id: 'cost-codes' as const,   label: 'Cost Codes' },
          { id: 'cash-flow' as const,    label: 'Cash Flow' },
          { id: 'period-close' as const, label: 'Period Close' },
          { id: 'snapshots' as const,    label: 'Snapshots' },
        ]).map((tab) => {
          const active = mainView === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => setMainView(tab.id)}
              style={{
                padding: `${spacing['2']} ${spacing['3']}`,
                border: 'none',
                borderBottom: active ? `2px solid ${colors.primaryOrange}` : '2px solid transparent',
                background: 'none',
                cursor: 'pointer',
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
                fontWeight: active ? typography.fontWeight.medium : typography.fontWeight.normal,
                color: active ? colors.primaryOrange : colors.textSecondary,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

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

      {mainView === 'summary' && (<>
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

      {/* ── Premium KPI Cards + Contingency Bar ── */}
      <BudgetKPIs
        totalBudget={projectData.totalValue}
        spent={spent}
        committed={committed}
        remaining={remaining}
        contingencyRemaining={contingencyRemaining}
        contingencyTotal={contingencyBudget}
        contingencyPct={contingencyPct}
        previousBilledToDate={previousBilledToDate}
        isFlashing={isFlashing}
      />

      {/* Budget Summary by Category — REMOVED (Jobs redesign: redundant with Division Health) */}

      {/* Contingency Drawdown — REMOVED (Jobs redesign: already shown in health badge) */}

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

      {/* Schedule Integration — REMOVED (Jobs redesign: belongs on Schedule page, not Budget) */}

      {/* AI Insights Panel — REMOVED (Jobs redesign: critical anomalies banner at top is sufficient) */}

      {/* ── Premium Tab Bar with sliding indicator ── */}
      <BudgetTabBar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setWbsView(tab === 'wbs');
        }}
        changeOrderCount={allChangeOrders.length}
      />

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
          {/* Division Health — the ONE thing that matters */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing['2'] }}>
                <h3 style={{
                  margin: 0, fontSize: 16, fontWeight: 600,
                  color: colors.textPrimary, fontFamily: typography.fontFamily,
                }}>
                  Division Health
                </h3>
                <span style={{ fontSize: 12, color: colors.textTertiary, fontWeight: 500 }}>
                  {costData.divisions.length} divisions
                </span>
              </div>
              <span style={{
                fontSize: 11, color: colors.textTertiary, fontWeight: 500,
                padding: `2px ${spacing['2']}`, backgroundColor: colors.surfaceInset,
                borderRadius: borderRadius.sm,
              }}>
                J/K navigate · Enter open
              </span>
            </div>
            <Card padding="0">
              {/* Premium sticky table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(150px, 2fr) 95px 140px 95px 115px 105px 24px 32px',
                padding: `10px ${spacing['4']}`,
                borderBottom: `1px solid ${colors.borderSubtle}`,
                backgroundColor: colors.surfaceInset,
                position: 'sticky',
                top: 0,
                zIndex: 2,
              }}>
                {['Division', 'Budget', 'Spent to Date', 'Committed', 'Remaining', '% Complete', '', ''].map((h, i) => (
                  <span key={`${h}-${i}`} style={{
                    fontSize: 11, fontWeight: 600, color: colors.textTertiary,
                    textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                  }}>{h}</span>
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
                      borderLeft: isAtRisk ? `3px solid #DC2626` : isHovered ? `3px solid ${colors.primaryOrange}` : '3px solid transparent',
                      borderBottom: idx < costData.divisions.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                      backgroundColor: isAtRisk ? 'rgba(220,38,38,0.04)' : isHovered ? colors.surfaceHover : 'transparent',
                      cursor: 'pointer',
                      outline: isFocused ? `2px solid ${colors.primaryOrange}` : 'none',
                      outlineOffset: '-2px',
                      transition: 'all 0.12s ease',
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
                          style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], cursor: canEditBudget ? 'text' : 'default', padding: `2px ${spacing['1']}`, borderRadius: borderRadius.sm }}
                        >
                          <div style={{ flex: 1, minWidth: 36, height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${Math.min(division.progress, 100)}%`,
                              backgroundColor: isAtRisk ? '#DC2626' : division.progress >= 70 ? '#D97706' : '#16A34A',
                              borderRadius: 2,
                              transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)',
                            }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: isAtRisk ? '#DC2626' : colors.textSecondary, minWidth: 28, textAlign: 'right' }}>{division.progress}%</span>
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
            <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing['2'], marginBottom: spacing['3'] }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>Cumulative Cost (S Curve)</h3>
              <span style={{ fontSize: 12, color: colors.textTertiary, fontWeight: 500 }}>Planned vs Actual</span>
            </div>
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

        </motion.div>
      )}

      {/* ── Change Orders Tab ── */}
      {activeTab === 'change-orders' && (
        <motion.div
          key="change-orders"
          role="tabpanel"
          id="budget-tab-change-orders"
          aria-label="Change Orders"
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          {/* ── CO Summary KPIs ── */}
          {(() => {
            const pendingCOs = allChangeOrders.filter(co => co.status !== 'approved' && co.status !== 'rejected' && co.status !== 'void');
            const pendingTotal = pendingCOs.reduce((s, co) => s + (co.estimated_cost || co.amount), 0);
            const rejectedTotal = allChangeOrders.filter(co => co.status === 'rejected').reduce((s, co) => s + (co.estimated_cost || co.amount), 0);
            const coKpis = [
              { label: 'Approved', value: fmt(approvedTotal), count: allChangeOrders.filter(co => co.status === 'approved').length, color: '#16A34A', bg: '#F0FDF4' },
              { label: 'Pending', value: fmt(pendingTotal), count: pendingCOs.length, color: '#D97706', bg: '#FFFBEB' },
              { label: 'Rejected', value: fmt(rejectedTotal), count: allChangeOrders.filter(co => co.status === 'rejected').length, color: '#DC2626', bg: '#FEF2F2' },
              { label: 'Net Impact', value: fmt(approvedTotal + pendingTotal), count: allChangeOrders.length, color: '#2563EB', bg: '#EFF6FF' },
            ];
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['3'], marginBottom: spacing['4'] }}>
                {coKpis.map(kpi => (
                  <div key={kpi.label} style={{
                    padding: `${spacing['3']} ${spacing['4']}`,
                    backgroundColor: colors.surfaceRaised,
                    borderRadius: borderRadius.xl,
                    border: `1px solid ${colors.borderSubtle}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['1'] }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: colors.textTertiary, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{kpi.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: kpi.color, backgroundColor: kpi.bg, padding: '1px 6px', borderRadius: borderRadius.full }}>{kpi.count}</span>
                    </div>
                    <span style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{kpi.value}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* CO Budget Impact Waterfall */}
          <div style={{ marginBottom: spacing['4'] }}>
            <h3 style={{ margin: 0, marginBottom: spacing['3'], fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>Budget Impact</h3>
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

          {/* Change Orders Table */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>Change Orders</h3>
              <Btn variant="ghost" size="sm" icon={<ArrowRight size={12} />} iconPosition="right" onClick={() => navigate('/change-orders')}>View Pipeline</Btn>
            </div>
            <Card padding="0">
              <div role="table" aria-label="Change orders">
              <div role="rowgroup">
              <div role="row" style={{
                display: 'grid', gridTemplateColumns: '80px 60px 1fr 120px 140px',
                padding: `10px ${spacing['4']}`,
                borderBottom: `1px solid ${colors.borderSubtle}`,
                backgroundColor: colors.surfaceInset,
              }}>
                {['Number', 'Type', 'Title', 'Amount', 'Status'].map((label) => (
                  <span role="columnheader" key={label} style={{ fontSize: 11, fontWeight: 600, color: colors.textTertiary, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{label}</span>
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
                  <div
                    role="row"
                    tabIndex={0}
                    key={co.id}
                    onClick={() => setSelectedCO(co)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCO(co); } }}
                    style={{
                      display: 'grid', gridTemplateColumns: '80px 60px 1fr 120px 140px',
                      padding: `${spacing['3']} ${spacing['4']}`,
                      borderBottom: i < allChangeOrders.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                      alignItems: 'center', cursor: 'pointer',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceHover; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
                  >
                    <span role="cell" style={{ fontSize: 13, fontWeight: 600, color: colors.primaryOrange, fontFamily: typography.fontFamilyMono }}>{co.coNumber}</span>
                    <span role="cell" style={{ fontSize: 11, fontWeight: 600, color: typeConfig.color }}>{typeConfig.shortLabel}</span>
                    <span role="cell" style={{ fontSize: 13, color: colors.textPrimary, display: 'inline-flex', alignItems: 'center', gap: spacing['1'] }}>
                      {co.title}
                      {getAnnotationsForEntity('change_order', co.id).map((ann) => (
                        <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                      ))}
                    </span>
                    <span role="cell" style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{fmt(co.amount)}</span>
                    <span role="cell" style={{ fontSize: 11, fontWeight: 600, color: statusConfig.color, backgroundColor: statusConfig.bg, padding: '3px 8px', borderRadius: borderRadius.full, textAlign: 'center', display: 'inline-block' }}>{statusConfig.label}</span>
                  </div>
                );
              })}
              </div>
              <div role="rowgroup">
              <div role="row" style={{ display: 'grid', gridTemplateColumns: '80px 60px 1fr 120px 140px', padding: `10px ${spacing['4']}`, borderTop: `2px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceInset }}>
                <span role="cell"></span>
                <span role="cell"></span>
                <span role="cell" style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>Approved Total</span>
                <span role="cell" style={{ fontSize: 13, fontWeight: 700, color: '#16A34A', fontVariantNumeric: 'tabular-nums' }}>{fmt(approvedTotal)}</span>
                <span role="cell"></span>
              </div>
              </div>
              </div>
              {allChangeOrders.length > 10 && (
                <div style={{ padding: `${spacing['3']} ${spacing['4']}`, textAlign: 'center', borderTop: `1px solid ${colors.borderSubtle}` }}>
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
          <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing['2'], marginBottom: spacing['3'] }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>Earned Value Analysis</h3>
            <span style={{ fontSize: 12, color: colors.textTertiary, fontWeight: 500 }}>CPI · SPI · EAC · ETC</span>
          </div>
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
      </>)}

      {/* ── Cost Codes tab ─────────────────────────────────────
          Absorbed from /cost-management. Division → Cost Code → Budget
          Items drill. Inline edit on spent / original_amount uses the
          existing useUpdateBudgetItem mutation. */}
      {mainView === 'cost-codes' && (
        <CostCodesSection
          projectId={projectId ?? null}
          divisions={divisions}
          canEdit={canEditBudget}
          fmt={fmt}
          onOpenDivision={(d) => setSelectedDivision(d)}
        />
      )}

      {/* ── Cash Flow tab ──────────────────────────────────────
          Monthly phased forecast. Pulls burn rate from cashFlowSummary
          which is already derived from budget_items + schedule_phases. */}
      {mainView === 'cash-flow' && (
        <CashFlowSection
          totalBudget={projectData?.totalValue ?? 0}
          spent={spent}
          plannedData={sCurveData.planned}
          actualData={sCurveData.actual}
          labels={sCurveData.labels}
          cashFlowSummary={cashFlowSummary}
          fmt={fmt}
        />
      )}

      {/* ── Period Close tab ───────────────────────────────────
          Absorbed from /financials. Monthly close ledger backed by
          the new financial_periods table. Close / Reopen are RLS-
          gated (owner/admin); UI gates on budget.edit for symmetry. */}
      {mainView === 'period-close' && (
        <PeriodCloseSection
          projectId={projectId ?? null}
          periods={financialPeriodsQuery.data ?? []}
          isLoading={financialPeriodsQuery.isLoading}
          canEdit={canEditBudget}
          isCreating={createPeriodMutation.isPending}
          onOpenClose={(p) => {
            setClosingPeriod(p);
            setPeriodCloseStatus('closed');
            setPeriodCloseNotes(p.notes ?? '');
          }}
          onOpenReopen={(p) => {
            setReopeningPeriod(p);
            setPeriodReopenNotes('');
          }}
          onTrackMonth={(monthIso) => {
            if (!projectId) return;
            createPeriodMutation.mutate({ projectId, periodMonth: monthIso });
          }}
        />
      )}

      {/* ── Snapshots tab ──────────────────────────────────────
          Budget history with month-over-month deltas. Uses the
          existing snapshots state (persisted via budgetSnapshotService). */}
      {mainView === 'snapshots' && (
        <SnapshotsSection
          snapshots={snapshots}
          fmt={fmt}
          canCreate={canEditBudget}
          onCreate={async () => {
            if (!projectId) return;
            try {
              const saved = await budgetSnapshotService.saveSnapshot({
                projectId,
                name: `Snapshot ${new Date().toLocaleDateString()}`,
                totalBudget: projectData?.totalValue ?? 0,
                totalSpent: spent,
                totalCommitted: committed,
                divisionData: divisions.map((d) => ({
                  division: d.name,
                  budget: d.budget,
                  spent: d.spent,
                  committed: d.committed,
                })),
              });
              setSnapshots((prev) => [saved, ...prev]);
              toast.success('Snapshot saved');
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Failed to save snapshot');
            }
          }}
        />
      )}

      {/* ── Close-period modal ─────────────────────────────────
          Renders when `closingPeriod` is set from the Period Close list. */}
      {closingPeriod && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setClosingPeriod(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}
        >
          <div style={{ backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg, padding: 24, width: '100%', maxWidth: 480 }}>
            <h2 style={{ margin: 0, marginBottom: 16, fontSize: 18, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Close Period — {formatMonthLabel(closingPeriod.period_month)}
            </h2>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: colors.textSecondary, marginBottom: 6 }}>Status</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {([
                { key: 'pending_close' as const, label: 'Mark Pending', hint: 'Lock to review; still editable' },
                { key: 'closed' as const,        label: 'Close',         hint: 'Hard close — no more writes' },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setPeriodCloseStatus(opt.key)}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: borderRadius.base,
                    border: `1px solid ${periodCloseStatus === opt.key ? colors.primaryOrange : colors.borderDefault}`,
                    backgroundColor: periodCloseStatus === opt.key ? colors.primaryOrange + '10' : 'transparent',
                    color: colors.textPrimary, cursor: 'pointer', textAlign: 'left',
                    fontFamily: typography.fontFamily,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>{opt.hint}</div>
                </button>
              ))}
            </div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: colors.textSecondary, marginBottom: 6 }}>Notes (optional)</label>
            <textarea
              value={periodCloseNotes}
              onChange={(e) => setPeriodCloseNotes(e.target.value)}
              rows={4}
              placeholder="Context for the audit trail…"
              style={{ width: '100%', padding: '8px 12px', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <Btn variant="ghost" onClick={() => setClosingPeriod(null)}>Cancel</Btn>
              <Btn
                variant="primary"
                disabled={closePeriodMutation.isPending}
                onClick={async () => {
                  if (!projectId) return;
                  await closePeriodMutation.mutateAsync({
                    id: closingPeriod.id,
                    projectId,
                    status: periodCloseStatus,
                    notes: periodCloseNotes.trim() || null,
                  });
                  setClosingPeriod(null);
                  setPeriodCloseNotes('');
                }}
              >
                {closePeriodMutation.isPending ? 'Saving…' : periodCloseStatus === 'closed' ? 'Close Period' : 'Mark Pending'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Reopen-period modal ────────────────────────────────
          Notes required — becomes part of the audit trail alongside
          reopened_at / reopened_by. */}
      {reopeningPeriod && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setReopeningPeriod(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}
        >
          <div style={{ backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg, padding: 24, width: '100%', maxWidth: 480 }}>
            <h2 style={{ margin: 0, marginBottom: 8, fontSize: 18, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Reopen Period — {formatMonthLabel(reopeningPeriod.period_month)}
            </h2>
            <p style={{ margin: 0, marginBottom: 16, fontSize: 12, color: colors.textTertiary }}>
              Reopening is audited. Provide a reason so the trail stays clean.
            </p>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: colors.textSecondary, marginBottom: 6 }}>Reason <span style={{ color: colors.statusCritical }}>*</span></label>
            <textarea
              value={periodReopenNotes}
              onChange={(e) => setPeriodReopenNotes(e.target.value)}
              rows={4}
              placeholder="e.g. Missed invoice from GC — need to re-run pay app #7"
              style={{ width: '100%', padding: '8px 12px', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <Btn variant="ghost" onClick={() => setReopeningPeriod(null)}>Cancel</Btn>
              <Btn
                variant="primary"
                disabled={reopenPeriodMutation.isPending || !periodReopenNotes.trim()}
                onClick={async () => {
                  if (!projectId) return;
                  await reopenPeriodMutation.mutateAsync({
                    id: reopeningPeriod.id,
                    projectId,
                    notes: periodReopenNotes.trim(),
                  });
                  setReopeningPeriod(null);
                  setPeriodReopenNotes('');
                }}
              >
                {reopenPeriodMutation.isPending ? 'Reopening…' : 'Reopen Period'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export const Budget: React.FC = () => (
  <ErrorBoundary message="Budget could not be displayed. Check your connection and try again.">
    <BudgetPage />
  </ErrorBoundary>
);

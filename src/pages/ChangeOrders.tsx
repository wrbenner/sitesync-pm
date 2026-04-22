import React, { useMemo, useState, useCallback } from 'react';
import { Plus, RefreshCw, ArrowRight, Clock, DollarSign, Calendar, AlertTriangle, TrendingUp, ChevronDown, ChevronUp, CheckCircle, Circle, XCircle, FileText, Link2, Shield, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageContainer, Card, Btn, StatusTag, EmptyState, Modal, InputField } from '../components/Primitives';
import { PresenceAvatars } from '../components/shared/PresenceAvatars';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { useProjectId } from '../hooks/useProjectId';
import { useChangeOrders, useProject } from '../hooks/queries';
import {
  useCreateChangeOrder,
  useDeleteChangeOrder,
  useSubmitChangeOrder,
  useApproveChangeOrder,
  useRejectChangeOrder,
} from '../hooks/mutations';
import { PermissionGate } from '../components/auth/PermissionGate';
import { ErrorBoundary } from '../components/ErrorBoundary';
import CreateChangeOrderModal from '../components/forms/CreateChangeOrderModal';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useRealtimeInvalidation } from '../hooks/useRealtimeInvalidation';
import { useLinkedEntities } from '../hooks/useLinkedEntities';
import { createEntityLink } from '../services/entityLinkService';
import type { LinkedItem } from '../components/shared/LinkedEntities';
import { PageInsightBanners } from '../components/ai/PredictiveAlert';
import { supabase } from '../lib/supabase';
import type { ChangeOrder } from '../types/database';

type COStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'voided';
type COType = 'pco' | 'cor' | 'co';

const fmtCurrency = (n: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

const statusTone: Record<COStatus, 'pending' | 'review' | 'active' | 'closed' | 'critical'> = {
  draft: 'pending',
  pending_review: 'review',
  approved: 'active',
  rejected: 'critical',
  voided: 'closed',
};

const typeLabels: Record<COType, string> = {
  pco: 'PCO',
  cor: 'COR',
  co: 'CO',
};

const typeColors: Record<COType, string> = {
  pco: colors.statusPending,
  cor: colors.statusReview ?? colors.brand400,
  co: colors.statusActive,
};

const reasonLabels: Record<string, string> = {
  owner_request: 'Owner Request',
  design_change: 'Design Change',
  unforeseen_condition: 'Unforeseen Condition',
  code_change: 'Code / Regulatory',
  value_engineering: 'Value Engineering',
  scope_addition: 'Scope Addition',
  error_omission: 'Error / Omission',
  other: 'Other',
};

// ── Approval Chain Types & Data ─────────────────────
type ApprovalStep = {
  label: string;
  status: 'completed' | 'current' | 'pending' | 'rejected';
  approver: string;
  date?: string;
  comments?: string;
};

const buildApprovalChain = (co: ChangeOrder): ApprovalStep[] => {
  const status = (co.status ?? 'draft') as COStatus;
  const requestedDate = co.requested_date?.slice(0, 10);
  const approvedDate = co.approved_date?.slice(0, 10);
  const updatedDate = co.updated_at?.slice(0, 10);

  const steps: ApprovalStep[] = [
    { label: 'Initiated', status: 'completed', approver: co.requested_by || 'System', date: requestedDate },
    { label: 'Review', status: 'pending', approver: '—' },
    { label: 'Approval', status: 'pending', approver: '—' },
    { label: 'Executed', status: 'pending', approver: '—' },
  ];

  if (status === 'draft') {
    steps[0].status = 'current';
  } else if (status === 'pending_review') {
    steps[1].status = 'current';
    steps[1].date = updatedDate;
  } else if (status === 'approved') {
    steps[1] = { ...steps[1], status: 'completed', date: updatedDate };
    steps[2] = { ...steps[2], status: 'completed', date: approvedDate };
    steps[3] = { ...steps[3], status: 'current', date: approvedDate };
  } else if (status === 'rejected') {
    steps[1] = { ...steps[1], status: 'completed', date: updatedDate };
    steps[2] = { ...steps[2], status: 'rejected', date: updatedDate };
  } else if (status === 'voided') {
    steps[1] = { ...steps[1], status: 'completed' };
    steps[2] = { ...steps[2], status: 'completed' };
    steps[3] = { ...steps[3], status: 'completed', date: updatedDate };
  }
  return steps;
};

const approvalStepColor: Record<ApprovalStep['status'], string> = {
  completed: colors.statusActive,
  current: colors.brand400,
  pending: colors.textTertiary,
  rejected: colors.statusCritical,
};

const ApprovalStepIcon: React.FC<{ status: ApprovalStep['status'] }> = ({ status }) => {
  if (status === 'completed') return <CheckCircle size={18} color={approvalStepColor.completed} />;
  if (status === 'current') return <Circle size={18} color={approvalStepColor.current} fill={`${approvalStepColor.current}30`} />;
  if (status === 'rejected') return <XCircle size={18} color={approvalStepColor.rejected} />;
  return <Circle size={18} color={approvalStepColor.pending} />;
};

// ── Approval Chain Component ─────────────────────
const ApprovalChain: React.FC<{ steps: ApprovalStep[]; coId: string; onAdvance?: () => void; onReturn?: () => void }> = ({ steps, coId, onAdvance, onReturn }) => {
  const currentStep = steps.find(s => s.status === 'current');
  return (
    <div style={{ padding: `${spacing['3']} 0` }}>
      <div style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, marginBottom: spacing['3'], textTransform: 'uppercase', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
        <Shield size={14} /> Approval Chain
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: spacing['2'] }}>
        {steps.map((step, i) => (
          <React.Fragment key={step.label}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['1'],
              minWidth: 120, padding: `${spacing['2']} ${spacing['1']}`,
              borderRadius: borderRadius.md,
              backgroundColor: step.status === 'current' ? `${approvalStepColor.current}10` : step.status === 'rejected' ? `${approvalStepColor.rejected}08` : 'transparent',
              border: step.status === 'current' ? `1px solid ${approvalStepColor.current}30` : '1px solid transparent',
            }}>
              <ApprovalStepIcon status={step.status} />
              <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: approvalStepColor[step.status], textAlign: 'center' }}>{step.label}</span>
              <span style={{ fontSize: '11px', color: colors.textTertiary, textAlign: 'center' }}>{step.approver}</span>
              {step.date && <span style={{ fontSize: '10px', color: colors.textTertiary }}>{step.date}</span>}
              {step.comments && <span style={{ fontSize: '10px', color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center', maxWidth: 110 }}>{step.comments}</span>}
            </div>
            {i < steps.length - 1 && (
              <div style={{ display: 'flex', alignItems: 'center', paddingTop: spacing['3'], color: steps[i].status === 'completed' ? colors.statusActive : colors.borderDefault }}>
                <div style={{ width: 24, height: 2, backgroundColor: 'currentColor' }} />
                <ArrowRight size={12} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
      {currentStep && currentStep.label !== 'Initiated' && currentStep.label !== 'Executed' && currentStep.status === 'current' && (
        <div style={{ display: 'flex', gap: spacing['2'], marginTop: spacing['2'], paddingTop: spacing['2'], borderTop: `1px solid ${colors.borderLight}` }}>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, alignSelf: 'center' }}>You are the current approver:</span>
          {onAdvance && <Btn size="sm" variant="primary" icon={<CheckCircle size={14} />} onClick={onAdvance}>Approve &amp; Advance</Btn>}
          {onReturn && <Btn size="sm" variant="ghost" icon={<XCircle size={14} />} onClick={onReturn}>Reject &amp; Return</Btn>}
        </div>
      )}
    </div>
  );
};

// ── Markup & Margin Calculator ─────────────────────
type MarkupTemplate = { label: string; oh: number; profit: number; bond: number; insurance: number };
const markupTemplates: MarkupTemplate[] = [
  { label: 'Subcontractor', oh: 15, profit: 10, bond: 1.5, insurance: 2 },
  { label: 'Self-Perform', oh: 10, profit: 10, bond: 1.5, insurance: 2 },
  { label: 'Material Only', oh: 5, profit: 8, bond: 0, insurance: 1 },
];

const MarkupCalculator: React.FC<{ directCost: number }> = ({ directCost }) => {
  const [oh, setOh] = useState(15);
  const [profit, setProfit] = useState(10);
  const [bond, setBond] = useState(1.5);
  const [insurance, setInsurance] = useState(2);
  const [expanded, setExpanded] = useState(false);

  const ohAmt = directCost * (oh / 100);
  const subtotal = directCost + ohAmt;
  const profitAmt = subtotal * (profit / 100);
  const bondAmt = (subtotal + profitAmt) * (bond / 100);
  const insuranceAmt = (subtotal + profitAmt) * (insurance / 100);
  const total = subtotal + profitAmt + bondAmt + insuranceAmt;
  const effectiveMarkup = directCost > 0 ? ((total - directCost) / directCost) * 100 : 0;

  const applyTemplate = (t: MarkupTemplate) => { setOh(t.oh); setProfit(t.profit); setBond(t.bond); setInsurance(t.insurance); };

  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], cursor: 'pointer', padding: `${spacing['2']} 0`, color: colors.brand400, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium }}
      >
        <Calculator size={14} /> Show Markup Calculator ({effectiveMarkup.toFixed(1)}% effective markup)
      </div>
    );
  }

  return (
    <div style={{ padding: spacing['3'], backgroundColor: `${colors.brand400}06`, border: `1px solid ${colors.brand400}20`, borderRadius: borderRadius.md }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
        <div style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <Calculator size={14} /> Markup &amp; Margin Calculator
        </div>
        <span onClick={() => setExpanded(false)} style={{ cursor: 'pointer', fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Collapse</span>
      </div>
      <div style={{ display: 'flex', gap: spacing['2'], marginBottom: spacing['3'], flexWrap: 'wrap' }}>
        {markupTemplates.map(t => (
          <span key={t.label} onClick={() => applyTemplate(t)} style={{
            padding: `2px 10px`, borderRadius: borderRadius.full, fontSize: '11px', cursor: 'pointer',
            border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.white, color: colors.textSecondary,
          }}>{t.label}</span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['2'], marginBottom: spacing['3'] }}>
        {[{ label: 'OH %', value: oh, set: setOh }, { label: 'Profit %', value: profit, set: setProfit }, { label: 'Bond %', value: bond, set: setBond }, { label: 'Insurance %', value: insurance, set: setInsurance }].map(f => (
          <div key={f.label}>
            <label style={{ display: 'block', fontSize: '11px', color: colors.textTertiary, marginBottom: 2 }}>{f.label}</label>
            <input type="number" value={f.value} onChange={e => f.set(parseFloat(e.target.value) || 0)} style={{
              width: '100%', padding: `${spacing['1']} ${spacing['2']}`, border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing['2'], fontSize: typography.fontSize.sm }}>
        <div><span style={{ color: colors.textTertiary, fontSize: '11px' }}>Direct Cost</span><div style={{ fontWeight: typography.fontWeight.medium }}>{fmtCurrency(directCost)}</div></div>
        <div><span style={{ color: colors.textTertiary, fontSize: '11px' }}>OH Amount</span><div>{fmtCurrency(ohAmt)}</div></div>
        <div><span style={{ color: colors.textTertiary, fontSize: '11px' }}>Subtotal</span><div>{fmtCurrency(subtotal)}</div></div>
        <div><span style={{ color: colors.textTertiary, fontSize: '11px' }}>Profit Amount</span><div>{fmtCurrency(profitAmt)}</div></div>
        <div><span style={{ color: colors.textTertiary, fontSize: '11px' }}>Bond + Insurance</span><div>{fmtCurrency(bondAmt + insuranceAmt)}</div></div>
        <div style={{ backgroundColor: `${colors.statusActive}10`, padding: spacing['1'], borderRadius: borderRadius.sm }}>
          <span style={{ color: colors.statusActive, fontSize: '11px', fontWeight: typography.fontWeight.semibold }}>Total w/ Markup</span>
          <div style={{ fontWeight: typography.fontWeight.bold, color: colors.statusActive }}>{fmtCurrency(total)}</div>
        </div>
      </div>
      <div style={{ marginTop: spacing['2'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
        Effective markup: <strong style={{ color: colors.textPrimary }}>{effectiveMarkup.toFixed(1)}%</strong>
      </div>
    </div>
  );
};

// ── GMP Impact Tracking ─────────────────────

const GMPImpactCard: React.FC<{ approvedAmount: number; approvedCOs: ChangeOrder[]; contractValue: number; contingencyBudget: number }> = ({ approvedAmount, approvedCOs, contractValue, contingencyBudget }) => {
  const gmpOriginal = contractValue;
  const gmpContingencyOriginal = contingencyBudget;
  const currentGMP = gmpOriginal + approvedAmount;
  const contingencyUsed = approvedAmount;
  const contingencyRemaining = gmpContingencyOriginal - contingencyUsed;
  const pctUsed = gmpContingencyOriginal > 0 ? (contingencyUsed / gmpContingencyOriginal) * 100 : 0;
  const gaugeColor = pctUsed < 50 ? colors.statusActive : pctUsed < 80 ? colors.statusPending : colors.statusCritical;

  return (
    <Card padding={spacing['4']} style={{ marginBottom: spacing['4'] }}>
      <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing['3'], textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
        <DollarSign size={14} /> GMP Impact Summary
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: spacing['3'], marginBottom: spacing['3'] }}>
        <div>
          <div style={{ fontSize: '11px', color: colors.textTertiary, marginBottom: 2 }}>Original GMP</div>
          <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{fmtCurrency(gmpOriginal)}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: colors.textTertiary, marginBottom: 2 }}>Approved Changes</div>
          <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: approvedAmount >= 0 ? colors.statusCritical : colors.statusActive }}>{approvedAmount >= 0 ? '+' : ''}{fmtCurrency(approvedAmount)}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: colors.textTertiary, marginBottom: 2 }}>Current GMP</div>
          <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>{fmtCurrency(currentGMP)}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: colors.textTertiary, marginBottom: 2 }}>Remaining Contingency</div>
          <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: contingencyRemaining > 0 ? colors.statusActive : colors.statusCritical }}>{fmtCurrency(contingencyRemaining)}</div>
        </div>
      </div>
      {/* Gauge bar */}
      <div style={{ marginBottom: spacing['2'] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: colors.textTertiary, marginBottom: 4 }}>
          <span>Contingency Used</span>
          <span style={{ color: gaugeColor, fontWeight: typography.fontWeight.semibold }}>{pctUsed.toFixed(1)}%</span>
        </div>
        <div style={{ height: 8, borderRadius: borderRadius.full, backgroundColor: `${colors.borderLight}`, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(pctUsed, 100)}%`, borderRadius: borderRadius.full, backgroundColor: gaugeColor, transition: 'width 300ms ease' }} />
        </div>
      </div>
      {/* Approved CO list */}
      {approvedCOs.length > 0 && (
        <div style={{ marginTop: spacing['2'] }}>
          <div style={{ fontSize: '11px', color: colors.textTertiary, marginBottom: spacing['1'] }}>Approved changes contributing to GMP:</div>
          <div style={{ display: 'flex', gap: spacing['1'], flexWrap: 'wrap' }}>
            {approvedCOs.slice(0, 6).map(co => (
              <span key={co.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
                borderRadius: borderRadius.full, fontSize: '11px', backgroundColor: `${colors.statusActive}10`, color: colors.statusActive,
              }}>
                {co.number || co.id.slice(0, 6)}: {fmtCurrency(co.approved_amount ?? co.amount ?? 0)}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

// ── Linked Entity References ─────────────────────
type LinkedEntity = { type: 'rfi' | 'submittal' | 'daily_log'; number: string; title: string; status?: string };

const entityTypeConfig: Record<LinkedEntity['type'], { label: string; color: string; icon: React.ReactNode }> = {
  rfi: { label: 'RFI', color: '#6366f1', icon: <FileText size={12} /> },
  submittal: { label: 'Submittal', color: '#0891b2', icon: <FileText size={12} /> },
  daily_log: { label: 'Daily Log', color: '#d97706', icon: <Calendar size={12} /> },
};

const entityRoute: Record<LinkedEntity['type'], string> = {
  rfi: '/rfis',
  submittal: '/submittals',
  daily_log: '/daily-log',
};

const LinkedEntities: React.FC<{ entities: LinkedEntity[]; navigate: (path: string) => void }> = ({ entities, navigate }) => {
  if (entities.length === 0) return null;
  return (
    <div style={{ padding: `${spacing['2']} 0` }}>
      <div style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, marginBottom: spacing['2'], textTransform: 'uppercase', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
        <Link2 size={14} /> Related Items
      </div>
      <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap' }}>
        {entities.map(entity => {
          const cfg = entityTypeConfig[entity.type];
          return (
            <span
              key={entity.number}
              onClick={(e) => { e.stopPropagation(); navigate(entityRoute[entity.type]); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
                borderRadius: borderRadius.full, fontSize: '12px', cursor: 'pointer',
                backgroundColor: `${cfg.color}10`, color: cfg.color, border: `1px solid ${cfg.color}25`,
                transition: 'background-color 150ms ease',
              }}
              title={entity.title}
            >
              {cfg.icon}
              <strong>{entity.number}</strong>
              <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: colors.textSecondary }}>{entity.title}</span>
              {entity.status && (
                <span style={{ fontSize: '10px', opacity: 0.7, textTransform: 'uppercase' }}>({entity.status})</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ── Pipeline Stage Visualization ─────────────────────
const PipelineStage: React.FC<{ label: string; count: number; amount: number; color: string; isActive: boolean }> = ({ label, count, amount, color, isActive }) => (
  <div style={{
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing['1'],
    padding: `${spacing['3']} ${spacing['2']}`,
    borderRadius: borderRadius.lg,
    backgroundColor: isActive ? `${color}12` : 'transparent',
    border: `1px solid ${isActive ? `${color}30` : colors.borderLight}`,
    transition: 'all 150ms ease',
  }}>
    <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
    <span style={{ fontSize: '1.5rem', fontWeight: typography.fontWeight.bold, color: colors.textPrimary, lineHeight: 1 }}>{count}</span>
    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{fmtCurrency(amount)}</span>
  </div>
);

const PipelineArrow: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', color: colors.textTertiary, flexShrink: 0 }}>
    <ArrowRight size={16} />
  </div>
);

// ── KPI Card ─────────────────────
const KpiCard: React.FC<{ label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string; bgColor: string }> = ({ label, value, sub, icon, color, bgColor }) => (
  <div style={{
    flex: '1 1 160px',
    padding: `${spacing['4']} ${spacing['5']}`,
    backgroundColor: bgColor,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: borderRadius.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing['2'],
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ color, opacity: 0.7 }}>{icon}</span>
    </div>
    <div style={{ fontSize: '1.5rem', fontWeight: typography.fontWeight.bold, color, lineHeight: 1 }}>{value}</div>
    {sub && <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{sub}</span>}
  </div>
);

const ChangeOrdersPage: React.FC = () => {
  const projectId = useProjectId();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: changeOrders = [], isPending, error, refetch } = useChangeOrders(projectId);
  const { data: project } = useProject(projectId);
  useRealtimeInvalidation(projectId);
  const createChangeOrder = useCreateChangeOrder();
  const deleteChangeOrder = useDeleteChangeOrder();
  const submitChangeOrder = useSubmitChangeOrder();
  const approveChangeOrder = useApproveChangeOrder();
  const rejectChangeOrder = useRejectChangeOrder();

  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<COStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<COType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCO, setEditingCO] = useState<ChangeOrder | null>(null);
  const [editForm, setEditForm] = useState({
    title: '', description: '', amount: '', cost_code: '', schedule_impact: '', reason: '',
  });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Fetch linked entities for the currently expanded CO
  const { data: linkedEntitiesData = [] } = useLinkedEntities(projectId, 'change_order', expandedRow);
  // Map to the local LinkedEntity shape for the existing LinkedEntities component
  const expandedLinkedEntities: LinkedEntity[] = linkedEntitiesData
    .filter((item: LinkedItem) => ['rfi', 'submittal', 'daily_log'].includes(item.type))
    .map((item: LinkedItem) => ({
      type: item.type as 'rfi' | 'submittal' | 'daily_log',
      number: String(item.number),
      title: item.title,
      status: item.status,
    }));

  const queryClient = useQueryClient();
  const updateCOMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { data, error } = await supabase.from('change_orders').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change_orders', projectId] });
      toast.success('Change order updated');
      setEditingCO(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update');
    },
  });

  const openEditCO = useCallback((co: ChangeOrder) => {
    setEditForm({
      title: co.title ?? '',
      description: co.description ?? '',
      amount: co.amount != null ? String(co.amount) : '',
      cost_code: co.cost_code ?? '',
      schedule_impact: co.schedule_impact ?? '',
      reason: co.reason ?? '',
    });
    setEditingCO(co);
  }, []);

  const handleEditSave = () => {
    if (!editingCO) return;
    updateCOMutation.mutate({
      id: editingCO.id,
      updates: {
        title: editForm.title || null,
        description: editForm.description || null,
        amount: editForm.amount ? parseFloat(editForm.amount) : null,
        cost_code: editForm.cost_code || null,
        schedule_impact: editForm.schedule_impact || null,
        reason: editForm.reason || null,
      },
    });
  };

  // ── Computed metrics ──────────────────────
  const metrics = useMemo(() => {
    const cos = changeOrders;
    let pcoCount = 0, pcoAmount = 0;
    let corCount = 0, corAmount = 0;
    let coCount = 0, coAmount = 0;
    let pendingCount = 0, approvedCount = 0, rejectedCount = 0;
    let totalAmount = 0, approvedAmount = 0;
    let totalScheduleImpact = 0;
    const reasonCounts: Record<string, number> = {};
    const approvedCOs: ChangeOrder[] = [];

    for (const co of cos) {
      const amount = co.amount ?? 0;
      const type = co.type || 'pco';
      const status = (co.status ?? 'draft') as COStatus;
      const reason = co.reason || 'other';

      totalAmount += amount;
      if (type === 'pco') { pcoCount++; pcoAmount += amount; }
      if (type === 'cor') { corCount++; corAmount += amount; }
      if (type === 'co') { coCount++; coAmount += amount; }
      if (status === 'approved') { approvedCount++; approvedAmount += Number(co.approved_amount ?? co.amount ?? 0); approvedCOs.push(co); }
      if (status === 'pending_review' || status === 'draft') pendingCount++;
      if (status === 'rejected') rejectedCount++;

      const impact = parseInt(String(co.schedule_impact ?? '0'), 10);
      if (!isNaN(impact)) totalScheduleImpact += impact;

      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
    return {
      pcoCount, pcoAmount, corCount, corAmount, coCount, coAmount,
      pendingCount, approvedCount, rejectedCount, approvedAmount, totalAmount,
      totalScheduleImpact, reasonCounts, total: cos.length, approvedCOs,
    };
  }, [changeOrders]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return changeOrders.filter((co) => {
      if (statusFilter !== 'all' && co.status !== statusFilter) return false;
      if (typeFilter !== 'all' && co.type !== typeFilter) return false;
      if (!q) return true;
      return (
        String(co.title ?? '').toLowerCase().includes(q) ||
        String(co.number ?? '').toLowerCase().includes(q) ||
        String(co.description ?? '').toLowerCase().includes(q) ||
        String(co.reason ?? '').toLowerCase().includes(q)
      );
    });
  }, [changeOrders, statusFilter, typeFilter, searchQuery]);

  const handleCreate = async (data: Record<string, unknown>) => {
    if (!projectId) return;
    try {
      // Transform form data: cost_impact → number, etc.
      const payload: Record<string, unknown> = { ...data, project_id: projectId };
      if (payload.cost_impact && typeof payload.cost_impact === 'string') {
        payload.cost_impact = parseFloat(payload.cost_impact) || null;
      }
      await createChangeOrder.mutateAsync({ projectId, data: payload });
      toast.success('Change order created');
      setShowCreate(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create change order');
    }
  };

  const handleSubmit = async (coId: string) => {
    if (!projectId || !user?.id) return;
    try {
      await submitChangeOrder.mutateAsync({ id: coId, projectId, userId: user.id });
      toast.success('Submitted for review');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit');
    }
  };

  const handleApprove = async (coId: string) => {
    if (!projectId || !user?.id) return;
    try {
      await approveChangeOrder.mutateAsync({ id: coId, projectId, userId: user.id });
      toast.success('Change order approved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const [rejectingCoId, setRejectingCoId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleReject = async (coId: string) => {
    if (!projectId || !user?.id) return;
    // If no reason captured yet, open inline prompt
    if (!rejectingCoId || rejectingCoId !== coId) {
      setRejectingCoId(coId);
      setRejectionReason('');
      return;
    }
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    try {
      await rejectChangeOrder.mutateAsync({ id: coId, projectId, userId: user.id, comments: rejectionReason.trim() });
      toast.success('Change order rejected');
      setRejectingCoId(null);
      setRejectionReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject');
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = async (co: ChangeOrder) => {
    if (!projectId) return;
    if (confirmDeleteId !== co.id) {
      setConfirmDeleteId(co.id);
      return;
    }
    setConfirmDeleteId(null);
    try {
      await deleteChangeOrder.mutateAsync({ id: co.id, projectId });
      toast.success('Change order deleted');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  // Promote PCO → COR or COR → CO
  const [confirmPromoteId, setConfirmPromoteId] = useState<string | null>(null);

  const handlePromote = (co: ChangeOrder) => {
    const currentType = co.type || 'pco';
    const nextType = currentType === 'pco' ? 'cor' : currentType === 'cor' ? 'co' : null;
    if (!nextType) return;
    if (confirmPromoteId !== co.id) {
      setConfirmPromoteId(co.id);
      return;
    }
    setConfirmPromoteId(null);
    updateCOMutation.mutate({
      id: co.id,
      updates: { type: nextType },
    });
  };

  if (!projectId) {
    return (
      <PageContainer title="Change Orders">
        <Card padding={spacing['6']}>
          <EmptyState icon={<Plus />} title="No project selected" description="Select a project to view change orders." />
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Change Orders"
      subtitle={`${metrics.total} total · ${fmtCurrency(metrics.totalAmount)} estimated value`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <PresenceAvatars page="change-orders" size={28} />
          <PermissionGate permission="change_orders.create">
            <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setShowCreate(true)} data-testid="create-change-order-button">
              New Change Order
            </Btn>
          </PermissionGate>
        </div>
      }
    >
      {error ? (
        <Card padding={spacing['6']}>
          <div role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
            <span style={{ color: colors.statusCritical }}>Unable to load change orders.</span>
            <Btn variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Retry</Btn>
          </div>
        </Card>
      ) : null}

      {/* AI Insights */}
      <PageInsightBanners page="change_orders" />

      {/* Pipeline Flow Visualization */}
      {!isPending && metrics.total > 0 && (
        <Card padding={spacing['4']} style={{ marginBottom: spacing['4'] }}>
          <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing['3'], textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Cost Change Pipeline
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <PipelineStage label="PCO" count={metrics.pcoCount} amount={metrics.pcoAmount} color={typeColors.pco} isActive={typeFilter === 'pco'} />
            <PipelineArrow />
            <PipelineStage label="COR" count={metrics.corCount} amount={metrics.corAmount} color={typeColors.cor} isActive={typeFilter === 'cor'} />
            <PipelineArrow />
            <PipelineStage label="CO" count={metrics.coCount} amount={metrics.coAmount} color={typeColors.co} isActive={typeFilter === 'co'} />
            <div style={{ width: 1, height: 48, backgroundColor: colors.borderLight, margin: `0 ${spacing['2']}` }} />
            <PipelineStage label="Approved" count={metrics.approvedCount} amount={metrics.approvedAmount} color={colors.tealSuccess ?? colors.statusActive} isActive={false} />
          </div>
        </Card>
      )}

      {/* GMP Impact Summary */}
      {!isPending && metrics.total > 0 && (
        <GMPImpactCard
          approvedAmount={metrics.approvedAmount}
          approvedCOs={metrics.approvedCOs}
          contractValue={project?.contract_value ?? 0}
          contingencyBudget={(project?.contract_value ?? 0) * 0.05}
        />
      )}

      {/* KPI Cards */}
      {!isPending && metrics.total > 0 && (
        <div style={{ display: 'flex', gap: spacing['3'], marginBottom: spacing['4'], flexWrap: 'wrap' }}>
          <KpiCard label="Pending Review" value={metrics.pendingCount} icon={<Clock size={16} />} color={colors.statusPending} bgColor={colors.statusPendingSubtle} />
          <KpiCard label="Approved Value" value={fmtCurrency(metrics.approvedAmount)} icon={<DollarSign size={16} />} color={colors.statusActive} bgColor={colors.statusActiveSubtle} />
          <KpiCard
            label="Schedule Impact"
            value={`${metrics.totalScheduleImpact > 0 ? '+' : ''}${metrics.totalScheduleImpact} days`}
            icon={<Calendar size={16} />}
            color={metrics.totalScheduleImpact > 0 ? colors.statusCritical : colors.statusActive}
            bgColor={metrics.totalScheduleImpact > 0 ? colors.statusCriticalSubtle : colors.statusActiveSubtle}
          />
          <KpiCard label="Rejected" value={metrics.rejectedCount} icon={<AlertTriangle size={16} />} color={colors.statusCritical} bgColor={colors.statusCriticalSubtle} />
        </div>
      )}

      {/* Search + filters */}
      <div style={{ display: 'flex', gap: spacing['2'], marginBottom: spacing['3'], flexWrap: 'wrap' }}>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by title, number, description, or reason…"
          aria-label="Search change orders"
          data-testid="search-change-orders"
          style={{
            flex: '1 1 280px',
            padding: `${spacing['2']} ${spacing['3']}`,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
          }}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as COType | 'all')}
          aria-label="Filter by type"
          style={{
            padding: `${spacing['2']} ${spacing['3']}`,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            backgroundColor: colors.white,
          }}
        >
          <option value="all">All types</option>
          <option value="pco">PCO</option>
          <option value="cor">COR</option>
          <option value="co">CO</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as COStatus | 'all')}
          aria-label="Filter by status"
          data-testid="filter-change-orders-status"
          style={{
            padding: `${spacing['2']} ${spacing['3']}`,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            backgroundColor: colors.white,
          }}
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_review">Pending Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="voided">Voided</option>
        </select>
      </div>

      {/* List */}
      {isPending ? (
        <Card padding={spacing['6']}><p style={{ color: colors.textTertiary, margin: 0 }}>Loading change orders…</p></Card>
      ) : filtered.length === 0 ? (
        <Card padding={spacing['6']}>
          <EmptyState
            icon={<Plus />}
            title={changeOrders.length === 0 ? 'No change orders yet' : 'No change orders match your filters'}
            description={changeOrders.length === 0 ? 'Create your first change order to track scope, cost, and schedule impacts.' : 'Try clearing the search or filters.'}
            actionLabel={changeOrders.length === 0 ? 'New Change Order' : undefined}
            onAction={changeOrders.length === 0 ? () => setShowCreate(true) : undefined}
          />
        </Card>
      ) : (
        <div role="table" aria-label="Change orders" style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
          {/* Header */}
          <div role="row" style={{
            display: 'grid',
            gridTemplateColumns: '72px 56px 2fr 120px 100px 120px 140px 100px',
            gap: spacing['2'],
            padding: `${spacing['2']} ${spacing['3']}`,
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            <span>CO #</span>
            <span>Type</span>
            <span>Title</span>
            <span>Status</span>
            <span>Reason</span>
            <span>Amount</span>
            <span>Schedule</span>
            <span aria-hidden="true"></span>
          </div>
          {filtered.map((co) => {
            const coType = (co.type || 'pco') as COType;
            const coStatus = (co.status ?? 'draft') as COStatus;
            const isExpanded = expandedRow === co.id;
            const scheduleImpact = parseInt(String(co.schedule_impact ?? '0'), 10);
            const canPromote = coType !== 'co' && (coStatus === 'draft' || coStatus === 'approved');

            return (
              <Card key={co.id} padding={0} style={{ overflow: 'hidden' }}>
                {/* Main row */}
                <div
                  role="row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '72px 56px 2fr 120px 100px 120px 140px 100px',
                    gap: spacing['2'],
                    padding: spacing['3'],
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedRow(isExpanded ? null : co.id)}
                >
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                    {co.number ?? co.id.slice(0, 6)}
                  </span>
                  <span>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: borderRadius.full,
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.semibold,
                      backgroundColor: `${typeColors[coType]}15`,
                      color: typeColors[coType],
                    }}>
                      {typeLabels[coType]}
                    </span>
                  </span>
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {co.title || '—'}
                  </span>
                  <span>
                    <StatusTag
                      status={statusTone[coStatus] ?? 'pending'}
                      label={String(co.status ?? '').replace('_', ' ') || 'draft'}
                    />
                  </span>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                    {reasonLabels[co.reason ?? ''] || co.reason || '—'}
                  </span>
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
                    {fmtCurrency(Number(co.amount ?? 0))}
                  </span>
                  <span style={{
                    fontSize: typography.fontSize.sm,
                    color: scheduleImpact > 0 ? colors.statusCritical : scheduleImpact < 0 ? colors.statusActive : colors.textTertiary,
                    fontWeight: scheduleImpact !== 0 ? typography.fontWeight.medium : typography.fontWeight.normal,
                  }}>
                    {co.schedule_impact ? `${scheduleImpact > 0 ? '+' : ''}${scheduleImpact} days` : '—'}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    {isExpanded ? <ChevronUp size={14} color={colors.textTertiary} /> : <ChevronDown size={14} color={colors.textTertiary} />}
                  </span>
                </div>

                {/* Expanded detail row */}
                {isExpanded && (
                  <div style={{
                    padding: `${spacing['3']} ${spacing['4']}`,
                    borderTop: `1px solid ${colors.borderLight}`,
                    backgroundColor: colors.gray50 ?? '#fafafa',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: spacing['3'],
                  }}>
                    {/* Description */}
                    {co.description && (
                      <div>
                        <div style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, marginBottom: spacing['1'], textTransform: 'uppercase', letterSpacing: '0.3px' }}>Description</div>
                        <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.5 }}>{co.description}</div>
                      </div>
                    )}
                    {/* Details grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: spacing['3'] }}>
                      {co.cost_code && (
                        <div>
                          <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: 2 }}>Cost Code</div>
                          <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{co.cost_code}</div>
                        </div>
                      )}
                      {co.requested_by && (
                        <div>
                          <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: 2 }}>Requested By</div>
                          <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{co.requested_by}</div>
                        </div>
                      )}
                      {co.requested_date && (
                        <div>
                          <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: 2 }}>Requested Date</div>
                          <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{co.requested_date?.slice(0, 10)}</div>
                        </div>
                      )}
                      {co.approved_amount != null && Number(co.approved_amount) > 0 && (
                        <div>
                          <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: 2 }}>Approved Amount</div>
                          <div style={{ fontSize: typography.fontSize.sm, color: colors.statusActive, fontWeight: typography.fontWeight.semibold }}>{fmtCurrency(Number(co.approved_amount))}</div>
                        </div>
                      )}
                      {co.approved_date && (
                        <div>
                          <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: 2 }}>Approved Date</div>
                          <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{co.approved_date?.slice(0, 10)}</div>
                        </div>
                      )}
                    </div>
                    {/* Approval Chain */}
                    <ApprovalChain
                      steps={buildApprovalChain(co)}
                      coId={co.id}
                      onAdvance={coStatus === 'pending_review' ? () => handleApprove(co.id) : undefined}
                      onReturn={coStatus === 'pending_review' ? () => handleReject(co.id) : undefined}
                    />

                    {/* Markup & Margin Calculator */}
                    <MarkupCalculator directCost={Number(co.amount ?? 0)} />

                    {/* Linked Entity References */}
                    <LinkedEntities entities={expandedLinkedEntities} navigate={navigate} />

                    {/* Inline rejection reason */}
                    {rejectingCoId === co.id && (
                      <div style={{ display: 'flex', gap: spacing['2'], alignItems: 'flex-end', padding: spacing['2'], backgroundColor: `${colors.statusCritical}06`, border: `1px solid ${colors.statusCritical}20`, borderRadius: borderRadius.md }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing['1'] }}>Rejection Reason</label>
                          <input
                            type="text"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Provide a reason for rejection..."
                            autoFocus
                            style={{ width: '100%', padding: `${spacing['2']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily }}
                          />
                        </div>
                        <Btn size="sm" variant="primary" onClick={() => handleReject(co.id)}>Confirm Reject</Btn>
                        <Btn size="sm" variant="ghost" onClick={() => { setRejectingCoId(null); setRejectionReason(''); }}>Cancel</Btn>
                      </div>
                    )}

                    {/* Actions bar */}
                    <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap', paddingTop: spacing['2'], borderTop: `1px solid ${colors.borderLight}` }}>
                      <Btn size="sm" variant="secondary" onClick={() => openEditCO(co)}>Edit</Btn>
                      {canPromote && (
                        confirmPromoteId === co.id ? (
                          <>
                            <Btn size="sm" variant="primary" icon={<TrendingUp size={14} />} onClick={() => handlePromote(co)}>
                              Confirm Promote
                            </Btn>
                            <Btn size="sm" variant="ghost" onClick={() => setConfirmPromoteId(null)}>Cancel</Btn>
                          </>
                        ) : (
                          <Btn size="sm" variant="secondary" icon={<TrendingUp size={14} />} onClick={() => handlePromote(co)}>
                            Promote to {typeLabels[coType === 'pco' ? 'cor' : 'co']}
                          </Btn>
                        )
                      )}
                      {coStatus === 'draft' && (
                        <PermissionGate permission="change_orders.create">
                          <Btn size="sm" variant="secondary" onClick={() => handleSubmit(co.id)}>Submit for Review</Btn>
                        </PermissionGate>
                      )}
                      {coStatus === 'pending_review' && (
                        <PermissionGate permission="change_orders.approve">
                          <Btn size="sm" variant="primary" onClick={() => handleApprove(co.id)}>Approve</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => handleReject(co.id)}>Reject</Btn>
                        </PermissionGate>
                      )}
                      <div style={{ flex: 1 }} />
                      <PermissionGate permission="change_orders.delete">
                        {confirmDeleteId === co.id ? (
                          <>
                            <Btn size="sm" variant="primary" onClick={() => handleDelete(co)} disabled={deleteChangeOrder.isPending} data-testid="confirm-delete-button">
                              Confirm Delete
                            </Btn>
                            <Btn size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>Cancel</Btn>
                          </>
                        ) : (
                          <Btn
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(co)}
                            disabled={deleteChangeOrder.isPending}
                            aria-label="Delete this change order"
                            data-testid="delete-change-order-button"
                          >
                            Delete
                          </Btn>
                        )}
                      </PermissionGate>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <CreateChangeOrderModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
      />

      {/* Edit Modal */}
      <Modal open={!!editingCO} onClose={() => setEditingCO(null)} title="Edit Change Order">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <InputField label="Title" value={editForm.title} onChange={(v) => setEditForm({ ...editForm, title: v })} />
          <InputField label="Description" value={editForm.description} onChange={(v) => setEditForm({ ...editForm, description: v })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Amount ($)" value={editForm.amount} onChange={(v) => setEditForm({ ...editForm, amount: v })} type="number" />
            <InputField label="Cost Code" value={editForm.cost_code} onChange={(v) => setEditForm({ ...editForm, cost_code: v })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Schedule Impact (days)" value={editForm.schedule_impact} onChange={(v) => setEditForm({ ...editForm, schedule_impact: v })} />
            <div>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['1'] }}>Reason</label>
              <select
                value={editForm.reason}
                onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                style={{
                  width: '100%',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.md,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  backgroundColor: colors.white,
                }}
              >
                <option value="">Select reason…</option>
                {Object.entries(reasonLabels).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setEditingCO(null)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleEditSave} loading={updateCOMutation.isPending}>
              {updateCOMutation.isPending ? 'Saving...' : 'Save'}
            </Btn>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};

export function ChangeOrders() {
  return (
    <ErrorBoundary message="Change orders could not be displayed. Check your connection and try again.">
      <ChangeOrdersPage />
    </ErrorBoundary>
  );
}

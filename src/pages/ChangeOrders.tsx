import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Search, X, ArrowRight, GitBranch, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import { PageContainer, Card, Btn, MetricBox, SectionHeader, Skeleton, useToast, Modal, TabBar } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme';
import { WaterfallChart } from '../components/budget/WaterfallChart';
import { useQuery } from '../hooks/useQuery';
import { getCostData } from '../api/endpoints/budget';
import { getProject } from '../api/endpoints/projects';
import { useProjectId } from '../hooks/useProjectId';
import {
  useCreateChangeOrder, useUpdateChangeOrder, useSubmitChangeOrder,
  useApproveChangeOrder, useRejectChangeOrder, usePromoteChangeOrder,
} from '../hooks/mutations';
import {
  getCOTypeConfig, getCOStatusConfig, getReasonCodeConfig,
  getValidCOTransitions, getNextCOType, getApprovalChain,
} from '../machines/changeOrderMachine';
import type { ChangeOrderType, ChangeOrderState, ReasonCode } from '../machines/changeOrderMachine';
import { PermissionGate } from '../components/auth/PermissionGate';
import type { MappedChangeOrder } from '../api/endpoints/budget';
import { useTableKeyboardNavigation } from '../hooks/useTableKeyboardNavigation';
const fmt = (n: number): string => {
  if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

const REASON_CODES: { value: ReasonCode; label: string }[] = [
  { value: 'owner_change', label: 'Owner Change' },
  { value: 'design_error', label: 'Design Error' },
  { value: 'field_condition', label: 'Field Condition' },
  { value: 'regulatory', label: 'Regulatory' },
  { value: 'value_engineering', label: 'Value Engineering' },
  { value: 'unforeseen', label: 'Unforeseen' },
];

export const ChangeOrders: React.FC = () => {
  const { addToast } = useToast();
  const projectId = useProjectId();
  const { data: costData, loading: costLoading } = useQuery('costData', getCostData);
  const { data: projectData, loading: projectLoading } = useQuery('projectData', getProject);

  const createCO = useCreateChangeOrder();
  const updateCO = useUpdateChangeOrder();
  const submitCO = useSubmitChangeOrder();
  const approveCO = useApproveChangeOrder();
  const rejectCO = useRejectChangeOrder();
  const promoteCO = usePromoteChangeOrder();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<ChangeOrderType | 'all'>('all');
  const [filterStatus] = useState<ChangeOrderState | 'all'>('all');
  const [selectedCO, setSelectedCO] = useState<MappedChangeOrder | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComments, setRejectComments] = useState('');
  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState<ChangeOrderType>('pco');
  const [newReasonCode, setNewReasonCode] = useState<ReasonCode>('field_condition');
  const [newEstimatedCost, setNewEstimatedCost] = useState('');
  const [newScheduleImpact, setNewScheduleImpact] = useState('0');
  const [newCostCode, setNewCostCode] = useState('');

  const allCOs: MappedChangeOrder[] = costData?.changeOrders || [];
  const originalContract = projectData?.totalValue || 0;

  const filteredCOs = useMemo(() => {
    return allCOs.filter(co => {
      const matchSearch = searchQuery === '' ||
        co.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        co.coNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        co.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = filterType === 'all' || co.type === filterType;
      const matchStatus = filterStatus === 'all' || co.status === filterStatus;
      return matchSearch && matchType && matchStatus;
    });
  }, [allCOs, searchQuery, filterType, filterStatus]);

  const handleKeySelectCO = useCallback((co: MappedChangeOrder) => setSelectedCO(co), []);
  useTableKeyboardNavigation(filteredCOs, selectedCO?.id ?? null, handleKeySelectCO);

  // Pipeline metrics
  const metrics = useMemo(() => {
    const pcos = allCOs.filter(co => co.type === 'pco');
    const cors = allCOs.filter(co => co.type === 'cor');
    const cos = allCOs.filter(co => co.type === 'co');
    const approvedTotal = allCOs.filter(co => co.status === 'approved').reduce((s, co) => s + (co.approved_cost || co.amount), 0);
    const pendingTotal = allCOs.filter(co => co.status !== 'approved' && co.status !== 'rejected' && co.status !== 'void').reduce((s, co) => s + co.estimated_cost, 0);
    const rejectedTotal = allCOs.filter(co => co.status === 'rejected').reduce((s, co) => s + co.estimated_cost, 0);
    const scheduleImpact = allCOs.filter(co => co.status === 'approved').reduce((s, co) => s + co.schedule_impact_days, 0);

    return { pcos, cors, cos, approvedTotal, pendingTotal, rejectedTotal, scheduleImpact };
  }, [allCOs]);

  const handleCreate = async () => {
    if (!newTitle.trim()) { addToast('error', 'Title is required'); return; }
    try {
      await createCO.mutateAsync({
        projectId: projectId!,
        data: {
          project_id: projectId!,
          title: newTitle.trim(),
          description: newDescription.trim(),
          type: newType,
          reason_code: newReasonCode,
          estimated_cost: parseFloat(newEstimatedCost) || 0,
          amount: parseFloat(newEstimatedCost) || 0,
          schedule_impact_days: parseInt(newScheduleImpact) || 0,
          cost_code: newCostCode || null,
          status: 'draft',
        },
      });
      addToast('success', `${getCOTypeConfig(newType).shortLabel} created`);
      setShowCreateModal(false);
      resetForm();
    } catch {
      addToast('error', 'Failed to create change order');
    }
  };

  const resetForm = () => {
    setNewTitle(''); setNewDescription(''); setNewType('pco');
    setNewReasonCode('field_condition'); setNewEstimatedCost('');
    setNewScheduleImpact('0'); setNewCostCode('');
  };

  const handleAction = async (co: MappedChangeOrder, action: string) => {
    try {
      if (action === 'Submit for Review') {
        await submitCO.mutateAsync({ id: co.id, userId: 'current-user', projectId: projectId! });
        addToast('success', `${co.coNumber} submitted for review`);
      } else if (action === 'Approve') {
        await approveCO.mutateAsync({ id: co.id, userId: 'current-user', approvedCost: co.submitted_cost || co.amount, projectId: projectId! });
        addToast('success', `${co.coNumber} approved`);
      } else if (action === 'Reject') {
        setShowRejectModal(true);
        return; // Don't close detail panel
      } else if (action === 'Revise and Resubmit') {
        await updateCO.mutateAsync({ id: co.id, updates: { status: 'draft' }, projectId: projectId! });
        addToast('success', `${co.coNumber} returned to draft`);
      } else if (action === 'Void') {
        await updateCO.mutateAsync({ id: co.id, updates: { status: 'void' }, projectId: projectId! });
        addToast('success', `${co.coNumber} voided`);
      } else if (action === 'Promote to COR' || action === 'Promote to CO') {
        const nextType = getNextCOType(co.type);
        if (nextType) {
          await promoteCO.mutateAsync({ sourceId: co.id, projectId: projectId!, nextType: nextType as 'cor' | 'co' });
          addToast('success', `${co.coNumber} promoted to ${getCOTypeConfig(nextType).shortLabel}`);
        }
      }
      setSelectedCO(null);
    } catch {
      addToast('error', 'Action failed');
    }
  };

  const handleReject = async () => {
    if (!selectedCO || !rejectComments.trim()) { addToast('error', 'Rejection reason is required'); return; }
    try {
      await rejectCO.mutateAsync({ id: selectedCO.id, userId: 'current-user', comments: rejectComments, projectId: projectId! });
      addToast('success', `${selectedCO.coNumber} rejected`);
      setShowRejectModal(false); setRejectComments(''); setSelectedCO(null);
    } catch {
      addToast('error', 'Failed to reject');
    }
  };

  if (costLoading || projectLoading || !costData || !projectData) {
    return (
      <PageContainer title="Change Orders" subtitle="Loading...">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.lg }}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} height="80px" />)}
        </div>
      </PageContainer>
    );
  }

  const renderPipelineColumn = (type: ChangeOrderType, items: MappedChangeOrder[]) => {
    const typeConfig = getCOTypeConfig(type);
    const typeTotal = items.reduce((s, co) => s + co.estimated_cost, 0);
    return (
      <div style={{ flex: 1, minWidth: 300 }}>
        {/* Column header */}
        <div style={{ padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: typeConfig.bg, borderTop: `3px solid ${typeConfig.color}`, borderRadius: `${borderRadius.md} ${borderRadius.md} 0 0`, marginBottom: spacing['2'] }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{typeConfig.label}</span>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: spacing['2'] }}>{items.length}</span>
            </div>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: typeConfig.color }}>{fmt(typeTotal)}</span>
          </div>
        </div>
        {/* Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {items.map(co => {
            const statusConfig = getCOStatusConfig(co.status);
            const reasonConfig = co.reason_code ? getReasonCodeConfig(co.reason_code) : null;
            return (
              <div key={co.id} onClick={() => setSelectedCO(co)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCO(co); } }} style={{
                padding: spacing['4'], backgroundColor: colors.surfaceRaised,
                borderRadius: borderRadius.md, cursor: 'pointer',
                boxShadow: shadows.card, transition: `box-shadow ${transitions.quick}`,
                borderLeft: `3px solid ${statusConfig.color}`,
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = shadows.cardHover; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = shadows.card; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
                  <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: typeConfig.color }}>{co.coNumber}</span>
                  <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: statusConfig.color, backgroundColor: statusConfig.bg, padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full }}>{statusConfig.label}</span>
                </div>
                <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'], lineHeight: typography.lineHeight.snug }}>{co.title}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(co.estimated_cost)}</span>
                  {co.schedule_impact_days > 0 && (
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.statusPending, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Clock size={10} /> +{co.schedule_impact_days}d
                    </span>
                  )}
                  {reasonConfig && (
                    <span style={{ fontSize: typography.fontSize.caption, color: reasonConfig.color }}>{reasonConfig.label}</span>
                  )}
                </div>
                {/* Promotion indicator */}
                {co.status === 'approved' && getNextCOType(co.type) && !co.promoted_at && (
                  <div style={{ marginTop: spacing['2'], display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                    <ArrowRight size={10} color={colors.primaryOrange} />
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.orangeText, fontWeight: typography.fontWeight.medium }}>Ready to promote</span>
                  </div>
                )}
              </div>
            );
          })}
          {items.length === 0 && (
            <div style={{ padding: `${spacing['6']} ${spacing['4']}`, textAlign: 'center' }}>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>No {typeConfig.label.toLowerCase()}s</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDetailPanel = () => {
    if (!selectedCO) return null;
    const co = selectedCO;
    const typeConfig = getCOTypeConfig(co.type);
    const statusConfig = getCOStatusConfig(co.status);
    const reasonConfig = co.reason_code ? getReasonCodeConfig(co.reason_code) : null;
    const validActions = getValidCOTransitions(co.status, co.type);
    const approvalChain = getApprovalChain(co.type);

    return (
      <>
        <div onClick={() => setSelectedCO(null)} role="presentation" aria-hidden="true" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.2)', zIndex: 1039 }} />
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '560px', backgroundColor: colors.surfaceRaised, boxShadow: shadows.lg, zIndex: 1040, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: `${spacing['4']} ${spacing['5']}`, position: 'sticky', top: 0, backgroundColor: colors.surfaceRaised, zIndex: 1 }}>
            <button onClick={() => setSelectedCO(null)} aria-label="Close change order details" title="Close change order details" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', color: colors.textTertiary }}><X size={18} /></button>
          </div>

          <div style={{ padding: `0 ${spacing['5']} ${spacing['5']}` }}>
            {/* Type + Number */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
              <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: typeConfig.color, backgroundColor: typeConfig.bg, padding: `2px ${spacing['2']}`, borderRadius: borderRadius.sm }}>{typeConfig.shortLabel}</span>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>{co.coNumber}</span>
              <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: statusConfig.color, backgroundColor: statusConfig.bg, padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full }}>{statusConfig.label}</span>
            </div>

            <h2 style={{ fontSize: typography.fontSize['4xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary, margin: 0, marginBottom: spacing['5'], lineHeight: typography.lineHeight.tight }}>{co.title}</h2>

            {/* Rejection banner */}
            {co.status === 'rejected' && co.rejection_comments && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'], padding: spacing['3'], backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusCritical}`, marginBottom: spacing['4'] }}>
                <AlertTriangle size={14} color={colors.statusCritical} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, margin: 0 }}>Rejected</p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: `${spacing['1']} 0 0` }}>{co.rejection_comments}</p>
                  {co.rejected_by && <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: `${spacing['1']} 0 0` }}>by {co.rejected_by} · {co.rejected_at ? new Date(co.rejected_at).toLocaleDateString() : ''}</p>}
                </div>
              </div>
            )}

            {/* Cost breakdown */}
            <div style={{ marginBottom: spacing['5'] }}>
              <h3 style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['3'] }}>Cost Impact</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing['3'] }}>
                <div style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
                  <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, textTransform: 'uppercase' }}>Estimated</p>
                  <p style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: `${spacing['1']} 0 0` }}>{fmt(co.estimated_cost)}</p>
                </div>
                <div style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md }}>
                  <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, textTransform: 'uppercase' }}>Submitted</p>
                  <p style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: `${spacing['1']} 0 0` }}>{fmt(co.submitted_cost)}</p>
                </div>
                <div style={{ padding: spacing['3'], backgroundColor: co.status === 'approved' ? colors.statusActiveSubtle : colors.surfaceInset, borderRadius: borderRadius.md }}>
                  <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, textTransform: 'uppercase' }}>Approved</p>
                  <p style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: co.status === 'approved' ? colors.statusActive : colors.textTertiary, margin: `${spacing['1']} 0 0` }}>{co.status === 'approved' ? fmt(co.approved_cost || co.amount) : 'Pending'}</p>
                </div>
              </div>
            </div>

            {/* Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'], marginBottom: spacing['5'] }}>
              {co.description && (
                <div>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase' }}>Description</span>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: `${spacing['1']} 0 0`, lineHeight: typography.lineHeight.relaxed }}>{co.description}</p>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
                {reasonConfig && (
                  <div>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase' }}>Reason</span>
                    <p style={{ fontSize: typography.fontSize.sm, color: reasonConfig.color, margin: `${spacing['1']} 0 0`, fontWeight: typography.fontWeight.medium }}>{reasonConfig.label}</p>
                  </div>
                )}
                <div>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase' }}>Schedule Impact</span>
                  <p style={{ fontSize: typography.fontSize.sm, color: co.schedule_impact_days > 0 ? colors.statusPending : colors.textSecondary, margin: `${spacing['1']} 0 0`, fontWeight: typography.fontWeight.medium }}>
                    {co.schedule_impact_days > 0 ? `+${co.schedule_impact_days} days` : 'None'}
                  </p>
                </div>
                {co.cost_code && (
                  <div>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase' }}>Cost Code</span>
                    <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: `${spacing['1']} 0 0` }}>{co.cost_code}</p>
                  </div>
                )}
                {co.requested_by && (
                  <div>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase' }}>Requested By</span>
                    <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: `${spacing['1']} 0 0` }}>{co.requested_by}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Approval Chain Timeline */}
            <div style={{ marginBottom: spacing['5'] }}>
              <h3 style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['3'] }}>Approval Chain</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                {approvalChain.map((step, i) => {
                  let done = false;
                  let timestamp = '';
                  let actor = '';
                  if (i === 0 && co.reviewed_at) { done = true; timestamp = co.reviewed_at; actor = co.reviewed_by || ''; }
                  if (i === 0 && !co.reviewed_at && co.submitted_at) { done = true; timestamp = co.submitted_at; actor = co.submitted_by || ''; }
                  if (i === approvalChain.length - 1 && co.approved_at) { done = true; timestamp = co.approved_at; actor = co.approved_by || ''; }

                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: done ? colors.statusActiveSubtle : colors.surfaceInset, borderRadius: borderRadius.sm }}>
                      <div style={{ width: 20, height: 20, borderRadius: borderRadius.full, backgroundColor: done ? colors.statusActive : colors.borderDefault, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {done && <span style={{ color: colors.white, fontSize: '10px', fontWeight: typography.fontWeight.semibold }}>✓</span>}
                        {!done && <span style={{ color: colors.textTertiary, fontSize: '10px' }}>{i + 1}</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0, fontWeight: typography.fontWeight.medium }}>{step.role}: {step.action}</p>
                        {done && timestamp && <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>{actor} · {new Date(timestamp).toLocaleDateString()}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Promoted from/to */}
            {co.promoted_from_id && (
              <div style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, marginBottom: spacing['4'], display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <GitBranch size={14} color={colors.textTertiary} />
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Promoted from a previous stage</span>
              </div>
            )}

            {/* Actions */}
            {validActions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'], paddingTop: spacing['4'], borderTop: `1px solid ${colors.borderSubtle}` }}>
                {validActions.map(action => {
                  const isPromote = action.startsWith('Promote');
                  const isApprove = action === 'Approve';
                  const isReject = action === 'Reject';
                  const isVoid = action === 'Void';
                  const btn = (
                    <Btn
                      key={action}
                      variant={isApprove || isPromote ? 'primary' : isReject || isVoid ? 'ghost' : 'secondary'}
                      size="md"
                      icon={isPromote ? <ArrowRight size={14} /> : undefined}
                      iconPosition="right"
                      onClick={() => handleAction(co, action)}
                    >
                      {action}
                    </Btn>
                  );
                  if (isApprove || isPromote) return <PermissionGate key={action} permission="change_orders.approve">{btn}</PermissionGate>;
                  return btn;
                })}
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <PageContainer
      title="Change Orders"
      subtitle={`${allCOs.length} items · ${fmt(metrics.approvedTotal)} approved`}
      actions={<PermissionGate permission="change_orders.create"><Btn variant="primary" size="md" icon={<Plus size={16} />} onClick={() => setShowCreateModal(true)}>New PCO</Btn></PermissionGate>}
    >
      {/* Schedule impact warning */}
      {metrics.scheduleImpact > 14 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['3'],
          padding: `${spacing['3']} ${spacing['4']}`, marginBottom: spacing['4'],
          backgroundColor: colors.statusPendingSubtle, borderRadius: borderRadius.md,
          borderLeft: `3px solid ${colors.statusPending}`,
        }}>
          <AlertTriangle size={16} color={colors.statusPending} />
          <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
            Cumulative schedule impact of <strong>+{metrics.scheduleImpact} days</strong> from approved change orders. Review milestone dates.
          </span>
        </div>
      )}

      {/* Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: spacing['3'], marginBottom: spacing['4'] }}>
        <MetricBox label="PCOs" value={String(metrics.pcos.length)} />
        <MetricBox label="CORs" value={String(metrics.cors.length)} />
        <MetricBox label="COs" value={String(metrics.cos.length)} />
        <MetricBox label="Approved" value={fmt(metrics.approvedTotal)} />
        <MetricBox label="Pending" value={fmt(metrics.pendingTotal)} />
      </div>

      {/* Waterfall Chart */}
      <Card>
        <SectionHeader title="Budget Impact" action={<span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Original → Revised Contract</span>} />
        <WaterfallChart
          originalContract={originalContract}
          approvedCOs={metrics.approvedTotal}
          pendingCOs={metrics.pendingTotal}
          rejectedCOs={metrics.rejectedTotal}
        />
      </Card>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginTop: spacing['5'], marginBottom: spacing['4'], flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['1']} ${spacing['3']}`, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, flex: '1 1 200px', maxWidth: 300 }}>
          <Search size={14} color={colors.textTertiary} />
          <input type="text" placeholder="Search change orders..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1, border: 'none', backgroundColor: 'transparent', outline: 'none', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary }} />
          {searchQuery && <button onClick={() => setSearchQuery('')} aria-label="Clear search" title="Clear search" style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, display: 'flex' }}><X size={12} /></button>}
        </div>

        {/* Type filter */}
        <div style={{ display: 'flex', gap: spacing['1'] }}>
          {(['all', 'pco', 'cor', 'co'] as const).map(t => {
            const active = filterType === t;
            const label = t === 'all' ? 'All' : getCOTypeConfig(t as ChangeOrderType).shortLabel;
            return (
              <button key={t} onClick={() => setFilterType(t)}
                style={{
                  padding: `${spacing['1']} ${spacing['3']}`, fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily, fontWeight: active ? typography.fontWeight.semibold : typography.fontWeight.medium,
                  backgroundColor: active ? colors.surfaceRaised : 'transparent',
                  color: active ? colors.textPrimary : colors.textTertiary,
                  border: 'none', borderRadius: borderRadius.full, cursor: 'pointer',
                  boxShadow: active ? shadows.sm : 'none',
                }}>
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        <TabBar
          tabs={[{ id: 'pipeline', label: 'Pipeline' }, { id: 'list', label: 'List' }]}
          activeTab={viewMode}
          onChange={id => setViewMode(id as 'pipeline' | 'list')}
        />
      </div>

      {/* Pipeline View */}
      {viewMode === 'pipeline' && (
        <div style={{ display: 'flex', gap: spacing['4'], alignItems: 'flex-start' }}>
          {renderPipelineColumn('pco', filteredCOs.filter(co => co.type === 'pco'))}
          <div style={{ display: 'flex', alignItems: 'center', paddingTop: spacing['12'], color: colors.textTertiary }}><ChevronRight size={20} /></div>
          {renderPipelineColumn('cor', filteredCOs.filter(co => co.type === 'cor'))}
          <div style={{ display: 'flex', alignItems: 'center', paddingTop: spacing['12'], color: colors.textTertiary }}><ChevronRight size={20} /></div>
          {renderPipelineColumn('co', filteredCOs.filter(co => co.type === 'co'))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <Card padding="0">
          <div style={{ display: 'grid', gridTemplateColumns: '80px 60px 1fr 100px 100px 80px 120px', padding: `${spacing['2']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
            {['Number', 'Type', 'Title', 'Amount', 'Impact', 'Days', 'Status'].map(h => (
              <span key={h} style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>{h}</span>
            ))}
          </div>
          {filteredCOs.map((co, i) => {
            const typeConfig = getCOTypeConfig(co.type);
            const statusConfig = getCOStatusConfig(co.status);
            return (
              <div key={co.id} onClick={() => setSelectedCO(co)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCO(co); } }} style={{
                display: 'grid', gridTemplateColumns: '80px 60px 1fr 100px 100px 80px 120px',
                padding: `${spacing['3']} ${spacing['4']}`,
                borderBottom: i < filteredCOs.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                cursor: 'pointer', alignItems: 'center',
                transition: `background-color ${transitions.quick}`,
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceHover; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
              >
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{co.coNumber}</span>
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: typeConfig.color }}>{typeConfig.shortLabel}</span>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.title}</span>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{fmt(co.estimated_cost)}</span>
                <span style={{ fontSize: typography.fontSize.sm, color: co.reason_code ? getReasonCodeConfig(co.reason_code).color : colors.textTertiary }}>{co.reason_code ? getReasonCodeConfig(co.reason_code).label : 'N/A'}</span>
                <span style={{ fontSize: typography.fontSize.sm, color: co.schedule_impact_days > 0 ? colors.statusPending : colors.textTertiary }}>{co.schedule_impact_days > 0 ? `+${co.schedule_impact_days}d` : '0d'}</span>
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: statusConfig.color, backgroundColor: statusConfig.bg, padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full, textAlign: 'center' }}>{statusConfig.label}</span>
              </div>
            );
          })}
          {filteredCOs.length === 0 && (
            <div style={{ padding: spacing['6'], textAlign: 'center' }}>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>No change orders match your filters</span>
            </div>
          )}
        </Card>
      )}

      {/* Detail Panel */}
      {selectedCO && renderDetailPanel()}

      {/* Reject Modal */}
      <Modal open={showRejectModal} onClose={() => { setShowRejectModal(false); setRejectComments(''); }} title="Reject Change Order">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>Provide a reason for rejecting {selectedCO?.coNumber}.</p>
          <textarea value={rejectComments} onChange={e => setRejectComments(e.target.value)} placeholder="Reason for rejection..." autoFocus
            style={{ width: '100%', padding: spacing['3'], fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, border: 'none', backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, outline: 'none', resize: 'vertical', minHeight: '96px', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
            <Btn variant="ghost" size="md" onClick={() => { setShowRejectModal(false); setRejectComments(''); }}>Cancel</Btn>
            <PermissionGate permission="change_orders.approve"><Btn variant="primary" size="md" onClick={handleReject}>Reject</Btn></PermissionGate>
          </div>
        </div>
      </Modal>

      {/* Create Modal */}
      <Modal open={showCreateModal} onClose={() => { setShowCreateModal(false); resetForm(); }} title="New Change Order">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          {/* Type selector */}
          <div>
            <label style={{ display: 'block', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['1'], textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Type</label>
            <div style={{ display: 'flex', gap: spacing['2'] }}>
              {(['pco', 'cor', 'co'] as ChangeOrderType[]).map(t => {
                const tc = getCOTypeConfig(t);
                const active = newType === t;
                return (
                  <button key={t} onClick={() => setNewType(t)} style={{
                    flex: 1, padding: `${spacing['2']} ${spacing['3']}`,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    fontWeight: active ? typography.fontWeight.semibold : typography.fontWeight.medium,
                    backgroundColor: active ? tc.bg : 'transparent',
                    color: active ? tc.color : colors.textTertiary,
                    border: active ? `1px solid ${tc.color}40` : `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.md, cursor: 'pointer',
                  }}>{tc.shortLabel}</button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['1'], textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Title *</label>
            <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Describe the change" autoFocus
              style={{ width: '100%', padding: spacing['3'], fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.white, borderRadius: borderRadius.md, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['1'], textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Description</label>
            <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Detailed description of the change and its impact"
              style={{ width: '100%', padding: spacing['3'], fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.white, borderRadius: borderRadius.md, outline: 'none', resize: 'vertical', minHeight: '72px', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <div>
              <label style={{ display: 'block', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['1'], textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Reason Code</label>
              <select value={newReasonCode} onChange={e => setNewReasonCode(e.target.value as ReasonCode)}
                style={{ width: '100%', padding: spacing['3'], fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.white, borderRadius: borderRadius.md, outline: 'none' }}>
                {REASON_CODES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['1'], textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Cost Code</label>
              <input type="text" value={newCostCode} onChange={e => setNewCostCode(e.target.value)} placeholder="e.g. 03.300"
                style={{ width: '100%', padding: spacing['3'], fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.white, borderRadius: borderRadius.md, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <div>
              <label style={{ display: 'block', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['1'], textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Estimated Cost</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: spacing['3'], top: '50%', transform: 'translateY(-50%)', fontSize: typography.fontSize.body, color: colors.textTertiary }}>$</span>
                <input type="number" value={newEstimatedCost} onChange={e => setNewEstimatedCost(e.target.value)} placeholder="0" min="0"
                  style={{ width: '100%', padding: spacing['3'], paddingLeft: spacing['6'], fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.white, borderRadius: borderRadius.md, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['1'], textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider }}>Schedule Impact (days)</label>
              <input type="number" value={newScheduleImpact} onChange={e => setNewScheduleImpact(e.target.value)} min="0"
                style={{ width: '100%', padding: spacing['3'], fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.white, borderRadius: borderRadius.md, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], paddingTop: spacing['3'], borderTop: `1px solid ${colors.borderSubtle}` }}>
            <Btn variant="ghost" size="md" onClick={() => { setShowCreateModal(false); resetForm(); }}>Cancel</Btn>
            <Btn variant="primary" size="md" onClick={handleCreate}>Create {getCOTypeConfig(newType).shortLabel}</Btn>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};

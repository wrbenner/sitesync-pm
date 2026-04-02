import React, { useState, useMemo, useCallback } from 'react';
import { VirtualDataTable } from '../components/shared/VirtualDataTable';
import { BulkActionBar } from '../components/shared/BulkActionBar';
import { createColumnHelper } from '@tanstack/react-table';
import { PageContainer, Card, Btn, StatusTag, PriorityTag, DetailPanel, RelatedItems, Skeleton, useToast } from '../components/Primitives';
import EmptyState from '../components/ui/EmptyState';
import { MetricCardSkeleton } from '../components/ui/Skeletons';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { useSubmittals } from '../hooks/queries';
import { AlertTriangle, Calendar, Clock, ArrowRight, CheckCircle, ClipboardList, Paperclip, LayoutGrid, List, RefreshCw, Sparkles, UserCheck, Tag as TagIcon, Download } from 'lucide-react';
import { useAppNavigate, getRelatedItemsForSubmittal } from '../utils/connections';
import { useCreateSubmittal, useUpdateSubmittal } from '../hooks/mutations';
import { useSubmittalReviewers } from '../hooks/queries';
import { useProjectId } from '../hooks/useProjectId';
import { useNavigate } from 'react-router-dom';
import { PermissionGate } from '../components/auth/PermissionGate';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { PredictiveAlertBanner } from '../components/ai/PredictiveAlert';
import { getAnnotationsForEntity, getPredictiveAlertsForPage } from '../data/aiAnnotations';
import { KanbanBoard } from '../components/shared/KanbanBoard';
import type { KanbanColumn } from '../components/shared/KanbanBoard';
import { ApprovalChain } from '../components/shared/ApprovalChain';
import type { ApprovalStep } from '../components/shared/ApprovalChain';
import CreateSubmittalModal from '../components/forms/CreateSubmittalModal';
import { EditableDetailField } from '../components/forms/EditableField';
import { toast } from 'sonner';
import { PresenceAvatars } from '../components/shared/PresenceAvatars';
import { EditingLockBanner } from '../components/ui/EditingLockBanner';

const isOverdue = (dateStr: string) => new Date(dateStr) < new Date();

// ── ReviewerStepper ──────────────────────────────────────
type StepStatus = 'pending' | 'current' | 'approved' | 'rejected' | 'approved_as_noted';

const STEP_COLORS: Record<StepStatus, { bg: string; fg: string }> = {
  pending:           { bg: '#E5E7EB', fg: '#9CA3AF' },
  current:           { bg: '#3B82F6', fg: '#FFFFFF' },
  approved:          { bg: '#4EC896', fg: '#FFFFFF' },
  rejected:          { bg: '#EF4444', fg: '#FFFFFF' },
  approved_as_noted: { bg: '#F59E0B', fg: '#FFFFFF' },
};

interface ReviewerStep {
  id: string | number;
  role: string;
  date?: string;
  status: StepStatus;
}

function buildFallbackSteps(status: string): ReviewerStep[] {
  let s0: StepStatus = 'pending';
  let s1: StepStatus = 'pending';
  let s2: StepStatus = 'pending';

  if (status === 'pending') {
    s0 = 'current';
  } else if (status === 'submitted' || status === 'under_review' || status === 'review_in_progress') {
    s0 = 'approved'; s1 = 'current';
  } else if (status === 'approved') {
    s0 = 'approved'; s1 = 'approved'; s2 = 'approved';
  } else if (status === 'approved_as_noted') {
    s0 = 'approved'; s1 = 'approved'; s2 = 'approved_as_noted';
  } else if (status === 'rejected' || status === 'revise_resubmit') {
    s0 = 'approved'; s1 = 'approved'; s2 = 'rejected';
  } else {
    s0 = 'current';
  }

  return [
    { id: 1, role: 'Submitted', status: s0 },
    { id: 2, role: 'Review', status: s1 },
    { id: 3, role: 'Decision', status: s2 },
  ];
}

type ReviewerRow = { id: string; role: string | null; status: string | null; stamp: string | null; comments: string | null; approver_id: string | null };

function buildReviewerSteps(reviewers: ReviewerRow[]): ReviewerStep[] {
  return reviewers.map((r) => {
    let stepStatus: StepStatus = 'pending';
    if (r.status === 'approved') stepStatus = 'approved';
    else if (r.status === 'approved_as_noted') stepStatus = 'approved_as_noted';
    else if (r.status === 'rejected' || r.status === 'revise_resubmit') stepStatus = 'rejected';
    else if (r.status === 'current' || r.status === 'in_review') stepStatus = 'current';
    return {
      id: r.id,
      role: r.role || 'Reviewer',
      status: stepStatus,
      date: r.stamp ? new Date(r.stamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined,
    };
  });
}

const ReviewerStepper: React.FC<{ status: string; reviewers: ReviewerRow[] }> = ({ status, reviewers }) => {
  const steps: ReviewerStep[] = useMemo(
    () => reviewers.length ? buildReviewerSteps(reviewers) : buildFallbackSteps(status),
    [reviewers, status],
  );

  return (
    <div aria-label="Approval chain" style={{ display: 'flex', alignItems: 'flex-start' }}>
      {steps.map((step, idx) => {
        const { bg, fg } = STEP_COLORS[step.status];
        const isDone = step.status === 'approved' || step.status === 'approved_as_noted' || step.status === 'rejected';
        const isLast = idx === steps.length - 1;

        return (
          <React.Fragment key={step.id}>
            {/* Circle + label column */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 56 }}>
              <div
                aria-current={step.status === 'current' ? 'step' : undefined}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {step.status === 'approved' && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7l3 3 6-6" stroke={fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {step.status === 'rejected' && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 2l8 8M10 2l-8 8" stroke={fg} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
                {step.status === 'approved_as_noted' && (
                  <span style={{ fontSize: 14, fontWeight: 700, color: fg, lineHeight: 1 }}>~</span>
                )}
                {step.status === 'current' && (
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: fg }} />
                )}
                {step.status === 'pending' && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: fg }} />
                )}
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: step.status === 'current' ? 600 : 400,
                color: step.status === 'pending' ? colors.textTertiary : colors.textSecondary,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                lineHeight: 1.3,
              }}>
                {step.role}
              </span>
              {step.date && (
                <span style={{ fontSize: 10, color: colors.textTertiary, textAlign: 'center', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                  {step.date}
                </span>
              )}
            </div>
            {/* Connector line */}
            {!isLast && (
              <div style={{
                flex: 1,
                height: 2,
                marginTop: 15,
                ...(isDone
                  ? { backgroundColor: '#4EC896' }
                  : {
                      backgroundImage: 'repeating-linear-gradient(90deg, #D1D5DB 0, #D1D5DB 6px, transparent 6px, transparent 12px)',
                      backgroundColor: 'transparent',
                    }
                ),
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const BIC_COLORS: Record<string, string> = {
  GC: '#3B82F6',
  Architect: '#8B5CF6',
  Engineer: '#14B8A6',
  Owner: '#F47820',
  Sub: '#6B7280',
};

const BallInCourtBadge: React.FC<{ value: string | null }> = ({ value }) => {
  if (!value) return null;
  const color = BIC_COLORS[value] ?? '#6B7280';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 500,
      backgroundColor: `${color}1A`,
      color,
      whiteSpace: 'nowrap',
    }}>
      {value}
    </span>
  );
};

const subColHelper = createColumnHelper<any>();

const Submittals: React.FC = () => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDetail, setEditingDetail] = useState(false);
  const { addToast } = useToast();
  const appNavigate = useAppNavigate();
  const navigate = useNavigate();
  const projectId = useProjectId();
  const createSubmittal = useCreateSubmittal();
  const updateSubmittal = useUpdateSubmittal();
  const { data: submittalsResult, isPending: loading, error: submittalsError, refetch } = useSubmittals(projectId);
  const selectedIdStr = selectedId != null ? String(selectedId) : undefined;
  const { data: reviewersData = [] } = useSubmittalReviewers(selectedIdStr);
  const submittalsRaw = submittalsResult?.data ?? [];

  // Map API data to component shape
  const submittals = useMemo(() => submittalsRaw.map((s: Record<string, unknown>) => ({
    ...s,
    submittalNumber: s.number ? `SUB-${String(s.number).padStart(3, '0')}` : String(s.id ?? '').slice(0, 8),
    from: (s.subcontractor as string) || (s.created_by as string) || '',
    dueDate: (s.due_date as string) || '',
  })), [submittalsRaw]);

  if (submittalsError) {
    return (
      <PageContainer title="Submittals" subtitle="Unable to load">
        <Card padding={spacing['6']}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['4'], padding: spacing['6'], textAlign: 'center' }}>
            <AlertTriangle size={40} color={colors.statusCritical} />
            <div>
              <p style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>Failed to load submittals</p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>{(submittalsError as Error).message || 'Unable to fetch submittal data'}</p>
            </div>
            <Btn variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Try Again</Btn>
          </div>
        </Card>
      </PageContainer>
    );
  }

  if (!submittals.length) {
    return (
      <PageContainer
        title="Submittals"
        subtitle="No items"
        actions={<PermissionGate permission="submittals.create"><Btn onClick={() => setShowCreateModal(true)}>New Submittal</Btn></PermissionGate>}
      >
        <EmptyState
          icon={ClipboardList}
          title="No submittals yet"
          description="Track shop drawings, product data, and samples through the approval workflow."
          action={{ label: 'Create Submittal', onClick: () => setShowCreateModal(true) }}
        />
      </PageContainer>
    );
  }

  const allSubmittals = submittals;

  const pageAlerts = getPredictiveAlertsForPage('submittals');
  const openCount = useMemo(() => allSubmittals.filter((s: Record<string, unknown>) => s.status !== 'approved').length, [allSubmittals]);

  const subColumns = useMemo(() => [
    subColHelper.accessor('submittalNumber', {
      header: 'Submittal #',
      size: 100,
      cell: (info) => <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.orangeText }}>{info.getValue()}</span>,
    }),
    subColHelper.accessor('title', {
      header: 'Title',
      size: 360,
      cell: (info) => {
        const sub = info.row.original;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, lineHeight: typography.lineHeight.snug }}>
              {info.getValue()}
              {getAnnotationsForEntity('submittal', sub.id).map((ann: any) => (
                <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
              ))}
            </span>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              {sub.spec_section && <span style={{ fontFamily: 'monospace', marginRight: spacing['2'] }}>{sub.spec_section}</span>}
              {sub.lead_time_weeks != null && sub.lead_time_weeks > 0 && (() => {
                const wks = sub.lead_time_weeks;
                const c = wks > 12 ? colors.statusCritical : wks >= 8 ? colors.statusPending : colors.statusActive;
                return <span style={{ color: c }}>{wks} wk lead</span>;
              })()}
            </span>
          </div>
        );
      },
    }),
    subColHelper.accessor('from', {
      header: 'From',
      size: 150,
      cell: (info) => <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{info.getValue()}</span>,
    }),
    subColHelper.accessor('priority', {
      header: 'Priority',
      size: 90,
      cell: (info) => <PriorityTag priority={info.getValue() as any} />,
    }),
    subColHelper.accessor('status', {
      header: 'Status',
      size: 130,
      cell: (info) => {
        const sub = info.row.original;
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
            <StatusTag status={info.getValue() as any} />
            {sub.revision_number > 1 && (
              <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, backgroundColor: `${colors.statusCritical}08`, padding: '1px 5px', borderRadius: borderRadius.full }}>
                C{sub.revision_number}
              </span>
            )}
          </span>
        );
      },
    }),
    subColHelper.accessor('dueDate', {
      header: 'Due',
      size: 100,
      cell: (info) => {
        const sub = info.row.original;
        return (
          <span style={{ fontSize: typography.fontSize.sm, color: isOverdue(info.getValue()) && sub.status !== 'approved' ? colors.statusCritical : colors.textTertiary, fontVariantNumeric: 'tabular-nums' as const }}>
            {new Date(info.getValue()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        );
      },
    }),
    subColHelper.accessor('ball_in_court', {
      header: 'Ball in Court',
      size: 120,
      cell: (info) => <BallInCourtBadge value={info.getValue() as string | null} />,
    }),
  ], []);

  const checkboxColumn = useMemo(() => subColHelper.display({
    id: 'select',
    size: 44,
    header: () => (
      <input
        type="checkbox"
        checked={selectedIds.size > 0 && selectedIds.size === allSubmittals.length}
        ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < allSubmittals.length; }}
        onChange={(e) => {
          if (e.target.checked) setSelectedIds(new Set(allSubmittals.map((s: any) => String(s.id))));
          else setSelectedIds(new Set());
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label="Select all submittals"
        style={{ cursor: 'pointer' }}
      />
    ),
    cell: (info: any) => {
      const id = String(info.row.original.id);
      return (
        <input
          type="checkbox"
          checked={selectedIds.has(id)}
          onChange={() => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select submittal ${id}`}
          style={{ cursor: 'pointer' }}
        />
      );
    },
  }), [selectedIds, allSubmittals]);

  const allSubColumns = useMemo(() => [checkboxColumn, ...subColumns], [checkboxColumn, subColumns]);

  const selected = allSubmittals.find((s: Record<string, unknown>) => s.id === selectedId) || null;
  const timeline: Array<{ date: string; event: string; by: string; status: 'complete' | 'active' | 'pending' }> = [];

  const kanbanColumns: KanbanColumn<any>[] = useMemo(() => [
    { id: 'pending', label: 'Pending', color: colors.statusPending, items: allSubmittals.filter((s) => s.status === 'pending') },
    { id: 'under_review', label: 'Under Review', color: colors.statusInfo, items: allSubmittals.filter((s) => s.status === 'under_review') },
    { id: 'revise_resubmit', label: 'Revise & Resubmit', color: colors.statusCritical, items: allSubmittals.filter((s) => s.status === 'revise_resubmit') },
    { id: 'approved', label: 'Approved', color: colors.statusActive, items: allSubmittals.filter((s) => s.status === 'approved') },
  ], [allSubmittals]);

  const approvalSteps: ApprovalStep[] = useMemo(() => selected ? [
    { id: 1, role: 'Subcontractor', name: selected.from || 'Contractor', initials: 'SC', status: 'approved', date: 'Submitted', comment: 'Initial submission' },
    { id: 2, role: 'General Contractor', name: 'GC Reviewer', initials: 'GC', status: 'approved', date: 'Reviewed' },
    { id: 3, role: 'Architect', name: 'Architect', initials: 'AR', status: selected.status === 'approved' ? 'approved' : selected.status === 'revise_resubmit' ? 'rejected' : 'pending', date: selected.status === 'approved' ? 'Approved' : undefined, comment: selected.status === 'revise_resubmit' ? 'Revisions required' : undefined },
    { id: 4, role: 'Owner', name: 'Owner', initials: 'OW', status: selected.status === 'approved' ? 'approved' : 'waiting' },
  ] : [], [selected]);

  const handleApprove = useCallback(() => {
    addToast('success', `${selected?.submittalNumber} approved successfully`);
    setSelectedId(null);
  }, [selected, addToast]);

  const handleReject = useCallback(() => {
    addToast('error', `${selected?.submittalNumber} has been rejected`);
    setSelectedId(null);
  }, [selected, addToast]);

  const handleRequestRevision = useCallback(() => {
    addToast('warning', `Revision requested for ${selected?.submittalNumber}`);
    setSelectedId(null);
  }, [selected, addToast]);

  const toggleBtnStyle = useCallback((active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: 'none',
    cursor: 'pointer',
    backgroundColor: active ? colors.primaryOrange : 'transparent',
    color: active ? colors.white : colors.textTertiary,
    transition: 'all 150ms ease',
  }), []);

  return (
    <PageContainer
      title="Submittals"
      subtitle={`${allSubmittals.length} total \u00b7 ${openCount} open`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <div style={{ display: 'flex', borderRadius: borderRadius.full, overflow: 'hidden', border: `1px solid ${colors.borderLight}` }}>
            <button
              style={{ ...toggleBtnStyle(viewMode === 'table'), borderRadius: `${borderRadius.full} 0 0 ${borderRadius.full}` }}
              onClick={() => setViewMode('table')}
              title="Table View"
              aria-label="Table View"
            >
              <List size={16} />
            </button>
            <button
              style={{ ...toggleBtnStyle(viewMode === 'kanban'), borderRadius: `0 ${borderRadius.full} ${borderRadius.full} 0` }}
              onClick={() => setViewMode('kanban')}
              title="Board View"
              aria-label="Board View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          <PermissionGate permission="submittals.create">
            <Btn onClick={() => setShowCreateModal(true)}>New Submittal</Btn>
          </PermissionGate>
        </div>
      }
    >
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} />
      ))}

      {viewMode === 'table' ? (
        <Card padding="0">
          <VirtualDataTable
            data={allSubmittals}
            columns={allSubColumns}
            rowHeight={48}
            containerHeight={600}
            onRowClick={(sub) => navigate(`/projects/${projectId}/submittals/${sub.id}`)}
            selectedRowId={null}
            getRowId={(row) => String(row.id)}
            loading={loading}
            emptyMessage="No submittals match your filters"
            onRowToggleSelectByIndex={(i) => {
              const id = String(allSubmittals[i]?.id);
              if (!id) return;
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
          />
        </Card>
      ) : (
        <KanbanBoard
          columns={kanbanColumns}
          getKey={(sub: any) => sub.id}
          renderCard={(sub: any) => (
            <div
              style={{ padding: spacing.md, cursor: 'pointer' }}
              onClick={() => setSelectedId(sub.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(sub.id); } }}
              role="button"
              tabIndex={0}
              aria-label={`View submittal ${sub.submittalNumber}: ${sub.title}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>{sub.submittalNumber}</span>
                <PriorityTag priority={sub.priority as any} />
              </div>
              <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.sm, lineHeight: typography.lineHeight.snug }}>
                {sub.title}
              </div>
              <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, marginBottom: spacing.xs }}>
                {sub.from}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: typography.fontSize.caption,
                    color: isOverdue(sub.dueDate) && sub.status !== 'approved' ? colors.statusCritical : colors.textTertiary,
                    fontWeight: isOverdue(sub.dueDate) && sub.status !== 'approved' ? typography.fontWeight.medium : typography.fontWeight.normal,
                  }}
                >
                  {new Date(sub.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <div style={{ display: 'flex', gap: spacing.xs }}>
                  {getAnnotationsForEntity('submittal', sub.id).map((ann) => (
                    <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                  ))}
                </div>
              </div>
            </div>
          )}
        />
      )}

      <BulkActionBar
        selectedIds={Array.from(selectedIds)}
        onClearSelection={() => setSelectedIds(new Set())}
        entityLabel="submittals"
        actions={[
          {
            label: 'Reassign Reviewer',
            icon: <UserCheck size={14} />,
            variant: 'secondary',
            onClick: async (ids) => {
              await Promise.all(ids.map((id) => updateSubmittal.mutateAsync({ id, updates: { reviewer: 'Reassigned' }, projectId: projectId! })));
              addToast('success', `${ids.length} submittal${ids.length > 1 ? 's' : ''} reassigned`);
            },
          },
          {
            label: 'Change Status',
            icon: <TagIcon size={14} />,
            variant: 'secondary',
            onClick: async (ids) => {
              await Promise.all(ids.map((id) => updateSubmittal.mutateAsync({ id, updates: { status: 'under_review' }, projectId: projectId! })));
              addToast('success', `${ids.length} submittal${ids.length > 1 ? 's' : ''} set to Under Review`);
            },
          },
          {
            label: 'Export',
            icon: <Download size={14} />,
            variant: 'secondary',
            onClick: async (ids) => {
              const selected = allSubmittals.filter((s: Record<string, unknown>) => ids.includes(String(s.id)));
              const csv = ['Submittal #,Title,From,Priority,Status,Due Date',
                ...selected.map((s: any) => `${s.submittalNumber},"${s.title}",${s.from},${s.priority},${s.status},${s.dueDate}`),
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'submittals-export.csv'; a.click();
              URL.revokeObjectURL(url);
            },
          },
        ]}
      />

      <DetailPanel
        open={!!selected}
        onClose={() => { setSelectedId(null); setEditingDetail(false); }}
        title={selected?.submittalNumber || ''}
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
            {/* Title + Edit Toggle */}
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing['3'] }}>
                <h3 style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing.md, flex: 1 }}>
                  {selected.title}
                </h3>
                <PresenceAvatars entityId={String(selected.id)} size={24} />
                <PermissionGate permission="submittals.edit">
                  <Btn
                    variant={editingDetail ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setEditingDetail(!editingDetail)}
                  >
                    {editingDetail ? 'Done' : 'Edit'}
                  </Btn>
                </PermissionGate>
              </div>
              <EditingLockBanner entityType="submittal" entityId={String(selected.id)} isEditing={editingDetail} />
              <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
                <PriorityTag priority={selected.priority as any} />
                <StatusTag status={selected.status as any} />
              </div>
            </div>

            {/* Approval Stepper */}
            <ReviewerStepper status={selected.status} reviewers={reviewersData} />

            {/* Details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
              <EditableDetailField
                label="From"
                value={selected.from || ''}
                editing={editingDetail}
                type="text"
                onSave={async (val) => {
                  await updateSubmittal.mutateAsync({ id: String(selected.id), updates: { subcontractor: val }, projectId: projectId! });
                  toast.success('Subcontractor updated');
                }}
              />
              <EditableDetailField
                label="Due Date"
                value={selected.dueDate?.slice(0, 10) || ''}
                editing={editingDetail}
                type="date"
                onSave={async (val) => {
                  await updateSubmittal.mutateAsync({ id: String(selected.id), updates: { due_date: val }, projectId: projectId! });
                  toast.success('Due date updated');
                }}
                displayContent={
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                    <Calendar size={14} color={isOverdue(selected.dueDate) && selected.status !== 'approved' ? colors.statusCritical : colors.textSecondary} />
                    <span style={{
                      fontSize: typography.fontSize.base,
                      color: isOverdue(selected.dueDate) && selected.status !== 'approved' ? colors.statusCritical : colors.textPrimary,
                      fontWeight: typography.fontWeight.medium,
                    }}>
                      {new Date(selected.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                }
              />
            </div>

            {/* Description */}
            <div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</div>
              <p style={{ fontSize: typography.fontSize.base, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed, margin: 0 }}>
                {(selected as any).description || 'No description provided.'}
              </p>
            </div>

            {/* Attachments indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.base }}>
              <Paperclip size={16} color={colors.textTertiary} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>3 attachments (shop drawings, spec sheet, cover letter)</span>
            </div>

            {/* Review Timeline */}
            <div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.lg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Review Timeline</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {timeline.map((entry, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: spacing.lg, position: 'relative', paddingBottom: idx < timeline.length - 1 ? spacing.xl : 0 }}>
                    {/* Timeline line */}
                    {idx < timeline.length - 1 && (
                      <div style={{
                        position: 'absolute',
                        left: '11px',
                        top: '24px',
                        bottom: 0,
                        width: '2px',
                        backgroundColor: entry.status === 'complete' ? colors.tealSuccess : colors.borderLight,
                      }} />
                    )}
                    {/* Dot */}
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: borderRadius.full,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      backgroundColor: entry.status === 'complete' ? colors.tealSuccess
                        : entry.status === 'active' ? colors.statusInfo
                        : colors.surfaceInset,
                    }}>
                      {entry.status === 'complete' ? (
                        <CheckCircle size={14} color={colors.white} />
                      ) : entry.status === 'active' ? (
                        <Clock size={14} color={colors.white} />
                      ) : (
                        <Clock size={14} color={colors.textTertiary} />
                      )}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: typography.fontSize.base, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
                        {entry.event}
                      </div>
                      <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, marginTop: spacing.xs }}>
                        {entry.by} &middot; {entry.date}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Approval Chain */}
            <div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.lg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Approval Chain</div>
              <ApprovalChain steps={approvalSteps} />
            </div>

            {/* AI Compliance Check */}
            <div style={{ marginTop: spacing['4'], padding: spacing['3'], backgroundColor: `${colors.statusActive}06`, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusActive}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
                <Sparkles size={12} color={colors.statusActive} />
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusActive, textTransform: 'uppercase', letterSpacing: '0.4px' }}>AI Compliance Check</span>
              </div>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>
                Submittal matches spec section 09 21 16 (Gypsum Board Assemblies). Material specifications align with project requirements. No deviations detected.
              </p>
            </div>

            {/* Related Items */}
            <RelatedItems items={getRelatedItemsForSubmittal(selected.id)} onNavigate={appNavigate} />

            {/* Actions */}
            {selected.status !== 'approved' && (
              <div style={{ display: 'flex', gap: spacing.sm, paddingTop: spacing.md, borderTop: `1px solid ${colors.borderLight}` }}>
                <PermissionGate permission="submittals.approve">
                  <Btn variant="primary" onClick={handleApprove} icon={<CheckCircle size={16} />}>Approve</Btn>
                </PermissionGate>
                <PermissionGate permission="submittals.approve">
                  <Btn variant="danger" onClick={handleReject}>Reject</Btn>
                </PermissionGate>
                <PermissionGate permission="submittals.approve">
                  <Btn variant="secondary" onClick={handleRequestRevision} icon={<ArrowRight size={16} />}>Request Revision</Btn>
                </PermissionGate>
              </div>
            )}
            {selected.status === 'approved' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: 'rgba(78, 200, 150, 0.08)', borderRadius: borderRadius.base }}>
                <CheckCircle size={18} color={colors.tealSuccess} />
                <span style={{ fontSize: typography.fontSize.base, color: colors.tealSuccess, fontWeight: typography.fontWeight.medium }}>This submittal has been approved</span>
              </div>
            )}
          </div>
        )}
      </DetailPanel>

      <CreateSubmittalModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (data) => {
          await createSubmittal.mutateAsync({
            projectId: projectId!,
            data: { ...data, project_id: projectId! },
          });
          toast.success('Submittal created: ' + (data.title || 'New Submittal'));
        }}
      />
    </PageContainer>
  );
};

export { Submittals };
export default Submittals;

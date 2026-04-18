import React, { useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PageContainer, Card, Btn, StatusTag, EmptyState, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { useProjectId } from '../hooks/useProjectId';
import { useChangeOrders } from '../hooks/queries';
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

type COStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'voided';

const fmtCurrency = (n: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

const statusTone: Record<COStatus, 'pending' | 'review' | 'active' | 'closed' | 'critical'> = {
  draft: 'pending',
  pending_review: 'review',
  approved: 'active',
  rejected: 'critical',
  voided: 'closed',
};

const ChangeOrdersPage: React.FC = () => {
  const projectId = useProjectId();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { data: changeOrders = [], isPending, error, refetch } = useChangeOrders(projectId);
  const createChangeOrder = useCreateChangeOrder();
  const deleteChangeOrder = useDeleteChangeOrder();
  const submitChangeOrder = useSubmitChangeOrder();
  const approveChangeOrder = useApproveChangeOrder();
  const rejectChangeOrder = useRejectChangeOrder();

  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<COStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const totals = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let approvedAmount = 0;
    for (const co of changeOrders as unknown as Array<Record<string, unknown>>) {
      const status = co.status as COStatus;
      const amount = Number(co.amount ?? co.approved_cost ?? 0);
      if (status === 'pending_review' || status === 'draft') pending += 1;
      if (status === 'approved') {
        approved += 1;
        approvedAmount += amount;
      }
    }
    return { pending, approved, approvedAmount };
  }, [changeOrders]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (changeOrders as unknown as Array<Record<string, unknown>>).filter((co) => {
      if (statusFilter !== 'all' && co.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(co.title ?? '').toLowerCase().includes(q) ||
        String(co.co_number ?? '').toLowerCase().includes(q) ||
        String(co.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [changeOrders, statusFilter, searchQuery]);

  const handleCreate = async (data: Record<string, unknown>) => {
    if (!projectId) return;
    try {
      await createChangeOrder.mutateAsync({ projectId, data: { ...data, project_id: projectId } });
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

  const handleReject = async (coId: string) => {
    if (!projectId || !user?.id) return;
    const comments = window.prompt('Rejection reason?');
    if (!comments) return;
    try {
      await rejectChangeOrder.mutateAsync({ id: coId, projectId, userId: user.id, comments });
      toast.success('Change order rejected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject');
    }
  };

  const handleDelete = async (co: Record<string, unknown>) => {
    if (!projectId) return;
    const label = (co.title as string) || `CO ${(co.co_number as string) ?? co.id}`;
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    try {
      await deleteChangeOrder.mutateAsync({ id: String(co.id), projectId });
      toast.success('Change order deleted');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (!projectId) {
    return (
      <PageContainer title="Change Orders">
        <Card padding={spacing['6']}>
          <EmptyState icon={Plus} title="No project selected" description="Select a project to view change orders." />
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Change Orders"
      subtitle={`${totals.pending} pending · ${totals.approved} approved · ${fmtCurrency(totals.approvedAmount)} approved total`}
      actions={
        <PermissionGate permission="change_orders.create">
          <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setShowCreate(true)} data-testid="create-change-order-button">
            New Change Order
          </Btn>
        </PermissionGate>
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

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: spacing['2'], marginBottom: spacing['3'], flexWrap: 'wrap' }}>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search change orders by title, number, or description…"
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
            icon={Plus}
            title={changeOrders.length === 0 ? 'No change orders yet' : 'No change orders match your filters'}
            description={changeOrders.length === 0 ? 'Create your first change order to track scope, cost, and schedule impacts.' : 'Try clearing the search or status filter.'}
            action={changeOrders.length === 0 ? { label: 'New Change Order', onClick: () => setShowCreate(true) } : undefined}
          />
        </Card>
      ) : (
        <div role="table" aria-label="Change orders" style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          <div role="row" style={{ display: 'grid', gridTemplateColumns: '100px 2fr 120px 140px 180px 120px', gap: spacing['3'], padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <span>CO #</span>
            <span>Title</span>
            <span>Status</span>
            <span>Amount</span>
            <span>Requested</span>
            <span aria-hidden="true">Actions</span>
          </div>
          {filtered.map((co) => (
            <Card key={String(co.id)} padding={0}>
              <div role="row" style={{ display: 'grid', gridTemplateColumns: '100px 2fr 120px 140px 180px 120px', gap: spacing['3'], padding: `${spacing['3']}`, alignItems: 'center' }}>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                  {(co.co_number as string) ?? String(co.id).slice(0, 6)}
                </span>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                  {(co.title as string) || '—'}
                </span>
                <span>
                  <StatusTag
                    status={statusTone[co.status as COStatus] ?? 'pending'}
                    label={String(co.status ?? '').replace('_', ' ') || 'draft'}
                  />
                </span>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
                  {fmtCurrency(Number(co.amount ?? co.approved_cost ?? 0))}
                </span>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  {(co.requested_by as string) || '—'} · {(co.requested_date as string)?.slice(0, 10) ?? ''}
                </span>
                <span style={{ display: 'flex', gap: spacing['1'], justifyContent: 'flex-end' }}>
                  {co.status === 'draft' && (
                    <PermissionGate permission="change_orders.create">
                      <Btn size="sm" variant="secondary" onClick={() => handleSubmit(String(co.id))}>Submit</Btn>
                    </PermissionGate>
                  )}
                  {co.status === 'pending_review' && (
                    <PermissionGate permission="change_orders.approve">
                      <>
                        <Btn size="sm" variant="primary" onClick={() => handleApprove(String(co.id))}>Approve</Btn>
                        <Btn size="sm" variant="ghost" onClick={() => handleReject(String(co.id))}>Reject</Btn>
                      </>
                    </PermissionGate>
                  )}
                  <PermissionGate permission="change_orders.delete">
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
                  </PermissionGate>
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateChangeOrderModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
      />
      {addToast ? null : null}
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

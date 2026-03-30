import React, { useState } from 'react';
import { PageContainer, Card, Btn, StatusTag, PriorityTag, TableHeader, TableRow, DetailPanel, RelatedItems, Skeleton, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { useQuery } from '../hooks/useQuery';
import { getSubmittals } from '../api/endpoints/submittals';
import { Calendar, Clock, ArrowRight, CheckCircle, Paperclip, LayoutGrid, List, Sparkles, Search } from 'lucide-react';
import { useAppNavigate, getRelatedItemsForSubmittal } from '../utils/connections';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { PredictiveAlertBanner } from '../components/ai/PredictiveAlert';
import { getAnnotationsForEntity, getPredictiveAlertsForPage } from '../data/aiAnnotations';
import { KanbanBoard } from '../components/shared/KanbanBoard';
import type { KanbanColumn } from '../components/shared/KanbanBoard';
import { ApprovalChain } from '../components/shared/ApprovalChain';
import type { ApprovalStep } from '../components/shared/ApprovalChain';

const isOverdue = (dateStr: string) => new Date(dateStr) < new Date();

const columns = [
  { label: 'Submittal #', width: '100px' },
  { label: 'Title', width: '1fr' },
  { label: 'From', width: '150px' },
  { label: 'Priority', width: '90px' },
  { label: 'Status', width: '130px' },
  { label: 'Due', width: '100px' },
];

const mockDescriptions: Record<number, string> = {
  1: 'Complete set of structural steel shop drawings for floors 7 through 12, including connection details, erection sequences, and bolt patterns per specification section 05 12 00.',
  2: 'Mechanical equipment specifications for rooftop HVAC units including performance data, electrical requirements, structural loads, and maintenance access requirements.',
  3: 'Full door and hardware schedule covering 186 door openings across floors 1 through 12. Includes finish hardware groups, keying schedule, and access control integration.',
  4: 'Electrical panel specifications for main distribution and branch circuit panels. Includes single line diagrams, short circuit calculations, and arc flash labels.',
};

const reviewTimelines: Record<number, Array<{ date: string; event: string; by: string; status: 'complete' | 'active' | 'pending' }>> = {
  1: [
    { date: 'Mar 10, 2025', event: 'Submitted by contractor', by: 'Fabricator ABC Steel', status: 'complete' },
    { date: 'Mar 18, 2025', event: 'Architect review complete', by: 'Morris Architects', status: 'complete' },
    { date: 'Mar 22, 2025', event: 'Approved with no exceptions', by: 'Turner Construction', status: 'complete' },
  ],
  2: [
    { date: 'Mar 14, 2025', event: 'Submitted by contractor', by: 'HVAC Contractor', status: 'complete' },
    { date: 'Mar 21, 2025', event: 'Under architect review', by: 'Morris Architects', status: 'active' },
    { date: 'Pending', event: 'Awaiting final response', by: 'Turner Construction', status: 'pending' },
  ],
  3: [
    { date: 'Mar 8, 2025', event: 'Submitted by contractor', by: 'Hardware Supplier', status: 'complete' },
    { date: 'Mar 15, 2025', event: 'Revisions requested', by: 'Morris Architects', status: 'complete' },
    { date: 'Pending', event: 'Awaiting resubmission', by: 'Hardware Supplier', status: 'pending' },
  ],
  4: [
    { date: 'Mar 20, 2025', event: 'Submitted by contractor', by: 'Electrical Supplier', status: 'complete' },
    { date: 'Pending', event: 'Awaiting architect review', by: 'Morris Architects', status: 'pending' },
    { date: 'Pending', event: 'Awaiting final response', by: 'Turner Construction', status: 'pending' },
  ],
};


const specSections: Record<number, string> = {
  1: '05 12 00', 2: '23 05 00', 3: '08 71 00', 4: '26 24 00',
  5: '03 30 00', 6: '08 44 00', 7: '23 73 00', 8: '14 21 00',
  9: '21 13 00', 10: '26 24 13', 11: '22 40 00', 12: '07 10 00',
  13: '09 51 00', 14: '08 71 00', 15: '09 91 00', 16: '05 12 00',
};

const reviewCycles: Record<number, number> = { 3: 2, 12: 3, 16: 2 };

const leadTimes: Record<number, number> = {
  1: 6, 2: 10, 3: 4, 4: 8, 5: 3, 6: 16, 7: 12, 8: 14, 9: 6, 10: 10, 11: 4, 12: 8, 13: 3, 14: 4, 15: 2, 16: 6,
};

const Submittals: React.FC = () => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const { addToast } = useToast();
  const appNavigate = useAppNavigate();
  const { data: submittals, loading } = useQuery('submittals', getSubmittals);

  if (loading || !submittals) {
    return (
      <PageContainer title="Submittals" subtitle="Loading...">
        <Card padding="0">
          <div style={{ padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} height="40px" />
            ))}
          </div>
        </Card>
      </PageContainer>
    );
  }

  const allSubmittals = submittals || [];

  const pageAlerts = getPredictiveAlertsForPage('submittals');
  const openCount = allSubmittals.filter(s => s.status !== 'approved').length;
  const selected = allSubmittals.find(s => s.id === selectedId) || null;
  const timeline = selectedId ? reviewTimelines[selectedId] || [] : [];

  const kanbanColumns: KanbanColumn<any>[] = [
    { id: 'pending', label: 'Pending', color: colors.statusPending, items: allSubmittals.filter((s) => s.status === 'pending') },
    { id: 'under_review', label: 'Under Review', color: colors.statusInfo, items: allSubmittals.filter((s) => s.status === 'under_review') },
    { id: 'revise_resubmit', label: 'Revise & Resubmit', color: colors.statusCritical, items: allSubmittals.filter((s) => s.status === 'revise_resubmit') },
    { id: 'approved', label: 'Approved', color: colors.statusActive, items: allSubmittals.filter((s) => s.status === 'approved') },
  ];

  const approvalSteps: ApprovalStep[] = selected ? [
    { id: 1, role: 'Subcontractor', name: selected.from || 'Contractor', initials: 'SC', status: 'approved', date: 'Submitted', comment: 'Initial submission' },
    { id: 2, role: 'General Contractor', name: 'Mike Patterson', initials: 'MP', status: 'approved', date: 'Reviewed' },
    { id: 3, role: 'Architect', name: 'Jennifer Lee', initials: 'JL', status: selected.status === 'approved' ? 'approved' : selected.status === 'revise_resubmit' ? 'rejected' : 'pending', date: selected.status === 'approved' ? 'Approved' : undefined, comment: selected.status === 'revise_resubmit' ? 'Revisions required' : undefined },
    { id: 4, role: 'Owner', name: 'James Bradford', initials: 'JB', status: selected.status === 'approved' ? 'approved' : 'waiting' },
  ] : [];

  const handleApprove = () => {
    addToast('success', `${selected?.submittalNumber} approved successfully`);
    setSelectedId(null);
  };

  const handleReject = () => {
    addToast('error', `${selected?.submittalNumber} has been rejected`);
    setSelectedId(null);
  };

  const handleRequestRevision = () => {
    addToast('warning', `Revision requested for ${selected?.submittalNumber}`);
    setSelectedId(null);
  };

  const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
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
  });

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
            >
              <List size={16} />
            </button>
            <button
              style={{ ...toggleBtnStyle(viewMode === 'kanban'), borderRadius: `0 ${borderRadius.full} ${borderRadius.full} 0` }}
              onClick={() => setViewMode('kanban')}
              title="Board View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          <Btn onClick={() => addToast('info', 'Form submission requires backend configuration')}>New Submittal</Btn>
        </div>
      }
    >
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} />
      ))}

      {viewMode === 'table' ? (
        <Card padding="0">
          <TableHeader columns={columns} />
          {allSubmittals.map((sub, i) => (
            <div
              key={sub.id}
              style={{
                backgroundColor: selectedId === sub.id ? colors.surfaceSelected : 'transparent',
                transition: 'background-color 150ms ease',
              }}
            >
              <TableRow
                divider={i < allSubmittals.length - 1}
                onClick={() => setSelectedId(sub.id)}
                columns={[
                  {
                    width: '100px',
                    content: <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange }}>{sub.submittalNumber}</span>,
                  },
                  {
                    width: '1fr',
                    content: (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, lineHeight: typography.lineHeight.snug }}>
                          {sub.title}
                          {getAnnotationsForEntity('submittal', sub.id).map((ann) => (
                            <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                          ))}
                        </span>
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                          {specSections[sub.id] && <span style={{ fontFamily: 'monospace', marginRight: spacing['2'] }}>{specSections[sub.id]}</span>}
                          {leadTimes[sub.id] && (() => { const wks = leadTimes[sub.id]; const c = wks > 12 ? colors.statusCritical : wks >= 8 ? colors.statusPending : colors.statusActive; return <span style={{ color: c }}>{wks} wk lead</span>; })()}
                        </span>
                      </div>
                    ),
                  },
                  {
                    width: '150px',
                    content: <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{sub.from}</span>,
                  },
                  {
                    width: '90px',
                    content: <PriorityTag priority={sub.priority as any} />,
                  },
                  {
                    width: '130px',
                    content: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                        <StatusTag status={sub.status as any} />
                        {reviewCycles[sub.id] && <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical, backgroundColor: `${colors.statusCritical}08`, padding: '1px 5px', borderRadius: borderRadius.full }}>C{reviewCycles[sub.id]}</span>}
                      </span>
                    ),
                  },
                  {
                    width: '100px',
                    content: (
                      <span style={{ fontSize: typography.fontSize.sm, color: isOverdue(sub.dueDate) && sub.status !== 'approved' ? colors.statusCritical : colors.textTertiary, fontVariantNumeric: 'tabular-nums' as const }}>
                        {new Date(sub.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          ))}
          {allSubmittals.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
              <Search size={32} color="#A09890" style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', fontWeight: 500, color: '#1A1613', margin: 0, marginBottom: '4px' }}>No items match your filters</p>
              <p style={{ fontSize: '13px', color: '#6B6560', margin: 0, marginBottom: '16px' }}>Try adjusting your search or filter criteria</p>
              <button onClick={() => window.location.reload()} style={{ padding: '6px 16px', backgroundColor: 'transparent', border: '1px solid #E5E1DC', borderRadius: '6px', fontSize: '13px', fontFamily: '"Inter", sans-serif', color: '#6B6560', cursor: 'pointer' }}>
                Clear Filters
              </button>
            </div>
          )}
        </Card>
      ) : (
        <KanbanBoard
          columns={kanbanColumns}
          getKey={(sub: any) => sub.id}
          renderCard={(sub: any) => (
            <div
              style={{ padding: spacing.md }}
              onClick={() => setSelectedId(sub.id)}
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
                    color: isOverdue(sub.dueDate) && sub.status !== 'approved' ? colors.red : colors.textTertiary,
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

      <DetailPanel
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.submittalNumber || ''}
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
            {/* Title and meta */}
            <div>
              <h3 style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing.md }}>
                {selected.title}
              </h3>
              <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
                <PriorityTag priority={selected.priority as any} />
                <StatusTag status={selected.status as any} />
              </div>
            </div>

            {/* Details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
              <div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.5px' }}>From</div>
                <div style={{ fontSize: typography.fontSize.base, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{selected.from}</div>
              </div>
              <div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Due Date</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                  <Calendar size={14} color={isOverdue(selected.dueDate) && selected.status !== 'approved' ? colors.red : colors.textSecondary} />
                  <span style={{
                    fontSize: typography.fontSize.base,
                    color: isOverdue(selected.dueDate) && selected.status !== 'approved' ? colors.red : colors.textPrimary,
                    fontWeight: typography.fontWeight.medium,
                  }}>
                    {new Date(selected.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</div>
              <p style={{ fontSize: typography.fontSize.base, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed, margin: 0 }}>
                {mockDescriptions[selected.id] || 'No description provided.'}
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
                <Btn variant="primary" onClick={handleApprove} icon={<CheckCircle size={16} />}>Approve</Btn>
                <Btn variant="danger" onClick={handleReject}>Reject</Btn>
                <Btn variant="secondary" onClick={handleRequestRevision} icon={<ArrowRight size={16} />}>Request Revision</Btn>
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
    </PageContainer>
  );
};

export { Submittals };
export default Submittals;

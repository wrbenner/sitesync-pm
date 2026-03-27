import React, { useState, useEffect } from 'react';
import { PageContainer, Card, Btn, StatusTag, PriorityTag, TableHeader, TableRow, DetailPanel, Avatar, Tag, RelatedItems, Skeleton, useToast } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { Plus, Clock, Paperclip, Calendar, Send, Sparkles, LayoutGrid, List, Search } from 'lucide-react';
import { useAppNavigate, getRelatedItemsForRfi } from '../utils/connections';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { PredictiveAlertBanner } from '../components/ai/PredictiveAlert';
import { getAnnotationsForEntity, getPredictiveAlertsForPage } from '../data/aiAnnotations';
import { KanbanBoard } from '../components/shared/KanbanBoard';
import type { KanbanColumn } from '../components/shared/KanbanBoard';
import { useRfiStore } from '../stores/rfiStore';
import { useProjectContext } from '../stores/projectContextStore';
import { useAuthStore } from '../stores/authStore';
import { CreateRFIForm } from '../components/forms/CreateRFIForm';
import type { RFI } from '../types/database';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  responded: 'Responded',
  closed: 'Closed',
};

const isOverdue = (dateStr: string | null) => dateStr ? new Date(dateStr) < new Date() : false;

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const columns = [
  { label: 'RFI #', width: '90px' },
  { label: 'Title', width: '1fr' },
  { label: 'Priority', width: '90px' },
  { label: 'Status', width: '120px' },
  { label: 'Days', width: '70px' },
  { label: 'Due', width: '100px' },
];

const RFIs: React.FC = () => {
  const { rfis, loading, loadRfis, responses, loadResponses, addResponse, updateRfiStatus } = useRfiStore();
  const { activeProject } = useProjectContext();
  const { profile } = useAuthStore();
  const [selectedRfi, setSelectedRfi] = useState<RFI | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [responseText, setResponseText] = useState('');
  const perPage = 10;
  const { addToast } = useToast();
  const appNavigate = useAppNavigate();

  const pageAlerts = getPredictiveAlertsForPage('rfis');

  useEffect(() => {
    if (activeProject?.id) {
      loadRfis(activeProject.id);
    }
  }, [activeProject?.id]);

  // Load responses when selecting an RFI
  useEffect(() => {
    if (selectedRfi) {
      loadResponses(selectedRfi.id);
    }
  }, [selectedRfi?.id]);

  if (loading || !activeProject) {
    return (
      <PageContainer title="RFIs" subtitle="Loading...">
        <Card padding="0">
          <div style={{ padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} height="44px" />
            ))}
          </div>
        </Card>
      </PageContainer>
    );
  }

  const filteredRfis = searchTerm
    ? rfis.filter((r) => r.title.toLowerCase().includes(searchTerm.toLowerCase()) || `RFI-${String(r.rfi_number).padStart(3, '0')}`.toLowerCase().includes(searchTerm.toLowerCase()))
    : rfis;

  const sortedRfis = [...filteredRfis].sort((a, b) => b.rfi_number - a.rfi_number);
  const totalPages = Math.ceil(sortedRfis.length / perPage);
  const paginatedRfis = sortedRfis.slice((page - 1) * perPage, page * perPage);

  const openCount = rfis.filter((r) => r.status !== 'closed' && r.status !== 'responded').length;
  const overdueCount = rfis.filter((r) => r.status !== 'closed' && r.status !== 'responded' && isOverdue(r.due_date)).length;

  const rfiLabel = (rfi: RFI) => `RFI-${String(rfi.rfi_number).padStart(3, '0')}`;

  const kanbanColumns: KanbanColumn<RFI>[] = [
    { id: 'draft', label: 'Draft', color: colors.textTertiary, items: sortedRfis.filter((r) => r.status === 'draft') },
    { id: 'submitted', label: 'Submitted', color: colors.statusPending, items: sortedRfis.filter((r) => r.status === 'submitted') },
    { id: 'under_review', label: 'Under Review', color: colors.statusInfo, items: sortedRfis.filter((r) => r.status === 'under_review') },
    { id: 'responded', label: 'Responded', color: colors.statusActive, items: sortedRfis.filter((r) => r.status === 'responded') },
    { id: 'closed', label: 'Closed', color: colors.statusNeutral, items: sortedRfis.filter((r) => r.status === 'closed') },
  ];

  const handleSubmitResponse = async () => {
    if (!selectedRfi || !responseText.trim() || !profile) return;
    const { error } = await addResponse(selectedRfi.id, profile.id, responseText.trim());
    if (error) {
      addToast('error', error);
    } else {
      addToast('success', 'Response submitted');
      setResponseText('');
      // Refresh the selected RFI from store
      const updated = useRfiStore.getState().rfis.find((r) => r.id === selectedRfi.id);
      if (updated) setSelectedRfi(updated);
    }
  };

  const handleStatusChange = async (rfiId: string, status: string) => {
    const { error } = await updateRfiStatus(rfiId, status as any);
    if (error) {
      addToast('error', error);
    } else {
      addToast('success', `Status updated to ${STATUS_LABELS[status] ?? status}`);
      const updated = useRfiStore.getState().rfis.find((r) => r.id === rfiId);
      if (updated) setSelectedRfi(updated);
    }
  };

  const currentResponses = selectedRfi ? (responses[selectedRfi.id] ?? []) : [];

  return (
    <PageContainer
      title="RFIs"
      subtitle={`${openCount} open \u00b7 ${overdueCount} overdue`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: colors.textTertiary }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              placeholder="Search RFIs..."
              style={{
                padding: `6px 12px 6px 32px`,
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.full,
                fontSize: typography.fontSize.sm,
                color: colors.textPrimary,
                backgroundColor: colors.surfaceRaised,
                outline: 'none',
                width: '180px',
                fontFamily: typography.fontFamily,
              }}
            />
          </div>
          {/* View toggle */}
          <div style={{ display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, padding: 2 }}>
            <button onClick={() => setViewMode('table')} style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', border: 'none', borderRadius: borderRadius.full, backgroundColor: viewMode === 'table' ? colors.surfaceRaised : 'transparent', color: viewMode === 'table' ? colors.textPrimary : colors.textTertiary, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily, cursor: 'pointer', boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              <List size={14} style={{ marginRight: 4 }} /> Table
            </button>
            <button onClick={() => setViewMode('kanban')} style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', border: 'none', borderRadius: borderRadius.full, backgroundColor: viewMode === 'kanban' ? colors.surfaceRaised : 'transparent', color: viewMode === 'kanban' ? colors.textPrimary : colors.textTertiary, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily, cursor: 'pointer', boxShadow: viewMode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              <LayoutGrid size={14} style={{ marginRight: 4 }} /> Kanban
            </button>
          </div>
          <Btn onClick={() => setShowCreate(true)}>
            <Plus size={16} style={{ marginRight: spacing.xs }} />
            New RFI
          </Btn>
        </div>
      }
    >
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} />
      ))}

      {viewMode === 'table' ? (
        <Card padding="0">
          <TableHeader columns={columns} />
          {paginatedRfis.map((rfi, i) => {
            const days = Math.ceil((Date.now() - new Date(rfi.created_at).getTime()) / (1000 * 60 * 60 * 24));
            const dColor = days > 10 ? colors.statusCritical : days > 5 ? colors.statusPending : colors.statusActive;
            const annotations = getAnnotationsForEntity('rfi', rfi.rfi_number);

            return (
              <TableRow
                key={rfi.id}
                divider={i < paginatedRfis.length - 1}
                onClick={() => setSelectedRfi(rfi)}
                selected={selectedRfi?.id === rfi.id}
                columns={[
                  {
                    width: '90px',
                    content: (
                      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange }}>{rfiLabel(rfi)}</span>
                    ),
                  },
                  {
                    width: '1fr',
                    content: (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, lineHeight: typography.lineHeight.snug }}>
                          {rfi.title}
                          {annotations.length > 0 && (
                            <span title={annotations[0]?.insight || ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: spacing['2'], padding: '1px 5px', backgroundColor: `${colors.statusReview}10`, borderRadius: borderRadius.full, verticalAlign: 'middle' }}>
                              <Sparkles size={10} color={colors.statusReview} />
                            </span>
                          )}
                        </span>
                        {rfi.description && (
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>
                            {rfi.description}
                          </span>
                        )}
                      </div>
                    ),
                  },
                  {
                    width: '90px',
                    content: <PriorityTag priority={rfi.priority as any} />,
                  },
                  {
                    width: '120px',
                    content: <StatusTag status={rfi.status as any} label={STATUS_LABELS[rfi.status]} />,
                  },
                  {
                    width: '70px',
                    content: <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: dColor, fontVariantNumeric: 'tabular-nums' }}>{days}d</span>,
                  },
                  {
                    width: '100px',
                    content: (
                      <span style={{ fontSize: typography.fontSize.sm, color: isOverdue(rfi.due_date) && rfi.status !== 'closed' && rfi.status !== 'responded' ? colors.statusCritical : colors.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
                        {rfi.due_date ? formatDate(rfi.due_date) : '\u2014'}
                      </span>
                    ),
                  },
                ]}
              />
            );
          })}
          {paginatedRfis.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
              <Search size={32} color="#A09890" style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', fontWeight: 500, color: '#1A1613', margin: 0, marginBottom: '4px' }}>No RFIs found</p>
              <p style={{ fontSize: '13px', color: '#6B6560', margin: 0, marginBottom: '16px' }}>
                {searchTerm ? 'Try adjusting your search criteria' : 'Create your first RFI to get started'}
              </p>
              {!searchTerm && (
                <button onClick={() => setShowCreate(true)} style={{ padding: '6px 16px', backgroundColor: colors.primaryOrange, border: 'none', borderRadius: '6px', fontSize: '13px', fontFamily: typography.fontFamily, color: '#fff', cursor: 'pointer' }}>
                  Create RFI
                </button>
              )}
            </div>
          )}
          {sortedRfis.length > perPage && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing.md} ${spacing.xl}`, borderTop: `1px solid ${colors.borderLight}` }}>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, sortedRfis.length)} of {sortedRfis.length}
              </span>
              <div style={{ display: 'flex', gap: spacing['1'] }}>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: `${spacing['1']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.sm, backgroundColor: 'transparent', cursor: page > 1 ? 'pointer' : 'default', color: page > 1 ? colors.textPrimary : colors.textTertiary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily }}>Prev</button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: `${spacing['1']} ${spacing['3']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.sm, backgroundColor: 'transparent', cursor: page < totalPages ? 'pointer' : 'default', color: page < totalPages ? colors.textPrimary : colors.textTertiary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily }}>Next</button>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <KanbanBoard
          columns={kanbanColumns}
          getKey={(rfi) => rfi.id}
          renderCard={(rfi) => (
            <div style={{ padding: spacing['3'] }} onClick={() => setSelectedRfi(rfi)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange }}>{rfiLabel(rfi)}</span>
                <PriorityTag priority={rfi.priority as any} />
              </div>
              <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0, marginBottom: spacing['2'] }}>{rfi.title}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  {Math.ceil((Date.now() - new Date(rfi.created_at).getTime()) / (1000 * 60 * 60 * 24))}d open
                </span>
                <span style={{ fontSize: typography.fontSize.caption, color: isOverdue(rfi.due_date) && rfi.status !== 'closed' ? colors.statusCritical : colors.textTertiary }}>
                  {rfi.due_date ? formatDate(rfi.due_date) : ''}
                </span>
              </div>
              {getAnnotationsForEntity('rfi', rfi.rfi_number).map((ann) => (
                <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
              ))}
            </div>
          )}
        />
      )}

      {/* Detail Panel */}
      <DetailPanel
        open={!!selectedRfi}
        onClose={() => { setSelectedRfi(null); setResponseText(''); }}
        title={selectedRfi ? rfiLabel(selectedRfi) : ''}
        width="560px"
      >
        {selectedRfi && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
            {/* Title */}
            <div>
              <h3 style={{ margin: 0, fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, lineHeight: typography.lineHeight.tight }}>
                {selectedRfi.title}
              </h3>
            </div>

            {/* Meta Grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg,
              padding: spacing.lg, backgroundColor: colors.surfaceFlat, borderRadius: borderRadius.md,
            }}>
              <div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: typography.fontWeight.medium }}>Priority</div>
                <PriorityTag priority={selectedRfi.priority as any} />
              </div>
              <div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: typography.fontWeight.medium }}>Status</div>
                <StatusTag status={selectedRfi.status as any} label={STATUS_LABELS[selectedRfi.status]} />
              </div>
              <div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: typography.fontWeight.medium }}>Due Date</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                  <Calendar size={14} style={{ color: colors.textTertiary }} />
                  <span style={{
                    color: isOverdue(selectedRfi.due_date) && selectedRfi.status !== 'closed' ? colors.red : colors.textPrimary,
                    fontWeight: isOverdue(selectedRfi.due_date) && selectedRfi.status !== 'closed' ? typography.fontWeight.medium : typography.fontWeight.normal,
                    fontSize: typography.fontSize.base,
                  }}>
                    {selectedRfi.due_date ? formatDate(selectedRfi.due_date) : 'Not set'}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: typography.fontWeight.medium }}>Created</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                  <Clock size={14} style={{ color: colors.textTertiary }} />
                  <span style={{ fontSize: typography.fontSize.base }}>{formatDate(selectedRfi.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            {selectedRfi.description && (
              <div>
                <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Description
                </div>
                <p style={{ margin: 0, fontSize: typography.fontSize.base, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed }}>
                  {selectedRfi.description}
                </p>
              </div>
            )}

            {/* Responses */}
            {currentResponses.length > 0 && (
              <div>
                <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.lg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Responses ({currentResponses.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {currentResponses.map((resp, idx) => (
                    <div key={resp.id} style={{ display: 'flex', gap: spacing.md, position: 'relative' }}>
                      {idx < currentResponses.length - 1 && (
                        <div style={{ position: 'absolute', left: '17px', top: '40px', bottom: '-4px', width: '2px', backgroundColor: colors.borderLight }} />
                      )}
                      <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                        <Avatar initials={resp.user_id.substring(0, 2).toUpperCase()} size={36} />
                      </div>
                      <div style={{ flex: 1, paddingBottom: idx < currentResponses.length - 1 ? spacing.xl : '0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                          <span style={{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                            Response
                          </span>
                          <Tag label="Response" color={colors.tealSuccess} backgroundColor="rgba(78,200,150,0.1)" />
                        </div>
                        <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.sm }}>
                          {formatDate(resp.created_at)}
                        </div>
                        <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed }}>
                          {resp.response_text}
                        </p>
                        {resp.attachments && resp.attachments.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
                            <Paperclip size={12} color={colors.textTertiary} />
                            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{resp.attachments.length} attachment{resp.attachments.length !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Workflow Actions */}
            {selectedRfi.status !== 'closed' && (
              <div>
                <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Add Response
                </div>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Type your response..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: spacing['3'],
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm,
                    color: colors.textPrimary,
                    fontFamily: typography.fontFamily,
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: spacing.md, paddingTop: spacing.md, borderTop: `1px solid ${colors.borderLight}`, flexWrap: 'wrap' }}>
              {responseText.trim() && (
                <div style={{ flex: 1 }}>
                  <Btn
                    fullWidth
                    icon={<Send size={15} />}
                    onClick={handleSubmitResponse}
                  >
                    Submit Response
                  </Btn>
                </div>
              )}
              {selectedRfi.status === 'draft' && (
                <div style={{ flex: 1 }}>
                  <Btn fullWidth onClick={() => handleStatusChange(selectedRfi.id, 'submitted')}>
                    Submit RFI
                  </Btn>
                </div>
              )}
              {selectedRfi.status === 'submitted' && (
                <div style={{ flex: 1 }}>
                  <Btn fullWidth variant="secondary" onClick={() => handleStatusChange(selectedRfi.id, 'under_review')}>
                    Begin Review
                  </Btn>
                </div>
              )}
              {(selectedRfi.status === 'responded' || selectedRfi.status === 'under_review') && (
                <div style={{ flex: 1 }}>
                  <Btn fullWidth variant="secondary" onClick={() => handleStatusChange(selectedRfi.id, 'closed')}>
                    Close RFI
                  </Btn>
                </div>
              )}
            </div>

            {/* Related Items */}
            <RelatedItems items={getRelatedItemsForRfi(selectedRfi.rfi_number)} onNavigate={appNavigate} />
          </div>
        )}
      </DetailPanel>

      {/* Create Form Modal */}
      <CreateRFIForm
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => addToast('success', 'RFI created successfully')}
      />
    </PageContainer>
  );
};

export { RFIs };
export default RFIs;

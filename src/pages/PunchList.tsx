import React, { useState, useMemo, useEffect } from 'react';
import { PageContainer, Card, Btn, StatusTag, PriorityTag, TableHeader, TableRow, DetailPanel, Avatar, RelatedItems, useToast, Skeleton } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { usePunchListStore } from '../stores/punchListStore';
import { useProjectContext } from '../stores/projectContextStore';
import { Camera, CheckCircle, Inbox, MessageSquare, Sparkles } from 'lucide-react';
import { useAppNavigate, getRelatedItemsForPunchItem } from '../utils/connections';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { PredictiveAlertBanner } from '../components/ai/PredictiveAlert';
import { getAnnotationsForEntity, getPredictiveAlertsForPage } from '../data/aiAnnotations';

const statusMap: Record<string, 'pending' | 'active' | 'complete'> = {
  open: 'pending',
  in_progress: 'active',
  complete: 'complete',
  verified: 'complete',
};

const statusLabel: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  complete: 'Complete',
  verified: 'Verified',
};

const columns = [
  { label: 'Item', width: '80px' },
  { label: 'Description', width: '1fr' },
  { label: 'Area', width: '140px' },
  { label: 'Assigned', width: '120px' },
  { label: 'Priority', width: '90px' },
  { label: 'Status', width: '100px' },
  { label: 'Due', width: '90px' },
];

const responsibleColors: Record<string, { bg: string; text: string }> = {
  subcontractor: { bg: 'rgba(58, 123, 200, 0.10)', text: colors.statusInfo },
  gc: { bg: 'rgba(244, 120, 32, 0.10)', text: colors.primaryOrange },
  owner: { bg: 'rgba(124, 93, 199, 0.10)', text: colors.statusReview },
};

const responsibleLabel: Record<string, string> = {
  subcontractor: 'Subcontractor',
  gc: 'General Contractor',
  owner: 'Owner',
};

interface PunchItem {
  id: string;
  itemNumber: string;
  area: string;
  description: string;
  assigned: string;
  priority: string;
  status: string;
  hasPhoto: boolean;
  photoCount?: number;
  dueDate: string;
  createdDate: string;
  reportedBy: string;
  responsible: string;
}


function getDueDateColor(dueDate: string): string {
  const now = new Date();
  const due = new Date(dueDate);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return colors.statusCritical;
  if (diffDays <= 4) return colors.statusPending;
  return colors.statusActive;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}/${day}`;
}

const PunchListPage: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [atRiskFilter, setAtRiskFilter] = useState(false);
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const { addToast } = useToast();
  const appNavigate = useAppNavigate();
  const { items: storeItems, loading, loadItems, updateItemStatus, getComments } = usePunchListStore();
  const { activeProject } = useProjectContext();

  useEffect(() => {
    if (activeProject?.id) {
      loadItems(activeProject.id);
    }
  }, [activeProject?.id, loadItems]);

  const pageAlerts = getPredictiveAlertsForPage('punchlist');

  // Map store items to the PunchItem interface expected by the UI
  const expandedPunchList: PunchItem[] = useMemo(() => {
    return storeItems.map((item) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      id: item.id as any,
      itemNumber: `PL-${String(item.item_number).padStart(3, '0')}`,
      area: item.area,
      description: item.description,
      assigned: item.assigned_to || 'Unassigned',
      priority: item.priority,
      status: item.status,
      hasPhoto: (item.photos?.length || 0) > 0,
      photoCount: item.photos?.length || 0,
      dueDate: item.due_date || '2026-04-30',
      createdDate: item.created_at.split('T')[0],
      reportedBy: 'Project Team',
      responsible: 'subcontractor',
    }));
  }, [storeItems]);

  // Counts
  const openCount = expandedPunchList.filter(p => p.status === 'open').length;
  const inProgressCount = expandedPunchList.filter(p => p.status === 'in_progress').length;
  const completeCount = expandedPunchList.filter(p => p.status === 'complete').length;
  const verifiedCount = expandedPunchList.filter(p => p.status === 'verified').length;
  const totalCount = expandedPunchList.length;
  const completionPct = totalCount > 0 ? Math.round(((completeCount + verifiedCount) / totalCount) * 100) : 0;

  // Priority counts
  const criticalCount = expandedPunchList.filter(p => p.priority === 'critical').length;
  const highCount = expandedPunchList.filter(p => p.priority === 'high').length;
  const mediumCount = expandedPunchList.filter(p => p.priority === 'medium').length;
  const lowCount = expandedPunchList.filter(p => p.priority === 'low').length;

  // Areas for filter
  const uniqueAreas = useMemo(() => {
    const areas = expandedPunchList.map(p => {
      const parts = p.area.split(',');
      return parts[0].trim();
    });
    return ['all', ...Array.from(new Set(areas)).sort()];
  }, [expandedPunchList]);

  // Filter logic
  const filteredList = useMemo(() => {
    let list = expandedPunchList;
    if (atRiskFilter) {
      list = list.filter(p => p.status === 'open' && (p.priority === 'high' || p.priority === 'critical'));
    }
    if (areaFilter !== 'all') {
      list = list.filter(p => p.area.startsWith(areaFilter));
    }
    return list;
  }, [expandedPunchList, atRiskFilter, areaFilter]);

  const selected = expandedPunchList.find(p => p.id === selectedId) || null;
  const storeComments = selectedId ? getComments(selectedId) : [];
  const comments = storeComments.map((c) => ({
    author: c.author,
    initials: c.initials,
    time: new Date(c.created_at).toLocaleString(),
    text: c.text,
  }));

  const handleMarkComplete = () => {
    if (selectedId) {
      updateItemStatus(selectedId, 'complete');
    }
    addToast('success', `${selected?.itemNumber} marked as complete`);
    setSelectedId(null);
  };

  const handleAddPhoto = () => {
    addToast('info', 'Photo capture coming soon');
  };

  // SVG donut
  const donutRadius = 36;
  const donutStroke = 7;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const donutOffset = donutCircumference - (completionPct / 100) * donutCircumference;

  return (
    <PageContainer
      title="Punch List"
      subtitle={`${openCount} open \u00b7 ${inProgressCount} in progress \u00b7 ${completeCount} complete \u00b7 ${verifiedCount} verified`}
      actions={<Btn onClick={() => addToast('info', 'New punch list item form coming soon')}>New Item</Btn>}
    >
      {/* Predictive Alert Banners */}
      {pageAlerts.map((alert) => (
        <PredictiveAlertBanner key={alert.id} alert={alert} />
      ))}

      {/* AI Insight Banner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], padding: `${spacing['3']} ${spacing['4']}`, marginBottom: spacing['4'], backgroundColor: `${colors.statusReview}06`, borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusReview}` }}>
        <Sparkles size={14} color={colors.statusReview} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>AI Analysis: 2 punch items trending overdue based on current response times. Completion rate at {completionPct}%. Floor 8 has the highest concentration of open items.</p>
          <button onClick={() => setAtRiskFilter(true)} style={{ marginTop: spacing['2'], padding: `${spacing['1']} ${spacing['3']}`, backgroundColor: colors.statusReview, color: 'white', border: 'none', borderRadius: borderRadius.base, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, fontFamily: typography.fontFamily, cursor: 'pointer' }}>View At Risk Items</button>
        </div>
      </div>

      {/* Fix 15: Completion Visualization */}
      <div style={{ display: 'flex', gap: spacing['4'], marginBottom: spacing['4'], flexWrap: 'wrap' }}>
        {/* Donut chart */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'], minWidth: '200px' }}><Card padding={spacing['4']}>
          <div style={{ position: 'relative', width: 86, height: 86, flexShrink: 0 }}>
            <svg width="86" height="86" viewBox="0 0 86 86">
              <circle cx="43" cy="43" r={donutRadius} fill="none" stroke={colors.borderSubtle} strokeWidth={donutStroke} />
              <circle
                cx="43" cy="43" r={donutRadius} fill="none"
                stroke={colors.statusActive}
                strokeWidth={donutStroke}
                strokeDasharray={donutCircumference}
                strokeDashoffset={donutOffset}
                strokeLinecap="round"
                transform="rotate(-90 43 43)"
              />
            </svg>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{completionPct}%</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Completion</div>
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>{completeCount + verifiedCount} of {totalCount} items done</div>
          </div>
        </Card></div>

        {/* Metric cards for statuses */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], minWidth: '100px' }}><Card padding={spacing['4']}>
          <div>
            <div style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.statusPending }}>{openCount}</div>
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Open</div>
          </div>
        </Card></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], minWidth: '100px' }}><Card padding={spacing['4']}>
          <div>
            <div style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.statusInfo }}>{inProgressCount}</div>
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>In Progress</div>
          </div>
        </Card></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], minWidth: '100px' }}><Card padding={spacing['4']}>
          <div>
            <div style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.statusActive }}>{completeCount}</div>
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Complete</div>
          </div>
        </Card></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], minWidth: '100px' }}><Card padding={spacing['4']}>
          <div>
            <div style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.statusActive }}>{verifiedCount}</div>
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>Verified</div>
          </div>
        </Card></div>

        {/* By Priority breakdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'], minWidth: '220px' }}><Card padding={spacing['4']}>
          <div>
            <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing['2'] }}>By Priority</div>
            <div style={{ display: 'flex', gap: spacing['3'] }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical }}>{criticalCount}</div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Critical</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.statusPending }}>{highCount}</div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>High</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.statusInfo }}>{mediumCount}</div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Medium</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary }}>{lowCount}</div>
                <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Low</div>
              </div>
            </div>
          </div>
        </Card></div>
      </div>

      {/* Area/Floor Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['3'] }}>
        <label style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>Filter by Area:</label>
        <select
          value={areaFilter}
          onChange={(e) => { setAreaFilter(e.target.value); setAtRiskFilter(false); }}
          style={{
            padding: `${spacing['1']} ${spacing['3']}`,
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.base,
            backgroundColor: colors.white,
            color: colors.textPrimary,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {uniqueAreas.map(area => (
            <option key={area} value={area}>{area === 'all' ? 'All Areas' : area}</option>
          ))}
        </select>
        {atRiskFilter && (
          <button
            onClick={() => setAtRiskFilter(false)}
            style={{
              padding: `${spacing['1']} ${spacing['3']}`,
              fontSize: typography.fontSize.caption,
              fontFamily: typography.fontFamily,
              fontWeight: typography.fontWeight.medium,
              backgroundColor: colors.statusCriticalSubtle,
              color: colors.statusCritical,
              border: `1px solid ${colors.statusCritical}`,
              borderRadius: borderRadius.full,
              cursor: 'pointer',
            }}
          >
            Showing At Risk Items \u00d7
          </button>
        )}
      </div>

      <Card padding="0">
        <TableHeader columns={columns} />
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ padding: spacing.md, display: 'flex', gap: spacing.md }}>
              <Skeleton width="80px" height="16px" />
              <Skeleton width="140px" height="16px" />
              <Skeleton width="60%" height="16px" />
              <Skeleton width="120px" height="16px" />
              <Skeleton width="80px" height="16px" />
              <Skeleton width="100px" height="16px" />
            </div>
          ))
        ) : filteredList.map((item, i) => (
          <div
            key={item.id}
            style={{
              backgroundColor: selectedId === item.id ? colors.surfaceSelected : 'transparent',
              transition: 'background-color 150ms ease',
            }}
          >
            <TableRow
              divider={i < filteredList.length - 1}
              onClick={() => setSelectedId(item.id)}
              columns={[
                {
                  width: '80px',
                  content: <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange }}>{item.itemNumber}</span>,
                },
                {
                  width: '1fr',
                  content: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, lineHeight: typography.lineHeight.snug, display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                        {item.description}
                        {item.hasPhoto && <Camera size={11} color={colors.textTertiary} />}
                        {getAnnotationsForEntity('punch_item', item.id).map((ann) => (
                          <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                        ))}
                      </span>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                        {item.reportedBy && <span>{item.reportedBy}</span>}
                        {item.createdDate && <span> · {formatDate(item.createdDate)}</span>}
                      </span>
                    </div>
                  ),
                },
                {
                  width: '140px',
                  content: <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{item.area}</span>,
                },
                {
                  width: '120px',
                  content: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{item.assigned}</span>
                      <span style={{
                        fontSize: '10px', fontWeight: typography.fontWeight.medium,
                        color: responsibleColors[item.responsible]?.text || colors.textTertiary,
                      }}>
                        {responsibleLabel[item.responsible] || ''}
                      </span>
                    </div>
                  ),
                },
                {
                  width: '90px',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content: <PriorityTag priority={item.priority as any} />,
                },
                {
                  width: '100px',
                  content: <StatusTag status={statusMap[item.status]} label={statusLabel[item.status]} />,
                },
                {
                  width: '90px',
                  content: (
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: getDueDateColor(item.dueDate), fontVariantNumeric: 'tabular-nums' as const }}>
                      {formatDate(item.dueDate)}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        ))}
        {filteredList.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
            <Inbox size={32} color="#A09890" style={{ marginBottom: '12px' }} />
            <p style={{ fontSize: '14px', fontWeight: 500, color: '#1A1613', margin: 0, marginBottom: '4px' }}>No items match your filters</p>
            <p style={{ fontSize: '13px', color: '#6B6560', margin: 0, marginBottom: '16px' }}>Try adjusting your search or filter criteria</p>
            <button onClick={() => { setAreaFilter('all'); setAtRiskFilter(false); }} style={{ padding: '6px 16px', backgroundColor: 'transparent', border: '1px solid #E5E1DC', borderRadius: '6px', fontSize: '13px', fontFamily: '"Inter", sans-serif', color: '#6B6560', cursor: 'pointer' }}>
              Clear Filters
            </button>
          </div>
        )}
      </Card>

      <DetailPanel
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.itemNumber || ''}
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
            {/* Title and status */}
            <div>
              <h3 style={{ fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0, marginBottom: spacing.md }}>
                {selected.description}
              </h3>
              <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <PriorityTag priority={selected.priority as any} />
                <StatusTag status={statusMap[selected.status]} label={statusLabel[selected.status]} />
              </div>
            </div>

            {/* Details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
              <div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Area / Location</div>
                <div style={{ fontSize: typography.fontSize.base, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{selected.area}</div>
              </div>
              <div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assigned To</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  <Avatar initials={selected.assigned.split(' ').map(n => n[0]).join('')} size={28} />
                  <span style={{ fontSize: typography.fontSize.base, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{selected.assigned}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Due Date</div>
                <div style={{ fontSize: typography.fontSize.base, color: getDueDateColor(selected.dueDate), fontWeight: typography.fontWeight.medium }}>{selected.dueDate}</div>
              </div>
              <div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reported By</div>
                <div style={{ fontSize: typography.fontSize.base, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{selected.reportedBy}</div>
              </div>
              <div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Responsible Party</div>
                <span style={{
                  display: 'inline-block',
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.medium,
                  padding: `2px ${spacing['2']}`,
                  borderRadius: borderRadius.full,
                  backgroundColor: responsibleColors[selected.responsible]?.bg || colors.surfaceInset,
                  color: responsibleColors[selected.responsible]?.text || colors.textSecondary,
                }}>
                  {responsibleLabel[selected.responsible] || selected.responsible}
                </span>
              </div>
              <div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Created</div>
                <div style={{ fontSize: typography.fontSize.base, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{selected.createdDate}</div>
              </div>
            </div>

            {/* Photo placeholder */}
            <div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Site Photo</div>
              {selected.hasPhoto ? (
                <div style={{
                  width: '100%',
                  height: '180px',
                  backgroundColor: colors.surfaceInset,
                  borderRadius: borderRadius.base,
                  border: `2px dashed ${colors.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                }}>
                  <Camera size={32} color={colors.textTertiary} />
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Photo captured on site</span>
                  <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>IMG_2847.jpg</span>
                </div>
              ) : (
                <div style={{
                  width: '100%',
                  height: '180px',
                  backgroundColor: colors.surfaceFlat,
                  borderRadius: borderRadius.base,
                  border: `2px dashed ${colors.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  cursor: 'pointer',
                }} onClick={handleAddPhoto}>
                  <Camera size={32} color={colors.textTertiary} />
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>No photo yet. Tap to capture.</span>
                </div>
              )}
            </div>

            {/* Comments */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
                <MessageSquare size={16} color={colors.textTertiary} />
                <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Comments ({comments.length})
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                {comments.map((comment, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: spacing.md }}>
                    <Avatar initials={comment.initials} size={32} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.xs }}>
                        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                          {comment.author}
                        </span>
                        <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>
                          {comment.time}
                        </span>
                      </div>
                      <p style={{ fontSize: typography.fontSize.base, color: colors.textSecondary, lineHeight: typography.lineHeight.relaxed, margin: 0 }}>
                        {comment.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Related Items */}
            <RelatedItems items={getRelatedItemsForPunchItem(parseInt(selected.id.replace(/\D/g, '')) || 0)} onNavigate={appNavigate} />

            {/* Actions */}
            <div style={{ display: 'flex', gap: spacing.sm, paddingTop: spacing.md, borderTop: `1px solid ${colors.borderLight}` }}>
              {selected.status !== 'complete' && selected.status !== 'verified' ? (
                <>
                  <Btn variant="primary" onClick={handleMarkComplete} icon={<CheckCircle size={16} />}>Mark Complete</Btn>
                  <Btn variant="secondary" onClick={handleAddPhoto} icon={<Camera size={16} />}>Add Photo</Btn>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: 'rgba(78, 200, 150, 0.08)', borderRadius: borderRadius.base, width: '100%' }}>
                  <CheckCircle size={18} color={colors.tealSuccess} />
                  <span style={{ fontSize: typography.fontSize.base, color: colors.tealSuccess, fontWeight: typography.fontWeight.medium }}>
                    {selected.status === 'verified' ? 'This item has been verified' : 'This item has been completed'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </DetailPanel>
    </PageContainer>
  );
};

export { PunchListPage as PunchList };
export default PunchListPage;

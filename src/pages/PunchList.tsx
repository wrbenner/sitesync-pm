import React, { useState, useMemo } from 'react';
import { PageContainer, Card, Btn, StatusTag, PriorityTag, TableHeader, TableRow, DetailPanel, Avatar, RelatedItems, useToast, Skeleton } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { getPunchList } from '../api/endpoints/field';
import { useQuery } from '../hooks/useQuery';
import { Camera, CheckCircle, Inbox, MessageSquare, Sparkles } from 'lucide-react';
import { useAppNavigate, getRelatedItemsForPunchItem } from '../utils/connections';
import { AIAnnotationIndicator } from '../components/ai/AIAnnotation';
import { PredictiveAlertBanner } from '../components/ai/PredictiveAlert';
import { getAnnotationsForEntity, getPredictiveAlertsForPage } from '../data/aiAnnotations';
import type { Priority } from '../types/database';

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
  id: number;
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

interface MockComment {
  author: string;
  initials: string;
  time: string;
  text: string;
}

const mockComments: Record<number, MockComment[]> = {
  1: [
    { author: 'John Smith', initials: 'JS', time: '2 hours ago', text: 'Checked the fixture. The mounting bracket is slightly bent. Need a replacement part from the supplier.' },
    { author: 'Mike Torres', initials: 'MT', time: '1 hour ago', text: 'Replacement bracket ordered. Should arrive tomorrow morning.' },
  ],
  2: [
    { author: 'Maria Garcia', initials: 'MG', time: '4 hours ago', text: 'Started prep work. Matching paint color from original spec.' },
    { author: 'David Lee', initials: 'DL', time: '3 hours ago', text: 'Make sure to use the low VOC paint per the environmental requirements.' },
    { author: 'Maria Garcia', initials: 'MG', time: '1 hour ago', text: 'Confirmed. Using the approved Sherwin Williams SW 7006 Extra White.' },
  ],
  3: [
    { author: 'Robert Chen', initials: 'RC', time: '6 hours ago', text: 'The closer arm is out of spec. Needs full replacement, not just adjustment.' },
    { author: 'James Wilson', initials: 'JW', time: '5 hours ago', text: 'Approved the replacement. Please coordinate with security for access to B2 after hours.' },
  ],
  4: [
    { author: 'James Wilson', initials: 'JW', time: '1 day ago', text: 'Marble pieces are onsite. Installation crew scheduled for Thursday.' },
    { author: 'Sarah Johnson', initials: 'SJ', time: '12 hours ago', text: 'Verified the marble matches the approved sample. Good to proceed.' },
  ],
  5: [
    { author: 'Sarah Johnson', initials: 'SJ', time: '2 days ago', text: 'Installed acoustic lining in the main supply duct. Noise levels within acceptable range now.' },
    { author: 'Mike Torres', initials: 'MT', time: '1 day ago', text: 'Confirmed. Sound level measured at 35 dB, well within the 40 dB limit. Marking complete.' },
  ],
};

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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [atRiskFilter, setAtRiskFilter] = useState(false);
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const { addToast } = useToast();
  const appNavigate = useAppNavigate();
  const { data: punchList, loading } = useQuery('punchList', getPunchList);

  const pageAlerts = getPredictiveAlertsForPage('punchlist');

  const expandedPunchList: PunchItem[] = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base: PunchItem[] = (punchList || []).map((p: any) => ({
      ...p,
      photoCount: p.hasPhoto ? 2 : 0,
      dueDate: p.id === 1 ? '2026-03-30' : p.id === 2 ? '2026-04-05' : p.id === 3 ? '2026-03-28' : p.id === 4 ? '2026-04-02' : '2026-03-20',
      createdDate: p.id === 1 ? '2026-03-10' : p.id === 2 ? '2026-03-08' : p.id === 3 ? '2026-03-12' : p.id === 4 ? '2026-03-05' : '2026-02-28',
      reportedBy: p.id === 1 ? 'Mike Torres' : p.id === 2 ? 'David Lee' : p.id === 3 ? 'James Wilson' : p.id === 4 ? 'Sarah Johnson' : 'Mike Torres',
      responsible: p.id === 1 ? 'subcontractor' : p.id === 2 ? 'subcontractor' : p.id === 3 ? 'gc' : p.id === 4 ? 'subcontractor' : 'subcontractor',
    }));
    const extra: PunchItem[] = [
      { id: 6, itemNumber: 'PL-006', area: 'Floor 8, Unit 802', description: 'Missing baseboards along corridor', assigned: 'Maria Garcia', priority: 'low', status: 'open', hasPhoto: false, photoCount: 0, dueDate: '2026-04-10', createdDate: '2026-03-15', reportedBy: 'David Lee', responsible: 'subcontractor' },
      { id: 7, itemNumber: 'PL-007', area: 'Floor 8, Unit 805', description: 'HVAC diffuser not connected', assigned: 'Karen Williams', priority: 'high', status: 'open', hasPhoto: true, photoCount: 3, dueDate: '2026-03-29', createdDate: '2026-03-14', reportedBy: 'Mike Torres', responsible: 'subcontractor' },
      { id: 8, itemNumber: 'PL-008', area: 'Floor 2, Unit 204', description: 'Electrical outlet cover plate missing', assigned: 'Tom Anderson', priority: 'low', status: 'complete', hasPhoto: false, photoCount: 0, dueDate: '2026-03-25', createdDate: '2026-03-01', reportedBy: 'Sarah Johnson', responsible: 'subcontractor' },
      { id: 9, itemNumber: 'PL-009', area: 'Floor 6, Common Area', description: 'Fire sprinkler head not flush with ceiling', assigned: 'Robert Chen', priority: 'critical', status: 'open', hasPhoto: true, photoCount: 2, dueDate: '2026-03-27', createdDate: '2026-03-18', reportedBy: 'James Wilson', responsible: 'subcontractor' },
      { id: 10, itemNumber: 'PL-010', area: 'Lobby', description: 'Elevator lobby tile grout discoloration', assigned: 'James Wilson', priority: 'medium', status: 'in_progress', hasPhoto: true, photoCount: 1, dueDate: '2026-04-01', createdDate: '2026-03-10', reportedBy: 'David Lee', responsible: 'gc' },
      { id: 11, itemNumber: 'PL-011', area: 'Floor 10, Unit 1003', description: 'Kitchen cabinet door alignment off', assigned: 'John Smith', priority: 'medium', status: 'verified', hasPhoto: false, photoCount: 0, dueDate: '2026-03-22', createdDate: '2026-03-02', reportedBy: 'Mike Torres', responsible: 'subcontractor' },
      { id: 12, itemNumber: 'PL-012', area: 'Parking B1', description: 'Parking garage stripes faded at ramp entry', assigned: 'Maria Garcia', priority: 'low', status: 'open', hasPhoto: false, photoCount: 0, dueDate: '2026-04-15', createdDate: '2026-03-16', reportedBy: 'Tom Anderson', responsible: 'gc' },
      { id: 13, itemNumber: 'PL-013', area: 'Floor 4, Unit 410', description: 'Bathroom exhaust fan excessive noise', assigned: 'Karen Williams', priority: 'high', status: 'in_progress', hasPhoto: true, photoCount: 1, dueDate: '2026-03-31', createdDate: '2026-03-11', reportedBy: 'Sarah Johnson', responsible: 'subcontractor' },
      { id: 14, itemNumber: 'PL-014', area: 'Rooftop', description: 'Rooftop access door weather seal damaged', assigned: 'Robert Chen', priority: 'critical', status: 'open', hasPhoto: true, photoCount: 4, dueDate: '2026-03-28', createdDate: '2026-03-20', reportedBy: 'James Wilson', responsible: 'gc' },
      { id: 15, itemNumber: 'PL-015', area: 'Floor 1, Retail A', description: 'Storefront glass panel scratch', assigned: 'Tom Anderson', priority: 'medium', status: 'complete', hasPhoto: false, photoCount: 0, dueDate: '2026-03-20', createdDate: '2026-02-25', reportedBy: 'David Lee', responsible: 'owner' },
      { id: 16, itemNumber: 'PL-016', area: 'Floor 7, Unit 701', description: 'Drywall crack above doorframe', assigned: 'John Smith', priority: 'low', status: 'open', hasPhoto: false, photoCount: 0, dueDate: '2026-04-08', createdDate: '2026-03-19', reportedBy: 'Mike Torres', responsible: 'subcontractor' },
      { id: 17, itemNumber: 'PL-017', area: 'Floor 9, Unit 902', description: 'Flooring transition strip loose', assigned: 'Maria Garcia', priority: 'medium', status: 'in_progress', hasPhoto: false, photoCount: 0, dueDate: '2026-04-03', createdDate: '2026-03-13', reportedBy: 'Sarah Johnson', responsible: 'subcontractor' },
      { id: 18, itemNumber: 'PL-018', area: 'Parking B2', description: 'Emergency lighting unit not functional', assigned: 'Karen Williams', priority: 'critical', status: 'open', hasPhoto: true, photoCount: 1, dueDate: '2026-03-26', createdDate: '2026-03-21', reportedBy: 'Tom Anderson', responsible: 'gc' },
      { id: 19, itemNumber: 'PL-019', area: 'Floor 11, Common Area', description: 'Corridor handrail loose at stairwell B', assigned: 'Robert Chen', priority: 'high', status: 'verified', hasPhoto: false, photoCount: 0, dueDate: '2026-03-18', createdDate: '2026-02-28', reportedBy: 'James Wilson', responsible: 'gc' },
      { id: 20, itemNumber: 'PL-020', area: 'Floor 12, Penthouse', description: 'Balcony door threshold gap too wide', assigned: 'James Wilson', priority: 'high', status: 'in_progress', hasPhoto: true, photoCount: 2, dueDate: '2026-04-01', createdDate: '2026-03-17', reportedBy: 'David Lee', responsible: 'owner' },
    ];
    return [...base, ...extra];
  }, [punchList]);

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
  const comments = selectedId ? mockComments[selectedId] || [] : [];

  const handleMarkComplete = () => {
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
        {loading || !punchList ? (
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
                  content: <PriorityTag priority={item.priority as Priority} />,
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
                <PriorityTag priority={selected.priority as Priority} />
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
            <RelatedItems items={getRelatedItemsForPunchItem(selected.id)} onNavigate={appNavigate} />

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

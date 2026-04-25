import React, { useState, useMemo } from 'react';
import { Card, PriorityTag } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';
import { ChevronRight, ChevronDown, AlertTriangle, Package } from 'lucide-react';
import { CSI_DIVISIONS } from '../../machines/submittalMachine';
import {
  isOverdue,
  formatCSICode,
  SubmittalStatusTag,
  MiniApprovalChain,
  BallInCourtBadge,
} from './types';

// ── Types ───────────────────────────────────────────────

export type GroupByMode = 'spec_section' | 'subcontractor' | 'none';

interface GroupedSubmittalsViewProps {
  filteredSubmittals: Array<Record<string, unknown>>;
  groupBy: GroupByMode;
  onRowClick: (sub: Record<string, unknown>) => void;
}

interface SubmittalGroup {
  key: string;
  label: string;
  sublabel?: string;
  submittals: Array<Record<string, unknown>>;
  stats: {
    total: number;
    pending: number;
    inReview: number;
    approved: number;
    overdue: number;
    criticalPath: number; // items where lead time exceeds remaining time
  };
}

// ── Helpers ─────────────────────────────────────────────

function getCSIDivisionCode(specSection: string | null | undefined): string {
  if (!specSection) return '00';
  const digits = specSection.replace(/[\s\-]/g, '');
  return digits.slice(0, 2);
}

function getCSIDivisionName(code: string): string {
  const division = CSI_DIVISIONS.find((d) => d.code === code);
  return division?.name ?? 'Uncategorized';
}

function computeStats(submittals: Array<Record<string, unknown>>): SubmittalGroup['stats'] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let pending = 0, inReview = 0, approved = 0, overdue = 0, criticalPath = 0;
  for (const s of submittals) {
    const status = s.status as string;
    if (status === 'pending' || status === 'draft') pending++;
    else if (status === 'submitted' || status === 'review_in_progress' || status === 'under_review' || status === 'gc_review' || status === 'architect_review') inReview++;
    else if (status === 'approved' || status === 'approved_as_noted') approved++;

    const dueDate = (s.due_date as string) || (s.dueDate as string) || '';
    if (dueDate && status !== 'approved' && status !== 'approved_as_noted') {
      if (new Date(dueDate) < today) overdue++;
    }

    // Critical path: required_onsite_date is soon but submittal isn't approved
    const onsiteDate = s.required_onsite_date as string | undefined;
    const leadWeeks = s.lead_time_weeks as number | undefined;
    if (onsiteDate && leadWeeks && status !== 'approved' && status !== 'approved_as_noted') {
      const onsite = new Date(onsiteDate);
      const weeksRemaining = (onsite.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000);
      if (weeksRemaining < leadWeeks) criticalPath++;
    }
  }
  return { total: submittals.length, pending, inReview, approved, overdue, criticalPath };
}

function groupBySpecSection(submittals: Array<Record<string, unknown>>): SubmittalGroup[] {
  // Group by division first, then by spec section within
  const divisionMap = new Map<string, Map<string, Array<Record<string, unknown>>>>();

  for (const s of submittals) {
    const specSection = (s.spec_section as string) || '';
    const divCode = getCSIDivisionCode(specSection || null);

    if (!divisionMap.has(divCode)) divisionMap.set(divCode, new Map());
    const sectionMap = divisionMap.get(divCode)!;

    const sectionKey = specSection || 'unassigned';
    if (!sectionMap.has(sectionKey)) sectionMap.set(sectionKey, []);
    sectionMap.get(sectionKey)!.push(s);
  }

  // Sort by division code, then flatten sections within each
  const groups: SubmittalGroup[] = [];
  const sortedDivCodes = [...divisionMap.keys()].sort();

  for (const divCode of sortedDivCodes) {
    const sectionMap = divisionMap.get(divCode)!;
    const allInDiv: Array<Record<string, unknown>> = [];
    const sections = [...sectionMap.entries()].sort(([a], [b]) => a.localeCompare(b));

    for (const [, subs] of sections) {
      allInDiv.push(...subs);
    }

    const divName = divCode === '00' ? 'Unassigned Spec Section' : getCSIDivisionName(divCode);
    groups.push({
      key: divCode,
      label: divCode === '00' ? divName : `Division ${divCode} — ${divName}`,
      sublabel: sections.length > 1 ? `${sections.length} spec sections` : undefined,
      submittals: allInDiv,
      stats: computeStats(allInDiv),
    });
  }

  return groups;
}

function groupBySubcontractor(submittals: Array<Record<string, unknown>>): SubmittalGroup[] {
  const map = new Map<string, Array<Record<string, unknown>>>();

  for (const s of submittals) {
    const sub = (s.subcontractor as string) || (s.from as string) || '';
    const key = sub || 'Unassigned';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }

  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b);
    })
    .map(([key, subs]) => ({
      key,
      label: key,
      submittals: subs,
      stats: computeStats(subs),
    }));
}

// ── Procurement Context Indicator ────────────────────────

const ProcurementIndicator: React.FC<{ submittal: Record<string, unknown> }> = ({ submittal }) => {
  const onsiteDate = submittal.required_onsite_date as string | undefined;
  const leadWeeks = submittal.lead_time_weeks as number | undefined;
  const status = submittal.status as string;

  if (status === 'approved' || status === 'approved_as_noted') return null;
  if (!onsiteDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const onsite = new Date(onsiteDate);
  const weeksRemaining = Math.round((onsite.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000) * 10) / 10;

  if (weeksRemaining < 0) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: typography.fontSize.caption, color: colors.statusCritical,
        fontWeight: typography.fontWeight.semibold,
      }}>
        <AlertTriangle size={11} />
        Past onsite date
      </span>
    );
  }

  const isCritical = leadWeeks ? weeksRemaining < leadWeeks : weeksRemaining < 4;
  const isWarning = leadWeeks ? weeksRemaining < leadWeeks * 1.5 : weeksRemaining < 8;
  const color = isCritical ? colors.statusCritical : isWarning ? colors.statusPending : colors.textTertiary;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: typography.fontSize.caption,
      color,
      fontWeight: isCritical ? typography.fontWeight.semibold : typography.fontWeight.normal,
    }}>
      <Package size={11} />
      {Math.round(weeksRemaining)}w to site
      {leadWeeks ? ` (${leadWeeks}w lead)` : ''}
    </span>
  );
};

// ── Compact Row ─────────────────────────────────────────

const SubmittalRow: React.FC<{
  submittal: Record<string, unknown>;
  onClick: () => void;
  showSpecSection?: boolean;
  showSubcontractor?: boolean;
}> = ({ submittal, onClick, showSpecSection = false, showSubcontractor = true }) => {
  const [hovered, setHovered] = useState(false);
  const dueDate = (submittal.due_date as string) || (submittal.dueDate as string) || '';
  const overdue = dueDate && submittal.status !== 'approved' && submittal.status !== 'approved_as_noted' && isOverdue(dueDate);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '80px 1fr 140px 100px 130px 100px 80px',
        alignItems: 'center',
        gap: spacing['3'],
        padding: `${spacing['2.5']} ${spacing['4']}`,
        cursor: 'pointer',
        backgroundColor: hovered ? colors.surfaceHover : 'transparent',
        borderBottom: `1px solid ${colors.borderSubtle}`,
        transition: 'background-color 100ms ease',
      }}
    >
      {/* Number */}
      <span style={{
        fontSize: 11,
        fontFamily: typography.fontFamilyMono,
        fontWeight: 600,
        color: colors.orangeText,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.02em',
      }}>
        {submittal.submittalNumber as string}
      </span>

      {/* Title + context */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{
          fontSize: typography.fontSize.sm,
          color: colors.textPrimary,
          fontWeight: typography.fontWeight.medium,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {submittal.title as string}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          {showSpecSection && submittal.spec_section && (
            <span style={{
              fontSize: 10,
              fontFamily: typography.fontFamilyMono,
              color: colors.textTertiary,
              backgroundColor: colors.surfaceInset,
              padding: '1px 5px',
              borderRadius: borderRadius.sm,
              letterSpacing: '0.02em',
            }}>
              {formatCSICode(submittal.spec_section as string)}
            </span>
          )}
          {showSubcontractor && (submittal.subcontractor || submittal.from) && (
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              {(submittal.subcontractor as string) || (submittal.from as string)}
            </span>
          )}
          <ProcurementIndicator submittal={submittal} />
        </div>
      </div>

      {/* Status */}
      <SubmittalStatusTag status={submittal.status as string} />

      {/* Priority */}
      <PriorityTag priority={(submittal.priority as 'low' | 'medium' | 'high' | 'critical') || 'medium'} />

      {/* Due / Lead time */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {dueDate && (
          <span style={{
            fontSize: 11,
            fontFamily: typography.fontFamilyMono,
            color: overdue ? colors.statusCritical : colors.textTertiary,
            fontWeight: overdue ? 600 : 400,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {overdue && ' !'}
          </span>
        )}
        {!dueDate && <span style={{ fontSize: 11, color: colors.textTertiary, opacity: 0.5 }}>—</span>}
      </div>

      {/* Ball in Court */}
      <BallInCourtBadge value={submittal.ball_in_court as string | null} />

      {/* Approval chain */}
      <MiniApprovalChain status={submittal.status as string} approvalChain={submittal.approval_chain} />
    </div>
  );
};

// ── Group Header ────────────────────────────────────────

const GroupHeader: React.FC<{
  group: SubmittalGroup;
  expanded: boolean;
  onToggle: () => void;
}> = ({ group, expanded, onToggle }) => {
  const { stats } = group;
  const hasCritical = stats.overdue > 0 || stats.criticalPath > 0;

  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['3'],
        padding: `${spacing['3']} ${spacing['4']}`,
        cursor: 'pointer',
        backgroundColor: colors.surfaceInset,
        borderBottom: `1px solid ${colors.borderSubtle}`,
        position: 'sticky',
        top: 0,
        zIndex: 2,
        userSelect: 'none',
      }}
    >
      {/* Expand/collapse icon */}
      {expanded ? (
        <ChevronDown size={16} color={colors.textSecondary} style={{ flexShrink: 0 }} />
      ) : (
        <ChevronRight size={16} color={colors.textSecondary} style={{ flexShrink: 0 }} />
      )}

      {/* Group label */}
      <span style={{
        fontSize: 13,
        fontWeight: 600,
        color: colors.textPrimary,
        flex: 1,
        letterSpacing: '-0.01em',
      }}>
        {group.label}
        {group.sublabel && (
          <span style={{ fontWeight: 400, color: colors.textTertiary, marginLeft: spacing['2'], fontSize: 11 }}>
            {group.sublabel}
          </span>
        )}
      </span>

      {/* Stats pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
        {hasCritical && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.semibold,
            color: colors.statusCritical,
            backgroundColor: colors.statusCriticalSubtle,
            padding: `1px ${spacing['2']}`,
            borderRadius: borderRadius.full,
          }}>
            <AlertTriangle size={10} />
            {stats.overdue > 0 && `${stats.overdue} overdue`}
            {stats.overdue > 0 && stats.criticalPath > 0 && ' · '}
            {stats.criticalPath > 0 && `${stats.criticalPath} at risk`}
          </span>
        )}

        <StatPill label="total" value={stats.total} color={colors.textSecondary} />
        {stats.inReview > 0 && <StatPill label="in review" value={stats.inReview} color={colors.statusInfo} />}
        {stats.pending > 0 && <StatPill label="pending" value={stats.pending} color={colors.statusPending} />}
        <StatPill
          label="approved"
          value={stats.approved}
          color={colors.statusActive}
          showProgress
          total={stats.total}
        />
      </div>
    </div>
  );
};

const StatPill: React.FC<{
  label: string;
  value: number;
  color: string;
  showProgress?: boolean;
  total?: number;
}> = ({ label, value, color, showProgress, total }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 10,
    color,
    whiteSpace: 'nowrap',
    opacity: 0.85,
  }}>
    {showProgress && total && total > 0 ? (
      <>
        <span style={{
          width: 28, height: 3, borderRadius: 2,
          backgroundColor: `${color}25`,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <span style={{
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            width: `${Math.round((value / total) * 100)}%`,
            backgroundColor: color,
            borderRadius: 2,
          }} />
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}/{total}</span>
      </>
    ) : (
      <>
        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {label}
      </>
    )}
  </span>
);

// ── Column Header ───────────────────────────────────────

const ColumnHeaders: React.FC<{ showSpecSection: boolean }> = ({ showSpecSection }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: '80px 1fr 140px 100px 130px 100px 80px',
    alignItems: 'center',
    gap: spacing['3'],
    padding: `${spacing['2']} ${spacing['4']}`,
    borderBottom: `1px solid ${colors.borderDefault}`,
    backgroundColor: colors.surfacePage,
    position: 'sticky',
    top: 0,
    zIndex: 3,
  }}>
    {['#', showSpecSection ? 'Title / Spec' : 'Title / Sub', 'Status', 'Priority', 'Due', 'Ball in Court', 'Chain'].map((h) => (
      <span key={h} style={{
        fontSize: typography.fontSize.caption,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wider,
      }}>
        {h}
      </span>
    ))}
  </div>
);

// ── Main Component ──────────────────────────────────────

export const GroupedSubmittalsView: React.FC<GroupedSubmittalsViewProps> = ({
  filteredSubmittals,
  groupBy,
  onRowClick,
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    if (groupBy === 'spec_section') return groupBySpecSection(filteredSubmittals);
    if (groupBy === 'subcontractor') return groupBySubcontractor(filteredSubmittals);
    return [];
  }, [filteredSubmittals, groupBy]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => setCollapsedGroups(new Set());
  const collapseAll = () => setCollapsedGroups(new Set(groups.map((g) => g.key)));

  if (groupBy === 'none' || groups.length === 0) return null;

  const showSpecSection = groupBy === 'subcontractor';
  const showSubcontractor = groupBy === 'spec_section';

  return (
    <Card padding="0">
      {/* Quick expand/collapse controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${spacing['2']} ${spacing['4']}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
        backgroundColor: colors.surfaceRaised,
      }}>
        <span style={{
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
        }}>
          {groups.length} {groupBy === 'spec_section' ? 'divisions' : 'subcontractors'}
          {' · '}
          {filteredSubmittals.length} submittals
        </span>
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <button
            onClick={expandAll}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: typography.fontSize.caption,
              color: colors.textSecondary,
              padding: `2px ${spacing['2']}`,
              borderRadius: borderRadius.sm,
            }}
          >
            Expand all
          </button>
          <button
            onClick={collapseAll}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: typography.fontSize.caption,
              color: colors.textSecondary,
              padding: `2px ${spacing['2']}`,
              borderRadius: borderRadius.sm,
            }}
          >
            Collapse all
          </button>
        </div>
      </div>

      <ColumnHeaders showSpecSection={showSpecSection} />

      {/* Groups */}
      <div style={{ maxHeight: 640, overflowY: 'auto' }}>
        {groups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.key);
          return (
            <div key={group.key}>
              <GroupHeader
                group={group}
                expanded={!isCollapsed}
                onToggle={() => toggleGroup(group.key)}
              />
              {!isCollapsed && (
                <div>
                  {group.submittals.map((s) => (
                    <SubmittalRow
                      key={s.id as string}
                      submittal={s}
                      onClick={() => onRowClick(s)}
                      showSpecSection={showSpecSection}
                      showSubcontractor={showSubcontractor}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

// ── Group By Selector (toolbar component) ───────────────

export const GroupBySelector: React.FC<{
  value: GroupByMode;
  onChange: (mode: GroupByMode) => void;
}> = ({ value, onChange }) => {
  const options: Array<{ mode: GroupByMode; label: string }> = [
    { mode: 'spec_section', label: 'Spec Section' },
    { mode: 'subcontractor', label: 'Subcontractor' },
    { mode: 'none', label: 'None' },
  ];

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: spacing['1'],
      padding: spacing['0.5'],
      borderRadius: borderRadius.md,
      border: `1px solid ${colors.borderSubtle}`,
      backgroundColor: colors.surfaceInset,
    }}>
      <span style={{
        fontSize: typography.fontSize.caption,
        color: colors.textTertiary,
        paddingLeft: spacing['2'],
        fontWeight: typography.fontWeight.medium,
        whiteSpace: 'nowrap',
      }}>
        Group:
      </span>
      {options.map(({ mode, label }) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            style={{
              border: 'none',
              cursor: 'pointer',
              fontSize: typography.fontSize.caption,
              fontWeight: active ? typography.fontWeight.semibold : typography.fontWeight.medium,
              color: active ? colors.textPrimary : colors.textTertiary,
              backgroundColor: active ? colors.surfaceRaised : 'transparent',
              borderRadius: borderRadius.base,
              padding: `${spacing['1']} ${spacing['2.5']}`,
              boxShadow: active ? shadows.sm : 'none',
              transition: 'all 150ms ease',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

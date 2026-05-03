import React, { useMemo } from 'react';
import { VirtualDataTable } from '../../components/shared/VirtualDataTable';
import { BulkActionBar } from '../../components/shared/BulkActionBar';
import { createColumnHelper } from '@tanstack/react-table';
import { Btn, PriorityTag, useToast } from '../../components/Primitives';
import { colors, spacing, typography } from '../../styles/theme';
import { UserCheck, Tag as TagIcon, Download } from 'lucide-react';
import { AIAnnotationIndicator } from '../../components/ai/AIAnnotation';
import { getAnnotationsForEntity } from '../../data/aiAnnotations';
import {
  isOverdue,
  formatCSICode,
  calcBusinessDaysRemaining,
  calcDaysInReview,
  BallInCourtBadge,
  SubmittalStatusTag,
  MiniApprovalChain,
} from './types';

const subColHelper = createColumnHelper<Record<string, unknown>>();

interface SubmittalsTableProps {
  filteredSubmittals: Array<Record<string, unknown>>;
  allSubmittals: Array<Record<string, unknown>>;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  loading: boolean;
  onRowClick: (sub: Record<string, unknown>) => void;
  clearFilters: () => void;
  projectId: string | undefined;
  updateSubmittalMutateAsync: (args: { id: string; updates: Record<string, unknown>; projectId: string }) => Promise<unknown>;
}

export const SubmittalsTable: React.FC<SubmittalsTableProps> = ({
  filteredSubmittals,
  allSubmittals,
  selectedIds,
  setSelectedIds,
  loading,
  onRowClick,
  clearFilters,
  projectId,
  updateSubmittalMutateAsync,
}) => {
  const { addToast } = useToast();

  const subColumns = useMemo(() => [
    subColHelper.accessor('submittalNumber', {
      header: '#',
      size: 100,
      cell: (info) => <span style={{ fontFamily: typography.fontFamilyMono, fontSize: 11, fontWeight: 600, color: colors.orangeText, letterSpacing: '0.02em' }}>{info.getValue() as string}</span>,
    }),
    subColHelper.accessor('title', {
      header: 'Title',
      size: 360,
      cell: (info) => {
        const sub = info.row.original as Record<string, unknown>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, lineHeight: typography.lineHeight.snug }}>
              {info.getValue() as string}
              {getAnnotationsForEntity('submittal', sub.id as string | number).map((ann) => (
                <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
              ))}
            </span>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              {sub.spec_section ? <span style={{ fontFamily: 'monospace', marginRight: spacing['2'] }}>{sub.spec_section as string}</span> : null}
              {sub.lead_time_weeks != null && (sub.lead_time_weeks as number) > 0 && (() => {
                const wks = sub.lead_time_weeks as number;
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
      cell: (info) => <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{info.getValue() as string}</span>,
    }),
    subColHelper.accessor('priority', {
      header: 'Priority',
      size: 90,
      cell: (info) => <PriorityTag priority={info.getValue() as 'low' | 'medium' | 'high' | 'critical'} />,
    }),
    subColHelper.accessor('status', {
      header: 'Status',
      size: 140,
      cell: (info) => <SubmittalStatusTag status={info.getValue() as string} />,
    }),
    subColHelper.accessor('specification_section', {
      header: 'Spec Section',
      size: 110,
      cell: (info) => {
        const raw = info.getValue() as string | null;
        const sub = info.row.original as Record<string, unknown>;
        const val = formatCSICode(raw) || formatCSICode((sub.submittal_type as string | null) ?? null);
        return val ? (
          <span style={{ fontSize: typography.fontSize.sm, fontFamily: 'monospace', color: colors.textSecondary }}>{val}</span>
        ) : (
          <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>&mdash;</span>
        );
      },
    }),
    subColHelper.accessor((row: Record<string, unknown>) => {
      const revisions = Array.isArray(row.submittal_revisions) ? (row.submittal_revisions as unknown[]).length : null;
      return revisions ?? (row.revision_number as number | undefined) ?? 0;
    }, {
      id: 'rev_number',
      header: 'Revision',
      size: 80,
      cell: (info) => {
        const val = info.getValue() as number;
        return (
          <span style={{
            fontSize: 11,
            fontFamily: typography.fontFamilyMono,
            fontWeight: val > 0 ? typography.fontWeight.semibold : typography.fontWeight.normal,
            color: val > 0 ? colors.statusCritical : colors.textTertiary,
            fontVariantNumeric: 'tabular-nums' as const,
          }}>
            {`Rev ${val}`}
          </span>
        );
      },
    }),
    subColHelper.accessor((row: Record<string, unknown>) => row, {
      id: 'lead_time',
      header: 'Lead Time',
      size: 130,
      cell: (info) => {
        const sub = info.getValue() as Record<string, unknown>;
        const daysRemaining = calcBusinessDaysRemaining((sub.due_date as string) || (sub.dueDate as string));
        if (daysRemaining === null) return <span style={{ fontSize: 11, color: colors.textTertiary, opacity: 0.5 }}>&mdash;</span>;
        const overdue = daysRemaining < 0;
        const color = overdue ? colors.statusCritical : daysRemaining <= 7 ? colors.statusPending : colors.statusActive;
        const label = overdue
          ? `${Math.abs(daysRemaining)}d overdue`
          : `${daysRemaining}d left`;
        return (
          <span style={{ fontSize: 11, fontFamily: typography.fontFamilyMono, color, fontWeight: typography.fontWeight.medium, fontVariantNumeric: 'tabular-nums' as const, whiteSpace: 'nowrap' }}>
            {label}
          </span>
        );
      },
    }),
    subColHelper.accessor('assigned_to', {
      header: 'Current Reviewer',
      size: 160,
      cell: (info) => {
        const val = info.getValue() as string | null;
        if (!val) return <span style={{ fontSize: 11, color: colors.textTertiary, opacity: 0.5 }}>—</span>;
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.statusInfo, flexShrink: 0, display: 'inline-block', opacity: 0.7 }} />
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{val}</span>
          </span>
        );
      },
    }),
    subColHelper.accessor('dueDate', {
      header: 'Due',
      size: 100,
      cell: (info) => {
        const sub = info.row.original as Record<string, unknown>;
        const val = info.getValue() as string;
        return (
          <span style={{ fontSize: 11, fontFamily: typography.fontFamilyMono, color: isOverdue(val) && sub.status !== 'approved' ? colors.statusCritical : colors.textTertiary, fontVariantNumeric: 'tabular-nums' as const, fontWeight: isOverdue(val) && sub.status !== 'approved' ? 600 : 400 }}>
            {new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        );
      },
    }),
    subColHelper.accessor('ball_in_court', {
      header: 'Ball in Court',
      size: 120,
      cell: (info) => <BallInCourtBadge value={info.getValue() as string | null} />,
    }),
    subColHelper.accessor((row: Record<string, unknown>) => row, {
      id: 'days_in_review',
      header: 'Days in Review',
      size: 120,
      cell: (info) => {
        const sub = info.getValue() as Record<string, unknown>;
        const days = calcDaysInReview(sub);
        if (days === null) return <span style={{ fontSize: 11, color: colors.textTertiary, opacity: 0.5 }}>&mdash;</span>;
        const color = days > 14 ? colors.statusCritical : days > 7 ? colors.statusPending : colors.textSecondary;
        return (
          <span style={{ fontSize: 11, fontFamily: typography.fontFamilyMono, color, fontWeight: days > 14 ? typography.fontWeight.semibold : typography.fontWeight.normal, fontVariantNumeric: 'tabular-nums' as const, whiteSpace: 'nowrap' }}>
            {days}d
          </span>
        );
      },
    }),
    subColHelper.accessor((row: Record<string, unknown>) => row, {
      id: 'approval_chain',
      header: 'Chain',
      size: 80,
      cell: (info) => {
        const sub = info.getValue() as Record<string, unknown>;
        return <MiniApprovalChain status={sub.status as string} approvalChain={sub.approval_chain} />;
      },
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
          if (e.target.checked) setSelectedIds(new Set(allSubmittals.map((s) => String(s.id))));
          else setSelectedIds(new Set());
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label="Select all submittals"
        style={{ cursor: 'pointer' }}
      />
    ),
    cell: (info) => {
      const id = String((info.row.original as Record<string, unknown>).id);
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
  }), [selectedIds, allSubmittals, setSelectedIds]);

  const allSubColumns = useMemo(() => [checkboxColumn, ...subColumns], [checkboxColumn, subColumns]);

  return (
    <>
      {filteredSubmittals.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', gap: '12px' }}>
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>No submittals match your filters</p>
          <Btn variant="secondary" size="sm" onClick={clearFilters}>Clear Filters</Btn>
        </div>
      ) : (
          <VirtualDataTable
            data={filteredSubmittals}
            columns={allSubColumns}
            rowHeight={48}
            containerHeight={600}
            onRowClick={onRowClick}
            selectedRowId={null}
            getRowId={(row) => String((row as Record<string, unknown>).id)}
            loading={loading}
            emptyMessage="No submittals match your filters"
            onRowToggleSelectByIndex={(i) => {
              const id = String((filteredSubmittals[i] as Record<string, unknown>)?.id);
              if (!id) return;
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
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
              try {
                await Promise.all(ids.map((id) => updateSubmittalMutateAsync({ id, updates: { reviewer: 'Reassigned' }, projectId: projectId! })));
                addToast('success', `${ids.length} submittal${ids.length > 1 ? 's' : ''} reassigned`);
              } catch {
                addToast('error', 'Failed to reassign submittals. Please try again.');
              }
            },
          },
          {
            label: 'Change Status',
            icon: <TagIcon size={14} />,
            variant: 'secondary',
            onClick: async (ids) => {
              try {
                await Promise.all(ids.map((id) => updateSubmittalMutateAsync({ id, updates: { status: 'under_review' }, projectId: projectId! })));
                addToast('success', `${ids.length} submittal${ids.length > 1 ? 's' : ''} set to Under Review`);
              } catch {
                addToast('error', 'Failed to update submittal status. Please try again.');
              }
            },
          },
          {
            label: 'Export',
            icon: <Download size={14} />,
            variant: 'secondary',
            onClick: async (ids) => {
              const selected = allSubmittals.filter((s) => ids.includes(String(s.id)));
              const csv = ['Submittal #,Title,From,Priority,Status,Due Date',
                ...selected.map((s) => `${s.submittalNumber},"${s.title}",${s.from},${s.priority},${s.status},${s.dueDate}`),
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
    </>
  );
};

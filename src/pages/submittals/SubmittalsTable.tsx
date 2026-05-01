import React, { useMemo } from 'react';
import { VirtualDataTable } from '../../components/shared/VirtualDataTable';
import { BulkActionBar } from '../../components/shared/BulkActionBar';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { useToast } from '../../components/Primitives';
import { colors, typography } from '../../styles/theme';
import { UserCheck, Tag as TagIcon, Download, Sparkles } from 'lucide-react';
import {
  isOverdue,
  formatCSICode,
  calcBusinessDaysRemaining,
  SubmittalStatusTag,
} from './types';
import { useIrisDraftStore } from '../../stores/irisDraftStore';
import { useProfileNames, displayName } from '../../hooks/queries/profiles';
import type { ScheduleActivity } from '../../hooks/useScheduleActivities';

// `assigned_to` is a uuid FK to auth.users; `current_reviewer` is text and
// can either be a free-form name or (legacy) a uuid copy. Detect the uuid
// shape so we can route through displayName instead of rendering raw ids.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s: string | null | undefined): s is string => !!s && UUID_RE.test(s);

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
  // Optional — surfaces the dependent activity countdown if a downstream
  // matcher exists. Wave 1 falls through to required_onsite_date heuristics.
  scheduleActivities?: ScheduleActivity[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the number of days from today until the submittal MUST be approved
 * to keep the dependent schedule activity on track.
 *   trigger = required_onsite_date − (lead_time_weeks × 7)
 *   risk    = trigger − today
 * Negative means we're already past the must-approve-by date. `null` when no
 * onsite date is recorded.
 */
function calcScheduleRiskDays(sub: Record<string, unknown>): number | null {
  const onsite = sub.required_onsite_date as string | undefined;
  if (!onsite) return null;
  const onsiteDate = new Date(onsite);
  if (Number.isNaN(onsiteDate.getTime())) return null;
  const leadDays = ((sub.lead_time_weeks as number | null | undefined) ?? 0) * 7;
  const trigger = new Date(onsiteDate);
  trigger.setDate(trigger.getDate() - leadDays);
  trigger.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((trigger.getTime() - today.getTime()) / 86400000);
}

const TONE_RUST = '#B8472E';      // DESIGN-RESET high / at-risk
const TONE_CRITICAL = '#C93B3B';  // DESIGN-RESET critical / overdue
const TONE_TRACK = '#2D8A6E';     // DESIGN-RESET on track
const TONE_INK3 = '#8C857E';

/**
 * Count approvers still pending AFTER the current ball-in-court.
 *
 * Reads the `approval_chain` jsonb (e.g. `["gc_pm", "architect", "engineer"]`)
 * and the `current_reviewer` text. Returns the number of approvers that
 * follow the current step. Returns 0 when:
 *   • approval_chain is missing/empty (single-reviewer flow), or
 *   • current_reviewer matches the *last* chain step (no one's after them), or
 *   • current_reviewer can't be matched to a chain step (we don't guess).
 *
 * The chain matching is fuzzy — `current_reviewer` is free text, so we
 * match by substring (case-insensitive) against each chain step. Good
 * enough for the common labels (`gc_pm`, `architect`, `engineer`); a
 * cleaner schema would put a chain index on the row.
 */
function countRemainingApprovers(sub: Record<string, unknown>): number {
  const chain = sub.approval_chain;
  if (!Array.isArray(chain) || chain.length === 0) return 0;
  const reviewer = (sub.current_reviewer as string | null | undefined) ?? '';
  if (!reviewer) return 0;
  const needle = reviewer.toLowerCase();
  const idx = chain.findIndex((step) => {
    const s = String(step).toLowerCase();
    return s === needle || needle.includes(s) || s.includes(needle);
  });
  if (idx < 0) return 0;
  return Math.max(0, chain.length - 1 - idx);
}

function pickRiskTone(days: number | null, status: string | undefined): { color: string; label: string } | null {
  if (days == null) return null;
  if (status === 'approved' || status === 'approved_as_noted') return null;
  if (days < 0) return { color: TONE_CRITICAL, label: `${Math.abs(days)}d past` };
  if (days <= 7) return { color: TONE_RUST, label: `+${days}d` };
  return { color: TONE_TRACK, label: `+${days}d` };
}

// ── Iris draft pill (read-only column) ──────────────────────────────────────
// The dashboard's Iris flow keys drafts by `${type}-${id}`; for submittals
// that's `submittal-${id}`. If a draft is present, surface a small indigo
// pill the PM can click to open the detail page where the draft preview
// renders. Wave 1 stops at "draft ready"; preview is on the detail page.

const IRIS_INDIGO = '#4F46E5';

const IrisCell: React.FC<{ submittalId: string; projectId: string | undefined }> = ({ submittalId, projectId }) => {
  const draft = useIrisDraftStore((s) => s.getDraft(`submittal-${submittalId}`, projectId));
  if (!draft) {
    return <span style={{ fontSize: 11, color: TONE_INK3, opacity: 0.5 }}>—</span>;
  }
  return (
    <span
      title="Iris drafted a review — click the row to review"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        backgroundColor: 'rgba(79, 70, 229, 0.10)',
        color: IRIS_INDIGO,
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.005em',
      }}
    >
      <Sparkles size={10} />
      Draft ready
    </span>
  );
};

// ── Component ───────────────────────────────────────────────────────────────

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

  // Collect any uuid that might appear in the Reviewer column so we can
  // resolve all of them in one round-trip and render names instead of ids.
  const reviewerUserIds = useMemo(() => {
    const ids: string[] = [];
    for (const sub of allSubmittals) {
      const reviewer = sub.current_reviewer as string | null | undefined;
      const assigned = sub.assigned_to as string | null | undefined;
      if (isUuid(reviewer)) ids.push(reviewer);
      if (isUuid(assigned)) ids.push(assigned);
    }
    return ids;
  }, [allSubmittals]);
  const profileMap = useProfileNames(reviewerUserIds).data;

  const subColumns = useMemo(() => [
    // ── Spec § ──
    subColHelper.accessor((row: Record<string, unknown>) =>
      formatCSICode((row.spec_section as string | null) ?? null) ?? '—',
    {
      id: 'spec_section',
      header: 'Spec §',
      size: 110,
      cell: (info) => {
        const val = info.getValue() as string;
        const sub = info.row.original as Record<string, unknown>;
        const number = sub.number ? `SUB-${String(sub.number).padStart(3, '0')}` : null;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12, fontFamily: typography.fontFamilyMono, color: colors.textPrimary, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {val}
            </span>
            {number && (
              <span style={{ fontSize: 10, color: colors.textTertiary, fontFamily: typography.fontFamilyMono }}>
                {number}
              </span>
            )}
          </div>
        );
      },
    }),
    // ── Title ──
    subColHelper.accessor('title', {
      header: 'Title',
      size: 360,
      cell: (info) => {
        const sub = info.row.original as Record<string, unknown>;
        const wks = sub.lead_time_weeks as number | undefined;
        const showLead = wks != null && wks > 0;
        const leadColor = !wks ? '' : wks > 12 ? TONE_CRITICAL : wks >= 8 ? TONE_RUST : TONE_TRACK;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13, color: colors.textPrimary, fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {info.getValue() as string}
            </span>
            {(sub.subcontractor || showLead) && (
              <span style={{ fontSize: 11, color: colors.textTertiary, display: 'flex', gap: 8 }}>
                {sub.subcontractor ? <span>{sub.subcontractor as string}</span> : null}
                {showLead && (
                  <span style={{ color: leadColor, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                    {wks}w lead
                  </span>
                )}
              </span>
            )}
          </div>
        );
      },
    }),
    // ── Ball-in-Court ──
    // Submittals have no `ball_in_court` column; the workflow puts the ball
    // on `current_reviewer` (text or legacy uuid) with `assigned_to` (uuid)
    // as the next-best fallback. Both are resolved through the profile map
    // so we never render a raw uuid. The accessor returns just the name
    // (for sortability); the cell adds a `+N more` chain-tail hint when
    // there are pending approvers beyond the current one — a multi-reviewer
    // submittal is the common case, not the edge.
    subColHelper.accessor((row: Record<string, unknown>) => {
      const reviewer = row.current_reviewer as string | null | undefined;
      const assigned = row.assigned_to as string | null | undefined;
      if (reviewer && !isUuid(reviewer)) return reviewer;
      if (isUuid(reviewer)) return displayName(profileMap, reviewer, '');
      if (isUuid(assigned)) return displayName(profileMap, assigned, '');
      return assigned ?? null;
    },
    {
      id: 'ball_in_court',
      header: 'Ball-in-Court',
      size: 180,
      cell: (info) => {
        const val = info.getValue() as string | null;
        if (!val) return <span style={{ fontSize: 11, color: colors.textTertiary, opacity: 0.5 }}>—</span>;
        const sub = info.row.original as Record<string, unknown>;
        const remaining = countRemainingApprovers(sub);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.statusInfo, flexShrink: 0, opacity: 0.7 }} />
              <span style={{ fontSize: 13, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
            </span>
            {remaining > 0 && (
              <span
                title="Approvers still pending after the current ball-in-court"
                style={{ fontSize: 11, color: colors.textTertiary, paddingLeft: 11, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
              >
                +{remaining} more
              </span>
            )}
          </div>
        );
      },
    }),
    // ── Submitted ──
    subColHelper.accessor((row: Record<string, unknown>) =>
      (row.submitted_date as string | null) ?? (row.created_at as string | null),
    {
      id: 'submitted',
      header: 'Submitted',
      size: 110,
      cell: (info) => {
        const val = info.getValue() as string | null;
        if (!val) return <span style={{ fontSize: 11, color: colors.textTertiary, opacity: 0.5 }}>—</span>;
        return (
          <span style={{ fontSize: 12, color: colors.textSecondary, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        );
      },
    }),
    // ── Due Back ──
    subColHelper.accessor((row: Record<string, unknown>) =>
      (row.due_date as string | null) ?? (row.dueDate as string | null),
    {
      id: 'due_back',
      header: 'Due Back',
      size: 120,
      cell: (info) => {
        const val = info.getValue() as string | null;
        const sub = info.row.original as Record<string, unknown>;
        if (!val) return <span style={{ fontSize: 11, color: colors.textTertiary, opacity: 0.5 }}>—</span>;
        const overdueNow = isOverdue(val) && sub.status !== 'approved' && sub.status !== 'approved_as_noted';
        const businessDays = calcBusinessDaysRemaining(val);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{
              fontSize: 12,
              fontVariantNumeric: 'tabular-nums',
              color: overdueNow ? TONE_CRITICAL : colors.textPrimary,
              fontWeight: overdueNow ? 600 : 400,
              whiteSpace: 'nowrap',
            }}>
              {new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            {businessDays != null && (
              <span style={{
                fontSize: 11,
                fontVariantNumeric: 'tabular-nums',
                color: overdueNow ? TONE_CRITICAL : businessDays <= 3 ? TONE_RUST : colors.textTertiary,
                whiteSpace: 'nowrap',
              }}>
                {businessDays < 0 ? `${Math.abs(businessDays)}d overdue` : `${businessDays}d left`}
              </span>
            )}
          </div>
        );
      },
    }),
    // ── Status ──
    subColHelper.accessor('status', {
      header: 'Status',
      size: 140,
      cell: (info) => <SubmittalStatusTag status={info.getValue() as string} />,
    }),
    // ── Schedule Risk ──
    subColHelper.accessor((row: Record<string, unknown>) => row, {
      id: 'schedule_risk',
      header: 'Schedule Risk',
      size: 130,
      cell: (info) => {
        const sub = info.getValue() as Record<string, unknown>;
        const days = calcScheduleRiskDays(sub);
        const tone = pickRiskTone(days, sub.status as string | undefined);
        if (!tone) return <span style={{ fontSize: 11, color: colors.textTertiary, opacity: 0.5 }}>—</span>;
        const onsite = sub.required_onsite_date as string | undefined;
        const onsiteFmt = onsite
          ? new Date(onsite).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : null;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{
              fontSize: 12,
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
              color: tone.color,
              whiteSpace: 'nowrap',
            }}>
              {tone.label}
            </span>
            {onsiteFmt && (
              <span style={{ fontSize: 10, color: colors.textTertiary, whiteSpace: 'nowrap' }}>
                onsite {onsiteFmt}
              </span>
            )}
          </div>
        );
      },
    }),
    // ── Iris ──
    subColHelper.accessor((row: Record<string, unknown>) => row.id as string, {
      id: 'iris',
      header: 'Iris',
      size: 110,
      cell: (info) => <IrisCell submittalId={info.getValue() as string} projectId={projectId} />,
    }),
  ], [projectId, profileMap]);

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

  // Concatenating column-def arrays of slightly different shapes (checkbox is
  // a display column, subColumns mix accessor + accessorFn) hits a TanStack
  // Table union-type quirk; the runtime shape is correct, so cast through
  // unknown to keep the consumer happy.
  const allSubColumns = useMemo(
    () => [checkboxColumn, ...subColumns] as unknown as ColumnDef<Record<string, unknown>, unknown>[],
    [checkboxColumn, subColumns],
  );

  if (filteredSubmittals.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', gap: 12 }}>
        <p style={{ fontSize: 13, color: colors.textSecondary, margin: 0 }}>No submittals match your filters</p>
        <button
          onClick={clearFilters}
          style={{
            padding: '6px 12px', minHeight: 30, backgroundColor: '#fff', color: colors.textPrimary,
            border: `1px solid ${colors.borderDefault}`, borderRadius: 4, cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
          }}
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <>
      <VirtualDataTable
        data={filteredSubmittals}
        columns={allSubColumns}
        rowHeight={48}
        containerHeight={600}
        onRowClick={onRowClick}
        selectedRowId={null}
        getRowId={(row) => String((row as Record<string, unknown>).id)}
        getRowStyle={(row) => {
          const sub = row as Record<string, unknown>;
          const dueRaw = (sub.due_date as string) || (sub.dueDate as string);
          if (!dueRaw) return {};
          const status = (sub.status as string) ?? '';
          const finalStates = ['approved', 'approved_as_noted', 'rejected'];
          if (finalStates.includes(status)) return {};
          const daysRemaining = calcBusinessDaysRemaining(dueRaw);
          if (daysRemaining == null || daysRemaining >= 0) return {};
          // Subtle 3px left rail in critical when due-back has passed.
          return {
            backgroundColor: `${TONE_CRITICAL}08`,
            boxShadow: `inset 3px 0 0 0 ${TONE_CRITICAL}`,
          };
        }}
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
                await Promise.all(ids.map((id) => updateSubmittalMutateAsync({ id, updates: { current_reviewer: 'Reassigned' }, projectId: projectId! })));
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
              const csv = [
                'Submittal #,Title,Subcontractor,Status,Due Back,Required Onsite,Lead Weeks',
                ...selected.map((s) => {
                  const r = s as Record<string, unknown>;
                  return [
                    r.number ?? r.id ?? '',
                    `"${String(r.title ?? '')}"`,
                    `"${String(r.subcontractor ?? '')}"`,
                    String(r.status ?? ''),
                    String(r.due_date ?? ''),
                    String(r.required_onsite_date ?? ''),
                    String(r.lead_time_weeks ?? ''),
                  ].join(',');
                }),
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

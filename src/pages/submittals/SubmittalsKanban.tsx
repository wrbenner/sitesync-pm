import React, { useMemo } from 'react';
import { PriorityTag } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { KanbanBoard } from '../../components/shared/KanbanBoard';
import type { KanbanColumn } from '../../components/shared/KanbanBoard';
import { Calendar, Clock, User } from 'lucide-react';
import { isOverdue, MiniApprovalChain } from './types';

interface SubmittalsKanbanProps {
  allSubmittals: Array<Record<string, unknown>>;
  onSelectSubmittal: (id: string) => void;
}

export const SubmittalsKanban: React.FC<SubmittalsKanbanProps> = ({ allSubmittals, onSelectSubmittal }) => {
  const kanbanColumns: KanbanColumn<Record<string, unknown>>[] = useMemo(() => [
    { id: 'pending', label: 'Pending', color: colors.statusPending, items: allSubmittals.filter((s) => s.status === 'pending' || s.status === 'draft') },
    { id: 'under_review', label: 'Under Review', color: colors.statusInfo, items: allSubmittals.filter((s) => s.status === 'under_review' || s.status === 'submitted' || s.status === 'review_in_progress' || s.status === 'gc_review' || s.status === 'architect_review') },
    { id: 'revise_resubmit', label: 'Revise & Resubmit', color: colors.statusCritical, items: allSubmittals.filter((s) => s.status === 'revise_resubmit' || s.status === 'rejected') },
    { id: 'approved', label: 'Approved', color: colors.statusActive, items: allSubmittals.filter((s) => s.status === 'approved' || s.status === 'approved_as_noted') },
  ], [allSubmittals]);

  return (
    <>
    <KanbanBoard
      columns={kanbanColumns}
      getKey={(sub) => (sub as Record<string, unknown>).id as string | number}
      renderCard={(sub) => {
        const s = sub as Record<string, unknown>;
        const subId = s.id as string;
        const subNumber = s.submittalNumber as string;
        const title = s.title as string;
        const from = s.from as string;
        const dueDate = s.dueDate as string;
        const status = s.status as string;
        const leadTime = s.lead_time_weeks as number | undefined;
        const specSection = s.spec_section as string | undefined;
        const overdue = dueDate && isOverdue(dueDate) && status !== 'approved';

        return (
          <div
            className="sub-kanban-card"
            style={{
              padding: `${spacing['3']} ${spacing['4']}`,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: spacing['2'],
              borderLeft: overdue ? `3px solid ${colors.statusCritical}` : 'none',
              transition: `box-shadow 200ms ease, transform 200ms ease`,
            }}
            onClick={() => onSelectSubmittal(subId)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSubmittal(subId); } }}
            role="button"
            tabIndex={0}
            aria-label={`View submittal ${subNumber}: ${title}`}
          >
            {/* Top row: number + priority + age */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{
                fontFamily: typography.fontFamilyMono,
                fontSize: 11,
                fontWeight: 700,
                color: colors.primaryOrange,
                letterSpacing: '0.02em',
              }}>
                {subNumber}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <PriorityTag priority={s.priority as 'low' | 'medium' | 'high' | 'critical'} />
              </div>
            </div>

            {/* Title */}
            <div style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              color: colors.textPrimary,
              lineHeight: typography.lineHeight.snug,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {title}
            </div>

            {/* Spec section badge + Approval chain */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {specSection && (
                <span style={{
                  fontSize: '10px',
                  fontFamily: typography.fontFamilyMono,
                  padding: '1px 6px',
                  borderRadius: borderRadius.sm,
                  backgroundColor: colors.statusInfoSubtle,
                  color: colors.statusInfo,
                  fontWeight: typography.fontWeight.medium,
                }}>
                  {specSection}
                </span>
              )}
              <MiniApprovalChain status={status} approvalChain={s.approval_chain} />
            </div>

            {/* Bottom row: from + due date */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingTop: spacing['1'],
              borderTop: `1px solid ${colors.borderSubtle}`,
              marginTop: spacing['1'],
            }}>
              {from ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: '11px', color: colors.textTertiary,
                }}>
                  <User size={10} />
                  {from.length > 20 ? from.slice(0, 20) + '…' : from}
                </span>
              ) : (
                <span />
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {leadTime != null && leadTime >= 8 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    fontSize: '10px',
                    color: leadTime > 12 ? colors.statusCritical : colors.statusPending,
                    fontWeight: typography.fontWeight.medium,
                  }}>
                    <Clock size={9} />
                    {leadTime}wk
                  </span>
                )}
                {dueDate && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    fontSize: '11px',
                    color: overdue ? colors.statusCritical : colors.textTertiary,
                    fontWeight: overdue ? typography.fontWeight.semibold : typography.fontWeight.normal,
                  }}>
                    <Calendar size={10} />
                    {new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      }}
    />
    <style>{`.sub-kanban-card:hover { box-shadow: ${shadows.cardHover}; transform: translateY(-1px); }`}</style>
    </>
  );
};

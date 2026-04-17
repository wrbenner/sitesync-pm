import React, { useMemo } from 'react';
import { PriorityTag } from '../../components/Primitives';
import { colors, spacing, typography } from '../../styles/theme';
import { KanbanBoard } from '../../components/shared/KanbanBoard';
import type { KanbanColumn } from '../../components/shared/KanbanBoard';
import { AIAnnotationIndicator } from '../../components/ai/AIAnnotation';
import { getAnnotationsForEntity } from '../../data/aiAnnotations';
import { isOverdue } from './types';

interface SubmittalsKanbanProps {
  allSubmittals: Array<Record<string, unknown>>;
  onSelectSubmittal: (id: number) => void;
}

export const SubmittalsKanban: React.FC<SubmittalsKanbanProps> = ({ allSubmittals, onSelectSubmittal }) => {
  const kanbanColumns: KanbanColumn<Record<string, unknown>>[] = useMemo(() => [
    { id: 'pending', label: 'Pending', color: colors.statusPending, items: allSubmittals.filter((s) => s.status === 'pending') },
    { id: 'under_review', label: 'Under Review', color: colors.statusInfo, items: allSubmittals.filter((s) => s.status === 'under_review') },
    { id: 'revise_resubmit', label: 'Revise & Resubmit', color: colors.statusCritical, items: allSubmittals.filter((s) => s.status === 'revise_resubmit') },
    { id: 'approved', label: 'Approved', color: colors.statusActive, items: allSubmittals.filter((s) => s.status === 'approved') },
  ], [allSubmittals]);

  return (
    <KanbanBoard
      columns={kanbanColumns}
      getKey={(sub) => (sub as Record<string, unknown>).id as string | number}
      renderCard={(sub) => {
        const s = sub as Record<string, unknown>;
        const subId = s.id as number;
        const subNumber = s.submittalNumber as string;
        const title = s.title as string;
        const from = s.from as string;
        const dueDate = s.dueDate as string;
        const status = s.status as string;
        return (
          <div
            style={{ padding: spacing.md, cursor: 'pointer' }}
            onClick={() => onSelectSubmittal(subId)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSubmittal(subId); } }}
            role="button"
            tabIndex={0}
            aria-label={`View submittal ${subNumber}: ${title}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
              <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.textTertiary }}>{subNumber}</span>
              <PriorityTag priority={s.priority as 'low' | 'medium' | 'high' | 'critical'} />
            </div>
            <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.sm, lineHeight: typography.lineHeight.snug }}>
              {title}
            </div>
            <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, marginBottom: spacing.xs }}>
              {from}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  color: isOverdue(dueDate) && status !== 'approved' ? colors.statusCritical : colors.textTertiary,
                  fontWeight: isOverdue(dueDate) && status !== 'approved' ? typography.fontWeight.medium : typography.fontWeight.normal,
                }}
              >
                {new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <div style={{ display: 'flex', gap: spacing.xs }}>
                {getAnnotationsForEntity('submittal', subId).map((ann) => (
                  <AIAnnotationIndicator key={ann.id} annotation={ann} inline />
                ))}
              </div>
            </div>
          </div>
        );
      }}
    />
  );
};

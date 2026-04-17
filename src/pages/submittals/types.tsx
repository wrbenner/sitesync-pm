import React from 'react';
import { colors } from '../../styles/theme';

export const isOverdue = (dateStr: string): boolean => new Date(dateStr) < new Date();

// ── ReviewerStepper ──────────────────────────────────────
export type StepStatus = 'pending' | 'current' | 'approved' | 'rejected' | 'approved_as_noted';

export const STEP_COLORS: Record<StepStatus, { bg: string; fg: string }> = {
  pending:           { bg: colors.borderLight, fg: colors.textTertiary },
  current:           { bg: colors.statusInfo, fg: colors.white },
  approved:          { bg: colors.statusActive, fg: colors.white },
  rejected:          { bg: colors.statusCritical, fg: colors.white },
  approved_as_noted: { bg: colors.statusPending, fg: colors.white },
};

export interface ReviewerStep {
  id: string | number;
  role: string;
  date?: string;
  status: StepStatus;
}

export function buildFallbackSteps(status: string): ReviewerStep[] {
  let s0: StepStatus = 'pending';
  let s1: StepStatus = 'pending';
  let s2: StepStatus = 'pending';

  if (status === 'pending') {
    s0 = 'current';
  } else if (status === 'submitted' || status === 'under_review' || status === 'review_in_progress') {
    s0 = 'approved'; s1 = 'current';
  } else if (status === 'approved') {
    s0 = 'approved'; s1 = 'approved'; s2 = 'approved';
  } else if (status === 'approved_as_noted') {
    s0 = 'approved'; s1 = 'approved'; s2 = 'approved_as_noted';
  } else if (status === 'rejected' || status === 'revise_resubmit') {
    s0 = 'approved'; s1 = 'approved'; s2 = 'rejected';
  } else {
    s0 = 'current';
  }

  return [
    { id: 1, role: 'Subcontractor', status: s0 },
    { id: 2, role: 'GC Review', status: s1 },
    { id: 3, role: 'Architect Review', status: s2 },
  ];
}

export type ReviewerRow = { id: string; role: string | null; status: string | null; stamp: string | null; comments: string | null; approver_id: string | null };

export function buildReviewerSteps(reviewers: ReviewerRow[]): ReviewerStep[] {
  return reviewers.map((r) => {
    let stepStatus: StepStatus = 'pending';
    if (r.status === 'approved') stepStatus = 'approved';
    else if (r.status === 'approved_as_noted') stepStatus = 'approved_as_noted';
    else if (r.status === 'rejected' || r.status === 'revise_resubmit') stepStatus = 'rejected';
    else if (r.status === 'current' || r.status === 'in_review') stepStatus = 'current';
    return {
      id: r.id,
      role: r.role || 'Reviewer',
      status: stepStatus,
      date: r.stamp ? new Date(r.stamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined,
    };
  });
}

export const BIC_COLORS: Record<string, string> = {
  GC: colors.statusInfo,
  Architect: colors.statusReview,
  Engineer: colors.statusActive,
  Owner: colors.primaryOrange,
  Sub: colors.textSecondary,
};

export const BallInCourtBadge: React.FC<{ value: string | null }> = ({ value }) => {
  if (!value) return null;
  const color = BIC_COLORS[value] ?? colors.textSecondary;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 500,
      backgroundColor: `${color}1A`,
      color,
      whiteSpace: 'nowrap',
    }}>
      {value}
    </span>
  );
};

export const SUBMITTAL_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending:           { bg: colors.surfaceInset, text: colors.textSecondary, label: 'Pending' },
  under_review:      { bg: colors.statusInfoSubtle, text: colors.statusInfo, label: 'Under Review' },
  approved:          { bg: colors.statusActiveSubtle, text: colors.statusActive, label: 'Approved' },
  approved_as_noted: { bg: colors.statusActiveSubtle, text: colors.statusActive, label: 'Approved as Noted' },
  rejected:          { bg: colors.statusCriticalSubtle, text: colors.statusCritical, label: 'Rejected' },
  revise_resubmit:   { bg: colors.statusPendingSubtle, text: colors.statusPending, label: 'Resubmit' },
  resubmit:          { bg: colors.statusPendingSubtle, text: colors.statusPending, label: 'Resubmit' },
};

export function formatCSICode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\s+/g, '');
  if (digits.length === 6 && /^\d{6}$/.test(digits)) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)}`;
  }
  return raw;
}

export function calcBusinessDaysRemaining(dueDateStr: string | null | undefined): number | null {
  if (!dueDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  let bizDays = 0;
  const cur = new Date(today);
  if (due < today) {
    while (cur > due) {
      cur.setDate(cur.getDate() - 1);
      const d = cur.getDay();
      if (d !== 0 && d !== 6) bizDays--;
    }
  } else {
    while (cur < due) {
      const d = cur.getDay();
      if (d !== 0 && d !== 6) bizDays++;
      cur.setDate(cur.getDate() + 1);
    }
  }
  return bizDays;
}

export const SubmittalStatusTag: React.FC<{ status: string }> = ({ status }) => {
  const style = SUBMITTAL_STATUS_STYLES[status] ?? { bg: colors.surfaceInset, text: colors.textSecondary, label: status };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 500,
      backgroundColor: style.bg,
      color: style.text,
      whiteSpace: 'nowrap',
    }}>
      {style.label}
    </span>
  );
};

export function calcDaysInReview(sub: Record<string, unknown>): number | null {
  const startStr = (sub.submission_date || sub.submitted_at || sub.created_at) as string | undefined;
  if (!startStr) return null;
  const start = new Date(startStr);
  start.setHours(0, 0, 0, 0);
  const isResolved = sub.status === 'approved' || sub.status === 'approved_as_noted' || sub.status === 'rejected' || sub.status === 'revise_resubmit';
  const endStr = isResolved ? ((sub.updated_at || sub.approval_date) as string | undefined) : undefined;
  const end = endStr ? new Date(endStr) : new Date();
  end.setHours(0, 0, 0, 0);
  let bizDays = 0;
  const cur = new Date(start);
  while (cur < end) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) bizDays++;
    cur.setDate(cur.getDate() + 1);
  }
  return bizDays;
}

export const CHAIN_COLORS = { green: colors.statusActive, amber: colors.statusPending, gray: colors.borderDefault, red: colors.statusCritical };

export type ChainColor = keyof typeof CHAIN_COLORS;

export function getChainColors(status: string): [ChainColor, ChainColor, ChainColor] {
  if (status === 'pending') return ['amber', 'gray', 'gray'];
  if (status === 'submitted' || status === 'review_in_progress' || status === 'under_review') return ['green', 'amber', 'gray'];
  if (status === 'approved' || status === 'approved_as_noted') return ['green', 'green', 'green'];
  if (status === 'rejected' || status === 'revise_resubmit' || status === 'resubmit') return ['green', 'green', 'red'];
  return ['amber', 'gray', 'gray'];
}

export const MiniApprovalChain: React.FC<{ status: string }> = ({ status }) => {
  const [c0, c1, c2] = getChainColors(status);
  const steps: Array<{ label: string; color: ChainColor }> = [
    { label: 'Sub', color: c0 },
    { label: 'GC', color: c1 },
    { label: 'Arch', color: c2 },
  ];
  return (
    <div aria-label="Approval chain" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          {i > 0 && <div style={{ width: 8, height: 1, backgroundColor: colors.borderLight, flexShrink: 0 }} />}
          <div
            title={step.label}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: CHAIN_COLORS[step.color],
              flexShrink: 0,
            }}
          />
        </React.Fragment>
      ))}
    </div>
  );
};

export const ReviewerStepper: React.FC<{ status: string; reviewers: ReviewerRow[] }> = ({ status, reviewers }) => {
  const steps: ReviewerStep[] = React.useMemo(
    () => reviewers.length ? buildReviewerSteps(reviewers) : buildFallbackSteps(status),
    [reviewers, status],
  );

  return (
    <div aria-label="Approval chain" style={{ display: 'flex', alignItems: 'flex-start' }}>
      {steps.map((step, idx) => {
        const { bg, fg } = STEP_COLORS[step.status];
        const isDone = step.status === 'approved' || step.status === 'approved_as_noted' || step.status === 'rejected';
        const isLast = idx === steps.length - 1;

        return (
          <React.Fragment key={step.id}>
            {/* Circle + label column */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 56 }}>
              <div
                aria-current={step.status === 'current' ? 'step' : undefined}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {step.status === 'approved' && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7l3 3 6-6" stroke={fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {step.status === 'rejected' && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 2l8 8M10 2l-8 8" stroke={fg} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
                {step.status === 'approved_as_noted' && (
                  <span style={{ fontSize: 14, fontWeight: 700, color: fg, lineHeight: 1 }}>~</span>
                )}
                {step.status === 'current' && (
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: fg }} />
                )}
                {step.status === 'pending' && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: fg }} />
                )}
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: step.status === 'current' ? 600 : 400,
                color: step.status === 'pending' ? colors.textTertiary : colors.textSecondary,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                lineHeight: 1.3,
              }}>
                {step.role}
              </span>
              {step.date && (
                <span style={{ fontSize: 10, color: colors.textTertiary, textAlign: 'center', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                  {step.date}
                </span>
              )}
            </div>
            {/* Connector line */}
            {!isLast && (
              <div style={{
                flex: 1,
                height: 2,
                marginTop: 15,
                ...(isDone
                  ? { backgroundColor: colors.statusActive }
                  : {
                      backgroundImage: 'repeating-linear-gradient(90deg, #D1D5DB 0, #D1D5DB 6px, transparent 6px, transparent 12px)',
                      backgroundColor: 'transparent',
                    }
                ),
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

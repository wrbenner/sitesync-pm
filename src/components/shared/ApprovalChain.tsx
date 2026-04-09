import React from 'react';
import { Check, Clock, X } from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

export interface ApprovalStep {
  id: number;
  role: string;
  name: string;
  initials: string;
  status: 'approved' | 'pending' | 'rejected' | 'waiting';
  date?: string;
  comment?: string;
}

interface ApprovalChainProps {
  steps: ApprovalStep[];
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  approved: { icon: <Check size={10} />, color: colors.statusActive, bg: `${colors.statusActive}14`, label: 'Approved' },
  pending: { icon: <Clock size={10} />, color: colors.statusPending, bg: `${colors.statusPending}14`, label: 'Pending Review' },
  rejected: { icon: <X size={10} />, color: colors.statusCritical, bg: `${colors.statusCritical}14`, label: 'Revision Required' },
  waiting: { icon: <Clock size={10} />, color: colors.textTertiary, bg: colors.surfaceInset, label: 'Waiting' },
};

export const ApprovalChain: React.FC<ApprovalChainProps> = ({ steps }) => {
  if (steps.length === 0) {
    return (
      <div style={{
        padding: `${spacing['4']} 0`,
        textAlign: 'center',
        color: colors.textTertiary,
        fontSize: typography.fontSize.sm,
      }}>
        No approval steps configured.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }} role="list" aria-label="Approval chain">
      {steps.map((step, i) => {
        const cfg = statusConfig[step.status];
        const isLast = i === steps.length - 1;
        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], position: 'relative' }} role="listitem">
            {/* Connector line */}
            {!isLast && (
              <div style={{
                position: 'absolute', left: 13, top: 30, bottom: -4,
                width: 2, backgroundColor: step.status === 'approved' ? colors.statusActive : colors.borderSubtle,
              }} />
            )}

            {/* Status dot */}
            <div
              role="img"
              aria-label={cfg.label}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                backgroundColor: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, zIndex: 1, border: `2px solid ${colors.surfaceRaised}`,
              }}
            >
              <span style={{ color: cfg.color }} aria-hidden="true">{cfg.icon}</span>
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : spacing['4'] }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{step.name}</span>
                <span style={{
                  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                  color: cfg.color, backgroundColor: cfg.bg,
                  padding: `0 ${spacing['1']}`, borderRadius: borderRadius.sm,
                }}>
                  {cfg.label}
                </span>
              </div>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: spacing['0.5'] }}>
                {step.role}{step.date ? ` · ${step.date}` : ''}
              </p>
              {step.comment && (
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, marginTop: spacing['1'], fontStyle: 'italic' }}>
                  &quot;{step.comment}&quot;
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

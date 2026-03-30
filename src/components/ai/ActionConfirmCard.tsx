import React from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import type { PendingAction } from '../../hooks/useProjectAI';

interface ActionConfirmCardProps {
  action: PendingAction;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ActionConfirmCard: React.FC<ActionConfirmCardProps> = ({ action, onConfirm, onCancel, isLoading }) => (
  <div style={{
    padding: spacing['4'],
    backgroundColor: colors.orangeSubtle,
    borderRadius: borderRadius.md,
    borderLeft: `3px solid ${colors.primaryOrange}`,
    marginTop: spacing['2'],
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'] }}>
      <AlertCircle size={16} color={colors.primaryOrange} style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>Action Required</p>
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: `${spacing['1']} 0 0`, lineHeight: typography.lineHeight.relaxed }}>{action.description}</p>
        <div style={{ display: 'flex', gap: spacing['2'], marginTop: spacing['3'] }}>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing['1'],
              padding: `${spacing['1']} ${spacing['3']}`,
              fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
              fontWeight: typography.fontWeight.semibold,
              backgroundColor: colors.primaryOrange, color: colors.white,
              border: 'none', borderRadius: borderRadius.sm, cursor: isLoading ? 'wait' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              transition: `opacity ${transitions.quick}`,
            }}
          >
            <Check size={13} /> {isLoading ? 'Executing...' : 'Confirm'}
          </button>
          <button
            onClick={onCancel}
            disabled={isLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing['1'],
              padding: `${spacing['1']} ${spacing['3']}`,
              fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
              fontWeight: typography.fontWeight.medium,
              backgroundColor: 'transparent', color: colors.textTertiary,
              border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.sm,
              cursor: 'pointer',
            }}
          >
            <X size={13} /> Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
);

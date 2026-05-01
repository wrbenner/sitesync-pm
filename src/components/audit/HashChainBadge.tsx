// ── HashChainBadge ─────────────────────────────────────────────────────────
// Compact pill that says "Audit chain intact" or "Audit chain broken — N
// gap(s)". Click to open the gap detail. Drops onto any entity detail
// page next to the title.

import React from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { colors, typography } from '../../styles/theme';
import type { ChainVerificationResult } from '../../lib/audit/hashChainVerifier';

interface HashChainBadgeProps {
  /** When undefined, renders a "verifying…" pill. */
  result: ChainVerificationResult | undefined;
  /** Callback when the user clicks the badge to expand details. */
  onShowDetails?: () => void;
  size?: 'sm' | 'md';
}

export const HashChainBadge: React.FC<HashChainBadgeProps> = ({
  result,
  onShowDetails,
  size = 'sm',
}) => {
  const fontSize = size === 'sm' ? typography.fontSize.label : typography.fontSize.sm;
  const padding = size === 'sm' ? '2px 8px' : '4px 10px';
  const iconSize = size === 'sm' ? 11 : 13;

  if (!result) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding,
          borderRadius: 999,
          background: colors.statusNeutralSubtle,
          color: colors.textSecondary,
          fontSize,
          fontWeight: typography.fontWeight.semibold,
        }}
      >
        <ShieldCheck size={iconSize} />
        Verifying chain…
      </span>
    );
  }

  if (result.ok) {
    return (
      <span
        title={`Hash chain verified across ${result.total} audit entries.`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding,
          borderRadius: 999,
          background: colors.statusActiveSubtle,
          color: colors.statusActive,
          fontSize,
          fontWeight: typography.fontWeight.semibold,
        }}
      >
        <ShieldCheck size={iconSize} />
        Audit chain intact ({result.total})
      </span>
    );
  }

  return (
    <button
      onClick={onShowDetails}
      title={`${result.gaps.length} gap(s) detected. Click to view affected rows.`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding,
        borderRadius: 999,
        border: 'none',
        background: colors.statusCriticalSubtle,
        color: colors.statusCritical,
        fontSize,
        fontWeight: typography.fontWeight.semibold,
        cursor: onShowDetails ? 'pointer' : 'default',
      }}
    >
      <ShieldAlert size={iconSize} />
      Audit chain broken — {result.gaps.length} gap{result.gaps.length === 1 ? '' : 's'}
    </button>
  );
};

export default HashChainBadge;

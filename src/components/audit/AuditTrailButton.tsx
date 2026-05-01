// ── AuditTrailButton ──────────────────────────────────────────────────────
// Small secondary-style header button that opens AuditTrailDrawer for the
// given entity. Drops onto entity detail pages (RFI / Submittal / Punch).
// Click → drawer slides in with the full deposition-grade history.

import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { AuditTrailDrawer } from './AuditTrailDrawer';
import type { AuditEntityType } from './EntityAuditViewer';

// Re-export so detail pages can import the type alongside the button without
// needing to know about EntityAuditViewer's internals.
export type { AuditEntityType };

interface AuditTrailButtonProps {
  entityType: AuditEntityType;
  entityId: string;
  projectId: string;
  /** Defaults to "Audit trail". */
  label?: string;
}

export const AuditTrailButton: React.FC<AuditTrailButtonProps> = ({
  entityType,
  entityId,
  projectId,
  label = 'Audit trail',
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open ${label.toLowerCase()}`}
        title={label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: spacing['1.5'],
          padding: '6px 12px',
          borderRadius: borderRadius.md,
          border: `1px solid ${colors.borderSubtle}`,
          backgroundColor: 'transparent',
          color: colors.textSecondary,
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.medium,
          fontFamily: typography.fontFamily,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: `border-color ${transitions.instant}, color ${transitions.instant}, background-color ${transitions.instant}`,
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.borderColor = colors.borderDefault;
          el.style.color = colors.textPrimary;
          el.style.backgroundColor = colors.surfaceHover;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.borderColor = colors.borderSubtle;
          el.style.color = colors.textSecondary;
          el.style.backgroundColor = 'transparent';
        }}
      >
        <Lock size={16} aria-hidden="true" />
        {label}
      </button>
      <AuditTrailDrawer
        open={open}
        onClose={() => setOpen(false)}
        entityType={entityType}
        entityId={entityId}
        projectId={projectId}
      />
    </>
  );
};

export default AuditTrailButton;

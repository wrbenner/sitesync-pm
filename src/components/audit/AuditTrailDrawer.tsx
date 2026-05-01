// ── AuditTrailDrawer ──────────────────────────────────────────────────────
// Right-side slide-in drawer that hosts EntityAuditViewer for a single
// entity. Composes the existing Drawer primitive + the existing audit
// viewer so the deposition-grade history is one click from any detail
// page header. Keeps EntityAuditViewer untouched — this drawer is purely
// presentational scaffolding.

import React from 'react';
import { Drawer } from '../Drawer';
import { EntityAuditViewer, type AuditEntityType } from './EntityAuditViewer';

interface AuditTrailDrawerProps {
  open: boolean;
  onClose: () => void;
  entityType: AuditEntityType;
  entityId: string;
  projectId: string;
}

// Right-side slide-in drawer that hosts EntityAuditViewer for a single
// entity. Composes the existing Drawer primitive (which already provides
// backdrop click + ESC + slide-in animation) so the deposition-grade
// history reuses the app's standard drawer construction.
export const AuditTrailDrawer: React.FC<AuditTrailDrawerProps> = ({
  open,
  onClose,
  entityType,
  entityId,
  projectId,
}) => {
  return (
    <Drawer open={open} onClose={onClose} title="Audit trail" width="560px">
      <EntityAuditViewer
        entityType={entityType}
        entityId={entityId}
        projectId={projectId}
      />
    </Drawer>
  );
};

export default AuditTrailDrawer;

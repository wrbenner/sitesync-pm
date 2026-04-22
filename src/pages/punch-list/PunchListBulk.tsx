import React from 'react';
import { CheckCircle, ArrowUp, Trash2 } from 'lucide-react';
import { BulkActionBar } from '../../components/shared/BulkActionBar';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { toast } from 'sonner';

interface PunchListBulkProps {
  bulkSelected: Set<string>;
  setBulkSelected: (s: Set<string>) => void;
  updatePunchItem: {
    mutateAsync: (args: { id: string; updates: Record<string, unknown>; projectId: string }) => Promise<unknown>;
  };
  deletePunchItem?: {
    mutateAsync: (args: { id: string; projectId: string }) => Promise<unknown>;
  };
  projectId: string | null;
}

export const PunchListBulk: React.FC<PunchListBulkProps> = ({
  bulkSelected,
  setBulkSelected,
  updatePunchItem,
  deletePunchItem,
  projectId,
}) => {
  return (
    <PermissionGate permission="punch_list.edit">
      <BulkActionBar
        selectedIds={Array.from(bulkSelected)}
        onClearSelection={() => setBulkSelected(new Set())}
        entityLabel="punch items"
        actions={[
          {
            label: 'Mark Complete',
            icon: <CheckCircle size={14} />,
            variant: 'primary',
            onClick: async (ids) => {
              for (const id of ids) {
                await updatePunchItem.mutateAsync({ id, updates: { verification_status: 'sub_complete', sub_completed_at: new Date().toISOString() }, projectId: projectId! });
              }
              toast.success(`${ids.length} items marked Sub Complete. Superintendent notified.`);
              setBulkSelected(new Set());
            },
          },
          {
            label: 'Change Priority',
            icon: <ArrowUp size={14} />,
            onClick: async (ids) => {
              for (const id of ids) {
                await updatePunchItem.mutateAsync({ id, updates: { priority: 'high' }, projectId: projectId! });
              }
              toast.success(`${ids.length} items set to high priority`);
              setBulkSelected(new Set());
            },
          },
          {
            label: 'Delete',
            icon: <Trash2 size={14} />,
            variant: 'danger',
            confirm: true,
            confirmMessage: `Are you sure you want to delete ${bulkSelected.size} punch items? This cannot be undone.`,
            onClick: async (ids) => {
              if (!deletePunchItem || !projectId) {
                toast.error('Delete unavailable');
                return;
              }
              let ok = 0;
              for (const id of ids) {
                try {
                  await deletePunchItem.mutateAsync({ id, projectId });
                  ok++;
                } catch (e) {
                  toast.error(`Failed to delete ${id}: ${(e as Error).message}`);
                }
              }
              if (ok > 0) toast.success(`${ok} item${ok > 1 ? 's' : ''} deleted`);
              setBulkSelected(new Set());
            },
          },
        ]}
      />
    </PermissionGate>
  );
};

/**
 * ColumnMappingModal — overlay shown after a CSV is dropped.
 * Wraps ColumnMapper with a confirm/cancel pair.
 */

import React from 'react';
import { ColumnMapper } from '../../../components/integrations/ColumnMapper';
import type { ColumnMap } from '../../../types/integrations';
import { colors, typography } from '../../../styles/theme';

interface ColumnMappingModalProps {
  open: boolean;
  headers: string[];
  value: ColumnMap;
  onChange: (next: ColumnMap) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  open,
  headers,
  value,
  onChange,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Map columns"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          maxWidth: 640,
          width: '90%',
          padding: 32,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <ColumnMapper headers={headers} value={value} onChange={onChange} />
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              fontFamily: typography.fontFamily.sans,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              color: colors.textTertiary,
              cursor: 'pointer',
              minHeight: 56,
              padding: '0 16px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-primary)',
              fontFamily: typography.fontFamily.sans,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              color: colors.primaryOrange,
              cursor: 'pointer',
              minHeight: 56,
              padding: '0 24px',
            }}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
};

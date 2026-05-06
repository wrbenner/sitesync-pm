import React from 'react';
import { STATUS_COLORS, statusLabel } from './types';

// Status pill — colored dot + label, used in the table, grouped views,
// and the detail panel pipeline. Single shared definition so deleting the
// legacy PunchListTable doesn't take it down with it.
export const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.open;
  const label = statusLabel[status] ?? status;
  return (
    <span
      role="img"
      aria-label={`Status: ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 999,
        backgroundColor: `${color}14`,
        fontFamily: 'inherit',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 11, fontWeight: 600, color, whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </span>
  );
};

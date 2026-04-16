import React from 'react';
import { Shield } from 'lucide-react';
import { Card, Btn } from '../../components/Primitives';
import { DataTable, createColumnHelper } from '../../components/shared/DataTable';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { getSeverityStyle } from './safetyTypes';

const incidentCol = createColumnHelper<Record<string, unknown>>();

const incidentColumns = [
  incidentCol.accessor('date', {
    header: 'Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue() as string).toLocaleDateString() : ''}
      </span>
    ),
  }),
  incidentCol.accessor('type', {
    header: 'Type',
    cell: (info) => {
      const v = info.getValue() as string;
      return <span style={{ color: colors.textPrimary }}>{v ? v.replace(/_/g, ' ') : ''}</span>;
    },
  }),
  incidentCol.accessor('severity', {
    header: 'Severity',
    cell: (info) => {
      const { fg, bg, label } = getSeverityStyle(info.getValue() as string | null);
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: fg, backgroundColor: bg }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: fg }} />
          {label}
        </span>
      );
    },
  }),
  incidentCol.accessor('location', {
    header: 'Location',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() as string}</span>,
  }),
  incidentCol.accessor('investigation_status', {
    header: 'Status',
    cell: (info) => {
      const v = (info.getValue() as string) || 'open';
      const c = v === 'closed' ? colors.statusActive : v === 'investigating' ? colors.statusPending : colors.statusInfo;
      return <span style={{ color: c, fontWeight: typography.fontWeight.medium }}>{v.charAt(0).toUpperCase() + v.slice(1)}</span>;
    },
  }),
  incidentCol.accessor('injured_party_name', {
    header: 'Involved Party',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{(info.getValue() as string) || '—'}</span>,
  }),
  incidentCol.display({
    id: 'ca_count',
    header: 'Corrective Actions',
    cell: (info) => {
      const count = (info.row.original as Record<string, unknown>).corrective_action_count as number ?? 0;
      if (count === 0) return <span style={{ color: colors.textTertiary }}>None</span>;
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.primaryOrange, backgroundColor: colors.orangeSubtle }}>
          {count}
        </span>
      );
    },
  }),
];

interface IncidentListProps {
  incidents: unknown[];
  onReportIncident: () => void;
}

export const IncidentList: React.FC<IncidentListProps> = ({ incidents, onReportIncident }) => {
  if (incidents.length === 0) {
    return (
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing['10']} ${spacing['6']}`, gap: spacing['4'], textAlign: 'center' }}>
          <Shield size={48} style={{ color: colors.textTertiary }} />
          <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary, maxWidth: 420 }}>
            Safety tracking not yet configured. Set up your safety program to track incidents, inspections, and certifications.
          </p>
          <div style={{ display: 'flex', gap: spacing['3'], flexWrap: 'wrap', justifyContent: 'center' }}>
            <Btn variant="primary" onClick={onReportIncident} style={{ minHeight: 56 }}>Report First Incident</Btn>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <Card>
        <DataTable columns={incidentColumns} data={incidents} enableSorting />
      </Card>
    </div>
  );
};

import React from 'react';
import { Plus, Clock, AlertCircle, Zap } from 'lucide-react';
import { Card, SectionHeader, Btn, MetricBox, PriorityTag, StatusTag, TableHeader, TableRow } from '../components/Primitives';
import { colors, spacing, typography } from '../styles/theme';
import { rfis, metrics } from '../data/mockData';

export const RFIs: React.FC = () => {
  const overdueDays = rfis.filter((r) => new Date(r.dueDate) < new Date()).length;

  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: colors.lightBackground,
        padding: spacing.xl,
        marginLeft: '260px',
      }}
    >
      <SectionHeader
        title="RFIs"
        action={<Btn variant="primary" size="md" icon={<Plus size={16} />}>New RFI</Btn>}
      />

      {/* Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: spacing.lg,
          marginBottom: spacing.xl,
        }}
      >
        <MetricBox
          label="Open RFIs"
          value={metrics.rfiOpen}
          icon={<AlertCircle color={colors.amber} />}
        />
        <MetricBox
          label="Avg Response Time"
          value="3.2"
          unit="days"
          icon={<Clock color={colors.blue} />}
        />
        <MetricBox
          label="Overdue"
          value={overdueDays}
          icon={<AlertCircle color={colors.red} />}
        />
        <MetricBox
          label="AI Routed"
          value="78"
          unit="%"
          icon={<Zap color={colors.green} />}
        />
      </div>

      {/* RFIs Table */}
      <Card padding="0">
        <TableHeader
          columns={[
            { label: 'RFI #', width: '100px' as string },
            { label: 'Title', width: '1fr' as string },
            { label: 'From', width: '150px' as string },
            { label: 'To', width: '150px' as string },
            { label: 'Priority', width: '100px' as string },
            { label: 'Status', width: '130px' as string },
            { label: 'Due Date', width: '110px' as string },
          ]}
        />
        {rfis.map((rfi, index) => (
          <TableRow
            key={rfi.id}
            divider={index < rfis.length - 1}
            columns={[
              {
                width: '100px' as string,
                content: (
                  <span
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.primaryOrange,
                    }}
                  >
                    {rfi.rfiNumber}
                  </span>
                ),
              },
              {
                width: '1fr' as string,
                content: (
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                    {rfi.title}
                  </span>
                ),
              },
              {
                width: '150px' as string,
                content: (
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                    {rfi.from}
                  </span>
                ),
              },
              {
                width: '150px' as string,
                content: (
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                    {rfi.to}
                  </span>
                ),
              },
              {
                width: '100px' as string,
                content: <PriorityTag priority={rfi.priority as any} />,
              },
              {
                width: '130px' as string,
                content: <StatusTag status={rfi.status as any} />,
              },
              {
                width: '110px' as string,
                content: (
                  <span
                    style={{
                      fontSize: typography.fontSize.sm,
                      color:
                        new Date(rfi.dueDate) < new Date()
                          ? colors.red
                          : colors.textSecondary,
                    }}
                  >
                    {rfi.dueDate}
                  </span>
                ),
              },
            ]}
          />
        ))}
      </Card>
    </main>
  );
};

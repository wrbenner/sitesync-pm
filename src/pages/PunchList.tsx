import React from 'react';
import { Plus, Camera, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, SectionHeader, Btn, MetricBox, PriorityTag, StatusTag, TableHeader, TableRow } from '../components/Primitives';
import { colors, spacing, typography } from '../styles/theme';
import { punchList } from '../data/mockData';

export const PunchList: React.FC = () => {
  const openCount = punchList.filter((p) => p.status === 'open').length;
  const inProgressCount = punchList.filter((p) => p.status === 'in_progress').length;
  const completeCount = punchList.filter((p) => p.status === 'complete').length;

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
        title="Punch List"
        action={<Btn variant="primary" size="md" icon={<Plus size={16} />}>Add Item</Btn>}
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
          label="Open"
          value={openCount}
          icon={<AlertTriangle color={colors.red} />}
        />
        <MetricBox
          label="In Progress"
          value={inProgressCount}
          icon={<AlertTriangle color={colors.amber} />}
        />
        <MetricBox
          label="Complete"
          value={completeCount}
          icon={<CheckCircle color={colors.green} />}
        />
      </div>

      {/* Punch Items Table */}
      <Card padding="0">
        <TableHeader
          columns={[
            { label: 'Item #', width: '100px' as string },
            { label: 'Area', width: '150px' as string },
            { label: 'Description', width: '1fr' as string },
            { label: 'Assigned', width: '130px' as string },
            { label: 'Priority', width: '100px' as string },
            { label: 'Status', width: '120px' as string },
          ]}
        />
        {punchList.map((item, index) => (
          <TableRow
            key={item.id}
            divider={index < punchList.length - 1}
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
                    {item.itemNumber}
                  </span>
                ),
              },
              {
                width: '150px' as string,
                content: (
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                    {item.area}
                  </span>
                ),
              },
              {
                width: '1fr',
                content: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                      {item.description}
                    </span>
                    {item.hasPhoto && <Camera size={14} color={colors.blue} />}
                  </div>
                ),
              },
              {
                width: '130px',
                content: (
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                    {item.assigned}
                  </span>
                ),
              },
              {
                width: '100px',
                content: <PriorityTag priority={item.priority as any} />,
              },
              {
                width: '120px',
                content: (
                  <StatusTag
                    status={
                      item.status === 'open'
                        ? 'pending'
                        : item.status === 'in_progress'
                          ? 'approved'
                          : 'complete'
                    }
                    label={
                      item.status === 'open'
                        ? 'Open'
                        : item.status === 'in_progress'
                          ? 'In Progress'
                          : 'Complete'
                    }
                  />
                ),
              },
            ]}
          />
        ))}
      </Card>
    </main>
  );
};

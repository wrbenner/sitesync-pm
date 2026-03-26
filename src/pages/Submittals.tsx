import React from 'react';
import { Plus } from 'lucide-react';
import { Card, SectionHeader, Btn, PriorityTag, StatusTag, TableHeader, TableRow } from '../components/Primitives';
import { colors, spacing, typography } from '../styles/theme';
import { submittals } from '../data/mockData';

export const Submittals: React.FC = () => {
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
        title="Submittals"
        action={<Btn variant="primary" size="md" icon={<Plus size={16} />}>New Submittal</Btn>}
      />

      {/* Submittals Table */}
      <Card padding="0">
        <TableHeader
          columns={[
            { label: 'Submittal #', width: '120px' as string },
            { label: 'Title', width: '1fr' as string },
            { label: 'From', width: '150px' as string },
            { label: 'Priority', width: '100px' as string },
            { label: 'Status', width: '150px' as string },
            { label: 'Due Date', width: '110px' as string },
          ]}
        />
        {submittals.map((submittal, index) => (
          <TableRow
            key={submittal.id}
            divider={index < submittals.length - 1}
            columns={[
              {
                width: '120px' as string,
                content: (
                  <span
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.primaryOrange,
                    }}
                  >
                    {submittal.submittalNumber}
                  </span>
                ),
              },
              {
                width: '1fr' as string,
                content: (
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                    {submittal.title}
                  </span>
                ),
              },
              {
                width: '150px' as string,
                content: (
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                    {submittal.from}
                  </span>
                ),
              },
              {
                width: '100px' as string,
                content: <PriorityTag priority={submittal.priority as any} />,
              },
              {
                width: '150px' as string,
                content: <StatusTag status={submittal.status as any} />,
              },
              {
                width: '110px' as string,
                content: (
                  <span
                    style={{
                      fontSize: typography.fontSize.sm,
                      color:
                        new Date(submittal.dueDate) < new Date()
                          ? colors.red
                          : colors.textSecondary,
                    }}
                  >
                    {submittal.dueDate}
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

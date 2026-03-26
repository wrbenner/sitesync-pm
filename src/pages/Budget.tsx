import React from 'react';
import { DollarSign, TrendingDown, Lock, AlertCircle } from 'lucide-react';
import { Card, SectionHeader, MetricBox, StatusTag, TableHeader, TableRow } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { costData, projectData } from '../data/mockData';

export const Budget: React.FC = () => {
  const committed = costData.divisions.reduce((sum, d) => sum + d.committed, 0);
  const spent = costData.divisions.reduce((sum, d) => sum + d.spent, 0);
  const remaining = projectData.totalValue - spent - committed;

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
      <SectionHeader title="Budget" />

      {/* Summary Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: spacing.lg,
          marginBottom: spacing.xl,
        }}
      >
        <MetricBox
          label="Total Project"
          value={`$${(projectData.totalValue / 1000000).toFixed(1)}M`}
          icon={<DollarSign color={colors.blue} />}
        />
        <MetricBox
          label="Spent to Date"
          value={`$${(spent / 1000000).toFixed(1)}M`}
          icon={<TrendingDown color={colors.red} />}
        />
        <MetricBox
          label="Committed"
          value={`$${(committed / 1000000).toFixed(1)}M`}
          icon={<Lock color={colors.amber} />}
        />
        <MetricBox
          label="Remaining"
          value={`$${(remaining / 1000000).toFixed(1)}M`}
          icon={<AlertCircle color={colors.green} />}
        />
      </div>

      {/* Cost Breakdown */}
      <div style={{ marginBottom: spacing.xl }}>
        <SectionHeader title="Cost by Division" />
        <Card padding={spacing.lg}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
            {costData.divisions.map((division) => {
              const spentPercent = (division.spent / division.budget) * 100;
              const committedPercent = ((division.spent + division.committed) / division.budget) * 100;

              return (
                <div key={division.id}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: spacing.sm,
                    }}
                  >
                    <span
                      style={{
                        fontSize: typography.fontSize.sm,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.textPrimary,
                      }}
                    >
                      {division.name}
                    </span>
                    <span
                      style={{
                        fontSize: typography.fontSize.sm,
                        color: colors.textSecondary,
                      }}
                    >
                      ${(division.spent / 1000000).toFixed(1)}M / ${(division.budget / 1000000).toFixed(1)}M
                    </span>
                  </div>

                  <div
                    style={{
                      height: '24px',
                      backgroundColor: colors.lightBackground,
                      borderRadius: borderRadius.sm,
                      overflow: 'hidden',
                      display: 'flex',
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    {/* Spent */}
                    <div
                      style={{
                        width: `${spentPercent}%`,
                        backgroundColor: colors.red,
                        transition: 'width 300ms ease-in-out',
                      }}
                    />
                    {/* Committed */}
                    <div
                      style={{
                        width: `${committedPercent - spentPercent}%`,
                        backgroundColor: colors.amber,
                        transition: 'width 300ms ease-in-out',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: spacing.md,
                      marginTop: spacing.sm,
                      fontSize: typography.fontSize.xs,
                      color: colors.textTertiary,
                    }}
                  >
                    <span>
                      <span style={{ color: colors.red }}>●</span> Spent {spentPercent.toFixed(0)}%
                    </span>
                    <span>
                      <span style={{ color: colors.amber }}>●</span> Committed
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Change Orders */}
      <div>
        <SectionHeader title="Change Orders" />
        <Card padding="0">
          <TableHeader
            columns={[
              { label: 'CO #', width: '100px' as string },
              { label: 'Title', width: '1fr' as string },
              { label: 'Amount', width: '130px' as string },
              { label: 'Status', width: '150px' as string },
            ]}
          />
          {costData.changeOrders.map((co, index) => (
            <TableRow
              key={co.id}
              divider={index < costData.changeOrders.length - 1}
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
                      {co.coNumber}
                    </span>
                  ),
                },
                {
                  width: '1fr' as string,
                  content: (
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                      {co.title}
                    </span>
                  ),
                },
                {
                  width: '130px' as string,
                  content: (
                    <span
                      style={{
                        fontSize: typography.fontSize.sm,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.red,
                      }}
                    >
                      ${(co.amount / 1000).toFixed(0)}K
                    </span>
                  ),
                },
                {
                  width: '150px' as string,
                  content: (
                    <StatusTag
                      status={co.status === 'approved' ? 'approved' : 'pending'}
                      label={co.status === 'approved' ? 'Approved' : 'Pending Approval'}
                    />
                  ),
                },
              ]}
            />
          ))}
        </Card>
      </div>
    </main>
  );
};

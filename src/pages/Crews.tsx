import React from 'react';
import { MapPin } from 'lucide-react';
import { Card, SectionHeader, Dot, TableHeader, TableRow } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { crews } from '../data/mockData';

export const Crews: React.FC = () => {
  const activeCrew = crews.filter((c) => c.status === 'active');

  const getStatusColor = (eta: string): string => {
    if (eta.includes('ahead')) return colors.tealSuccess;
    if (eta.includes('behind')) return colors.red;
    return colors.blue;
  };

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
      <SectionHeader title="Crews" />

      {/* Live Site View */}
      <div style={{ marginBottom: spacing.xl }}>
        <h2
          style={{
            fontSize: typography.fontSize.xl,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            margin: 0,
            marginBottom: spacing.lg,
          }}
        >
          Live Site
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: spacing.lg,
            marginBottom: spacing.xl,
          }}
        >
          {activeCrew.map((crew) => (
            <Card key={crew.id} padding={spacing.lg}>
              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: spacing.md }}>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.textPrimary,
                      margin: 0,
                      marginBottom: spacing.xs,
                    }}
                  >
                    {crew.name}
                  </p>
                  <p
                    style={{
                      fontSize: typography.fontSize.xs,
                      color: colors.textSecondary,
                      margin: 0,
                    }}
                  >
                    {crew.size} workers
                  </p>
                </div>
                <Dot color={colors.tealSuccess} pulse size={10} />
              </div>

              <div
                style={{
                  backgroundColor: colors.lightBackground,
                  padding: spacing.md,
                  borderRadius: borderRadius.sm,
                  marginBottom: spacing.md,
                }}
              >
                <p
                  style={{
                    fontSize: typography.fontSize.xs,
                    color: colors.textSecondary,
                    margin: 0,
                    marginBottom: spacing.xs,
                  }}
                >
                  Location
                </p>
                <p
                  style={{
                    fontSize: typography.fontSize.sm,
                    color: colors.textPrimary,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                  }}
                >
                  <MapPin size={14} />
                  {crew.location}
                </p>
              </div>

              <div style={{ marginBottom: spacing.md }}>
                <p
                  style={{
                    fontSize: typography.fontSize.xs,
                    color: colors.textSecondary,
                    margin: 0,
                    marginBottom: spacing.xs,
                  }}
                >
                  Productivity
                </p>
                <div
                  style={{
                    height: '4px',
                    backgroundColor: colors.border,
                    borderRadius: borderRadius.full,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${crew.productivity}%`,
                      backgroundColor: crew.productivity >= 90 ? colors.tealSuccess : colors.amber,
                    }}
                  />
                </div>
                <p
                  style={{
                    fontSize: typography.fontSize.xs,
                    color: colors.textSecondary,
                    margin: 0,
                    marginTop: spacing.xs,
                  }}
                >
                  {crew.productivity}% of target
                </p>
              </div>

              <p
                style={{
                  fontSize: typography.fontSize.xs,
                  color: getStatusColor(crew.eta),
                  margin: 0,
                  fontWeight: typography.fontWeight.semibold,
                }}
              >
                {crew.eta}
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* Crews Table */}
      <div>
        <h2
          style={{
            fontSize: typography.fontSize.xl,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            margin: 0,
            marginBottom: spacing.lg,
          }}
        >
          All Crews
        </h2>
        <Card padding="0">
          <TableHeader
            columns={[
              { label: 'Crew / Task', width: '150px' as string },
              { label: 'Location', width: '150px' as string },
              { label: 'Size', width: '80px' as string },
              { label: 'Productivity', width: '1fr' as string },
              { label: 'ETA', width: '120px' as string },
            ]}
          />
          {crews.map((crew, index) => (
            <TableRow
              key={crew.id}
              divider={index < crews.length - 1}
              columns={[
                {
                  width: '150px' as string,
                  content: (
                    <div>
                      <p
                        style={{
                          fontSize: typography.fontSize.sm,
                          fontWeight: typography.fontWeight.semibold,
                          color: colors.textPrimary,
                          margin: 0,
                        }}
                      >
                        {crew.name}
                      </p>
                      <p
                        style={{
                          fontSize: typography.fontSize.xs,
                          color: colors.textSecondary,
                          margin: 0,
                        }}
                      >
                        {crew.task}
                      </p>
                    </div>
                  ),
                },
                {
                  width: '150px' as string,
                  content: (
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                      {crew.location}
                    </span>
                  ),
                },
                {
                  width: '80px' as string,
                  content: (
                    <span
                      style={{
                        fontSize: typography.fontSize.sm,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.textPrimary,
                      }}
                    >
                      {crew.size}
                    </span>
                  ),
                },
                {
                  width: '1fr' as string,
                  content: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                      <div
                        style={{
                          height: '6px',
                          width: '100px',
                          backgroundColor: colors.border,
                          borderRadius: borderRadius.full,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${crew.productivity}%`,
                            backgroundColor:
                              crew.productivity >= 90
                                ? colors.tealSuccess
                                : crew.productivity >= 75
                                  ? colors.amber
                                  : colors.red,
                          }}
                        />
                      </div>
                      <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                        {crew.productivity}%
                      </span>
                    </div>
                  ),
                },
                {
                  width: '120px' as string,
                  content: (
                    <span
                      style={{
                        fontSize: typography.fontSize.sm,
                        color: getStatusColor(crew.eta),
                        fontWeight: typography.fontWeight.medium,
                      }}
                    >
                      {crew.eta}
                    </span>
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

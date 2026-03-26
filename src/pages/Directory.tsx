import React from 'react';
import { Building2 } from 'lucide-react';
import { Card, SectionHeader, TableHeader, TableRow } from '../components/Primitives';
import { colors, spacing, typography } from '../styles/theme';
import { directory } from '../data/mockData';

export const Directory: React.FC = () => {
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
      <SectionHeader title="Directory" subtitle="Project stakeholders and contacts" />

      {/* Directory Table */}
      <Card padding="0">
        <TableHeader
          columns={[
            { label: 'Company', width: '180px' as string },
            { label: 'Role', width: '150px' as string },
            { label: 'Contact Name', width: '150px' as string },
            { label: 'Phone', width: '130px' as string },
            { label: 'Email', width: '1fr' as string },
          ]}
        />
        {directory.map((entry, index) => (
          <TableRow
            key={entry.id}
            divider={index < directory.length - 1}
            columns={[
              {
                width: '180px' as string,
                content: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <Building2 size={16} color={colors.textSecondary} />
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                      {entry.company}
                    </span>
                  </div>
                ),
              },
              {
                width: '150px' as string,
                content: (
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                    {entry.role}
                  </span>
                ),
              },
              {
                width: '150px' as string,
                content: (
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                    {entry.contactName}
                  </span>
                ),
              },
              {
                width: '130px' as string,
                content: (
                  <a
                    href={`tel:${entry.phone}`}
                    style={{
                      fontSize: typography.fontSize.sm,
                      color: colors.blue,
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none';
                    }}
                  >
                    {entry.phone}
                  </a>
                ),
              },
              {
                width: '1fr' as string,
                content: (
                  <a
                    href={`mailto:${entry.email}`}
                    style={{
                      fontSize: typography.fontSize.sm,
                      color: colors.blue,
                      textDecoration: 'none',
                      cursor: 'pointer',
                      wordBreak: 'break-all',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none';
                    }}
                  >
                    {entry.email}
                  </a>
                ),
              },
            ]}
          />
        ))}
      </Card>
    </main>
  );
};

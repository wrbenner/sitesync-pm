import React from 'react';
import { Folder, File, MoreVertical } from 'lucide-react';
import { Card, SectionHeader, TableHeader, TableRow } from '../components/Primitives';
import { colors, spacing, typography } from '../styles/theme';
import { files } from '../data/mockData';

export const Files: React.FC = () => {
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
      <SectionHeader title="Files" subtitle="Project documents and resources" />

      {/* Files Table */}
      <Card padding="0">
        <TableHeader
          columns={[
            { label: 'Name', width: '1fr' as string },
            { label: 'Type', width: '100px' as string },
            { label: 'Size / Count', width: '130px' as string },
            { label: 'Modified', width: '120px' as string },
            { label: '', width: '40px' as string },
          ]}
        />
        {files.map((file, index) => (
          <TableRow
            key={file.id}
            divider={index < files.length - 1}
            columns={[
              {
                width: '1fr' as string,
                content: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                    {file.type === 'folder' ? (
                      <Folder size={16} color={colors.amber} />
                    ) : (
                      <File size={16} color={colors.blue} />
                    )}
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                      {file.name}
                    </span>
                  </div>
                ),
              },
              {
                width: '100px' as string,
                content: (
                  <span
                    style={{
                      fontSize: typography.fontSize.sm,
                      color: colors.textSecondary,
                      textTransform: 'capitalize',
                    }}
                  >
                    {file.type}
                  </span>
                ),
              },
              {
                width: '130px' as string,
                content: (
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                    {file.type === 'folder'
                      ? `${file.itemCount} items`
                      : file.size}
                  </span>
                ),
              },
              {
                width: '120px' as string,
                content: (
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                    {file.modifiedDate}
                  </span>
                ),
              },
              {
                width: '40px' as string,
                content: (
                  <button
                    style={{
                      width: 28,
                      height: 28,
                      padding: 0,
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background-color 150ms',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.lightBackground;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <MoreVertical size={14} color={colors.textSecondary} />
                  </button>
                ),
              },
            ]}
          />
        ))}
      </Card>
    </main>
  );
};

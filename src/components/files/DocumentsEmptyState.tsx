import React from 'react';
import { FolderOpen } from 'lucide-react';
import { Btn } from '../Primitives';
import { colors, spacing, typography } from '../../styles/theme';

interface DocumentsEmptyStateProps {
  onUpload: () => void;
}

export const DocumentsEmptyState: React.FC<DocumentsEmptyStateProps> = ({ onUpload }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: `${spacing['16']} ${spacing['4']}`,
      textAlign: 'center',
    }}
  >
    <FolderOpen size={48} color={colors.textTertiary} style={{ marginBottom: spacing['4'] }} />
    <h3
      style={{
        fontSize: typography.fontSize.title,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
        margin: 0,
        marginBottom: spacing['2'],
      }}
    >
      No documents yet
    </h3>
    <p
      style={{
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
        margin: 0,
        marginBottom: spacing['5'],
        maxWidth: 400,
        lineHeight: 1.6,
      }}
    >
      Upload drawings, specs, contracts, and reports to keep your project organized
    </p>
    <Btn variant="primary" onClick={onUpload}>Upload Files</Btn>
  </div>
);

import React from 'react';
import { Layers } from 'lucide-react';
import { Btn } from '../Primitives';
import { colors, spacing, typography } from '../../styles/theme';

interface DrawingsEmptyStateProps {
  onUpload: () => void;
}

export const DrawingsEmptyState: React.FC<DrawingsEmptyStateProps> = ({ onUpload }) => (
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
    <Layers size={48} color={colors.textTertiary} style={{ marginBottom: spacing['4'] }} />
    <h3
      style={{
        fontSize: typography.fontSize.title,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
        margin: 0,
        marginBottom: spacing['2'],
      }}
    >
      No drawings yet
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
      Upload drawing sets to track revisions, coordinate disciplines, and review sheets
    </p>
    <Btn variant="primary" onClick={onUpload}>Upload Set</Btn>
  </div>
);

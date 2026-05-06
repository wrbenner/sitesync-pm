import React from 'react';
import { FileText } from 'lucide-react';
import { colors, spacing, typography } from '../../styles/theme';

interface DrawingsEmptyStateProps {
  onUpload: () => void;
}

export const DrawingsEmptyState: React.FC<DrawingsEmptyStateProps> = ({ onUpload }) => (
  <div
    aria-label="Empty drawings state"
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: `${spacing['16']} ${spacing['4']}`,
      textAlign: 'center',
    }}
  >
    <FileText size={48} color={colors.ink4} style={{ marginBottom: spacing['4'] }} />
    <h3
      style={{
        fontFamily: typography.fontFamilySerif,
        fontSize: 22,
        fontWeight: 400,
        letterSpacing: '-0.02em',
        color: colors.textPrimary,
        margin: 0,
        marginBottom: spacing['2'],
      }}
    >
      No drawings uploaded yet
    </h3>
    <p
      style={{
        fontFamily: typography.fontFamily,
        fontSize: 14,
        color: colors.textSecondary,
        margin: 0,
        marginBottom: spacing['5'],
        maxWidth: 400,
        lineHeight: 1.6,
      }}
    >
      Upload your plans to enable digital markup, RFI linking, and AI coordination analysis.
    </p>
    <button
      onClick={onUpload}
      style={{
        background: colors.primaryOrange,
        color: colors.white,
        borderRadius: 8,
        height: 40,
        paddingLeft: 20,
        paddingRight: 20,
        border: 'none',
        fontFamily: typography.fontFamily,
        fontWeight: 600,
        fontSize: 14,
        cursor: 'pointer',
      }}
    >
      Upload Drawings
    </button>
  </div>
);

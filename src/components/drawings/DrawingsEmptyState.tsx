import React from 'react';
import { FileText } from 'lucide-react';
import { spacing } from '../../styles/theme';

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
    <FileText size={48} color="#9CA3AF" style={{ marginBottom: spacing['4'] }} />
    <h3
      style={{
        fontSize: 18,
        fontWeight: 600,
        color: '#111827',
        margin: 0,
        marginBottom: spacing['2'],
      }}
    >
      No drawings uploaded yet
    </h3>
    <p
      style={{
        fontSize: 14,
        color: '#6B7280',
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
        background: '#F47820',
        color: '#FFFFFF',
        borderRadius: 8,
        height: 40,
        paddingLeft: 20,
        paddingRight: 20,
        border: 'none',
        fontWeight: 600,
        fontSize: 14,
        cursor: 'pointer',
      }}
    >
      Upload Drawings
    </button>
  </div>
);

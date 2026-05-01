/**
 * CsvDropZone — drag-drop area for a single CSV file. Hairline border,
 * no decorative chrome.
 */

import React, { useCallback, useState } from 'react';
import { colors, typography } from '../../styles/theme';

interface CsvDropZoneProps {
  onFile: (filename: string, content: string) => void;
}

export const CsvDropZone: React.FC<CsvDropZoneProps> = ({ onFile }) => {
  const [hovering, setHovering] = useState(false);
  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const f = files[0];
      const text = await f.text();
      onFile(f.name, text);
    },
    [onFile],
  );
  return (
    <label
      onDragEnter={(e) => {
        e.preventDefault();
        setHovering(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setHovering(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHovering(false);
        handleFiles(e.dataTransfer.files);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 160,
        border: `1px dashed ${hovering ? colors.primaryOrange : 'var(--hairline)'}`,
        cursor: 'pointer',
        fontFamily: typography.fontFamily.serif,
        fontStyle: 'italic',
        color: colors.textSecondary,
        padding: 32,
        textAlign: 'center',
      }}
    >
      <input
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      Drop a CSV here, or click to choose a file.
    </label>
  );
};

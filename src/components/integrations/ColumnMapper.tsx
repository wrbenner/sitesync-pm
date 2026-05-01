/**
 * ColumnMapper — UI for matching incoming CSV header columns to
 * SiteSync's expected fields (code, name, division, type, rate).
 *
 * The admin sees the importer's default mapping pre-applied; they
 * can override per-row before parsing.
 */

import React from 'react';
import { Eyebrow } from '../atoms';
import { colors, typography } from '../../styles/theme';
import type { ColumnMap } from '../../types/integrations';

interface ColumnMapperProps {
  headers: string[];
  value: ColumnMap;
  onChange: (next: ColumnMap) => void;
}

const FIELDS: Array<{ key: keyof ColumnMap; label: string; required?: boolean }> = [
  { key: 'code', label: 'Code', required: true },
  { key: 'name', label: 'Name', required: true },
  { key: 'division', label: 'Division' },
  { key: 'type', label: 'Type' },
  { key: 'rate', label: 'Rate' },
];

export const ColumnMapper: React.FC<ColumnMapperProps> = ({ headers, value, onChange }) => {
  return (
    <div role="group" aria-label="Column mapping">
      <Eyebrow>Map columns</Eyebrow>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {FIELDS.map((f) => (
          <label
            key={f.key}
            style={{
              display: 'grid',
              gridTemplateColumns: '160px 1fr',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <span
              style={{
                fontFamily: typography.fontFamily.sans,
                fontSize: 13,
                color: colors.textSecondary,
              }}
            >
              {f.label}
              {f.required && <span style={{ color: colors.primaryOrange, marginLeft: 4 }}>*</span>}
            </span>
            <select
              value={value[f.key] ?? ''}
              onChange={(e) => onChange({ ...value, [f.key]: e.target.value || undefined })}
              style={{
                minHeight: 56,
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--hairline)',
                fontFamily: typography.fontFamily.sans,
                fontSize: 14,
                padding: '8px 0',
              }}
            >
              <option value="">—</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
};

/**
 * CsvValidator — surfaces row-level validation errors on a bulk
 * invite CSV before submission.
 */

import React from 'react';
import { Eyebrow } from '../../../components/atoms';
import { colors, typography } from '../../../styles/theme';

export interface InviteRow {
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
}

export interface RowError {
  row: number;
  field: string;
  message: string;
}

interface CsvValidatorProps {
  rows: InviteRow[];
  errors: RowError[];
}

export const CsvValidator: React.FC<CsvValidatorProps> = ({ rows, errors }) => {
  if (rows.length === 0) return null;
  return (
    <div style={{ marginTop: 24 }}>
      <Eyebrow>
        {rows.length} rows parsed · {errors.length} errors
      </Eyebrow>
      {errors.length > 0 && (
        <ul style={{ paddingLeft: 20, marginTop: 12 }}>
          {errors.slice(0, 50).map((e, i) => (
            <li
              key={i}
              style={{
                fontFamily: typography.fontFamily,
                fontSize: 13,
                color: colors.statusOverdue ?? colors.primaryOrange,
              }}
            >
              Row {e.row}: {e.field} — {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export function validateInviteRows(rows: Array<Record<string, string>>): {
  ok: InviteRow[];
  errors: RowError[];
} {
  const ok: InviteRow[] = [];
  const errors: RowError[] = [];
  rows.forEach((r, i) => {
    const email = (r.email ?? r.Email ?? '').trim();
    const role = (r.role ?? r.Role ?? '').trim();
    if (!email) {
      errors.push({ row: i + 2, field: 'email', message: 'missing' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: i + 2, field: 'email', message: 'invalid format' });
      return;
    }
    if (!role) {
      errors.push({ row: i + 2, field: 'role', message: 'missing' });
      return;
    }
    ok.push({
      email,
      role,
      first_name: r.first_name ?? r['First Name'],
      last_name: r.last_name ?? r['Last Name'],
    });
  });
  return { ok, errors };
}

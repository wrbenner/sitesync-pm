/**
 * /admin/bulk-invite — paste-or-upload a CSV of (email, role) and
 * fan-out invites via the existing send-invite edge function.
 */

import { useState } from 'react';
import { Eyebrow, Hairline, PageQuestion } from '../../../components/atoms';
import { PermissionGate } from '../../../components/auth/PermissionGate';
import { CsvDropZone } from '../../../components/integrations/CsvDropZone';
import { CsvValidator, validateInviteRows, type InviteRow } from './CsvValidator';
import { parseCsvRows } from '../../../lib/integrations/costCodeImporters/shared';
import { supabase } from '../../../lib/supabase';
import { colors, typography } from '../../../styles/theme';

export default function BulkInvitePage() {
  const [parsed, setParsed] = useState<{ rows: InviteRow[]; errors: ReturnType<typeof validateInviteRows>['errors'] }>(
    { rows: [], errors: [] },
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const onFile = (_name: string, content: string) => {
    const cells = parseCsvRows(content);
    if (cells.length === 0) {
      setParsed({ rows: [], errors: [] });
      return;
    }
    const header = cells[0].map((h) => h.toLowerCase());
    const rows = cells.slice(1).map((row) => {
      const obj: Record<string, string> = {};
      header.forEach((h, i) => {
        obj[h] = row[i] ?? '';
      });
      return obj;
    });
    setParsed(validateInviteRows(rows));
  };

  const onSubmit = async () => {
    if (parsed.rows.length === 0) return;
    setSubmitting(true);
    let succeeded = 0;
    let failed = 0;
    for (const r of parsed.rows) {
      try {
        const { error } = await supabase.functions.invoke('send-invite', {
          body: { email: r.email, role: r.role, first_name: r.first_name, last_name: r.last_name },
        });
        if (error) failed++;
        else succeeded++;
      } catch {
        failed++;
      }
    }
    setResult(`${succeeded} invites sent · ${failed} failures`);
    setSubmitting(false);
  };

  return (
    <PermissionGate permission="org.settings">
      <main style={{ padding: '48px 64px', maxWidth: 960, margin: '0 auto' }}>
        <Eyebrow>Admin · Bulk invite</Eyebrow>
        <PageQuestion>Who else needs to be in this organization on Monday morning?</PageQuestion>
        <Hairline spacing="normal" />

        <CsvDropZone onFile={onFile} />
        <CsvValidator rows={parsed.rows} errors={parsed.errors} />

        {parsed.rows.length > 0 && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || parsed.errors.length > 0}
            style={{
              marginTop: 24,
              background: 'transparent',
              border: `1px solid ${colors.primaryOrange}`,
              color: colors.primaryOrange,
              fontFamily: typography.fontFamily,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              padding: '14px 24px',
              minHeight: 56,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Sending…' : `Send ${parsed.rows.length} invites`}
          </button>
        )}
        {result && (
          <p style={{ marginTop: 16, fontFamily: typography.fontFamily, fontStyle: 'italic' }}>
            {result}
          </p>
        )}
      </main>
    </PermissionGate>
  );
}

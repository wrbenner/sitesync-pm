/**
 * /admin/cost-code-library — drop a CSV from any of the supported
 * accounting systems and import the cost-code master list into
 * `cost_codes`.
 */

import React, { useState } from 'react';
import { Eyebrow, Hairline, PageQuestion } from '../../../components/atoms';
import { PermissionGate } from '../../../components/auth/PermissionGate';
import { CsvDropZone } from '../../../components/integrations/CsvDropZone';
import { ColumnMappingModal } from './ColumnMappingModal';
import { IMPORTERS, getImporter } from '../../../lib/integrations/costCodeImporters';
import { parseCsvRows } from '../../../lib/integrations/costCodeImporters/shared';
import type { ColumnMap } from '../../../types/integrations';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';
import { colors, typography } from '../../../styles/theme';

export default function CostCodeLibraryPage() {
  const { company } = useAuthStore();
  const [systemId, setSystemId] = useState<string>(IMPORTERS[0].id);
  const [csv, setCsv] = useState<{ name: string; content: string } | null>(null);
  const [mapping, setMapping] = useState<ColumnMap | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [imported, setImported] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importer = getImporter(systemId)!;

  const onFile = (name: string, content: string) => {
    setCsv({ name, content });
    setMapping(importer.defaultColumnMap);
    setShowMap(true);
  };

  const headers = csv ? (parseCsvRows(csv.content)[0] ?? []) : [];

  const onConfirm = async () => {
    if (!csv || !company?.id || !mapping) return;
    setShowMap(false);
    const result = importer.parse(csv.content, mapping);
    if (result.error) {
      setError(result.error.userMessage);
      return;
    }
    const rows = (result.data ?? []).map((c) => ({
      organization_id: company.id,
      code: c.code,
      name: c.name,
      division: c.division,
      type: c.type,
      rate: c.rate,
      source_system: importer.id,
    }));
    if (rows.length === 0) {
      setError('CSV produced no rows.');
      return;
    }
    const { error: dbErr } = await supabase
      .from('cost_codes')
      .upsert(rows, { onConflict: 'organization_id,code' });
    if (dbErr) {
      setError(dbErr.message);
      return;
    }
    setImported(rows.length);
    setError(null);
  };

  return (
    <PermissionGate permission="org.settings">
      <main style={{ padding: '48px 64px', maxWidth: 960, margin: '0 auto' }}>
        <Eyebrow>Admin · Cost-code library</Eyebrow>
        <PageQuestion>What's the master cost-code list this org bills against?</PageQuestion>
        <Hairline spacing="normal" />

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
          <Eyebrow>Source accounting system</Eyebrow>
          <select
            value={systemId}
            onChange={(e) => setSystemId(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--hairline)',
              fontFamily: typography.fontFamily.sans,
              fontSize: 14,
              padding: '8px 0',
              minHeight: 56,
            }}
          >
            {IMPORTERS.map((i) => (
              <option key={i.id} value={i.id}>
                {i.system}
              </option>
            ))}
          </select>
        </label>

        <CsvDropZone onFile={onFile} />

        {imported != null && (
          <p
            style={{
              marginTop: 24,
              fontFamily: typography.fontFamily.serif,
              fontStyle: 'italic',
              color: colors.statusActive,
            }}
          >
            Imported {imported} cost codes from {csv?.name}.
          </p>
        )}
        {error && (
          <p
            style={{
              marginTop: 24,
              fontFamily: typography.fontFamily.sans,
              color: colors.statusOverdue ?? colors.primaryOrange,
            }}
          >
            {error}
          </p>
        )}

        {mapping && (
          <ColumnMappingModal
            open={showMap}
            headers={headers}
            value={mapping}
            onChange={setMapping}
            onConfirm={onConfirm}
            onCancel={() => setShowMap(false)}
          />
        )}
      </main>
    </PermissionGate>
  );
}

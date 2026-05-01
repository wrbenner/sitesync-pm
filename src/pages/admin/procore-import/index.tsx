/**
 * /admin/procore-import — start a Procore import + monitor in-flight jobs.
 */

import React, { useState } from 'react';
import { Eyebrow, Hairline, PageQuestion } from '../../../components/atoms';
import { PermissionGate } from '../../../components/auth/PermissionGate';
import { JobProgressView } from './JobProgressView';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';
import { colors, typography } from '../../../styles/theme';

const ENTITIES = [
  'rfis', 'submittals', 'change_orders', 'daily_logs',
  'drawings', 'photos', 'contacts', 'schedule', 'budget',
] as const;

export default function ProcoreImportPage() {
  const { company } = useAuthStore();
  const [token, setToken] = useState('');
  const [projectIds, setProjectIds] = useState('');
  const [region, setRegion] = useState<'us' | 'eu' | 'au'>('us');
  const [selected, setSelected] = useState<string[]>([...ENTITIES]);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onStart = async () => {
    if (!company?.id || !token || !projectIds.trim()) return;
    setRunning(true);
    setMessage(null);
    try {
      const ids = projectIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter((n) => Number.isFinite(n));
      const { data, error } = await supabase.functions.invoke('procore-import-extended', {
        body: {
          organization_id: company.id,
          procore_token: token,
          project_ids: ids,
          entity_types: selected,
          region,
        },
      });
      if (error) throw error;
      setMessage('Job started: ' + (data?.job_id ?? 'unknown'));
    } catch (e) {
      setMessage('Error: ' + (e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <PermissionGate permission="org.settings">
      <main style={{ padding: '48px 64px', maxWidth: 960, margin: '0 auto' }}>
        <Eyebrow>Admin · Procore import</Eyebrow>
        <PageQuestion>What from Procore should we bring across, and how far did the last run get?</PageQuestion>
        <Hairline spacing="normal" />

        <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Eyebrow>Procore access token</Eyebrow>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Eyebrow>Procore project IDs (comma-separated)</Eyebrow>
            <input
              value={projectIds}
              onChange={(e) => setProjectIds(e.target.value)}
              placeholder="12345, 67890"
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Eyebrow>Region</Eyebrow>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as 'us' | 'eu' | 'au')}
              style={inputStyle}
            >
              <option value="us">US</option>
              <option value="eu">EU</option>
              <option value="au">AU</option>
            </select>
          </label>
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <Eyebrow>Entities to import</Eyebrow>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
              {ENTITIES.map((e) => (
                <label
                  key={e}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    minHeight: 56,
                    fontFamily: typography.fontFamily.sans,
                    fontSize: 13,
                    color: colors.textSecondary,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(e)}
                    onChange={(ev) =>
                      setSelected(
                        ev.target.checked ? [...selected, e] : selected.filter((x) => x !== e),
                      )
                    }
                  />
                  {e.replace('_', ' ')}
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            onClick={onStart}
            disabled={running || !token || !projectIds.trim() || selected.length === 0}
            style={buttonStyle(running)}
          >
            {running ? 'Starting…' : 'Start import'}
          </button>
          {message && (
            <p
              style={{
                fontFamily: typography.fontFamily.serif,
                fontStyle: 'italic',
                color: colors.textSecondary,
              }}
            >
              {message}
            </p>
          )}
        </section>

        <Hairline spacing="wide" />
        <JobProgressView />
      </main>
    </PermissionGate>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--hairline)',
  fontFamily: 'var(--font-sans)',
  fontSize: 14,
  padding: '8px 0',
  minHeight: 56,
  color: 'var(--color-text-primary)',
};

const buttonStyle = (disabled: boolean): React.CSSProperties => ({
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: disabled ? 'var(--color-text-tertiary)' : 'var(--color-primary)',
  fontFamily: 'var(--font-sans)',
  fontSize: 12,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  padding: '14px 24px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  minHeight: 56,
  width: 'fit-content',
});

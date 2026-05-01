/**
 * CrossProjectSearch — full-text search across the org's RFIs,
 * submittals, change orders, daily logs, and punch items.
 *
 * Calls the cross-project-search edge function, which RLS-filters
 * server-side via search_org() so projects the user isn't a member
 * of never surface here.
 */

import React, { useState } from 'react';
import { Eyebrow, Hairline, PageQuestion } from '../../components/atoms';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { colors, typography } from '../../styles/theme';

interface SearchHit {
  entity_type: string;
  entity_id: string;
  project_id: string;
  title: string;
  body: string;
  rank: number;
}

export default function CrossProjectSearch() {
  const { company } = useAuthStore();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(query: string) {
    if (!company?.id || query.trim().length < 2) return;
    setRunning(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'cross-project-search',
        {
          body: { organization_id: company.id, q: query, limit: 50 },
        },
      );
      if (fnError) throw fnError;
      setResults((data?.results ?? []) as SearchHit[]);
    } catch (e) {
      setError((e as Error).message);
      setResults([]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main style={{ padding: '48px 64px', maxWidth: 960, margin: '0 auto' }}>
      <Eyebrow>Search</Eyebrow>
      <PageQuestion>What were we worrying about, last time we dealt with this?</PageQuestion>

      <Hairline spacing="normal" />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(q);
        }}
      >
        <input
          type="search"
          aria-label="Search across all projects"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="curtain wall, AHU-3, RFI 109…"
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--hairline)',
            fontFamily: typography.fontFamily.serif,
            fontStyle: 'italic',
            fontSize: 22,
            padding: '16px 0',
            minHeight: 56,
            color: colors.textPrimary,
            outline: 'none',
          }}
        />
      </form>

      {running && (
        <p
          style={{
            fontFamily: typography.fontFamily.serif,
            fontStyle: 'italic',
            color: colors.textTertiary,
          }}
        >
          Looking…
        </p>
      )}
      {error && (
        <p style={{ color: colors.statusOverdue ?? colors.primaryOrange }}>{error}</p>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: '32px 0' }}>
        {results.map((r) => (
          <li
            key={r.entity_type + r.entity_id}
            style={{ borderBottom: '1px solid var(--hairline)', padding: '14px 0' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Eyebrow>{r.entity_type.replace('_', ' ')}</Eyebrow>
              <span style={{ fontFamily: typography.fontFamily.sans, fontSize: 11, color: colors.textTertiary }}>
                rank {r.rank.toFixed(2)}
              </span>
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: typography.fontFamily.sans,
                fontSize: 15,
                color: colors.textPrimary,
              }}
            >
              {r.title || '(untitled)'}
            </div>
            {r.body && (
              <div
                style={{
                  marginTop: 4,
                  fontFamily: typography.fontFamily.serif,
                  fontStyle: 'italic',
                  fontSize: 14,
                  color: colors.textSecondary,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {r.body}
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

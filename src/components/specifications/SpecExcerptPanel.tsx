// ── SpecExcerptPanel ────────────────────────────────────────────────────────
// L2#11: Spec section reference → auto-load excerpt. When an RFI or submittal
// references a spec section (e.g. "08 71 00"), this panel queries the
// project's `specifications` table for matching content and renders a
// compact summary inline. Saves the user one navigation hop and immediately
// answers the question "what does the spec actually say?"
//
// Match strategy: exact section_number first, then prefix match (so a
// reference to "08 71 00" surfaces "08 71 00.13 Door Hardware" too).

import React from 'react';
import { useQuery } from '../../hooks/useQuery';
import { supabase } from '../../lib/supabase';
import { FileText, ExternalLink } from 'lucide-react';
import { colors, spacing, typography } from '../../styles/theme';

interface SpecExcerptPanelProps {
  projectId: string | null | undefined;
  specSection: string | null | undefined;
}

interface Specification {
  id: string;
  section_number: string;
  title: string;
  description: string | null;
  division: string | null;
  revision: string | null;
  status: string | null;
  file_url: string | null;
}

export const SpecExcerptPanel: React.FC<SpecExcerptPanelProps> = ({
  projectId,
  specSection,
}) => {
  const enabled = !!(projectId && specSection && specSection.trim().length >= 2);

  const { data: specs, loading } = useQuery<Specification[]>(
    `spec-excerpt-${projectId}-${specSection ?? ''}`,
    async () => {
      if (!enabled) return [];
      const trimmed = (specSection ?? '').trim();
      // The generated Database types are strict about column-name unions and
      // lag behind some live schemas. Cast through `any` for the local query
      // — same escape hatch the rest of the codebase uses.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      // Exact match first; if none, fall back to prefix match.
      const exact = await sb
        .from('specifications')
        .select('id, section_number, title, description, division, revision, status, file_url')
        .eq('project_id', projectId)
        .eq('section_number', trimmed)
        .limit(1);
      if (exact.data && exact.data.length > 0) return exact.data as unknown as Specification[];

      const prefix = await sb
        .from('specifications')
        .select('id, section_number, title, description, division, revision, status, file_url')
        .eq('project_id', projectId)
        .ilike('section_number', `${trimmed}%`)
        .limit(3);
      return (prefix.data as unknown as Specification[]) ?? [];
    },
    { enabled },
  );

  if (!enabled || loading || !specs || specs.length === 0) return null;

  return (
    <div
      style={{
        marginTop: spacing['3'],
        padding: spacing['3'],
        background: colors.surfaceRaised,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: spacing['2'],
          color: colors.textSecondary,
          fontSize: typography.fontSize.label,
          fontWeight: typography.fontWeight.medium,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        <FileText size={12} />
        Spec excerpt {specs.length > 1 ? `(${specs.length} matches)` : ''}
      </div>

      {specs.map((s) => (
        <div
          key={s.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            paddingTop: spacing['2'],
            paddingBottom: spacing['2'],
            borderTop: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: typography.fontSize.sm,
                color: colors.textPrimary,
                fontWeight: typography.fontWeight.semibold,
              }}
            >
              {s.section_number}
            </span>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
              {s.title}
            </span>
            {s.division && (
              <span style={{ fontSize: typography.fontSize.label, color: colors.textSecondary }}>
                Division {s.division}
              </span>
            )}
            {s.revision && (
              <span style={{ fontSize: typography.fontSize.label, color: colors.textSecondary }}>
                Rev {s.revision}
              </span>
            )}
          </div>
          {s.description && (
            <p
              style={{
                margin: 0,
                fontSize: typography.fontSize.sm,
                color: colors.textSecondary,
                lineHeight: 1.5,
              }}
            >
              {s.description.length > 280 ? s.description.slice(0, 280) + '…' : s.description}
            </p>
          )}
          {s.file_url && (
            <a
              href={s.file_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: typography.fontSize.label,
                color: colors.primaryOrange,
                textDecoration: 'none',
                marginTop: 2,
              }}
            >
              Open full spec
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      ))}
    </div>
  );
};

export default SpecExcerptPanel;

/**
 * /admin/project-templates — list, create-from-existing, and
 * materialize project templates.
 */

import React, { useEffect, useState } from 'react';
import { Eyebrow, Hairline, PageQuestion } from '../../../components/atoms';
import { PermissionGate } from '../../../components/auth/PermissionGate';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';
import { colors, typography } from '../../../styles/theme';
import type { ProjectTemplate } from '../../../types/portfolio';

interface TemplateRow extends ProjectTemplate {
  id: string;
  created_at: string;
}

export default function ProjectTemplatesPage() {
  const { company } = useAuthStore();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!company?.id) {
        setTemplates([]);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('project_templates')
        .select('id, name, description, structural_payload, created_at')
        .eq('organization_id', company.id)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (!error && data) setTemplates(data as TemplateRow[]);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [company?.id]);

  return (
    <PermissionGate permission="org.settings">
      <main style={{ padding: '48px 64px', maxWidth: 960, margin: '0 auto' }}>
        <Eyebrow>Admin · Project templates</Eyebrow>
        <PageQuestion>What's the standard shape of a new project for this org?</PageQuestion>
        <Hairline spacing="normal" />

        {loading && (
          <p
            style={{
              fontFamily: typography.fontFamily.serif,
              fontStyle: 'italic',
              color: colors.textTertiary,
            }}
          >
            Loading templates…
          </p>
        )}
        {!loading && templates.length === 0 && (
          <p
            style={{
              fontFamily: typography.fontFamily.serif,
              fontStyle: 'italic',
              color: colors.textTertiary,
            }}
          >
            No templates yet. Strip an existing project to create one.
          </p>
        )}
        {!loading &&
          templates.map((t) => (
            <article
              key={t.id}
              style={{
                padding: '16px 0',
                borderBottom: '1px solid var(--hairline)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3
                  style={{
                    fontFamily: typography.fontFamily.serif,
                    fontStyle: 'italic',
                    fontSize: 18,
                    fontWeight: 400,
                    margin: 0,
                  }}
                >
                  {t.name}
                </h3>
                <span style={{ fontFamily: typography.fontFamily.sans, fontSize: 11, color: colors.textTertiary }}>
                  {new Date(t.created_at).toLocaleDateString()}
                </span>
              </div>
              {t.description && (
                <p
                  style={{
                    fontFamily: typography.fontFamily.sans,
                    fontSize: 14,
                    color: colors.textSecondary,
                    marginTop: 8,
                  }}
                >
                  {t.description}
                </p>
              )}
              <p
                style={{
                  marginTop: 6,
                  fontFamily: typography.fontFamily.sans,
                  fontSize: 12,
                  color: colors.textTertiary,
                }}
              >
                {summarize(t.structural_payload)}
              </p>
            </article>
          ))}
      </main>
    </PermissionGate>
  );
}

function summarize(p: ProjectTemplate['structural_payload']): string {
  const parts: string[] = [];
  if (p?.sov_line_items) parts.push(`${p.sov_line_items.length} SOV items`);
  if (p?.rfi_categories) parts.push(`${p.rfi_categories.length} RFI categories`);
  if (p?.submittal_log_defaults) parts.push(`${p.submittal_log_defaults.length} submittals`);
  if (p?.punch_templates) parts.push(`${p.punch_templates.length} punch templates`);
  if (p?.closeout_deliverables) parts.push(`${p.closeout_deliverables.length} closeout deliverables`);
  if (p?.role_assignments) parts.push(`${p.role_assignments.length} roles`);
  return parts.join(' · ') || 'empty template';
}

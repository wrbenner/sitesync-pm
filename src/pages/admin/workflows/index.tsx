/**
 * Admin · Workflows page — pick an entity type, edit its workflow.
 */

import React, { useEffect, useState } from 'react'
import { colors, spacing, typography } from '../../../styles/theme'
import { Eyebrow, Hairline, PageQuestion, SectionHeading } from '../../../components/atoms'
import { WorkflowBuilder } from '../../../components/workflows/WorkflowBuilder'
import { buildDefaultWorkflow } from '../../../lib/workflows'
import type { WorkflowDefinition, WorkflowEntityType } from '../../../types/workflows'

import { fromTable, asRow } from '../../../lib/db/queries'

const ENTITY_TYPES: WorkflowEntityType[] = ['rfi', 'submittal', 'change_order']

export const AdminWorkflowsPage: React.FC = () => {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [entity, setEntity] = useState<WorkflowEntityType>('rfi')
  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null)

  // Resolve current project from supabase auth or context — for now we
  // accept the server-side default and fall through to a placeholder.
  useEffect(() => {
    let mounted = true
    ;(async () => {
      // Best-effort: pull the user's first project membership.
      const { data } = await fromTable('project_members').select('project_id').limit(1).maybeSingle()
      const member = asRow<{ project_id: string | null }>(data)
      if (mounted && member?.project_id) setProjectId(member.project_id)
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!projectId) return
    let mounted = true
    ;(async () => {
      const { data } = await fromTable('workflow_definitions')
        .select('*')
        .eq('project_id' as never, projectId)
        .eq('entity_type' as never, entity)
        .is('archived_at' as never, null)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!mounted) return
      const def = asRow<{
        id: string
        version: number
        name: string
        start_step: string
        definition: { steps?: unknown[] } | null
      }>(data)
      if (def) {
        setDefinition({
          id: def.id,
          project_id: projectId,
          entity_type: entity,
          version: def.version,
          name: def.name,
          start_step: def.start_step,
          steps: (def.definition?.steps ?? []) as WorkflowDefinition['steps'],
        })
      } else {
        setDefinition(buildDefaultWorkflow(entity, projectId))
      }
    })()
    return () => {
      mounted = false
    }
  }, [projectId, entity])

  const handleSave = async (def: WorkflowDefinition) => {
    if (!projectId) return
    // Always create a new version row.
    const next = (def.version ?? 1) + 1
    await fromTable('workflow_definitions').insert({
      project_id: projectId,
      entity_type: entity,
      version: next,
      name: def.name,
      start_step: def.start_step,
      definition: { steps: def.steps },
    } as never)
    setDefinition({ ...def, version: next })
  }

  return (
    <div style={{ padding: spacing['8'], maxWidth: '100%', minHeight: '100vh', backgroundColor: colors.surfaceRaised }}>
      <Eyebrow>Admin · Workflows</Eyebrow>
      <PageQuestion size="medium" style={{ marginTop: spacing['2'] }}>
        How should this entity move through the team?
      </PageQuestion>
      <Hairline />

      <div style={{ marginBottom: spacing['4'] }}>
        <Eyebrow>Entity type</Eyebrow>
        <div style={{ display: 'flex', gap: spacing['2'], marginTop: spacing['2'] }}>
          {ENTITY_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setEntity(t)}
              style={{
                padding: `${spacing['2']} ${spacing['3']}`,
                background: entity === t ? colors.primaryOrange : 'transparent',
                color: entity === t ? colors.white : colors.textSecondary,
                border: `1px solid ${entity === t ? colors.primaryOrange : colors.borderDefault}`,
                borderRadius: 6,
                fontFamily: typography.fontFamily,
                fontSize: typography.fontSize.sm,
                cursor: 'pointer',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <SectionHeading level={3}>Definition</SectionHeading>
      <Hairline spacing="tight" />
      {definition ? (
        <div style={{ height: 700 }}>
          <WorkflowBuilder initial={definition} onSave={handleSave} />
        </div>
      ) : (
        <div style={{ padding: spacing['6'], color: colors.textTertiary }}>Loading…</div>
      )}
    </div>
  )
}

export default AdminWorkflowsPage

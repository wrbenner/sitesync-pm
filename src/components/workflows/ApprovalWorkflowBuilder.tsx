import React, { useState } from 'react'
import { Plus, Trash2, GripVertical, Save } from 'lucide-react'
import { Card, Btn, InputField } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import {
  useApprovalTemplates,
  useSaveApprovalTemplate,
  type ApprovalEntityType,
  type ApprovalStep,
  type ApprovalActionType,
  type ApprovalWorkflowTemplate,
} from '../../hooks/useApprovalWorkflow'
import { toast } from 'sonner'

const ENTITY_TYPES: Array<{ value: ApprovalEntityType; label: string }> = [
  { value: 'submittal', label: 'Submittal' },
  { value: 'rfi', label: 'RFI' },
  { value: 'change_order', label: 'Change Order' },
  { value: 'pay_application', label: 'Pay Application' },
  { value: 'daily_log', label: 'Daily Log' },
  { value: 'safety_inspection', label: 'Safety Inspection' },
]

const ROLE_OPTIONS = [
  'Submitter',
  'Project Engineer',
  'Project Manager',
  'Superintendent',
  'Architect',
  'Engineer of Record',
  'Owner Representative',
  'Safety Manager',
  'Accounting',
  'Executive Sponsor',
]

const ACTIONS: ApprovalActionType[] = ['approve', 'review', 'acknowledge']

export const ApprovalWorkflowBuilder: React.FC = () => {
  const [entityType, setEntityType] = useState<ApprovalEntityType>('submittal')
  const { data: templates, isLoading } = useApprovalTemplates(entityType)
  const saveTemplate = useSaveApprovalTemplate()

  const [editing, setEditing] = useState<Partial<ApprovalWorkflowTemplate>>({
    name: '',
    steps: [{ step_order: 1, role: 'Project Manager', action_required: 'approve', required: true }],
    is_default: true,
  })

  const setSteps = (steps: ApprovalStep[]) => setEditing((p) => ({ ...p, steps: steps.map((s, i) => ({ ...s, step_order: i + 1 })) }))

  const startEdit = (tpl: ApprovalWorkflowTemplate) => {
    setEditing({ id: tpl.id, name: tpl.name, steps: tpl.steps, is_default: tpl.is_default })
  }

  const reset = () => {
    setEditing({
      name: '',
      steps: [{ step_order: 1, role: 'Project Manager', action_required: 'approve', required: true }],
      is_default: false,
    })
  }

  const save = () => {
    if (!editing.name?.trim()) {
      toast.error('Name is required')
      return
    }
    saveTemplate.mutate(
      {
        id: editing.id,
        entity_type: entityType,
        name: editing.name.trim(),
        steps: editing.steps ?? [],
        is_default: !!editing.is_default,
      },
      {
        onSuccess: () => {
          toast.success('Template saved')
          reset()
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Save failed'),
      },
    )
  }

  const steps = editing.steps ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing['3'], marginBottom: spacing['3'] }}>
          <h3 style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold }}>
            Workflow for
          </h3>
          <select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value as ApprovalEntityType)
              reset()
            }}
            style={{
              padding: `${spacing['2']} ${spacing['3']}`,
              background: colors.surfaceInset,
              color: colors.textPrimary,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.base,
              fontSize: typography.fontSize.body,
            }}
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <InputField
          label="Template name"
          value={editing.name ?? ''}
          onChange={(v) => setEditing((p) => ({ ...p, name: v }))}
          placeholder="e.g., Standard 3-Step Submittal Review"
        />

        <div style={{ marginTop: spacing['4'] }}>
          <div style={{ fontSize: typography.fontSize.label, color: colors.textTertiary, marginBottom: spacing['2'] }}>
            Approval steps
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
            {steps.map((step, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing['2'],
                  padding: spacing['3'],
                  background: colors.surfaceInset,
                  borderRadius: borderRadius.base,
                }}
              >
                <GripVertical size={16} color={colors.textTertiary} />
                <span style={{ minWidth: 24, fontSize: typography.fontSize.label, color: colors.textTertiary }}>
                  {i + 1}
                </span>
                <select
                  value={step.role}
                  onChange={(e) => {
                    const copy = steps.slice()
                    copy[i] = { ...copy[i], role: e.target.value }
                    setSteps(copy)
                  }}
                  style={{
                    flex: 1,
                    padding: spacing['2'],
                    background: colors.surfaceRaised,
                    color: colors.textPrimary,
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.body,
                  }}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <select
                  value={step.action_required}
                  onChange={(e) => {
                    const copy = steps.slice()
                    copy[i] = { ...copy[i], action_required: e.target.value as ApprovalActionType }
                    setSteps(copy)
                  }}
                  style={{
                    padding: spacing['2'],
                    background: colors.surfaceRaised,
                    color: colors.textPrimary,
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.body,
                  }}
                >
                  {ACTIONS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  <input
                    type="checkbox"
                    checked={step.required}
                    onChange={(e) => {
                      const copy = steps.slice()
                      copy[i] = { ...copy[i], required: e.target.checked }
                      setSteps(copy)
                    }}
                  />
                  Required
                </label>
                <button
                  onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                  aria-label="Remove step"
                  style={{
                    width: 56,
                    height: 56,
                    border: 'none',
                    background: 'transparent',
                    color: colors.textTertiary,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <Btn
            variant="ghost"
            onClick={() =>
              setSteps([
                ...steps,
                { step_order: steps.length + 1, role: 'Project Manager', action_required: 'approve', required: true },
              ])
            }
            style={{ marginTop: spacing['2'] }}
          >
            <Plus size={14} /> Add step
          </Btn>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing['4'] }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.body }}>
            <input
              type="checkbox"
              checked={!!editing.is_default}
              onChange={(e) => setEditing((p) => ({ ...p, is_default: e.target.checked }))}
            />
            Set as default for {entityType.replace('_', ' ')}
          </label>
          <div style={{ display: 'flex', gap: spacing['2'] }}>
            <Btn variant="ghost" onClick={reset}>Cancel</Btn>
            <Btn variant="primary" onClick={save} disabled={saveTemplate.isPending}>
              <Save size={14} /> {editing.id ? 'Update' : 'Save template'}
            </Btn>
          </div>
        </div>
      </Card>

      <Card>
        <h3 style={{ margin: 0, fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, marginBottom: spacing['3'] }}>
          Existing templates
        </h3>
        {isLoading ? (
          <div style={{ fontSize: typography.fontSize.body, color: colors.textTertiary }}>Loading…</div>
        ) : !templates?.length ? (
          <div style={{ fontSize: typography.fontSize.body, color: colors.textTertiary }}>No templates yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => startEdit(t)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing['3'],
                  padding: spacing['3'],
                  background: colors.surfaceInset,
                  border: 'none',
                  borderRadius: borderRadius.base,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{t.name}</div>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    {t.steps.length} steps · {t.is_default ? 'Default' : 'Optional'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

export default ApprovalWorkflowBuilder

import React from 'react'
import { EntityFormModal } from './EntityFormModal'
import { rfiSchema } from './schemas'
import type { FieldConfig } from './EntityFormModal'
import { dollarsToCents } from '../../types/money'

interface CreateRFIModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => Promise<void> | void
  initialValues?: Record<string, unknown>
}

const fields: FieldConfig[] = [
  { name: 'title', label: 'Title', type: 'text', placeholder: 'Enter the RFI title', required: true },
  { name: 'description', label: 'Question / Description', type: 'textarea', placeholder: 'Describe the information needed and any relevant context' },
  { name: 'priority', label: 'Priority', type: 'select', row: 1, options: [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ]},
  { name: 'assigned_to', label: 'Assigned To', type: 'text', placeholder: 'Name or company to respond', row: 1 },
  { name: 'ball_in_court', label: 'Ball in Court', type: 'text', placeholder: 'e.g. Architect, Owner, Sub', row: 2 },
  { name: 'spec_section', label: 'Spec Section', type: 'text', placeholder: 'e.g. 05 12 00', row: 2 },
  { name: 'drawing_reference', label: 'Drawing Reference', type: 'text', placeholder: 'e.g. A 001, S 201', row: 3 },
  { name: 'due_date', label: 'Due Date', type: 'date', row: 3 },
  { name: 'response_due_date', label: 'Response Due Date', type: 'date', row: 4 },
  // Field collects dollars; the submit shim below converts to
  // cost_impact_cents per CLAUDE.md money rule. Legacy NUMERIC column
  // dropped in 20260507000001_rfi_p1b_workflow_depth.sql.
  { name: 'cost_impact_dollars', label: 'Cost Impact ($)', type: 'currency', row: 4 },
  { name: 'schedule_impact', label: 'Schedule Impact (days)', type: 'text', placeholder: 'e.g. +5, -3, or 0', row: 5 },
  { name: 'related_submittal_id', label: 'Related Submittal', type: 'text', placeholder: 'Submittal ID (optional)', row: 5 },
]

const CreateRFIModal: React.FC<CreateRFIModalProps> = ({ open, onClose, onSubmit, initialValues }) => {
  const submitShim = React.useCallback(
    async (data: Record<string, unknown>) => {
      const { cost_impact_dollars, ...rest } = data as Record<string, unknown>
      const dollarsRaw = typeof cost_impact_dollars === 'string' ? cost_impact_dollars : ''
      const dollarsParsed = dollarsRaw.trim() === '' ? null : Number.parseFloat(dollarsRaw)
      const next: Record<string, unknown> = {
        ...rest,
        cost_impact_cents:
          dollarsParsed != null && Number.isFinite(dollarsParsed)
            ? dollarsToCents(dollarsParsed)
            : null,
      }
      await onSubmit(next)
    },
    [onSubmit],
  )

  return (
    <EntityFormModal
      open={open}
      onClose={onClose}
      onSubmit={submitShim}
      title="Create New RFI"
      schema={rfiSchema}
      fields={fields}
      defaults={initialValues ? { priority: 'medium', ...initialValues } : { priority: 'medium' }}
      submitLabel="Create RFI"
      submittingLabel="Creating..."
      draftKey="draft_rfi"
    />
  )
}

export { CreateRFIModal }
export default CreateRFIModal

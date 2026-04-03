import React from 'react'
import { EntityFormModal } from './EntityFormModal'
import { rfiSchema } from './schemas'
import type { FieldConfig } from './EntityFormModal'

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
  { name: 'spec_section', label: 'Spec Section', type: 'text', placeholder: 'e.g. 05 12 00', row: 2 },
  { name: 'drawing_reference', label: 'Drawing Reference', type: 'text', placeholder: 'e.g. A 001, S 201', row: 2 },
  { name: 'due_date', label: 'Due Date', type: 'date' },
]

const CreateRFIModal: React.FC<CreateRFIModalProps> = ({ open, onClose, onSubmit, initialValues }) => (
  <EntityFormModal
    open={open}
    onClose={onClose}
    onSubmit={onSubmit}
    title="Create New RFI"
    schema={rfiSchema}
    fields={fields}
    defaults={initialValues ? { priority: 'medium', ...initialValues } : { priority: 'medium' }}
    submitLabel="Create RFI"
    submittingLabel="Creating..."
    draftKey="draft_rfi"
  />
)

export default CreateRFIModal

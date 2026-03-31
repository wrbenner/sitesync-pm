import React from 'react'
import { EntityFormModal } from './EntityFormModal'
import { changeOrderSchema } from './schemas'
import type { FieldConfig } from './EntityFormModal'

interface CreateChangeOrderModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => Promise<void> | void
}

const today = new Date().toISOString().split('T')[0]

const fields: FieldConfig[] = [
  { name: 'title', label: 'Title', type: 'text', placeholder: 'Brief title for this change', required: true },
  { name: 'type', label: 'Type', type: 'select', row: 1, options: [
    { value: 'pco', label: 'Potential Change Order (PCO)' },
    { value: 'cor', label: 'Change Order Request (COR)' },
    { value: 'co', label: 'Change Order (CO)' },
  ]},
  { name: 'amount', label: 'Amount', type: 'currency', row: 1 },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Describe the scope change and what triggered it', required: true },
  { name: 'cost_codes', label: 'Cost Codes', type: 'text', placeholder: 'e.g. 03 30 00, 05 12 00' },
  { name: 'justification', label: 'Justification', type: 'textarea', placeholder: 'Why is this change necessary?' },
  { name: 'requested_by', label: 'Requested By', type: 'text', placeholder: 'Name or company', row: 2 },
  { name: 'requested_date', label: 'Requested Date', type: 'date', row: 2 },
]

const CreateChangeOrderModal: React.FC<CreateChangeOrderModalProps> = ({ open, onClose, onSubmit }) => (
  <EntityFormModal
    open={open}
    onClose={onClose}
    onSubmit={onSubmit}
    title="New Change Order"
    schema={changeOrderSchema}
    fields={fields}
    defaults={{ type: 'pco', requested_date: today }}
    submitLabel="Create Change Order"
    draftKey="draft_change_order"
    width={580}
  />
)

export default CreateChangeOrderModal

import React from 'react'
import { EntityFormModal } from './EntityFormModal'
import { punchItemSchema } from './schemas'
import type { FieldConfig } from './EntityFormModal'

interface CreatePunchItemModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => Promise<void> | void
}

const floorOptions = [
  'Basement', 'Lobby', 'Floor 1', 'Floor 2', 'Floor 3', 'Floor 4',
  'Floor 5', 'Floor 6', 'Floor 7', 'Floor 8', 'Floor 9', 'Floor 10',
  'Floor 11', 'Floor 12', 'Roof', 'Parking',
].map(f => ({ value: f, label: f }))

const tradeOptions = [
  'Structural', 'Mechanical', 'Electrical', 'Plumbing',
  'Fire Protection', 'Finishing', 'General',
].map(t => ({ value: t, label: t }))

const fields: FieldConfig[] = [
  { name: 'title', label: 'Title', type: 'text', placeholder: 'Brief description of the issue', required: true },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Provide additional details about the deficiency' },
  { name: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Unit 802, Corridor B' },
  { name: 'floor', label: 'Floor', type: 'select', row: 1, options: floorOptions },
  { name: 'trade', label: 'Trade', type: 'select', row: 1, options: tradeOptions },
  { name: 'priority', label: 'Priority', type: 'select', row: 2, options: [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ]},
  { name: 'assigned_to', label: 'Assigned To', type: 'text', placeholder: 'Person or crew responsible', row: 2 },
  { name: 'due_date', label: 'Due Date', type: 'date', row: 3 },
  { name: 'verification_role', label: 'Verification Role', type: 'select', row: 3, options: [
    { value: 'superintendent', label: 'Superintendent' },
    { value: 'project_manager', label: 'Project Manager' },
    { value: 'owners_rep', label: "Owner's Rep" },
  ]},
  { name: 'drawing_id', label: 'Drawing Sheet', type: 'text', placeholder: 'Drawing sheet ID or reference (optional)' },
]

const CreatePunchItemModal: React.FC<CreatePunchItemModalProps> = ({ open, onClose, onSubmit }) => (
  <EntityFormModal
    open={open}
    onClose={onClose}
    onSubmit={onSubmit}
    title="Add Punch Item"
    schema={punchItemSchema}
    fields={fields}
    defaults={{ priority: 'medium' }}
    submitLabel="Add Punch Item"
    draftKey="draft_punch_item"
  />
)

export default CreatePunchItemModal

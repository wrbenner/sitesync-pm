import React from 'react'
import { EntityFormModal } from './EntityFormModal'
import { submittalSchema } from './schemas'
import type { FieldConfig } from './EntityFormModal'

interface CreateSubmittalModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => Promise<void> | void
}

const fields: FieldConfig[] = [
  { name: 'title', label: 'Title', type: 'text', placeholder: 'Enter the submittal title', required: true },
  { name: 'type', label: 'Type', type: 'select', row: 1, options: [
    { value: 'shop_drawing', label: 'Shop Drawing' },
    { value: 'product_data', label: 'Product Data' },
    { value: 'sample', label: 'Sample' },
    { value: 'design_data', label: 'Design Data' },
    { value: 'test_report', label: 'Test Report' },
    { value: 'certificate', label: 'Certificate' },
    { value: 'closeout', label: 'Closeout' },
  ]},
  { name: 'spec_section', label: 'Spec Section', type: 'text', placeholder: 'e.g. 05 12 00', row: 1 },
  { name: 'subcontractor', label: 'Subcontractor', type: 'text', placeholder: 'Subcontractor or supplier name', row: 2 },
  { name: 'revision_number', label: 'Revision #', type: 'text', placeholder: '0', row: 2 },
  { name: 'due_date', label: 'Due Date', type: 'date', row: 3 },
  { name: 'required_onsite_date', label: 'Required On-Site Date', type: 'date', row: 3 },
  { name: 'submit_by_date', label: 'Submit By Date', type: 'date', row: 4 },
  { name: 'lead_time_weeks', label: 'Lead Time (weeks)', type: 'text', placeholder: 'e.g. 6', row: 4 },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Describe the submittal contents and any special requirements' },
  { name: 'related_rfi_id', label: 'Related RFI', type: 'text', placeholder: 'RFI ID (optional)' },
]

const CreateSubmittalModal: React.FC<CreateSubmittalModalProps> = ({ open, onClose, onSubmit }) => (
  <EntityFormModal
    open={open}
    onClose={onClose}
    onSubmit={onSubmit}
    title="Create New Submittal"
    schema={submittalSchema}
    fields={fields}
    defaults={{ type: 'shop_drawing' }}
    submitLabel="Create Submittal"
    draftKey="draft_submittal"
  />
)

export default CreateSubmittalModal

import React from 'react'
import { z } from 'zod'
import { EntityFormModal } from './EntityFormModal'
import type { FieldConfig } from './EntityFormModal'

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  project_type: z.string().optional(),
  contract_value: z.number().optional(),
  start_date: z.string().optional(),
  target_completion: z.string().optional(),
  description: z.string().optional(),
})

interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => Promise<void> | void
}

const fields: FieldConfig[] = [
  { name: 'name', label: 'Project Name', type: 'text', placeholder: 'e.g. Riverside Tower', required: true },
  { name: 'address', label: 'Address', type: 'text', placeholder: '123 Main Street' },
  { name: 'city', label: 'City', type: 'text', placeholder: 'Dallas', row: 1 },
  { name: 'state', label: 'State', type: 'text', placeholder: 'TX', row: 1 },
  { name: 'project_type', label: 'Project Type', type: 'select', row: 2, options: [
    { value: 'commercial_office', label: 'Commercial Office' },
    { value: 'mixed_use', label: 'Mixed Use' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'education', label: 'Education' },
    { value: 'multifamily', label: 'Multifamily' },
    { value: 'industrial', label: 'Industrial' },
    { value: 'data_center', label: 'Data Center' },
    { value: 'retail', label: 'Retail' },
    { value: 'hospitality', label: 'Hospitality' },
    { value: 'government', label: 'Government' },
    { value: 'infrastructure', label: 'Infrastructure' },
  ]},
  { name: 'contract_value', label: 'Contract Value ($)', type: 'currency', placeholder: '52000000', row: 2 },
  { name: 'start_date', label: 'Start Date', type: 'date', row: 3 },
  { name: 'target_completion', label: 'Target Completion', type: 'date', row: 3 },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief project description' },
]

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ open, onClose, onSubmit }) => (
  <EntityFormModal
    open={open}
    onClose={onClose}
    onSubmit={onSubmit}
    title="Create New Project"
    schema={projectSchema}
    fields={fields}
    defaults={{ project_type: 'commercial_office' }}
    submitLabel="Create Project"
    submittingLabel="Creating..."
    draftKey="draft_project"
  />
)

export default CreateProjectModal

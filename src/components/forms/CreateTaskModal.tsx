import React from 'react'
import { EntityFormModal } from './EntityFormModal'
import { taskSchema } from './schemas'
import type { FieldConfig } from './EntityFormModal'

interface CreateTaskModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => Promise<void> | void
}

const fields: FieldConfig[] = [
  { name: 'title', label: 'Title', type: 'text', placeholder: 'Enter the task title', required: true },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Describe the scope and any relevant details' },
  { name: 'status', label: 'Status', type: 'select', row: 1, options: [
    { value: 'todo', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'in_review', label: 'In Review' },
    { value: 'done', label: 'Done' },
  ]},
  { name: 'priority', label: 'Priority', type: 'select', row: 1, options: [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ]},
  { name: 'assigned_to', label: 'Assigned To', type: 'text', placeholder: 'Person or crew responsible' },
  { name: 'start_date', label: 'Start Date', type: 'date', row: 2 },
  { name: 'end_date', label: 'End Date', type: 'date', row: 2 },
  { name: 'is_critical_path', label: 'Critical Path Item', type: 'checkbox' },
]

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ open, onClose, onSubmit }) => (
  <EntityFormModal
    open={open}
    onClose={onClose}
    onSubmit={onSubmit}
    title="Create New Task"
    schema={taskSchema}
    fields={fields}
    defaults={{ status: 'todo', priority: 'medium' }}
    submitLabel="Create Task"
    draftKey="draft_task"
  />
)

export default CreateTaskModal

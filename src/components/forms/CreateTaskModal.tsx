import React, { useState } from 'react'
import { toast } from 'sonner'
import { colors } from '../../styles/theme'
import {
  FormModal,
  FormBody,
  FormRow,
  FormFooter,
  FormField,
  FormInput,
  FormTextarea,
  FormSelect,
  FormCheckbox,
} from './FormPrimitives'

export interface TaskFormData {
  title: string
  description: string
  status: string
  priority: string
  assigned_to: string
  due_date: string
  is_critical_path: boolean
}

interface CreateTaskModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: TaskFormData) => void
}

const emptyForm: TaskFormData = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  assigned_to: '',
  due_date: '',
  is_critical_path: false,
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ open, onClose, onSubmit }) => {
  const [form, setForm] = useState<TaskFormData>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (field: keyof TaskFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field as string]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!form.title.trim()) newErrors.title = 'Title is required'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    onSubmit(form)
    toast.success('Task created: ' + form.title)
    setForm(emptyForm)
    setErrors({})
    onClose()
  }

  const handleClose = () => {
    setForm(emptyForm)
    setErrors({})
    onClose()
  }

  return (
    <FormModal open={open} onClose={handleClose} title="Create New Task">
      <FormBody onSubmit={handleSubmit}>
        <FormField label="Title" required error={errors.title}>
          <FormInput
            type="text"
            value={form.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Enter the task title"
            hasError={!!errors.title}
          />
        </FormField>

        <FormField label="Description">
          <FormTextarea
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Describe the scope and any relevant details"
          />
        </FormField>

        <FormRow>
          <FormField label="Status">
            <FormSelect value={form.status} onChange={(e) => handleChange('status', e.target.value)}>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="done">Done</option>
            </FormSelect>
          </FormField>
          <FormField label="Priority">
            <FormSelect value={form.priority} onChange={(e) => handleChange('priority', e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </FormSelect>
          </FormField>
        </FormRow>

        <FormField label="Assigned To">
          <FormInput
            type="text"
            value={form.assigned_to}
            onChange={(e) => handleChange('assigned_to', e.target.value)}
            placeholder="Person or crew responsible"
          />
        </FormField>

        <FormField label="Due Date">
          <FormInput
            type="date"
            value={form.due_date}
            onChange={(e) => handleChange('due_date', e.target.value)}
          />
        </FormField>

        <FormCheckbox
          id="critical-path"
          label="Critical Path Item"
          checked={form.is_critical_path}
          onChange={(checked) => handleChange('is_critical_path', checked)}
        />

        <FormFooter onCancel={handleClose} submitLabel="Create Task" />
      </FormBody>
    </FormModal>
  )
}

export default CreateTaskModal

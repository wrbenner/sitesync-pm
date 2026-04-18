import React from 'react'
import { EntityFormModal } from './EntityFormModal'
import { meetingSchema, type MeetingFormValues } from './schemas'
import type { FieldConfig } from './EntityFormModal'

interface CreateMeetingModalProps {
  onClose: () => void
  projectId: string
  onSubmit: (data: MeetingFormValues) => Promise<void>
}

const fields: FieldConfig[] = [
  { name: 'title', label: 'Title', type: 'text', placeholder: 'Enter the meeting title', required: true },
  { name: 'type', label: 'Type', type: 'select', row: 1, options: [
    { value: 'oac', label: 'OAC' },
    { value: 'safety', label: 'Safety' },
    { value: 'coordination', label: 'Coordination' },
    { value: 'progress', label: 'Progress' },
    { value: 'subcontractor', label: 'Subcontractor' },
  ]},
  { name: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Jobsite Trailer, Conference Room', row: 1 },
  { name: 'date', label: 'Date', type: 'date', required: true, row: 2 },
  { name: 'time', label: 'Time', type: 'time', row: 2 },
  { name: 'duration_minutes', label: 'Duration (minutes)', type: 'number', min: 1, row: 2 },
  { name: 'agenda', label: 'Agenda', type: 'textarea', placeholder: 'Meeting agenda items' },
]

const CreateMeetingModal: React.FC<CreateMeetingModalProps> = ({ onClose, onSubmit }) => {
  return (
    <EntityFormModal
      open={true}
      onClose={onClose}
      onSubmit={onSubmit}
      title="Create New Meeting"
      schema={meetingSchema}
      fields={fields}
      defaults={{ type: 'oac', duration_minutes: '60' }}
      submitLabel="Create Meeting"
      draftKey="draft_meeting"
    />
  )
}

export default CreateMeetingModal

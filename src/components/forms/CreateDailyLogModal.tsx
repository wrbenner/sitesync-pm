import React from 'react'
import { EntityFormModal } from './EntityFormModal'
import { dailyLogSchema } from './schemas'
import type { FieldConfig } from './EntityFormModal'

interface CreateDailyLogModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => Promise<void> | void
}

const today = new Date().toISOString().split('T')[0]

const fields: FieldConfig[] = [
  { name: 'date', label: 'Date', type: 'date', required: true },
  { name: 'weather_condition', label: 'Weather', type: 'select', row: 1, options: [
    { value: 'clear', label: 'Clear' },
    { value: 'partly_cloudy', label: 'Partly Cloudy' },
    { value: 'cloudy', label: 'Cloudy' },
    { value: 'rain', label: 'Rain' },
    { value: 'snow', label: 'Snow' },
    { value: 'fog', label: 'Fog' },
    { value: 'windy', label: 'Windy' },
  ]},
  { name: 'crew_count', label: 'Crew Count', type: 'number', placeholder: 'Total crew on site', row: 1 },
  { name: 'temperature_high', label: 'Temp High (F)', type: 'number', placeholder: '85', row: 2 },
  { name: 'temperature_low', label: 'Temp Low (F)', type: 'number', placeholder: '62', row: 2 },
  { name: 'activities', label: 'Activities', type: 'textarea', placeholder: 'Describe work performed today' },
  { name: 'safety_notes', label: 'Safety Notes', type: 'textarea', placeholder: 'Safety observations, incidents, or toolbox talks' },
  { name: 'delays', label: 'Delays', type: 'textarea', placeholder: 'Note any weather, material, or coordination delays' },
]

const CreateDailyLogModal: React.FC<CreateDailyLogModalProps> = ({ open, onClose, onSubmit }) => (
  <EntityFormModal
    open={open}
    onClose={onClose}
    onSubmit={onSubmit}
    title="New Daily Log"
    schema={dailyLogSchema}
    fields={fields}
    defaults={{ date: today, weather_condition: 'clear' }}
    submitLabel="Create Log"
    draftKey="draft_daily_log"
    width={600}
  />
)

export default CreateDailyLogModal

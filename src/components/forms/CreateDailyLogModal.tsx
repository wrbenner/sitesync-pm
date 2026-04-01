import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
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
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { fetchWeatherForProject } from '../../lib/weather'
import type { WeatherSnapshot } from '../../lib/weather'

// ── Incident Form ─────────────────────────────────────────

export interface IncidentData {
  type: string
  description: string
  persons_involved: string
  medical_treatment: boolean
  reported_to_osha: boolean
}

const INCIDENT_TYPES = [
  { value: 'near_miss', label: 'Near Miss' },
  { value: 'first_aid', label: 'First Aid' },
  { value: 'recordable', label: 'Recordable Injury' },
  { value: 'lost_time', label: 'Lost Time Injury' },
  { value: 'fatality', label: 'Fatality' },
  { value: 'property_damage', label: 'Property Damage' },
]

const EMPTY_INCIDENT: IncidentData = {
  type: 'near_miss',
  description: '',
  persons_involved: '',
  medical_treatment: false,
  reported_to_osha: false,
}

interface IncidentFormProps {
  value: IncidentData
  onChange: (v: IncidentData) => void
}

const IncidentForm: React.FC<IncidentFormProps> = ({ value, onChange }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', gap: spacing['3'],
    padding: spacing['4'],
    backgroundColor: colors.surfaceInset,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.borderSubtle}`,
  }}>
    <FormField label="Incident Type" required>
      <FormSelect
        value={value.type}
        onChange={e => onChange({ ...value, type: e.target.value })}
      >
        {INCIDENT_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </FormSelect>
    </FormField>
    <FormField label="Description" required>
      <FormTextarea
        value={value.description}
        onChange={e => onChange({ ...value, description: e.target.value })}
        placeholder="Describe what happened, location, sequence of events"
        rows={3}
      />
    </FormField>
    <FormField label="Persons Involved">
      <FormInput
        value={value.persons_involved}
        onChange={e => onChange({ ...value, persons_involved: e.target.value })}
        placeholder="Names and titles of persons involved"
      />
    </FormField>
    <FormCheckbox
      id="medical_treatment"
      label="Medical treatment required beyond first aid"
      checked={value.medical_treatment}
      onChange={checked => onChange({ ...value, medical_treatment: checked })}
    />
    <FormCheckbox
      id="reported_to_osha"
      label="Reported to OSHA (required for fatalities and hospitalizations within 8 hours)"
      checked={value.reported_to_osha}
      onChange={checked => onChange({ ...value, reported_to_osha: checked })}
    />
  </div>
)

// ── Main Modal ────────────────────────────────────────────

export interface CreateDailyLogFormData {
  date: string
  weather_condition: string
  temperature_high: number | ''
  temperature_low: number | ''
  wind_speed: number | ''
  precipitation_probability: number | ''
  weather_source: 'api' | 'manual'
  weather_fetched_at: string
  crew_count: number | ''
  activities: string
  safety_notes: string
  delays: string
  has_incident: boolean
  incident: IncidentData
}

interface CreateDailyLogModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CreateDailyLogFormData) => Promise<void> | void
  projectId?: string
  projectLat?: number
  projectLon?: number
}

const today = new Date().toISOString().split('T')[0]

const EMPTY_FORM: CreateDailyLogFormData = {
  date: today,
  weather_condition: 'clear',
  temperature_high: '',
  temperature_low: '',
  wind_speed: '',
  precipitation_probability: '',
  weather_source: 'manual',
  weather_fetched_at: '',
  crew_count: '',
  activities: '',
  safety_notes: '',
  delays: '',
  has_incident: false,
  incident: EMPTY_INCIDENT,
}

const CreateDailyLogModal: React.FC<CreateDailyLogModalProps> = ({
  open,
  onClose,
  onSubmit,
  projectId,
  projectLat,
  projectLon,
}) => {
  const [form, setForm] = useState<CreateDailyLogFormData>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [incidentOpen, setIncidentOpen] = useState(false)

  // Auto-fetch weather on modal open (and when date changes) using project coordinates
  useEffect(() => {
    if (!open) return
    const lat = projectLat ?? 40.7128
    const lon = projectLon ?? -74.0060
    setWeatherLoading(true)
    fetchWeatherForProject(projectId ?? '', lat, lon)
      .then((w: WeatherSnapshot) => {
        setForm(f => ({
          ...f,
          temperature_high: w.temperature_high,
          temperature_low: w.temperature_low,
          wind_speed: w.wind_speed,
          precipitation_probability: w.precipitation_probability,
          weather_condition: conditionToSelect(w.conditions),
          weather_source: w.weather_source,
          weather_fetched_at: w.weather_fetched_at,
        }))
      })
      .finally(() => setWeatherLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.date, projectId, projectLat, projectLon])

  const set = <K extends keyof CreateDailyLogFormData>(k: K, v: CreateDailyLogFormData[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit(form)
      setForm(EMPTY_FORM)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormModal open={open} onClose={onClose} title="New Daily Log" width={620}>
      <FormBody onSubmit={handleSubmit}>
        {/* Date */}
        <FormField label="Date" required>
          <FormInput
            type="date"
            value={form.date}
            onChange={e => set('date', e.target.value)}
            required
          />
        </FormField>

        {/* Weather section */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: spacing['2'],
          }}>
            <span style={{
              fontSize: typography.fontSize.label,
              fontWeight: typography.fontWeight.medium,
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: typography.letterSpacing.wider,
              fontFamily: typography.fontFamily,
            }}>
              Weather
            </span>
            {weatherLoading && (
              <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                Fetching weather...
              </span>
            )}
            {!weatherLoading && form.weather_source === 'api' && form.weather_fetched_at && (
              <span style={{
                fontSize: typography.fontSize.caption, color: colors.textTertiary,
                backgroundColor: colors.surfaceInset, border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.sm, padding: `2px ${spacing['2']}`,
              }}>
                Weather auto-populated from NOAA/OpenWeather
                {' · '}
                {new Date(form.weather_fetched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {!weatherLoading && form.weather_source === 'manual' && form.weather_fetched_at && (
              <span style={{
                fontSize: typography.fontSize.caption, color: colors.statusPending,
                backgroundColor: colors.surfaceInset, border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.sm, padding: `2px ${spacing['2']}`,
              }}>
                Manually entered
              </span>
            )}
          </div>
          <FormRow columns={2}>
            <FormField label="Conditions">
              <FormSelect
                value={form.weather_condition}
                onChange={e => { set('weather_condition', e.target.value); set('weather_source', 'manual') }}
              >
                <option value="clear">Clear</option>
                <option value="partly_cloudy">Partly Cloudy</option>
                <option value="cloudy">Cloudy</option>
                <option value="rain">Rain</option>
                <option value="snow">Snow</option>
                <option value="fog">Fog</option>
                <option value="windy">Windy</option>
              </FormSelect>
            </FormField>
            <FormField label="Wind Speed (mph)">
              <FormInput
                type="number"
                value={form.wind_speed}
                onChange={e => { set('wind_speed', e.target.value === '' ? '' : Number(e.target.value)); set('weather_source', 'manual') }}
                placeholder="12"
                min={0}
              />
            </FormField>
          </FormRow>
          <FormRow columns={4}>
            <FormField label="Temp High (F)">
              <FormInput
                type="number"
                value={form.temperature_high}
                onChange={e => { set('temperature_high', e.target.value === '' ? '' : Number(e.target.value)); set('weather_source', 'manual') }}
                placeholder="85"
              />
            </FormField>
            <FormField label="Temp Low (F)">
              <FormInput
                type="number"
                value={form.temperature_low}
                onChange={e => { set('temperature_low', e.target.value === '' ? '' : Number(e.target.value)); set('weather_source', 'manual') }}
                placeholder="62"
              />
            </FormField>
            <FormField label="Precip. Chance (%)">
              <FormInput
                type="number"
                value={form.precipitation_probability}
                onChange={e => { set('precipitation_probability', e.target.value === '' ? '' : Number(e.target.value)); set('weather_source', 'manual') }}
                placeholder="30"
                min={0}
                max={100}
              />
            </FormField>
          </FormRow>
        </div>

        {/* Crew */}
        <FormField label="Crew Count">
          <FormInput
            type="number"
            value={form.crew_count}
            onChange={e => set('crew_count', e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Total crew on site"
            min={0}
          />
        </FormField>

        {/* Log entries */}
        <FormField label="Activities">
          <FormTextarea
            value={form.activities}
            onChange={e => set('activities', e.target.value)}
            placeholder="Describe work performed today"
            rows={3}
          />
        </FormField>
        <FormField label="Safety Notes">
          <FormTextarea
            value={form.safety_notes}
            onChange={e => set('safety_notes', e.target.value)}
            placeholder="Safety observations, incidents, or toolbox talks"
            rows={2}
          />
        </FormField>
        <FormField label="Delays">
          <FormTextarea
            value={form.delays}
            onChange={e => set('delays', e.target.value)}
            placeholder="Note any weather, material, or coordination delays"
            rows={2}
          />
        </FormField>

        {/* Incident section */}
        <div>
          <button
            type="button"
            onClick={() => {
              const next = !form.has_incident
              set('has_incident', next)
              setIncidentOpen(next)
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing['2'],
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: typography.fontSize.label,
              fontWeight: typography.fontWeight.medium,
              color: form.has_incident ? colors.statusCritical : colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: typography.letterSpacing.wider,
              fontFamily: typography.fontFamily,
            }}
          >
            {incidentOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Record Safety Incident
            {form.has_incident && (
              <span style={{
                fontSize: typography.fontSize.caption,
                backgroundColor: colors.statusCriticalSubtle,
                color: colors.statusCritical,
                borderRadius: borderRadius.sm,
                padding: `1px ${spacing['2']}`,
                marginLeft: spacing['1'],
              }}>
                OSHA Required
              </span>
            )}
          </button>
          {incidentOpen && (
            <div style={{ marginTop: spacing['3'] }}>
              <IncidentForm value={form.incident} onChange={v => set('incident', v)} />
            </div>
          )}
        </div>

        <FormFooter
          onCancel={onClose}
          submitLabel={submitting ? 'Creating...' : 'Create Log'}
        />
      </FormBody>
    </FormModal>
  )
}

// Map OpenWeatherMap condition strings to the select option values
function conditionToSelect(conditions: string): string {
  const map: Record<string, string> = {
    Clear: 'clear',
    Cloudy: 'cloudy',
    'Light Rain': 'rain',
    Rain: 'rain',
    Thunderstorm: 'rain',
    Snow: 'snow',
    Fog: 'fog',
    Haze: 'fog',
    Smoke: 'cloudy',
    Dust: 'partly_cloudy',
    Tornado: 'windy',
  }
  return map[conditions] ?? 'partly_cloudy'
}

export default CreateDailyLogModal

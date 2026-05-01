import React, { useState, useEffect, useRef } from 'react'
import { Copy, Loader2, Lock, Pencil, X } from 'lucide-react'
import { summarizeDailyLog } from '../../api/endpoints/aiService'
import {
  FormModal,
  FormBody,
  FormRow,
  FormField,
  FormInput,
  FormTextarea,
  FormSelect,
  FormCheckbox,
} from './FormPrimitives'
import { colors, spacing, typography, borderRadius, zIndex } from '../../styles/theme'
import { fetchWeatherForDate, fetchWeatherForecast5Day, fetchWeather } from '../../lib/weather'
import type { WeatherForDate, WeatherDay, WeatherData } from '../../lib/weather'
import { toast } from 'sonner'
import { SignaturePad } from '../dailylog/SignaturePad'
import { WeatherCard } from '../dailylog/WeatherCard'
import { supabase } from '../../api/client'
import { useIsOnline } from '../../hooks/useOfflineStatus'
import { useOfflineMutation } from '../../hooks/useOfflineMutation'

// ── Toggle Switch ─────────────────────────────────────────

const ToggleSwitch: React.FC<{ id: string; checked: boolean; onChange: (v: boolean) => void }> = ({ id, checked, onChange }) => (
  <button
    type="button"
    id={id}
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    style={{
      width: 40, height: 22,
      borderRadius: 11,
      backgroundColor: checked ? colors.primaryOrange : colors.borderDefault,
      border: 'none',
      cursor: 'pointer',
      position: 'relative',
      transition: 'background-color 0.2s',
      flexShrink: 0,
    }}
  >
    <span style={{
      position: 'absolute',
      top: 2,
      left: checked ? 20 : 2,
      width: 18, height: 18,
      borderRadius: '50%',
      backgroundColor: '#FFFFFF',
      transition: 'left 0.2s',
      display: 'block',
    }} />
  </button>
)

// ── Collapsible Section ────────────────────────────────────

interface CollapsibleSectionProps {
  label: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  badge?: React.ReactNode
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ label, open, onToggle, children, badge }) => (
  <div>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={`section-${label.toLowerCase().replace(/\s+/g, '-')}`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        padding: `${spacing['3']} 0 ${spacing['2']}`,
        borderBottom: `2px solid ${colors.borderSubtle}`,
        marginTop: spacing['2'],
      }}
    >
      <span style={{
        fontSize: '17px', fontWeight: 700, color: colors.textPrimary,
        fontFamily: typography.fontFamily, letterSpacing: '-0.01em',
        display: 'flex', alignItems: 'center', gap: spacing['2'],
      }}>
        {label}
        {badge}
      </span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, borderRadius: borderRadius.sm,
        color: colors.textTertiary,
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 0.18s ease',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    </button>
    <div
      id={`section-${label.toLowerCase().replace(/\s+/g, '-')}`}
      style={{
        display: open ? 'flex' : 'none',
        flexDirection: 'column',
        gap: spacing['3'],
        paddingTop: spacing['3'],
      }}
    >
      {children}
    </div>
  </div>
)

// ── Crew Row ───────────────────────────────────────────────

export interface CrewRow {
  id: string
  trade: string
  company: string
  headcount: number | ''
  hours: number | ''
}

const COMMON_TRADES = [
  'Concrete', 'Carpentry', 'Electrical', 'Mechanical', 'Plumbing',
  'Steel', 'Roofing', 'Glazing', 'Painting', 'Fire Protection',
  'Excavation', 'General Labor', 'Other',
]

// ── Manpower Table ─────────────────────────────────────────

interface ManpowerTableProps {
  rows: CrewRow[]
  onChange: (rows: CrewRow[]) => void
  disabled?: boolean
}

const ManpowerTable: React.FC<ManpowerTableProps> = ({ rows, onChange, disabled }) => {
  const totalHeadcount = rows.reduce((s, r) => s + (Number(r.headcount) || 0), 0)
  const totalHours = rows.reduce((s, r) => s + (Number(r.hours) || 0), 0)

  const updateRow = (id: string, field: keyof CrewRow, value: string | number) => {
    onChange(rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }
  const removeRow = (id: string) => onChange(rows.filter(r => r.id !== id))
  const addRow = () => onChange([...rows, { id: crypto.randomUUID(), trade: '', company: '', headcount: '', hours: '' }])

  const colStyle = (flex: number): React.CSSProperties => ({
    flex,
    padding: `${spacing['2']} ${spacing['2']}`,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily,
  })

  const cellInputStyle: React.CSSProperties = {
    width: '100%',
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.sm,
    padding: `${spacing['1']} ${spacing['2']}`,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    background: disabled ? colors.surfaceInset : colors.white,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const headerCellStyle: React.CSSProperties = {
    padding: `${spacing['2']} ${spacing['2']}`,
    fontSize: typography.fontSize.label,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
    fontFamily: typography.fontFamily,
  }

  return (
    <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', backgroundColor: colors.surfaceInset, borderBottom: `1px solid ${colors.borderSubtle}` }}>
        <div style={{ ...headerCellStyle, flex: 3 }}>Trade</div>
        <div style={{ ...headerCellStyle, flex: 3 }}>Company</div>
        <div style={{ ...headerCellStyle, flex: 1.5, textAlign: 'center' as const }}>Workers</div>
        <div style={{ ...headerCellStyle, flex: 1.5, textAlign: 'center' as const }}>Hours</div>
        <div style={{ width: 32 }} />
      </div>

      {/* Rows */}
      {rows.map((row, idx) => (
        <div
          key={row.id}
          style={{
            display: 'flex', alignItems: 'center',
            borderBottom: idx < rows.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
            backgroundColor: colors.white,
          }}
        >
          <div style={{ ...colStyle(3) }}>
            {disabled ? (
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{row.trade}</span>
            ) : (
              <select
                value={row.trade}
                onChange={e => updateRow(row.id, 'trade', e.target.value)}
                aria-label={`Trade for row ${idx + 1}`}
                style={{ ...cellInputStyle, cursor: 'pointer' }}
              >
                <option value="">Select trade</option>
                {COMMON_TRADES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>
          <div style={{ ...colStyle(3) }}>
            {disabled ? (
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{row.company}</span>
            ) : (
              <input
                type="text"
                value={row.company}
                onChange={e => updateRow(row.id, 'company', e.target.value)}
                placeholder="Company name"
                aria-label={`Company for row ${idx + 1}`}
                style={cellInputStyle}
              />
            )}
          </div>
          <div style={{ ...colStyle(1.5) }}>
            {disabled ? (
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, display: 'block', textAlign: 'center' }}>{row.headcount}</span>
            ) : (
              <input
                type="number"
                value={row.headcount}
                onChange={e => updateRow(row.id, 'headcount', e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0"
                min={0}
                aria-label={`Worker count for row ${idx + 1}`}
                style={{ ...cellInputStyle, textAlign: 'center' }}
              />
            )}
          </div>
          <div style={{ ...colStyle(1.5) }}>
            {disabled ? (
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, display: 'block', textAlign: 'center' }}>{row.hours}</span>
            ) : (
              <input
                type="number"
                value={row.hours}
                onChange={e => updateRow(row.id, 'hours', e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0"
                min={0}
                step={0.5}
                aria-label={`Hours for row ${idx + 1}`}
                style={{ ...cellInputStyle, textAlign: 'center' }}
              />
            )}
          </div>
          <div style={{ width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!disabled && (
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                aria-label={`Remove row ${idx + 1}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: 4, display: 'flex', borderRadius: borderRadius.sm }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Add Crew row */}
      {!disabled && (
        <div style={{ borderTop: rows.length > 0 ? `1px solid ${colors.borderSubtle}` : 'none' }}>
          <button
            type="button"
            onClick={addRow}
            aria-label="Add crew row"
            style={{
              display: 'flex', alignItems: 'center', gap: spacing['2'],
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              padding: `${spacing['2']} ${spacing['3']}`,
              fontSize: typography.fontSize.sm,
              color: colors.primaryOrange,
              fontFamily: typography.fontFamily,
              fontWeight: typography.fontWeight.medium,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Add Crew
          </button>
        </div>
      )}

      {/* Totals */}
      {rows.length > 0 && (
        <div style={{
          display: 'flex',
          backgroundColor: colors.surfaceInset,
          borderTop: `2px solid ${colors.borderSubtle}`,
        }}>
          <div style={{ ...colStyle(3), fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Total</div>
          <div style={{ ...colStyle(3) }} />
          <div style={{ ...colStyle(1.5), textAlign: 'center' as const, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, fontSize: typography.fontSize.sm }}>{totalHeadcount}</div>
          <div style={{ ...colStyle(1.5), textAlign: 'center' as const, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, fontSize: typography.fontSize.sm }}>{totalHours}</div>
          <div style={{ width: 32 }} />
        </div>
      )}
    </div>
  )
}

// ── Incident Form ─────────────────────────────────────────

export interface IncidentData {
  type: string
  description: string
  injured_party: string
  root_cause: string
  corrective_action: string
  osha_recordable: boolean
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
  injured_party: '',
  root_cause: '',
  corrective_action: '',
  osha_recordable: false,
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
    <FormField label="Injured Party">
      <FormInput
        value={value.injured_party}
        onChange={e => onChange({ ...value, injured_party: e.target.value })}
        placeholder="Name, title, and employer of injured person"
      />
    </FormField>
    <FormField label="Root Cause">
      <FormTextarea
        value={value.root_cause}
        onChange={e => onChange({ ...value, root_cause: e.target.value })}
        placeholder="Immediate and contributing causes"
        rows={2}
      />
    </FormField>
    <FormField label="Corrective Action">
      <FormTextarea
        value={value.corrective_action}
        onChange={e => onChange({ ...value, corrective_action: e.target.value })}
        placeholder="Steps taken or required to prevent recurrence"
        rows={2}
      />
    </FormField>
    <FormCheckbox
      id="osha_recordable"
      label="OSHA recordable (must be entered on OSHA 300 log)"
      checked={value.osha_recordable}
      onChange={checked => onChange({ ...value, osha_recordable: checked })}
    />
    <FormField label="Persons Involved">
      <FormInput
        value={value.persons_involved}
        onChange={e => onChange({ ...value, persons_involved: e.target.value })}
        placeholder="All parties present or involved"
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
  precipitation_inches: number | ''
  weather_source: 'auto' | 'manual'
  weather_fetched_at: string
  crew_count: number | ''
  activities: string
  safety_notes: string
  delays: string
  has_incident: boolean
  incident: IncidentData
  visitors?: string
  superintendent_signature_url?: string
  crew_entries?: CrewRow[]
}

interface CreateDailyLogModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CreateDailyLogFormData) => Promise<{ id?: string } | void> | void
  projectId?: string
  projectLat?: number
  projectLon?: number
  // When set, the modal renders the submitted lock state (no editing allowed)
  submittedAt?: string
  submittedByName?: string
}

const today = new Date().toISOString().split('T')[0]

const EMPTY_FORM: CreateDailyLogFormData = {
  date: today,
  weather_condition: 'clear',
  temperature_high: '',
  temperature_low: '',
  wind_speed: '',
  precipitation_inches: '',
  weather_source: 'manual',
  weather_fetched_at: '',
  crew_count: '',
  activities: '',
  safety_notes: '',
  delays: '',
  has_incident: false,
  incident: EMPTY_INCIDENT,
  visitors: '',
  crew_entries: [],
}

const CreateDailyLogModal: React.FC<CreateDailyLogModalProps> = ({
  open,
  onClose,
  onSubmit,
  projectId,
  projectLat,
  projectLon,
  submittedAt,
  submittedByName,
}) => {
  const isSubmittedView = Boolean(submittedAt)
  const isOnline = useIsOnline()
  const [form, setForm] = useState<CreateDailyLogFormData>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const offlineDailyLogMutation = useOfflineMutation<void, CreateDailyLogFormData>({
    table: 'daily_logs',
    operation: 'insert',
    mutationFn: async (data) => { await onSubmit(data) },
    getOfflinePayload: (data) => ({ ...data as unknown as Record<string, unknown>, project_id: projectId }),
    offlineMessage: 'Draft saved offline',
    onSuccess: () => {
      setForm(EMPTY_FORM)
      setCrewRows([])
      setSignatureBlob(null)
      onClose()
    },
  })
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [fetchedWeather, setFetchedWeather] = useState<WeatherForDate | null>(null)
  const [forecast5Day, setForecast5Day] = useState<WeatherDay[]>([])
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set())
  const [editedAfterAutoFill, setEditedAfterAutoFill] = useState<Set<string>>(new Set())
  const [sameAsYesterdayLoading, setSameAsYesterdayLoading] = useState(false)
  const [noIncidentsToday, setNoIncidentsToday] = useState<boolean>(true)
  const [noVisitorsToday, setNoVisitorsToday] = useState<boolean>(true)
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null)
  const [crewRows, setCrewRows] = useState<CrewRow[]>([])
  const [openSections, setOpenSections] = useState({
    weather: true,
    manpower: true,
    narrative: true,
    photos: false,
  })
  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768
  )
  const [dragOffset, setDragOffset] = useState(0)
  const touchStartY = useRef(0)

  // Track mobile viewport
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    setIsMobile(mq.matches)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Auto-fetch weather on modal open (and when date changes) using project coordinates.
  // Uses Open-Meteo (free, no API key). Results are cached in localStorage.
  useEffect(() => {
    if (!open || isSubmittedView) return
    if (!projectLat || !projectLon) return
    setWeatherLoading(true)
    setAutoFilledFields(new Set())
    setEditedAfterAutoFill(new Set())
    Promise.all([
      fetchWeatherForDate(projectLat, projectLon, form.date),
      fetchWeatherForecast5Day(projectLat, projectLon),
    ]).then(([w, forecast]) => {
      setFetchedWeather(w)
      setForecast5Day(forecast)
      setForm(f => ({
        ...f,
        temperature_high: w.temp_high,
        temperature_low: w.temp_low,
        wind_speed: w.wind_speed,
        precipitation_inches: w.precipitation_inches,
        weather_condition: conditionToSelect(w.conditions),
        weather_source: w.source === 'open-meteo' ? 'auto' : 'manual',
        weather_fetched_at: w.source !== 'default' ? new Date().toISOString() : '',
      }))
      if (w.source === 'open-meteo') {
        setAutoFilledFields(new Set(['weather_condition', 'temperature_high', 'temperature_low', 'wind_speed', 'precipitation_inches']))
      }
    }).finally(() => setWeatherLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.date, projectLat, projectLon])

  // Fallback: no coordinates provided — use fetchWeather() cache for current conditions
  useEffect(() => {
    if (!open || isSubmittedView) return
    if (projectLat && projectLon) return
    setWeatherLoading(true)
    setAutoFilledFields(new Set())
    setEditedAfterAutoFill(new Set())
    fetchWeather().then((w) => {
      const windNumeric = parseInt(w.wind_speed) || 0
      setForm(f => ({
        ...f,
        temperature_high: w.temp_high,
        temperature_low: w.temp_low,
        wind_speed: windNumeric,
        weather_condition: conditionToSelect(w.conditions),
        weather_source: w.source === 'openweathermap' ? 'auto' : 'manual',
        weather_fetched_at: w.source === 'openweathermap' ? new Date().toISOString() : '',
      }))
      if (w.source === 'openweathermap') {
        setAutoFilledFields(new Set(['weather_condition', 'temperature_high', 'temperature_low', 'wind_speed']))
      }
    }).finally(() => setWeatherLoading(false))
   
  }, [open, isSubmittedView, projectLat, projectLon])

  const set =<K extends keyof CreateDailyLogFormData>(k: K, v: CreateDailyLogFormData[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const markManual = (field: string) => {
    setAutoFilledFields(prev => { const s = new Set(prev); s.delete(field); return s })
    setEditedAfterAutoFill(prev => new Set([...prev, field]))
  }

  const weatherFieldBadge = (field: string) => {
    if (weatherLoading) {
      return (
        <span style={{
          display: 'inline-block', marginTop: spacing['1'],
          width: 52, height: 14,
          backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.sm,
        }} />
      )
    }
    if (autoFilledFields.has(field)) {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          marginTop: spacing['1'],
          fontSize: '10px',
          color: '#2E7D32',
          backgroundColor: '#E8F5E9',
          borderRadius: '4px',
          padding: '2px 6px',
          fontWeight: 600,
        }}>
          Auto
        </span>
      )
    }
    if (editedAfterAutoFill.has(field)) {
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '3px',
          marginTop: spacing['1'],
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
        }}>
          <Pencil size={10} />
          Edited
        </span>
      )
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittedView) return
    setSubmitting(true)
    try {
      if (!isOnline) {
        offlineDailyLogMutation.mutate(form)
        return
      }
      let signatureUrl: string | undefined
      if (signatureBlob && projectId) {
        const path = `${projectId}/${Date.now()}.svg`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('daily-log-signatures')
          .upload(path, signatureBlob, { contentType: 'image/svg+xml', upsert: false })
        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from('daily-log-signatures')
            .getPublicUrl(uploadData.path)
          signatureUrl = urlData.publicUrl
        }
      }
      const totalWorkers = crewRows.reduce((s, r) => s + (Number(r.headcount) || 0), 0)
      const submitForm: CreateDailyLogFormData = {
        ...form,
        superintendent_signature_url: signatureUrl,
        crew_count: totalWorkers > 0 ? totalWorkers : form.crew_count,
        crew_entries: crewRows,
      }
      const result = await onSubmit(submitForm)
      const createdId = result && typeof result === 'object' && 'id' in result ? result.id : undefined
      if (createdId) {
        const logData: Record<string, unknown> = { ...form as unknown as Record<string, unknown>, id: createdId }
        summarizeDailyLog(logData).then((summary) => {
          if (summary) {
            supabase.from('daily_logs').update({ ai_summary: summary }).eq('id', createdId).then(() => {})
          }
        }).catch(() => {})
      }
      setForm(EMPTY_FORM)
      setCrewRows([])
      setSignatureBlob(null)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  // ── Swipe-to-dismiss (mobile sheet) ─────────────────────

  const handleSheetTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }

  const handleSheetTouchMove = (e: React.TouchEvent) => {
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0) setDragOffset(Math.min(dy, 400))
  }

  const handleSheetTouchEnd = () => {
    if (dragOffset > 80) {
      setDragOffset(0)
      onClose()
    } else {
      setDragOffset(0)
    }
  }

  const handleSameAsYesterday = async () => {
    if (!projectId) return
    setSameAsYesterdayLoading(true)
    try {
      const { data: rows } = await supabase
        .from('daily_logs')
        .select('id, workers_onsite, daily_log_entries(type, company, trade, headcount, hours)')
        .eq('project_id', projectId)
        .order('log_date', { ascending: false })
        .limit(1)
      if (rows && rows.length > 0) {
        const prev = rows[0] as {
          workers_onsite?: number
          daily_log_entries?: Array<{ type?: string | null; company?: string | null; trade?: string | null; headcount?: number | null; hours?: number | null }>
        }
        const prevCrew = (prev.daily_log_entries ?? []).filter(e => e.type === 'crew')
        const seeded: CrewRow[] = prevCrew.map(c => ({
          id: crypto.randomUUID(),
          trade: c.trade ?? '',
          company: c.company ?? '',
          headcount: c.headcount ?? '',
          hours: c.hours ?? '',
        }))
        if (seeded.length > 0) setCrewRows(seeded)
        setForm(f => ({
          ...f,
          crew_count: prev.workers_onsite ?? f.crew_count,
        }))
        toast.success('Copied crew and entries from previous log')
      }
    } catch {
      // silent
    } finally {
      setSameAsYesterdayLoading(false)
    }
  }

  // ── Form body (shared between mobile and desktop) ────────

  const formBody = (
    <FormBody onSubmit={handleSubmit}>
      {/* Submitted lock banner */}
      {isSubmittedView && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['2'],
          padding: `${spacing['3']} ${spacing['4']}`,
          backgroundColor: colors.statusActiveSubtle,
          borderRadius: borderRadius.md,
          borderLeft: `3px solid ${colors.statusActive}`,
          marginBottom: spacing['2'],
        }}>
          <Lock size={14} color={colors.statusActive} />
          <div>
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusActive }}>
              Submitted
            </span>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginLeft: spacing['2'] }}>
              {submittedAt
                ? new Date(submittedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : ''}
              {submittedByName ? ` by ${submittedByName}` : ''}
            </span>
          </div>
          <span style={{
            marginLeft: 'auto', fontSize: typography.fontSize.caption,
            backgroundColor: colors.statusActive, color: colors.white,
            borderRadius: borderRadius.sm, padding: `2px ${spacing['2']}`,
            fontWeight: typography.fontWeight.semibold,
          }}>
            Locked
          </span>
        </div>
      )}

      {/* Same as yesterday */}
      {!isSubmittedView && (
        <div style={{ marginBottom: spacing['2'] }}>
          <button
            type="button"
            aria-label="Copy crew and equipment from previous daily log"
            onClick={handleSameAsYesterday}
            disabled={sameAsYesterdayLoading || !projectId}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
              background: '#FFFFFF',
              border: '1px solid #D0D5DD',
              borderRadius: borderRadius.md,
              padding: `${spacing['2']} ${spacing['3']}`,
              fontSize: typography.fontSize.sm,
              color: colors.textPrimary,
              cursor: sameAsYesterdayLoading || !projectId ? 'not-allowed' : 'pointer',
              fontFamily: typography.fontFamily,
              fontWeight: typography.fontWeight.medium,
              opacity: sameAsYesterdayLoading || !projectId ? 0.6 : 1,
            }}
          >
            <Copy size={14} />
            {sameAsYesterdayLoading ? 'Loading...' : 'Same as Yesterday'}
          </button>
        </div>
      )}

      {/* Date */}
      <FormField label="Date" required>
        <FormInput
          type="date"
          value={form.date}
          onChange={e => set('date', e.target.value)}
          required
        />
      </FormField>

      {/* Weather section — collapsible */}
      <CollapsibleSection
        label="Weather"
        open={openSections.weather}
        onToggle={() => toggleSection('weather')}
        badge={
          !openSections.weather && form.weather_source === 'auto' ? (
            <span style={{
              fontSize: '10px', fontWeight: 600, color: '#2E7D32',
              backgroundColor: '#E8F5E9', borderRadius: '4px', padding: '1px 6px',
            }}>Auto</span>
          ) : undefined
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          {weatherLoading && (
            <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              Fetching weather...
            </span>
          )}
          {!weatherLoading && form.weather_source === 'auto' && form.weather_fetched_at && (
            <span style={{
              fontSize: typography.fontSize.caption, color: colors.textTertiary,
              backgroundColor: colors.surfaceInset, border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.sm, padding: `2px ${spacing['2']}`,
            }}>
              Auto-filled via Open-Meteo
              {' · '}
              {new Date(form.weather_fetched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {!weatherLoading && form.weather_source === 'manual' && (
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
              aria-label="Weather conditions"
              value={form.weather_condition}
              onChange={e => { markManual('weather_condition'); set('weather_condition', e.target.value); set('weather_source', 'manual') }}
            >
              <option value="clear">Clear</option>
              <option value="partly_cloudy">Partly Cloudy</option>
              <option value="cloudy">Cloudy</option>
              <option value="rain">Rain</option>
              <option value="snow">Snow</option>
              <option value="fog">Fog</option>
              <option value="windy">Windy</option>
            </FormSelect>
            {weatherFieldBadge('weather_condition')}
          </FormField>
          <FormField label="Wind Speed (mph)">
            <FormInput
              type="number"
              aria-label="Wind speed in mph"
              value={form.wind_speed}
              onChange={e => { markManual('wind_speed'); set('wind_speed', e.target.value === '' ? '' : Number(e.target.value)); set('weather_source', 'manual') }}
              placeholder="12"
              min={0}
            />
            {weatherFieldBadge('wind_speed')}
          </FormField>
        </FormRow>
        <FormRow columns={isMobile ? 2 : 4}>
          <FormField label="Temp High (F)">
            <FormInput
              type="number"
              aria-label="High temperature in Fahrenheit"
              value={form.temperature_high}
              onChange={e => { markManual('temperature_high'); set('temperature_high', e.target.value === '' ? '' : Number(e.target.value)); set('weather_source', 'manual') }}
              placeholder="85"
            />
            {weatherFieldBadge('temperature_high')}
          </FormField>
          <FormField label="Temp Low (F)">
            <FormInput
              type="number"
              aria-label="Low temperature in Fahrenheit"
              value={form.temperature_low}
              onChange={e => { markManual('temperature_low'); set('temperature_low', e.target.value === '' ? '' : Number(e.target.value)); set('weather_source', 'manual') }}
              placeholder="62"
            />
            {weatherFieldBadge('temperature_low')}
          </FormField>
          <FormField label="Precipitation (in)">
            <FormInput
              type="number"
              aria-label="Precipitation in inches"
              value={form.precipitation_inches}
              onChange={e => { markManual('precipitation_inches'); set('precipitation_inches', e.target.value === '' ? '' : Number(e.target.value)); set('weather_source', 'manual') }}
              placeholder="0.00"
              min={0}
              step={0.01}
            />
            {weatherFieldBadge('precipitation_inches')}
          </FormField>
        </FormRow>
      </CollapsibleSection>

      {/* Manpower section — collapsible table */}
      <CollapsibleSection
        label="Manpower"
        open={openSections.manpower}
        onToggle={() => toggleSection('manpower')}
        badge={
          !openSections.manpower && crewRows.length > 0 ? (
            <span style={{
              fontSize: '11px', fontWeight: 600, color: colors.primaryOrange,
              backgroundColor: colors.orangeSubtle, borderRadius: '4px', padding: '1px 6px',
            }}>{crewRows.reduce((s, r) => s + (Number(r.headcount) || 0), 0)} workers</span>
          ) : undefined
        }
      >
        <ManpowerTable rows={crewRows} onChange={setCrewRows} disabled={isSubmittedView} />
      </CollapsibleSection>

      {/* Work Performed section — collapsible */}
      <CollapsibleSection
        label="Work Performed"
        open={openSections.narrative}
        onToggle={() => toggleSection('narrative')}
      >
        <FormField label="Work Performed">
          <FormTextarea
            aria-label="Work performed today"
            value={form.activities}
            onChange={e => set('activities', e.target.value)}
            placeholder="Describe work performed today. Tap the microphone on your keyboard for voice input."
            rows={4}
          />
        </FormField>
        <FormField label="Delays">
          <FormTextarea
            aria-label="Delays encountered today"
            value={form.delays}
            onChange={e => set('delays', e.target.value)}
            placeholder="Note any weather, material, or coordination delays"
            rows={2}
          />
        </FormField>
      </CollapsibleSection>

      {/* Safety / Incidents section */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `2px solid ${colors.borderSubtle}`,
          padding: `${spacing['3']} 0 ${spacing['2']}`,
          marginTop: spacing['2'],
        }}>
          <span style={{
            fontSize: '17px', fontWeight: 700, color: colors.textPrimary,
            fontFamily: typography.fontFamily, letterSpacing: '-0.01em',
          }}>
            Safety
          </span>
          <label htmlFor="no-incidents-toggle" style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], cursor: 'pointer' }}>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>No incidents today</span>
            <ToggleSwitch
              id="no-incidents-toggle"
              checked={noIncidentsToday}
              onChange={(v) => {
                setNoIncidentsToday(v)
                set('has_incident', !v)
              }}
            />
          </label>
        </div>
        {!noIncidentsToday && (
          <div style={{ marginTop: spacing['3'] }}>
            <IncidentForm value={form.incident} onChange={v => set('incident', v)} />
          </div>
        )}
      </div>

      {/* Visitors section */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `2px solid ${colors.borderSubtle}`,
          padding: `${spacing['3']} 0 ${spacing['2']}`,
          marginTop: spacing['2'],
        }}>
          <span style={{
            fontSize: '17px', fontWeight: 700, color: colors.textPrimary,
            fontFamily: typography.fontFamily, letterSpacing: '-0.01em',
          }}>
            Visitors
          </span>
          <label htmlFor="no-visitors-toggle" style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], cursor: 'pointer' }}>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>No visitors today</span>
            <ToggleSwitch
              id="no-visitors-toggle"
              checked={noVisitorsToday}
              onChange={setNoVisitorsToday}
            />
          </label>
        </div>
        {!noVisitorsToday && (
          <div style={{ marginTop: spacing['3'] }}>
            <FormField label="Visitor Names">
              <FormTextarea
                aria-label="Visitor names and affiliations"
                value={form.visitors ?? ''}
                onChange={e => set('visitors', e.target.value)}
                placeholder="List visitor names and company affiliations"
                rows={2}
              />
            </FormField>
          </div>
        )}
      </div>

      {/* Photos section — collapsible */}
      <CollapsibleSection
        label="Photos"
        open={openSections.photos}
        onToggle={() => toggleSection('photos')}
      >
        <div
          aria-label="Photo upload area"
          style={{
            border: `2px dashed ${colors.borderDefault}`,
            borderRadius: borderRadius.lg,
            padding: spacing['8'],
            textAlign: 'center',
            cursor: isSubmittedView ? 'default' : 'pointer',
            backgroundColor: colors.surfaceInset,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['3'],
          }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ color: colors.textTertiary }}>
            <rect x="3" y="7" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="16" cy="17" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 7l2-4h4l2 4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          <div>
            <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
              Drag photos here or tap to select
            </p>
            <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              JPEG, PNG up to 20MB each. Multiple files supported.
            </p>
          </div>
          {!isSubmittedView && (
            <label
              aria-label="Select photos to upload"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['4']}`,
                backgroundColor: colors.white,
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.md,
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
                fontWeight: typography.fontWeight.medium,
                color: colors.textPrimary,
                cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Select Photos
              <input
                type="file"
                accept="image/*"
                multiple
                aria-label="Photo file input"
                style={{ display: 'none' }}
                onChange={() => {}}
              />
            </label>
          )}
        </div>
      </CollapsibleSection>

      {/* Superintendent signature */}
      {!isSubmittedView && (
        <div style={{ marginTop: spacing['2'] }}>
          <div style={{
            fontSize: '17px', fontWeight: 700, color: colors.textPrimary,
            fontFamily: typography.fontFamily,
            padding: `${spacing['3']} 0 ${spacing['2']}`,
            borderBottom: `2px solid ${colors.borderSubtle}`,
            marginBottom: spacing['3'],
            letterSpacing: '-0.01em',
          }}>
            Superintendent Signature
          </div>
          <SignaturePad
            signerName="Superintendent"
            signerTitle="Sign to certify this log is accurate and complete"
            onSigned={(blob) => setSignatureBlob(blob)}
          />
          {signatureBlob && (
            <p style={{ fontSize: typography.fontSize.caption, color: colors.statusActive, margin: `${spacing['1']} 0 0`, display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
              Signature captured. Will be stored on submission.
            </p>
          )}
        </div>
      )}

      {/* Sticky Submit Log button */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        backgroundColor: colors.white,
        borderTop: `1px solid ${colors.borderSubtle}`,
        padding: `${spacing['4']} 0 ${spacing['2']}`,
        display: 'flex',
        gap: spacing['3'],
        justifyContent: 'flex-end',
        marginTop: spacing['2'],
      }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: `${spacing['2']} ${spacing['5']}`,
            fontSize: typography.fontSize.body,
            fontFamily: typography.fontFamily,
            fontWeight: typography.fontWeight.medium,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.md,
            backgroundColor: colors.white,
            color: colors.textSecondary,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          aria-label={isSubmittedView ? 'Close log' : 'Submit daily log'}
          style={{
            padding: `${spacing['2']} ${spacing['6']}`,
            fontSize: typography.fontSize.body,
            fontFamily: typography.fontFamily,
            fontWeight: typography.fontWeight.semibold,
            border: 'none',
            borderRadius: borderRadius.md,
            backgroundColor: submitting ? colors.surfaceDisabled : colors.primaryOrange,
            color: colors.white,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1,
            minWidth: 120,
          }}
        >
          {isSubmittedView ? 'Close' : submitting ? 'Submitting...' : 'Submit Log'}
        </button>
      </div>
    </FormBody>
  )

  // ── Mobile: bottom sheet ─────────────────────────────────

  if (isMobile) {
    if (!open) return null
    return (
      <>
        <style>{`
          @keyframes slideUpSheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
          .dl-mobile-sheet input,
          .dl-mobile-sheet select { min-height: 48px; padding: 12px; box-sizing: border-box; }
          .dl-mobile-sheet textarea { padding: 12px; box-sizing: border-box; }
          .dl-mobile-sheet button[type="button"],
          .dl-mobile-sheet button[type="submit"] { min-height: 48px; }
        `}</style>

        {/* Backdrop */}
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: zIndex.modal as number,
          }}
        />

        {/* Sheet */}
        <div
          className="dl-mobile-sheet"
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            borderRadius: '16px 16px 0 0',
            backgroundColor: colors.white,
            zIndex: (zIndex.modal as number) + 1,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
            transition: dragOffset === 0 ? 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
            animation: dragOffset === 0 ? 'slideUpSheet 280ms cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
          }}
        >
          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: `${spacing['3']} 0 ${spacing['1']}`, flexShrink: 0 }}>
            <div style={{ width: 36, height: 4, borderRadius: '2px', backgroundColor: colors.borderDefault }} />
          </div>

          {/* Sheet header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: `${spacing['2']} ${spacing['5']} ${spacing['3']}`,
            borderBottom: `1px solid ${colors.borderSubtle}`,
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: typography.fontSize.subtitle,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              fontFamily: typography.fontFamily,
            }}>
              New Daily Log
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 44, height: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: colors.surfaceInset,
                border: 'none', borderRadius: '50%', cursor: 'pointer',
                color: colors.textTertiary,
              }}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable form */}
          <div style={{ flex: 1, overflowY: 'auto', padding: `${spacing['4']} ${spacing['5']} ${spacing['10']}` }}>
            {formBody}
          </div>
        </div>
      </>
    )
  }

  // ── Desktop: centered modal ──────────────────────────────

  const showSidebar = Boolean(projectLat && projectLon)
  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      <div style={{
        fontSize: typography.fontSize.label,
        fontWeight: typography.fontWeight.medium,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wider,
      }}>
        Today's Forecast
      </div>
      {weatherLoading ? (
        <div style={{
          height: 88,
          backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.lg,
        }} />
      ) : fetchedWeather ? (
        <WeatherCard
          weather={toWeatherData(fetchedWeather)}
          locked
          forecast={forecast5Day.length > 0 ? forecast5Day : undefined}
        />
      ) : (
        <div style={{
          padding: spacing['4'],
          backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.lg,
          fontSize: typography.fontSize.sm,
          color: colors.textTertiary,
          textAlign: 'center',
        }}>
          No forecast available
        </div>
      )}
    </div>
  )

  return (
    <FormModal open={open} onClose={onClose} title="New Daily Log" width={showSidebar ? 940 : 620}>
      {showSidebar ? (
        <div style={{ display: 'flex', gap: spacing['6'], alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>{formBody}</div>
          <div style={{ width: 280, flexShrink: 0 }}>{sidebarContent}</div>
        </div>
      ) : formBody}
    </FormModal>
  )
}

// Convert WeatherForDate (Open-Meteo shape) to WeatherData (WeatherCard shape)
function toWeatherData(w: WeatherForDate): WeatherData {
  const iconMap: Record<string, string> = {
    Clear: '☀️', 'Partly Cloudy': '⛅', Cloudy: '☁️', Fog: '🌫️',
    'Light Rain': '🌦️', Rain: '🌧️', 'Heavy Rain': '🌧️',
    Snow: '❄️', 'Heavy Snow': '❄️', Thunderstorm: '⛈️',
  }
  return {
    temp_high: w.temp_high,
    temp_low: w.temp_low,
    conditions: w.conditions,
    precipitation: `${w.precipitation_inches}in`,
    wind_speed: `${w.wind_speed} mph`,
    icon: iconMap[w.conditions] ?? '☀️',
    humidity: 50,
    fetched_at: new Date().toISOString(),
    source: w.source === 'open-meteo' ? 'openweathermap' : 'default',
  }
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

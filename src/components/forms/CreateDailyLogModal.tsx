import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, Loader2, Lock, Pencil, X } from 'lucide-react'
import { summarizeDailyLog } from '../../api/endpoints/aiService'
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
import { colors, spacing, typography, borderRadius, zIndex } from '../../styles/theme'
import { fetchWeatherForDate, fetchWeatherForecast5Day, fetchWeather } from '../../lib/weather'
import type { WeatherForDate, WeatherDay, WeatherData } from '../../lib/weather'
import { toast } from 'sonner'
import { SignaturePad } from '../dailylog/SignaturePad'
import { WeatherCard } from '../dailylog/WeatherCard'
import { supabase } from '../../api/client'
import { useIsOnline } from '../../hooks/useOfflineStatus'
import { useOfflineMutation } from '../../hooks/useOfflineMutation'

// ── Section Header ────────────────────────────────────────

const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <div style={{
    fontSize: '17px',
    fontWeight: 700,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily,
    padding: `${spacing['3']} 0 ${spacing['2']}`,
    borderBottom: `2px solid ${colors.borderSubtle}`,
    marginTop: spacing['2'],
    letterSpacing: '-0.01em',
  }}>
    {label}
  </div>
)

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
  superintendent_signature_url?: string
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
  const [incidentOpen, setIncidentOpen] = useState(false)
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const result = await onSubmit({ ...form, superintendent_signature_url: signatureUrl })
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
        .select('workers_onsite')
        .eq('project_id', projectId)
        .order('log_date', { ascending: false })
        .limit(1)
      if (rows && rows.length > 0) {
        const prev = rows[0] as { workers_onsite?: number }
        setForm(f => ({
          ...f,
          crew_count: prev.workers_onsite ?? f.crew_count,
        }))
        toast.success('Pre-filled from previous log')
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
            onClick={handleSameAsYesterday}
            disabled={sameAsYesterdayLoading || !projectId}
            style={{
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
            {sameAsYesterdayLoading ? 'Loading...' : 'Same as yesterday'}
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

      {/* Weather section */}
      <SectionHeader label="Weather" />
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          marginBottom: spacing['2'],
        }}>
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
              value={form.temperature_high}
              onChange={e => { markManual('temperature_high'); set('temperature_high', e.target.value === '' ? '' : Number(e.target.value)); set('weather_source', 'manual') }}
              placeholder="85"
            />
            {weatherFieldBadge('temperature_high')}
          </FormField>
          <FormField label="Temp Low (F)">
            <FormInput
              type="number"
              value={form.temperature_low}
              onChange={e => { markManual('temperature_low'); set('temperature_low', e.target.value === '' ? '' : Number(e.target.value)); set('weather_source', 'manual') }}
              placeholder="62"
            />
            {weatherFieldBadge('temperature_low')}
          </FormField>
          <FormField label="Precipitation (in)">
            <FormInput
              type="number"
              value={form.precipitation_inches}
              onChange={e => { markManual('precipitation_inches'); set('precipitation_inches', e.target.value === '' ? '' : Number(e.target.value)); set('weather_source', 'manual') }}
              placeholder="0.00"
              min={0}
              step={0.01}
            />
            {weatherFieldBadge('precipitation_inches')}
          </FormField>
        </FormRow>
      </div>

      {/* Crew section */}
      <SectionHeader label="Crew" />
      <FormField label="Crew Count">
        <FormInput
          type="number"
          value={form.crew_count}
          onChange={e => set('crew_count', e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="Total crew on site"
          min={0}
        />
      </FormField>

      {/* Narrative section */}
      <SectionHeader label="Narrative" />
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
            background: 'none', border: 'none', cursor: 'pointer',
            padding: `${spacing['3']} 0`,
            minHeight: '48px',
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

      <FormFooter
        onCancel={onClose}
        submitLabel={isSubmittedView ? 'Close' : submitting ? 'Creating...' : 'Create Log'}
      />
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

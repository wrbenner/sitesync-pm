import React, { memo, useCallback, useMemo } from 'react'
import {
  Mic, Square, X, CheckCircle, Play, Pause, Globe, Sparkles,
  FileText, AlertTriangle, ClipboardCheck, ShieldAlert, Trash2,
  ChevronDown, Volume2, Wifi, WifiOff, Camera,
} from 'lucide-react'
import { colors, spacing, typography, borderRadius, transitions, shadows, zIndex } from '../../styles/theme'
import { useVoiceCapture } from '../../hooks/useVoiceCapture'
import type { ExtractedEntity, SupportedLanguage } from '../../hooks/useVoiceCapture'

// ── Entity Type Config ────────────────────────────────────────

const ENTITY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  daily_log: { label: 'Daily Log', icon: FileText, color: colors.statusInfo, bg: colors.statusInfoSubtle },
  rfi_draft: { label: 'RFI Draft', icon: AlertTriangle, color: colors.primaryOrange, bg: colors.orangeSubtle },
  punch_item: { label: 'Punch Item', icon: ClipboardCheck, color: colors.statusPending, bg: colors.statusPendingSubtle },
  safety_observation: { label: 'Safety', icon: ShieldAlert, color: colors.statusCritical, bg: colors.statusCriticalSubtle },
  general_note: { label: 'Note', icon: FileText, color: colors.textTertiary, bg: colors.statusNeutralSubtle },
}

// ── Waveform Visualizer ───────────────────────────────────────

const WaveformBars = memo<{ frequencies: number[]; isRecording: boolean }>(
  ({ frequencies, isRecording }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        height: 64,
      }}
      aria-hidden="true"
    >
      {frequencies.map((value, i) => {
        const height = isRecording ? Math.max(4, (value / 255) * 56) : 4
        return (
          <div
            key={i}
            style={{
              width: 3,
              height: `${height}px`,
              borderRadius: 2,
              backgroundColor: isRecording ? colors.statusCritical : colors.textTertiary,
              transition: isRecording ? 'none' : `height ${transitions.quick}`,
              opacity: isRecording ? 0.8 : 0.3,
            }}
          />
        )
      })}
    </div>
  ),
)
WaveformBars.displayName = 'WaveformBars'

// ── Extraction Entity Card ────────────────────────────────────

interface EntityCardProps {
  entity: ExtractedEntity
  index: number
  onRemove: (index: number) => void
}

const EntityCard = memo<EntityCardProps>(({ entity, index, onRemove }) => {
  const config = ENTITY_CONFIG[entity.type] || ENTITY_CONFIG.general_note
  const Icon = config.icon
  const data = entity.data as Record<string, unknown>

  // Flatten data into displayable key/value pairs
  const displayFields = useMemo(() => {
    const fields: Array<{ key: string; value: string }> = []

    if (entity.type === 'daily_log') {
      const activities = data.activities as Array<Record<string, unknown>> | undefined
      if (activities?.[0]) {
        const act = activities[0]
        if (act.trade) fields.push({ key: 'Trade', value: String(act.trade) })
        if (act.location) fields.push({ key: 'Location', value: String(act.location) })
        if (act.description) fields.push({ key: 'Description', value: String(act.description) })
        if (act.progress != null) fields.push({ key: 'Progress', value: `${act.progress}%` })
      }
      const crew = data.crew as Array<Record<string, unknown>> | undefined
      if (crew?.[0]) {
        fields.push({ key: 'Crew', value: `${crew[0].headcount} from ${crew[0].company}` })
      }
      const weather = data.weather as Record<string, unknown> | undefined
      if (weather) {
        fields.push({ key: 'Weather', value: `${weather.condition}, ${weather.temp_f}°F` })
      }
    } else if (entity.type === 'rfi_draft') {
      if (data.subject) fields.push({ key: 'Subject', value: String(data.subject) })
      if (data.location) fields.push({ key: 'Location', value: String(data.location) })
      if (data.question) fields.push({ key: 'Question', value: String(data.question) })
      if (data.priority) fields.push({ key: 'Priority', value: String(data.priority) })
    } else if (entity.type === 'punch_item') {
      if (data.title) fields.push({ key: 'Title', value: String(data.title) })
      if (data.location) fields.push({ key: 'Location', value: String(data.location) })
      if (data.trade) fields.push({ key: 'Trade', value: String(data.trade) })
      if (data.priority) fields.push({ key: 'Priority', value: String(data.priority) })
    } else if (entity.type === 'safety_observation') {
      if (data.description) fields.push({ key: 'Description', value: String(data.description) })
      if (data.location) fields.push({ key: 'Location', value: String(data.location) })
      if (data.severity) fields.push({ key: 'Severity', value: String(data.severity) })
      if (data.corrective_action) fields.push({ key: 'Action', value: String(data.corrective_action) })
    } else {
      if (data.description) fields.push({ key: 'Note', value: String(data.description) })
    }

    return fields
  }, [entity, data])

  return (
    <div
      style={{
        backgroundColor: colors.darkHoverBg,
        borderRadius: borderRadius.lg,
        border: `1px solid rgba(255, 255, 255, 0.12)`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${spacing['3']} ${spacing['4']}`,
          borderBottom: `1px solid ${colors.darkHoverBg}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: borderRadius.sm,
              backgroundColor: config.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={12} color={colors.white} />
          </div>
          <span
            style={{
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.semibold,
              color: config.color,
              textTransform: 'uppercase',
              letterSpacing: typography.letterSpacing.wider,
            }}
          >
            {config.label}
          </span>
          <span
            style={{
              fontSize: typography.fontSize.caption,
              color: colors.darkMutedText,
            }}
          >
            {Math.round(entity.confidence * 100)}% confidence
          </span>
        </div>
        <button
          onClick={() => onRemove(index)}
          aria-label={`Remove ${config.label}`}
          style={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: borderRadius.sm,
            cursor: 'pointer',
            color: colors.toolbarBg,
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Fields */}
      <div style={{ padding: `${spacing['3']} ${spacing['4']}` }}>
        {displayFields.map((field) => (
          <div
            key={field.key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              padding: `${spacing['1']} 0`,
              gap: spacing['4'],
            }}
          >
            <span
              style={{
                fontSize: typography.fontSize.caption,
                color: colors.darkMutedText,
                flexShrink: 0,
                minWidth: 70,
              }}
            >
              {field.key}
            </span>
            <span
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.textOnDark,
                fontWeight: typography.fontWeight.medium,
                textAlign: 'right',
                lineHeight: typography.lineHeight.snug,
              }}
            >
              {field.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
})
EntityCard.displayName = 'EntityCard'

// ── Audio Playback Button ─────────────────────────────────────

const AudioPlayback = memo<{ audioUrl: string | null }>(({ audioUrl }) => {
  const [playing, setPlaying] = React.useState(false)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  const toggle = useCallback(() => {
    if (!audioUrl) return
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)
      audioRef.current.onended = () => setPlaying(false)
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }, [audioUrl, playing])

  if (!audioUrl) return null

  return (
    <button
      onClick={toggle}
      aria-label={playing ? 'Pause playback' : 'Play recording'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: spacing['1'],
        padding: `${spacing['1.5']} ${spacing['3']}`,
        backgroundColor: colors.overlayWhiteThin,
        border: 'none',
        borderRadius: borderRadius.full,
        color: colors.overlayWhiteBold,
        fontSize: typography.fontSize.caption,
        fontFamily: typography.fontFamily,
        fontWeight: typography.fontWeight.medium,
        cursor: 'pointer',
      }}
    >
      {playing ? <Pause size={11} /> : <Play size={11} />}
      {playing ? 'Pause' : 'Re-listen'}
    </button>
  )
})
AudioPlayback.displayName = 'AudioPlayback'

// ── Main VoiceCapture Component ───────────────────────────────

interface VoiceCaptureProps {
  onClose: () => void
  onConfirm: (entities: ExtractedEntity[], transcript: string, audioBlob: Blob | null) => void
}

export const VoiceCapture: React.FC<VoiceCaptureProps> = ({ onClose, onConfirm }) => {
  const vc = useVoiceCapture()

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  const handleConfirmAll = useCallback(() => {
    onConfirm(vc.entities, vc.transcript, vc.audioBlob)
  }, [onConfirm, vc.entities, vc.transcript, vc.audioBlob])

  const handleClose = useCallback(() => {
    vc.reset()
    onClose()
  }, [vc, onClose])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: zIndex.tooltip,
        backgroundColor: 'rgba(0, 0, 0, 0.92)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'auto',
      }}
      role="dialog"
      aria-label="Voice capture"
      aria-modal="true"
    >
      {/* Top bar */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${spacing['4']} ${spacing['5']}`,
        }}
      >
        {/* Language selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <Globe size={14} color="rgba(255, 255, 255, 0.5)" />
          <select
            value={vc.language}
            onChange={(e) => vc.setLanguage(e.target.value as SupportedLanguage)}
            disabled={vc.phase === 'recording'}
            aria-label="Select language"
            style={{
              backgroundColor: colors.darkHoverBg,
              color: colors.overlayWhiteBold,
              border: 'none',
              borderRadius: borderRadius.base,
              padding: `${spacing['1']} ${spacing['2']}`,
              fontSize: typography.fontSize.caption,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {vc.languageOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {vc.detectedLanguage && (
            <span
              style={{
                fontSize: typography.fontSize.caption,
                color: colors.statusActive,
                fontWeight: typography.fontWeight.medium,
              }}
            >
              Detected: {vc.detectedLanguage}
            </span>
          )}
        </div>

        {/* Status indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          {vc.pendingSync > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: spacing['1'],
                fontSize: typography.fontSize.caption,
                color: colors.statusPending,
              }}
            >
              <WifiOff size={11} />
              {vc.pendingSync} pending sync
            </span>
          )}
          <button
            onClick={handleClose}
            aria-label="Close voice capture"
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: colors.textOnDarkMuted,
              cursor: 'pointer',
              padding: spacing['2'],
            }}
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: vc.phase === 'review' ? 'flex-start' : 'center',
          maxWidth: '540px',
          width: '100%',
          padding: `0 ${spacing['5']}`,
          paddingBottom: spacing['8'],
        }}
      >
        {/* ── Idle / Recording / Processing States ─────────── */}
        {(vc.phase === 'idle' || vc.phase === 'recording' || vc.phase === 'processing') && (
          <>
            {/* Waveform */}
            <div style={{ marginBottom: spacing['6'] }}>
              <WaveformBars
                frequencies={vc.waveform.frequencies}
                isRecording={vc.phase === 'recording'}
              />
              <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
                {vc.phase === 'recording' ? 'Audio waveform active' : ''}
              </span>
            </div>

            {/* Timer */}
            <p
              style={{
                fontSize: typography.fontSize['4xl'],
                fontWeight: typography.fontWeight.semibold,
                color: colors.white,
                margin: 0,
                marginBottom: spacing['2'],
                fontFeatureSettings: '"tnum"',
              }}
            >
              {formatTime(vc.elapsed)}
            </p>

            {/* Status text */}
            <p
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.textOnDarkMuted,
                margin: 0,
                marginBottom: spacing['8'],
              }}
            >
              {vc.phase === 'idle' && 'Tap to start recording'}
              {vc.phase === 'recording' && 'Listening...'}
              {vc.phase === 'processing' && (
                <span style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  <Sparkles size={14} color={colors.statusReview} />
                  Extracting structured data...
                </span>
              )}
            </p>

            {/* Record / Stop button */}
            {vc.phase !== 'processing' && (
              <button
                onClick={vc.phase === 'recording' ? vc.stopRecording : vc.startRecording}
                aria-label={vc.phase === 'recording' ? 'Stop recording' : 'Start voice recording'}
                aria-pressed={vc.phase === 'recording'}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  backgroundColor: vc.phase === 'recording' ? 'rgba(255, 255, 255, 0.15)' : colors.statusCritical,
                  border: `3px solid ${vc.phase === 'recording' ? colors.statusCritical : 'transparent'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: `all ${transitions.quick}`,
                }}
              >
                {vc.phase === 'recording' ? (
                  <Square size={24} color={colors.white} fill={colors.white} />
                ) : (
                  <Mic size={28} color={colors.white} />
                )}
              </button>
            )}

            {/* Processing spinner */}
            {vc.phase === 'processing' && (
              <div
                style={{
                  width: 48,
                  height: 48,
                  border: `3px solid ${colors.overlayWhiteThin}`,
                  borderTopColor: colors.statusReview,
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            )}

            {/* Live transcript */}
            {(vc.transcript || vc.interimText) && (
              <div
                style={{
                  marginTop: spacing['8'],
                  width: '100%',
                }}
              >
                <p
                  style={{
                    fontSize: typography.fontSize.caption,
                    color: colors.darkMutedText,
                    margin: 0,
                    marginBottom: spacing['2'],
                    textTransform: 'uppercase',
                    letterSpacing: typography.letterSpacing.wider,
                  }}
                >
                  Transcription
                </p>
                <p
                  style={{
                    fontSize: typography.fontSize.body,
                    color: colors.textOnDark,
                    margin: 0,
                    lineHeight: typography.lineHeight.relaxed,
                  }}
                >
                  {vc.transcript}
                  {vc.interimText && (
                    <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                      {' '}{vc.interimText}
                    </span>
                  )}
                  {vc.phase === 'recording' && (
                    <span
                      style={{
                        opacity: 0.5,
                        animation: 'pulse 1s infinite',
                      }}
                    >
                      |
                    </span>
                  )}
                </p>
              </div>
            )}
          </>
        )}

        {/* ── Review State (Extracted Entities) ────────────── */}
        {vc.phase === 'review' && (
          <>
            {/* Header */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                marginBottom: spacing['4'],
                marginTop: spacing['4'],
              }}
            >
              <Sparkles size={16} color={colors.statusReview} />
              <span
                style={{
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.statusReview,
                  textTransform: 'uppercase',
                  letterSpacing: typography.letterSpacing.wider,
                }}
              >
                AI Extracted {vc.entities.length} Item{vc.entities.length !== 1 ? 's' : ''}
              </span>
              {vc.extractionResult && (
                <span
                  style={{
                    fontSize: typography.fontSize.caption,
                    color: colors.darkMutedText,
                    marginLeft: 'auto',
                  }}
                >
                  {vc.extractionResult.processingTimeMs}ms
                </span>
              )}
            </div>

            {/* Transcript with playback */}
            <div
              style={{
                width: '100%',
                padding: spacing['3'],
                backgroundColor: 'rgba(255, 255, 255, 0.04)', /* subtle dark bg */
                borderRadius: borderRadius.base,
                marginBottom: spacing['4'],
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: spacing['2'],
                }}
              >
                <span
                  style={{
                    fontSize: typography.fontSize.caption,
                    color: colors.darkMutedText,
                    textTransform: 'uppercase',
                    letterSpacing: typography.letterSpacing.wider,
                  }}
                >
                  Original transcript
                </span>
                <AudioPlayback audioUrl={vc.audioUrl} />
              </div>
              <p
                style={{
                  fontSize: typography.fontSize.sm,
                  color: 'rgba(255, 255, 255, 0.65)', /* between muted and bold */
                  margin: 0,
                  lineHeight: typography.lineHeight.relaxed,
                  fontStyle: 'italic',
                }}
              >
                "{vc.transcript}"
              </p>
            </div>

            {/* Entity cards */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: spacing['3'],
                marginBottom: spacing['6'],
              }}
            >
              {vc.entities.map((entity, index) => (
                <EntityCard
                  key={`${entity.type}-${index}`}
                  entity={entity}
                  index={index}
                  onRemove={vc.removeEntity}
                />
              ))}

              {vc.entities.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: spacing['8'],
                    color: colors.darkMutedText,
                    fontSize: typography.fontSize.sm,
                  }}
                >
                  No entities extracted. Try recording a longer description.
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                gap: spacing['3'],
                position: 'sticky',
                bottom: spacing['4'],
              }}
            >
              <button
                onClick={handleConfirmAll}
                disabled={vc.entities.length === 0}
                aria-label={`Confirm all ${vc.entities.length} items`}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing['2'],
                  padding: spacing['4'],
                  backgroundColor: vc.entities.length > 0 ? colors.statusReview : 'rgba(255, 255, 255, 0.1)',
                  color: colors.white,
                  border: 'none',
                  borderRadius: borderRadius.lg,
                  fontSize: typography.fontSize.body,
                  fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily,
                  cursor: vc.entities.length > 0 ? 'pointer' : 'default',
                  opacity: vc.entities.length > 0 ? 1 : 0.5,
                  transition: `opacity ${transitions.quick}`,
                  minHeight: '48px',
                }}
              >
                <CheckCircle size={18} />
                Confirm All ({vc.entities.length})
              </button>
              <button
                onClick={() => {
                  vc.reset()
                }}
                aria-label="Record again"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing['2'],
                  padding: `${spacing['4']} ${spacing['5']}`,
                  backgroundColor: colors.overlayWhiteThin,
                  color: colors.overlayWhiteBold,
                  border: 'none',
                  borderRadius: borderRadius.lg,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  fontWeight: typography.fontWeight.medium,
                  cursor: 'pointer',
                  minHeight: '48px',
                }}
              >
                <Mic size={16} />
                Redo
              </button>
              <button
                onClick={handleClose}
                aria-label="Discard recording"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: `${spacing['4']} ${spacing['5']}`,
                  backgroundColor: colors.darkHoverBg,
                  color: colors.darkMutedText,
                  border: 'none',
                  borderRadius: borderRadius.lg,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                  minHeight: '48px',
                }}
              >
                Discard
              </button>
            </div>
          </>
        )}

        {/* ── Error State ──────────────────────────────────── */}
        {vc.phase === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <AlertTriangle
              size={32}
              color={colors.statusCritical}
              style={{ marginBottom: spacing['3'] }}
            />
            <p
              style={{
                fontSize: typography.fontSize.body,
                color: colors.statusCritical,
                margin: 0,
                marginBottom: spacing['4'],
              }}
            >
              {vc.error}
            </p>
            <button
              onClick={vc.reset}
              style={{
                padding: `${spacing['3']} ${spacing['6']}`,
                backgroundColor: colors.overlayWhiteThin,
                color: colors.overlayWhiteBold,
                border: 'none',
                borderRadius: borderRadius.base,
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.medium,
                fontFamily: typography.fontFamily,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Screen reader live region for recording state and transcription */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
      >
        {vc.phase === 'recording' ? 'Recording in progress' : vc.transcript}
      </div>

      {/* CSS animation for spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

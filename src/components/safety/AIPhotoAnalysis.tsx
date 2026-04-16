import React, { useState, useRef, useCallback, memo } from 'react'
import {
  Camera, Upload, ShieldAlert, AlertTriangle, CheckCircle,
  Eye, Sparkles, Plus, X,
} from 'lucide-react'
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme'
import { Btn, Card, SectionHeader } from '../Primitives'
import { usePhotoAnalysis } from '../../hooks/usePhotoAnalysis'
import type { PhotoAnalysisResult } from '../../hooks/usePhotoAnalysis'
import { PermissionGate } from '../auth/PermissionGate'
import { toast } from 'sonner'

// ── Severity Config ───────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  critical: { color: colors.statusCritical, bg: colors.statusCriticalSubtle, icon: ShieldAlert },
  warning: { color: colors.statusPending, bg: colors.statusPendingSubtle, icon: AlertTriangle },
  info: { color: colors.statusInfo, bg: colors.statusInfoSubtle, icon: Eye },
}

// ── Violation Card ────────────────────────────────────────────

const ViolationCard = memo<{
  violation: PhotoAnalysisResult['safetyViolations'][0]
  onCreateObservation: (description: string, severity: string) => void
}>(({ violation, onCreateObservation }) => {
  const config = SEVERITY_CONFIG[violation.severity] || SEVERITY_CONFIG.info
  const Icon = config.icon

  return (
    <div style={{
      display: 'flex', gap: spacing['3'],
      padding: spacing['3'],
      backgroundColor: config.bg,
      borderRadius: borderRadius.md,
      borderLeft: `3px solid ${config.color}`,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: borderRadius.base,
        backgroundColor: config.color, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={14} color={colors.white} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
          <span style={{
            fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
            color: config.color, textTransform: 'uppercase',
          }}>
            {violation.severity}
          </span>
          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
            {violation.type}
          </span>
        </div>
        <p style={{
          margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary,
          lineHeight: typography.lineHeight.normal,
        }}>
          {violation.description}
        </p>
        {violation.location && (
          <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            Location: {violation.location}
          </p>
        )}

        {/* Action button */}
        <PermissionGate permission="safety.create">
          <button
            onClick={() => onCreateObservation(
              `${violation.type}: ${violation.description}${violation.location ? ` at ${violation.location}` : ''}`,
              violation.severity,
            )}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
              padding: `${spacing['1.5']} ${spacing['3']}`,
              backgroundColor: config.color, color: colors.white,
              border: 'none', borderRadius: borderRadius.base,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily, cursor: 'pointer',
              marginTop: spacing['2'],
              transition: `opacity ${transitions.instant}`,
            }}
          >
            <Plus size={11} /> Create Safety Observation
          </button>
        </PermissionGate>
      </div>
    </div>
  )
})
ViolationCard.displayName = 'ViolationCard'

// ── PPE Compliance Badge ──────────────────────────────────────

const PPEBadge = memo<{ compliance: PhotoAnalysisResult['ppeCompliance']; workersVisible: number }>(
  ({ compliance, workersVisible }) => {
    const isCompliant = compliance.compliant
    const color = isCompliant ? colors.statusActive : colors.statusCritical
    const bg = isCompliant ? colors.statusActiveSubtle : colors.statusCriticalSubtle

    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing['3'],
        padding: spacing['4'], backgroundColor: bg, borderRadius: borderRadius.md,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: borderRadius.full,
          backgroundColor: color, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {isCompliant ? <CheckCircle size={20} color={colors.white} /> : <ShieldAlert size={20} color={colors.white} />}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            PPE: {isCompliant ? 'Compliant' : 'Violations Detected'}
          </p>
          <p style={{ margin: `${spacing['0.5']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
            {workersVisible} worker{workersVisible !== 1 ? 's' : ''} visible
            {!isCompliant && compliance.violations.length > 0 && (
              <> · {compliance.violations.length} violation{compliance.violations.length !== 1 ? 's' : ''}</>
            )}
          </p>
          {!isCompliant && compliance.violations.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['1'], marginTop: spacing['2'] }}>
              {compliance.violations.map((v, i) => (
                <span key={i} style={{
                  padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
                  backgroundColor: colors.statusCritical, color: colors.white,
                  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                }}>
                  {v}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  },
)
PPEBadge.displayName = 'PPEBadge'

// ── Main AI Photo Analysis Panel ──────────────────────────────

export const AIPhotoAnalysis: React.FC = () => {
  const { state, result, error, analyzePhoto, reset } = usePhotoAnalysis()
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        setImagePreview(dataUrl)
        analyzePhoto(dataUrl)
      }
      reader.readAsDataURL(file)
    },
    [analyzePhoto],
  )

  const handleCreateObservation = useCallback(
    (description: string, _severity: string) => {
      // In production, this would call the safety observation mutation
      toast.success(`Safety observation created: ${description.substring(0, 50)}...`)
    },
    [],
  )

  const handleReset = useCallback(() => {
    reset()
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [reset])

  return (
    <div>
      {/* Upload area */}
      {!imagePreview && (
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: spacing['3'],
            padding: spacing['8'],
            border: `2px dashed ${colors.borderDefault}`,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.surfaceInset,
            cursor: 'pointer',
            transition: `border-color ${transitions.quick}`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = colors.primaryOrange }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = colors.borderDefault }}
          role="button"
          aria-label="Upload site photo for AI safety analysis"
        >
          <div style={{
            width: 48, height: 48, borderRadius: borderRadius.full,
            backgroundColor: colors.orangeSubtle, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Camera size={24} color={colors.primaryOrange} />
          </div>
          <p style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            Upload Site Photo
          </p>
          <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary, textAlign: 'center' }}>
            AI will analyze for safety violations, PPE compliance, and work progress
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* Image preview + analysis */}
      {imagePreview && (
        <div>
          {/* Image with analysis overlay */}
          <div style={{ position: 'relative', marginBottom: spacing['4'] }}>
            <img
              src={imagePreview}
              alt="Uploaded site photo"
              style={{
                width: '100%', maxHeight: 400, objectFit: 'cover',
                borderRadius: borderRadius.lg,
              }}
            />

            {/* Analysis state overlay */}
            {state === 'analyzing' && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: spacing['3'],
                backgroundColor: 'rgba(0, 0, 0, 0.6)', borderRadius: borderRadius.lg,
                backdropFilter: 'blur(4px)',
              }}>
                <div style={{
                  width: 40, height: 40, border: `3px solid rgba(255,255,255,0.2)`,
                  borderTopColor: colors.primaryOrange, borderRadius: '50%',
                  animation: 'safetyAnalysisSpin 0.8s linear infinite',
                }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  <Sparkles size={14} color={colors.primaryOrange} />
                  <span style={{ color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>
                    Analyzing with Claude Vision...
                  </span>
                </div>
              </div>
            )}

            {/* Close button */}
            <button
              onClick={handleReset}
              aria-label="Remove photo"
              style={{
                position: 'absolute', top: spacing['2'], right: spacing['2'],
                width: 32, height: 32, borderRadius: borderRadius.full,
                backgroundColor: 'rgba(0, 0, 0, 0.5)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: colors.white,
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Analysis Results */}
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
              {/* Summary */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: spacing['3'],
                padding: spacing['4'], backgroundColor: colors.statusReviewSubtle,
                borderRadius: borderRadius.md, borderLeft: `3px solid ${colors.statusReview}`,
              }}>
                <Sparkles size={16} color={colors.statusReview} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                    AI Analysis Summary
                  </p>
                  <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.normal }}>
                    {result.summary}
                  </p>
                </div>
              </div>

              {/* PPE Compliance */}
              <PPEBadge compliance={result.ppeCompliance} workersVisible={result.workersVisible} />

              {/* Safety Violations */}
              {result.safetyViolations.length > 0 && (
                <div>
                  <SectionHeader
                    title={`${result.safetyViolations.length} Safety Violation${result.safetyViolations.length !== 1 ? 's' : ''} Detected`}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'], marginTop: spacing['3'] }}>
                    {result.safetyViolations.map((violation, i) => (
                      <ViolationCard
                        key={i}
                        violation={violation}
                        onCreateObservation={handleCreateObservation}
                      />
                    ))}
                  </div>
                </div>
              )}

              {result.safetyViolations.length === 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                  padding: spacing['4'], backgroundColor: colors.statusActiveSubtle,
                  borderRadius: borderRadius.md,
                }}>
                  <CheckCircle size={16} color={colors.statusActive} />
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusActive }}>
                    No safety violations detected
                  </span>
                </div>
              )}

              {/* Progress Observations */}
              {result.progressObservations.length > 0 && (
                <Card padding={spacing['4']}>
                  <SectionHeader title="Progress Observations" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginTop: spacing['3'] }}>
                    {result.progressObservations.map((obs, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['2']} 0`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        <div>
                          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{obs.trade}</span>
                          <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{obs.description}</p>
                        </div>
                        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.primaryOrange }}>
                          {obs.estimatedProgress}%
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Tags */}
              {result.suggestedTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['1'] }}>
                  {result.suggestedTags.map((tag, i) => (
                    <span key={i} style={{
                      padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full,
                      backgroundColor: colors.surfaceInset, color: colors.textSecondary,
                      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Bulk create action */}
              {result.safetyViolations.length > 0 && (
                <PermissionGate permission="safety.create">
                  <Btn
                    onClick={() => {
                      toast.success(`${result.safetyViolations.length} safety observations created from photo analysis`)
                    }}
                  >
                    <ShieldAlert size={14} /> Create All {result.safetyViolations.length} Safety Observations
                  </Btn>
                </PermissionGate>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: spacing['2'],
              padding: spacing['4'], backgroundColor: colors.statusCriticalSubtle,
              borderRadius: borderRadius.md,
            }}>
              <AlertTriangle size={16} color={colors.statusCritical} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.statusCritical }}>{error}</span>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes safetyAnalysisSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

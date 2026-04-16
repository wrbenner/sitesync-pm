import React from 'react'
import { Building, Calendar, Camera, MessageSquare, CheckCircle } from 'lucide-react'
import { Skeleton } from '../components/Primitives'
import { colors, spacing, typography, borderRadius, shadows } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useProject, useSchedulePhases, useOwnerUpdates } from '../hooks/queries'

function ProgressRing({ value, size = 160, stroke = 10 }: { value: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={colors.borderDefault} strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={colors.primaryOrange} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '36px', fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>
          {value}%
        </span>
        <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Complete</span>
      </div>
    </div>
  )
}

function MilestoneTimeline({ phases }: { phases: unknown[] }) {
  if (!phases || phases.length === 0) {
    return <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm }}>No schedule milestones available.</p>
  }

  const milestones = phases.slice(0, 8)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {milestones.map((phase: unknown, i: number) => {
        const isComplete = phase.progress_pct >= 100
        const isActive = phase.progress_pct > 0 && phase.progress_pct < 100
        const dotColor = isComplete ? colors.statusActive : isActive ? colors.primaryOrange : colors.borderDefault

        return (
          <div key={phase.id || i} style={{ display: 'flex', gap: spacing.md, minHeight: 56 }}>
            {/* Timeline line + dot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20 }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                backgroundColor: dotColor, border: `2px solid ${dotColor}`,
                flexShrink: 0, marginTop: 4,
              }} />
              {i < milestones.length - 1 && (
                <div style={{ width: 2, flex: 1, backgroundColor: colors.borderDefault }} />
              )}
            </div>
            {/* Content */}
            <div style={{ paddingBottom: spacing.md }}>
              <p style={{ margin: 0, fontWeight: typography.fontWeight.medium, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                {phase.name}
              </p>
              <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 2 }}>
                {phase.start_date ? new Date(phase.start_date).toLocaleDateString() : ''} &mdash; {phase.end_date ? new Date(phase.end_date).toLocaleDateString() : ''}
                {isComplete && (
                  <CheckCircle size={12} style={{ marginLeft: 6, color: colors.statusActive, verticalAlign: 'middle' }} />
                )}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const OwnerPortal: React.FC = () => {
  const projectId = useProjectId()
  const { data: project, isLoading: projectLoading } = useProject(projectId)
  const { data: phases, isLoading: phasesLoading } = useSchedulePhases(projectId)
  const { data: updates, isLoading: updatesLoading } = useOwnerUpdates(projectId)

  const isLoading = projectLoading || phasesLoading || updatesLoading

  const publishedUpdates = updates?.filter((u: unknown) => u.published) || []
  const latestUpdate = publishedUpdates.length > 0 ? publishedUpdates[0] : null

  const avgProgress = phases?.length ? Math.round(phases.reduce((s: number, p: unknown) => s + (p.percent_complete || 0), 0) / phases.length) : 62
  const overallProgress = avgProgress

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', backgroundColor: colors.white,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: `${spacing['6']} ${spacing['4']}`,
      }}>
        <Skeleton width="300px" height="36px" />
        <div style={{ marginTop: spacing.lg }}><Skeleton width="160px" height="160px" /></div>
        <div style={{ marginTop: spacing.xl, width: '100%', maxWidth: 720 }}><Skeleton width="100%" height="300px" /></div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.white,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: `${spacing['6']} ${spacing['4']}`,
      fontFamily: typography.fontFamily,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
          <Building size={20} style={{ color: colors.orangeText }} />
          <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.orangeText, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.widest }}>
            Owner Portal
          </span>
        </div>
        <h1 style={{
          fontSize: '32px', fontWeight: typography.fontWeight.bold,
          color: colors.textPrimary, margin: 0, letterSpacing: typography.letterSpacing.tight,
        }}>
          {project?.name || 'Project'}
        </h1>
        {project?.address && (
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginTop: spacing.xs }}>
            {project.address}
          </p>
        )}
      </div>

      {/* Progress Ring */}
      <div style={{ marginBottom: spacing.xl }}>
        <ProgressRing value={overallProgress} />
      </div>

      {/* Content area */}
      <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>

        {/* Schedule Milestones */}
        <div style={{
          backgroundColor: colors.surfaceRaised,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          boxShadow: shadows.sm,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Calendar size={18} style={{ color: colors.orangeText }} />
            <h2 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Schedule Milestones
            </h2>
          </div>
          <MilestoneTimeline phases={phases || []} />
        </div>

        {/* Latest Update */}
        <div style={{
          backgroundColor: colors.surfaceRaised,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          boxShadow: shadows.sm,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <MessageSquare size={18} style={{ color: colors.orangeText }} />
            <h2 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Latest Update
            </h2>
          </div>
          {latestUpdate ? (
            <div>
              <h3 style={{ margin: 0, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing.xs }}>
                {latestUpdate.title}
              </h3>
              <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.6 }}>
                {latestUpdate.content || latestUpdate.schedule_summary || 'No details available.'}
              </p>
              <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: spacing.sm }}>
                Posted {latestUpdate.created_at ? new Date(latestUpdate.created_at).toLocaleDateString() : ''}
              </p>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
              No published updates yet.
            </p>
          )}
        </div>

        {/* Photo Gallery Placeholder */}
        <div style={{
          backgroundColor: colors.surfaceRaised,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          boxShadow: shadows.sm,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Camera size={18} style={{ color: colors.orangeText }} />
            <h2 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Project Photos
            </h2>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing.sm,
          }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} style={{
                aspectRatio: '4/3',
                backgroundColor: colors.surfaceInset,
                borderRadius: borderRadius.base,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Camera size={24} style={{ color: colors.textTertiary, opacity: 0.4 }} />
              </div>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm }}>
            Photo gallery loading
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: spacing.xl, textAlign: 'center' }}>
        <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>
          Powered by SiteSync AI
        </p>
      </div>
    </div>
  )
}

export default OwnerPortal

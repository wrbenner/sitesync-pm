import React, { useState } from 'react'
import { Building, Calendar, Camera, MessageSquare, CheckCircle, Send, CheckCheck } from 'lucide-react'
import { Skeleton } from '../components/Primitives'
import { colors, spacing, typography, borderRadius, shadows } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useProject, useSchedulePhases } from '../hooks/queries'
import { useOwnerUpdatesForProject, type OwnerUpdate } from '../hooks/queries/owner-updates'
import { useCreateOwnerUpdate, useAcknowledgeOwnerUpdate } from '../hooks/mutations/owner-updates'
import { usePermissions } from '../hooks/usePermissions'
import { useAuth } from '../hooks/useAuth'
import type { SchedulePhase } from '../types/database'

// ── Progress Ring ──────────────────────────────────────────
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

// ── Milestone Timeline ─────────────────────────────────────
function MilestoneTimeline({ phases }: { phases: SchedulePhase[] }) {
  if (!phases || phases.length === 0) {
    return <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm }}>No schedule milestones available.</p>
  }

  const milestones = phases.slice(0, 8)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {milestones.map((phase, i) => {
        const pct = phase.percent_complete ?? 0
        const isComplete = pct >= 100
        const isActive = pct > 0 && pct < 100
        const dotColor = isComplete ? colors.statusActive : isActive ? colors.primaryOrange : colors.borderDefault

        return (
          <div key={phase.id || i} style={{ display: 'flex', gap: spacing.md, minHeight: 56 }}>
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
            <div style={{ paddingBottom: spacing.md, flex: 1 }}>
              <p style={{ margin: 0, fontWeight: typography.fontWeight.medium, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                {phase.name}
              </p>
              <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 2 }}>
                {phase.start_date ? new Date(phase.start_date).toLocaleDateString() : ''} &mdash; {phase.end_date ? new Date(phase.end_date).toLocaleDateString() : ''}
                {' '}&middot;{' '}{pct}%
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

// ── Composer (owners only) ─────────────────────────────────
interface ComposerProps {
  projectId: string
  userId: string | null
}
function UpdateComposer({ projectId, userId }: ComposerProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const createUpdate = useCreateOwnerUpdate()

  const disabled = createUpdate.isPending || title.trim().length === 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled) return
    await createUpdate.mutateAsync({
      project_id: projectId,
      title,
      content,
      created_by: userId,
      publish: true,
    })
    setTitle('')
    setContent('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        boxShadow: shadows.sm,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.sm,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
        <Send size={18} style={{ color: colors.orangeText }} />
        <h2 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
          Post an Update
        </h2>
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Update title (required)"
        maxLength={200}
        style={{
          width: '100%',
          padding: `${spacing.sm} ${spacing.md}`,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: borderRadius.base,
          fontSize: typography.fontSize.base,
          fontFamily: typography.fontFamily,
          color: colors.textPrimary,
          backgroundColor: colors.white,
        }}
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share progress, milestones, risks, or decisions with the owner"
        rows={4}
        style={{
          width: '100%',
          padding: `${spacing.sm} ${spacing.md}`,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: borderRadius.base,
          fontSize: typography.fontSize.sm,
          fontFamily: typography.fontFamily,
          color: colors.textPrimary,
          backgroundColor: colors.white,
          resize: 'vertical',
          minHeight: 96,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="submit"
          disabled={disabled}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: spacing.xs,
            padding: `${spacing.sm} ${spacing.md}`,
            minHeight: 44,
            backgroundColor: disabled ? colors.borderDefault : colors.primaryOrange,
            color: colors.white,
            border: 'none',
            borderRadius: borderRadius.base,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <Send size={14} aria-hidden="true" />
          {createUpdate.isPending ? 'Posting…' : 'Post Update'}
        </button>
      </div>
    </form>
  )
}

// ── Single update card ─────────────────────────────────────
interface UpdateCardProps {
  update: OwnerUpdate
  currentUserId: string | null
}
function UpdateCard({ update, currentUserId }: UpdateCardProps) {
  const ack = useAcknowledgeOwnerUpdate()

  const handleAcknowledge = () => {
    if (!currentUserId || ack.isPending) return
    ack.mutate({ owner_update_id: update.id, user_id: currentUserId })
  }

  return (
    <div style={{
      backgroundColor: colors.surfaceRaised,
      border: `1px solid ${colors.borderSubtle}`,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      boxShadow: shadows.sm,
    }}>
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: spacing.sm }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            {update.title}
          </h3>
          <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 2 }}>
            {update.published
              ? `Posted ${update.published_at ? new Date(update.published_at).toLocaleDateString() : (update.created_at ? new Date(update.created_at).toLocaleDateString() : '')}`
              : 'Draft'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleAcknowledge}
          disabled={!currentUserId || ack.isPending}
          aria-label="Acknowledge this update"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: spacing.xs,
            padding: `${spacing.xs} ${spacing.sm}`,
            minHeight: 36,
            backgroundColor: colors.white,
            color: colors.textPrimary,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.base,
            fontSize: typography.fontSize.caption,
            fontFamily: typography.fontFamily,
            cursor: !currentUserId || ack.isPending ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <CheckCheck size={14} aria-hidden="true" />
          {ack.isPending ? 'Saving…' : 'Acknowledge'}
        </button>
      </div>

      {(update.content || update.schedule_summary) && (
        <p style={{ margin: 0, marginTop: spacing.sm, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {update.content || update.schedule_summary}
        </p>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────
export const OwnerPortal: React.FC = () => {
  const projectId = useProjectId()
  const { user } = useAuth()
  const { role } = usePermissions()
  const { data: project, isLoading: projectLoading } = useProject(projectId)
  const { data: phases, isLoading: phasesLoading } = useSchedulePhases(projectId)
  const { data: updates, isLoading: updatesLoading } = useOwnerUpdatesForProject(projectId)

  const isOwner = role === 'owner'
  const isLoading = projectLoading || phasesLoading || updatesLoading

  const visibleUpdates: OwnerUpdate[] = (updates ?? []).filter(
    (u) => isOwner || u.published,
  )

  const avgProgress: number | null = phases?.length
    ? Math.round(phases.reduce((s, p) => s + (p.percent_complete ?? 0), 0) / phases.length)
    : null
  const overallProgress = avgProgress ?? 0

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
        {avgProgress === null ? <Skeleton width="160px" height="160px" /> : <ProgressRing value={overallProgress} />}
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
          <MilestoneTimeline phases={(phases ?? []) as SchedulePhase[]} />
        </div>

        {/* Composer — owners only */}
        {isOwner && projectId && (
          <UpdateComposer projectId={projectId} userId={user?.id ?? null} />
        )}

        {/* Updates list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            <MessageSquare size={18} style={{ color: colors.orangeText }} />
            <h2 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Updates
            </h2>
          </div>
          {visibleUpdates.length === 0 ? (
            <div style={{
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              boxShadow: shadows.sm,
            }}>
              <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                No published updates yet.
              </p>
            </div>
          ) : (
            visibleUpdates.map((u) => (
              <UpdateCard key={u.id} update={u} currentUserId={user?.id ?? null} />
            ))
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
          Powered by SiteSync PM
        </p>
      </div>
    </div>
  )
}

export default OwnerPortal

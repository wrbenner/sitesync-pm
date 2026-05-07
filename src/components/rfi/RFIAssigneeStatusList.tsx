/**
 * RFIAssigneeStatusList — multi-assignee panel for the RFI detail page.
 *
 * Surfaces what the May-7 Procore-parity audit flagged as a Brad-eye
 * gap: Procore's RFI detail shows three checkbox-marked people with a
 * red "Response Required" tag per unresponded assignee, and SiteSync
 * shows just `ball_in_court`. The plumbing is already there
 * (`rfi_assignees` table, populated by P1b workflow-depth migration);
 * we just weren't rendering it.
 *
 * Each row: avatar + UserName + per-person ✓ checkbox (the "responded
 * indicator", driven by `responded_at`). Toggling persists to
 * `rfi_assignees.responded_at`; the trigger at the DB level then
 * recomputes `rfis.ball_in_court` to the earliest unresponded
 * assignee's user_id.
 *
 * Permission: a user can flip their own row; admins/owners can flip
 * anyone's. Non-editable rows render the same UI without the click
 * handler.
 */

import React, { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, AlertCircle } from 'lucide-react'
import { fromTable } from '../../lib/db/queries'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import { UserName } from '../UserName'
import { Avatar } from '../Primitives'
import { useProfileNames, displayName } from '../../hooks/queries/profiles'
import { colors, spacing, typography } from '../../styles/theme'

type AssigneeRow = {
  id: string
  rfi_id: string
  user_id: string
  role: string | null
  responded_at: string | null
  response_id: string | null
  created_at: string
}

interface Props {
  rfiId: string
  /** Indicates whether the response_required pill should pulse — used
   *  during status transitions to draw attention to the unresponded set. */
  emphasize?: boolean
}

const dayDiff = (iso: string): number => {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

const initialsFromName = (name: string): string =>
  (name || '').trim().split(/\s+/).filter(Boolean).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || 'U'

export const RFIAssigneeStatusList: React.FC<Props> = ({ rfiId, emphasize = false }) => {
  const { user } = useAuth()
  const { hasPermission } = usePermissions()
  const queryClient = useQueryClient()

  const { data: assignees = [], isLoading } = useQuery({
    queryKey: ['rfi_assignees', rfiId],
    queryFn: async () => {
      const { data, error } = await fromTable('rfi_assignees')
        .select('*')
        .eq('rfi_id' as never, rfiId)
        .order('created_at' as never, { ascending: true })
      if (error) throw error
      return ((data as unknown) ?? []) as AssigneeRow[]
    },
    enabled: !!rfiId,
  })

  const userIds = useMemo(() => assignees.map((a) => a.user_id), [assignees])
  const { data: profileMap } = useProfileNames(userIds)

  const toggleResponded = useMutation({
    mutationFn: async (row: AssigneeRow) => {
      const next = row.responded_at ? null : new Date().toISOString()
      const { error } = await fromTable('rfi_assignees')
        .update({ responded_at: next } as never)
        .eq('id' as never, row.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfi_assignees', rfiId] })
      // Trigger recomputes ball_in_court on rfis; refetch the parent.
      queryClient.invalidateQueries({ queryKey: ['rfi', rfiId] })
      queryClient.invalidateQueries({ queryKey: ['rfis'] })
    },
  })

  if (isLoading) {
    return <div style={{ fontSize: 12, color: colors.textTertiary }}>Loading assignees…</div>
  }

  if (assignees.length === 0) {
    return (
      <div style={{ fontSize: 13, color: colors.textTertiary, fontStyle: 'italic' }}>
        No assignees. Set ball-in-court above or add via the Edit panel.
      </div>
    )
  }

  return (
    <ul
      aria-label="RFI assignees"
      style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: spacing['2'] }}
    >
      {assignees.map((row) => {
        const responded = !!row.responded_at
        const days = !responded ? dayDiff(row.created_at) : 0
        const canToggle = hasPermission('rfis.edit') || row.user_id === user?.id
        const name = displayName(profileMap, row.user_id, '')
        const labelName = name || ''

        return (
          <li
            key={row.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['3'],
              padding: `${spacing['2']} ${spacing['3']}`,
              borderRadius: 10,
              backgroundColor: responded ? colors.surfaceInset : colors.surfaceRaised,
              border: `1px solid ${responded ? colors.borderSubtle : colors.borderDefault}`,
            }}
          >
            <button
              type="button"
              onClick={() => canToggle && toggleResponded.mutate(row)}
              disabled={!canToggle || toggleResponded.isPending}
              aria-label={
                responded
                  ? `Mark ${labelName || 'assignee'} as not responded`
                  : `Mark ${labelName || 'assignee'} as responded`
              }
              aria-pressed={responded}
              style={{
                width: 22,
                height: 22,
                flex: '0 0 auto',
                borderRadius: 6,
                border: `2px solid ${responded ? colors.green : colors.borderDefault}`,
                background: responded ? colors.green : 'transparent',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: canToggle ? 'pointer' : 'default',
                opacity: canToggle ? 1 : 0.6,
              }}
            >
              {responded ? <Check size={14} strokeWidth={3} /> : null}
            </button>

            <Avatar initials={initialsFromName(labelName)} size={28} />

            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: typography.fontSize.body,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <UserName userId={row.user_id} fallback="—" />
                {row.role ? (
                  <span style={{ marginLeft: 6, fontSize: 11, color: colors.textTertiary, fontWeight: 500 }}>
                    · {row.role}
                  </span>
                ) : null}
              </span>
              {responded ? (
                <span style={{ fontSize: 11, color: colors.green, marginTop: 2 }}>
                  Responded {dayDiff(row.responded_at!)}d ago
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 11,
                    color: colors.red,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 2,
                    animation: emphasize ? 'rfi-detail-pulse 1.5s ease-in-out infinite' : undefined,
                  }}
                >
                  <AlertCircle size={11} /> Response required
                  {days > 0 ? ` · ${days}d open` : ''}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default RFIAssigneeStatusList

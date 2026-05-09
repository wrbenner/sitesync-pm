// ── RFIResponseThread ───────────────────────────────────────────────────
// Drives the entirety of the response feed on the RFI detail page.
//
// Responsibilities:
//   • Render responses in chronological order (excluding soft-deleted
//     rows the viewer doesn't have permission to see — that filter
//     happens server-side in RLS).
//   • Pin the Official answer above the thread (P1b #5).
//   • Show response_type colored badge (P1b #6).
//   • Internal notes get yellow background + lock icon (P1b #7).
//   • Each response has a kebab menu with Edit / Delete (P1b #4).
//     - Edit only when own + within 24-hr window OR admin role
//     - Delete on own response or admin role
//   • Mark-as-Official flip (P1b #5) — gated by rfis.edit + admin/owner.
//   • Render @-mention spans with hover card.

import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Pencil, Trash2, MoreVertical, Star, Lock, Check, X, AtSign, Mail,
} from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '../Primitives'
import { PermissionGate } from '../auth/PermissionGate'
import { UserName } from '../UserName'
import { displayName, useProfileNames, type ProfileMap } from '../../hooks/queries/profiles'
import {
  useEditRFIResponse,
  useSoftDeleteRFIResponse,
  RESPONSE_TYPES,
  isWithinEditWindow,
  type RFIResponseRow,
  type RFIResponseType,
} from '../../hooks/queries/useRFIResponses'
import { usePermissions } from '../../hooks/usePermissions'
import { can } from '../../permissions'
import { useAuth } from '../../hooks/useAuth'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

interface RFIResponseThreadProps {
  rfiId: string
  projectId: string
  responses: RFIResponseRow[]
}

const getInitials = (s: string) =>
  ((s || '').trim().split(/\s+/).filter(Boolean).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase()) || 'U'

const relativeTime = (d: string | null | undefined) => {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const renderWithMentions = (content: string, profileMap: ProfileMap | undefined): React.ReactNode => {
  // Highlight "@<name>" tokens (1- or 2-word). The actual id resolution
  // already happened at send-time and persists in mentioned_user_ids;
  // this is purely visual emphasis.
  const parts: React.ReactNode[] = []
  const re = /@([A-Za-z][A-Za-z0-9_]*(?:\s[A-Za-z][A-Za-z0-9_]*)?)/g
  const matches = Array.from(content.matchAll(re))
  let last = 0
  for (const m of matches) {
    if (m.index === undefined) continue
    if (m.index > last) parts.push(content.slice(last, m.index))
    parts.push(
      <span
        key={`m-${m.index}`}
        title={m[1]}
        style={{
          color: colors.primaryOrange,
          fontWeight: 600,
          backgroundColor: colors.orangeSubtle,
          padding: '0 4px',
          borderRadius: 4,
        }}
      >
        @{m[1]}
      </span>,
    )
    last = m.index + m[0].length
  }
  if (last < content.length) parts.push(content.slice(last))
  void profileMap
  return parts
}

interface ResponseCardProps {
  response: RFIResponseRow
  rfiId: string
  projectId: string
  profileMap?: ProfileMap
  isOfficial?: boolean
  /** Pinned position changes the card's visual elevation. */
  pinned?: boolean
}

const ResponseCard: React.FC<ResponseCardProps> = ({
  response,
  rfiId,
  projectId,
  profileMap,
  isOfficial,
  pinned,
}) => {
  const editResponse = useEditRFIResponse()
  const deleteResponse = useSoftDeleteRFIResponse()
  const { role } = usePermissions()
  const { user } = useAuth()

  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftContent, setDraftContent] = useState(response.content)

  const isOwn = user?.id === response.author_id
  const canAdminEdit = can(role, 'rfis.admin_edit')
  const canEdit = (isOwn && isWithinEditWindow(response.created_at)) || canAdminEdit
  const canDelete = isOwn || canAdminEdit
  const canFlipOfficial = can(role, 'rfis.flip_official')

  const authorName = displayName(profileMap, response.author_id)
  const responseTypeMeta = RESPONSE_TYPES.find((rt) => rt.value === (response.response_type as RFIResponseType))

  const handleSave = async () => {
    const next = draftContent.trim()
    if (!next || next === response.content) {
      setEditing(false)
      return
    }
    try {
      await editResponse.mutateAsync({
        responseId: response.id,
        rfiId,
        projectId,
        content: next,
      })
      toast.success('Response updated')
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this response? It will be hidden from the thread.')) return
    try {
      await deleteResponse.mutateAsync({ responseId: response.id, rfiId, projectId })
      toast.success('Response deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const handleToggleOfficial = async () => {
    try {
      await editResponse.mutateAsync({
        responseId: response.id,
        rfiId,
        projectId,
        isOfficial: !isOfficial,
      })
      toast.success(isOfficial ? 'Removed Official' : 'Marked as Official Answer')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const isInternal = !!response.is_internal
  const cardBg = isInternal
    ? '#FFFBEB'
    : pinned
      ? colors.orangeSubtle
      : colors.surfaceInset
  const cardBorder = isInternal
    ? '1px solid #F59E0B'
    : pinned
      ? `1.5px solid ${colors.primaryOrange}`
      : 'none'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        gap: spacing['2'],
        alignItems: 'flex-start',
        position: 'relative',
        padding: '2px 0',
      }}
    >
      <Avatar initials={getInitials(authorName)} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>
            {authorName}
          </span>

          {pinned && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '1px 8px',
                borderRadius: 10,
                backgroundColor: colors.primaryOrange,
                color: 'white',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <Star size={9} fill="white" /> Official Answer
            </span>
          )}

          {isInternal && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '1px 8px',
                borderRadius: 10,
                backgroundColor: '#F59E0B',
                color: 'white',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <Lock size={9} /> Internal
            </span>
          )}

          {response.source === 'email_inbound' && (
            <span
              title={`Replied via email${response.source_email ? ` from ${response.source_email}` : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '1px 8px',
                borderRadius: 10,
                backgroundColor: '#4F46E512',
                color: '#4F46E5',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <Mail size={9} /> Replied via email
              {response.source_email && (
                <span style={{ textTransform: 'none', fontWeight: 500, color: '#4F46E5', opacity: 0.8 }}>
                  · {response.source_email}
                </span>
              )}
            </span>
          )}

          {responseTypeMeta && responseTypeMeta.value !== 'answered' && (
            <span
              style={{
                padding: '1px 8px',
                borderRadius: 10,
                backgroundColor: `${responseTypeMeta.color}20`,
                color: responseTypeMeta.color,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.02em',
              }}
            >
              {responseTypeMeta.label}
            </span>
          )}

          <span style={{ fontSize: 11, color: colors.textTertiary }}>
            {relativeTime(response.created_at)}
            {response.edited_at && (
              <span title={`Edited ${relativeTime(response.edited_at)}`} style={{ marginLeft: 4, fontStyle: 'italic' }}>
                · edited
              </span>
            )}
          </span>

          {Array.isArray(response.mentioned_user_ids) && response.mentioned_user_ids.length > 0 && (
            <span
              title="@-mentions in this response"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 10,
                color: colors.textTertiary,
              }}
            >
              <AtSign size={9} /> {response.mentioned_user_ids.length}
            </span>
          )}

          {(canEdit || canDelete || canFlipOfficial) && !editing && (
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Response actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: colors.textTertiary,
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <MoreVertical size={14} />
              </button>
              {menuOpen && (
                <ul
                  role="menu"
                  onMouseLeave={() => setMenuOpen(false)}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: 4,
                    listStyle: 'none',
                    padding: 4,
                    minWidth: 180,
                    backgroundColor: colors.surfaceRaised,
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: borderRadius.base,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 10,
                  }}
                >
                  {canEdit && (
                    <li role="menuitem">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(true)
                          setMenuOpen(false)
                          setDraftContent(response.content)
                        }}
                        style={menuBtnStyle()}
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    </li>
                  )}
                  {canFlipOfficial && (
                    <PermissionGate permission="rfis.edit">
                      <li role="menuitem">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false)
                            void handleToggleOfficial()
                          }}
                          style={menuBtnStyle()}
                        >
                          <Star
                            size={12}
                            fill={isOfficial ? colors.primaryOrange : 'none'}
                            color={isOfficial ? colors.primaryOrange : 'currentColor'}
                          />
                          {isOfficial ? 'Remove Official' : 'Mark as Official'}
                        </button>
                      </li>
                    </PermissionGate>
                  )}
                  {canDelete && (
                    <li role="menuitem">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          void handleDelete()
                        }}
                        style={menuBtnStyle(colors.statusCritical)}
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              rows={3}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              aria-label="Edit response"
              style={{
                padding: '10px 12px',
                fontSize: 14,
                color: colors.textPrimary,
                backgroundColor: colors.surfaceRaised,
                border: `1.5px solid ${colors.primaryOrange}`,
                borderRadius: 12,
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: 1.5,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setDraftContent(response.content)
                }}
                style={cancelBtnStyle}
              >
                <X size={12} /> Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={editResponse.isPending}
                style={saveBtnStyle(editResponse.isPending)}
              >
                <Check size={12} /> {editResponse.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: cardBg,
              border: cardBorder,
              borderRadius: '4px 14px 14px 14px',
              fontSize: 14,
              color: colors.textPrimary,
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {renderWithMentions(response.content || '', profileMap)}
            {Array.isArray(response.mentioned_user_ids) && response.mentioned_user_ids.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: colors.textTertiary }}>
                Notified:{' '}
                {response.mentioned_user_ids.map((uid, i) => (
                  <span key={uid}>
                    {i > 0 && ', '}
                    <UserName userId={uid} fallback="—" />
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export const RFIResponseThread: React.FC<RFIResponseThreadProps> = ({ rfiId, projectId, responses }) => {
  const userIds = useMemo(() => responses.map((r) => r.author_id), [responses])
  const { data: profileMap } = useProfileNames(userIds)

  const visible = responses.filter((r) => !r.deleted_at)
  const officials = visible.filter((r) => r.is_official === true)
  const others = visible.filter((r) => r.is_official !== true)

  if (visible.length === 0) return null

  return (
    <div
      style={{
        padding: `${spacing['4']} ${spacing['5']}`,
        borderTop: `1px solid ${colors.borderSubtle}`,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing['4'],
      }}
    >
      {officials.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: spacing['2'],
            paddingBottom: spacing['3'],
            borderBottom: `1px dashed ${colors.borderSubtle}`,
          }}
        >
          {officials.map((r) => (
            <ResponseCard
              key={r.id}
              response={r}
              rfiId={rfiId}
              projectId={projectId}
              profileMap={profileMap}
              isOfficial
              pinned
            />
          ))}
        </div>
      )}

      {others.map((r) => (
        <ResponseCard
          key={r.id}
          response={r}
          rfiId={rfiId}
          projectId={projectId}
          profileMap={profileMap}
        />
      ))}
    </div>
  )
}

const menuBtnStyle = (color?: string): React.CSSProperties => ({
  width: '100%',
  textAlign: 'left',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: `${spacing['1']} ${spacing['2']}`,
  border: 'none',
  borderRadius: borderRadius.sm,
  background: 'transparent',
  color: color ?? colors.textPrimary,
  fontSize: typography.fontSize.sm,
  cursor: 'pointer',
})

const cancelBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 10px',
  fontSize: typography.fontSize.caption,
  color: colors.textSecondary,
  background: 'transparent',
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.sm,
  cursor: 'pointer',
}

const saveBtnStyle = (busy: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 10px',
  fontSize: typography.fontSize.caption,
  fontWeight: 600,
  color: 'white',
  background: busy ? colors.borderSubtle : colors.primaryOrange,
  border: 'none',
  borderRadius: borderRadius.sm,
  cursor: busy ? 'not-allowed' : 'pointer',
})

export default RFIResponseThread

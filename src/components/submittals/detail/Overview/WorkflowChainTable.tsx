// Phase 7 — Workflow Chain dense table.
//
// Replaces CompactWorkflowChain (Phase 6) on the Overview tab. Per spec
// Part 2.4 + plan Pillar B Workflow chain spec:
//
//   8 columns:
//   - Step (sequence number; parallel reviewers share the number)
//   - Reviewer name + company
//   - Sent date
//   - Due date
//   - Returned date
//   - Response (disposition)
//   - Comments (truncated, click to expand)
//   - Attachments (CURRENT badge on latest revision)
//   - Version (rev_number)
//   - Actions (delegate / forward / mark received)
//
// Parallel reviewers render as multiple rows under the same step number;
// the step number cell uses rowSpan when ≥ 2 reviewers share a sequence.
// Pending reviewers render with grey style; current step gets the
// orange-tint highlight (matches CompactWorkflowChain affordance).

import React, { useMemo, useState } from 'react'
import { Paperclip, MoreHorizontal, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  active: '#2D8A6E',
  pending: '#C4850C',
  critical: '#C93B3B',
  brandOrange: '#F47820',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface WorkflowChainRow {
  id: string
  sequence: number
  reviewer_name: string | null
  reviewer_company: string | null
  reviewer_role: string | null
  reviewer_email: string | null
  sent_at: string | null
  due_date: string | null
  returned_at: string | null
  responded_at: string | null
  disposition: string | null
  comments: string | null
  attachments: Array<{ id: string; name: string; url?: string; isCurrent?: boolean }>
  version: number | null
  parallel_group: number | null
  is_current: boolean
  /** Phase 7c-1: per-step Iris-augmented thread summary (LLM via 7c-2). */
  iris_thread_summary?: string | null
  /** Phase 7c-1: count of (collapsed) step comments — drives the deterministic
   *  fallback summary chip when iris_thread_summary is null. */
  thread_comment_count?: number
}

export interface WorkflowChainTableProps {
  rows: WorkflowChainRow[]
  onDelegate?: (rowId: string) => void
  onForward?: (rowId: string) => void
  onMarkReceived?: (rowId: string) => void
  /** Phase 7c-1: click a comments cell → open the StepThreadPanel for that step. */
  onOpenThread?: (rowId: string) => void
  /** Phase 7c-1: open the SendBackDialog with this step pre-flagged as the source.
   *  The dialog itself filters priorSteps; this just kicks the page-level state. */
  onOpenSendBack?: (rowId: string) => void
}

export const WorkflowChainTable: React.FC<WorkflowChainTableProps> = ({
  rows,
  onDelegate,
  onForward,
  onMarkReceived,
  onOpenThread,
  onOpenSendBack,
}) => {
  // Group by sequence so parallel reviewers (same sequence number) collapse
  // into a single step header with multiple sub-rows.
  const stepGroups = useMemo(() => groupBySequence(rows), [rows])

  if (rows.length === 0) {
    return (
      <section
        aria-label="Workflow chain"
        style={{
          backgroundColor: '#fff',
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          padding: '14px 18px',
          fontFamily: FONT,
        }}
      >
        <h3 style={headingStyle}>Workflow Chain</h3>
        <p style={{ margin: 0, fontSize: 12, color: C.ink3 }}>
          No reviewer chain configured yet. Apply a workflow template to begin.
        </p>
      </section>
    )
  }

  return (
    <section
      aria-label="Workflow chain"
      style={{
        backgroundColor: '#fff',
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: '14px 0 0',
        fontFamily: FONT,
        overflow: 'hidden',
      }}
    >
      <h3 style={{ ...headingStyle, padding: '0 18px 10px' }}>Workflow Chain</h3>

      <div style={{ overflowX: 'auto' }}>
        <table
          role="table"
          aria-label="Reviewer chain"
          style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: 0,
            fontSize: 12,
          }}
        >
          <thead>
            <tr style={{ backgroundColor: C.surfaceInset }}>
              <Th width={48}>#</Th>
              <Th width={210}>Reviewer</Th>
              <Th width={92}>Sent</Th>
              <Th width={92}>Due</Th>
              <Th width={92}>Returned</Th>
              <Th width={140}>Response</Th>
              <Th width={'1fr' as unknown as number}>Comments</Th>
              <Th width={88} align="center">📎</Th>
              <Th width={56} align="center">Rev</Th>
              <Th width={44} align="right" />
            </tr>
          </thead>
          <tbody>
            {stepGroups.map((group) =>
              group.rows.map((row, idxWithinGroup) => (
                <RowView
                  key={row.id}
                  row={row}
                  isFirstInGroup={idxWithinGroup === 0}
                  groupSize={group.rows.length}
                  onDelegate={onDelegate}
                  onForward={onForward}
                  onMarkReceived={onMarkReceived}
                  onOpenThread={onOpenThread}
                  onOpenSendBack={onOpenSendBack}
                />
              )),
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── Row view ────────────────────────────────────────────────────────────────

interface RowViewProps {
  row: WorkflowChainRow
  isFirstInGroup: boolean
  groupSize: number
  onDelegate?: (rowId: string) => void
  onForward?: (rowId: string) => void
  onMarkReceived?: (rowId: string) => void
  onOpenThread?: (rowId: string) => void
  onOpenSendBack?: (rowId: string) => void
}

const RowView: React.FC<RowViewProps> = ({
  row,
  isFirstInGroup,
  groupSize,
  onDelegate,
  onForward,
  onMarkReceived,
  onOpenThread,
  onOpenSendBack,
}) => {
  const [expanded, setExpanded] = useState(false)
  const hasLongComments = (row.comments?.length ?? 0) > 100
  const status = inferRowStatus(row)
  const tone = statusTone(status)
  const isCurrent = row.is_current

  return (
    <tr
      style={{
        backgroundColor: isCurrent ? 'rgba(244, 120, 32, 0.04)' : 'transparent',
        borderTop: `1px solid ${C.borderSubtle}`,
      }}
    >
      {isFirstInGroup ? (
        <Td rowSpan={groupSize} align="center" sticky>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: 'rgba(26, 22, 19, 0.05)',
              color: C.ink2,
              fontSize: 11,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {row.sequence}
          </span>
        </Td>
      ) : null}
      <Td>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 500, color: C.ink, lineHeight: 1.3 }}>
            {row.reviewer_name ?? <em style={{ color: C.ink3, fontStyle: 'normal' }}>Unassigned</em>}
            {row.parallel_group != null && (
              <span style={{
                marginLeft: 6,
                fontSize: 9,
                color: C.ink3,
                fontWeight: 600,
                padding: '1px 4px',
                borderRadius: 3,
                backgroundColor: C.borderSubtle,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>parallel</span>
            )}
          </span>
          {(row.reviewer_company || row.reviewer_role) && (
            <span style={{ fontSize: 11, color: C.ink3, marginTop: 1 }}>
              {[row.reviewer_company, row.reviewer_role].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      </Td>
      <Td mono>{formatDate(row.sent_at)}</Td>
      <Td mono>{formatDate(row.due_date)}</Td>
      <Td mono>{formatDate(row.returned_at)}</Td>
      <Td>
        <DispositionBadge status={status} tone={tone} disposition={row.disposition} />
      </Td>
      <Td>
        <CommentsCell
          text={row.comments}
          expanded={expanded}
          onToggle={() => setExpanded((e) => !e)}
          hasLong={hasLongComments}
          irisSummary={row.iris_thread_summary ?? null}
          threadCount={row.thread_comment_count ?? 0}
          onOpenThread={onOpenThread ? () => onOpenThread(row.id) : undefined}
        />
      </Td>
      <Td align="center">
        <AttachmentsCell attachments={row.attachments} />
      </Td>
      <Td align="center" mono>
        {row.version != null ? `R${row.version}` : <span style={{ color: C.ink3 }}>—</span>}
      </Td>
      <Td align="right">
        <RowMenu
          rowId={row.id}
          status={status}
          onDelegate={onDelegate}
          onForward={onForward}
          onMarkReceived={onMarkReceived}
          onSendBack={onOpenSendBack}
        />
      </Td>
    </tr>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

interface StepGroup {
  sequence: number
  rows: WorkflowChainRow[]
}

export function groupBySequence(rows: WorkflowChainRow[]): StepGroup[] {
  const map = new Map<number, WorkflowChainRow[]>()
  for (const r of rows) {
    const list = map.get(r.sequence)
    if (list) list.push(r)
    else map.set(r.sequence, [r])
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([sequence, rs]) => ({ sequence, rows: rs }))
}

type RowStatus = 'done' | 'current' | 'pending' | 'rejected' | 'overdue'

export function inferRowStatus(row: WorkflowChainRow): RowStatus {
  if (row.disposition && /reject|fail/i.test(row.disposition)) return 'rejected'
  if (row.responded_at || row.returned_at) return 'done'
  if (row.is_current) {
    if (row.due_date) {
      const d = new Date(row.due_date)
      if (!Number.isNaN(d.getTime()) && d < new Date()) return 'overdue'
    }
    return 'current'
  }
  return 'pending'
}

function statusTone(status: RowStatus): 'success' | 'pending' | 'critical' | 'neutral' {
  if (status === 'done') return 'success'
  if (status === 'current') return 'pending'
  if (status === 'rejected' || status === 'overdue') return 'critical'
  return 'neutral'
}

function formatDate(iso: string | null | undefined): React.ReactNode {
  if (!iso) return <span style={{ color: C.ink3 }}>—</span>
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return <span style={{ color: C.ink3 }}>—</span>
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ── Sub-components ──────────────────────────────────────────────────────────

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 600,
  color: C.ink3,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

interface ThProps {
  width: number
  align?: 'left' | 'center' | 'right'
  children?: React.ReactNode
}

const Th: React.FC<ThProps> = ({ width, align = 'left', children }) => (
  <th
    scope="col"
    style={{
      padding: '8px 10px',
      borderBottom: `1px solid ${C.border}`,
      fontSize: 10,
      fontWeight: 600,
      color: C.ink3,
      textAlign: align,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      width: typeof width === 'number' ? width : undefined,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </th>
)

interface TdProps {
  align?: 'left' | 'center' | 'right'
  rowSpan?: number
  mono?: boolean
  sticky?: boolean
  children?: React.ReactNode
}

const Td: React.FC<TdProps> = ({ align = 'left', rowSpan, mono, sticky, children }) => (
  <td
    rowSpan={rowSpan}
    style={{
      padding: '10px 10px',
      verticalAlign: 'top',
      textAlign: align,
      fontFamily: mono ? '"JetBrains Mono", SFMono-Regular, Menlo, monospace' : 'inherit',
      fontSize: mono ? 11 : 12,
      color: C.ink,
      backgroundColor: sticky ? C.surfaceInset : undefined,
    }}
  >
    {children}
  </td>
)

const DispositionBadge: React.FC<{ status: RowStatus; tone: 'success' | 'pending' | 'critical' | 'neutral'; disposition: string | null }> = ({
  status,
  tone,
  disposition,
}) => {
  const color = tone === 'success' ? C.active : tone === 'critical' ? C.critical : tone === 'pending' ? C.pending : C.ink3
  const label =
    disposition ? disposition.replace(/_/g, ' ') :
    status === 'pending' ? 'Pending' :
    status === 'current' ? 'In review' :
    status === 'overdue' ? 'Overdue' :
    status === 'rejected' ? 'Rejected' :
    'Done'
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 600,
        color,
        padding: '2px 7px',
        borderRadius: 3,
        backgroundColor: tone === 'neutral' ? C.borderSubtle : `${color}14`,
      }}
    >
      {label}
    </span>
  )
}

const CommentsCell: React.FC<{
  /** The disposition's "verdict" comment (legacy `submittal_reviewers.comments`). */
  text: string | null
  expanded: boolean
  onToggle: () => void
  hasLong: boolean
  /** Phase 7c-1: Iris-augmented thread summary. */
  irisSummary: string | null
  /** Phase 7c-1: total comments on the threaded discussion (collapsed view). */
  threadCount: number
  /** Phase 7c-1: when set, "Open thread" link fires this. Without it, no link. */
  onOpenThread?: () => void
}> = ({ text, expanded, onToggle, hasLong, irisSummary, threadCount, onOpenThread }) => {
  const hasVerdict = !!(text && text.trim())
  const hasThread = threadCount > 0 || !!irisSummary

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, lineHeight: 1.4 }}>
      {/* Iris summary chip (or deterministic fallback when threadCount > 0). */}
      {hasThread && (
        <button
          type="button"
          onClick={onOpenThread}
          disabled={!onOpenThread}
          title={irisSummary ?? `${threadCount} comment${threadCount === 1 ? '' : 's'} on this step`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
            fontSize: 10,
            fontWeight: 500,
            color: C.brandOrange,
            backgroundColor: 'rgba(244, 120, 32, 0.06)',
            border: 'none',
            borderRadius: 3,
            cursor: onOpenThread ? 'pointer' : 'default',
            fontFamily: FONT,
            whiteSpace: 'nowrap',
            maxWidth: 320,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            alignSelf: 'flex-start',
            letterSpacing: '0.02em',
          }}
        >
          ✨ {irisSummary ?? `${threadCount} comment${threadCount === 1 ? '' : 's'}`}
        </button>
      )}

      {/* Disposition verdict (legacy single field). */}
      {hasVerdict ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
          {hasLong && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={expanded ? 'Collapse comments' : 'Expand comments'}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                color: C.ink3,
                cursor: 'pointer',
                padding: 0,
                marginTop: 1,
              }}
            >
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          )}
          <span
            style={{
              color: C.ink2,
              whiteSpace: hasLong && !expanded ? 'nowrap' : 'normal',
              overflow: hasLong && !expanded ? 'hidden' : 'visible',
              textOverflow: hasLong && !expanded ? 'ellipsis' : 'clip',
              maxWidth: hasLong && !expanded ? 320 : undefined,
              wordBreak: 'break-word',
            }}
          >
            {text}
          </span>
        </div>
      ) : !hasThread ? (
        <span style={{ color: C.ink3 }}>—</span>
      ) : null}

      {hasThread && onOpenThread && !hasVerdict && (
        <button
          type="button"
          onClick={onOpenThread}
          style={{
            alignSelf: 'flex-start',
            border: 'none',
            backgroundColor: 'transparent',
            color: C.ink3,
            fontSize: 10,
            cursor: 'pointer',
            padding: 0,
            fontFamily: FONT,
          }}
        >
          Open thread →
        </button>
      )}
    </div>
  )
}

const AttachmentsCell: React.FC<{ attachments: WorkflowChainRow['attachments'] }> = ({ attachments }) => {
  if (attachments.length === 0) return <span style={{ color: C.ink3 }}>—</span>
  const current = attachments.find((a) => a.isCurrent)
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: C.ink2 }}>
      <Paperclip size={11} />
      <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
        {attachments.length}
      </span>
      {current && (
        <span
          title={`Current revision: ${current.name}`}
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: '#fff',
            backgroundColor: C.brandOrange,
            padding: '1px 4px',
            borderRadius: 3,
            letterSpacing: '0.05em',
          }}
        >
          CURRENT
        </span>
      )}
    </div>
  )
}

interface RowMenuProps {
  rowId: string
  status: RowStatus
  onDelegate?: (rowId: string) => void
  onForward?: (rowId: string) => void
  onMarkReceived?: (rowId: string) => void
  onSendBack?: (rowId: string) => void
}

const RowMenu: React.FC<RowMenuProps> = ({ rowId, status, onDelegate, onForward, onMarkReceived, onSendBack }) => {
  const [open, setOpen] = useState(false)
  const hasAny = onDelegate || onForward || onMarkReceived || onSendBack
  if (!hasAny) return <span style={{ color: C.ink3 }}>—</span>

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Row actions"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          border: 'none',
          backgroundColor: 'transparent',
          color: C.ink3,
          cursor: 'pointer',
          borderRadius: 3,
        }}
      >
        <MoreHorizontal size={12} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            minWidth: 160,
            padding: 4,
            backgroundColor: '#fff',
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            boxShadow: '0 6px 16px rgba(0, 0, 0, 0.08)',
            zIndex: 5,
            fontSize: 12,
          }}
        >
          {onDelegate && status !== 'done' && (
            <MenuItem onClick={() => { onDelegate(rowId); setOpen(false) }}>
              <ExternalLink size={11} /> Delegate
            </MenuItem>
          )}
          {onForward && (
            <MenuItem onClick={() => { onForward(rowId); setOpen(false) }}>
              <ExternalLink size={11} /> Forward
            </MenuItem>
          )}
          {onMarkReceived && status === 'pending' && (
            <MenuItem onClick={() => { onMarkReceived(rowId); setOpen(false) }}>
              <ExternalLink size={11} /> Mark received
            </MenuItem>
          )}
          {onSendBack && (
            <MenuItem onClick={() => { onSendBack(rowId); setOpen(false) }}>
              <ExternalLink size={11} style={{ transform: 'scaleX(-1)' }} /> Send back…
            </MenuItem>
          )}
        </div>
      )}
    </div>
  )
}

const MenuItem: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      width: '100%',
      padding: '6px 8px',
      backgroundColor: 'transparent',
      border: 'none',
      cursor: 'pointer',
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 500,
      color: C.ink,
      textAlign: 'left',
      fontFamily: FONT,
    }}
    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.surfaceInset }}
    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
  >
    {children}
  </button>
)

export default WorkflowChainTable

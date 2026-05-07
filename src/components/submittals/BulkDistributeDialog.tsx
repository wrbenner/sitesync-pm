// Phase 3 — Bulk Distribute dialog.
//
// Resolves recipients via useProjectDirectory and fans out
// submittal_distribute RPC per selected submittal with the picked user_ids.
// Bugatti standard: explicit recipient list, no empty-array placeholder.

import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Send, X, Search, Check } from 'lucide-react'
import { useProjectDirectory } from '../../hooks/queries/useProjectDirectory'
import { submittalService } from '../../services/submittalService'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
  brandOrange: '#F47820',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface BulkDistributeDialogProps {
  open: boolean
  projectId: string | null | undefined
  selectedIds: string[]
  onClose: () => void
  /** Page clears selection + refetches on completion. */
  onComplete: () => void
}

export const BulkDistributeDialog: React.FC<BulkDistributeDialogProps> = ({
  open,
  projectId,
  selectedIds,
  onClose,
  onComplete,
}) => {
  const { data: directory, isPending } = useProjectDirectory(projectId)
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)

  const members = directory?.members ?? []
  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) => m.label.toLowerCase().includes(q))
  }, [members, query])

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = async () => {
    const recipients = Array.from(picked)
    if (recipients.length === 0) {
      toast.error('Pick at least one recipient.')
      return
    }
    setBusy(true)
    let ok = 0
    let failed = 0
    for (const submittalId of selectedIds) {
      const result = await submittalService.distribute(submittalId, recipients)
      if (result.error) failed += 1
      else ok += 1
    }
    setBusy(false)

    if (failed === 0) {
      toast.success(
        `Distributed ${ok} submittal${ok === 1 ? '' : 's'} to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}.`,
      )
    } else if (ok === 0) {
      toast.error(`Distribute failed for all ${failed}.`)
    } else {
      toast.warning(`Distributed ${ok}; ${failed} failed.`)
    }
    setPicked(new Set())
    setQuery('')
    onComplete()
  }

  if (!open) return null

  const count = selectedIds.length
  const recipientCount = picked.size

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-distribute-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.40)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460,
          maxWidth: '92vw',
          maxHeight: '80vh',
          backgroundColor: '#fff',
          borderRadius: 8,
          padding: 0,
          fontFamily: FONT,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div>
            <h2 id="bulk-distribute-title" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.ink }}>
              Distribute to field
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: C.ink2 }}>
              {count} submittal{count === 1 ? '' : 's'} → pick recipients
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: C.ink3,
              cursor: 'pointer',
              padding: 4,
              display: 'inline-flex',
            }}
          >
            <X size={14} />
          </button>
        </header>

        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.borderSubtle}`, position: 'relative' }}>
          <Search
            size={12}
            style={{
              position: 'absolute',
              left: 26,
              top: '50%',
              transform: 'translateY(-50%)',
              color: C.ink3,
              pointerEvents: 'none',
            }}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipients…"
            aria-label="Search recipients"
            autoFocus
            style={{
              width: '100%',
              padding: '6px 10px 6px 28px',
              minHeight: 30,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              fontSize: 12,
              fontFamily: FONT,
              backgroundColor: '#fff',
              color: C.ink,
              outline: 'none',
            }}
          />
        </div>

        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label="Project members"
          style={{ flex: 1, overflow: 'auto', padding: '4px 8px', minHeight: 200 }}
        >
          {isPending && (
            <div style={{ padding: 12, color: C.ink3, fontSize: 12 }}>Loading directory…</div>
          )}
          {!isPending && filteredMembers.length === 0 && (
            <div style={{ padding: 12, color: C.ink3, fontSize: 12, fontStyle: 'italic' }}>
              {members.length === 0 ? 'No project members found.' : 'No members match your search.'}
            </div>
          )}
          {filteredMembers.map((m) => {
            const isPicked = picked.has(m.value)
            return (
              <button
                key={m.value}
                type="button"
                role="option"
                aria-selected={isPicked}
                onClick={() => togglePick(m.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 4,
                  border: 'none',
                  background: isPicked ? 'rgba(244, 120, 32, 0.08)' : 'transparent',
                  color: C.ink,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: FONT,
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!isPicked) e.currentTarget.style.backgroundColor = C.surfaceInset
                }}
                onMouseLeave={(e) => {
                  if (!isPicked) e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 14,
                    height: 14,
                    border: `1px solid ${isPicked ? C.brandOrange : C.border}`,
                    borderRadius: 3,
                    backgroundColor: isPicked ? C.brandOrange : '#fff',
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {isPicked && <Check size={10} strokeWidth={3} />}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.label}
                </span>
              </button>
            )
          })}
        </div>

        <footer
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '12px 18px',
            borderTop: `1px solid ${C.border}`,
          }}
        >
          <span aria-live="polite" style={{ fontSize: 11, color: C.ink2 }}>
            {recipientCount === 0 ? 'No recipients picked.' : `${recipientCount} recipient${recipientCount === 1 ? '' : 's'} picked.`}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              style={{
                padding: '6px 12px',
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                background: '#fff',
                color: C.ink,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: FONT,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || recipientCount === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                backgroundColor: C.brandOrange,
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: busy || recipientCount === 0 ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: FONT,
                opacity: busy || recipientCount === 0 ? 0.6 : 1,
              }}
            >
              <Send size={11} />
              {busy ? 'Distributing…' : `Distribute to ${recipientCount}`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default BulkDistributeDialog

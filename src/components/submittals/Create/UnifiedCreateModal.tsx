// Phase 5 — Unified Create Modal.
//
// Per `docs/audits/SUBMITTALS_PAGE_REBUILD_PLAN_2026-05-06.md` Phase 5 +
// `/Users/walkerbenner/.claude/plans/stateful-greeting-book.md` Pillar A:
// one modal, six entry methods, all converging here. Two tiers:
//
//   QUICK   — title + ball-in-court + due. ⌘+Enter sends. The 80% path.
//   FULL    — progressive disclosure of every field. The 20% power path.
//
// Steve Jobs touches this PR ships:
//   * The required-on-site date never empty — schedule-walkback default
//     with an "auto" badge (per Predictive Defaults principle)
//   * Send & New rapid rhythm — clears form + refocuses Title
//   * Live spec-compliance preview (rule-based pre-flight; LLM augmentation
//     in Phase 7)
//   * Esc warns when dirty
//   * Save Draft / Send / Send & New footer
//   * Provenance-aware "auto" badges per Iris-prefilled field
//
// Voice / spec / drawing-pin / email-in / magic-link entry handlers seed
// the draft via props (`initialDraft`); the modal renders the same shell
// regardless of entry method.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { useCreateSubmittal } from '../../../hooks/mutations'
import { useScheduleWalkback } from '../../../hooks/useScheduleWalkback'
import {
  emptyDraft,
  runPreflight,
  type SubmittalDraft,
  type DraftSource,
} from '../../../services/iris/submittalDraft'
import { QuickTierFields } from './QuickTierFields'
import { FullTierProgressive } from './FullTierProgressive'
import { IrisPreflightInline } from './IrisPreflightInline'

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
  critical: '#C93B3B',
  active: '#2D8A6E',
  scrim: 'rgba(26, 22, 19, 0.30)',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const DRAFT_LOCALSTORAGE_PREFIX = 'sitesync.submittal.create.draft.'

export interface UnifiedCreateModalProps {
  open: boolean
  projectId: string
  /** Initial draft state — pre-filled by entry-method handlers (voice / spec /
   *  drawing-pin / email-in / magic-link). Defaults to a manual empty draft. */
  initialDraft?: SubmittalDraft | null
  /** Tier to open in. Quick is the 80% path; Full is the power path. */
  initialTier?: 'quick' | 'full'
  onClose: () => void
  /** Fired after successful create. Caller decides whether to navigate to
   *  the new submittal's detail page or stay on the log. */
  onCreated?: (submittalId: string) => void
}

export const UnifiedCreateModal: React.FC<UnifiedCreateModalProps> = ({
  open,
  projectId,
  initialDraft,
  initialTier = 'quick',
  onClose,
  onCreated,
}) => {
  const create = useCreateSubmittal()
  const [tier, setTier] = useState<'quick' | 'full'>(initialTier)
  const [draft, setDraft] = useState<SubmittalDraft>(() => initialDraft ?? emptyDraft('manual'))
  const [submittedOnce, setSubmittedOnce] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const titleRef = useRef<HTMLInputElement | null>(null)

  const draftKey = `${DRAFT_LOCALSTORAGE_PREFIX}${projectId}`

  // Restore in-flight draft from localStorage on open (only when no entry-
  // method seed was provided). Skip when initialDraft was passed (entry
  // methods always win over restored manual drafts).
  useEffect(() => {
    if (!open || initialDraft) return
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(draftKey)
      if (!raw) return
      const restored = JSON.parse(raw) as SubmittalDraft
      if (restored && typeof restored === 'object') setDraft(restored)
    } catch {
      // Ignore corrupt drafts.
    }
  }, [open, initialDraft, draftKey])

  // Persist draft when dirty (debounced via state-batching; localStorage
  // writes are cheap so no explicit debounce is needed for typical typing).
  useEffect(() => {
    if (!open || !isDirty) return
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft))
    } catch {
      // Quota exceeded — silent; the create button still works without
      // persistence.
    }
  }, [draft, isDirty, draftKey, open])

  // Reset draft when modal re-opens with a new initialDraft.
  useEffect(() => {
    if (!open) return
    if (initialDraft) {
      setDraft(initialDraft)
      setTier(initialDraft.source !== 'manual' ? 'full' : initialTier)
      setIsDirty(false)
    }
  }, [open, initialDraft, initialTier])

  // Schedule walkback default — required_on_site never empty.
  const walkback = useScheduleWalkback({
    projectId,
    scheduleActivityId: draft.schedule_activity_id,
    kind: draft.kind,
  })

  // When walkback resolves AND the user hasn't manually set required_on_site,
  // pre-fill it with a 'walkback' provenance tag.
  useEffect(() => {
    if (!walkback.ready) return
    setDraft((d) => {
      const userSet = d.required_on_site_date && d.provenance.required_on_site_date === 'manual'
      if (userSet) return d
      if (d.required_on_site_date === walkback.computed_required_on_site
          && d.submit_by_date === walkback.computed_submit_by) {
        return d
      }
      return {
        ...d,
        required_on_site_date: walkback.computed_required_on_site,
        submit_by_date: walkback.computed_submit_by,
        lead_time_weeks: walkback.computed_lead_time_weeks,
        provenance: {
          ...d.provenance,
          required_on_site_date: 'spec' as DraftSource,
          submit_by_date: 'spec' as DraftSource,
          lead_time_weeks: 'spec' as DraftSource,
        },
      }
    })
  }, [walkback.ready, walkback.computed_required_on_site, walkback.computed_submit_by,
      walkback.computed_lead_time_weeks])

  // Pre-flight findings — run on every draft change (cheap rule-based).
  const preflight = useMemo(() => runPreflight(draft), [draft])
  const blockingFindings = preflight.filter((f) => f.severity === 'block').length
  const warningFindings = preflight.filter((f) => f.severity === 'warning').length

  // Patch draft (any caller). Sets isDirty + clears provenance for the field
  // (manual edit overrides Iris pre-fill).
  const patchDraft = useCallback((patch: Partial<SubmittalDraft>) => {
    setIsDirty(true)
    setDraft((d) => {
      const next = { ...d, ...patch }
      const nextProv = { ...d.provenance }
      for (const key of Object.keys(patch)) {
        nextProv[key] = 'manual'
      }
      next.provenance = nextProv
      return next
    })
  }, [])

  // ── Submit ────────────────────────────────────────────────────────────────

  const performCreate = useCallback(async (): Promise<string | null> => {
    setSubmittedOnce(true)
    if (!draft.title.trim()) {
      toast.error('Title is required.')
      titleRef.current?.focus()
      return null
    }
    try {
      const result = await create.mutateAsync({
        projectId,
        data: {
          project_id: projectId,
          title: draft.title.trim(),
          kind: draft.kind ?? null,
          csi_section: draft.csi_section ?? null,
          spec_section_paragraph: draft.spec_section_paragraph ?? null,
          spec_pdf_page: draft.spec_pdf_page ?? null,
          assigned_to: draft.ball_in_court_user_id ?? null,
          due_date: draft.due_date ?? null,
          submit_by_date: draft.submit_by_date ?? null,
          required_on_site_date: draft.required_on_site_date ?? null,
          required_onsite_date: draft.required_on_site_date ?? null,
          lead_time_weeks: draft.lead_time_weeks ?? null,
          schedule_activity_id: draft.schedule_activity_id ?? null,
          is_critical_path: draft.is_critical_path,
          is_private: draft.is_private,
          subcontractor: draft.responsible_sub_id ?? null,
          responsible_sub_id: draft.responsible_sub_id ?? null,
        },
      })
      // Clear persisted draft on success.
      try { window.localStorage.removeItem(draftKey) } catch { /* ignore */ }

      const newId = (result?.data as { id?: string } | undefined)?.id
                  ?? (result as unknown as { id?: string })?.id
                  ?? null
      toast.success(`Submittal created${draft.title ? ': ' + draft.title : ''}`)
      return newId ?? null
    } catch (err) {
      toast.error('Failed to create submittal: ' + (err as Error).message)
      return null
    }
  }, [create, draft, draftKey, projectId])

  const handleSend = useCallback(async () => {
    const id = await performCreate()
    if (id) {
      onCreated?.(id)
      onClose()
    }
  }, [performCreate, onCreated, onClose])

  const handleSendAndNew = useCallback(async () => {
    const id = await performCreate()
    if (id) {
      onCreated?.(id)
      // Reset to a fresh manual draft + refocus title — the rapid rhythm.
      setDraft(emptyDraft('manual'))
      setIsDirty(false)
      setSubmittedOnce(false)
      // useEffect-based focus handoff: defer to next tick.
      setTimeout(() => titleRef.current?.focus(), 0)
    }
  }, [performCreate, onCreated])

  const handleSaveDraft = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft))
      toast.info('Draft saved. Pick up where you left off the next time you open Create.')
      onClose()
    } catch {
      toast.error('Could not save draft (storage quota).')
    }
  }, [draft, draftKey, onClose])

  // Esc closes; warns when dirty.
  const handleClose = useCallback(() => {
    if (isDirty && !window.confirm('Discard your in-progress submittal?')) return
    try { window.localStorage.removeItem(draftKey) } catch { /* ignore */ }
    onClose()
  }, [isDirty, draftKey, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        handleClose()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        void handleSend()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, handleClose, handleSend])

  // Autofocus title on open.
  useEffect(() => {
    if (!open) return
    setTimeout(() => titleRef.current?.focus(), 30)
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create submittal"
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: C.scrim,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: FONT,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: tier === 'quick' ? 520 : 780,
          maxWidth: '100%',
          maxHeight: '92vh',
          backgroundColor: '#fff',
          borderRadius: 8,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.18)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 160ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        <Header
          tier={tier}
          source={draft.source}
          onTierChange={setTier}
          onClose={handleClose}
        />

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'grid',
            gridTemplateColumns: tier === 'full' ? '1fr 280px' : '1fr',
            gap: 0,
          }}
        >
          <div style={{ padding: '16px 20px' }}>
            <QuickTierFields
              draft={draft}
              projectId={projectId}
              onPatch={patchDraft}
              titleRef={titleRef}
              showValidation={submittedOnce}
            />
            {tier === 'full' && (
              <FullTierProgressive
                draft={draft}
                projectId={projectId}
                walkback={walkback}
                onPatch={patchDraft}
              />
            )}
          </div>
          {tier === 'full' && (
            <aside
              aria-label="Iris pre-flight"
              style={{
                borderLeft: `1px solid ${C.borderSubtle}`,
                backgroundColor: C.surface,
                padding: '16px 18px',
                overflow: 'auto',
              }}
            >
              <IrisPreflightInline findings={preflight} />
            </aside>
          )}
        </div>

        <Footer
          tier={tier}
          onTierChange={setTier}
          blockingFindings={blockingFindings}
          warningFindings={warningFindings}
          isPending={create.isPending}
          onSaveDraft={handleSaveDraft}
          onSend={handleSend}
          onSendAndNew={handleSendAndNew}
        />
      </div>
    </div>
  )
}

// ── Header ─────────────────────────────────────────────────────────────────

interface HeaderProps {
  tier: 'quick' | 'full'
  source: DraftSource
  onTierChange: (t: 'quick' | 'full') => void
  onClose: () => void
}

const Header: React.FC<HeaderProps> = ({ tier, source, onTierChange, onClose }) => {
  const sourceLabel = source !== 'manual' ? sourceLabels[source] : null

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 18px',
        borderBottom: `1px solid ${C.borderSubtle}`,
        backgroundColor: C.surface,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.ink }}>
          New Submittal
        </h2>
        {sourceLabel && (
          <span
            title="Iris pre-filled some fields from this source. Manual edits override the auto values."
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              fontWeight: 600,
              color: C.brandOrange,
              padding: '2px 6px',
              borderRadius: 3,
              backgroundColor: 'rgba(244, 120, 32, 0.08)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            ✨ {sourceLabel}
          </span>
        )}
        <span style={{ fontSize: 11, color: C.ink3 }}>
          {tier === 'quick' ? '⌘+Enter to send. + Add details for full form.' : 'Full form: every field.'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          onClick={() => onTierChange(tier === 'quick' ? 'full' : 'quick')}
          aria-label={tier === 'quick' ? 'Expand to full form' : 'Collapse to quick form'}
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            backgroundColor: '#fff',
            padding: '4px 8px',
            color: C.ink2,
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          {tier === 'quick' ? '+ Add details' : '← Quick form'}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            border: 'none',
            backgroundColor: 'transparent',
            color: C.ink2,
            cursor: 'pointer',
            borderRadius: 4,
          }}
        >
          <X size={14} />
        </button>
      </div>
    </header>
  )
}

const sourceLabels: Record<DraftSource, string | null> = {
  manual: null,
  voice: 'voice',
  spec: 'spec section',
  drawing_pin: 'drawing pin',
  email_in: 'incoming email',
  magic_link_request: 'magic-link sub upload',
}

// ── Footer ─────────────────────────────────────────────────────────────────

interface FooterProps {
  tier: 'quick' | 'full'
  onTierChange: (t: 'quick' | 'full') => void
  blockingFindings: number
  warningFindings: number
  isPending: boolean
  onSaveDraft: () => void
  onSend: () => void
  onSendAndNew: () => void
}

const Footer: React.FC<FooterProps> = ({
  tier,
  onTierChange,
  blockingFindings,
  warningFindings,
  isPending,
  onSaveDraft,
  onSend,
  onSendAndNew,
}) => {
  const sendDisabled = blockingFindings > 0 || isPending
  const sendLabel = isPending ? 'Sending…' : 'Send'

  return (
    <footer
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 18px',
        borderTop: `1px solid ${C.borderSubtle}`,
        backgroundColor: '#fff',
      }}
    >
      {tier === 'quick' && warningFindings > 0 && (
        <span
          style={{
            fontSize: 11,
            color: C.ink3,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {warningFindings} note{warningFindings === 1 ? '' : 's'}
        </span>
      )}
      <span style={{ flex: 1 }} />
      <SecondaryBtn onClick={onSaveDraft} disabled={isPending}>
        Save Draft
      </SecondaryBtn>
      <SecondaryBtn onClick={onSendAndNew} disabled={sendDisabled}>
        Send & New
      </SecondaryBtn>
      <PrimaryBtn onClick={onSend} disabled={sendDisabled} badge={blockingFindings > 0 ? blockingFindings : null}>
        {sendLabel}
      </PrimaryBtn>
      {tier === 'quick' && (
        <button
          type="button"
          onClick={() => onTierChange('full')}
          style={{
            border: 'none',
            backgroundColor: 'transparent',
            color: C.ink3,
            fontSize: 11,
            cursor: 'pointer',
            padding: 0,
            marginLeft: 4,
          }}
          aria-label="Expand to full form"
          title="Expand to full form"
        >
          ⏵
        </button>
      )}
    </footer>
  )
}

const PrimaryBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { badge?: number | null }> = ({
  children, badge, ...rest
}) => (
  <button
    type="button"
    {...rest}
    style={{
      position: 'relative',
      padding: '7px 14px',
      backgroundColor: rest.disabled ? '#F4D7BD' : C.brandOrange,
      color: '#fff',
      border: 'none',
      borderRadius: 4,
      cursor: rest.disabled ? 'not-allowed' : 'pointer',
      fontSize: 13,
      fontWeight: 600,
      fontFamily: FONT,
      letterSpacing: '-0.005em',
      opacity: rest.disabled ? 0.65 : 1,
    }}
  >
    {children}
    {badge != null && badge > 0 && (
      <span
        aria-label={`${badge} blocking issue${badge === 1 ? '' : 's'}`}
        style={{
          position: 'absolute',
          top: -6,
          right: -6,
          minWidth: 18,
          height: 18,
          padding: '0 5px',
          borderRadius: 9,
          backgroundColor: C.critical,
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {badge}
      </span>
    )}
  </button>
)

const SecondaryBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...rest }) => (
  <button
    type="button"
    {...rest}
    style={{
      padding: '7px 12px',
      backgroundColor: '#fff',
      color: C.ink,
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      cursor: rest.disabled ? 'not-allowed' : 'pointer',
      fontSize: 12,
      fontWeight: 500,
      fontFamily: FONT,
      opacity: rest.disabled ? 0.55 : 1,
    }}
  >
    {children}
  </button>
)

export default UnifiedCreateModal

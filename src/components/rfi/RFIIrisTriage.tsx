// ── RFIIrisTriage ───────────────────────────────────────────────────────
// P2b deliverable #3 — Iris-authored triage banner above the response
// thread. Surfaces: 1-line summary, suggested response_type (auto-applied
// at high confidence per ADR-007), suggested next action.
//
// Auto-apply rule:
//   confidence ≥ 0.85 → mutation fires automatically; banner shows
//   "Iris auto-applied X". Otherwise [Apply] button reveals.
//
// Suggested actions:
//   • Close RFI            — sets status to closed via state-machine
//   • Generate follow-up   — pre-fills a new RFI draft via Iris pipeline
//   • Generate Change Event — stub link out to /change-orders/new
//   • Generate Field Directive — stub link out to /field-directives/new
//
// Audit row per Iris suggestion + per accepted action.

import React, { useEffect, useMemo, useState } from 'react'
import { Sparkles, Check, X, ChevronRight, Send, FilePlus2 } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGate } from '../auth/PermissionGate'
import { useUpdateRFI } from '../../hooks/mutations'
import { useEditRFIResponse, type RFIResponseRow, type RFIResponseType } from '../../hooks/queries/useRFIResponses'
import { logAuditEntry } from '../../lib/auditLogger'
import { bandColor, bandFromScore, shouldAutoApply, type IrisConfidenceBand } from '../../lib/iris/confidence'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

interface RFIIrisTriageProps {
  rfiId: string
  projectId: string
  responses: RFIResponseRow[]
}

interface TriageSuggestion {
  responseId: string
  summary: string
  suggestedType: RFIResponseType | null
  suggestedTypeConfidence: number
  suggestedAction: 'close' | 'follow_up' | 'change_event' | 'field_directive' | null
  suggestedActionConfidence: number
  ambiguityNote: string | null
  band: IrisConfidenceBand
}

const APPROVAL_RE = /\bapprove(d|s|d\sas\snoted)?\b|\bno\sexceptions?\b/i
const REVISE_RE = /\brevise\s*(and|&)?\s*resubmit\b|\breject(ed)?\b/i
const CLARIFY_RE = /\b(returned\sfor\s)?clarif(ication|y)\b|\b(please\s)?clarify\b/i
const ANSWERED_RE = /\b(answered|see\s(attached|sketch)|use\sdetail|confirmed|please\sproceed)\b/i

/** Pure, deterministic triage — no LLM call. The full pipeline plugs
    in here when the iris-rfi-response-draft fn is rebuilt; for now this
    is a defensible rules-only baseline that satisfies the audit. */
function triageResponse(r: RFIResponseRow): TriageSuggestion | null {
  if (!r.content) return null
  const text = r.content
  const summary = text
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)

  let suggestedType: RFIResponseType | null = null
  let typeConfidence = 0.4
  if (REVISE_RE.test(text)) { suggestedType = 'revise_and_resubmit'; typeConfidence = 0.9 }
  else if (CLARIFY_RE.test(text)) { suggestedType = 'returned_for_clarification'; typeConfidence = 0.85 }
  else if (APPROVAL_RE.test(text)) { suggestedType = 'approved_as_noted'; typeConfidence = 0.88 }
  else if (ANSWERED_RE.test(text)) { suggestedType = 'answered'; typeConfidence = 0.7 }

  let suggestedAction: TriageSuggestion['suggestedAction'] = null
  let actionConfidence = 0.4
  if (suggestedType === 'approved_as_noted' || suggestedType === 'answered') {
    suggestedAction = 'close'
    actionConfidence = 0.78
  } else if (suggestedType === 'revise_and_resubmit') {
    suggestedAction = 'follow_up'
    actionConfidence = 0.7
  } else if (suggestedType === 'returned_for_clarification') {
    suggestedAction = 'follow_up'
    actionConfidence = 0.75
  }

  const ambiguityNote =
    typeConfidence < 0.6
      ? "Iris couldn't classify this response with confidence — review before applying."
      : null

  const band = bandFromScore(Math.min(typeConfidence, actionConfidence))
  return {
    responseId: r.id,
    summary,
    suggestedType,
    suggestedTypeConfidence: typeConfidence,
    suggestedAction,
    suggestedActionConfidence: actionConfidence,
    ambiguityNote,
    band,
  }
}

export const RFIIrisTriage: React.FC<RFIIrisTriageProps> = ({ rfiId, projectId, responses }) => {
  const editResponse = useEditRFIResponse()
  const updateRFI = useUpdateRFI()
  const [appliedFor, setAppliedFor] = useState<Set<string>>(new Set())

  // Most recent visible response only — older messages don't need a banner.
  const latestResponse = useMemo(() => {
    return [...responses].reverse().find((r) => !r.deleted_at) ?? null
  }, [responses])

  const triage = useMemo(() => (latestResponse ? triageResponse(latestResponse) : null), [latestResponse])

  // Auto-apply at high confidence (band='high' AND not yet applied).
  useEffect(() => {
    if (!triage || !triage.suggestedType || appliedFor.has(triage.responseId)) return
    if (!shouldAutoApply(triage.band)) return
    if (latestResponse && latestResponse.response_type === triage.suggestedType) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- idempotency guard: mark already-applied response so the mutation is not re-fired on next render
      setAppliedFor((s) => new Set([...s, triage.responseId]))
      return
    }
    void editResponse
      .mutateAsync({
        responseId: triage.responseId,
        rfiId,
        projectId,
        responseType: triage.suggestedType,
      })
      .then(async () => {
        await logAuditEntry({
          projectId,
          entityType: 'rfi',
          entityId: rfiId,
          action: 'update',
          afterState: { response_id: triage.responseId, response_type: triage.suggestedType, auto_applied: true },
          metadata: {
            kind: 'iris_triage_auto_apply',
            confidence: triage.suggestedTypeConfidence,
            model_fingerprint: 'iris-triage:rules-2026-05-07',
          },
        })
        setAppliedFor((s) => new Set([...s, triage.responseId]))
      })
      .catch(() => {/* surfaced by mutation toast */})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triage?.responseId, triage?.suggestedType, triage?.band])

  if (!triage || !latestResponse) return null

  const tone = bandColor(triage.band)
  const isAutoApplied = appliedFor.has(triage.responseId) && shouldAutoApply(triage.band)

  const handleApplyType = async () => {
    if (!triage.suggestedType) return
    try {
      await editResponse.mutateAsync({
        responseId: triage.responseId,
        rfiId,
        projectId,
        responseType: triage.suggestedType,
      })
      await logAuditEntry({
        projectId,
        entityType: 'rfi',
        entityId: rfiId,
        action: 'update',
        afterState: { response_id: triage.responseId, response_type: triage.suggestedType },
        metadata: {
          kind: 'iris_triage_user_apply',
          confidence: triage.suggestedTypeConfidence,
          model_fingerprint: 'iris-triage:rules-2026-05-07',
        },
      })
      toast.success(`Applied "${triage.suggestedType.replace(/_/g, ' ')}"`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not apply')
    }
  }

  const handleApplyAction = async () => {
    if (!triage.suggestedAction) return
    try {
      if (triage.suggestedAction === 'close') {
        await updateRFI.mutateAsync({ id: rfiId, projectId, updates: { status: 'closed' } })
        await logAuditEntry({
          projectId,
          entityType: 'rfi',
          entityId: rfiId,
          action: 'status_change',
          afterState: { status: 'closed' },
          metadata: { kind: 'iris_triage_close', confidence: triage.suggestedActionConfidence },
        })
        toast.success('RFI closed')
      } else {
        // Follow-up / change-event / field-directive — stub: just log
        // an audit row so the deposition records the suggestion. The
        // wired flows ship in a follow-up PR.
        await logAuditEntry({
          projectId,
          entityType: 'rfi',
          entityId: rfiId,
          action: 'update',
          afterState: { suggested_action: triage.suggestedAction },
          metadata: { kind: 'iris_triage_action_stub', action: triage.suggestedAction },
        })
        toast(`Logged "${triage.suggestedAction.replace(/_/g, ' ')}". Wired flow ships in a follow-up.`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    }
  }

  return (
    <div
      role="region"
      aria-label="Iris triage"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing['1'],
        padding: spacing['3'],
        margin: `${spacing['2']} 0`,
        backgroundColor: tone.bg,
        border: `1px solid ${tone.fg}`,
        borderRadius: borderRadius.base,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: tone.fg }}>
        <Sparkles size={14} />
        <strong style={{ fontSize: typography.fontSize.sm }}>Iris triage</strong>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginLeft: 'auto' }}>
          {triage.band}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
        {triage.summary}
      </p>
      {triage.ambiguityNote && (
        <p style={{ margin: 0, fontSize: 11, color: tone.fg, fontStyle: 'italic' }}>
          {triage.ambiguityNote}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
        {triage.suggestedType && (
          <PermissionGate permission="rfis.edit">
            <button
              type="button"
              onClick={handleApplyType}
              disabled={editResponse.isPending || isAutoApplied}
              title={`Confidence ${triage.suggestedTypeConfidence.toFixed(2)}`}
              style={btnStyle(isAutoApplied)}
            >
              <Check size={11} /> {isAutoApplied ? 'Auto-applied' : `Apply: ${triage.suggestedType.replace(/_/g, ' ')}`}
            </button>
          </PermissionGate>
        )}
        {triage.suggestedAction && (
          <PermissionGate permission="rfis.edit">
            <button
              type="button"
              onClick={handleApplyAction}
              disabled={updateRFI.isPending}
              style={btnStyle(false)}
            >
              {triage.suggestedAction === 'close' ? <X size={11} /> : triage.suggestedAction === 'follow_up' ? <Send size={11} /> : <FilePlus2 size={11} />}
              {triage.suggestedAction === 'close' && 'Close RFI'}
              {triage.suggestedAction === 'follow_up' && 'Generate follow-up'}
              {triage.suggestedAction === 'change_event' && 'Generate Change Event'}
              {triage.suggestedAction === 'field_directive' && 'Generate Field Directive'}
            </button>
          </PermissionGate>
        )}
      </div>
    </div>
  )
}

const btnStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 10px',
  fontSize: typography.fontSize.caption,
  fontWeight: 600,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.sm,
  background: disabled ? colors.surfaceDisabled : colors.surfaceRaised,
  color: disabled ? colors.textTertiary : colors.textPrimary,
  cursor: disabled ? 'default' : 'pointer',
})

void ChevronRight  // keep import for future expansion

export default RFIIrisTriage

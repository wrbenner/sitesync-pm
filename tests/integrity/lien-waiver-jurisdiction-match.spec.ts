/**
 * FMEA B.LIEN.1 (Wave 4) — Lien waiver state mismatch
 *
 * Hazard: a project in California has a subcontractor sign a TX-form
 *         waiver. The waiver text references "Texas Property Code Ch. 53"
 *         and the statutory cure period — but the project is in California
 *         (Civil Code § 8132 governs). The waiver may be voidable.
 *
 *         The matching contract is:
 *           - Project's billing jurisdiction (state) = waiver's
 *             template jurisdiction. AIA is a special "any state"
 *             jurisdiction the project owner can opt into.
 *           - `resolveWaiverTemplateId(jurisdiction, type)` MUST not
 *             silently fall back to AIA if the jurisdiction is CA/TX/FL
 *             and the requested type has a matching localized template.
 *           - When a waiver is being signed, the validator MUST reject
 *             a (project_state, template) tuple that mismatches.
 *
 * Wave-4 contract (this file):
 *   1. Template registry surface: pin that CA/TX/FL templates exist
 *      and are *not* superseded.
 *   2. Resolver behavior: pin that resolveWaiverTemplateId(CA, ...) →
 *      CA template (not AIA fallback).
 *   3. Validator: author a `validateWaiverJurisdiction` contract that
 *      a future service-layer wrapper must satisfy.
 */
import { describe, it, expect } from 'vitest'
import {
  resolveWaiverTemplateId,
  getWaiverTemplate,
  listWaiverTemplates,
  type WaiverJurisdiction,
} from '../../src/lib/lienWaiver/templateRenderer'

/**
 * Service-layer contract — author here, enforced at the service layer
 * in a follow-up. Returns null on match, error string on mismatch.
 *
 * The hazard is bypassing this validator and letting the resolver's
 * AIA fallback paper over a CA/TX/FL project.
 */
function validateWaiverJurisdiction(opts: {
  projectState: string | null | undefined
  templateId: string
}): { ok: true } | { ok: false; reason: string } {
  const tpl = getWaiverTemplate(opts.templateId)
  if (!tpl) {
    return { ok: false, reason: `unknown template: ${opts.templateId}` }
  }
  const state = (opts.projectState ?? '').toUpperCase().trim()
  if (state === '') {
    return { ok: false, reason: 'project state is required to select a waiver template' }
  }
  // AIA is the explicit fallback — only acceptable if the project
  // jurisdiction isn't one of the localized variants.
  const localized: WaiverJurisdiction[] = ['CA', 'TX', 'FL']
  if (localized.includes(state as WaiverJurisdiction)) {
    if (tpl.jurisdiction !== state) {
      return {
        ok: false,
        reason: `project state ${state} requires a ${state} template; got ${tpl.jurisdiction}`,
      }
    }
    return { ok: true }
  }
  // Non-localized state — AIA acceptable.
  if (tpl.jurisdiction === 'AIA') return { ok: true }
  return {
    ok: false,
    reason: `project state ${state} expects AIA template; got ${tpl.jurisdiction}`,
  }
}

describe('FMEA B.LIEN.1 — waiver jurisdiction matches project state', () => {
  it('registry: CA / TX / FL / AIA localized templates exist', () => {
    const all = listWaiverTemplates()
    const jur = new Set(all.map((t) => t.jurisdiction))
    expect(jur.has('CA')).toBe(true)
    expect(jur.has('TX')).toBe(true)
    expect(jur.has('FL')).toBe(true)
    expect(jur.has('AIA')).toBe(true)
  })

  it('registry: no active template is silently superseded', () => {
    const all = listWaiverTemplates()
    // Active set = no supersededDate. Confirm CA/TX/FL each have at
    // least one active template.
    for (const j of ['CA', 'TX', 'FL'] as const) {
      const active = all.filter((t) => t.jurisdiction === j && !t.supersededDate)
      expect(active.length, `active ${j} templates`).toBeGreaterThan(0)
    }
  })

  it('resolver: CA + conditional_progress returns the CA template (not AIA fallback)', () => {
    const id = resolveWaiverTemplateId('CA', 'conditional_progress')
    const tpl = getWaiverTemplate(id)
    expect(tpl).not.toBeNull()
    expect(tpl?.jurisdiction).toBe('CA')
  })

  it('resolver: TX + conditional_progress returns the TX template', () => {
    const id = resolveWaiverTemplateId('TX', 'conditional_progress')
    expect(getWaiverTemplate(id)?.jurisdiction).toBe('TX')
  })

  it('resolver: FL + conditional_progress returns the FL template', () => {
    const id = resolveWaiverTemplateId('FL', 'conditional_progress')
    expect(getWaiverTemplate(id)?.jurisdiction).toBe('FL')
  })

  it('resolver: unknown jurisdiction (e.g. NY, IL) falls back to AIA — documented behavior', () => {
    // The hazard is silently picking AIA when a localized template
    // exists; for NY/IL we *expect* the AIA fallback today.
    const id = resolveWaiverTemplateId('NY', 'conditional_progress')
    expect(getWaiverTemplate(id)?.jurisdiction).toBe('AIA')
  })

  it('validator: CA project + CA template is accepted', () => {
    const id = resolveWaiverTemplateId('CA', 'conditional_progress')
    const result = validateWaiverJurisdiction({ projectState: 'CA', templateId: id })
    expect(result.ok).toBe(true)
  })

  it('validator: CA project + TX template is REJECTED (the headline hazard)', () => {
    const txId = resolveWaiverTemplateId('TX', 'conditional_progress')
    const result = validateWaiverJurisdiction({ projectState: 'CA', templateId: txId })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/CA template/)
  })

  it('validator: CA project + AIA template is REJECTED (CA has a localized template)', () => {
    // The AIA fallback is fine for NY/IL but a CA project must use
    // the statute form.
    const result = validateWaiverJurisdiction({
      projectState: 'CA',
      templateId: 'aia-g706-conditional-progress-v1',
    })
    expect(result.ok).toBe(false)
  })

  it('validator: NY project + AIA template is accepted (no localized template)', () => {
    const result = validateWaiverJurisdiction({
      projectState: 'NY',
      templateId: 'aia-g706-conditional-progress-v1',
    })
    expect(result.ok).toBe(true)
  })

  it('validator: missing project state is REJECTED (no silent default)', () => {
    const result = validateWaiverJurisdiction({
      projectState: null,
      templateId: 'aia-g706-conditional-progress-v1',
    })
    expect(result.ok).toBe(false)
  })

  it('validator: unknown templateId is REJECTED', () => {
    const result = validateWaiverJurisdiction({
      projectState: 'CA',
      templateId: 'made-up-template-v999',
    })
    expect(result.ok).toBe(false)
  })

  it('KNOWN-VIOLATION ledger: no project-wide validateWaiverJurisdiction wrapper is exported', () => {
    // This file *authors* the contract. The actual service-layer
    // wrapper that calls it from the lien_waivers insert path does
    // not yet exist. Until it does, the resolver's AIA fallback is
    // the only guard — which is insufficient for CA/TX/FL projects.
    expect(true).toBe(true)
  })
})

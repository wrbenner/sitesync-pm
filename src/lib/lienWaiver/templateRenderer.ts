/**
 * Lien Waiver Template Renderer.
 *
 * Pure renderer that takes structured input + a template id and produces a
 * plain-text waiver body. The legal prose itself is a `[TODO_LEGAL_REVIEW]`
 * placeholder by design — see PLATINUM_FINANCIAL.md. Mechanical fields
 * (sub name, project, period, amount, signature block) are templated for
 * real and must populate accurately on every render.
 *
 * Templates self-register here so the registry is the single source of
 * truth that callers can iterate. Adding a new jurisdiction is one new
 * file in `templates/` plus an import here.
 */

import { aiaConditionalProgress } from './templates/aia-g706-conditional-progress';
import { aiaUnconditionalProgress } from './templates/aia-g706-unconditional-progress';
import { caConditionalProgress } from './templates/ca-conditional-progress';
import { txConditionalProgress } from './templates/tx-conditional-progress';
import { flConditionalProgress } from './templates/fl-conditional-progress';

export type WaiverJurisdiction = 'AIA' | 'CA' | 'TX' | 'FL';
export type WaiverType = 'conditional_progress' | 'unconditional_progress' | 'conditional_final' | 'unconditional_final';

export interface WaiverInput {
  /** Subcontractor (waiving party) name. */
  subcontractorName: string;
  /** Project legal name. */
  projectName: string;
  /** Project address — full street address. */
  projectAddress: string;
  /** Owner / GC making payment. */
  payerName: string;
  /** ISO date — period through (the "as of" date for the waiver). */
  periodThrough: string;
  /** Dollar amount being waived against, two-decimal string. */
  amount: number;
  /** Signer print name. */
  signerName: string;
  /** Signer title. */
  signerTitle: string;
  /** ISO date — execution date. Stays null in the rendered body until signed. */
  executionDate?: string | null;
}

export interface WaiverTemplate {
  /** Stable id — used in the DB column waivers.template_id. */
  id: string;
  jurisdiction: WaiverJurisdiction;
  type: WaiverType;
  /** ISO date — when this template version became effective. */
  effectiveDate: string;
  /** ISO date — when superseded by a newer revision (null = active). */
  supersededDate?: string | null;
  /**
   * Template version string, used to lock prior signed waivers to the
   * exact text they were signed against (lien_waivers.template_version).
   */
  version: string;
  /** Pure renderer — no I/O. */
  render(input: WaiverInput): string;
}

const REGISTRY: Record<string, WaiverTemplate> = {
  [aiaConditionalProgress.id]: aiaConditionalProgress,
  [aiaUnconditionalProgress.id]: aiaUnconditionalProgress,
  [caConditionalProgress.id]: caConditionalProgress,
  [txConditionalProgress.id]: txConditionalProgress,
  [flConditionalProgress.id]: flConditionalProgress,
};

export function getWaiverTemplate(id: string): WaiverTemplate | null {
  return REGISTRY[id] ?? null;
}

export function listWaiverTemplates(): WaiverTemplate[] {
  return Object.values(REGISTRY);
}

/**
 * Known jurisdictions the resolver explicitly recognizes. Anything outside
 * this set is rejected by `validateWaiverJurisdiction` rather than getting
 * an opaque AIA fallback. `AIA` is the explicit "any state" template.
 *
 * FMEA B.LIEN.1 (Wave 4): adding to this set is a deliberate act — a
 * silent AIA fallback for an unrecognized state would let a project
 * sign a non-statutory waiver against the wrong jurisdiction.
 */
export const KNOWN_WAIVER_JURISDICTIONS = ['AIA', 'CA', 'TX', 'FL', 'NY'] as const;
export type KnownWaiverJurisdiction = (typeof KNOWN_WAIVER_JURISDICTIONS)[number];

export function isKnownWaiverJurisdiction(value: unknown): value is KnownWaiverJurisdiction {
  if (typeof value !== 'string') return false;
  const norm = value.toUpperCase().trim();
  return (KNOWN_WAIVER_JURISDICTIONS as readonly string[]).includes(norm);
}

/**
 * Throws a clear, user-surfaceable error if the project's state is not
 * one of the resolver's known jurisdictions. NY currently routes to
 * the AIA template (no NY-specific form yet), but is *recognized* —
 * the throw is reserved for genuinely unknown states (e.g. 'IL', 'PA')
 * where we must prompt the user to confirm AIA explicitly rather than
 * silently signing a non-statutory waiver.
 *
 * @throws {Error} when `state` is not in KNOWN_WAIVER_JURISDICTIONS.
 */
export function validateWaiverJurisdiction(state: string | null | undefined): KnownWaiverJurisdiction {
  if (state == null || String(state).trim() === '') {
    throw new Error(
      'Lien waiver jurisdiction is required: project state is missing. ' +
      'Set the project billing state before requesting a waiver.',
    );
  }
  const norm = String(state).toUpperCase().trim();
  if (!isKnownWaiverJurisdiction(norm)) {
    throw new Error(
      `Unknown lien waiver jurisdiction: "${state}". ` +
      `Supported: ${KNOWN_WAIVER_JURISDICTIONS.join(', ')}. ` +
      `If this project is in a jurisdiction without a localized template, ` +
      `explicitly pass 'AIA' to use the AIA G706 fallback.`,
    );
  }
  return norm;
}

/**
 * Resolve a template id from jurisdiction + type.
 *
 * FMEA B.LIEN.1 (Wave 4): the resolver previously silently fell back to
 * the AIA template on ANY unrecognized input. That's correct for explicit
 * AIA opt-in (state = 'AIA') and reasonable for jurisdictions we recognize
 * but have no localized template for (e.g. NY today). For *unknown* inputs
 * (typos, unsupported states), we throw via `validateWaiverJurisdiction`
 * so the caller surfaces an error rather than silently producing a
 * non-statutory waiver for a CA/TX/FL project.
 */
export function resolveWaiverTemplateId(
  jurisdiction: WaiverJurisdiction | string | null | undefined,
  type: WaiverType,
): string {
  const j = validateWaiverJurisdiction(jurisdiction ?? 'AIA');
  const matches = listWaiverTemplates().filter(
    t => t.jurisdiction === j && t.type === type && !t.supersededDate,
  );
  if (matches.length > 0) return matches[0].id;
  // No localized template for this jurisdiction — fall back to AIA.
  // This is *explicit* fallback (the jurisdiction was validated), not
  // silent fallback (which would mask a typo).
  return aiaConditionalProgress.id;
}

/**
 * Render the body of a waiver. Throws on missing required fields rather
 * than silently emitting a malformed legal document.
 */
export function renderWaiver(templateId: string, input: WaiverInput): string {
  const tpl = getWaiverTemplate(templateId);
  if (!tpl) {
    throw new Error(`Unknown waiver template id: ${templateId}`);
  }
  validateInput(input);
  return tpl.render(input);
}

function validateInput(input: WaiverInput): void {
  const required: (keyof WaiverInput)[] = [
    'subcontractorName',
    'projectName',
    'projectAddress',
    'payerName',
    'periodThrough',
    'amount',
    'signerName',
    'signerTitle',
  ];
  for (const k of required) {
    const v = input[k];
    if (v == null || v === '' || (typeof v === 'number' && !Number.isFinite(v))) {
      throw new Error(`Missing required waiver field: ${String(k)}`);
    }
  }
}

/** Helper used by the templates — formats a number as $1,234.56. */
export function fmtAmount(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const cents = Math.round(abs * 100);
  const dollars = Math.floor(cents / 100);
  const rem = cents - dollars * 100;
  return `${sign}$${dollars.toLocaleString('en-US')}.${rem.toString().padStart(2, '0')}`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

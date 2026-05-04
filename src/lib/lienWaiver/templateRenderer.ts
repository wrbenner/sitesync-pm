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
 * Resolve a template id from jurisdiction + type. Falls back to the AIA
 * conditional progress template when no jurisdictional match is found.
 */
export function resolveWaiverTemplateId(
  jurisdiction: WaiverJurisdiction | string | null | undefined,
  type: WaiverType,
): string {
  const j = (jurisdiction ?? 'AIA').toString().toUpperCase();
  const matches = listWaiverTemplates().filter(
    t => t.jurisdiction === j && t.type === type && !t.supersededDate,
  );
  if (matches.length > 0) return matches[0].id;
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

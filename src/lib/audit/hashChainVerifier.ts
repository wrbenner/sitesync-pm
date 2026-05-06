// ── Hash-chain verifier ────────────────────────────────────────────────────
// Mirror of the audit_log_compute_hash() Postgres trigger. Walks an
// ordered run of audit_log rows, recomputes each entry_hash, and
// compares against the stored value.
//
// The payload formula MUST stay byte-for-byte identical to the trigger
// in 20260426000001_audit_log_hash_chain.sql:
//
//   coalesce(id::text, '')              || '|' ||
//   coalesce(created_at::text, '')      || '|' ||
//   coalesce(user_id::text, '')         || '|' ||
//   coalesce(user_email, '')            || '|' ||
//   coalesce(project_id::text, '')      || '|' ||
//   coalesce(organization_id::text, '') || '|' ||
//   entity_type                         || '|' ||
//   entity_id::text                     || '|' ||
//   action                              || '|' ||
//   coalesce(before_state::text, '')    || '|' ||
//   coalesce(after_state::text, '')     || '|' ||
//   coalesce(array_to_string(changed_fields, ','), '') || '|' ||
//   coalesce(metadata::text, '{}')      || '|' ||
//   coalesce(prev_hash, '')
//
// This function is pure. Used by:
//   • EntityAuditViewer (badge + gap surface in the timeline)
//   • supabase/functions/sealed-entity-export (manifest stamp)
//   • A scheduled verify-audit-chain cron (already in the codebase
//     spec; this lib supports it)

export interface AuditLogRow {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  /** Optional display name; not part of the hash payload but useful for UI. */
  user_name?: string | null;
  project_id: string | null;
  organization_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  before_state: unknown | null;
  after_state: unknown | null;
  changed_fields: ReadonlyArray<string> | null;
  metadata: Record<string, unknown> | null;
  previous_hash: string | null;
  entry_hash: string | null;
}

export type GapReason =
  | 'previous_hash_mismatch'
  | 'entry_hash_mismatch'
  | 'missing_entry_hash'
  | 'missing_previous_hash_for_non_first';

export interface ChainGap {
  row_id: string;
  reason: GapReason;
  /** Computed expected vs. stored value. Truncated to 16 chars for UI. */
  expected: string | null;
  actual: string | null;
}

export interface ChainVerificationResult {
  ok: boolean;
  total: number;
  gaps: ReadonlyArray<ChainGap>;
}

/**
 * Stringify a value the way Postgres `text` casts produce. JSON objects
 * are rendered without whitespace because Postgres jsonb::text emits
 * canonical (compact) form.
 *
 * NOTE: For full byte-identical matching of jsonb::text in Postgres,
 * key order and formatting must match exactly. supabase-js returns
 * already-parsed JS objects, which we re-serialize with JSON.stringify;
 * Postgres normalizes jsonb internally too. In practice the two match
 * when no manual mutations have occurred. If they ever drift, we
 * surface a `entry_hash_mismatch` and the user investigates the row.
 */
function pgText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

function pgArrayJoin(arr: ReadonlyArray<string> | null | undefined): string {
  if (!arr || arr.length === 0) return '';
  return arr.join(',');
}

/** Concatenated payload that goes into SHA-256. */
export function buildPayload(row: AuditLogRow, prevHash: string | null): string {
  return [
    row.id,
    row.created_at,
    row.user_id ?? '',
    row.user_email ?? '',
    row.project_id ?? '',
    row.organization_id ?? '',
    row.entity_type,
    row.entity_id,
    row.action,
    row.before_state == null ? '' : pgText(row.before_state),
    row.after_state == null ? '' : pgText(row.after_state),
    pgArrayJoin(row.changed_fields),
    row.metadata == null ? '{}' : pgText(row.metadata),
    prevHash ?? '',
  ].join('|');
}

/** Compute SHA-256 hex of a string. Browser + Node both support
 *  globalThis.crypto.subtle. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  // crypto is available in Deno (edge fns), modern browsers, and Node 18+.
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify an ordered run of rows. Caller MUST sort the input chronologically
 * (created_at ASC, id ASC) before passing — the trigger's ordering rule.
 *
 * Returns gaps in document order (mirrors the input). The chain is `ok` only
 * when every row's previous_hash and entry_hash match the recomputed values.
 */
export async function verifyChain(
  rowsChronological: ReadonlyArray<AuditLogRow>,
): Promise<ChainVerificationResult> {
  const gaps: ChainGap[] = [];
  let prevHash: string | null = null;

  for (let i = 0; i < rowsChronological.length; i++) {
    const row = rowsChronological[i];

    // 1. previous_hash must equal the prior row's entry_hash
    //    (or null when this is the first row).
    const expectedPrev = prevHash;
    if (i === 0) {
      if (row.previous_hash != null) {
        gaps.push({
          row_id: row.id,
          reason: 'previous_hash_mismatch',
          expected: null,
          actual: row.previous_hash,
        });
      }
    } else if (row.previous_hash !== expectedPrev) {
      gaps.push({
        row_id: row.id,
        reason: row.previous_hash == null
          ? 'missing_previous_hash_for_non_first'
          : 'previous_hash_mismatch',
        expected: expectedPrev,
        actual: row.previous_hash,
      });
    }

    // 2. entry_hash must match the SHA-256 of the canonical payload.
    if (row.entry_hash == null) {
      gaps.push({
        row_id: row.id,
        reason: 'missing_entry_hash',
        expected: null,
        actual: null,
      });
      // Use whatever previous_hash the row claims for chain continuation;
      // the next row's check will likely also fail, surfacing the gap.
      prevHash = row.previous_hash;
      continue;
    }

    const computed = await sha256Hex(buildPayload(row, expectedPrev));
    if (computed !== row.entry_hash) {
      gaps.push({
        row_id: row.id,
        reason: 'entry_hash_mismatch',
        expected: computed,
        actual: row.entry_hash,
      });
    }

    prevHash = row.entry_hash;
  }

  return { ok: gaps.length === 0, total: rowsChronological.length, gaps };
}

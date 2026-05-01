// =============================================================================
// Daily-log signing — SHA-256 hash chain
// =============================================================================
// Each signed daily log appends a checkpoint to the project's hash chain:
//
//   payload_hash = SHA-256(entity_type || entity_id || canonical_payload || created_at || actor_id)
//   chain_hash   = SHA-256(prev_hash || payload_hash)
//
// `canonical_payload` is the daily log's value-bearing fields serialized
// deterministically — same bytes in == same hash out, regardless of object
// key ordering. The verifier walks the chain and recomputes; tampering with
// any historical row breaks every later chain_hash.
//
// Pure functions only. The Web Crypto subtle API is async; that ripples
// through every caller, but it lets the same code run in Node tests
// (via globalThis.crypto), the browser, and a Deno edge function.
// =============================================================================

export const ZERO_HASH = '0'.repeat(64)

export interface SignableDailyLog {
  id: string
  project_id: string
  log_date: string
  summary: string | null
  weather: string | null
  temperature_high: number | null
  temperature_low: number | null
  workers_onsite: number | null
  total_hours: number | null
  incidents: number | null
  created_at: string
}

export interface SignInputs {
  log: SignableDailyLog
  /** Hash of the previous checkpoint for this project (or ZERO_HASH at chain start). */
  prevHash: string
  /** Signing user's UUID — bound into the payload hash so a forged signature
   *  by another user produces a different hash. */
  signerId: string
  /** Timestamp the signature happened. Bound into payload_hash so two
   *  identical-content signs at different times still produce different hashes. */
  signedAt: string
}

export interface SignedCheckpoint {
  prevHash: string
  payloadHash: string
  chainHash: string
  signerId: string
  signedAt: string
  entityType: 'daily_log'
  entityId: string
  /** The exact canonical bytes that were hashed. Preserved for forensic
   *  re-verification — auditors don't have to trust our serializer; they
   *  can re-hash these bytes with SHA-256 and compare. */
  canonicalPayload: string
}

/**
 * Canonical JSON: sorted keys, no whitespace, no trailing newline. Two logs
 * with the same value-bearing content always produce the same string.
 */
export function canonicalize(log: SignableDailyLog): string {
  const ordered = {
    id: log.id,
    project_id: log.project_id,
    log_date: log.log_date,
    summary: log.summary ?? '',
    weather: log.weather ?? '',
    temperature_high: log.temperature_high ?? null,
    temperature_low: log.temperature_low ?? null,
    workers_onsite: log.workers_onsite ?? null,
    total_hours: log.total_hours ?? null,
    incidents: log.incidents ?? null,
    created_at: log.created_at,
  }
  return JSON.stringify(ordered, Object.keys(ordered).sort())
}

async function sha256Hex(input: string): Promise<string> {
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle
  if (!subtle) throw new Error('crypto.subtle unavailable in this environment')
  const buf = new TextEncoder().encode(input)
  const hash = await subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function computePayloadHash(
  log: SignableDailyLog,
  signerId: string,
  signedAt: string,
): Promise<string> {
  const canonical = canonicalize(log)
  return sha256Hex(`daily_log:${log.id}:${canonical}:${signedAt}:${signerId}`)
}

export async function computeChainHash(prevHash: string, payloadHash: string): Promise<string> {
  return sha256Hex(`${prevHash}|${payloadHash}`)
}

/**
 * Build a SignedCheckpoint deterministically. Same inputs ⇒ same outputs.
 * The DB INSERT is the caller's job — this function does no IO.
 */
export async function buildCheckpoint(inputs: SignInputs): Promise<SignedCheckpoint> {
  const canonical = canonicalize(inputs.log)
  const payloadHash = await computePayloadHash(inputs.log, inputs.signerId, inputs.signedAt)
  const chainHash = await computeChainHash(inputs.prevHash, payloadHash)
  return {
    prevHash: inputs.prevHash,
    payloadHash,
    chainHash,
    signerId: inputs.signerId,
    signedAt: inputs.signedAt,
    entityType: 'daily_log',
    entityId: inputs.log.id,
    canonicalPayload: canonical,
  }
}

/**
 * Walk a chain (oldest → newest) and recompute every chain_hash.
 * Returns the index of the first row that fails verification, or -1 if
 * the entire chain is consistent.
 *
 * The auditor passes the rows ordered by `sequence ASC`. Each row carries
 * its own claimed `chain_hash`, `prev_hash`, `payload_hash`, and the
 * canonical bytes; this function recomputes from those bytes.
 */
export async function verifyChain(
  rows: Array<Pick<SignedCheckpoint, 'prevHash' | 'payloadHash' | 'chainHash'>>,
  /** Optional: force the first row's prevHash to ZERO_HASH (chain root check). */
  startsAtRoot = true,
): Promise<number> {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (i === 0 && startsAtRoot && r.prevHash !== ZERO_HASH) return 0
    if (i > 0 && r.prevHash !== rows[i - 1].chainHash) return i
    const recomputed = await computeChainHash(r.prevHash, r.payloadHash)
    if (recomputed !== r.chainHash) return i
  }
  return -1
}

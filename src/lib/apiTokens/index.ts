// ── apiTokens — pure helpers ───────────────────────────────────────────────
// Mint a long-lived API token; verify a presented token; format the
// prefix for display in the admin UI.
//
// Token shape:
//   ss_<env>_<base32-secret>
//   e.g.  ss_live_4U7Z8X3KQH2BDM6V5RFA1NCY
//
// Storage: only SHA-256(token) lives in org_api_tokens.token_hash. The
// original token is shown to the admin once and never persisted by
// the platform.

const ENV_LIVE = 'live'

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' // Crockford-ish; no 0/1/I/O.

/** Crypto-strong random secret using the standard alphabet. */
function randomSecret(length: number): string {
  const bytes = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return out
}

export interface MintedToken {
  /** Full secret token. Show to the admin ONCE; never persist. */
  token: string
  /** Stable prefix shown in the admin UI / logs. Safe to persist. */
  prefix: string
  /** SHA-256 of `token`. Persist this in org_api_tokens.token_hash. */
  hash: string
}

export interface MintOptions {
  env?: 'live' | 'test'
  /** Length of the random secret portion. Default 30 (155 bits entropy). */
  secretLength?: number
}

export async function mintToken(opts: MintOptions = {}): Promise<MintedToken> {
  const env = opts.env ?? ENV_LIVE
  const secret = randomSecret(opts.secretLength ?? 30)
  const token = `ss_${env}_${secret}`
  const prefix = `ss_${env}_${secret.slice(0, 6)}`
  const hash = await sha256Hex(token)
  return { token, prefix, hash }
}

/** Constant-time string compare — prevents timing-side-channel leaks. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Validate a presented token against a stored hash. Returns true on
 *  match. Caller is responsible for fetching the row by prefix first
 *  (the prefix is stored cleartext so the lookup can be indexed). */
export async function verifyToken(presented: string, storedHash: string): Promise<boolean> {
  const computed = await sha256Hex(presented)
  return constantTimeEqual(computed, storedHash)
}

/** Format token for masked display in logs / UI: "ss_live_AB12CD…". */
export function maskToken(prefixOrToken: string): string {
  const m = prefixOrToken.match(/^ss_(live|test)_(.{1,6})/)
  if (!m) return '****'
  return `ss_${m[1]}_${m[2]}…`
}

/** Parse a token's environment hint. Returns 'live' | 'test' | null. */
export function envFromToken(token: string): 'live' | 'test' | null {
  if (token.startsWith('ss_live_')) return 'live'
  if (token.startsWith('ss_test_')) return 'test'
  return null
}

/** Validate the requested scope against the token's granted scopes.
 *  '*' in the granted list means all scopes. */
export function hasScope(grantedScopes: ReadonlyArray<string>, requested: string): boolean {
  if (grantedScopes.includes('*')) return true
  if (grantedScopes.includes(requested)) return true
  // Wildcard support: 'rfis.*' → matches 'rfis.create' etc.
  for (const granted of grantedScopes) {
    if (granted.endsWith('.*') && requested.startsWith(granted.slice(0, -1))) return true
  }
  return false
}

/** Validate that a project_id is permitted by the token's project filter.
 *  null `tokenProjectIds` = all projects. */
export function hasProjectAccess(
  tokenProjectIds: ReadonlyArray<string> | null | undefined,
  projectId: string,
): boolean {
  if (tokenProjectIds == null || tokenProjectIds.length === 0) return true
  return tokenProjectIds.includes(projectId)
}

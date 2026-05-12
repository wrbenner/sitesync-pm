// src/lib/auth/passwordChecks.ts — BRT subsystem 2 §4.3
//
// Password security checks. Two layers:
//
//   1. Local rules — length, complexity. Synchronous, no network. Used for
//      live form validation.
//
//   2. Pwned Passwords k-anonymity check — sends only the first 5 chars of
//      the SHA-1 to https://api.pwnedpasswords.com/range/<5char> and locally
//      filters the response. The full hash never leaves the browser.
//      Used at submit time, not on every keystroke (latency + rate limits).
//
// Spec: BRT_SUBSYSTEM_2_SELF_SERVE_SIGNUP.md §4.3
//   - min 12 chars (spec); upgrade from current min 8
//   - one uppercase, one digit
//   - reject if seen in > 100 breaches

export interface PasswordRuleResult {
  ok: boolean
  /** Human-readable reason if !ok. */
  reason?: string
}

const MIN_LENGTH = 12
const PWNED_THRESHOLD = 100 // reject if breach count exceeds this

/**
 * Synchronous local rules. Safe to call on every keystroke.
 */
export function checkPasswordRules(password: string): PasswordRuleResult {
  if (typeof password !== 'string') {
    return { ok: false, reason: 'Password is required' }
  }
  if (password.length < MIN_LENGTH) {
    return { ok: false, reason: `Password must be at least ${MIN_LENGTH} characters` }
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, reason: 'Password must include at least one uppercase letter' }
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, reason: 'Password must include at least one digit' }
  }
  return { ok: true }
}

/**
 * SHA-1 hex of input. We use SHA-1 because the Pwned Passwords API uses it;
 * we never store this hash, so SHA-1's collision resistance issues don't
 * matter here — only its compatibility with the upstream API.
 */
async function sha1Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-1', enc)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

/**
 * Returns the breach count from the Pwned Passwords k-anonymity API.
 * Only the first 5 hex chars of the SHA-1 are sent over the wire; the
 * suffix is matched locally.
 *
 * Returns 0 if the password is not in any known breach.
 * Returns a positive integer = number of times the password has been seen.
 *
 * Network failures throw — the caller decides whether to fail open or closed.
 * For signup: fail open (allow the signup to proceed) with a logged warning.
 * The local rules from checkPasswordRules() still apply.
 */
export async function getPwnedBreachCount(password: string): Promise<number> {
  const hash = await sha1Hex(password)
  const prefix = hash.slice(0, 5)
  const suffix = hash.slice(5)

  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true' },
  })
  if (!res.ok) {
    throw new Error(`pwned-passwords API returned ${res.status}`)
  }

  const text = await res.text()
  // Each line is `<35-char hex suffix>:<count>`
  for (const line of text.split('\n')) {
    const sep = line.indexOf(':')
    if (sep < 0) continue
    const lineSuffix = line.slice(0, sep).trim().toUpperCase()
    if (lineSuffix === suffix) {
      const count = parseInt(line.slice(sep + 1).trim(), 10)
      return Number.isFinite(count) ? count : 0
    }
  }
  return 0
}

/**
 * Combined check: local rules + breach count threshold.
 * Network failure on the breach check resolves to ok=true (fail open) so
 * a Have-I-Been-Pwned outage doesn't take signup offline. The reason is
 * logged at the call site.
 */
export async function checkPasswordSafe(password: string): Promise<PasswordRuleResult> {
  const local = checkPasswordRules(password)
  if (!local.ok) return local

  try {
    const breachCount = await getPwnedBreachCount(password)
    if (breachCount > PWNED_THRESHOLD) {
      return {
        ok: false,
        reason: `This password has been seen in ${breachCount.toLocaleString()} known data breaches. Please choose a different one.`,
      }
    }
    return { ok: true }
  } catch (err) {
    // Fail open. Local rules still passed, so the password meets our
    // explicit policy — we just couldn't verify against breaches this time.
    if (typeof console !== 'undefined') {
      console.warn('[passwordChecks] pwned-passwords check failed; allowing:', err)
    }
    return { ok: true }
  }
}

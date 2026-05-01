// ── sso — pure helpers ─────────────────────────────────────────────────────
// SAML/OIDC normalization. The actual signature verification lives in the
// edge function (it needs Deno's crypto with X.509 support). This file
// covers what's safely testable in pure JS:
//   • Attribute extraction from a parsed assertion / claim object
//   • Group → role mapping
//   • Test-mode + provisioning policy decisions
//   • IdP metadata field validation (URL shape, cert PEM detection)

export type SsoOutcome =
  | 'success'
  | 'blocked_no_email'
  | 'blocked_no_org'
  | 'blocked_test_mode'
  | 'blocked_default_role'
  | 'provisioned'

export interface AttributeMapping {
  email: string
  first_name?: string
  last_name?: string
  groups?: string
}

export interface GroupRoleMapping {
  /** "GC-PMs" → "pm". Lowercased on lookup. */
  [groupName: string]: string
}

export interface AssertionLike {
  /** Free-form attribute bag (parsed from SAML or OIDC). */
  attributes: Record<string, unknown>
  /** Issuer string. We pass through; the edge fn already validated it. */
  issuer?: string
}

export interface SsoConfig {
  attribute_mapping: AttributeMapping
  group_role_mapping: GroupRoleMapping
  default_role: string | null
  allow_jit_provision: boolean
  test_mode_enabled: boolean
  test_user_emails: ReadonlyArray<string>
}

export interface ResolvedUser {
  email: string
  first_name?: string
  last_name?: string
  groups: ReadonlyArray<string>
}

/** Strip surrounding whitespace + lowercase — for case-insensitive
 *  email + group lookups. */
const norm = (s: string) => s.trim().toLowerCase()

/** Read a single string value from the attribute bag at the specified
 *  key. Handles both string and array (SAML often returns arrays). */
function readString(bag: Record<string, unknown>, key: string): string | undefined {
  const v = bag[key] ?? bag[key.toLowerCase()] ?? bag[key.toUpperCase()]
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : undefined
  return typeof v === 'string' ? v : undefined
}

/** Read an array of strings (groups). */
function readStrings(bag: Record<string, unknown>, key: string): ReadonlyArray<string> {
  const v = bag[key] ?? bag[key.toLowerCase()] ?? bag[key.toUpperCase()]
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  if (typeof v === 'string') return [v]
  return []
}

/** Pull the user fields out of a SAML/OIDC assertion using the configured
 *  attribute mapping. Returns null when the email field is missing. */
export function extractUser(
  assertion: AssertionLike,
  mapping: AttributeMapping,
): ResolvedUser | null {
  const email = readString(assertion.attributes, mapping.email)
  if (!email) return null
  const first_name = mapping.first_name ? readString(assertion.attributes, mapping.first_name) : undefined
  const last_name  = mapping.last_name  ? readString(assertion.attributes, mapping.last_name)  : undefined
  const groups = mapping.groups ? readStrings(assertion.attributes, mapping.groups) : []
  return { email: norm(email), first_name, last_name, groups }
}

/** Map IdP groups → SiteSync role using the configured mapping. Returns
 *  the first group that matches, falling back to default_role. */
export function resolveRole(
  groups: ReadonlyArray<string>,
  groupRoleMapping: GroupRoleMapping,
  defaultRole: string | null,
): string | null {
  const lookup: Record<string, string> = {}
  for (const [name, role] of Object.entries(groupRoleMapping)) {
    lookup[norm(name)] = role
  }
  for (const g of groups) {
    const match = lookup[norm(g)]
    if (match) return match
  }
  return defaultRole
}

export interface DecisionInput {
  config: SsoConfig
  user: ResolvedUser | null
  /** True when an account with this email already exists in the org. */
  existingUserInOrg: boolean
}

export interface Decision {
  outcome: SsoOutcome
  /** Resolved role (when applicable). */
  role: string | null
  reason: string
}

/** Apply policy: test-mode gating, JIT provisioning, default-role rules.
 *  Returns the outcome the SSO handler should record + the role to
 *  assign when allowed. */
export function decideAccess(input: DecisionInput): Decision {
  const { config, user, existingUserInOrg } = input
  if (!user) return { outcome: 'blocked_no_email', role: null, reason: 'IdP returned no email claim.' }

  if (config.test_mode_enabled) {
    const allowed = new Set(config.test_user_emails.map(norm))
    if (!allowed.has(norm(user.email))) {
      return {
        outcome: 'blocked_test_mode',
        role: null,
        reason: `Test mode is enabled; ${user.email} is not in the test_user_emails allow-list.`,
      }
    }
  }

  const role = resolveRole(user.groups, config.group_role_mapping, config.default_role)
  if (!existingUserInOrg && !config.allow_jit_provision) {
    return {
      outcome: 'blocked_no_org',
      role: null,
      reason:
        'JIT provisioning is disabled and the user is not yet a member of this organization.',
    }
  }
  if (!existingUserInOrg && !role) {
    return {
      outcome: 'blocked_default_role',
      role: null,
      reason:
        'No group matched the configured mapping and no default_role is set; refusing to provision a role-less user.',
    }
  }
  return {
    outcome: existingUserInOrg ? 'success' : 'provisioned',
    role,
    reason: existingUserInOrg
      ? 'Existing user signed in via SSO.'
      : `New user provisioned via JIT with role ${role}.`,
  }
}

// ── IdP metadata validation ───────────────────────────────────────────

/** Minimal sanity check of a SAML SSO URL. We don't fetch it — we just
 *  surface "this looks wrong" to the admin before they save. */
export function validateSsoUrl(url: string): { ok: true } | { ok: false; reason: string } {
  if (!url) return { ok: false, reason: 'URL is required.' }
  if (!/^https:\/\//i.test(url)) return { ok: false, reason: 'URL must use HTTPS.' }
  try {
    const u = new URL(url)
    if (!u.host) return { ok: false, reason: 'URL has no hostname.' }
  } catch {
    return { ok: false, reason: 'URL is not parseable.' }
  }
  return { ok: true }
}

/** Detect whether a string contains at least one PEM certificate block. */
export function looksLikeX509Pem(text: string): boolean {
  return /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/m.test(text)
}

/** Count PEM cert blocks — helps the admin verify they pasted the right
 *  number of certs during a rotation. */
export function countX509Pems(text: string): number {
  const matches = text.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)
  return matches?.length ?? 0
}

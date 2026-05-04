import { describe, it, expect } from 'vitest';
import {
  extractUser,
  resolveRole,
  decideAccess,
  validateSsoUrl,
  looksLikeX509Pem,
  countX509Pems,
  type SsoConfig,
} from '../index';

const cfg: SsoConfig = {
  attribute_mapping: { email: 'EMAIL', first_name: 'FIRST', last_name: 'LAST', groups: 'MEMBEROF' },
  group_role_mapping: { 'gc-pms': 'pm', 'gc-owners': 'owner' },
  default_role: 'viewer',
  allow_jit_provision: true,
  test_mode_enabled: false,
  test_user_emails: [],
};

describe('extractUser', () => {
  it('reads attributes mapped to mapping keys', () => {
    const u = extractUser(
      { attributes: { EMAIL: 'a@b.co', FIRST: 'A', LAST: 'B', MEMBEROF: ['gc-pms'] } },
      cfg.attribute_mapping,
    );
    expect(u).toEqual({ email: 'a@b.co', first_name: 'A', last_name: 'B', groups: ['gc-pms'] });
  });
  it('handles single-string group claims', () => {
    const u = extractUser(
      { attributes: { EMAIL: 'a@b.co', MEMBEROF: 'gc-pms' } },
      cfg.attribute_mapping,
    );
    expect(u?.groups).toEqual(['gc-pms']);
  });
  it('returns null when email is missing', () => {
    expect(extractUser({ attributes: {} }, cfg.attribute_mapping)).toBeNull();
  });
  it('lowercases the resolved email', () => {
    const u = extractUser(
      { attributes: { EMAIL: 'JANE@EXAMPLE.COM' } },
      cfg.attribute_mapping,
    );
    expect(u?.email).toBe('jane@example.com');
  });
});

describe('resolveRole', () => {
  it('returns the first matching group role', () => {
    expect(resolveRole(['random', 'gc-pms', 'gc-owners'], cfg.group_role_mapping, 'viewer')).toBe('pm');
  });
  it('falls back to default when no group matches', () => {
    expect(resolveRole(['random'], cfg.group_role_mapping, 'viewer')).toBe('viewer');
  });
  it('returns null when no group matches and default is null', () => {
    expect(resolveRole(['random'], cfg.group_role_mapping, null)).toBeNull();
  });
  it('case-insensitive group match', () => {
    expect(resolveRole(['GC-PMs'], cfg.group_role_mapping, null)).toBe('pm');
  });
});

describe('decideAccess', () => {
  it('blocks when no email claim', () => {
    const d = decideAccess({ config: cfg, user: null, existingUserInOrg: false });
    expect(d.outcome).toBe('blocked_no_email');
  });
  it('lets existing users through', () => {
    const u = { email: 'a@b.co', groups: ['gc-pms'] as ReadonlyArray<string> };
    const d = decideAccess({ config: cfg, user: u, existingUserInOrg: true });
    expect(d.outcome).toBe('success');
    expect(d.role).toBe('pm');
  });
  it('JIT provisions a new user with a mapped role', () => {
    const u = { email: 'a@b.co', groups: ['gc-pms'] as ReadonlyArray<string> };
    const d = decideAccess({ config: cfg, user: u, existingUserInOrg: false });
    expect(d.outcome).toBe('provisioned');
    expect(d.role).toBe('pm');
  });
  it('falls back to default_role when no group matches', () => {
    const u = { email: 'a@b.co', groups: [] as ReadonlyArray<string> };
    const d = decideAccess({ config: cfg, user: u, existingUserInOrg: false });
    expect(d.outcome).toBe('provisioned');
    expect(d.role).toBe('viewer');
  });
  it('blocks new user when JIT disabled', () => {
    const u = { email: 'a@b.co', groups: ['gc-pms'] as ReadonlyArray<string> };
    const d = decideAccess(
      { config: { ...cfg, allow_jit_provision: false }, user: u, existingUserInOrg: false },
    );
    expect(d.outcome).toBe('blocked_no_org');
  });
  it('blocks new user when no group matches and default_role is null', () => {
    const u = { email: 'a@b.co', groups: [] as ReadonlyArray<string> };
    const d = decideAccess(
      { config: { ...cfg, default_role: null }, user: u, existingUserInOrg: false },
    );
    expect(d.outcome).toBe('blocked_default_role');
  });
  it('respects test mode allow-list', () => {
    const u = { email: 'walker@example.com', groups: ['gc-pms'] as ReadonlyArray<string> };
    const denied = decideAccess({
      config: { ...cfg, test_mode_enabled: true, test_user_emails: ['someone-else@example.com'] },
      user: u, existingUserInOrg: true,
    });
    expect(denied.outcome).toBe('blocked_test_mode');
    const allowed = decideAccess({
      config: { ...cfg, test_mode_enabled: true, test_user_emails: ['walker@example.com'] },
      user: u, existingUserInOrg: true,
    });
    expect(allowed.outcome).toBe('success');
  });
});

describe('validateSsoUrl', () => {
  it('requires HTTPS', () => {
    expect(validateSsoUrl('http://idp.example.com').ok).toBe(false);
  });
  it('rejects non-URLs', () => {
    expect(validateSsoUrl('').ok).toBe(false);
    expect(validateSsoUrl('not a url').ok).toBe(false);
  });
  it('accepts a valid HTTPS URL', () => {
    expect(validateSsoUrl('https://idp.example.com/saml/sso').ok).toBe(true);
  });
});

describe('cert PEM helpers', () => {
  const onePem = `-----BEGIN CERTIFICATE-----\nMIIabc\n-----END CERTIFICATE-----`;
  it('detects a PEM block', () => {
    expect(looksLikeX509Pem(onePem)).toBe(true);
    expect(looksLikeX509Pem('not a pem')).toBe(false);
  });
  it('counts multiple PEMs (rotation overlap)', () => {
    expect(countX509Pems(onePem + '\n' + onePem)).toBe(2);
    expect(countX509Pems(onePem)).toBe(1);
    expect(countX509Pems('')).toBe(0);
  });
});

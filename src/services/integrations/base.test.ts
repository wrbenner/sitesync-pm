import { describe, it, expect } from 'vitest'
import { INTEGRATION_REGISTRY, type IntegrationMeta } from './base'

// INTEGRATION_REGISTRY is the source-of-truth catalog of every external
// integration. Every entry surfaces as a card in the Integrations page,
// and a regression here would mis-render or break the OAuth/credential
// onboarding flow.

describe('INTEGRATION_REGISTRY — shape invariants', () => {
  it('exposes the documented set of integrations', () => {
    expect(Object.keys(INTEGRATION_REGISTRY).sort()).toEqual(
      [
        'autodesk_bim360',
        'bluebeam',
        'docusign',
        'dropbox',
        'email_resend',
        'google_drive',
        'ms_project',
        'primavera_p6',
        'procore_import',
        'quickbooks',
        'sage',
        'sharepoint',
        'slack',
        'teams',
        'zapier_webhook',
      ].sort(),
    )
  })

  it('every entry has all required IntegrationMeta fields', () => {
    for (const [key, meta] of Object.entries(INTEGRATION_REGISTRY)) {
      const m: IntegrationMeta = meta
      expect(m.name).toBeTruthy()
      expect(m.description).toBeTruthy()
      expect(m.category).toBeTruthy()
      expect(Array.isArray(m.capabilities)).toBe(true)
      expect(m.capabilities.length).toBeGreaterThan(0)
      expect(['oauth2', 'api_key', 'credentials', 'none']).toContain(m.authType)
      expect(Array.isArray(m.fields)).toBe(true)
      // Sanity: at least flag any entry whose key obviously diverged.
      expect(typeof key).toBe('string')
    }
  })

  it('every category falls in the documented set', () => {
    const valid = ['accounting', 'scheduling', 'documents', 'communication', 'storage', 'automation']
    for (const meta of Object.values(INTEGRATION_REGISTRY)) {
      expect(valid).toContain(meta.category)
    }
  })

  it('every field has key + label + type', () => {
    for (const meta of Object.values(INTEGRATION_REGISTRY)) {
      for (const field of meta.fields) {
        expect(field.key).toBeTruthy()
        expect(field.label).toBeTruthy()
        expect(['text', 'password', 'url']).toContain(field.type)
        expect(typeof field.required).toBe('boolean')
      }
    }
  })

  it('every required-credential field for an api_key auth integration includes apiKey', () => {
    const apiKeyIntegrations = Object.entries(INTEGRATION_REGISTRY).filter(
      ([, m]) => m.authType === 'api_key',
    )
    for (const [key, meta] of apiKeyIntegrations) {
      const hasApiKey = meta.fields.some((f) => /api[\s_-]?key/i.test(f.key) && f.required)
      // bluebeam uses 'apiKey'; procore_import uses 'apiKey'; email_resend uses 'apiKey'.
      // If a future integration is added without an apiKey field, this assertion
      // will fail and force the contributor to review it.
      expect(hasApiKey, `${key} has authType=api_key but no required apiKey field`).toBe(true)
    }
  })

  it('oauth2 integrations either skip credential fields entirely or declare clientId/clientSecret', () => {
    // Browser-driven OAuth (google_drive, dropbox) — no fields
    // Optional-config OAuth (sharepoint) — only optional non-credential fields
    // Self-managed OAuth (autodesk_bim360, docusign, quickbooks) — clientId+clientSecret required
    const oauthIntegrations = Object.entries(INTEGRATION_REGISTRY).filter(
      ([, m]) => m.authType === 'oauth2',
    )
    for (const [key, meta] of oauthIntegrations) {
      const hasRequiredCreds = meta.fields
        .filter((f) => f.required)
        .some((f) => /client.?id/i.test(f.key) || /client.?secret/i.test(f.key))
      const hasNoRequiredFields = meta.fields.every((f) => !f.required)
      expect(
        hasRequiredCreds || hasNoRequiredFields,
        `${key} oauth2 has required fields but none are clientId/clientSecret`,
      ).toBe(true)
    }
  })

  it('communication integrations have notification capabilities', () => {
    const comms = Object.entries(INTEGRATION_REGISTRY).filter(
      ([, m]) => m.category === 'communication',
    )
    for (const [key, meta] of comms) {
      const hasNotif = meta.capabilities.some((c) => /email|notification|notifications/.test(c))
      expect(hasNotif, `${key} is communication but has no email/notification capability`).toBe(true)
    }
  })

  it('procore_import declares the documented capabilities', () => {
    const m = INTEGRATION_REGISTRY.procore_import
    expect(m.name).toBe('Procore')
    expect(m.capabilities).toEqual(
      expect.arrayContaining(['project_import', 'rfi_import', 'submittal_import']),
    )
    expect(m.fields.find((f) => f.key === 'apiKey')?.required).toBe(true)
    expect(m.fields.find((f) => f.key === 'companyId')?.required).toBe(true)
  })

  it('sage declares serverUrl + username + password as required', () => {
    const m = INTEGRATION_REGISTRY.sage
    expect(m.name).toBe('Sage 300 CRE')
    expect(m.authType).toBe('credentials')
    const required = m.fields.filter((f) => f.required).map((f) => f.key)
    expect(required.sort()).toEqual(['password', 'serverUrl', 'username'])
  })

  it('every integration name is unique', () => {
    const names = Object.values(INTEGRATION_REGISTRY).map((m) => m.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('zapier_webhook is in the automation category', () => {
    expect(INTEGRATION_REGISTRY.zapier_webhook.category).toBe('automation')
  })
})

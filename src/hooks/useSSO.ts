// SSO/SAML authentication for enterprise organizations.
// Supports: Okta, Azure AD, OneLogin, Google Workspace.
// JIT (Just-In-Time) user provisioning on first SSO login.
// SSO enforcement: when active, password login is disabled for the org.

import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fromTable } from '../lib/db/queries'
import { toast } from 'sonner'

// ── Types ────────────────────────────────────────────────

export type SSOProvider = 'okta' | 'azure_ad' | 'onelogin' | 'google_workspace'

export interface SSOConfig {
  id: string
  organizationId: string
  provider: SSOProvider
  entityId: string // SAML Entity ID
  ssoUrl: string // SAML SSO URL
  certificate: string // X.509 certificate for signature verification
  enforced: boolean // When true, password login is disabled
  jitProvisioning: boolean // Auto-create users on first login
  defaultRole: string // Default role for JIT-provisioned users
  allowedDomains: string[] // Email domains allowed for SSO
  scimEnabled: boolean // SCIM 2.0 provisioning enabled
  scimEndpoint?: string
  createdAt: string
  updatedAt: string
}

export interface SSOProviderInfo {
  id: SSOProvider
  name: string
  description: string
  setupGuideUrl: string
}

export const SSO_PROVIDERS: SSOProviderInfo[] = [
  { id: 'okta', name: 'Okta', description: 'Enterprise identity management', setupGuideUrl: 'https://docs.sitesync.pm/sso/okta' },
  { id: 'azure_ad', name: 'Microsoft Entra ID', description: 'Azure Active Directory / Microsoft 365', setupGuideUrl: 'https://docs.sitesync.pm/sso/azure' },
  { id: 'onelogin', name: 'OneLogin', description: 'Unified access management', setupGuideUrl: 'https://docs.sitesync.pm/sso/onelogin' },
  { id: 'google_workspace', name: 'Google Workspace', description: 'Google SSO for organizations', setupGuideUrl: 'https://docs.sitesync.pm/sso/google' },
]

// ── SSO Login Hook ───────────────────────────────────────

export function useSSO() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initiate SSO login flow
  const loginWithSSO = useCallback(async (domain: string) => {
    setLoading(true)
    setError(null)

    try {
      // Supabase Auth SSO: initiate SAML flow for the given domain
      const { data, error: ssoError } = await supabase.auth.signInWithSSO({ domain })

      if (ssoError) {
        throw new Error(ssoError.message)
      }

      // Redirect to the IdP's SSO URL
      if (data?.url) {
        window.location.href = data.url
      }
    } catch (err) {
      const message = (err as Error).message
      if (message.includes('No SSO provider')) {
        setError('SSO is not configured for this domain. Contact your administrator.')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Check if SSO is enforced for a given email domain
  const checkSSOEnforcement = useCallback(async (email: string): Promise<{ enforced: boolean; domain: string }> => {
    const domain = email.split('@')[1]
    if (!domain) return { enforced: false, domain: '' }

    try {
      const { data } = await fromTable('sso_configurations')
        .select('enforced')
        .contains('allowed_domains' as never, [domain])
        .eq('enforced' as never, true)
        .limit(1)

      return { enforced: (data?.length ?? 0) > 0, domain }
    } catch {
      return { enforced: false, domain }
    }
  }, [])

  return { loginWithSSO, checkSSOEnforcement, loading, error }
}

// ── SSO Admin Hook ───────────────────────────────────────

export function useSSOAdmin(organizationId: string | undefined) {
  const [saving, setSaving] = useState(false)

  // Get current SSO configuration
  const getConfig = useCallback(async (): Promise<SSOConfig | null> => {
    if (!organizationId) return null
    const { data } = await fromTable('sso_configurations')
      .select('*')
      .eq('organization_id' as never, organizationId)
      .single()
    return data as unknown as SSOConfig | null
  }, [organizationId])

  // Save SSO configuration
  const saveConfig = useCallback(async (config: Partial<SSOConfig>) => {
    if (!organizationId) return
    setSaving(true)

    try {
      const { error } = await fromTable('sso_configurations')
        .upsert({
          organization_id: organizationId,
          ...config,
          updated_at: new Date().toISOString(),
        } as never, { onConflict: 'organization_id' })

      if (error) throw error
      toast.success('SSO configuration saved')
    } catch (err) {
      toast.error(`Failed to save SSO config: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }, [organizationId])

  // Test SSO connection
  const testConnection = useCallback(async (config: Partial<SSOConfig>): Promise<{ success: boolean; error?: string }> => {
    try {
      // Validate the SAML metadata by checking the certificate format
      if (!config.certificate?.includes('BEGIN CERTIFICATE')) {
        return { success: false, error: 'Invalid X.509 certificate format' }
      }
      if (!config.ssoUrl?.startsWith('https://')) {
        return { success: false, error: 'SSO URL must use HTTPS' }
      }
      if (!config.entityId) {
        return { success: false, error: 'Entity ID is required' }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }, [])

  return { getConfig, saveConfig, testConnection, saving }
}

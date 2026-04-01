import { supabase, transformSupabaseError } from '../client'
import type {
  WebhookEndpoint,
  WebhookEndpointInsert,
  WebhookEndpointUpdate,
  WebhookDelivery,
  ApiKey,
  ApiKeyInsert,
  ApiKeyCreated,
} from '../../types/webhooks'

// ── Webhook Endpoints ──────────────────────────────────────────────────────

export async function getWebhookEndpoints(organizationId: string): Promise<WebhookEndpoint[]> {
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) throw transformSupabaseError(error)
  return data as WebhookEndpoint[]
}

export async function getWebhookEndpointById(id: string): Promise<WebhookEndpoint> {
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw transformSupabaseError(error)
  return data as WebhookEndpoint
}

export async function createWebhookEndpoint(
  input: WebhookEndpointInsert,
): Promise<WebhookEndpoint> {
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .insert(input)
    .select()
    .single()

  if (error) throw transformSupabaseError(error)
  return data as WebhookEndpoint
}

export async function updateWebhookEndpoint(
  id: string,
  input: WebhookEndpointUpdate,
): Promise<WebhookEndpoint> {
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw transformSupabaseError(error)
  return data as WebhookEndpoint
}

export async function deleteWebhookEndpoint(id: string): Promise<void> {
  const { error } = await supabase
    .from('webhook_endpoints')
    .delete()
    .eq('id', id)

  if (error) throw transformSupabaseError(error)
}

// ── Webhook Deliveries ─────────────────────────────────────────────────────

export async function getDeliveriesForEndpoint(
  endpointId: string,
  limit = 50,
): Promise<WebhookDelivery[]> {
  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select('*')
    .eq('endpoint_id', endpointId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw transformSupabaseError(error)
  return data as WebhookDelivery[]
}

export async function getFailedDeliveries(organizationId: string): Promise<WebhookDelivery[]> {
  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select('*, webhook_endpoints!inner(organization_id)')
    .eq('webhook_endpoints.organization_id', organizationId)
    .in('status', ['failed', 'retrying'])
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw transformSupabaseError(error)
  return data as WebhookDelivery[]
}

// ── API Keys ───────────────────────────────────────────────────────────────

export async function getApiKeys(organizationId: string): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, organization_id, name, prefix, scopes, last_used_at, expires_at, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) throw transformSupabaseError(error)
  return data as ApiKey[]
}

// Creates a new API key. The raw key is returned once and never stored.
export async function createApiKey(input: ApiKeyInsert): Promise<ApiKeyCreated> {
  const rawKey = generateApiKey()
  const prefix = rawKey.slice(0, 16) // sk_live_XXXXXXXX
  const keyHash = await hashApiKey(rawKey)

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      organization_id: input.organization_id,
      name: input.name,
      key_hash: keyHash,
      prefix,
      scopes: input.scopes,
      expires_at: input.expires_at ?? null,
    })
    .select('id, organization_id, name, prefix, scopes, last_used_at, expires_at, created_at')
    .single()

  if (error) throw transformSupabaseError(error)

  return { ...(data as ApiKey), raw_key: rawKey }
}

export async function deleteApiKey(id: string): Promise<void> {
  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', id)

  if (error) throw transformSupabaseError(error)
}

// ── Helpers ────────────────────────────────────────────────────────────────

function generateApiKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `sk_live_${hex}`
}

// SHA-256 hash of the raw key — lightweight alternative to bcrypt in the browser.
// A server-side Edge Function should use bcrypt for production hardening.
async function hashApiKey(rawKey: string): Promise<string> {
  const data = new TextEncoder().encode(rawKey)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

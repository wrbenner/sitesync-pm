import { transformSupabaseError } from '../client'
import { fromTable } from '../../lib/db/queries'
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
  const { data, error } = await fromTable('webhook_endpoints')
    .select('*')
    .eq('organization_id' as never, organizationId)
    .order('created_at', { ascending: false })

  if (error) throw transformSupabaseError(error)
  return data as unknown as WebhookEndpoint[]
}

export async function getWebhookEndpointById(id: string): Promise<WebhookEndpoint> {
  const { data, error } = await fromTable('webhook_endpoints')
    .select('*')
    .eq('id' as never, id)
    .single()

  if (error) throw transformSupabaseError(error)
  return data as unknown as WebhookEndpoint
}

export async function createWebhookEndpoint(
  input: WebhookEndpointInsert,
): Promise<WebhookEndpoint> {
  const { data, error } = await fromTable('webhook_endpoints')
    .insert(input as never)
    .select()
    .single()

  if (error) throw transformSupabaseError(error)
  return data as unknown as WebhookEndpoint
}

export async function updateWebhookEndpoint(
  id: string,
  input: WebhookEndpointUpdate,
): Promise<WebhookEndpoint> {
  const { data, error } = await fromTable('webhook_endpoints')
    .update(input as never)
    .eq('id' as never, id)
    .select()
    .single()

  if (error) throw transformSupabaseError(error)
  return data as unknown as WebhookEndpoint
}

export async function deleteWebhookEndpoint(id: string): Promise<void> {
  const { error } = await fromTable('webhook_endpoints')
    .delete()
    .eq('id' as never, id)

  if (error) throw transformSupabaseError(error)
}

// ── Webhook Deliveries ─────────────────────────────────────────────────────

export async function getDeliveriesForEndpoint(
  endpointId: string,
  limit = 50,
): Promise<WebhookDelivery[]> {
  const { data, error } = await fromTable('webhook_deliveries')
    .select('*')
    .eq('endpoint_id' as never, endpointId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw transformSupabaseError(error)
  return data as unknown as WebhookDelivery[]
}

export async function getFailedDeliveries(organizationId: string): Promise<WebhookDelivery[]> {
  const { data, error } = await fromTable('webhook_deliveries')
    .select('*, webhook_endpoints!inner(organization_id)')
    .eq('webhook_endpoints.organization_id' as never, organizationId)
    .in('status' as never, ['failed', 'retrying'])
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw transformSupabaseError(error)
  return data as unknown as WebhookDelivery[]
}

// ── API Keys ───────────────────────────────────────────────────────────────

export async function getApiKeys(organizationId: string): Promise<ApiKey[]> {
  const { data, error } = await fromTable('api_keys')
    .select('id, organization_id, name, prefix, scopes, last_used_at, expires_at, created_at')
    .eq('organization_id' as never, organizationId)
    .order('created_at', { ascending: false })

  if (error) throw transformSupabaseError(error)
  return data as unknown as ApiKey[]
}

// Creates a new API key. The raw key is returned once and never stored.
export async function createApiKey(input: ApiKeyInsert): Promise<ApiKeyCreated> {
  const rawKey = generateApiKey()
  const prefix = rawKey.slice(0, 16) // sk_live_XXXXXXXX
  const keyHash = await hashApiKey(rawKey)

  const { data, error } = await fromTable('api_keys')
    .insert({
      organization_id: input.organization_id,
      name: input.name,
      key_hash: keyHash,
      prefix,
      scopes: input.scopes,
      expires_at: input.expires_at ?? null,
    } as never)
    .select('id, organization_id, name, prefix, scopes, last_used_at, expires_at, created_at')
    .single()

  if (error) throw transformSupabaseError(error)

  return { ...(data as unknown as ApiKey), raw_key: rawKey }
}

export async function deleteApiKey(id: string): Promise<void> {
  const { error } = await fromTable('api_keys')
    .delete()
    .eq('id' as never, id)

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

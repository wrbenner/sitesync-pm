export type WebhookEvent =
  | 'rfi.created' | 'rfi.updated' | 'rfi.closed'
  | 'submittal.created' | 'submittal.approved' | 'submittal.rejected'
  | 'change_order.created' | 'change_order.approved' | 'change_order.rejected'
  | 'daily_log.submitted'
  | 'punch_item.created' | 'punch_item.completed'
  | 'pay_app.submitted' | 'pay_app.approved'
  | 'safety.incident_reported'
  | 'schedule.milestone_completed' | 'schedule.delay_detected'

export interface WebhookEndpoint {
  id: string
  organization_id: string
  url: string
  secret: string
  events: WebhookEvent[]
  active: boolean
  description: string | null
  created_at: string
  updated_at: string
}

export interface WebhookEndpointInsert {
  organization_id: string
  url: string
  secret: string
  events: WebhookEvent[]
  active?: boolean
  description?: string | null
}

export interface WebhookEndpointUpdate {
  url?: string
  events?: WebhookEvent[]
  active?: boolean
  description?: string | null
}

export interface WebhookDelivery {
  id: string
  endpoint_id: string
  event: WebhookEvent
  payload: WebhookPayload
  response_status: number | null
  response_body: string | null
  delivered_at: string | null
  attempts: number
  next_retry_at: string | null
  status: 'pending' | 'delivered' | 'failed' | 'retrying'
  created_at: string
}

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  project_id: string
  data: Record<string, unknown>
}

export interface ApiKey {
  id: string
  organization_id: string
  name: string
  key_hash: string
  prefix: string
  scopes: ApiKeyScope[]
  last_used_at: string | null
  expires_at: string | null
  created_at: string
}

export interface ApiKeyInsert {
  organization_id: string
  name: string
  scopes: ApiKeyScope[]
  expires_at?: string | null
}

// Returned once on creation — the raw key is never stored
export interface ApiKeyCreated extends Omit<ApiKey, 'key_hash'> {
  raw_key: string
}

export type ApiKeyScope =
  | 'rfis:read' | 'rfis:write'
  | 'submittals:read' | 'submittals:write'
  | 'budget:read' | 'budget:write'
  | 'schedule:read' | 'schedule:write'
  | 'documents:read' | 'documents:write'
  | 'webhooks:read' | 'webhooks:write'
  | 'projects:read' | 'projects:write'

import { supabase } from './supabase'

interface AuditEntry {
  projectId: string
  entityType: string
  entityId: string
  action: 'create' | 'update' | 'delete' | 'status_change' | 'approve' | 'reject' | 'submit' | 'submit_with_override' | 'close'
  beforeState?: Record<string, unknown>
  afterState?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

function diffFields(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined
): string[] {
  if (!before || !after) return []
  const changed: string[] = []
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of allKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.push(key)
    }
  }
  return changed
}

export async function logAuditEntry(entry: AuditEntry): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('audit_log').insert({
    project_id: entry.projectId,
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
    user_name: (user?.user_metadata?.['full_name'] as string | undefined) ?? user?.email ?? null,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    action: entry.action,
    before_state: entry.beforeState ?? null,
    after_state: entry.afterState ?? null,
    changed_fields: diffFields(entry.beforeState, entry.afterState),
    metadata: {
      ...entry.metadata,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    },
  })

  if (error) {
    // Never block the user's action due to audit logging failures
    if (import.meta.env.DEV) console.error('Failed to write audit log:', error)
  }
}

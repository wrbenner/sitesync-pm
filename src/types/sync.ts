export interface SyncOperation {
  id: string
  table: string
  operation: 'insert' | 'update' | 'delete'
  record_id: string
  project_id: string
  payload: Record<string, unknown>
  local_updated_at: string
  server_updated_at?: string
  status: 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed'
  retry_count: number
  created_at: string
}

export interface ConflictRecord {
  id: string
  table: string
  record_id: string
  local_version: Record<string, unknown>
  server_version: Record<string, unknown>
  base_version: Record<string, unknown> // version when user went offline
  conflicting_fields: string[]
  resolved: boolean
  resolution: 'local' | 'server' | 'merged' | null
  merged_version?: Record<string, unknown>
}

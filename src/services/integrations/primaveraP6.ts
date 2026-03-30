// Primavera P6 Integration: XER file import/export
// Parses Oracle Primavera P6 .xer files (tab-delimited format) into schedule data.

import { supabase } from '../../lib/supabase'
import {
  type IntegrationProvider,
  type SyncResult,
  type IntegrationStatus,
  logSyncResult,
  updateIntegrationStatus,
  createIntegrationRecord,
} from './base'

// ── XER Parser ──────────────────────────────────────────
// XER files use a tab-delimited format with %T (table), %F (fields), %R (rows)

interface XERTable {
  name: string
  fields: string[]
  rows: Record<string, string>[]
}

function parseXER(content: string): Map<string, XERTable> {
  const tables = new Map<string, XERTable>()
  let currentTable: XERTable | null = null

  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/\r$/, '')

    if (line.startsWith('%T')) {
      // Table definition
      const tableName = line.substring(3).trim()
      currentTable = { name: tableName, fields: [], rows: [] }
      tables.set(tableName, currentTable)
    } else if (line.startsWith('%F') && currentTable) {
      // Field names
      currentTable.fields = line.substring(3).split('\t')
    } else if (line.startsWith('%R') && currentTable) {
      // Data row
      const values = line.substring(3).split('\t')
      const row: Record<string, string> = {}
      currentTable.fields.forEach((field, i) => {
        row[field] = values[i] ?? ''
      })
      currentTable.rows.push(row)
    }
    // %E = end of file, skip
  }

  return tables
}

// ── P6 Activity Extraction ──────────────────────────────

interface P6Activity {
  activityId: string
  activityName: string
  wbsId: string
  startDate: string | null
  finishDate: string | null
  percentComplete: number
  status: string
  calendarId: string
  durationOriginal: number
  durationRemaining: number
}

interface P6WBS {
  wbsId: string
  parentWbsId: string
  wbsName: string
  wbsPath: string
}

interface P6Relationship {
  predecessorId: string
  successorId: string
  type: string // FS, FF, SS, SF
  lag: number
}

function extractActivities(tables: Map<string, XERTable>): P6Activity[] {
  const taskTable = tables.get('TASK')
  if (!taskTable) return []

  return taskTable.rows.map((row) => {
    const pctField = row['phys_complete_pct'] || row['complete_pct'] || '0'
    const pct = parseFloat(pctField) || 0

    // Map P6 status codes
    const statusCode = row['status_code'] ?? ''
    let status = 'not_started'
    if (statusCode === 'TK_Complete') status = 'complete'
    else if (statusCode === 'TK_Active') status = 'in_progress'
    else if (statusCode === 'TK_NotStart') status = 'not_started'

    return {
      activityId: row['task_id'] ?? '',
      activityName: row['task_name'] ?? row['task_code'] ?? '',
      wbsId: row['wbs_id'] ?? '',
      startDate: row['act_start_date'] || row['early_start_date'] || null,
      finishDate: row['act_end_date'] || row['early_end_date'] || null,
      percentComplete: pct,
      status,
      calendarId: row['clndr_id'] ?? '',
      durationOriginal: parseFloat(row['target_drtn_hr_cnt'] ?? '0') / 8,
      durationRemaining: parseFloat(row['remain_drtn_hr_cnt'] ?? '0') / 8,
    }
  })
}

function extractWBS(tables: Map<string, XERTable>): P6WBS[] {
  const wbsTable = tables.get('PROJWBS')
  if (!wbsTable) return []

  return wbsTable.rows.map((row) => ({
    wbsId: row['wbs_id'] ?? '',
    parentWbsId: row['parent_wbs_id'] ?? '',
    wbsName: row['wbs_name'] ?? '',
    wbsPath: row['wbs_short_name'] ?? '',
  }))
}

function extractRelationships(tables: Map<string, XERTable>): P6Relationship[] {
  const relTable = tables.get('TASKPRED')
  if (!relTable) return []

  return relTable.rows.map((row) => {
    const typeCode = row['pred_type'] ?? 'PR_FS'
    const typeMap: Record<string, string> = {
      PR_FS: 'FS', PR_FF: 'FF', PR_SS: 'SS', PR_SF: 'SF',
    }

    return {
      predecessorId: row['pred_task_id'] ?? '',
      successorId: row['task_id'] ?? '',
      type: typeMap[typeCode] ?? 'FS',
      lag: parseFloat(row['lag_hr_cnt'] ?? '0') / 8,
    }
  })
}

// ── Provider ────────────────────────────────────────────

export const primaveraP6Provider: IntegrationProvider = {
  type: 'primavera_p6',

  async connect(projectId, _credentials) {
    // P6 is file-based, no external auth needed
    const { data: { user } } = await supabase.auth.getUser()
    const integrationId = await createIntegrationRecord('primavera_p6', projectId, {
      projectId,
      lastImportFile: null,
    }, user?.id ?? '')
    return { integrationId }
  },

  async disconnect(integrationId) {
    await updateIntegrationStatus(integrationId, 'disconnected')
  },

  async sync(integrationId, direction) {
    await updateIntegrationStatus(integrationId, 'syncing')

    const { data: integration } = await supabase.from('integrations').select('config').eq('id', integrationId).single()
    const config = (integration?.config ?? {}) as Record<string, unknown>
    const projectId = config.projectId as string

    if (direction === 'export') {
      // P6 export would generate a .xer file from schedule data
      // Complex format, not commonly needed (most teams export from P6 to SiteSync, not the reverse)
      const result: SyncResult = { success: false, recordsSynced: 0, recordsFailed: 0, errors: ['XER export is not yet supported. Use Microsoft Project XML for export.'] }
      await logSyncResult(integrationId, result, direction)
      await updateIntegrationStatus(integrationId, 'connected')
      return result
    }

    // Import: parse XER content from config.pendingImportXer
    const xerData = config.pendingImportXer as string | undefined
    if (!xerData) {
      const result: SyncResult = { success: false, recordsSynced: 0, recordsFailed: 0, errors: ['No import file provided. Upload a .xer file first.'] }
      await logSyncResult(integrationId, result, direction)
      await updateIntegrationStatus(integrationId, 'connected')
      return result
    }

    let synced = 0
    let failed = 0
    const errors: string[] = []
    const details: Record<string, number> = {}

    try {
      const tables = parseXER(xerData)
      const activities = extractActivities(tables)
      const wbs = extractWBS(tables)
      const relationships = extractRelationships(tables)

      details.activities = activities.length
      details.wbs = wbs.length
      details.relationships = relationships.length

      // Build WBS name lookup
      const wbsMap = new Map(wbs.map((w) => [w.wbsId, w.wbsName]))

      // Upsert activities as schedule phases
      for (const activity of activities) {
        try {
          const wbsName = wbsMap.get(activity.wbsId) ?? ''
          const phaseName = wbsName ? `${wbsName}: ${activity.activityName}` : activity.activityName

          await supabase.from('schedule_phases').upsert({
            project_id: projectId,
            name: phaseName,
            start_date: activity.startDate ? activity.startDate.slice(0, 10) : null,
            end_date: activity.finishDate ? activity.finishDate.slice(0, 10) : null,
            percent_complete: activity.percentComplete,
            status: activity.status,
          }, { onConflict: 'name,project_id' })
          synced++
        } catch {
          failed++
        }
      }

      // Clear pending import
      await supabase.from('integrations').update({
        config: { ...config, pendingImportXer: null, lastImportFile: new Date().toISOString() },
      }).eq('id', integrationId)

    } catch (err) {
      errors.push(`XER parse error: ${(err as Error).message}`)
    }

    const result: SyncResult = { success: errors.length === 0, recordsSynced: synced, recordsFailed: failed, errors, details }
    await logSyncResult(integrationId, result, direction)
    await updateIntegrationStatus(integrationId, errors.length === 0 ? 'connected' : 'error')
    return result
  },

  async getStatus(integrationId) {
    const { data } = await supabase.from('integrations').select('status, last_sync, error_log').eq('id', integrationId).single()
    return {
      status: (data?.status as IntegrationStatus) ?? 'disconnected',
      lastSync: data?.last_sync ?? null,
    }
  },

  getCapabilities() {
    return ['schedule_import', 'xer_import']
  },
}

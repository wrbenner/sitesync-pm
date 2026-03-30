// Microsoft Project Integration: Import/Export schedules (.xml format)

import { supabase } from '../../lib/supabase'
import {
  type IntegrationProvider,
  type SyncResult,
  type IntegrationStatus,
  logSyncResult,
  updateIntegrationStatus,
  createIntegrationRecord,
} from './base'

// MS Project XML uses a specific schema for tasks
interface MSProjectTask {
  uid: string
  name: string
  start: string
  finish: string
  percentComplete: number
  isMilestone: boolean
  predecessors: string[]
}

function parseProjectXml(xmlString: string): MSProjectTask[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'text/xml')
  const tasks: MSProjectTask[] = []

  const taskElements = doc.getElementsByTagName('Task')
  for (let i = 0; i < taskElements.length; i++) {
    const el = taskElements[i]
    const uid = el.getElementsByTagName('UID')[0]?.textContent ?? ''
    const name = el.getElementsByTagName('Name')[0]?.textContent ?? ''
    const start = el.getElementsByTagName('Start')[0]?.textContent ?? ''
    const finish = el.getElementsByTagName('Finish')[0]?.textContent ?? ''
    const pct = parseInt(el.getElementsByTagName('PercentComplete')[0]?.textContent ?? '0', 10)
    const milestone = el.getElementsByTagName('Milestone')[0]?.textContent === '1'

    // Parse predecessors
    const predecessors: string[] = []
    const predLinks = el.getElementsByTagName('PredecessorLink')
    for (let j = 0; j < predLinks.length; j++) {
      const predUid = predLinks[j].getElementsByTagName('PredecessorUID')[0]?.textContent
      if (predUid) predecessors.push(predUid)
    }

    if (name && uid !== '0') {
      tasks.push({ uid, name, start, finish, percentComplete: pct, isMilestone: milestone, predecessors })
    }
  }
  return tasks
}

function generateProjectXml(
  projectName: string,
  phases: Array<{ name: string; start_date: string | null; end_date: string | null; percent_complete?: number; status: string }>
): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Project xmlns="http://schemas.microsoft.com/project">',
    `  <Name>${escapeXml(projectName)}</Name>`,
    '  <Tasks>',
  ]

  phases.forEach((phase, i) => {
    const uid = i + 1
    lines.push('    <Task>')
    lines.push(`      <UID>${uid}</UID>`)
    lines.push(`      <Name>${escapeXml(phase.name)}</Name>`)
    lines.push(`      <Start>${phase.start_date ?? ''}</Start>`)
    lines.push(`      <Finish>${phase.end_date ?? ''}</Finish>`)
    lines.push(`      <PercentComplete>${phase.percent_complete ?? 0}</PercentComplete>`)
    lines.push(`      <Milestone>${phase.status === 'complete' ? '1' : '0'}</Milestone>`)
    lines.push('    </Task>')
  })

  lines.push('  </Tasks>')
  lines.push('</Project>')
  return lines.join('\n')
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export const msProjectProvider: IntegrationProvider = {
  type: 'ms_project',

  async connect(projectId, _credentials) {
    // MS Project doesn't require external auth, just file import/export
    const { data: { user } } = await supabase.auth.getUser()
    const integrationId = await createIntegrationRecord('ms_project', projectId, {
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

    const { data: integration } = await supabase
      .from('integrations')
      .select('config')
      .eq('id', integrationId)
      .single()

    const config = (integration?.config ?? {}) as Record<string, unknown>
    const projectId = config.projectId as string

    if (direction === 'export') {
      return await exportSchedule(integrationId, projectId)
    }

    // Import requires file data in config.pendingImportXml
    const xmlData = config.pendingImportXml as string | undefined
    if (!xmlData) {
      const result: SyncResult = { success: false, recordsSynced: 0, recordsFailed: 0, errors: ['No import file provided. Upload an .xml file first.'] }
      await logSyncResult(integrationId, result, direction)
      await updateIntegrationStatus(integrationId, 'connected')
      return result
    }

    return await importSchedule(integrationId, projectId, xmlData)
  },

  async getStatus(integrationId) {
    const { data } = await supabase.from('integrations').select('status, last_sync, error_log').eq('id', integrationId).single()
    return {
      status: (data?.status as IntegrationStatus) ?? 'disconnected',
      lastSync: data?.last_sync ?? null,
    }
  },

  getCapabilities() {
    return ['schedule_import', 'schedule_export']
  },
}

async function importSchedule(integrationId: string, projectId: string, xmlData: string): Promise<SyncResult> {
  let synced = 0
  let failed = 0
  const errors: string[] = []

  try {
    const tasks = parseProjectXml(xmlData)

    for (const task of tasks) {
      try {
        await supabase.from('schedule_phases').upsert({
          project_id: projectId,
          name: task.name,
          start_date: task.start ? task.start.slice(0, 10) : null,
          end_date: task.finish ? task.finish.slice(0, 10) : null,
          percent_complete: task.percentComplete,
          status: task.percentComplete >= 100 ? 'complete' : task.percentComplete > 0 ? 'in_progress' : 'not_started',
        }, { onConflict: 'name,project_id' })
        synced++
      } catch {
        failed++
      }
    }
  } catch (err) {
    errors.push((err as Error).message)
  }

  // Clear the pending import
  await supabase.from('integrations').update({ config: { projectId, pendingImportXml: null } }).eq('id', integrationId)

  const result: SyncResult = { success: errors.length === 0, recordsSynced: synced, recordsFailed: failed, errors, details: { phases: synced } }
  await logSyncResult(integrationId, result, 'import')
  await updateIntegrationStatus(integrationId, 'connected')
  return result
}

async function exportSchedule(integrationId: string, projectId: string): Promise<SyncResult> {
  try {
    const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single()
    const { data: phases } = await supabase.from('schedule_phases').select('*').eq('project_id', projectId).order('start_date')

    if (!phases || phases.length === 0) {
      return { success: false, recordsSynced: 0, recordsFailed: 0, errors: ['No schedule phases to export'] }
    }

    const xml = generateProjectXml(
      project?.name ?? 'Project',
      phases.map((p) => ({
        name: p.name ?? '',
        start_date: p.start_date,
        end_date: p.end_date,
        percent_complete: (p as any).percent_complete ?? 0,
        status: p.status ?? 'not_started',
      }))
    )

    // Trigger download
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project?.name ?? 'Schedule'}_${new Date().toISOString().slice(0, 10)}.xml`
    a.click()
    URL.revokeObjectURL(url)

    const result: SyncResult = { success: true, recordsSynced: phases.length, recordsFailed: 0, errors: [], details: { phases: phases.length } }
    await logSyncResult(integrationId, result, 'export')
    await updateIntegrationStatus(integrationId, 'connected')
    return result
  } catch (err) {
    const result: SyncResult = { success: false, recordsSynced: 0, recordsFailed: 0, errors: [(err as Error).message] }
    await logSyncResult(integrationId, result, 'export')
    await updateIntegrationStatus(integrationId, 'error')
    return result
  }
}

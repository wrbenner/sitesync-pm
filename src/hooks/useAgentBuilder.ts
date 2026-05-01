// Agent Builder: Create custom AI agents from natural language descriptions.
// Matches Procore Helix Agent Builder capability.
// All agent actions require human approval (no auto-execute).

import { useState, useCallback } from 'react'
import { supabase, fromTable } from '../lib/supabase'
import { useProjectId } from './useProjectId'
import { useAuth } from './useAuth'
import { toast } from 'sonner'

// ── Types ────────────────────────────────────────────────

export type AgentTrigger = 'schedule' | 'event' | 'manual'
export type AgentEventType = 'entity_created' | 'entity_updated' | 'status_changed' | 'threshold_exceeded' | 'deadline_approaching'

export interface AgentCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'is_overdue'
  value: string | number | boolean
}

export interface AgentAction {
  type: 'notify' | 'create_entity' | 'update_status' | 'generate_report' | 'send_email' | 'escalate'
  config: Record<string, unknown>
}

export interface AgentDefinition {
  name: string
  description: string
  trigger: AgentTrigger
  schedule?: string // cron expression for schedule triggers
  eventType?: AgentEventType
  entityType?: string // which entity type to watch
  conditions: AgentCondition[]
  actions: AgentAction[]
  notificationTargets: string[] // user IDs or roles
  enabled: boolean
}

export interface ParsedAgentDefinition {
  definition: AgentDefinition
  explanation: string
  confidence: number
}

// ── AI Parsing Prompt ────────────────────────────────────

const AGENT_BUILDER_PROMPT = `You are a construction AI agent builder. Convert natural language descriptions into structured agent definitions.

SUPPORTED TRIGGERS:
- schedule: Run on a cron schedule (e.g., "every Monday at 6am", "daily at 8am", "every Friday at 3pm")
- event: Run when a specific event occurs (entity_created, entity_updated, status_changed, threshold_exceeded, deadline_approaching)
- manual: Run on demand

SUPPORTED ENTITY TYPES: rfis, tasks, submittals, change_orders, daily_logs, punch_items, budget_items, safety_inspections

SUPPORTED ACTIONS:
- notify: Send notification to users or roles
- create_entity: Create a new entity (e.g., create a task)
- update_status: Change entity status
- generate_report: Generate a report
- send_email: Send an email notification
- escalate: Escalate to a higher authority

Respond with ONLY valid JSON:
{
  "definition": {
    "name": "short agent name",
    "description": "what the agent does",
    "trigger": "schedule|event|manual",
    "schedule": "cron expression or null",
    "eventType": "event type or null",
    "entityType": "entity type or null",
    "conditions": [{ "field": "string", "operator": "string", "value": "any" }],
    "actions": [{ "type": "string", "config": {} }],
    "notificationTargets": ["role names or specific targets"],
    "enabled": true
  },
  "explanation": "human-readable explanation of what this agent will do",
  "confidence": 0.0-1.0
}`

// ── Hook ─────────────────────────────────────────────────

export function useAgentBuilder() {
  const projectId = useProjectId()
  const { user } = useAuth()

  const [parsing, setParsing] = useState(false)
  const [parsedAgent, setParsedAgent] = useState<ParsedAgentDefinition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Parse natural language into agent definition
  const parseDescription = useCallback(async (description: string) => {
    if (!description.trim()) return
    setParsing(true)
    setError(null)
    setParsedAgent(null)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) {
        setParsedAgent(fallbackParse(description))
        return
      }

      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Create an AI agent from this description:\n\n"${description}"` }],
          projectContext: {
            projectId,
            page: 'agent-builder',
            entityContext: AGENT_BUILDER_PROMPT,
          },
        }),
      })

      if (!response.ok) throw new Error('Failed to parse agent description')

      const data = await response.json()
      const content = data.content || ''
      const jsonMatch = content.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as ParsedAgentDefinition
        setParsedAgent(parsed)
      } else {
        setParsedAgent(fallbackParse(description))
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setParsing(false)
    }
  }, [projectId])

  // Create the agent in the database
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- React Compiler cannot preserve; deps are stable
  const createAgent = useCallback(async (definition: AgentDefinition) => {
    if (!projectId) return
    setCreating(true)

    try {
      const { error: insertError } = await fromTable('ai_agents').insert({
        project_id: projectId,
        agent_type: `custom_${Date.now()}`,
        name: definition.name,
        description: definition.description,
        status: 'active',
        configuration: {
          trigger: definition.trigger,
          schedule: definition.schedule,
          eventType: definition.eventType,
          entityType: definition.entityType,
          conditions: definition.conditions,
          actions: definition.actions,
          notificationTargets: definition.notificationTargets,
          auto_execute_threshold: 999, // Never auto-execute (human approval required)
        },
        created_by: user?.id,
      })

      if (insertError) throw insertError
      toast.success(`Agent "${definition.name}" created`)
      setParsedAgent(null)
    } catch (err) {
      toast.error(`Failed to create agent: ${(err as Error).message}`)
    } finally {
      setCreating(false)
    }
  }, [projectId, user?.id])

  const reset = useCallback(() => {
    setParsedAgent(null)
    setError(null)
  }, [])

  return { parsing, parsedAgent, error, creating, parseDescription, createAgent, reset }
}

// ── Fallback ─────────────────────────────────────────────

function fallbackParse(description: string): ParsedAgentDefinition {
  const lower = description.toLowerCase()

  // Detect schedule triggers
  let trigger: AgentTrigger = 'manual'
  let schedule: string | undefined
  if (lower.includes('every morning') || lower.includes('daily')) {
    trigger = 'schedule'
    schedule = '0 8 * * *'
  } else if (lower.includes('every monday') || lower.includes('weekly')) {
    trigger = 'schedule'
    schedule = '0 6 * * 1'
  } else if (lower.includes('every friday')) {
    trigger = 'schedule'
    schedule = '0 15 * * 5'
  } else if (lower.includes('when') || lower.includes('flag') || lower.includes('auto')) {
    trigger = 'event'
  }

  return {
    definition: {
      name: description.slice(0, 50).replace(/^create an agent that\s*/i, '').trim(),
      description,
      trigger,
      schedule,
      entityType: lower.includes('rfi') ? 'rfis' : lower.includes('task') ? 'tasks' : lower.includes('change order') ? 'change_orders' : undefined,
      conditions: [],
      actions: [{ type: 'notify', config: { message: description } }],
      notificationTargets: ['project_manager'],
      enabled: true,
    },
    explanation: `This agent will ${trigger === 'schedule' ? `run on schedule (${schedule})` : trigger === 'event' ? 'trigger on events' : 'run manually'} and send notifications.`,
    confidence: 0.5,
  }
}

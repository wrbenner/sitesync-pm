// ── AI Copilot Tools — Function Definitions ──────────────────
// Adapted from SiteSync PM production chatbot:
//   sitesyncai-backend/src/chatbot/openai/function-definitions.ts
//
// These tool schemas are fed to Claude / OpenAI for function-calling in the
// AI Copilot. The function NAMES and ARGUMENT SHAPES are battle-tested; the
// DESCRIPTIONS are mapped to SiteSync PM's data model (projects, drawings,
// discrepancies, pairs, entities) instead of SiteSync PM's file-centric one.
//
// Each tool handler runs server-side via supabase edge functions — this
// module is the SHARED SCHEMA + CLIENT-SIDE DISPATCHER.

export type ToolName =
  | 'get_sheet_metadata'
  | 'get_pair_relationships'
  | 'get_unpaired_drawings'
  | 'get_paired_drawings'
  | 'get_project_stats'
  | 'get_discrepancy_stats'
  | 'audit_cross_modal_scales'
  | 'search_entities'
  | 'get_entity_stats'
  | 'list_projects'
  | 'get_project_info'
  | 'trigger_platform_action'

export interface AiCopilotTool {
  type: 'function'
  function: {
    name: ToolName
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

export const AI_COPILOT_TOOLS: AiCopilotTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_sheet_metadata',
      description:
        'Get detailed metadata for a single drawing sheet or page. Use this for questions about a specific sheet including its sheet number, scale, validation status, title, discipline classification, or notes. You can pass EITHER a sheet number (e.g. "A101") OR a page number (e.g. "3") as sheet_no. ALWAYS pass project_id from the system context.',
      parameters: {
        type: 'object',
        properties: {
          sheet_no: {
            type: 'string',
            description:
              "Sheet number OR page number. Examples: 'A101', 'S101', 'A0.10', '3'. Page numbers are resolved to sheet numbers automatically.",
          },
          project_id: {
            type: 'string',
            description: 'UUID of the project. ALWAYS use the exact value from system context — never placeholders.',
          },
        },
        required: ['sheet_no', 'project_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pair_relationships',
      description:
        'Analyze architectural/structural pair relationships. Use this to answer which drawings are paired together, the pair status, and the partner sheet for a given sheet number. ALWAYS pass project_id.',
      parameters: {
        type: 'object',
        properties: {
          sheet_no: {
            type: 'string',
            description: "Sheet number to look up the pair for (e.g. 'A101' or 'S101').",
          },
          project_id: { type: 'string', description: 'UUID of the project.' },
        },
        required: ['sheet_no', 'project_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_unpaired_drawings',
      description:
        'Get a list of all drawings that are NOT part of any pair. Useful for completeness audits. ALWAYS pass project_id.',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'string', description: 'UUID of the project.' },
        },
        required: ['project_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_paired_drawings',
      description:
        'Get all paired drawings with their partner information. ALWAYS pass project_id.',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'string', description: 'UUID of the project.' },
        },
        required: ['project_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_project_stats',
      description:
        'Comprehensive project statistics: counts of architectural sheets, structural sheets, pairs, unpaired sheets, sheets with dimensions, and overall progress. Use for "how many sheets", "how many pairs", "show me the numbers", etc. Do NOT use for discrepancy-specific questions — use get_discrepancy_stats.',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'string', description: 'UUID of the project.' },
          filter_criteria: {
            type: 'object',
            description: 'Optional additional filter criteria (discipline, revision, etc.).',
          },
        },
        required: ['project_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_discrepancy_stats',
      description:
        'Get dimensional discrepancy statistics for paired drawings. Use for any question about discrepancies, mismatches, clashes, or "which pairs have issues". ALWAYS pass project_id.',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'string', description: 'UUID of the project.' },
        },
        required: ['project_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'audit_cross_modal_scales',
      description:
        'Audit scale consistency between architectural and structural pairs — flags pairs where the drawing scales disagree. ALWAYS pass project_id.',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'string', description: 'UUID of the project.' },
          limit: {
            type: 'integer',
            description: 'Maximum pairs to check (default 50, max 100).',
            default: 50,
            minimum: 1,
            maximum: 100,
          },
        },
        required: ['project_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_entities',
      description:
        'Search across all entity types in the project (drawings, discrepancies, RFIs, tasks, submittals, change orders). Use for open-ended queries like "find anything about Level 3 foundations" or "where is wall type W-1 referenced".',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'string', description: 'UUID of the project.' },
          query: {
            type: 'string',
            description: 'Free-text search query.',
          },
          entity_types: {
            type: 'array',
            items: { type: 'string' },
            description:
              "Optional list of entity types to search, e.g. ['drawing','rfi','task']. If omitted, searches all.",
          },
          limit: { type: 'integer', default: 20, maximum: 100 },
        },
        required: ['project_id', 'query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_entity_stats',
      description:
        'Statistics about detected entities (doors, windows, columns, etc.) on drawings. Use for "how many doors", "count windows on page 3". ALWAYS pass project_id.',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'string', description: 'UUID of the project.' },
          sheet_no: {
            type: 'string',
            description: "Optional sheet or page number (e.g. 'A101' or '3').",
          },
          entity_class: {
            type: 'string',
            description: "Optional entity class (e.g. 'Door', 'Window', 'Column').",
          },
        },
        required: ['project_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_projects',
      description:
        "List all projects in the user's organization. Use for 'list my projects', 'how many projects'. Does NOT require project_id.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_project_info',
      description:
        'Get information about a specific project by name (status, drawing count, discrepancy count, key dates). Does NOT require project_id — searches by name.',
      parameters: {
        type: 'object',
        properties: {
          project_name: {
            type: 'string',
            description: "Project name or partial name, e.g. 'Alpha Tower', 'oak grove'.",
          },
        },
        required: ['project_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'trigger_platform_action',
      description:
        "Trigger platform actions: open a specific drawing view, overlap two drawings, generate a report, or navigate. Use when the user says 'show me A101', 'overlap A1 and S1', 'download the report', 'open the schedule'.",
      parameters: {
        type: 'object',
        properties: {
          action_type: {
            type: 'string',
            enum: [
              'SHOW_DRAWING',
              'OVERLAP_DRAWINGS',
              'GENERATE_REPORT',
              'OPEN_VIEW',
            ],
            description:
              "SHOW_DRAWING: open a single sheet. OVERLAP_DRAWINGS: compare two sheets. GENERATE_REPORT: create PDF. OPEN_VIEW: navigate to a top-level app view (e.g. 'schedule', 'rfis', 'budget').",
          },
          target_ids: {
            type: 'array',
            items: { type: 'string' },
            description:
              "For SHOW_DRAWING: one sheet no, e.g. ['A101']. For OVERLAP: two sheet nos. For GENERATE_REPORT: optional list of drawing IDs. For OPEN_VIEW: one view key.",
          },
          project_id: {
            type: 'string',
            description: 'UUID of the project. Pass exactly from system context.',
          },
          report_type: {
            type: 'string',
            enum: ['discrepancy', 'classification', 'scale_audit', 'full'],
            description: 'Required when action_type = GENERATE_REPORT.',
          },
        },
        required: ['action_type', 'project_id'],
      },
    },
  },
]

// ── Dispatcher ────────────────────────────────────────────────
// Invokes the agent-orchestrator edge function's executeAction path
// to actually run a tool against Supabase, and returns the real result.
//
// Note: mutations (create_*, update_*) run immediately here and
// bypass the chat-time approval flow. User-facing copilot UIs should
// route mutations through useMultiAgentChat's approveAction instead of
// calling dispatchTool directly.

import { supabase } from './supabase'

export interface ToolDispatchResult {
  success: boolean
  result?: Record<string, unknown>
  error?: string
}

// Map a client-facing ToolName to the agent domain the orchestrator
// expects. These domains gate which tool handlers are reachable.
function domainForTool(name: ToolName): string {
  switch (name) {
    case 'get_sheet_metadata':
    case 'get_pair_relationships':
    case 'get_unpaired_drawings':
    case 'get_paired_drawings':
    case 'search_entities':
    case 'get_entity_stats':
      return 'document'
    case 'get_project_stats':
    case 'get_discrepancy_stats':
    case 'audit_cross_modal_scales':
    case 'list_projects':
    case 'get_project_info':
      return 'document'
    case 'trigger_platform_action':
      return 'document'
  }
}

export async function dispatchTool(
  name: ToolName,
  args: Record<string, unknown>,
  projectId?: string,
): Promise<ToolDispatchResult> {
  const resolvedProjectId = (args.project_id as string | undefined) ?? projectId ?? ''

  try {
    const { data, error } = await supabase.functions.invoke('agent-orchestrator', {
      body: {
        executeAction: {
          actionId: `dispatch-${Date.now()}`,
          tool: name,
          input: args,
          domain: domainForTool(name),
        },
        projectContext: { projectId: resolvedProjectId },
      },
    })
    if (error) return { success: false, error: error.message }
    const payload = data as { success?: boolean; result?: Record<string, unknown> } | null
    return {
      success: payload?.success !== false,
      result: payload?.result,
    }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

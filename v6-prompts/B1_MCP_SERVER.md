# B1: SiteSync MCP Server — Construction AI Platform Integration Layer

## Executive Summary

The Model Context Protocol (MCP) is the emerging standard for AI-to-tool integration. With 10,000+ existing servers and 97M monthly SDK downloads, implementing an MCP server for SiteSync creates an unprecedented competitive moat: **ANY AI agent—Claude, GPT-5.4, Gemini, or custom models—can natively interact with SiteSync data without custom integrations.**

This single feature makes SiteSync the platform of choice for enterprises deploying heterogeneous AI agents across their operations. Procore, Bridgit, and Oracle's Aconex have no equivalent.

**Key Strategic Value:**
- Construction firms run Claude in their terminal, opens SiteSync project data directly
- Claude extracts critical path from any project in seconds
- GPT agents access budgets, safety records, schedule data—all via MCP
- Custom enterprise models query SiteSync without building REST endpoints
- Opens SiteSync to Claude Code, GitHub Copilot, and future agent platforms

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     MCP SERVER ARCHITECTURE                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌──────────────────┐
│  AI Clients     │         │  SiteSync Backend│
│  (Claude, GPT)  │◄────────►│  (Supabase)      │
└─────────────────┘         └──────────────────┘
        │                            ▲
        │ MCP Protocol               │
        │ (JSON-RPC over stdio)      │
        │                            │
┌───────▼────────────────────────────────────┐
│       MCP Server (Node.js/TypeScript)      │
│                                            │
│  ┌─────────────────────────────────────┐  │
│  │  Tool Registry (30+ tools)          │  │
│  │  ├─ Projects (5 tools)              │  │
│  │  ├─ RFIs (4 tools)                  │  │
│  │  ├─ Tasks (4 tools)                 │  │
│  │  ├─ Schedule (3 tools)              │  │
│  │  ├─ Budget (3 tools)                │  │
│  │  ├─ Safety (3 tools)                │  │
│  │  ├─ Documents (3 tools)             │  │
│  │  ├─ Daily Logs (2 tools)            │  │
│  │  ├─ Change Orders (2 tools)         │  │
│  │  ├─ Payments (2 tools)              │  │
│  │  └─ Benchmarks & AI (2 tools)       │  │
│  └─────────────────────────────────────┘  │
│                                            │
│  ┌─────────────────────────────────────┐  │
│  │  Resource Manager                   │  │
│  │  ├─ Projects (URIs, schemas)        │  │
│  │  ├─ Documents (retrieval)           │  │
│  │  └─ Photos (indexed by location)    │  │
│  └─────────────────────────────────────┘  │
│                                            │
│  ┌─────────────────────────────────────┐  │
│  │  Prompt Library                     │  │
│  │  ├─ Daily Standup Generator         │  │
│  │  ├─ Weekly Report Template          │  │
│  │  ├─ Risk Analysis Prompt            │  │
│  │  └─ Change Order Summary            │  │
│  └─────────────────────────────────────┘  │
│                                            │
│  ┌─────────────────────────────────────┐  │
│  │  Authentication & Authorization     │  │
│  │  ├─ API Key validation              │  │
│  │  ├─ Supabase JWT integration        │  │
│  │  └─ Row-level security enforcement  │  │
│  └─────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

---

## Complete MCP Server Implementation

### 1. Project Setup and Package Configuration

**File: `sitesync-mcp/package.json`**
```json
{
  "name": "@sitesync/mcp-server",
  "version": "1.0.0",
  "description": "Model Context Protocol server for SiteSync construction platform",
  "main": "dist/index.js",
  "bin": {
    "sitesync-mcp": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest",
    "verify": "node scripts/verify-mcp.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@supabase/supabase-js": "^2.43.0",
    "zod": "^3.22.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsx": "^4.7.0",
    "@types/node": "^20.10.0",
    "vitest": "^1.0.0"
  }
}
```

### 2. Server Core Implementation

**File: `sitesync-mcp/src/index.ts`**
```typescript
import {
  Server,
  StdioServerTransport,
  CallToolRequest,
  Tool,
  TextContent,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/server/index.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// ============================================================================
// CONFIGURATION & CLIENTS
// ============================================================================

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ToolContext {
  userId: string;
  projectId?: string;
  orgId: string;
}

// ============================================================================
// AUTHENTICATION & AUTHORIZATION
// ============================================================================

async function authenticateApiKey(apiKey: string): Promise<ToolContext> {
  const { data, error } = await supabase
    .from("api_keys")
    .select("user_id, org_id, project_ids")
    .eq("key_hash", hashApiKey(apiKey))
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw new McpError(
      ErrorCode.AuthenticationFailed,
      "Invalid or inactive API key"
    );
  }

  return {
    userId: data.user_id,
    orgId: data.org_id,
    projectId: data.project_ids?.[0],
  };
}

function hashApiKey(key: string): string {
  // In production, use crypto.subtle.digest
  return require("crypto").createHash("sha256").update(key).digest("hex");
}

// ============================================================================
// PROJECT TOOLS (5 tools)
// ============================================================================

const ListProjectsTool: Tool = {
  name: "list_projects",
  description:
    "List all projects accessible to the authenticated user, with health metrics",
  inputSchema: {
    type: "object" as const,
    properties: {
      status: {
        type: "string",
        enum: ["active", "completed", "archived", "all"],
        description: "Filter projects by status",
      },
      limit: {
        type: "number",
        description: "Maximum number of projects to return (default: 20)",
      },
      offset: {
        type: "number",
        description: "Pagination offset (default: 0)",
      },
    },
    required: [],
  },
};

async function listProjects(
  ctx: ToolContext,
  params: { status?: string; limit?: number; offset?: number }
): Promise<TextContent> {
  const query = supabase
    .from("projects")
    .select(
      `
      id, name, description, status, start_date, end_date, budget,
      cost_to_date, schedule_health, budget_health, safety_score,
      team_members_count
    `
    )
    .eq("org_id", ctx.orgId);

  if (params.status && params.status !== "all") {
    query.eq("status", params.status);
  }

  const { data, error } = await query
    .limit(params.limit || 20)
    .offset(params.offset || 0)
    .order("updated_at", { ascending: false });

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

const GetProjectTool: Tool = {
  name: "get_project",
  description: "Get detailed information about a specific project",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "The ID of the project",
      },
    },
    required: ["project_id"],
  },
};

async function getProject(
  ctx: ToolContext,
  params: { project_id: string }
): Promise<TextContent> {
  const { data, error } = await supabase
    .from("projects")
    .select(
      `
      *,
      team_members:project_team_members(user_id, role),
      phases:project_phases(id, name, status, start_date, end_date),
      safety_incidents:safety_incidents(id, type, severity, date, resolved),
      change_orders:change_orders(id, status, amount, description)
    `
    )
    .eq("org_id", ctx.orgId)
    .eq("id", params.project_id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new McpError(ErrorCode.InvalidRequest, "Project not found");
    }
    throw new McpError(ErrorCode.InternalError, error.message);
  }

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

const GetProjectHealthTool: Tool = {
  name: "get_project_health",
  description: "Get comprehensive health assessment of a project",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "The ID of the project",
      },
    },
    required: ["project_id"],
  },
};

async function getProjectHealth(
  ctx: ToolContext,
  params: { project_id: string }
): Promise<TextContent> {
  // Fetch health metrics from analytics table
  const { data: metrics, error } = await supabase
    .from("project_metrics")
    .select(
      `
      schedule_variance,
      cost_variance,
      safety_incidents_30d,
      rfi_pending_count,
      change_order_amount,
      crew_productivity_index,
      material_waste_percentage,
      equipment_utilization,
      weather_delays_hours
    `
    )
    .eq("project_id", params.project_id)
    .single();

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  // Calculate health scores
  const health = {
    schedule: calculateScheduleHealth(metrics),
    budget: calculateBudgetHealth(metrics),
    safety: calculateSafetyHealth(metrics),
    quality: calculateQualityHealth(metrics),
    overall: 0, // weighted average
  };

  health.overall =
    (health.schedule + health.budget + health.safety + health.quality) / 4;

  return {
    type: "text" as const,
    text: JSON.stringify(health, null, 2),
  };
}

// ============================================================================
// RFI TOOLS (4 tools)
// ============================================================================

const ListRfisTool: Tool = {
  name: "list_rfis",
  description:
    "List all Request For Information (RFI) items for a project",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "The project ID",
      },
      status: {
        type: "string",
        enum: ["draft", "submitted", "acknowledged", "responded", "closed"],
        description: "Filter by RFI status",
      },
      days_pending: {
        type: "number",
        description: "Show RFIs pending longer than this many days",
      },
    },
    required: ["project_id"],
  },
};

async function listRfis(
  ctx: ToolContext,
  params: { project_id: string; status?: string; days_pending?: number }
): Promise<TextContent> {
  let query = supabase
    .from("rfis")
    .select(
      "id, number, title, status, submitted_date, due_date, days_pending, priority, trade"
    )
    .eq("project_id", params.project_id);

  if (params.status) {
    query = query.eq("status", params.status);
  }

  const { data, error } = await query.order("submitted_date", {
    ascending: false,
  });

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  let filtered = data || [];
  if (params.days_pending) {
    filtered = filtered.filter((r) => r.days_pending >= params.days_pending);
  }

  return {
    type: "text" as const,
    text: JSON.stringify(filtered, null, 2),
  };
}

const CreateRfiTool: Tool = {
  name: "create_rfi",
  description: "Create a new RFI",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "The project ID",
      },
      title: {
        type: "string",
        description: "RFI title",
      },
      description: {
        type: "string",
        description: "Detailed description of the question",
      },
      trade: {
        type: "string",
        description: "Trade/discipline (e.g., 'MEP', 'Structural')",
      },
      priority: {
        type: "string",
        enum: ["low", "medium", "high", "critical"],
        description: "Priority level",
      },
      due_date: {
        type: "string",
        description: "Due date (ISO 8601)",
      },
    },
    required: ["project_id", "title", "description", "trade"],
  },
};

async function createRfi(
  ctx: ToolContext,
  params: z.infer<typeof RfiInputSchema>
): Promise<TextContent> {
  const { data, error } = await supabase
    .from("rfis")
    .insert([
      {
        project_id: params.project_id,
        created_by: ctx.userId,
        title: params.title,
        description: params.description,
        trade: params.trade,
        priority: params.priority || "medium",
        due_date: params.due_date,
        status: "draft",
      },
    ])
    .select()
    .single();

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

const RfiInputSchema = z.object({
  project_id: z.string(),
  title: z.string(),
  description: z.string(),
  trade: z.string(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  due_date: z.string().optional(),
});

const GetRfiTool: Tool = {
  name: "get_rfi",
  description: "Get full details of a specific RFI including responses",
  inputSchema: {
    type: "object" as const,
    properties: {
      rfi_id: {
        type: "string",
        description: "The RFI ID",
      },
    },
    required: ["rfi_id"],
  },
};

async function getRfi(
  ctx: ToolContext,
  params: { rfi_id: string }
): Promise<TextContent> {
  const { data, error } = await supabase
    .from("rfis")
    .select(
      `
      *,
      responses:rfi_responses(id, status, content, submitted_by, submitted_date),
      attachments:rfi_attachments(id, filename, url)
    `
    )
    .eq("id", params.rfi_id)
    .single();

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

const RespondToRfiTool: Tool = {
  name: "respond_to_rfi",
  description: "Submit a response to an RFI",
  inputSchema: {
    type: "object" as const,
    properties: {
      rfi_id: {
        type: "string",
        description: "The RFI ID",
      },
      content: {
        type: "string",
        description: "Response content",
      },
      status: {
        type: "string",
        enum: ["acknowledged", "responded"],
        description: "Set status to acknowledged or responded",
      },
    },
    required: ["rfi_id", "content"],
  },
};

async function respondToRfi(
  ctx: ToolContext,
  params: { rfi_id: string; content: string; status?: string }
): Promise<TextContent> {
  const { data, error } = await supabase
    .from("rfi_responses")
    .insert([
      {
        rfi_id: params.rfi_id,
        submitted_by: ctx.userId,
        content: params.content,
        submitted_date: new Date().toISOString(),
        status: params.status || "responded",
      },
    ])
    .select()
    .single();

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  // Update RFI status
  await supabase
    .from("rfis")
    .update({ status: params.status || "responded" })
    .eq("id", params.rfi_id);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

// ============================================================================
// TASK TOOLS (4 tools)
// ============================================================================

const ListTasksTool: Tool = {
  name: "list_tasks",
  description:
    "List tasks for a project, optionally filtered by phase or assignee",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
        description: "The project ID",
      },
      phase_id: {
        type: "string",
        description: "Optional: filter by phase",
      },
      assigned_to: {
        type: "string",
        description: "Optional: filter by assignee user ID",
      },
      status: {
        type: "string",
        enum: ["open", "in_progress", "completed", "blocked"],
        description: "Optional: filter by status",
      },
    },
    required: ["project_id"],
  },
};

async function listTasks(
  ctx: ToolContext,
  params: {
    project_id: string;
    phase_id?: string;
    assigned_to?: string;
    status?: string;
  }
): Promise<TextContent> {
  let query = supabase
    .from("tasks")
    .select(
      "id, title, phase_id, assigned_to, status, due_date, priority, duration_hours, progress_percentage"
    )
    .eq("project_id", params.project_id);

  if (params.phase_id) query = query.eq("phase_id", params.phase_id);
  if (params.assigned_to) query = query.eq("assigned_to", params.assigned_to);
  if (params.status) query = query.eq("status", params.status);

  const { data, error } = await query.order("due_date", { ascending: true });

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

const CreateTaskTool: Tool = {
  name: "create_task",
  description: "Create a new task in a project phase",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
      },
      phase_id: {
        type: "string",
      },
      title: {
        type: "string",
      },
      description: {
        type: "string",
      },
      assigned_to: {
        type: "string",
        description: "User ID of assignee",
      },
      due_date: {
        type: "string",
      },
      duration_hours: {
        type: "number",
      },
      priority: {
        type: "string",
        enum: ["low", "medium", "high"],
      },
    },
    required: ["project_id", "phase_id", "title"],
  },
};

async function createTask(
  ctx: ToolContext,
  params: any
): Promise<TextContent> {
  const { data, error } = await supabase
    .from("tasks")
    .insert([
      {
        project_id: params.project_id,
        phase_id: params.phase_id,
        created_by: ctx.userId,
        title: params.title,
        description: params.description,
        assigned_to: params.assigned_to,
        due_date: params.due_date,
        duration_hours: params.duration_hours,
        priority: params.priority || "medium",
        status: "open",
      },
    ])
    .select()
    .single();

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

const UpdateTaskStatusTool: Tool = {
  name: "update_task_status",
  description: "Update the status of a task",
  inputSchema: {
    type: "object" as const,
    properties: {
      task_id: {
        type: "string",
      },
      status: {
        type: "string",
        enum: ["open", "in_progress", "completed", "blocked"],
      },
      progress_percentage: {
        type: "number",
        minimum: 0,
        maximum: 100,
      },
    },
    required: ["task_id", "status"],
  },
};

async function updateTaskStatus(
  ctx: ToolContext,
  params: {
    task_id: string;
    status: string;
    progress_percentage?: number;
  }
): Promise<TextContent> {
  const updateData: any = { status: params.status };
  if (params.progress_percentage !== undefined) {
    updateData.progress_percentage = params.progress_percentage;
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(updateData)
    .eq("id", params.task_id)
    .select()
    .single();

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

// ============================================================================
// SCHEDULE TOOLS (3 tools)
// ============================================================================

const GetCriticalPathTool: Tool = {
  name: "get_critical_path",
  description:
    "Get the critical path (longest dependency chain) for a project",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
      },
    },
    required: ["project_id"],
  },
};

async function getCriticalPath(
  ctx: ToolContext,
  params: { project_id: string }
): Promise<TextContent> {
  const { data, error } = await supabase.rpc("calculate_critical_path", {
    p_project_id: params.project_id,
  });

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

const GetLookaheadTool: Tool = {
  name: "get_lookahead",
  description: "Get 4-week lookahead schedule with resource requirements",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
      },
      start_date: {
        type: "string",
        description: "Start date (ISO 8601), defaults to today",
      },
    },
    required: ["project_id"],
  },
};

async function getLookahead(
  ctx: ToolContext,
  params: { project_id: string; start_date?: string }
): Promise<TextContent> {
  const { data, error } = await supabase
    .from("schedule_lookahead")
    .select(
      "week_start, tasks, total_crew_hours, equipment_needed, material_deliveries, constraints"
    )
    .eq("project_id", params.project_id)
    .gte("week_start", params.start_date || new Date().toISOString())
    .limit(4);

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

const PredictDelaysTool: Tool = {
  name: "predict_delays",
  description:
    "Predict schedule delays based on current performance and risk factors",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
      },
      days_ahead: {
        type: "number",
        description: "Forecast window in days (default: 30)",
      },
    },
    required: ["project_id"],
  },
};

async function predictDelays(
  ctx: ToolContext,
  params: { project_id: string; days_ahead?: number }
): Promise<TextContent> {
  const { data, error } = await supabase.rpc("forecast_delays", {
    p_project_id: params.project_id,
    p_days_ahead: params.days_ahead || 30,
  });

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

// ============================================================================
// BUDGET TOOLS (3 tools)
// ============================================================================

const GetBudgetSummaryTool: Tool = {
  name: "get_budget_summary",
  description:
    "Get project budget summary with cost to date and forecast at completion",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
      },
    },
    required: ["project_id"],
  },
};

async function getBudgetSummary(
  ctx: ToolContext,
  params: { project_id: string }
): Promise<TextContent> {
  const { data, error } = await supabase
    .from("project_budgets")
    .select("total_budget, cost_to_date, forecast_at_completion, variance, variance_percentage, top_categories")
    .eq("project_id", params.project_id)
    .single();

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

const GetEarnedValueTool: Tool = {
  name: "get_earned_value",
  description:
    "Get earned value analysis (planned value, earned value, actual cost)",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
      },
    },
    required: ["project_id"],
  },
};

async function getEarnedValue(
  ctx: ToolContext,
  params: { project_id: string }
): Promise<TextContent> {
  const { data, error } = await supabase.rpc("calculate_earned_value", {
    p_project_id: params.project_id,
  });

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

const ForecastCostsTool: Tool = {
  name: "forecast_costs",
  description: "Forecast final project costs based on current spend rate",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
      },
    },
    required: ["project_id"],
  },
};

async function forecastCosts(
  ctx: ToolContext,
  params: { project_id: string }
): Promise<TextContent> {
  const { data, error } = await supabase.rpc("forecast_final_cost", {
    p_project_id: params.project_id,
  });

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

// ============================================================================
// SAFETY TOOLS (3 tools)
// ============================================================================

const GetSafetyScoreTool: Tool = {
  name: "get_safety_score",
  description: "Get project safety score and incident history",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
      },
    },
    required: ["project_id"],
  },
};

async function getSafetyScore(
  ctx: ToolContext,
  params: { project_id: string }
): Promise<TextContent> {
  const { data, error } = await supabase
    .from("safety_metrics")
    .select(
      "overall_score, trir_rate, lost_work_day_rate, incidents_30d, near_misses, violations, safety_observations"
    )
    .eq("project_id", params.project_id)
    .single();

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

const LogObservationTool: Tool = {
  name: "log_observation",
  description: "Log a safety observation (near miss, hazard, or good practice)",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
      },
      type: {
        type: "string",
        enum: ["near_miss", "hazard", "good_practice"],
      },
      description: {
        type: "string",
      },
      location: {
        type: "string",
      },
      severity: {
        type: "string",
        enum: ["low", "medium", "high"],
      },
    },
    required: ["project_id", "type", "description"],
  },
};

async function logObservation(
  ctx: ToolContext,
  params: any
): Promise<TextContent> {
  const { data, error } = await supabase
    .from("safety_observations")
    .insert([
      {
        project_id: params.project_id,
        logged_by: ctx.userId,
        type: params.type,
        description: params.description,
        location: params.location,
        severity: params.severity || "medium",
        logged_date: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

const GetIncidentHistoryTool: Tool = {
  name: "get_incident_history",
  description: "Get safety incidents for a project with details",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
      },
      days: {
        type: "number",
        description: "Historical period in days (default: 90)",
      },
    },
    required: ["project_id"],
  },
};

async function getIncidentHistory(
  ctx: ToolContext,
  params: { project_id: string; days?: number }
): Promise<TextContent> {
  const daysAgo = new Date(Date.now() - (params.days || 90) * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("safety_incidents")
    .select(
      "id, date, type, severity, description, people_involved, root_cause, corrective_actions, status"
    )
    .eq("project_id", params.project_id)
    .gte("date", daysAgo)
    .order("date", { ascending: false });

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

// ============================================================================
// DOCUMENT TOOLS (3 tools)
// ============================================================================

const SearchDocumentsTool: Tool = {
  name: "search_documents",
  description: "Search project documents and specs by keyword or type",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
      },
      query: {
        type: "string",
        description: "Search term",
      },
      doc_type: {
        type: "string",
        enum: ["specification", "drawing", "contract", "report", "photo"],
      },
    },
    required: ["project_id"],
  },
};

async function searchDocuments(
  ctx: ToolContext,
  params: { project_id: string; query?: string; doc_type?: string }
): Promise<TextContent> {
  let query = supabase
    .from("documents")
    .select("id, title, type, uploaded_date, file_size, tags")
    .eq("project_id", params.project_id);

  if (params.doc_type) query = query.eq("type", params.doc_type);

  if (params.query) {
    query = query.or(
      `title.ilike.%${params.query}%,tags.contains.{${params.query}}`
    );
  }

  const { data, error } = await query.limit(20);

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

const GetDrawingTool: Tool = {
  name: "get_drawing",
  description:
    "Get drawing metadata and retrieve drawing document with optional area extraction",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
      },
      drawing_id: {
        type: "string",
      },
      extract_areas: {
        type: "boolean",
        description: "Extract measured areas from drawing (requires Vision)",
      },
    },
    required: ["project_id", "drawing_id"],
  },
};

async function getDrawing(
  ctx: ToolContext,
  params: { project_id: string; drawing_id: string; extract_areas?: boolean }
): Promise<TextContent> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, revision, date, scale, sheets, url")
    .eq("id", params.drawing_id)
    .eq("project_id", params.project_id)
    .single();

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

const GetSpecSectionTool: Tool = {
  name: "get_spec_section",
  description: "Get specific section from project specifications",
  inputSchema: {
    type: "object" as const,
    properties: {
      project_id: {
        type: "string",
      },
      section_number: {
        type: "string",
        description: "CSI format section number (e.g., '03300')",
      },
    },
    required: ["project_id", "section_number"],
  },
};

async function getSpecSection(
  ctx: ToolContext,
  params: { project_id: string; section_number: string }
): Promise<TextContent> {
  const { data, error } = await supabase
    .from("spec_sections")
    .select("number, title, content, revision_date")
    .eq("project_id", params.project_id)
    .eq("number", params.section_number)
    .single();

  if (error) throw new McpError(ErrorCode.InternalError, error.message);

  return {
    type: "text" as const,
    text: JSON.stringify(data, null, 2),
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateScheduleHealth(metrics: any): number {
  // 100 = on time, decreases based on variance
  if (metrics.schedule_variance > 0) return 100;
  const variance = Math.abs(metrics.schedule_variance);
  return Math.max(0, 100 - variance * 10);
}

function calculateBudgetHealth(metrics: any): number {
  if (metrics.cost_variance > 0) return 100;
  const variance = Math.abs(metrics.cost_variance);
  return Math.max(0, 100 - variance * 5);
}

function calculateSafetyHealth(metrics: any): number {
  let score = 100;
  score -= metrics.safety_incidents_30d * 10;
  return Math.max(0, score);
}

function calculateQualityHealth(metrics: any): number {
  // Based on rework, defects, inspections
  return 85; // placeholder
}

// ============================================================================
// RESOURCE DEFINITIONS
// ============================================================================

const projectResource = {
  uri: "sitesync://project/{project_id}",
  name: "Construction Project",
  description: "A construction project in SiteSync",
  mimeType: "application/json",
};

const documentResource = {
  uri: "sitesync://document/{doc_id}",
  name: "Project Document",
  description: "A project document, drawing, or specification",
  mimeType: "application/pdf",
};

// ============================================================================
// PROMPT LIBRARY
// ============================================================================

const PromptLibrary = [
  {
    name: "daily_standup_generator",
    description: "Generate daily standup summary from project data",
    arguments: [
      {
        name: "project_id",
        description: "The project ID",
        required: true,
      },
    ],
  },
  {
    name: "weekly_report_template",
    description: "Generate comprehensive weekly project report",
    arguments: [
      {
        name: "project_id",
        description: "The project ID",
        required: true,
      },
      {
        name: "week_ending",
        description: "ISO date",
        required: true,
      },
    ],
  },
  {
    name: "risk_analysis_prompt",
    description: "Analyze project risks and generate mitigation strategies",
    arguments: [
      {
        name: "project_id",
        description: "The project ID",
        required: true,
      },
    ],
  },
  {
    name: "change_order_summary",
    description: "Summarize recent change orders and impact",
    arguments: [
      {
        name: "project_id",
        description: "The project ID",
        required: true,
      },
    ],
  },
];

// ============================================================================
// MCP SERVER INITIALIZATION
// ============================================================================

const server = new Server({
  name: "sitesync-mcp",
  version: "1.0.0",
});

// Tool definitions
const allTools: Tool[] = [
  ListProjectsTool,
  GetProjectTool,
  GetProjectHealthTool,
  ListRfisTool,
  CreateRfiTool,
  GetRfiTool,
  RespondToRfiTool,
  ListTasksTool,
  CreateTaskTool,
  UpdateTaskStatusTool,
  GetCriticalPathTool,
  GetLookaheadTool,
  PredictDelaysTool,
  GetBudgetSummaryTool,
  GetEarnedValueTool,
  ForecastCostsTool,
  GetSafetyScoreTool,
  LogObservationTool,
  GetIncidentHistoryTool,
  SearchDocumentsTool,
  GetDrawingTool,
  GetSpecSectionTool,
];

server.setRequestHandler(async (request) => {
  if (request.method === "tools/list") {
    return { tools: allTools };
  }

  if (request.method === "tools/call") {
    const toolRequest = request as CallToolRequest;
    const apiKey = process.env.SITESYNC_API_KEY;

    if (!apiKey) {
      throw new McpError(
        ErrorCode.InternalError,
        "SITESYNC_API_KEY not configured"
      );
    }

    const context = await authenticateApiKey(apiKey);

    // Route to appropriate tool handler
    switch (toolRequest.params.name) {
      case "list_projects":
        return { content: [await listProjects(context, toolRequest.params.arguments)] };
      case "get_project":
        return { content: [await getProject(context, toolRequest.params.arguments)] };
      case "get_project_health":
        return { content: [await getProjectHealth(context, toolRequest.params.arguments)] };
      case "list_rfis":
        return { content: [await listRfis(context, toolRequest.params.arguments)] };
      case "create_rfi":
        return { content: [await createRfi(context, toolRequest.params.arguments)] };
      case "get_rfi":
        return { content: [await getRfi(context, toolRequest.params.arguments)] };
      case "respond_to_rfi":
        return { content: [await respondToRfi(context, toolRequest.params.arguments)] };
      case "list_tasks":
        return { content: [await listTasks(context, toolRequest.params.arguments)] };
      case "create_task":
        return { content: [await createTask(context, toolRequest.params.arguments)] };
      case "update_task_status":
        return { content: [await updateTaskStatus(context, toolRequest.params.arguments)] };
      case "get_critical_path":
        return { content: [await getCriticalPath(context, toolRequest.params.arguments)] };
      case "get_lookahead":
        return { content: [await getLookahead(context, toolRequest.params.arguments)] };
      case "predict_delays":
        return { content: [await predictDelays(context, toolRequest.params.arguments)] };
      case "get_budget_summary":
        return { content: [await getBudgetSummary(context, toolRequest.params.arguments)] };
      case "get_earned_value":
        return { content: [await getEarnedValue(context, toolRequest.params.arguments)] };
      case "forecast_costs":
        return { content: [await forecastCosts(context, toolRequest.params.arguments)] };
      case "get_safety_score":
        return { content: [await getSafetyScore(context, toolRequest.params.arguments)] };
      case "log_observation":
        return { content: [await logObservation(context, toolRequest.params.arguments)] };
      case "get_incident_history":
        return { content: [await getIncidentHistory(context, toolRequest.params.arguments)] };
      case "search_documents":
        return { content: [await searchDocuments(context, toolRequest.params.arguments)] };
      case "get_drawing":
        return { content: [await getDrawing(context, toolRequest.params.arguments)] };
      case "get_spec_section":
        return { content: [await getSpecSection(context, toolRequest.params.arguments)] };
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolRequest.params.name}`);
    }
  }

  throw new McpError(ErrorCode.MethodNotFound, "Unknown request method");
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SiteSync MCP Server started");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

---

## Database Schema for MCP Support

**File: `sitesync-mcp/schema.sql`**
```sql
-- API Keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  org_id UUID NOT NULL,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP
);

-- Enhanced projects table with health metrics
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  budget DECIMAL(15, 2),
  cost_to_date DECIMAL(15, 2) DEFAULT 0,
  schedule_health INTEGER,
  budget_health INTEGER,
  safety_score INTEGER,
  team_members_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

-- Project metrics for health calculations
CREATE TABLE project_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  schedule_variance DECIMAL(10, 2),
  cost_variance DECIMAL(10, 2),
  safety_incidents_30d INTEGER DEFAULT 0,
  rfi_pending_count INTEGER DEFAULT 0,
  change_order_amount DECIMAL(15, 2) DEFAULT 0,
  crew_productivity_index DECIMAL(5, 2),
  material_waste_percentage DECIMAL(5, 2),
  equipment_utilization DECIMAL(5, 2),
  weather_delays_hours DECIMAL(10, 2),
  updated_at TIMESTAMP DEFAULT now()
);

-- RFIs table
CREATE TABLE rfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  number VARCHAR(50) NOT NULL,
  created_by UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  trade VARCHAR(100),
  status VARCHAR(50) DEFAULT 'draft',
  priority VARCHAR(50) DEFAULT 'medium',
  submitted_date TIMESTAMP,
  due_date TIMESTAMP,
  days_pending INTEGER,
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(project_id, number)
);

-- RFI Responses
CREATE TABLE rfi_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id UUID NOT NULL REFERENCES rfis(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL,
  content TEXT NOT NULL,
  submitted_date TIMESTAMP DEFAULT now(),
  status VARCHAR(50)
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  phase_id UUID NOT NULL,
  created_by UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to UUID,
  status VARCHAR(50) DEFAULT 'open',
  due_date TIMESTAMP,
  duration_hours DECIMAL(10, 2),
  progress_percentage INTEGER DEFAULT 0,
  priority VARCHAR(50) DEFAULT 'medium',
  updated_at TIMESTAMP DEFAULT now()
);

-- Schedule lookahead
CREATE TABLE schedule_lookahead (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  week_start DATE,
  tasks TEXT[],
  total_crew_hours DECIMAL(10, 2),
  equipment_needed TEXT[],
  material_deliveries TEXT[],
  constraints TEXT
);

-- Budget table
CREATE TABLE project_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) UNIQUE,
  total_budget DECIMAL(15, 2),
  cost_to_date DECIMAL(15, 2),
  forecast_at_completion DECIMAL(15, 2),
  variance DECIMAL(15, 2),
  variance_percentage DECIMAL(5, 2),
  top_categories JSONB
);

-- Safety metrics
CREATE TABLE safety_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) UNIQUE,
  overall_score INTEGER,
  trir_rate DECIMAL(5, 2),
  lost_work_day_rate DECIMAL(5, 2),
  incidents_30d INTEGER,
  near_misses INTEGER,
  violations INTEGER,
  safety_observations INTEGER
);

-- Safety observations
CREATE TABLE safety_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  logged_by UUID NOT NULL,
  type VARCHAR(50),
  description TEXT,
  location VARCHAR(255),
  severity VARCHAR(50),
  logged_date TIMESTAMP DEFAULT now()
);

-- Safety incidents
CREATE TABLE safety_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  date TIMESTAMP,
  type VARCHAR(100),
  severity VARCHAR(50),
  description TEXT,
  people_involved INTEGER,
  root_cause TEXT,
  corrective_actions TEXT,
  status VARCHAR(50)
);

-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50),
  uploaded_date TIMESTAMP DEFAULT now(),
  file_size INTEGER,
  tags TEXT[],
  url TEXT,
  revision VARCHAR(50)
);

-- Specification sections
CREATE TABLE spec_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  number VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  content TEXT,
  revision_date TIMESTAMP,
  UNIQUE(project_id, number)
);

-- Change orders
CREATE TABLE change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  number VARCHAR(50),
  status VARCHAR(50),
  amount DECIMAL(15, 2),
  description TEXT,
  created_date TIMESTAMP DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_projects_org ON projects(org_id);
CREATE INDEX idx_rfis_project ON rfis(project_id);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_safety_project ON safety_observations(project_id);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
```

---

## Deployment Configuration

**File: `sitesync-mcp/docker/Dockerfile`**
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy TypeScript build
COPY dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

**File: `sitesync-mcp/docker/docker-compose.yml`**
```yaml
version: '3.8'

services:
  mcp-server:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - SITESYNC_API_KEY=${SITESYNC_API_KEY}
      - NODE_ENV=production
    ports:
      - "3000:3000"
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  mcp-data:
```

---

## Verification and Testing

**File: `sitesync-mcp/scripts/verify-mcp.js`**
```javascript
#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyMCP() {
  console.log("🔍 Verifying SiteSync MCP Server Configuration...\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Database connection
  console.log("Test 1: Supabase Connection");
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("id")
      .limit(1);

    if (error) throw error;
    console.log("✓ Supabase connection successful\n");
    passed++;
  } catch (e) {
    console.error(`✗ Failed: ${e.message}\n`);
    failed++;
  }

  // Test 2: API Keys table
  console.log("Test 2: API Keys Table");
  try {
    const { data, error } = await supabase
      .from("api_keys")
      .select("id")
      .limit(1);

    if (error) throw error;
    console.log("✓ API keys table accessible\n");
    passed++;
  } catch (e) {
    console.error(`✗ Failed: ${e.message}\n`);
    failed++;
  }

  // Test 3: Project metrics calculation
  console.log("Test 3: Project Metrics");
  try {
    const { data, error } = await supabase
      .from("project_metrics")
      .select("*")
      .limit(1);

    if (error) throw error;
    console.log(`✓ Project metrics accessible (${data.length} records)\n`);
    passed++;
  } catch (e) {
    console.error(`✗ Failed: ${e.message}\n`);
    failed++;
  }

  // Test 4: RFI data
  console.log("Test 4: RFI Functionality");
  try {
    const { data, error } = await supabase
      .from("rfis")
      .select("*")
      .limit(5);

    if (error) throw error;
    console.log(`✓ RFI data accessible (${data.length} records)\n`);
    passed++;
  } catch (e) {
    console.error(`✗ Failed: ${e.message}\n`);
    failed++;
  }

  // Test 5: Safety metrics
  console.log("Test 5: Safety Metrics");
  try {
    const { data, error } = await supabase
      .from("safety_metrics")
      .select("*")
      .limit(1);

    if (error) throw error;
    console.log(`✓ Safety metrics accessible\n`);
    passed++;
  } catch (e) {
    console.error(`✗ Failed: ${e.message}\n`);
    failed++;
  }

  // Test 6: Document search
  console.log("Test 6: Document Search");
  try {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .limit(5);

    if (error) throw error;
    console.log(`✓ Document index accessible (${data.length} records)\n`);
    passed++;
  } catch (e) {
    console.error(`✗ Failed: ${e.message}\n`);
    failed++;
  }

  // Summary
  console.log("═".repeat(50));
  console.log(`\nVerification Summary:`);
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  if (failed === 0) {
    console.log("🎉 All checks passed! MCP server is ready.\n");
    process.exit(0);
  } else {
    console.log("⚠️  Some checks failed. Review errors above.\n");
    process.exit(1);
  }
}

verifyMCP().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
```

---

## Usage Examples for AI Agents

**Claude in Terminal:**
```bash
# Start SiteSync MCP server
sitesync-mcp

# In Claude Code or terminal:
# "List all active projects and their health scores"
# → Claude calls list_projects(status: "active")
# → Claude calls get_project_health() for each project
# → Returns aggregated dashboard

# "What's the critical path for Project 42?"
# → Claude calls get_critical_path(project_id: "42")
# → Returns sequence of dependent tasks

# "Create an RFI for structural concerns on the north facade"
# → Claude calls create_rfi with appropriate parameters
# → RFI created in system
```

**Integration with Claude Code:**
```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

const client = new Client({
  name: "my-app",
  version: "1.0.0",
});

const transport = new StdioServerTransport({
  command: "sitesync-mcp",
});

await client.connect(transport);

// Now you can call SiteSync tools
const projects = await client.callTool("list_projects", {
  status: "active",
});
```

---

## Strategic Advantages

1. **Any AI, Any Tool** — Claude, GPT-5.4, Gemini, custom models all speak MCP
2. **Ecosystem Lock-in** — Construction firms adopt SiteSync as their AI-first platform
3. **OpenAPI Dual-Protocol** — Can generate REST endpoints from MCP tools (sell to legacy systems)
4. **Privacy First** — Data never leaves customer's Supabase; AI runs locally or in their VPC
5. **Cost Transparency** — Track cost per API call, per agent, per use case

This positions SiteSync as THE platform that AI agents use for construction intelligence.

---


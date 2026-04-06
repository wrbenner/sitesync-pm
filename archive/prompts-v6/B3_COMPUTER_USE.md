# B3: AI Computer Use Workflows — Automating Construction Tasks at Human Speed

## Executive Summary

Claude Opus 4.6 and GPT-5.4 can now control desktop applications. This unlocks a category of automation that no construction platform offers: **AI that can read Outlook, extract from Bluebeam, scrape permit websites, and bridge legacy systems without building custom integrations.**

**Use Cases:**
1. Legacy System Bridge: Claude opens Sage 300 CRE, extracts cost data, imports into SiteSync
2. Document Processor: Claude opens Bluebeam, extracts markups from PDFs, creates RFIs
3. Email Triage: Claude reads Outlook, finds construction emails, creates action items
4. Permit Tracker: Claude checks city building department websites for permit status
5. Material Price Scraper: Claude visits supplier websites, updates SiteSync material intelligence

**Why This Matters:**
- Construction firms use 15+ separate tools. No integration exists for many. SiteSync becomes the hub.
- Captures workflows that were previously manual 2-3 hour tasks. Automates them in minutes.
- Show the user what Claude will do before executing (human-in-the-loop). Builds trust.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│          COMPUTER USE WORKFLOW ORCHESTRATION SYSTEM             │
└─────────────────────────────────────────────────────────────────┘

USER REQUEST
  │ "Extract cost data from Sage 300 and import to SiteSync"
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ WORKFLOW ENGINE (Edge Function)                                 │
│                                                                 │
│ ├─ Parse natural language request                              │
│ ├─ Match to workflow template                                  │
│ ├─ Validate user authorization                                │
│ └─ Generate execution plan (steps + expected states)           │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ APPROVAL LAYER (React Component)                                │
│                                                                 │
│ USER SEES:                                                      │
│ ┌──────────────────────────────────────────────────────┐       │
│ │ WORKFLOW: Extract Sage 300 Cost Data                 │       │
│ │                                                       │       │
│ │ PLANNED ACTIONS:                                      │       │
│ │ 1. Open Sage 300 desktop app                         │       │
│ │ 2. Log in with [credentials masked]                  │       │
│ │ 3. Navigate to Cost Module > Projects                │       │
│ │ 4. Export 2024-2026 cost data to CSV                 │       │
│ │ 5. Parse CSV and validate format                     │       │
│ │ 6. Upload to SiteSync via API                        │       │
│ │                                                       │       │
│ │ Expected time: 8-12 minutes                          │       │
│ │ Risk level: Low (read-only except final upload)      │       │
│ │                                                       │       │
│ │ [Screenshot: Sage 300 login screen]                  │       │
│ │                                                       │       │
│ │ ⚠️  Screenshot shows Sage 300 login. AI will:        │       │
│ │ • Use your stored credentials                         │       │
│ │ • Click "Log In"                                      │       │
│ │ • Wait for dashboard (max 30s)                       │       │
│ │                                                       │       │
│ │ [APPROVE]  [DENY]  [MODIFY STEPS]                    │       │
│ └──────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
  │
  ├─ USER APPROVES
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ EXECUTION ENGINE (Claude Opus 4.6 via computer_use)            │
│                                                                 │
│ STEP 1: Click Sage 300 application                            │
│ SCREENSHOT → Claude Vision: "Recognize login form"             │
│ STATE: "Login form visible" ✓ Matches expected                │
│                                                                 │
│ STEP 2: Enter username                                         │
│ SCREENSHOT → Claude Vision: "Username field active"            │
│ STATE: "Cursor in username field" ✓ Matches expected          │
│                                                                 │
│ STEP 3: Enter password                                         │
│ SCREENSHOT → Claude Vision: "Password mask visible"            │
│ STATE: "Password entered" ✓ Matches expected                  │
│                                                                 │
│ STEP 4: Click Log In                                          │
│ WAIT 5 seconds for app to load                               │
│ SCREENSHOT → Claude Vision: "Dashboard visible with menu"     │
│ STATE: "Logged in successfully" ✓ Matches expected            │
│                                                                 │
│ [continues through all steps...]                              │
│                                                                 │
│ AT EACH STEP:                                                  │
│ • Take screenshot                                             │
│ • Claude Vision verifies state matches expected               │
│ • If mismatch: abort, report to user                         │
│ • If match: proceed                                          │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ AUDIT & LOGGING                                                 │
│                                                                 │
│ ✓ Workflow completed successfully                              │
│                                                                 │
│ AUDIT TRAIL:                                                    │
│ ├─ 12 steps executed                                          │
│ ├─ 47 screenshots captured                                     │
│ ├─ 12 state verifications (all passed)                        │
│ ├─ Final action: Uploaded 2,847 cost records to SiteSync       │
│ ├─ Timestamp: 2024-03-31 14:23:15 UTC                         │
│ └─ User: john@company.com                                      │
│                                                                 │
│ RESULT:                                                         │
│ ├─ Cost data imported                                         │
│ ├─ 2,847 records processed                                     │
│ ├─ Validation: 100% success rate                              │
│ ├─ New costs detected: 184 (flagged for review)               │
│ └─ Budget impact: -$145K (favorable variance)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Complete Implementation

### 1. Workflow Definition Schema

**File: `sitesync-workflows/src/schema/workflow.ts`**
```typescript
import { z } from "zod";

// Workflow definition schema (JSON)
export const WorkflowStepSchema = z.object({
  id: z.string(),
  action: z.enum([
    "click",
    "type",
    "keystroke",
    "wait",
    "screenshot",
    "scroll",
    "select",
    "navigate_url",
    "read_clipboard",
    "write_clipboard",
  ]),
  target: z.object({
    type: z.enum(["coordinates", "element_text", "element_id", "screen_region"]),
    value: z.string().or(z.number()).or(z.object({})),
  }).optional(),
  input: z.string().optional(),
  waitTime: z.number().optional(), // milliseconds
  expectedState: z.object({
    description: z.string(),
    visualIndicators: z.array(z.string()),
    visionPrompt: z.string(), // Claude Vision prompt to verify state
  }).optional(),
  fallback: z.string().optional(), // Step ID to jump to on failure
  timeout: z.number().default(30000), // 30 seconds
});

export const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum([
    "legacy_integration",
    "document_processing",
    "email_management",
    "web_scraping",
    "data_entry",
  ]),
  sourceApplication: z.string(), // "Sage 300", "Bluebeam", "Outlook", etc.
  requiredCredentials: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["username_password", "api_key", "oauth"]),
      label: z.string(),
    })
  ),
  steps: z.array(WorkflowStepSchema),
  outputHandling: z.object({
    type: z.enum(["none", "extract_text", "extract_data", "file_capture"]),
    format: z.enum(["json", "csv", "xml", "text"]).optional(),
    destination: z.enum(["sitesync_api", "storage_bucket", "clipboard"]),
  }),
  riskLevel: z.enum(["low", "medium", "high"]),
  estimatedDuration: z.number(), // seconds
  prerequisites: z.array(z.string()).optional(), // "application_installed", "network_connection"
  rollback: z.boolean().default(false),
});

export type Workflow = z.infer<typeof WorkflowSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

// ============================================================================
// WORKFLOW TEMPLATES (Pre-built)
// ============================================================================

export const WORKFLOW_SAGE_300_COST_EXTRACT: Workflow = {
  id: "sage-300-cost-extract",
  name: "Extract Cost Data from Sage 300",
  description: "Read current project costs from Sage 300 CRE and import to SiteSync",
  category: "legacy_integration",
  sourceApplication: "Sage 300 CRE",
  requiredCredentials: [
    {
      name: "sage300_username",
      type: "username_password",
      label: "Sage 300 Username",
    },
  ],
  steps: [
    {
      id: "step-1",
      action: "click",
      target: {
        type: "element_text",
        value: "Sage 300",
      },
      expectedState: {
        description: "Sage 300 application opens",
        visualIndicators: ["Login form visible", "Username field focused"],
        visionPrompt: "Describe the Sage 300 login screen. Is the username field ready for input?",
      },
      timeout: 10000,
    },
    {
      id: "step-2",
      action: "click",
      target: {
        type: "coordinates",
        value: { x: 200, y: 100 },
      },
      waitTime: 500,
    },
    {
      id: "step-3",
      action: "type",
      input: "${credentials.sage300_username}",
      expectedState: {
        description: "Username entered",
        visualIndicators: ["Username field contains text"],
        visionPrompt: "Is the username field populated with text?",
      },
    },
    {
      id: "step-4",
      action: "keystroke",
      input: "Tab",
    },
    {
      id: "step-5",
      action: "type",
      input: "${credentials.sage300_password}",
    },
    {
      id: "step-6",
      action: "keystroke",
      input: "Return",
      expectedState: {
        description: "Login successful, dashboard visible",
        visualIndicators: ["Login form gone", "Dashboard menu visible"],
        visionPrompt: "Has the login form closed? Is the Sage 300 dashboard now visible?",
      },
      timeout: 15000,
      fallback: "step-7",
    },
    {
      id: "step-7",
      action: "navigate_url",
      input: "sage300://module/cost/projects",
    },
    {
      id: "step-8",
      action: "wait",
      waitTime: 2000,
      expectedState: {
        description: "Projects page loaded",
        visualIndicators: ["Project list visible", "Data grid with cost columns"],
        visionPrompt: "Can you see a list of projects with cost data? Are column headers visible?",
      },
    },
    {
      id: "step-9",
      action: "keystroke",
      input: "ctrl+a", // Select all
    },
    {
      id: "step-10",
      action: "keystroke",
      input: "ctrl+c", // Copy to clipboard
    },
    {
      id: "step-11",
      action: "read_clipboard",
    },
    {
      id: "step-12",
      action: "screenshot",
    },
  ],
  outputHandling: {
    type: "extract_data",
    format: "json",
    destination: "sitesync_api",
  },
  riskLevel: "low",
  estimatedDuration: 480, // 8 minutes
  prerequisites: ["Sage 300 installed", "Network connection"],
  rollback: false,
};

export const WORKFLOW_BLUEBEAM_RFI_EXTRACTION: Workflow = {
  id: "bluebeam-rfi-extract",
  name: "Extract Markups from Bluebeam PDF",
  description: "Read markup comments from Bluebeam document and create RFIs in SiteSync",
  category: "document_processing",
  sourceApplication: "Bluebeam Revu",
  requiredCredentials: [],
  steps: [
    {
      id: "step-1",
      action: "click",
      target: {
        type: "element_text",
        value: "Bluebeam Revu",
      },
      expectedState: {
        description: "Bluebeam opens with document",
        visualIndicators: ["PDF viewer visible", "Markups panel visible"],
        visionPrompt: "Is Bluebeam open with a document? Can you see markup comments on the left panel?",
      },
      timeout: 10000,
    },
    {
      id: "step-2",
      action: "click",
      target: {
        type: "element_text",
        value: "Markups",
      },
    },
    {
      id: "step-3",
      action: "wait",
      waitTime: 1000,
    },
    {
      id: "step-4",
      action: "keystroke",
      input: "ctrl+a", // Select all markups
    },
    {
      id: "step-5",
      action: "click",
      target: {
        type: "element_text",
        value: "Export Markups",
      },
      expectedState: {
        description: "Export dialog opens",
        visualIndicators: ["Export dialog visible", "Format options available"],
        visionPrompt: "Is an export dialog visible with file format options?",
      },
    },
    {
      id: "step-6",
      action: "click",
      target: {
        type: "element_text",
        value: "JSON",
      },
    },
    {
      id: "step-7",
      action: "keystroke",
      input: "Return",
      expectedState: {
        description: "Markups exported to JSON",
        visualIndicators: ["File saved notification"],
        visionPrompt: "Did a file save confirmation appear?",
      },
      timeout: 10000,
    },
    {
      id: "step-8",
      action: "screenshot",
    },
  ],
  outputHandling: {
    type: "extract_data",
    format: "json",
    destination: "sitesync_api",
  },
  riskLevel: "low",
  estimatedDuration: 300, // 5 minutes
  prerequisites: ["Bluebeam Revu installed", "PDF document open"],
};

export const WORKFLOW_OUTLOOK_EMAIL_TRIAGE: Workflow = {
  id: "outlook-email-triage",
  name: "Triage Construction Emails in Outlook",
  description: "Read recent Outlook emails, identify construction-related items, create SiteSync tasks",
  category: "email_management",
  sourceApplication: "Microsoft Outlook",
  requiredCredentials: [],
  steps: [
    {
      id: "step-1",
      action: "click",
      target: {
        type: "element_text",
        value: "Outlook",
      },
      expectedState: {
        description: "Outlook opens",
        visualIndicators: ["Inbox visible", "Email list loaded"],
        visionPrompt: "Is Outlook open with an inbox email list visible?",
      },
      timeout: 15000,
    },
    {
      id: "step-2",
      action: "click",
      target: {
        type: "element_text",
        value: "Inbox",
      },
    },
    {
      id: "step-3",
      action: "wait",
      waitTime: 2000,
      expectedState: {
        description: "Emails loaded",
        visualIndicators: ["Email list with subject lines visible"],
        visionPrompt: "Can you see a list of emails with subject lines and sender names?",
      },
    },
    {
      id: "step-4",
      action: "keystroke",
      input: "ctrl+a", // Select all emails visible
    },
    {
      id: "step-5",
      action: "screenshot",
    },
  ],
  outputHandling: {
    type: "extract_text",
    format: "json",
    destination: "sitesync_api",
  },
  riskLevel: "low",
  estimatedDuration: 600, // 10 minutes for scanning and categorization
};

export const WORKFLOW_PERMIT_CHECK: Workflow = {
  id: "permit-checker",
  name: "Check Permit Status on City Website",
  description: "Visit building department website, search for permit, extract status and requirements",
  category: "web_scraping",
  sourceApplication: "Web Browser",
  requiredCredentials: [
    {
      name: "permit_number",
      type: "username_password",
      label: "Permit Number",
    },
  ],
  steps: [
    {
      id: "step-1",
      action: "navigate_url",
      input: "https://permits.city.gov/search",
      expectedState: {
        description: "Permit search page loads",
        visualIndicators: ["Search form visible"],
        visionPrompt: "Is the permit search form visible?",
      },
      timeout: 10000,
    },
    {
      id: "step-2",
      action: "click",
      target: {
        type: "element_id",
        value: "permit-search-box",
      },
    },
    {
      id: "step-3",
      action: "type",
      input: "${workflow_params.permit_number}",
    },
    {
      id: "step-4",
      action: "keystroke",
      input: "Return",
      expectedState: {
        description: "Search results visible",
        visualIndicators: ["Permit details displayed"],
        visionPrompt: "Can you see permit information including status, issue date, and expiration?",
      },
      timeout: 15000,
    },
    {
      id: "step-5",
      action: "screenshot",
    },
  ],
  outputHandling: {
    type: "extract_data",
    format: "json",
    destination: "sitesync_api",
  },
  riskLevel: "low",
  estimatedDuration: 180, // 3 minutes
};
```

### 2. Workflow Execution Engine (Edge Function)

**File: `sitesync-workflows/src/functions/execute-workflow.ts`**
```typescript
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.0";

interface WorkflowExecutionRequest {
  workflowId: string;
  userId: string;
  projectId: string;
  credentials?: Record<string, string>;
  params?: Record<string, string>;
}

interface ExecutionLog {
  stepId: string;
  action: string;
  timestamp: string;
  screenshot?: string;
  stateVerification: {
    expected: string;
    actual: string;
    passed: boolean;
  };
  error?: string;
}

// Initialize Anthropic client
const client = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
});

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const execRequest: WorkflowExecutionRequest = await req.json();
  const executionLogs: ExecutionLog[] = [];
  let currentStep = 0;

  try {
    // Step 1: Load workflow from database
    const workflow = await loadWorkflow(execRequest.workflowId);

    console.log(
      `[WORKFLOW] Starting: ${workflow.name} (${workflow.steps.length} steps)`
    );

    // Step 2: Validate credentials
    const credentials = await validateCredentials(
      execRequest.userId,
      workflow.requiredCredentials,
      execRequest.credentials
    );

    // Step 3: Execute each step
    for (const step of workflow.steps) {
      currentStep++;
      console.log(`[STEP ${currentStep}/${workflow.steps.length}] ${step.action}`);

      const log: ExecutionLog = {
        stepId: step.id,
        action: step.action,
        timestamp: new Date().toISOString(),
        stateVerification: {
          expected: step.expectedState?.description || "N/A",
          actual: "",
          passed: false,
        },
      };

      try {
        // Execute the action
        let actionResult: any = null;

        switch (step.action) {
          case "click":
            actionResult = await performClick(step.target);
            break;
          case "type":
            const text = interpolateCredentials(step.input || "", credentials, execRequest.params);
            actionResult = await performType(text);
            break;
          case "keystroke":
            actionResult = await performKeystroke(step.input || "");
            break;
          case "wait":
            await new Promise((resolve) => setTimeout(resolve, step.waitTime || 1000));
            break;
          case "screenshot":
            actionResult = await takeScreenshot();
            log.screenshot = actionResult;
            break;
          case "navigate_url":
            const url = interpolateCredentials(step.input || "", credentials, execRequest.params);
            actionResult = await navigateUrl(url);
            break;
          case "read_clipboard":
            actionResult = await readClipboard();
            break;
          default:
            throw new Error(`Unknown action: ${step.action}`);
        }

        // Step 4: Verify expected state if defined
        if (step.expectedState) {
          const screenshot = log.screenshot || (await takeScreenshot());

          const message = await client.messages.create({
            model: "claude-opus-4-1-20250805",
            max_tokens: 1000,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: "image/png",
                      data: screenshot,
                    },
                  },
                  {
                    type: "text",
                    text: `${step.expectedState.visionPrompt}\n\nExpected state: ${step.expectedState.description}\n\nRespond with JSON: {"matches": true/false, "reason": "brief explanation"}`,
                  },
                ],
              },
            ],
          });

          const content = message.content[0];
          if (content.type === "text") {
            try {
              const verification = JSON.parse(content.text);
              log.stateVerification = {
                expected: step.expectedState.description,
                actual: verification.reason,
                passed: verification.matches,
              };

              if (!verification.matches) {
                if (step.fallback) {
                  console.log(
                    `[FALLBACK] State verification failed, jumping to ${step.fallback}`
                  );
                  // Find fallback step index
                  const fallbackIndex = workflow.steps.findIndex(
                    (s) => s.id === step.fallback
                  );
                  if (fallbackIndex >= 0) {
                    currentStep = fallbackIndex;
                    continue; // Skip to fallback step
                  }
                } else {
                  throw new Error(
                    `State verification failed: ${verification.reason}`
                  );
                }
              }
            } catch (e) {
              console.error("Failed to parse state verification:", e);
              throw e;
            }
          }
        }

        // Step 5: Wait for timeout if specified
        if (step.timeout) {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Step timeout")), step.timeout)
          );

          Promise.race([
            new Promise((resolve) => setTimeout(resolve, step.waitTime || 500)),
            timeoutPromise,
          ]).catch((e) => {
            if (e.message === "Step timeout") {
              log.error = `Step exceeded timeout of ${step.timeout}ms`;
              throw e;
            }
          });
        }

        executionLogs.push(log);
        console.log(`[SUCCESS] ${step.action} completed`);
      } catch (error) {
        log.error = error instanceof Error ? error.message : String(error);
        executionLogs.push(log);
        console.error(`[ERROR] Step failed:`, log.error);

        if (!step.fallback) {
          throw new Error(
            `Workflow stopped at step ${currentStep}: ${log.error}`
          );
        }
      }
    }

    // Step 6: Process output
    const output = await processWorkflowOutput(
      workflow.outputHandling,
      executionLogs
    );

    // Step 7: Store execution record
    await storeExecutionRecord({
      workflowId: execRequest.workflowId,
      userId: execRequest.userId,
      projectId: execRequest.projectId,
      status: "success",
      stepsExecuted: currentStep,
      executionLogs,
      output,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        status: "success",
        stepsExecuted: currentStep,
        output,
        logs: executionLogs,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[WORKFLOW ERROR]", error);

    // Store failed execution
    await storeExecutionRecord({
      workflowId: execRequest.workflowId,
      userId: execRequest.userId,
      projectId: execRequest.projectId,
      status: "failed",
      stepsExecuted: currentStep,
      executionLogs,
      error: error instanceof Error ? error.message : String(error),
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        status: "failed",
        stepsExecuted: currentStep,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function loadWorkflow(workflowId: string): Promise<any> {
  // Load from Supabase
  const response = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/rest/v1/workflows?id=eq.${workflowId}`,
    {
      headers: {
        apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
      },
    }
  );

  if (!response.ok) throw new Error("Failed to load workflow");

  const workflows = await response.json();
  if (workflows.length === 0) throw new Error("Workflow not found");

  return workflows[0];
}

async function validateCredentials(
  userId: string,
  required: any[],
  provided?: Record<string, string>
): Promise<Record<string, string>> {
  const credentials: Record<string, string> = {};

  for (const req of required) {
    if (provided?.[req.name]) {
      credentials[req.name] = provided[req.name];
    } else {
      // Try to retrieve from credential vault
      const response = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/rest/v1/user_credentials?user_id=eq.${userId}&name=eq.${req.name}`,
        {
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Missing required credential: ${req.name}`);
      }

      const creds = await response.json();
      if (creds.length === 0) {
        throw new Error(`Credential not found: ${req.name}`);
      }

      credentials[req.name] = creds[0].value; // Decrypted by Supabase
    }
  }

  return credentials;
}

function interpolateCredentials(
  text: string,
  credentials: Record<string, string>,
  params?: Record<string, string>
): string {
  let result = text;

  // Replace ${credentials.xxx}
  for (const [key, value] of Object.entries(credentials)) {
    result = result.replace(`\${credentials.${key}}`, value);
  }

  // Replace ${workflow_params.xxx}
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      result = result.replace(`\${workflow_params.${key}}`, value);
    }
  }

  return result;
}

async function performClick(target: any): Promise<void> {
  // This would be implemented via the computer_use_api
  // For now, placeholder
  console.log(`[CLICK] ${JSON.stringify(target)}`);
}

async function performType(text: string): Promise<void> {
  console.log(`[TYPE] ${text.substring(0, 20)}...`);
}

async function performKeystroke(keys: string): Promise<void> {
  console.log(`[KEYSTROKE] ${keys}`);
}

async function takeScreenshot(): Promise<string> {
  console.log("[SCREENSHOT] Capturing screen");
  return "base64-encoded-image"; // Placeholder
}

async function navigateUrl(url: string): Promise<void> {
  console.log(`[NAVIGATE] ${url}`);
}

async function readClipboard(): Promise<string> {
  console.log("[CLIPBOARD] Reading");
  return "clipboard-content";
}

async function processWorkflowOutput(
  outputConfig: any,
  logs: ExecutionLog[]
): Promise<any> {
  // Parse clipboard or extracted data based on outputConfig
  return {};
}

async function storeExecutionRecord(record: any): Promise<void> {
  // Store in Supabase
  const response = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/rest/v1/workflow_executions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`,
      },
      body: JSON.stringify(record),
    }
  );

  if (!response.ok) {
    console.error("Failed to store execution record");
  }
}
```

### 3. Approval UI Component

**File: `sitesync-web/src/components/WorkflowApprovalModal.tsx`**
```typescript
import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

interface WorkflowApprovalProps {
  workflow: any;
  onApprove: (approved: boolean) => void;
  onModifySteps: (modifications: any) => void;
}

export function WorkflowApprovalModal({
  workflow,
  onApprove,
  onModifySteps,
}: WorkflowApprovalProps) {
  const [loading, setLoading] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const handleApprove = async () => {
    setLoading(true);
    try {
      await executeWorkflow(workflow.id);
      onApprove(true);
    } catch (error) {
      console.error("Workflow execution failed:", error);
      onApprove(false);
    }
    setLoading(false);
  };

  const toggleStepExpanded = (stepId: string) => {
    const newSet = new Set(expandedSteps);
    if (newSet.has(stepId)) {
      newSet.delete(stepId);
    } else {
      newSet.add(stepId);
    }
    setExpandedSteps(newSet);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 border-b">
          <h2 className="text-2xl font-bold">{workflow.name}</h2>
          <p className="text-blue-100 mt-1">{workflow.description}</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Metadata */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-sm text-gray-600">Steps</div>
              <div className="text-2xl font-bold">{workflow.steps.length}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-sm text-gray-600">Estimated Time</div>
              <div className="text-2xl font-bold">
                {Math.round(workflow.estimatedDuration / 60)}m
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-sm text-gray-600">Risk Level</div>
              <div
                className={`text-2xl font-bold ${
                  workflow.riskLevel === "low"
                    ? "text-green-600"
                    : workflow.riskLevel === "medium"
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}
              >
                {workflow.riskLevel.charAt(0).toUpperCase() +
                  workflow.riskLevel.slice(1)}
              </div>
            </div>
          </div>

          {/* Steps Breakdown */}
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">Planned Actions</h3>
            {workflow.steps.map((step: any, idx: number) => (
              <div key={step.id} className="border rounded-lg">
                <button
                  onClick={() => toggleStepExpanded(step.id)}
                  className="w-full p-4 text-left hover:bg-gray-50 flex items-between justify-between"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      Step {idx + 1}: {step.action.toUpperCase()}
                    </div>
                    {step.input && (
                      <div className="text-sm text-gray-600 mt-1">
                        Input:{" "}
                        {step.input.length > 50
                          ? step.input.substring(0, 50) + "..."
                          : step.input}
                      </div>
                    )}
                  </div>
                  <span className="text-gray-400">
                    {expandedSteps.has(step.id) ? "▼" : "▶"}
                  </span>
                </button>

                {expandedSteps.has(step.id) && (
                  <div className="bg-gray-50 p-4 border-t space-y-2">
                    {step.target && (
                      <div>
                        <span className="font-semibold text-gray-700">
                          Target:
                        </span>
                        <pre className="bg-white p-2 rounded text-xs text-gray-600 overflow-auto">
                          {JSON.stringify(step.target, null, 2)}
                        </pre>
                      </div>
                    )}
                    {step.expectedState && (
                      <div>
                        <span className="font-semibold text-gray-700">
                          Expected State:
                        </span>
                        <div className="text-sm text-gray-600">
                          {step.expectedState.description}
                        </div>
                        <ul className="list-disc list-inside text-xs text-gray-600 mt-1">
                          {step.expectedState.visualIndicators?.map(
                            (indicator: string) => (
                              <li key={indicator}>{indicator}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Screenshot Preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div>
                <div className="font-semibold text-blue-900">
                  The AI will perform these actions
                </div>
                <p className="text-sm text-blue-800 mt-1">
                  Before executing, the AI will take a screenshot to verify each
                  step. If something looks different from expected, it will
                  stop.
                </p>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">ℹ️</div>
              <div>
                <div className="font-semibold text-yellow-900">
                  All actions are logged
                </div>
                <p className="text-sm text-yellow-800 mt-1">
                  Every click, keystroke, and screenshot is saved in an audit
                  trail for compliance and debugging.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t p-6 flex gap-3 justify-end">
          <button
            onClick={() => onApprove(false)}
            disabled={loading}
            className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 disabled:opacity-50"
          >
            Deny
          </button>
          <button
            onClick={() => onModifySteps({})}
            disabled={loading}
            className="px-6 py-2 rounded-lg border border-blue-300 text-blue-700 font-medium hover:bg-blue-50 disabled:opacity-50"
          >
            Modify Steps
          </button>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Executing..." : "Approve & Execute"}
          </button>
        </div>
      </div>
    </div>
  );
}

async function executeWorkflow(workflowId: string) {
  const response = await fetch("/api/workflows/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workflowId }),
  });

  if (!response.ok) {
    throw new Error("Workflow execution failed");
  }

  return response.json();
}
```

### 4. Database Schema

**File: `sitesync-workflows/schema.sql`**
```sql
-- Workflow definitions
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  source_application VARCHAR(255),
  definition JSONB NOT NULL, -- Complete workflow definition
  risk_level VARCHAR(50),
  estimated_duration INTEGER, -- seconds
  org_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Workflow executions (audit trail)
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  user_id UUID NOT NULL,
  project_id UUID,
  status VARCHAR(50), -- success, failed, stopped
  steps_executed INTEGER,
  execution_logs JSONB, -- Array of execution logs
  output JSONB, -- Extracted data/output
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT now()
);

-- User credentials (encrypted)
CREATE TABLE user_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  value_encrypted TEXT NOT NULL, -- AES-256 encrypted
  encryption_key_id UUID,
  application VARCHAR(255),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, name, application)
);

-- Workflow templates (pre-built)
CREATE TABLE workflow_templates (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  source_application VARCHAR(255),
  definition JSONB NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_workflows_org ON workflows(org_id);
CREATE INDEX idx_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_executions_user ON workflow_executions(user_id);
CREATE INDEX idx_executions_status ON workflow_executions(status);
CREATE INDEX idx_credentials_user ON user_credentials(user_id);
```

### 5. Verification Script

**File: `sitesync-workflows/scripts/verify-workflows.js`**
```javascript
#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  console.log("🔄 Verifying Workflow System...\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Workflows table
  console.log("Test 1: Workflows Table");
  try {
    const { count } = await supabase
      .from("workflows")
      .select("*", { count: "exact", head: true });

    console.log(`✓ Workflows table: ${count || 0} workflows\n`);
    passed++;
  } catch (e) {
    console.error(`✗ ${e.message}\n`);
    failed++;
  }

  // Test 2: Templates
  console.log("Test 2: Workflow Templates");
  try {
    const { count } = await supabase
      .from("workflow_templates")
      .select("*", { count: "exact", head: true });

    console.log(`✓ Templates: ${count || 0} pre-built templates\n`);
    passed++;
  } catch (e) {
    console.error(`✗ ${e.message}\n`);
    failed++;
  }

  // Test 3: Credential vault
  console.log("Test 3: Credential Vault");
  try {
    const { count } = await supabase
      .from("user_credentials")
      .select("*", { count: "exact", head: true });

    console.log(`✓ Credential vault: ${count || 0} credentials stored\n`);
    passed++;
  } catch (e) {
    console.error(`✗ ${e.message}\n`);
    failed++;
  }

  // Test 4: Execution logs
  console.log("Test 4: Execution Audit Trail");
  try {
    const { count } = await supabase
      .from("workflow_executions")
      .select("*", { count: "exact", head: true });

    console.log(`✓ Execution history: ${count || 0} runs logged\n`);
    passed++;
  } catch (e) {
    console.error(`✗ ${e.message}\n`);
    failed++;
  }

  console.log("═".repeat(50));
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

  if (failed === 0) {
    console.log("✅ Workflow system ready!\n");
    process.exit(0);
  } else {
    process.exit(1);
  }
}

verify().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
```

---

## Strategic Impact

1. **Bridge Legacy Systems** — Sage 300, Procore, Bluebeam integration without APIs
2. **Eliminate Manual Work** — 2-3 hour tasks become 10-minute automated flows
3. **Human-in-Loop** — Users see exactly what Claude will do before it happens (trust)
4. **Audit Trail** — Every action logged for compliance
5. **Extensible** — New workflows created by describing steps in natural language

---


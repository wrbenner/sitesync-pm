# Session 4 (Tab D): Iris Stream Integration

## Read First (in order)
1. `specs/homepage-redesign/PRODUCT-DIRECTION.md` — Iris integration philosophy (progressive phases)
2. `specs/homepage-redesign/CONTRACT.md` — your ownership boundaries (do not violate)
3. `src/types/stream.ts` — locked contract; `IrisEnhancement` and `IrisDraftType` are defined here
4. `src/services/iris/index.ts` — pre-flight stub you will replace
5. `src/services/iris/draftAction.ts` — existing infrastructure for AI-drafted actions (reference, do not modify)

## Replaces Pre-Flight Stub
The file `src/services/iris/index.ts` already exists as an identity-function stub. Your job is to replace its `detectIrisEnhancements` implementation with the real one. Tab A's `useActionStream` already calls this function — no other tab needs to be updated.

Your service-local types (e.g., `IrisDraft` for the persisted-draft state below) live in `src/services/iris/types.ts`. **Do not redefine `StreamItem` or `IrisEnhancement` types** — import them from `@/types/stream`.

## Objective
Wire Iris into the stream as a draft assistant. She pre-drafts follow-up emails, daily logs, and owner updates. Every draft requires human approval. She lives inside stream items, not in a chatbot or separate panel.

## Core Principle
Iris is the junior PM — helpful, prepared, but never autonomous. The product works perfectly without her. She makes it faster when she's ready.

## What Iris Can Do (Phase 2 features — build now)

### 1. Overdue RFI Follow-Up
- **Trigger:** RFI is overdue by 2+ days
- **Draft:** Professional follow-up email to ball-in-court party
- **Template:**
```
Hi [assignee],

Following up on RFI #[number] regarding [subject], which was due on [due_date].

[If schedule impact known: This RFI is currently on the critical path for [activity name], and a delayed response may impact the [milestone] milestone.]

Please advise on your expected timeline for response.

Thank you,
[user name]
```
- **Confidence:** 0.85 (high — templated, low risk)
- **Sources:** RFI subject, due date, assignee, schedule link if available

### 2. Daily Log Draft
- **Trigger:** Yesterday's log not submitted (after 6am) or today after 2pm
- **Draft:** Narrative daily log compiled from the day's data
- **Inputs:**
  - Weather (from weather API)
  - Workforce count (from useWorkforceMembers)
  - Field entries / photos uploaded that day
  - Deliveries, visitors, incidents
  - Schedule activities for that day
- **Output format:** Match existing daily log narrative style
- **Confidence:** 0.6 (medium — needs human review for accuracy)
- **Sources:** "Based on [N] field entries, weather data, and crew records"

### 3. Owner Update Draft
- **Trigger:** Available as on-demand action, not auto-triggered
- **Draft:** Executive summary pulling from:
  - Schedule status (overall, critical path)
  - Budget status (% used, exposure)
  - Key risks (top 3)
  - Decisions needed from owner
  - Progress highlights
  - Lookahead (next 2 weeks)
- **Confidence:** 0.5 (medium-low — needs significant human review)
- **Sources:** All project data sources cited

### 4. Submittal Follow-Up
- **Trigger:** Submittal overdue or at risk of delaying procurement
- **Draft:** Follow-up to responsible party
- **Confidence:** 0.8 (high — templated)

### 5. Schedule Risk Note
- **Trigger:** Critical path activity behind schedule
- **Draft:** Brief risk note suitable for adding to a report or sharing with stakeholders
- **Confidence:** 0.7 (medium-high — based on math)

## What Iris Does NOT Do
- Approve anything
- Send anything without explicit human tap
- Respond to RFIs with technical content (she drafts follow-ups, not answers)
- Make budget decisions
- Anything safety-related beyond surfacing incidents
- Generate content that could have legal implications without clear "draft" labeling

## File Structure
```
src/services/iris/
  index.ts                    — REPLACES pre-flight stub (detectIrisEnhancements)
  drafts.ts                   — draft generation functions (NEW)
  templates.ts                — prompt templates per draft type (NEW)
  types.ts                    — service-local types (IrisDraft, etc.) (NEW)
src/stores/
  irisDraftStore.ts           — Zustand store for draft state (NEW)
```

**Existing files in `src/services/iris/` you must NOT modify:** `draftAction.ts`, `executeAction.ts`, `tools.ts`, `executors/`. Those serve a different concern (AI-drafted action execution from existing UI). The new files above are additive.

## Draft Generation Service

### `src/services/iris/drafts.ts`
> **Provider note:** Wave 1 uses `@ai-sdk/anthropic` directly to match the existing pattern in `src/services/iris/draftAction.ts`. Migrating Iris (and the other existing direct-provider call sites) to the Vercel AI Gateway is a separate post-Wave-1 initiative — out of scope for tonight, but recommended for the eventual consolidation pass.
```typescript
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

export async function generateIrisDraft(
  item: StreamItem,
  projectContext: ProjectContext
): Promise<IrisDraft> {
  const template = DRAFT_TEMPLATES[item.irisEnhancement?.draftType]
  if (!template) throw new Error(`No template for draft type: ${item.irisEnhancement?.draftType}`)

  const prompt = template.buildPrompt(item, projectContext)

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4.6'),
    prompt,
    temperature: 0.3,  // low — professional, consistent
    maxTokens: 500,    // drafts should be concise
  })

  return {
    id: item.id,
    type: item.irisEnhancement!.draftType,
    content: text,
    sources: template.getSources(item),
    status: 'pending',
    generatedAt: new Date().toISOString(),
  }
}
```

### `src/services/iris/templates.ts`
Each template provides:
- `buildPrompt(item, context)` — constructs the prompt
- `getSources(item)` — extracts source references
- `confidence` — static confidence score

Prompt guidelines:
- Keep prompts short and focused
- Include role context: "You are drafting on behalf of a construction project manager"
- Include project context: project name, parties involved
- Specify tone: professional, concise, construction-industry appropriate
- Specify format: email format for follow-ups, narrative for daily logs
- Never ask the AI to make things up — only use provided data

## Iris Draft Store

### `src/stores/irisDraftStore.ts`
```typescript
interface IrisDraft {
  id: string
  type: string
  content: string
  sources: string[]
  status: 'pending' | 'approved' | 'rejected' | 'edited'
  generatedAt: string
  editedContent?: string
}

interface IrisDraftStore {
  drafts: Map<string, IrisDraft>
  loading: Set<string>           // item IDs currently generating
  generateDraft: (item: StreamItem) => Promise<void>
  approveDraft: (id: string) => void
  rejectDraft: (id: string) => void
  editDraft: (id: string, content: string) => void
  getDraft: (id: string) => IrisDraft | undefined
  isLoading: (id: string) => boolean
}
```

## Iris Enhancement Detection

### `src/services/iris/index.ts`
```typescript
// Determine which stream items can have Iris enhancements
export function detectIrisEnhancements(items: StreamItem[]): StreamItem[] {
  return items.map(item => {
    const enhancement = getEnhancement(item)
    return enhancement ? { ...item, irisEnhancement: enhancement } : item
  })
}

function getEnhancement(item: StreamItem): IrisEnhancement | undefined {
  // Overdue RFI → follow-up email
  if (item.type === 'rfi' && item.overdue && daysPastDue(item) >= 2) {
    return {
      draftAvailable: true,
      draftType: 'follow_up_email',
      confidence: 0.85,
      summary: `Draft follow-up to ${item.assignedTo || 'responsible party'}`,
    }
  }

  // Missing daily log → daily log draft
  if (item.type === 'daily_log') {
    return {
      draftAvailable: true,
      draftType: 'daily_log',
      confidence: 0.6,
      summary: 'Draft daily log from field data',
    }
  }

  // Overdue submittal → follow-up
  if (item.type === 'submittal' && item.overdue) {
    return {
      draftAvailable: true,
      draftType: 'follow_up_email',
      confidence: 0.8,
      summary: `Draft follow-up for overdue submittal`,
    }
  }

  // Behind-schedule critical path → risk note
  if (item.type === 'schedule' && item.urgency === 'critical') {
    return {
      draftAvailable: true,
      draftType: 'schedule_suggestion',
      confidence: 0.7,
      summary: 'Draft schedule risk note',
    }
  }

  return undefined
}
```

This function is called inside `useActionStream()` after items are assembled and before they're returned. It decorates items with Iris enhancements without changing the core stream logic.

## UI Integration
The UI for Iris drafts is defined in Session 2 (StreamItemExpanded). This session only builds the data/service layer. Key integration points:

1. `useActionStream()` calls `detectIrisEnhancements()` on assembled items
2. When user expands a stream item with `irisEnhancement.draftAvailable`, the UI calls `irisDraftStore.generateDraft(item)` — this triggers the API call
3. While loading: show "Iris is drafting..." with subtle pulse
4. When loaded: show draft preview in the Draft Card section of the expanded item
5. User actions: "Send as-is" → approveDraft, "Edit" → inline edit → editDraft, "Dismiss" → rejectDraft

## Do NOT
- Modify `src/types/stream.ts` (locked contract)
- Modify `src/hooks/useActionStream.ts` or `src/stores/streamStore.ts` (Tab A)
- Modify any UI component or page (Tab B)
- Modify navigation, sidebar, or routing (Tab C)
- Modify the existing Iris files: `draftAction.ts`, `executeAction.ts`, `tools.ts`, `executors/`
- Migrate to Vercel AI Gateway in Wave 1 — separate post-Wave-1 initiative
- Build a chat interface
- Auto-generate drafts on page load (only on user expand)
- Auto-send anything
- Generate drafts for items that don't have clear templates
- Make API calls without user interaction triggering them
- Store drafts in Supabase (Zustand in-memory is fine for now)
- Build the owner update feature as auto-triggered (it should be on-demand from Reports page)

# Edge Functions Quick Reference

## File Structure

```
supabase/functions/
├── shared/
│   ├── auth.ts                 # Shared authentication & utilities
│   ├── emails/templates.ts
│   ├── webhookFanout.ts
│   └── apiAuth.ts
├── ai-copilot/
│   └── index.ts               # Conversational AI assistant (225 lines)
├── ai-rfi-draft/
│   └── index.ts               # Auto-generate RFI from field notes (143 lines)
├── ai-daily-summary/
│   └── index.ts               # Daily narrative summaries (200 lines)
├── ai-schedule-risk/
│   └── index.ts               # Schedule risk analysis (190 lines)
├── ai-conflict-detection/
│   └── index.ts               # Conflict detection (185 lines)
├── weather-sync/
│   └── index.ts               # Weather caching (149 lines)
├── EDGE_FUNCTIONS_GUIDE.md    # Complete guide (this document)
└── QUICK_REFERENCE.md         # This file
```

## Function Summary Table

| Function | Input | Output | API Model | Tables |
|----------|-------|--------|-----------|--------|
| **ai-copilot** | message, project_id, conversation_id? | response, conversation_id, tokens_used | Claude Sonnet 4.6 | ai_conversations, ai_messages |
| **ai-rfi-draft** | description, photo_url?, drawing_ref?, project_id | subject, question, suggested_assignee?, spec_section? | Claude Sonnet 4.6 | rfi_drafts |
| **ai-daily-summary** | project_id, date (YYYY-MM-DD) | summary, highlights[], concerns[] | Claude Sonnet 4.6 | daily_summaries |
| **ai-schedule-risk** | project_id | risks[] (activity_id, activity_name, risk_level, probability, impact_days, reason, mitigation) | Claude Sonnet 4.6 | (read-only) |
| **ai-conflict-detection** | project_id | conflicts[] (type, severity, description, affected_items, recommendation) | Claude Sonnet 4.6 | (read-only) |
| **weather-sync** | project_id | cached, forecast_days | OpenWeatherMap | weather_cache |

## API Endpoints

### All endpoints are relative to your Supabase project URL:

```
https://your-project.supabase.co/functions/v1/{function-name}
```

### Required Headers (all functions except weather-sync)

```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

### CORS Origins

Allowed:
- http://localhost:5173
- http://localhost:3000
- https://sitesync.ai
- https://app.sitesync.ai

## Code Patterns

### Authentication Pattern

```typescript
// All user-facing functions
const { user, supabase } = await authenticateRequest(req)
await verifyProjectMembership(supabase, user.id, projectId)

// CRON-only functions
const supabase = authenticateCron(req)
```

### Input Validation Pattern

```typescript
const projectId = requireUuid(body.project_id, 'project_id')
const message = sanitizeForPrompt(body.message, 5000)

if (!message || message.length < 1) {
  throw new HttpError(400, 'message must be non-empty')
}
```

### Anthropic API Call Pattern

```typescript
const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages/create', {
  method: 'POST',
  headers: {
    'x-api-key': anthropicApiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages,
  }),
})

const anthropicData = await anthropicResponse.json()
const response = anthropicData.content[0]?.text
const tokensUsed = (anthropicData.usage?.input_tokens || 0) + (anthropicData.usage?.output_tokens || 0)
```

### Response Pattern

```typescript
return new Response(JSON.stringify(response), {
  headers: {
    ...getCorsHeaders(req),
    'Content-Type': 'application/json',
  },
})
```

### Error Handling Pattern

```typescript
try {
  // function logic
} catch (error) {
  return errorResponse(error, getCorsHeaders(req))
}
```

## Key Design Decisions

### 1. Claude Sonnet 4.6 Model
- Fast enough for real-time copilot interactions
- Smart enough for construction-specific reasoning
- Cost-effective vs. Claude 3 Opus
- Can be upgraded to Opus for higher accuracy if needed

### 2. Conversation Storage
- Stores full message history in `ai_messages` table
- Loads last 20 messages for context window
- Allows multi-turn conversations
- Enables conversation replay and audit

### 3. Context Loading
- Loads recent RFIs, schedule status, budget, weather on each call
- Keeps context fresh without full database load
- Limits to 5-10 most relevant items
- Trades latency for accuracy

### 4. CRON Authentication
- weather-sync uses service role key (CRON-only)
- Rejects requests without matching CRON_SECRET
- Allows safe on-demand or scheduled execution

### 5. Input Sanitization
- Sanitizes text input to remove HTML/scripts
- Preserves code blocks in prompts
- Limits input length to prevent abuse
- Safe for use in AI prompts

## Deployment Checklist

- [ ] Set all environment variables in Supabase
- [ ] Create required database tables (see EDGE_FUNCTIONS_GUIDE.md)
- [ ] Deploy functions: `supabase functions deploy`
- [ ] Test each function with sample data
- [ ] Enable Row Level Security on tables
- [ ] Set up project_members table with test users
- [ ] Configure CORS origins if different from defaults
- [ ] Set up monitoring/logging for API calls
- [ ] Create backup credentials for API keys
- [ ] Document any customizations made

## Testing Examples

### Test ai-copilot

```bash
curl -X POST http://localhost:54321/functions/v1/ai-copilot \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What activities are at risk?",
    "project_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

### Test ai-rfi-draft

```bash
curl -X POST http://localhost:54321/functions/v1/ai-rfi-draft \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "The steel columns on level 3 have rust spots that need attention",
    "photo_url": "https://example.com/rust.jpg",
    "drawing_ref": "S-2.1",
    "project_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

### Test weather-sync (CRON)

```bash
curl -X POST http://localhost:54321/functions/v1/weather-sync \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

## Performance Notes

### Typical Response Times

- **ai-copilot:** 2-4 seconds (includes context loading)
- **ai-rfi-draft:** 1-2 seconds (simple generation)
- **ai-daily-summary:** 2-3 seconds (aggregates activity)
- **ai-schedule-risk:** 3-5 seconds (analyzes dependencies)
- **ai-conflict-detection:** 2-4 seconds (cross-references data)
- **weather-sync:** 1-2 seconds (external API call)

### Optimizations Applied

1. Parallel database queries using Promise.all()
2. Limit queries with .limit() and order by relevant fields
3. Service role key for batch operations
4. Context pruning to max 5-10 items per category
5. Efficient JSON parsing with regex extraction

## Monitoring & Debugging

### View Logs

```bash
# View edge function logs
supabase functions list

# Tail logs for a specific function
supabase functions serve ai-copilot
```

### Monitor API Usage

- **Anthropic Dashboard:** https://console.anthropic.com
- **OpenWeather Dashboard:** https://openweathermap.org/api/one-call-api
- **Supabase Logs:** https://supabase.com/dashboard/project/{project}/logs/functions

### Cost Tracking

Calculate estimated monthly costs:

```
ai-copilot calls/day * 100 tokens * $0.003/1M = $X
weather-sync calls/day * 1 call * $0.001 = $X
... per function
```

---

For complete details, see **EDGE_FUNCTIONS_GUIDE.md**

# SiteSync AI Edge Functions Guide

This directory contains Deno TypeScript Edge Functions deployed via Supabase. All functions follow construction-industry conventions and leverage Claude Sonnet for AI capabilities.

## Overview

| Function | Purpose | Endpoint | Auth |
|----------|---------|----------|------|
| **ai-copilot** | Conversational AI assistant with project context | `POST /ai-copilot` | JWT |
| **ai-rfi-draft** | Auto-generate formal RFI from field notes | `POST /ai-rfi-draft` | JWT |
| **ai-daily-summary** | Generate narrative daily project summary | `POST /ai-daily-summary` | JWT |
| **ai-schedule-risk** | Analyze schedule activities for delay risks | `POST /ai-schedule-risk` | JWT |
| **ai-conflict-detection** | Detect timeline and dependency conflicts | `POST /ai-conflict-detection` | JWT |
| **weather-sync** | Fetch and cache weather forecasts | `POST /weather-sync` | CRON |

## Function Details

### 1. ai-copilot: Conversational Assistant

**Endpoint:** `POST /functions/v1/ai-copilot`

**Request:**
```json
{
  "message": "What's the status of the concrete pour?",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "conversation_id": "optional-uuid"
}
```

**Response:**
```json
{
  "response": "The concrete pour for the foundation is scheduled for Tuesday...",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "tokens_used": 1240
}
```

**Features:**
- Loads project context: recent RFIs, schedule status, budget summary, weather
- Maintains multi-turn conversation history (up to 20 messages)
- Uses Claude Sonnet 4.6 with construction-specific system prompt
- Stores all messages in `ai_conversations` and `ai_messages` tables
- Field-first language suitable for superintendents

**Database Tables:**
- `ai_conversations` (id, project_id, user_id, last_message_at)
- `ai_messages` (conversation_id, role, content, tokens, created_at)

---

### 2. ai-rfi-draft: RFI Generation

**Endpoint:** `POST /functions/v1/ai-rfi-draft`

**Request:**
```json
{
  "description": "The drywall around the mechanical room has visible cracks and doesn't meet the specification.",
  "photo_url": "https://example.com/photo.jpg",
  "drawing_ref": "A-3.2",
  "project_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "subject": "Drywall crack mitigation in mechanical room",
  "question": "Should we repair the drywall cracks per specification 09 21 16 or replace the section?",
  "suggested_assignee": "Architect",
  "spec_section": "09 21 16"
}
```

**Features:**
- Converts field descriptions and photos into formal RFI language
- Suggests appropriate specification sections
- Recommends recipient role (Architect, Engineer, etc.)
- Stores drafts for later submission or editing
- Professional tone suitable for submittals

**Database Tables:**
- `rfi_drafts` (project_id, user_id, subject, question, source_description, source_photo, source_drawing)

---

### 3. ai-daily-summary: Daily Narrative Summaries

**Endpoint:** `POST /functions/v1/ai-daily-summary`

**Request:**
```json
{
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "date": "2026-04-01"
}
```

**Response:**
```json
{
  "summary": "On April 1st, the masonry crew completed 85% of the first floor exterior walls despite cooler temperatures...",
  "highlights": [
    "Masonry crew completed 85% of first floor exterior",
    "Concrete curing ahead of schedule",
    "No safety incidents"
  ],
  "concerns": [
    "Delayed submittal response from MEP coordinator",
    "Cold weather may impact mortar curing rates"
  ]
}
```

**Features:**
- Aggregates daily logs, RFI activity, and punch list changes
- Generates narrative suitable for owners or GCs
- Extracts highlights and concerns automatically
- Professional tone for stakeholder communication
- Queries all activity for specified date

**Database Tables:**
- `daily_logs` (project_id, crew_name, entry_text, weather, equipment_used, created_at)
- `daily_summaries` (project_id, date, summary, highlights, concerns, generated_by)

---

### 4. ai-schedule-risk: Schedule Risk Analysis

**Endpoint:** `POST /functions/v1/ai-schedule-risk`

**Request:**
```json
{
  "project_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "risks": [
    {
      "activity_id": "phase-003",
      "activity_name": "Roof Installation",
      "risk_level": "high",
      "probability": 0.75,
      "impact_days": 7,
      "reason": "Weather forecast shows 60% chance of rain during scheduled period. Limited crew availability (68%).",
      "mitigation": "Secure additional crew or defer to April 8-10 window with better forecast."
    }
  ]
}
```

**Features:**
- Analyzes schedule activities against multiple risk factors
- Considers weather forecast, crew availability, and RFI dependencies
- Prioritizes critical path activities
- Provides specific mitigation recommendations
- Only flags activities with probability > 0.3 or on critical path

**Risk Factors Analyzed:**
- Weather forecast impact on duration
- Crew availability and resource conflicts
- Open RFI dependencies and response timelines
- Critical path and float
- Material delivery lead times

---

### 5. ai-conflict-detection: Dependency Conflict Analysis

**Endpoint:** `POST /functions/v1/ai-conflict-detection`

**Request:**
```json
{
  "project_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "conflicts": [
    {
      "type": "submittal_lead_time",
      "severity": "critical",
      "description": "Structural steel submittal due 3/28 but installation scheduled 4/1 with only 4 days for approval.",
      "affected_items": ["Structural Steel Supplier", "Installation Phase"],
      "recommendation": "Accelerate submittal to 3/20 or defer installation to 4/8 post-approval."
    },
    {
      "type": "rfi_dependency",
      "severity": "major",
      "description": "Open RFI on electrical layout affects panel installation scheduled 4/3.",
      "affected_items": ["RFI-0047", "Electrical Panel Installation"],
      "recommendation": "Prioritize RFI response or delay panel installation pending answer."
    }
  ]
}
```

**Features:**
- Cross-references schedule vs. submittal lead times
- Detects weather conflicts with critical path
- Identifies open RFI dependencies
- Analyzes activity logic and sequencing issues
- Provides actionable recommendations

**Conflict Types:**
- `submittal_lead_time`: Material submittal too close to installation
- `weather_conflict`: Critical activity during severe weather
- `rfi_dependency`: Open RFI affecting scheduled activity
- `critical_path_at_risk`: Multiple risks on critical path

---

### 6. weather-sync: Weather Caching

**Endpoint:** `POST /functions/v1/weather-sync`

**Request:**
```json
{
  "project_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "cached": true,
  "forecast_days": 10
}
```

**Features:**
- Fetches 10-day forecast from OpenWeatherMap API
- Caches data in `weather_cache` table
- CRON-only function (service role authentication)
- Can be called on-demand or scheduled
- Processes full forecast into usable format

**Data Cached:**
- Temperature (min, max, feels-like)
- Humidity and wind speed
- Precipitation probability and volume
- Cloud cover percentage
- Weather conditions (rain, snow, clear, etc.)

---

## Environment Variables

All functions require these environment variables in Supabase:

```env
# Supabase (automatic, set by Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# APIs
ANTHROPIC_API_KEY=sk-ant-...
OPENWEATHER_API_KEY=your-openweather-key

# Cron security (optional, for weather-sync)
CRON_SECRET=your-secret-token
```

**To set secrets locally:**
```bash
supabase secrets set ANTHROPIC_API_KEY "sk-ant-..."
supabase secrets set OPENWEATHER_API_KEY "your-key"
supabase secrets set CRON_SECRET "your-secret"
```

---

## Database Tables Required

Create these tables in your Supabase database:

```sql
-- Conversations
create table if not exists ai_conversations (
  id uuid primary key,
  project_id uuid not null,
  user_id uuid not null,
  last_message_at timestamp not null,
  created_at timestamp default now()
);

create table if not exists ai_messages (
  id bigserial primary key,
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  tokens int,
  created_at timestamp default now()
);

-- Drafts
create table if not exists rfi_drafts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null,
  subject text not null,
  question text not null,
  source_description text,
  source_photo text,
  source_drawing text,
  created_at timestamp default now()
);

-- Summaries
create table if not exists daily_summaries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  date date not null,
  summary text not null,
  highlights text[],
  concerns text[],
  generated_by uuid not null,
  created_at timestamp default now(),
  unique(project_id, date)
);

-- Weather
create table if not exists weather_cache (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique,
  forecast_data jsonb not null,
  cached_at timestamp not null,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Enable RLS
alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;
alter table rfi_drafts enable row level security;
alter table daily_summaries enable row level security;
alter table weather_cache enable row level security;
```

---

## Deployment

### Local Testing

```bash
# Start local Supabase
supabase start

# Set environment variables for local development
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENWEATHER_API_KEY="your-key"

# Test a function locally
curl -X POST http://localhost:54321/functions/v1/ai-copilot \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What tasks are pending?",
    "project_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

### Production Deployment

```bash
# Deploy all functions to production
supabase functions deploy

# Deploy a specific function
supabase functions deploy ai-copilot

# List deployed functions
supabase functions list
```

---

## Error Handling

All functions return standard error responses:

```json
{
  "error": {
    "message": "User is not a member of this project",
    "type": "api_error",
    "status": 403
  }
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Bad request (validation error)
- `401`: Unauthorized (missing/invalid JWT)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found (missing data)
- `415`: Unsupported media type (wrong Content-Type)
- `500`: Internal server error
- `502`: Bad gateway (external API error)

---

## Cost Considerations

### Anthropic API Usage

Each function call to ai-copilot, ai-rfi-draft, ai-daily-summary, ai-schedule-risk, and ai-conflict-detection makes one API call to Claude Sonnet 4.6.

**Estimate:** $3 per 1M input tokens, $15 per 1M output tokens

Typical costs per call:
- ai-copilot: ~50-150 tokens (~$0.003)
- ai-rfi-draft: ~300-800 tokens (~$0.005)
- ai-daily-summary: ~400-1200 tokens (~$0.007)
- ai-schedule-risk: ~800-2000 tokens (~$0.012)
- ai-conflict-detection: ~800-2000 tokens (~$0.012)

### OpenWeatherMap API Usage

weather-sync uses the 5-day forecast endpoint (~$0.001 per call with free tier limits).

### Optimization Tips

1. **Rate limit external API calls:** Cache responses, batch requests
2. **Limit context size:** Keep project context concise
3. **Pagination:** Use limit() on database queries
4. **Conversation pruning:** Archive old messages after 30 days
5. **On-demand vs. scheduled:** Run risk analysis only when needed

---

## Security Notes

1. **JWT Authentication:** All user-facing functions verify authentication via Supabase JWT
2. **Project membership:** All operations check project membership before proceeding
3. **Input sanitization:** All text input is sanitized to remove malicious content
4. **Service role key:** Only used server-side for admin operations
5. **CORS:** Limited to known SiteSync domains
6. **Rate limiting:** Implement at API gateway level for production
7. **Cost controls:** Monitor API usage; set spending limits on Anthropic

---

## Support & Troubleshooting

### Common Issues

**"ANTHROPIC_API_KEY not configured"**
- Run: `supabase secrets set ANTHROPIC_API_KEY "sk-ant-..."`
- Restart: `supabase functions serve`

**"User is not a member of this project"**
- Verify project_members table has user entry with correct project_id
- Check JWT token is valid and not expired

**"Project location coordinates not configured"**
- Update projects table: set coordinates to { lat: X, lng: Y }
- Required for weather-sync function

**High API costs**
- Reduce conversation history limit in ai-copilot
- Cache and reuse responses when possible
- Implement input token limits
- Monitor usage via Anthropic dashboard

---

## Next Steps

1. Create required database tables (see SQL above)
2. Set environment variables in Supabase
3. Deploy functions: `supabase functions deploy`
4. Test each function with sample data
5. Integrate with frontend (see example calls above)
6. Monitor logs and costs
7. Set up scheduled cron jobs (e.g., weather-sync every 6 hours)

---

Generated for SiteSync AI construction project management platform.

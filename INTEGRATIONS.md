# SiteSync AI - Third Party Integrations Specification

## Overview
This document specifies all third party integrations for SiteSync AI, a construction PM platform. Each integration includes authentication method, data flow, edge function handlers, database schema changes, and frontend implementation requirements.

All integrations use Supabase edge functions as the middleware layer. Sensitive API keys are stored in Supabase secrets. Rate limiting and error handling is centralized via edge functions.

---

## 1. Weather API Integration

### Purpose
Real time weather data for dashboard widget, schedule risk analysis, daily log context, and field conditions tracking.

### Provider: OpenWeatherMap API
- **Endpoint**: `https://api.openweathermap.org/data/3.0/` (One Call 3.0 API)
- **Authentication**: API key (stored in `process.env.OPENWEATHER_API_KEY`)
- **Rate Limit**: 1,000 calls/day standard tier (sufficient for 30 min refresh on 2,000 projects)
- **Cost**: Free tier available, paid at scale

### Data Requirements
1. **Current Conditions**: temperature, feels like, humidity, precipitation, wind speed, visibility, pressure, weather description, icon code
2. **Hourly Forecast**: next 48 hours with 1 hour granularity (temperature, precipitation probability, rain/snow accumulation)
3. **Daily Forecast**: next 7 days with daily high/low, precipitation probability, risk alerts
4. **Historical**: last 7 days (for daily log backfill if needed)

### Database Schema Changes
```sql
-- Weather cache table (Supabase)
create table weather_cache (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  location_lat numeric not null,
  location_lon numeric not null,
  current_temp float,
  current_feels_like float,
  current_humidity int,
  current_precip_probability int,
  current_precip_mm float,
  current_wind_speed float,
  current_wind_direction int,
  current_visibility_m int,
  current_pressure_mb int,
  current_description text,
  current_icon_code text,
  hourly_forecast jsonb, -- array of 48 hourly objects
  daily_forecast jsonb,  -- array of 7 daily objects
  risk_alerts jsonb,     -- { rain_expected: bool, extreme_temp: bool, high_wind: bool, snow_expected: bool }
  fetched_at timestamp default now(),
  expires_at timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_weather_cache_project_expires on weather_cache(project_id, expires_at);
create index idx_weather_cache_updated on weather_cache(updated_at);

-- Weather history for daily logs
create table weather_history (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid not null references daily_logs(id) on delete cascade,
  project_id uuid not null references projects(id),
  date date not null,
  high_temp float,
  low_temp float,
  avg_temp float,
  max_precip_mm float,
  max_wind_speed float,
  conditions_description text,
  created_at timestamp default now()
);

create index idx_weather_history_daily_log on weather_history(daily_log_id);
create index idx_weather_history_project_date on weather_history(project_id, date);
```

### Edge Function: `weather-sync`
**Trigger**: Cron job every 30 minutes
**Handler**: `supabase/functions/weather-sync/index.ts`

```typescript
// Pseudocode structure
export async function weatherSync(req: Request) {
  try {
    // 1. Get all active projects with locations
    const projects = await getActiveProjectsWithLocation();

    // 2. For each project, fetch weather
    for (const project of projects) {
      const weatherData = await fetchOpenWeatherMap(
        project.location_lat,
        project.location_lon,
        process.env.OPENWEATHER_API_KEY
      );

      // 3. Transform to SiteSync schema
      const cached = transformWeatherData(weatherData);

      // 4. Upsert to weather_cache
      await upsertWeatherCache(project.id, cached);

      // 5. Check for risk alerts, create notifications
      const alerts = identifyWeatherAlerts(cached);
      if (alerts.length > 0) {
        await createNotifications(project.id, alerts);
      }
    }

    return { success: true, processed: projects.length };
  } catch (error) {
    // Log to Sentry, return 500
    logError(error);
    return { error: error.message };
  }
}

// Helper: transform OpenWeatherMap response
function transformWeatherData(owmResponse) {
  return {
    current_temp: owmResponse.current.temp,
    current_feels_like: owmResponse.current.feels_like,
    current_humidity: owmResponse.current.humidity,
    current_precip_probability: owmResponse.current.clouds || 0,
    current_precip_mm: owmResponse.current.rain?.['1h'] || 0,
    current_wind_speed: owmResponse.current.wind_speed,
    current_wind_direction: owmResponse.current.wind_deg,
    current_visibility_m: owmResponse.current.visibility,
    current_pressure_mb: owmResponse.current.pressure,
    current_description: owmResponse.current.weather[0].main,
    current_icon_code: owmResponse.current.weather[0].icon,
    hourly_forecast: owmResponse.hourly.slice(0, 48).map(h => ({
      dt: h.dt,
      temp: h.temp,
      feels_like: h.feels_like,
      precip_probability: h.pop,
      rain_mm: h.rain?.['1h'] || 0,
      snow_mm: h.snow?.['1h'] || 0,
      wind_speed: h.wind_speed,
      description: h.weather[0].main
    })),
    daily_forecast: owmResponse.daily.slice(0, 7).map(d => ({
      dt: d.dt,
      temp_max: d.temp.max,
      temp_min: d.temp.min,
      precip_probability: d.pop,
      rain_mm: d.rain || 0,
      snow_mm: d.snow || 0,
      wind_speed: d.wind_speed,
      description: d.weather[0].main
    })),
    risk_alerts: {
      rain_expected: owmResponse.daily[0].pop > 0.6,
      extreme_temp: owmResponse.daily[0].temp.max > 35 || owmResponse.daily[0].temp.min < 0,
      high_wind: owmResponse.current.wind_speed > 25,
      snow_expected: owmResponse.daily[0].snow && owmResponse.daily[0].snow > 0
    }
  };
}

// Helper: identify alerts for notifications
function identifyWeatherAlerts(cached) {
  const alerts = [];
  if (cached.risk_alerts.rain_expected) {
    alerts.push({ type: 'RAIN_EXPECTED', severity: 'warning' });
  }
  if (cached.risk_alerts.extreme_temp) {
    alerts.push({ type: 'EXTREME_TEMP', severity: 'warning' });
  }
  if (cached.risk_alerts.high_wind) {
    alerts.push({ type: 'HIGH_WIND', severity: 'critical' });
  }
  if (cached.risk_alerts.snow_expected) {
    alerts.push({ type: 'SNOW_EXPECTED', severity: 'warning' });
  }
  return alerts;
}
```

### Frontend Hook: `useWeather(projectId)`

```typescript
// hooks/useWeather.ts
import { useEffect, useState } from 'react';
import { supabase } from '../client';

export function useWeather(projectId: string) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const { data, error: queryError } = await supabase
          .from('weather_cache')
          .select('*')
          .eq('project_id', projectId)
          .single();

        if (queryError) throw queryError;

        // Check if expired
        if (new Date(data.expires_at) < new Date()) {
          // Trigger manual refresh via edge function
          await supabase.functions.invoke('weather-refresh', {
            body: { projectId }
          });
          // Refetch
          const { data: fresh } = await supabase
            .from('weather_cache')
            .select('*')
            .eq('project_id', projectId)
            .single();
          setWeather(fresh);
        } else {
          setWeather(data);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      fetchWeather();
    }
  }, [projectId]);

  return { weather, loading, error };
}
```

### Frontend Widget: Dashboard Weather Display
- Show current temperature, description, icon
- 48 hour hourly chart (bars for precipitation, line for temp)
- 7 day forecast cards
- Risk alert banner (rain, extreme temps, high wind)
- Update every 30 minutes via subscription to `weather_cache` table

### Error Handling
- If OpenWeatherMap API fails, return cached data with age indicator ("Last updated 2 hours ago")
- If no cached data exists, show placeholder "Weather unavailable"
- Sentry logging for all API errors
- Automatic retry with exponential backoff (3 attempts, 1s/2s/4s delays)

### Rate Limiting
- Edge function checks Redis cache to avoid duplicate requests within 5 minutes per project
- Returns 429 Too Many Requests if exceeded

---

## 2. Procore API Integration

### Purpose
Bi directional sync of projects, RFIs, submittals, change orders, daily logs, and directory data. Procore is the secondary system; SiteSync is primary for any conflicts.

### Provider: Procore Inc.
- **Base URL**: `https://api.procore.com/rest/v1.0`
- **Authentication**: OAuth 2.0 (Authorization Code flow)
- **Client ID / Secret**: Stored in Supabase secrets
- **Rate Limit**: 500 requests per minute per app (sufficient for small active projects)
- **Scopes Needed**: `projects:read`, `projects:write`, `rfis:read`, `rfis:write`, `submittals:read`, `submittals:write`, `change_orders:read`, `daily_logs:read`, `daily_logs:write`, `companies:read`, `users:read`

### Database Schema Changes
```sql
-- OAuth tokens for Procore users
create table procore_oauth (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamp not null,
  scope text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_procore_oauth_user on procore_oauth(user_id);

-- Project sync metadata
create table project_sync_metadata (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  procore_project_id text,
  sync_direction text, -- 'import', 'export', 'bidirectional'
  last_synced_at timestamp,
  sync_status text, -- 'success', 'failed', 'pending', 'in_progress'
  last_error text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_project_sync_metadata_project on project_sync_metadata(project_id);

-- RFI sync mapping
create table rfi_sync_mapping (
  id uuid primary key default gen_random_uuid(),
  sitesync_rfi_id uuid not null references rfis(id) on delete cascade,
  procore_rfi_id text not null,
  procore_company_id text,
  last_synced_direction text, -- 'sitesync_to_procore', 'procore_to_sitesync'
  local_hash text, -- hash of local changes for conflict detection
  remote_hash text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_rfi_sync_mapping_ids on rfi_sync_mapping(sitesync_rfi_id, procore_rfi_id);

-- Submittal sync mapping
create table submittal_sync_mapping (
  id uuid primary key default gen_random_uuid(),
  sitesync_submittal_id uuid not null references submittals(id) on delete cascade,
  procore_submittal_id text not null,
  procore_company_id text,
  last_synced_direction text,
  local_hash text,
  remote_hash text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_submittal_sync_mapping_ids on submittal_sync_mapping(sitesync_submittal_id, procore_submittal_id);

-- Daily log sync mapping
create table daily_log_sync_mapping (
  id uuid primary key default gen_random_uuid(),
  sitesync_daily_log_id uuid not null references daily_logs(id) on delete cascade,
  procore_daily_log_id text,
  last_synced_direction text,
  local_hash text,
  remote_hash text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_daily_log_sync_mapping_ids on daily_log_sync_mapping(sitesync_daily_log_id, procore_daily_log_id);

-- Sync queue for failed operations
create table sync_queue (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null, -- 'rfi', 'submittal', 'change_order', 'daily_log'
  entity_id uuid,
  procore_id text,
  operation text not null, -- 'create', 'update', 'delete'
  payload jsonb,
  attempt_count int default 0,
  max_retries int default 5,
  last_error text,
  status text default 'pending', -- 'pending', 'processing', 'success', 'failed'
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_sync_queue_status on sync_queue(status, created_at);
```

### OAuth 2.0 Flow

**Step 1: User initiates Procore connection**
- Frontend button "Connect to Procore"
- Redirects to: `https://api.procore.com/oauth/authorize?client_id=...&redirect_uri=https://sitesync.app/auth/procore&response_type=code&scope=...`

**Step 2: Procore redirects with authorization code**
- Frontend receives code, calls edge function `procore-oauth-callback`

**Step 3: Edge function exchanges code for tokens**
```typescript
// supabase/functions/procore-oauth-callback/index.ts
export async function procoreOAuthCallback(req: Request) {
  const code = new URL(req.url).searchParams.get('code');
  const userId = req.headers.get('x-user-id');

  try {
    const tokenResponse = await fetch(
      'https://api.procore.com/oauth/token',
      {
        method: 'POST',
        headers: { 'Content Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: process.env.PROCORE_CLIENT_ID,
          client_secret: process.env.PROCORE_CLIENT_SECRET,
          code,
          redirect_uri: 'https://sitesync.app/auth/procore'
        })
      }
    );

    const tokens = await tokenResponse.json();

    // Store tokens
    await supabase
      .from('procore_oauth')
      .upsert(
        {
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000),
          scope: tokens.scope
        },
        { onConflict: 'user_id' }
      );

    return { success: true, message: 'Connected to Procore' };
  } catch (error) {
    return { error: error.message };
  }
}
```

### Data Sync Architecture

**Strategy**: SiteSync is primary (source of truth). Procore is secondary (mirror). On conflict, SiteSync data wins.

#### RFI Sync

**Field Mapping: Procore → SiteSync**
| Procore Field | SiteSync Field | Notes |
|---|---|---|
| `id` | (procore_rfi_id in mapping) | |
| `number` | number | |
| `title` | title | |
| `description` | description | |
| `question` | title + description | Combined |
| `status` | status | Map: draft→draft, issued→open, answered→responded, closed→closed |
| `from` (company) | submitted_by_company_id | |
| `to` (company) | assigned_to_company_id | |
| `created_at` | created_at | |
| `responded_at` | responded_at | |
| `due_date` | due_at | |
| `answer` | responses (array) | Each answer is a response entry |
| `custom_fields` | metadata jsonb | Store as is |

**Field Mapping: SiteSync → Procore**
| SiteSync Field | Procore Field | Notes |
|---|---|---|
| title | title | |
| description | question | |
| status | status | Map inverse |
| assigned_to_company_id | to (company) | |
| due_at | due_date | |
| responses | answer | Concatenate all responses |
| metadata | custom_fields | Post as custom fields if keys exist in Procore |

**Sync Triggers**:
- User creates RFI in SiteSync → `procore-export-rfi` edge function
- Procore webhook (RFI updated) → `procore-webhook-handler` receives payload, upserts RFI

#### Submittal Sync

**Field Mapping: Procore → SiteSync**
| Procore Field | SiteSync Field | Notes |
|---|---|---|
| `id` | (procore_submittal_id in mapping) | |
| `number` | number | |
| `title` | title | |
| `description` | description | |
| `spec_section` | spec_section | |
| `submitted_by` (company) | submitted_by_company_id | |
| `status` | status | Map: draft→draft, submitted→submitted, approved→approved, rejected→rejected, conditional→requested_changes |
| `due_date` | due_at | |
| `submitted_at` | submitted_at | |
| `approved_at` | approved_at | |
| `rejection_reason` | rejection_reason | |
| `is_late` | is_overdue | Computed from due_at vs submitted_at |
| `attachments` | files (array) | Store URLs and metadata |

**Sync Triggers**:
- User submits submittal in SiteSync → `procore-export-submittal`
- Procore webhook (submittal reviewed) → `procore-webhook-handler`

#### Change Order Sync

**Import only** (typically generated in Procore, reviewed in SiteSync)

**Field Mapping: Procore → SiteSync**
| Procore Field | SiteSync Field | Notes |
|---|---|---|
| `id` | (procore_co_id in mapping) | |
| `number` | number | CO-001, CO-002, etc. |
| `title` | title | |
| `description` | description | |
| `status` | status | Map: draft, submitted, approved, rejected |
| `amount_change` | cost_impact | In cents |
| `days_change` | schedule_impact_days | |
| `created_at` | created_at | |
| `submitted_at` | submitted_at | |
| `approved_at` | approved_at | |

#### Daily Log Sync

**Export only** (SiteSync is primary, export to Procore as backup)

**Field Mapping: SiteSync → Procore**
| SiteSync Field | Procore Field | Notes |
|---|---|---|
| date | date | |
| weather_summary | weather | Text description |
| work_summary | work_performed | |
| crews (array) | labor | Name, count, hours |
| equipment | equipment | Name, count, hours |
| materials_used | materials | Name, quantity |
| safety_incidents | safety_events | |
| notes | notes | |
| photos | photos | Upload via Procore API |

### Edge Functions

#### `procore-export-rfi`
```typescript
// Triggered when user saves RFI in SiteSync
// 1. Check if RFI has procore_rfi_id mapping
// 2. If new: POST to Procore /rfis, store mapping
// 3. If update: PATCH to Procore /rfis/{id}
// 4. Handle conflicts (if remote hash != local hash, user gets warning)
// 5. Log sync_queue entry
```

#### `procore-export-submittal`
```typescript
// Triggered when user submits submittal in SiteSync
// Similar to RFI export
```

#### `procore-import-projects`
```typescript
// Scheduled daily or on demand
// 1. Get user's Procore OAuth token
// 2. Fetch /companies/{company_id}/projects
// 3. For each Procore project, upsert to projects table
// 4. Create project_sync_metadata entry
```

#### `procore-import-rfis`
```typescript
// Scheduled every 4 hours or on webhook
// 1. For each active project, fetch /projects/{id}/rfis
// 2. For each RFI, check if mapping exists
// 3. If new: transform and insert into rfis table, create mapping
// 4. If update: check local_hash vs remote_hash
//    - If different and local is newer: skip (SiteSync is primary)
//    - If different and remote is newer: update SiteSync, set last_synced_direction
// 5. Handle deletions (soft delete)
```

#### `procore-webhook-handler`
```typescript
// Receives webhook from Procore
// Payload: { event_type, entity_type, entity_id, data }
// 1. Verify signature (Procore provides HMAC)
// 2. Route by event_type
// 3. Call appropriate import function (import-rfis, import-submittals, etc.)
// 4. Return 200 OK immediately (async processing)
```

#### `procore-sync-queue-processor`
```typescript
// Scheduled every 30 seconds
// 1. Get pending sync_queue entries (status = 'pending', attempt_count < max_retries)
// 2. For each entry:
//    - Attempt operation (POST, PATCH, DELETE to Procore)
//    - On success: mark status='success', update mapping
//    - On failure: increment attempt_count, log error, update status='failed' if max retries reached
// 3. Alert user if sync fails after max retries
```

#### `procore-token-refresh`
```typescript
// Cron job every 30 days
// 1. Find all procore_oauth entries where expires_at < now() + 7 days
// 2. Use refresh_token to get new access_token
// 3. Update procore_oauth entry
// 4. Log failures
```

### Webhook Configuration
- User sets up webhook in Procore dashboard (https://sitesync.app/webhooks/procore)
- Webhook events: RFI created/updated/deleted, submittal created/updated/deleted, daily log created/updated, change order created/updated
- Signature verification: Use HMAC SHA256 with webhook secret

### Frontend
- **Procore Connection Screen**: OAuth button, list of connected projects from Procore
- **Sync Status**: Small indicator on each RFI/submittal showing "Synced to Procore", "Out of sync", "Sync error"
- **Settings**: Toggle sync on/off per project, choose sync direction (import, export, bidirectional)
- **Sync Dashboard**: View sync queue, retry failed syncs, manual force sync button

### Error Handling
- Network error: Add to sync_queue, retry with exponential backoff
- 401 Unauthorized: Refresh token or ask user to reconnect
- 409 Conflict: If local_hash != remote_hash and remote is newer, show user dialog: "Procore has updates. Merge or keep local?"
- 422 Validation error: Log to Sentry, alert user that data format is incompatible
- Rate limit (429): Back off to 1 request per second per project

### Rate Limiting
- Per user: max 100 requests per minute
- Per project: max 1 import every 60 seconds (prevent thrashing)
- Batch operations: GET multiple RFIs in single request when possible

---

## 3. Google Calendar & Microsoft Outlook Integration

### Purpose
Bidirectional sync of meetings. Create meeting in SiteSync → creates calendar event. Update calendar event → updates SiteSync meeting.

### Providers
- **Google Calendar API**: https://www.googleapis.com/calendar/v3
- **Microsoft Graph API**: https://graph.microsoft.com/v1.0/me/calendar

### Authentication
Both use OAuth 2.0. Users can connect multiple calendar accounts.

**Google OAuth Scopes**:
- `https://www.googleapis.com/auth/calendar` (read/write calendars)
- `https://www.googleapis.com/auth/calendar.events` (read/write events)

**Microsoft OAuth Scopes**:
- `Calendars.ReadWrite` (read/write calendars)
- `User.Read` (user profile)

### Database Schema
```sql
create table calendar_oauth (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null, -- 'google' or 'microsoft'
  access_token text not null,
  refresh_token text not null,
  expires_at timestamp not null,
  calendar_id text, -- Google: primary@gmail.com, Microsoft: calendar-id-guid
  calendar_name text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_calendar_oauth_user_provider on calendar_oauth(user_id, provider);

-- Mapping between SiteSync meeting and calendar event
create table meeting_calendar_mapping (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  provider text not null, -- 'google' or 'microsoft'
  calendar_event_id text not null,
  calendar_user_id uuid not null references calendar_oauth(id) on delete cascade,
  last_synced_at timestamp,
  local_hash text,
  remote_hash text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_meeting_calendar_mapping_meeting on meeting_calendar_mapping(meeting_id);
create index idx_meeting_calendar_mapping_provider on meeting_calendar_mapping(provider, calendar_event_id);
```

### Field Mapping: SiteSync Meeting → Calendar Event

| SiteSync Field | Google Calendar Field | Microsoft Calendar Field | Notes |
|---|---|---|---|
| title | summary | subject | |
| description | description | bodyPreview + body | |
| start_time | start.dateTime | start.dateTime | ISO 8601 with timezone |
| end_time | end.dateTime | end.dateTime | |
| location | location.displayName | location.displayName | |
| attendees | attendees[] | attendees[] | Email only |
| project_id | extendedProperties.private.sitesync_project_id | categories | Tag with project ID |
| meeting_type | extendedProperties.private.sitesync_meeting_type | categories | Tag with meeting type |
| notes | description | bodyPreview | |

### Edge Functions

#### `calendar-oauth-callback`
```typescript
export async function calendarOAuthCallback(req: Request) {
  const code = new URL(req.url).searchParams.get('code');
  const provider = new URL(req.url).searchParams.get('provider'); // 'google' or 'microsoft'
  const userId = req.headers.get('x-user-id');

  if (provider === 'google') {
    // Exchange code for tokens
    const tokens = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: 'https://sitesync.app/auth/calendar/google'
      })
    }).then(r => r.json());

    // Get calendar info
    const calendarInfo = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList/primary',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    ).then(r => r.json());

    // Store
    await supabase
      .from('calendar_oauth')
      .insert({
        user_id: userId,
        provider: 'google',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000),
        calendar_id: calendarInfo.id,
        calendar_name: calendarInfo.summary
      });

    return { success: true };
  } else if (provider === 'microsoft') {
    // Similar flow for Microsoft
  }
}
```

#### `calendar-export-meeting`
```typescript
// Triggered when user creates/updates meeting in SiteSync
// 1. Check if meeting_calendar_mapping exists
// 2. Get calendar_oauth for user (or allow user to choose which calendar)
// 3. If new meeting: POST to Google Calendar API /calendars/{id}/events
// 4. If update: PATCH to /calendars/{id}/events/{eventId}
// 5. Store mapping with event ID
// 6. Handle timezone conversion (convert meeting.start_time to user's timezone)
```

#### `calendar-import-events`
```typescript
// Scheduled every 4 hours or on webhook from Google Calendar API
// 1. Get user's calendar_oauth entries
// 2. For each calendar:
//    - Fetch /calendars/{id}/events?timeMin=now&timeMax=now+7days
//    - Filter events with sitesync_project_id in extendedProperties
// 3. For each event, check if mapping exists
// 4. If new: transform to SiteSync meeting, insert, create mapping
// 5. If update: compare local_hash vs remote_hash, handle conflicts
// 6. Handle deletions
```

#### `calendar-token-refresh`
```typescript
// Cron job hourly
// Find calendar_oauth entries where expires_at < now() + 1 hour
// Refresh each using refresh_token
// Update access_token and expires_at
```

### Push Notifications
- Google Calendar: Use push notifications API (subscription to calendar changes)
- Microsoft: Use webhook subscriptions (change notifications)

### Frontend
- **Meeting Creation**: Checkbox "Add to Calendar" with dropdown to choose calendar (Google/Microsoft)
- **Meeting Detail**: Show "Synced to Google Calendar" badge with last sync time
- **Settings**: Connect Google Calendar, Connect Microsoft Outlook, toggle sync on/off

---

## 4. Email Integration (SendGrid)

### Purpose
Transactional email notifications, capture email replies, digest emails.

### Provider: SendGrid
- **API**: https://api.sendgrid.com/v3/mail/send
- **Inbound Parse**: Receive emails at webhook
- **Authentication**: API key (process.env.SENDGRID_API_KEY)
- **Cost**: $9.95/month for 500K emails

### Database Schema
```sql
create table email_templates (
  id uuid primary key default gen_random_uuid(),
  name text unique not null, -- 'rfi_notification', 'submittal_request', 'daily_log_reminder', 'digest'
  subject_template text not null,
  html_template text not null,
  text_template text not null,
  variables text[], -- ['{{rfi_number}}', '{{rfi_title}}', ...]
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  to_address text not null,
  template_name text,
  subject text,
  entity_type text, -- 'rfi', 'submittal', 'daily_log', 'digest'
  entity_id uuid,
  status text default 'queued', -- 'queued', 'sent', 'opened', 'clicked', 'bounced', 'complained'
  sendgrid_message_id text,
  sent_at timestamp,
  opened_at timestamp,
  clicked_at timestamp,
  failed_reason text,
  created_at timestamp default now()
);

create index idx_email_log_user on email_log(user_id, created_at);
create index idx_email_log_entity on email_log(entity_type, entity_id);
create index idx_email_log_status on email_log(status);

-- Capture replies
create table email_replies (
  id uuid primary key default gen_random_uuid(),
  email_log_id uuid not null references email_log(id) on delete cascade,
  from_address text,
  subject text,
  body_text text,
  body_html text,
  attachments jsonb, -- array of {filename, url, mime_type}
  parsed_content jsonb, -- extracted data (for RFI replies, submittal approvals, etc.)
  created_at timestamp default now()
);

create index idx_email_replies_email_log on email_replies(email_log_id);

-- User notification preferences
create table notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  rfi_notification_method text default 'email', -- 'email', 'push', 'sms', 'none'
  submittal_notification_method text default 'email',
  change_order_notification_method text default 'email',
  daily_reminder_enabled boolean default true,
  daily_reminder_time time default '15:00:00', -- 3 PM
  daily_digest_enabled boolean default true,
  daily_digest_time time default '19:00:00', -- 7 PM
  daily_digest_timezone text default 'America/Denver',
  critical_alert_method text default 'email', -- email + sms or push for critical
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_notification_preferences_user on notification_preferences(user_id);
```

### Email Templates

#### 1. RFI Notification
```
Subject: {{project_name}}: New RFI #{{rfi_number}} from {{submitted_by_company}}

Dear {{recipient_name}},

A new Request for Information has been submitted on {{project_name}}:

RFI #{{rfi_number}}: {{rfi_title}}

Question: {{rfi_description}}

Submitted by: {{submitted_by_company}}
Due by: {{due_date}}

[View RFI in SiteSync] (button linking to sitesync.app/rfis/{{rfi_id}})

Reply to this email to add a response.

Best regards,
SiteSync AI
```

#### 2. Submittal Request
```
Subject: {{project_name}}: Submittal Requested - {{submittal_title}}

Dear {{recipient_name}},

A submittal has been requested on {{project_name}}:

{{submittal_title}}
Spec Section: {{spec_section}}

Due by: {{due_date}}

[Review Submittal] (button)

Reply to this email with your submittal document.

Best regards,
SiteSync AI
```

#### 3. Daily Log Reminder
```
Subject: {{project_name}}: Daily Log Reminder for {{log_date}}

Hi {{recipient_name}},

Don't forget to log today's activity on {{project_name}}:

- Weather conditions
- Work performed
- Crews and labor
- Equipment used
- Safety events
- Photos and notes

[Open Daily Log] (button linking to sitesync.app/daily-log/{{date}})

This is an automated reminder. Reply to this email if you have questions.

Best regards,
SiteSync AI
```

#### 4. Daily Digest (7 PM)
```
Subject: {{project_name}} Daily Digest | {{digest_date}}

Hi {{recipient_name}},

Here's today's summary for {{project_name}}:

New RFIs: {{new_rfis_count}}
Overdue RFIs: {{overdue_rfis_count}}

New Submittals: {{new_submittals_count}}
Pending Review: {{pending_submittals_count}}

Critical Alerts: {{critical_alerts_count}}

[View Dashboard] (button)

Sent at {{digest_time}} {{digest_timezone}}
```

### Edge Functions

#### `email-send`
```typescript
export async function emailSend(req: Request) {
  const { userId, templateName, variables, entityType, entityId } = await req.json();

  try {
    // 1. Get user email and notification preference
    const user = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    const prefs = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    // 2. Check notification method (if email, continue; if none, return)
    const methodField = `${entityType}_notification_method`;
    if (prefs[methodField] === 'none') {
      return { skipped: true, reason: 'User opted out' };
    }

    // 3. Get email template
    const template = await supabase
      .from('email_templates')
      .select('*')
      .eq('name', templateName)
      .single();

    // 4. Render subject and HTML
    const subject = renderTemplate(template.subject_template, variables);
    const htmlBody = renderTemplate(template.html_template, variables);
    const textBody = renderTemplate(template.text_template, variables);

    // 5. Send via SendGrid
    const sgResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: user.email }],
          subject
        }],
        from: { email: 'noreply@sitesync.ai', name: 'SiteSync AI' },
        reply_to: { email: `reply+${entityType}-${entityId}@sitesync.ai` },
        content: [
          { type: 'text/plain', value: textBody },
          { type: 'text/html', value: htmlBody }
        ],
        tracking_settings: {
          open_tracking: { enable: true },
          click_tracking: { enable: true }
        },
        custom_args: {
          sitesync_user_id: userId,
          sitesync_entity_type: entityType,
          sitesync_entity_id: entityId
        }
      })
    });

    if (!sgResponse.ok) throw new Error(await sgResponse.text());

    const headers = sgResponse.headers;
    const messageId = headers.get('x-message-id');

    // 6. Log to email_log
    await supabase
      .from('email_log')
      .insert({
        user_id: userId,
        to_address: user.email,
        template_name: templateName,
        subject,
        entity_type: entityType,
        entity_id: entityId,
        status: 'sent',
        sendgrid_message_id: messageId,
        sent_at: new Date()
      });

    return { success: true, messageId };
  } catch (error) {
    logError(error);
    return { error: error.message };
  }
}

// Helper: simple template rendering
function renderTemplate(template: string, variables: Record<string, string>) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}
```

#### `email-inbound-webhook`
```typescript
// Receives email replies from SendGrid Inbound Parse
// Webhook URL: https://sitesync.app/webhooks/sendgrid/inbound

export async function emailInboundWebhook(req: Request) {
  const formData = await req.formData();

  try {
    // 1. Parse SendGrid inbound payload
    const fromAddress = formData.get('from');
    const subject = formData.get('subject');
    const text = formData.get('text');
    const html = formData.get('html');
    const customArgs = JSON.parse(formData.get('custom_args') || '{}');

    const { sitesync_entity_type, sitesync_entity_id } = customArgs;

    // 2. Find corresponding email_log entry
    const emailLog = await supabase
      .from('email_log')
      .select('*')
      .eq('entity_type', sitesync_entity_type)
      .eq('entity_id', sitesync_entity_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 3. Create email_replies entry
    const reply = await supabase
      .from('email_replies')
      .insert({
        email_log_id: emailLog.id,
        from_address: fromAddress,
        subject,
        body_text: text,
        body_html: html,
        parsed_content: parseEmailContent(text, sitesync_entity_type)
      })
      .select()
      .single();

    // 4. Trigger entity update based on entity_type
    if (sitesync_entity_type === 'rfi') {
      await handleRFIReply(sitesync_entity_id, reply.parsed_content);
    } else if (sitesync_entity_type === 'submittal') {
      await handleSubmittalReply(sitesync_entity_id, reply.parsed_content);
    }

    return { success: true, replyId: reply.id };
  } catch (error) {
    logError(error);
    return { error: error.message };
  }
}

// Helper: extract structured data from email reply
function parseEmailContent(emailText: string, entityType: string) {
  // For RFI replies: extract answer
  if (entityType === 'rfi') {
    return {
      answer: emailText,
      confidence: 'high'
    };
  }
  // For submittal replies: detect approval/rejection keywords
  if (entityType === 'submittal') {
    const approved = /approved|approved|looks good|accepted|ok/i.test(emailText);
    const rejected = /rejected|rejected|needs revision|not approved|no/i.test(emailText);
    return {
      status: approved ? 'approved' : rejected ? 'rejected' : 'pending_review',
      notes: emailText,
      confidence: approved || rejected ? 'high' : 'low'
    };
  }
  return { raw_text: emailText };
}

async function handleRFIReply(rfiId: string, parsedContent: any) {
  // Create RFI response
  await supabase
    .from('rfi_responses')
    .insert({
      rfi_id: rfiId,
      response_text: parsedContent.answer,
      source: 'email',
      created_at: new Date()
    });

  // Notify RFI submitter
  // ... send email/push notification
}

async function handleSubmittalReply(submittalId: string, parsedContent: any) {
  // Update submittal status based on parsed approval/rejection
  await supabase
    .from('submittals')
    .update({
      status: parsedContent.status,
      status_changed_at: new Date()
    })
    .eq('id', submittalId);

  // Notify parties
  // ... send notifications
}
```

#### `email-daily-reminder`
```typescript
// Cron job daily at 3 PM (runs in each project's timezone)
// Sends daily log reminder to project manager(s)

export async function emailDailyReminder() {
  try {
    // 1. Get all active projects and their PMs
    const projects = await supabase
      .from('projects')
      .select('id, name, timezone')
      .eq('status', 'active');

    // 2. For each project, send reminder to PMs who have it enabled
    for (const project of projects) {
      const pms = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', project.id)
        .in('role', ['project_manager', 'superintendent']);

      for (const pm of pms) {
        const prefs = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', pm.user_id)
          .single();

        if (prefs.daily_reminder_enabled) {
          await emailSend({
            userId: pm.user_id,
            templateName: 'daily_log_reminder',
            variables: {
              project_name: project.name,
              log_date: new Date().toDateString()
            },
            entityType: 'daily_log',
            entityId: project.id
          });
        }
      }
    }

    return { success: true };
  } catch (error) {
    logError(error);
  }
}
```

#### `email-daily-digest`
```typescript
// Cron job daily at 7 PM (each user's timezone from prefs)

export async function emailDailyDigest() {
  try {
    // 1. Get all users with digest enabled
    const users = await supabase
      .from('notification_preferences')
      .select('user_id')
      .eq('daily_digest_enabled', true);

    // 2. For each user, aggregate their projects' metrics
    for (const userPref of users) {
      const userId = userPref.user_id;

      // Get user's projects
      const projects = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId);

      const projectIds = projects.map(p => p.project_id);

      // Get today's counts
      const today = new Date().toISOString().split('T')[0];
      const newRFIs = await supabase
        .from('rfis')
        .select('count', { count: 'exact' })
        .in('project_id', projectIds)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);

      const overduRFIs = await supabase
        .from('rfis')
        .select('count', { count: 'exact' })
        .in('project_id', projectIds)
        .eq('status', 'open')
        .lt('due_at', today);

      const newSubmittals = await supabase
        .from('submittals')
        .select('count', { count: 'exact' })
        .in('project_id', projectIds)
        .gte('created_at', `${today}T00:00:00`);

      // ... get other metrics

      // Send digest email
      await emailSend({
        userId,
        templateName: 'daily_digest',
        variables: {
          project_name: 'Your Projects',
          new_rfis_count: newRFIs.count.toString(),
          overdue_rfis_count: overduRFIs.count.toString(),
          new_submittals_count: newSubmittals.count.toString(),
          pending_submittals_count: '0', // compute
          critical_alerts_count: '0', // compute
          digest_date: new Date().toDateString()
        },
        entityType: 'digest',
        entityId: userId
      });
    }

    return { success: true };
  } catch (error) {
    logError(error);
  }
}
```

#### `sendgrid-event-webhook`
```typescript
// Receives delivery, open, click, bounce, complaint events from SendGrid
// Updates email_log status

export async function sendgridEventWebhook(req: Request) {
  const events = await req.json(); // Array of events

  for (const event of events) {
    const messageId = event.sg_message_id;
    const eventType = event.event; // 'open', 'click', 'bounce', 'complaint', 'dropped', 'delivered'

    let updateData = {};
    if (eventType === 'open') {
      updateData = { status: 'opened', opened_at: new Date() };
    } else if (eventType === 'click') {
      updateData = { status: 'clicked', clicked_at: new Date() };
    } else if (eventType === 'bounce' || eventType === 'dropped') {
      updateData = { status: 'bounced', failed_reason: event.reason || event.response };
    } else if (eventType === 'complaint') {
      updateData = { status: 'complained' };
    }

    await supabase
      .from('email_log')
      .update(updateData)
      .eq('sendgrid_message_id', messageId);
  }

  return { success: true };
}
```

### Frontend
- **Settings**: Notification preferences form with toggles for each notification type and time/method selectors
- **Email Log**: Admin view of all sent emails, bounce/complaint rates, resend failed emails

### Error Handling
- SendGrid API down: Queue emails in sync_queue, retry every 5 minutes
- Invalid email address: Mark as bounced, alert user to update
- Spam complaints: Disable email for that user, log to compliance

---

## 5. SMS & Push Notifications (Twilio + OneSignal)

### Purpose
Critical alerts via SMS (overdue RFIs, rejected submittals, schedule delays), daily log reminders, push notifications for mobile app.

### Providers
- **Twilio**: SMS and voice calls
  - **API**: https://api.twilio.com
  - **Auth**: Account SID + Auth Token
  - **Cost**: $0.0075 per SMS

- **OneSignal**: Push notifications
  - **API**: https://onesignal.com/api/v1
  - **Auth**: App ID + API Key
  - **Cost**: Free up to 10K subscribers, then tiered

### Database Schema
```sql
create table user_phone (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  phone_number text not null, -- E.164 format: +14155552671
  is_verified boolean default false,
  verified_at timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_user_phone_user on user_phone(user_id);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_type text, -- 'ios', 'android', 'web'
  onesignal_player_id text unique,
  app_version text,
  os_version text,
  is_active boolean default true,
  last_active_at timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_push_subscriptions_user on push_subscriptions(user_id);
create index idx_push_subscriptions_active on push_subscriptions(is_active);

create table notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text, -- 'sms', 'push', 'email'
  channel text, -- 'critical_alert', 'daily_reminder', 'digest', etc.
  title text,
  body text,
  entity_type text,
  entity_id uuid,
  delivery_status text default 'pending', -- 'pending', 'sent', 'delivered', 'failed'
  delivery_error text,
  created_at timestamp default now(),
  delivered_at timestamp
);

create index idx_notification_log_user on notification_log(user_id, created_at);
create index idx_notification_log_status on notification_log(delivery_status);
```

### Edge Functions

#### `sms-send`
```typescript
// Send critical alerts via SMS
// Called only for critical situations (overdue, rejected, late)

export async function smsSend(req: Request) {
  const { userId, alertType, alertData } = await req.json();

  try {
    // 1. Get user phone number
    const userPhone = await supabase
      .from('user_phone')
      .select('*')
      .eq('user_id', userId)
      .eq('is_verified', true)
      .single();

    if (!userPhone) {
      return { skipped: true, reason: 'No verified phone' };
    }

    // 2. Check notification preferences
    const prefs = await supabase
      .from('notification_preferences')
      .select('critical_alert_method')
      .eq('user_id', userId)
      .single();

    if (!prefs.critical_alert_method.includes('sms')) {
      return { skipped: true, reason: 'SMS disabled for critical alerts' };
    }

    // 3. Compose message based on alertType
    let message = '';
    if (alertType === 'OVERDUE_RFI') {
      message = `SiteSync: RFI #${alertData.rfi_number} "${alertData.rfi_title}" is now overdue (due ${alertData.due_date}).`;
    } else if (alertType === 'REJECTED_SUBMITTAL') {
      message = `SiteSync: Submittal "${alertData.submittal_title}" was rejected. Reason: ${alertData.rejection_reason}`;
    } else if (alertType === 'SCHEDULE_DELAY') {
      message = `SiteSync: Schedule alert on ${alertData.project_name}. Activity "${alertData.activity_name}" is ${alertData.days_late} days behind.`;
    }

    // 4. Send via Twilio
    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(
            process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN
          )
        },
        body: new URLSearchParams({
          From: process.env.TWILIO_PHONE_NUMBER,
          To: userPhone.phone_number,
          Body: message
        })
      }
    );

    if (!twilioResponse.ok) {
      throw new Error(await twilioResponse.text());
    }

    const twilioData = await twilioResponse.json();

    // 5. Log notification
    await supabase
      .from('notification_log')
      .insert({
        user_id: userId,
        notification_type: 'sms',
        channel: 'critical_alert',
        title: alertType,
        body: message,
        entity_type: alertData.entity_type,
        entity_id: alertData.entity_id,
        delivery_status: 'sent',
        delivered_at: new Date()
      });

    return { success: true, twilioSid: twilioData.sid };
  } catch (error) {
    logError(error);
    return { error: error.message };
  }
}
```

#### `push-send`
```typescript
// Send push notifications via OneSignal

export async function pushSend(req: Request) {
  const { userId, title, body, data } = await req.json();

  try {
    // 1. Get user's push subscriptions
    const subscriptions = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (subscriptions.length === 0) {
      return { skipped: true, reason: 'No active push subscriptions' };
    }

    const playerIds = subscriptions.map(s => s.onesignal_player_id);

    // 2. Send via OneSignal
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
        'Content Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        app_id: process.env.ONESIGNAL_APP_ID,
        include_player_ids: playerIds,
        headings: { en: title },
        contents: { en: body },
        data: data, // Custom data for app to handle
        ios_badgeType: 'Increase',
        ios_badgeCount: 1
      })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const onesignalData = await response.json();

    // 3. Log notification
    await supabase
      .from('notification_log')
      .insert({
        user_id: userId,
        notification_type: 'push',
        channel: data.channel || 'app_notification',
        title,
        body,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        delivery_status: 'sent',
        delivered_at: new Date()
      });

    return { success: true, notificationId: onesignalData.id };
  } catch (error) {
    logError(error);
    return { error: error.message };
  }
}
```

#### `verify-phone-number`
```typescript
// Two step SMS verification for phone number

export async function verifyPhoneNumber(req: Request) {
  const { userId, phoneNumber, code } = await req.json();

  if (!code) {
    // Step 1: Send verification code
    try {
      const verificationCode = Math.random().toString().slice(2, 8); // 6 digits

      // Send via Twilio
      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + btoa(
              process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN
            )
          },
          body: new URLSearchParams({
            From: process.env.TWILIO_PHONE_NUMBER,
            To: phoneNumber,
            Body: `Your SiteSync verification code is: ${verificationCode}`
          })
        }
      );

      // Store code in Redis with 10 minute expiry
      await redis.set(
        `phone_verify:${userId}`,
        JSON.stringify({ code, phoneNumber }),
        'EX',
        600
      );

      return { success: true, message: 'Verification code sent' };
    } catch (error) {
      return { error: error.message };
    }
  } else {
    // Step 2: Verify code
    try {
      const stored = await redis.get(`phone_verify:${userId}`);
      if (!stored) {
        return { error: 'Verification code expired' };
      }

      const { code: savedCode, phoneNumber: savedPhone } = JSON.parse(stored);
      if (code !== savedCode) {
        return { error: 'Invalid verification code' };
      }

      // Save phone number
      await supabase
        .from('user_phone')
        .upsert(
          {
            user_id: userId,
            phone_number: savedPhone,
            is_verified: true,
            verified_at: new Date()
          },
          { onConflict: 'user_id' }
        );

      await redis.del(`phone_verify:${userId}`);

      return { success: true, message: 'Phone number verified' };
    } catch (error) {
      return { error: error.message };
    }
  }
}
```

#### `push-register-device`
```typescript
// Called from mobile app when user logs in or installs app

export async function pushRegisterDevice(req: Request) {
  const { userId, deviceType, playerId, appVersion, osVersion } = await req.json();

  try {
    await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          device_type: deviceType,
          onesignal_player_id: playerId,
          app_version: appVersion,
          os_version: osVersion,
          is_active: true,
          last_active_at: new Date()
        },
        { onConflict: 'onesignal_player_id' }
      );

    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}
```

#### `critical-alert-trigger`
```typescript
// Called when critical event occurs (RFI overdue, submittal rejected, schedule delay)

export async function criticalAlertTrigger(req: Request) {
  const { alertType, alertData } = await req.json();

  try {
    // 1. Determine affected users
    let affectedUsers = [];
    if (alertType === 'OVERDUE_RFI') {
      affectedUsers = await getProjectManagers(alertData.project_id);
    } else if (alertType === 'REJECTED_SUBMITTAL') {
      affectedUsers = [alertData.submitted_by_user_id];
    } else if (alertType === 'SCHEDULE_DELAY') {
      affectedUsers = await getProjectManagers(alertData.project_id);
    }

    // 2. For each user, send SMS and push notification
    for (const userId of affectedUsers) {
      // SMS (only if critical)
      await smsSend({
        userId,
        alertType,
        alertData
      });

      // Push notification
      await pushSend({
        userId,
        title: `Critical Alert: ${alertType}`,
        body: alertData.message || formatAlertMessage(alertType, alertData),
        data: {
          alertType,
          entity_type: alertData.entity_type,
          entity_id: alertData.entity_id,
          channel: 'critical_alert'
        }
      });
    }

    return { success: true, notifiedCount: affectedUsers.length };
  } catch (error) {
    logError(error);
    return { error: error.message };
  }
}

function formatAlertMessage(alertType: string, data: any): string {
  if (alertType === 'OVERDUE_RFI') {
    return `RFI #${data.rfi_number} is overdue`;
  }
  // ... other types
  return 'Critical alert on your project';
}
```

### Frontend

#### Mobile App Integration
- OneSignal SDK initialization in app shell
- Register device on login via `push-register-device` edge function
- Handle notification taps (deep link to relevant entity)
- Settings: Enable/disable push, manage notification channels

#### Web Settings
- Phone number verification form with SMS code entry
- Notification preference toggles (email, SMS, push per alert type)
- Do not disturb schedule (e.g., "Do not send SMS between 8 PM and 8 AM")

### Error Handling
- Twilio error (invalid number): Mark as failed, alert user
- OneSignal error (player not found): Remove subscription
- High failure rate: Alert admin to investigate

---

## 6. Document & Drawing Viewers

### Purpose
View and annotate PDFs, drawings (DWG/PDF), markup with comments, version comparison.

### Libraries
- **PDF Viewer**: PDF.js (Mozilla) + pdfjs-dist npm package
- **Drawing Viewer**: OpenSeadragon for high res pan/zoom
- **Markup/Annotation**: Fabric.js for canvas based drawing
- **Version Comparison**: Custom overlay comparison

### Database Schema
```sql
create table drawing_markups (
  id uuid primary key default gen_random_uuid(),
  drawing_id uuid not null references drawings(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id),
  markup_type text, -- 'comment', 'line', 'circle', 'rectangle', 'stamp', 'freehand'
  svg_path text, -- SVG for shapes, base64 for freehand
  color text, -- Hex color
  page_number int,
  x_percent float, -- Normalized 0 1 position
  y_percent float,
  text_content text, -- For comment markup
  timestamp_ms int, -- Position in video if drawing is video
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_drawing_markups_drawing on drawing_markups(drawing_id);
create index idx_drawing_markups_user on drawing_markups(created_by_user_id);

create table drawing_versions (
  id uuid primary key default gen_random_uuid(),
  drawing_id uuid not null references drawings(id) on delete cascade,
  version_number int,
  file_url text,
  file_size_bytes int,
  md5_hash text unique,
  uploaded_by_user_id uuid not null references auth.users(id),
  revision_date date,
  revision_notes text,
  comparison_with_version_id uuid references drawing_versions(id),
  created_at timestamp default now()
);

create index idx_drawing_versions_drawing on drawing_versions(drawing_id, version_number);
```

### React Component: `PdfViewer`
```typescript
// components/PdfViewer.tsx
import { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useSidePanel } from '../hooks/useSidePanel';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PdfViewerProps {
  fileUrl: string;
  documentTitle: string;
  onMarkupChange?: (markups: any[]) => void;
  isEditable?: boolean;
}

export function PdfViewer({
  fileUrl,
  documentTitle,
  onMarkupChange,
  isEditable = false
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [markups, setMarkups] = useState([]);
  const { openPanel } = useSidePanel();

  useEffect(() => {
    // Load PDF
    pdfjsLib.getDocument(fileUrl).promise.then((pdf) => {
      setPdf(pdf);
      setNumPages(pdf.numPages);
    });
  }, [fileUrl]);

  useEffect(() => {
    // Render current page
    if (!pdf) return;

    pdf.getPage(pageNumber).then((page) => {
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      page.render({ canvasContext: context, viewport }).promise;
    });
  }, [pdf, pageNumber, scale]);

  const handleAddComment = (x: number, y: number) => {
    if (!isEditable) return;

    openPanel({
      type: 'markup_comment',
      data: { x, y, pageNumber },
      onSave: (comment) => {
        const newMarkup = {
          id: Math.random(),
          markup_type: 'comment',
          text_content: comment,
          x_percent: x / canvasRef.current.width,
          y_percent: y / canvasRef.current.height,
          page_number: pageNumber,
          created_at: new Date()
        };
        const updated = [...markups, newMarkup];
        setMarkups(updated);
        onMarkupChange?.(updated);
      }
    });
  };

  return (
    <div className="pdf-viewer">
      <div className="toolbar" style={{ display: 'flex', gap: 8, padding: 8, background: '#f7f8fa' }}>
        <button onClick={() => setScale(scale * 1.1)}>Zoom In</button>
        <button onClick={() => setScale(scale / 1.1)}>Zoom Out</button>
        <span>{Math.round(scale * 100)}%</span>
        <span>{pageNumber} / {numPages}</span>
        <button
          onClick={() => setPageNumber(Math.max(pageNumber - 1, 1))}
          disabled={pageNumber === 1}
        >
          Previous
        </button>
        <button
          onClick={() => setPageNumber(Math.min(pageNumber + 1, numPages))}
          disabled={pageNumber === numPages}
        >
          Next
        </button>
      </div>

      <div
        className="pdf-canvas-container"
        style={{ overflow: 'auto', flex: 1, position: 'relative' }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          handleAddComment(x, y);
        }}
      >
        <canvas ref={canvasRef} style={{ display: 'block' }} />

        {/* Markup overlay */}
        <div className="markups-overlay" style={{ position: 'absolute', top: 0, left: 0 }}>
          {markups
            .filter((m) => m.page_number === pageNumber)
            .map((markup) => (
              <div
                key={markup.id}
                className="markup"
                style={{
                  position: 'absolute',
                  left: `${markup.x_percent * 100}%`,
                  top: `${markup.y_percent * 100}%`,
                  width: 30,
                  height: 30,
                  background: '#F47820',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 'bold'
                }}
                title={markup.text_content}
              >
                {markup.id}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
```

### React Component: `DrawingComparison`
```typescript
// components/DrawingComparison.tsx
// Side by side comparison of two drawing versions
// User can toggle between versions or see them overlaid

interface DrawingComparisonProps {
  version1: { id: string; fileUrl: string; versionNumber: number };
  version2: { id: string; fileUrl: string; versionNumber: number };
  comparisonMode: 'side-by-side' | 'overlay' | 'slider';
}

export function DrawingComparison({
  version1,
  version2,
  comparisonMode
}: DrawingComparisonProps) {
  const [sliderPosition, setSliderPosition] = useState(50);

  if (comparisonMode === 'side-by-side') {
    return (
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <h3>Version {version1.versionNumber}</h3>
          <PdfViewer fileUrl={version1.fileUrl} documentTitle="Version 1" isEditable={false} />
        </div>
        <div style={{ flex: 1 }}>
          <h3>Version {version2.versionNumber}</h3>
          <PdfViewer fileUrl={version2.fileUrl} documentTitle="Version 2" isEditable={false} />
        </div>
      </div>
    );
  }

  if (comparisonMode === 'slider') {
    return (
      <div style={{ position: 'relative', width: '100%', height: 600 }}>
        {/* Version 2 background */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <PdfViewer fileUrl={version2.fileUrl} documentTitle="Version 2" isEditable={false} />
        </div>
        {/* Version 1 overlay with clip path */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: `${sliderPosition}%`,
            overflow: 'hidden'
          }}
        >
          <PdfViewer fileUrl={version1.fileUrl} documentTitle="Version 1" isEditable={false} />
        </div>
        {/* Slider handle */}
        <input
          type="range"
          min="0"
          max="100"
          value={sliderPosition}
          onChange={(e) => setSliderPosition(Number(e.target.value))}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            width: '100%',
            zIndex: 10,
            height: '100%',
            opacity: 0,
            cursor: 'ew-resize'
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${sliderPosition}%`,
            top: 0,
            bottom: 0,
            width: 4,
            background: '#F47820',
            zIndex: 5,
            transform: 'translateX(-2px)'
          }}
        />
      </div>
    );
  }

  return null;
}
```

### Frontend Hook: `useDrawingMarkups`
```typescript
// hooks/useDrawingMarkups.ts

export function useDrawingMarkups(drawingId: string) {
  const [markups, setMarkups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMarkups() {
      const { data } = await supabase
        .from('drawing_markups')
        .select('*')
        .eq('drawing_id', drawingId)
        .order('created_at', { ascending: true });

      setMarkups(data || []);
      setLoading(false);
    }

    loadMarkups();

    // Subscribe to realtime updates
    const subscription = supabase
      .channel(`markups:${drawingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drawing_markups',
          filter: `drawing_id=eq.${drawingId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMarkups([...markups, payload.new]);
          } else if (payload.eventType === 'DELETE') {
            setMarkups(markups.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [drawingId]);

  const addMarkup = async (markup: Omit<DrawingMarkup, 'id' | 'created_at'>) => {
    const { data } = await supabase
      .from('drawing_markups')
      .insert(markup)
      .select()
      .single();

    return data;
  };

  const deleteMarkup = async (markupId: string) => {
    await supabase
      .from('drawing_markups')
      .delete()
      .eq('id', markupId);
  };

  return { markups, loading, addMarkup, deleteMarkup };
}
```

---

## 7. Mapping & Location Services (Mapbox)

### Purpose
Project location display, geofencing for auto check in, photo location tagging, field crew tracking.

### Provider: Mapbox
- **API**: https://api.mapbox.com
- **SDK**: mapbox gl js (npm package: mapbox-gl)
- **Authentication**: Access token (public, safe in frontend)
- **Cost**: Free tier 50K map loads/month

### Database Schema
```sql
create table project_location (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade unique,
  address text,
  lat numeric not null,
  lon numeric not null,
  geohash text, -- For spatial queries
  geofence_radius_m int default 100, -- Auto check in radius
  timezone text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_project_location_geohash on project_location(geohash);

create table crew_checkins (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  checkin_at timestamp not null,
  checkout_at timestamp,
  lat numeric,
  lon numeric,
  checkin_method text, -- 'manual', 'geofence_auto', 'qr_code'
  created_at timestamp default now()
);

create index idx_crew_checkins_project_date on crew_checkins(project_id, date(checkin_at));
create index idx_crew_checkins_user on crew_checkins(user_id, checkin_at);

create table photo_locations (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references photos(id) on delete cascade,
  lat numeric,
  lon numeric,
  accuracy_m int, -- GPS accuracy in meters
  captured_at timestamp,
  created_at timestamp default now()
);

create index idx_photo_locations_photo on photo_locations(photo_id);
```

### React Component: `MapboxProjectMap`
```typescript
// components/MapboxProjectMap.tsx
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapboxProjectMapProps {
  projectId: string;
  lat: number;
  lon: number;
  address?: string;
  geofenceRadius?: number;
  showCrewLocations?: boolean;
}

export function MapboxProjectMap({
  projectId,
  lat,
  lon,
  address,
  geofenceRadius = 100,
  showCrewLocations = false
}: MapboxProjectMapProps) {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return;

    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lon, lat],
      zoom: 16
    });

    // Add project location marker
    new mapboxgl.Marker({ color: '#F47820' })
      .setLngLat([lon, lat])
      .setPopup(new mapboxgl.Popup().setHTML(`
        <strong>${address || 'Project Site'}</strong><br/>
        ${lat.toFixed(4)}, ${lon.toFixed(4)}
      `))
      .addTo(map.current);

    // Draw geofence circle
    const geofenceFeature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lon, lat]
      }
    };

    // Add geofence layer (using mapbox circle layer)
    map.current.addLayer({
      id: 'geofence',
      type: 'circle',
      source: {
        type: 'geojson',
        data: geofenceFeature
      },
      paint: {
        'circle-radius': geofenceRadius / 111000 * 111.32, // Rough conversion to degrees
        'circle-color': '#4EC896',
        'circle-opacity': 0.1,
        'circle-stroke-color': '#4EC896',
        'circle-stroke-width': 2,
        'circle-stroke-opacity': 0.5
      }
    });

    // Load crew locations if enabled
    if (showCrewLocations) {
      loadCrewLocations();
    }

    return () => {
      // Cleanup on unmount
    };
  }, [lat, lon, geofenceRadius, showCrewLocations]);

  const loadCrewLocations = async () => {
    // Fetch recent crew checkins from API
    // Add markers to map
  };

  return (
    <div
      ref={mapContainer}
      style={{ width: '100%', height: '500px', borderRadius: 8 }}
    />
  );
}
```

### Geofencing Logic: `useGeofence` Hook
```typescript
// hooks/useGeofence.ts

export function useGeofence(projectId: string) {
  const [isNearProject, setIsNearProject] = useState(false);

  useEffect(() => {
    // Get project location
    const getProjectLocation = async () => {
      const { data } = await supabase
        .from('project_location')
        .select('lat, lon, geofence_radius_m')
        .eq('project_id', projectId)
        .single();

      if (!data) return;

      // Start watching user location
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;

          // Calculate distance
          const distance = calculateDistance(
            latitude,
            longitude,
            data.lat,
            data.lon
          );

          const isInFence = distance < (data.geofence_radius_m / 1000);

          if (isInFence && !isNearProject) {
            // User entered geofence, auto check in
            handleAutoCheckin(projectId);
            setIsNearProject(true);
          } else if (!isInFence && isNearProject) {
            // User left geofence, auto check out
            handleAutoCheckout(projectId);
            setIsNearProject(false);
          }
        },
        (error) => console.error(error),
        { enableHighAccuracy: true, maximumAge: 30000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    };

    getProjectLocation();
  }, [projectId]);

  return { isNearProject };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Haversine formula
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function handleAutoCheckin(projectId: string) {
  const { data: user } = await supabase.auth.getUser();

  await supabase
    .from('crew_checkins')
    .insert({
      project_id: projectId,
      user_id: user.id,
      checkin_at: new Date(),
      checkin_method: 'geofence_auto'
    });

  // Send notification
  await pushSend({
    userId: user.id,
    title: 'Checked In',
    body: 'You have been automatically checked in to the project site.',
    data: { entityType: 'checkin', projectId }
  });
}
```

### Photo Location Capture
```typescript
// When user captures photo in FieldCapture
const handlePhotoCapture = async (blob: Blob) => {
  // Get current location
  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject);
  });

  const { latitude, longitude, accuracy } = position.coords;

  // Upload photo and location
  const { data: photo } = await supabase
    .from('photos')
    .insert({
      // ... photo data
    })
    .select()
    .single();

  await supabase
    .from('photo_locations')
    .insert({
      photo_id: photo.id,
      lat: latitude,
      lon: longitude,
      accuracy_m: Math.round(accuracy),
      captured_at: new Date()
    });
};
```

---

## 8. Accounting Integration (QuickBooks Online)

### Purpose
Export invoices (pay applications) to accounting, import cost codes, budget sync.

### Provider: Intuit QuickBooks Online
- **API**: https://quickbooks.api.intuit.com
- **OAuth 2.0**: Auth code flow
- **Realm ID**: Customer's QuickBooks company ID
- **Rate Limit**: 10 requests per second per app

### Database Schema
```sql
create table quickbooks_oauth (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamp not null,
  realm_id text not null, -- QuickBooks company ID
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_quickbooks_oauth_user on quickbooks_oauth(user_id);

create table qbo_cost_codes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  qbo_account_id text not null,
  qbo_account_name text,
  account_type text, -- Asset, Liability, Revenue, Expense, Equity
  sitesync_cost_code text,
  sitesync_category text,
  sync_status text default 'active',
  created_at timestamp default now()
);

create index idx_qbo_cost_codes_project on qbo_cost_codes(project_id);

create table pay_application_export (
  id uuid primary key default gen_random_uuid(),
  pay_application_id uuid not null references pay_applications(id) on delete cascade,
  project_id uuid not null references projects(id),
  qbo_invoice_id text,
  qbo_invoice_number text,
  export_status text default 'pending', -- 'pending', 'exported', 'error'
  export_error text,
  exported_at timestamp,
  created_at timestamp default now()
);

create index idx_pay_application_export_status on pay_application_export(export_status);
```

### Edge Functions

#### `quickbooks-oauth-callback`
```typescript
// Similar to Procore and Calendar OAuth flows
// Exchanges auth code for access and refresh tokens
// Stores in quickbooks_oauth table
```

#### `quickbooks-import-cost-codes`
```typescript
// Fetch all accounts from QuickBooks and import as cost codes
// Triggered manually or scheduled daily

export async function quickbooksImportCostCodes(req: Request) {
  const { projectId } = await req.json();

  try {
    // Get user's QBO credentials
    const { data: qboAuth } = await supabase
      .from('quickbooks_oauth')
      .select('*')
      .eq('project_id', projectId)
      .single();

    // Fetch accounts from QBO
    const response = await fetch(
      `https://quickbooks.api.intuit.com/v2/company/${qboAuth.realm_id}/query?query=SELECT * FROM Account`,
      {
        headers: {
          Authorization: `Bearer ${qboAuth.access_token}`,
          'Accept': 'application/json'
        }
      }
    );

    const { QueryResponse } = await response.json();
    const accounts = QueryResponse.Account || [];

    // Import each account as cost code
    for (const account of accounts) {
      await supabase
        .from('qbo_cost_codes')
        .upsert({
          project_id: projectId,
          qbo_account_id: account.Id,
          qbo_account_name: account.Name,
          account_type: account.AccountType,
          sitesync_cost_code: account.Name, // User can update mapping
          sitesync_category: mapQBOTypeToCategory(account.AccountType)
        }, {
          onConflict: 'qbo_account_id'
        });
    }

    return { success: true, imported: accounts.length };
  } catch (error) {
    return { error: error.message };
  }
}

function mapQBOTypeToCategory(accountType: string): string {
  const mapping = {
    'Expense': 'cost',
    'Asset': 'equipment',
    'Revenue': 'income',
    'Liability': 'liability'
  };
  return mapping[accountType] || 'other';
}
```

#### `quickbooks-export-invoice`
```typescript
// Export pay application as invoice to QuickBooks

export async function quickbooksExportInvoice(req: Request) {
  const { payApplicationId, projectId } = await req.json();

  try {
    // Get pay application details
    const { data: payApp } = await supabase
      .from('pay_applications')
      .select('*')
      .eq('id', payApplicationId)
      .single();

    // Get QBO auth
    const { data: qboAuth } = await supabase
      .from('quickbooks_oauth')
      .select('*')
      .eq('project_id', projectId)
      .single();

    // Build QBO invoice from pay application
    const qboInvoice = {
      Line: payApp.line_items.map((item: any) => ({
        DetailType: 'SalesItemLineDetail',
        Description: item.description,
        Amount: item.amount,
        SalesItemLineDetail: {
          ItemRef: { value: item.cost_code } // Maps to QBO account
        }
      })),
      CustomerRef: { value: payApp.customer_id },
      DueDate: payApp.due_date,
      DocNumber: payApp.number,
      TxnDate: new Date().toISOString().split('T')[0]
    };

    // POST to QuickBooks
    const response = await fetch(
      `https://quickbooks.api.intuit.com/v2/company/${qboAuth.realm_id}/invoice`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${qboAuth.access_token}`,
          'Content Type': 'application/json'
        },
        body: JSON.stringify(qboInvoice)
      }
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const { Invoice } = await response.json();

    // Update export log
    await supabase
      .from('pay_application_export')
      .upsert({
        pay_application_id: payApplicationId,
        project_id: projectId,
        qbo_invoice_id: Invoice.Id,
        qbo_invoice_number: Invoice.DocNumber,
        export_status: 'exported',
        exported_at: new Date()
      }, {
        onConflict: 'pay_application_id'
      });

    return { success: true, qboInvoiceId: Invoice.Id };
  } catch (error) {
    logError(error);

    // Log failure
    await supabase
      .from('pay_application_export')
      .upsert({
        pay_application_id: payApplicationId,
        project_id: projectId,
        export_status: 'error',
        export_error: error.message
      }, {
        onConflict: 'pay_application_id'
      });

    return { error: error.message };
  }
}
```

---

## 9. AI/LLM Integration (Anthropic Claude API)

### Purpose
AI assistant for RFI drafting, daily summary generation, schedule risk analysis, conflict detection, document Q&A.

### Provider: Anthropic Claude API
- **Model**: claude 3 5 sonnet (latest)
- **API**: https://api.anthropic.com/v1/messages
- **Authentication**: API key (process.env.ANTHROPIC_API_KEY)
- **Cost**: Based on input/output tokens

### Database Schema
```sql
create table ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  conversation_type text, -- 'rfi_draft', 'daily_summary', 'schedule_analysis', 'general_chat'
  title text,
  total_input_tokens int default 0,
  total_output_tokens int default 0,
  estimated_cost numeric default 0,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_ai_conversations_user_project on ai_conversations(user_id, project_id);

create table ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role text not null, -- 'user', 'assistant'
  content text not null,
  input_tokens int,
  output_tokens int,
  created_at timestamp default now()
);

create index idx_ai_messages_conversation on ai_messages(conversation_id);

-- Context documents for RAG
create table ai_context_docs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  entity_type text, -- 'rfi', 'drawing', 'spec', 'contract', 'meeting_notes'
  entity_id uuid,
  embedding vector(1536), -- OpenAI embeddings
  summary text,
  created_at timestamp default now()
);

create index idx_ai_context_docs_conversation on ai_context_docs(conversation_id);
```

### Edge Function: `ai-message`
```typescript
// Main AI conversation handler
// Supports multi turn conversations with memory and context

export async function aiMessage(req: Request) {
  const {
    conversationId,
    userId,
    projectId,
    userMessage,
    conversationType = 'general_chat',
    contextIds = [] // RFI IDs, drawing IDs, etc to include as context
  } = await req.json();

  try {
    // 1. Get or create conversation
    let conversation = conversationId
      ? (await supabase
          .from('ai_conversations')
          .select('*')
          .eq('id', conversationId)
          .single()).data
      : (await supabase
          .from('ai_conversations')
          .insert({
            user_id: userId,
            project_id: projectId,
            conversation_type: conversationType,
            title: userMessage.substring(0, 50) + '...'
          })
          .select()
          .single()).data;

    // 2. Build conversation history
    const { data: messages } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });

    const conversationHistory = messages.map((m) => ({
      role: m.role,
      content: m.content
    }));

    // 3. Fetch context documents (RAG)
    let contextText = '';
    for (const contextId of contextIds) {
      // Fetch RFI, drawing, etc. and add to context
      contextText += await buildContextForEntity(contextId);
    }

    // 4. Build system prompt
    const systemPrompt = buildSystemPrompt(
      conversationType,
      { projectId, userId },
      contextText
    );

    // 5. Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          ...conversationHistory,
          { role: 'user', content: userMessage }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const apiResponse = await response.json();
    const assistantMessage = apiResponse.content[0].text;
    const inputTokens = apiResponse.usage.input_tokens;
    const outputTokens = apiResponse.usage.output_tokens;

    // 6. Save messages to database
    await supabase
      .from('ai_messages')
      .insert([
        {
          conversation_id: conversation.id,
          role: 'user',
          content: userMessage,
          input_tokens: inputTokens,
          output_tokens: 0
        },
        {
          conversation_id: conversation.id,
          role: 'assistant',
          content: assistantMessage,
          input_tokens: 0,
          output_tokens: outputTokens
        }
      ]);

    // 7. Update conversation token count and cost
    const totalTokens =
      (conversation.total_input_tokens || 0) +
      inputTokens +
      outputTokens;
    const estimatedCost = calculateTokenCost(
      inputTokens + (conversation.total_input_tokens || 0),
      outputTokens + (conversation.total_output_tokens || 0)
    );

    await supabase
      .from('ai_conversations')
      .update({
        total_input_tokens: (conversation.total_input_tokens || 0) + inputTokens,
        total_output_tokens: (conversation.total_output_tokens || 0) + outputTokens,
        estimated_cost: estimatedCost,
        updated_at: new Date()
      })
      .eq('id', conversation.id);

    return {
      success: true,
      conversationId: conversation.id,
      assistantMessage,
      inputTokens,
      outputTokens
    };
  } catch (error) {
    logError(error);
    return { error: error.message };
  }
}

function buildSystemPrompt(
  conversationType: string,
  context: { projectId: string; userId: string },
  contextText: string
): string {
  const basePrompt = `You are SiteSync AI, an intelligent assistant for construction project managers. You have deep knowledge of construction industry practices, regulations, and terminology. Always speak like a construction professional, not a software PM.

Current Project Context:
${contextText}

You are helping with: ${conversationType}`;

  const typeSpecificPrompts = {
    rfi_draft: `${basePrompt}

Your task is to help draft professional RFI (Request for Information) documents. Structure them clearly:
1. Clear, specific question
2. Context (why it matters)
3. Deadline recommendation
4. Reference to relevant documents/specs

Make sure the RFI is constructive and not accusatory.`,

    daily_summary: `${basePrompt}

You are generating a daily activity summary for the project. Include:
1. Work completed
2. Weather conditions and impact
3. Crews and staffing
4. Safety events or near misses
5. Equipment and materials
6. Outstanding items or blockers

Be concise and factual.`,

    schedule_analysis: `${basePrompt}

You are analyzing schedule risks. For each activity:
1. Assess current status (on track, at risk, late)
2. Identify critical path impacts
3. Recommend mitigation strategies
4. Suggest acceleration options if behind

Use the project's schedule data to inform your analysis.`,

    conflict_detection: `${basePrompt}

You are identifying conflicts in project data:
1. Specification conflicts (contradictions in drawings/specs)
2. Schedule conflicts (overlapping crew work)
3. Budget conflicts (cost overruns vs budget)
4. Safety conflicts (risky work sequences)

Be specific about what conflicts exist and recommend resolution steps.`,

    general_chat: basePrompt
  };

  return typeSpecificPrompts[conversationType] || basePrompt;
}

async function buildContextForEntity(entityId: string): string {
  // Fetch entity (RFI, drawing, spec, etc.) and return summary
  // Example:
  const { data: rfi } = await supabase
    .from('rfis')
    .select('*')
    .eq('id', entityId)
    .single();

  if (rfi) {
    return `
RFI #${rfi.number}: ${rfi.title}
Question: ${rfi.description}
Status: ${rfi.status}
Due: ${rfi.due_at}
Submitted by: ${rfi.submitted_by_company}
Assigned to: ${rfi.assigned_to_company}
`;
  }

  return '';
}

function calculateTokenCost(
  inputTokens: number,
  outputTokens: number
): number {
  // Claude 3 5 Sonnet pricing (as of April 2026)
  const inputCost = inputTokens * (3 / 1000000); // $3 per 1M input tokens
  const outputCost = outputTokens * (15 / 1000000); // $15 per 1M output tokens
  return inputCost + outputCost;
}
```

### Edge Function: `ai-rfi-draft`
```typescript
// Specialized endpoint for drafting RFIs

export async function aiRFIDraft(req: Request) {
  const { projectId, userId, initialPrompt, drawingIds = [], specIds = [] } = await req.json();

  try {
    // Fetch context documents
    let contextText = 'Relevant Project Documents:\n';
    for (const drawingId of drawingIds) {
      const { data: drawing } = await supabase
        .from('drawings')
        .select('*')
        .eq('id', drawingId)
        .single();

      contextText += `\nDrawing: ${drawing.title} (Rev ${drawing.revision})\n`;
      // In real implementation, could extract key notes from drawing
    }

    // Call Claude with RFI drafting prompt
    const systemPrompt = `You are an expert construction RFI drafter. Create a professional, clear RFI that:
1. Asks a single, specific question
2. Provides context without being accusatory
3. References drawings/specs precisely
4. Suggests a reasonable deadline
5. Is formatted for immediate sending`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 512,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Context:\n${contextText}\n\nDraft RFI based on: ${initialPrompt}`
          }
        ]
      })
    });

    const apiResponse = await response.json();
    const draftText = apiResponse.content[0].text;

    return {
      success: true,
      draft: draftText,
      tokensUsed: apiResponse.usage.input_tokens + apiResponse.usage.output_tokens
    };
  } catch (error) {
    return { error: error.message };
  }
}
```

### Frontend Hook: `useAIAssistant`
```typescript
// hooks/useAIAssistant.ts

export function useAIAssistant(projectId: string, conversationType: string = 'general_chat') {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (userMessage: string, contextIds: string[] = []) => {
    try {
      setLoading(true);
      setError(null);

      const response = await supabase.functions.invoke('ai-message', {
        body: {
          conversationId,
          projectId,
          userMessage,
          conversationType,
          contextIds
        }
      });

      if (!response.success) throw new Error(response.error);

      setConversationId(response.conversationId);
      setMessages([
        ...messages,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: response.assistantMessage }
      ]);

      return response.assistantMessage;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const draftRFI = async (initialPrompt: string, drawingIds: string[] = []) => {
    try {
      setLoading(true);
      const response = await supabase.functions.invoke('ai-rfi-draft', {
        body: { projectId, initialPrompt, drawingIds }
      });

      return response.draft;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    conversationId,
    messages,
    loading,
    error,
    sendMessage,
    draftRFI
  };
}
```

### Frontend Component: `AICopilot`
```typescript
// pages/AICopilot.tsx
// Chat interface for AI assistant

export function AICopilot() {
  const { projectId } = useParams();
  const { conversationId, messages, loading, sendMessage } = useAIAssistant(
    projectId,
    'general_chat'
  );
  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (!input.trim()) return;

    setInput('');
    await sendMessage(input);
  };

  return (
    <div className="ai-copilot" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="messages" style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: 16,
              textAlign: msg.role === 'user' ? 'right' : 'left'
            }}
          >
            <div
              style={{
                display: 'inline-block',
                maxWidth: '70%',
                padding: 12,
                borderRadius: 8,
                background: msg.role === 'user' ? '#F47820' : '#f0f0f0',
                color: msg.role === 'user' ? 'white' : 'black'
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && <div>SiteSync is thinking...</div>}
      </div>

      <div className="input-area" style={{ padding: 16, borderTop: '1px solid #e0e0e0' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask SiteSync AI..."
            style={{
              flex: 1,
              padding: 12,
              border: '1px solid #ccc',
              borderRadius: 8
            }}
          />
          <button onClick={handleSend} disabled={loading}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Integration Summary Table

| Integration | Purpose | Auth | Data Flow | Rate Limit | Cost |
|---|---|---|---|---|---|
| OpenWeatherMap | Weather widget, schedule risk | API key | Edge function cron | 1K/day | Free |
| Procore | Project sync, RFI, submittal | OAuth 2 | Bidirectional via webhook | 500/min | Contact |
| Google Calendar | Meeting sync | OAuth 2 | Bidirectional via push | 10K/day | Free |
| Microsoft Outlook | Meeting sync | OAuth 2 | Bidirectional via webhook | 10K/day | Free |
| SendGrid | Email notifications | API key | Edge function on event | 100/min | $9.95/mo |
| Twilio | SMS alerts | API key | Edge function on event | 100/sec | $0.0075/SMS |
| OneSignal | Push notifications | API key | Edge function on event | 100/sec | Free |
| PDF.js | Document viewing | npm package | Frontend only | N/A | Free |
| OpenSeadragon | Drawing zoom | npm package | Frontend only | N/A | Free |
| Mapbox | Location, geofencing | API key | Edge function + frontend | 50K/mo | Free |
| QuickBooks | Invoice export, cost codes | OAuth 2 | Edge function on export | 10/sec | Contact |
| Anthropic Claude | AI assistant | API key | Edge function on message | Per request | Token based |

---

## Deployment Checklist

- [ ] All API keys stored in Supabase secrets (not in code)
- [ ] OAuth redirect URIs configured in each provider
- [ ] Webhook endpoints verified with providers
- [ ] Database schema migrations applied
- [ ] Edge functions deployed and tested
- [ ] Rate limiting configured in Redis
- [ ] Error logging via Sentry configured
- [ ] Monitoring dashboards set up for token usage
- [ ] User documentation for connecting integrations
- [ ] Fallback behavior tested for each integration failure scenario

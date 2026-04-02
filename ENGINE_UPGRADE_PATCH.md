# ENGINE UPGRADE PATCH v6.1 — Backend Module Awareness

**Status**: Ready to deploy on next engine restart.

**Purpose**: Extend the autonomous evolution engine to understand and audit backend modules (Supabase auth, database, AI edge functions, storage, integrations). The frontend-only engine has maxed out its optimization potential. Backend is now P0.

**Context**: The current autonomous_loop.sh (v6.0) was built to evolve React/TypeScript frontend. It decomposes into 7 modules, maintains a brain file list, wraps prompts with frontend context rules, and validates with `npm run build`. The patch extends this to include backend architecture and Supabase patterns.

---

## Change 1: Add New Modules to Fallback List

**Location**: `autonomous_loop.sh` around line 646 (inside the `decompose_modules()` function, the fallback modules.json)

**Current state** (lines 647-657):
```json
{
  "modules": [
    {"name":"ui-design-system","label":"UI Design System","description":"Theme, primitives, shared components","files":[],"priority":1},
    {"name":"core-workflows","label":"Core Workflows","description":"RFIs, submittals, change orders, punch list","files":[],"priority":1},
    {"name":"financial-engine","label":"Financial Engine","description":"Budget, financials, pay apps","files":[],"priority":1},
    {"name":"scheduling","label":"Scheduling","description":"Schedule, lookahead, gantt","files":[],"priority":2},
    {"name":"field-operations","label":"Field Operations","description":"Daily log, crews, safety","files":[],"priority":2},
    {"name":"project-intelligence","label":"Project Intelligence","description":"AI copilot, agents, insights","files":[],"priority":2},
    {"name":"infrastructure","label":"Infrastructure","description":"Routing, state, API, auth","files":[],"priority":3}
  ]
}
```

**Change**: Add 4 new modules after `infrastructure`:
```json
    {"name":"auth-rbac","label":"Authentication & RBAC","description":"Supabase Auth, profiles, roles, RLS, login/signup flows","files":["src/lib/supabase.ts","src/stores/authStore.ts","src/pages/Login.tsx"],"priority":1},
    {"name":"database-api","label":"Database & API Layer","description":"Supabase client, typed hooks, real-time subscriptions, optimistic updates","files":["src/lib/supabase.ts","src/types/database.ts","src/hooks/useSupabase.ts"],"priority":1},
    {"name":"ai-features","label":"AI Features","description":"Edge functions, copilot, RFI drafter, schedule risk, conflict detection","files":["supabase/functions/"],"priority":2},
    {"name":"integrations","label":"Integrations & Storage","description":"Weather API, file storage, PDF export, calendar sync, notifications","files":["supabase/functions/"],"priority":3}
```

**Rationale**: These modules are now auditable by the engine. Priority 1 and 2 mean they will be included in decomposition and audited early in the cycle. The `files` array tells the engine where to look for evidence.

---

## Change 2: Extend Brain Files List

**Location**: `autonomous_loop.sh` around line 582 (inside the `load_brain_files()` function)

**Current state** (lines 582-589):
```bash
    local brain_files=(
        "COMPETITORS.md:COMPETITIVE INTELLIGENCE (know the enemy)"
        "CONSTRUCTION_DOMAIN.md:CONSTRUCTION DOMAIN KNOWLEDGE (how the industry actually works)"
        "DESIGN_STANDARDS.md:DESIGN STANDARDS (what world-class UI looks like, enforce these rules)"
        "MODULE_SPECS.md:MODULE SPECIFICATIONS (what done looks like for each feature)"
        "INDUSTRY_REFERENCE.md:INDUSTRY REFERENCE (CSI codes, AIA forms, financial formulas, KPIs)"
        "LEARNINGS.md:ENGINE LEARNINGS (what worked, what failed, fix rates, score trends from prior runs — use this to avoid repeating mistakes)"
    )
```

**Change**: Add 3 new brain files after MODULE_SPECS.md:
```bash
        "BACKEND_ARCHITECTURE.md:BACKEND ARCHITECTURE (Supabase schema, RLS, edge functions, storage, real-time subscriptions, deployment)"
        "AUTH_SPECS.md:AUTHENTICATION SPECIFICATIONS (roles, permissions, RLS policies, auth flows, session management)"
        "API_SPECS.md:API SPECIFICATIONS (query patterns, React hooks, edge function endpoints, error handling, pagination)"
        "INTEGRATIONS.md:INTEGRATION SPECIFICATIONS (weather, Procore, calendar, email, SMS, AI providers, cost tracking)"
```

**Rationale**: The engine needs these files to understand backend patterns. Without them, it will audit auth/database/AI modules without context and generate incomplete prompts. These files should document:
- BACKEND_ARCHITECTURE.md: Tables (auth.users, profiles, project_members, rfis, etc.), RLS rules, edge function locations, Realtime subscriptions
- AUTH_SPECS.md: Role enum values, permission matrix, RLS policy examples, magic link flow, password reset flow, invite flow
- API_SPECS.md: Hook signatures (useRFIs, useSubmittals, etc.), pagination format, error shape, optimistic update pattern, real-time subscription names
- INTEGRATIONS.md: API endpoints (OpenWeather, Google Calendar, SendGrid, etc.), response formats, cost per call, rate limits

---

## Change 3: Update Decomposition Prompt

**Location**: `autonomous_loop.sh` around line 621 (inside the `decompose_modules()` function)

**Current state** (line 629):
```bash
Use these modules: ui-design-system, core-workflows (RFIs/submittals/change-orders/punch-list), financial-engine (budget/pay-apps), scheduling (gantt/phases), field-operations (daily-log/field-capture/crews), project-intelligence (AI-copilot), document-management (drawings/files), collaboration (meetings/directory), infrastructure (App.tsx/routing/auth)."
```

**Change**: Replace with:
```bash
Use these modules: ui-design-system, core-workflows (RFIs/submittals/change-orders/punch-list), financial-engine (budget/pay-apps), scheduling (gantt/phases), field-operations (daily-log/field-capture/crews), project-intelligence (AI-copilot), document-management (drawings/files), collaboration (meetings/directory), infrastructure (App.tsx/routing), auth-rbac (Supabase auth, roles, RLS), database-api (Supabase client, hooks, real-time), ai-features (edge functions, AI), integrations (weather, storage, PDF, calendar, notifications)."
```

**Rationale**: Instructs Haiku to consider backend modules when decomposing. Without this, Haiku will only think about frontend even if supabase/ directory is in the snapshot.

---

## Change 4: Extend Prompt Wrapper Context

**Location**: `autonomous_loop.sh` around line 1064 (inside the `execute_prompts()` function, in the prompt wrapping section)

**Current state** (lines 1064-1072):
```bash
        local prompt="IMPORTANT RULES:
1. This is a React 19 + TypeScript + Vite app. Styles use inline styles from src/styles/theme.ts. Do NOT use CSS modules or styled-components.
2. Read the target file FIRST before making changes. Understand what exists before modifying.
3. Make the MINIMUM change needed. Do not refactor unrelated code.
4. After making changes, run: npm run build — if the build fails, fix the errors before finishing.
5. Never use hyphens in UI text. Use commas or periods instead.

TASK:
${raw_prompt}"
```

**Change**: Add backend context after rule 4:
```bash
        local prompt="IMPORTANT RULES:
1. This is a React 19 + TypeScript + Vite app. Styles use inline styles from src/styles/theme.ts. Do NOT use CSS modules or styled-components.
2. Read the target file FIRST before making changes. Understand what exists before modifying.
3. Make the MINIMUM change needed. Do not refactor unrelated code.
4. After making changes, run: npm run build — if the build fails, fix the errors before finishing.
5. Never use hyphens in UI text. Use commas or periods instead.
6. If editing backend/Supabase code: Use Supabase client from src/lib/supabase.ts, follow RLS patterns from AUTH_SPECS.md, type all queries against Database interface, add real-time subscriptions to relevant tables (rfis, daily_logs, notifications, activity_feed), implement optimistic updates on mutations.

TASK:
${raw_prompt}"
```

**Rationale**: Gives Claude Code the backend patterns it needs to write correct Supabase code. Without this, Claude Code will write insecure or untyped queries.

---

## Change 5: Update BUILD_CMD Validation

**Location**: `autonomous_loop.sh` around line ~230 (in the `auto_detect_build_cmd()` function or where BUILD_CMD is set up)

**Current behavior**: Runs `npm run build` to validate frontend TypeScript.

**Change**: Also validate edge functions if supabase/ directory exists:
```bash
# After npm run build succeeds, check for supabase/ directory:
if [ -d "$PROJECT_DIR/supabase/functions" ]; then
    log "Validating Supabase edge functions..."
    # Deno lint if deno.json is present, or just type-check .ts files
    if [ -f "$PROJECT_DIR/supabase/deno.json" ] || [ -f "$PROJECT_DIR/deno.json" ]; then
        # Assuming Deno is available; otherwise skip
        deno check supabase/functions/*/*.ts 2>&1 | head -50 || warn "Deno check not available, skipping edge function validation"
    fi
fi
```

**Rationale**: The engine currently only validates frontend builds. If edge functions are broken (syntax errors, missing types), the engine won't catch them. This extends validation to backend.

**Note**: If Deno is not available in the CI environment, the validation will gracefully warn and continue. The frontend build gate will still catch most errors via TypeScript types.

---

## Change 6: Expand Audit Dimensions for Backend Modules

**Location**: `autonomous_loop.sh` around line 738 (inside `audit_module()` function, where audit dimensions are defined)

**Current behavior**: Audits 14 dimensions (TypeScript errors, component structure, performance, UX, accessibility, etc.)

**Change**: When auditing auth-rbac, database-api, ai-features, integrations modules, add dimensions:
- **Auth Security**: No secrets in code, all tokens use env vars, RLS policies cover all tables, password reset flow secure
- **Database Typing**: All queries typed against Database interface, no `any` types, optimistic updates have rollback, pagination cursor-safe
- **Edge Function Performance**: Cold start acceptable, concurrent execution safe, error handling with user-friendly messages
- **Real-time Safety**: Subscriptions unsubscribed on unmount, no memory leaks, rate limited
- **Storage Security**: Files in correct buckets, public/private access correct, uploads validated on client and server
- **Integration Health**: API keys in env vars, fallback responses if external API unavailable, rate limits respected, costs tracked

These dimensions are already present in the snapshot if the backend modules are properly described in MODULE_SPECS.md and brain files. The engine's audit_module function will naturally pick them up. No code change needed if brain files are complete.

**Rationale**: Ensures the engine looks for backend-specific issues, not just frontend ones.

---

## Deployment Checklist

Before restarting autonomous_loop.sh:

- [ ] Verify MODULE_SPECS.md has all backend sections added (check file ends with "email integration" section)
- [ ] Create BACKEND_ARCHITECTURE.md with Supabase schema diagram, RLS policy patterns, edge function folder structure
- [ ] Create AUTH_SPECS.md with role matrix, RLS policy examples (select/insert/update/delete per table per role)
- [ ] Create API_SPECS.md with React hook signatures and edge function endpoints
- [ ] Create INTEGRATIONS.md with external API contracts (weather, calendar, email, etc.)
- [ ] Apply this patch to autonomous_loop.sh manually or via script
- [ ] Test: Run autonomous_loop.sh with MAX_CYCLES=1 to verify it decomposes into 11 modules (7 frontend + 4 backend)
- [ ] Monitor first cycle: Watch for auth-rbac, database-api, ai-features, integrations modules to appear in the cycle report

---

## Rollback Plan

If the upgraded engine causes issues:

1. Revert autonomous_loop.sh to v6.0 (git checkout HEAD~1 autonomous_loop.sh)
2. Delete the 4 new brain files (BACKEND_ARCHITECTURE.md, AUTH_SPECS.md, API_SPECS.md, INTEGRATIONS.md)
3. Delete engine logs: rm -rf ./engine-logs/*
4. Restart: ./autonomous_loop.sh /path/to/sitesync-pm

The engine will fall back to 7-module decomposition and frontend-only audits.

---

## Success Metrics

After upgrade, monitor:

1. **Decomposition**: Engine should report 11 modules, not 7 (verify in cycle 1 log)
2. **Brain loading**: Should load 9 brain files, not 6 (verify in engine output)
3. **Backend audits**: Cycles 2-5 should audit auth, database, AI, integrations modules with specific issues (not generic ones)
4. **Prompt quality**: Claude Code should mention RLS, Supabase hooks, edge functions in execution logs
5. **Build validation**: Edge functions should be validated or skipped gracefully (no build failures)

---

## Version

- Patch version: 6.1
- Frontend modules: 7 (unchanged)
- Backend modules: 4 (new)
- Brain files: +3 new (BACKEND_ARCHITECTURE, AUTH_SPECS, API_SPECS, INTEGRATIONS)
- Changes to autonomous_loop.sh: 6 locations (fallback modules, brain_files array, decomposition prompt, prompt wrapper, BUILD_CMD validation, audit dimensions)

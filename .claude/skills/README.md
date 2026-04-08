# SiteSync Skill Library

This directory contains the persistent skill library for the SiteSync PM autonomous coding system. Skills encode successful patterns from previous sessions so they can be reused without rediscovering them.

**Repository:** wrbenner/sitesync-pm  
**Stack:** React 19 + TypeScript + Vite 8 + Supabase + Vercel

---

## How to Use This Library

### At session start — load the registry (~200 tokens)

Read `SKILL_REGISTRY.json` at the beginning of every session. It is intentionally small — just enough to know what skills exist and when to invoke them:

```
Read: wave1/skills/SKILL_REGISTRY.json
```

Do not read individual `SKILL.md` files at startup. Load them on demand only.

### When you encounter a task — match against the registry

Before writing code for any task, scan the registry's `when_to_use` fields. If your current task matches one, load the full `SKILL.md`:

```
# Match found? Load the full skill before writing any code.
Read: wave1/skills/{skill-name}/SKILL.md
```

**Match examples:**

| Situation | Load this skill |
|---|---|
| About to write `supabase.from('projects')` | `type-safe-supabase` |
| Adding a new route to App.tsx | `route-error-boundary` |
| Creating a "Delete" or "Approve" button | `permission-gate` |
| Writing a new mutation hook | `zod-api-validation` |
| Creating any button, input, or link | `industrial-touch-targets` |
| Seeing `as any` on a Supabase result | `type-safe-supabase` |
| Seeing a white-screen error report | `route-error-boundary` |

### After successfully using a skill — update usage count

When a skill resolves your task successfully, increment its `usage_count` and set `last_used` in `SKILL_REGISTRY.json`:

```json
{
  "name": "type-safe-supabase",
  "usage_count": 1,
  "last_used": "2025-01-15T03:42:00Z"
}
```

This data feeds future prioritization — high-usage skills are loaded first during triage.

### When you discover a new reusable pattern — create a skill

If you solve a problem that took non-trivial reasoning and could recur in future sessions, create a new skill:

1. Create a new directory: `wave1/skills/{kebab-case-name}/`
2. Write `SKILL.md` using the format below
3. Add the skill to `SKILL_REGISTRY.json`

**The bar for creating a skill:** If you had to think about it for more than one iteration, or if the pattern appears more than once in the codebase, it's worth capturing.

---

## SKILL.md Format

```markdown
---
name: skill-name-in-kebab-case
description: One sentence. What this skill does.
version: "1.0.0"
when_to_use: Specific trigger conditions. Be precise — this is scanned at ~3 tokens per skill.
allowed-tools: list, of, tools
---

## Overview
Why this skill exists. 1-2 paragraphs.

## Detection
How to recognize when this skill applies. Code patterns, error messages, or symptoms.

## [Main implementation section]
The full code pattern, immediately actionable. An agent reading this must know exactly what to write.

## Resolution Steps
Numbered, sequential steps. No ambiguity.

## Common Pitfalls
Table: Pitfall | Symptom | Fix

## Usage Tracking
usage_count: 0
last_used: null
```

**Quality bar:** An agent reading a SKILL.md should be able to implement the pattern correctly on the first attempt, without any additional context or searching.

---

## Current Skills

| Skill | Trigger | Version |
|---|---|---|
| `type-safe-supabase` | `as any` on Supabase query, new query creation | 1.0.0 |
| `route-error-boundary` | New route, unhandled render error, white screen | 1.0.0 |
| `permission-gate` | Create/edit/delete/approve action, role restriction | 1.0.0 |
| `zod-api-validation` | Mutation hook, form submission, API handler | 1.0.0 |
| `industrial-touch-targets` | Any interactive element creation or modification | 1.0.0 |

---

## Architecture Notes

### Why co-located schemas?

Zod schemas live in the same file as the hook that uses them (see `zod-api-validation`). This keeps the validation contract next to the code that enforces it, making it impossible for a hook refactor to silently break validation.

### Why 56px touch targets?

SiteSync is used on construction job sites. Workers wear heavy gloves. The standard 44px (Apple) or 48px (Material) minimum is calibrated for bare fingertips in consumer contexts. 56px is calibrated for gloved industrial use — see `industrial-touch-targets` for the research basis.

### Why role hierarchy over exact role match?

`PermissionGate` uses a numeric rank (`ROLE_RANK`) rather than exact equality checks. This means admins inherit all lower-role permissions automatically. An exact-match approach would require listing all authorized roles for every gate, which creates maintenance debt as roles are added.

### Why per-route ErrorBoundary (not one global)?

A single boundary around `<Routes>` would white-screen the entire app when any route errors. Per-route boundaries isolate failures — if the punch list crashes, the project dashboard remains accessible. This is critical for field use where workers may be in the middle of data entry.

---

## Skill Evolution

Skills improve over time. When you find a gap, limitation, or better pattern:

1. Update the relevant `SKILL.md` with the improved pattern
2. Increment the `version` field (semver: patch for fixes, minor for additions)
3. Add a comment in the pitfalls table if the old pattern caused issues

Failed patterns are as valuable as successful ones. If a pitfall burned an agent, document it — it will save the next run.

---
name: page-card
description: File a tier-1 Page Card describing a SiteSync UI surface (route, persona, jobs, entities, permissions, workflows, Iris hooks, telemetry, acceptance) in ~250 words; deeper sections live behind [Deep dive →] links.
version: "1.0.0"
when_to_use: When a new top-level page or surface ships, or when an existing page is being reviewed for completeness; pair with workflow-spec and iris-spec for cross-cutting features.
allowed-tools: read_file, write_file, bash, grep, edit_file
---

## Overview

A **Page Card** is the primary spec unit for any addressable surface in SiteSync (a route under `src/pages/`). The goal is one ~250-word card filed under `docs/audits/` so any reviewer — Walker, a future Claude session, a soft-pilot user, an investor doing diligence — can read the card and understand what the page does, who it serves, what it touches, and how to verify it, without reading the source.

Sister templates: `/workflow-spec` (cross-feature chains in `src/lib/crossFeatureWorkflows.ts`) and `/iris-spec` (any Iris feature that drafts, suggests, or auto-executes). All three share the same 10-field shape.

**Golden rule:** The card stays scannable. Anything that would push it past ~250 words goes behind a `[Deep dive →]` link to a separate doc, written only when the work demands it.

---

## Template

Copy this block, fill it in, save to `docs/audits/PAGE_CARD_<NAME>_<YYYY-MM-DD>.md`.

```markdown
# Page Card — `<route>`

**Date:** YYYY-MM-DD · **Status:** Draft | Reviewed | Locked
**Entry file:** `src/pages/<path-to-entry>.tsx`

| Field | Value |
|---|---|
| **Persona(s)** | (per ADR-019) — pm / super / foreman / owner_rep / office |
| **Job-to-be-done** | One sentence. Action verb first. The job, not the feature. |
| **Surfaces** | Sub-routes, drawers, side-panels owned by this page. `[Deep dive →]` |
| **Entities** | Supabase tables read or written. `[Deep dive →]` |
| **Stores** | `useEntityStore('X')`, `useUiStore`, `useAuthStore`, etc. |
| **Permissions** | PermissionGate-wrapped actions on this page. `[Deep dive →]` |
| **Workflows triggered** | `runX...Chain` calls firing from this surface, or `—` |
| **Iris hooks** | `useIris*`, `<Iris*>` components, iris-call edge fn refs, or `—` |
| **Telemetry** | Events emitted (12mo retention per ADR-008), or `⚠️ none` |
| **Acceptance** | PR test + Day-N gate + manual smoke checklist (3 lines). `[Deep dive →]` |

**Open questions:** 1–3 bullets. Empty when locked.
```

---

## Section-by-section authoring guide

| Field | What goes here | What does NOT go here |
|---|---|---|
| **Persona(s)** | The 5 ADR-019 personas only. List the role(s) for whom this page is the daily landing surface OR a frequent return surface. | Don't list "all roles" — that means you haven't thought about it. Every page has a primary persona. |
| **Job-to-be-done** | The user's job in their language. "Track open questions blocking work" — not "manage the RFI lifecycle." | Don't restate the page's title. |
| **Surfaces** | Every URL the page owns + every drawer/side-panel/modal it controls. If sub-portal or guest-portal versions exist, list them and note which ones get separate Page Cards. | Don't list buttons. Don't list every dialog. Just persistent or addressable surfaces. |
| **Entities** | Supabase tables this page reads from OR writes to. Use real table names from `src/types/database.ts`. | Don't list every join. Don't list view names unless the page only reads from them. |
| **Stores** | The 13-store target (per ADR-002) — never `useCrewStore`, `useRfiStore`, etc. (those are dead). | Don't list legacy stores even if they show up in a stale grep. |
| **Permissions** | Action permissions as `<entity>.<verb>` (matches the existing audit-permission-gate convention). Flag with ⚠️ if any sensitive action lacks a gate. | Don't list passive view permissions unless the page itself is gated. |
| **Workflows triggered** | Direct `runX...Chain(...)` calls firing from this surface OR via cron from this entity. Use `—` if none. | Don't list workflows the page indirectly causes (e.g., RFI page doesn't "trigger" runDailyLogIncidentChain). |
| **Iris hooks** | `useIris*` hooks, `<Iris*>` components, iris-call edge fn references. Note if the Iris-on-Create wedge pattern is implemented. | Don't include "potential" Iris hooks — only what's actually wired today. |
| **Telemetry** | Events the page itself emits via `track(`, `analytics.`, or direct inserts to `iris_telemetry` / `audit_log`. **If none, write `⚠️ none emitted from page` — that's a known gap pattern.** | Don't list telemetry that fires from edge functions reachable from the page; that belongs on the edge fn's spec. |
| **Acceptance** | 1–3 lines max: PR # / receipt path + the most recent Day-N gate the page passed + a 3-line manual smoke checklist. | Don't paste a whole test plan. That goes in the deep-dive link. |
| **Open questions** | Concrete, actionable bullets. Empty when locked. | Don't use this for general musings; that's what the receipt is for. |

---

## How to populate from code (the 90-second sweep)

Run from repo root. These are the searches that fill the card. Replace `<page>` with the entry filename (e.g., `RFIs.tsx`).

```bash
# Entry file + most-imported children
grep -l "src/pages/<page-dir>" src/pages/<page-dir>/*.tsx 2>/dev/null

# Stores
grep -h "use\(Auth\|Ui\|Copilot\|Entity\|Realtime\)Store" src/pages/<page-dir>/*.tsx | sort -u

# PermissionGate-wrapped actions
grep -h "PermissionGate" src/pages/<page-dir>/*.tsx -A1 | grep "requires" | sort -u

# Cross-feature chains
grep -h "run[A-Z][a-zA-Z]*Chain\|run[A-Z][a-zA-Z]*Sweep" src/pages/<page-dir>/*.tsx

# Iris hooks + components
grep -h "useIris\|<Iris\|iris-call" src/pages/<page-dir>/*.tsx | sort -u

# Telemetry (likely empty — that's a finding worth flagging)
grep -h "track(\|analytics\.\|iris_telemetry\|audit_log\.insert" src/pages/<page-dir>/*.tsx
```

For a multi-file page (most pages), recurse: `find src/pages/<page-dir> -name '*.tsx' | xargs grep -l 'PermissionGate'`.

The Explore subagent is a good fit when the page has more than ~10 children — it can return the populated table in one pass.

---

## Common pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| Card grows past ~250 words | Loses the scannability that's the whole point | Move the bloat behind `[Deep dive →]` |
| Listing dead stores | Card cites `useRfiStore` or `useCrewStore` | Per CLAUDE.md sprint invariant 3, those stores are deleted; use `useEntityStore('rfis')` |
| "All roles" in Persona | Means the author didn't think about it | Pick the primary persona; list secondary personas only if they hit the page weekly+ |
| Telemetry = `(none)` and you move on | Silently masks a Lap-2-gate-blocking gap (per ADR-008) | Write `⚠️ none emitted from page` and add an Open Question |
| Acceptance is a paragraph | The card stops being a card | 3 lines max; everything else lives in the receipt or deep dive |
| Skipping Open Questions | Card looks "done" but isn't | If you can't write a single open question, you probably skimmed; re-run the 90-second sweep |
| Filing under the wrong path | Card hides from `INDEX.md` | Always `docs/audits/PAGE_CARD_<NAME>_<DATE>.md` and append to `INDEX.md` § Page Cards |

---

## After you save

1. Append a one-line entry to `docs/audits/INDEX.md` under the **Page Cards** section
2. If any field has `⚠️` flags, note them in the next receipt — they're punch-list candidates, not card defects
3. Status starts as `Draft`. Walker reviews → `Reviewed`. Three reviewers agree → `Locked`. (Any non-trivial code change to the page bumps a Locked card back to `Reviewed` until re-confirmed.)

---

## Usage Tracking

usage_count: 0
last_used: null

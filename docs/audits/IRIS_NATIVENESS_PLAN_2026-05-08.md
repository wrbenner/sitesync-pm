# IRIS Nativeness Plan — From Bolted-On Assistant to Bugatti-Grade Operating System

**Date:** 2026-05-08
**Author:** Walker (with Claude as thinking partner)
**Status:** Strategic plan. Not yet ratified. Companion to `REVERSE_ENGINEERED_MILESTONES_2026-05-04.md`.
**Companion docs:** `LAP_2_READINESS_AUDIT_2026-05-04.md`, `IRIS_TELEMETRY_SPEC_2026-05-04.md`, `IRIS_CITATIONS_SPEC_2026-05-04.md`, `IRIS_VOICE_GUIDE_SPEC_2026-05-04.md`, `SCHEDULED_INSIGHTS_SPEC_2026-05-04.md`, `SOFT_PILOT_PLAYBOOK_2026-05-04.md`.

---

## 0. TL;DR — The Bet

The product question Walker asked on 2026-05-08 was the right one to be skeptical about:

> *"Did this thing truly have role-based AI native? It needs to know who, what, when, where and why on everything. All information needs to be accessible, then personalized, then have actionable insights across every page and piece of information — no piece of information is not absorbed and made useful."*

**Today's honest answer: no. Not yet.** IRIS is a competent PM-facing communication drafter plus a rule-based risk detector. The cross-vertical research is unambiguous about what "AI-native" actually means, and SiteSync currently ships ~3 of the 9 pillars, and only ~10–15% of pages have any IRIS surface at all.

**The bet this plan codifies:**

> Construction is not a chat-AI domain. It is a **workflow-and-evidence** domain — high-stakes, multi-actor, governed by drawings/specs/contracts, transacted through money and schedule, and lived on a jobsite. The right operating model is a **constellation of named workflows**, each role-tuned, each grounded in citations, each writing back to a unified entity graph, each replayable, each permission-aware, with a **single context fabric** that always knows who/what/when/where/why and an **ambient layer** that pushes insights before they're asked for.

Building that takes **8 phases**, mapped onto the existing T-300 → T-0 reverse-engineered timeline (Apr 30, 2027 = Embedded Payments v0 LIVE = the Game Changer event). The first three phases are partially in-flight today and close out by ~T-180 (Oct 31, 2026). Phases 4–6 land between Q4 2026 and Q2 2027 and are what makes the 36-month "moat closes structurally" thesis real. Phases 7–8 are Series A → Series B work.

**Phase-0 → Phase-3 are achievable inside Lap 2 and Lap 3.** Phases 4–6 are Lap 4 → Lap 6. Phases 7–8 are Lap 7 → Lap 8.

---

## 1. The Question, Decomposed

What Walker asked decomposes into **eight distinct claims** that have to hold simultaneously for the platform to be AI-native:

| # | Claim | What it requires |
|---|---|---|
| 1 | **Role-based** | A persona system. PM ≠ Foreman ≠ Owner ≠ Sub ≠ Office. Different prompts, suggestion sets, dashboards, voice. |
| 2 | **Knows who** | User identity + role + project membership + reporting chain + recent activity. |
| 3 | **Knows what** | The entity at hand: this RFI, this submittal, this spec section, this drawing callout, this cost code, this schedule activity. |
| 4 | **Knows when** | Project lifecycle stage (procurement / mobilization / 30% / 60% / 90% / closeout) + day in week + month-end / pay-app cycle + weather forecast horizon. |
| 5 | **Knows where** | Spatial — building, floor, area, GPS coordinate, jobsite vs. office. |
| 6 | **Knows why** | Intent inference — "drafting an RFI because the spec contradicts the drawing," "asking about float because the owner wants an early CO." |
| 7 | **Personalized** | Per-user voice memory, per-firm playbook memory, per-project vocabulary, per-customer history. |
| 8 | **Actionable everywhere** | Every page surfaces insights. No AI dead zones. Information absorbed somewhere is retrievable everywhere. |

Today's product satisfies **2 of these 8** at production grade (3: knows what; 8: partially — only on ~10% of pages, only reactively). The plan below is sequenced to close the other six in dependency order without crowding the critical path to the Apr 30, 2027 launch.

---

## 2. The Honest Scorecard — Today (2026-05-08)

This is the audit-grade verdict. Cited line counts and file paths from the prior audit run. Categories: **Real** (production-shipping), **Partial** (works but shallow), **Aspirational** (in spec, not yet code), **Missing** (no path drawn).

| Pillar | Status | Evidence |
|---|---|---|
| **1. Role-based persona system** | Aspirational | `src/services/iris/templates.ts:63` — single hardcoded `ROLE_PREAMBLE`: "You are Iris, a junior project assistant for a construction project manager." No Foreman/Owner/Sub/Office variants. Tone variants exist but don't persist. |
| **2. Context fabric (who/what/when/where/why)** | Partial — only "what" + shallow "who" | `supabase/functions/iris-call/index.ts:100-128` accepts `project_id`, `entity_type`, `entity_id`. JWT gives `user_id`. Does NOT receive role, recent actions, schedule state, weather, location, lifecycle stage, intent. The `system` prompt is caller-supplied, not assembled from a context graph. |
| **3. Universal knowledge absorption** | Missing | No pgvector. No embeddings table. No ingestion pipeline. Photos, jobsite voice notes, conversations, daily-log narrative, schedule deltas, change-order reasoning are siloed to their feature tables. Each AI feature does its own ad-hoc retrieval. |
| **4. Permission-aware retrieval** | Partial | RLS on tables; `is_pilot_user()` helper; `is_soft_pilot` flag (per ADR-006). Not yet enforced as a retrieval-layer abstraction across all AI calls. UI permission gate is mature; AI permission gate is informal. |
| **5. Citations / grounding** | Real | `src/lib/iris/citationRouting.ts`, `20260504030000_resolve_citation.sql`, 8 citation kinds, side-panel host, auto-reject on fake citations, snippet verification. Day-38 / Day-39 receipts confirm shipped. **This is the strongest pillar.** |
| **6. Voice / domain vocabulary** | Partial | `src/lib/iris/style.ts` (10 seed rules), `voiceLinter.ts` fixed-point autofix, `voicePrompt.ts` action-scoped, `iris_voice_diffs` migration live (Days 43–49 receipt). Real corpus build (150 hand-edits) is Walker-side and pending. No construction-term ontology yet (no enforced distinction between RFI/ASI/CCD or submittal/shop drawing/product data). |
| **7. Ambient / proactive insights** | Partial | 5 detectors live (cascade/aging/variance/staffing/weather, Days 31–35 receipts). pg_cron + pgmq + edge worker pipeline shipped (ADR-003). But: detectors are deterministic logic, not AI; surface only on dashboard; no per-page proactive layer; no cross-project pattern detection. |
| **8. Action layer (commit, not just generate)** | Partial | `drafted_actions` table + auto-reject + auto-withdraw policy (ADR-007). But most flows still produce drafts the human types into another form. The gap between "drafted" and "committed structured record" is wide. |
| **9. Replayable, observable agent behavior** | Aspirational | Telemetry foundation shipped (Day 30.5: 6 cols + 2 RPCs + matview). No session-replay UI. No regression suite of golden adversarial scenarios. No simulation harness à la Sierra. |
| **Coverage — every page** | Partial | `src/pages` hosts ~50 pages; IRIS surfaces measurable on ~5–8 (RFIs, submittals, daily logs, drafts inbox, /iris route). Schedule, budget, punch, crews, reports, settings, analytics — **no IRIS UI**. |

**Headline:** 1 Real, 6 Partial, 2 Aspirational, 1 Missing — out of 10 dimensions. Coverage at 10–15%. This is a respectable foundation for a 12-month-old product, but it is not "AI-native" in the sense Walker is asking.

---

## 3. What "Bugatti-Grade AI-Native" Actually Means — The 9 Pillars

Synthesized from cross-vertical research across 26 best-in-class platforms (Harvey, Hebbia, Abridge, Hippocratic, Suki, Glean, Notion AI, Microsoft Copilot, Salesforce Agentforce, Gong, Sierra, Cresta, Decagon, Cursor, Devin, GitHub Copilot Workspace, Granola, Otter, Fireflies, Perplexity Enterprise, Procore Copilot, Trunk Tools, Document Crunch, OpenSpace, Buildots, Disperse, Suffolk MAX, ALICE).

These 9 are the universal traits — and they are the spine of every phase below.

### Pillar 1. Workflows beat chat. Chat is the fallback.

Harvey replaced its chat-first product with named workflows. Suki shipped voice commands shaped like clinical actions. Cursor has Composer modes. Decagon ships AOPs. Blank-prompt chat puts cognitive load on the user. Workflows put it on the platform.

**Construction translation:** the PM's day is structured by ~12 named, repeated workflows: morning brief, daily log, RFI loop, submittal review, schedule update, weekly OAC prep, pay app, change-order management, safety walk, end-of-day handoff, weekly owner report, monthly forecast. Each is a workflow product. Iris is a constellation of these. "Ask Iris anything" stays as a fallback, never the front door.

### Pillar 2. Citations are the trust contract.

Abridge anchors every sentence to audio. Perplexity numbers every claim. Harvey links to source paragraphs. Glean shows document, author, and date. Gong jumps to the 12-second clip.

**Construction translation:** shipped (Day 38). Extend to all 8 kinds across all workflows. Inline numbered citations as default UX, not "show source" toggle. Audio-anchored citations for foreman voice notes (Pillar 5).

### Pillar 3. The unit of context is the entity. Build a graph.

Microsoft has the Graph. Glean has its graph. Salesforce has Customer 360. Gong has the deal. Harvey has the matter. Procore has the project. The platform's job is to know that **this RFI is on this project for this owner about this spec section linked to this submittal in this schedule activity for this trade in this area of the building.**

**Construction translation:** build the SiteSync Project Graph. Nodes = projects, people, roles, RFIs, submittals, change orders, drawings, spec sections, schedule activities, cost codes, daily logs, photos, areas (BIM-aware), weather days, conversations. Edges = "blocks," "references," "depends on," "supersedes," "responds to," "located at," "happened on." Every IRIS call pulls a sub-graph as context.

### Pillar 4. Permission-aware retrieval is non-negotiable.

Glean's quiet moat. RBAC has to live in the retrieval layer, not just the UI. The fastest way to kill enterprise trust is for AI to surface content the user shouldn't have seen.

**Construction translation:** every retrieval call checks tenant + project + role + sensitivity classification before chunks ever reach the model. A sub never sees an owner's contingency, even by accidental retrieval leak. An office staffer never sees subcontractor pay rates. A foreman sees their crew's items, not the whole project's. The retrieval layer is the gate, not the UI.

### Pillar 5. Specialist sub-agents beat one mega-prompt.

Hippocratic's Polaris supervisor + specialist constellation. Salesforce Topics. Decagon AOPs. Pattern: a primary agent with specialist sub-agents handling narrowly-scoped concerns. Each specialist has small surface area and is easier to test.

**Construction translation:** Iris should not be one giant prompt. It should be:

```
IrisRouter
 ├── IrisDrafter        — writes RFIs, submittal responses, owner emails
 ├── IrisMoneyAgent     — verifies cost math, change-order math, pay-app math
 ├── IrisCodeAgent      — verifies spec / drawing / code citations
 ├── IrisScheduleAgent  — float, lookahead, slip-risk, weather impact
 ├── IrisSafetyAgent    — JHA, incident classification, OSHA logic
 ├── IrisSynthAgent     — daily log, weekly report, monthly forecast
 ├── IrisFieldAgent     — voice → structured record (foreman-facing)
 └── IrisAuditAgent     — replay, evaluate, regress against goldens
```

Each specialist has tools, prompts, and write-scope of its own. The router decides which specialist to invoke.

### Pillar 6. Domain-tuned voice and vocabulary is a moat.

Trunk Tools' pitch: construction-tuned LLMs. Suki's specialty-aware vocabulary. Cresta mining top-performer language. Sierra building bespoke per-customer voice.

**Construction translation:** the `IRIS_VOICE_GUIDE_SPEC` corpus is right. Push it further. Build a **construction-term ontology** that distinguishes:

- RFI vs. ASI vs. CCD (Procurement consequence: ASI doesn't authorize cost; CCD does.)
- Submittal vs. shop drawing vs. product data (Specifier-approval routing differs.)
- T&M vs. cost-plus vs. lump-sum (Risk allocation differs.)
- Substantial completion vs. final completion vs. punchlist closure (Bonding & retainage logic.)
- Float vs. slack vs. lag (Scheduling math.)
- Means/methods (contractor's risk) vs. design (designer's risk).

These are not interchangeable, and an Iris that blurs them is a liability. Encode in `style.ts`, lint outputs against it.

### Pillar 7. Generate AND commit. Close the loop.

Suki writes back to Epic. Salesforce Agentforce updates records. Decagon resolves tickets. Generation without commit is a demo.

**Construction translation:** Iris outputs commit to the right tables — RFI #N created with cost code linked, schedule activity flagged, sub notified — with a clear `PermissionGate` approval where needed (per Sprint Invariant #5). The auto-withdraw policy (ADR-007) is the right pattern; extend it: every workflow either commits or withdraws — no "stays as a draft forever" state.

### Pillar 8. Ambient, proactive insights — not just reactive Q&A.

Disperse's insight engine. Buildots' variance analytics. Gong's deal-at-risk score. Cresta's real-time agent assist. The valuable AI moves before being asked.

**Construction translation:** every page has an Insight Slot. Dashboard has the daily brief. RFI list has "3 RFIs likely to slip the wall closeup." Schedule has "weather impact next 5 days." Pay app page has "math check + mismatch with ledger." Foreman's mobile home has "today's safety risks for your crews based on tomorrow's weather + activities."

### Pillar 9. Replayable, evaluable, observable.

Devin's session recordings. Sierra's simulation harness. Cursor's diff view. Decagon's versioned AOPs. Every AI action should be reproducible and graded.

**Construction translation:** every Iris call writes to `iris_sessions` with the retrieval ledger, the prompt, the tool calls, the output, the human accept/edit/reject, and the latency. Build a goldens suite — 200+ scenarios spanning all 12 workflows × all 5 roles. Run nightly. Block deploy on regression. The Day-30.5 telemetry foundation is the start; the goldens suite is the next move.

---

## 4. Construction-Specific Overlays

Healthcare has EHR + ICD-10. Legal has matters + clauses. Sales has deals + contacts. **Construction has six native context dimensions** that have to be first-class in the platform — not bolt-ons:

### 4.1 Spatial (where on the building)

OpenSpace and Buildots prove this matters. Every artifact has a location: floor, area, grid line, BIM element, GPS. Every Iris query about "the curtain wall" should retrieve photos, RFIs, submittals, daily log entries spatially associated with it.

**Implementation:** add `area_id` (FK to a per-project areas table, optionally BIM-linked) to RFIs, submittals, daily logs, photos, schedule activities. Mobile capture is GPS-tagged + geofenced to project. Drawing-coordinate citation kind already exists (per `IRIS_CITATIONS_SPEC`). Build the Areas hierarchy on top.

### 4.2 Temporal — project lifecycle stage

A 30%-design RFI is not a 90%-construction RFI. Owner-driven scope changes pre-permit are not the same as during structural steel. Lifecycle stage is a context dimension.

**Implementation:** project has a current stage (`schematic | design_dev | procurement | mobilization | substructure | superstructure | mep_rough | finishes | commissioning | substantial | final | closeout | warranty`). Iris context-builder injects current stage. Suggested actions and risk thresholds vary by stage.

### 4.3 Weather

Existing weather detector is the wedge. Push deeper: every outdoor activity has weather sensitivity (`pour_sensitive`, `wind_sensitive_lift`, `temp_sensitive_finishes`). Forecast feed (NOAA + historical accuracy weighting) is a system input. Iris proactively re-sequences lookaheads.

**Implementation:** `weather_sensitivities` taxonomy on activity type. Daily forecast pulls. The existing weather detector graduates into a scheduler co-pilot.

### 4.4 Plans, drawings, and specs

These are the project's source of truth. Sheet index. Spec sections (CSI MasterFormat). Bulletins. ASIs. The drawing-coordinate and spec-reference citation kinds (per `IRIS_CITATIONS_SPEC`) already point here. Extend to:

- Auto-extract sheet index on upload.
- Spec section text indexed (pgvector) for semantic retrieval.
- Drawing OCR for callouts (PMs reference "see callout 4/A-301" constantly).
- Bulletin / ASI / CCD provenance chain — what changed when, by whom, citing which RFI.

### 4.5 Conversations

Email + Slack + meetings + text are where projects actually run. Granola, Abridge, Gong all show that conversation is a first-class data source. Today, none of this is in IRIS's retrieval graph.

**Implementation (Phase 5+):** opt-in OAC meeting transcription (Granola pattern — no bot). Email forwarding integration (forward `*@projects.sitesync.ai` ⇒ ingest). Slack bot (via Slack-by-Salesforce MCP that already exists in the plugin set). All becomes searchable, summarizable, cross-referenceable. Citations to specific message timestamps.

### 4.6 Money and schedule

The two financial-grade dimensions where errors are catastrophic. Money goes through `src/types/money.ts` already (Sprint Invariant #2). Schedule float / variance is a math layer. Both need specialist sub-agents (Pillar 5) that can never be wrong because the LLM said so. They check work against deterministic math.

---

## 5. Target Architecture — The IRIS Operating System

Block diagram in markdown:

```
                                    ┌──────────────────────────┐
                                    │   Soft-Pilot / Customer  │
                                    │  (web, mobile, voice)    │
                                    └─────────────┬────────────┘
                                                  │
                  ┌───────────────────────────────┼──────────────────────────────┐
                  │                               │                              │
                  ▼                               ▼                              ▼
         ┌──────────────────┐         ┌──────────────────────┐        ┌─────────────────┐
         │  Per-Page Slots  │         │  Workflow Surfaces   │        │  Ambient Layer  │
         │  (insight cards, │         │  (Daily Log → … →    │        │  (morning brief,│
         │  inline actions) │         │  Pay App)            │        │  push alerts)   │
         └────────┬─────────┘         └─────────┬────────────┘        └────────┬────────┘
                  │                             │                              │
                  └─────────────────┬───────────┴──────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────────┐
                    │           IrisRouter             │
                    │  (intent → specialist + scope)   │
                    └────────────────┬─────────────────┘
                                     │
        ┌──────────────┬─────────────┼──────────────┬──────────────┐
        ▼              ▼             ▼              ▼              ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐   ┌──────────┐   ┌──────────┐
  │ Drafter  │  │ Money    │  │ Schedule │   │ Code/Cite│   │ Synth    │
  │          │  │ Agent    │  │ Agent    │   │ Agent    │   │ Agent    │
  └─────┬────┘  └─────┬────┘  └─────┬────┘   └─────┬────┘   └─────┬────┘
        │             │             │              │              │
        └─────────────┴─────────────┴──────────────┴──────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────────┐
                    │      Context Fabric (Builder)    │
                    │  WHO  + WHAT + WHEN + WHERE +    │
                    │  WHY  + RECENT + MEMORY          │
                    └────────────────┬─────────────────┘
                                     │
              ┌──────────────────────┼─────────────────────┐
              ▼                      ▼                     ▼
   ┌────────────────────┐  ┌──────────────────┐  ┌─────────────────────┐
   │ Project Graph (DB) │  │ Vector Knowledge │  │ Memory Layer        │
   │ entities + edges   │  │ Base (pgvector)  │  │ user/firm/project   │
   │ + permissioned RLS │  │ docs+convo+photo │  │ voice + prefs       │
   └────────────────────┘  └──────────────────┘  └─────────────────────┘
                                     │
                                     ▼
                    ┌──────────────────────────────────┐
                    │    Observability + Eval Layer    │
                    │  iris_sessions + goldens + telem │
                    └──────────────────────────────────┘
```

**Three things this diagram makes explicit and the current code doesn't:**

1. **The Context Fabric is a single layer.** Every workflow, every per-page slot, every ambient signal pulls from the same builder. Today, `iris-call` accepts a caller-supplied `system` prompt — that is going to be replaced by a Context Fabric that assembles WHO/WHAT/WHEN/WHERE/WHY/RECENT/MEMORY from the Graph + KB + Memory layer.
2. **Specialists are real services, not prompt sections.** Money, Schedule, Code/Cite each have their own deterministic checks + LLM reasoning + write-scope. The Router is the only thing that knows about all of them.
3. **Eval is wired in from the start.** Every prod call hits `iris_sessions`. Every nightly run hits `goldens`. Regressions block deploy. This is what makes Phase 5+ safe.

---

## 6. The Phased Plan

Eight phases. Each maps to a Lap and a window in the T-300 → T-0 calendar. **Phase 0 is closing now.** Phases 1–3 are achievable inside Lap 2 + Lap 3 (i.e., land by T-180, Oct 31 2026). Phases 4–6 are Lap 4 → Lap 6 (T-180 → T-0 = Nov 2026 → Apr 2027). Phases 7–8 are post-launch (Series A → Series B).

**Numbering convention:** Phase 0 = current (Lap 2 close-out). Phase N = forward.

| Phase | Lap | T-X window | Title | Closes which pillars | Bugatti exit gate |
|---|---|---|---|---|---|
| **0** | Lap 2 | T-361 → T-300 (today → Jul 2 2026) | **Foundation (in-flight)** | P5, P6, P7, P9 (partial) | "I don't want to go back" + 100 approved drafts ≥70% accept ≤90s |
| **1** | Lap 3 | T-300 → T-240 (Jul → Sep 2026) | **Role Layer + Context Fabric v0** | P1, P2 (partial) | 5 personas live; ≥80% Iris calls go through Context Fabric, not legacy `system=` |
| **2** | Lap 3 | T-240 → T-210 (Sep → Oct 2026) | **Specialist Sub-Agents + Action Layer** | P5, P7 | 4 specialists live (Drafter, Money, Schedule, Code); Drafter→commit close-loop on RFI + Submittal |
| **3** | Lap 4 | T-210 → T-180 (Oct → Nov 2026) | **Universal Knowledge Absorption (pgvector + ingestion)** | P3 | Every doc, daily log, photo OCR, conversation indexed; recall ≥0.85 on 100-question evaluation |
| **4** | Lap 5 | T-180 → T-120 (Nov 2026 → Jan 2027) | **Per-Page Coverage + Ambient Layer** | P8 | ≥80% of pages have an Insight Slot; ≥50% of insights consumed before user asks |
| **5** | Lap 5–6 | T-120 → T-60 (Jan → Mar 2027) | **Multi-Modal — Voice, Photo, Drawings** | P3 (deepens) | Voice-first foreman flow live on mobile; OpenSpace-class spatial memory v0; image-anchored citations |
| **6** | Lap 6 | T-60 → T-0 (Mar → Apr 2027) | **Cross-Project Memory + Firm Playbook** | P3 (firm), P9 (eval at scale) | Suffolk-MAX-grade pattern detection on ≥3 closed projects; "we've seen this before" alerts firing |
| **7** | Lap 7 | T-0 → T+90 (May → Jul 2027) | **Open Action Platform — Agents commit to external systems** | P7 (beyond) | Iris commits to Procore, Sage, Foundation via integration marketplace; pay-app math closes |
| **8** | Lap 8 | T+90 → T+360 (Jul 2027 → 2028) | **Predictive + Generative — Schedule, Cost, Safety simulation** | New | ALICE-class generative scheduling integrated; safety incident prediction model in beta |

---

## 7. Per-Phase Detail

### Phase 0 — Foundation (Lap 2 close-out, today → 2026-07-02)

**Status: ~70% shipped.** This phase is what `LAP_2_READINESS_AUDIT_2026-05-04.md` defines and what the Days 31 → 60 receipts have been closing.

**Objective:** Citations real, voice substrate real, scheduled detectors real, telemetry real, Lap 2 acceptance gate measurable, soft pilot live with Nexus + Carleton.

**Deliverables (mostly shipped):**
- ✅ Citations 8 kinds + side panel + auto-reject + 4 dedicated panels (Days 38, 39 receipts).
- ✅ Voice substrate: `style.ts`, `voiceLinter.ts`, `iris_voice_diffs`, post-process linter (Days 43–49 + Day 39+45+60 receipts).
- ✅ 5 detectors live (cascade, aging, variance, staffing, weather, Days 31–35 receipts).
- ✅ Telemetry: 6 cols + 2 RPCs + matview + ADR-008 (Day 30.5).
- ✅ Lap-2-acceptance.yml CI workflow + threshold source-of-truth (Day 30.75).
- ✅ Pilot substrate: `pilot_agreements`, `is_pilot_user()`, agreement template, standup template, `provision-pilot-org.ts`, ADR-006 (Days 50–60).
- ⏳ Walker-side: 150-draft hand-edit voice corpus.
- ⏳ Walker-side: recruit Brad Cameron at Nexus + Carleton, onboard, run 14-day pilot.
- ⏳ Day 41 staging smoke + Day 41 Walker review of citations.

**Exit gate (Lap 2 acceptance, T-300 = ~Jul 2 2026):** see `LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md`. 4 programmatic + 1 qualitative ("I don't want to go back").

**This plan does not change Phase 0.** It frames it as the foundation Phase 1 builds on.

---

### Phase 1 — Role Layer + Context Fabric v0 (Lap 3, 2026-07 → 2026-09)

**The single highest-leverage move on this plan.** Closes Pillars 1 and 2.

**Objective:** Replace the single hardcoded `ROLE_PREAMBLE` with a 5-persona system. Replace the caller-supplied `system=` parameter with a Context Fabric Builder that assembles WHO/WHAT/WHEN/WHERE on every IRIS call.

**Deliverables:**

1. **5 personas with role-tuned prompts, suggestion sets, dashboards, voice:**

| Persona | Primary surface | Distinctive voice/scope |
|---|---|---|
| `pm` (Project Manager) | Web | Owns: schedule, budget, RFIs, submittals, OAC. Voice: precise, references AIA. Today's persona. |
| `superintendent` | Mobile + web | Owns: lookahead, crews, daily logs, safety. Voice: tactical, terse, jobsite vernacular. |
| `foreman` (incl. trade) | Mobile-first, voice-input-first | Owns: daily reporting, T&M, defects. Voice: minimal text input; voice → structured. |
| `owner_rep` (Owner / Owner's Rep) | Web | Owns: progress reporting, change-order approvals, pay-app review. Voice: outcome-framed, dollar-aware, schedule-aware. |
| `office` (PM coordinator, AP, project accounting) | Web | Owns: contracts, COs, pay apps, lien waivers. Voice: documentation-grade, audit-trail-aware. |

Each persona = `iris_personas` row with `system_prompt_template`, `default_tools`, `dashboard_layout_id`, `voice_style_overrides` (`style.ts` extension), `permission_scope_template`.

2. **Context Fabric Builder service (`src/services/iris/contextFabric.ts`):**

```typescript
interface IrisContext {
  who: { user_id, role, persona, project_membership[], reporting_chain[] }
  what: { entity_type, entity_id, entity_data, related_entities[] }
  when: { project_stage, day_in_cycle, near_milestone[], weather_horizon }
  where: { project_id, area_id, gps?, jobsite_or_office }
  why: { intent_inference, recent_actions[], current_workflow }
  recent: { last_5_pages, last_5_iris_actions, last_5_drafts }
  memory: { user_voice_prefs, firm_playbook_excerpts, project_vocab }
}

function buildContext(req: IrisRequest): IrisContext
```

Every IRIS call goes through this. Old `system=` parameter deprecated; legacy callers fall back to a default until migrated.

3. **Persona-routing middleware in `iris-call`:** loads persona by user, merges with workflow-level overrides, applies role-scoped permissions, attaches Context Fabric output to the prompt assembly.

4. **5 role-tuned dashboards** (`src/pages/HomeFor[Persona].tsx`). PM home is closest to today's; others are new.

5. **Telemetry extension** (`iris_sessions` gains `persona`, `context_fabric_version`, `context_fabric_size_kb` columns; matview updated).

**Risks:**
- Foreman persona requires mobile-first voice flow that doesn't exist yet. Scope as text-fallback in Phase 1; voice in Phase 5.
- Owner_rep persona is a sensitive permission boundary. Sub never sees what owner_rep sees. Bake permission scoping into the persona, not just the UI.

**Exit gate:**
- ≥80% of IRIS calls in production go through Context Fabric (vs. legacy `system=`).
- 5 personas live with measurably different prompt outputs (regression suite of 25 scenarios × 5 personas = 125 cases, ≥80% pass divergence test: same input ≠ same output across persona).
- 3 of 5 dashboards live (PM, Super, Owner_rep). Foreman + office can be Phase-1.5 if scope tight.
- Lap 3 acceptance gate (per existing T-270 milestone: first signed contract). The role layer is what makes Brad Cameron AND his super AND the owner all see something useful.

---

### Phase 2 — Specialist Sub-Agents + Action Layer (Lap 3, 2026-09 → 2026-10)

**Closes Pillars 5 and 7.** This is what `T-240 — Iris graduates from drafter to actor` requires.

**Objective:** Stand up 4 specialist sub-agents with deterministic checks. Close the loop: Iris commits structured records, not just draft text.

**Deliverables:**

1. **`IrisRouter`** (`src/services/iris/router.ts`): given a workflow + context, dispatch to one or more specialists. Tracks tool-call traces.

2. **4 specialist sub-agents:**

| Agent | Service | Deterministic check | LLM scope |
|---|---|---|---|
| `IrisDrafter` | `services/iris/agents/drafter.ts` | Voice linter (existing) + length budget | Generates RFI/submittal/owner-email drafts. |
| `IrisMoneyAgent` | `services/iris/agents/money.ts` | `addCents/multiplyCents/applyRateCents` math reconciliation | Reads CO line items + pay-app + ledger. Flags math drift. Refuses to generate dollar values; only verifies. |
| `IrisScheduleAgent` | `services/iris/agents/schedule.ts` | Float math + critical path traversal | Lookahead synthesis, slip risk narrative, weather impact. Math is real; narrative is LLM. |
| `IrisCodeAgent` | `services/iris/agents/code.ts` | `verifyCitationSnippet` (existing, extended) | Validates spec/drawing/code references. Auto-rejects fabricated citations. |

3. **3 hardened executors** (per the T-240 milestone in `REVERSE_ENGINEERED_MILESTONES`):

| Executor | What it commits | Approval gate |
|---|---|---|
| `RfiAutoRoute` | Routes new RFI to spec-section-derived assignee + cost code + schedule activity | PermissionGate (PM auto-approves; foreman pre-routes) |
| `DailyLogFinalize` | Promotes draft daily log to finalized record with photos + crews + weather + work-completed sections | PermissionGate (super approves) |
| `LienWaiverChase` | Generates per-sub waiver request + sends + tracks + retries | PermissionGate (office approves first run; auto-after) |

Each executor is its own state machine (Day 50 ADR-009 descoped general state-machine wiring; these 3 get bespoke wiring).

4. **`iris_actions` audit log:** every executor invocation writes intent → context_snapshot → tool_calls → output → commit_or_withdraw → reviewer → final_state. Foundation for Phase 3 and Phase 9 evals.

5. **PermissionGate-AI integration:** every executor's commit step routes through `PermissionGate`. The audit-coverage gate (per `RFI_BUGATTI_POLISH_RECEIPT_2026-05-07.md`) ensures no AI commit slips past.

**Risks:**
- Specialist sub-agents add latency. Budget: P95 router-to-output ≤ 2.0s for non-LLM specialists, ≤ 8.0s for LLM-backed. Gate.
- Executors that commit incorrectly are an integrity risk. The auto-withdraw policy (ADR-007) has to extend cleanly to executor outputs.

**Exit gate:**
- Router routes ≥95% of calls correctly on the goldens suite.
- 3 executors live with ≥85% auto-approval acceptance on pilot data.
- Lap 3 acceptance: first signed paid contract (T-270, Aug 1 2026 — earlier than Phase 2 close in calendar terms; Phase 2 deepens what the contract relies on).

---

### Phase 3 — Universal Knowledge Absorption (Lap 4, 2026-10 → 2026-11)

**Closes Pillar 3.** This is the missing pillar that today rates Missing in the scorecard. Walker said "no piece of information is not absorbed and made useful" — Phase 3 is where that becomes true.

**Objective:** Every document, daily log narrative, photo (OCR + caption), conversation, RFI thread, change order indexed in pgvector. A single retrieval API that the Context Fabric can query across all of it, permission-aware.

**Deliverables:**

1. **`pgvector` schema migration** — `iris_kb_chunks` table (chunk_id, source_type, source_id, project_id, area_id, embedding vector(1536), text, metadata, created_at, deleted_at). Indexed with HNSW or IVFFLAT. RLS-enforced on `project_id` and source-derived sensitivity.

2. **Ingestion workers** — pg_cron + pgmq + edge function pattern (same as ADR-003 scheduled-insights). One worker per source type:
   - `ingest_documents_worker` — drawings (OCR), specs (section text), submittals, contracts, ASIs, bulletins.
   - `ingest_daily_logs_worker` — narrative + work-completed + safety notes.
   - `ingest_rfis_worker` — question, answer, all comments.
   - `ingest_photos_worker` — captions + OCR (text in image) + EXIF (location, time, device).
   - `ingest_conversations_worker` — emails, Slack messages, meeting transcripts (as available; full coverage in Phase 5).

3. **Retrieval API** (`src/services/iris/retrieve.ts`):
   ```typescript
   retrieve(query: string, ctx: IrisContext, opts: { 
     k: number, 
     filters: { source_types[], areas[], date_range, freshness_bias }
   }): Chunk[]
   ```
   Permission-aware (joins through `project_members` and `is_pilot_user`); freshness-biased (recent > old, like Glean); area-aware (queries about the curtain wall pull curtain-wall chunks).

4. **Embedding model decision (ADR-010-stub):** OpenAI `text-embedding-3-large` vs. self-hosted (Cohere, Voyage, BAAI/bge). Recommend OpenAI for Phase 3, revisit at Phase 7 for cost. Per-chunk cost at scale needs a real model; placeholder budget = $1.50/project/month.

5. **Eval harness for retrieval** — 100 question goldens (e.g., "what's the spec section for curtain wall installation tolerance?", "which submittal was rejected last week and why?"); recall@5 ≥ 0.85 on goldens.

**Risks:**
- pgvector index size on photo OCR + conversation can blow up. Plan for Postgres tier upgrade or sharding by project at scale.
- Ingestion lag during high-volume daily logs. Worker concurrency tunable; alert on backlog > 5min.
- Permission RLS on vector retrieval is non-obvious. Test extensively before pilot expansion.

**Exit gate:**
- All 5 source types ingesting in <5min from create.
- Retrieval recall@5 ≥ 0.85 on 100-Q goldens.
- Permission tests: 50 cases of "user X queries Y, must not see Z" — 100% pass.
- T-180 milestone: Procore importer end-to-end + audit chain certified, both leverage this layer indirectly.

---

### Phase 4 — Per-Page Coverage + Ambient Layer (Lap 5, 2026-11 → 2027-01)

**Closes Pillar 8.** Walker's "actionable insights across every page and piece of information."

**Objective:** Every page has an Insight Slot. The ambient layer pushes a daily brief and per-page proactive recommendations. No more 10–15% coverage.

**Deliverables:**

1. **Insight Slot pattern** (`src/components/iris/InsightSlot.tsx`):
   - A standardized slot rendered in the page header / sidebar / floating panel of every page.
   - Reads `iris_insights` table (extends `drafted_actions` — same schema, scoped to per-page surfaces).
   - Renders 0–3 insights with provenance, citations, actions.
   - Tracks impressions / dismissals / accepts in telemetry.

2. **Coverage milestone:** add Insight Slot to all 50 pages. Where a page has no relevant insight, slot renders empty (not absent — the pattern is universal).

3. **Per-page insight generators:** small functions (most deterministic, some LLM-backed) that compute insights for the entity in view. Examples:
   - Schedule page: "weather puts 4 outdoor activities at risk next 5 days" (existing weather detector, surfaced here).
   - Budget page: "CO log delta vs. ledger = $42K — investigate."
   - Punch list page: "23 open items >30 days; 11 are owner-blocked."
   - Crew page: "next Tuesday lookahead has 14 carpenters needed; you have 9 confirmed."
   - Photo gallery: "12 photos this week show MEP rough-in completion 4 days ahead of schedule."

4. **Morning brief (ambient push):** existing `scheduled-insights-worker` extended to fan out per-user daily briefs. Email + in-app + (Phase 5) push notification. Per-persona content.

5. **"Cards on home" — cross-entity insights:** the Glean / Gong pattern. "Across all your projects, the highest-risk thing this week is X." Cross-project proactive even before formal cross-project memory (Phase 6).

**Risks:**
- Insight fatigue. Cap at 3 per page, decay if dismissed. Telemetry on `dismissal_rate` per generator; auto-disable generators with > 70% dismissal.
- LLM cost from per-page generators. Default to deterministic; use LLM only for synthesis of multiple deterministic signals.

**Exit gate:**
- ≥80% of pages have a non-empty Insight Slot at least once a week per active user.
- ≥50% of insights surfaced before the user formed the question (measured by query-vs-pushed ratio in `iris_sessions`).
- Daily brief open rate ≥40% on pilot cohort.
- Lap 5 — first soft pilots scaling up to 3-customer footprint by T-100 (Jan 20 2027 milestone).

---

### Phase 5 — Multi-Modal: Voice, Photo, Drawings (Lap 5–6, 2027-01 → 2027-03)

**Deepens Pillar 3 (knowledge) + closes the foreman persona.**

**Objective:** Voice-first foreman flow on mobile. OpenSpace-class spatial memory v0 (jobsite captures stitched to plans). Image-anchored citations.

**Deliverables:**

1. **Foreman voice flow:** mobile app captures voice; Whisper-class transcription; `IrisFieldAgent` parses to structured daily-log entry / RFI question / T&M ticket. **Audio anchored** — every line of output links back to the source audio segment, Abridge-style. This is the trust mechanism.

2. **Photo capture pipeline:** mobile camera → upload → OCR → caption (vision LLM) → embedding → spatial alignment (area_id from drawing alignment, GPS fallback) → indexed. Photos become first-class retrievable artifacts with citations.

3. **Drawing OCR + callout indexing:** every drawing sheet OCR'd; callouts (e.g., "see 4/A-301") parsed and linked. Iris answers "where's the curtain wall detail?" by pointing to sheet + region.

4. **Spatial memory v0:** an Areas hierarchy per project (floors → zones → areas) populated at project setup. Every artifact tagged with area. "What happened on Floor 4 north tower this week?" returns photos, daily logs, RFIs, issue reports.

5. **Image-anchored citation kind:** extend the existing 8 citation kinds with `photo_anchor` (frame ID + bounding box). Side panel renders the image with the bounding box highlighted.

**Risks:**
- Vision LLM cost. Cache aggressively. Captions don't change once written.
- Spatial alignment without BIM is approximate. v0 = manual area assignment + GPS heuristic; v1 = BIM-linked.
- Whisper transcription accuracy on jobsite noise. Use Whisper-large + custom vocabulary (per project — same pattern as Otter custom vocab).

**Exit gate:**
- Foreman persona on mobile generates ≥1 daily log + ≥3 photos per day across pilot, ≥80% of voice-derived logs accepted with ≤2 edits.
- Spatial queries ("Floor 3 last week") return ≥0.80 precision on a 50-Q test.
- Image citations in production. ≥30% of synthesized weekly reports include photo anchors.

---

### Phase 6 — Cross-Project Memory + Firm Playbook (Lap 6, 2027-03 → 2027-04)

**The 36-month moat — Suffolk MAX class.** This is what makes a fifth project run smarter than a first project.

**Objective:** Per-customer firm-level memory. Pattern detection across closed and in-flight projects. "We've seen this before" alerts.

**Deliverables:**

1. **`firm_memory` schema:** per-customer (tenant) durable layer. Contains anonymized patterns, lessons-learned from closed projects, recurring RFI categories, common change-order causes, typical schedule slips.

2. **Project closeout extractor:** when a project closes (or hits substantial completion), an offline batch process extracts patterns from RFIs, COs, daily logs, schedule history, and the user-flagged "lessons learned" list. Writes to `firm_memory`.

3. **`IrisHistorian` — a cross-project sub-agent:** queries firm_memory at relevant moments. "On your last 3 hospital projects, MEP coordination RFIs spiked 30 days before substantial completion. Today is Day -32. Current MEP RFI count is 3. Median was 18. Investigate."

4. **Anonymization layer:** per `ADR-008`, telemetry is 24-month retention with anonymization for soft pilot. Extend the anonymization to firm_memory for any cross-firm aggregate insights (Phase 7+).

5. **Lessons-learned UX:** at project closeout, a structured prompt session captures explicit lessons. These ground future `IrisHistorian` answers with cited human-authored lessons (highest-trust signal).

**Risks:**
- Cross-project memory is exactly the layer Procore could feature-match if telegraphed early. Ship it after audit chain cert (T-195, Oct 15) to lead with the moat.
- Anonymization mistakes are reputation events. Two-engineer review on every cross-firm aggregate query.
- "We've seen this before" can be wrong and confidently. Always frame as `historical signal`, never `prediction`. Cite the source projects.

**Exit gate:**
- ≥3 closed projects in firm_memory across the pilot cohort.
- ≥10 historian alerts fired across the pilot, ≥60% rated useful by the receiving PM.
- T-0 (Apr 30 2027) Embedded Payments v0 LIVE — Phase 6 is what makes the launch narrative ("the only PM platform that gets smarter with every project") real.

---

### Phase 7 — Open Action Platform (Lap 7, 2027-05 → 2027-07)

**Post-Game-Changer.** Opens the action layer to external systems via the Integrations Marketplace (T-75 milestone in REM).

**Objective:** Iris commits to Procore, Sage, Foundation, Concur, ProEst, etc. Pay-app math closes through Embedded Payments v0.

**Deliverables:**

1. **Integration adapters per partner** (5 launch partners per T-75 milestone).
2. **Outbound webhooks for Iris commits.**
3. **Embedded Payments tie-in:** pay-app draft → Iris money agent verification → ACH push the day GC approves. Closes Pillar 7 to its ultimate form.
4. **Public API for third-party agents:** Iris OAuth scopes, agent registry, audit log.

(Less detail at this distance — Phase 7 spec is a Q1-2027 deliverable.)

---

### Phase 8 — Predictive + Generative (Lap 8, 2027-07 →)

**Series A → Series B work.** ALICE-class generative scheduling. Safety incident prediction. Cost simulation.

**Objective:** Add a second AI layer — optimization, simulation, prediction — alongside the LLM-driven generation. AI = LLM + OR.

**Deliverables:** generative scheduling (ALICE-class); incident prediction model (per-project + cross-firm); cost-overrun forecasting; commercial-grade what-if simulator.

(Phase 8 is post-launch and beyond the current planning horizon. Listed for completeness so the roadmap's apex is visible.)

---

## 8. Risks & Slip-Killers Specific to This Plan

Beyond the slip-killers in `REVERSE_ENGINEERED_MILESTONES_2026-05-04.md`:

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Phase 1 persona divergence is cosmetic, not functional** | High | 30-day slip + pilot loses trust | Goldens regression test: same input must produce divergent output across personas; <60% divergence = block. |
| 2 | **Specialist sub-agent latency stacks badly** | Medium | UX collapses; pilot rejects | Budget P95 ≤ 8s end-to-end; parallelize specialists; use Haiku-class for non-reasoning subtasks. |
| 3 | **pgvector retrieval RLS bypass via embedding-similarity inference** | Medium | Privacy incident | Two-engineer review on every retrieval query. Embedding leakage tests: compute similarity from outside-tenant chunks, must always score 0 in retrievable chunks. |
| 4 | **Insight fatigue collapses ambient layer** | High | Per-page slot adoption craters | Generator-level dismissal-rate tracking; auto-disable >70%; cap 3 per page. |
| 5 | **Voice OCR / transcription accuracy on jobsite is below 85%** | Medium | Foreman flow never adopts | Test with real Nexus daily logs at Phase 1; if <85%, defer Phase 5 voice to Phase 6. |
| 6 | **Cross-project memory ships before audit-chain cert and Procore copies the narrative** | Low–Medium | Strategic blow | Sequence Phase 6 deliberately AFTER T-195 (audit chain cert). Phase 6 is the post-cert moat — don't reveal early. |
| 7 | **Engineer #2 not hired by Phase 2 → Walker bottlenecks the Specialist Sub-Agents work** | High (per REM slip-killer #6) | All forward phases drift | Engineer #2 search opens NOW (already a critical-path long-lead per REM). |
| 8 | **Soft pilot rejects role-tuned dashboards as "just rearranging UI"** | Medium | Persona thesis dies | Validate persona divergence with Brad Cameron's super at Phase 1 design review, not after build. |

---

## 9. ADR Stubs Required

This plan introduces 5 architectural decisions that warrant their own ADRs. **ADR numbers 010–016 are taken** (Mobile Native / ACH Partner / Pricing / Audit Firm / Trust Center / Reliability / Integration Framework — see INDEX.md). New ADRs in this plan begin at ADR-017:

- **ADR-017 — Embedding model choice for pgvector knowledge base.** OpenAI `text-embedding-3-large` for Phase 3; revisit at Phase 7 for cost/latency.
- **ADR-018 — Specialist sub-agent boundary contract.** Each specialist owns: deterministic check, LLM scope, write-scope, latency budget, and audit log fields. Standardized.
- **ADR-019 — Persona model and override hierarchy.** persona = base prompt + tools + dashboards + voice. Workflow can override; never user.
- **ADR-020 — Context Fabric as the single retrieval entrypoint.** Deprecate caller-supplied `system=`. All IRIS calls assemble context through `contextFabric.ts`.
- **ADR-021 — Cross-project memory anonymization protocol.** What can leave a tenant boundary, what cannot, what's required for legal review. Companion to ADR-008.

Each gets a standalone document at the time its phase opens.

---

## 10. Acceptance Gates Per Phase (consolidated)

| Phase | Bugatti exit gate (1 line each) |
|---|---|
| 0 | "I don't want to go back" + 100 approved drafts ≥70% accept ≤90s (Lap 2 spec). |
| 1 | ≥80% of Iris calls go through Context Fabric; 5 personas with ≥80% divergence on goldens; 3 dashboards live. |
| 2 | Router ≥95% correct routing on goldens; 3 executors with ≥85% auto-approval acceptance on pilot. |
| 3 | All 5 source types ingesting <5min; recall@5 ≥0.85 on 100-Q goldens; 50 RLS test cases all pass. |
| 4 | ≥80% pages have Insight Slot non-empty weekly; ≥50% insights pushed-not-asked; daily brief open ≥40%. |
| 5 | Foreman ≥1 daily log + ≥3 photos/day; ≥80% voice logs accept ≤2 edits; spatial queries ≥0.80 precision. |
| 6 | ≥3 closed projects in firm_memory; ≥10 historian alerts ≥60% useful per receiving PM. |
| 7 | 5 launch integration partners; pay-app math ACH closes; agent OAuth scopes shipping. |
| 8 | Generative scheduler integrated; incident prediction model in beta. |

Each gate is a **CI workflow**, on the same pattern as `lap-2-acceptance.yml`. Phase opens when prior gate is green; phase closes when its own gate is green.

---

## 11. What This Changes About the Existing Roadmap

This plan is **additive, not replacing**. It does not change:

- Lap 2 acceptance gate (unchanged — Phase 0 is exactly that work).
- T-270 first signed contract milestone.
- T-195 audit chain cert milestone.
- T-165 Procore Groundbreak response.
- T-0 Apr 30 2027 Embedded Payments v0 LIVE.

It **adds clarity** on three things the linear plan was leaving implicit:

1. **Phase 1 (Role Layer + Context Fabric) belongs in Lap 3, not later.** The current roadmap implies Lap 3 is "Iris graduates from drafter to actor" — Phase 2 — but you cannot have a multi-actor product without a persona system first. **Build Phase 1 in Jul–Sep 2026, BEFORE Phase 2 in Sep–Oct 2026.**

2. **Phase 3 (pgvector + ingestion) is the precondition for Phase 4 (per-page coverage).** The current roadmap doesn't have an explicit knowledge-absorption layer; per-page insights without it are deterministic-only and shallow. Lap 4 (Oct–Nov 2026) gets the ingestion pipeline; Lap 5 (Nov–Jan) lights up the per-page layer.

3. **Phase 6 (firm-level memory) is sequenced AFTER audit-chain cert deliberately.** Lead with the moat. Don't telegraph cross-project memory pre-cert.

The 90-day tracker (`SiteSync_90_Day_Tracker.xlsx`) currently runs through Lap 2. Add a `Lap 3 — IRIS Native` sheet now with Phase 1 + Phase 2 day-rows.

---

## 12. The Anti-Patterns — What NOT to Build

A Bugatti plan also names what to refuse. Drawn from the cross-vertical research and from the SiteSync invariants:

- **Don't build "ask Iris anything" as the primary surface.** That's the Hebbia/Harvey lesson: chat is the fallback, not the front door.
- **Don't merge specialist agents into one mega-prompt.** That's the Hippocratic lesson: specialists shrink the safety surface.
- **Don't show a citation toggle.** Inline numbered citations always. Perplexity lesson.
- **Don't generate without committing.** Suki lesson. A drafted RFI that the user has to copy/paste is half-finished.
- **Don't trust LLMs with money or schedule math.** Use deterministic specialists. Sprint Invariant #2 amplified.
- **Don't ingest without permission-aware retrieval.** Glean lesson — ACL leakage at retrieval kills enterprise trust.
- **Don't treat each project as an island.** Suffolk MAX lesson — firm memory is the long-term differentiator.
- **Don't delete the `IrisAuditAgent` before the goldens suite is real.** Devin lesson — replayability is what makes autonomy safe.
- **Don't put cross-firm aggregate queries into the firm playbook before two-engineer privacy review.** Reputation event risk.
- **Don't skip the Day 1 of every phase being the eval harness extension.** Sierra lesson — simulation-first.

---

## 13. One Opinionated Call

If Walker reads this plan and remembers one paragraph from it:

**Construction is a workflow-and-evidence domain. The right product shape is a constellation of named, role-tuned, citation-grounded, write-committing, permission-aware, replayable workflow agents — orchestrated by a single context fabric that always knows who/what/when/where/why — supported by an ambient layer that pushes insights before they're asked for — and grounded in a permissioned knowledge base that absorbs every document, log, photo, and conversation. Build that, and "AI-native" stops being marketing and becomes structural. Don't build that, and you're a slightly better Procore.**

The 8 phases are the path. Phase 0 is closing now. Phase 1 — the Role Layer + Context Fabric — is the highest-leverage next move. Start it the day Lap 2 closes (T-300, ~Jul 2 2026). Engineer #2's first week.

---

## 14. Verification Notes

- The cross-vertical research underlying this plan was synthesized by an unsearchable subagent on 2026-05-08 from training-data knowledge through January 2026. Specifics flagged "unverified" in that research file: depth of per-user memory in Harvey/Granola/Procore Copilot, Hippocratic Polaris architecture details, Suffolk MAX feature depth, Disperse differentiators. Recommend a verification pass via a web-enabled session before treating any single platform claim as gospel — but the **9-pillar synthesis is the load-bearing structure here** and is robust across the well-established patterns regardless of the per-platform details.
- Today's scorecard reflects state through the `RFI_PROCORE_PARITY_FOLLOW_ON_RECEIPT_2026-05-07.md` and `RFI_CREATE_FLOW_PARITY_SPEC_2026-05-08.md`. Phase 0 percentage-shipped (~70%) is approximate.
- Phases beyond Phase 4 are sketched at lower resolution because they're past the planning event horizon. Each gets a standalone spec at phase open.

---

## 15. Footer — What to Do With This Doc

1. **Walker decides** whether the 9-pillar synthesis matches his intuition. If a pillar is missing or wrong, the plan re-threads.
2. **Add `IRIS_NATIVENESS_PLAN_2026-05-08.md` to `INDEX.md`** in the "Specs / Plans" section.
3. **Open ADR-017 through ADR-021 stubs** as files in `docs/audits/` so they're in-tree even before phases open. (ADR-010–016 are taken — see INDEX.md.)
4. **Add a `Lap 3 — IRIS Native` tab** to `SiteSync_90_Day_Tracker.xlsx` with day-rows for Phase 1 (~30 days) and Phase 2 (~30 days).
5. **Critical-path long-lead reminder:** Engineer #2 hire is a Phase-1 prerequisite. Per `REVERSE_ENGINEERED_MILESTONES`, the search should already be open. If not, today.
6. **Quarterly review.** Re-write this plan every quarter. Update the scorecard. Move shipped pillars from Partial → Real. The North Star says "lie to no one about how confident you are" — that applies here too.

---

*End of plan. T-minus 357 days to Apr 30, 2027.*

# IRIS Nativeness Planning Push — Receipt

**Date:** 2026-05-08
**Driver:** Walker — "lets get all of the planning done so we can start working"
**Companion docs:** `IRIS_NATIVENESS_PLAN_2026-05-08.md` (parent plan), `BUGATTI_LAUNCH_ROADMAP_2026-05-04.md` (calendar peer)

---

## What landed in this push

Twelve documents written or updated in one parallel wave to close the planning runway before Phase 1 implementation begins.

### Phase specs (6 documents, ~5,000–7,000 words each)

| File | Phase | Calendar |
|---|---|---|
| `IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md` | 1 | Lap 3 first half (~Jul–Sep 2026) |
| `IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md` | 2 | Lap 3 second half (~Sep–Oct 2026) |
| `IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md` | 3 | Lap 4 (~Oct–Nov 2026) |
| `IRIS_PHASE_4_INSIGHT_SLOT_AMBIENT_SPEC_2026-05-08.md` | 4 | Lap 5 (~Nov 2026 → Jan 2027) |
| `IRIS_PHASE_5_MULTIMODAL_SPEC_2026-05-08.md` | 5 | Lap 5–6 (~Jan–Mar 2027) |
| `IRIS_PHASE_6_FIRM_MEMORY_SPEC_2026-05-08.md` | 6 | Lap 6 (~Mar–Apr 2027), AFTER T-195 audit-chain cert |

### Phase 3 sub-spec (1 document)

| File | Purpose |
|---|---|
| `INGESTION_TAXONOMY_SPEC_2026-05-08.md` | 64-artifact catalog with router targets, citation kinds, sensitivity defaults, anchor shapes. Catch-all router named so no upload drops on the floor. |

### ADR stubs (5 documents)

| ID | Title | File |
|---|---|---|
| ADR-017 | Embedding model — OpenAI text-embedding-3-large (1536-dim) for Phase 3 | `ADR_017_EMBEDDING_MODEL_2026-05-08.md` |
| ADR-018 | Specialist sub-agent boundary contract | `ADR_018_SPECIALIST_BOUNDARY_CONTRACT_2026-05-08.md` |
| ADR-019 | Persona model + override hierarchy | `ADR_019_PERSONA_MODEL_2026-05-08.md` |
| ADR-020 | Context Fabric as single retrieval entrypoint | `ADR_020_CONTEXT_FABRIC_AS_RETRIEVAL_ENTRYPOINT_2026-05-08.md` |
| ADR-021 | Cross-project memory anonymization protocol | `ADR_021_CROSS_PROJECT_ANONYMIZATION_2026-05-08.md` |

### Index updates

- `INDEX.md` updated with: new "IRIS Native — Phase Specs" section under the Bugatti roadmap; ADRs 017–021 appended to the ADR table; date stamp + summary updated.

---

## Specs are stubs no longer — they're implementation-ready

Every phase spec covers, at minimum:

- Status / target calendar
- Why this phase (decision rationale, alternatives considered)
- Schemas (full DDL where applicable)
- Service contracts (TypeScript interfaces for every public function)
- Migration plan
- Eval / goldens harness with concrete metrics
- Telemetry columns + dashboards
- Test plan (unit, integration, RLS, load, leakage where relevant)
- Failure modes (named, with detection + degraded path)
- Acceptance gate (Bugatti exit gate, multi-criterion, time-windowed)
- Cross-references to upstream/downstream phases + ADRs
- Day-by-day breakdown (~30 days each, except Phase 4 at 45 and Phase 5 at 60)
- Phase-specific risks with mitigations

That's the "implementation-ready" bar — engineer #2 can open Phase 1 spec and start typing.

---

## One thing to clean up — DUPLICATE SPECS for Phases 1–4

This is on me. Earlier this same day, a previous turn dispatched a parallel-spec wave that produced specs at `PHASE_X_*` paths (Phases 1–4). When Walker said "let's get all the planning done," I dispatched a NEW parallel wave without first checking that the earlier wave's outputs already covered Phases 1–4. The newer wave wrote to `IRIS_PHASE_X_*` paths — different filename, same content space.

Net: the tree now has **two specs for each of Phases 1, 2, 3, 4**. Phases 5 and 6 are clean (no prior, only the new spec). The Phase-3 sub-spec (`INGESTION_TAXONOMY_SPEC`) is also clean.

Word counts (newer / older):
- Phase 1: 7,526 / 5,553
- Phase 2: 6,617 / 4,891
- Phase 3: 6,339 / 5,712
- Phase 4: 7,290 / 7,392 (essentially equivalent length)

The newer specs cover the same architectural ground and are slightly more detailed for Phases 1–3. Phase 4 is a wash — both ~7,300 words.

**Recommended cleanup at Walker's review:**
1. Diff the two Phase-1 specs to see if the older has details worth merging into the newer.
2. Repeat for Phases 2, 3, 4.
3. Then pick canonical and move the loser to `docs/audits/legacy/` with a banner.

The INDEX has been updated with a ⚠️ flag at the top of the IRIS Native — Phase Specs section explaining the dual-spec state.

I should have read the directory listing before dispatching. Lesson logged.

---

## Day-1 next moves (per IRIS_NATIVENESS_PLAN §15)

1. **Walker decides:** does the 9-pillar synthesis match your intuition? If a pillar is missing or wrong, the plan re-threads.
2. **Engineer #2 hire:** Phase-1 prerequisite per REM critical-path long-leads. Search opens today (if not already open).
3. **`SiteSync_90_Day_Tracker.xlsx`:** add a `Lap 3 — IRIS Native` tab with day-rows for Phase 1 (~30 days, Days 91–120) and Phase 2 (~30 days, Days 121–150). I did NOT auto-edit the tracker per the sprint invariant ("Don't try to fix it via raw edit — call out the corruption in your receipt and let Walker fix it manually" applies to risky edits; this is non-risky but tracker structure changes deserve Walker's review). Spec'd at high level; Walker creates the tab.
4. **Reconcile the two Phase 3 docs** (see above).
5. **Verification pass on cross-vertical research** noted as "unverified" in `IRIS_NATIVENESS_PLAN §14` — recommend a web-enabled session before treating any single platform claim as gospel; the 9-pillar synthesis is robust regardless.

---

## What's deliberately not in this push

- **Phase 7 spec** (Open Action Platform — Lap 7+, post-launch). Reserved per parent plan.
- **Phase 8 spec** (Predictive + Generative — Series A→B). Reserved per parent plan.
- **ADR-017-A** (Phase 7 embedding-model revisit). Authored at Phase 7 open.
- **ADR-021-A** (Phase 7 cross-tenant aggregate protocol). Authored at Phase 7 open with outside counsel.
- **Code changes.** This was a planning push only. No source files modified.

---

## Sprint invariants honored

1. ✅ Typecheck — no source code changed; baseline preserved.
2. ✅ Money math — every spec routes specialist money math through `src/types/money.ts` (Phase 2 + ADR-018 explicit).
3. ✅ No re-added stores — no new stores proposed.
4. ✅ 13-store target preserved — Context Fabric is a service, not a store (Phase 1 + ADR-020 explicit).
5. ✅ PermissionGate not touched.
6. ✅ Tracker not modified (Walker-side per "do not auto-edit" caution).
7. ✅ This receipt logged.

---

## Bottom line

**The Lap 3 → T-0 IRIS architecture is fully specified through Phase 6.** Engineer #2 walks in to a tree where Phase 1 has 14 sections of mechanics and a 30-day plan. The Bugatti grade ask was about depth and rigor; the depth and rigor are here. Phase 1 opens the day Lap 2 closes (~Jul 2 2026) — and there will be no "what do we build first" stall because the answer is in the spec.

— end —

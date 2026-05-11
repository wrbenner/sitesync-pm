# SiteSync Agent Topology — Recommendation Memo

**Date:** 2026-05-08
**Author:** Walker (with Claude as architectural partner)
**Status:** Recommendation. Ratification gates Phase 1 implementation.
**Companions to be cross-referenced once landed:** `CROSS_INDUSTRY_AI_RESEARCH_2026-05-08.md`, `AGENT_ARCHITECTURE_RESEARCH_2026-05-08.md` (parallel agents producing these in the same `docs/audits/` directory).
**Related, in-tree:** `IRIS_NATIVENESS_PLAN_2026-05-08.md`, `IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md`, `IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md`, `ADR_018_SPECIALIST_BOUNDARY_CONTRACT_2026-05-08.md`, `ADR_019_PERSONA_MODEL_2026-05-08.md`, `ADR_020_CONTEXT_FABRIC_AS_RETRIEVAL_ENTRYPOINT_2026-05-08.md`, `REVERSE_ENGINEERED_MILESTONES_2026-05-04.md`, `CLAUDE.md`.

---

## 0. Bottom-line recommendation

**Ship Archetype A (Specialist Council) for Phases 0–4. Evolve to a constrained Archetype B (Tiered Hierarchy with two non-fanout tiers) at Phase 5. Never ship Archetype C (Agent Army). Cap LLM-backed agents at ≤14 at GA. Treat "personas" as prompt-conditioning, not agents — confirmed against the persona divergence eval.**

The agent count by phase:

| Phase close | Calendar | LLM-backed agents | Deterministic generators | Total moving parts |
|---|---|---|---|---|
| **Phase 0 (Lap 2)** | Jul 2 2026 | 1 (Iris drafter, today's monolith) | 5 detectors | ~6 |
| **Phase 1 (Role Layer + Fabric)** | Sep 15 2026 | 1 + 5 personas as prompt-conditioning | 5 detectors | ~6 |
| **Phase 2 (Specialists)** | Oct 26 2026 | 4 specialists + 1 router | 5 detectors + 3 executors | ~13 |
| **Phase 3 (Knowledge)** | Nov 30 2026 | 4 specialists + 1 router (no new agents; Code agent gets a real KB) | 5 detectors + 3 executors + 5 ingestion workers | ~18 |
| **Phase 4 (Per-Page + Ambient)** | Jan 2027 | 4 specialists + 1 router + 1 brief-synthesizer | 5 detectors + 3 executors + ~50 per-page deterministic generators | ~10 LLM + 58 deterministic |
| **Phase 5 (Multi-Modal)** | Mar 2027 | + Field agent + Vision-caption agent → 7 LLM | 5 detectors + 3 executors + ~50 generators + Whisper + OCR pipeline | ~12 LLM + 60 deterministic |
| **Phase 6 (Cross-Project Memory)** | Apr 30 2027 (T-0) | + Historian agent → 8 LLM | 5 detectors + 3 executors + ~50 generators + Whisper + OCR + closeout extractor | ~13 LLM + 62 deterministic |
| **GA target** | T+90 → T+360 | ≤14 LLM (room for Safety + Procurement + 1 reserve) | ~70 deterministic | ≤84 moving parts total |

Key shifts to the existing plan: **Phase 1 spec stays as written. Phase 2 spec stays as written. ADRs 017–021 stay accepted. ADR-022 (Agent Topology — this memo's outcome) is added as a new accepted ADR. The plan changes by *constraint*, not by re-architecture: a hard cap on agent count, an explicit deterministic-first rule for per-page coverage, a clear "no swarms" policy, and a ratified path for Field/Historian as additive specialists rather than new tiers.**

The remainder of this memo justifies that recommendation.

---

## 1. Current state — what IRIS is today

### 1.1 Inventory

The active spec set names the moving parts. Today's IRIS architecture (post-Phase-0, pre-Phase-1) is:

**LLM-backed agents (1 today, ~10 at Phase 6 close per the plan):**

- **Iris drafter (today)** — one prompt. The `ROLE_PREAMBLE` in `src/services/iris/templates.ts:63` is a single hardcoded string ("junior project assistant for a construction project manager"). All draft templates concatenate it.
- **Phase 2 will add 4 specialists:** Drafter, Money, Schedule, Code (per `IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC` §3).
- **Phase 5 will add 1:** Field (foreman voice flow).
- **Phase 6 will add 1:** Historian (cross-project memory).
- **Total at GA:** 6 specialists per the named plan; ≤14 with reserves under the cap this memo proposes.

**Personas (5, prompt-conditioning, not agents):**

- `pm`, `superintendent`, `foreman`, `owner_rep`, `office`. Per ADR-019 personas are `{base_prompt + tools + dashboards + voice + permissions + auto-action threshold}` — assembled by the Context Fabric, never user-overridable, override hierarchy `workflow > persona-override > org-default > system-default`.

**Router (1):**

- Per Phase 2 §4, deterministic-first: workflow-tag → regex/keyword → LLM-fallback (Haiku-class) → unknown_fallback. Routes to one of the 4 specialists.

**Context Fabric (1):**

- Per ADR-020, the single retrieval entrypoint. Assembles WHO/WHAT/WHEN/WHERE/WHY into an `IrisContext`. Cap: 2,950 tokens. Latency P95 ≤ 150ms. **Phase 1 ships with zero LLM-derived fields** in the Fabric (deliberate — see Phase 1 §4.5).

**Deterministic generators (~5 today, ~50 at Phase 4 close):**

- 5 ambient detectors live: cascade, aging, variance, staffing, weather (Days 31–35 receipts, ADR-003 hybrid cron).
- Phase 4 plan: ~50 per-page Insight Slot generators — one per page, mostly deterministic, some LLM-backed via the existing 4 specialists.

**Executors (3 at Phase 2 close, expanding):**

- `rfi_create_executor`, `co_pricing_attach_executor`, `schedule_lookahead_publish_executor`. Each wraps the cancel-window pattern + PermissionGate + dry-run + audit log.

### 1.2 What the count actually means

If you tally "agents" by the strictest definition — **a service with its own LLM prompt and write-scope** — the GA target on the existing plan is **6 specialists + 1 router + 1 brief-synthesizer = 8 LLM-backed agents**. Add to that ~50 deterministic generators, ~5 detectors, ~3+ executors, and the Context Fabric, and the total system has roughly **70–85 named components by GA**, of which ~14% are LLM-backed.

That 14% number is the right ratio. It's the same shape as Hippocratic's Polaris (1 supervisor, ~10 specialists, hundreds of deterministic clinical guardrails), Salesforce Agentforce (Topics ~ specialists, action templates ~ deterministic generators), and Stripe's risk stack (a small number of ML/LLM models, dozens of rules engines, hundreds of feature definitions). **Most production "AI" systems are mostly not LLM** — and that is the design lesson, not a deficiency.

The current plan does *not* claim "20 agents" or "100 agents." It claims **≤10 LLM-backed agents + a deterministic substrate**. The question this memo answers is whether that count and shape are right — or whether SiteSync should swing toward a tiered hierarchy (more agents, structured by org tier) or a swarm (many micro-agents). The answer is: **mostly stay the course, with two refinements.**

---

## 2. Three architecture archetypes for construction

### 2.1 Archetype A — Specialist Council (current plan)

**Topology:** 1 router + 4–8 named specialists, all peers. Each specialist owns a deterministic check, an LLM scope, a write-scope, and a tool allow-list. Personas are prompt-conditioning. Per-page insights come from deterministic generators that may invoke a specialist for synthesis. The Context Fabric is the single retrieval entrypoint.

**Total LLM-backed agents at GA:** 6–14. Deterministic generators: 50–70. Total: 60–85 components.

**Pros.**

1. **Safety surface stays small.** Each specialist has a finite prompt surface and a finite tool surface. CI lint enforces (ADR-018). Adversarial inputs can compromise *one* specialist, not the council. This is the Hippocratic / Sierra lesson.
2. **Engineering velocity scales linearly.** Engineer #2 owns a specialist end-to-end. Adding the 5th, 6th, 7th specialist is "ship a file" not "redesign the supervisor." This matters with a 12-month critical path and a 2-engineer team.
3. **Latency is predictable.** Router → 1 specialist = 1 LLM call. P95 budgets per specialist (Drafter 6s, Money 4s, Schedule 5s, Code 5s) compose without compounding.
4. **Audit chain is single-signature.** Every IRIS action has one specialist signature in `iris_actions`. The T-195 audit-chain certification (Big-4 attestation) requires that. A multi-tier system has multi-signature actions, which complicates the attestation scope.
5. **Sprint Invariant compatibility.** Sprint Invariant #2 (money math through `src/types/money.ts`) is enforced *inside* the Money specialist. Sprint Invariant #5 (PermissionGate on actions) wraps each executor, which is one per specialist. The flat shape matches the existing CI gates.
6. **Procore-resistant moat.** Procore's Copilot is closer to one big agent + an Agent Builder. A flat specialist council with deterministic gates is a different shape and harder to feature-match cheaply.

**Cons.**

1. **Fixed ceiling on parallelism within a single user query.** A "weekly OAC summary" workflow that needs Drafter + Money + Schedule has to fan out manually (Phase 2 spec Appendix B notes this). The router does not natively orchestrate; the workflow does.
2. **No structural answer to "the firm tier."** The 6 specialists are project-scoped. Cross-project Historian (Phase 6) is *also* project-scoped at query time — it just queries firm-wide indexes. There is no agent that "represents the firm." Whether that is a missing tier or a missing query is a real architectural question this memo decides on (§3 — answer: missing query, not missing tier).
3. **Per-page coverage requires ~50 deterministic generators.** That is real engineering work in Phase 4. The agent army would, in theory, give you that "for free" via emergent micro-agent behavior. (In practice, see Archetype C — that's not what happens.)
4. **No emergent behavior.** Specialists do exactly what they're told. There is no "the agents discovered a new pattern" surprise. For construction, that's a feature not a bug — but for VC story-telling and for some long-tail edge cases, it cedes ground.

**Industry analogue.** This is the **Hippocratic Polaris model** (supervisor + clinical specialists, all deterministic-gated), the **Sierra model** (specialists + AOPs + simulation harness), and structurally the **SpaceX Falcon program model** (small number of named teams, each owning a subsystem with a deterministic interface, integration via a standard contract). Construction maps to this: the PM has a finite number of named workflows, each owned by a specialist, integrated by the Fabric.

**Phase-by-phase implementation.** Already specified:

- Phase 0 (today → Jul 2026): 1 monolith Iris, 5 detectors. **Done.**
- Phase 1 (Jul–Sep 2026): Role Layer + Fabric. 5 personas, 1 router stub. No new specialists.
- Phase 2 (Sep–Oct 2026): 4 specialists + 3 executors + 200-Q routing goldens.
- Phase 3 (Oct–Nov 2026): pgvector KB. Code agent gets full KB. No new agents.
- Phase 4 (Nov 2026–Jan 2027): 50 per-page deterministic generators + ambient brief synthesizer (1 LLM call/day/user).
- Phase 5 (Jan–Mar 2027): + Field agent (Whisper + structured-form output).
- Phase 6 (Mar–Apr 2027): + Historian agent.
- Phase 7 (May–Jul 2027): + integration adapters (not agents — adapters).
- Phase 8 (Jul 2027+): + Safety/Procurement specialists if the data justifies them.

**Cost.** At GA (T-0 + 90 days), with 10 paying GCs × ~5 active users/GC × ~50 IRIS calls/user/week × $0.02/call (Sonnet for high-stakes specialists, Haiku for routing/narrative wrappers) = ~$2,500/month. Per-project marginal cost ≤ $1.50/month for embeddings (per ADR-017 stub). **Total LLM cost at 10-GC scale: < $5,000/month.** The Council shape is cheap because most calls hit one specialist, not many.

**Failure modes.**

- A specialist regresses → the *one* specialist is rolled back. Nightly goldens catch.
- Router miscalibration → user override chip + telemetry on `route_overridden_by_user`. Above 5% override = recalibrate regex bank.
- Cross-specialist orchestration is workflow code, not agent emergent behavior — that's a velocity tax on workflows like "weekly OAC summary," but a velocity *win* on the 95% of calls that hit one specialist.

### 2.2 Archetype B — Tiered Hierarchy

**Topology:** 4 tiers.

- **Layer 1 (worker tier):** 30–50 micro-agents, each watching one entity type / page / signal. RFI watcher, Submittal watcher, Daily Log watcher, Weather watcher, etc. Most are deterministic with optional LLM enrichment.
- **Layer 2 (synthesizer tier):** 1 orchestrator agent per project. Reads from worker tier; produces project-level synthesis (the morning brief, the weekly OAC prep, the slip-risk score). LLM-backed.
- **Layer 3 (firm tier):** 1 strategic agent per tenant (GC firm). Reads from project orchestrators; produces firm-wide insights ("on your last 3 hospital projects, MEP RFIs spiked at Day -30; investigate"). LLM-backed.
- **Layer 4 (cross-firm tier):** Aggregate-only, anonymized, behind ADR-021. **Phase 7+ only.**

Information flows up; commands flow down. The supervisor pattern at each tier.

**Total LLM-backed agents at GA:** ~30 (mostly Layer 1 watchers) + 5–10 project orchestrators (one per active project, scaling to 100+ at Series A scale) + 1 firm agent per tenant. **At 10 GCs × 5 active projects/GC × 1 orchestrator/project = 50 orchestrator instances.** Plus 1 firm agent × 10 GCs = 10. Plus 30 Layer 1 watchers (shared across projects — instances are per project but the agent definition is shared). Total agent **instances** at 10-GC scale: ~30 worker definitions × 50 projects = 1,500 worker instances + 50 orchestrator instances + 10 firm instances = **~1,560 instances**.

**Pros.**

1. **Maps to construction's natural hierarchy.** Foreman → Super → PM → Executive is a real organizational structure. A tiered agent system *mirrors* that structure. The owner_rep persona could literally talk to the firm agent; the foreman could literally talk to the worker tier. Conceptually clean.
2. **Cross-project memory is an obvious tier, not a special-case query.** The firm agent is the natural home for "we've seen this before." The Phase 6 Historian *is* the firm agent in this archetype — and it's been waiting for an architectural slot.
3. **Per-page coverage is more emergent.** Layer 1 watchers can produce per-page insights without 50 hand-coded generators. The RFI watcher knows everything about RFIs and surfaces what's relevant on the RFI page automatically.
4. **Scales the engineering team better.** A 10-engineer team can own a tier each: 3 on Layer 1 watchers (~10 each), 2 on Layer 2 orchestrators, 1 on Layer 3 firm agent, 4 on Fabric/infra/integrations. Linearly parallelizable across hires.
5. **The story fundraisers like.** Series A pitches with "tiered agentic AI matching the hierarchy of the construction firm" pitch better than "specialist council" — though that's vanity, not architecture.

**Cons.**

1. **Latency compounds.** A single user query that needs cross-tier synthesis (e.g., "what should I worry about this week?") fans out to 30 watchers, gets synthesized by the project orchestrator, gets context from the firm agent, and returns. Even with parallel fan-out, the supervisor-fan-out-fan-in-supervisor pattern P95 stacks at 12–20s. That breaks the per-page coverage thesis (Phase 4 demands sub-3s response on slot rendering). Mitigation is aggressive caching, but caching across tiers is its own complexity.
2. **Cost is 5–10× the council.** 1,560 agent instances at 10-GC scale. Even with deterministic Layer 1, the LLM-call rate is dramatically higher because every project orchestrator runs continuously. Per-project monthly LLM cost climbs from $100 to $500–$1,000. At 100 paying GCs × 5 projects = 500 projects, that's $250K–$500K/month in LLM cost. The Council is $25K/month at the same scale. **The cost ceiling alone disqualifies this archetype until Series B revenue.**
3. **Audit chain attestation is a 5× scope.** Every action has a chain of signatures (worker → orchestrator → firm). The Big-4 audit (T-195 milestone) becomes a multi-month exercise. Procore would still have a 12-month gap to close, but ours opens up too — so the moat-thickness is roughly unchanged while our cert cost is much higher.
4. **Specialist boundaries are harder to enforce.** ADR-018's lint contract is straightforward for 4 peer agents. For 30+ agents in a tree, the contract has to gain "what tier is this," "what does it pass up," "what does it accept down." More rules to remember = more rules to break.
5. **The "firm tier" claim is mostly vibes until 3+ closed projects exist.** Phase 6 already addresses cross-project memory as a *retrieval* layer (firm_memory schema, Historian agent reading it). Promoting it to its own tier *now* means architecting for a capability that won't have data to operate on for 18+ months. The retrieval-layer answer ships value at Phase 6; the tier answer doesn't ship value until Phase 8.
6. **Engineer #2 onboarding becomes harder, not easier.** A flat council says "pick a specialist, here's the contract, ship it." A tiered hierarchy says "pick a tier, learn the inter-tier contract, learn the supervisor pattern, then ship."
7. **Sprint invariant compatibility is not free.** Money math through `money.ts` (Sprint Invariant #2) is enforced inside one specialist in the Council. In the Tiered Hierarchy, money flows up from the Layer 1 cents-watcher to the Layer 2 budget-orchestrator to the Layer 3 firm financial agent — three places to enforce, three places to break.

**Industry analogue.** This is the **Glean enterprise model** (corpus → people → topics, layered). Or the **military command structure** (squad → platoon → company → battalion). Or — relevantly — the **TSMC fab orchestration model** (per-wafer agents → per-tool orchestrators → per-fab supervisors → enterprise) which works because the timescales are minutes-to-hours and the fab is a closed system. Construction is not a closed system; it is multi-actor with information arriving asynchronously over weeks.

**Phase-by-phase implementation (if adopted).**

- Phase 0: same as today.
- Phase 1: Role Layer + Fabric ships unchanged.
- Phase 2: 4 specialists *plus* skeleton tier scaffolding — not all watchers, but 5 representative ones. Latency budgets crash. **High risk of Phase 2 slipping by 30+ days.**
- Phase 3: pgvector + watchers fan-out from KB. Watcher ingestion infra adds 4–6 weeks.
- Phase 4: per-page coverage emerges from watchers. Plausible win — ~50 deterministic generators replaced by ~30 watchers. **But:** the watcher-to-page mapping has to exist, and that's another 4 weeks.
- Phase 5: Field agent slots into Layer 1 (it's a foreman watcher, structurally).
- Phase 6: Historian *is* the firm-tier agent. **Phase 6 calendar shrinks** because the architecture is already there.
- Phase 7: integrations are Layer 1 watchers reading external systems. Marginal velocity win.
- Phase 8: cross-firm tier opens. Requires anonymization (ADR-021).

**Cost (if adopted).** At GA: **5–10× the council** in LLM spend. ~$25K–$50K/month at 10 GCs. ~$250K–$500K/month at 100 GCs. **This is the disqualifier.** Pre-Series-A burn rate cannot absorb $500K/month in LLM cost without crowding payroll.

**Failure modes.**

- Per-tier latency stacks — Phase 4 thesis breaks. Hardest to recover from.
- One Layer 1 watcher misbehaves → its outputs flow up to the orchestrator, which propagates to the firm agent → contaminates the firm narrative. The blast radius is wider than the Council.
- The cross-tier contract drift problem: Layer 1 changes its output shape; Layer 2 still expects the old shape; Layer 3 silently degrades. CI lint can catch but the rule surface is ~10× the Council.

### 2.3 Archetype C — Agent Army (Swarm)

**Topology:** 100+ micro-agents per project, mostly deterministic, with a small fleet (~5) of LLM agents synthesizing. Closer to a manufacturing MES (Manufacturing Execution System) or power-grid SCADA model. Every entity has its own agent: every RFI has an RFI-agent, every submittal has a submittal-agent, every cost code has a cost-code-agent, every drawing sheet has a drawing-agent, every photo has a photo-agent, every schedule activity has an activity-agent.

**Total agents at GA:** *thousands* per active project. At 10 GCs × 5 projects × ~5,000 entities/project = **~250,000 agent instances**, of which ≤1% are LLM-backed.

**Pros.**

1. **"No piece of information is not absorbed" is literal.** Every entity has an agent watching it. This is what Walker's May-8 question literally describes if you take it at maximal face value.
2. **Resilient to component failure.** One agent dies; 249,999 keep running. SCADA model.
3. **Natural fit for sensor/IoT integration if/when SiteSync wires real-time jobsite telemetry.** Phase 8+. (Today this is aspirational; sensor integration is not on the roadmap.)
4. **Most agents are deterministic.** The LLM cost can stay low if the synthesis fleet is ≤5 agents, because the army is just rules-engines wearing the "agent" label.

**Cons.**

1. **Operational complexity is order-of-magnitude higher.** 250K instances need scheduling, lifecycle management, dead-letter queues, retry logic, observability. The pgmq + edge-fn worker pattern (ADR-003) does NOT scale to 250K consumers without a real Kafka/NATS substrate. Building that = 2 engineers for 6 months. **Phase 0–6 scope blows up.**
2. **The construction domain doesn't justify the swarm shape.** A power grid has microsecond-scale events, sensor fan-out, real-time control loops. Construction has *days*-scale events. The signal-to-noise is wrong. A swarm processing 250K agents 1Hz each produces 250K events/sec; the actual interesting events on a real construction project are ~50/day. The swarm overhead is 99.99%+ wasted.
3. **The deterministic component of the swarm is exactly what the Council already has as 50 per-page generators + 5 detectors.** Re-labeling each one as "an agent" is a vocabulary change, not an architecture change. If you mean the *LLM* swarm (every RFI with its own LLM call), cost explodes to ~$50K/month per project.
4. **Audit chain attestation is impossible at this scale.** Big-4 won't certify a hash chain over 250K-agent action streams in 90 days. The T-195 milestone fails.
5. **No industry analogue with a positive track record in operations-management software.** SCADA works because the operator's mental model is "one big system with many sensors." Construction PMs do not think that way; they think in workflows. The swarm shape is a forced fit.
6. **Sprint Invariant violations multiply.** Each cents-bearing agent is a new place to break Sprint Invariant #2. ADR-018's contract enforcement scales linearly with agent count. At 250K agents, the lint surface is unmanageable.
7. **No customer asks for this.** Procore Copilot, Trunk Tools, OpenSpace AI agents are all *fewer* than 14 LLM agents per customer at the topology level. The market's revealed preference is the Council, not the army.

**Industry analogue.** Closest is **Tesla's Autopilot stack** (sensors → perception → planning → control), but that has microsecond control loops driving the architecture. Construction has no control loop on that timescale. Also closest is **certain crypto/MEV systems** with thousands of bot-agents, but those are adversarial, real-time, money-game systems. Construction is collaborative, weeks-scale, document-game.

**Phase-by-phase implementation.** **Disqualified.** Would push T-0 right by 12+ months and burn the Series A. Not pursued in this memo.

**Cost.** $200K–$500K/month per 10 GCs in LLM-backed swarm. Plus ~$2 engineers × $250K/yr × 1 year = $500K headcount cost. Disqualifying.

**Failure modes.** Operations team spends 80% of cycles managing the swarm, not shipping product. By Phase 4, the team is rebuilding their own Kafka. By Phase 6, they're recruiting a separate platform team to operate the agent infrastructure. Pre-money company can't afford that path.

---

## 3. The recommendation — defend Archetype A with evolutions

### 3.1 Pick Archetype A. Specialist Council.

**Specifically:** the Phase-1 Role Layer + Context Fabric design ratified in ADR-019 and ADR-020 stays. The Phase-2 4-specialist + router + 3-executor design ratified in ADR-018 stays. Phase 5 adds the Field agent as a 5th specialist. Phase 6 adds the Historian as a 6th. Phase 8 may add Safety/Procurement bringing the count to 8–10 specialists. **Hard cap at 14.** Beyond 14, the next system is **not** another specialist — it's a tool inside an existing specialist or a deterministic generator. This is the constraint that differentiates the recommended architecture from "drift into a tiered hierarchy by accident."

### 3.2 Defend the choice against the cross-vertical research

The 9 universal pillars from `IRIS_NATIVENESS_PLAN_2026-05-08.md` §3 are the sanity check. The Council architecture maps to them as follows:

| Pillar | Council answer | Strength |
|---|---|---|
| **P1. Workflows beat chat** | Workflows live in client + executor code; specialists serve workflows. Chat is fallback. | Strong. |
| **P2. Citations are the trust contract** | Drafter + Code specialists carry citation contracts. Side panel renders. | Strong (Phase 0 already shipped). |
| **P3. Unit of context is the entity / build a graph** | Context Fabric assembles entity + related entities + spatial + temporal + intent. Phase 3 adds vector retrieval. | Strong by Phase 3. |
| **P4. Permission-aware retrieval** | Fabric is the single retrieval entrypoint (ADR-020). RLS enforced at SQL. 50 RLS test cases per phase. | Strong. |
| **P5. Specialist sub-agents beat one mega-prompt** | The whole memo. | The architecture is named after this pillar. |
| **P6. Domain-tuned voice and vocabulary** | `style.ts` ontology + voice linter + persona-conditioned voice modifiers. | Strong by Phase 1 close. |
| **P7. Generate AND commit** | 3 executors at Phase 2 close; cancel-window pattern; PermissionGate. | Strong by Phase 2 close. |
| **P8. Ambient, proactive insights** | 5 detectors + 50 per-page deterministic generators + ambient morning brief synthesizer. | Strong by Phase 4 close. |
| **P9. Replayable, evaluable, observable** | `iris_invocations` + `iris_actions` + goldens per specialist + nightly persona-eval. | Strong by Phase 2 close. |

The pillars do not *require* a tiered hierarchy. They require a **named, citation-grounded, permission-aware, replayable specialist substrate over a single context fabric**. The Council ships exactly that.

The cross-industry research (`CROSS_INDUSTRY_AI_RESEARCH_2026-05-08.md`, to be cross-referenced) is expected to confirm the Council shape is also what Hippocratic, Sierra, Decagon, Suki, and Glean ship. The agent-architecture research (`AGENT_ARCHITECTURE_RESEARCH_2026-05-08.md`, to be cross-referenced) is expected to surface the LangGraph/CrewAI Coordinator+Worker pattern — which is the Council pattern, not the tiered hierarchy.

Industry watch — early 2026 web research (Procore Helix + Procore Assist, Trunk Tools' "AI army" platform, OpenSpace's "agents over reality data" pitch) confirms that **no construction-tech vendor at scale has shipped Archetype B or C topologies.** Procore ships an Assist (chat) + Insights (detectors) + Agent Builder (customer-defined agents on top) — a Council with customer-extensible nodes. Trunk Tools' "AI agents" headline is marketing language for what is, structurally, a small fleet of LLM-backed services + a deep deterministic ontology + a vision stack. OpenSpace's agents are described as "agents over reality data" — which is one synthesizer agent, not a hierarchy.

**The market revealed preference matches the Council. The architectural pillars match the Council. The sprint invariants match the Council. The cost ceiling forces the Council. The recommendation is the Council.**

### 3.3 Specific answers to the questions

**How many agents at Phase 2 close?**

- **5 LLM-backed:** Drafter + Money + Schedule + Code + Router. Plus 3 executors (deterministic-with-LLM-narrative).
- 5 detectors (deterministic).
- ~13 named components total.

**Phase 6 close (T-0, Apr 30 2027)?**

- **8 LLM-backed:** Drafter + Money + Schedule + Code + Field + Historian + Router + brief-synthesizer.
- 5 detectors + 3 executors + ~50 per-page generators + 5 ingestion workers + closeout extractor.
- ~75 named components total.

**GA (T+90 → T+360)?**

- **≤14 LLM-backed.** Headroom for Safety, Procurement, and 2–4 reserves (e.g., a Punchlist specialist if the data justifies; a Submittal-deep specialist if Drafter is overloaded).
- ~70 deterministic.
- ≤84 named components total.

**Are personas agents or prompt-conditioning?**

- **Prompt-conditioning. Confirmed.** ADR-019's design is correct: persona = `{base_prompt + tools + dashboards + voice + permissions + auto-action threshold}`. The Context Fabric assembles persona context; the same specialist serves all 5 personas with persona-conditioned prompts. Promoting personas to agents would mean 5× the specialist surface (5 × 4 specialists = 20 agent instances at Phase 2) which violates the cap, gets messier with the workflow-pin override (ADR-019's tightening), and provides no measurable benefit beyond what the Fabric already provides.
- **Eval mechanism (Phase 1 §7):** persona divergence ≥ 80% on 50 paired prompts × 5 personas = 250 outputs. If divergence holds with persona-as-prompt-conditioning, the architecture is correct. If divergence collapses below 80%, *only then* re-litigate persona-as-agent. Walker reviews 25 random pairs personally on Day 27 of Phase 1.

**Tiered? If yes, what tiers?**

- **No tiers in Phases 0–4.** Flat Council.
- **Phase 5+ optional 2-non-fanout-tier:** the Field agent is *structurally* a worker-tier agent (mobile-first, voice-input, narrow scope). The Drafter/Money/Schedule/Code/Code agents are the synthesizer tier. The Historian is structurally a firm-tier agent. **But:** these are still all peers in the audit chain, all routed by the single router, and the "tier" designation is documentation, not runtime architecture. There is no fanout from synthesizer to worker. There is no supervisor-of-supervisors. The flat call graph stays flat.
- **Why this is the right call:** the **Sprint Invariant #2 + audit-chain certification + cost-ceiling triple** all reward flatness. The hierarchical tier story adds engineering surface without proportional product value before Series B. Promoting "tiers" to runtime architecture is a Series-B-or-later decision driven by data.

**Verification: which agents review which? When does Walker review?**

- **Pre-Phase-2:** Walker reviews every PR.
- **Phase 2:** the Drafter's outputs are reviewed by the user (existing accept/reject UX). The Money agent's outputs are reviewed by the *Money agent's deterministic check* before user sees them. The Schedule agent's outputs are reviewed by the CPM module before user sees them. The Code agent's outputs are reviewed by `verifyCitationSnippet` before user sees them.
- **No specialist reviews another specialist's output.** Each specialist is responsible for its own deterministic gate. This is ADR-018's flat contract.
- **Walker reviews the system** at: Phase 1 Day 27 (persona divergence), Phase 2 Day 26 (routing goldens curation), Phase 4 Day 30 (insight dismissal-rate thresholds), Phase 6 Day 15 (anonymization protocol two-engineer review), and quarterly thereafter. **Engineer #2** does the specialist-level reviews on weekly cycles starting Phase 2 Day 1.

**Cost ceiling: cost-per-project budget at GA, and how the topology fits.**

- **Cost ceiling: $25/project/month** at GA. (Reasoning: pricing is $200–$500/seat/month per North Star; a project has 3–8 seats; 5% of revenue going to LLM cost = ~$30–$100/project/month soft ceiling; tighten to $25 for headroom.)
- **The Council fits well:** ~50 IRIS calls/user/week × 5 users/project × 4 weeks/month = 1,000 calls/project/month. Average cost per call ~$0.02 (mix of Sonnet + Haiku) = **$20/project/month**. Embeddings: $1.50/project/month per ADR-017 stub. Detectors: deterministic, ~$0.50/project/month for cron + DB. **Total: ~$22/project/month, under the $25 ceiling.**
- **The Tiered Hierarchy at the same scale:** $100–$500/project/month. Disqualified.
- **The Swarm at the same scale:** $1,000+/project/month. Disqualified.

### 3.4 Two refinements vs. the existing plan

The existing plan is correct in shape. Two refinements that this memo recommends ratifying as ADR-022 (Agent Topology):

**Refinement 1 — Hard cap at 14 LLM-backed agents through end of Phase 8.** Whenever someone proposes a new specialist, the bar is: (a) does the data show ≥3 distinct workflows that exceed an existing specialist's scope, (b) does the cost-per-project model still fit under $25, (c) does the audit-chain attestation scope still close in 90 days. If any of the three fails, the new capability ships as a tool inside an existing specialist or a deterministic generator. This is the difference between "principled Council" and "drift into a hierarchy by accident."

**Refinement 2 — Deterministic-first for per-page coverage.** Phase 4 ships ~50 Insight Slot generators. The default is deterministic. LLM-backed generators are the exception, gated behind the existing 4 specialists. **No new LLM-backed agent is introduced for per-page coverage.** This protects the cost ceiling and the latency budget.

These two refinements are the substantive content of ADR-022. Everything else in ADRs 017–021 stays.

---

## 4. What changes about the existing plan if recommendation is adopted

The plan changes by *constraint*, not by *re-architecture*. Specifically:

### 4.1 ADRs

- **ADR-017 (Embedding model)** — unchanged.
- **ADR-018 (Specialist Boundary Contract)** — **amend** §3 (the four declared specialists) to note: "Phase 5 adds Field; Phase 6 adds Historian; Phase 8 may add Safety + Procurement; **hard cap at 14 LLM-backed specialists; new specialists must clear the 3-data + cost + audit triple in ADR-022.**"
- **ADR-019 (Persona Model)** — unchanged. Personas confirmed as prompt-conditioning, not agents.
- **ADR-020 (Context Fabric)** — unchanged. Fabric remains the single retrieval entrypoint for all specialists, deterministic or LLM-backed, and for all per-page generators.
- **ADR-021 (Cross-Project Anonymization)** — unchanged. Historian remains a project-scoped agent that queries firm_memory; no firm-tier promotion.
- **ADR-022 (NEW — Agent Topology)** — **add.** Document the Council choice, the 14-agent cap, the deterministic-first rule for per-page coverage, the explicit rejection of Archetype B and C through Phase 8, and the data thresholds for revisiting at Series B.

### 4.2 Phase specs

- **Phase 1 spec** — unchanged. The Role Layer + Fabric design is exactly what the Council needs.
- **Phase 2 spec** — **amend §3** with one paragraph: "Phase 2 ships the 4 specialists named here. The Council architecture (per ADR-022) caps total LLM-backed agents at 14 through Phase 8. Phase 2's 4 are not the floor; they are the foundation. New specialists added in later phases must clear the data-cost-audit triple before they ship."
- **Phase 3 spec** — unchanged. KB ingestion is deterministic; Code agent's KB swap is contract-stable.
- **Phase 4 spec** — **amend** the per-page coverage section: "Default to deterministic generators (per ADR-022 refinement 2). LLM-backed generators are the exception, gated behind one of the 4 specialists. No new LLM-backed agent is introduced at Phase 4."
- **Phase 5 spec** — **amend** to call out: "Field agent is the 5th specialist; brings total LLM-backed count to 7 (4 + Field + Router + brief-synthesizer)."
- **Phase 6 spec** — **amend** to call out: "Historian is the 6th specialist; brings total to 8. Phase 6 explicitly does NOT promote firm-memory to a tier — Historian is a project-scoped agent that queries firm_memory."
- **Phase 7 / Phase 8 specs** — when written: must invoke the data-cost-audit triple from ADR-022 before adding any new specialist.

### 4.3 New ADRs needed

- **ADR-022 — Agent Topology.** Documents the Council choice. ~3 pages. Inline summary of the 3 archetypes evaluated. Decision matrix. The 14-agent cap. The deterministic-first rule. The data-cost-audit triple. Rollback path (if cost or audit certification needs the architecture to evolve).

### 4.4 Calendar impact

- **Phases 0–6: no calendar change.** All phase windows in `IRIS_NATIVENESS_PLAN_2026-05-08.md` §6 remain as written. T-300, T-270, T-240, T-210, T-180, T-120, T-60, T-0 milestones stay.
- **Phases 7–8: minor risk of pull-forward.** If a future capability (e.g., Safety) wants to land in Q3 2027, the data-cost-audit triple gate may delay by 4–8 weeks while the data accumulates. That's a Series-A-era concern, not a current-plan concern.
- **Engineer #2 hire window: unchanged.** The Council is the topology Engineer #2 was hired to ship. The Tiered Hierarchy would have demanded a 2nd engineer arriving at Phase 2 instead of Phase 1; the Swarm would have demanded a platform team. **The Council is the *only* topology that fits the current hiring plan.**

### 4.5 Sprint invariants

- **Invariant #1 (typecheck green):** unchanged.
- **Invariant #2 (money math through `money.ts`):** **strengthens.** The Money specialist is the embodiment. The cap at 14 LLM agents prevents money flowing through 30+ agents.
- **Invariant #3 (no re-adding deleted stores):** unchanged. Specialists are services, not stores.
- **Invariant #4 (13-store target):** unchanged. The Council adds zero stores.
- **Invariant #5 (PermissionGate on action buttons):** **strengthens.** Each executor wraps PermissionGate; with executors capped to ~10 by Phase 8, the lint surface (`audit-permission-gate.mjs`) stays manageable.
- **Invariant #6 (tracker updates):** unchanged.
- **Invariant #7 (receipt per day):** unchanged.

### 4.6 Tracker impact

The `Lap 3 — IRIS Native` tab in `SiteSync_90_Day_Tracker.xlsx` (per Phase 1 plan) gets one new row at the top: "Day 0 — ADR-022 Agent Topology ratified." That's the only tracker change.

---

## 5. Risks of the recommendation

### 5.1 What could prove the Council wrong

Six failure signals would force a re-evaluation. Each has an explicit telemetry signal.

**Risk 1. The Drafter latency P95 exceeds 6s consistently and customers complain.** This means the single-LLM-call per workflow is too slow for human attention spans. The Tiered Hierarchy would be *worse* (more hops); the Swarm would have the same per-call latency. So the right response is **smaller models + caching + parallelism within the Drafter**, not a topology change. Telemetry: `iris_invocations.latency_specialist_ms` p95. Threshold: 7 days over 6.5s = action required.

**Risk 2. Two specialists end up with overlapping scope and the user can't tell which one will be invoked.** Symptom: routing override rate > 5%. Response: regex bank tuning + LLM-fallback prompt rewrite + scope-boundary clarification in ADR-018. **Not a topology change.** Telemetry: `iris_invocations.route_overridden_by_user`.

**Risk 3. A specialist needs to call another specialist, and the workflow-orchestrator pattern feels too clunky.** This is the pull toward a tiered hierarchy. Symptom: ≥3 workflows where the orchestrator code grows past 200 LOC. Response: **refactor the workflow code, not the agent topology.** Workflows are allowed to be complex; specialists are not. Telemetry: lines of code in `src/services/iris/workflows/*.ts`. Threshold: ≥3 workflows over 200 LOC = code review.

**Risk 4. The 14-agent cap feels too tight by Phase 7.** Symptom: Walker or Engineer #2 proposes a 15th specialist and it clearly clears the data-cost-audit triple. Response: **revisit the cap deliberately at Phase 7 open**, with a written ADR amendment. Don't drift past 14 silently. Telemetry: count of files in `src/services/iris/specialists/`. Threshold: hard CI lint blocks the 15th file without an ADR amendment.

**Risk 5. The cost ceiling drifts over $25/project/month at scale.** Symptom: monthly LLM bill / project count > $25. Response: model-tier optimization (more Haiku, less Sonnet for non-critical paths) + better caching. **Not a topology change** — neither the Tiered Hierarchy nor the Swarm makes this *cheaper*. Telemetry: monthly LLM spend / active projects. Threshold: $30/project/month for 2 months = action required.

**Risk 6. Cross-project memory at Phase 6 feels architecturally awkward as a "specialist that queries a table."** This is the strongest argument for the Tiered Hierarchy — and it's the one to take seriously. Symptom: Historian agent code grows complex (>1000 LOC) and overlaps with other specialists. Response: **first attempt the refactor as a tool inside Drafter/Code/Schedule that pulls from firm_memory** rather than promoting to a tier. If that also fails, the Phase-7/8 ADR-022 amendment promotes Historian to a synthesizer-tier with an explicit fanout pattern, scoped narrowly. **This is the one pre-authorized escape hatch in this memo.** Telemetry: `src/services/iris/specialists/historian.ts` LOC and import graph complexity.

### 5.2 Rollback path

If, in 12 months, the data shows the Council is wrong, the rollback is:

1. **Phase 6 Historian becomes the firm-tier synthesizer.** The `firm_memory` schema (per the existing Phase 6 spec) is already there. The Historian is already declared. Promote it to a tier with explicit fanout to project-orchestrators.
2. **Add 1 project-orchestrator agent per project.** Reads from the existing 4 specialists; produces project-level synthesis. Replaces the current "workflow code orchestrates specialists" pattern.
3. **Layer 1 worker tier remains optional.** Most existing deterministic generators don't need to become "agents" — they're fine as functions. The promotion is opt-in for the ≤10 generators that genuinely benefit.

The rollback is a 4-week effort for 1 engineer. **The Council does not lock us out of the Tiered Hierarchy; it just makes us earn it before we ship it.**

### 5.3 What this memo cannot prove

Three things this memo does not prove and that future quarters may falsify:

1. **That 14 specialists is enough at Series B scale.** Maybe the right cap is 20. The data threshold for revisiting is end of Phase 8.
2. **That deterministic per-page generators stay below $25/project/month at 100-GC scale.** Modeling only goes so far; we'll see at Phase 4 close. The cost-ceiling telemetry is the bellwether.
3. **That no construction customer demands tiered hierarchy.** A future Series A customer (a 1,000-project ENR-50 GC) may demand a "firm tier" agent for board reporting. That demand is real but Phase-7+, and the existing Historian + ADR-021 anonymization is the answer, not a topology change.

---

## 6. Decision call

**Walker, today (2026-05-08), to unblock Phase 1 implementation:**

Ratify ADR-022 (Agent Topology — Specialist Council, 14-agent cap, deterministic-first per-page coverage). The Phase 1 spec, the Phase 2 spec, and ADRs 017–021 stand as written. Engineer #2's first PR is the Phase 1 Day 1 scaffolding: Fabric skeleton + persona table seed + telemetry table.

The decision is **not** between flat and tiered. The decision is between **flat with a cap and a deterministic floor** versus **flat that drifts upward**. Cap and floor are how the Council stays the Council under product pressure. Without ADR-022, Phase 4's per-page coverage will be tempted into 50 LLM agents; Phase 6's cross-project memory will be tempted into a firm tier; Phase 8's predictive layer will be tempted into a swarm. **The cap and floor are the discipline that makes the architecture survive contact with the calendar.**

If Walker reads only the bottom line: **Ship the Council. Cap at 14. Default to deterministic. Revisit at Phase 8. Engineer #2's first PR is Phase 1 Day 1.**

---

## 7. Cross-references for the parallel research files

When `CROSS_INDUSTRY_AI_RESEARCH_2026-05-08.md` and `AGENT_ARCHITECTURE_RESEARCH_2026-05-08.md` land in `docs/audits/`, the expected confirmations and contradictions:

**Expected confirmations from cross-industry:**
- Hippocratic Polaris ships ~10 specialists, not a hierarchy.
- Sierra ships AOPs (atomic operations) over a small specialist core.
- Salesforce Agentforce uses Topics (specialists) not tiers.
- Suki uses voice commands shaped like clinical actions — workflows over chat.
- Glean's "moat" is permission-aware retrieval over a graph — the Fabric.
- Stripe's risk stack is 70%+ deterministic, 30% ML/LLM — same ratio as the Council target.
- SpaceX's Falcon program: small named teams + standard contracts + integration hub. The Council shape.

**Expected confirmations from agent-architecture:**
- LangGraph Coordinator+Worker pattern = the Council's router + specialists.
- CrewAI hierarchical (manager + workers) is one supervisor + 4–8 workers, not 4 tiers.
- Hierarchical agentic RAG papers describe 2-tier max for production systems.
- Multi-agent benchmarks (e.g., Claude 3.7 in 2-agent config) show diminishing returns past ~5 agents on most tasks.

**Expected contradictions to address (if surfaced):**
- If the agent-architecture research promotes a 3+ tier hierarchy as the 2026 best practice for high-stakes domains, this memo's §5.1 Risk 6 escape hatch (Historian-as-tier at Phase 7) absorbs it.
- If the cross-industry research reports that one named competitor (likely Trunk Tools or Procore) ships a tiered hierarchy in production with positive customer feedback, this memo's §3.2 industry-watch paragraph needs amendment but the recommendation does not change — because the cost ceiling and audit-chain scope at our pre-Series-A stage still favor the Council.

---

## 8. Footer — what to do with this memo

1. Walker reviews and ratifies (or amends) within 5 working days.
2. ADR-022 written as a standalone file (~3 pages) at `docs/audits/ADR_022_AGENT_TOPOLOGY_2026-05-XX.md` and added to `INDEX.md`.
3. Phase 1 spec and Phase 2 spec each get a one-paragraph amendment per §4.2 above. Receipts attached.
4. The cross-industry and agent-architecture research files are read on landing; if they contradict, this memo's §5 risk thresholds are the gate.
5. Quarterly review: re-validate the 14-agent cap, the deterministic-first rule, and the cost ceiling. The North Star says "lie to no one about how confident you are."

---

*End of memo. T-minus 357 days to Apr 30, 2027. The Council ships.*

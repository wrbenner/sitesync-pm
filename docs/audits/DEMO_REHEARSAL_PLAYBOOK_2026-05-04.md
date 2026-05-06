# Demo Rehearsal Playbook — Lap 3 Days 73-77

**Date:** 2026-05-04
**Status:** Spec ready. Walker rehearses Days 73-77 (~June 26 - June 30 tight calendar).
**Companion specs:** `LAP_3_ACCEPTANCE_GATE_SPEC` (Gate 3 = 4 consecutive flawless external runs), `SALES_DECK_v1` (the deck the demo lives in), `FIRST_CONTRACT_PLAYBOOK` (where the demo earns the next meeting).
**Format reference:** Performance / muscle-memory training playbook. Modeled on speech-rehearsal cadences from professional speakers + air force pilot pre-flight checklists.

---

## TL;DR

Walker performs **200 reps of the 12-second demo** across 5 days. Goal: when he runs it externally on Day 78+, the demo is **muscle memory** — not "let me show you what would happen if the data was loaded" + apologetic lag, but a clean, confident, predictable performance.

The demo is the moment that earns the next meeting. **Bugatti standard:** the demo runs flawlessly four times in a row externally (per Gate 3) — and behind that gate is 200 internal reps that nobody sees but everyone benefits from.

This spec covers: the demo environment, the 12-second sequence, the 50-rep blocks, the failure modes to drill, and the rehearsal-day rhythm.

---

## The 12-Second Demo (the contract)

Per Field Manual Part III + Sales Deck v1 Slide 8:

```
Time      Action                                          Audience-visible
0:00      Walker opens /iris on iPad                       iPad lock screen → app login
0:01      Three drafts already in the inbox                Cards animate in (pre-loaded by seed)
0:03      First draft: RFI follow-up                       Tap card → expanded view
0:04      Confidence: 0.94                                  Read aloud: "0.94 confidence"
0:05      3 citations visible                                Citation chips
0:06      Walker: "Approve"                                  Cmd+Enter (or button tap)
0:07      Card disappears; second draft auto-shows            Smooth transition
0:08      Daily log card                                      Same flow
0:09      Walker: "Approve"                                  
0:10      Pay-app review card                                  Iris flagged duplicate
0:11      Walker: "Approve"                                  
0:12      Audit chain visualization shows 3 new rows          Real-time visualization
```

**12 seconds.** No pauses. No "let me wait for that to load." No apology. The pacing comes from rehearsal.

---

## The 200 Reps (broken into 5 blocks of 40)

### Block 1 — Day 73: Setup + first 40 reps (3 hours)

**Setup (1 hour):**
- Confirm demo environment is provisioned + seeded with the 3 drafts at exactly the right confidence levels + citation kinds
- Verify all three drafts persist correctly across page reloads (no state issues)
- Confirm the audit-chain visualization renders correctly
- Backup demo environment (if primary fails, swap in 60 seconds)
- iPad fully charged + brightness max + airplane-off mode
- iPad in folio case Walker prefers (real demo conditions)

**40 reps (2 hours):**
- 5-min warmup: explain to camera what's about to happen
- 10 reps slow (~30 seconds each, talking through every step)
- 15 reps medium (~20 seconds each, simulating sales call)
- 15 reps fast (~12-15 seconds each, target performance)
- Each rep recorded; review after each block of 5
- Self-critique: "what felt wrong"

**End of Day 73:** Walker has muscle memory of the 12-second sequence. Failures (mistapped, wrong card opens) are within the band of acceptable.

### Block 2 — Day 74: Failure-mode drilling (3 hours)

**40 reps focused on failure scenarios:**

What can go wrong on a real customer call:
1. **Wifi drops mid-demo.** What does Walker do? (Demo runs entirely from iPad cache; hot-spot fallback ready)
2. **Audience interrupts mid-card.** What does Walker do? (Pause the timer; answer; resume from same state)
3. **iPad runs out of battery.** Backup iPad always present; charger always ready.
4. **Demo data didn't seed correctly.** (Seed script must run successfully every morning before any demo.)
5. **Audience asks about a draft Walker didn't expect.** (Flexibility in narrating; can swap demo data on the fly.)
6. **Demo crashes (red screen, error state).** Acknowledge; switch to backup iPad; finish demo.

Each scenario: 5 reps with the failure injected. Walker learns to recover gracefully.

**End of Day 74:** Walker has trained for failure. Real demos will happen; recovery is muscle memory.

### Block 3 — Day 75: Audience-variation drilling (3 hours)

**40 reps with different audience profiles:**

- **Skeptical CFO:** rep with audience focused on financial details (pay app draft + audit chain)
- **Excited PE:** rep with audience focused on workflow + UX (smooth flows)
- **VP of Operations:** rep with audience focused on team adoption + sub portal
- **CIO:** rep with audience focused on integrations + compliance

Walker varies emphasis based on audience cue. Each rep includes 30 seconds of pre-demo Q&A to match the persona.

**End of Day 75:** Walker can read the room and emphasize the right thing.

### Block 4 — Day 76: Cold-open from closed laptop (4 hours)

**40 reps with NO setup prep:**

This is the hardest variation. Walker arrives at a customer's office with iPad in folio. Must:
1. Power on iPad (10s)
2. Open SiteSync app (5s)
3. Verify demo data is loaded (5s — if not, run seed script while talking)
4. Begin demo within 30 seconds of "shall we start?"

Practiced 40 times. Cold-open mastered.

**End of Day 76:** Walker is robust to "the customer is ready and waiting; let's go now."

### Block 5 — Day 77: Final 40 + pressure test (4 hours)

**Final 40 reps simulating real conditions:**

- 4 reps in front of a friend / advisor (real audience)
- 8 reps standing up (different from sitting)
- 4 reps with a real iPhone calling — Walker silences and resumes
- 4 reps with someone interrupting (the friend acts as customer asking a real question)
- 4 reps cold-open with hot lights (visual stress)
- 8 reps timed — must finish in exactly 12 seconds, ±1 second
- 4 reps with deliberate failures (Walker injects an error to practice recovery)
- 4 final reps perfect — record as the "gold standard"

**End of Day 77:** Walker is demo-ready. 200 reps done.

---

## The Failure-Mode Drill List (40 specific scenarios across 5 days)

These are the actual things that can go wrong, drilled across the 5 blocks:

1. iPad battery dies → backup iPad ready
2. Wifi drops → hot-spot fallback (cellular)
3. iPad cache loses demo data → re-seed via emergency script (30s)
4. App crashes → reopen + resume (auto-saves state)
5. Demo data is wrong (different seed) → backup environment ready
6. Audience interrupts → pause + answer + resume
7. Audience laughs at something unexpected → acknowledge + continue
8. Audience says "this is too good to be true" → take a beat; show the audit chain proof
9. Audience asks about a feature we don't have yet → honest answer + roadmap
10. Audience says "Procore can do that" → compare specifically (battlecard mode)
11. Demo crashes mid-flight → switch to backup iPad
12. Sound issues (audio) → switch to local; audience leans in
13. Glare on iPad screen → reposition; max brightness
14. Walker forgets a line → improvise; the muscle memory carries
15. Demo loop is wrong (different drafts) → swap the 3 drafts via dev tool
16. Demo data is empty → re-seed; the audience watches Walker recover
17. Walker is jet-lagged + tired → muscle memory carries; not as smooth, still works
18. Walker is sick → reschedule; reschedule mechanic in playbook
19. Audience is hostile → de-escalate via empathy; carry on
20. Audience is bored → speed up; emphasize value-prop slides
21. Audience is technical → linger on the audit chain; embrace deeper questions
22. Audience is non-technical → skip the architecture; emphasize the workflow
23. Customer's existing tool is on the table (Procore, Trunk Tools) → battlecard mode
24. Customer expresses doubt about the audit chain → external attestation reference
25. Customer says "what about my data" → show data export + DPA
26. Customer says "your AI will hallucinate" → cite citation panel + adversarial test
27. Customer asks about pricing mid-demo → "let me finish the demo first; pricing slide coming"
28. Customer says "we'll think about it" → "I'll follow up Friday with the leave-behind"
29. Customer asks about implementation timeline → 30-day pilot path
30. Customer asks about integrations → stack list (Sage, Foundation, etc.)
31. Customer asks about mobile → "iOS app in App Store [date]; field-tested in 95° heat"
32. Customer asks about security → SOC 2 + Trust Center + insurance
33. Customer asks about compliance → industry-specific compliance roadmap
34. Customer asks about Embedded Payments → April 30 launch + benefit
35. Customer asks about subs → free portal + magic-link onboarding
36. Customer asks about voice → 150-draft hand-edit cycle + style guide
37. Customer asks about the audit chain whitepaper → email attached after call
38. Demo runs over time → cut to high-impact moments
39. Demo runs short → fill with audit-chain story + customer story
40. Customer wants to try it themselves → schedule pilot kickoff within 14 days

Each scenario gets a 5-second decision tree Walker has rehearsed.

---

## Pressure-test Day 77

The final 40 reps must include:

**Adversarial conditions (8 of the 40):**
- Walker stands during the demo (more energy, harder pacing)
- Walker holds the iPad in one hand (mimicking customer office)
- Audience asks a question Walker didn't anticipate (he answers + recovers)
- Phone vibrates audibly during the demo (Walker silences without breaking flow)
- Walker is mid-sentence when iPad screen times out (he taps + continues without panic)
- Walker has to stop demo for a real interruption (phone call) and resume
- Walker has to demo to someone he disagrees with (a Procore loyalist)
- Walker has to demo on a borrowed iPad (different model, slightly different UI)

**Audience reaction tests (4 of the 40):**
- Friend pretends to be confused — Walker re-explains
- Friend pretends to be skeptical — Walker shows the audit chain
- Friend pretends to be excited — Walker maintains pace, doesn't oversell
- Friend pretends to be bored — Walker speeds up, emphasizes value

These are the demos that prepare Walker for "anything can happen" Day 78+.

---

## What Earns Gate 3

Per `LAP_3_ACCEPTANCE_GATE_SPEC` Gate 3: **4 consecutive flawless external demos.**

After Day 77, Walker is ready. Day 78 is the first external demo. If it goes flawlessly, that's 1 of 4. Day 79+ (post-Day 78 launch event), Walker accumulates external demos in the natural sales motion.

A "fail" resets the count to zero. So Walker is highly motivated to make every external demo a clean run.

---

## Demo Environment Verification (every morning before any demo)

```bash
# scripts/demo-prep.sh

# 1. Confirm demo org is configured correctly
psql $STAGING_DB_URL -c "SELECT * FROM organizations WHERE slug = 'sitesync-demo';"

# 2. Confirm 3 drafts exist with right confidence + citations
psql $STAGING_DB_URL -c "
SELECT id, action_type, confidence, jsonb_array_length(citations) as citation_count
FROM drafted_actions
WHERE project_id = (SELECT id FROM projects WHERE name = 'Demo Project')
  AND status = 'pending'
ORDER BY created_at;
"
# Expected: 3 rows, all confidence ≥ 0.92, all citation_count >= 3

# 3. Re-seed if anything is off
if [ "$(echo $output | grep -c 'rfi.draft')" != "3" ]; then
  psql $STAGING_DB_URL -f scripts/reset-demo-data.sql
fi

# 4. Test the iPad: charge, brightness, network, app version
echo "Demo environment ready: $(date)"
```

This script runs every morning Walker has a demo. Output goes in `docs/sales/demo-env-checks/<date>.log`.

---

## What Walker Does with This Spec

1. **Day 73-77 (~June 26-30):** Block 5 days × 3-4 hours each. NOTHING ELSE on those days. This is the work.
2. **Each rep:** record on iPad / phone for self-review. ~3 hours of recordings to review post-Day 77.
3. **Failure scenarios:** rehearse + recover; muscle memory matters.
4. **Day 78+:** Walker uses the demo in real customer + investor calls. Every demo log goes in `docs/sales/demo-runs/`.

---

## What Claude Code Does

- Build the demo prep script (`scripts/demo-prep.sh`) (planned)
- Build the demo log table (`demo_runs` per `LAP_3_ACCEPTANCE_GATE_SPEC` migration)
- Maintain the demo environment seed (`scripts/reset-demo-data.sql`) (planned)
- Build a "demo health check" widget for Walker's standup feed

Total Claude Code work: ~2 days.

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| DEMO-1 | Demo crashes during a critical pitch (e.g., investor) | Low (post-200-reps) | High | 200 reps + backup iPad + cellular hot-spot + emergency seed script |
| DEMO-2 | Walker doesn't have time for 200 reps; cuts to 100 | Medium | Medium | Same demo Days 73-77 reserved on calendar; nothing else |
| DEMO-3 | Demo data drifts during pilot (Brad's pilot affects demo seed) | Low | Low | Demo org isolated; pilot org separate; verified daily |
| DEMO-4 | Walker performs worse on stage than in rehearsal | Medium | Medium | Block 5 includes adversarial conditions specifically for this |
| DEMO-5 | Audience reaction is different than rehearsal | Medium | Low | Variations across audiences in Block 3 prepare for this |
| DEMO-6 | Walker's nervous about high-stakes investor demo | Medium | Medium | More reps; familiarity reduces nervousness |

---

## What this spec deliberately does NOT cover

- The actual sales pitch deck (`SALES_DECK_v1`)
- The customer prospect list (`FIRST_CONTRACT_PLAYBOOK`)
- The Lap 3 acceptance gate measurement (`LAP_3_ACCEPTANCE_GATE_SPEC`)
- Demo to investors (different audience, slightly different cadence — covered by `SEED_DECK_v0`)
- AGC Convention demo prep (Q1 2027; new playbook then)
- Demo for owner audiences (Q4 2026+; different stakeholders)

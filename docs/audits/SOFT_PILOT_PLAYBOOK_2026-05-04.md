# Soft Pilot Playbook — Lap 2 Days 50–60

**Date:** 2026-05-04
**Status:** Spec ready. Includes ADR-006 (pilot data isolation) inline.
**Stakes:** Highest in the 90-day plan. If the pilot doesn't land, Lap 2 gate fails. If Lap 2 gate fails, no PMF signal. If no PMF signal, the entire 12-month plan is fiction.
**Companion:** `LAP_2_ACCEPTANCE_GATE_SPEC` (this playbook produces the data the gate measures), `SOFT_PILOT_GC_RESEARCH_2026-05-04.md` (which GCs we're targeting), `IRIS_TELEMETRY_SPEC` (instrumentation that captures pilot signal).

---

## TL;DR

Two GCs in conversation: **Nexus Companies (Dallas) — primary, Walker has an in via Brad Cameron, P.E., S.E., Technical Director** — and **Carleton Companies (Dallas, multifamily LIHTC) — backup**. Both are Dallas-based, light on existing tech adoption, ICP-fit. Pilot is 14 days in mid-June, 2 PMs + 2 supers + 1 project. Walker is on the slab Day 1 in person.

The playbook covers: recruit script, pilot agreement, data isolation (ADR-006), onboarding day-of, daily 5:30 PM standup format, the rule for "ship a fix overnight," exit criteria for pivot-to-backup, and the post-pilot debrief.

---

## ADR-006 — Pilot Data Isolation

**Decision:** **Row-level multi-tenancy in the existing production Supabase project, with a dedicated `is_soft_pilot=TRUE` flag on the org and stronger RLS predicates that key off it.** NOT a separate Supabase project.

### Options considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Separate Supabase project | Hard wall. Pilot data physically isolated. No accidental cross-pollination. | We have to maintain two of everything: migrations, edge fns, monitoring, Stripe. Releases to one require duplicate releases to the other. New columns drift. The pilot becomes its own product. | Rejected |
| Schema-per-tenant in same DB | Cleaner than mixed tables. Migrations apply once, run per schema. | Postgres `search_path` machinery is fragile. Triggers don't compose cleanly across schemas. RLS is harder. | Rejected |
| **Row-level + `is_soft_pilot` flag (chosen)** | One codebase. One migration set. One observability stack. RLS already in place. Telemetry naturally aggregates. The pilot org is just an org with a flag. | Requires discipline that nothing leaks across orgs by default — which is exactly what RLS already gives us. | **Chosen.** |

### Migration

```sql
-- Migration: 20260504050000_soft_pilot_org_flag.sql
ALTER TABLE organizations
  ADD COLUMN is_soft_pilot BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN pilot_started_at TIMESTAMPTZ,
  ADD COLUMN pilot_agreement_id UUID;  -- references pilot_agreements

CREATE TABLE pilot_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  signed_by_name TEXT NOT NULL,
  signed_by_email TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL,
  agreement_text_version TEXT NOT NULL,  -- pin the agreement text used
  agreement_pdf_url TEXT,                -- archived copy
  pilot_user_ids UUID[] NOT NULL,        -- the 2 PMs + 2 supers
  data_handling_consent JSONB NOT NULL,  -- record what they consented to
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper: identify pilot users for the gate query, telemetry policies, etc.
CREATE OR REPLACE FUNCTION is_pilot_user(p_user_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
      FROM organizations o
      JOIN pilot_agreements pa ON pa.id = o.pilot_agreement_id
      WHERE o.is_soft_pilot = TRUE
        AND p_user_id = ANY(pa.pilot_user_ids)
  );
$$;
```

### What the flag changes operationally

| Surface | Behavior when `is_soft_pilot=TRUE` |
|---|---|
| `scheduled-insights-worker` | Only fans out to pilot orgs in Lap 2 |
| `lap_2_gate_metrics_daily` | Filters to the pilot org |
| Iris voice diff logging | Always on |
| Audit chain verification | Hourly instead of daily |
| Analytics dashboards | Walker's "pilot health" tab pulls from this flag |
| Cost reporting | Pilot AI spend isolated for the receipt |
| Support tier | Implicit P0 — Walker is on the slab |

### Data-handling commitments

For the pilot org, additional commitments encoded in the agreement (Phase 3 below):

- All Iris drafts retained 24 months minimum (vs. the 12-month default elsewhere) for retroactive analysis
- Pilot users may export their data in CSV at any time via Walker
- Right-to-erasure: as in `IRIS_TELEMETRY_SPEC`, erasure removes `viewer_user_id` references but preserves chain integrity
- No cross-tenant data exposure: standard RLS, but with explicit assertion in the pilot agreement

---

## Phase 1 — Recruit (Days now through Day 49)

### Lead candidate: Nexus Companies (Dallas)

**Brad Cameron, P.E., S.E., LEED AP BD+C** · Technical Director · 206.349.8876 · 3500 Maple Ave Suite 350, Dallas TX 75219

Walker has the in. The recruit ask:

> "Brad — quick favor. I'm 30 days into a 90-day push to ship something I think will reset how PMs and supers work. It's an AI that drafts the boring half of the job — RFI follow-ups, daily logs, pay-app prep — and the human approves before anything ships. The whole product is built around an audit chain that's deposition-grade by construction. I want to put it in front of two of your PMs and two of your supers on one project for two weeks in mid-June. I'll be on the slab Day 1. Nothing leaves your environment that you don't approve. After two weeks if your team says it changed how they work, we go from there. If they don't, no harm done — but I have to know either way before I can ship to other GCs. Twenty minutes Tuesday to walk through the demo?"

The pitch leverages:
- His engineering credentials → audit-chain framing
- His role (Technical Director, not PM) → he's a sponsor, not a user; he picks the project + people
- Walker's existing relationship → no cold-call discount
- "Nothing leaves your environment you don't approve" → addresses the data-control concern directly
- Hard end ("two weeks") → low commitment ask

### Backup candidate: Carleton Companies (Dallas)

**Printice L. Gary** · Managing Partner · founded 1991 · multifamily LIHTC affordable housing · Dallas

Walker doesn't have a personal in here per current notes. Recruit path: warm intro via mutual contact (target: Texas multifamily developer network or LIHTC consultant). If no warm intro available by **Day 38**, Carleton drops as backup and Walker recruits another candidate (the playbook should always have 2-deep).

The pitch for Carleton differs:
- Less audit-chain (Brad-specific), more "I built this because I watched my last GC waste 12 hours a week on RFI follow-ups"
- Multifamily LIHTC angle: deposition-grade audit chain is *especially* valuable when state housing authorities subpoena your project records
- Smaller commitment ask: 1 PM + 1 super (Carleton is smaller; matching the team size to their scale)

### Other backup candidates to research if Carleton drops

- **A Texas commercial GC Walker has worked under** (he's ex-GC; one of his old employers)
- **A multifamily developer–GC duo** (his network)
- **A regional GC in his Procore-implementation past life** (find from old contacts)

### Recruit timeline

| Day from today | Target |
|---|---|
| Today (May 4) | Initial text/call to Brad. Schedule the 20-min demo. |
| May 5–6 | Demo with Brad. Get verbal yes/maybe. |
| May 7 | If yes from Brad → start Carleton intro hunt (still need backup). If no from Brad → call backup intro hunt for both slots. |
| May 8 | Brad nominates the 2 PMs + 2 supers + 1 project. |
| May 11 | Pilot agreement draft delivered to Brad's general counsel. |
| May 18 | Pilot agreement signed. Pilot kickoff date locked. |
| Day 49 (~May 29) | Final pre-pilot check-in with Brad's team. Calendar holds. |
| Day 50 (~May 30) | Walker on the slab. |
| Day 60 (~Jun 9) | Acceptance gate. |

**Two date options for pilot kickoff** based on Brad's availability:

- **Tight (preferred):** Day 50 = May 30, gate close June 9. 23 days of slack before the Reverse-Engineered hard date of July 2. This is the original 90-day-plan calendar adjusted for the 7-day pre-flight.
- **Loose (if Brad needs more notice):** Day 50 = June 12, gate close July 2. Aligns to the Reverse-Engineered Milestones T-320 / T-300 dates exactly. Zero slack — any pilot extension blows the hard date.

Default to tight. Slip to loose only if Brad explicitly asks. Don't pre-volunteer the looser option.

**Hard deadline:** Verbal commit from primary GC by **May 11** (Day 7 of pre-flight). After May 11, every day of delay risks the pilot start. Below 19 days from verbal-commit-to-pilot-start (the tight calendar), the recruit cycle is too short and you slip to the loose calendar automatically.

---

## Phase 2 — The pilot agreement

### Document structure (1 page, plain English)

```
SiteSync Soft Pilot Agreement — [GC Name]
Pilot start: [date]
Pilot end: [date + 14 days]
Pilot users (the 4): [name, email, role × 4]
Project: [project name + address]

What [GC] gets:
1. Free use of SiteSync + Iris on the pilot project for 14 days.
2. Walker on-site Day 1 + virtually available 24/7 during pilot.
3. A daily 5:30 PM standup call with the pilot team. Bugs reported by 5:30
   PM are fixed by 8 AM the next day or escalated to you in writing.
4. Full export of all pilot data in CSV at pilot end (or any time on
   request).
5. Decision-grade audit chain on every action — exportable as PDF.

What [GC] commits:
1. The 4 named users use SiteSync for their day-to-day work on the pilot
   project for 14 days. (NOT in addition to existing tools — instead of.)
2. Daily 5:30 PM standup attendance (15 min, can be phone).
3. Honest feedback. Including the moments where Iris is wrong.
4. One named PM to make the final stay-or-go call at Day 14.

What we ask permission to record:
- Every Iris draft created, edited, approved, or rejected (always
  attributed; never anonymized within the chain).
- Time-to-decide telemetry per draft.
- Decision method (keyboard shortcut vs. mouse vs. voice).
- Citation click-through.
- One representative aggregate quote may appear in a future case study,
  WITH [GC]'s explicit written approval. No quote, ever, without that
  approval.

What stays inside [GC]'s environment forever:
- Your project documents (drawings, RFIs, daily logs, pay apps, photos).
- Your contract details. Your pricing. Your sub list.
- Anything you mark confidential in the UI (a redact action exists).

Right to walk:
- Either party may end the pilot at any time with 24h notice. Data export
  delivered within 48h of termination. No refund/payment owed by either
  party.

Limitation of liability:
- During pilot, SiteSync's total liability is capped at the cost of [GC]'s
  internal time spent on the pilot, not to exceed $10,000.
- Iris drafts are drafts. Every action is approved by a human. SiteSync
  is not liable for actions [GC] approved that turn out wrong.

Signed by: ____________________ (you)
Date: __________

Signed by: ____________________ (Walker, SiteSync)
Date: __________
```

The pilot agreement is NOT a SaaS contract. It's a shared statement of what we're doing for two weeks. Brad's general counsel reviews; if they want to mark it up into a 12-page MSA, that's a flag that the pilot isn't going to start on time — escalate to backup GC.

### File structure

`docs/audits/pilot-agreement-template-v1.md` (text version, the source of truth) plus a PDF generated from it. Each signed pilot agreement archived in `docs/audits/pilot-agreements/<gc-slug>-<date>.pdf` and the path stored in `pilot_agreements.agreement_pdf_url`.

---

## Phase 3 — Onboarding (Day 50, in person)

### The day-of script

**8:00 AM** — Arrive on-site. Coffee for the team. Set up in trailer with screen-shareable iPad + laptop.

**8:30 AM** — 30-minute kickoff with all 4 users + Brad:
- "Here's what we're trying to learn in two weeks: does Iris save you time and does it earn your trust. Not 'do you like the product' — those two specific things."
- "I'm here as the engineer, not the salesman. If something is broken, you tell me, I fix it. If it's just wrong, you tell me, I tune the model."
- "Daily standup at 5:30 PM, 15 min, on the phone. Standard agenda: yesterday's drafts, today's frictions, anything that surprised you."
- Walk-through of the inbox + approval gate + voice + citations on Brad's existing project data (pre-imported the night before — see Day 49 prep).

**9:30 AM** — Per-user 1:1s, 20 min each:
- PM #1: their actual workflow, what they did yesterday, what they want help with first
- PM #2: same
- Super #1: walk the field. Open the app on their phone in the field. Do they trust it on a glove?
- Super #2: same

**1:00 PM** — Reconvene. Live demo: Walker plants an aged RFI in the seed; the cron fires (manually triggered for the demo); the inbox shows a draft. PM #1 reviews + approves. The audit chain row is shown live in the UI.

**3:00 PM** — Each user does their first 3 real drafts unassisted. Walker watches over shoulder. Records what trips them up.

**5:30 PM** — First standup. Capture Day 1 frictions. Walker drafts the overnight fix list.

**6:30 PM** — Walker leaves the slab. Drives home (Dallas → wherever). Spends evening shipping the overnight fix list.

### The Day 49 prep checklist (the night before)

- [ ] Pilot org provisioned with `is_soft_pilot=TRUE`
- [ ] 4 pilot users provisioned, RBAC set, magic-link email sent
- [ ] Pilot project created; Brad's choice of real project's drawings + RFI history imported (from Procore or wherever they live today)
- [ ] `scheduled-insights-worker` smoke-tested against the pilot project — assert it produces expected drafts on a synthetic seed
- [ ] Voice flag enabled, Linter active
- [ ] `#pilot-quotes` Slack channel created with Walker as sole member
- [ ] `lap_2_gate_metrics_daily` view sanity-queried; baseline numbers (zeros) recorded
- [ ] Walker's phone has site-shareable hotspot tested
- [ ] Walker's iPad has SiteSync installed in production mode + a pre-rehearsed 12-second demo loop
- [ ] Walker's laptop has dev-tools and the production deploy runner (because the overnight fix is going to ship at 9 PM Day 1)

---

## Phase 4 — The 14-day rhythm

### Daily 5:30 PM standup (15 min, by phone)

**Standard agenda (every day):**

| Slot | Owner | Question |
|---|---|---|
| 0:00–2:00 | Each user, in turn | "How many drafts did you decide today? How many approve / reject / edit-then-approve?" |
| 2:00–6:00 | Each user, in turn | "What was the worst draft Iris produced today?" (specific, not vibes) |
| 6:00–10:00 | Each user, in turn | "What's one thing that should be different by tomorrow morning?" |
| 10:00–13:00 | Walker | Read back the fix list. Confirm priority. State commit time for each. |
| 13:00–15:00 | Open | Anything else (pilot logistics, meetings, weather, etc.) |

**Walker's notes file:** `docs/audits/pilot-standups/<date>.md`. One per day, committed end-of-call, public for transparency to Brad. Each note includes:

```markdown
# Pilot Standup Day N (date)
Attendees: [who joined]
Drafts decided today: PM1 X, PM2 Y, Sup1 Z, Sup2 W
Worst-draft examples: <verbatim quotes from users>
Fix list with commit times:
  - [ ] Fix #1 — by 8 AM tomorrow
  - [ ] Fix #2 — by 10 AM tomorrow
  - [ ] Fix #3 — by EOD Wednesday
Quotes captured for #pilot-quotes:
  - <if any unprompted "I don't want to go back" signal landed today>
Walker's read on momentum: <green / yellow / red>
```

### The "ship a fix overnight" rule

A bug or pain reported by 5:30 PM ships by 8 AM the next morning, OR Walker sends a written note to Brad by 7 AM the next morning explaining (a) what's blocking, (b) when it WILL ship, (c) what mitigation the user does in the meantime.

Hard rule: **never go silent on a reported issue.** The pilot trust is built on this single discipline. Lap 1 was internal — silent failures were OK. Lap 2 is external — silence kills.

### Mid-pilot retro (Day 56 = pilot Day 7, FRIDAY)

A 30-min call with Walker + the named PM (the one who'll make the stay-or-go call). One question:

> "If today were the last day of the pilot, would you keep using it? Yes / No / Tell me what would have to be true."

If "No" without a clear "if X were true": **escalate to exit-criteria review**. The pilot may be salvageable; it may not. Walker decides whether to push to Day 14 or pull the plug.

If "Yes": ride to Day 14.

If "If X were true": ship X by Day 10 if humanly possible. Re-ask Day 12.

---

## Phase 5 — Exit criteria

### When to stop the pilot early

The pilot ends early if any of:

1. **Audit-chain integrity breaks.** `verify_audit_chain('pilot')` returns false. STOP. Triage. Do not ship to second pilot until root-caused.
2. **A pilot user explicitly asks to stop.** Honor immediately. Day-end debrief, then end.
3. **Walker observes a draft causing real-world harm.** (Iris drafts a pay app with a duplicated line item; PM approves; sub gets overpaid; week of reconciliation work.) STOP. Refund any sub damages out of pocket if needed; this is reputational protection.
4. **5:30 PM standup attendance drops below 75% for 3 consecutive days.** The pilot is dead in their minds; ours is the last to know. Make the call ourselves.
5. **Mid-pilot retro Day 7 is "No" with no path to Yes.** End at Day 7, not Day 14. Save 7 days of execution for a backup-GC pilot. (This is the hardest rule to follow — sunk cost will scream — but the math is right.)

### When to extend past Day 14

Two cases only:

1. **Gate metric 1 (count) is at 80–99 with strong trajectory.** Extend to 21 days to clear 100. Communicate explicitly to Brad, get re-signoff.
2. **Gate metric 5 (qualitative quote) hasn't landed but Walker reads the room as "they're getting there."** Extend 7 days. Maximum 1 extension.

Otherwise: **don't extend.** Lap 3 starts on schedule.

---

## Phase 6 — Post-pilot debrief (Day 60 / Day 14 of pilot)

### The morning of Day 60

8 AM call with named PM:
- "Walking through the four numbers." (count, rate, latency, incidents — the gate spec)
- "Walking through the qualitative." (Read back the captured quotes; ask if they consent to specific ones being case-study material)
- "Walking through what's next." (Are they signing for Lap 3? At what price? With what conditions?)

### The afternoon of Day 60

4-hour block — Walker writes the Day 60 receipt:

`docs/audits/DAY_60_PILOT_RECEIPT_<date>.md`. Format mirrors `DAY_30_LAP_1_ACCEPTANCE_RECEIPT_2026-05-04.md`:
- Header with gate-pass status (5 gates, 5 verdicts)
- Final measured numbers
- What changed mid-pilot and why
- File-by-file changelog of overnight ships
- Quotes captured (with consent flags)
- What's deferred to Lap 3
- What this pilot taught us about the next pilot

### Update tracker + INDEX

- Tracker row 60 (Day 89 of 90) → Status `✓` or `partial` or `✗`
- INDEX.md → add the receipt
- ADR if any architectural decision was forced mid-pilot
- A new spec for Lap 3 if the pilot revealed a gap (likely scenario)

---

## Phase 7 — What this playbook does NOT solve

### Things that require Walker's time, not specs

- *Recruiting backup #2 if Carleton drops.* No spec can replace Walker's network rolodex.
- *The actual product feeling right on the slab.* Specs say what to build; Walker watching a super struggle says what to fix.
- *Real legal review by Brad's general counsel.* The pilot agreement template above is what you'd hand them, not a substitute for their review.

### Things deferred to Lap 3

- Pricing (Day 80 in the tracker — different conversation)
- Multi-pilot orchestration (when GC #2 + GC #3 + GC #4 run simultaneously, the playbook needs a fan-out version)
- Self-serve pilot onboarding (Lap 2 is in-person; Lap 3 may be remote)
- Pilot → paid contract handoff (Lap 3, Days 82–87 in tracker)

### Things deferred to ADRs

- ADR-007 (auto-withdraw policy) — separate spec; references this playbook for pilot-period enforcement
- ADR-008 (telemetry retention/privacy) — drafted alongside `IRIS_TELEMETRY_SPEC`; signed off as part of pilot agreement signing

---

## File-by-file changelog

| Path | Change |
|---|---|
| `supabase/migrations/20260504050000_soft_pilot_org_flag.sql` | NEW — flag + agreement table + helper fn |
| `docs/audits/pilot-agreement-template-v1.md` | NEW — agreement source-of-truth |
| `docs/audits/pilot-agreements/.gitkeep` | NEW — folder for signed pilot agreements |
| `docs/audits/pilot-standups/.gitkeep` | NEW — folder for daily standup notes |
| `scripts/provision-pilot-org.ts` | NEW — Day 49 prep automation: org + users + flag + project import |
| `scripts/seed-pilot-project.ts` | NEW — import Brad's existing project state into the pilot org |
| `e2e/pilot-smoke.spec.ts` | NEW — pilot-org-specific smoke tests |
| `docs/audits/INDEX.md` | EDIT — add this playbook + the agreement template + ADR-006 |

---

## Acceptance criteria for this playbook to be considered "shipped" (the spec, not the pilot itself)

1. ADR-006 committed
2. Migration applied to staging
3. Agreement template reviewed by Walker; sentence-by-sentence pass
4. Recruit script for Brad rehearsed (Walker says it out loud once)
5. Provisioning script tested end-to-end against a fake org
6. Standup template + format documented
7. Exit criteria committed
8. Day 49 prep checklist printed and posted somewhere physical (sticky note above the laptop is fine)

---

## What success looks like, viscerally

It's mid-June. Walker is on a folding chair next to a stack of rebar in 95° heat. Brad's super is on his phone in the next trailer. He approves a daily-log draft that already includes the trade hours from check-ins, the photo from the safety walk Brad's super did at 2 PM, and the weather. He looks at Walker through the trailer window and gives a thumbs up, no words.

Two days later, the named PM Slacks Walker at 6 PM:

> "I asked the super to file the 5/12 daily log. He said it's already filed. I checked. It is. With photos. With the weather. With manpower. He just had to read it and tap approve. We're never going back to typing those out."

That message goes in `#pilot-quotes`. With consent, into the case study. With a date and a witness. That's Gate 5.

That's the moment Lap 2 is real.

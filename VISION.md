# VISION.md — SiteSync PM

> Internal pitch document. One page. Read once a quarter.
>
> **Last updated:** 2026-04-27

---

## The one line

> Procore sells you a place to file your project. SiteSync runs your project for you, with you in the loop. Same price, 100x the leverage. The GC who switches cuts a project executive line item, gets a better audit trail, and never goes back.

If that line doesn't make the room go quiet, the vision needs sharpening. If it does, we ship to it.

---

## The category reframe

Procore won the last decade as **the system of record**. They sell "everything in one place." That's a filing-cabinet pitch.

The next decade belongs to **the system of intelligence** — software that does the work, not just records it.

SiteSync is **the AI superintendent every project hires.** That single reframe changes everything downstream:

- Pricing is per-project, not per-seat. Like a real super.
- Demos aren't feature tours. They're "watch what it does in 5 minutes."
- The KPI isn't "logins per week." It's "decisions made by AI vs. by humans on this project."
- The competitor isn't Procore — it's the GC's project executive's salary.

Once SiteSync is "the AI super," every tactical question has a clear answer.

---

## The one feature that decides everything

**Iris that ACTS, not chats.** Every other PM tool is shipping a Q&A copilot this year. The 10x move: Iris does the work itself, with audit trail.

By demo day:

- Iris watches the project state (RFIs, drawings, schedule, photos, daily logs).
- When it sees something that needs action, it **drafts** the action and asks for approval. *"Electrical drawing E-2 conflicts with mechanical M-4 at column line 7. I drafted RFI-048 to ask the architect. Send?"*
- One click → Iris sends the RFI, watches for the response, reminds the architect at day 3, escalates at day 7.
- Iris generates the pay-app draft from approved change orders + completion %. The PM reviews, signs, sends.
- Iris writes the daily log from the day's photos + crew check-ins + weather + GPS. The super edits 10%, signs.

This is the demo moment that ends the conversation:

> Procore made my super faster. SiteSync did my super's job.

Procore can't ship this in 12 months — their architecture is form-fields-and-tables, not action-graphs. We can.

---

## The data compound

Every project run on SiteSync makes the next project better. This is the moat that takes 5+ years to build, but starts compounding from day one.

Three things to capture by default, today:

- **The drawing-to-RFI graph.** Every RFI is linked to coordinates on a specific drawing. After 100 projects, the AI knows: *"MEP coordination at column-line crossings generates 3-5x more RFIs than you'd budget. Add 2 weeks of float."*
- **The change-order pattern.** Every CO has a cost-code, a cause, and a stage. After 100 projects: *"Owner-driven scope changes after schematic design average $X/sqft for healthcare projects. Budget that into your contingency math."*
- **The schedule-recovery playbook.** Every time a project gets back on schedule, capture *how*. Resequencing? Crew add? Critical-path swap? After 100 projects: *"Three projects with similar slips recovered by parallelizing trades A and B. Want me to draft a resequence?"*

The killer feature in year 2: **"Build a budget for a 60,000 sqft Class-A office in Austin."** SiteSync drafts a budget from 47 similar projects in its history, with confidence intervals.

Procore has the data. They don't have the structure to mine it.

---

## The distribution wedge

Two real options, ranked:

### A. The superintendent app, given away free
Free for the field. Daily logs, photos, punch list. Mid-management adopts bottom-up. The GC's PE eventually sees the data and realizes they're already on SiteSync without paying. Slack did this with chat. Figma did this with files. Linear did this with issues.

### B. The Procore migration tool
One-shot import (already shipped — PR #211). Make it 10x better. *"Drop your Procore export, get your SiteSync project in 30 seconds. Run side-by-side for 30 days, free, see what's different."* Switching cost → zero. Win the bake-off.

Both can run in parallel. (A) seeds the user base in 1-3 years. (B) wins enterprise deals in 1-3 quarters.

**Decision needed this week:** which one is *primary*? Pick one — a 3-person team can't do both well in parallel.

---

## The unbreakable moat

Things to build *now* that Procore literally cannot copy because of architecture or org:

- **Open API + webhooks.** First-class, documented, with SDKs. Once a GC integrates SiteSync with Sage / QuickBooks / their data warehouse, switching cost becomes infinite. Procore's API is famously hostile.
- **Per-project data ownership.** *"Your data lives in your Supabase project. Export anytime. Audit log forever."* This terrifies enterprise procurement. Make it the default. Procore can't say this.
- **Audit log as a product.** Every mutation already audited. Make it queryable, exportable as PDF, time-machine-replayable. *"Show me everything that happened on RFI-047 in the 72 hours before it was closed"* → one keystroke. This is what gets a GC out of a lawsuit. Procore makes this a $30K/year add-on.
- **Configurable state machines.** Every workflow already runs on XState. Expose it. *"Some GCs need 2 reviewers on a submittal. Others need 4. Configure per-project."* Procore hardcodes one workflow.

---

## The product-market-fit signal

Sean Ellis's 40% test is wrong for B2B construction. The real signal:

> A superintendent — gloves dirty, on the slab, no time — opens SiteSync 3+ times per shift without being told to.

Track it. **8+ field-app sessions per super per day, within 30 days of onboarding** = PMF. The PM/PE adoption is downstream of field adoption. We saw this with Procore vs. paper.

Optimize the 1-handed gloved-thumbs experience above everything else.

---

## Kill criteria — quarterly board check

Three signals to pivot or fold this thesis:

1. **Iris drift > 20%** after 6 months of training. If Iris's drafts get rewritten more than 1-in-5 times, "AI super" is marketing not product. Cut to a chat-only copilot.
2. **GCs refuse per-project pricing.** If 4 enterprise GCs walk because "we pay per-seat for everything," capitulate to per-seat and rethink the moat.
3. **Field super DAU/WAU < 60%** after onboarding. If the field doesn't show up, the data flywheel never starts and we're back to selling a filing cabinet.

Set tripwires. Honor them.

---

## The 18-month roadmap

| Quarter | Focus | Outcome |
|---------|-------|---------|
| Q2 2026 | Demo to ship | 6-step demo flow under latency budget, real seed data, April 15 demo lands |
| Q3 2026 | Iris that acts (v1) | Drafts RFIs, pay apps, daily logs. Approval-gated. First 10 pilot GCs |
| Q4 2026 | Field super app | 5-tab IA, voice-first daily log, photo-driven RFI, free for the field |
| Q1 2027 | Open API + audit log as product | SDK, public docs, first Sage/QuickBooks integration. First $150K+ ACV |
| Q2 2027 | Data compound starts | Project comparables, drawing-to-RFI graphs, schedule-recovery playbook |
| Q3 2027 | Procore migration moment | Automated import + 30-day bake-off. Goal: 50 GCs migrated, $5M ARR run-rate |

See `ROADMAP.md` for the detailed sequencing.

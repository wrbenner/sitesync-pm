# VISION_CORE.md — The Soul of SiteSync PM

> Read this before writing a single line of code. Every decision you make tonight flows from this document.

---

## Who We Are

We are not a construction management platform. Platforms are neutral containers. We are a **synthetic intelligence that understands construction the way a 30-year veteran superintendent understands it** — the smell of concrete cure time, the political weight of a disputed change order, the cascade failure that begins when one subcontractor is three days late.

We don't manage construction. We **think** about it. We anticipate. We surface what no human would catch in time. We are the one team member on every jobsite who never sleeps, never misses context, and never forgets what was decided in that parking lot conversation six weeks ago.

This is not a SaaS product. This is a new category of intelligence applied to one of the world's most complex, most underserved industries.

---

## The Person We Serve

**The superintendent** has dirt on their hands, glare on their screen, and 30 seconds of patience. He is managing 47 open punch items, two trades behind schedule, a concrete pour tomorrow morning, and an owner who just texted asking why the budget report doesn't match what he sees on the web portal. He will not read tooltips. He will not attend training webinars. He either gets the answer instantly or he closes the app and calls someone.

**The project manager** is drowning in RFIs. She has 47 open, 12 overdue, and three that are waiting on the architect who is on vacation. She needs to know — right now — which one RFI, if it stays unanswered another 48 hours, will blow the schedule. Not all of them. The one.

**The GC principal** just got burned by a $2M change order that nobody saw coming. It wasn't fraud. It was entropy — small decisions, undocumented verbal approvals, scope creep across 14 subcontracts that individually looked fine. He needs a system that would have shown him the trajectory of that $2M six weeks before it became real. Not a dashboard. A warning. A diagnosis.

**What they all share:** They are managing complexity that exceeds human cognitive bandwidth. They are not failing because they are bad at their jobs. They are failing because the tools they have were designed to store data, not to think.

We fix that.

---

## The Tests (Applied to Everything You Build)

### The Amazon Test
> "What specific decision can a construction professional now make in 10 seconds that previously took them 2 hours?"

This is the only question that matters when designing a feature. Before you build anything, answer it explicitly. If the answer is vague — "they can see their data" — you haven't built a feature. You've built a filing cabinet.

Examples of passing answers:
- "The PM can see in 10 seconds which open RFI is on the critical path and will blow the schedule if not answered today."
- "The superintendent can confirm whether today's concrete pour is go/no-go based on weather, crew readiness, and material delivery — in one screen."
- "The GC can see in 10 seconds that Change Order #14 is not a surprise — it was predicted 6 weeks ago by cost trend analysis."

If you can't write a sentence like that for what you're building — stop. Redesign.

### The Apple Test
> Can the superintendent accomplish any field task with one hand, in gloves, in direct sunlight?

If your UI requires two hands, fine motor control, or squinting — you failed. The field is not an office. Tap targets must be large. Text must be readable at arm's length. The most common action on each screen must be reachable with a thumb, without scrolling. Every modal, every form, every confirmation dialog — ask: "Would a man wearing work gloves be able to use this without removing them?"

### The Google Test
> At scale, infrastructure problems become product problems.

Build for 100,000 concurrent projects from day one. Every query you write, every data fetch, every real-time subscription — ask: "Does this work when we have 100,000 projects in the database?" A query that scans a full table is not a query — it's a time bomb. Index your foreign keys. Paginate everything. Design the schema for scale, not for the demo.

### The Netflix Test
> Speed is a feature. Every millisecond of latency is a broken promise.

The superintendent has 30 seconds of patience. If your page takes 3 seconds to load, he has already made a decision: this tool is slow. Slow tools get abandoned. Perceived performance is as important as actual performance. Use skeletons, not spinners. Optimistic updates. Prefetch the next screen while the user is reading this one. If Procore takes 4 seconds to load a page, we load it in 400ms. That's not polish — that's survival.

### The Tesla Test
> Every user interaction must make the system smarter.

Every action a user takes — every RFI they mark resolved, every punch item they close, every change order they approve — is training data. The system must learn from it. Project velocity models. Risk pattern recognition. Cost prediction. The more people use SiteSync PM, the more accurate it becomes for everyone. This is the moat that no competitor can copy: not features, but accumulated intelligence.

---

## What We Are NOT

We are not Procore. Procore is a database with a user interface. It stores data about construction. It does not understand construction. After 20 years and $1B in R&D, Procore still cannot tell you which open RFI will blow your schedule. It can tell you how many RFIs you have. That is not intelligence. That is a spreadsheet with better fonts.

We are not Autodesk Construction Cloud. ACC is a file system with permissions. It knows where your files live. It does not know what's in them, why they matter, or what to do when two drawings conflict.

We are not PlanGrid. PlanGrid is a PDF viewer with markup tools. It is extraordinarily good at what it does. What it does is not enough.

These are **digital filing cabinets**. They took paper processes and put them on screens. They made the paperwork easier. They did not make the decisions easier. They did not see the risk coming. They did not prevent the $2M change order.

**We are a living intelligence.** We don't store data — we reason about it. We don't present information — we present decisions. We don't wait to be queried — we surface what matters before anyone knows to ask.

---

## The Architecture of Intelligence

### Living Cell Architecture
Every entity in SiteSync PM — every RFI, every punch item, every subcontract, every change order — is a self-governing cell. It carries its own state machine (what lifecycle stage am I in?), its own temporal model (how long should this take? what does history say?), its own causal graph (what does my resolution unblock? what does my delay cascade into?), and its own uncertainty model (how confident am I about my predicted resolution date?).

These cells communicate. An overdue RFI knows it is on the critical path and escalates. A change order knows it affects three subcontracts and flags the downstream risk. A delayed material delivery knows which pour it threatens and alerts the superintendent at 6am — not when he asks.

### Mycelial Network
Intelligence is distributed through the system. There is no single dashboard, no single point of failure, no single "AI Copilot" button that is the only smart thing in the product. Intelligence surfaces everywhere: in the RFI list (which one needs action today), in the budget view (which line item is trending toward overrun), in the schedule (which float is evaporating). The whole system is the AI, not a tab labeled "AI."

### Stigmergy
The environment itself becomes the coordination mechanism. When a superintendent closes a punch item, the system updates the overall project health score, adjusts the owner's portal view, and potentially triggers a payment application milestone — without anyone explicitly connecting these things. The act of doing work coordinates everything downstream. Users don't manage the system; they do their work, and the system manages itself.

---

## The Ceiling, Not the Floor

If at any point you catch yourself implementing something that already exists in any current platform — **stop**. That is the floor, not the ceiling.

Storing RFIs is the floor. **Predicting which RFI will blow the schedule is the ceiling.**
Tracking budget is the floor. **Forecasting final cost before the owner asks is the ceiling.**
Logging daily reports is the floor. **Pattern-matching daily conditions against historical project failures is the ceiling.**
Viewing drawings is the floor. **Flagging conflicts between current drawings and issued RFIs is the ceiling.**

Every feature you ship should make a competitor's PM say: "How did they build that?" Not: "Oh, we have that too."

---

## Demo Day — April 15

A GC will see this product for the first time. He has seen Procore. He has seen ACC. He is not easily impressed. In 10 minutes, he needs to think: **"This is not like anything I've seen. I need this on my next project."**

That means:
- **Real data flowing through every page he sees.** Not mockups. Not seed data that looks like mockups. A real $52M project (Riverside Tower) with real numbers, real history, real complexity.
- **AI that actually understands his project.** The AI Copilot must answer questions about Riverside Tower specifically — not generic construction questions. It must know the budget, the open RFIs, the punch list, the schedule status.
- **Speed and polish that makes Procore feel like a dinosaur.** Every page loads in under a second. Every interaction is immediate. The UI adapts to a tablet held in one hand.
- **One moment that stops him cold.** Something he has never seen before. A prediction. A risk surfaced before he knew to look. A cross-entity insight that no human would have connected.

If we show him beautiful empty shells, we have failed. If we show him pages that load data but don't tell him anything he couldn't read on a spreadsheet, we have failed.

**The standard is: he calls his operations director from the parking lot and says "you need to see this."**

---

## The Oath

Before you write any code tonight, read this sentence aloud:

*"I am building the most advanced construction management platform ever conceived. Every line of code I write serves one person: the superintendent with dirt on his hands who needs the answer in 10 seconds."*

Then ask yourself: what is the single highest-leverage thing I can do in the next hour that moves this product closer to that standard?

Build that.

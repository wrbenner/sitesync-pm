# SiteSync PM — The Product Vision

### The Defining Document

*Written for the team that builds the platform, the investors who fund it, and the construction professionals who will use it every day.*

*Founded by Walker Benner — General Contractor, Engineering Technician at ILDoT, AI Builder.*

---

> "The people who build the physical world deserve tools as thoughtful as the tools built for people who sit at desks."

---

## Table of Contents

1. [Part 1: The Problem Nobody Has Solved](#part-1-the-problem-nobody-has-solved)
2. [Part 2: Why Every Existing Solution Fails](#part-2-why-every-existing-solution-fails)
3. [Part 3: The SiteSync Philosophy](#part-3-the-sitesync-philosophy)
4. [Part 4: The 5 Moments That Change Everything](#part-4-the-5-moments-that-change-everything)
5. [Part 5: The Design DNA](#part-5-the-design-dna)
6. [Part 6: The Technical Architecture That Enables This](#part-6-the-technical-architecture-that-enables-this)
7. [Part 7: The Roadmap](#part-7-the-roadmap-what-gets-built-when)
8. [Part 8: What Makes This Impossible to Copy](#part-8-what-makes-this-impossible-to-copy)
9. [Part 9: The Emotional Core](#part-9-the-emotional-core)

---
---

# Part 1: The Problem Nobody Has Solved

---

## The Morning

A superintendent arrives at the job site at 5:45 AM. The sun isn't up. The gate is locked. The trailer is dark. They have thirty minutes — maybe forty on a good day — before the first trade crew arrives and the chaos begins.

In that window, they need to answer five questions:

1. What is happening today?
2. What is going to go wrong?
3. What did I miss yesterday?
4. What does the inspector need to see?
5. Is the site safe to open?

Right now, in 2025, here is how a superintendent gets this information:

**From their memory.** The superintendent is a walking project database. They know the as-installed condition of every wall, floor, and ceiling — not what the drawings say, what actually happened. They know which sub cut corners, where every utility was actually run, which foreman can be trusted, and the real schedule — the one that exists only in their head, not in Primavera.

**From a paper schedule taped to the trailer wall.** Or maybe a printout of a three-week lookahead that was last updated on Thursday. The project is on Wednesday. Three days of drift, undocumented.

**From 47 unread text messages.** The electrical foreman saying he's short three guys tomorrow. The plumber asking if the corridor is clear. The PM forwarding an email about a submittal that was rejected. The concrete supplier confirming a pour time. All of it on a personal phone, in iMessage, mixed with family photos and fantasy football threads.

**From an email chain they haven't opened.** The architect responded to an RFI at 11 PM last night. The response was "See attached." The attachment is a marked-up PDF that requires downloading, zooming, and cross-referencing against three other sheets. On a phone. In a parking lot. At 5:45 AM.

**And maybe — if their company pays $35,000 to $80,000 per year — from a Procore dashboard** that takes eight seconds to load and shows them a list of overdue RFIs they already knew about, in a table view designed for someone sitting at a desk with a 27-inch monitor, good lighting, and a cup of coffee.

This is not a hypothetical. This is every commercial construction project in America, every morning.

---

## The Scale of the Failure

$1.3 trillion is spent on construction in the United States every year.

35% of all work hours are non-productive. That is not a rounding error. That is $177.5 billion in labor costs burned annually on searching for information, resolving conflicts, and redoing work that was done wrong the first time because someone didn't have the right data at the right moment.

Construction professionals spend 5.5 hours per week looking for project data and information. 4.7 hours per week on conflict resolution. 3.9 hours per week dealing with mistakes and rework. That is 14 hours per week per person — more than a third of a 40-hour week — lost to activities that produce nothing.

48% of all rework on U.S. construction sites is caused by miscommunication and missing project data. Not by incompetent workers. Not by bad materials. By information that existed somewhere but didn't reach the person who needed it, when they needed it.

52% of total project cost growth is caused by rework. Up to 70% of that rework originates from design-induced errors — incomplete or conflicting drawings that push design decisions onto the contractor's time and money.

The daily log — the single most important legal document on a construction project, the document that gets read by lawyers three years later when there's a $2 million dispute — is filled out from memory at 5 PM about things that happened at 7 AM. The typical daily log takes 30 to 60 minutes to write. The output: "Continued work on 2nd floor. Weather clear. 42 workers on site." That is a legal document. That is what gets entered into evidence.

The good version — the version that would actually be defensible — would say: "Acme Framing, 6 workers, completed grids C-F, third floor west, 400 LF of 3-1/2-inch metal studs. Core Concrete, 15 crew, placed 42 CY at second floor slab section C-D. Weather: 42°F at 6 AM, 58°F at noon, clear. Fire marshal inspection at 10:00 AM, passed. Smith Mechanical 2 hours late, arrived 9:00 AM instead of 7:00 AM."

Nobody writes that version from memory at 5 PM after a 10-hour day of managing chaos. And so the most important document on the project is, on most projects, nearly useless.

---

## The Human Reality

### The Superintendent's Day

The superintendent is the person at the center of the storm. They arrive before anyone else — 5:30 to 6:30 AM — and they leave after everyone else. Industry guidance is emphatic: "Arriving early is the foundation of the rest of your morning routine because you're given time and silence to organize what needs to be completed that day without the distraction of loud noises and constant interruptions."

That pre-crew window — thirty to sixty minutes of silence — is the only quiet time they will have for the next ten hours. They use it to review the schedule, check the weather (weather drives everything: concrete pours, crane operations, masonry work, roofing), walk the site looking for overnight problems, and mentally plan the day's coordination.

By 7:00 AM, it's over. Every trade crew arrives simultaneously. The foremen need direction. The super does a morning huddle — walking to each foreman's crew, not the reverse — explaining today's plan, confirming scope, resolving access conflicts. On larger projects, this alone takes 30 to 45 minutes.

From 8:00 AM to noon, there is no such thing as a typical hour. The job is interruption management. Reddit's r/ConstructionManagers captures it: "My phone is always buzzing with calls." And: "Every issue falls on my shoulders."

What the super is actually doing between 8 and noon:
- Walking the site every 60 to 90 minutes in continuous surveillance
- Receiving and staging material deliveries — verifying quantities, directing staging, signing delivery tickets
- Coordinating trade conflicts in real time (most scheduling conflicts surface in the morning when all trades hit the site simultaneously)
- Calling or texting the project manager about issues that need PM-level decisions
- Calling inspectors or checking the building department portal to confirm scheduled inspections
- Responding to foreman questions about scope, sequence, and spec ambiguities
- Monitoring safety conditions continuously — because the super is personally liable for site conditions

The super handles the three pillars of daily operations: **Manpower, Material, Information.** Any disruption to any one of these three stops work. If a sub's crew shows up short three people, work slows or stops. If a material delivery doesn't arrive, work stops. If an RFI isn't answered and work is about to proceed, either work stops or you proceed at risk.

Lunch happens in the construction trailer. The super rarely leaves the site. This is when they catch up on texts, emails, and Procore notifications — the digital world they've been ignoring while managing the physical one.

Afternoons are when the day's decisions start creating consequences. The super is checking progress against plan, making calls to subs who are behind, coordinating late-day deliveries, facilitating afternoon inspections, and resolving disputes between trades about sequencing or space. The most critical moments are around handoffs — what gets completed today that the next trade needs to start tomorrow. If the mechanical sub finishes above-ceiling work and the drywall crew is scheduled to hang board tomorrow, the super needs to know by 2 PM whether that's actually going to happen.

At 3:30 to 4:00 PM, the last crew leaves. The super does a final site walk — locks up gates, checks for hazards, verifies everything is secured.

Then comes the daily log. After a ten-hour day of managing chaos, the superintendent sits down to document what happened. "Most contractors know they should be keeping them but either skip the habit entirely, half-fill a form at the end of the week, or rely on memory when it counts." Two weeks after starting a documentation system, half the crew stops filling them out and the other half writes "same as yesterday" every day.

The daily log takes 30 to 60 minutes. Memory degrades rapidly. What gets written from memory at 5 PM says "framing in progress, second floor" instead of "Acme Framing, 6 workers, completed grids C-F, third floor west, 400 LF of 3-1/2-inch metal studs." The second version is defensible in a dispute. The first is nearly useless.

---

### The Project Manager's Day

The PM is the business interface. The super manages the physical work — who's doing what, where, when, and at what quality standard. The PM manages the contracts, money, schedule, and information — the documents that authorize, record, and get paid for the work.

A PM typically manages multiple projects simultaneously. A superintendent typically manages one project. This is a fundamental difference in cognitive load and context-switching.

The PM's day starts at 6:00 to 7:00 AM with email triage: overnight messages, open RFI items, submittal approvals pending, outstanding correspondence. One PM described it: "I try to arrive before 7:30 AM to check emails and messages in case anything urgent has come up. Then, I set up my day to meet with supervisors, subcontractors, etc. There are always fires to put out."

The administrative core of the PM's day is submittals, RFIs, change orders, and schedule updates. A 20-trade project might have 300 to 500 submittals over its life. The PM tracks who needs to submit what, whether the sub has submitted, whether the architect has reviewed, whether the review was "approved," "approved as noted," or "revise and resubmit," whether the approved material has been ordered, and when it's expected to arrive. Submittal delays are one of the leading causes of procurement delays.

The PM owns the RFI log. They receive field-identified issues from the super, draft RFIs, submit them to the architect, and distribute responses. They manage the "ball in court" — for every open RFI, who is responsible for the next action? A PM juggling 50+ open RFIs needs systematic tracking. Industry best practice: "If you cannot answer those questions in under a minute, your tracking system is not working."

The OAC meeting — Owner-Architect-Contractor — is the PM's most visible performance moment. They present to the owner and architect, which means their materials need to be accurate, their narrative credible, and any bad news packaged with a recovery plan. The PM assembles this presentation by pulling data from multiple systems — schedule from Primavera, RFI log from Procore, budget from accounting, change order log from Excel. This compilation takes hours. Much of the data is stale by the time the meeting happens.

What keeps a PM up at night: an open RFI blocking critical path work, a sub who's behind and not catching up, a change order the owner won't sign, a submittal that's been with the architect for six weeks, a safety incident with legally critical documentation, a monthly pay app being rejected, and a schedule three weeks behind while the owner expects on-time delivery.

"Non-stop thoughts about safety, schedule, and quality of the job, even while at home, chipping away at the individual."

---

### The Subcontractor's Experience

A subcontractor's foreman shows up at 6:30 AM with a crew and needs to start producing immediately. To do that, they need: physical access (gates open, work area accessible), current drawings (not drawings from two revisions ago), confirmed scope, answers to open RFI questions, material on site, and no trade conflicts.

Every one of these can fail. On any given morning on a large commercial project, a sub foreman might arrive and find their work area inaccessible (plumbers are still finishing yesterday's rough-in), their materials weren't delivered (the PM forgot to confirm the delivery window), or they have a question about a detail that the architect hasn't answered yet.

The RFI process from the sub's perspective: Foreman identifies a field condition. Tells their PM. Sub PM writes the RFI and submits to the GC. GC PM reviews, forwards to the architect. Architect takes 7 to 14 days to respond. GC distributes the response. Sub PM transmits to foreman. Total elapsed time: two to three weeks. Meanwhile, the work is either blocked or proceeding at risk.

The fundamental problem, as one Reddit commenter described it: "Design teams/owners are subsidizing design fees with subcontractors' time. They leave gaps, subcontractors review, coordinate, design, then RFI for design team approval."

Then there's the pay application gauntlet. The sub submits monthly. Required documents: notarized lien waiver, updated insurance certificate, current license numbers, sworn statement of labor and material, breakdown by SOV line item with percent complete, and backup for stored materials. Six to eight documents, minimum. A missing document stops payment completely. The average pay cycle runs 30 to 60 days, meaning a sub who did work in early September might not get paid until mid-November.

What subs wish they had: earlier notification of schedule changes, real-time drawing updates with change clouds, faster RFI responses, clear daily access to site sequencing, and payment status visibility.

What makes subs hate using the GC's PM tool: "Procore is prohibitively expensive and, while marketed to specialty contractors, is very clearly geared to the general contractors." The core problem: GC tools are designed for the GC. Subs are required to use them but get minimal value. The GC gets the data; the sub does the data entry.

---

### What's Trapped in People's Heads

Almost none of the most valuable project information lives in a system. It lives in one human brain. The superintendent knows the as-installed condition of every wall, floor, and ceiling. They know which materials were substituted and why. They know where every utility was actually run versus where the drawings say. They know which inspections had issues that got "resolved." They know the specific clauses in every sub's scope that are currently in dispute.

When that superintendent leaves the project — which happens — institutional knowledge walks out the door.

The PM has mental models of which subs are reliable and which aren't. "This mechanical sub has been consistently 2 weeks late on every phase on this project and the last two projects we ran together." This lives in memory. There's no system capturing it. When the same company bids the next project, estimating has no access to this operational data.

The real schedule — the one the super knows — says mechanical rough-in won't be done until November 1. The official schedule says October 15. The gap between the official schedule and reality is enormous and completely undocumented.

The inspector passed the inspection but mentioned, off-record, that they'd be looking more carefully at the next floor's fireproofing. The super files this away mentally. It's not documented anywhere.

---

### What Gets Communicated by Text That Should Be in the System

"Field crews default to texting, while vendors stick to email or calls." One PM described: "He uses iMessage for all comms between clients and subs and says it is a pain in the ass."

The texts that should be in a system:
- "Hey, the electricals for panel EP-3 are gonna be in the south mechanical room, not the north one" — a field coordination decision that affects coordination drawings and future work
- "The concrete pour is pushed to Thursday, weather delay" — a schedule change that affects three other trades
- "Your inspector was here, they want you to add another layer of firestopping in the east corridor" — an inspection result that affects scope and cost
- "We're going to go ahead and proceed on the assumption that the RFI answer is X" — a field decision made without formal authorization

Every one of these texts represents a project event. None of them is in the project record. When a dispute arises 18 months later, these texts exist on someone's personal phone — if the phone hasn't been replaced, if the person still works there, if they can find the right thread.

---

### What This All Adds Up To

This is the problem. Not "we need better project management software." Not "construction needs to go digital." Not "AI will transform the industry."

The problem is this: **the people who build the physical world are served by software designed by people who have never set foot on a job site.**

Software designed for someone sitting at a desk with good lighting, good connectivity, and two hours to spare. Software that assumes the user will navigate six menu levels to log a concrete delay. Software that treats documentation as a data entry task instead of the legal record that determines who pays for a $2 million mistake.

The daily log written from memory at 5 PM. The 24-day cycle from T&M tag to change order request. The 8-document pay app gauntlet. The RFI that takes 9.7 days to get a response while the schedule slips. The 14 hours per week per person burned on non-productive activities. The 48% of rework caused by miscommunication. The $177.5 billion in annual labor costs on non-optimal activities.

This is the problem SiteSync exists to solve.

---
---

# Part 2: Why Every Existing Solution Fails

---

## The Incumbent: Procore

Procore is the Enterprise Oracle of construction. Powerful. Expensive. And nobody loves using it.

Procore is a left-navigation-rail product organized into tool modules: Project Management, Quality & Safety, Construction Financials, and Workforce Management. Each module is a separate tool silo — Drawings, RFIs, Submittals, Daily Logs, Observations, Inspections, Schedule, Budget, Change Events, Commitments, Invoicing. The web interface is largely form-based with table-list views. Almost every action triggers a full page reload. There is no single "dashboard" showing a live project state — you navigate tool by tool.

47 tools. Unlimited users. Deep integrations. And a superintendent on a muddy job site still needs to navigate six menu levels to log that the concrete pour was delayed.

### Procore's Specific Failures

**Performance that disrespects the user's time.** In an era where Linear achieves sub-50ms response times and Superhuman achieves under 100ms, Procore delivers full page reloads on every action. 800 to 3000 milliseconds per navigation. Every click is a wait. For a user who navigates 50 to 100 times per day, that is 40 to 300 seconds of pure waiting — just on page loads.

**Navigation designed for software engineers, not construction professionals.** For experienced users, tool-to-tool navigation is muscle memory. For new users or occasional users (which describes most field staff), the depth of nested menus is disorienting. One Capterra reviewer captured it: the workflow inconsistency is maddening — submittals work differently than observations, which work differently than punch lists. There's no consistent pattern across tools. "I think the workflow should be more similar than not with a universal 'Ball in Court' feature."

**Mobile that's a shrunken desktop app.** The Procore mobile app has 4.1 stars on Google Play with criticism for slow loading, unreliable sync, and crashes. Drawing downloads are unreliable on job site connectivity. Large file handling frequently crashes or times out. The markup tools have oversized selection boxes, no undo, and poor precision for field conditions — gloves, sun, vibration. The dirty secret: many field teams use Procore on mobile only for photos and daily logs, then switch to desktop in the trailer for everything else.

**No undo on drawing annotations.** This is 2025. Procore still has no undo for drawing markups. "The absence of an undo feature for drawing annotations makes me nostalgic for PlanGrid." A basic function, missing for ten years.

**A daily log that's a form, not an experience.** Weather requires a manual click to populate — even though the system knows the project location. No voice-to-text for notes. Manpower entry requires looking up companies from a list. No intelligence — Procore knows manpower, weather, and productivity data but never tells you "you're 15% behind last Tuesday's pace on this trade." Photos aren't automatically linked to relevant activities. The daily log is raw data entry and display. No insight. No intelligence. No reduction of the superintendent's 30-minute burden.

**The RFI tool requires 6 to 8 form fields before you can submit.** On a job site, in the cold, with gloves on, this is a multi-minute workflow. No intelligent routing — Procore doesn't know from the drawing sheet reference who the right reviewer is. No automatic detection of related RFIs. No AI assistance for drafting the question. No escalation logic — an overdue RFI just sits with no automated escalation or priority flagging. No predictive analytics — how long do RFIs typically take to resolve on this project?

**Used as CYA, not coordination.** "I'm seeing more GCs treat Procore as a CYA info dump instead of actually managing the job. They quickly send out RFIs and submittals, and then weeks later, they'll ask you, 'Did you review RFI 156?'" — MEP engineer. The tool makes it very easy to generate high volumes of RFIs with loose questions. Engineers and architects are overwhelmed; actual coordination deteriorates.

**Full page reload on every action.** No multi-tab support — you can't have a drawing open next to an RFI. Returning to top of list after opening a document — when you're in a long submittal log, reviewing item 47, then go back, you're at item 1 again. Meeting minutes that feel like data entry, not notetaking. No procurement management. No observation-to-punchlist conversion. No spec annotation. Can't reassign an RFI without admin permissions.

### Procore's Pricing Problem

Procore's pricing model — Annual Construction Volume — makes it extremely expensive for growth. The faster your volume grows, the faster your software costs grow.

Real prices from user reports:
- $15M project: ~$20,000/year
- $55M annual volume: ~$55,000/year
- $59M project: $80,000/year (without the financials module)
- $38M project: $110,000 over 16 months

Renewal increases went from typical 2-5% to 10-14% year-over-year starting in 2023-2024. Pricing has doubled in eight years while simultaneously removing tools from base packages. Features that were bundled are now separate purchases. "We've downgraded to the Project Management Pro and Quality and Safety packages only, yet we're still paying twice as much as when we joined."

Customer sentiment: "$30K-$60K a year for software is ridiculous." Multiple Reddit threads show contractors actively exploring alternatives. One company had a 150% price increase mid-contract and migrated out in two months. 73% of small and mid-size contractors who adopt Procore reportedly abandon it within the first year. Average sunk cost before abandonment: approximately $18,000.

This is not a product people love. This is a product people tolerate because the switching costs are high and the alternatives are worse.

---

## Autodesk Build: The Acquisition Graveyard

Autodesk bought PlanGrid for $875 million in 2018. PlanGrid was the product that field crews loved. It was built for the guy on the scaffold, not the PM in the trailer. It hit $100M ARR on the strength of three things: speed (when competitor apps crashed loading hospital blueprints, PlanGrid was instant), mobile-first field-first design, and viral adoption among workers who moved between projects.

Autodesk buried it under enterprise complexity.

PlanGrid is now in maintenance mode — no new features, just bug fixes until it's sunsetted. The soul of the product (simple, beautiful, construction teams love to use) was absorbed into a larger, more complex platform. 40% of the PlanGrid team left within 18 months of acquisition. "During the merger, we had to drop all our point solutions and startup tools to turn on all the enterprise 'winners.' We wasted hours on slow, cumbersome software and were thrown into confusing legacy workflows."

The irony: Autodesk paid $875 million for PlanGrid's field adoption and brand love. They then rebuilt it into Autodesk Build, which is more powerful but harder to love. The things that made PlanGrid great — simplicity, speed, field-first design — got diluted in the enterprise rebuild.

Autodesk Build does have genuine strengths. BIM integration is real — pinning RFIs to 3D model locations, clash detection, progress tracking against models. Construction IQ uses historical patterns to predict risk. The drawing comparison tools are superior to Procore's. But these strengths serve a specific, high-end use case: large, BIM-heavy projects with design-build teams.

For the majority of construction volume — tenant improvements, renovation, smaller commercial, residential, heavy civil — Autodesk Build is a checkbox, not a revelation.

And the labor tracking gap is inexplicable: Autodesk Build has no timecards, no production reports, no T&M tickets, no labor scheduling. The most fundamental data on a construction project — who worked, where, for how long — is outside the product's scope.

---

## Fieldwire: The Right Instinct, the Wrong Ceiling

Fieldwire understood something nobody else did: field workers are different users than project managers. They're on a scaffold, wearing gloves, in low light, under time pressure. And the product reflects this.

Field crews love Fieldwire. "It has brought back my love of the job." "No more soggy drawings." "I absolutely love Fieldwire. I am shocked we haven't been using this from the start." 4.8/5 on the App Store. 4.5/5 on Google Play. Compare to Procore's 4.1.

Fieldwire got the field experience right: offline-first design that actually works when connectivity drops, fast drawing loads, markup precision with actual undo, task pinning to plan locations, make-ready planning built in, and customer support with an average first response of 1.3 hours. Field staff become proficient within one shift, not after 40 hours of training.

But Fieldwire stopped at task management. It's a field tool, not a platform. No financial management, no budget tracking, no change order workflow, no pay applications. RFIs and change orders only on the highest pricing tier. No scheduling tool — no Gantt, no CPM, no schedule integration beyond importing an image. No submittal management. No owner or architect portal. No accounting integration. No preconstruction tools.

The positioning is clear and honest: Fieldwire is the field execution layer, not the project management layer. For a GC running a $50M project, it needs to run alongside something else.

Hilti acquired Fieldwire for $300 million in 2021. Since then, the team has doubled to 300 people and launched in 22 languages. But the ceiling remains: Fieldwire doesn't aspire to be the system of record for a commercial construction project. It aspires to be the best field tool in the stack.

---

## Buildertrend, CoConstruct, Jobber: Wrong Category

The residential software market serves a different user with different needs. Buildertrend built client relationship software for home builders — homeowner portals, selections management, warranty tracking. It's genuinely better than Procore at those specific workflows. But it wasn't designed for commercial construction: no RFI workflows for multi-party coordination, no submittal management at scale, no CPM scheduling, no multi-project PM oversight.

CoConstruct was acquired by Buildertrend in 2021 and is now effectively a zombie product. Jobber is a field service platform for HVAC techs and landscapers — no RFIs, no submittals, no drawing management. Wrong category entirely.

---

## The Emerging Players: Point Solutions, Not Platforms

Bridgit does workforce planning beautifully — but just workforce allocation, not scheduling or productivity. OpenSpace does 360° photo documentation — but requires Procore or Autodesk alongside it for task management. Doxel does AI progress tracking — but requires a BIM model, limiting its addressable market. Togal.AI does AI takeoff — saving 70% of estimation time — but only for preconstruction. BuildOps serves commercial subcontractors — but only MEP trades.

Each of these products is a point solution built for a narrow use case. They accept that Procore or Autodesk exists and build on top of them rather than trying to replace them. They're useful. They're not the answer.

---

## The Gap

Here is what the construction tech market has built: tools for **documentation**.

Here is what the industry desperately needs: tools for **intelligence**.

Every existing tool captures what happened. No existing tool tells you what's about to go wrong and what to do about it. The data to make these predictions is already being generated in Procore and Autodesk — daily logs, manpower, RFIs, change orders, submittals, inspection results, drawing revisions, safety observations. Thousands of projects, millions of records. The predictions aren't being made.

Nobody has built the thing that makes a superintendent say: "I can't imagine doing this job without this."

Nobody has built the tool that earns field trust — where supers actually use it — because the first minute of use makes their job easier, and every day after that makes it easier still.

Nobody has built the construction equivalent of Linear, Figma, Superhuman, or the iPhone — a product so obviously, viscerally better that the old way becomes intolerable.

That is what SiteSync builds.

---
---

# Part 3: The SiteSync Philosophy

---

Ten design principles govern every decision at SiteSync. These are not aspirational slogans. These are laws. When two priorities conflict, these principles decide.

Each principle is followed by a concrete construction example that makes it real. If a principle can't be illustrated with a specific moment from a job site, it doesn't belong here.

---

## Principle 1: The Site Is the Source of Truth, Not the Office

Every feature must work from a phone on a job site with one hand, in the rain, with gloves on. If it can't be used in the field, it doesn't ship.

Construction happens in the field. The office exists to serve the field, not the other way around. When software is designed for the office and then adapted for the field, the field experience is always compromised — smaller buttons, slower loading, features that require Wi-Fi, workflows that assume a mouse.

SiteSync is designed the other way: field-first, and then the desktop experience extends it. The phone interface is the primary product. The desktop interface is the extended product.

**The example:** A superintendent is standing in the rain looking at missing fire blocking above a corridor ceiling. They need to create an RFI. In Procore, they would need to: open the app, navigate to RFIs, tap create, fill out 12 fields, attach a photo, assign it, submit. Four to six minutes minimum. In the rain, with gloves, on a phone.

In SiteSync, they point the phone at the problem. Take a photo. Say what they see. Done. Fifteen seconds. The system handles everything else.

If any feature cannot survive that test — the rain test, the glove test, the 15-second test — it doesn't ship.

---

## Principle 2: Show Me What I Need Before I Ask

The app should know what time it is, what phase the project is in, what's scheduled today, what the weather is, and what's overdue — and surface the right information at the right moment without being asked.

Construction professionals don't have time to search for information. They need the right information at the right time, delivered without a query. The product should behave like a chief of staff who knows the project as well as the superintendent does.

**The example:** It's 5:50 AM. The superintendent opens SiteSync. Without tapping anything, they see: the weather is 42°F and clear, good conditions for the concrete pour. Three trades are scheduled today — electrical rough-in (8 crew), HVAC duct install (6 crew), and a fire blocking inspection at 10 AM. Smith Mechanical was 2 hours late yesterday — flagged as a watch item. RFI #347 has been with the architect for 9 days — the SLA is 7. The electrical and HVAC work areas overlap on the 2nd floor east wing — potential conflict.

The superintendent didn't search for any of this. The system assembled it. The system knew what time it was (early morning), what role the user has (superintendent), what phase the project is in (MEP rough-in), and what's most likely to need attention (late subs, overdue RFIs, trade conflicts). The briefing was generated, not discovered.

---

## Principle 3: Capture Happens in the Moment, Documentation Happens Automatically

The superintendent should never sit down for 30 minutes to fill out a daily log. They should capture observations throughout the day — voice, photo, tap — and the system should compose the documentation.

The distinction between capture and documentation is the most important design insight in SiteSync. Capture is what happens in the moment: a photo, a voice note, a status tap. Documentation is what gets compiled afterward: a daily log, an RFI, a safety report. Current tools force the human to do both. SiteSync separates them — the human captures, the system documents.

**The example:** At 7:15 AM, the superintendent takes a photo of a concrete pour in progress. At 9:30 AM, they record a voice note: "Smith Mechanical showed up with 4 guys instead of 6." At 10:45 AM, the fire marshal inspection passes — one tap. At 11:30 AM, a delivery truck arrives and the super photographs the ticket. At 2:00 PM, the architect visits and the super taps "visitor."

At 4:30 PM, the daily log is already 85% complete. Weather was pulled automatically every two hours. Workforce was compiled from sub check-ins and the morning head count. Activities were assembled from photos, voice notes, and status changes. The super reviews it in two minutes, makes one edit, taps approve. Done.

What took 45 minutes now takes 5. And the quality is better, because every entry was captured in the moment, not reconstructed from memory.

---

## Principle 4: Every Interaction Should Take Less Than 3 Seconds

If creating an RFI takes more than 3 taps and a voice note, it's too slow. If checking the schedule takes more than a glance, it's too complex.

Superhuman set the standard: sub-100ms response times, zero perceptible latency, the user never breaks flow state. Linear proved it's achievable: under 50ms for state changes, 150 to 250ms for transitions. SiteSync must meet this standard — not because construction professionals are impatient, but because they're busy. A four-minute workflow on a job site doesn't just waste four minutes — it loses the observation entirely, because the superintendent has already moved on to the next problem.

**The example:** The super sees a plumbing rough-in that doesn't match the drawings. In the current world, they make a mental note, plan to create an RFI later, and forget by 3 PM. In SiteSync: photo, voice note, done. Fifteen seconds. The system drafts the RFI, identifies the drawing sheets, suggests the responsible party, and puts it in the queue. The superintendent never navigated a menu, never filled out a form, never left the field.

The benchmark: if an interaction requires the superintendent to stop walking, it's too slow.

---

## Principle 5: AI Is Invisible Infrastructure, Not a Feature

The user shouldn't "use the AI." The AI should make everything feel smarter — better search, better suggestions, better drafts, better predictions — without ever showing a chatbot or requiring a prompt.

There is no "AI button" in SiteSync. There is no chatbot sidebar. There is no "Ask AI" dialog. The AI is the intelligence layer beneath every interaction — the reason search returns the right result, the reason the RFI draft is already written, the reason the morning briefing knows what matters, the reason the daily log writes itself.

**The example:** When a superintendent takes a photo of missing fire blocking, they don't type "AI, analyze this photo." The system analyzes it automatically — Gemini identifies the fire blocking gap, Claude drafts the RFI with the correct drawing references and code citations, the classification engine assigns the CSI code and urgency level, the code reference engine finds the relevant IBC section. The superintendent sees a completed RFI draft. They don't see AI. They see a tool that understands their job.

This is the Tesla principle: software that runs the car, not software that the driver operates. The driver doesn't "use the battery management system." The battery management system runs silently, making every drive better. That's how AI works in SiteSync.

---

## Principle 6: The App Gets Smarter Every Day

Every RFI teaches the system what causes coordination failures. Every inspection teaches it what gets missed. Every project teaches it about sub performance. The platform is a learning system, not a static tool.

Static tools stay the same no matter how much you use them. SiteSync gets better. After one project, it knows your subs. After ten projects, it knows your patterns. After a hundred projects, it knows things about construction coordination that no individual human could know — because no individual human works on a hundred projects simultaneously.

**The example:** On your third project using SiteSync, the system notices that a specific mechanical subcontractor has been 1 to 2 days late on their committed schedule in the last three weekly plans. It surfaces this to the PM: "Smith Mechanical is exhibiting the same early-project patterns that preceded a 3-week delay on the Riverside project. Consider a performance conversation now."

No human PM tracks cross-project subcontractor performance at this resolution. No human PM remembers that the same pattern happened on a project two years ago. The system does, because every project teaches it.

After 1,000 projects, SiteSync knows: which drawing details consistently generate RFIs, which architects respond slowly, which inspection types fail most often with which crews, what the actual productivity rate is for each trade in each building type, and which weather conditions actually delay work versus which ones just look threatening. This intelligence compounds. It cannot be replicated by a competitor who starts from zero.

---

## Principle 7: Subs Are First-Class Citizens, Not Second-Class Afterthoughts

The viral loop depends on subs wanting to use this. Free access, persistent identity across GCs, data they own, and an experience designed for the person holding the phone, not the person paying the invoice.

Procore is designed for the GC. Subs are required to use it but get minimal value — they do data entry for the GC, for free, in exchange for access to work. "Procore is prohibitively expensive and, while marketed to specialty contractors, is very clearly geared to the general contractors."

SiteSync inverts this. The sub portal is not an afterthought bolted onto the GC platform. It's a first-class experience with genuine value for the subcontractor: real-time payment status visibility, earlier notification of schedule changes, drawing updates with change clouds, a persistent identity that carries reputation data across GCs, and tools designed for the foreman in the field — not the office manager at a desk.

**The example:** A plumbing foreman named Dave works for three different GCs this year. On each project, the GC uses SiteSync. Dave doesn't create three accounts. He has one identity — one login, one profile, one reputation. His RFI response data, his crew's manpower reliability, his inspection pass rates — all of it accumulates into a performance profile that makes Dave's company more competitive when bidding the next project. Dave owns that data. It follows him, not the GC.

When Dave opens SiteSync on a new project, the app already knows he's a plumber. It shows him his scope, his work areas on the floor plan, his open punch list items, and his payment status. He didn't configure anything. The app configured itself for him.

This is how the viral loop works: Dave loves the app. Dave moves to a different GC's project. Dave asks: "Why aren't we using SiteSync?" The sub becomes the distribution channel, not the GC's sales team.

---

## Principle 8: Construction Is Visual, So the Software Should Be Visual

Plans, photos, site maps — these are the native language of construction. Tables and forms are the language of databases. The app should speak construction.

Construction is fundamentally spatial. A project is not a list of tasks — it's a physical place where things are happening at specific locations. The site map should be the home screen, not a view within a navigation tree. From the site map: tap a floor, see the floor plan. Tap a room, see all issues, tasks, and documents related to that room. Tap an issue pin, see the detail with photos, status, and assigned trade.

**The example:** When a PM needs to know the status of the 2nd floor, they don't open a table of tasks filtered by floor number. They see the 2nd floor plan, with color-coded zones: green where work is complete, amber where it's in progress, red where it's blocked. Issue pins show open items at their exact physical location. The PM understands the status of the floor in a glance — because they're seeing it the way a superintendent sees the floor during a site walk.

This spatial metaphor has no equivalent in current construction software, which organizes information by document type (RFIs, submittals, daily logs, punch list) rather than by location. The location-first model matches how superintendents actually think: "What's happening in the south wing today?"

---

## Principle 9: Time Is the Most Important Dimension

Construction is fundamentally about sequence — what happens before what, what's blocking what, what's late. Every view should be oriented around time: what happened today, what's planned this week, what's at risk next month.

Time is not a filter in SiteSync — it's the organizing principle. The app opens to "now." Scroll left for yesterday. Scroll right for tomorrow. The morning briefing shows today's work. The evening view shows today's log. The weekly view shows the lookahead. The monthly view shows the owner report.

**The example:** It's Wednesday afternoon. The PM is reviewing the week's progress. The timeline view shows: Monday's concrete pour (completed, green), Tuesday's mechanical rough-in (in progress, amber — behind schedule), Wednesday's inspection (passed, green), Thursday's planned electrical work (at risk, red — the mechanical work needs to finish first).

The PM doesn't read a Gantt chart. They see a timeline that tells a story: here's what happened, here's what's happening, here's what's in trouble. The most important thing — the red flag on Thursday's electrical work — is the biggest visual element. Not buried in row 47 of a table.

---

## Principle 10: Quality Is the Only Speed

Ship nothing that isn't polished. A superintendent who sees a buggy, slow, or confusing screen will never open the app again. First impressions are permanent in construction — these are people who judge building quality for a living.

Construction professionals have a highly calibrated sense of quality. They spend their days inspecting work — checking level, plumb, square, finish, tolerance. When they encounter software that crashes, loads slowly, or looks unprofessional, they judge it the same way they'd judge a crooked door frame: this was built by someone who doesn't care about their work.

**The example:** A competing construction app ships a daily log feature that sometimes loses voice notes, occasionally duplicates photo entries, and takes 4 seconds to save. The super uses it for one week. The first time a voice note disappears, they lose trust. The second time, they stop using voice. By the end of the week, they're back to paper.

SiteSync will never ship that feature. If the voice note capture isn't rock-solid reliable, it stays in development. If the save time is 4 seconds, it gets optimized before release. If the photo deduplication isn't perfect, it doesn't go to the field.

This means SiteSync may ship fewer features than competitors in any given month. That's the tradeoff. Competitors ship 40 mediocre features. SiteSync ships 5 flawless ones. The field will choose the 5.

Linear made this same bet: fewer features, executed with obsessive quality. The result was a product that developers described as "the first tool that feels like it was designed, not assembled." That's the standard.

---
---

# Part 4: The 5 Moments That Change Everything

---

These are the five daily interactions where SiteSync should be so dramatically better than anything else that a user would never go back. Not 43 pages of features — five moments of magic.

For each moment: the current reality, what the incumbent does, what SiteSync does, why it matters, and how it works.

---

## Moment 1: The Morning Briefing

---

### The Current Reality

The superintendent arrives at 5:45 AM. They check their texts — 30 to 50 messages from the previous evening and overnight, scattered across personal and work threads. They open the weather app — but it just says "partly cloudy, 42°F," which tells them nothing about whether concrete can cure, masonry can proceed, or the crane needs a wind hold. They try to remember what's happening today from the schedule they looked at yesterday. They walk the site looking for problems — overnight water intrusion, vandalism, safety hazards, material deliveries. They make mental notes. By the time the first crew arrives at 6:30, the super has assembled a picture of the day from memory, texts, a weather app, and a physical walk.

None of this picture is written down. None of it is shared with the PM. None of it is connected to the schedule.

### What Procore Does

A dashboard with overdue items and an activity feed. Generic. It takes 8 seconds to load. It doesn't know what time it is. It doesn't know what trade is coming today unless you navigate to the schedule tool — a separate page load. It doesn't know the weather unless you navigate to the daily log tool and manually pull it. It doesn't detect trade conflicts. It doesn't know that Smith Mechanical was late yesterday.

Procore's morning experience is a list of things that are overdue. Not a briefing. Not a plan. A list.

### What SiteSync Does

You open the app. It knows.

Before you ask, before you tap, before you navigate, the screen shows:

**Weather:**
42°F, clear, wind 8 mph. Good pour day.

This is not just "partly cloudy." This is construction-specific weather intelligence: concrete can cure (temperature above 40°F), masonry can proceed (no precipitation), no wind hold on crane operations (wind below 20 mph). The system knows what trades are scheduled today and what weather conditions affect them.

**Today's Work:**
- Electrical rough-in, 2nd floor — ABC Electric, 8 crew
- HVAC duct install, 1st floor — Smith Mechanical, 6 crew
- Fire blocking inspection at 10:00 AM

Pulled from the schedule. Not a Gantt chart. A list of what's actually happening today, by trade, by location, by crew size.

**Watch Items:**
- Smith Mechanical was 2 hours late yesterday. Pattern: late 3 of last 5 days.
- RFI #347 (MEP coordination, 2nd floor) has been with the architect for 9 days. SLA is 7. This RFI blocks electrical work in the east wing next week.
- The electrical sub's work area overlaps with HVAC on the 2nd floor east wing — potential spatial conflict. Historical data: last time electrical and HVAC overlapped on a project, it added 2 days.

**Overnight:**
- Security camera detected water intrusion at SW corner (photo attached)
- Temperature dropped to 28°F overnight — check freeze protection on exposed pipes
- No gate alerts. Site secure.

This isn't a dashboard. It's a **briefing**. Like a chief of staff preparing an executive for the day, except the chief of staff has perfect memory and access to every data point on the project.

The superintendent reads it in 60 seconds. They know what matters. They know what's at risk. They know where to walk first. They haven't opened a single sub-menu. They haven't searched for anything. The system did the work.

### Why This Matters

The morning briefing is the "aha moment" — the first thing a user sees, the thing that earns or loses trust in the first 60 seconds. If this experience is good, the super opens the app every morning. If this experience is mediocre, the super goes back to texts and memory.

The briefing also prevents problems. The trade conflict flag gives the super 15 minutes to resolve it before crews arrive — instead of discovering it at 8 AM when both crews are already on the floor. The RFI aging alert triggers a call to the architect. The weather intelligence prevents a concrete pour that would fail in freezing temperatures overnight.

Every morning briefing that prevents one wasted hour pays for the product ten times over.

### How It Works Technically

The morning briefing is an edge function that assembles data from:
- **Weather API** — hyper-local weather data, mapped against construction-specific thresholds (concrete curing temperature, crane wind limits, masonry precipitation restrictions)
- **Schedule data** — today's planned activities, by trade, by location, by crew size
- **Yesterday's daily log** — what actually happened, who was late, what was completed, what was deferred
- **RFI aging engine** — every open RFI, its age, its SLA, its schedule impact, who has the ball
- **Trade overlap detection** — spatial analysis of the schedule: which trades are planned for the same location on the same day
- **IoT/camera alerts** — security camera feeds, temperature sensors, gate sensors (where available)
- **Historical sub performance data** — pattern detection across current and past projects

The AI model (Claude) composes the briefing narrative from structured data. The briefing is generated fresh each morning at 4:00 AM and cached. When the superintendent opens the app, it loads instantly — no computation at open time.

---

## Moment 2: The Field Capture

---

### The Current Reality

The superintendent is walking the site at 9:00 AM. They see a problem — fire blocking is missing above the corridor ceiling on the 2nd floor. They take a photo on their personal phone. They text it to the PM: "Hey, missing fire blocking 2nd floor corridor, need to send an RFI." They make a mental note to create the RFI later. By 3 PM, they've dealt with fourteen other issues. The RFI doesn't get created until the next day — or not at all. The photo lives in their camera roll, mixed with 200 other photos, unfiled.

### What Procore Does

Open app. Navigate to RFIs. Tap create. Fill in: Subject. Question. Responsible party. Due date. Drawing reference. Specification section. Priority. Distribution list. Attach photo. Write the question in formal language. Review. Submit.

If you're fast, and you know the drawing references off the top of your head, this takes 4 to 6 minutes. On a phone. With one hand. In the field.

Most superintendents don't create RFIs in the field. They create them at the end of the day, from the trailer, from a laptop. Which means the observation and the documentation are separated by hours. Context is lost. Photos aren't linked. Drawing references are approximate. The RFI quality suffers.

### What SiteSync Does

Point your phone at the problem. Take a photo. Say: "Fire blocking is missing above the corridor on the second floor. This needs to go to the architect."

Done. Fifteen seconds.

Here's what happened behind the scenes:

**Gemini analyzed the photo.** Identified: fire blocking gap above corridor ceiling. Recognized the ceiling assembly type. Matched it against the drawing set.

**The voice note was transcribed** and combined with the photo analysis into a structured observation: location (2nd floor corridor), issue (missing fire blocking), responsible party (architect).

**Claude drafted a formal RFI:**
> RFI #348 — Missing Fire Blocking Above 2nd Floor Corridor
>
> Reference: Sheet A2.03, Detail 4/A5.01
>
> The fire blocking above the corridor ceiling on the 2nd floor between gridlines C-D/2-3 has not been installed per the fire-rated assembly detail. Please clarify whether this condition was intentionally omitted or advise on the required fire blocking configuration per the fire-rated assembly.

**The classification engine** assigned: Trade = Fire Protection. CSI Division = 07 84 00 (Firestopping). Urgency = High (life safety item).

**The code reference engine** found the relevant code: IBC 2021 Section 714.4 requires continuity of fire-resistant-rated assemblies at penetrations. This citation is attached to the RFI as reference.

**The routing engine** auto-assigned the RFI to the architect (ball-in-court detection from the kernel's state machine: new RFI → architect review).

**The photo was geotagged** and linked to the drawing sheet (A2.03) at the precise location of the observation.

**The daily log entry was auto-generated:** "Field observation: missing fire blocking, 2nd floor corridor. RFI #348 created, assigned to architect."

The superintendent never typed a word. Never navigated a menu. Never filled out a form. Never looked up a drawing reference. Never wrote formal language. Never classified urgency. Never assigned a responsible party.

They pointed, spoke, and moved on. The system did everything else.

### Why This Matters

**Every unrecorded observation is a risk.** The super who sees a problem and doesn't document it immediately has a 50% chance of documenting it later — and a 100% chance that the documentation will be less accurate. When fire blocking is missing and it's not documented, someone covers it with drywall. Three months later, the inspector finds it. Rework cost: $15,000 to $50,000. Documentation trail: none.

**The speed difference is not incremental — it's categorical.** The difference between a 6-minute RFI and a 15-second RFI is not 5 minutes and 45 seconds of time savings. It's the difference between "this gets documented" and "this gets forgotten." A superintendent will not stop walking the site for 6 minutes to create an RFI. They will stop for 15 seconds. The barrier determines whether the observation becomes a record.

**The RFI quality is better than a human would write.** The AI-drafted RFI includes formal language, drawing references, specification sections, and code citations. Most field-drafted RFIs say something like "fire blocking missing, please advise." The SiteSync RFI says exactly what's missing, where it is, what drawing it should reference, and what code requires it. This RFI gets answered faster because the architect doesn't need to ask clarifying questions.

### How It Works Technically

The field capture pipeline uses four AI models:
1. **Gemini** — Photo analysis: identifies construction elements, conditions, and anomalies. Trained on construction imagery including assemblies, trades, and code-relevant details.
2. **Claude** — RFI drafting: takes structured observation data (photo analysis + voice transcription + location) and composes a formal, professional RFI with drawing references and specification citations.
3. **Classification model** — Assigns CSI division, trade, urgency, and responsible party based on the observation type and project configuration.
4. **Code reference engine** — Searches relevant building codes (IBC, NEC, NFPA, local amendments) for applicable requirements.

The pipeline runs in sequence: photo → transcription → analysis → draft → classification → code reference → routing → daily log. Total latency: under 30 seconds. The superintendent sees a notification within one minute: "RFI #348 created. Review?" They can review, edit, or approve with one tap. If they don't review, the RFI goes to a draft queue for PM review.

---

## Moment 3: The Coordination Moment

---

### The Current Reality

The superintendent notices that the electrician and the plumber are scheduled for the same corridor tomorrow. Both crews need overhead access. Both foremen plan to have scaffolding in the corridor. The space can't hold both.

The super calls both foremen. Negotiates who goes first. Maybe sends a text: "Plumbing tomorrow, electrical Thursday." This decision affects the schedule. It's not entered into the schedule. It lives in the super's memory and a text message.

The academic literature confirms: space conflicts without a formal resolution procedure lead to "interfered workers, interrupted or inefficient work, schedule delays, and numerous complaints that can destroy morale." When site engineers face space conflicts, "many rely on personal experience."

### What Procore Does

Nothing. Procore doesn't detect trade conflicts. It doesn't analyze the schedule for spatial overlaps. It doesn't know that two trades are about to collide. You'd have to manually check the schedule, realize the overlap exists, and handle it yourself.

### What SiteSync Does

The system detected the overlap 3 days ago. It already flagged it in Monday's morning briefing: "Electrical and plumbing are both scheduled for the 2nd floor north corridor on Thursday. Historical note: last time these trades overlapped on the Johnson project, it added 2 extra days."

When the superintendent taps the conflict, the screen shows:

**Visual overlay:** Both trades' work areas rendered on the floor plan. The overlap zone is highlighted. Clear spatial representation — not a table, not a Gantt chart, but the actual physical space that's in conflict.

**Schedule impact analysis:**
- If Trade A (plumbing) goes first: 2-day plumbing rough-in, then electrical can work around completed plumbing. Total impact: 0 days to schedule (plumbing was already planned first in the baseline).
- If Trade B (electrical) goes first: electrical conduit runs block access for plumbing waste lines. Plumbing would need to work around electrical, adding 1 day. Total impact: 1 day to schedule.

**Historical resolution data:** "On the Johnson project (2024), the same conflict between electrical and plumbing rough-in was resolved by running plumbing waste lines first. Rationale: plumbing rough needs to be inspected before electrical covers it. Result: no added days."

**Suggested resolution:** "Recommend plumbing waste rough-in first (2 days), then electrical. This aligns with the inspection sequence — plumbing rough inspection must occur before electrical work covers the waste lines. One-tap to notify both foremen and update the 3-week lookahead."

One tap. Both foremen get a notification with the updated sequence. The 3-week lookahead is updated. The daily log records the decision. The PM sees the change.

This is **construction intelligence**. Not "here's a Gantt chart" — but "here's what's about to go wrong, here's what happened last time, and here's how to fix it."

### Why This Matters

**Trade conflicts are the most common daily crisis** on commercial construction projects. MEP rough-in on any floor creates inevitable spatial conflict — the ceiling space above a commercial floor is a three-dimensional puzzle of competing duct, pipe, and conduit systems. Every day that a conflict goes unresolved costs money in idle crews, delayed successors, and compressed downstream schedules.

**The historical data is the real moat.** No human superintendent remembers how a specific trade conflict was resolved on a project two years ago. The system does. After hundreds of resolutions, SiteSync knows the optimal sequencing for every trade combination in every building type. This intelligence is unique to SiteSync's data and cannot be replicated by a competitor who doesn't have the project history.

**The one-tap resolution eliminates the phone call chain.** Today, resolving a trade conflict requires: the super calls foreman A, calls foreman B, negotiates, sends confirmation texts, manually updates the lookahead (or doesn't). Total time: 15 to 30 minutes plus the risk of miscommunication. SiteSync reduces this to one tap plus two push notifications. Total time: 10 seconds.

### How It Works Technically

The coordination engine combines:
- **Schedule analysis** — Every activity in the CPM schedule has a location attribute. The engine runs daily overlap detection: which activities are planned for the same physical space on the same day?
- **Spatial modeling** — Floor plans are parsed into zones. Each trade's work area is mapped to zones. Overlap detection is geometric, not just temporal.
- **Historical resolution database** — Every conflict resolution on every SiteSync project is stored with: the trade combination, the resolution chosen, the schedule impact, and the outcome. This becomes training data for the suggestion engine.
- **Impact simulation** — When a conflict is detected, the engine simulates both sequencing options (A-then-B vs B-then-A) against the CPM and calculates the schedule impact of each.
- **Notification engine** — One-tap resolution triggers push notifications to affected foremen with the new sequence, updates the schedule, and logs the decision.

---

## Moment 4: The Daily Log (That Writes Itself)

---

### The Current Reality

It's 4:30 PM. The superintendent is exhausted. They've been managing chaos since 6 AM — ten hours of walking, talking, coordinating, inspecting, resolving, and putting out fires. Now they sit in the trailer and try to remember everything that happened.

They type: "Continued work on 2nd floor. Weather clear. 42 workers on site."

This is a legal document. This is what gets entered into evidence when there's a $2 million dispute in three years. This is what the lawyer reads to the jury. "The superintendent's daily log states: 'Continued work on 2nd floor. Weather clear. 42 workers on site.' That is the entirety of the documentation for this day."

The reality is worse than negligence — it's structural. The daily log is filled out by a person who has spent ten hours doing a physically and mentally demanding job. Their memory of specific events is imperfect. The log reflects that imperfection. "Two weeks after starting a system, half the crew stops filling them out and the other half writes 'same as yesterday' every day."

### What Procore Does

A form with fields for weather, workforce, activities, visitors, equipment, deliveries, safety violations, accidents, quantities. You type in each one. The weather auto-populates — but requires a manual click. The "Copy previous day" feature reduces repetitive entry. The distribution list auto-sends the completed log.

For a thorough log, this takes 30 to 60 minutes. Most supers spend 15 to 20 minutes and the log is incomplete. Completion rates on projects are often below 60%. The daily log analytics show manpower trends but provide no intelligence — Procore never says "you're 15% behind last Tuesday's pace on this trade." Just raw data entry and display.

### What SiteSync Does

The daily log has been writing itself all day.

**Weather:** Pulled automatically every 2 hours from the hyper-local weather API. 42°F/clear at 6 AM. 58°F/clear at noon. 48°F/clear at 4 PM. Wind speeds, precipitation, humidity — all logged. Construction-relevant notes: "Temperature remained above 40°F for the duration of the concrete cure window."

**Workforce:** Auto-counted from three sources: (1) sub daily manpower submissions via the app, (2) gate badge data where available, (3) the superintendent's morning head count confirmed with one tap per trade. Result: 47 workers on site — ABC Electric 8, Smith Mechanical 6, Johnson Drywall 12, Core Concrete 15, Other 6.

**Activities:** Compiled from the morning briefing confirmations, photos taken during the day (with AI-analyzed descriptions), RFIs created, inspections completed, voice notes, and status changes.

> "Electrical rough-in progressed on 2nd floor east wing (ABC Electric, 8 crew). HVAC duct install continued on 1st floor (Smith Mechanical, 6 crew, arrived at 9:00 AM — 2 hours late). Concrete placement completed for 2nd floor slab section C-D (Core Concrete, 15 crew, 42 CY placed). Fire blocking inspection at 10:00 AM — passed. Drywall hanging continued on 1st floor south wing (Johnson Drywall, 12 crew)."

**Visitors:** "Fire marshal inspection 10:00–10:45 AM (passed, no deficiencies). Architect site visit 2:00–3:00 PM (walked 2nd floor with PM, reviewed MEP coordination)."

**Safety:** "Toolbox talk: fall protection refresher (all trades, 7:00 AM, 47 attendees). No incidents. One observation: housekeeping concern at south stairwell landing, resolved by 11:00 AM."

**Deliveries:** "Concrete delivery: 42 CY, Big River Ready Mix, ticket #47832, staged at 2nd floor deck. Electrical materials delivery: ABC Supply, ticket #11204, staged in south storage area."

**Photos:** 12 photos taken throughout the day, auto-tagged with location, trade, and AI-generated description. Linked to corresponding activity entries.

The superintendent opens the daily log at 4:30 PM. Everything above is already there. They read through it in 2 minutes. They add one note: "Discussed 2nd floor east wing sequencing with Smith Mechanical foreman — agreed to complete duct install by Friday to clear for electrical." They tap approve. Timestamped. Signed. Distributed.

Total time: 3 minutes.

### Why This Matters

**The daily log is the single most important legal document on a construction project.** In a dispute, the daily log is what proves who was on site, what work was performed, what conditions existed, what delays occurred, and who caused them. Three years after the fact, memories have faded, people have moved on, and the only thing that remains is the written record.

A daily log that says "Continued work on 2nd floor" is worse than useless in litigation — it suggests the superintendent wasn't paying attention. A daily log that says "Core Concrete, 15 crew, placed 42 CY at 2nd floor slab section C-D. Weather: 58°F/clear at noon. Concrete delivery: Big River Ready Mix, ticket #47832. Temperature above 40°F for duration of cure window" is a legal fortress.

**The time savings alone justify the product.** 30 minutes per day, per superintendent, per project. On a portfolio of 10 projects, that's 5 hours per day returned to the field. Over the life of a 2-year project, that's approximately 250 hours — six full work weeks — spent on documentation that the system can compose in real time.

**The quality difference is the real impact.** A daily log compiled in real time from timestamped observations is not just faster — it's categorically better than one written from memory. Every entry has a timestamp. Every photo is geotagged. Every workforce count is verified by the sub who submitted it. This log is defensible in ways that a memory-reconstructed log never is.

### How It Works Technically

The self-writing daily log is an aggregation pipeline:

1. **Weather service** — Hyper-local weather API polls every 2 hours. Data stored per-project with construction-relevant annotations (curing conditions, wind holds, precipitation impacts).

2. **Workforce aggregation** — Sub foremen submit daily manpower via a one-screen interface (trade name, crew count, one tap). Gate badge APIs where available. Morning head count by the superintendent (one tap per trade to confirm or adjust). All sources reconciled into a single workforce table.

3. **Activity compilation** — Claude analyzes the day's inputs: photos (with Gemini captions), voice notes (transcribed), RFIs created, inspections logged, status changes, morning briefing confirmations. Outputs a narrative activity summary by trade, by location, with quantities where available.

4. **Visitor and inspection log** — Inspection results captured via one-tap interface at the time of the event. Visitor arrivals logged via a check-in screen (name, company, purpose — three fields).

5. **Photo organization** — All photos taken during the day are auto-sorted by time, location (GPS), and AI-identified trade/activity. Duplicates removed. Best representative photos selected for the log.

6. **Narrative generation** — Claude composes the final daily log from all aggregated data. The narrative is written in the style of a professional daily log — factual, specific, trade-by-trade, location-specific. The log is generated at 4:00 PM and presented as a review draft.

7. **Review and approval** — The superintendent reviews the draft on a single scrollable screen. Each section (weather, workforce, activities, visitors, safety, photos) can be edited inline. One tap to approve. Approval triggers: timestamp, digital signature, distribution to the configured list (PM, owner, archive).

---

## Moment 5: The Owner Meeting

---

### The Current Reality

The OAC meeting is every other week. Before each meeting, the PM spends 2 to 4 hours (some reports say 4 to 8 hours) preparing. They pull the schedule update from Primavera. The RFI log from Procore. The budget from the accounting system. The change order log from Excel. The submittal log from another Procore tool. They compile this into PowerPoint slides — copying data from five systems into one deck.

Then they present to the owner, who asks two questions: "Are we on schedule?" and "Why is it over budget?"

The PM answers with slides that were assembled hours ago from data that's already partially stale. If the owner asks a follow-up — "What's the status of the mechanical work specifically?" — the PM flips through slides or says "Let me get back to you on that."

### What Procore Does

The reports section generates PDFs of RFI logs, submittal logs, and schedule exports. The PM copies this data into PowerPoint. Manual. The schedule export is a static Gantt that's difficult to read on a projector. The RFI log is a table. The budget report is another table. None of it tells a story. None of it answers "What should I be worried about?"

### What SiteSync Does

Before the meeting, the system generates a complete meeting package — without the PM doing any assembly:

**Visual progress report:** Not a Gantt chart. A site plan with progress overlay — a visual heat map showing where work is complete (green), in progress (amber), and behind (red). The owner sees the building taking shape, not rows in a table. Progress photos are embedded: this week's photo of the 2nd floor next to last week's photo, next to the plan rendering. Visual comparison tells the story better than any table.

**Narrative summary:** Generated by Claude from structured project data:

> "The project is 2 days ahead of schedule on structural work but 5 days behind on MEP coordination due to 3 outstanding RFIs with the architect (average age: 11 days, SLA: 7 days). The electrical subcontractor has been consistently 1–2 days behind their committed schedule on the last 3 weekly plans. Budget impact: $0 to date, but the MEP delay creates a $45,000 risk if not resolved this week. Recommended action: escalate RFIs #347, #351, and #354 to the architect with a notice of delay."

This narrative is not a data dump. It's an executive briefing — the kind that a highly experienced PM would write if they had three hours and perfect memory. The system writes it in 30 seconds because it has all the data.

**Change order summary:** Visual cost impact — a waterfall chart showing: original contract, approved changes, pending changes, projected final cost. Each change order links to its source (owner directive, design error, unforeseen condition) and its documentation.

**Photo comparison timeline:** This week vs. last week vs. plan, side by side. Progress is visible. The owner sees the building getting built.

**3-week lookahead with risk flags:** Not a Gantt chart — a card-based view showing next week's milestones, the week after, and the week after that. Red flags on items at risk, with the reason (blocked by RFI, sub behind schedule, material not delivered).

**Live during the meeting:** The PM doesn't present slides. They present a live dashboard. When the owner asks "What's the status of the mechanical work?" — the PM taps "Mechanical" and the view filters to show: Smith Mechanical's schedule, their daily crew counts (trending down), their open RFIs, their recent inspection results, and a predictive note: "At current crew levels, HVAC rough-in will complete 4 days late. Adding 2 crew members recovers the schedule."

**After the meeting:** Action items are captured via voice transcription during the meeting. The system auto-generates tasks, assigns them to the responsible parties, and distributes the meeting summary within minutes of the meeting ending. No manual minutes. No forgotten follow-ups.

### Why This Matters

**The PM's meeting prep time is one of the largest non-productive time sinks in construction management.** Four hours of preparation for a one-hour meeting, multiplied by biweekly meetings, multiplied by 10 projects — that's 40 hours per month (a full work week) spent compiling data instead of managing projects.

**The quality of the presentation reflects the quality of the GC.** An owner who sees a polished, data-driven, visually compelling project report thinks: "This GC has their act together. I can trust them." An owner who sees a cobbled-together PowerPoint with stale data and inconsistent formatting thinks: "This project is less organized than I'd like."

SiteSync makes every GC look world-class. The PM walks into the meeting with more insight than any human could compile manually — because the system has perfect memory, real-time data, and the ability to synthesize across schedule, budget, RFI, and workforce dimensions simultaneously.

**The live meeting experience changes the dynamic.** When the PM can answer any question in real time — by tapping into the live data — the meeting becomes a decision-making session instead of a status report. The owner's time is respected. Decisions happen faster. Follow-up meetings are eliminated.

### How It Works Technically

The owner meeting package is generated by an automated report pipeline:

1. **Progress visualization** — Schedule percent complete is mapped to floor plan zones using location-tagged schedule activities. A rendering engine produces the heat map overlay. Photo comparison uses timestamped geo-tagged photos matched to consistent camera positions.

2. **Narrative generation** — Claude generates the executive summary from: schedule variance (planned vs. actual), RFI aging data, budget committed vs. actual, change order status, and sub performance metrics. The narrative is templated for consistency but dynamically populated.

3. **Change order waterfall** — A visualization engine produces the waterfall chart from the change event database. Each bar links to the source documentation.

4. **Lookahead risk engine** — Each activity in the 3-week lookahead is evaluated against: open prerequisites (RFIs, submittals, inspections), sub performance trends (are they meeting daily targets?), and material delivery status. Activities that fail any prerequisite check are flagged red.

5. **Live meeting mode** — The meeting dashboard is a real-time web view with role-based filtering. The PM can drill from project summary → trade detail → individual RFI/submittal/change order in two taps. No slides. No static exports.

6. **Meeting minutes automation** — Audio capture during the meeting is transcribed. Claude identifies action items ("Owner to approve CO #14 by Friday," "Architect to respond to RFI #347 by Wednesday"). Tasks are created, assigned, and distributed automatically.

---
---

# Part 5: The Design DNA

---

## From Principles to Rules

Each of the 10 SiteSync principles translates into concrete implementation rules. These rules are testable — a design review can check whether a screen follows or violates them.

---

### Principle 1: The Site Is the Source of Truth

**Concrete rule:** Every screen must be fully functional on an iPhone SE (the smallest current iPhone) held in one hand, in portrait orientation, with a minimum tap target size of 44x44 pixels.

**Violating it:** An RFI creation form that requires pinch-to-zoom to hit the "Assign" dropdown. A drawing markup that requires two-finger gestures to undo. A settings screen that only works in landscape.

**Following it:** An RFI created with one photo, one voice note, and zero form fields. A daily log review that's a single scrollable screen with one "Approve" button at the bottom. A morning briefing that loads in under 1 second on a 4G connection.

---

### Principle 2: Show Me What I Need Before I Ask

**Concrete rule:** The home screen must change based on: time of day, user role, project phase, and outstanding items. A superintendent at 6 AM sees the morning briefing. A PM at 9 AM sees today's action items. A sub foreman at 7 AM sees their work areas and open tasks.

**Violating it:** A generic dashboard that shows the same widgets regardless of time or context. A home screen that requires the user to select "Morning View" from a dropdown.

**Following it:** The app opens to the morning briefing at 5:00–8:00 AM, shifts to a field capture mode at 8:00 AM–4:00 PM, and transitions to the daily log review at 4:00–6:00 PM. No manual mode switching.

---

### Principle 3: Capture Now, Document Later

**Concrete rule:** No documentation workflow may require the user to type more than 20 words. Voice and photo are the primary inputs. Structured data (fields, classifications, assignments) is either auto-detected or confirmed with a single tap.

**Violating it:** An RFI form with 12 required text fields. A safety observation that requires selecting from a 3-level nested dropdown of hazard categories.

**Following it:** A safety observation created by voice: "Hard hat violation, south stairwell, third floor." The system creates the observation, classifies the hazard type (PPE non-compliance), tags the location (south stairwell, 3rd floor), assigns it to the general foreman, and adds it to the daily log. The user spoke 8 words.

---

### Principle 4: Every Interaction Under 3 Seconds

**Concrete rule:** Page load time must be under 1 second on a 4G connection. Interaction response must be under 200ms. State changes must be under 50ms. No loading spinners for actions on local data.

**Violating it:** A drawing that takes 4 seconds to render. An RFI list that shows a spinner for 2 seconds while fetching from the server. A status change that requires a round-trip to the server before updating the UI.

**Following it:** Local-first architecture: all user actions write to local storage immediately and sync in the background. Drawings are pre-cached on the device. RFI lists are available offline. The user never waits for the network.

---

### Principle 5: AI Is Invisible

**Concrete rule:** No screen may contain the words "AI," "artificial intelligence," "machine learning," or "powered by." No chatbot interface. No "Ask AI" button. AI outputs are presented as native product features.

**Violating it:** A sidebar with an AI chatbot labeled "SiteSync AI Assistant." A button that says "Generate with AI." A notification that says "Our AI detected a conflict."

**Following it:** The morning briefing shows trade conflict warnings — no mention of how they were detected. The RFI draft appears as a pre-filled form — no mention of who drafted it. The daily log narrative appears as a document ready for review — no mention of who wrote it.

---

### Principle 6: Gets Smarter Every Day

**Concrete rule:** Every user interaction must create a feedback signal that improves future behavior. RFI edits teach the system better drafting. Conflict resolution choices teach the system better sequencing. Daily log corrections teach the system better narrative style.

**Violating it:** A static system that produces the same suggestions on project 100 as on project 1. A morning briefing that doesn't learn which items the user actually reads.

**Following it:** After a superintendent consistently edits the daily log to add more detail about concrete quantities, the system learns to include concrete quantities automatically. After a PM consistently modifies the AI-drafted RFI language, the system adapts to their preferred tone and level of detail.

---

### Principle 7: Subs Are First-Class

**Concrete rule:** The sub experience must be available for free, with no GC involvement required to sign up. Sub profiles persist across GCs. Sub data (performance, documents, certifications) belongs to the sub, not the GC.

**Violating it:** A sub portal that requires the GC to invite the sub. A sub account that's project-specific and disappears after the project ends. Sub performance data that's only visible to the GC.

**Following it:** Dave the plumber downloads SiteSync. Creates a profile. His insurance, licenses, and certifications are uploaded once and auto-shared with every GC who adds him to a project. His performance data is visible to him on his own dashboard. When a new GC invites him, his profile is already complete.

---

### Principle 8: Visual, Not Tabular

**Concrete rule:** The primary view for any spatial information must be a floor plan or site map, not a table. Tables may exist as secondary views for data export and filtering, but the default experience is visual.

**Violating it:** A punch list displayed as a 200-row table with columns for location, description, trade, status, and due date.

**Following it:** A punch list displayed as pins on the floor plan — red for open, amber for in progress, green for complete. Tap a pin to see the detail. The superintendent sees the building, not a spreadsheet.

---

### Principle 9: Time-Oriented

**Concrete rule:** The app's primary navigation axis is temporal: Today, This Week, This Month. Every view can be scoped to a time window. The default scope is always "now" — what's relevant right now.

**Violating it:** A navigation menu that organizes by document type: RFIs, Submittals, Daily Logs, Punch List. To see "what's happening today," the user must visit each tool separately.

**Following it:** A single timeline view that shows today's activities (by trade and location), today's open items (RFIs, inspections, coordination issues), and today's completions (work finished, inspections passed). One screen. One scroll. Complete situational awareness.

---

### Principle 10: Quality Is the Only Speed

**Concrete rule:** No feature ships until it passes: (1) the field test — a superintendent uses it on a real job site for one full day without reporting a bug, (2) the speed test — every interaction meets the performance targets in Principle 4, and (3) the design review — every screen has been reviewed against all 10 principles.

**Violating it:** Shipping a voice capture feature that occasionally drops audio. Shipping a photo upload that sometimes fails on poor connectivity. Shipping a daily log that generates incorrect workforce counts.

**Following it:** Holding a feature for two additional weeks to fix an edge case where voice notes are truncated when the phone receives a call. This is the kind of bug that would make a superintendent stop using voice input permanently.

---

## The Visual Language

---

### Color

Construction sites are brown, grey, orange, and dusty. The physical environment is visually chaotic — equipment, materials, people, scaffolding, signage. The app must be a visual oasis in that chaos.

**Background:** White and light grey. Clean. Calm. High contrast against the physical environment.

**Primary accent:** Construction orange (#E86833). Used sparingly — for primary actions, active states, and critical alerts. Feels native to the construction context without being garish.

**Status colors:** Green (complete/safe), amber (in progress/warning), red (blocked/critical). These map directly to construction's universal visual language — traffic signals, safety signage, schedule status.

**Text:** Near-black (#1A1A1A) on white backgrounds. Maximum contrast. No light grey text on white backgrounds — this is unreadable in direct sunlight.

**Dark mode:** Available but not default. Some superintendents arrive before sunrise and check the app in a dark truck cab. Dark mode uses the same color hierarchy with inverted backgrounds.

---

### Typography

Must be readable outdoors, in bright sunlight, on a phone screen, by a person who may be 50 years old and doesn't wear their reading glasses on the job site.

**Primary font:** System font (SF Pro on iOS, Roboto on Android). No custom fonts that might render slowly. System fonts are optimized for each platform's rendering engine.

**Minimum body text:** 16px. No exceptions. 14px is too small for field conditions.

**Headers:** 20–28px, bold. The most important information on any screen should be readable from arm's length.

**Weight:** Medium and Bold only. No Light or Thin weights. Thin fonts wash out in bright sunlight.

**Line height:** 1.5x minimum. Dense text is harder to scan on a moving job site.

---

### Information Hierarchy

The most important thing is the **biggest** thing. Not buried in a table. Not tucked into a secondary panel. The thing that matters most takes the most visual space.

**Level 1 — The headline:** What you need to know in 2 seconds. Full-width, large text, at the top of the screen. "3 Watch Items Today" or "Daily Log: 85% Complete" or "Inspection at 10 AM — Fire Blocking."

**Level 2 — The details:** Supporting information. Cards or sections below the headline. Each card is scannable — one piece of information per card, with a clear label. Tap to expand.

**Level 3 — The deep data:** Tables, timelines, full histories. Accessible from Level 2, but never shown by default. Progressive disclosure: the complexity is there when you need it, invisible when you don't.

This is the Apple Health model applied to construction: the home screen shows your vitals as sparklines. Tap for the detail. Tap again for the history. Three levels of depth, each accessible in one tap, each appropriate for its context.

---

### Interaction Design

**Tap targets:** 44x44 pixels minimum. This is Apple's Human Interface Guideline, and it exists because thumbs are imprecise — especially when wearing work gloves. Every interactive element in SiteSync meets this minimum, and primary actions (approve, submit, confirm) exceed it at 56x56 pixels.

**Swipe gestures:** Used for common actions that should feel fast and physical. Swipe right on a daily log entry to approve. Swipe left to flag for edit. Swipe right on a punch list item to mark complete. These gestures match the physical metaphor of moving papers — signing off, setting aside, filing.

**Voice as first-class input:** Every screen that accepts text input also accepts voice input. The microphone button is always visible, always the same size, always in the same position (bottom-right). Voice input is not dictation-into-a-text-field — it's a semantic input that the system interprets. "Tell Smith Mechanical to check the rough-in on the 3rd floor before Thursday" becomes a task assigned to Smith Mechanical with a due date and a location.

**Long-press for context:** Long-pressing any element reveals contextual actions. Long-press a photo to add to daily log. Long-press an RFI to escalate. Long-press a trade name to see their performance summary. This is progressive disclosure through gesture — power-user actions accessible without cluttering the screen.

**Pull-to-refresh:** Standard behavior, but with a twist: the refresh animation shows a brief status ("Last synced 2 minutes ago" → "Syncing..." → "Up to date"). This gives offline-first confidence — the user knows whether they're seeing live data or cached data.

---

### Animation

Purposeful, fast, and communicative. Never decorative.

**State changes:** Under 50ms. When a daily log entry changes from "Draft" to "Approved," the status badge transitions instantly. The user sees the change happen — it's fast enough to feel instantaneous but slow enough for the eye to register.

**Transitions:** 150 to 250ms. When drilling from the morning briefing into a specific RFI, the card expands into the full RFI view. The animation communicates spatial relationship — where you came from and how to get back.

**Loading:** If content takes more than 500ms to load (which should be rare with local-first architecture), a subtle skeleton screen appears — the layout of the content without the data. This maintains spatial orientation and eliminates the jarring "flash of empty content."

**What SiteSync never does:** Bounce effects, spring physics, parallax scrolling, confetti on completion, or any animation that takes more than 300ms. These feel playful in consumer apps and unprofessional in a tool used by people who judge quality for a living.

---

### Sound and Haptics

**Confirmation haptic:** A short, firm tap (Apple's `.success` haptic) when an RFI is submitted, a daily log is approved, or an inspection is logged. The user feels the confirmation without looking at the screen.

**Alert haptic:** A longer, double-tap pattern (Apple's `.warning` haptic) when an inspection is due in 30 minutes, an RFI is past SLA, or a safety observation requires immediate attention.

**Error haptic:** A heavy, abrupt tap (Apple's `.error` haptic) when an action fails — photo upload unsuccessful, sync conflict detected, mandatory field missing.

**Audio readout:** The morning briefing can be read aloud by the system while the superintendent drives to the site. Not a robotic text-to-speech — a natural voice that reads the briefing as a narrative: "Good morning. It's 42 degrees and clear — good conditions for the pour today. Three trades are scheduled. Smith Mechanical was late yesterday and has been late 3 of the last 5 days. There's one watch item..."

This matters because superintendents are in their trucks at 5:30 AM. Hands on the wheel. Eyes on the road. The briefing plays through CarPlay or Bluetooth, and by the time they arrive at the site, they know everything they need to know.

---

## The Command Palette: Universal Navigation for Office Users

Every great modern product has converged on the command palette as the primary navigation mechanism for power users. Linear uses Cmd+K. Superhuman uses Cmd+K. Arc uses Cmd+T. Figma uses the slash command. Notion uses the slash command. All of them provide a single text-entry point that surfaces any action, any navigation target, any workflow.

For the project engineer, the estimator, the document controller — the office users who work at desks with keyboards — the command palette is the most important interface element in SiteSync.

Type "RFI" and immediately see options: Create RFI, View Open RFIs, RFI #347, Close RFI. Type "Daily Log" and immediately open today's log. Type "Smith" and immediately find all documents, tasks, conversations, and performance data related to Smith Mechanical. Type "2nd floor" and see every active item on the 2nd floor — RFIs, tasks, inspections, punch items, schedule activities.

The command palette treats the product's entire feature set as a search index, eliminating navigation friction completely. A superintendent in the field uses voice and camera. A project engineer in the office uses the command palette. Both move at the speed of thought.

---

## Offline-First Architecture

Construction sites are not always in cellular coverage. A basement. An underground parking garage. A rural site with no tower. A daily log that requires connectivity to save — and loses data when the connection drops — will be abandoned in favor of paper immediately and permanently.

SiteSync is offline-first. This means:

- All user actions write to local storage immediately, with zero network dependency
- Sync happens whenever connectivity is available — Wi-Fi in the trailer, cellular when walking the site, 4G when driving between projects
- Conflicts are resolved gracefully: last-writer-wins for most fields, with explicit conflict flags for shared documents where simultaneous edits might diverge
- The user never sees a loading spinner for actions on local data
- Photos, voice notes, and status changes queue locally and upload when bandwidth allows
- The morning briefing is pre-generated and cached — it's available at 5:45 AM even if the super opens the app in a dead zone

Linear proved this architecture works in software development. The same local-first model that makes Linear feel fast in a San Francisco office building makes SiteSync resilient in a basement excavation with no signal.

The technical foundation: a local SQLite database on the device that mirrors the cloud database structure. Writes go to local first, always. A sync engine reconciles local and cloud state in the background. The sync is conflict-aware — it knows which fields can be safely merged (additive data like photos and voice notes) and which fields need human resolution (competing edits to the same text).

---

## Alert Hierarchy: Preventing Alert Fatigue

Tesla's alert system taught the industry something important: when everything is urgent, nothing is urgent. A worker who receives 50 push notifications a day will stop reading all of them — including the one that actually matters.

SiteSync uses a graduated alert hierarchy:

**Level 1 — Ambient information:** Always visible, minimal visual weight. Project health indicator. Schedule status. Budget status. These live in the periphery — visible when you glance at the screen, never demanding attention.

**Level 2 — Informational notifications:** Banner notifications that appear and auto-dismiss. "RFI #347 received a response." "Smith Mechanical confirmed 6 crew for tomorrow." "Weather update: rain expected after 3 PM." These inform without interrupting.

**Level 3 — Action-required alerts:** Persistent notifications that require acknowledgment. "Daily log not yet approved." "Inspection scheduled in 30 minutes — fire blocking, 2nd floor." "RFI #351 is 3 days past SLA — escalation recommended." These stay on screen until addressed.

**Level 4 — Safety-critical alerts:** Audio + visual + haptic, immediate and unavoidable. "Safety incident reported — 2nd floor, south wing." "Failed inspection — stop work order issued." "Weather emergency — high wind warning, crane operations suspended." These are rare — perhaps once a week on an average project — and because they're rare, they're heeded.

The principle: match the intensity of the notification to the urgency of the action required. Reserve maximum-intensity alerts for genuinely time-sensitive items. The superintendent who trusts that a Level 4 alert is always serious will always respond to it.

---

## Onboarding: How a Superintendent Learns SiteSync

Superhuman's legendary onboarding — a 30-to-60-minute 1:1 video call with every new user — demonstrated that products with new interaction modes benefit from human coaching. The results were extraordinary: users didn't just learn the product, they became emotionally bonded to it.

SiteSync's onboarding is modeled on this insight but adapted for construction:

**The first morning:** The superintendent downloads SiteSync 10 minutes before arriving at the site. The app asks three questions: What project are you on? What's your role? What GC are you with? Then it assembles the morning briefing from the project data already in the system (imported from the schedule, the RFI log, the sub list). The superintendent sees the briefing. They read it. In that moment — in the first 60 seconds — they learn something about their project they didn't know. An RFI that's past SLA. A trade conflict tomorrow. A weather condition that affects the pour.

That's the onboarding. Not a tutorial. Not a video. Not a 40-hour training program. One morning briefing that provides genuine value.

**The first field capture:** The superintendent sees a problem on the site walk. The app prompts: "Tap to capture." They take a photo. They say what they see. The RFI draft appears. They're astonished. They show it to the foreman. "Did you see this? It wrote the RFI for me." The foreman downloads the app.

**The first daily log:** At 4:30 PM, the app presents the daily log — 85% complete. The superintendent reviews it, makes one edit, taps approve. They look at the clock. It's 4:35 PM. Yesterday, this took until 5:15 PM. They're done 40 minutes early.

Each of these moments is designed to produce an immediate emotional payoff — the "aha" moment that bonds the user to the product. No training manual. No certification program. No 40-hour implementation. The product teaches itself through use.

**The onboarding metric:** Percentage of users who would be "very disappointed" if they could no longer use SiteSync. Superhuman tracked this metric obsessively — they took it from 22% to 58% in three quarters. SiteSync targets 60% within 90 days of first use.

---
---

# Part 6: The Technical Architecture That Enables This

---

## Why This Vision Is Technically Possible

Most product vision documents describe features and assume the engineering team will figure out how to build them. SiteSync is different — the architecture was designed from the beginning to support exactly this vision. Every technical decision serves a product decision.

---

### The Kernel Specification

The kernel spec defines every entity (RFI, Daily Log, Inspection, Change Order, Submittal, Punch Item) and every valid state transition for each entity. This is not documentation — it's a machine-readable contract that the AI uses to understand what "correct" looks like.

When Claude drafts an RFI, it doesn't guess the workflow. It reads the kernel spec: an RFI starts in Draft, moves to Open when submitted, moves to Under Review when the architect receives it, moves to Answered when a response is provided, and moves to Closed when the GC accepts the response. Each transition has required fields, valid actors, and business rules.

This means the AI can't create invalid states. It can't submit an RFI without a responsible party. It can't close an RFI without a response. The kernel spec is the source of truth for business logic, and every AI action is validated against it.

---

### The Eval Harness

The evaluation harness tests real assertions — the system verifies its own behavior. Every AI-generated output (RFI drafts, daily log narratives, meeting summaries, conflict detections) is evaluated against test cases that check for: factual accuracy, completeness, format compliance, and business rule adherence.

This is the quality ratchet. When an AI-generated daily log includes an incorrect workforce count, the eval catches it. The system improves. The next daily log is more accurate. Over time, the eval harness drives quality monotonically upward — it can get better, but it can never get worse.

---

### The AI Router

SiteSync uses four AI providers — Claude, Gemini, OpenAI, and specialized models — routed by task type. Photo analysis goes to Gemini (best-in-class visual understanding). RFI drafting and narrative generation goes to Claude (best-in-class writing and reasoning). Classification and embedding tasks go to efficient specialized models. Code reference lookups go to search-augmented models.

This multi-model architecture means each task gets the best model for that task. No single model bottleneck. No single provider dependency. The router dynamically selects based on task type, latency requirements, and availability.

---

### The RFI Service Layer

The RFI service is the first proof of the full architecture. It enforces the lifecycle defined in the kernel spec. It maintains provenance — every change is tracked with who, when, and why. It supports soft-delete — nothing is ever truly lost, because in construction, a "deleted" document might be needed three years later in litigation.

The RFI service layer proves that the architecture works: the kernel defines the rules, the service enforces them, the AI operates within them, and the eval harness verifies the results.

---

### Supabase Row-Level Security

Access control is enforced at the database level, not the application level. This means the sub portal isn't a separate app — it's the same app with different RLS policies. A sub foreman sees their trade's tasks, their open items, their payment status. They don't see other subs' data. They don't see the GC's internal budget. They don't see performance rankings.

This is not just a convenience — it's a security architecture that scales. Adding a new role (owner's rep, inspector, architect) is an RLS policy, not a new application. The data model is shared; the access model is differentiated.

---

### Edge Functions

AI orchestration runs on edge functions — serverless functions that execute close to the user. The morning briefing is an edge function that assembles data from the weather API, the schedule, the RFI database, and the daily log, then calls Claude to compose the narrative. The field capture pipeline is an edge function that calls Gemini for photo analysis, Claude for RFI drafting, and the classification engine for routing.

Edge functions keep the latency low and the architecture modular. Each function does one thing. Functions can be updated independently. The morning briefing can be improved without touching the field capture pipeline.

---

### The Organism

The platform builds itself. The organism — the autonomous development loop — uses the kernel spec as its blueprint, the eval harness as its quality gate, and the multi-model AI as its builder. New features ship while the team sleeps. Bug fixes are identified and resolved by the system. The quality ratchet ensures that every change is an improvement.

This is SiteSync's most radical technical advantage. While competitors employ teams of developers to write features, SiteSync's architecture allows the platform to improve continuously, autonomously, verified by the eval harness at every step.

A competitor who wanted to replicate this would need to build: the kernel spec, the eval harness, the quality ratchet, the multi-model AI router, the edge function orchestration, AND the autonomous development loop. That's six months of architecture before they write their first feature.

---
---

# Part 7: The Roadmap (What Gets Built When)

---

Priority order is based on the 5 Moments. Each phase ships when it's ready — not on a calendar — because Principle 10 (Quality Is the Only Speed) overrides schedule pressure.

---

## Phase 1: The Morning Briefing (2 weeks)

*The "aha moment" — the first thing a user sees.*

**What ships:**
- Weather-aware project dashboard with construction-specific annotations (curing conditions, wind holds, precipitation impacts)
- Today's work from the schedule — by trade, by location, by crew size
- RFI aging alerts — every open RFI with age, SLA status, and schedule impact
- Trade conflict detection — spatial overlap analysis of tomorrow's scheduled work
- Sub performance watch items — late arrivals, missed commitments, trending issues
- Audio readout for the drive to the site

**Why this is first:** The morning briefing is the hook. It's the thing that earns or loses trust in the first 60 seconds. If this is great — if it genuinely tells a superintendent something they didn't know, every single morning — the superintendent opens the app every day. If it's mediocre, everything else is irrelevant.

**Success metric:** 80% of users open the morning briefing 5 or more days per week within 30 days of onboarding.

---

## Phase 2: The Field Capture (2 weeks)

*Photo + voice → RFI in 15 seconds.*

**What ships:**
- Photo capture with Gemini analysis — identifies construction elements, conditions, and anomalies
- Voice note transcription and semantic interpretation
- Claude-drafted RFI with drawing references, spec citations, and formal language
- Auto-classification: CSI division, trade, urgency, responsible party
- Drawing sheet linking via geolocation and photo analysis
- Daily log auto-entries for every field capture
- Draft queue for PM review before submission

**Why this is second:** The field capture converts passive observers into active documenters. The superintendent who was making mental notes and texting photos is now creating formal, AI-drafted RFIs in 15 seconds. The volume and quality of documentation increases dramatically.

**Success metric:** Average time from observation to RFI draft under 30 seconds. 3x increase in RFIs created per project compared to baseline.

---

## Phase 3: The Self-Writing Daily Log (3 weeks)

*30-minute chore becomes 3-minute review.*

**What ships:**
- Continuous capture aggregation throughout the day — photos, voice notes, status changes, check-ins
- Auto weather from hyper-local API with construction annotations
- Auto workforce from sub manpower submissions with one-tap confirmation
- Photo/voice note aggregation into narrative activity descriptions
- Visitor and inspection logging with one-tap interface
- Full daily log narrative generated by Claude at 4:00 PM
- 2-minute review and approve workflow
- Digital signature and timestamped distribution
- Completion nudge notifications at 3:00 PM

**Why this is third:** The daily log is the highest-frequency documentation task on a construction project. Reducing it from 30 minutes to 3 minutes returns over 200 hours per project to productive work. The quality improvement — timestamped, photo-documented, auto-verified — makes the daily log legally defensible for the first time.

**Success metric:** Daily log completion rate above 90% (compared to industry average of ~60%). Average completion time under 5 minutes.

---

## Phase 4: The Coordination Engine (3 weeks)

*From reactive fire-fighting to proactive conflict prevention.*

**What ships:**
- Trade overlap detection from schedule — spatial analysis of all activities within a configurable lookahead window
- Visual conflict display on floor plans — overlapping zones highlighted with trade assignments
- Schedule impact simulation — what happens if Trade A goes first vs. Trade B
- Historical resolution database — how was this type of conflict resolved on past projects
- AI-generated resolution suggestion with rationale
- One-tap resolution and automatic foreman notification
- 3-week lookahead integration — resolved conflicts automatically update the work plan
- Daily log documentation of all coordination decisions

**Why this is fourth:** The coordination engine prevents the most common daily crisis on a commercial job site. Every conflict resolved proactively saves 15 to 30 minutes of phone calls, prevents idle crew time, and protects downstream schedule activities. The historical resolution data is the beginning of the cross-project intelligence moat.

**Success metric:** 50% reduction in reported trade conflicts reaching the field (measured by survey). Average resolution time under 2 minutes.

---

## Phase 5: The Owner Report (2 weeks)

*From 4 hours of manual assembly to 0 hours.*

**What ships:**
- Auto-generated progress narrative from schedule, RFI, budget, and workforce data
- Visual progress overlay on site plan — heat map of complete, in-progress, and behind areas
- Budget/schedule dashboard — visual waterfall for cost, visual timeline for schedule
- Photo comparison timeline — this week vs. last week vs. plan
- 3-week lookahead with risk flags
- Live meeting mode — real-time dashboard with drill-down capability
- Meeting minutes automation — voice capture, action item extraction, auto-distribution

**Why this is fifth:** The owner report is the highest-value output of the platform for GC leadership. It makes the GC look world-class. It eliminates the PM's largest non-productive time sink. And it creates the data-driven relationship with the owner that drives referrals and repeat business.

**Success metric:** PM meeting prep time reduced by 80%. Owner satisfaction with project reporting (measured by survey) in top quartile.

---

## Beyond Phase 5: The Intelligence Layer

Phases 1 through 5 establish SiteSync as the best field-to-office platform in construction. What comes next transforms it into something competitors cannot comprehend: a construction intelligence engine.

**Phase 6: Predictive Schedule Risk (4 weeks)**

The system has been collecting data through Phases 1-5: actual daily manpower, RFI response times, inspection pass rates, weather delay patterns, sub performance trends. In Phase 6, this data powers predictions.

"Based on current RFI response rates, submittal cycle times, and manpower trends, this project has a 75% probability of missing the mechanical rough-in milestone." This is calculable from existing data. No construction platform computes this prediction today.

"Your concrete crew is consistently 15% below forecast on Mondays and Fridays. At this productivity rate, the slab work will complete 8 days late. Adding 3 crew members on Monday and Friday recovers the schedule. Estimated cost impact: $12,000."

These predictions are not AI hallucinations. They are statistical inferences from real project data — the same inferences an experienced superintendent makes intuitively, except the system does it across 100 projects simultaneously and with quantitative precision.

**Phase 7: Cross-Project Intelligence (6 weeks)**

The intelligence layer that no competitor can replicate: insights that span projects.

"This architect has generated, on average, 35% more change orders than the industry median on similar project types. Budget accordingly."

"This subcontractor's insurance certificate expires in 14 days. On their last project, the renewal was 21 days late and held up a $180,000 pay application. Auto-notify their insurance agent now."

"The last three tenant improvement projects in this building type experienced a 22% increase in RFIs during the MEP coordination phase. Recommend scheduling a pre-installation coordination meeting for all MEP trades before rough-in begins."

This is the intelligence trapped in people's heads — the tribal knowledge of which subs perform, which architects generate problems, which building types are risky — extracted from data and made available to every user on every project.

**Phase 8: The Sub Marketplace (8 weeks)**

Once the sub network reaches critical mass — 10,000+ subcontractor profiles with performance data — SiteSync becomes the marketplace where GCs find and evaluate subs.

A GC estimator pricing a new project searches: "HVAC subcontractor, commercial tenant improvement, $500K-$1M scope, Chicago metro." SiteSync returns: 12 qualified subs with performance scores, average schedule adherence, RFI response times, inspection pass rates, and references from GCs who've worked with them.

The sub who performs well earns a better score. The sub who performs poorly is visible — they're incentivized to improve. The market becomes more efficient. Quality improves industry-wide.

This is the endgame. Not a project management tool. A construction intelligence platform that makes the entire industry better.

---
---

# Part 8: What Makes This Impossible to Copy

---

This is not a feature war. Features can be copied in six months. What SiteSync builds cannot be copied, because the moats are structural, not functional.

---

## Moat 1: Construction Intelligence from Real Project Data

Every RFI that flows through SiteSync teaches the system what causes coordination failures. Every inspection teaches it what gets missed. Every daily log teaches it about actual productivity rates. Every conflict resolution teaches it about optimal sequencing.

After 100 projects, SiteSync knows things about construction coordination that no individual human knows — because no individual human works on 100 projects simultaneously. After 1,000 projects, the intelligence is orders of magnitude beyond any human.

Specific intelligence that compounds:
- Which drawing details consistently generate RFIs (and which architects produce them)
- Which inspection types fail most often with which crews and in which conditions
- Actual productivity rates by trade, building type, weather condition, and crew size
- Optimal trade sequencing for every common conflict combination
- Subcontractor performance patterns that predict delays before they happen
- Change order likelihood by project type, owner, architect, and specification section

This data is SiteSync's most valuable asset. A competitor can copy the morning briefing feature. They cannot copy 1,000 projects of construction intelligence.

---

## Moat 2: The Sub Network

Once 10,000 subcontractors have persistent cross-GC profiles on SiteSync, that network is a moat. Procore's sub data is siloed per GC — when Dave the plumber moves to a new GC's project, his data doesn't follow him. In SiteSync, Dave has one identity. His performance data, certifications, insurance, and project history follow him everywhere.

This creates a flywheel:
- Subs sign up because the app is free and useful to them
- Subs accumulate performance data that makes them more competitive
- GCs see sub performance data that helps them make better hiring decisions
- GCs adopt SiteSync to access the sub network
- More GCs means more data for subs
- More data means more value for both sides

The sub network is SiteSync's distribution channel. Subs carry SiteSync from project to project, from GC to GC. Each sub is an unpaid evangelist. The network effect compounds: the more subs on the platform, the more valuable it is for every GC, and the more GCs on the platform, the more valuable it is for every sub.

Procore cannot replicate this without fundamentally restructuring their data model — their architecture silos sub data per GC, per project. Breaking that silo would require a migration that affects every existing customer.

---

## Moat 3: The Organism

The platform gets better every six hours without any human writing code.

The organism — the autonomous development loop — uses the kernel spec as its blueprint, the eval harness as its quality gate, and the multi-model AI as its builder. New capabilities emerge continuously. The quality ratchet ensures monotonic improvement.

A competitor who wanted to replicate this capability would need to build:
1. A kernel specification that defines every entity and state machine
2. An evaluation harness that tests real assertions against real data
3. A quality ratchet that prevents regression
4. A multi-model AI router that selects the right model for each task
5. An autonomous development loop that writes, tests, and deploys code
6. The monitoring and safety infrastructure to ensure autonomous deployment is reliable

That's six months of architecture work — before writing their first feature. And when they're done, they'll have a development loop with zero project data and zero construction intelligence. SiteSync will be six months ahead and accelerating.

---

## Moat 4: Domain Authenticity

SiteSync was built by a general contractor who knows what a fire blocking inspection looks like, what it sounds like when a concrete pump is running, and what it feels like when the inspector shows up and you can't find the documentation.

Walker Benner is not a Silicon Valley PM designing from a conference room. He's been on job sites. He knows what a superintendent's morning feels like. He knows that the 24-day change order cycle isn't an abstract statistic — it's a real conversation with a real sub who already paid their workers and is waiting to get reimbursed. He knows that the 8-document pay app gauntlet isn't a workflow diagram — it's a monthly crisis that determines whether a 25-person plumbing company can make payroll.

This shows in every design decision. The morning briefing includes trade-specific weather intelligence (not just temperature) because Walker knows that a superintendent needs to know whether the crane can operate, not whether to bring an umbrella. The field capture is voice-first because Walker knows that gloves and cold hands make typing impossible. The daily log writes itself because Walker knows that a superintendent who's been on their feet for ten hours isn't going to spend 45 minutes on documentation — no matter how important it is.

Domain authenticity cannot be acquired. It cannot be hired. A competitor can hire construction consultants, but consultants advise — they don't build. A competitor can acquire a construction company, but operators don't design software. The combination — a builder who builds buildings AND builds software — is vanishingly rare. It is SiteSync's founding advantage.

---

## Moat 5: The Mid-Market Gap

Procore has abandoned the sub-$50M contractor as a viable customer. Their pricing model — based on Annual Construction Volume — means that a GC doing $10M to $50M in annual volume pays $10,000 to $50,000 per year for software. For a company with 15 to 50 employees and tight margins, that's prohibitive. Especially when the field team refuses to use it and the company ends up using 10 to 15% of the features.

Buildertrend doesn't do commercial. Fieldwire doesn't do financials or scheduling. Autodesk Build requires BIM and enterprise sales cycles. There is no good product for a GC doing $10M to $75M in commercial work.

This is a multi-billion-dollar market segment with no great solution.

SiteSync prices for this market: per-project pricing that's transparent, predictable, and affordable. No ACV calculations. No "call us for a quote." No surprise 14% renewal increases. A 20-person GC running a $5M project can afford SiteSync. A 200-person GC running a $100M project gets the same product with more data and more intelligence.

The mid-market GC is SiteSync's wedge. They're underserved, they're frustrated, and they're looking for alternatives. They're small enough to adopt quickly (no 6-month implementation) and large enough to generate meaningful project data for the intelligence engine.

Once SiteSync owns the mid-market, the move upmarket is natural: the intelligence from 1,000 mid-market projects makes SiteSync smarter than any product in the enterprise market. Enterprise GCs adopt SiteSync not because it's cheaper than Procore, but because it's smarter.

---

## The Competitive Response — and Why It Won't Work

Procore will see SiteSync. They'll respond in predictable ways:

**"We'll add AI features."** Procore will bolt AI onto their existing architecture. They'll add a chatbot sidebar. They'll add AI-generated RFI drafts. They'll announce "Procore AI" at their annual conference. But bolting AI onto a form-based, full-page-reload, tool-silo architecture is like bolting a turbocharger onto a horse-drawn carriage. The architecture is the product. You can't make a slow, fragmented product feel intelligent by adding a chatbot.

**"We'll improve our mobile app."** They'll invest in mobile performance. They'll reduce load times from 8 seconds to 4 seconds. They'll add voice input for daily logs. But their mobile app is built on top of a web architecture that was designed for desktop. Making it faster doesn't make it field-first. The interaction model — navigate to a tool, open a form, fill out fields — remains fundamentally wrong for a person standing on a job site.

**"We'll cut prices for mid-market."** They can't. Procore's business model is built on ACV-based pricing that scales with customer growth. Cutting prices for mid-market means cannibalizing their enterprise revenue. Wall Street will not accept that tradeoff.

**"We'll acquire a competitor."** They might acquire a point solution — the way Autodesk acquired PlanGrid. But acquisition doesn't create integration. It creates complexity. PlanGrid's soul died inside Autodesk. The same would happen to any acquisition Procore makes.

The structural response SiteSync forces is this: Procore would need to rebuild their architecture from scratch — local-first, field-first, AI-native, with a kernel spec and eval harness and autonomous development loop. That's not a feature add. That's a rewrite. Rewrites take years, and during those years, SiteSync is compounding intelligence from thousands of projects.

---
---

# Part 9: The Emotional Core

---

Construction workers build the hospitals where our children are born, the schools where they learn, the bridges we drive across every day. They build in 100°F heat and 15°F cold. They work at heights that would paralyze most people. They operate equipment that weighs 60,000 pounds. They pour concrete that must be right the first time because you can't un-pour it.

They do this under relentless schedule pressure — because the owner's lease starts on a specific date and every day of delay costs money. They do this under relentless budget pressure — because every change order is a negotiation and every pay app is a test. They do this under relentless safety pressure — because a mistake doesn't mean a lost file or a crashed server, it means a person gets hurt.

And they're served by software designed by people who've never held a hammer.

That's the gap. Not a technology gap. Not a market gap. A respect gap.

The person who spends their day making sure a building stands up — that the rebar is spaced correctly, that the fire blocking is continuous, that the structural connections are torqued to spec — deserves a tool that was designed with the same care they bring to their own work. Not a database with a UI. Not a shrunken desktop app on a phone. Not a form that takes 45 minutes to fill out at the end of a grueling day.

They deserve a tool that knows what they need before they ask. A tool that captures their observations in the moment they happen. A tool that documents their work automatically, completely, and accurately — so that when the lawyer asks "what happened on October 14th?" the answer is precise, timestamped, and irrefutable. A tool that detects conflicts before they become problems. A tool that gets smarter every day. A tool that was built by someone who knows what their job actually feels like.

SiteSync exists because the people who build the physical world deserve tools as thoughtful as the tools built for people who sit at desks.

That's the mission.

Everything else — the AI, the organism, the eval harness, the kernel spec, the morning briefing, the field capture, the self-writing daily log, the coordination engine, the owner report — exists to serve that mission.

The $177.5 billion in annual wasted labor costs. The 48% of rework from miscommunication. The 14 hours per week per person searching for information. The daily log written from memory at 5 PM. The 24-day change order cycle. The 8-document pay app gauntlet. The RFI that takes 9.7 days while the schedule slips.

These aren't statistics. They're the daily reality of people who build the world.

We're going to fix it.

---

## What This Feels Like When It Works

Imagine a superintendent named Maria. She's been doing this for 18 years. She runs a $12 million tenant improvement project in a downtown office building. She has 14 subs. She manages 400 RFIs over the life of the project. She writes a daily log every single day for 14 months.

Before SiteSync, Maria's day starts in the dark. She arrives at 5:45, checks her texts, walks the site with a flashlight, and assembles her mental model of the day from memory and fragments. She manages 14 simultaneous conversations by text. She creates RFIs by sitting in the trailer at lunch. She writes the daily log at 5 PM, tired, hungry, and thinking about the drive home. She preps for the OAC meeting on Sunday night. She carries every trade conflict, every late sub, every overdue RFI, and every unanswered inspection result in her head.

Maria is exceptional at her job. But her tools make her job harder, not easier. She spends 30% of her time on documentation and information retrieval — time she could spend managing the work.

After SiteSync, Maria's day starts with a briefing. She reads it in the truck. By the time she walks onto the site, she knows what's happening, what's at risk, and where to walk first. When she sees a problem, she captures it in 15 seconds — the RFI writes itself. When there's a trade conflict, the system detected it two days ago and suggests the same resolution that worked on her last project. At 4:30 PM, her daily log is already done — she reviews and approves in 3 minutes. On Sunday night, she doesn't prep for the OAC meeting. The system did it. She reviews the meeting package in 10 minutes, adds one note, and goes to dinner with her family.

Maria doesn't talk about AI. She doesn't talk about features. When someone asks her about SiteSync, she says: "It's the first tool that actually knows what I need."

That's the sentence we're designing for. That's the sentence that means we got it right.

---

## The Promise

To every superintendent who has ever written a daily log from memory at 5 PM after a 10-hour day: this tool will write it for you.

To every PM who has ever spent 4 hours assembling a meeting deck from five different systems: this tool will do it in 30 seconds.

To every sub foreman who has ever showed up to a work area that was still occupied by another trade because nobody told them the schedule changed: this tool will tell you before you leave the shop.

To every project engineer who has ever spent 30 minutes searching for the right drawing revision: this tool will find it in 2 seconds.

To every estimator who has ever looked at a sub's bid and wondered whether they'd actually show up on time: this tool will show you their track record across the last five projects.

To every GC who has ever paid $60,000 a year for software that their field team refuses to use: this tool costs less and your field team will love it.

To everyone who builds the physical world and has been served by software designed by people who've never been on a job site:

We built this for you. Because you deserve better.

---
---

# Appendix: Key Data Points

| Metric | Value | Source |
|--------|-------|--------|
| Annual US construction spend | $1.3 trillion | Industry data |
| Non-productive work hours | 35% of all work hours | Autodesk/FMI Construction Disconnected study |
| Annual labor cost on non-optimal activities | $177.5 billion (US) | Autodesk/FMI |
| Hours/week lost per person (searching, conflict, rework) | 14+ hours | Autodesk/FMI |
| Rework caused by miscommunication | 48% of all rework | Textline construction communication study |
| Project cost growth caused by rework | 52% | 2025 peer-reviewed study via PlanRadar |
| Rework from design-induced errors | Up to 70% | PlanRadar 2025 |
| Average RFIs on large projects | 800–1,400+ | Layer.team |
| Average RFI response time (western US) | 6.4 days | Layer.team |
| Average RFI response time (Southeast) | 9.7 days | Layer.team |
| Design changes contributing to cost overruns | 56.5% | Rhumbix |
| T&M tag to change order request average time | 24 days | Clearstory |
| Daily log time (current practice) | 30–60 minutes | Projul |
| Daily log time (optimal) | Under 5 minutes | Projul |
| Cost of rework on construction budgets (US) | $30–40 billion/year | FMI 2023 |
| Procore typical pricing | $35,000–$80,000/year | User-reported (Reddit, G2) |
| Procore renewal increases (2023–2024) | 10–14% YoY | User-reported (Reddit) |
| Procore adoption abandonment (small/mid GCs) | ~73% within first year | BuildVision |
| Procore mobile app rating (Google Play) | 4.1/5 (3,080 reviews) | Google Play |
| Fieldwire App Store rating | 4.8/5 | Apple App Store |
| PlanGrid acquisition price | $875 million | Autodesk, 2018 |
| Fieldwire acquisition price | $300 million | Hilti, 2021 |
| PlanGrid team attrition post-acquisition | 40% within 18 months | Industry reporting |

---

*This document is the foundation. Every feature decision, every design review, every sprint prioritization, every hiring choice, and every investor conversation references this document. If an action doesn't serve this vision, it doesn't happen.*

*SiteSync PM. Built by a builder. For builders.*

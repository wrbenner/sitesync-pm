# Competitive Landscape — Construction Project Management Software

What each competitor does well, what they do poorly, and where the opportunity
lies. This is loaded into the strategic reasoning context so the system knows
what it's building against.

---

## Procore

**What they are:** The 800-lb gorilla. $1B+ revenue. 16,000+ customers.
The default choice for large commercial GCs.

**What they do well:**
- Breadth. They cover everything: RFIs, submittals, drawings, budget,
  schedule, quality, safety, invoicing, bidding, change orders.
- Market presence. "Nobody gets fired for choosing Procore." The sales
  team is enormous and effective.
- Integrations. They connect to everything — ERP systems, accounting
  packages, scheduling tools, BIM platforms.
- Mobile app is functional (not great, but it works in the field).

**What they do poorly:**
- Speed. The app is slow. Pages take 3-5 seconds to load. Navigating
  between sections feels like switching applications.
- Dashboard feels like an ERP. Dense, busy, data-heavy but insight-free.
  You get numbers but not meaning.
- No intelligence. Procore tells you what happened. It never tells you
  what's about to happen or what you should do about it.
- Pricing. $375-$550/user/month for enterprise. Small/mid GCs struggle
  to justify the cost.
- Innovation speed. Public company inertia. Major features take 12-18
  months to ship. They optimize for retention, not delight.

**Their blind spot:** They digitized paper processes. The RFI workflow in
Procore is a paper RFI turned into a web form. It doesn't think. It
doesn't predict. It doesn't warn. It's a filing cabinet with a URL.

---

## Fieldwire (Hilti)

**What they are:** Best-in-class field execution tool. Acquired by Hilti
in 2021 for $300M. Strong with superintendents and field teams.

**What they do well:**
- Excellent field experience. Fast, intuitive, designed for people in
  hard hats. The mobile app is genuinely good.
- Task management on drawings. Pin a task to a drawing location, assign
  it, track it. This workflow is seamless.
- Speed. The app is fast. Pages load instantly. Interactions feel native.
- Punch list management is best-in-class. Photo capture, markup, and
  assignment in one flow.

**What they do poorly:**
- Limited scope. Strong on field execution, weak on office/financial
  workflows. No serious budget tracking, limited RFI capabilities.
- Weak on analytics. Data goes in but insights don't come out.
- Enterprise features are thin. Multi-project portfolio views, company-
  level reporting, and cross-project analytics are basic.
- Since Hilti acquisition, focus has shifted toward tool integration and
  away from software innovation.

**Their blind spot:** They're excellent at the "last mile" (field execution)
but miss the "first mile" (planning, prediction, risk assessment). A
superintendent who uses Fieldwire still needs to open Procore/P6/Excel
for the big picture.

---

## PlanGrid → Autodesk Construction Cloud (ACC)

**What they were:** Elegant, beloved drawing management app. The iPad app
that made paper drawings obsolete on job sites. Acquired by Autodesk in
2018 for $875M.

**What they are now:** Absorbed into Autodesk Construction Cloud.
The original elegance is diluted.

**What they do well:**
- Drawing management is still strong. Version comparison, markup tools,
  hyperlinking between sheets.
- Autodesk ecosystem integration (Revit, BIM 360, Navisworks).
- Enterprise credibility. Large ENR Top 400 firms use ACC because they
  already pay for Autodesk.

**What they do poorly:**
- UX degraded significantly post-acquisition. The original PlanGrid
  was delightful. ACC feels like an Autodesk product — powerful but
  dense and unintuitive.
- Pricing and bundling are confusing. Multiple products, multiple tiers,
  unclear what you're paying for.
- Innovation has stalled. They're integrating products, not building
  new capabilities.
- The "single platform" promise hasn't materialized. ACC is still
  multiple products stapled together.

**Their blind spot:** They bet everything on BIM-to-field workflows.
But most commercial projects don't use BIM end-to-end, and field teams
don't think in 3D models. The gap between design technology and field
reality remains wide.

---

## Buildertrend

**What they are:** Leading residential/light commercial platform. Strong
with custom home builders, remodelers, and small commercial contractors.

**What they do well:**
- Great residential workflows (selections, proposals, warranties).
- Client-facing portal. Homeowners can see progress, make selections,
  and communicate through the platform.
- Onboarding is fast. A small builder can be up and running in a day.
- Pricing is accessible ($99-$499/month, not per-user).

**What they do poorly:**
- Weak at commercial scale. Project complexity beyond a single building
  quickly overwhelms the platform.
- No enterprise features. Multi-company collaboration, complex approval
  chains, and role-based access are basic.
- Financial tracking is simplified. No serious cost-loaded scheduling,
  earned value analysis, or change order management.
- Mobile app is adequate, not excellent.

**Their blind spot:** They optimized for simplicity and priced for the
SMB market. This means they can't move upmarket without rebuilding.
A GC doing $50M+ projects won't consider them.

---

## CMiC

**What they are:** Construction ERP. The financial and operational
backbone for large contractors. Deep integration with accounting,
HR, and project management.

**What they do well:**
- Financial depth. Job costing, WIP schedules, percent-complete,
  retention tracking — the accounting team loves it.
- Enterprise resource planning. Equipment, labor, materials tracking
  at a level no PM tool matches.
- Mature, battle-tested. Used by some of the largest contractors in
  North America.

**What they do poorly:**
- UX is brutal. Feels like 2005. Dense screens, tiny fonts, modal
  dialogs nested three deep. Training takes weeks.
- The UI is so bad that field teams refuse to use it. Data entry
  happens in the trailer, not on the floor.
- Speed is poor. Complex pages take 5-10 seconds to render.
- Modern SaaS expectations (SSO, API-first, webhooks, mobile) are
  poorly met.
- Implementation takes 6-12 months and costs more than the software.

**Their blind spot:** They're so deep in the back office that they've
lost the field. No superintendent wants to touch CMiC. This creates a
data gap: the most valuable real-time information (what happened on
site today) never enters the system.

---

## Sage 300 CRE (formerly Timberline)

**What they are:** The construction accounting standard. If a GC has
been around 20+ years, they probably run Sage.

**What they do well:**
- Accounting accuracy. The financial reporting is rock-solid.
- Industry-specific chart of accounts, job costing, compliance.
- Stability. It works. It has worked for decades.

**What they do poorly:**
- Zero modern UI. This is a Windows desktop application with a web
  portal bolted on. The interface is from the Windows XP era.
- No mobile presence. None.
- No field integration. Data flows from the field to a piece of paper
  to an admin who types it into Sage.
- No API to speak of. Integration requires middleware and custom work.

**Their blind spot:** They ARE the legacy system. Sage knows this. Their
strategy is retention (switching costs are enormous) rather than
innovation. Every year they lose a few customers to Procore + Sage
Intacct, but the base is sticky.

---

## What They ALL Get Wrong

This is the strategic opportunity:

1. **They digitize paper processes.** Every one of these tools takes a
   paper workflow (RFI form, daily log template, submittal register)
   and turns it into a web form. The workflow doesn't change. The
   software is a filing cabinet, not a brain.

2. **None of them think.** No product in this space looks at your data
   and tells you what matters. No product says "this RFI is going to
   delay your project by 2 weeks if you don't answer it today." No
   product connects the dots between weather forecast + concrete pour
   schedule + crew availability. The intelligence layer doesn't exist.

3. **They're organized by document type, not by insight.** You go to
   the RFIs page to see RFIs. You go to the budget page to see the
   budget. But no one connects "this RFI impacts this budget line
   which impacts this schedule milestone." The data lives in silos
   even though it's all in one database.

4. **They're slow.** Every legacy platform feels slow. Page transitions,
   loading spinners, clunky interfaces. Construction professionals
   use iPhones and Teslas — they know what fast software feels like.
   Construction software hasn't caught up.

5. **They treat the field as data entry.** The superintendent is the
   most important person on a construction project. But every tool
   treats them as a data entry clerk: "fill out this form, submit
   this log, upload these photos." No tool gives the superintendent
   *intelligence* — "here's what you should focus on today based on
   everything happening across your project."

---

## Where SiteSync PM Wins

The differentiation is not features. It's intelligence.

- **We don't just show data — we show meaning.** The dashboard doesn't
  list metrics; it highlights the ONE metric that needs attention.
- **We predict, not just report.** "This RFI pattern suggests a design
  coordination problem. Last time this happened on a project this size,
  it added 3 weeks to the schedule."
- **We organize by insight, not by document.** The copilot connects
  RFIs + budget + schedule into a single answer: "What should I worry
  about today?"
- **We're fast.** Sub-second navigation. No loading spinners. The UI
  feels like a tool, not an enterprise application.
- **We respect the field.** The superintendent is not a data entry
  clerk — they're the user who matters most. Everything we build
  should work with one hand, in gloves, in sunlight.

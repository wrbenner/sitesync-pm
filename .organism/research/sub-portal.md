# Sub Portal Architecture, Viral Adoption, and Network Effects
## Deep Research for a Construction PM Platform Competing with Procore

*Research compiled April 2026. Sources cited inline.*

---

## Table of Contents

1. [Procore's Sub Portal — How It Works](#1-procores-sub-portal)
2. [Competitor Sub Portals](#2-competitor-sub-portals)
3. [Viral Adoption Mechanics in Construction](#3-viral-adoption-mechanics)
4. [Free Tier Design](#4-free-tier-design)
5. [RLS Architecture for Sub Access](#5-rls-architecture)
6. [Network Effects and Data Moat](#6-network-effects-and-data-moat)
7. [Implementation Priorities](#7-implementation-priorities)
8. [Pricing Strategy](#8-pricing-strategy)
9. [Strategic Summary: The Playbook](#9-strategic-summary)

---

## 1. Procore's Sub Portal — How It Works

### 1.1 The Core Model: Unlimited Users, GC Pays

Procore's fundamental commercial insight is the **unlimited-user model**: the GC pays one annual fee (based on Annual Construction Volume), and every subcontractor, architect, owner, and consultant on every project can access Procore for free. There is no per-user incremental charge.

> *"Unlimited users are included in Procore's licensing, so GCs can add all subcontractors, owners, and architects to a project without per-user fees."*
> — [Downtobid, Plangrid vs Procore comparison, July 2024](https://downtobid.com/blog/plangrid-vs-procore)

This was a strategic masterstroke that enabled viral adoption: by removing friction for sub onboarding, Procore turned every GC customer into a growth engine. The GC's subs are exposed to Procore on every project.

### 1.2 What Subs Can Do (Access Matrix)

Procore grants subcontractors access **per project**, with permissions assigned by the GC's Procore administrator. The default subcontractor role is designed as a **collaborator** — limited write access to only what they're responsible for.

**What subs can do by default:**

| Tool | Typical Sub Permission | Notes |
|------|----------------------|-------|
| Documents | Read-only | View plans, specs, drawings |
| RFIs | Standard (create + view) | Can submit and view responses on assigned RFIs |
| Submittals | Read-only (Standard if assigned) | Can submit responses when added to workflow |
| Daily Logs | Standard | Can create their own daily logs |
| Photos | Standard | Can upload and view photos |
| Punch List | Read-only or Standard | View items assigned to them |
| Schedule | Read-only | View project schedule |
| Directory | Read-only | See project team contacts |
| Commitments | Read-only | View their own subcontract (if not Private) |
| Financials / Budgets | None | Hidden from subs by default |
| ERP Integrations | None | Hidden entirely |
| Change Orders (internal) | None | Owner changes hidden |
| Other subs' contracts | None | Private by default |

Sources: [Procore Support — View a Subcontract](https://v2.support.procore.com/product-manuals/commitments-project/tutorials/view-a-subcontract), [Procore Subcontractor Permissions Learning Path](https://support.procore.com/procore-learning-paths/general-contractor/subcontractor/permissions)

### 1.3 Permission Levels: The Four-Tier System

Procore uses four permission levels for every tool:
- **None** — Tool is invisible to the user
- **Read-Only** — Can view but not create or edit
- **Standard** — Can create, edit items within their scope
- **Admin** — Full access including private data and configuration

Subcontractors typically receive Read-Only or Standard on field tools, None on financial tools. Key nuances:
- **Private subcontracts**: If a GC marks a subcontract as Private, the sub can only see it if explicitly added to the Private list or given Admin on Commitments
- **Change Orders**: Only visible to users with Admin on Commitments, or those added to the Private list — subs cannot see COs by default
- **Granular permissions**: The GC can override defaults with granular permission templates. For example, they can grant "View Private Work Order Contract" as a granular permission without full Admin access

Source: [Procore Support — Permissions Templates](https://en-ca.support.procore.com/faq/what-is-a-permissions-template)

### 1.4 How Procore Handles Sub Invitations

The invitation flow is project-level and requires prior directory registration:

1. **GC creates sub profile** in Company Directory (name, email, company, role)
2. **GC adds sub to project** via Project Directory → Add User
3. **System sends "Welcome to Procore" email** from @procoretech.com domain
4. **Automated follow-ups** at 3, 7, and 14 days if the sub hasn't logged in
5. **Sub sets up password** and gains access to that specific project
6. **Each new project requires a new invitation** — even if the sub already has an account

Critical behavior: A sub's Procore identity is **tied to the GC's account instance**. If Jack Smith from ABC Concrete works with GC Gold and GC Silver (both Procore customers), he uses the same email but exists as two separate user records in two separate GC accounts. There is **no unified sub identity across GC accounts**.

Source: [Procore FAQ — Can a person be associated with multiple vendor/company records](https://v2.support.procore.com/faq-can-a-person-be-associated-with-multiple-vendor-company-records-in-the-company-directory/)

### 1.5 The Free Account Concept (Procore Construction Network)

Procore also offers a **free Procore account** (via the Procore Construction Network) — this is distinct from being invited as a collaborator. Free account holders have three permission levels:

| Permission Level | Actions |
|-----------------|---------|
| Member | View projects/bids they're invited to |
| Team Administrator | View projects/bids + manage company settings |
| System Administrator | Full user management |

The free account is primarily for subs who want to **claim their business page** on the Procore Construction Network and receive bid invitations. It is NOT a full project management product.

Source: [Procore — How do permissions work for free Procore accounts?](https://v2.support.procore.com/faq-how-do-permissions-work-for-free-procore-accounts)

### 1.6 The Procore Construction Network: The Data Play

The Procore Construction Network is a **free, publicly searchable directory of 215,000+ construction businesses**. Key features:
- Business pages show: trades served, geography, project history, RFIs completed, active projects in Procore
- GCs can add subs from the Network directly to their project directory
- When a sub is added from the Network, their **Procore project history data is visible** — number of projects completed, RFIs resolved, etc.
- This creates the beginning of a **cross-GC sub performance profile**

Source: [Procore Construction Network](https://www.procore.com/network), [About the Procore Construction Network](https://v2.support.procore.com/process-guides/about-the-procore-construction-network/common-questions/)

### 1.7 Sub Pain Points and Complaints

The sub experience in Procore is frequently described negatively. Key pain points from industry forums and Reddit:

**Pain Point 1: Loss of data at project close**
When a project closes, subs lose all access. RFI trails, daily logs, photos, submittals — gone. The GC controls the archive, not the sub. This is described as a "digital eviction from your own performance history."

> *"When that documentation resides exclusively within the GC's system, your defense strategy rests in someone else's control."*
> — [Procore blog: What subs lose when the GC closes the project, March 2026](https://www.procore.com/blog/what-subs-lose-when-gc-closes-project)

**Pain Point 2: Complexity for field use**
Procore is built for GC project managers, not field subcontractors. The UI is dense; subs find it over-engineered for what they need (view plans, submit RFIs, upload photos).

> *"I work for a large electrical contractor and I have a hard time seeing any subcontractor using procore unless they are directed to."*
> — [Reddit r/Construction, 2021](https://www.reddit.com/r/Construction/comments/oghlhi/any_of_you_specialty_subs_use_procore_if_so_how/)

**Pain Point 3: Forced adoption without value**
Subs are told "use Procore or we won't work with you" — they're doing data entry for the GC without getting workflow value in return.

**Pain Point 4: GC uses Procore as CYA, not coordination**
> *"I'm seeing more GCs treat Procore as a CYA info dump instead of actually managing the job."*
> — [Reddit r/MEPEngineering, February 2026](https://www.reddit.com/r/MEPEngineering/comments/1r7xv3y/procore_is_an_info_dump_gcs_use_to_avoid_real/)

**Pain Point 5: No sub-owned data**
Subs contribute their productivity data, BIM clash resolutions, and field documentation — but they lose that asset when the project closes, even though they created it.

**Pain Point 6: Procore Pay fee ambiguity**
If the GC uses Procore Pay, subs may be charged a transaction fee percentage on each payment received (the "Specialty Contractor Pays Fee Model"), creating friction. Source: [Procore Pay fee models](https://support.procore.com/products/online/procore-pay/faq/what-fee-models-does-procore-offer-to-payors-using-procore-pay)

---

## 2. Competitor Sub Portals

### 2.1 Autodesk Build / PlanGrid

**Before Autodesk Build (PlanGrid era):** PlanGrid used a per-user pricing model where subs needed their own licenses. GCs had to pay for sub licenses or limit who they invited. This created friction and was a competitive disadvantage vs. Procore.

**Current Autodesk Build model:** Autodesk Build (the successor to PlanGrid + BIM 360) moved to a more flexible model with Account-level and Project-level user types:

- **Account Admins**: Full access, manage all projects
- **Project Admins**: Full access within a project
- **Members**: Assigned role-based access within a project
- **Project Users**: Invited specifically to projects, not covered under the account owner's umbrella by default — *the account that owns the project may incur charges for project users*

**The key difference from Procore:** Autodesk charges based on seats/licenses. Adding a large sub network can increase costs. This is a material competitive disadvantage.

**Sub access in Autodesk Build:**
- Subs get project-level roles with configurable permissions
- Role-based folder permissions in Autodesk Docs (plans, documents by folder)
- Custom roles can be created with specific access levels per module
- Members can be assigned "Member" (not Admin) to restrict what they see

Source: [PlanGrid/Autodesk Build FAQ via Microsol Resources](https://microsolresources.com/tech-resources/article/top-things-to-know-about-plangrid-autodesk-build/), [Autodesk Docs role management](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-assign-role-based-folder-permissions-in-ACC.html)

**Pricing:** Autodesk Build starts at ~$50-$80/user/month for lower tiers, up to ~$140/user/month for unlimited sheets. Enterprise pricing for flat-rate unlimited users exists. Legacy PlanGrid users retained old pricing.

Source: [PlanGrid/Autodesk Build pricing analysis, Downtobid 2025](https://downtobid.com/blog/plangrid-cost)

### 2.2 BuildingConnected (Autodesk)

BuildingConnected is a **preconstruction and bid management** platform, not a full PM platform. Its sub relationship is fundamentally different:

**For GCs:** Paid subscription ($3,600-$15,000+/year) provides:
- Unlimited bid invites from a network of 700,000+ subs
- Bid leveling, comparison, analytics
- Document sharing during bidding
- TradeTapp for sub prequalification (sold separately)
- Bid Board Pro for multi-project bid tracking

**For subs:** The **Bid Board** product is effectively **free** (basic version). Subs:
- Receive bid invitations in one centralized inbox from any GC using BuildingConnected
- Submit bids, track bid status, message GCs, access project files
- Invite their own vendors/suppliers to view bid files (limited access, no bid submission)
- Cross-GC identity: **Single login sees invitations from ALL GCs** — this is the critical difference from Procore

**The cross-GC identity model:** BuildingConnected solved the multi-GC problem by being the neutral network. A sub creates one Bid Board account and sees all their bid invitations regardless of which GC sent them. This is a massive adoption enabler for subs.

Source: [BuildingConnected — What is BuildingConnected?](https://support.buildingconnected.com/hc/en-us/articles/360019964273-What-is-BuildingConnected), [BuildingConnected sub vendor invitations](https://support.buildingconnected.com/hc/en-us/articles/360023645294)

**Pain point:** Subs report spammy irrelevant bid invitations, mandatory sign-up friction, and BuildingConnected has increased prices significantly (reported 2x+ in 2025), leading to churn. Source: [Downtobid — How much is BuildingConnected 2024](https://downtobid.com/blog/how-much-is-building-connected)

### 2.3 GCPay (Payapps internationally)

GCPay is a **payment-specialized** platform focused entirely on the application for payment workflow between GCs and subs.

**The model:**
- GC pays for GCPay subscription
- **Subs access GCPay for free** to submit their payment applications
- All subs see digital AIA G702/G703 forms, submit pay apps online, track approval status
- Lien waiver exchange is automated and digital
- Compliance documents (insurance, W-9) collected before payment processing

**Key sub value propositions:**
- Know exactly when payment was approved and when it will arrive
- Reduce phone calls chasing payment status
- Electronic ACH payment capability
- Automatic notification when documents expire
- Sub-tier management (subs can manage their own sub-tier subs)

**GCPay pricing:** GC pays; subs are free. GCPay integrates with Sage 300, Viewpoint Vista, CMiC, QuickBooks, and other ERPs. Usage stats: 2.7M+ compliance documents exchanged, 48,000+ lien waivers.

Source: [GCPay overview — Kolena.com 2025](https://www.kolena.com/blog/gcpay-streamlining-construction-payments-with-automation-and-ai/), [GCPay official site](https://ww3.gcpay.com)

**GCPay's viral mechanic:** GCs who pay faster and are more transparent attract better subs. When GCs use GCPay, their reputation for payment transparency becomes a competitive advantage in hiring quality subs. The platform itself becomes a virtuous cycle — subs prefer working with GCPay-enabled GCs.

### 2.4 Oracle Textura (Textura Payment Management)

Textura (acquired by Oracle, now Oracle Construction & Engineering) is GCPay's primary enterprise competitor:

- Serves 120,000+ projects, connects 800+ GCs with 200,000+ subs
- Subs can enroll in electronic payments when accepting their contract, or later during invoicing
- Enrollment is **optional** for subs; they can decline and re-enroll later
- When enrolled, subs receive accelerated payment (weeks faster than paper checks)
- Handles sub-tier compliance, lien waivers, compliance tracking

**Pricing model:** Owner/GC pays; sub access is free but sub enrollment in e-payments is incentivized. Textura charges transaction fees on payments processed.

Source: [Oracle Textura Payment Management](https://www.oracle.com/construction-engineering/textura-construction-payment-management/), [Surety Systems Textura guide 2025](https://www.suretysystems.com/insights/streamlining-construction-payments-with-oracle-textura-a-complete-guide/)

**Key insight:** Textura and GCPay demonstrate the "GC pays, subs are free" model is the clear market standard for payment-workflow tools. The sub value exchange is: **faster payment + visibility = free adoption**.

### 2.5 Fieldwire (Hilti)

Fieldwire is a **field management** platform (acquired by Hilti, ~2022). It has a tiered sub access model that is importantly **charged to the GC for project users**:

**Account permission levels:**
- **Account Managers**: Full account access; manage all projects
- **Account Users**: Create and access own projects; covered under account license
- **Project Users**: Invited to individual projects only; **the account that owns the project incurs a charge for project users** if over the license limit

**Project permission levels:**
- **Admins**: Full project access (create tasks, upload plans, delete projects)
- **Members**: Can create tasks, markups, invite users
- **Followers**: View plans, create tasks, add photos — **read-mostly access**

**Sub access in practice:** A sub (project user, follower) can:
- View plans, add markups
- Create and view tasks assigned to them
- Submit photos to tasks
- On Business/Business+ tiers: create RFIs, submittals, change orders as "Contributor" (not Manager)
- "Manager" PM access: Create RFIs, submittals, push through workflows

**Fieldwire's pricing:** $39-$54/user/month for Pro, $59-$69 for Business. Free plan: up to 5 users only, limited to basic features. No "free for subs" model — subs either get their own license or are on the GC's account (which may trigger overage charges).

Source: [Fieldwire account permissions help](https://help.fieldwire.com/hc/en-us/articles/115000637206-Introduction-to-Account-Permission-Levels-Managers-Account-Users-and-Project-Users), [Fieldwire project permissions help](https://help.fieldwire.com/hc/en-us/articles/205654334-Introduction-to-Project-Permission-Levels-Administrators-Members-and-Followers), [Best free construction management software 2026 — Ingenious Build](https://www.ingenious.build/blog-posts/top-5-free-construction-software-tools-in-2025)

### 2.6 Competitive Summary Table

| Platform | Sub Access Cost | Cross-GC Identity | Sub's Data Ownership | Viral Mechanism |
|----------|----------------|-------------------|---------------------|-----------------|
| Procore | Free (collaborator) | No — per-GC instance | Lost at project close | GC mandates → sub exposure |
| Autodesk Build | Per-user billing may apply | No — per-GC instance | Similar to Procore | Weak; per-user friction |
| BuildingConnected | Free (Bid Board basic) | **Yes — single login** | Preconstruction only | Sub value → advocacy |
| GCPay | Free (pay apps only) | No | Payment records only | Faster payment → GC preference |
| Textura | Free (payment enrollment) | No | Payment records only | Enterprise mandate |
| Fieldwire | GC pays for project users | No | Project-specific | Field crew advocacy |

---

## 3. Viral Adoption Mechanics in Construction

### 3.1 The Fundamental Mechanic: GC Mandate → Sub Adoption → Sub Evangelism

The viral loop in construction software follows a well-documented three-stage pattern:

**Stage 1 — GC Mandate:** A GC decides to use Platform X and mandates that all subs on their projects use it. Subs don't choose; they comply. This is a "push" onboarding — the sub is forced.

**Stage 2 — Sub Habituation:** The sub is now using Platform X on a live project. If the platform delivers genuine value (easier RFI submissions, payment visibility, document access on mobile), the sub moves from compliance → habit.

**Stage 3 — Sub Evangelism:** The sub, now habituated, encounters a new GC who uses a different system or no system. The sub says: "We prefer working in Platform X — do you use it?" This is the viral pull moment. The sub becomes a demand-creation agent for the platform.

**The viral coefficient formula:**
```
K = (avg subs per GC project) × (% of subs who adopt) × (% of habituated subs who advocate) × (% of advocacy that converts new GCs)
```

For Procore historically:
- Avg 15-30 sub/trade companies per commercial project
- ~60-80% sub adoption rate (compliance is high when GC mandates)
- ~20-30% of subs become advocates
- ~10-15% of advocacy converts a new GC to Procore
- K ≈ 0.3-0.9 per project per quarter (meaningful but below 1 without marketing)

Source: [Muro AI — Procore's viral project network model](https://www.muro.ai/blog/ai-construction-tech-and-the-power-of-distribution-channels), [OpenView — Viral coefficient for SaaS](https://openviewpartners.com/blog/the-network-effect-the-importance-of-the-viral-coefficient-for-saas-companies/)

### 3.2 How Procore Achieved Market Dominance

Procore's growth story is the canonical case study in construction software virality:

1. **The unlimited-user breakthrough (~2010s):** By eliminating per-user fees, Procore removed the #1 barrier to GC adoption — the cost of onboarding large sub networks. Suddenly a GC could invite 50 subs without a $50k license increase.

2. **Each project became a viral vector:** Every collaborator on a Procore project is a potential future customer. The GC's subs got exposed on one job, then advocated for Procore on the next.

3. **Network flywheel:** As Procore's sub network grew, its directory and Construction Network became increasingly valuable. A GC new to Procore could find qualified subs who already had Procore accounts — lowering adoption friction.

4. **App marketplace:** Procore built an ecosystem of integrations, turning the platform into the central system of record. This deepened switching costs beyond just sub relationships.

5. **Result:** 2+ million users in 150+ countries, 17,501 customers as of June 2025, going public as the dominant construction PM platform.

> *"By eliminating per-user friction, Procore turned each project into a viral vector: every collaborator on a Procore project is a potential customer for the platform."*
> — [Muro AI, 2025](https://www.muro.ai/blog/ai-construction-tech-and-the-power-of-distribution-channels)

Source: [Investors.com — How Procore's CEO Built a Billion-Dollar Software Company](https://www.investors.com/research/the-new-america/procore-stock-construction-software/), [PESTEL — Procore Growth Strategy](https://pestel-analysis.com/blogs/growth-strategy/procore)

### 3.3 Barriers to Viral Adoption in Construction

Despite the structural opportunity, several forces slow viral adoption:

| Barrier | Description | Severity |
|---------|-------------|---------|
| **Fragmentation** | Each GC uses a different platform; subs face 5-7 tools simultaneously | High |
| **Complexity aversion** | Field workers are not tech-savvy; multi-module platforms overwhelm | High |
| **Email inertia** | Many subs still prefer email; GC can't force behavior change, only compliance | Medium |
| **Platform fatigue** | Subs already pay for ISNetworld, Avetta, etc.; another login is friction | High |
| **Data lock-in fear** | Subs fear contributing data they'll lose when the project ends | Medium |
| **Small sub resistance** | Sub companies with 5-10 people have no PM bandwidth for complex software | High |
| **Connectivity** | Field workers often offline; web-heavy tools fail in the field | Medium |

Source: [Fieldwire — Guide for subcontractors new to construction software, 2025](https://www.fieldwire.com/blog/guide-construction-software/), [Reddit r/Construction threads on Procore adoption]

### 3.4 What Makes a Sub WANT to Use the Tool

The shift from "forced compliance" to "genuine want" happens when the sub gets value that the GC doesn't provide:

**High-value drivers for subs:**
1. **Mobile plan access** — "All the prints in my pocket." The #1 most cited benefit from subs.
2. **Payment transparency** — Know when the pay app was approved and when the check arrives.
3. **Their own data** — RFI history, photos, daily logs they *own* and can export.
4. **Faster RFI responses** — Reduced waiting time on critical path items.
5. **Cross-GC portability** — One login, multiple GCs, one dashboard of their work.
6. **Performance history** — A record they can show the next GC: "Here's our defect rate, RFI response time, schedule adherence."

**The critical insight:** Procore's sub portal is GC-centric — it serves the GC's need for compliance and documentation, not the sub's operational needs. A platform that genuinely helps subs run their business (not just satisfy the GC) will generate pull adoption.

### 3.5 Free Features That Create Sub Evangelism

Based on research into sub pain points and adoption patterns, these features most reliably create advocates:

1. **Permanent project history** — Subs keep their data after project close; they OWN their performance record
2. **Cross-GC dashboard** — "All my active projects, regardless of which GC uses what platform"
3. **Mobile-first plan viewer** — Fast, offline-capable, easy markup
4. **Payment tracking** — Real-time visibility into pay app status across all projects
5. **One-click RFI submission** — Dramatically faster than email chains
6. **Performance badge/score** — Shareable credentials for their next GC pitch

---

## 4. Free Tier Design

### 4.1 The Freemium Framework: What's Free vs Paid

The correct mental model: **the sub portal is a growth channel, not a revenue line**. Subs being free drives GC adoption, which is where revenue is generated.

#### FREE FOR SUBS (Always)

These features should be permanently free because they (a) create viral adoption, (b) generate data that benefits the platform, and (c) create switching costs for subs:

| Feature | Rationale |
|---------|-----------|
| **Read-only project access** | Core value prop; zero marginal cost |
| **RFI viewing** | Subs need to see their open/closed RFIs |
| **Submittal status viewing** | Track approval status of their submittals |
| **Document/plan access** | Plans on mobile; this is the #1 sub use case |
| **Schedule viewing** | Know when their work is due |
| **Daily log viewing** (GC logs) | Contextual awareness of project status |
| **Punch list viewing** (items assigned to them) | Know what needs fixing |
| **Photo viewing** | See project progress, their own photos |
| **Payment application status** | When was my pay app approved? |
| **Basic company profile** (cross-GC) | Claim their identity on the platform |
| **Project history archive** | Their own data, permanently accessible |
| **Notifications/messaging** | Communication from GC |

#### FREE TO SUBMIT (Write Access — Also Free)

These write-access features should ALSO be free because they generate data and reduce friction in the viral loop:

| Feature | Rationale |
|---------|-----------|
| **RFI creation** | Subs MUST be able to create RFIs to do their job; gating this creates friction that hurts GC adoption |
| **Submittal uploads** | Same as RFIs; workflow-critical |
| **Daily log creation** (their own logs) | Data generation; subs own their field notes |
| **Photo uploads** | Documentation; zero marginal cost |
| **Punch list item responses** | Respond to items assigned to them |
| **Pay app submission** | Gate this and you'll never get sub adoption |

#### PAID FOR SUBS (Upgrading to a Sub-Paid Tier)

These features are genuinely GC-oriented or enterprise features that subs would pay for when they want to run projects, not just participate in them:

| Feature | Target Buyer | Why It's Paid |
|---------|-------------|---------------|
| **Creating new projects** | Sub acting as GC | Full PM capability |
| **Managing their own sub network** | Large specialty contractors | GC-level functionality |
| **Analytics & reporting** | Operations teams | Business intelligence |
| **Portfolio dashboard** (all projects, all GCs) | Project managers | Advanced use case |
| **AI features** (spec analysis, risk flags, claim documentation) | Power users | Premium value |
| **Advanced prequalification profile** | Subs seeking preferred-vendor status | Value-add service |
| **Sub-to-GC upgrade path** | Specialty contractor who also acts as GC | Full platform purchase |

### 4.2 The Critical Design Principle: Don't Gate RFI Creation

The biggest mistake competing platforms make is charging subs to **create** RFIs and submittals. This destroys the viral loop:

- GC mandates the platform → Sub is forced to adopt → Sub hits a paywall to submit an RFI → Sub goes back to email → GC gets no adoption benefit → GC churns from the platform

**The correct model:** Sub write access (RFIs, submittals, daily logs, pay apps) should be free. The GC's admin overhead for reviewing and processing those submissions is why they're paying for the platform.

### 4.3 Fieldwire's Free Plan as Competitive Context

Fieldwire's free plan: up to 5 users, basic task tracking, plan viewing, punch lists. It's designed for tiny teams, not viral sub adoption. Their per-user billing model fundamentally conflicts with the viral dynamic — source: [Ingenious Build — Best Free Construction Management Software 2026](https://www.ingenious.build/blog-posts/top-5-free-construction-software-tools-in-2025)

### 4.4 The "Aha Moment" for Subs

Based on construction software onboarding research, subs reach their retention point (and become advocates) when they:
1. **First view plans on mobile** without printing — usually within first 5 minutes
2. **First submit an RFI** without sending an email — within first project week
3. **First see their pay app status** in real-time — payment period 1
4. **First export their project archive** — at project close

Source: [Construction software churn reduction research — SaaS Hero](https://www.saashero.net/customer-retention/construction-software-churn-reduction-marketing/)

---

## 5. RLS Architecture for Sub Access

### 5.1 The Core Problem

A construction PM platform must handle multiple distinct security boundaries simultaneously:
- **Tenant isolation**: GC A's data is invisible to GC B
- **Project isolation**: Sub can only see projects they're invited to
- **Role-based access**: Sub can read documents but not write to financials
- **Scope-based access**: Electrical sub sees electrical RFIs, not mechanical
- **Cross-GC sub identity**: Same physical person works for GC A and GC B

PostgreSQL Row Level Security (RLS) is the correct architectural foundation for this.

### 5.2 RLS Architecture Overview

PostgreSQL RLS works by adding invisible WHERE clauses at the database level, evaluated on every query. It is the correct pattern for multi-tenant SaaS because:

- All tenant data shares the same tables (pool model) — lowest operational cost
- Security is enforced at the database tier, not application tier — reduces attack surface
- Deny-by-default: if no policy matches, zero rows returned (safe failure mode)
- Application sets session context (`SET app.current_tenant = 'uuid'`) per connection

Source: [AWS — Multi-tenant data isolation with PostgreSQL RLS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/), [Querio — RLS for Multi-Tenant SaaS](https://querio.ai/articles/row-level-security-multi-tenant-saas-analytics)

### 5.3 Role Hierarchy for Sub Access

```
PLATFORM LEVEL
├── platform_admin (bypasses all RLS, operational use only)
│
TENANT LEVEL (GC Company Account)
├── gc_admin (full access to all projects in GC's account)
├── gc_pm (project manager — full access to assigned projects)
├── gc_super (superintendent — limited financial access)
│
PROJECT LEVEL
├── project_owner_rep (read-only on everything)
├── subcontractor (scoped access — the key role)
│   ├── scope: project_id + company_id
│   └── trade_scope: optional spec_section filter
└── invoice_contact (pay app access only)
```

### 5.4 The Subcontractor RLS Policy Design

**Core principle:** A subcontractor can see anything related to their project assignment, filtered to their scope.

```sql
-- Core sub policy: can see rows in project they're invited to
CREATE POLICY sub_project_isolation ON rfis
USING (
  project_id IN (
    SELECT project_id 
    FROM project_members 
    WHERE user_id = current_setting('app.current_user')::uuid
    AND role = 'subcontractor'
  )
);

-- Scope-limiting policy: only see RFIs assigned to their company
-- or RFIs that are "project-wide" (broadcast)
CREATE POLICY sub_scope_isolation ON rfis
USING (
  responsible_company_id = current_setting('app.current_company')::uuid
  OR visibility = 'project_wide'
);

-- Financial isolation: subs NEVER see budget, cost codes, or other subs' contracts
CREATE POLICY no_sub_financials ON budget_line_items
USING (
  current_setting('app.current_role') NOT IN ('subcontractor', 'invoice_contact')
);

-- Read-only enforcement: combine with application-layer role check
-- (RLS handles row filtering; application handles write permission check)
```

### 5.5 The Three Sub Access Models

**Model A: Whole-Project Visibility (Simplest)**
Sub sees ALL RFIs, ALL submittals, ALL daily logs for the project. No trade filtering. Simple to implement, matches how smaller projects actually work.

Pros: Easiest to implement, mirrors real-world (subs often need cross-trade awareness)
Cons: Subs see other subs' RFIs; some GCs dislike this

**Model B: Company-Scoped Visibility**
Sub sees only items where `responsible_company_id = their company` OR items tagged as "all-project." This is the Procore model — subs primarily see their own RFIs, submittals, and tasks.

Pros: Clean separation; privacy for other subs
Cons: Subs lose awareness of adjacent trade issues that affect their schedule

**Model C: Trade/Spec-Section Scoped Visibility**
Sub sees items tagged to their CSI division(s). Electrical sub sees Division 26 specs, submittals, and RFIs. This is the most granular model.

Pros: Maximum relevance; reduces information overload
Cons: Most complex to implement; requires consistent spec-section tagging; can fail if GC doesn't tag correctly

**Recommendation:** Implement Model B as default, with Model C as an opt-in feature ("enable trade-scoped filtering"). Model A should be available as a project-level setting for small/simple projects.

### 5.6 Schema Pattern for Sub Scoping

```sql
-- Core tables with sub-access scaffolding
CREATE TABLE project_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id),
  user_id       UUID NOT NULL REFERENCES users(id),
  company_id    UUID NOT NULL REFERENCES companies(id),
  role          TEXT NOT NULL CHECK (role IN ('gc_admin', 'gc_pm', 'subcontractor', 'owner_rep', 'invoice_contact')),
  trade_scopes  TEXT[], -- e.g., ['16', '26', '28'] for electrical CSI divisions
  access_level  TEXT NOT NULL DEFAULT 'standard' CHECK (access_level IN ('read_only', 'standard', 'admin')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rfis (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES projects(id),
  tenant_id             UUID NOT NULL REFERENCES tenants(id), -- GC's account
  responsible_company_id UUID REFERENCES companies(id),
  spec_section          TEXT, -- CSI division, e.g., '26 05 00'
  visibility            TEXT DEFAULT 'company_scoped' CHECK (visibility IN ('project_wide', 'company_scoped')),
  -- ... other fields
);

-- RLS policy combining tenant + project + scope isolation
CREATE POLICY rfi_sub_access ON rfis
FOR SELECT
USING (
  tenant_id = current_setting('app.current_tenant')::uuid
  AND project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = current_setting('app.current_user')::uuid
  )
  AND (
    -- If user is GC role: see all RFIs in project
    current_setting('app.current_role') IN ('gc_admin', 'gc_pm', 'gc_super')
    OR
    -- If sub: see own company's RFIs or project-wide RFIs
    (
      current_setting('app.current_role') = 'subcontractor'
      AND (
        responsible_company_id = current_setting('app.current_company')::uuid
        OR visibility = 'project_wide'
      )
    )
  )
);
```

### 5.7 Handling Cross-GC Sub Identity

This is the architectural decision that determines whether you build a **GC-owned platform** or a **sub-empowering platform**:

**Option A (Procore model): Subs are users within GC accounts**
- Sub's identity is scoped to each GC's account
- Sub uses same email to log in to GC A's instance and GC B's instance
- Sub's data from GC A is invisible to GC B
- Simple to implement; GC has full control

**Option B (BuildingConnected model): Subs have a platform-level identity**
- Sub creates ONE account on your platform
- Sub sees all their projects across all GCs who use your platform
- GC A and GC B both see the sub in their directory, but the sub has one canonical record
- Enables cross-GC performance data, portfolio views, and true sub-side value

**Recommendation: Build Option B**. This is the key competitive differentiation vs. Procore. Implementing it requires:

```sql
-- Platform-level identity
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT UNIQUE NOT NULL,
  -- NO tenant_id here — users are platform-level
);

CREATE TABLE companies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  platform_claimed BOOLEAN DEFAULT FALSE -- has sub claimed this company profile?
  -- NO tenant_id — companies are platform-level
);

-- The join table that creates GC-tenant-scoped context
CREATE TABLE tenant_company_memberships (
  tenant_id  UUID REFERENCES tenants(id),
  company_id UUID REFERENCES companies(id),
  -- GC-specific data about this company goes here
  PRIMARY KEY (tenant_id, company_id)
);
```

RLS then uses `tenant_id` to scope GC-specific data while the user and company records are global.

### 5.8 Performance Considerations

- Index `tenant_id`, `project_id`, `company_id`, and `user_id` on every table that has RLS policies
- Use `SET LOCAL` not `SET` for session variables in transactions — prevents context leakage in connection pooling
- Avoid table joins in RLS predicates where possible — inline the lookup or use session variables
- Do NOT use server-side connection pooling (pgBouncer in transaction mode) with session-variable RLS — use per-session pooling or inject tenant context at the application query layer
- Test with 100k+ rows per table in CI to catch performance regressions from RLS predicate evaluation

---

## 6. Network Effects and Data Moat

### 6.1 The Data Accumulation Model

Every sub interaction on your platform generates data that makes the platform more valuable:

| Data Type | Source | Value Created |
|-----------|--------|---------------|
| **RFI response times** | RFI workflow | Sub performance scoring |
| **Submittal approval rates** | Submittal workflow | Quality reputation signal |
| **Defect/punch list rates** | Punch list completions | Field quality indicator |
| **Schedule adherence** | Project schedule vs actuals | Reliability scoring |
| **Pay app submission timing** | Invoice workflow | Professionalism signal |
| **Capacity/availability** | Active project count | Staffing insights |
| **Scope of work history** | Commitment records | Trade expertise profiling |
| **Pricing patterns** | Subcontract values (anonymized) | Market rate benchmarking |
| **Safety records** | Incident reports, inspections | Risk profiling |
| **Geographic coverage** | Project location history | Where they operate |

### 6.2 How This Data Creates Switching Costs

**For GCs:** A GC who has 3 years of sub performance data on your platform faces a real switching cost:
- They'd lose their curated sub performance history
- They'd lose their prequalified sub list with track records
- They'd start from scratch evaluating subs on any new platform

**The virtuous cycle:**
```
More GC projects → More sub performance data → 
Better GC recommendations → GCs prefer your platform → 
More GC projects...
```

**The data network effect:** Unlike Procore (where sub data is siloed per GC), a platform that shares *anonymized cross-GC performance signals* creates data that NO SINGLE GC COULD HAVE ALONE. An electrical sub who has completed 47 projects with 23 GCs on your platform has a verifiable, cross-referenced performance record. This is genuinely new value.

Source: [Victor Muchiri — Why Preconstruction Agents are the Startup Wedge, 2025](https://victormuchiri.substack.com/p/why-preconstruction-agents-are-the), [Procore Construction Network data](https://v2.support.procore.com/process-guides/about-the-procore-construction-network/common-questions/)

### 6.3 Sub Performance History as a Marketplace Asset

The long-term moat is a **verified sub performance marketplace** — analogous to contractor reviews but based on real project data, not self-reported credentials:

**Data points per sub company (accumulated over time):**
- Response time P50/P90 for RFIs across all projects
- Average defect rate (punch list items per $1M contract value)
- On-time completion rate
- Change order frequency (lower = better coordination)
- Payment timeliness (do they submit pay apps on time?)
- Repeat hire rate (what % of GCs who used them once hired them again?)

**For subs who opt-in to sharing their performance profile**, this becomes a competitive advantage in bidding. They can show a "Verified Performance Score" to new GCs.

**Analogous moat examples:**
- Upwork's contractor reviews create lock-in for both freelancers and clients
- Amazon Seller performance scores create switching costs for sellers
- ISNetworld's safety pre-qualification database (800+ enterprise buyers, 70,000+ contractors) commands $875-$1,500/year subscription from subs — source: [Billy vs ISNetworld vs Avetta, 2026](https://billyforinsurance.com/resources/billy-vs-isnetworld-vs-avetta-subcontractor-prequalification/)

### 6.4 How This Data Attracts New GCs

The data flywheel creates a direct GC acquisition channel:

1. **GC hears about platform** from a sub they trust
2. **GC evaluates sub performance data** — sees verified track records for subs they already work with
3. **GC realizes all their subs are already on the platform** (because those subs were invited by other GCs)
4. **GC adopts** because sub friction is zero — their trades are already onboarded

This is the exact dynamic BuildingConnected built, but for execution (not just bidding). When 70%+ of a GC's regular sub network is already on your platform, their decision to switch from Procore becomes frictionless from a sub-management perspective.

### 6.5 The Sub Availability/Capacity Data Moat

An underexplored data asset: **sub capacity and availability**. If subs maintain their profile with current project load, the platform can surface insights like:
- "ABC Electrical is currently on 4 active projects in Phoenix; they may not be available for a June start"
- "XYZ Concrete has recently completed 3 projects and has available capacity"

No competitor has this data today because no competitor has a cross-GC sub profile that persists beyond individual projects.

---

## 7. Implementation Priorities

### 7.1 Minimum Viable Sub Portal (2-Week Build)

**Goal:** Create the viral invitation loop. A GC invites a sub; the sub has an immediately useful experience.

**Must have in 2 weeks:**
1. **Email invitation flow**
   - GC inputs sub email + company name + role assignment
   - System sends branded "You've been invited to [Project Name]" email
   - One-click magic link → password setup → project dashboard
   - Mobile-responsive (subs often click links from phone)
   
2. **Sub dashboard: Project overview**
   - Project name, address, phase
   - Their assigned trade/scope
   - GC contact (project manager)
   - Quick action buttons: "View Plans", "Open RFIs", "Submit Daily Log"

3. **Document/plan viewer** (read-only)
   - Most recent drawing sets, organized by discipline
   - Basic mobile viewer (pinch-to-zoom, annotation view)
   - File download capability

4. **RFI list** (assigned to their company)
   - Open RFIs with status and ball-in-court indicator
   - Create new RFI (simple form: title, description, photo attachments)
   - View responses and history

5. **Notifications** (email + in-app)
   - "RFI #42 has been answered"
   - "New drawings uploaded"
   - "Pay app #3 approved"

**Not in 2 weeks:** Analytics, AI features, advanced RLS scoping, multi-GC portfolio view, payment processing.

### 7.2 Phase 2 Features (2-Month Build)

1. **Submittal workflow** — Sub can upload submittal documents, track approval chain status
2. **Daily log creation** — Sub-side daily logs with weather, manpower counts, work performed
3. **Punch list response** — View items assigned to their company, mark complete, add photos
4. **Pay app submission** — AIA-format pay app with schedule of values, stored for history
5. **Cross-project dashboard** — Sub sees ALL their active projects (across all GCs on the platform)
6. **Sub company profile** — Claimed profile: trades, geography, past projects (with permission)
7. **Permanent archive** — All project data accessible after project close (the key differentiator vs. Procore)
8. **Mobile app (PWA or native)** — Offline plan access, photo upload, RFI push notifications

### 7.3 Phase 3 Features (6-Month Build)

1. **Cross-GC performance dashboard** — Sub sees their own performance metrics aggregated across all GCs
2. **Trade-scoped RFI filtering** — Opt-in spec-section filtering so electrical sub only sees electrical RFIs
3. **Sub-to-GC upgrade path** — Sub company that also manages projects can upgrade to GC tier
4. **Prequalification module** — GCs can run pre-qualification questionnaires; subs fill them once, share cross-GC
5. **AI RFI assistant** — Suggest spec section references, flag similar closed RFIs, draft responses
6. **Sub performance scoring** — Opt-in, with verified cross-project metrics
7. **Capacity/availability signaling** — Sub indicates current project load; GCs see availability

### 7.4 The Onboarding Flow

**Critical principle:** First login must deliver value in under 3 minutes. Any friction here kills the viral loop.

```
EMAIL INVITATION (sent by GC admin)
Subject: "[GC Company] invited you to [Project Name] on [Platform Name]"
Body: 
  - Project name + location + GC PM contact
  - What they can do: "View plans, submit RFIs, track payment status"
  - ONE big CTA: "Accept Invitation & Set Up Your Account"
  - Magic link (token-based, 7-day expiry with auto-resend)

CLICK MAGIC LINK → PASSWORD SETUP (30 seconds)
  - Set password (or allow Google/Microsoft SSO)
  - Confirm company name (pre-filled from GC's invite)
  - Optional: Add phone for SMS notifications

FIRST-TIME SUB DASHBOARD (immediate value)
  - Banner: "Welcome to [Project Name]. Here's what's waiting for you:"
  - Card 1: "3 Open RFIs — you're the ball-in-court"
  - Card 2: "New drawings uploaded 2 days ago"
  - Card 3: "Your pay app is due in 5 days"
  - Big CTA: "View Plans" (most universally valuable first action)

PLAN VIEWER (within 2 minutes of invitation)
  - Opens most recent drawing set
  - Pinch to zoom, tap to annotate
  - "This is the pull moment" — sub realizes the value

FOLLOW-UP EMAIL (Day 3, if no RFI submitted)
  Subject: "Quick tip: How to submit an RFI in [Platform]"
  - 30-second GIF walkthrough
  - Link back to open RFIs
```

### 7.5 Handling Subs Who Work for Multiple GCs

The cross-GC identity problem is fundamental. Two approaches:

**Approach A: Federated (recommended):** One account, multiple tenant contexts.
- Sub creates one account with their email
- They appear in multiple GC directories (one per GC they work with)
- Their login takes them to "My Projects" — showing projects from ALL GCs using your platform
- Each GC's project is isolated (RLS): sub can't see GC A's financials from GC B's project
- Sub's own data (their RFIs, daily logs, photos) is accessible from their account regardless of which GC

**Approach B: Per-GC accounts (Procore model):** Separate logins per GC.
- Simple to implement
- Creates frustration for subs (multiple passwords, contexts)
- Destroys the cross-GC portfolio value proposition
- Don't do this if you want genuine sub-side adoption

---

## 8. Pricing Strategy

### 8.1 Current Procore Pricing Model

Procore uses **Annual Construction Volume (ACV) pricing** — a percentage of the aggregate dollar value of construction work processed through the platform:

| ACV Range | Approx. Annual Cost | Effective % of Volume |
|-----------|--------------------|-----------------------|
| $5M ACV | $4,500-$15,000/yr | 0.09%-0.3% |
| $50M ACV | $35,000-$60,000/yr | 0.07%-0.12% |
| $100M ACV | $60,000-$120,000/yr | 0.06%-0.12% |
| $500M+ ACV | Custom, often $200k+ | 0.04%-0.08% |

Real-world examples:
- $55M work volume → ~$55k/year (0.1%)
- $59M project → ~$80k/year for no-financial-modules package
- $38M project → $110k for 16 months (~0.3% of project cost)

Annual renewals have been increasing 10-14% in recent years, creating churn risk and competitor opportunity.

Source: [SubmittalLink — Procore Pricing Deep Dive 2026](https://www.submittallink.com/post/procore-pricing), [CountOnACTS — How Much Does Procore Actually Cost 2025](https://www.countonacts.com/blog/how-much-does-procore-actually-cost)

**Procore also charges for modules separately:**
| Module | Estimated Annual Add-On |
|--------|------------------------|
| Project Management | $4,500-$7,200 |
| Financials (ERP, Budgeting) | $6,000-$12,000 |
| Quality & Safety | $2,400-$5,000 |
| Field Productivity | $3,000-$6,000 |
| Preconstruction | $2,400-$4,800 |
| Analytics Pack | $2,000-$5,000 |

**Subs pay nothing** to access projects as collaborators. Procore Pay has an optional transaction fee model for subs on electronic payment receipt.

### 8.2 Competitor Pricing Benchmarks

| Platform | Pricing Model | Starting Cost | Best For |
|----------|--------------|---------------|---------|
| Procore | ACV % + modules | $10,000+/yr | Large GCs ($50M+ ACV) |
| Autodesk Build | Per-user + tiers | $50-$140/user/month | Enterprise, design-heavy |
| BuildingConnected | Revenue-based (opaque) | $3,600+/yr | Preconstruction/bidding |
| Fieldwire | Per-user tiered | $39-$69/user/month | Field-focused teams |
| Buildertrend | Flat monthly | $499+/month | Residential |
| JobTread | Flat monthly | $159+/month | Small/mid GCs |
| Contractor Foreman | Flat monthly | $49-$249/month | Small GCs |
| Constructable | Transparent, not ACV-based | ~$500-$1,500/month | Mid-market GCs |

Source: [Best construction software pricing guide — Projul 2026](https://projul.com/blog/best-construction-software/), [Procore alternatives mid-market — Constructable 2026](https://constructable.ai/blog/procore-alternatives-mid-market-contractors)

### 8.3 The Pricing Gap Procore Has Created

Procore's ACV model **explicitly abandons the mid-market**:
- Minimum realistic entry cost: ~$10,000-$15,000/year
- Small GC with $10M ACV: still ~$8,000-$12,000/year for basic modules
- Local builders on $5M projects find Procore disproportionately expensive
- Mid-market contractors ($20M-$150M ACV) are the underserved sweet spot

> *"Procore is pretty much the only competent option and the minimum to pay for it is just unrealistic for smaller-mid sized GCs"*
> — [SubmittalLink user testimonial, 2026](https://www.submittallink.com/post/procore-pricing)

> *"Everything was pushing towards the higher-spec end of the market"*
> — Construction tech expert on Procore's strategy direction

### 8.4 Recommended Pricing Architecture

**Core principle:** GC pays (by project, not by ACV); subs are always free.

**Tier 1: GC Starter — $299/month**
- Up to 3 active projects
- All core features (plans, RFIs, submittals, daily logs, punch lists, schedule)
- Unlimited users (GC team + unlimited subs as collaborators)
- Free sub portal: unlimited subs
- 10GB document storage
- Target: GCs with $5-25M ACV

**Tier 2: GC Professional — $699/month**
- Up to 10 active projects
- Everything in Starter
- Financial management (budgets, change orders, pay apps)
- Sub performance analytics
- 100GB storage
- API access
- Target: GCs with $25-100M ACV

**Tier 3: GC Enterprise — $1,499+/month**
- Unlimited active projects
- Everything in Professional
- Custom ERP integrations
- Advanced analytics and AI features
- White-label sub portal with GC branding
- Dedicated support + implementation
- Unlimited storage
- Target: GCs with $100M+ ACV

**Sub Tier: Always Free**
- Unlimited collaborator access to projects they're invited to
- Cross-project portfolio view
- Permanent project archive
- Basic company profile on platform network

**Sub Pro: $49/month per company** (optional, not required)
- Create and manage their own projects
- Advanced reporting on their performance
- Verified Performance Score badge (shareable to new GCs)
- Priority integrations with their own accounting software

**Per-Project Option (for occasional GC users):** $149/project one-time, capped features. Designed for GCs who won't commit to monthly but want to try for a specific job.

### 8.5 Positioning Against Procore

**Price comparison at equivalent GC size:**

| GC ACV | Procore Annual | Your Platform Annual | Savings |
|--------|---------------|---------------------|---------|
| $10M | ~$15,000 | $3,588 (Starter) | ~76% |
| $50M | ~$45,000 | $8,388 (Professional) | ~81% |
| $100M | ~$80,000 | $17,988 (Enterprise) | ~78% |
| $500M | ~$250,000 | Custom ($50-100k) | ~60-80% |

**Competitive messages:**
- "Procore for GCs under $100M ACV is like buying a 747 to fly to the grocery store"
- "Same unlimited-users model, 80% of the price, 100% of what mid-market GCs actually use"
- "Your subs prefer working with us — they actually own their data"

### 8.6 Should There Be a Free GC Tier?

**Yes, with strict limits.** A free GC tier serves as:
1. A growth channel for small GCs who may grow into paying tiers
2. A way to attract subs who become advocates
3. A competitive weapon against Procore (who has no free tier)

**Free GC Tier:**
- 1 active project at a time
- Limited document storage (2GB)
- Core features only (plans, RFIs, basic submittals)
- "Powered by [Platform]" branding on sub-facing views
- No financial management
- Unlimited subs (this is critical for the viral dynamic)

**The free GC tier is a sub acquisition vehicle as much as a GC acquisition vehicle.** Every free GC project brings in subs who are exposed to the platform.

---

## 9. Strategic Summary: The Playbook

### 9.1 The Core Insight Competitors Miss

Procore built a GC platform and gave subs a portal as an afterthought. Their sub experience is deliberately limited: subs lose their data when projects close, they have no cross-GC identity, and they're tools for the GC's data collection rather than beneficiaries of the platform.

**The opportunity:** Build a platform that genuinely serves both GCs and subs. Give subs permanent data ownership, cross-GC portfolio visibility, and performance credentials. Subs who own their data become advocates — not just compliant users.

### 9.2 The Winning Flywheel

```
GC adopts platform (lower price, better UX than Procore)
    ↓
GC invites subs → subs get free access + real value
    ↓
Subs get cross-GC dashboard + permanent data ownership
    ↓
Subs prefer working with GCs who use your platform
    ↓
Subs tell next GC: "Can you get on [Platform]? We love it."
    ↓
New GC encounters a sub network that's already onboarded
    ↓
New GC adopts → new subs exposed → loop accelerates
    ↓
Sub performance data accumulates → platform becomes more valuable
    ↓
Switching cost for GCs increases (their sub history is here)
```

### 9.3 The 5 Decisions That Determine Outcome

| Decision | Wrong Choice | Right Choice |
|----------|-------------|--------------|
| Sub identity | Per-GC silo (Procore model) | Platform-level cross-GC identity |
| Sub data ownership | GC owns, sub loses at close | Sub owns their own data permanently |
| RFI/submittal write access | Gate it (paywalled for subs) | Free for subs always |
| Pricing model | ACV % like Procore | Flat monthly by project tier |
| Free tier | None | Free GC tier (1 project) + always-free sub tier |

### 9.4 The 2-Week MVP That Creates the Viral Loop

Ship exactly these things first:
1. GC email invitation → magic link → sub password setup (3-minute onboarding)
2. Mobile plan viewer (immediate "aha" moment for subs)
3. RFI creation and viewing (sub's primary workflow need)
4. Notifications (GC and sub get alerted on ball-in-court changes)
5. Sub dashboard showing their active projects

This minimal scope creates the viral loop. A sub gets invited, opens plans on their phone in 2 minutes, submits their first RFI without an email chain, and tells the next GC: "Do you use [Platform]?"

### 9.5 The Data Moat Strategy

Start collecting this data from day one, even before you expose it as a product:

- RFI creation → response time (per company)
- Submittal upload → approval cycle time (per company)
- Punch list close rate and time-to-close
- Pay app submission timing relative to billing period
- Repeat hire rate: what fraction of subs are re-invited on subsequent projects by the same GC?

After 12-18 months, this data supports a **Sub Performance Score** product that has no direct competitor. Procore's Construction Network shows raw counts (projects completed, RFIs resolved). Your platform shows verified, quantified performance metrics across multiple GCs.

---

## Sources

All sources cited inline throughout this document. Key primary sources:

- [Procore — What subs lose when the GC closes the project (March 2026)](https://www.procore.com/blog/what-subs-lose-when-gc-closes-project)
- [Procore — Subcontractor Permissions Learning Path](https://support.procore.com/procore-learning-paths/general-contractor/subcontractor/permissions)
- [Procore — Free Account Permissions FAQ](https://v2.support.procore.com/faq-how-do-permissions-work-for-free-procore-accounts)
- [Procore — View a Subcontract](https://v2.support.procore.com/product-manuals/commitments-project/tutorials/view-a-subcontract)
- [Procore — Construction Network cross-company identity](https://v2.support.procore.com/faq-can-a-person-be-associated-with-multiple-vendor-company-records-in-the-company-directory/)
- [Procore — About the Procore Construction Network](https://v2.support.procore.com/process-guides/about-the-procore-construction-network/common-questions/)
- [Muro AI — Construction, AI and the Power of Distribution Channels (2025)](https://www.muro.ai/blog/ai-construction-tech-and-the-power-of-distribution-channels)
- [Downtobid — PlanGrid vs Procore (July 2024)](https://downtobid.com/blog/plangrid-vs-procore)
- [SubmittalLink — Procore Pricing Deep Dive (2026)](https://www.submittallink.com/post/procore-pricing)
- [CountOnACTS — How Much Does Procore Actually Cost (2025)](https://www.countonacts.com/blog/how-much-does-procore-actually-cost)
- [BuildingConnected — What is BuildingConnected?](https://support.buildingconnected.com/hc/en-us/articles/360019964273-What-is-BuildingConnected)
- [GCPay — Kolena Overview (2025)](https://www.kolena.com/blog/gcpay-streamlining-construction-payments-with-automation-and-ai/)
- [Oracle Textura — Payment Management](https://www.oracle.com/construction-engineering/textura-construction-payment-management/)
- [Fieldwire — Account Permission Levels](https://help.fieldwire.com/hc/en-us/articles/115000637206-Introduction-to-Account-Permission-Levels-Managers-Account-Users-and-Project-Users)
- [AWS — Multi-tenant data isolation with PostgreSQL RLS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Victor Muchiri — Preconstruction Agents and Data Network Effects (2025)](https://victormuchiri.substack.com/p/why-preconstruction-agents-are-the)
- [Billy — Billy vs ISNetworld vs Avetta (2026)](https://billyforinsurance.com/resources/billy-vs-isnetworld-vs-avetta-subcontractor-prequalification/)
- [Procore — How to Invite Someone to Procore (FollowUp CRM guide)](https://www.followupcrm.com/blog/how-to-invite-someone-to-procore)
- [Constructable — Procore Alternatives Mid-Market (January 2026)](https://constructable.ai/blog/procore-alternatives-mid-market-contractors)
- [PlanHub — BuildingConnected vs PlanHub pricing](https://planhub.com/resources/buildingconnected-vs-planhub/)
- [Smrtbld — Data Ownership in Construction (2024)](https://smrtbld.com/news/data-ownership-in-construction-empowering-subcontractors)
- [CockroachDB — Row Level Security for multi-tenant SaaS (2025)](https://www.cockroachlabs.com/blog/fine-grained-access-control-row-level-security/)
- [Reddit r/Construction — Specialty subs and Procore](https://www.reddit.com/r/Construction/comments/oghlhi/any_of_you_specialty_subs_use_procore_if_so_how/)
- [Reddit r/MEPEngineering — Procore as CYA info dump](https://www.reddit.com/r/MEPEngineering/comments/1r7xv3y/procore_is_an_info_dump_gcs_use_to_avoid_real/)

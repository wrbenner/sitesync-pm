# Track 4: Enterprise Infrastructure Research
## SiteSync PM — React 19 + TypeScript + Supabase + Vercel

*Research compiled April 2026. Sources cited inline throughout.*

---

## Table of Contents

1. [SOC2 for Startups](#1-soc2-for-startups)
2. [FedRAMP for Construction Software](#2-fedramp-for-construction-software)
3. [Supabase at Scale](#3-supabase-at-scale)
4. [Vercel Deployment at Scale](#4-vercel-deployment-at-scale)
5. [Data Security for Construction](#5-data-security-for-construction)
6. [Offline-First Architecture](#6-offline-first-architecture-at-production-scale)
7. [Real-Time at Scale](#7-real-time-at-scale)
8. [Decision Framework Summary](#8-decision-framework-summary)

---

## 1. SOC2 for Startups

### 1.1 What Is SOC2 and Why It Matters for Construction SaaS

SOC2 is a voluntary audit framework from the AICPA that evaluates security controls against five Trust Services Criteria: Security (mandatory), Availability, Processing Integrity, Confidentiality, and Privacy. For B2B SaaS, it has become the de facto admission ticket to enterprise sales. [According to Iterators](https://www.iteratorshq.com/blog/soc2-compliance-for-saas-why-enterprise-customers-demand-it-and-how-to-get-certified/), over 70% of B2B SaaS deals now require a SOC2 report before contracts are signed.

**Do enterprise GCs actually require SOC2?** Yes — at the mid-market and enterprise level, effectively yes. Large general contractors (ENR Top 400 firms) route software procurement through security review teams that require either a SOC2 Type II report or will send a 100+ question security questionnaire. Without SOC2, you either fail to pass the questionnaire or spend weeks on manual back-and-forth for every deal. SOC2 converts that to a one-page report handoff.

**Construction-specific note:** Defense-adjacent construction work (DOD facilities, GSA projects) may additionally require FedRAMP (see Section 2). Regional GCs and mid-market firms typically need SOC2 Type II minimum. Government owners beyond state DOTs will require FedRAMP.

### 1.2 Timeline: Zero to SOC2 Type I

| Phase | Duration | Key Activities |
|---|---|---|
| Scoping & gap analysis | 1–2 weeks | Define scope, inventory systems, identify gaps |
| Control implementation | 2–8 weeks | MFA, access controls, logging, encryption policies |
| Policy documentation | 1–3 weeks | Write 20–30 required policies |
| Auditor engagement | 1–2 weeks | Select AICPA-accredited CPA firm |
| Audit execution | 1–2 weeks | Evidence collection, auditor testing |
| Report delivery | 1 week | Draft, management review, final report |

**Total for Type I (point-in-time snapshot):**
- **Fastest path (with automation tool + existing security baseline):** 4–6 weeks
- **Typical startup (starting from scratch):** 2–3 months
- **Traditional/manual path:** 3–6 months

[Source: Comp AI timeline guide](https://trycomp.ai/how-long-does-soc-2-compliance-take)

### 1.3 Timeline: Type I to SOC2 Type II

Type II adds a mandatory observation period where an auditor monitors your controls operating over time. Most startups choose a **3-month observation window** (the minimum) to get their first Type II done quickly.

| Phase | Duration |
|---|---|
| Gap remediation (if Type I found issues) | 2–4 weeks |
| Observation window (minimum) | 3 months |
| Pre-audit preparation | 2–4 weeks |
| Audit execution | 4–8 weeks |
| Report delivery | 2–4 weeks |

**Total from scratch (including Type I prep):**
- **Fastest possible:** ~5 months (3-month window + 2 months prep/audit)
- **Typical:** 6–12 months
- **Starting after Type I:** ~4–6 months (control gaps already addressed)

[Source: EasyAudit SOC2 timeline guide](https://www.easyaudit.ai/post/how-long-does-it-take-to-get-soc-2-compliance)

**Recommended path for SiteSync PM:**
1. Start SOC2 Type I process now (target Q3 2026 if starting today)
2. Begin Type II observation window immediately after Type I is issued
3. Target Type II completion ~Q1 2027 before aggressive enterprise sales
4. Use Type I report to unlock deals during the waiting period

### 1.4 Cost Breakdown by Approach

**Total Year 1 cost ranges for a 10–50 person startup:**

| Approach | Platform Cost | Auditor Fees | Internal Hours | Total Cash |
|---|---|---|---|---|
| DIY (spreadsheets) | $0 | $8K–$20K | 400–600 hrs | $15K–$25K |
| Comp AI (newer entrant) | $5K–$10K | Included | 20–50 hrs | $15K–$25K |
| Secureframe | $5K–$7K | $5K–$15K | 100–200 hrs | $17K–$32K |
| Vanta | $10K–$45K | $5K–$15K | 80–150 hrs | $20K–$50K |
| Drata | $8K–$35K | $5K–$15K | 100–200 hrs | $20K–$50K |
| Big 4 + consultant | N/A | $60K+ | 50–150 hrs | $80K–$150K+ |

[Source: SecureLeap Vanta vs Drata vs Secureframe comparison](https://www.secureleap.tech/blog/soc-2-tools-vanta-drata-secureframe-guide-2025)

**Ongoing annual costs (Year 2+):** $18K–$45K including platform renewal + maintenance audit.

**Best fit for SiteSync PM:** Secureframe or Vanta at the startup tier. Secureframe offers the most aggressive pricing at ~$5K/year for startups and is ideal for budget-constrained seed-stage companies. Vanta is the better choice if you need the fastest path to first report (2–4 week onboarding vs. 3–6 weeks for Secureframe) or expect to need multiple compliance frameworks (SOC2, ISO 27001, HIPAA) on a shared evidence base.

### 1.5 What Supabase Covers (Inherited Controls)

Supabase is SOC2 Type 2 compliant and is assessed annually. [Per Supabase's official SOC2 documentation](https://supabase.com/docs/guides/security/soc-2-compliance), Supabase's compliance covers the **infrastructure layer** within the Shared Responsibility Model:

**Supabase covers (you inherit):**
- Physical data center security (AWS infrastructure)
- Database server security, patching, and hardening
- Platform-level access controls and monitoring
- Incident response for platform-level events
- Data backups and redundancy at the infrastructure level
- Encryption at rest (Supabase manages keys at the platform level)
- Network security and firewall configuration for the Supabase platform
- Vendor management for Supabase's own sub-processors

**Supabase does NOT cover (your responsibility):**
- Your application's access control logic (RLS policies are yours to configure correctly)
- Authentication flows you build on top of Supabase Auth
- Data that your app exports or processes outside Supabase
- Your CI/CD pipeline security
- Your developer workstation security
- Your team's security training and policies
- The security of your Vercel deployment layer

**Important:** Supabase's SOC2 report is available only to Enterprise and Team Plan customers. To use Supabase's compliance documentation in your own SOC2 audit, you must be on at least the Team plan ($599/month).

### 1.6 What Vercel Covers (Inherited Controls)

[Vercel holds SOC2 Type 2 attestation](https://vercel.com/kb/guide/is-vercel-soc-2-compliant) for Security, Confidentiality, and Availability (3 of 5 Trust Services Criteria).

**Vercel covers:**
- Edge network and CDN infrastructure security
- Deployment infrastructure patching and hardening
- Platform availability and uptime controls
- TLS certificate management for custom domains
- DDoS mitigation at the edge
- Data encryption in transit (TLS) for traffic through Vercel's network
- Vercel's own employee access controls to customer deployment artifacts

**Vercel does NOT cover:**
- Your application's security vulnerabilities
- Secrets management (though Vercel Environment Variables help here)
- Your build pipeline scripts and dependencies
- Preview deployment access (configurable but your responsibility)
- Any backend logic that routes through Supabase (separate boundary)

### 1.7 Remaining Gaps for React + Supabase + Vercel Stack

After inheriting from Supabase and Vercel, SiteSync PM must implement and evidence these controls independently:

| Control Area | Specific Requirements | Priority |
|---|---|---|
| Access Management | MFA for all team members, RBAC in app, SSO for Enterprise customers | Critical |
| Change Management | Code review policy, branch protection, required approvals for production | Critical |
| Vulnerability Management | SAST scanning in CI/CD, dependency scanning (Dependabot/Snyk), pen testing | Critical |
| Endpoint Security | MDM for all developer devices, full-disk encryption, remote wipe | Critical |
| Logging & Monitoring | Centralized logs with 90-day retention minimum, alert on anomalies | High |
| Incident Response | Documented IR plan, designated IR roles, tested runbook | High |
| Vendor Management | Inventory all sub-processors, review their SOC2 reports annually | High |
| Business Continuity | Documented BCP/DR plan, tested backups with RTO/RPO defined | High |
| Security Training | Annual security awareness training for all staff | Medium |
| Background Checks | Pre-employment screening policy for employees with data access | Medium |
| Privacy/Data Classification | Document what PII you collect, retention policies, deletion procedures | Medium |

**Practical gap closure for the Supabase + Vercel stack:**
- **Logging:** Supabase provides database logs; use Vercel Log Drains + a SIEM (Datadog, Logtail, or Axiom) to centralize and retain 90 days
- **Secrets:** Use Vercel Environment Variables + Supabase Vault; never hard-code in source
- **SAST:** Add CodeQL or Snyk to GitHub Actions — these run on every PR automatically
- **Pen testing:** Budget $5K–$15K for an annual third-party penetration test
- **MFA:** Enforce across GitHub, Supabase dashboard, Vercel, all cloud accounts

---

## 2. FedRAMP for Construction Software

### 2.1 What Level Does Construction Software Need?

FedRAMP has three baseline levels, determined by the sensitivity of data processed:

| Level | Controls Required | Data Handled | Typical Use |
|---|---|---|---|
| Low (LI-SaaS) | 37–60 controls | Public/non-sensitive data | Collaboration tools, productivity |
| Moderate | 325 controls | Sensitive unclassified, CUI, PII | Most federal systems |
| High | 421 controls | CUI, critical infrastructure data | Law enforcement, defense |

**For construction software:** [Per Procore's own FedRAMP compliance guide](https://www.procore.com/library/fedramp-construction-compliance) and [SmartPM's 2026 analysis](https://smartpm.com/blog/fedramp-authorized-construction-software), **FedRAMP Moderate is the standard for most federal construction management work**. Construction data including RFIs, submittals, drawings, change orders, and contractor data qualifies as Controlled Unclassified Information (CUI) under DFARS clause 252.204-7012 when it relates to a DOD project.

For large infrastructure programs (major bridge replacements, interstate reconstructions, critical transit systems), agencies managing critical infrastructure data may evaluate vendors against **FedRAMP High**.

### 2.2 Procore's FedRAMP Status

[Procore Technologies achieved FedRAMP Moderate Authorization on January 29, 2026](https://www.procore.com/press/procore-for-government-achieves-fedramp-moderate-authorization) — this is a recent development. Procore for Government is now formally authorized to handle Controlled Unclassified Information and support DoD contractors with CMMC Level 2 obligations. This took Procore — a $9.67B market cap company — years and likely $1M+ to achieve.

**Implication for SiteSync PM:** You are entering a market where the largest competitor just cleared FedRAMP Moderate in early 2026. If you target federal construction, you will be competing without this authorization initially. However, the vast majority of commercial GC and private construction work does not require FedRAMP. Only federal agency-awarded contracts and DOD subcontractors handling CUI face this requirement.

### 2.3 FedRAMP Timeline and Cost

[Per Paramify's 2026 cost analysis](https://www.paramify.com/blog/fedramp-cost) and [Convox's practical guide](https://www.convox.com/blog/fedramp-authorization-2026-guide-saas-companies):

**FedRAMP Moderate (most common path):**
- Initial authorization: **$500K–$1.5M**
- Ongoing annual maintenance: **$200K–$500K/year**
- Timeline: **12–36 months** (traditional Agency ATO path)
- Documentation: System Security Plan alone is 300–500+ pages
- 3PAO assessment fees: **$125K–$195K** (required independent assessor)
- Infrastructure/tooling setup: **$50K–$150K** initial

**FedRAMP LI-SaaS (Low Impact, streamlined path):**
- Controls: 37–60
- Initial cost: **$150K–$300K**
- Annual maintenance: **$50K–$100K**
- Applicable only to systems handling public data or minimal PII
- NOT applicable to construction software handling CUI/project documents

**FedRAMP 20X (emerging simplified path):**
- Pilot program accepting submissions now
- Claims to compress Low authorization to ~5 weeks via automated evidence
- Not yet available at Moderate level
- Uncertain long-term viability for construction/CUI use cases

### 2.4 Government Construction Agencies That Require FedRAMP

- **Department of Defense (DOD)** — All cloud services used by DoD contractors handling CUI must be FedRAMP authorized (per DFARS 252.204-7012)
- **General Services Administration (GSA)** — Federal construction and facilities management projects
- **U.S. Army Corps of Engineers** — Major infrastructure and military construction
- **Department of Transportation (FHWA, FAA)** — Federal highway and aviation infrastructure projects
- **Department of Veterans Affairs** — VA healthcare facility construction
- **Naval Facilities Engineering Systems Command (NAVFAC)** — Navy/Marine Corps construction

[Per ProjectTeam.com's FedRAMP guide](https://blog.projectteam.com/what-fedramp-authorization-really-means-for-federal-construction-contractors), the rule is: if the contract involves CUI (drawings, specs, contractor data for a federal project), the cloud system storing it must be FedRAMP authorized or have an agency-specific Authority to Operate (ATO).

### 2.5 Is FedRAMP Worth Pursuing Before $10M ARR?

**No.** Not for a construction management startup below $10M ARR, with high confidence.

**The math doesn't work:**
- FedRAMP Moderate costs $500K–$1.5M to achieve + $200K–$500K/year to maintain
- At $10M ARR, you're spending 5–15% of revenue just on FedRAMP compliance
- Federal construction is a slow, long sales cycle (18–36 months from RFP to contract)
- Federal customers represent a small slice of total addressable construction market

**Better approach before $10M ARR:**
1. **Pursue SOC2 Type II first** — required for all enterprise customers, not just federal
2. **Build CMMC Level 1 readiness** — DOD subcontractors need CMMC, not necessarily FedRAMP if using a FedRAMP-authorized platform
3. **Wait for federal deals to appear organically** — if you're getting federal RFPs consistently, then evaluate FedRAMP with the projected contract revenue in hand
4. **Consider Knox or similar pre-authorized boundary services** — [Knox claims 90-day authorization at 90% lower cost](https://knoxsystems.com/resources/fedramp-authorization-timeline) by providing pre-authorized infrastructure; worth evaluating if federal sales momentum develops

**Realistic trigger:** Start FedRAMP evaluation seriously when you have $20M+ ARR, dedicated sales pipeline in federal construction, and at least one federal agency partner willing to sponsor your ATO.

---

## 3. Supabase at Scale

### 3.1 Database Connection Limits

Supabase uses **Supavisor** as its connection pooler. Raw direct PostgreSQL connections are surprisingly limited, but the pooler dramatically extends capacity:

| Compute Size | Monthly Cost | Direct Connections | Pooler Connections |
|---|---|---|---|
| Nano (Free tier) | $0 | 60 | 200 |
| Micro | $10 | 60 | 200 |
| Small | $15 | 90 | 400 |
| Medium | $60 | 120 | 600 |
| Large | $110 | 160 | 800 |
| XL | $210 | 240 | 1,000 |
| 2XL | $410 | 380 | 1,500 |
| 4XL | $960 | 480 | 3,000 |
| 8XL | $1,870 | 490 | 6,000 |
| 12XL | $2,800 | 500 | 9,000 |
| 16XL | $3,730 | 500 | 12,000 |

[Source: Supabase pricing and connection management docs](https://supabase.com/docs/guides/database/connection-management)

**Key insight:** Always use the Supavisor pooler connection string (port 6543) from serverless functions and Vercel deployments. The pooler handles connection multiplexing transparently, turning 200 effective pool slots into support for thousands of application-level "connections."

### 3.2 Realtime Subscription Limits

[Per Supabase's official Realtime limits documentation](https://supabase.com/docs/guides/realtime/limits):

| Plan | Monthly Cost | Concurrent Connections | Messages/Second | Channel Joins/Second |
|---|---|---|---|---|
| Free | $0 | 200 | 100 | 100 |
| Pro | $25 base | 500 | 500 | 500 |
| Pro (no spend cap) | $25 base + usage | 10,000 | 2,500 | 2,500 |
| Team | $599 base | 10,000 | 2,500 | 2,500 |
| Enterprise | Custom | 10,000+ | 2,500+ | Custom |

**What 10K concurrent connections means for SiteSync PM:** On a Pro plan with no spend cap or Team plan, 10,000 concurrent WebSocket connections are supported. For a construction SaaS, this is sufficient for tens of thousands of active users (not all users are connected simultaneously). A project with 100,000 registered users would typically have 2,000–5,000 concurrent connections during peak hours.

**Important:** Each connected client counts as one connection regardless of how many channels they subscribe to (up to 100 channels per connection). So a user viewing a live project dashboard with 5 real-time subscriptions still consumes only 1 connection.

### 3.3 Row Level Security Performance Impact

RLS adds a policy evaluation overhead to every row accessed. [Supabase's RLS performance documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) shows the overhead can be severe or negligible depending on implementation:

| Policy Pattern | Performance | Notes |
|---|---|---|
| `user_id = auth.uid()` (direct) | Excellent | Simple equality check, indexed |
| `(select auth.uid()) = user_id` | 94% faster than above (!) | Caches the auth.uid() call within query |
| Subquery: `user_id IN (SELECT id FROM users...)` | Poor at scale | Evaluated per row |
| `is_admin()` function with table join | ~11 seconds without caching | Catastrophic at scale |
| `(select is_admin())` with cached result | ~7ms | 99.94% improvement |

**Key findings from Supabase's own benchmarks:**
- Wrapping function calls in `(select ...)` caches the result within the query, preventing per-row re-evaluation
- Composite indexes on columns used in RLS policies eliminate sequential scans
- Subqueries in RLS policies that join other tables are evaluated for *every row* in the result set — catastrophic at 10K+ rows
- Use `security definer` functions to bypass RLS on internal join tables (with caution)

**Practical recommendations for SiteSync PM:**
```sql
-- GOOD: Cached auth.uid() call
CREATE POLICY "users_own_projects" ON projects FOR SELECT 
USING ((select auth.uid()) = owner_id);

-- GOOD: Cached organization membership check  
CREATE POLICY "org_members_see_documents" ON documents FOR SELECT
USING (
  (select auth.uid()) IN (
    SELECT user_id FROM org_members WHERE org_id = documents.org_id
  )
);

-- CRITICAL: Index every column referenced in RLS policies
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_org_members_user_org ON org_members(user_id, org_id);
CREATE INDEX idx_documents_org ON documents(org_id);
```

After proper optimization, [real-world RLS overhead is less than 5ms per query](https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2), making it effectively invisible at the application level.

### 3.4 Storage and Bandwidth Limits

| Plan | Database Storage | File Storage | Monthly Egress |
|---|---|---|---|
| Free | 500 MB | 1 GB | 5 GB |
| Pro | 8 GB base + $0.125/GB (up to 16TB GP, 60TB HP) | 100 GB + $0.021/GB | 250 GB + $0.09/GB |
| Team | Same as Pro | Same as Pro | Same as Pro |
| Enterprise | Custom | Custom | Custom |

For construction SaaS storing blueprints, submittals, and photos: plan for significant storage. A medium-sized project might accumulate 5–50 GB of documents. 100 active projects could mean 500 GB–5 TB of file storage. Plan accordingly and budget ~$21/TB/month for storage overage on Pro.

### 3.5 Edge Function Performance

Supabase Edge Functions run on Deno Deploy infrastructure. Key performance characteristics:

- **Cold start (typical):** 150–500ms on first invocation
- **Cold start optimization:** [Supabase announced persistent storage with up to 97% faster cold starts](https://supabase.com/blog/persistent-storage-for-faster-edge-functions) via S3-mounted storage
- **Warm execution:** Sub-10ms for simple functions
- **Optimization strategies:** Combine multiple actions into a single edge function to reduce cold starts; use in-memory caching for repeated expensive operations; minimize dependencies

**Supabase Edge Functions vs. Vercel Edge Functions:**
- Supabase Edge Functions run on **Deno** runtime; Vercel Edge Functions run on **V8 isolates** (Cloudflare Workers infrastructure)
- They are architecturally separate — Supabase functions can't be deployed via Vercel
- Use **Supabase Edge Functions** for: database triggers, auth webhooks, backend logic that directly accesses Postgres, scheduled jobs
- Use **Vercel Edge Functions** (or Vercel API routes): for API routes that need to process user requests before hitting Supabase, middleware authentication, rate limiting, geographic routing
- [Per community discussion](https://news.ycombinator.com/item?id=38621849): Vercel Edge Functions are Cloudflare Workers under the hood; Supabase uses Deno Deploy/subhosting

### 3.6 Real-World Supabase Performance at Scale

From [Prince Nzanzu's production guide for 50K+ users](https://princenocode.com/blog/scale-supabase-production-guide):
- The Supavisor pooler + proper indexing handles 50,000+ active users on a 2XL instance ($410/month)
- Database query times from 5 seconds → 50ms with proper indexing
- Cost optimized from $500/month → $100/month with connection pooling + query optimization

**Scale thresholds summary:**

| User Count | Recommended Compute | Monthly DB Cost | Key Concern |
|---|---|---|---|
| 0–10K | Small or Medium | $15–$60 | Connection pooling, basic RLS optimization |
| 10K–100K | Large or XL | $110–$210 | RLS optimization, indexing, read replicas |
| 100K–500K | 2XL–4XL | $410–$960 | Query optimization, caching layer, connection management |
| 500K+ | 8XL+ or self-hosted | $1,870+ | Evaluate self-hosting or multi-tenant sharding |

### 3.7 When to Self-Host Supabase

[Per Supascale's self-hosting analysis](https://www.supascale.app/blog/supabase-selfhosted-vs-cloud-complete-comparison), move to self-hosted when:

1. **FedRAMP required** — Supabase Cloud is not FedRAMP authorized; federal work forces self-hosting or an alternative
2. **Data residency constraints** — Specific regions not available on Supabase Cloud
3. **Cost efficiency at massive scale** — Self-hosting typically saves money only at 8XL+ equivalent workloads
4. **Custom networking** — Private VPC, direct database access without internet routing

**Do NOT self-host when:**
- You don't have dedicated ops/DevOps capacity (plan for 1–2 FTE to maintain)
- You still need SOC2/HIPAA compliance certifications (these are Cloud Enterprise features)
- You're pre-product-market fit
- Scale is under ~100K–500K users

---

## 4. Vercel Deployment at Scale

### 4.1 Pricing Structure

[Per Vendr's 2026 Vercel pricing analysis](https://www.vendr.com/marketplace/vercel):

| Plan | Base Cost | Commercial Use | Key Limits |
|---|---|---|---|
| Hobby | Free | No | Personal projects only |
| Pro | $20/user/month | Yes | 1TB bandwidth, 6,000 build minutes, 1M edge requests included |
| Enterprise | Custom (~$25K+/year) | Yes | Custom limits, SLA, SSO, WAF, audit logs |

**Usage-based overages on Pro:**
- Bandwidth: ~$40/TB overage
- Serverless execution: ~$40/GB-hour
- Build minutes: ~$0.005/minute
- Edge requests: $0 for first 10M, then usage-based

**Real-world costs:**
- Small team (3–5 devs), moderate traffic SaaS: **$180–$600/year** (base) + **$500–$3K/year** usage overages
- Growing team (10–20 devs), high traffic: **$2.4K–$4.8K/year** base + significant usage
- Mid-market (50+ devs): Consider Enterprise at **$30K–$150K/year** negotiated contract

**The Pro-to-Enterprise cliff:** Several features only unlock at Enterprise — SSO, WAF, private VPC, 99.99% SLA, audit logs. The jump from Pro ($20/seat/month) to Enterprise ($25K+/year minimum) is steep. For a SaaS targeting enterprise GCs, you'll likely need Enterprise features (especially SSO/SCIM for GC internal user management) before you're big enough to justify the price.

### 4.2 Vercel Features That Matter for Construction SaaS

| Feature | Plan | Relevance |
|---|---|---|
| Preview Deployments | Pro+ | Critical for AI-generated PRs; auto-deploys every branch with unique URL |
| Password-protected Previews | Pro+ | Secure preview links for GC stakeholder review |
| Deployment Protection | Pro+ | Restrict preview URLs to Vercel-authenticated team members |
| Audit Logs | Enterprise | Required for SOC2 evidence collection |
| SSO/SAML | Enterprise | Required for GC enterprise accounts |
| WAF (Web Application Firewall) | Enterprise | Required for enterprise security questionnaires |
| Private VPC Connectivity | Enterprise | Required for organizations with strict network controls |
| 99.99% SLA | Enterprise | Required language in enterprise contracts |
| Custom Domains | Pro ($10/domain) | Needed for white-label or custom subdomains per GC |

**Preview Deployments for AI-generated PRs:** This works out of the box. Every PR (including AI-generated ones) gets a unique stable URL that updates on each push. The URL format is `[project-name]-git-[branch-name]-[team].vercel.app`. These can be protected via Vercel Authentication so only team members can access them. Merging to main triggers an automatic production deployment.

### 4.3 ISR/SSR Patterns for Vite + React (Not Next.js)

Vercel's ISR (Incremental Static Regeneration) is a Next.js-specific feature. For a Vite + React SPA on Vercel, options are:

**1. Serve as SPA (recommended for construction apps):** Build static assets with Vite, serve via Vercel CDN. All routing is client-side. This works excellent for apps where data is user-specific (can't pre-render anyway due to authentication).

**2. Vercel Edge Functions for server-side rendering:** Use Vercel's serverless/edge functions as an API layer. React stays client-side; data fetching calls your Vercel API routes (or directly calls Supabase).

**3. For public/SEO pages:** If marketing pages, project dashboards meant for public sharing, or report views need SEO, consider adding Remix or Astro as a separate project for those routes, keeping the main app as a SPA.

**CDN and Asset Optimization:**
- Vercel's Smart CDN caches static assets at edge PoPs globally (20+ regions)
- Enable `Cache-Control: public, max-age=31536000, immutable` for hashed asset filenames (Vite does this automatically with content hashing)
- Use Vercel's Image Optimization API for construction photos/document thumbnails
- Compress large JavaScript bundles — Vite's rollup tree-shaking handles most of this automatically

---

## 5. Data Security for Construction

### 5.1 Data Classification in Construction Documents

Construction projects generate multiple sensitivity tiers:

| Classification | Examples | Controls Required |
|---|---|---|
| Public | Project name, location, general timeline | Standard web security |
| Internal | Bid documents, subcontractor lists, schedules | Authenticated access, basic encryption |
| Confidential | Proprietary cost data, margin analysis, trade secrets | RLS, audit logs, access control per role |
| CUI (Controlled Unclassified) | Federal project drawings, military specs, DFARS data | FedRAMP or CMMC Level 2, FIPS encryption |
| Classified | Defense classified projects | Out of scope for commercial SaaS |

For most commercial construction SaaS, data falls in the **Internal** and **Confidential** tiers. Government construction work immediately elevates project documents to **CUI** requiring CMMC Level 2 compliance minimum.

### 5.2 ITAR Implications for Defense Construction

ITAR (International Traffic in Arms Regulations) applies to any technical data related to items on the U.S. Munitions List (USML). For construction software, ITAR becomes relevant when:

- The construction project involves military facilities, weapons systems manufacturing facilities, or defense-related infrastructure
- Technical drawings or specifications describe ITAR-controlled items
- Your software would store or process design data, manufacturing specs, or performance data for defense articles

[ITAR applies to deemed exports](https://cmmccompliance.us/itar-requirements-made-simple-for-contractors/) — sharing ITAR data with a non-U.S. person (even within the U.S.) is a violation. This has direct implications for:
- Foreign national employees accessing your system
- Offshore development teams with database access
- Cloud infrastructure located outside the U.S.

**For SiteSync PM:** Unless you specifically target defense construction clients, ITAR is not your primary concern. However, implement a data residency architecture that keeps all data in U.S. AWS regions (which Supabase supports) from the start, and consider adding a field to project records indicating whether a project involves federal/defense data so access can be appropriately restricted.

### 5.3 Data Residency Requirements

For U.S. government construction:
- **Data must reside on U.S. soil** — Supabase supports U.S.-only hosting (choose `us-east-1` or `us-west-1` regions at project creation)
- **DFARS 252.204-7012** requires cloud services handling CUI to be FedRAMP authorized
- **FedRAMP requires U.S.-based data centers** with no foreign jurisdiction

For state/local government construction:
- No universal federal standard; varies by state
- Some states have adopted GovRAMP (a state-level analog to FedRAMP)
- Generally, U.S.-hosted infrastructure + SOC2 suffices for most state agencies

**Supabase regional deployment:** Select your region at project creation — it cannot be changed. For a U.S. construction SaaS, default to `us-east-1`. For future multi-region needs, plan for separate Supabase projects per region with application-level routing.

### 5.4 Encryption Requirements

**At-rest encryption (what's required):**
- Supabase Cloud: AES-256 encryption at rest, managed by AWS KMS. This is automatic and not configurable by the customer at the algorithm level.
- Files stored in Supabase Storage: AES-256 via S3 SSE-KMS
- Database volumes: AES-256 via RDS encryption (automatic when enabled)

**For CUI/CMMC Level 2:** [FIPS 140-2 or 140-3 validated modules are required](https://www.kiteworks.com/cmmc-compliance/cmmc-encryption-aes-256/). AWS KMS uses FIPS 140-2 validated hardware — Supabase Cloud on AWS inherits this. However, **customer-managed keys (CMK)** provide stronger compliance posture than AWS-managed keys, as CMK means only the customer can access the key material.

**In-transit encryption:**
- Vercel enforces TLS for all traffic; supports HSTS
- Supabase enforces TLS 1.2+ for all connections
- For CMMC compliance, TLS 1.3 is recommended (both platforms support it but may need explicit configuration)
- Internal PostgreSQL connections should use `sslmode=verify-full`

**Document-level access control patterns:**
```
// Supabase RLS pattern for multi-tenant construction documents
CREATE POLICY "project_members_access_documents" ON documents
FOR SELECT USING (
  project_id IN (
    SELECT pm.project_id 
    FROM project_members pm
    WHERE (select auth.uid()) = pm.user_id
    AND pm.status = 'active'
  )
);

// For document-level sensitivity
CREATE POLICY "confidential_documents_restricted" ON documents  
FOR SELECT USING (
  sensitivity_level < 'CONFIDENTIAL' 
  OR (
    (select auth.uid()) IN (
      SELECT pm.user_id FROM project_members pm
      WHERE pm.project_id = documents.project_id
      AND pm.role IN ('owner', 'admin', 'executive')
    )
  )
);
```

### 5.5 Audit Log Requirements

For SOC2 compliance, audit logs must capture:
- **User identity** (user ID, email, IP address)
- **Timestamp** (UTC, millisecond precision)
- **Action performed** (create, read, update, delete)
- **Resource affected** (table, record ID)
- **Result** (success/failure)
- **Source** (application, API, direct DB access)

**Immutability requirement:** [Per SOC2 auditor expectations](https://hoop.dev/blog/immutable-audit-logs-the-key-to-soc-2-compliance-and-trust), audit logs must be tamper-proof. Implement:
- Write-once storage (AWS S3 with Object Lock in COMPLIANCE mode)
- Append-only audit log table in Postgres (use triggers, restrict DELETE permissions)
- Hash chaining: each log entry includes SHA-256 hash of previous entry
- Log retention: minimum 90 days accessible, 1 year archived

**Practical implementation for Supabase:**
```sql
-- Audit log table with append-only enforcement
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id     UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL,
  resource    TEXT NOT NULL,
  resource_id TEXT,
  ip_address  INET,
  user_agent  TEXT,
  metadata    JSONB
);

-- Revoke DELETE on audit_log from all roles
REVOKE DELETE ON audit_log FROM authenticated, anon;
REVOKE TRUNCATE ON audit_log FROM authenticated, anon;

-- Index for audit queries
CREATE INDEX idx_audit_user_time ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_log(resource, resource_id);
```

---

## 6. Offline-First Architecture at Production Scale

### 6.1 Service Workers for React + Vite

Service workers are the foundation of offline-first capability. For Vite + React, the recommended approach is **vite-plugin-pwa** (built on Workbox):

```bash
npm install vite-plugin-pwa workbox-window
```

**Caching strategy by resource type:**

| Resource Type | Strategy | Rationale |
|---|---|---|
| App shell (HTML, JS, CSS) | Cache First + Workbox Precache | App must load offline |
| Project data (recent) | NetworkFirst with timeout | Show cached if offline |
| Document thumbnails | CacheFirst, 30-day expiry | Images don't change |
| Uploaded documents (current project) | CacheFirst, selective | Store active project files |
| User-generated forms/inputs | Network-first with IndexedDB queue | Must not lose data |
| Auth tokens | NetworkOnly | Never cache auth |

[Per OneUptime's service worker guide](https://oneuptime.com/blog/post/2026-01-15-service-workers-offline-support-react/view), service workers run independently of the main thread and survive page refreshes, making them ideal for background sync of queued mutations.

**Service worker update flow:** Use Workbox's `waiting` event to prompt users when a new version is available, avoiding stale-code issues in production:
```javascript
const wb = new Workbox('/sw.js');
wb.addEventListener('waiting', () => {
  // Show "New version available - Reload?" prompt
});
wb.register();
```

### 6.2 IndexedDB (Dexie) vs. SQLite (wa-sqlite) for Offline Storage

| Factor | Dexie.js (IndexedDB wrapper) | wa-sqlite (SQLite in WebAssembly) |
|---|---|---|
| Bundle size | ~29 KB gzipped | ~500KB–1MB (SQLite WASM) |
| Query power | Basic NoSQL, limited joins | Full SQL including JOINs, aggregates |
| Performance | Good for simple key-value + indexes | Faster for complex queries; slower for simple operations |
| Reactivity | Built-in live queries (Dexie 4+) | Manual query re-execution |
| iOS/iPad support | Excellent | Excellent (runs in browser) |
| Concurrent access | IndexedDB spec support | Single writer (WAL mode helps) |
| JSON support | Native object storage | JSON column type + json_extract |
| Maturity | Production-proven at scale | Newer but stable |
| Best for | Simple structure, reactivity needed | Complex relational queries, existing SQL schemas |

**Recommendation for SiteSync PM:** Start with **Dexie.js**. Construction data has relatively simple access patterns (project → tasks, project → documents, project → forms). Dexie's reactive live queries integrate naturally with React state. If you find yourself needing complex SQL queries offline (e.g., aggregate cost reports across all offline projects), evaluate wa-sqlite at that point.

[Per RxDB's storage comparison](https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html), the Origin Private File System (OPFS) is emerging as a high-performance alternative for heavy I/O — Dexie 4+ supports OPFS as a storage backend for dramatically better performance on large datasets.

### 6.3 Conflict Resolution: CRDTs vs. OT vs. Last-Write-Wins

| Strategy | Mechanism | Best For | Drawbacks |
|---|---|---|---|
| Last-Write-Wins (LWW) | Timestamp-based; latest edit wins | Simple fields, forms where one person edits at a time | Data loss if two people edit simultaneously |
| Operational Transform (OT) | Server coordinates and transforms concurrent operations | Real-time collaborative text (Google Docs model) | Requires constant server connection; complex implementation |
| CRDT | Math-guaranteed merge; any order, any time, no conflicts | Offline-first; collaborative data that must always merge | Higher memory overhead; data never deleted |

[Per the CRDTs vs. OT analysis](https://dev.to/puritanic/building-collaborative-interfaces-operational-transforms-vs-crdts-2obo): **OT requires live connection for coordination; CRDTs work offline.** This is the critical distinction for construction field workers who lose connectivity.

**What's actually achievable for construction:**
- **Daily logs, punch lists, task status:** Last-Write-Wins is acceptable — one person owns each record
- **RFI responses, submittal reviews:** CRDT for text (use Yjs or Automerge) — multiple stakeholders may annotate simultaneously
- **Quantity tracking, cost entries:** Operational merge with server validation — mathematical additions can be commutative (add 10 units + add 5 units = 15 units, order-independent)
- **Drawing markups:** CRDT (Yjs with a shared array of annotation objects)

**Practical recommendation:** Use **Yjs** for collaborative documents and drawing markups. Use **Dexie + timestamp-based LWW** for everything else. Yjs is mature, used by Notion, Linear, and countless collaboration tools, and has providers for both WebSocket (Supabase Realtime) and offline-first sync.

### 6.4 How Much Data to Store Offline

**Practical limits on iPad (2024 iPad Pro):**
- Available storage: 128GB–2TB (but apps are typically limited by OS quota)
- Browser IndexedDB quota: ~10–15% of available disk (Safari) to 60–70% (Chrome/Edge)
- On a 128GB iPad: up to ~12–18 GB IndexedDB (Safari) or 77–90 GB (Chrome)

**What to cache offline for a construction app:**
- ✅ Active project task lists and forms (< 50 MB per project)
- ✅ Recent RFIs and submittals (metadata + thumbnail) (< 100 MB per project)
- ✅ Current revision of key drawings as optimized images (50–500 MB per project)
- ✅ User's schedule for the next 2 weeks (< 5 MB)
- ✅ Offline-capable forms and inspection checklists (< 10 MB)
- ❌ Full-resolution CAD/BIM exports (gigabytes per file — server-side only)
- ❌ Complete project document history (years of data — search against server)
- ❌ Video site walkthroughs (stream only)

**Recommended offline budget:** Cache the **active project + the user's recent 30 days of activity** up to ~500 MB per project, with a maximum of 3 active offline projects (~1.5 GB total). Alert users when offline cache approaches device limits.

### 6.5 Battery and Storage Implications

- **Service worker background sync:** Minimal battery impact when idle; activates briefly on connectivity restore
- **IndexedDB transactions:** Battery-efficient (browser manages write coalescing); avoid writing on every keystroke
- **Periodic background sync:** Use sparingly; set minimum intervals (e.g., 15 minutes) to prevent battery drain
- **Image prefetching:** Aggressive prefetching of all project images can cause significant battery/data usage — let users control this or limit to Wi-Fi-only
- **SQLite WAL mode:** Reduces I/O by batching writes — enable if using wa-sqlite

---

## 7. Real-Time at Scale

### 7.1 Supabase Realtime at 10K Concurrent Connections

At 10,000 concurrent WebSocket connections (Pro no-spend-cap or Team plan):
- Messages per second: 2,500 across all connections
- Channel joins per second: 2,500
- This translates to roughly **0.25 messages/second/user** at 10K concurrent

For construction, real-time needs are lower frequency than chat apps: status updates (someone closed an RFI), presence (who's viewing this drawing), push of schedule changes. 2,500 msg/sec is more than sufficient for 10K concurrent construction users.

**At 100K concurrent (requires Enterprise):**
- Custom limits negotiated with Supabase
- Supabase claims their cluster "supports millions of concurrent connections" at the infrastructure level; the per-project limits are configurable
- At this scale, also consider whether all users need real-time (vs. polling for non-critical updates)

### 7.2 WebSocket vs. Server-Sent Events for Construction Data

| Factor | WebSocket | Server-Sent Events (SSE) |
|---|---|---|
| Bidirectional | Yes | No (server → client only) |
| Protocol overhead | Higher | Lower (plain HTTP) |
| Proxy/firewall compatibility | Lower (some proxies block WS) | Higher (standard HTTP) |
| Connection multiplexing | No (1 connection per use) | Native HTTP/2 multiplexing |
| Built-in reconnection | Manual | Automatic |
| Browser support | Universal | Universal (IE11 needs polyfill) |
| Supabase Realtime uses | WebSocket | N/A |

**For construction SaaS:** WebSocket (via Supabase Realtime) is the correct choice for anything bidirectional (presence, live collaboration). SSE is viable for one-way notifications (new assignment alerts, schedule changes) and has better compatibility with enterprise proxy/firewall configurations common in GC office environments.

**Hybrid approach:** Use Supabase Realtime WebSocket for collaborative features (presence, live document editing). Use SSE or polling for notifications and updates in environments where WebSocket is blocked by corporate proxies. Detect WebSocket failures and fall back to polling automatically.

### 7.3 Presence Systems Comparison

| System | Best For | Integration | Pricing |
|---|---|---|---|
| Supabase Presence | Simple "who's online" tracking per channel | Native to your Supabase stack | Included in plan |
| Yjs/y-presence | Collaborative presence with cursor/selection tracking | Pairs with Yjs CRDT sync | Open source |
| Liveblocks | Full-featured collaborative presence, cursors, comments, history | SaaS; React hooks first-class | Free up to 100 users, then $99+/month |
| PartyKit | Flexible WebSocket-based presence and sync | Durable Object-based | Newer; free tier available |

[Liveblocks integrates directly with Yjs and Supabase](https://liveblocks.io/docs/guides/how-to-synchronize-your-liveblocks-yjs-document-data-to-a-supabase-postgres-database), syncing Yjs document data to Postgres via webhooks. This is a powerful pattern: Liveblocks handles the real-time collaboration layer, Supabase handles persistent storage.

**Recommendation for SiteSync PM:**
- **MVP:** Use Supabase Presence directly for basic "who's online per project" tracking
- **Collaborative drawings/documents:** Add Yjs with Supabase Realtime as the WebSocket provider (open source, no additional cost)
- **Rich collaboration features (cursors, comments, multiplayer selection):** Evaluate Liveblocks when collaboration is a core differentiator — the React SDK is exceptional

### 7.4 Real-Time Collaboration on Construction Documents

**What's achievable:**
- ✅ Multi-user presence on the same drawing view (up to 50 simultaneous users feasibly)
- ✅ Real-time markup/annotation sync (Yjs + canvas library like Fabric.js or Konva)
- ✅ Concurrent RFI editing with conflict merging (Yjs text CRDT)
- ✅ Live status updates on task boards (Supabase Postgres Changes)
- ✅ Real-time cost change notifications (Supabase Broadcast)
- ⚠️ True co-authoring of BIM/CAD files (not feasible in browser; use desktop app integration)
- ❌ Real-time PDF co-editing (PDFs are binary; manage as version-controlled uploads instead)

**Yjs implementation pattern:**
```typescript
import * as Y from 'yjs';
import { SupabaseProvider } from '@supabase/realtime-js/experimental';

const ydoc = new Y.Doc();
const provider = new SupabaseProvider(supabase, {
  id: `project-${projectId}`,
  doc: ydoc,
});

// Annotations as a shared Y.Array
const annotations = ydoc.getArray('annotations');
annotations.observe(() => {
  // Re-render canvas annotations
  renderAnnotations(annotations.toArray());
});
```

### 7.5 Push Notifications for Field Workers

For field workers using the Capacitor-wrapped app (iOS/Android):

**Architecture:**
1. **FCM (Firebase Cloud Messaging)** handles both Android and iOS (via FCM → APNs bridge)
2. Supabase Edge Function or a dedicated notification service sends FCM messages
3. Capacitor's `@capacitor/push-notifications` plugin handles receipt on-device

[Per Capawesome's push notification guide](https://capawesome.io/blog/the-push-notifications-guide-for-capacitor/), the recommended stack:

```typescript
// Request permission and get FCM token
import { PushNotifications } from '@capacitor/push-notifications';

await PushNotifications.requestPermissions();
await PushNotifications.register();

PushNotifications.addListener('registration', (token) => {
  // Send token to Supabase
  await supabase.from('device_tokens').upsert({
    user_id: user.id,
    fcm_token: token.value,
    platform: Capacitor.getPlatform(),
  });
});
```

```typescript
// Supabase Edge Function to send notifications
const payload = {
  message: {
    notification: { title: 'New RFI', body: 'RFI #123 assigned to you' },
    token: deviceToken,
    data: { type: 'rfi', rfi_id: '123', project_id: 'abc' }
  }
};
// POST to FCM v1 API with service account auth
```

**Key considerations for construction:**
- Field workers often have intermittent connectivity; notifications must queue and deliver when back online
- Deep link from notification → specific project/RFI in the app
- iOS requires explicit APNs certificate configuration in Firebase Console
- Notification analytics are important — track open rates, time-to-response for RFI assignments

---

## 8. Decision Framework Summary

### SOC2 Roadmap for SiteSync PM

```
Month 1-3:   Implement core controls (MFA, RBAC, logging, CI/CD security)
             Sign up for Secureframe or Vanta ($5K-$10K/year)
             Engage SOC2 auditor
Month 3-4:   SOC2 Type I audit → USE this report for first enterprise deals
Month 4-9:   Type II observation window (3-6 months)
Month 9-12:  SOC2 Type II report → Unlock unrestricted enterprise sales
Budget:      $20K-$35K all-in for a 10-person startup
```

### FedRAMP Decision Gate

| Condition | Action |
|---|---|
| No federal pipeline in sight | Skip FedRAMP; focus SOC2 + CMMC Level 1 |
| Federal RFPs emerging | Evaluate partnership with FedRAMP-authorized platform (Knox, etc.) |
| $20M+ ARR + committed federal pipeline | Begin FedRAMP Moderate pursuit (~$500K-$1.5M, 12-24 months) |

### Infrastructure Scale Thresholds

| Milestone | Supabase Plan | Monthly DB Cost | Key Actions |
|---|---|---|---|
| 0–1K users | Pro (base) | $25 | Pooler connection string, basic RLS |
| 1K–10K users | Pro + Medium compute | $85 | Optimize RLS indexes, implement caching |
| 10K–100K users | Pro + XL compute | $235 | Read replicas, connection audit, SIEM |
| 100K–500K users | Team + 2XL–4XL | $1K-$1.6K | Query optimization, evaluate Redis layer |
| 500K+ users | Enterprise or self-host | Custom | Architecture review, potential sharding |

### Technology Recommendations by Phase

| Feature | MVP (0–6 months) | Growth (6–18 months) | Scale (18+ months) |
|---|---|---|---|
| Offline storage | Dexie.js (IndexedDB) | Dexie.js + OPFS backend | Evaluate wa-sqlite for complex queries |
| Conflict resolution | Last-Write-Wins | Yjs for documents | Yjs + custom CRDT for domain objects |
| Real-time | Supabase Realtime Presence | Supabase + Yjs | Liveblocks or custom WS infrastructure |
| Push notifications | FCM via Capacitor | FCM + notification service | Multi-channel (push + email + SMS) |
| Audit logging | Postgres append-only table | + Log drain to S3 with Object Lock | Immutable pipeline with OpenTelemetry |
| Compliance | SOC2 Type I | SOC2 Type II | FedRAMP (if federal pipeline justifies) |

---

*Research sources:*
- *[Comp AI SOC2 timeline guide](https://trycomp.ai/how-long-does-soc-2-compliance-take)*
- *[SecureLeap Vanta vs Drata vs Secureframe](https://www.secureleap.tech/blog/soc-2-tools-vanta-drata-secureframe-guide-2025)*
- *[Supabase SOC2 compliance documentation](https://supabase.com/docs/guides/security/soc-2-compliance)*
- *[Vercel SOC2 compliance](https://vercel.com/kb/guide/is-vercel-soc-2-compliant)*
- *[Procore FedRAMP Moderate Authorization announcement](https://www.procore.com/press/procore-for-government-achieves-fedramp-moderate-authorization)*
- *[Paramify FedRAMP cost analysis](https://www.paramify.com/blog/fedramp-cost)*
- *[Knox Systems FedRAMP timeline guide](https://knoxsystems.com/resources/fedramp-authorization-timeline)*
- *[SmartPM FedRAMP construction software overview 2026](https://smartpm.com/blog/fedramp-authorized-construction-software)*
- *[Supabase Realtime limits documentation](https://supabase.com/docs/guides/realtime/limits)*
- *[Supabase connection management docs](https://supabase.com/docs/guides/database/connection-management)*
- *[Supabase RLS performance docs](https://supabase.com/docs/guides/database/postgres/row-level-security)*
- *[Supabase pricing](https://supabase.com/pricing)*
- *[Prince Nzanzu: Scale Supabase to 100K+ users](https://princenocode.com/blog/scale-supabase-production-guide)*
- *[Supascale: self-hosted vs cloud](https://www.supascale.app/blog/supabase-selfhosted-vs-cloud-complete-comparison)*
- *[Vercel pricing breakdown](https://flexprice.io/blog/vercel-pricing-breakdown)*
- *[Vendr Vercel pricing analysis](https://www.vendr.com/marketplace/vercel)*
- *[RxDB storage comparison](https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html)*
- *[CRDTs vs Operational Transform analysis](https://dev.to/puritanic/building-collaborative-interfaces-operational-transforms-vs-crdts-2obo)*
- *[Liveblocks Yjs + Supabase sync guide](https://liveblocks.io/docs/guides/how-to-synchronize-your-liveblocks-yjs-document-data-to-a-supabase-postgres-database)*
- *[Capawesome push notifications guide](https://capawesome.io/blog/the-push-notifications-guide-for-capacitor/)*
- *[Kiteworks AES-256 CMMC guide](https://www.kiteworks.com/cmmc-compliance/cmmc-encryption-aes-256/)*
- *[hoop.dev: Immutable audit logs](https://hoop.dev/blog/immutable-audit-logs-the-key-to-soc-2-compliance-and-trust)*
- *[Iterators: SOC2 for SaaS](https://www.iteratorshq.com/blog/soc2-compliance-for-saas-why-enterprise-customers-demand-it-and-how-to-get-certified/)*
- *[Procore FedRAMP construction compliance guide](https://www.procore.com/library/fedramp-construction-compliance)*
- *[ProjectTeam.com FedRAMP construction guide](https://blog.projectteam.com/what-fedramp-authorization-really-means-for-federal-construction-contractors)*
- *[Convox FedRAMP 2026 guide](https://www.convox.com/blog/fedramp-authorization-2026-guide-saas-companies)*

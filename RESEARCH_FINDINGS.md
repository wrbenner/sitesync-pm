# RESEARCH_FINDINGS.md — Intelligence Deposit (April 8, 2026)
*Frontier research the organism and Product Mind must absorb. Updated periodically.*

---

## I. Self-Improving Systems (ICLR 2026 Workshop on RSI)

The frontier is not "AI that codes." It is "AI that improves how it improves."

### HyperAgents (2026)
Meta-level self-modification. The agent does not just learn patterns — it improves its own improvement process. Meta-skills (memory management, prompt engineering, exploration strategies) are domain-general and compound across tasks. This is the next evolution of the SiteSync organism.

**Application:** The Product Mind should periodically evaluate whether its own decision-making process is producing good outcomes and adjust its approach.

### Karpathy's Autoresearch Loop (March 2026)
630 lines of Python. 700 experiments in 2 days. 20 optimizations discovered. 11% efficiency gain on Time-to-GPT-2. The simplest proof that autonomous loops work at scale.

**Application:** The SiteSync organism is this — running nightly experiments. But Karpathy ran 700 in 2 days. We run 3/day. The question is whether we can increase iteration rate.

### Voyager Skill Library (NVIDIA + Caltech)
Lifelong learning by storing successful programs in an expanding skill library. 3.3x more unique items. 15.3x faster milestones. The key: reusable skills that compound.

**Application:** EVOLUTION_LEDGER.json should become a skill library. Each successful pattern is a composable skill that future sessions can invoke.

### SWE-RL (Meta, Dec 2025)
Self-play for coding. The agent injects bugs into real codebases, then trains itself to fix them. The agent gets better at debugging by creating its own training data.

**Application:** The /red-team command could include a "self-play" mode where the organism deliberately introduces defects, then fixes them, strengthening its repair skills.

### Emergent Internal Self-Debate (Jan 2026)
Reasoning models like DeepSeek-R1 spontaneously simulate multi-agent debates WITHIN their own chain of thought. Without external prompting. Steering these produces +27% accuracy improvement. The model argues with itself and gets better answers.

**Application:** The nightly organism prompt should encourage internal debate: "Before implementing, argue both sides of the approach. Consider at least 2 alternative approaches. Then choose."

### Key Insight: Model Collapse Prevention
Research warns of two failure modes in self-improving systems:
1. **Entropy Decay** — the system's strategy space shrinks with each iteration (doing the same thing over and over)
2. **Variance Amplification** — drift from reality without grounding in real data

**Application for SiteSync:** The Product Mind must watch for the organism doing the same type of work repeatedly (entropy decay). If it spent 3 nights on type safety, force a switch to a completely different domain. The MARKET_INTELLIGENCE.md and COMPETITIVE.md serve as reality grounding.

---

## II. Agent Teams (Claude Code, Feb 2026)

### What Shipped
- Peer-to-peer communication via mailbox (not hub-spoke)
- Shared task list with dependency management
- Each teammate: own context window, own tool access
- Anthropic's code review coverage: 16% → 54% using Agent Teams

### Why This Matters for SiteSync
The nightly build currently runs ONE agent sequentially. With Agent Teams, one session could decompose into:
- **Investigator:** reads the prompt file, identifies what needs changing
- **Implementer:** writes the code
- **Tester:** writes tests for what the implementer built
- **Verifier:** adversarially checks the implementation

All working in parallel within a single 120-turn session. Effective turns: 480 instead of 120.

### Current Limitation
Agent Teams is experimental. For autonomous nightly runs, stability matters more than speed. **Recommendation:** Monitor Agent Teams stability. Enable when Anthropic marks it production-ready. For now, the single-agent approach with 120 turns is safer.

---

## III. Construction AI (Autodesk 25-Expert Report, 2026)

### The Shift
"2026 marks the shift from AI as a 'future trend' to 'industry baseline.' Firms that fail to adopt risk losing contracts."

### What Experts Are Saying
- "AI assistants will act as virtual project engineers — answer technical questions, track daily tasks, detect safety risks, produce reports automatically"
- "Predictive analytics powered by digital twins: teams identify delays and cost overruns months earlier"
- "MCP will be used to build more robust digital workflows by connecting capabilities and automating manual tasks"
- "Networks of AI agents will operate across design, engineering, and construction"
- "Companies that adapt will see compounding advantage through 2027 and beyond"

### What This Means for SiteSync
1. **MCP Server is now urgent, not future** — the industry expects MCP-connected tools in 2026
2. **The AI Copilot is not a feature, it is the product** — "virtual project engineer" is what SiteSync already has
3. **Predictive analytics is table stakes** — schedule risk, cost overrun prediction, safety trend analysis
4. **Digital twins are mainstream** — the BIM viewer + real-time data = SiteSync's digital twin story
5. **Early adopters capture disproportionate value** — the moat is compounding. Start now.

---

## IV. SaaS Market Trends (2026)

### The Three Forces
1. **Agentic AI is the new default.** 95% of orgs use AI-powered SaaS. Shift from copilots to autonomous agents.
2. **Vertical SaaS is winning.** Growing 18-32% annually vs 12-15% for horizontal. 35% of total SaaS revenue. SiteSync IS vertical SaaS.
3. **Hybrid pricing.** Subscription + usage-based. 85% of SaaS companies now use some form of usage-based billing.

### What Winners Do
- "Stop building features for everyone. Start building solutions for someone." — SiteSync builds for GCs.
- API-first and composable architecture — MCP server, TypeScript SDK, REST API
- Mobile-first is non-negotiable — "users expect native-quality experiences, not responsive web wrappers"
- From seat-based to outcome-based pricing — "when one user with an AI agent can do the work of ten, per-seat pricing breaks down"

### SiteSync's Position
SiteSync is perfectly positioned as vertical SaaS with agentic AI, API-first architecture, and mobile-first design. The market is moving toward exactly what we are building.

---

## V. Procore Competitive Intelligence (Updated April 2026)

### Procore's Vulnerabilities (from reviews, analyst reports, competitor positioning)
1. **Pricing is cost-prohibitive for mid-market** — "tens to hundreds of thousands annually"
2. **Mobile app has performance issues** — "crashes and slow response times"
3. **Steep learning curve** — "requires comprehensive training"
4. **Click-dense interfaces** — "built for very large organizations rather than mid-market teams"
5. **Onboarding takes months** — "lengthy onboarding most mid-market teams can't absorb"
6. **Multiple acquisitions = inconsistent UX** — Autodesk CC has this same problem

### What Competitors Are Exploiting
- **Constructable.ai:** Targeting mid-market with "fast onboarding, transparent pricing, field and office alignment, AI-powered search"
- **Fieldwire (Hilti):** Field execution excellence but no financial tracking
- **RedTeam:** Cheap but dated ("feels like 2012")
- **INGENIOUS.BUILD:** Better for owners than GCs

### SiteSync's Opening
The mid-market ($5M-$100M ACV) is underserved. Procore is too expensive and complex. Fieldwire is field-only. Nobody has AI-native + financial engine + field-first UX. SiteSync wins this segment.

---

## VI. Recommendations for the Product Mind

Based on all research, the Product Mind should prioritize:

1. **MCP Server** — Move from V6 backlog to near-term. The industry expects MCP-connected tools NOW.
2. **Mobile excellence** — V7 polish must ensure 44px touch targets, offline capability, and native-quality feel. This is the #1 field differentiator.
3. **AI Copilot as the centerpiece** — Not a chatbot sidebar. The virtual project engineer that answers questions, surfaces risks, and produces reports. This is what 25 experts say the industry needs.
4. **Transparent pricing page** — Procore hides pricing. SiteSync publishes it. Trust signal.
5. **5-minute onboarding** — Procore takes months. SiteSync takes 5 minutes. The adaptive onboarding wizard.
6. **Watch for entropy decay** — If the organism repeats the same type of work 3 nights in a row, force a domain switch.
7. **Enable Agent Teams when stable** — 4x productivity per session is available when Anthropic marks it production-ready.

---

## Sources
- [ICLR 2026 Workshop on AI with Recursive Self-Improvement](https://iclr.cc/virtual/2026/workshop/10000796)
- [O-Mega: Self-Improving AI Agents 2026 Guide](https://o-mega.ai/articles/self-improving-ai-agents-the-2026-guide)
- [Autodesk: 2026 AI Construction Trends — 25+ Experts](https://www.autodesk.com/blogs/construction/2026-ai-trends-25-experts-share-insights/)
- [Constructable: Procore Alternatives for Mid-Market](https://constructable.ai/blog/procore-alternatives-mid-market-contractors)
- [Claude Code Agent Teams Guide](https://claudefa.st/blog/guide/agents/agent-teams)
- [Shipyard: Multi-Agent Orchestration for Claude Code](https://shipyard.build/blog/claude-code-multi-agent/)
- [Cogent Info: AI-Driven Self-Evolving Software 2026](https://cogentinfo.com/resources/ai-driven-self-evolving-software-the-rise-of-autonomous-codebases-by-2026)
- [Modall: 25 SaaS Trends 2026](https://modall.ca/blog/saas-trends)
- [Ralph: Autonomous AI Agent Loop](https://github.com/snarktank/ralph)

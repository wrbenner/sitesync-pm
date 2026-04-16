# Autonomous Organism Architecture v2
## Deep Research: Self-Improving AI Systems for Autonomous Construction PM Software

*Research compiled for designing an autonomous AI system that builds and improves a construction PM software platform without human intervention.*

---

## Table of Contents

1. [Self-Improving AI Systems — State of the Art](#1-self-improving-ai-systems--state-of-the-art)
2. [Autonomous Code Generation at Scale](#2-autonomous-code-generation-at-scale)
3. [Guardrails for Autonomous Systems](#3-guardrails-for-autonomous-systems)
4. [Multi-Model Orchestration](#4-multi-model-orchestration)
5. [Learning and Memory](#5-learning-and-memory)
6. [Real-World Examples](#6-real-world-examples)
7. [Synthesis: Architecture Recommendations for Construction PM Platform](#7-synthesis-architecture-recommendations)

---

## 1. Self-Improving AI Systems — State of the Art

### The Core Paradigm: Generator-Verifier-Updater (GVU)

Every self-improving AI system, regardless of its branding, reduces to three operations working in a loop:

| Component | Role | Examples |
|-----------|------|---------|
| **Generator** | Produces candidate solutions/code/improvements | LLM proposing code edits, mutations, tool additions |
| **Verifier** | Evaluates and scores candidate outputs | Test suites, benchmarks, reward models, human review |
| **Updater** | Integrates feedback to improve the system | Fine-tuning, prompt editing, code modifications |

The [GVU operator](https://arxiv.org/html/2512.02731v1) provides a formal mathematical unification of all self-improvement approaches — RL, self-play (AlphaZero), GANs, Reflexion, and SICA are all specializations. The key insight: self-improvement is only stable when the noise in generation and verification is bounded by a "Variance Inequality." When verifier noise is too high (the verifier can't reliably judge quality), self-improvement loops collapse or regress.

### The Benchmark: How Fast Is the Field Moving?

[METR benchmarks](https://o-mega.ai/articles/self-improving-ai-agents-the-2026-guide) show AI agent task completion horizon has been **doubling every 7 months for 6 years** (R² = 0.98). In 2024–2025, this accelerated to every 4 months. Current frontier models reliably complete ~50-minute tasks autonomously. A year ago: under 15 minutes.

**SWE-bench trajectory** (real GitHub issue resolution):
| Year | System | Score |
|------|--------|-------|
| Early 2024 | Devin (launch) | 13.86% |
| Early 2024 | SWE-agent (GPT-4 Turbo) | 12.5% |
| Mid-2025 | SICA | 53% |
| Mid-2025 | DGM | 50% |
| Late 2025 | Live-SWE-agent | 75.4% |
| Mid-2025 | GPT-5.2 | 72.8% (Verified subset) |

---

### Google DeepMind: AlphaCode → AlphaProof → AlphaEvolve

**AlphaCode (2022):** Competitive programming at median human level. Trained on GitHub + Codeforces. Required to produce unique solutions, not duplicates. Landmark for establishing LLMs could write nontrivial code.

**AlphaProof (2024):** A step-change in architecture. [AlphaProof](https://www.nature.com/articles/s41586-025-09833-y) couples an LLM with AlphaZero-style reinforcement learning. The LLM fine-tunes on Gemini to auto-translate natural language problems into formal Lean statements, creating a massive library of problems at varying difficulty. AlphaZero then searches for proofs. Key: **the system generates its own training curriculum** by creating formal problems, attempts proofs, and uses proof success/failure as the training signal. At IMO 2024, AlphaProof solved 3/5 non-geometry problems including the hardest — silver medal equivalent. The pattern: **formal verification as the ground-truth signal** eliminates ambiguous human judgment.

**AlphaEvolve (May 2025):** The most architecturally relevant system for autonomous coding. [AlphaEvolve](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/) is an evolutionary coding agent that:

1. Takes an existing algorithm + evaluation metrics as inputs
2. Uses **Gemini Flash** (breadth/speed) and **Gemini Pro** (depth/insight) together — Flash maximizes search coverage, Pro handles critical refinements
3. Proposes mutations/improvements to the algorithm as code changes
4. Runs automated evaluators that score solutions objectively
5. Keeps the best candidates, discards the rest, evolves forward

**AlphaEvolve's real-world results:**
- Recovering 0.7% of Google's worldwide compute (Borg scheduler optimization) — now in production 1+ years
- 23% speedup for matrix multiplication kernel in Gemini's own training pipeline
- 32.5% speedup for FlashAttention
- Discovered first improvement to matrix multiplication since Strassen's 1969 algorithm
- On 50+ open math problems: rediscovered state-of-art 75%, improved on it 20%

**Critical difference from previous systems:** AlphaEvolve can evolve entire codebases, not just single functions. It also accelerated its own training — the system improved the LLM that runs it. This is the recursive self-improvement pattern applied in practice.

---

### Sakana AI: The AI Scientist

[The AI Scientist](https://sakana.ai/ai-scientist-nature/) (published in *Nature*, March 2026) represents the most complete autonomous research agent to date. Starting from a broad research direction, it:
1. Generates novel hypotheses autonomously
2. Searches and reads relevant literature
3. Designs, programs, and runs experiments via parallelized **agentic tree search**
4. Writes full LaTeX papers with AI-vision feedback on figures
5. Submits to peer review

**Key results:** AI Scientist-v2 produced the first fully AI-generated paper to pass rigorous human peer review (ICLR 2025 workshop). Three papers submitted; one accepted. Sakana's team notes it's "not at the level of the best human papers" but the trajectory is clear.

**Architecture insight for construction PM:** The agentic tree search pattern — exploring a tree of possibilities, backtracking from dead ends, keeping a growing record of what was tried — is directly applicable to a system exploring software improvement strategies.

---

### NVIDIA Voyager: Lifelong Learning Agent

[Voyager](https://voyager.minedojo.org) remains the canonical reference for the three components that make autonomous learning work:

**1. Automatic Curriculum (Task Selection)**
- GPT-4 proposes next tasks based on current skill level and world state
- Goal: "discover as many diverse things as possible" — explicit novelty bias
- Adapts to environment (desert → harvest sand before iron; forest → different priority)
- Self-driven continual exploration

**2. Skill Library (Memory)**
- Every successful program stored in a vector database indexed by natural-language description embedding
- Retrieval: top-5 most relevant skills for new tasks via embedding similarity
- Complex skills are synthesized by composing simpler skills — compounding capability
- Prevents catastrophic forgetting (old skills remain available)

**3. Iterative Prompting Mechanism (Self-Evaluation)**
- Environment feedback + execution errors → GPT-4 refines the program
- Self-verification: GPT-4 acts as a critic, checks if program achieved the task
- No model fine-tuning required — all in-context

**Empirical result:** Voyager obtains 3.3× more unique items, travels 2.3× longer distances, unlocks tech tree milestones up to 15.3× faster than prior SOTA. The skill library generalizes to entirely new environments.

---

### SICA: Self-Improving Coding Agent (2025)

[SICA](https://arxiv.org/html/2504.15228v2) is the most directly applicable architecture for an autonomous software improvement system. It **eliminates the distinction between the meta-agent and target agent** — the same system that edits code also edits its own code.

**Architecture:**
- Maintains an **archive** of all previous agent versions + their benchmark scores
- The best-performing agent (by utility function) becomes the meta-agent
- Utility function: `U = 0.5 × benchmark_score + 0.25 × (1 - cost/cap) + 0.25 × (1 - time/timeout)`
- Meta-agent analyzes the archive, identifies an improvement opportunity, implements it
- New agent evaluated on benchmarks; result stored in archive

**The 14 improvements SICA autonomously discovered** (over 15 iterations, ~$7,000 API cost):
1. Smart Editor (optimal file editing strategy selection)
2. Quick Overwrite Tool (reduced token usage)
3. Diff-Enhanced Smart Editor (pattern-based editing)
4. Code Context Summarizer (ripgrep-based exploration)
5. File Edit Verification (state tracking)
6. AST Symbol Locator (code navigation)
7. Hybrid Symbol Locator (ripgrep + AST)
8. Optimized AST Parsing (targets relevant regions)
9. ...and 6 more incremental tooling improvements

**Results:** SWE-bench Verified improved from 17% → 53% (iteration 0 → 14). The system got faster (130s avg → 114s) and cheaper (cost decrease) while improving quality.

**Safety architecture:** Asynchronous overseer LLM monitors for pathological behavior, intervenes via in-lined messages or cancels execution. Hard limits: $10/problem cost cap, 300s timeout.

---

### Darwin Gödel Machine (DGM, Sakana AI, May 2025)

[DGM](https://sakana.ai/dgm/) combines SICA-style self-improvement with open-ended evolutionary exploration. The key innovation: it doesn't just keep the single best agent — it maintains a **growing archive of diverse, high-quality agents** (MAP-Elites style), using each as a potential starting point for further evolution.

**Why this matters:** Without open-ended exploration, the system gets trapped in local optima. DGM demonstrated that both self-improvement AND open-ended exploration are necessary:
- DGM: 20% → 50% on SWE-bench, 14.2% → 30.7% on Polyglot
- DGM without self-improvement: significantly lower
- DGM without open-ended exploration: significantly lower
- Both components together: necessary for continuous improvement

**Critical finding for construction PM:** Improvements discovered by DGM (better tools, refined workflows) **generalize across underlying LLMs** — an agent optimized with Claude 3.5 Sonnet also improved when powered by o3-mini or Claude 3.7 Sonnet. The system discovers *general design improvements*, not model-specific tricks.

---

### SWE-agent and the ACI Pattern

[SWE-agent](https://proceedings.neurips.cc/paper_files/paper/2024/file/5a7c947568c1b1328ccc5230172e1e7c-Paper-Conference.pdf) introduced the concept of **Agent-Computer Interface (ACI)**: a purpose-built abstraction layer between an LLM and a computer, designed for how LLMs actually read and write rather than how humans do. Key design principles:
- Show the LLM concise, relevant file content (not raw shell dumps)
- Provide structured navigation tools
- Return clear success/failure signals after each action
- Design interfaces that make it "inevitable for the model to succeed"

SWE-agent showed that a well-designed ACI outperforms a powerful LLM without one by 6-7× on real engineering tasks. This means **interface design matters as much as model capability**.

---

### The Distinction: Polishing vs. Architecting

This is the critical capability gap in current systems:

| **Polishing Systems** | **Architecting Systems** |
|----------------------|-------------------------|
| Fix bugs in existing patterns | Design new system components |
| Add endpoints following existing conventions | Invent new architectural patterns |
| Refactor within established boundaries | Restructure across boundaries |
| Work at task horizon < 1 hour | Work at task horizon > 1 day |
| SWE-bench style problems | SWE-EVO style problems |

[SWE-EVO](https://arxiv.org/html/2512.18470v5) — a benchmark requiring multi-file changes across 21 files average, validated against 874 tests — reveals this gap starkly: GPT-5.4 achieves only 25% on SWE-EVO despite 72.8% on SWE-bench Verified. The failure mode for stronger models is semantic: **misinterpreting nuanced requirements** and missing the "why" behind design decisions.

For a construction PM platform, this means the autonomous system is highly capable at polishing and incremental improvement, but architecting major new modules (e.g., a new scheduling engine from scratch) requires more structured human input at the specification level.

---

## 2. Autonomous Code Generation at Scale

### Task Selection: What to Work on Next

The naive approach — random selection or fixed priority lists — produces poor results because agents get stuck on tasks above their current capability or waste time on trivial items below it. The best approaches:

**1. Curriculum-Based Selection (Voyager/AlphaProof pattern)**
- The agent assesses its current "skill level" and world state
- Proposes tasks at the frontier of its capability — hard enough to push skills, easy enough to succeed
- Explicitly novelty-biased: penalize tasks similar to ones already completed
- Implementation: "Given skills [X, Y, Z] and environment state [S], what is the most valuable task I haven't tried?"

**2. Value-of-Information Selection**
- Prioritize tasks where uncertainty is highest and the outcome would most update future decisions
- Tasks that unlock other tasks get priority (dependency graph traversal)
- Tasks with clearest verifiability get preference (since unverifiable outcomes can't reliably train the system)

**3. Failure-Gap Analysis**
- Track which categories of tasks have lowest success rate
- Prioritize improvements that would close the largest performance gaps
- SICA does this explicitly: the meta-agent reviews the archive looking for patterns in failures

**4. Backlog-Driven with Impact Scoring**
For a construction PM platform specifically, a prioritized backlog with scores across dimensions:
- User impact (affects how many users, how frequently)
- Verifiability (can automated tests confirm success?)
- Dependency (does this unlock other work?)
- Risk (could this break existing functionality?)

---

### Avoiding Mode Collapse

Mode collapse in autonomous systems = the agent converges to a small set of solution patterns, stops exploring, and gets stuck in a local optimum. Mechanisms that prevent it:

**1. Diversity-Preserving Archives (MAP-Elites)**
Rather than keeping only the single best solution, maintain an archive organized by behavioral dimensions. MAP-Elites partitions the solution space by descriptors (e.g., code complexity × test coverage) and keeps the best solution found in each cell. This creates a **population of diverse, high-quality stepping stones**.

[MAP-Elites](https://pmc.ncbi.nlm.nih.gov/articles/PMC8115726/) enables:
- Superior performance compared to single-objective search
- Better generalization when transferred to new environments
- Diverse ancestry that enables novel solutions requiring unexpected intermediate steps

**2. Explicit Novelty Rewards**
Add a novelty term to the utility function: solutions that are behaviorally different from anything in the archive get a bonus, even if their immediate quality is lower. This creates pressure to explore.

**3. Temperature/Epsilon Management**
- Higher temperature (more randomness) during early exploration phases
- Lower temperature (more exploitation) once good patterns are found
- ε-greedy: with probability ε, try a random approach; with probability 1-ε, use the best known

**4. Self-Challenging Adversarial Pair**
A separate "challenger" agent generates tasks specifically designed to expose gaps in the executor's capabilities. This prevents curriculum collapse — the agent can't stay near its comfort zone if the challenger is actively probing its weaknesses.

**5. Diverse Model Ensemble**
Using multiple LLMs with different architectures and training data naturally produces diverse solutions. When all models agree, the solution is likely valid; when they disagree, it signals a genuinely ambiguous problem worth more careful evaluation.

---

### How Systems Verify Their Own Work

The central tension: asking the same model that generated code to verify it produces biased results. [Anthropic's internal research](https://www.youtube.com/watch?v=9d5bzxVsocw) found that out-of-the-box Claude "identifies legitimate issues and then talks itself into deciding they weren't a big deal and approved the work anyway."

**Best practices:**

| Method | Mechanism | Reliability |
|--------|-----------|-------------|
| **Unit/integration tests** | Ground-truth automated verification | High (when tests are good) |
| **Separate verifier model** | Different model reviews output | Medium-high |
| **Cross-model perplexity (CMP)** | Verifier's surprise at generator's tokens | High for confident errors |
| **Process verification** | Check each reasoning step, not just outcome | 78.2% vs 72.4% for outcome-only |
| **Ensemble voting** | Multiple models independently assess | ~71.6% (better than single) |
| **Dynamic sandbox testing** | Execute code in isolated environment | High for functional correctness |
| **Self-consistency** | Multiple samples, majority vote | Good for reasoning tasks |

**Critical finding:** [Cross-Model Perplexity (CMP)](https://arxiv.org/abs/2603.25450) — measuring a verifier model's *surprise* at a generator's answer tokens — achieves AUROC of 0.75 vs 0.59 for within-model entropy. CMP specifically targets the most dangerous failure mode: *confident errors* (model is wrong but certain). It requires only a single forward pass through the verifier — no generation needed.

**For construction PM platform:** The verification stack should be layered:
1. Automated tests run first (fast, cheap, objective)
2. CMP-style cross-model check for remaining uncertainties
3. Separate verifier agent for complex changes
4. Human review reserved for architectural decisions

---

### Learning from Failures

The archive pattern (SICA/DGM) is the most robust approach. Every attempt — success or failure — is stored with:
- What was attempted (the code change / task)
- What happened (test results, error messages, benchmark scores)
- Why it likely failed (LLM-generated post-mortem)
- What alternatives weren't tried

**The "failed approaches" field is critical.** [Anthropic's long-running agent research](https://www.anthropic.com/research/long-running-Claude) found that without logging failed approaches, subsequent sessions re-attempt the same dead ends. Example log entry: *"Tried using Tsit5 for the perturbation ODE, system is too stiff. Switched to Kvaerno5."*

**SEA-TS (Self-Evolving Agent for Time Series)** implements this as "running prompt refinement" — after each successfully executed solution undergoes automated code review, running prompts are updated to persistently encode corrective patterns, preventing recurrence of similar mistakes in all subsequent iterations.

---

## 3. Guardrails for Autonomous Systems

### The Quality Ratchet Pattern

The [12-Factor AgentOps "Lock Progress Forward"](https://www.12factoragentops.com/factors/06-lock-progress-forward) pattern is the most rigorous implementation of "quality only goes up":

**The Brownian Ratchet Metaphor:** A gear that only turns forward. Chaos pushes it randomly, but only forward motion locks in. For autonomous agents:
- **Chaos is cheap:** Spawn 5 parallel agents trying different approaches
- **Filtering is the gate:** Validation separates winners from losers
- **The ratchet is the lock:** Validated work merges permanently; failures are discarded

**Implementation:**
```
main branch protection:
  - Require PR approval (automated or human)
  - Require all status checks (build, tests, security scan, performance)
  - Require linear history (no merge commits)
  - No force pushes
  - No branch deletions
```

**After validation, the ratchet locks:**
```json
{
  "timestamp": "2026-02-15T10:30:00Z",
  "agent": "builder-alpha",
  "action": "merge",
  "pr": "#123",
  "tests_passed": true,
  "performance_regression": false,
  "files_changed": 12,
  "lines_added": 340
}
```

**Anti-patterns to absolutely avoid:**
- Force-pushing to main (history rewrite breaks provenance)
- Deploying unvalidated code ("tests are slow, fix in prod")
- Merging without CI ("code looks fine")
- Infinite retry loops without failure budgets
- Reopening closed issues without new evidence

**Metrics that prove the ratchet is working:**
- Main is always green (CI passes 100%)
- Issue reopen rate < 5%
- Time-to-merge decreasing
- Agent success rate increasing
- Failure budget exhaustion decreasing

---

### Constitutional Constraints (Things the System Must Never Do)

[Anthropic's Constitutional AI](https://www.anthropic.com/constitution) demonstrates the principle: rather than rules, give the system *reasons*. A rule-following system breaks when it encounters edge cases the rules didn't anticipate. A reason-following system can generalize.

**Anthropic's 4-tier priority hierarchy (directly applicable to autonomous coders):**
1. **Broadly safe** — don't undermine human oversight mechanisms
2. **Broadly ethical** — don't do harm even if instructed to
3. **Compliant with guidelines** — follow operational constraints
4. **Genuinely helpful** — maximize value within the above constraints

**For a construction PM platform, the constitutional constraints should include:**

**Absolute prohibitions (hardcoded — the system must NEVER):**
- Modify production database schemas without explicit human approval
- Delete or truncate data without a reversible backup pathway
- Push to main branch without passing all CI checks
- Disable or bypass security controls
- Modify billing/financial calculation logic without senior review
- Remove test coverage (tests/lines-of-code ratio must not decrease)
- Accept credentials, API keys, or sensitive data into version control

**Soft defaults (can be adjusted by operators):**
- Minimum test coverage percentage for any changed file
- Performance regression threshold (e.g., no more than 5% slower)
- Maximum PR size (e.g., changes must be < 500 lines)
- Notification thresholds for human review

**Implementation approach:** Embed constitutional checks at multiple levels:
1. In the system prompt (reasoning-level — WHY these constraints exist)
2. As automated CI checks (enforcement-level — BLOCK on violation)
3. As a separate reviewer agent (detection-level — CATCH subtle violations)
4. In the merge policy (lock-level — PREVENT bypass)

---

### Exploration vs. Exploitation

The [exploration-exploitation tradeoff](https://arxiv.org/abs/2405.17503) in autonomous code improvement follows the same mathematics as multi-armed bandits. Key insight from NeurIPS 2024 research on code repair: refinement creates this tradeoff explicitly — **exploit** by refining the program with highest test pass rate, **explore** by refining a less-considered program.

**Thompson Sampling** is the optimal solution in many cases: maintain a probability distribution over solution quality, sample from it, and update based on outcomes. This naturally balances exploration and exploitation without requiring manual tuning.

**Practical implementation for construction PM:**
- **Early phase (high exploration):** ε = 0.3, try novel approaches 30% of the time
- **Mature phase (high exploitation):** ε = 0.1, 90% of time improve what works
- **Stagnation detection:** If benchmark hasn't improved in N iterations, force exploration
- **Parallel tracks:** Always maintain one "exploit" track and one "explore" track simultaneously

---

### Approval and Merge Policy

Based on empirical data from [33,707 agentic PRs studied on GitHub](https://arxiv.org/html/2601.00477v1):
- ~28% of agent PRs merge almost instantly for narrow automation tasks
- ~72% enter iterative review cycles
- Security-related PRs: 49-86% merge rate (by agent), with lower rates for complex/verbose PRs

**Recommended tiered merge policy for construction PM:**

| Risk Level | Criteria | Approval Required | Auto-merge |
|-----------|----------|-------------------|------------|
| **Low** | Tests only, no logic changes (docs, comments, types) | CI pass | Yes |
| **Medium-low** | Single file, new test added, < 100 lines | CI + automated review | Yes |
| **Medium** | Multi-file, feature extension of existing pattern | CI + automated review + test threshold | Conditional |
| **Medium-high** | New module, schema change, security-adjacent | CI + automated review + human approval | No |
| **High** | Architecture, billing, auth, DB schema | CI + senior human review | No |

**Key operating principle from mabl's production system:** AI code review catches issues before human reviewers spend time on them. Auto-fix agents resolve trivial CI failures (missing semicolons, unused imports, type mismatches) without human intervention. Humans focus on PRs that genuinely need judgment: architectural decisions, security implications, complex logic.

---

## 4. Multi-Model Orchestration

### When to Use Which Model

Different models have demonstrably different strengths, and the optimal system routes tasks dynamically:

| Model | Optimal Use Cases | Weaknesses |
|-------|------------------|------------|
| **Claude (Anthropic)** | Complex multi-file reasoning, instruction following, safety-sensitive code, long context | Can be overly cautious, verbosity |
| **GPT-4/5 (OpenAI)** | General coding, broad knowledge, tool use, parallel workloads | Less reliable on deep codebase understanding |
| **Gemini (Google)** | Multimodal (reading diagrams/screenshots), orchestration decisions, knowledge retrieval | Inconsistent on complex reasoning |
| **o3/o1 (OpenAI reasoning)** | Mathematical verification, complex logic, algorithmic design | Slow, expensive |
| **DeepSeek** | Code generation at low cost, open-source integration | Less aligned for safety-sensitive work |
| **Small distilled models** | Verification passes, style checks, simple routing | Limited capability on complex tasks |

**A practical orchestration architecture (from OliBot/production systems):**
1. **Gemini as orchestrator** — manages task routing, session control, determines when to escalate
2. **Claude Code as executor** — runs sandboxed code tasks with full tool access
3. **o3/o1 as verifier** — validates complex logical correctness
4. **Small ensemble as screening layer** — fast, cheap pre-filtering before expensive model calls

---

### Using Model Disagreement as a Signal

**Cross-Model Perplexity (CMP):** When a generator model produces output and a verifier model is highly "surprised" by it (high perplexity), this is a strong signal the output may be wrong — even if the generator was confident. [MIT/arXiv research](https://arxiv.org/abs/2603.25450) establishes:
- CMP achieves AUROC 0.75 vs 0.59 for within-model entropy on MMLU
- Works between same-sized models of different families
- Requires only a single forward pass — no generation from verifier
- Most effective for "confidently wrong" errors — the most dangerous failure mode

**Practical signal interpretation:**
```
High CMP (verifier very surprised) → flag for human review or re-generation
Low CMP (verifier unsurprised) → likely correct, proceed
Models diverge in generation → ambiguous problem, needs clarification
All models agree → high confidence, can auto-merge with test passing
```

**Routing logic:**
- If Model A and Model B produce significantly different code for the same task → escalate to human review or use a third model as tiebreaker
- If verification model has high perplexity on generated code → do not auto-merge
- If multiple models independently produce similar solutions → high confidence signal

---

### Red-Team / Blue-Team Patterns

**BlueCodeAgent** (from [arXiv research](https://arxiv.org/html/2510.18131v1)) implements this precisely:
- **Red team:** Generates diverse risky code instances, vulnerability examples, adversarial inputs
- **Blue team:** Uses red team outputs as training examples for defense; applies constitution + code analysis
- **Dynamic testing module:** Executes code in Docker sandbox to confirm whether reported vulnerabilities actually manifest — reduces false positives

**Key finding:** "Constitutions help increase true positives (TP) and reduce false negatives (FN), while dynamic testing primarily reduces false positives (FP)." They are complementary.

**For construction PM platform:**
- Red-team agent: "Generate a PR that would break the schedule calculation in a subtle, hard-to-detect way"
- Blue-team agent: "Review all PRs for any changes that could affect schedule integrity"
- Dynamic tester: "Run the schedule calculation on known test cases before and after any changes"

---

### Generate-Then-Verify Architecture

The most reliable pattern: **decouple generation from verification** and use separate agents for each.

```
Architecture:
  Generator Agent (Claude/GPT)
    ↓ produces PR/code change
  Static Analysis (lint, type check, AST analysis)
    ↓ fast automated gate
  Test Runner (unit + integration)
    ↓ functional correctness gate
  Cross-Model Verifier (separate model family)
    ↓ semantic correctness gate
  Domain Verifier (construction PM logic checks)
    ↓ business logic gate
  Merge Decision
```

The **generation-verification gap** — the space between what a model can generate and what it can reliably select — is, as [BuildML analysis](https://buildml.substack.com/p/the-verification-problem-why-your) notes, "probably the single biggest source of wasted capability." A model given 100 attempts at a problem gets the right answer 98.6% of the time — but reward models pick correctly only 78% of the time. The fix: combine multiple weak verifiers. A weighted ensemble of 33 open-source verifiers can match frontier reasoning models, and a 400M-parameter distilled verifier can carry 98% of the signal at 0.03% of the cost.

---

## 5. Learning and Memory

### Memory Architecture for Autonomous Systems

Autonomous agents require at least three memory tiers working together:

| Tier | Content | Duration | Access Pattern |
|------|---------|----------|---------------|
| **Working memory** | Current task context, open files, recent actions | Session | In-context window |
| **Episodic memory** | What was tried, outcomes, error messages | Weeks-months | Vector search by similarity |
| **Semantic memory** | Compressed learnings, patterns, anti-patterns | Permanent | RAG/keyword lookup |

**Claude-mem** (from [Corti.com](https://corti.com/claude-mem-persistent-memory-for-ai-coding-assistants/)) demonstrates the practical implementation:
- Automatically captures every tool execution (file reads, writes, searches)
- AI compresses observations into semantic summaries with 10× token reduction
- Progressive disclosure: inject only the most relevant ~50 observations per session
- Structured learnings: bugfix | feature | refactor | discovery, with "how-it-works | gotcha | trade-off" metadata
- **79% token reduction** vs. re-reading files each session

---

### What to Learn from Each Build Cycle

After every improvement cycle, the system should extract:

```json
{
  "cycle_id": "2026-04-15-003",
  "task": "Add multi-project dashboard to construction PM",
  "approach_taken": "Extended existing single-project view with portfolio aggregation layer",
  "approaches_rejected": [
    {"approach": "Complete rewrite to multi-tenant model", "reason": "Would break existing data model, too large scope"},
    {"approach": "Separate dashboard service", "reason": "Introduced latency, created data sync complexity"}
  ],
  "key_learnings": [
    "Construction PM users need drill-down from portfolio to project within 2 clicks",
    "Schedule data aggregation requires handling NULL completion dates gracefully"
  ],
  "gotchas": [
    "React Query invalidation must include portfolio cache when project status changes"
  ],
  "test_coverage_before": 0.73,
  "test_coverage_after": 0.79,
  "performance_before_p95": "210ms",
  "performance_after_p95": "185ms",
  "pr_merged": true,
  "human_intervention_required": false
}
```

---

### Evolution Ledgers

An evolution ledger is an **immutable, append-only log** of every improvement attempt. It serves multiple functions:

1. **Provenance:** Full audit trail of every change merged
2. **Anti-regression:** Basis for detecting if the system is re-trying failed approaches
3. **Training data:** Feed successful trajectories back into model fine-tuning
4. **Performance tracking:** Monitor whether the improvement rate is accelerating or stagnating

**Structure (from 12-Factor AgentOps):**
```json
{
  "timestamp": "ISO8601",
  "agent_id": "string",
  "action": "merge|reject|abandon",
  "pr_id": "string",
  "task_type": "bugfix|feature|refactor|performance|security",
  "files_changed": "integer",
  "test_delta": "float",
  "benchmark_delta": "float",
  "cost_tokens": "integer",
  "time_seconds": "float",
  "human_intervention": "boolean",
  "rejection_reason": "string|null"
}
```

---

### Skill Libraries

**Voyager's pattern** translated to software engineering: a skill is any reusable code capability that has been verified to work. [SkillNet](https://huggingface.co/blog/xzwnlx/skillnet) formalizes this:

```
Skill structure:
  - Name and description (searchable)
  - Trigger conditions (when to use this skill)
  - Required tools and interfaces
  - Execution policy (step-by-step)
  - Termination criteria
  - Success rate and resource consumption metadata
  - Relationships: compose_with, depends_on, similar_to, replaces
```

**Self-evolving skill libraries** (from [SoK: Agentic Skills](https://arxiv.org/html/2602.20867v1)):
- After each task, evaluate whether the successful trajectory warrants distillation into a reusable skill
- CRADLE extends Voyager with multi-level memory that links skills to episodic context — retrieval based on both task similarity AND environmental state
- AST-based skill abstraction: cluster policy code by abstract syntax tree similarity, synthesize higher-order functions via LLM

**For construction PM, example skills to accumulate:**
- "Add API endpoint following REST conventions in this codebase"
- "Extend React table component with new filterable column"
- "Add database migration for new field preserving existing data"
- "Write integration test for schedule calculation with edge cases"
- "Debug N+1 query in project loading logic"

**10-30% performance improvement** is achievable by incorporating relevant skills from a skill library before starting new tasks (SkillNet benchmark results on ALFWorld, WebShop, ScienceWorld).

---

### Knowledge Compression

Raw session logs are too large and noisy to use directly. The compression pipeline:

1. **Observation → Summary:** AI compresses tool execution logs into semantic summaries (10× token reduction)
2. **Summary → Pattern:** Multiple similar summaries merged into reusable patterns
3. **Pattern → Anti-pattern:** Failed patterns explicitly labeled so future agents avoid them
4. **Anti-pattern → Constitutional update:** Systemic failures elevate to constitutional constraints

**The "Ralph Loop" pattern** (from Anthropic's long-running agent research): When an agent claims completion on a complex task, a wrapper loop re-asks "are you *really* done?" This counters agentic laziness — models that find excuses to stop before finishing.

---

## 6. Real-World Examples

### Devin (Cognition AI) — 18 Months of Lessons

[Devin's 2025 performance review](https://cognition.ai/blog/devin-annual-performance-review-2025) is the most honest public post-mortem on autonomous AI software engineering at scale:

**What worked exceptionally well:**
| Task Type | Result |
|-----------|--------|
| Security vulnerability fixes | 20× efficiency gain vs. human (1.5 min vs. 30 min per vulnerability) |
| Database migrations (ETL) | 10× faster than human engineers |
| Framework upgrades | 14× faster than human engineers |
| Test generation | Coverage: 50-60% → 80-90% |
| Documentation (DeepWiki) | 400,000+ repos documented at one bank |
| Code review (first pass) | 67% of PRs merged (up from 34% first year) |

**What failed:**
- Ambiguous requirements with no clear success criterion
- Mid-task scope changes (performs worse when told "more" after starting)
- Tasks requiring implicit domain knowledge not in the codebase
- Tasks touching > 10-15 files with complex interdependencies
- Anything requiring human "soft skills" judgment

**Core lesson:** "Senior intelligence at codebase understanding, junior at execution." Devin excels at tasks with clear, upfront requirements and verifiable outcomes — the 4-8 hour junior engineer category at infinite scale and zero sleep.

**Architecture lesson for construction PM:** Design tasks for Devin-like agents: specific, clear requirements, verifiable outcomes, bounded scope. The system should auto-decompose ambiguous requests into verifiable sub-tasks before execution.

---

### GitHub Copilot Workspace — Human-in-the-Loop Autonomy

[Copilot Workspace](https://getathenic.com/blog/github-copilot-workspace-autonomous-dev-ga) (GA November 2025) takes a more conservative, human-supervised approach:
1. Reads the issue + linked docs + relevant codebase sections
2. Creates a plan with specific file changes (human reviews/modifies)
3. Implements across multiple files
4. Runs tests and linting
5. Opens PR for human review and merge

**Handles well:** Bug fixes with clear reproduction, feature additions following existing patterns, cross-codebase refactoring.

**Struggles with:** Architectural decisions requiring design judgment, novel implementations without existing patterns, issues requiring implicit context, changes touching > 10-15 files.

**Critical insight:** Copilot Workspace's reliability **scales with your test suite quality**. This is the clearest data point establishing that test coverage is the primary constraint on autonomous coding capability.

---

### Cursor 2.0 — Agent-First Architecture

[Cursor 2.0](https://www.digitalapplied.com/blog/cursor-2-0-agent-first-architecture-guide) (October 2025) introduced:
- **Composer model** built with RL — 4× faster than similarly capable models
- Up to **8 parallel agents** with Git worktree isolation (prevents conflicts)
- Autonomous multi-file refactors, terminal command execution, repository-wide changes
- Automatic test execution and verification after each change

**Key architectural difference from Copilot:** Cursor agents plan → execute → verify without requiring human approval at each step. The 8-agent parallel model allows exploring multiple approaches simultaneously — the MAP-Elites pattern in practice.

---

### Windsurf (Codeium) — Deep Context Autonomy

Windsurf's **Cascade** system:
- Indexes the entire codebase and automatically selects relevant context (no manual file tagging)
- Maintains persistent context across sessions via "Flow" memory
- Single-agent depth rather than multi-agent breadth
- Optimized for large monorepos and multi-module architectures

**Best for:** Focused work within a single repository where full-context understanding matters more than parallel exploration.

---

### Factory.ai ("Droids") — Agent-Native Development

[Factory's Droids](https://siliconangle.com/2025/09/25/factory-unleashes-droids-software-agents-50m-fresh-funding/) (September 2025, $50M in funding):
- LLM-agnostic and interface-agnostic (CLI, IDE, Slack, Linear)
- Handles full tasks: feature development, refactoring, code review, documentation, incident response
- #1 on TerminalBench benchmark
- Core thesis: "agent-native software development" — autonomous agents handle full tasks, humans handle high-level decisions

**Factory's key differentiator:** Flexibility at the interface level. Agents don't require you to change workflows. This is directly applicable to a construction PM platform — the system should integrate into GitHub/Jira/Slack native workflows rather than requiring a separate UI.

---

### Magic.dev — Ultra-Long Context for Autonomous Coding

[Magic.dev](https://magic.dev) ($515M raised) is building toward autonomous software engineering with three distinguishing approaches:
1. **Ultra-long context windows** ("Long-Term Memory Network" — LTM architecture)
2. **Reinforcement Learning from Code Execution Feedback (RLCEF)** — models execute code, hit errors, debug, and learn from the process (vs. just reading code)
3. **Domain-specific RL at scale** — frontier-scale pre-training with code-specific fine-tuning

**RLCEF pattern:** Exposing models to 800,000+ containerized repositories with test suites, running code, getting compiler feedback, learning from execution outcomes. This produces qualitatively different code understanding than static training.

---

### Poolside — RLCEF at Production Scale

[Poolside](https://www.sentinelone.com/s-ventures/blog/s-ventures-invests-in-poolside-next-generation-ai-for-software-engineering/) ($626M raised) runs RLCEF at 10,000 code executions per minute:
- Models learn from actual execution outcomes, not just text prediction
- Enterprise focus: models run entirely on-premises (code never leaves the organization)
- Custom fine-tuning on specific codebases — the internal payments API, the coding standards, the patterns
- Key for regulated industries (finance, healthcare) — and by extension, large construction enterprises

**Lesson for construction PM:** For an enterprise-grade autonomous system, on-premises operation and codebase-specific fine-tuning are significant differentiators. A model that has been trained on the construction PM codebase will vastly outperform a generic model given the same prompts.

---

### OpenAI Codex — Self-Bootstrapping at Scale

[OpenAI's Codex](https://newsletter.pragmaticengineer.com/p/how-codex-is-built) is the most dramatic example of recursive self-improvement in production:
- Codex writes **> 90%** of its own application code
- Used early iterations to troubleshoot its own training, oversee deployment, analyze test outcomes
- GPT-5.3-Codex: the first model that was "instrumental in creating itself"
- 910 experiments run autonomously in 8 hours, reaching 9× faster to best validation loss

**The "tiered code review" pattern:** Not all code from agents is treated equally — risk tier determines review depth. This exactly mirrors the merge policy table in Section 3.

---

### Construction-Specific AI Systems

[Current construction AI landscape](https://rtslabs.com/ai-agents-for-construction/) from 2025-2026:

| Tool | Domain | Capability |
|------|--------|-----------|
| Buildots | Progress tracking | Computer vision vs. BIM; 20% faster delivery, 15 hrs/week saved |
| Procore Copilot | PM workflow | Automates daily logs, RFI summaries, issue detection |
| Autodesk Construction Cloud AI | Document management | Issue detection, cost prediction |
| Doxel | Project controls | 38% less rework, 11% labor improvement; early budget/schedule warnings |
| Togal.AI | Estimating | 10× faster takeoff, 95%+ accuracy |
| RTS Labs Custom Agents | Full automation | Scheduling, maintenance, compliance, ESG reporting |

**Key domain-specific challenges for construction PM:**
- BIM model integration (structured 3D data)
- Schedule float calculations (critical path changes cascade)
- RFI/submittal lifecycle (complex multi-party workflows)
- Safety compliance logging (regulatory requirement)
- Cost code tracking (industry-specific taxonomy)
- Subcontractor coordination (external parties with varying tech sophistication)

**Construction AI by 2026 (per BuiltWorlds research):** Agents transition from co-pilots that surface information to systems that evaluate options across variables — proposing schedule adjustments, flagging design risks based on downstream impacts, recommending supply chain changes. Lower-stakes decisions (material selection) can be fully automated; higher-stakes decisions (project selection) retain human final approval.

---

## 7. Synthesis: Architecture Recommendations for Construction PM Platform

### The Core Architecture: Darwin-Voyager Loop

The optimal architecture synthesizes DGM's open-ended evolution, Voyager's three-component structure, and SICA's self-referential improvement:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONSTRUCTION PM AUTONOMOUS ORGANISM           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Curriculum  │    │  Skill       │    │  Evolution       │  │
│  │  Engine      │───▶│  Library     │    │  Archive         │  │
│  │              │    │  (vector DB) │    │  (all agents +   │  │
│  │ Task select  │    │              │    │   scores)        │  │
│  │ Priority     │    │ Skills       │    │                  │  │
│  │ Diversity    │    │ Patterns     │    │ Ledger entries   │  │
│  │ Gap analysis │    │ Anti-patterns│    │ Provenance       │  │
│  └──────┬───────┘    └──────────────┘    └──────────────────┘  │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              GENERATOR POOL (parallel)                    │   │
│  │   Claude Agent │ GPT Agent │ Gemini Agent │ ...           │   │
│  │   (each with sandbox, tools, codebase access)            │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              VERIFICATION STACK                           │   │
│  │  1. Automated tests (CI)                                  │   │
│  │  2. Cross-model perplexity check (CMP)                    │   │
│  │  3. Separate verifier agent                               │   │
│  │  4. Construction domain logic checks                      │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              RATCHET GATE                                 │   │
│  │  PASS → Merge to main, update archive, update skills     │   │
│  │  FAIL → Store failure in archive, log reason, discard    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Five Design Principles for the Construction PM Organism

**1. Verifiability First (Verification Oracle Principle)**
Every task the system attempts must have a machine-verifiable success criterion before execution begins. If success can only be judged subjectively, the task must be decomposed or deferred to human review. The system should only accept tasks where it can know whether it succeeded.

**2. The Ratchet Beats Perfection**
Accept a lower success rate per attempt in exchange for higher exploration velocity. 10 attempts at 50% success each produces more cumulative progress than 2 attempts at 80% success — and much faster. The ratchet ensures failures don't regress quality while allowing rapid exploration.

**3. Diversity Over Greedy Optimization**
Never reduce to a single "best agent." Maintain a population of agents across the behavioral space (MAP-Elites). This prevents mode collapse and provides stepping stones to solutions that require passing through apparently worse intermediate states.

**4. Memory Is the Moat**
The primary competitive advantage of an autonomous system that runs continuously is accumulated knowledge: what was tried, what worked, what patterns repeat, what anti-patterns to avoid. Invest disproportionately in memory architecture. A system with great memory and mediocre models will outperform a system with great models and amnesia.

**5. Constitution Over Rules**
Give the system the *reasons* behind its constraints, not just the constraints. A system that understands why it must never modify billing logic without review is more robust than one that has a rule "don't touch /src/billing/". The reason-following system generalizes to novel situations; the rule-following system breaks at every new edge case.

---

### Recommended Model Routing for Construction PM

```
Task arrives
    │
    ├── Architectural design / ADR writing
    │       → Claude (long context, careful reasoning)
    │
    ├── Rapid feature implementation (known patterns)
    │       → GPT-4 or Claude Sonnet (fast, cost-effective)
    │
    ├── Complex multi-file refactoring
    │       → Cursor Composer or Claude Code (RL-trained for code)
    │
    ├── Verification / code review
    │       → Different family than generator (CMP disagreement signal)
    │
    ├── Mathematical/algorithmic verification
    │       → o3 or o1 (best reasoning)
    │
    ├── Construction domain knowledge (RFI formats, spec sections)
    │       → RAG over construction PM corpus + Gemini (knowledge retrieval)
    │
    └── Security review
            → Dedicated security-trained model + BlueCodeAgent pattern
```

---

### Handling Construction-Specific Complexity

Construction PM is a domain with high-stakes, interconnected data:

- **Schedule changes cascade:** A one-day delay on one activity can ripple through hundreds of successor activities. The autonomous system must understand critical path logic before modifying scheduling code.
- **Regulatory compliance is non-negotiable:** OSHA safety logs, AIA contract forms, lien release workflows have legally mandated formats. Constitutional constraint: the system must never modify compliance-adjacent code without legal sign-off.
- **Multi-party workflows:** RFIs involve owner, architect, contractor, subcontractor — each with different access levels and notification requirements. Behavioral changes here affect real business relationships.
- **Historical project data is sacrosanct:** Never delete or modify historical cost, schedule, or safety records. All changes are additive.

These domain-specific constraints belong in the system's constitution at the highest priority level — above even general software engineering principles.

---

### The Build-Measure-Improve Flywheel

```
Week 1-2: Establish baseline
  → Full test suite
  → Performance benchmarks
  → Evolution ledger initialized
  → Skill library seeded with existing patterns

Week 3-4: First autonomous cycles
  → Low-risk tasks only (documentation, tests, minor bug fixes)
  → Human reviews all PRs
  → Skill library grows
  → Failure patterns recorded

Month 2: Expand autonomy
  → Auto-merge for lowest-risk tier with CI passing
  → Skill library retrieval active
  → Cross-model verification enabled
  → Red-team agent scanning PRs

Month 3+: Production autonomy
  → System selecting and executing medium-risk improvements
  → Human oversight on architectural changes only
  → Evolution archive showing measurable capability growth
  → Self-referential improvement loop active (system improving its own tooling)
```

---

*Research compiled from: [Sakana AI Nature paper](https://sakana.ai/ai-scientist-nature/), [DGM paper](https://sakana.ai/dgm/), [SICA arXiv](https://arxiv.org/html/2504.15228v2), [AlphaEvolve DeepMind blog](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/), [AlphaProof Nature](https://www.nature.com/articles/s41586-025-09833-y), [Voyager minedojo.org](https://voyager.minedojo.org), [SWE-agent NeurIPS 2024](https://proceedings.neurips.cc/paper_files/paper/2024/file/5a7c947568c1b1328ccc5230172e1e7c-Paper-Conference.pdf), [12-Factor AgentOps](https://www.12factoragentops.com/factors/06-lock-progress-forward), [Anthropic Constitution](https://www.anthropic.com/constitution), [Anthropic long-running agents](https://www.anthropic.com/research/long-running-Claude), [Cross-model disagreement arXiv](https://arxiv.org/abs/2603.25450), [GVU operator arXiv](https://arxiv.org/html/2512.02731v1), [Devin 2025 review](https://cognition.ai/blog/devin-annual-performance-review-2025), [GitHub Copilot Workspace GA](https://getathenic.com/blog/github-copilot-workspace-autonomous-dev-ga), [Cursor 2.0](https://www.digitalapplied.com/blog/cursor-2-0-agent-first-architecture-guide), [Factory Droids](https://siliconangle.com/2025/09/25/factory-unleashes-droids-software-agents-50m-fresh-funding/), [Poolside RLCEF](https://www.sentinelone.com/s-ventures/blog/s-ventures-invests-in-poolside-next-generation-ai-for-software-engineering/), [OpenAI Codex self-bootstrap](https://newsletter.pragmaticengineer.com/p/how-codex-is-built), [SWE-EVO arXiv](https://arxiv.org/html/2512.18470v5), [Self-improving agents taxonomy](https://yoheinakajima.com/better-ways-to-build-self-improving-ai-agents/), [SkillNet HuggingFace](https://huggingface.co/blog/xzwnlx/skillnet), [BlueCodeAgent arXiv](https://arxiv.org/html/2510.18131v1), [MAP-Elites PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8115726/), [BuiltWorlds construction AI](https://builtworlds.com/news/ai-building-blocks-construction-agents-automation-integration/)*

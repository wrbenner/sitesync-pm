# Organism Gap Analysis — April 6, 2026
*Mapping Walker's 13 biological systems to current SiteSync state*

| System | What Exists | Critical Gap | Addressed In |
|--------|-------------|-------------|-------------|
| **I. Cell** | XState machines (9), Zod schemas (partial), RLS policies | Cell differentiation not systematic. Base entity class missing. | V6/A5 (Night 2) |
| **II. Nervous System** | Supabase real-time (Night 3) | **AUTONOMIC CASCADES MISSING.** Schedule slip → downstream recalc → notifications. Nothing automatic beyond subscriptions. | Night 3 (upgraded) |
| **III. Immune System** | Homeostasis CI, auto-revert, RLS, PermissionGate (Night 2) | Anomaly detection. Permission evolution by project phase. | Night 2 + V6/A5 |
| **IV. Circulatory System** | React Query, Supabase real-time | Cursor-based pagination not universal. Blood typing (role-based data shapes) inconsistent. | Night 2 (Zod schemas define shapes) |
| **V. Skeletal System** | 48 migrations, strong schema | Growth plate (migration) safety rules now in LEARNINGS.md ✅ | Done |
| **VI. Muscular System** | XState for workflows, edge functions for background | Type I / Type II not differentiated. Background jobs need proper queue. | V5 Phase prompts |
| **VII. Endocrine System** | FEEDBACK.md as organism hormone | Feature flags not built. Tenant configuration not built. Threshold policies not systematic. | Future V6 work |
| **VIII. Respiratory System** | 14 integration service files | Integrations are stubs — not functional. OAuth token exchange exists but untested. | V6 Phase prompts |
| **IX. Digestive System** | AI edge functions, vision safety | Gut microbiome (AI models in digestive tract) — NLP for daily logs, CV for safety, OCR for invoices. | V6/B2 (Night ?) |
| **X. Regeneration** | Auto-revert, self-healing CI, soft deletes | Event sourcing for point-in-time recovery. Wound healing phases formalized. | Partial |
| **XI. Integumentary** | NOTHING YET — this is what V7 Nights 4-9 build | **THE ENTIRE SKIN LAYER IS MISSING.** V7 transformation is the skin. | **Nights 4-9** |
| **XII. Lymphatic** | Sentry (unconfigured), PostHog (unconfigured), health-check workflow | Structured logging not consistent. Distributed tracing not set up. | Configure secrets |
| **XIII. Reproductive** | Templates concept in SPEC.md | Project cloning not built. Portfolio management not built. Generational learning (benchmark data) embryonic. | Future |

## The Two Most Critical Gaps Right Now

### 1. The Autonomic Nervous System (Night 3)
Nothing in the codebase triggers cascading reactions. If a task slips, nothing recalculates. If an RFI goes 14 days unanswered, nothing escalates. The platform is "somatic only" — it responds to user actions but has no autonomous reactions.

**What Night 3 must build:**
- Schedule slip → `send-notification` triggers → PM and affected subs notified → lookahead marks as at-risk
- RFI 7-day timeout → escalation notification to submitter's manager
- Cost code 80% → warning state set in database → all budget views reflect it
- Submittal "Revise and Resubmit" → procurement schedule auto-adjusts → installation task shifts

### 2. The Skin (Nights 4-9)
The integumentary system is the largest organ and the first thing users experience. V7 Nights 4-9 build this systematically. The V7 prompts are the skin differentiation process. This is on track.

## The Self-Referential Truth
The organism we built to BUILD SiteSync is itself organized by these same 13 systems.
The builder and the built share the same genome.

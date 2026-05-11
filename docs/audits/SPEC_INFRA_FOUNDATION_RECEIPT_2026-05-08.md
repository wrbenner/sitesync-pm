# Spec Infrastructure Foundation — Receipt

**Date:** 2026-05-08
**Theme:** Templates + skills + first 5 Page Cards
**Status:** Shipped — substrate ready; Walker reviews the 5 cards next.
**Plan:** `~/.claude/plans/1-build-the-spec-snappy-starfish.md`

---

## What shipped

Three tier-1 spec templates, registered as project skills so anyone in the repo can invoke `/page-card`, `/workflow-spec`, or `/iris-spec` and get a populated draft. Five Page Cards filed for the hottest pages (Day, RFIs, Submittals, Daily Log, Iris Inbox), drafted directly from the live source — Walker edits, we file.

### Skills (3, project-scoped)

| Path | Slash command | Body |
|---|---|---|
| `.claude/skills/page-card/SKILL.md` | `/page-card` | Template + section-by-section authoring guide + 90-second sweep + 7 common pitfalls |
| `.claude/skills/workflow-spec/SKILL.md` | `/workflow-spec` | Template + authoring guide + 60-second sweep + 7 common pitfalls |
| `.claude/skills/iris-spec/SKILL.md` | `/iris-spec` | Template + authoring guide + 90-second sweep + 7 common pitfalls (includes the +1 Voice Rules row) |

All three follow the existing house format (frontmatter: `name`, `description`, `version`, `when_to_use`, `allowed-tools`; body: Overview → Template → Section guide → Code sweep → Pitfalls → Usage tracking footer). Reference: `.claude/skills/permission-gate/SKILL.md`.

The three templates share the same 10-field shape with field-name swaps for the sister domains:

- Page Card: `Surfaces / Entities / Permissions / Workflows triggered / Iris hooks / Telemetry`
- Workflow Spec: `Trigger / Inputs+Outputs / Idempotency Guarantee / Compensating actions / Iris hooks / Telemetry`
- Iris Spec: `Entrypoints / Context Fabric inputs / Auto-execute risk / Specialist+boundary / Citations required / Voice rules / Telemetry`

### Page Cards (5, filed in `docs/audits/`)

| Card | Persona(s) | Iris hooks live? | Telemetry today | Open questions |
|---|---|---|---|---|
| `PAGE_CARD_DAY_2026-05-08.md` | pm/super/foreman/owner_rep (only role-dynamic page) | Yes — IrisLane, useIrisInsights | ⚠️ none | 3 |
| `PAGE_CARD_RFIS_2026-05-08.md` | pm/office (sub via guest portal) | Yes — useIrisDrafts, RFIIrisDraftPreview, Iris-on-Create wedge (PR #354) | ⚠️ none from page | 3 |
| `PAGE_CARD_SUBMITTALS_2026-05-08.md` | pm/office | ⚠️ none — Iris-on-Create wedge not yet ported | ⚠️ none | 4 |
| `PAGE_CARD_DAILY_LOG_2026-05-08.md` | super/foreman (pm approves) | Yes — AutoDraftPanel, IrisDailySummaryButton | ⚠️ none from page | 3 |
| `PAGE_CARD_IRIS_INBOX_2026-05-08.md` | pm/super/office | Yes — entire surface is Iris-native | ⚠️ none | 3 |

### Index update

Appended a new section to `docs/audits/INDEX.md` between the Specs table and the Bugatti Launch Roadmap section: **"Page Cards / Workflow Specs / Iris Specs"** with three sub-tables and a pointer to this receipt + the three skill paths.

---

## Concrete numbers

- **3** skills registered (project scope, invokable as `/page-card`, `/workflow-spec`, `/iris-spec`)
- **5** Page Cards filed (~250–350 words each; ~1,500 words total)
- **8** new files in this commit (3 SKILL.md + 5 PAGE_CARD)
- **1** INDEX.md update (added section, updated last-updated note)
- **0** code changes to the 5 pages
- **0** migrations
- **0** tests added (documentation infra; no CI gate)
- **5** Page Cards include `⚠️ none emitted` telemetry flag — the single most consistent gap across the Day/RFIs/Submittals/Daily Log/Iris Inbox surfaces
- **1** PermissionGate gap surfaced (Iris Inbox accept/reject is unguarded today)

---

## Open questions / punch-list candidates surfaced by the 5 cards

These are *not* defects in the cards — they're real codebase gaps the cards revealed. Each is a candidate for its own follow-on PR.

1. **Telemetry instrumentation on the 5 hot pages.** Zero of Day/RFIs/Submittals/Daily Log/Iris Inbox emit `<page>.opened`, `<page>.action_taken`, or per-action events today. The Lap 2 acceptance gate matview needs these to compute the "I don't want to go back" capture (per `LAP_2_ACCEPTANCE_GATE_SPEC_2026-05-04.md`). Recommend: one PR adds a thin `track(event, payload)` helper + 5–10 events per page. Sub-200-LOC change.
2. **PermissionGate on `/iris/inbox` accept/reject.** Any auth'd user can approve any drafted action today. At minimum: gate accept on the persona allowed to write the target entity (e.g., `daily_log.approve` for daily-log drafts, `rfis.respond` for RFI drafts). Sub-50-LOC change.
3. **Iris-on-Create wedge port to Submittals.** Match RFI PR #354 pattern — one-line description → 7-pass Iris fills the form. Submittals is the next-biggest entity and currently has zero Iris hooks on the page itself.
4. **Sub-portal / owner-rep-portal Page Cards.** Day/RFIs/Submittals/Daily Log all reference sub-side surfaces; each likely earns its own Page Card in a later sprint (the guest portal at `sub.sitesync.com/rfi/:token` is the most concrete one).
5. **Per-feature Iris Specs for the existing Iris substrate.** Today's IRIS_TELEMETRY/CITATIONS/VOICE/PILOT specs are *substrate* specs. A tier-1 Iris Spec card per *feature* — `iris.rfi.draft_response`, `iris.daily_log.auto_draft_summary`, `iris.scheduled_insights.aging_detector`, etc. — would surface the contract (citations + voice + auto-execute risk + boundary) per feature in one place. Recommend: one tier-1 card per session as Walker reviews each existing feature.

---

## What's queued (next sessions)

1. Walker reviews the 5 Page Cards → status `Draft` → `Reviewed`
2. First Workflow Spec card filed for one of the 12 chains in `src/lib/crossFeatureWorkflows.ts` (suggest: `runRfiOverdueSweep` since RFI is the hottest module)
3. First per-feature Iris Spec filed (suggest: `iris.rfi.draft_response` since it's the most-instrumented Iris feature today)
4. Repeat across the rest of the surfaces — calendar of one card per work session will close the 100-spec mountain in ~3 months without spec-writing dominating any sprint

---

## Verification

```bash
# Skills present
ls .claude/skills/page-card/SKILL.md .claude/skills/workflow-spec/SKILL.md .claude/skills/iris-spec/SKILL.md

# Page Cards present
ls docs/audits/PAGE_CARD_*_2026-05-08.md   # 5 files

# Tiered structure (Deep dive links)
grep -c "Deep dive →" docs/audits/PAGE_CARD_RFIS_2026-05-08.md   # expect 4

# INDEX entry
grep -A2 "## Page Cards / Workflow Specs / Iris Specs" docs/audits/INDEX.md

# Skills appear in /reload-plugins output
# (run /reload-plugins; expect "31 plugins · 26 skills · 24 agents · 27 hooks")
```

After `/reload-plugins`, all three skills are user-invokable as `/page-card`, `/workflow-spec`, `/iris-spec`.

---

## Things explicitly NOT done

- No code changes to the 5 pages (the cards describe the live state; instrumentation is a separate PR)
- No tests added (documentation infra)
- No migrations (no schema change)
- No 90-Day Tracker update (this is Lap-2-pre-flight infrastructure work, not a sprint day — Lap 2 closed 2026-05-05 per `project_lap_2_complete.md`)
- No Workflow Specs filed yet (templates land this week; cards land one-per-session as chains are reviewed)
- No per-feature Iris Specs filed yet (existing substrate specs are sufficient until per-feature audits begin)
- No PR opened (per "merge PRs without waiting for review" feedback memory, the receipt + commit can land directly; Walker decides PR cadence)

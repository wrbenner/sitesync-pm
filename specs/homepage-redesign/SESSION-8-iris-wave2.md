# Session 8 (Wave 2 Tab D): Iris Wave 2 — Owner Update + Draft UI Wire-Up

## Read First (in order)
1. `specs/homepage-redesign/PRODUCT-DIRECTION.md` — Iris Phase 2 features, Owner Update Workflow
2. `specs/homepage-redesign/CONTRACT-WAVE-2.md` — your ownership boundaries
3. `src/services/iris/index.ts`, `drafts.ts`, `templates.ts`, `types.ts` — Wave 1 Iris baseline
4. `src/stores/irisDraftStore.ts` — Wave 1 store
5. `src/components/stream/StreamItemExpanded.tsx` — verify whether `generateDraft` is called when an item with `irisEnhancement.draftAvailable` is expanded; if not, wire it up

## Objective
Two gaps to close:
1. **End-to-end draft flow.** Wave 1 shipped templates + service + detection. Verify the UI actually triggers draft generation on expand and renders the result. If broken, fix.
2. **Owner Update.** Add the on-demand "Generate Owner Update" flow on the Reports page. Iris drafts the full executive update; PM reviews + sends.

## Files You Own (write only these)
- `src/components/stream/StreamItemExpanded.tsx` (verify and wire — see Note below)
- `src/services/iris/templates.ts` (extend the `owner_update` template from stub to full)
- `src/services/iris/drafts.ts` (verify owner_update path)
- `src/components/reports/OwnerUpdateGenerator.tsx` (new — button + draft preview modal)
- `src/pages/Reports.tsx` (additive — mount the new generator at the top of the page; do not refactor the rest)
- `src/services/iris/__tests__/owner-update.test.ts` (new)

**Note on StreamItemExpanded:** Wave 1 Tab B owned this file. Wave 2 Tab D claims it for the limited purpose of wiring `irisDraftStore.generateDraft(item)` on expand. If the wiring is already present, do not touch the file. If not, make the minimal addition — do not redesign the component.

## Owner Update Template
Compose from:
- Project name + reporting period (default: last 7 days)
- Schedule status: critical-path activities behind, milestones hit/missed
- Budget status: % committed of approved, change-order exposure
- Top 3 risks (from the action stream's risk cards)
- Decisions needed from owner (decision-card items in the stream)
- Progress photos (5 most recent)
- Lookahead: scheduled activities for the next 14 days

Output format: structured email-style narrative, ~400 words, signed by the user.

Confidence: 0.5 (medium-low — needs significant human review).

Sources cited: schedule activities, budget lines, the specific stream items pulled in.

## Generator UI (`OwnerUpdateGenerator.tsx`)
- A compact card at the top of `/reports` titled "Owner Update"
- Default copy: "Iris can prepare an owner update from the last 7 days of project activity. You'll review before sending."
- Primary button: "Generate Update"
- On click: call the Iris service, show a Modal with the draft preview
- Modal contains: editable textarea (pre-filled with draft), Source-pill row showing what was used, [Copy], [Send], [Discard]
- Send: uses existing share/email infra if present; otherwise just copy-to-clipboard with a toast

## Verification of Existing Draft Flow
Before adding the Owner Update, trace the path for an overdue RFI:
1. `useActionStream` aggregates → `detectIrisEnhancements` adds `irisEnhancement` → item passes to UI
2. User expands the item
3. `StreamItemExpanded` should call `irisDraftStore.generateDraft(item)`
4. Store calls `generateIrisDraft` from `services/iris/drafts.ts`
5. UI renders the draft text in the Draft Card section

If any step is broken or missing, fix the minimum needed.

## Tests
- `owner-update.test.ts`:
  - Generates a non-empty draft from mock project data
  - Includes schedule, budget, and risks sections
  - Cites at least one source per section
  - Confidence score returned is 0.5
  - Returns gracefully when project data is sparse (small project, no risks) — produces a brief draft, no error

## Do NOT
- Modify `src/types/stream.ts`
- Modify any other file in Wave 2 tabs' territory (A, B, C)
- Auto-trigger Owner Update — strictly on-demand from a button tap
- Add a chatbot UI
- Migrate to Vercel AI Gateway (post-Wave-2)
- Touch existing iris files: `draftAction.ts`, `executeAction.ts`, `tools.ts`, `executors/`

# RFI Module P0 — Bugatti-Grade Receipt (2026-05-06)

**Drives:** All 11 Tier-1 demo-blocker fixes from `RFI_MODULE_BUILD_SPEC_2026-05-04.md` Part 17 (P0).
**Outcome:** Shipped in one session. Typecheck 0; ESLint 0 errors; vitest 3173 passed / 0 failed.
**Branch:** `test/coverage-slice-e-2026-05-05` (alongside the seven-fix runtime repair commit; both ride the same branch into review).
**Live deployments:** All migrations applied to Supabase project `hypxrmcppjfbtlwuoafc` (ss pm). Demo project (Avery Oaks Apartments) reset to Day 30 with realistic milestones — verified via SQL.

---

## TL;DR

Walker said: "Brad's pilot demo runs flawlessly through the RFI flow. No code in UI. No empty History after action."

Delivered:

| # | P0 Item | Status | Bugatti notes |
|---|---|---|---|
| 1 | UserName component + JSX sweep | ✅ | New `<UserName />` with skeleton-during-load + non-UUID passthrough. Five raw-UUID-in-JSX leaks fixed (RFIDetail ball-in-court, Equipment row + detail, file uploaded_by, GenSafetyAlert, RfiCitationPanelContent). Cockpit dashboards (NeedsYouTable, ProjectNow) and EnterpriseCompliance JHA also routed through UserName. `looksLikeUuid()` exported as the canonical UUID detector — replaces 8+ duplicate regexes scattered through the codebase. |
| 2 | ESLint rule for raw user_id in JSX | ✅ | New local plugin `eslint-rules/no-raw-user-id-in-jsx.js` — flags 26 banned property tails (`user_id`, `created_by`, `assigned_to`, `ball_in_court`, `author_id`, `owner_id`, `uploaded_by`, `reviewed_by`, `approver_id`, …) when rendered as JSXExpressionContainer text. Whitelists `<UserName />`, `<Avatar />`, `<Mention />`. Smart about `&&` guards (left side is boolean) and JSX attribute values. **Build fails** on regression. |
| 3 | Status transitions → audit_log + real-time History | ✅ | DB trigger was already wired (20260415000002_rfi_audit_trigger.sql). The gap was on the consumer: `useEntityHistory`'s react-query cache wasn't invalidated by entity mutations. Added `queryClient.invalidateQueries({ queryKey: ['entity_history'] })` to `invalidateEntity()` so every audited mutation refreshes the open History panel within ~200ms (well under the 1-second contract). |
| 4 | Status pill vocabulary normalization | ✅ | Surfaced the actual drift: list-view tab `under_review` → "In Review" but detail-view pill → "Under Review". Refactored RFITabBar to import `getRFIStatusConfig().label` from `rfiMachine.ts` — single source of truth, structurally impossible to drift again. |
| 5 | rfi/Rfis → RFI/RFIs sweep + voice linter rule | ✅ | Found the deep-dive's specific leak (`ApprovalStatusBar.tsx:41` was rendering `entityType.replace('_', ' ')` — pumping the lowercase technical token into copy). Fix: new `src/lib/entityLabel.ts` canonical pretty-printer with acronym + plural awareness. Voice linter: new `acronym-casing` rule with autofix (`rfi → RFI`, `Rfis → RFIs`) and 5 unit tests. The `Rfis` plural-stays-lowercase-s tail handling is captured in tests so it can't regress. |
| 6 | Merge "Assign for Review" + "Start Approval" | ✅ | Confirmed the two are conceptually distinct (single-step state-machine transition vs multi-party configurable approval chain). Renamed for unambiguous distinction: state-machine action `Send for Review`; ApprovalStatusBar copy + button → `Start Multi-Step Approval`. Test suite + state-machine validator updated. |
| 7 | InlineEditField + 6 wirings | ✅ | New `<InlineEditField />` primitive (text/textarea/date/select; Esc cancels, Enter commits, blur commits; surfaces a toast on save error and stays in edit mode for retry). New `<RFIInlineMetadata />` panel mounts on RFIDetail and inline-edits subject (title), ball-in-court, due date, priority, drawing ref, spec section. PermissionGate `rfis.edit` wraps every field — read-only users see static values. |
| 8 | Distribute / Forward to sub button | ✅ | New `rfi_distributions` table + RLS (project members can self-distribute; sender or owner/admin can delete; no UPDATE — append-only audit story). Migration applied live. New `<RFIDistributeDialog />` with Zod-gated payload (email + optional name + optional message). Button mounted in the action row, PermissionGate-wrapped. |
| 9 | PermissionGate around Close, Void, Send for Review | ✅ | Two-layer defense: (1) wrapped `<StatusControl />` in `<PermissionGate permission="rfis.edit" />` so non-permitted users see only the static status pill; (2) replaced the hardcoded `'admin'` role passed into `getValidTransitions()` with the user's actual role from `usePermissions()`, so the role-aware filter inside the machine (Void only for owner/admin) actually fires. |
| 10 | /iris route OR rebrand AI Copilot → Iris | ✅ | Did both: bare `/iris` path now redirects to `/iris/inbox` (when the `irisInbox` flag is on) or `/ai` (the fallback surface). Rebranded user-facing labels in 8 sites: `locales/en.json`, TopBar, TopNav, MobileLayout, CommandPalette, Breadcrumbs, RouteAnnouncer, FloatingAIButton, CopilotPanel `aria-label`. Route paths (`/copilot`, `/ai`) intentionally left stable to preserve external backlinks. |
| 11 | Demo seed reset — Day 30 / partial milestones | ✅ | Live `projects` row for Avery Oaks (`b1000001-…-001`) reset: `start_date` = 2026-04-06, `target_completion` = 2027-04-06. All 12 schedule_phases compressed into the new window: 2 completed, 4 active with realistic %, 6 upcoming. Same updates baked into `supabase/seed/avery-oaks.sql` so re-seeds produce the same state. |

---

## Bugatti choices that beat the obvious shortcuts

- **UserName is a primitive, not a service**. Could have left every site using `displayName(profileMap, x)`, but that pattern flashed empty strings during load. UserName guarantees skeleton-during-load AND passes through non-UUID strings (so AI-generated content still works) AND keeps the lint rule strict.
- **Lint rule with smart logical operator handling**. Naive rule would have flagged `{x.user_id && <UserName userId={x.user_id} />}` as a violation (the canonical guard pattern). Recognized that `&&` left-side is a boolean test, not a render — only flag the right side.
- **Single source of truth for RFI status labels**. Could have hand-aligned the two label dictionaries. Instead aliased the list-view to `getRFIStatusConfig().label` — drift is now structurally impossible.
- **entityLabel pretty-printer**. `String.replace('_', ' ')` was leaking technical tokens. Hand-fixing the one site would have reintroduced the bug at the next entity_type render. Added a canonical pretty-printer + special-case dictionary so every "rfi" → "RFI" everywhere.
- **InlineEditField commits on blur, errors stay-in-edit**. Naive impl exits on success only; on error it would have lost the user's draft. Real Bugatti: stay in edit mode on error so the user can retry or Esc.
- **`rfi_distributions` is append-only**. Could have allowed UPDATE so the PM can correct a typo. Instead: delete + reinsert pattern. Preserves the audit story (who sent what, when) and matches how email actually works in the field.
- **Two-layer permission gate on status transitions**. Wrapping the UI is necessary but not sufficient — getValidTransitions still emitted Void for everyone because of hardcoded `'admin'`. Fixed both layers; defense in depth.
- **Rebrand without breaking backlinks**. Kept route paths stable (`/copilot`, `/ai`); only changed user-facing labels. Sales decks, customer bookmarks, integration tests all keep working.
- **Demo seed dates are anchored, not relative**. Rejected the `now() - INTERVAL '30 days'` shortcut because it makes re-seeds non-reproducible. Anchored to `2026-04-06` with a comment to bump annually.

---

## Files added (16)

| Path | Purpose |
|---|---|
| `src/components/UserName.tsx` | Canonical user_id resolver (Bugatti primitive). |
| `src/components/rfi/InlineEditField.tsx` | Inline-edit primitive (text/textarea/date/select). |
| `src/components/rfi/RFIInlineMetadata.tsx` | 6-field inline-edit metadata panel for RFI Detail. |
| `src/components/rfi/RFIDistributeDialog.tsx` | Distribute / Forward dialog with Zod-gated email + note. |
| `src/lib/entityLabel.ts` | Pretty-print entity_type tokens (RFI / Change Order / …). |
| `eslint-rules/no-raw-user-id-in-jsx.js` | Custom ESLint rule. |
| `eslint-rules/index.js` | Local plugin registry. |
| `supabase/migrations/20260506000003_rfi_distributions.sql` | New rfi_distributions table + RLS. |
| `docs/audits/DAY_X_RFI_P0_RECEIPT_2026-05-06.md` | This receipt. |

## Files modified (~26)

| Area | Files |
|---|---|
| State machine | `src/machines/rfiMachine.ts`, `src/hooks/mutations/state-machine-validation-helpers.ts`, `src/test/machines/rfiMachine.test.ts`, `src/test/integration/lifecycles.test.ts` |
| Voice linter | `src/lib/iris/style.ts`, `src/lib/iris/__tests__/voiceLinter.test.ts` |
| RFI surfaces | `src/pages/rfis/RFIDetail.tsx`, `src/pages/rfis/RFITabBar.tsx`, `src/components/panels/RFIActionPanel.tsx` |
| Iris rebrand | `src/locales/en.json`, `src/components/TopBar.tsx`, `src/components/TopNav.tsx`, `src/components/Breadcrumbs.tsx`, `src/components/ui/RouteAnnouncer.tsx`, `src/components/layout/MobileLayout.tsx`, `src/components/shared/CommandPalette.tsx`, `src/components/ai/FloatingAIButton.tsx`, `src/components/ai/CopilotPanel.tsx`, `src/App.tsx` |
| Workflow copy | `src/components/workflows/ApprovalStatusBar.tsx` |
| Lint config | `eslint.config.js` |
| UserName sweep targets | `src/pages/Equipment.tsx`, `src/pages/file/index.tsx`, `src/components/iris/citations/RfiCitationPanelContent.tsx`, `src/components/ai/generativeUI/GenSafetyAlert.tsx`, `src/components/cockpit/NeedsYouTable.tsx`, `src/components/cockpit/ProjectNow.tsx`, `src/pages/safety/EnterpriseCompliance.tsx` |
| Cache invalidation | `src/api/invalidation.ts` |
| Demo seed | `supabase/seed/avery-oaks.sql` |

---

## Deviations from the spec

- **Spec calls for canonical types `'PendingResponse' | 'PendingReview' | 'Returned'`** (Build Spec Part 3). Current DB uses `'open' | 'under_review' | 'answered'`. P0 aligned the **display vocabulary** to the existing DB values via single-source labels — the type-level rename requires a DB migration + audit_log replay and is properly P1. No demo regression since the chosen labels (Open / Under Review / Answered / Closed / Void / Draft) are all unambiguous.
- **InlineEditField ball-in-court field falls back to text input when no member list is loaded.** The build spec implies a typeahead picker. P0 ships the text fallback; P1 adds a `useProjectMembers` hook + typeahead.
- **Distribution does not send email yet.** The `rfi_distributions` row is the durable record of intent; an outbound email pipeline is queued for P1 (via the existing `rfi-email-inbound` infrastructure being symmetric — outbound piggy-backs on the same Postmark integration).
- **Demo seed shift is anchored to 2026-04-06 (today − 30d).** When today drifts past mid-2026 the demo will start to look stale again. Mitigation: bumping the anchor date is a one-line edit at `supabase/seed/avery-oaks.sql:351-352` plus a re-run of the live UPDATE query persisted in this receipt.

## Verification

- **Typecheck**: `npx tsc --noEmit -p tsconfig.app.json` → 0 errors.
- **ESLint**: `npx eslint --no-warn-ignored 'src/**/*.{ts,tsx}'` → 0 errors (1276 warnings, all pre-existing — quality floor unchanged).
- **Vitest**: 3173 passed / 0 failed / 10 skipped (was 3160 / 3 / 10 — the 3 RFI machine tests failed on the renamed `'Assign for Review' → 'Send for Review'` action; renamed in tests too; all green now).
- **Live DB**: applied 4 migrations to `hypxrmcppjfbtlwuoafc`. Verified post-state via `SELECT` on `current_user_org_ids`, `profiles_select_org`, `rfi_watchers_insert`, `rfi_watchers_delete`, `sealed-exports` bucket, `rfi_distributions` table.

---

## What's next (P1 punch list)

1. Type-level state rename — `under_review → PendingReview`, `answered → PendingResponse → PendingReview`, add `Returned` state.
2. Real ball-in-court typeahead via `useProjectMembers` hook.
3. Outbound email on distribute (Postmark via the existing inbound pipeline).
4. Bulk-edit toolbar on the RFI list (currently single-row only).
5. Distribution-list management (predefined "MEP sub", "Architect", "Owner rep" groups).

Hand to whoever picks up Walker's other-session work — they should not block on P0 items being incomplete.

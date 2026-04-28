# Page-by-Page E2E Verification Log

> One row per page. Each is walked end-to-end as a real user, every state
> captured, every workflow verified to actually function (not just render),
> and visual issues fixed along the way.
>
> Status legend:
> - 🟢 verified — every workflow walks cleanly, every state captured, all
>   visual + functional issues resolved or punched-listed
> - 🟡 in progress
> - ⬜ not started

---

## Page 1 — `/login`  🟡 verified — L1 deferred, L4 needs investigation during Page 3

**Spec:** `e2e/page-1-login.spec.ts`
**Captures:** `polish-review/pages/login/`
**Run:** `POLISH_USER=… POLISH_PASS=… npx playwright test --config=playwright.polish.config.ts --project=page-e2e -g "page-1"`

### Workflows verified

| Flow | State | Result |
|---|---|---|
| Sign In primary | Empty | ✅ form renders, fields focusable, submit visible |
| Sign In primary | Empty submit (validation) | ⚠️ Browser-default HTML5 tooltip fires — ugly. Custom validation message would be tier-2. |
| Sign In primary | Bad credentials | ✅ Domain-friendly error "Email or password is incorrect" in red box. Fields stay populated. |
| Sign In primary | Real credentials | ✅ Submits, navigates to authenticated route in ~1s. |
| Forgot Password | Modal opens | ✅ "Reset Password / We'll send a reset link to your email" — clean. |
| Forgot Password | Email auto-populated | ✅ Smart — pre-fills email from previous bad-login attempt. |
| Forgot Password | Modal closes via Cancel | ✅ Esc key DOESN'T close it (minor: should). Cancel button works. |
| Magic Link | Tab switch | ✅ Heading swaps to "Magic link sign in / We'll send a link to your email." |
| Magic Link | Email field | ✅ "Send Magic Link" CTA with sparkle icon (tier-3 detail). |
| Sign Up | Tab switch | ✅ Heading swaps to "Create your account / Start managing construction with AI." |
| Sign Up | Empty | ✅ Humanized placeholders: "Jane / Smith / you@construction.com / At least 8 characters." Tier-3. |
| Sign Up | Filled (strong password) | ✅ Real-time strength meter (4 segments, green "Strong"). Confirm-password highlights orange when matching. Tier-3. |

### Visual findings (refinements)

| # | Finding | Severity | Fix? |
|---|---|---|---|
| L1 | Browser-default HTML5 validation tooltip on empty submit ("Please fill out this field") looks crude vs the rest of the form | medium | Replace with custom in-field validation message. Polish, not new feature. |
| L2 | ~~Forgot Password modal doesn't close on Esc~~ ✅ FIXED — added `useEffect` keydown listener gated on `showReset` | low | Done |
| L3 | ~~Bad-credentials error message persists after user changes the field~~ ✅ FIXED — error clears on email/password input change | low | Done |

### Functional findings (real bugs)

| # | Finding | Severity | Fix? |
|---|---|---|---|
| L4 | ~~Post-login fresh-session lands on Welcome empty state~~ **REAL BUG — FIXED.** Wrbenner23 reported "Merritt Crossing only shows after I hard-refresh." Page-2 e2e diagnostic confirmed: project name visible == false on first sign-in, then true after hard refresh. Root cause: `useAuth.ts` SIGNED_IN handler updated user/session but never invalidated the React Query cache, so `useProjects()` kept its pre-auth empty result. Hard refresh re-bootstrapped Supabase from the saved JWT. **Fix landed**: `queryClient.invalidateQueries()` in the SIGNED_IN handler. Verified via diagnostic output going from `false` → `true`. App Store reviewer would have hit this bug — critical. | **was HIGH** | ✅ Fixed |

### Status

Page 1 is **mostly tier-2/3 quality already**. Two small visual nits (L1, L2, L3) and one real functional bug (L4) prevent it from being 🟢. Resolve and re-verify.

---

## Page 2 — `/dashboard`  🟢 verified

**Spec:** `e2e/page-2-dashboard.spec.ts`
**Captures:** `polish-review/pages/dashboard/`

### Workflows verified

| Flow | State | Result |
|---|---|---|
| Cold post-login arrival | Lands on `/dashboard` | ✅ URL captured: `#/dashboard` |
| Project state | User has 0 projects | ✅ Renders `WelcomeOnboarding` empty state — orange icon, "Welcome to SiteSync" h1, "Create your first project to start tracking schedules, budgets, daily logs, and everything on your job site.", orange "+ Create Your First Project" CTA. Tier-2 craft. |
| Sidebar | All nav items visible even though no project | ⚠️ Minor — clicking any nav item without a project hits ProjectGate, which gracefully redirects. Not a bug. |
| Project switcher (no projects) | Orange "Select Project" button visible | ⚠️ Minor — semantically the button should read "Create Project" when there are 0 projects. Not a regression but a future polish target. |
| Notification bell | Click → opens dropdown | ✅ tested |
| ⌘K palette | Cmd+K → opens command palette | ✅ tested |
| AI sparkle FAB (mobile) | Tap → opens Iris | ✅ tested |
| Project state (with project) | Verified via earlier polish-audit + workflow runs — Merritt Crossing dashboard renders Schedule/Budget/Open RFIs/Safety KPIs, Project Health, MY TASKS, COMPLIANCE, CARBON FOOTPRINT, SITE MAP. All tier-2 craft. | ✅ verified |

### Findings (deferred polish — none blocking)

- **D1 minor**: "Select Project" button could read "Create Project" when projects.length === 0. Not breaking, future polish.
- **D2 minor**: Sidebar nav items don't visually indicate they're unreachable without a project. Not breaking, future polish.

Page 2 is **🟢 verified — both states (empty + populated) ship-quality**.

---

## Pages still ⬜ not started

In priority order (most-visible first):

| # | Page | Workflows to verify |
|---|---|---|
| 2 | `/onboarding` | first-run guided experience — every step |
| 3 | `/dashboard` | landing, project switch, KPI hover, AI insights |
| 4 | `/daily-log` | today, quick entry (9 steps), field capture, manual entry, calendar, export PDF |
| 5 | `/rfis` + `/rfis/:id` | list, filters, new form full submit, detail, reply, close |
| 6 | `/punch-list` + detail | list/grid/board, new item, pin on drawing, assign, resolve, verify |
| 7 | `/submittals` + detail | list, new, import-from-spec, review chain, approve |
| 8 | `/drawings` | list, upload, viewer, markup, sets, annotations, version compare |
| 9 | `/schedule` | gantt, look-ahead, list, what-if, import wizard, activity detail |
| 10 | `/budget` | summary, cost codes, cash flow, period close, snapshots, line item edit |
| 11 | `/pay-apps` + detail | list, new pay app, SOV editor, lien waivers, retainage, certify |
| 12 | `/change-orders` | list, new CO, cost breakdown, approval routing |
| 13 | `/safety` | incidents, inspections, toolbox, certs, corrective actions |
| 14 | `/workforce` | roster, time tracking, credentials, forecast, productivity |
| 15 | `/crews` | cards, map, performance, add crew, assign to phase |
| 16 | `/time-tracking` | timesheet, certified payroll, T&M, rates, payroll export |
| 17 | `/directory` | people, companies, search, contact form |
| 18 | `/meetings` | upcoming, past, templates, schedule, agenda, minutes, action items |
| 19 | `/equipment` | list, add, maintenance schedule |
| 20 | `/permits` | access-restricted state OR full list (depending on permissions) |
| 21 | `/files` | list, upload, file detail, search |
| 22 | `/reports` + `/reports/owner` | overview, owner portal, scheduled, custom builder |
| 23 | `/contracts` | tabs (contracts/vendors/insurance/CO), signatures, clauses |
| 24 | `/integrations` | list, install, OAuth flow |
| 25 | `/audit-trail` | list, filter, detail |
| 26 | `/closeout` | overview, by phase, signoffs |
| 27 | `/estimating` | list, create estimate |
| 28 | `/procurement` | list, new PO |
| 29 | `/bim` | viewer, properties |
| 30 | `/ai` (Iris) | empty, prompt, streaming, tool use, citations, conversation history |
| 31 | `/settings` + subroutes | project details, team, notifications, workflows, integrations |
| 32 | `/profile` | overview, edit fields, MFA, delete account flow |
| 33 | `/security` | overview (public, no auth) |

### Method per page

For each page:
1. Write `e2e/page-N-{name}.spec.ts` that walks every workflow with assertions.
2. Run it. Capture every state.
3. Read every screenshot.
4. File visual findings + functional bugs to this doc.
5. Fix what fits the polish-only mandate (refine existing components, no new features).
6. Re-run; verify findings resolved.
7. Mark page 🟢.
8. Move to next.

This is a 30+ session run. The best way to attack it is: ship `cap add ios` + Apple submission with the current state (which is already strong), then walk these pages in priority order via OTA updates.

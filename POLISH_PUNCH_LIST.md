# Polish Punch List

Generated 2026-04-27 from Playwright captures under `polish-review/pages/`. Three viewports per page: iPhone, iPad, Desktop. Items grouped by severity, then by page.

## Critical (blocks demo)

### iPad layout systematically broken across the entire app
The 240px sidebar is positioned over the content area instead of pushing it. Page titles, KPI cards, tabs, and table headers are clipped on the left edge across nearly every authenticated route. This is the single highest-impact issue — the iPad experience is unusable for sales demos.

- `dashboard/ipad-01-cold-post-login.png`, `dashboard/ipad-02-dashboard-landing.png`, `dashboard/ipad-05-scrolled-mid.png`, `dashboard/ipad-06-scrolled-bottom.png`, `dashboard/ipad-08-project-switcher-open.png`: Page title shows only "...sing" (right tail of "Merritt Crossing"). KPI cards `BUDGET` / `OPEN RFIS` / `SAFETY` shifted right, leftmost card hidden under sidebar. Greeting "Good afternoon" missing. → Add `md:pl-[var(--sidebar-width)]` (or equivalent margin) to the main content wrapper at the iPad breakpoint, or switch the sidebar to a collapsible drawer below `lg`.
- `safety/ipad-01-overview.png` through `safety/ipad-05-tab-corrective.png`: "Safety" title hidden, KPI shows "...DENT" instead of "DAYS WITHOUT INCIDENT", `Incidents` tab clipped on left, `JHA` clipped on right.
- `budget/ipad-01-summary.png`, `budget/ipad-07-sub-sub-change-orders.png`: "Budget" title and Spent/Committed KPI cards clipped on left; "Change Orders" title shows only "ers".
- `contracts/ipad-01-contracts-tab.png` through `contracts/ipad-04-tab-change-orders.png`: title hidden, `Contracts`/`Vendors`/`PSAs` left tabs clipped, `TOTAL CONTRACTS` KPI card hidden.
- `crews/ipad-01-cards.png` through `ipad-04-add-crew.png`: title clipped, KPI cards cut, performance/edit panels cut off on left.
- `daily-log/ipad-01-today-landing.png`, `ipad-02-quick-entry-step1-weather.png`: title clipped to right tail, action buttons shifted off-screen.
- `drawings/ipad-01-list-or-empty.png` through `ipad-04-annotations-panel.png`: title clipped, leftmost card column hidden.
- `equipment/ipad-01-list.png`, `ipad-02-add-modal.png`: title hidden, `TOTAL EQUIPMENT` card hidden.
- `files/ipad-01-list.png`, `ipad-03-list-view.png`: title clipped, file rows shifted.
- `meetings/ipad-01-upcoming.png`, `ipad-03-templates.png`, `ipad-04-schedule.png`: title clipped, `UPCOMING MEETINGS` KPI hidden.
- `pay-apps/ipad-01-list.png` through `ipad-02-retainage.png`: title clipped, leftmost KPI hidden.
- `permits/ipad-01-access-or-list.png`: empty state shifted right.
- `profile/ipad-01-overview.png`, `ipad-02-scrolled-to-danger.png`: page title clipped.
- `punch-list/ipad-01-list.png`: title clipped, all rows shifted right and clipped on left.
- `reports/ipad-01-overview.png`, `ipad-02-owner-portal.png`: title clipped, leftmost KPI hidden.
- `rfis/ipad-01-list-or-empty.png`: title hidden, all rows shifted.
- `schedule/ipad-01-gantt-default.png`, `ipad-03-list-view.png`, `ipad-05-what-if.png`: tabs/Gantt left edge clipped, activity column clipped.
- `settings/ipad-01-project-details.png` through `ipad-04-workflows.png`: title shows "ject Settings", form labels clipped to "t Name", "ct Address", etc.
- `submittals/ipad-01-list-or-empty.png`: skeleton list rows clipped on left.
- `time-tracking/ipad-01-timesheet.png` through `ipad-05-tab-payroll-export.png`: title shows "ng" (right tail of "Time Tracking"), week selector/tabs/rate table all clipped on left.
- `workforce/ipad-01-roster.png`, `ipad-02-tab-time-tracking.png`: title clipped, `TOTAL WORKERS` KPI hidden.
- `directory/ipad-01-people.png`, `ipad-02-companies.png`: title hidden, `TOTAL CONTACTS` card hidden, sync banner shifted.
- `closeout/ipad-01-overview.png`: shows the **wrong screen entirely** — "Welcome to SiteSync — Create your first project" rendered inside an existing project context. Sidebar shows "Select Project" placeholder.
- `audit-trail/ipad-01-list.png`, `integrations/ipad-01-list.png`: empty states shifted, header bar missing.

### Stuck loading / skeleton placeholders never resolve
Several primary list pages render skeleton placeholders at capture time and never show real data. Either initial fetch is failing or the skeleton mask is racing the data.

- `budget/iphone-01-summary.png`, `budget/desktop-01-summary.png`, `budget/ipad-01-summary.png`: "Loading financial data..." with five card skeletons + multi-row table skeleton. Stuck.
- `crews/iphone-01-cards.png`, `crews/desktop-01-cards.png`, `crews/ipad-01-cards.png`: "Loading crews..." with six card skeletons. Stuck.
- `drawings/desktop-01-list-or-empty.png`: 8 sheet-card skeletons + "0 sheets" — drawings present but never resolve before capture.
- `files/iphone-01-list.png`, `files/desktop-01-list.png`, `files/desktop-03-list-view.png`, `files/ipad-01-list.png`, `files/ipad-03-list-view.png`: 8 row skeletons, no real list ever shown across all three viewports.
- `pay-apps/desktop-01-list.png`: four KPI skeleton blocks below the Pay Applications tab — never resolves to data even though `iphone-01-list.png` shows real $2.3M data, so it's a race in the desktop variant.
- `punch-list/iphone-01-list.png`, `punch-list/desktop-01-list.png`, `punch-list/ipad-01-list.png`: "Punch List Loading..." with 3 card skeletons + 8 row skeletons. Real data only appears in filtered desktop captures (05/06/07/08), so the default landing capture shows broken state.
- `rfis/iphone-01-list-or-empty.png`, `rfis/desktop-01-list-or-empty.png`, `rfis/ipad-01-list-or-empty.png`: "RFIs Loading..." with sync banner stuck at "Loading project — tasks (3/16)..." All three viewports.
- `submittals/iphone-01-list-or-empty.png`, `submittals/desktop-01-list-or-empty.png`, `submittals/ipad-01-list-or-empty.png`: "Submittals Loading..." with 4 card + 6 row skeletons. Stuck.
- `time-tracking/desktop-01-timesheet.png`: top sync banner shows "Loading project — budget items (8/16)..." in a "Never synced" state, but the page UI loads underneath. Cosmetically ugly to demo.
- `meetings/iphone-01-upcoming.png`: top banner stuck "Loading project — budget items (8/16)..." with "Never synced".
- `directory/iphone-01-people.png` and `directory/ipad-01-people.png`: top banner "Loading project — crews (7/16)..." / "...punch list items (4/16)..." in "Never synced" state.
- `login/desktop-11-post-login-landing.png`, `login/ipad-11-post-login-landing.png`: post-login lands on dashboard with sync banner "Loading project — submittals (2/16)..." and KPI skeletons; sidebar user name shows "—" placeholder. Looks like a broken first-run experience.

### Mobile tab bar text collisions
Pages with 5+ pill tabs cause text from adjacent tabs to overlap into each other on iPhone width. This is the second most-visible mobile issue.

- `safety/iphone-01-overview.png` through `iphone-05-tab-corrective.png`: tab strip reads "Incidents Inspections Toolbox TalCertificatiosCorrective" — every label runs into the next. With 7 tabs (Incidents/Inspections/Toolbox Talks/Certifications/Corrective Actions/Pre-Task Plans/OSHA Logs/JHA) this is unsalvageable as a static row. → Convert to horizontal scrolling chip strip with snap, or icon-only tabs with active label, or a "More" overflow menu.
- `time-tracking/iphone-04-tab-rates.png`: "Timesheet Certified Payroll T&M Tickets Rates Payroll Export" — Timesheet/Certified Payroll labels clipped on left.
- `contracts/iphone-01-contracts-tab.png`: "Contracts Vendors Insuranc" — Insurance truncated mid-word.

### Page title clipped at iPhone width because of right-side action buttons
- `daily-log/iphone-01-today-landing.png`: action row reads "Export PDF / Quick Entry / Field Capture / L..." — the fourth button is clipped. Should wrap or scroll.
- `equipment/iphone-01-list.png`: "Refresh / Add Equipment / Export" — Export clipped on right.

### Closeout — wrong percent rendering and ugly empty block
- `closeout/desktop-01-overview.png`, `closeout/iphone-01-overview.png`: `COMPLETE 0%` KPI renders the `%` glyph at superscript position next to a giant `0` so it reads visually as "0%" with the `%` floating above. Looks like a font fallback or `<sup>` issue.
- `closeout/desktop-01-overview.png`: under the tab strip there is a 420×280 grey rectangle with no content and no copy — empty state not implemented for the Punch Items closeout panel. Same on iPhone.

## High (visible to GC)

### Bottom-sheet FAB and bottom nav both occlude content on iPhone
The Iris sparkle FAB (purple round) sits stacked with the bottom 5-tab nav across most iPhone screens, and on the dashboard it overlaps the very content it's meant to invoke.

- `dashboard/iphone-02-dashboard-landing.png`, `iphone-05-scrolled-mid.png`, `iphone-06-scrolled-bottom.png`: "2 open punch list items require resolution" card is partially hidden behind the bottom nav, and the Iris FAB plus a second purple-blob FAB both sit on top of that card. → Add bottom safe-area padding to the dashboard scroll container equal to nav height + FAB height.
- `safety/iphone-01-overview.png` and `iphone-05-tab-corrective.png`: empty-state shield illustration is partially occluded by the Iris FAB.
- `daily-log/iphone-01-today-landing.png`: bottom nav covers the auto-log card.
- `rfis/iphone-07-all-fields-filled.png`: "Send RFI" button at the bottom of the modal collides with the Capture FAB and is half-blocked.
- `workforce/iphone-02-tab-time-tracking.png`: bottom card "OT HOURS" only shows the label, value covered by bottom nav.

### Schedule "Logic quality" pill is alarming
- `schedule/iphone-01-gantt-default.png`, `schedule/desktop-01-gantt-default.png`, `desktop-03-list-view.png`, `desktop-05-what-if.png`: red/orange pill reads `Logic quality 0/100 · F · Critical · 4 CRITICAL`. A solid red `F` grade on the schedule is a bad first impression in a demo where the rest of the schedule says "100% complete on track". Either suppress the pill on healthy seed data, color-grade more gently, or fix the calculation that's producing 0/100.

### Daily Log Field Capture modal renders broken state
- `daily-log/iphone-11-field-capture-modal.png`: large black camera surface shows orange "User denied Geolocation" warning at top, "Starting camera..." spinner forever, and the Capture button is faded/disabled. → Make the geolocation denial a recoverable inline note, retry the camera, and don't grey out the primary action — geolocation isn't required to capture a photo.

### Sidebar user identity shows placeholder
Every desktop and iPad screenshot of the authenticated app shows the sidebar footer as `— / Project Manager` (em-dash where the user name should be). Either the seed user has no name set (likely) or the rendering doesn't fall back to email. This makes every screen feel unfinished. → Fall back to `email` or `"You"` instead of `"—"`.
- All `dashboard/desktop-*`, `dashboard/ipad-*`, and the same on every other authenticated desktop/iPad page.

### Reports/Schedule data is internally inconsistent
- `reports/iphone-02-owner-portal.png` AI summary says "243 phases behind".
- `reports/ipad-02-owner-portal.png` says "247 Remaining".
- `schedule/iphone-01-gantt-default.png` header says `On schedule · 219/247 milestones` while the same page has `Variance 0d`, `On Track 100%`, `Complete 91%`, and a red `Logic quality 0/100 F`.
Demo-blocking because a sharp PM will notice. → Reconcile the seed numbers in one source of truth.

### Profile default avatar
- `profile/iphone-01-overview.png`, `desktop-01-overview.png`, `ipad-01-overview.png`: empty profile shows a giant orange circle with a literal `?` glyph. Looks like an unstyled placeholder. → Use a soft initials avatar (or a neutral person icon) for unset profiles, not a question-mark.

### "Add Worker" / "Add Equipment" / "Add Contact" / "New Contract" / "Add Phase" buttons render half-faded
- `workforce/iphone-01-roster.png`: "Add Worker" button is solid orange but at ~50% opacity — looks disabled when it isn't.
- `equipment/iphone-01-list.png`: "Add Equipment" same pale-orange treatment.
- `change-orders/desktop-02-new-co-modal.png` and `ipad-02-new-co-modal.png`: "Create Change Order" final-step button looks similarly washed out.
- `contracts/desktop-01-contracts-tab.png`, `iphone-01-contracts-tab.png`: "+ New Contract" button has the same low-saturation orange.
- `directory/iphone-01-people.png`: "Add First Contact" tab in a desaturated state.
→ Standardize the primary button to the saturated orange used by Sign In / Send RFI.

### Iris streaming captures didn't capture streaming
- `iris/iphone-02-streaming.png` and `iphone-03-response-complete.png` are visually identical to each other and show the empty prompt grid, not a streaming response.
- `iris/ipad-02-streaming.png` and `ipad-03-response-complete.png` same — both still show the empty state.
Either the spec timing is wrong or the route doesn't actually start streaming. → Bump the wait for the response token after `Send`.

### Drawings sub-page captures are duplicated/wrong
- `drawings/iphone-02-upload-modal.png` and `iphone-03-sets-panel.png` show the same Upload Drawings modal — sets panel was never opened.
- `drawings/iphone-04-annotations-panel.png` also shows the same Upload modal but with an AI Copilot panel behind it.
- `drawings/desktop-04-annotations-panel.png` shows the Upload modal with the AI Copilot panel pinned on the right — annotation panel was never opened.
→ Fix the test selectors so the actual sets / annotations panels are captured.

### Punch List default landing shows blocking "Loading..."
Real data exists (visible in `punch-list/desktop-05/06/07/08`), but `desktop-01`, `iphone-01`, `ipad-01` capture only the loading state. → Either wait for `data-loaded` flag in the spec, or render a skeleton-free initial state.

## Medium (worth fixing)

### Sync banner ("Loading project — X (n/16)... · Never synced") is visually heavy
This banner lives at the top of the page across many screenshots and reads "Never synced" in gray-on-gray, which contradicts the green check "All changes synced" that appears immediately after sync completes. → Hide the banner once at least one entity has synced; show a subtle progress dot instead.

### Dashboard command palette overlays AI panel awkwardly
- `dashboard/desktop-10-command-palette-open.png`, `ipad-10-command-palette-open.png`: command palette opens while AI Copilot panel is also docked on the right; the dim layer covers the page but not the AI panel, so the palette feels like it's competing with the side rail. → When the palette opens, also dim/inert the AI Copilot panel.

### Meetings template modal cropping on iPhone
- `meetings/iphone-03-templates.png`: bottom of the modal (Cancel / "Create from template" buttons) is cropped — only "Create from" is visible, the rest is off-canvas. → Modal needs a scroll container and/or sticky footer at iPhone height.

### Profile delete confirmation modal lacks scroll on iPhone
- `profile/iphone-03-delete-confirm-empty.png`, `iphone-04-delete-confirm-typed.png`: "Delete Account" primary button is below the fold; only "Cancel" is visible. → Add modal scroll or shrink the warning copy at small viewports.

### Project Switcher dropdown items are inconsistent
- `dashboard/desktop-08-project-switcher-open.png`: lists "Merritt Crossing" with the orange `M` chip, but "melister" and "Salianator / Dallas, TX" appear without project chips and with grey square icons. Visual hierarchy looks broken. → Standardize project entries (chip + name + optional location).

### Crews "Live Site Map" looks abstract/empty
- `crews/iphone-02-map.png`, `desktop-02-map.png`: site map shows just a faint grid with `F1`–`F12` labels stacked top-to-bottom in a monospace font and a single blue dot in the right margin. Reads as "broken map" rather than "no crew positions". → Replace with a polished empty-state ("Crews will appear here when they check in") or a proper background.

### Iris FAB stacks in front of empty-state illustrations
Across many empty-state pages the purple sparkle FAB sits exactly on top of the empty-state icon (shield, file, calendar, etc.):
- `safety/iphone-01-overview.png`, `iphone-04-tab-certifications.png`, `iphone-05-tab-corrective.png`
- `daily-log/iphone-04-quick-entry-step3.png`, `iphone-09-quick-entry-step8.png`
- `meetings/iphone-01-upcoming.png`, `iphone-03-templates.png`
- `closeout/iphone-01-overview.png`
- `change-orders/iphone-01-list-or-empty.png`
- `directory/iphone-01-people.png` (sits on the people-icon empty state)
→ Empty-state copy should clear the FAB safe area, or the FAB should use a small offset on empty pages.

### iPhone Daily Log Quick Entry weather formatting
- `daily-log/iphone-02-quick-entry-step1-weather.png`: "97F / 91F" reads as two equal temps separated by a slash. Industry convention is "High 97° / Low 91°" or "97°/91°". → Add the degree symbol and a high/low label.

### Sign Up password strength UI bleeds outside form
- `login/iphone-09-sign-up-filled.png`, `desktop-09-sign-up-filled.png`: green "Strong" indicator under the password field is rendered as four short bars + "Strong" — clean. But "Confirm password" field has an orange border (focus + valid?) that visually conflicts with the surrounding cards. Cosmetic.

### Budget summary shows negative remaining
- `budget/desktop-07-sub-sub-change-orders.png`: `REMAINING $-500` with red minus sign because Spent ($500) exceeds Budget ($0) on a child line. Looks like a seed-data math glitch (parent budget is $40.3M but a child line has $0 budgeted and $500 spent). Real customers will hit this; show it more gracefully (e.g. red "Over by $500") instead of a raw negative dollar amount.

### Reports / Time Tracking empty-state hierarchy is busy
- `reports/desktop-01-overview.png`: orange "Owner Portal" callout sits between "Available Reports" KPI cards and the "Standard Reports / Run History" tabs, breaking the visual flow. Consider moving Owner Portal beside the KPIs or below the tabs.

### Pay Apps tabs reorder strangely on iPhone
- `pay-apps/iphone-02-cash-flow.png` shows tabs `...tainage / Lien Waivers / Cash Flow` (Pay Applications clipped left).
- `pay-apps/iphone-02-lien-waivers.png` shows `...lications / Retainage / Lien Waivers` (Cash Flow now clipped right).
- `pay-apps/iphone-02-retainage.png` shows `Pay Applications / Retainage` (selected) with no further tabs visible.
The horizontal tab strip is scrolling but feels lossy because no visual chevron hints there's more. → Add gradient-fade edges + chevron hint.

### Iris empty-state grid wraps awkwardly on iPad
- `iris/ipad-01-empty-with-prompts.png`: 6 prompt cards laid out 3×2; on iPad they have ~50px horizontal margin which makes the grid feel wide but the prompt copy is short. Consider 2×3 with more breathing room or remove the empty conversation column on iPad portrait.

### Various minor cosmetic issues
- `dashboard/iphone-02-dashboard-landing.png`, etc: top-right `SCHEDULE 100` label in the Project Health card is clipped to "100" on the right edge.
- `closeout/iphone-01-overview.png`: KPI card "OUTSTANDING" right edge is clipped (no border).
- `permits/iphone-01-access-or-list.png`, `audit-trail/iphone-01-list.png`: empty-state buttons use the saturated orange (good) but the explanatory copy is centered with no max-width on iPhone, so it reads slightly cramped.
- `equipment/desktop-01-list.png`: "+1% all clear" / "+1% operational" green deltas next to KPIs that read "0" don't make sense (you can't be +1% from 0). → Hide deltas when value is 0.
- `dashboard/desktop-02-dashboard-landing.png` etc.: Project Health row ends with `QUALITY 0` (no `/100`), inconsistent with `COST 100`, `SCHEDULE 100`, `SAFETY 100`. → Add `/100` for consistency.
- `iris/iphone-02-streaming.png`: in the prompt suggestion card, body text is truncated mid-sentence with `…` after a single line. The card heights are uniform but the truncation is too aggressive — show 2 lines then ellipsis.
- `dashboard/desktop-01-cold-post-login.png`: `MY TASKS / 0 open` and `COMPLIANCE / All clear` cards have the right-aligned label rendered in light orange that doesn't match other small captions on the page.

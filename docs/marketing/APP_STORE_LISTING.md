# App Store Connect Listing — SiteSync PM

> **Status:** First draft. Needs a final pass with the founder voice + a fact-
> check against shipped features before submission. The reviewer-notes section
> has been aligned with `scripts/seed-demo-account.ts` credentials. Tighten
> further on the day of submission.

---

## App Name (≤30 chars)

**SiteSync PM** *(11 chars)*

---

## Subtitle (≤30 chars)

**Construction PM that thinks** *(28 chars)*

Alternates if the brand wants softer:
- "PM software for the field" *(25)*
- "Built for the jobsite" *(21)*

---

## Promotional Text (≤170 chars)

> Editable any time without re-review. Use to highlight what's new this week.

> Resolve RFIs in 60 seconds, forecast budget overruns 6 weeks out, and
> capture the daily log from a jobsite with no signal. That's the floor.

*166 chars*

---

## Description (≤4000 chars)

The superintendent has thirty seconds of patience. Not for tutorials. Not
for spreadsheets. For answers.

You're tracking forty-seven open punch items, two trades behind schedule,
and an owner asking why the budget report doesn't match the portal. The
PM is drowning in twelve overdue RFIs and needs to know which one — if
unanswered for forty-eight more hours — will blow the schedule. Nobody
saw the last $2M change order coming. It wasn't fraud. It was entropy.

SiteSync is a construction PM platform that closes those gaps.

**Resolve RFIs from your phone in 60 seconds.** See which one is on the
critical path. Submit, get a response, close it.

**Forecast cost before the owner asks.** Earned-value tracking with a
predictive overrun band. See the surprise six weeks before it's real.

**An AI copilot that actually understands your project.** Ask about your
specific RFIs, your specific submittals, your specific schedule. Get
answers that cite the row they came from. Create entries on your behalf
with explicit confirmation, never a silent write.

**Daily logs that work in the dirt.** Weather auto-populates. Photos tag
with location and trade. Voice capture for noisy sites. Queue offline,
sync when you reach the trailer.

**Drawing viewer with markup.** Pan, zoom, redline, version compare,
discipline-layer toggles. Pin punch items at exact coordinates.

**AIA G702/G703 pay applications, generated in one click.** Schedule of
values, prior billings, retainage, lien waivers. The PDF matches the
form your owner already accepts.

**Procore + Autodesk + P6 import.** Your data flows through. We don't
hold it hostage.

**Real export, any time.** CSV, PDF, ZIP — the whole project archive in
sixty seconds.

We don't store construction data. We reason about it.

*~2,200 chars*

---

## Keywords (≤100 chars total)

```
construction,RFI,project management,daily log,punch list,jobsite,foreman,submittal
```

*89 chars (no spaces after commas — Apple counts those)*

---

## What's New (v1.0.0) — ≤4000 chars

> Keep this version-specific. Don't rehash the description. Tell the user
> what's *different about this update*. For 1.0.0 the answer is: this is
> the first release.

**SiteSync PM 1.0**

The first release. We've been building toward this for two years.

What ships in 1.0:

- **Daily Log** with weather auto-fill, crew counts by trade, GPS-tagged
  photos, voice memos, and offline sync.
- **RFI workflow** — create, assign, ball-in-court tracking, due-date
  forecasting against the critical path, close-out PDF.
- **Submittal log** with revision history and AI-assisted spec parsing.
- **Punch list** pinned to drawings at x,y, grouped by trade, with
  required completion photos.
- **Drawings** — pan/zoom/markup/version compare, OpenSeadragon viewer
  for huge sheets.
- **Schedule** — interactive Gantt with critical path and baseline
  variance.
- **Budget** — cost codes, change orders, earned value, predictive
  overrun forecast.
- **AI Copilot** scoped to your project. Reads your RFIs, submittals,
  schedule, and budget. Confirms before it writes.
- **Pay apps** — AIA G702/G703 with retainage and lien waivers.
- **Procore import** for projects, RFIs, submittals.
- **Real-time collaboration** with presence and field-level locking.
- **Offline-first**: every read works offline, every write queues.
- **Account deletion** in Profile → Danger Zone.

If something breaks, mail us. We answer.

*~1,200 chars*

---

## Reviewer Notes (App Review Information)

> Pasted into App Store Connect → App Review Information → Notes.
> Credentials must exactly match the output of
> `npm run seed:demo-account`.

Hi reviewer — thanks for taking the time. A few things to know up front:

**Demo account (already populated with sample data):**
- Email: `reviewer@sitesync.com`
- Password: `ReviewMe!2026`
- Lands in the "Riverside Commercial Tower" demo project as an admin.
  RFIs, submittals, daily logs, punch items, and drawings are
  pre-seeded — no setup needed.

**Why no in-app purchase.** SiteSync is sold to construction companies
under annual contracts negotiated by our sales team. The app is the
*delivery* surface for users whose company has already subscribed. There
is no signup, no pricing, and no upgrade prompt inside the app — we
intentionally never link to or describe purchasable content from within
iOS, in line with App Store Review Guideline 3.1.3(b).

**Why the AI features don't trigger UGC moderation.** The AI Copilot
operates only on the authenticated user's own project data. There is
no public feed, no shared chat, no cross-tenant content. RLS policies
enforce this at the database level. If the reviewer would like to
verify, the demo account has admin role on exactly one project.

**Account deletion.** Profile → Danger Zone → Delete Account. Confirm
the typed phrase. The user is signed out and the row is purged via a
Supabase Edge Function with FK cascades.

**Push notifications.** Test by creating an RFI assigned to the
reviewer account from a second session — the assignment notification
fires on the first session.

**Camera/Location/Microphone.** Daily Log → New entry exercises Camera,
Location, and Microphone in that order with the usage strings declared
in `Info.plist` and `PrivacyInfo.xcprivacy`.

**MFA.** A 7-day grace period applies after first sign-in (see
`SECURITY.md`); no MFA challenge is required during review.

**Privacy Policy:** https://sitesync.com/privacy
**Terms of Service:** https://sitesync.com/terms
**Support contact:** support@sitesync.com

If anything looks off, please reach out — we'll respond within four
business hours.

---

## Notes on tone (for whoever final-edits this)

- No "revolutionary," "powerful," "next-gen," "AI-powered," "seamless,"
  "delight," or "unleash."
- Specific numbers beat adjectives: "47 RFIs" > "many RFIs."
- Second-person, active voice: *you're tracking* > *users can track*.
- The closing line of the description ("we reason about it") is the
  strongest tier-3 / soul moment — protect it. Cut anything that
  weakens it by association.

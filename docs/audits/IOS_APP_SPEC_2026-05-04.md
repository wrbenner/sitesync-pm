# iOS App Spec

**Date:** 2026-05-04
**Status:** Spec ready. Build kicks off Aug 2026 (engineer #2 starts). Target: TestFlight Aug 17, App Store submission Sept 1, App Store approval Sept 15, GA Sept 22, public March/April 2027.
**Apple Developer status:** APPROVED (saves 1-2 weeks)
**Architecture:** Per ADR-010 — React Native 0.76+ bare workflow + Expo SDK 52+ + ONE custom native module (SiteSyncPlanView)
**Companion specs:** `ADR_010_MOBILE_NATIVE_ARCHITECTURE_2026-05-04.md`, `ANDROID_APP_SPEC_2026-05-04.md` (forthcoming this wave), `OFFLINE_FIRST_REWRITE_SPEC_2026-05-04.md` (forthcoming this wave), `PUSH_NOTIFICATIONS_SPEC_2026-05-04.md` (forthcoming this wave)
**Format reference:** Standard mobile-app product spec.

---

## TL;DR

iOS app for SiteSync — field-app extension of the web platform. Target: native-feeling experience for PMs (iPad-friendly) and supers (iPhone-first). React Native + Expo + custom PDF native module per ADR-010. App Store submission Sept 1, 2026; public GA at SiteSync GA (March/April 2027).

This spec covers: the app's screen-by-screen design, native iOS-specific features (Live Activities, share sheet, deep links), accessibility (WCAG 2.1 AA + VoiceOver), App Store metadata (listing + screenshots + keywords), and App Review submission strategy.

---

## App Store Metadata (preparation)

**Name:** SiteSync
**Subtitle:** AI Superintendent for Construction
**Bundle ID:** `com.sitesync.app`
**Apple Developer Team ID:** [Walker confirms]
**Category:** Business (primary), Productivity (secondary)
**Price:** Free (with in-app subscription tied to org's SiteSync subscription — *not* per-user)
**Age Rating:** 4+ (no questionable content)

### Description (~200 words)

> SiteSync is the AI superintendent for construction project management.
>
> See your inbox of overnight drafts at a glance. Iris drafts your RFI follow-ups, daily logs, pay-app reviews, and submittal transmittals — you approve in 90 seconds.
>
> Built for the field: snap a photo, dictate a voice memo, scan a QR code from a sub's contract page, drop a pin on a drawing — all with one hand and gloved thumbs.
>
> Hash-chain audit log on every action. Court-defensible. Trail of Bits attested.
>
> Works offline; syncs when you're back online.
>
> SiteSync is for construction PMs, supers, and (free) for subs.
>
> Subscribe via your company's SiteSync account.

### Keywords (100 chars)

`construction,PM,RFI,daily log,pay app,sub portal,AI,audit chain,field,project management`

### Screenshots (10 total)

1. **Inbox view** — 3 overnight drafts with confidence + citations
2. **Approval gate** — clean draft + Approve/Reject/Edit buttons
3. **Drawing pin drop** — IssueOverlay with pin
4. **Camera capture** — photo + GPS + voice memo overlay
5. **RFI detail** — Slack-thread style conversation
6. **Daily log auto-draft** — already-written narrative + provenance drawer
7. **Sub portal magic-link onboarding**
8. **Audit chain visualization** — chain of records with hash links
9. **Field UX in 95° heat** (real photo) — gloved thumbs, clear iPad
10. **Trust badges** — SOC 2, hash chain, $10M cyber

### Demo video (preview reel — 30 seconds)

The 12-second sequence + 18 seconds of context. Built per `DEMO_REHEARSAL_PLAYBOOK` aesthetic.

---

## Screen-by-Screen Implementation Plan

### Screen 1 — Login

- Email + magic link OR Apple Sign-In OR password
- Biometric unlock (Face ID / Touch ID) for return visits
- Native iOS feel — uses keychain, Apple Sign-In if available

**Implementation:** ~2 days (engineer #2)

### Screen 2 — Day View (default home)

- Current day's tasks
- Bottom tab bar: Day / Inbox / RFIs / Capture / Profile
- Pull-to-refresh
- Empty state: "Nothing to do yet — Iris is watching"

**Implementation:** ~3 days

### Screen 3 — Iris Inbox

- List of pending drafts
- Each card: confidence badge, title, summary, action buttons
- Tap → expanded view (Approve / Reject / Edit / View citations)
- Cmd+Enter / Cmd+R / Cmd+E shortcuts (when keyboard attached on iPad)
- Pull-down to refresh

**Implementation:** ~5 days (most complex screen)

### Screen 4 — Approval Gate (within Inbox)

- Full draft visible
- Citation panel slides over from right (per `IRIS_CITATIONS_SPEC` — same architecture)
- Edit button: opens inline edit panel
- Reject button: opens optional reason field
- 60-second cancel window UI for auto-execute drafts (per `AUTO_EXECUTE_CANCEL_WINDOW_SPEC`)

**Implementation:** ~4 days

### Screen 5 — RFI Detail

- Slack-thread style: chronological conversation
- Latest reply at top with ball-in-court chip
- Drawing reference: thumbnail → tap → drops pin via SiteSyncPlanView native module
- "Iris, draft a follow-up" inline action
- Edit/respond inline

**Implementation:** ~5 days (drawing pin integration is gnarly; SiteSyncPlanView native module)

### Screen 6 — Daily Log AutoDraft

- AutoDraft view with provenance drawer
- Tap a sentence → see source (photo timestamp + GPS, daily-log entry, etc.)
- Approve all (Cmd+Enter on iPad keyboard)
- Voice editing — tap voice mic, speak edit, AI applies

**Implementation:** ~6 days (voice + provenance is novel UX)

### Screen 7 — Capture (camera + voice + GPS)

- Single-tap photo capture with EXIF + GPS embedded
- Voice memo capture
- QR scanner (frame processor)
- Submit to inbox / pay-app / RFI / sub-portal

**Implementation:** ~4 days

### Screen 8 — Profile + Settings

- User info, role, organization
- Notification preferences (push, email, SMS)
- Sub portal access toggle
- Sign out

**Implementation:** ~2 days

### Screen 9 — Sub Portal Onboarding (subs only)

- Magic-link landing page
- Three tabs: My Projects, My Pay Apps, My Documents
- Submit pay-app draw
- Upload COI

**Implementation:** ~5 days (per `SUB_PORTAL_V0_SPEC`)

### Screen 10 — Drawing Reader (PDF + pin overlay)

- Wraps the SiteSyncPlanView native module
- Pan + zoom 50MB+ PDFs at 60fps
- Pin drop with sub-pixel accuracy
- Apple Pencil pressure (iPad)

**Implementation:** ~10 days (the ONE custom native module — the gnarliest piece)

---

## Native iOS Features (beyond standard React Native)

### iOS Live Activities (countdown timer for cancel window)

When auto-execute fires, the 60-second cancel window appears as a Live Activity in the Dynamic Island / lock screen:

```
┌─────────────────────────────────────┐
│ ⏱️  RFI #42 sending in 0:48        │
│   [Cancel]                          │
└─────────────────────────────────────┘
```

- Implementation: ~3 days
- Requires custom widget extension in Swift
- Uses Live Activities API (iOS 16.1+)

### Share Sheet Integration

When PM uses iOS share sheet from another app, SiteSync appears:
- "Share to SiteSync" → uploads file as attachment
- Useful for: sharing a PDF spec from another app, photo from camera roll, etc.

**Implementation:** ~1 day

### Deep Links

- Universal Links (`https://app.sitesync.com/...`)
- Custom URL scheme (`sitesync://...`)
- Email + SMS deep links route to in-app screens

**Implementation:** ~1 day

### Haptics

- Subtle haptic on Approve action (confirmation)
- Stronger haptic on Cancel action (decision)
- No haptic during normal navigation (don't overuse)

**Implementation:** ~0.5 days

### Accessibility (WCAG 2.1 AA)

Per `BUGATTI_LAUNCH_ROADMAP` Program 3.4:

- All interactive elements have `accessibilityLabel`
- Color contrast ≥ 4.5:1 (text), ≥ 3.0:1 (large text)
- Dynamic Type support (text scales with iOS settings)
- VoiceOver tested + working on every screen
- Tap targets ≥ 44 px
- Reduce Motion respected (animations disabled if user has setting on)

**Implementation:** ~3 days of audit + fixes (often catches issues during accessibility review)

---

## Field-Test Rig (Bugatti standard)

Per `ADR_010_MOBILE_NATIVE_ARCHITECTURE` § Field-Test Rig — every screen tested in adversarial field conditions before App Store submission:

- ✅ Direct-sun test: 95°F outdoors at noon. Every screen readable.
- ✅ Gloved-thumb test: tap targets ≥ 44 px; tested with real construction glove.
- ✅ 95°F-heat test: 30 min running in 95°F environment; no thermal throttle crash.
- ✅ Dropped-device test: AppleCare-grade case + 2 drops onto concrete from 4 ft. App still functions.
- ✅ 12-hour-shift battery test: app + camera + GPS + open all day = battery to 0% no later than 9 hours.
- ✅ Cellular-dead-zone test: airplane mode 30 min; queue 50 actions; restore; verify all sync.
- ✅ Port-a-potty test: one-handed operation while standing.

Each screen: signed off in code as `// FIELD-TESTED 2026-08-XX`. CI fails if signoff is removed without explicit override.

---

## App Store Submission Strategy

### Sept 1, 2026 — Submit

- TestFlight beta has run 50+ pilot users for 14 days
- All 10 screens implemented + tested
- Field-test rig signed off
- Demo video preview reel produced
- 10 screenshots prepared
- App Description finalized
- Privacy Policy linked
- Terms of Service linked

### Sept 8 — Apple Review (typical 1-2 day cycle in 2026)

If approved: GA on App Store. Set Live State to "Available."

If rejected: typically a fix-and-resubmit cycle. Common rejection reasons + responses:
- "Requires SSO" → we have Apple Sign-In
- "Not enough first-party features" → we have local-mode for offline
- "Violates IAP rules" → we use external subscription (org-level), not in-app
- "Needs Privacy Policy" → linked

Response time to fix and resubmit: typically 24 hours.

### Sept 15 — App live in Store

- Walker tweets, LinkedIn post
- Sub portal magic links updated to deep-link to app
- Pilot customers' supers download

### Soft GA — Visible only to existing customers

For first 30 days post-launch (Sept 15 → Oct 15), app is in store but not actively marketed. Existing customers' supers download; we monitor crash rates + telemetry.

### Public GA — March/April 2027 launch

At SiteSync GA, app is part of the marketing push. Marketing site has an "Available on App Store" badge. Demo video features the iOS app prominently.

---

## App Store Optimization (ASO)

Post-GA, we monitor + optimize:

- **Keyword rankings:** track our keywords in the App Store search
- **Conversion rate:** views → installs
- **Reviews:** monitor; respond to negative reviews professionally
- **Screenshots:** A/B test (Apple supports this)
- **Description:** A/B test

Goal year 1: 4.5+ stars; > 1,000 installs; > 200 active users (Pro+ customers' supers).

---

## Crash + Performance Monitoring

- **Sentry React Native** + iOS native crash reports
- Real-time crash alerting (page on > 0.5% crash rate)
- Performance monitoring: cold start time, memory usage, network failure rate
- Daily crash inbox review by Walker (first 30 days post-launch)

---

## What Walker Does With This Spec This Week

1. Confirm Apple Developer Team ID + bundle ID
2. Review screen-by-screen plan; flag any user flow that's wrong
3. Identify designer for screenshots + demo video preview reel

---

## What Claude Code (engineer #2) Does With This Spec

- Build all 10 screens (~50 engineer-days through Aug-Sept 2026)
- Build SiteSyncPlanView native module (iOS) (~10 days)
- Build Live Activity widget extension (~3 days)
- Field-test rig run + signoff (~3 days)
- App Store submission package (screenshots, description, video, etc.) (~2 days)
- Crash monitoring setup (~1 day)

Total engineer #2 work: ~70 days = ~14 weeks. Aligns with engineer #2 starting June 1, ramping June, building July-August, submitting Sept 1.

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| IOS-1 | App Store rejects on first submission | Medium | Medium | Privacy Policy + Apple Sign-In + IAP disclosure ready |
| IOS-2 | SiteSyncPlanView native module is harder than expected | Medium | High | Allocate 10 days; iterate; PDF rendering can fall back to react-native-pdf if needed |
| IOS-3 | TestFlight beta reveals UX issues we missed | High (likely) | Medium | 14-day TestFlight period before submission; iterate |
| IOS-4 | Live Activities don't work as expected on older iOS versions | Medium | Low | Graceful fallback to push notifications |
| IOS-5 | Field-test rig doesn't catch a real-world issue | Low | Medium | Pilot users (Brad's pilot) catch what tests don't |
| IOS-6 | App Store category change required | Low | Low | Submit under "Business" + "Productivity" |
| IOS-7 | Engineer #2 hire slips → mobile build slips | Medium | Critical | Walker on critical path if engineer hire is delayed; build smaller surface |

---

## What this spec deliberately does NOT cover

- Android equivalent (covered by `ANDROID_APP_SPEC` forthcoming)
- Push notifications design (covered by `PUSH_NOTIFICATIONS_SPEC` forthcoming)
- Offline queue design (covered by `OFFLINE_FIRST_REWRITE_SPEC` forthcoming)
- iPad-specific layouts (defer to year 2)
- Apple Watch companion (defer to year 2)
- WidgetKit / Lock Screen widgets (defer to year 2)
- Mac Catalyst / Apple Silicon Mac (skip; not needed)
- TestFlight beta program management (covered by `RELIABILITY_ARCHITECTURE` qua incident response)

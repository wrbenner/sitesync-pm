# Android App Spec

**Date:** 2026-05-04
**Status:** Spec ready. Build kicks off ~2 weeks after iOS scaffold (Aug-Sept 2026); Play Store closed-track beta Oct 2026; GA Q3 2027.
**Architecture:** Per ADR-010 — same RN codebase as iOS. Native module (SiteSyncPlanView) ports to Kotlin + Compose canvas.
**Companion specs:** `IOS_APP_SPEC_2026-05-04.md` (sister), `ADR_010_MOBILE_NATIVE_ARCHITECTURE_2026-05-04.md`, `OFFLINE_FIRST_REWRITE_SPEC` (forthcoming), `PUSH_NOTIFICATIONS_SPEC` (forthcoming)
**Format reference:** `IOS_APP_SPEC_2026-05-04.md` — most decisions mirror; this spec covers the deltas.

---

## TL;DR

Same React Native codebase as iOS with **5 deltas**: native module ported to Kotlin + Compose canvas, push via FCM (not APNs), Material 3 theming for system colors, Play Store submission instead of App Store, no Live Activities (Android equivalents are different).

Beta Oct 2026; closed-track beta with 20+ users; GA Q3 2027 (post-launch).

---

## What's the Same as iOS

98% of the codebase. The whole RN screen tree, components, business logic, Iris approval flow, citations panel, drawing rendering at the JS level, offline queue (MMKV + op-sqlite work cross-platform), authentication, deep links, accessibility audits — identical.

---

## The 5 Deltas

### Delta 1 — Native module ports to Kotlin + Compose

**iOS:** Swift + UIKit overlay layer for `SiteSyncPlanView` (PDF + pin overlay)
**Android:** Kotlin + Jetpack Compose canvas for the same component

Same React Native bridge (TurboModule API); same JS API. Underlying implementation differs.

**Implementation:** ~10 engineer-days for the Android port (after iOS native module is mature).

### Delta 2 — Push notifications via FCM (not APNs)

**iOS:** APNs (Apple Push Notification service) via `expo-notifications` + `@react-native-firebase/messaging`
**Android:** FCM (Firebase Cloud Messaging) directly via `@react-native-firebase/messaging`

Both work in RN. Implementation is parallel; back-end picks correct provider per device token.

### Delta 3 — Material 3 theming for system colors

**iOS:** uses our brand colors directly; respects iOS Dark Mode system setting
**Android:** uses Material 3 dynamic theming where appropriate; respects Android Dark Mode

For brand consistency: our brand palette overrides system Material colors on key brand surfaces (logo, primary actions). Material applies to standard system controls (date pickers, etc.).

### Delta 4 — No Live Activities (use Notification Channels instead)

iOS Live Activities for the 60s cancel-window countdown don't have a 1:1 Android equivalent. Android equivalent: **Foreground Service notification** that updates in real time, with action buttons.

**Implementation:** ~2 days

### Delta 5 — Play Store submission flow

Different than App Store:
- Play Store registration: $25 one-time fee (Walker registers Q2 2026)
- Closed Track (alpha) → Open Track (beta) → Production (GA)
- Review process: typically 2-4 hours (faster than Apple)
- AAB (Android App Bundle) format, not APK
- Privacy Policy + Data Safety form (Google's equivalent of App Store privacy nutrition labels)

**Implementation:** ~3 days for Play Store metadata + listing setup

---

## Play Store Listing

### Title + Subtitle

- Short title: SiteSync (30 char limit)
- Full title: SiteSync: AI Construction PM (50 char limit)
- Short description: AI superintendent for construction. Drafts your work, you approve, audit chain proves it. Subs use it free.

### Description (~4000 chars max)

Same content as App Store description, expanded to use Android's higher character allowance.

### Screenshots

- Phone screenshots: same set as iPhone iOS
- Tablet screenshots: same set as iPad iOS (using a 7" or 10" mockup)
- Feature graphic: 1024x500 — same brand visual as iOS demo video preview

### Categorization

- Primary: Business
- Secondary: Productivity
- Content rating: Everyone (no age-restricted content)

### Privacy + Data Safety

Google's Data Safety form requires us to declare:
- Personal info collected: email (yes); phone (optional)
- Financial info: nope (handled by Modern Treasury post-launch)
- Health/fitness: nope
- Photos/videos: yes (camera capture)
- Location: yes (GPS)
- Audio: yes (voice memos)
- App activity: yes (interactions tracked for analytics + audit log)

All used for: app functionality. Optional or required per feature. We're transparent.

---

## Field-Test Rig (Android-specific)

Same scenarios as iOS, but Android testing covers:
- ✅ Multiple manufacturer fragmentation (Samsung, Google Pixel, OnePlus, Motorola)
- ✅ Older Android versions (back to Android 10 = API 29, covers ~95% of in-field devices in 2026)
- ✅ Battery optimization settings (Doze + App Standby — cellular dead zone test crucial)
- ✅ Edge-to-edge display + gesture nav vs. 3-button nav
- ✅ Different screen sizes + densities (DPI variations)

Tested on devices Walker has access to + cloud testing service (Firebase Test Lab or AWS Device Farm).

---

## Closed-Track Beta (Oct 2026)

- 20+ users, mostly pilot customers' supers (subset of TestFlight beta on iOS)
- Distribution: Closed Track in Play Store; users get a tester invite link
- Feedback collection: Sentry + in-app feedback widget
- Iteration cycle: 2-week sprints; new beta builds via EAS Build

---

## What Walker Does With This Spec This Week

1. Register Play Store developer account ($25)
2. Confirm Material 3 theming approach matches brand
3. Identify Android pilot users (subset of iOS TestFlight beta)

---

## What Claude Code (engineer #2) Does

- Add Android target to RN project (`expo prebuild --platform android`)
- Port SiteSyncPlanView to Kotlin (~10 days)
- Set up FCM (~1 day)
- Set up Material 3 theming (~1 day)
- Notification Foreground Service for cancel window (~2 days)
- Play Store submission package (~3 days)

Total: ~17 engineer-days. Done in parallel with later iOS polish.

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| AND-1 | Native module port to Kotlin reveals iOS approach won't work cleanly | Medium | Medium | Allocate 10 days; iterate; backup: react-native-pdf with custom overlay |
| AND-2 | Material 3 default styling clashes with brand | Medium | Low | Override systematically; test on multiple devices |
| AND-3 | Manufacturer fragmentation breaks Foreground Service | Medium | Medium | Test on Samsung + Google + OnePlus + Motorola; document workarounds |
| AND-4 | FCM token expires faster than APNs | Low | Medium | Token refresh + retry on push fail |
| AND-5 | Play Store rejects on Data Safety form | Low | Low | Be explicit + transparent; if rejected, fix + resubmit |

---

## What this spec deliberately does NOT cover

- iOS specifics (covered by `IOS_APP_SPEC`)
- Cross-platform shared code (it's the same RN codebase)
- Wear OS / Android Auto (skip year 1)
- Desktop / Chromebook (skip year 1)

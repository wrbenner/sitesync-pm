# ADR-010 — Mobile Native Architecture: React Native + Expo + One Native Module

**Date:** 2026-05-04
**Status:** Accepted
**Decider:** Walker
**Apple Developer status:** Approved (saves 1-2 weeks of account approval cycle)
**Companion specs:** `IOS_APP_SPEC` + `ANDROID_APP_SPEC` + `OFFLINE_FIRST_REWRITE_SPEC` + `PUSH_NOTIFICATIONS_SPEC` (forthcoming Wave 3)

---

## Decision

Ship the SiteSync mobile app on **React Native 0.76+ (bare workflow with Expo SDK 52+)** with **one strategic custom native module** for PDF rendering + pin overlay (`SiteSyncPlanView`). Target iOS App Store submission **September 2026**, Android closed-track Play Store beta **same window**. iOS GA at SiteSync GA (Mar/Apr 2027). Android GA Q3 2027.

This decision supersedes any prior assumption that mobile would be native Swift + Kotlin.

---

## The Choice

The 2026 RN ecosystem has three viable architectures:

| Architecture | Code paths | Talent needed | Time to first TestFlight | Notes |
|---|---|---|---|---|
| Native Swift + Kotlin | 2 | 2 senior platform engineers | 6+ months | Procore's path. Doesn't match team scale. |
| **React Native 0.76+ (bare) + Expo + 1 custom native module** | 1 + 1 small platform shim | 1 RN engineer with iOS background | ~10 weeks to TestFlight | Trunk Tools' path. Fits team. |
| Capacitor / Ionic / hybrid web wrapper | 0.5 | 1 web engineer | 4 weeks | Cheapest, lowest UX bar. Not Bugatti grade for field UX. |

**RN 0.76+ chosen.** The 2026 RN ecosystem has crossed the maturity threshold:

- **New Architecture default since Oct 2024** — Fabric (synchronous concurrent renderer) + TurboModules (lazy-loaded type-safe native bridges via JSI) + Bridgeless mode (legacy async bridge gone)
- **Performance parity** with native for everything except sub-16ms hardware-sensor interactions and tight run-loop control (none of which SiteSync needs)
- **Production deployments at scale**: Shopify (entire mobile app, ~500 screens), Discord, Coinbase, Microsoft Office/Teams/Outlook, Walmart, Tesla owner app, Mercari, Bloomberg
- **Trunk Tools — the closest construction-tech analog — chose React Native** for explicitly the same founder-led-team reasons SiteSync faces
- **Talent market**: RN job postings outnumber iOS+Android-combined ~1.4-to-1; one RN engineer covers both platforms; native specialists cost ~2x in salary
- **Migration-away-from-RN at scale**: zero notable cases in 2024-2026 (Airbnb 2018 was pre-Fabric, pre-Hermes, pre-most-of-modern-RN — its lessons no longer apply)

Native Swift + Kotlin is the right answer if you have two senior platform specialists and 9 months. We have one engineer + about-to-hire engineer #2 + 6 months. RN gets us to TestFlight in ~10 weeks and App Store by August (Sept conservatively) with the time-buffer the Bugatti bar demands.

---

## The Stack

```
React Native 0.76+ (bare workflow, New Architecture on)
Expo SDK 52+ (config plugins, EAS Build, OTA updates, expo-camera, etc.)

Core libraries (all >1M weekly downloads, corporate maintainers):
- expo-router (file-system routing, deep links)
- expo-camera or react-native-vision-camera v4 (for frame processors → QR/barcode)
- expo-av (audio capture for voice memos)
- expo-notifications + @react-native-firebase/messaging (push: APNs + FCM)
- expo-background-task (BGTaskScheduler iOS + WorkManager Android)
- expo-secure-store (keychain + Android Keystore)
- expo-crypto (hashing for client-side audit trail prep)

State + offline:
- react-native-mmkv (KV store; JSI; replaces AsyncStorage)
- op-sqlite (raw SQLite via JSI; replaces dexie/offlineDb on mobile)
- (We do NOT use Redux on mobile — Zustand stores from web port directly via React Native)

Animations + interactions:
- react-native-reanimated 3 (UI-thread animations)
- react-native-gesture-handler 2

Lists:
- @shopify/flash-list (anything >50 items)

Crash + perf monitoring:
- @sentry/react-native (matches the web Sentry already in the codebase)

CI/CD + OTA:
- EAS Build (replaces local Xcode/Gradle build chains for CI)
- EAS Update (over-the-air JS bundle updates without App Store review)

Design system:
- Tamagui (matches Tailwind/web semantics; SSR-friendly; performant on RN)
  OR: Nativewind (lighter; if Tamagui's complexity is overkill)
  Decision deferred to designer onboarding Q4

Custom native modules:
- @sitesync/plan-view  (the ONE custom module)
    - iOS: PDFKit + UIKit overlay layer for pin drops + Apple Pencil
    - Android: PdfRenderer + Compose canvas
    - JS API: <PlanView pdfUrl={...} pins={[{x, y, label}]} onPinDrop={...} />
    - ~500-1000 LOC per platform
```

---

## What We Write Custom Native For

**Exactly one component:** `SiteSyncPlanView`. This is the drawing-pin-overlay surface. It needs:
- 60fps panning + zooming on a 50MB PDF
- Sub-16ms response to pin-drop gestures
- Apple Pencil pressure sensitivity (iPad, year 2)
- Sub-pixel-accurate pin placement (otherwise the IssueOverlay deep-link is wrong)

These are exactly the "tight control over the run loop" things RN's JS thread can't deliver. PDFKit (iOS) and Android's PdfRenderer + Compose canvas handle them natively. Expose a single component to the JS layer.

**Everything else** — camera, voice, push, offline queue, gestures, animations, navigation, deep links, QR scan, notifications — has a 2026 RN library that's production-grade. Don't write native code we don't need to.

---

## Why Bare RN + Expo (not Managed Expo, not naked RN)

The 2026 standard for production apps is **bare workflow with Expo Modules** (also called "Continuous Native Generation" or "prebuild" model):

- **Bare workflow** = we own the `ios/` and `android/` directories. Drop into them when we need to (the PlanView native module).
- **Expo Modules** = we get Expo's batteries: config plugins, EAS Build, EAS Update, the entire `expo-*` library set.
- This is what Shopify, Discord, Coinbase use today.

**Naked RN (no Expo)** is what we'd use if Expo's overhead wasn't worth it — but Expo's overhead in 2026 is minimal and the surface they cover (camera, notifications, secure store, OTA) is exactly the surface we need.

**Managed Expo** (no bare workflow) is for prototypes and apps that never need custom native. We've outgrown it on day one because we need PlanView.

---

## Apple Developer Status — Already Approved

This saves 1-2 weeks of account approval. We can submit a TestFlight build the day the iOS app spec is implemented + EAS Build is configured. Walker should:

1. Verify Apple Developer account is in the org's name (not personal)
2. Verify two-factor + key permissions are set
3. Provide App Store Connect access to engineer #2 when hired

Android Play Store registration is separate — $25 one-time fee, ~24-48 hours approval. Defer until iOS TestFlight is in-progress (~July 2026).

---

## Timeline (compressed for the Mar 2027 launch target)

| Date | Milestone | Owner |
|---|---|---|
| **June 1, 2026** | Engineer #2 starts (RN + iOS background) | Walker |
| **June 8, 2026** | Bare RN + Expo scaffold + EAS Build configured + first hello-world build runs | Eng #2 |
| **June 22, 2026** | Auth + first 5 screens (Login, Day, Inbox, RFI Detail, Capture) ported from web | Eng #2 |
| **July 13, 2026** | Camera + voice + offline queue + push wired | Eng #2 |
| **July 27, 2026** | `@sitesync/plan-view` native module v1 (iOS only first; Android 2 weeks later) | Eng #2 |
| **August 10, 2026** | All screens covered. Field-test rig pass: 95°F, gloved thumbs, sunlight, dropped device | Walker + Eng #2 |
| **August 17, 2026** | TestFlight beta of 50+ pilot users | Walker |
| **September 1, 2026** | App Store submission | Eng #2 |
| **September 15, 2026** | App Store approval (typical 1-2 day cycle in 2026) | Apple |
| **September 22, 2026** | Soft GA on iOS (visible only to current customers) | Walker |
| **October 2026** | Android closed-track beta in Play Store | Eng #2 |
| **March/April 2027** | Public GA at SiteSync launch | Walker |

---

## What's Out of Scope for V1

- **iPad-specific layouts.** iOS GA is iPhone-first. iPad gets the unmodified iPhone layout (acceptable per Apple guidelines). iPad-optimized layouts ship Q3 2027.
- **Apple Watch companion.** Year 2.
- **WidgetKit / Live Activities.** Year 2 (would be cool to have "RFI #42 awaiting your review" as a Live Activity but not launch-critical).
- **Android Auto / CarPlay.** Year 2+.
- **Apple Pencil pressure sensitivity in PlanView.** iPhone uses finger-only at GA; Pencil supported when iPad lands.

---

## Migration Escape Hatch (if RN proves wrong)

RN-to-native migration is **feature-by-feature, not rewrite**:

1. **Brownfield embedding works both directions.** RN screens embed in native shells via `RCTRootView` (iOS) and `ReactRootView` (Android). And vice versa.
2. **Migration order if needed:** (a) re-skin the shell in SwiftUI/Compose with RN screens still mounted, (b) rewrite hot screens (login, plan view, daily log) one at a time, (c) retire the RN runtime when last screen migrated. Microsoft Office did the *reverse* (RN screens absorbed into native) — pattern works either way.
3. **Worst case at year 2 = rewrite UI, keep data layer.** Domain code (money math via `src/types/money.ts`, RPC contracts, state machines) is platform-agnostic TypeScript. Swift and Kotlin can call the same Supabase RPCs. ~4-month native rewrite, not 12-month.

There is no architecturally-locked-in scenario.

---

## Field-Test Rig (Bugatti-grade requirement)

Per the weapon-discipline framing: every screen tested in adversarial field conditions before App Store submission. The rig:

- **Direct-sun test**: open the app on iPhone outdoors at noon. Every screen readable.
- **Gloved-thumb test**: tap targets ≥ 44 px (Apple HIG); test with a real construction glove.
- **95°F-heat test**: run the app 30 min on iPhone in 95°F environment; confirm no thermal throttling crashes.
- **Dropped-device test**: AppleCare-grade case + 2 drops onto concrete from 4ft. App still functions.
- **12-hour-shift battery test**: app open in background + 8 hours active + camera capture + GPS = battery to 0% no later than ~9 hours.
- **Cellular-dead-zone test**: airplane mode for 30 min, queue 50 actions, restore connection, verify all sync.
- **Port-a-potty test**: one-handed operation while standing. (No, seriously — supers do this. Walker laughs but tests.)

Each screen + workflow has a "Field-Tested" sign-off in the code. CI fails if signoff is removed without explicit override.

---

## File-by-file Initial Structure

```
mobile/
  app.config.ts               # Expo config (bare workflow)
  package.json
  tsconfig.json
  babel.config.js
  metro.config.js
  src/
    app/                      # expo-router file-system routes
      (auth)/
        login.tsx
        forgot-password.tsx
      (main)/
        _layout.tsx           # bottom tab bar
        day/
          index.tsx
        inbox/
          index.tsx
          [draftId].tsx
        rfis/
          index.tsx
          [rfiId].tsx
        capture/
          index.tsx
        profile/
          index.tsx
      _layout.tsx             # root navigator
    components/
      PlanView.native.tsx     # wraps the @sitesync/plan-view native module
      PlanView.web.tsx        # web fallback (uses pdfjs)
      ...
    services/
      api.ts                  # supabase client + types (shared with web)
      offline.ts              # MMKV + op-sqlite
      camera.ts
      voice.ts
      push.ts
    domain/                   # COPY-PASTED from src/types + src/services where applicable
      money.ts
      drafted-actions.ts
      ...
    hooks/                    # mobile-specific hooks
    state/                    # zustand stores (port from web)
  modules/
    sitesync-plan-view/        # the ONE custom native module
      ios/
        SiteSyncPlanView.swift
        SiteSyncPlanViewModule.swift
      android/
        SiteSyncPlanView.kt
        SiteSyncPlanViewModule.kt
      src/
        index.ts               # JS API
      expo-module.config.json
  ios/                          # auto-generated by expo prebuild; commit
  android/                      # auto-generated by expo prebuild; commit
  eas.json                      # EAS Build config
  __tests__/
```

---

## Code Sharing Strategy with Web

**Domain layer:** copied/symlinked from `src/types/` and `src/services/` where applicable. Money, types, RPC client signatures, state machines (the validation tables, not the actor wiring) — same code on web + mobile.

**State management:** Zustand stores port directly. (One reason we kept the 13 stores in Lap 1 — they're framework-agnostic.)

**UI components:** mostly NOT shared. Web uses CSS-in-JS / inline styles; mobile uses Tamagui or Nativewind. Component shapes are similar but rendering is platform-native.

**API surface:** one Supabase client (`@supabase/supabase-js`) works on both. The same RPCs we use on web are callable from RN.

**Tests:** domain tests share. UI tests don't (Playwright on web; Detox or Maestro on mobile).

---

## What Walker Does With This ADR This Week

Nothing — this ADR is a decision document, not an outreach trigger. Implementation starts when engineer #2 starts (June 1).

What does need to happen this week:
- Engineer #2 sourcing kicks off (per Q3 2026 pre-flight plan)
- Job spec for engineer #2 explicitly mentions: RN + iOS background, comfortable with custom native modules, plus-one for construction-tech experience
- Apple Developer account verified (it's already approved per Walker)

---

## Acceptance Criteria for This ADR to Be "Shipped"

1. ADR committed to `docs/audits/`
2. INDEX.md updated to add ADR-010
3. Engineer #2 job spec mentions the chosen architecture
4. Walker re-confirms after reading; if any of the 10 stack choices change (e.g., Tamagui → Nativewind), spec gets revised
5. Sister specs IOS_APP_SPEC + ANDROID_APP_SPEC + OFFLINE_FIRST_REWRITE_SPEC + PUSH_NOTIFICATIONS_SPEC reference this ADR as ratifying the architecture choice

---

## Consequences

### Positive

- 6-month TestFlight delivery achievable with 1-2 engineers
- Single codebase = halved maintenance burden vs native parity
- TypeScript continuity from web → mobile reduces context-switching
- Trunk Tools precedent provides confidence at our team scale
- EAS Update gives us OTA hotfix capability — critical for the soft pilot's "ship a fix overnight" rule

### Negative

- One custom native module to maintain (the PDF/pin module). ~2-3 engineer-weeks/year of upkeep.
- Native specialists in our network might raise eyebrows. (Mitigation: cite Trunk Tools, Shopify.)
- Some bleeding-edge iOS features (Live Activities, Dynamic Island integration) lag native by 3-6 months in the RN ecosystem. Acceptable for our launch scope.

### Neutral

- The web codebase doesn't change. Web is still web. Mobile is mobile. They share domain code, not UI.
- App Store / Play Store submission cycles same as native.
- Crash monitoring (Sentry) and analytics (PostHog) work identically.

# App Store Runbook — SiteSync PM

The end-to-end plan for getting SiteSync onto the iOS App Store (and
the Google Play Store as a near-free bonus). Owns the strategic
decisions and the human-only steps; the code-level work is already
landed and referenced inline.

---

## 0. Strategic decisions (locked in)

| # | Decision | Why |
|---|---|---|
| 1 | **Sales-led billing, no IAP, ever** | Sidesteps Apple's 30% cut and the entire reader-app rules maze. App is sign-in-only; no signup, no pricing copy. Procore, Autodesk Construction Cloud, etc. operate this way. |
| 2 | **OTA via Capacitor Live Updates** | Ships JS bundles without review. Apple review only gates native shell + plugin changes. Without this, iOS users perma-lag web users by a week. |
| 3 | **TestFlight before public listing** | No review for internal testers (≤100); 1-day review for external (≤10k); 90-day build expiry. We can run the entire iOS business off TestFlight for months. |
| 4 | **Apple Developer Program — Organization** | Requires D-U-N-S, takes 1–2 weeks. Long pole; start today. Individual enrollment locks us out of TestFlight team distribution and looks unprofessional. |
| 5 | **Reviewer-first hardening** | The five rejection causes — privacy strings, privacy manifest, account deletion, broken demo login, IAP confusion — are all addressed. Everything else is polish. |

---

## 1. What's already done (in this repo)

| Item | Path |
|---|---|
| Removed unused `@capacitor/share` (shrinks reviewer surface) | `package.json` |
| Added `@capacitor/ios` to dependencies | `package.json` |
| `delete-account` Supabase Edge Function (auth.admin.deleteUser + cascade + sole-admin guard) | `supabase/functions/delete-account/index.ts` |
| Migration for `account_deletion_events` audit table | `supabase/migrations/20260427000001_account_deletion_events.sql` |
| `DeleteAccountDialog` UI with typed-confirm | `src/components/auth/DeleteAccountDialog.tsx` |
| Danger Zone section in profile screen | `src/pages/UserProfile.tsx` |
| iOS Info.plist usage strings (NSCamera, NSLocation, etc.) | `ios-assets/Info.plist.snippet.xml` |
| iOS Privacy Manifest declaring data flows | `ios-assets/PrivacyInfo.xcprivacy` |
| Privacy Policy (host on sitesync.com/privacy) | `docs/legal/PRIVACY_POLICY.md` |
| Terms of Service with Apple-specific section | `docs/legal/TERMS_OF_SERVICE.md` |
| Reviewer demo-account seed script (`npm run seed:demo-account`) | `scripts/seed-demo-account.ts` |
| `.gitignore` entries for Pods/build/xcuserdata | `.gitignore` |

After pulling, run:
```bash
npm install                                  # drops @capacitor/share
supabase functions deploy delete-account     # deploy the edge function
supabase db push                             # apply the migration
```

---

## 2. Human-only — long pole (start today)

### 2.1 Apple Developer Program enrollment (Organization)

1. Get a **D-U-N-S Number** for SiteSync, Inc.
   https://developer.apple.com/enroll/duns-lookup/ (free, 1–14 days).
2. Enroll at https://developer.apple.com/programs/enroll/
   ($99/yr, requires the D-U-N-S Number).
3. Once approved, register the App ID for `com.sitesync.pm` at
   https://developer.apple.com/account/resources/identifiers/list.
   Enable capabilities: Push Notifications, Sign In with Apple
   (only if you ever add Google sign-in), Associated Domains.

### 2.2 App Store Connect record

Once enrolled:
1. Create the app at https://appstoreconnect.apple.com/apps with
   bundle ID `com.sitesync.pm`, primary language English (US),
   SKU `sitesync-pm`.
2. Fill in App Information: privacy policy URL
   `https://sitesync.com/privacy`, category Business / Productivity.
3. Complete the **App Privacy questionnaire** using
   `ios-assets/PrivacyInfo.xcprivacy` as the source of truth.
4. Set **Age Rating** (4+ for B2B productivity).
5. Answer **Encryption export compliance**: "Uses standard encryption,
   exempt under §740.17(b)(1)". (Already pre-set in
   `Info.plist.snippet.xml` via `ITSAppUsesNonExemptEncryption=false`.)

### 2.3 Privacy Policy + Terms of Service must be live

Host these as public URLs before submission:
- `https://sitesync.com/privacy` ← `docs/legal/PRIVACY_POLICY.md`
- `https://sitesync.com/terms` ← `docs/legal/TERMS_OF_SERVICE.md`

---

## 3. Native project setup (one-time, ~30 min)

**Prerequisites — install on the host machine before running cap add ios:**

1. **Full Xcode** (not just Command Line Tools): install from the Mac
   App Store, then `sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer`.
   Without full Xcode, `cap add ios` fails at `pod install`.
2. **CocoaPods**: `brew install cocoapods` (preferred) or
   `sudo gem install cocoapods`. Verify with `pod --version`.

Once both are installed:

```bash
npm install                          # drops @capacitor/share
# @capacitor/ios is already in dependencies
npx cap add ios                      # generates ios/ directory
npm run cap:build:ios                # build web + sync
npx cap open ios                     # open Xcode
```

Then in Xcode:

1. **Drag** `ios-assets/PrivacyInfo.xcprivacy` into `App/App/`.
   Check "Copy items if needed", target = App.
2. Open `App/App/Info.plist` as source code; paste the keys from
   `ios-assets/Info.plist.snippet.xml` before the closing `</dict>`.
3. **Signing & Capabilities** → select your team. Let Xcode auto-manage
   signing.
4. Add capabilities: **Push Notifications**, **Background Modes** →
   "Remote notifications".
5. Add the **App Icon** (1024×1024 master in `App/Assets.xcassets/AppIcon`).
   No alpha, no rounded corners.
6. Set deployment target to **iOS 16.0** (covers ~98% of devices and
   matches Capacitor 8 minimum).
7. Build & run on a simulator → fix any crashes → run on a real device.

`ios/` should be **committed** to the repo. Add to `.gitignore`:
```
ios/App/Pods/
ios/App/build/
ios/App/DerivedData/
ios/App/*.xcworkspace/xcuserdata/
ios/App/*.xcodeproj/xcuserdata/
ios/App/*.xcodeproj/project.xcworkspace/xcuserdata/
ios/App/output/
```

---

## 4. OTA — Capacitor Live Updates

1. Sign up for Ionic's App Flow (or self-host with `capgo`).
2. `npm i @capacitor/live-updates`.
3. Add to `capacitor.config.ts`:
   ```ts
   plugins: {
     LiveUpdates: {
       appId: '<your-channel-id>',
       channel: 'production',
       autoUpdateMethod: 'background',
       maxVersions: 2,
     },
   },
   ```
4. Wire upload step into CI: on merge to `main`, `npm run build` then
   `npx @capacitor/live-updates upload --channel=production`.
5. **Native-shell-changing** PRs (new plugin, new entitlement) bump
   the binary version and require a fresh App Store build.

---

## 5. Pre-submission checklist — reviewer-rejection hardening

- [ ] Demo account credentials prepared (`reviewer@sitesync.com` /
      `Test1234!`) seeded with a populated demo project — added to
      App Store Connect → App Review Information → Sign-In Required.
- [ ] Reviewer notes drafted explaining: (a) AI features are scoped
      to the user's own project context, not public UGC; (b) billing
      is sales-led on the website, no IAP intentionally; (c) MFA can
      be skipped within a 7-day grace window (matches our security
      policy, see `SECURITY.md`).
- [ ] Account deletion confirmed working end-to-end on a real device.
- [ ] All Capacitor plugin permissions trigger their usage prompts
      with the strings from `Info.plist.snippet.xml`.
- [ ] Privacy Policy and Terms URLs return 200, not 404, on first load.
- [ ] App runs offline-tolerant: airplane-mode test on a real device,
      Liveblocks degrades gracefully, daily-log entry queues.

---

## 6. Marketing assets (Photoshop / Figma)

| Asset | Spec | Notes |
|---|---|---|
| App Icon | 1024×1024 PNG | No alpha, no rounded corners. Match brand. |
| Launch Screen | Storyboard or asset catalog | Solid brand color + logo. Keep simple. |
| Screenshots — 6.9" iPhone | 1320×2868 | Required. 3–10 shots. |
| Screenshots — 6.5" iPhone | 1284×2778 | Required if you don't have 6.9". |
| Screenshots — 13" iPad | 2064×2752 | Only if iPad supported. |
| Subtitle | ≤30 chars | "Construction PM, simplified." |
| Description | ≤4000 chars | Lead with daily-log + RFI value props. |
| Keywords | ≤100 chars total | "construction,project,daily log,RFI,jobsite,foreman" |
| Promotional text | ≤170 chars | Updateable without re-review. |
| Support URL | required | `https://sitesync.com/support` |

Take screenshots from the demo project, not customer data.

---

## 7. Submit

```bash
# In Xcode:
Product → Archive
Distribute App → App Store Connect → Upload
```

Then in App Store Connect:
1. Attach the build to a version (e.g., 1.0.0 (1)).
2. Submit to TestFlight first → 24h review → distribute to 5–10
   internal testers.
3. After 2–4 weeks of TestFlight stability, submit for App Store
   Review with all marketing copy and screenshots.

First review: 24–48h. Plan for **one rejection** on round 1; the
common causes are documented and pre-empted, but reviewers vary.

---

## 8. Android (~1 day, can run in parallel)

```bash
npm install -D @capacitor/android
npx cap add android
npm run cap:build:android
npx cap open android   # Android Studio
```

Google Play Console:
- Pay $25 one-time registration fee.
- Mostly mirrors the iOS process — privacy policy URL, content rating,
  screenshots, app bundle (.aab). Review takes hours, not days.
- The PrivacyInfo.xcprivacy doesn't apply; Google has its own Data
  Safety form. Same data categories as iOS.

---

## 9. Owner & dates

| Owner | Item | Target |
|---|---|---|
| Walker | Apple Developer enrollment + D-U-N-S | Week 1 |
| Walker | Privacy/Terms URLs live on sitesync.com | Week 1 |
| Claude / Walker | `cap add ios` + Xcode wiring | Week 1 |
| Walker | App icon + screenshots | Week 2 |
| Walker | TestFlight upload | Week 3 |
| Walker | App Store submission | Week 5–6 |

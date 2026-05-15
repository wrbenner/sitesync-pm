# iOS App Store Submission Pipeline — Scaffold Receipt

**Date:** 2026-05-13
**Branch:** `feat/ios-app-store-pipeline`
**Bundle ID:** `com.sitesyncai.app`
**Apple Team ID:** stored in `APPLE_TEAM_ID` GitHub secret (not committed)
**Authorizer:** Walker

## Scope

Single PR scaffolding the iOS App Store submission pipeline end-to-end:
local dev → CI build → TestFlight → App Store Review. Authenticates via
App Store Connect API key (no Apple ID, no 2FA).

## Files added / modified

| File | Status | Purpose |
|---|---|---|
| `capacitor.config.ts` | modified | appId `com.sitesyncai.app`, appName `SiteSync`, ios scheme + contentInset |
| `ios/` (full Xcode scaffold) | added | `npx cap add ios` baseline |
| `ios/App/App.xcodeproj/project.pbxproj` | modified | `PRODUCT_BUNDLE_IDENTIFIER = com.sitesyncai.app` |
| `ios/App/App/Info.plist` | modified | 6 usage descriptions + `ITSAppUsesNonExemptEncryption=false` |
| `ios/App/App/PrivacyInfo.xcprivacy` | added | Apple Privacy Manifest — 7 collected data types, tracking=false |
| `fastlane/Appfile` | added | Reads `APP_BUNDLE_ID` + `APPLE_TEAM_ID` from env |
| `fastlane/Fastfile` | added | `beta` + `release` lanes; base64-decoded .p8 written to temp file, cleaned in `after_all`/`error` |
| `Gemfile` | added | fastlane 2.221.x + cocoapods 1.15.x |
| `.github/workflows/ios-build.yml` | added | `workflow_dispatch` + tag-on-push `v*-ios`; macos-14 runner |
| `.gitignore` | modified | `secrets/`, `*.p8`, `*.mobileprovision`, `*.cer`, `*.p12`, fastlane report/output/build |
| `docs/runbooks/IOS_BUILD_RUNBOOK.md` | added | Local dev, beta, release, key rotation, troubleshooting |
| `docs/audits/IOS_PIPELINE_RECEIPT_2026-05-13.md` | added | This receipt |

## Required GitHub Actions secrets (already configured)

All five were set on `wrbenner/sitesync-pm` on 2026-05-14 (UTC) prior to
opening this PR:

- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_API_ISSUER_ID`
- `APP_STORE_CONNECT_API_KEY_BASE64`
- `APPLE_TEAM_ID`
- `APP_BUNDLE_ID`

Verified via `gh secret list --repo wrbenner/sitesync-pm`.

## Security posture

1. **No `.p8` in repo.** `*.p8`, `*.cer`, `*.p12`, `*.mobileprovision`, and
   `secrets/` are all gitignored. The fastlane lanes decode the base64
   key into a `mktmpdir` path at runtime and delete the file in
   `after_all` / `error`. No tracked file references a local secret path.

2. **No Apple ID auth.** Both lanes authenticate via
   `app_store_connect_api_key`. No FASTLANE_USER, no FASTLANE_PASSWORD,
   no 2FA prompts. The CI is fully non-interactive.

3. **Workflow input sanitization.** `inputs.lane` is a `type: choice`
   constrained to `{beta, release}`, AND the value is bound to an `env:`
   var (`LANE`) before any `run:` step. The Fastlane step uses
   `"$LANE"` (quoted), and a "Validate lane name" step re-checks the
   value before invoking fastlane. Belt-and-suspenders against the
   GitHub Actions injection pattern.

4. **Export compliance.** `ITSAppUsesNonExemptEncryption=false` is
   declared in `Info.plist`. The release lane also sends
   `submission_information.export_compliance_uses_encryption: false`,
   matching the plist. The app uses only HTTPS + standard iOS crypto.

5. **Privacy manifest.** Seven data types declared in
   `PrivacyInfo.xcprivacy`: email/name/device-ID/photos/coarse-location
   (linked, app functionality), crash-data/performance-data (not linked,
   analytics via Sentry). `NSPrivacyTracking=false`, no tracking domains.

## Verification (pre-PR)

| Check | Result |
|---|---|
| `npm run typecheck` clean | see PR CI |
| `npx cap sync ios` runs without error | ✅ verified locally |
| `fastlane lanes` lists `beta` and `release` | ⚠ defer to CI (fastlane gems not installed in this workspace; the Fastfile is hand-validated and parses fine) |
| Grep for `.p8` / `.cer` / `.p12` / `secrets/` paths in tracked files | ✅ no hits in source — only references are in `.gitignore`, the runbook, and this receipt (documentation, not paths) |
| 5 required GitHub secrets present | ✅ confirmed via `gh secret list` |

## Out of scope (intentional)

- iOS app icon set, splash screen artwork (placeholders from `cap add` ship)
- App Store screenshots (per device class) — uploaded manually for first release
- Push-notification entitlement + APNs auth key — separate PR
- Universal Links / deep linking — `Info.plist.patch` documents the future setup; not in this PR
- Android pipeline — separate effort (Play Store has its own flow)

## Next steps for first TestFlight upload

1. Walker eyeballs this PR (no auto-merge).
2. Merge to `main`.
3. Wait for the previously-blocked Apple Developer Program enrollment to
   close (paperwork sent 2026-04-27; 1–2 week wait per app store status memo).
4. Once enrolled, run `gh workflow run ios-build.yml -f lane=beta` (or push
   a `v1.0.0-ios` tag).
5. First run: open Xcode locally once, set the SiteSync team in
   Signing & Capabilities, let it generate the dev cert + distribution
   profile. Subsequent runs are fully CI.
6. Validate the build in TestFlight internal testing → graduate to external
   when ready → `lane=release` for App Store submission.

## Sign-off

- Pipeline scaffold: ✅ shipped
- Live build: blocked on Apple Developer Program enrollment (out of our hands)
- Documented: runbook + receipt + this PR description

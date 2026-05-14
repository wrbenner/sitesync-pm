# iOS Build Runbook

**Owner:** SiteSync mobile pipeline
**Last updated:** 2026-05-13
**Bundle ID:** `com.sitesyncai.app`
**Apple Team ID:** stored in `APPLE_TEAM_ID` GitHub secret (look it up with `gh secret list --repo wrbenner/sitesync-pm` if needed)

This runbook covers the four operational paths for the iOS app:
local dev, TestFlight beta, App Store release, and API-key rotation.

The pipeline authenticates to App Store Connect with an API key (not an
Apple ID). The key lives in three GitHub Actions secrets and is decoded
to a temp `.p8` at build time. No path to a local secret file is ever
committed.

---

## Architecture at a glance

```
┌────────────────────┐    npm run build     ┌────────────────────┐
│  Vite SPA (src/)   ├─────────────────────▶│   dist/  (web)     │
└────────────────────┘                       └────────────────────┘
                                                       │
                                                       │ npx cap sync ios
                                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ios/App/                                                            │
│  ├── App/                  ← Info.plist, PrivacyInfo.xcprivacy       │
│  ├── App.xcodeproj/        ← bundle id = com.sitesyncai.app          │
│  └── Podfile               ← capacitor cocoapods                     │
└─────────────────────────────────────────────────────────────────────┘
                                                       │
                                          bundle exec fastlane …
                                                       ▼
┌────────────────────┐    upload_to_testflight     ┌──────────────────┐
│  fastlane/Fastfile ├────────────────────────────▶│  TestFlight      │
│   beta lane        │                              └──────────────────┘
│   release lane     │    upload_to_app_store     ┌──────────────────┐
│                    ├────────────────────────────▶│  App Store Review │
└────────────────────┘                              └──────────────────┘
```

The CI runner is `macos-14` with Xcode 15.4 and Ruby 3.3.

---

## Prerequisites (one-time, local)

You only need this once per workstation:

```bash
# Ruby tooling
brew install rbenv ruby-build
rbenv install 3.3.5 && rbenv local 3.3.5

# Bundler + fastlane + cocoapods
gem install bundler
bundle install         # reads Gemfile at repo root

# Capacitor / Node prereqs are already in package.json
npm ci

# Xcode (manual): install Xcode 15.4 from the App Store
sudo xcode-select -switch /Applications/Xcode.app
sudo xcodebuild -license accept

# .p8 key on disk (only for local fastlane runs — CI uses the GH secret).
# Keep this OUTSIDE the repo to avoid any accidental tracking; the local
# Fastfile only reads the base64-encoded body from $APP_STORE_CONNECT_API_KEY_BASE64.
mkdir -p ~/secrets-local
# Drop the AuthKey_<KEY_ID>.p8 you downloaded from App Store Connect into
# ~/secrets-local/. Apple only lets you download a key once — save it
# somewhere outside the repo immediately.
```

Export the same env vars locally that CI uses (live values live only in the
GitHub Actions secrets — pull them from `gh secret list` if you need to
remind yourself which keys are configured):

```bash
# Replace <…> with the real values; the literal Key ID + Issuer ID are
# stored as GitHub Actions secrets only and intentionally not committed.
export APP_STORE_CONNECT_API_KEY_ID="<KEY_ID>"
export APP_STORE_CONNECT_API_ISSUER_ID="<ISSUER_UUID>"
export APP_STORE_CONNECT_API_KEY_BASE64="$(base64 -i ~/secrets-local/AuthKey_<KEY_ID>.p8)"
export APPLE_TEAM_ID="<TEAM_ID>"
export APP_BUNDLE_ID="com.sitesyncai.app"
```

---

## Path 1 — Local development (simulator / device)

```bash
# 1. Build the web bundle
npm run build

# 2. Sync into the iOS scaffold
npx cap sync ios

# 3. Open in Xcode
npx cap open ios

# In Xcode:
# - Select a simulator (e.g. iPhone 15 Pro) or a connected device
# - Press Cmd+R to build & run
# - For a device, the first run prompts for code-signing — pick the
#   "SiteSync" team and let Xcode handle the provisioning profile.
```

Changing app code? Re-run `npm run build && npx cap sync ios`. You do not
need to re-open Xcode — it picks up the new bundle on next run.

---

## Path 2 — TestFlight beta release

The intended flow is **CI-driven**. Two ways to trigger it:

### A. Manual workflow_dispatch (preferred)

1. Go to: `https://github.com/wrbenner/sitesync-pm/actions/workflows/ios-build.yml`
2. Click **Run workflow**.
3. Pick `lane = beta`.
4. The job:
   - Checks out the repo on `macos-14`
   - Runs `npm ci && npm run build && npx cap sync ios`
   - Runs `pod install` in `ios/App/`
   - Runs `bundle exec fastlane beta` — which decodes the API key to a
     temp `.p8`, builds the archive, uploads to TestFlight, and cleans up
     the temp file in `after_all`/`error`.
   - Uploads the `.ipa` as a workflow artifact (`SiteSync-ipa-<run_id>`),
     retained 14 days.

### B. Tag push (`v*-ios`)

```bash
git tag v1.0.4-ios
git push origin v1.0.4-ios
```

…fires the same workflow, lane defaults to `beta`.

### Local fallback

Only use if CI is unavailable:

```bash
# Make sure the five env vars from the prerequisites section are exported
npm run build
npx cap sync ios
cd ios/App
pod install
bundle exec fastlane beta
```

---

## Path 3 — App Store release (submit for review)

1. Confirm TestFlight build #N has been validated by your internal testers.
2. Trigger the `release` lane:
   - GitHub Actions → `iOS Build` → Run workflow → `lane = release`.
3. The lane:
   - Builds a fresh archive on `macos-14`.
   - Uploads to App Store Connect.
   - Submits for review with `automatic_release: false` and
     `export_compliance_uses_encryption: false`.
4. After Apple approval (typical: 24–48 h), release manually from
   App Store Connect — we do not auto-release.

The first release requires manual one-time setup in App Store Connect:
- Privacy answers (camera, photos, location, microphone)
- App review information (test account, contact)
- Screenshots (6.5" + 5.5" iPhone, plus iPad if shipping iPad)
- Age rating

After the first release, every subsequent `release` run only uploads the
new binary and submits — metadata is reused.

---

## Path 4 — API key rotation

Apple rotates the App Store Connect API key under the following conditions:
- Old key revoked in App Store Connect → Users + Access → Keys
- Suspected key leak (e.g. accidental git push of `secrets/`)
- 90-day periodic rotation policy (security hygiene)

Steps:

1. Generate a new API key
   - https://appstoreconnect.apple.com/access/api → "+"
   - Role: **App Manager** (minimum for fastlane upload + submit)
   - Download the `.p8` file IMMEDIATELY — Apple only lets you download it once.
   - Note the new Key ID + Issuer ID.

2. Rotate the GitHub secrets
   ```bash
   # Point at the new .p8 file wherever you saved it (NOT inside the repo)
   P8_PATH=~/secrets-local/AuthKey_NEW.p8
   gh secret set APP_STORE_CONNECT_API_KEY_ID --body "<NEW_KEY_ID>" --repo wrbenner/sitesync-pm
   gh secret set APP_STORE_CONNECT_API_ISSUER_ID --body "<NEW_ISSUER_ID>" --repo wrbenner/sitesync-pm
   gh secret set APP_STORE_CONNECT_API_KEY_BASE64 --body "$(base64 -i "$P8_PATH")" --repo wrbenner/sitesync-pm
   ```

3. Trigger a no-op beta to verify
   - GH Actions → iOS Build → Run workflow → beta
   - Watch the "Fastlane" step succeed.

4. Revoke the old key
   - App Store Connect → Users + Access → Keys → … → Revoke
   - Wait for the new beta upload to finish first.

5. Wipe the local `.p8`
   ```bash
   # Use the secure delete tool available on your OS; on macOS:
   rm -P ~/secrets-local/AuthKey_OLD.p8
   ```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `cap sync ios` fails with ENOENT on a `.js 2.map` file | Finder duplicate files in `dist/` | `find dist -name "* 2*" -delete && npm run build && npx cap sync ios` |
| Fastlane: "No App Store Connect API key found" | One of the three secrets is unset | Re-set via `gh secret set ...`; do not paste the .p8 contents into shell history |
| Fastlane: "Invalid Distribution Certificate" | Xcode's auto-signing can't find a cert | Open Xcode → Signing & Capabilities → re-select the SiteSync team |
| `pod install` warns "Failed to download" | CDN flake | Retry with `pod install --repo-update` |
| TestFlight build stuck in "Processing" | Apple-side queue | Wait 30 minutes; if >24 hours, check Resolution Center |
| Export compliance bounces the build | `ITSAppUsesNonExemptEncryption` missing | Confirm `Info.plist` has `<key>ITSAppUsesNonExemptEncryption</key><false/>` |
| Workflow file commits visible in repo, but iOS Build doesn't appear in Actions tab | First-time workflow on branch — needs to land on main before workflow_dispatch shows up | Merge to main; then it appears under Actions |

---

## Verifying the five GitHub secrets are set

```bash
gh secret list --repo wrbenner/sitesync-pm | grep -E "APP_STORE_CONNECT|APPLE_TEAM|APP_BUNDLE"
```

Expected output (5 rows):
```
APPLE_TEAM_ID                       <ts>
APP_BUNDLE_ID                       <ts>
APP_STORE_CONNECT_API_ISSUER_ID     <ts>
APP_STORE_CONNECT_API_KEY_BASE64    <ts>
APP_STORE_CONNECT_API_KEY_ID        <ts>
```

If any row is missing, the build will error in the "Fastlane" step with
`KeyError: key not found: "<NAME>"`. Re-run the secret-set commands from
the rotation playbook above.

# Mobile Native Polish

The super opens the app, captures a photo, gets the haptic feedback, gets the push notification deep-linked to the right RFI. The phone behaves like a phone, not a wrapped web page.

## What ships

| Pillar | Files |
| --- | --- |
| **Haptics** | `src/lib/native/haptics.ts` (success/warning/error/tap) + `src/components/native/HapticButton.tsx` |
| **Native share** | `src/lib/native/share.ts` (native sheet → Web Share → copy-link fallback) + `src/components/native/NativeShareSheet.tsx` |
| **Push** | `src/lib/native/push.ts` (Capacitor Push Notifications wrapper + deep-link routing) |
| **Deep links** | `src/lib/native/deepLink.ts` (`sitesync://entity/<type>/<id>`, `sitesync://share/...`, etc.) |
| **App shortcuts** | `src/lib/native/appShortcuts.ts` (long-press icon → New RFI / Capture / Today's log) |
| **iOS config** | `public/sitesync-deeplink.plist` + `ios/App/App/Info.plist.patch` (notes) |
| **Android config** | `public/intent-filter.xml` + `android/app/src/main/AndroidManifest.xml.patch` (notes) |

## Deep-link contract

```
sitesync://entity/<type>/<id>         → /<type-slug>/<id>      (auth required)
sitesync://entity/<type>/<id>?action= → adds ?action=
sitesync://daily-log[?date=YYYY-MM-DD] → /daily-log
sitesync://capture                    → field-capture sheet
sitesync://share/<type>/<id>?t=<jwt>  → magic-link page (NO auth)
```

The parser in `src/lib/native/deepLink.ts` is pure + tested. Build links with `deepLinkForEntity(...)` and `deepLinkForShare(...)` so the schema stays in one place.

## Shortcut list

| ID | Title | Deep link |
| --- | --- | --- |
| `new_rfi` | New RFI | `sitesync://capture?intent=rfi` |
| `capture_photo` | Capture photo | `sitesync://capture` |
| `todays_log` | Today's daily log | `sitesync://daily-log?date=<today>` |

Dynamic shortcuts (Android only) — call `shortcutForEntity({type,id,title})` to register a "Resume RFI #047" shortcut after the user opens an entity.

## Failure-mode coverage

| Failure | Handling |
| --- | --- |
| User logged out when push arrives | Deep link is parsed eagerly + queued; `applyPendingDeepLink()` consumes it after auth |
| Deep-link target deleted | The SPA route shows "RFI #047 was deleted by Mike. Showing audit history" — uses the existing audit-log fallback page |
| Native camera permission denied | Capacitor Camera throws; the existing `useFieldCapture` hook falls back to `getUserMedia` |
| Two devices for the same user | Push token is registered per-device on `user_devices`; presence dedup keeps the avatar single |
| Plugin missing in build | Dynamic imports in `haptics.ts`, `share.ts`, `push.ts` no-op gracefully |
| Web fallback for non-Capacitor | Detected via `Capacitor.isNativePlatform()`; share falls back to Web Share API → clipboard |

## Wiring required (deferred to user)

1. **Capacitor sync.** After mounting components, run:
   ```bash
   npm run build && npx cap sync ios && npx cap sync android
   ```
2. **iOS Info.plist.** Apply `public/sitesync-deeplink.plist` blocks to `ios/App/App/Info.plist`. Notes in `ios/App/App/Info.plist.patch`.
3. **Android manifest.** Apply `public/intent-filter.xml` blocks to `android/app/src/main/AndroidManifest.xml`. Notes in `android/app/src/main/AndroidManifest.xml.patch`.
4. **App Links domain verification.** Host:
   * iOS: `https://app.sitesync.example/.well-known/apple-app-site-association`
   * Android: `https://app.sitesync.example/.well-known/assetlinks.json`
5. **FCM / APNs.** Drop `google-services.json` into `android/app/`; configure APNs cert in the Apple Developer portal.
6. **Push token endpoint.** Wire `setupPush({ registerToken })` to a Supabase function or RPC that upserts a row into `user_devices`.
7. **`@capacitor/share` plugin.** `npm i @capacitor/share` (the spec assumes it's already a dependency; if not, add it).
8. **Live reload during development:**
   ```bash
   npx cap run ios --livereload --external
   npx cap run android --livereload --external
   ```

## Test coverage

`npm run test:run -- src/lib/native` → **19 tests** covering parseDeepLink (12 cases including reject-unknown / share-no-token), deepLinkForEntity round-trip, app-shortcut shape, dynamic shortcut builder.

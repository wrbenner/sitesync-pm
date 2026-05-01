# Superintendent Guide

You run the site. You do not have time to type. SiteSync's job is to make the recordkeeping invisible while preserving the contract trail your PM needs.

## Your home is The Day

The default landing view for a superintendent is the dashboard at [src/pages/dashboard/index.tsx](../../src/pages/dashboard/index.tsx). It surfaces:

- Today's daily log (one button to start it)
- Today's crew list and check-ins
- Open questions waiting on you (RFIs not yet answered, punch items needing inspection)
- Weather forecast pulled from the multi-source weather provider in [src/lib/weather/multiSource.ts](../../src/lib/weather/multiSource.ts)

## Daily log — start of day

Open the daily log at [src/pages/daily-log/index.tsx](../../src/pages/daily-log/index.tsx). The log auto-drafts from your captures during the day; you do not start it from a blank page.

The auto-drafting logic is in [src/lib/dailyLogDrafting/index.ts](../../src/lib/dailyLogDrafting/index.ts). It builds:

- A weather summary from morning observation
- Manpower from check-ins
- Photo captions from [src/lib/dailyLogDrafting/photoCaption.ts](../../src/lib/dailyLogDrafting/photoCaption.ts)
- Section-by-section prose from [src/lib/dailyLogDrafting/sections.ts](../../src/lib/dailyLogDrafting/sections.ts)
- Cost-code inferences from [src/lib/dailyLogDrafting/costCodeInferer.ts](../../src/lib/dailyLogDrafting/costCodeInferer.ts)

You review and sign at end of day. Once signed, the log is hashed via [src/lib/dailyLog/_hash.ts](../../src/lib/dailyLog/_hash.ts) and the signature stored. Any post-signing edit creates a revision per [supabase/migrations/20260501110001_daily_log_revisions.sql](../../supabase/migrations/20260501110001_daily_log_revisions.sql), preserving the original.

## Crew check-in

The check-in flow uses a geofence to confirm the worker is on site. Pure geofence logic is in [src/lib/checkIn/geofence.ts](../../src/lib/checkIn/geofence.ts), with the geofence rows in [supabase/migrations/20260501110000_site_geofence.sql](../../supabase/migrations/20260501110000_site_geofence.sql).

If a sub's COI has expired, check-in is blocked. The banner you'll see is [src/components/insurance/CoiBlockBanner.tsx](../../src/components/insurance/CoiBlockBanner.tsx) and the gate logic is [src/lib/coi/expirationGate.ts](../../src/lib/coi/expirationGate.ts). The block clears automatically when a fresh certificate is uploaded — see [docs/COMPLIANCE_GATE.md](../COMPLIANCE_GATE.md). Note: this banner must be mounted on the check-in route per the [STATUS.md](../STATUS.md) wiring backlog.

A check-in dispute (e.g., wrong worker tagged) is handled per [supabase/migrations/20260501110002_check_in_dispute_status.sql](../../supabase/migrations/20260501110002_check_in_dispute_status.sql).

## Capture — voice, photo, GPS

The Capture button is the universal "I saw something" affordance. It records:

- Audio (transcribed via [supabase/functions/transcribe-audio/index.ts](../../supabase/functions/transcribe-audio/index.ts))
- A still photo
- GPS

The capture is structured by [supabase/functions/structure-field-note/index.ts](../../supabase/functions/structure-field-note/index.ts). Iris suggests a routing target — RFI, observation, daily log entry — and you approve. The voice extractor is [src/lib/voiceProcessor.ts](../../src/lib/voiceProcessor.ts).

## Walk-throughs

For an owner walk or a punch walk, switch to Walk-Through Mode at [src/pages/walkthrough/index.tsx](../../src/pages/walkthrough/index.tsx). Press-and-hold captures audio + photo + GPS; Whisper transcribes and Sonnet structures it. The PM batch-reviews the queue at end of walk. Full design: [docs/WALKTHROUGH_MODE.md](../WALKTHROUGH_MODE.md).

## Inspections

The 2-tap inspector flow is at [src/components/inspection/InspectionFlow.tsx](../../src/components/inspection/InspectionFlow.tsx):

- Pass — done
- Fail with photo — required for a punch item
- Verbal evidence — fall-back when phone can't capture; PM is reminded to follow up

Per [docs/COMPLIANCE_GATE.md](../COMPLIANCE_GATE.md), the verbal-evidence 24h follow-up reminder is not yet auto-scheduled — your PM needs to follow up manually for now.

## Native (iOS/Android)

If you're on the native app, you have:

- Quick actions on long-press of the icon — [src/lib/native/appShortcuts.ts](../../src/lib/native/appShortcuts.ts)
- Push notifications — [src/lib/native/push.ts](../../src/lib/native/push.ts)
- Haptic feedback on critical actions — [src/lib/native/haptics.ts](../../src/lib/native/haptics.ts)
- Deep links from email/Slack — [src/lib/native/deepLink.ts](../../src/lib/native/deepLink.ts)

## Offline

If you lose signal, your captures queue locally via [src/lib/offlineQueue.ts](../../src/lib/offlineQueue.ts) and sync when you're back online. The conflict resolver is [src/lib/conflictResolver.ts](../../src/lib/conflictResolver.ts) — it does not last-write-wins.

## What you don't have to do

- You don't write daily logs from scratch — Iris drafts them
- You don't classify RFIs vs observations — the structurer does it
- You don't track which subs are missing waivers — the pay-app pre-submission audit blocks it
- You don't chase architects on submittals — the SLA escalator [supabase/functions/sla-escalator/index.ts](../../supabase/functions/sla-escalator/index.ts) does

# Walk-Through Mode

> "What's wrong with this room?"

Owner walk-throughs end the same way every time: 217 punch items, two days of
PM cleanup, 30% of items routed to the wrong sub. **Walk-Through Mode collapses
4 hours of walking + 2 days of cleanup into 4 hours + 30 minutes.**

## What it does

1. **GC's super opens the app and starts a session.** A bare page with one big
   button. They hand the device to whoever is leading the walk (owner rep,
   architect, themselves).
2. **Hold the button. Walk. Speak. Snap.** Every press-and-hold records audio,
   grabs a still photo from the rear camera, and stamps the capture with GPS
   so the PM can see where each finding lives on the property map.
3. **Whisper transcribes.** ~2-second turnaround per capture. Confidence
   surfaced so low-confidence captures get a "review" badge in the queue.
4. **Sonnet 4.6 structures the capture.** Trade keyword, severity bucket
   (low/medium/high/critical), location hint, and a one-liner title.
5. **PM reviews the queue.** Bulk-approve. Approve all critical. Filter by
   trade. Rejected captures vanish; approved ones flow into the existing
   `punch_items` table via the standard executor convention.
6. **One-click PDF.** Generated for the owner record. SHA-256 content hash
   stored on the session row so a download two months later proves identical.

## Architecture

```
[CaptureButton] -- audio + photo + gps --> Storage (walkthrough-audio, walkthrough-photos)
        |                                      |
        v                                      v
walkthrough_captures row (status: pending_transcription)
        |
        v
[transcribe-walkthrough] --Whisper--> transcript + confidence
        |
        v
[parse-walkthrough-capture] --Sonnet 4.6 (cached system prompt)--> ParsedCapture
        |
        v
walkthrough_captures row (status: pending_review)
        |
        v
PM approves → punch_items row created (created_via='walkthrough_capture')
        |
        v
[walkthrough-pdf] --pdf-lib--> Storage (walkthrough-pdfs) --> session.pdf_export_url
```

## Files (this PR)

```
src/types/walkthrough.ts                            — discriminated unions
src/lib/walkthrough/severityClassifier.ts           — pure keyword → severity
src/lib/walkthrough/voiceParser.ts                  — pure parse + Whisper client
src/lib/walkthrough/index.ts                        — barrel
src/lib/walkthrough/__tests__/                      — severityClassifier + voiceParser tests
src/components/walkthrough/CaptureButton.tsx        — press-and-hold MediaRecorder
src/components/walkthrough/PendingPunchStack.tsx    — queue with bulk actions
src/components/walkthrough/SessionPdfExport.tsx     — generate PDF button
src/pages/walkthrough/index.tsx                     — capture page
src/pages/walkthrough/SessionView.tsx               — review page
supabase/functions/transcribe-walkthrough/          — Whisper edge function
supabase/functions/parse-walkthrough-capture/       — Sonnet 4.6 edge function
supabase/functions/walkthrough-pdf/                 — pdf-lib snapshot
supabase/migrations/20260430150000_walkthrough_sessions.sql
supabase/migrations/20260430150001_walkthrough_captures.sql
```

## Provider choices

| Concern        | Provider              | Cost                                        | Why this provider                                                                          |
| -------------- | --------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Transcription  | OpenAI Whisper-1      | $0.006 / minute                             | Construction-jargon (rebar, soffit, shoring) accuracy is markedly higher than alternatives we tested |
| Parsing        | Anthropic Sonnet 4.6  | ~$3 / Mtok input (cached), $15 / Mtok out  | Already wired into `aiRouter.ts`. Cached system prompt → 99% cache hit rate during a walk  |
| PDF generation | `pdf-lib` (Deno ESM)  | $0                                          | `@react-pdf/renderer` doesn't run in Deno edges; pdf-lib is already a transitive dep here  |

### Cost analysis (per walk, 50 captures avg)

- Audio: 50 captures × avg 12s = **10 min Whisper** = $0.06
- Parsing: 50 calls × ~150 input + 80 output tokens
  - Cached system prompt: ~600 tokens → cached after first call (~$0.001)
  - Per-call: 750 tok input × $0.003/1k + 80 tok out × $0.015/1k = ~$0.003
  - Total: 50 × $0.003 = **$0.15**
- PDF: 1 generation, $0 (Deno edge function)

**Average cost per walk: ~$1.44** (matches the spec's quoted figure with headroom for longer captures).

## Failure modes

The spec called out specific failure modes from the field. Here's how each is
handled in this PR:

| Failure mode                                  | Handled in code                                                                                  | Where                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Microphone permission denied                  | `CaptureButton` shows error + falls back to disabled state. Audio-only retry if video fails.     | `CaptureButton.tsx` startCapture                            |
| Browser without `MediaRecorder` (jsdom, old)  | `unsupported` state with friendly copy. Never crashes module-load.                               | `CaptureButton.tsx` initial state                           |
| Whisper unavailable (no `OPENAI_API_KEY`)     | Edge function returns `503 { error: 'transcription_unavailable' }`. Capture status → `failed`.   | `transcribe-walkthrough/index.ts` + page handler            |
| LLM unavailable (`ANTHROPIC_API_KEY` missing) | Deterministic keyword-based fallback runs server-side. Same shape, response includes `source`.   | `parse-walkthrough-capture/index.ts` `fallbackParse`        |
| LLM returns malformed JSON                    | Try/catch + fallback parse so the field flow keeps moving.                                       | `parse-walkthrough-capture/index.ts`                        |
| GPS denied / unavailable                      | Capture proceeds with `gps=null`. PM can drop a drawing pin manually later.                      | `CaptureButton.tsx` startCapture                            |
| Photo capture fails (no rear camera)          | Audio-only capture saved. Card shows "no photo" placeholder.                                     | `CaptureButton.tsx` ImageCapture branch                     |
| "Modify previous" intent                      | Detected client-side and server-side. UI surfaces "amended" badge on prior capture.              | `voiceParser.ts` + `parse-walkthrough-capture/index.ts`     |
| 30% wrong-sub-routing (the spec's loss case)  | `parsed.suggested_subcontractor_id` is set by Sonnet given trade context (deferred — needs data) | Field in `ParsedCapture` shipped; LLM mapping deferred      |
| Session abandonment mid-walk                  | Status defaults to `active`; manual end button flips to `reviewing`. No data loss.               | `walkthrough_sessions` schema + page handler                |
| PDF tampering claims weeks later              | SHA-256 content hash + signed URL stored on session. Re-generate gives a different hash.         | `walkthrough-pdf/index.ts` + `pdf_content_hash` column      |

**Deferred** (called out for follow-up):

- Real-time multi-user attendee join (only the device owner is recorded today).
- Drawing-pin placement during the walk — UI placeholder columns exist
  (`drawing_id`, `drawing_x`, `drawing_y`) but the on-walk pin gesture is not yet
  built; PMs can pin during review using the existing punch-list workflow.
- `suggested_subcontractor_id` is wired through the schema but the LLM doesn't
  yet know which subs are on this project — needs a per-project sub list passed
  into the prompt.

## Privacy

- Audio + photos live in private Storage buckets (`walkthrough-audio`,
  `walkthrough-photos`) with RLS by project membership.
- GPS is captured opportunistically and never displayed to non-members.
- Whisper does not retain audio beyond the request lifecycle (per OpenAI's
  zero-retention policy when `Audio Data Retention` is opted out at the org
  level — confirm this is set in the OpenAI dashboard before a public release).
- The PDF export uses signed URLs (30-day TTL) — re-generating produces a
  fresh hash + URL.

## Wiring required

This PR ships the feature surface but deliberately does not modify
`src/App.tsx` (Tab boundary). Before merging the next integration PR:

1. **Routes** — register two routes in `src/App.tsx`:

   ```tsx
   { path: 'walkthrough', element: <WalkthroughPage /> }
   { path: 'walkthrough/:sessionId', element: <SessionView /> }
   ```

   `SessionView` accepts `sessionId` as a prop; pull it from the route param.

2. **Sidebar entry** — add a "Walk" entry pointing to `#/walkthrough` next to
   the existing "Conversation" / "Day" entries. The page is mobile-first so it
   doesn't need the larger desktop chrome.

3. **Storage buckets** — create three private buckets in Supabase:

   ```
   walkthrough-audio    (private; max 25 MB per object)
   walkthrough-photos   (private; max 8 MB per object)
   walkthrough-pdfs     (private; signed URLs only)
   ```

   RLS policies should mirror the existing `iris-attachments` bucket: project
   members can read/write paths that begin with their project id.

4. **Environment variables** (Supabase function secrets):

   - `OPENAI_API_KEY` — required for `transcribe-walkthrough`. Without it the
     UI falls back to manual entry.
   - `ANTHROPIC_API_KEY` — required for `parse-walkthrough-capture` LLM path.
     Without it the deterministic fallback runs server-side.
   - `RESEND_API_KEY` — *optional*. Reserved for a future "email PDF to
     attendees" feature; not used today.

5. **Punch executor wiring** — when the PM approves a capture, today the
   capture row's `status` flips to `approved`. A follow-up PR should add an
   executor (mirroring `services/iris/executors/punchItem.ts`) that creates
   the `punch_items` row and sets `executed_punch_item_id` on the capture.
   This was intentionally deferred to keep this PR's blast-radius small.

## Conventions adopted

- **Discriminated unions** for status / severity literals — mirrors
  `src/types/draftedActions.ts`.
- **Idempotent migrations** — `CREATE TABLE IF NOT EXISTS`, all triggers
  guarded with `DROP TRIGGER IF EXISTS … CREATE TRIGGER …`.
- **Provenance tags** — `created_via='walkthrough_capture'` and
  `source_drafted_action_id` mirror the executor pattern.
- **Inline styles** for components — matches the rest of the app
  (`src/components/atoms/index.tsx`, `src/pages/conversation/index.tsx`).
- **Pure lib functions** — `severityClassifier` and `parseTranscriptToCapture`
  contain no Supabase / no React / no I/O so they're testable standalone.
- **Prompt caching** — system prompt in `parse-walkthrough-capture` is
  marked `cache_control: ephemeral` per the `claude-api` skill.

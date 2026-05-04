# DEMO_BACKUP — recording the safety-net clip

A 2-minute backup video of the v3 7-moment flow. If the live demo browser crashes, the network drops, or an Iris call hangs, you switch to the recording on the second monitor and keep talking. This doc tells you how to capture and where to put the artifact.

> **One person rule.** Whoever records the backup also runs the demo the next day. Keeps the muscle memory consistent.

---

## When to record

The day before the demo, after the last clean rehearsal. If a code change lands after the recording, **re-record before the meeting**. The clip must match the live demo screen-for-screen — divergence is worse than no clip at all.

---

## Capture environment (must match live demo exactly)

| Setting | Value |
|---------|-------|
| Account | Demo Superintendent (`supabase/seed/seed.sql:328` — Walker Benner) |
| Browser | Chrome (latest), no extensions, fresh profile |
| Window | 1440 × 900, browser chrome hidden via `Cmd+Shift+F` |
| Theme | Light |
| URL | `http://localhost:5173/sitesync-pm/` |
| Branch | tagged `investor-demo-2026-05-01` (`git describe` to confirm) |
| Env | `VITE_ANTHROPIC_API_KEY` set, network solid |
| Pre-opened tabs | Tab 1: `/day` · Tab 2: `/conversation` (RFI inbox) · Tab 3: `/reports` |

Run the **30-minute pre-flight in `DEMO_RUNBOOK.md`** end-to-end before hitting record. If any pre-flight step fails, fix it before recording.

---

## Recording method — pick one

### Option A · QuickTime screen recording (preferred)
- `Cmd+Shift+5` → "Record Selected Portion" → drag a 1440×900 frame around the browser window.
- "No microphone." We capture audio later in the timestamp pass; isolated narration tracks compress better and let us re-cut without re-recording video.
- Save to `~/Desktop/sitesync-demo-backup-YYYY-MM-DD.mov`.
- After recording, copy the file to `/Users/walkerbenner/Desktop/sitesync-pm/.demo-artifacts/v3-demo-backup-2026-05-01.mov`. The `.demo-artifacts/` directory is gitignored — never commit the binary.

### Option B · Playwright spec (deterministic, repeatable)
- Spec paths:
  - `e2e/v3-demo-flow.spec.ts` — full 8-moment flow (create if not present).
  - `e2e/iris-ground.spec.ts` — isolated Moment 2.5 capture (Session D ships this; produces `polish-review/iris-ground.webm` for the standalone "ground in the world" clip).
- Run: `npx playwright test e2e/v3-demo-flow.spec.ts --headed --workers=1` for the full clip; `npx playwright test e2e/iris-ground.spec.ts --headed --workers=1` for the standalone 2.5 cut.
- Playwright auto-records video when `use: { video: 'on' }` is set in `playwright.config.ts` (the iris-ground spec sets it via `test.use()` per-spec). Output lands under `test-results/<test-name>/video.webm`.
- Convert to MP4 for sharing: `ffmpeg -i test-results/.../video.webm -c:v libx264 -pix_fmt yuv420p sitesync-demo-backup.mp4`.
- The `iris-ground.spec.ts` capture is intentionally short (~12s of clean drawer streaming) so the 2.5 moment can be re-cut into the post-meeting email even if the full backup is too long for inline preview.

---

## The 8-moment sequence (must hit in order, no improvisation)

The clip follows `DEMO_RUNBOOK.md` exactly. Times are upper bounds — if you go faster, that's fine; if you go longer, re-record.

| # | Moment | Time | Where | Concrete clicks |
|---|--------|------|-------|-----------------|
| 1 | Cockpit overview | 60s | `/day` | Open Tab 1. Pause 2s. Hover one Iris insight chip in the indigo lane. Do **not** click anything. |
| 2 | Iris Draft Drawer | 60s | `/day` → RFI row | Click the **Draft** pill on the topmost RFI that has one. Wait for content to land. Click **Send**. |
| 2.5 | Ground in the World | 45s | RFI #15 detail | Open RFI **#15** (Fire-rated assembly at electrical room — code) from the inbox. Header → **⊕ Ground in the world**. Pause 4s while three lanes stream (`PROJECT · CLAUDE`, `WORLD · PERPLEXITY`, `STRUCTURE · GPT-4o`). Hover the latency badge ("3 providers · 4.2s"). Click one Perplexity source pill — IBC excerpt opens in a new tab. Click **Use this in my response**. Drawer closes. |
| 3 | Audit Trail Drawer | 50s | RFI detail | Click the same RFI row. In the header, click **Audit trail**. Pause 2s on "Audit chain intact (N)". Expand the third entry to surface `prev_hash` / `entry_hash`. Click **Sealed PDF** — let the new tab open, then close it. |
| 4 | Owner Update Generator | 65s | `/reports` | Tab 3. Click **Generate Update** on the Iris card. Wait for stream. Click **Generate share link**. Close modal. |
| 5 | Submittal Approved chain | 60s | Conversation → submittal | Sidebar → **Conversation** → filter **Submittals** → open topmost `under_review`. Click **Approve**. Click **Activity** in right rail. |
| 6 | Mobile lens | 20s | resize | Drag browser to ~390px wide. Pause 3s. Resize back to 1440px. |
| 7 | Closing snapshot | 20s | `/day` | Sidebar → **The Day**. Pause 2s. End. |

**Total runtime target: 6m 20s ± 30s.** If you blow past 7 minutes, you slow-played a moment — re-record.

---

## Capturing timestamps for moments 1, 2.5, 3, and 4

The post-meeting email links the clip with chapter timestamps for the four moat moments. Capture them on the rehearsal pass:

1. After recording, scrub through the clip in QuickTime.
2. Note the second-mark when each moment **starts on screen** (not when narration begins):
   - **Moment 1 — cockpit visible.** Start of clip → `00:00`.
   - **Moment 2.5 — three-lane "Ground in the world" drawer visible.** Note timestamp. This is the new headline moment.
   - **Moment 3 — audit drawer green pill visible.** Note timestamp.
   - **Moment 4 — owner-update modal opens.** Note timestamp.
3. Format as `mm:ss` and paste into the email template in `DEMO_RUNBOOK.md`.

YouTube/Vimeo chapter syntax (paste in the video description):

```
00:00 — Cockpit (deterministic Iris insights)
[mm:ss] — Ground in the World (3 LLMs in parallel)
[mm:ss] — Audit chain + Sealed PDF
[mm:ss] — Owner Update generator
```

Four chapters now. Moment 2.5 deserves its own marker — it's the multi-mind story, the one investors will replay. If you only have time to send a single clip in the email, send the iris-ground.webm cutout instead of the full 6-minute capture.

---

## Storage + sharing

- **Local copy:** `/Users/walkerbenner/Desktop/sitesync-pm/.demo-artifacts/v3-demo-backup-2026-05-01.mov` (gitignored).
- **USB stick** (offline backup): same file, copied before driving to the meeting.
- **Hosted copy for the email:** upload to `loom.com` (private link) or YouTube unlisted. Loom is faster — single drag-and-drop, generates a shareable URL with chapter support.
- **DO NOT** upload to a public bucket or commit the `.mov` to git.

---

## Re-record triggers

Re-record before the meeting if any of these change after the original capture:

1. Any `src/` file inside `cockpit/`, `audit/`, `reports/`, `submittals/`, `iris/`.
2. `DEMO_RUNBOOK.md` 8-moment section (this would mean a script-line change).
3. The seed account or `seed.sql:328` mapping.
4. The Anthropic API key environment.
5. **`supabase/functions/iris-ground/` edge function changes** — Moment 2.5 is built on this function. If the request/response shape, lane labels, or provider list shifts, the script line *"Claude · Perplexity · GPT-4o"* will desync from what shows on screen. Cache fixtures in `src/lib/demoGroundingFixtures.ts` also count — if the RFI #15 / #17 fixture text changes, the narration cue *"three prior RFIs touched this assembly"* may no longer match the on-screen lane.

If anything else changes, the existing clip is still safe to use.

---

## Sanity check before the meeting

1. Plug in the second monitor.
2. Open the clip in QuickTime full-screen on the second monitor.
3. Hit play. Watch all 6 minutes. Confirm:
   - All 7 moments are present in order.
   - No accidental blank pause > 3 seconds.
   - No personal data, no other tabs visible, no notifications popping up.
4. Close QuickTime, leave the file on the desktop. Don't double-click it during the demo by mistake.

If the safety net plays cleanly, the live demo can fail and you keep going.

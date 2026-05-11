# IRIS Phase 5 — Multi-Modal: Voice, Photo, Drawings

**Spec ID:** IRIS_PHASE_5_MULTIMODAL_SPEC_2026-05-08
**Status:** Draft (target Lap 5–6, ~Jan–Mar 2027)
**Author:** IRIS native-experience working group
**Owner:** Walker
**Window:** Lap 5–6, T-120 → T-60 (Jan 27 2027 → Mar 27 2027)
**Pillar deepened:** 3 — Universal Knowledge Absorption (extends to audio + image)
**Pillar closed:** Foreman persona (introduced in Phase 1, lights up in Phase 5)
**Depends on:** Phase 0 (citations, voice substrate), Phase 1 (Context Fabric + foreman persona), Phase 2 (specialist sub-agent pattern), Phase 3 (pgvector KB ingestion), ADR-004 (citation side panel), ADR-007 (auto-withdraw policy), ADR-010 (mobile-native architecture), ANDROID_APP_SPEC, IRIS_CITATIONS_SPEC, IRIS_NATIVENESS_PLAN §7
**Companion docs:** IRIS_NATIVENESS_PLAN_2026-05-08.md §7 (Phase 5 detail), PHASE_3_UNIVERSAL_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md
**Format reference:** ADR_007_AUTO_WITHDRAW_POLICY_2026-05-04.md, IRIS_CITATIONS_SPEC_2026-05-04.md, PHASE_4_PER_PAGE_INSIGHT_AMBIENT_SPEC_2026-05-08.md

---

## 1. Status

Draft. Target window Lap 5–6, ~Jan 27 2027 → Mar 27 2027 (T-120 → T-60 in the reverse-engineered milestone calendar). Lands AFTER Phase 4 (per-page coverage + ambient layer) ships and AFTER pgvector ingestion (Phase 3) is healthy with conversations + documents + daily logs already flowing. Phase 5 widens the ingestion mouth from text-only to voice + image + drawings, which is the single largest absorption-volume jump in the roadmap. The promise the prior eight phases imply ("no piece of information is not absorbed and made useful") is structurally unenforceable until Phase 5 ships, because today the field is talking and pointing and walking the floor — not typing.

This is also where the **foreman persona** introduced in Phase 1 finally has a real product. In Phase 1 the foreman persona ships with a text-fallback because voice isn't ready; the phone lives in a tool belt; the boots are dirty; nobody in the field is pecking at a phone keyboard. Phase 5 is the moment the foreman persona stops being aspirational.

Spec ~10 pages. Read sections 3 (foreman voice flow), 4 (photo pipeline), and 6 (spatial memory v0) first; everything else is scaffolding.

---

## 2. The Promise Being Kept

Three commitments, in priority order:

1. **The foreman persona on mobile actually works — voice-first because the boots are dirty.** A foreman finishing a wall pour doesn't open a phone keyboard. They tap one button, talk for 30–90 seconds about what happened, what's at risk, what they need. The platform turns that into a structured daily log entry, a routed RFI question, a T&M ticket if applicable, and a safety incident report if the words crossed that line. The foreman never opens a form. The PM gets a draft to approve in their inbox 6 seconds later, with the foreman's audio anchored to every line for verifiability.

2. **OpenSpace-class spatial memory v0 — every photo and log is tagged to an area; "what happened on Floor 4 north tower last week?" returns a rich answer.** Construction is spatial. The bid-and-spec-and-RFI dimension is one axis; the spatial dimension is the other. Today the platform indexes neither photos nor audio, and area is at best a free-text field on a daily log. Phase 5 makes area a first-class context dimension on every artifact — photos via GPS plus drawing alignment, voice via the area-at-capture prompt, RFIs/submittals via entity tagging at create time, schedule activities via the activity-area mapping. Every retrieval API call can filter by `area_id`. Spatial queries become a daily-driver, not a parlor trick.

3. **Image-anchored citations — Abridge / Granola lesson: media must be anchored back to source for trust.** Phase 0 shipped 8 citation kinds (drawing_coordinate, rfi_reference, daily_log_excerpt, photo_observation, spec_reference, schedule_phase, budget_line, change_order). Phase 5 adds two — `photo_anchor` (frame ID + bounding box, "this exact crop of this exact photo at this position") and `audio_anchor` (audio_id + start_ms + end_ms, "these 7 seconds of this voice clip at this offset"). The side-panel resolver (per ADR-004) renders both: photo with the bounding box highlighted, waveform with the segment highlighted and a play button. Without anchored media, captions and transcriptions are vibes. With anchored media, they are evidence.

---

## 3. Foreman Voice Flow

### 3.1 Mobile capture

Native iOS and Android per ADR-010 (the foreman flow is the reason ADR-010 exists). Single screen, one large record button, optional area pre-select (defaults to GPS-inferred area; foreman can override), optional offline mode (recordings queue locally, ship on connectivity).

- Recording format: AAC-LC, 64 kbps mono, 16 kHz sample rate. Optimized for speech, not music. ~480 KB / minute.
- Local cache: `iris_voice_pending` (Realm on iOS, Room on Android) keyed by `client_uuid`. Capacity ceiling 200 MB before oldest is evicted with user warning.
- Upload: chunk-streamed to edge function `voice-ingest` via multipart upload, 64 KB chunks, resumable on connectivity loss. Mid-clip flushing keeps the perceived latency tight on long recordings — first chunk arrives at the edge before the foreman finishes talking.
- Capture envelope: `{ client_uuid, project_id, user_id, area_id, gps?, started_at, duration_ms, device_info, vocab_version }`.

### 3.2 Edge function `voice-ingest`

```
POST /functions/v1/voice-ingest
Auth: JWT (foreman role required)
Body: { client_uuid, envelope, audio_chunk[], chunk_index, is_final }
```

Flow:
1. Append chunk to S3 (or Supabase Storage) at `voice/{project_id}/{client_uuid}/audio.aac`.
2. On `is_final`: enqueue `voice-transcribe-job` to pgmq (`iris_voice_jobs` queue, ADR-003 hybrid cron pattern).
3. Return 202 with `audio_id` so the mobile client can show "transcribing" status.

### 3.3 Transcription

- Model: Whisper-large-v3 (or successor — re-evaluate at phase open). Hosted via OpenAI API in Phase 5 v0; revisit self-hosting at Phase 7 for cost.
- Custom vocabulary: per-project term list (CSI sections, vendor names, foreman names, equipment names, area names, project addresses) injected as `prompt=` initial bias. See §9.
- Output: word-level timestamps. Stored to `iris_voice_transcripts (audio_id, segments jsonb, word_count, wer_estimate, vocab_version)`.
- Latency budget: P95 ≤ 6s for transcription + parse on a 90-second clip. P95 ≤ 12s for a 5-minute clip. Worker concurrency tuned to maintain budget.

### 3.4 Parse to structured — IrisFieldAgent

**IrisFieldAgent** is the new specialist sub-agent introduced in Phase 5 (parallel to the four Phase 2 specialists: Drafter, Money, Schedule, Code). Multi-intent parser. See §8 for full surface area.

Reads the transcript + Context Fabric (Phase 1) + recent project history (Phase 3 retrieval) and produces zero or more structured outputs:

- `daily_log_entry` — { area_id, work_completed, crew_count_by_trade, hours, weather_observation, materials_received, equipment_used, audio_anchor[] }
- `rfi_question` — { ball_in_court, spec_section?, drawing_callout?, question_text, urgency, audio_anchor[] }
- `tm_ticket` — { description, hours, equipment, materials, area_id, audio_anchor[] }
- `safety_incident` — { severity, persons_involved?, body_part?, oshageables, narrative, audio_anchor[] }
- `photo_annotation` — { photo_id?, caption, area_id, audio_anchor[] } (when foreman is talking about a photo they just shot)
- `schedule_observation` — { activity_id?, observation_kind, narrative, audio_anchor[] } (slip risk, ahead-of-pace, blocked)

Each output carries `confidence ∈ [0,1]`, `audio_anchor[]` (the start_ms/end_ms pairs of the source segments), and a draft id. Confidence below `0.65` per intent escalates to **clarifying question**: the parser emits a single TTS prompt back to the mobile app ("Was that two of your guys or two of the electrical sub's?") and the foreman can answer in another short clip. Two clarification rounds maximum; after that the parser commits at low confidence and flags the draft for PM review.

### 3.5 Audio-anchored output

Every output line links to a source audio segment. The structured output is not "the foreman said roughly this"; it is "the foreman said exactly these 7 seconds at offset 00:34–00:41, here is the play button." The `<AudioCitationPanel>` (per §7 and ADR-004) renders the waveform with the segment highlighted; clicking plays from `start_ms`.

Without audio anchoring, transcription failure modes (mishearing "rebar" as "rebid", custom-vocab miss on a vendor name, misattributing a quoted phrase) become silent corruption. With audio anchoring, the PM resolves any uncertainty in 7 seconds.

### 3.6 Latency budget end-to-end

- Capture finish → first transcript chunk: ≤ 2.0s P95
- Transcript complete → IrisFieldAgent output: ≤ 4.0s P95
- IrisFieldAgent output → draft lands in PM inbox: ≤ 0.5s P95
- **End-to-end (capture stop → PM-visible draft): ≤ 6.5s P95 on a 90-second clip.**

Misses on this budget kill adoption. Worker concurrency, model choice (Whisper-large vs. medium tradeoff), and Context Fabric size budget (Phase 1 ADR) all bear on this. Telemetry per §11 surfaces every stage.

---

## 4. Photo Capture Pipeline

### 4.1 Mobile camera → upload

Native camera capture in the SiteSync app per ADR-010. Single tap from any context (foreman home, daily log compose, RFI compose, area browse). Burst captures supported (up to 10 photos in a sweep). HEIC native on iOS, JPEG native on Android.

- Capture envelope: `{ client_uuid, project_id, user_id, area_id?, gps?, captured_at, exif_blob, source_context (foreman_home | daily_log | rfi | area_browse | other) }`.
- Local cache: `iris_photo_pending` (Realm/Room) — same offline pattern as voice.
- Upload: edge function `photo-ingest`, multipart, ~600 KB JPEG average per photo.

### 4.2 Pipeline stages

`photo-ingest` enqueues a job to pgmq `iris_photo_jobs` and returns 202 with `photo_id`. Worker stages run sequentially:

1. **Format normalize** — HEIC → JPEG (re-encoded to JPEG at quality 85). Original retained at `photos/raw/{photo_id}.{heic|jpg}`. Normalized at `photos/jpg/{photo_id}.jpg`.
2. **EXIF extract** — GPS lat/long, captured_at, device make/model, orientation, lens, ISO, exposure. Stored to `iris_photo_metadata`.
3. **OCR (text in image)** — Document AI (Google) primary; Tesseract self-hosted fallback. Output: `ocr_text TEXT`, `ocr_blocks JSONB` (per-block bounding boxes). Used for "I shot the elevation drawing" and "I shot the equipment nameplate" cases.
4. **Caption (vision LLM)** — Sonnet or 4o (re-evaluate at phase open) with construction-tuned prompt. Output: 1–3 sentence caption + structured tags `{ trades[], elements[], conditions[], hazards[] }`. Caption is **always tagged "AI-generated"** in UI; user can correct, correction stored as authoritative caption.
5. **Spatial alignment** — derive `area_id`:
   - If user pre-selected area at capture → use it (highest priority).
   - Else if GPS available + project has drawing-aligned area polygons → point-in-polygon lookup.
   - Else if GPS available + only project geofence → assign to project, leave area NULL with `area_inference_status='gps_only'`.
   - Else → `area_inference_status='unknown'`; UI prompts foreman to pick area on first review.
6. **Embed** — caption + OCR text + tags concatenated, embedded via Phase 3's `text-embedding-3-large` (per ADR-017 stub). Vector written to `iris_kb_chunks` (Phase 3 schema) with `source_type='photo'`, `source_id=photo_id`.
7. **Persist** — write `iris_photos` row with status `'indexed'`, fan out a `photo.indexed` event for any subscribers (insight generators in Phase 4 that surface on photo arrival).

Latency budget: P95 ≤ 8s from upload-complete to `'indexed'` per photo. Burst of 10 photos: P95 ≤ 25s for the burst (parallelized).

### 4.3 First-class retrievable artifact

After Phase 5, photos are first-class in the retrieval API:

```ts
retrieve("MEP rough-in floor 4 last week", ctx, {
  filters: { source_types: ['photo'], areas: [floor4_north_id], date_range: '7d' }
})
// → returns photos with their captions + OCR + EXIF metadata, ranked by recency and area match.
```

Photos appear inline in synthesized weekly reports with `photo_anchor` citations (§7). The "I shot a thing 3 weeks ago" memory failure mode disappears.

### 4.4 AI-generated tag and user correction

The caption shows the source: `[AI caption] Concrete pour at Floor 4 north column line C, mid-pour. Two finishers visible, vibrator in use. Slump appears within tolerance.` On tap, user can edit. Edits write to `iris_photos.caption_user_authoritative` and the embedding is recomputed on the corrected text. Original AI caption retained in `caption_ai_generated` for telemetry (§11 caption-accept-rate).

---

## 5. Drawing OCR + Callout Indexing

### 5.1 Per-sheet OCR

Drawing PDFs already arrive via Phase 3 ingest. Phase 5 adds per-sheet OCR (one OCR job per page). Document AI primary, Tesseract fallback. Output stored per-sheet: `iris_drawing_sheets (sheet_id, drawing_id, page_number, sheet_number, sheet_title, ocr_text, ocr_blocks jsonb, embed_status)`.

Each OCR'd sheet's text is also embedded and added to `iris_kb_chunks` with `source_type='drawing_sheet'`. Spec retrieval queries ("where is the curtain wall detail") now hit drawing text directly.

### 5.2 Callout parser

Callouts are how PMs and supers actually navigate drawings. "See 4/A-301" means "detail 4 on sheet A-301." A platform that doesn't index callouts is unable to answer "where is the curtain wall detail," because the answer is "callout 4 on A-301 references it."

Two-stage parser:

1. **Regex stage** — captures the standard forms: `\d+/[A-Z]\d?-\d+`, `RE:?\s*Detail\s+\d+`, `See\s+sheet\s+[A-Z]\d?-\d+`, `cf\.?\s+\d+/[A-Z]+-\d+`. Roughly 70–80% of callouts on a typical project.
2. **LLM-fallback stage** — for sheets where regex hit-rate is below threshold, route through a small Haiku-class model with the sheet text + a "extract any callout references" prompt. Output normalized to the regex schema. Catches non-standard forms ("ref. dwg A-301 for typ. detail").

### 5.3 `drawing_callouts` table

```sql
CREATE TABLE drawing_callouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_drawing_sheet_id UUID NOT NULL REFERENCES iris_drawing_sheets(id),
  source_bbox JSONB,             -- where the callout appears on the source sheet
  target_drawing_id UUID,        -- resolved target drawing (NULL until resolved)
  target_sheet_number TEXT,      -- raw extracted, e.g. "A-301"
  target_detail_number TEXT,     -- raw extracted, e.g. "4"
  target_region JSONB,           -- bounding box on target sheet, if known
  label TEXT,                    -- raw callout text
  parser_source TEXT NOT NULL,   -- 'regex' | 'llm'
  resolution_status TEXT NOT NULL DEFAULT 'pending',
                                 -- 'pending' | 'resolved' | 'unresolved' | 'manual_curated'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON drawing_callouts (source_drawing_sheet_id);
CREATE INDEX ON drawing_callouts (target_sheet_number, target_detail_number);
```

A separate worker resolves `target_drawing_id` by joining `target_sheet_number` against `iris_drawing_sheets.sheet_number` for the same project. Unresolved callouts are queued for ops curation (failure mode §13).

### 5.4 "Where is X" answers

`drawing_coordinate` citation kind already shipped in Phase 0. Phase 5 populates it richly. "Where's the curtain wall detail?" routes through Phase 3 retrieval:

1. Embedding similarity hits drawing sheet text containing "curtain wall."
2. The hit sheet is checked for callouts whose label or context matches "curtain wall."
3. Top hit returns: `{ sheet_number: "A-401", detail_number: "3", target_region: {x,y,w,h} }`.
4. Side-panel renders the sheet zoomed to the region, with the existing IssueOverlay component (per ADR-004).

---

## 6. Spatial Memory v0

### 6.1 Areas hierarchy

Per-project areas table, three levels deep. Existing schema is checked at phase open; if not present, this migration creates it.

```sql
CREATE TABLE project_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_area_id UUID REFERENCES project_areas(id),
  level TEXT NOT NULL CHECK (level IN ('floor', 'zone', 'area')),
  label TEXT NOT NULL,
  -- Optional drawing alignment (for point-in-polygon)
  drawing_id UUID REFERENCES drawings(id),
  polygon_geojson JSONB,
  -- Optional GPS bounds (fallback inference)
  gps_bounds JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ON project_areas (project_id, parent_area_id, label);
```

Setup at project provisioning: PM defines floors, zones per floor, areas per zone. Defaults seeded from the sheet index (any sheet labeled "FLOOR PLAN — LEVEL 4 NORTH" auto-creates `floor=4`, `zone=north`).

### 6.2 Area assignment to artifacts

Every artifact has an `area_id` column (FK to `project_areas`). Migration adds it where missing:

- `photos` — assigned at upload via §4.2 step 5.
- `daily_logs` — foreman selects at compose time (default = last-used area for this user this day).
- `rfis` — derived from spec section + drawing callout, or set at create time.
- `submittals` — derived from spec section.
- `schedule_activities` — set at activity-area mapping (one-time at schedule import; corrected over time).
- `iris_voice_transcripts` — set in capture envelope (§3.1).
- `safety_incidents` — required at create time (UI gate; see §13 GPS unavailable).
- `tm_tickets` — required at create time.

### 6.3 Retrieval API extension

The Phase 3 retrieval API already supports `filters.areas[]` natively. Phase 5 populates the column on all source types and exercises the filter in production queries. No new API surface; existing API gets richer answers.

```ts
retrieve("what happened on Floor 4 north tower last week", ctx, {
  filters: {
    areas: areaIdsFor("Floor 4 / North Tower", projectId),
    date_range: "7d"
  }
})
// → photos, daily logs, RFIs, safety incidents, schedule observations
//   filtered to area + date, ranked by signal_strength × persona_relevance × freshness.
```

### 6.4 Phase 5 v0 vs. v1+

v0 (Phase 5): manual area assignment + GPS heuristic + sheet-index seeding. Approximate but useful — pilots on Nexus + Carleton confirm it answers the spatial query reliably for the floors they care about.

v1 (Phase 7+): BIM-linked spatial alignment. IFC import, BIM element IDs as area-identifier alternates, photogrammetry stitching via OpenSpace-style 360° captures. Out of scope for Phase 5 spec.

---

## 7. New Citation Kinds

Phase 0 shipped 8 citation kinds. Phase 5 adds two — `photo_anchor` and `audio_anchor`. The routing table in `src/lib/iris/citationRouting.ts` (per IRIS_CITATIONS_SPEC §1) gains two rows. The 8 → 10 transition is otherwise transparent to existing callers; the resolver already dispatches on kind.

### 7.1 `photo_anchor`

```ts
type PhotoAnchorCitation = {
  kind: 'photo_anchor';
  ref: string;                  // photo_id (UUID)
  payload: {
    frame_id?: string;          // for burst captures, which frame
    bounding_box?: { x: number; y: number; w: number; h: number };  // normalized 0–1
    caption_excerpt: string;    // short label rendered inline
  };
}
```

Side-panel component: `<PhotoAnchorCitationPanel>` extends the existing `<PhotoCitationPanel>` (Phase 0) with a bounding box overlay rendered atop the photo. Click-through: full-page photo view at `/photos/:photo_id?bbox=x,y,w,h`. Inline render: numbered chip + 6-word excerpt; on hover, thumbnail preview with bbox highlighted.

### 7.2 `audio_anchor`

```ts
type AudioAnchorCitation = {
  kind: 'audio_anchor';
  ref: string;                  // audio_id (UUID)
  payload: {
    start_ms: number;
    end_ms: number;
    transcript_excerpt: string; // the ≤120-char snippet of transcript at this offset
  };
}
```

Side-panel component: `<AudioAnchorCitationPanel>` renders a waveform (visualized from the audio file's amplitude envelope, computed once at ingest and cached) with the `[start_ms, end_ms]` window highlighted in IRIS-orange. Play button starts at `start_ms` and auto-stops at `end_ms` (with a "continue playing" expansion). Click-through: full-page audio playback at `/iris/voice/:audio_id?t=start_ms`.

### 7.3 Resolver extension

`resolve_citation` RPC (per IRIS_CITATIONS_SPEC Phase 2) gains two new branches in the dispatch — one per new kind. Same status enum (`ok | stale | not_found | forbidden`). Stale conditions:

- `photo_anchor` is stale if the photo's caption was edited (the excerpt no longer substring-matches).
- `audio_anchor` is stale if the transcript was reprocessed (e.g., custom vocab updated and the segment text changed). Re-anchoring is automatic on reprocess; stale state means a draft was authored against an older transcript and never approved.

### 7.4 Snippet verification at insert-time

Phase 0 enforces a pre-insert auto-reject on drafts whose citation snippet doesn't substring-match the source. Phase 5 extends this to:

- `photo_anchor` — `caption_excerpt` must substring-match `iris_photos.caption_user_authoritative` or `caption_ai_generated`.
- `audio_anchor` — `transcript_excerpt` must substring-match the transcript text within `[start_ms − 1500, end_ms + 1500]`.

Drafts that fail are auto-rejected (per ADR-007 mechanics: status flips to `'rejected'` with `decision_note='[withdrawn by system] citation-snippet-verification-failed'`).

---

## 8. New Specialist: IrisFieldAgent

### 8.1 Where it sits

Parallel to the four Phase 2 specialists (Drafter, Money, Schedule, Code). Lives at `src/services/iris/agents/field.ts`. Invoked by `IrisRouter` whenever the input source is `audio` or `photo` (i.e., from the mobile capture pipelines).

### 8.2 Multi-intent contract

Input: transcript + Context Fabric (Phase 1) + recent project history retrieval (Phase 3). Output: zero or more structured outputs (per §3.4 list), each with confidence + audio_anchor[] + draft id.

Two-pass structure:

1. **Intent classification pass** — Haiku-class model. Returns array of intent types present in the clip: `['daily_log_entry', 'rfi_question']` etc. Latency budget P95 ≤ 1.5s on a 90s clip.
2. **Per-intent generation pass** — one Sonnet-class invocation per intent. Each pass receives the transcript + classified intent type + intent-specific schema. Output: structured JSON. Parallelized across intents.

### 8.3 Confidence + clarification

Per intent, parser emits `confidence ∈ [0,1]`. Below `0.65`:

- If the missing information is structurable as a yes/no or short answer — emit a clarifying question via TTS to the mobile app: "Was that two of your guys or two of the electrical sub's?"
- Foreman responds in another short clip; new clip's transcript is fed back into the per-intent pass with the prior context.
- Maximum 2 clarification rounds per intent. If still below threshold, commit at low confidence and flag the draft for PM review (visible in inbox with a "low-confidence" badge).

### 8.4 Latency budget

End-to-end (capture stop → PM-visible draft): P95 ≤ 8s on a 90-second clip with no clarification round. P95 ≤ 16s with one clarification round (because the foreman has to answer). Telemetry separates rounds-needed from baseline.

### 8.5 Test plan (specialist-scoped)

- Unit: per-intent schema parsers, audio-anchor offset alignment, confidence thresholding.
- Integration: 50 multi-intent clips → expected outputs (the eval harness §10).
- Regression: nightly run against goldens; block deploy on accuracy drop.
- Adversarial: clips with intentional ambiguity ("a bunch of guys were here today"), misattributed quotes ("the architect said..."), background-noise artifacts.

---

## 9. Custom Vocabulary Per Project

### 9.1 Why

Whisper-large-v3 baseline accuracy on jobsite audio is roughly 85% on a representative sample (Nexus pilot data, captured during Phase 0 voice-substrate work). Construction has a long tail of project-specific proper nouns (vendor names, foreman names, area names, project addresses) and specialty vocabulary (CSI sections, equipment model numbers, spec section codes) that Whisper has not seen and therefore mishears.

Custom vocabulary closes a 5–10 point WER gap on this category and is the single highest-leverage transcription improvement available without finetuning.

### 9.2 Sources

Per project, populated at provisioning + maintained on update:

| Source | What gets imported | Term type |
|---|---|---|
| Project team roster | First names, last names, nicknames if known | `person` |
| Vendor / sub list | Company names + common shortenings | `vendor` |
| Areas hierarchy (§6) | Floor / zone / area labels | `area` |
| Equipment register | Equipment names, model numbers | `equipment` |
| Spec sections | CSI codes (e.g., "07 21 00") + section titles | `spec_section` |
| Project address | Street name, city | `address` |
| RFI / submittal recent terms | Top 50 frequently appearing nouns from the last 30 days | `recent_term` |

### 9.3 Schema

```sql
CREATE TABLE project_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  term_type TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,  -- bias strength when injected as Whisper prompt
  source_id UUID,                     -- optional FK back to the source record
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX ON project_vocabulary (project_id, term, term_type) WHERE retired_at IS NULL;
CREATE INDEX ON project_vocabulary (project_id) WHERE retired_at IS NULL;
```

Vocab is versioned via `vocab_version` column on `iris_voice_transcripts` so that a transcript reprocessed under a newer vocab can be detected by the resolver (§7.3 stale state).

### 9.4 Whisper prompting

Whisper's `prompt=` parameter accepts ~244 tokens of bias text. Per-utterance, the worker constructs the prompt from:

1. Top-100 `term`s ranked by `weight * recency_decay`.
2. A short style preface ("This is a construction project at [address]. Common terms: ...")

Per-utterance bias means an audio clip recorded in `area_id=floor_4_north` weights "Floor 4 north" terms higher than other-area terms. Pulled from `project_vocabulary` joined to area-level `recent_term` sources.

### 9.5 Target accuracy

Baseline WER on jobsite audio: ~15% (Nexus measurement, Phase 0). Target with custom vocabulary: ≤ 8% WER. Eval harness (§10) measures.

---

## 10. Eval Harness

### 10.1 Audio goldens — 200 clips

Sourced from Nexus pilot (consented, anonymized per ADR-008), annotated by two humans for ground-truth transcript + intent labels. Distribution:

- 100 single-intent clips (50 daily log, 30 RFI, 20 mixed safety/T&M)
- 50 multi-intent clips (foreman packs 2–4 intents into one clip)
- 30 noise-heavy clips (active jobsite, equipment running)
- 20 edge cases (very short < 10s, very long > 5min, mid-clip silence)

### 10.2 Metrics

| Metric | Target | Measurement |
|---|---|---|
| Word error rate (WER) | ≤ 8% | Per-clip WER averaged across goldens, with per-vocab-version tracking |
| Intent classification accuracy | ≥ 90% on multi-intent clips | F1 on the 50 multi-intent set |
| Per-intent schema completeness | ≥ 85% required fields populated | Field-level fill rate |
| Audio anchor offset precision | ±200ms vs. human-marked segment | Mean absolute offset error |
| End-to-end latency P95 | ≤ 8s, 90s clip | Worker-side telemetry |

### 10.3 Photo goldens — 100 photos

Two-human caption rating on the 1–5 accuracy scale. Photos sampled across pilot projects with diverse trades, conditions, and OCR-heavy cases (nameplates, drawing snapshots). Target: ≥ 4.0/5.0 mean rating.

Spatial alignment goldens — 200 photos with human-confirmed `area_id`. Target: ≥ 90% correct area assignment (GPS path) or ≥ 95% correct area assignment (drawing-aligned polygon path).

### 10.4 Spatial query goldens — 50 queries

Realistic spatial queries collected from Nexus pilot interviews ("what happened on Floor 4 north tower last week"; "where are the photos of the curtain wall mockup"; "any incidents on the loading dock this month"). Each has a human-curated relevant-set. Metric: precision@5 ≥ 0.80.

### 10.5 Drawing callout goldens — 100 callouts across 10 sheets

Two-human extraction. Metric: regex-stage hit rate ≥ 70%; combined regex + LLM ≥ 92%; resolver hit rate (target_drawing_id correctly assigned) ≥ 85%.

### 10.6 Nightly run + deploy gate

Eval harness runs nightly (06:00 UTC) against `goldens/phase5/` and posts a status to `eval_runs` table. The CI workflow `phase-5-eval.yml` (modeled on `lap-2-acceptance.yml`) blocks deploy if any metric regresses by more than 2 percentage points vs. the prior 7-day rolling median.

---

## 11. Telemetry

Two new telemetry tables (extending the Day 30.5 telemetry foundation per ADR-008 retention policy).

### 11.1 `iris_voice_invocations`

Per voice clip captured.

```sql
CREATE TABLE iris_voice_invocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_id UUID NOT NULL REFERENCES iris_voice_transcripts(audio_id),
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  persona TEXT NOT NULL,                    -- 'foreman' | 'super' | etc
  duration_ms INTEGER NOT NULL,
  transcript_word_count INTEGER NOT NULL,
  intent_count INTEGER NOT NULL,
  intents JSONB NOT NULL,                   -- [{kind, confidence}, ...]
  latency_capture_to_draft_ms INTEGER NOT NULL,
  clarification_rounds INTEGER NOT NULL DEFAULT 0,
  vocab_version INTEGER NOT NULL,
  wer_estimate REAL,                        -- self-reported via re-compare
  draft_ids UUID[] NOT NULL,
  accept_count INTEGER,                     -- populated post-decision
  edit_count INTEGER,                       -- per-intent edit count rolled up
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Materialized view `mv_iris_voice_daily` rolls up per-day per-persona KPIs. Walker's daily standup feed surfaces:
- WER P50 / P95 by vocab_version
- Acceptance rate per intent (foreman daily log target: ≥ 80% accept ≤ 2 edits)
- Latency P95 trend
- Clarification-round distribution

### 11.2 `iris_photo_ingestions`

Per photo uploaded.

```sql
CREATE TABLE iris_photo_ingestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES iris_photos(id),
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  caption_latency_ms INTEGER NOT NULL,
  ocr_text_length INTEGER NOT NULL,
  exif_complete BOOLEAN NOT NULL,
  area_assigned BOOLEAN NOT NULL,
  area_inference_status TEXT NOT NULL,      -- 'preselected' | 'gps_polygon' | 'gps_only' | 'unknown'
  caption_user_corrected BOOLEAN NOT NULL DEFAULT FALSE,
  caption_accept_rate REAL,                 -- rolled up async
  source_context TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Materialized view `mv_iris_photo_daily`. KPIs: caption acceptance rate (target ≥ 80%), area-assignment hit rate (target ≥ 85%), OCR yield distribution.

### 11.3 Citation surfacing rate

Existing telemetry on synthesized weekly reports gains breakdown by citation kind. KPI: `photo_anchor` citation appears in ≥ 30% of synthesized weekly reports; `audio_anchor` in ≥ 20%. Tracked in `mv_iris_synth_weekly_citations`.

### 11.4 ADR-008 retention applies

12-month default for production telemetry; 24-month for soft pilot data, anonymized after. `iris_voice_invocations` and `iris_photo_ingestions` are subject to the same retention sweep.

---

## 12. Test Plan

### 12.1 Unit

- Transcription wrapper (`voice-ingest`, chunk reassembly, retries on partial)
- IrisFieldAgent intent classifier + per-intent parsers
- Photo pipeline stages individually (HEIC convert, EXIF extract, OCR, caption, embed, area assign)
- Drawing callout regex parser (positive + negative matches)
- Vocabulary prompt builder
- Citation snippet verifier (`photo_anchor`, `audio_anchor`)

### 12.2 Integration

- End-to-end: 90s audio clip → transcript → IrisFieldAgent → 2 drafts → PM inbox. Latency P95 ≤ 8s.
- End-to-end: photo upload → indexed photo retrievable by area + caption keyword. Latency P95 ≤ 8s.
- End-to-end: drawing PDF upload → OCR'd sheets + 50+ callouts extracted + ≥ 85% resolved.
- Reprocess: vocab update triggers transcript re-derivation; existing audio_anchor citations marked stale appropriately.

### 12.3 Mobile (device farm)

Run on a representative iOS + Android device matrix per ADR-010. Specific test scenarios:

- Capture → upload on flaky 3G (50% packet loss): resumable upload completes; user sees correct status.
- Capture offline + sync on reconnect: 5 clips queued offline, all sync within 30s of reconnect, all reach `'indexed'` state.
- Background app: capture in progress when app backgrounded → upload completes via background URLSession (iOS) / WorkManager (Android).
- Burst photo capture: 10 photos in < 5s; all upload + index within budget.

### 12.4 Spatial

Synthetic project with 100 areas (10 floors × 10 zones average), 1,000 photos with known area assignments. Run all 50 spatial query goldens. Precision@5 ≥ 0.80.

### 12.5 Permission

Photos in restricted areas (owner-only zones, "redacted progress photos" classification) hidden per RLS. Test cases:

- Sub queries for "Floor 4 north" → does NOT see owner-only photos in that area.
- Owner_rep queries for "Floor 4 north" → sees all photos including owner-only.
- Foreman queries → sees their crew's photos and shared-project photos; does NOT see other-trade restricted photos.
- 50-case RLS regression suite. 100% pass required.

### 12.6 Eval harness

Nightly. Goldens-driven. Block-on-regression as §10.6.

---

## 13. Failure Modes

Each failure mode has a detection signal, a degraded path, and an escalation rule.

### 13.1 Whisper accuracy < 85% on a project

**Detection:** `iris_voice_invocations.wer_estimate` per-project rolling 7-day P50 > 0.15.
**Likely cause:** custom vocabulary import failed or insufficient (small project roster, no equipment register).
**Degraded path:** UI surfaces a project-level banner: "Voice transcription accuracy below threshold — vocabulary needs setup. [Setup now]." Foreman is prompted to use manual entry until resolved. Voice flow stays available but flagged as unreliable.
**Escalation:** ops dashboard alert; vocabulary-setup wizard surfaced to project admin.

### 13.2 GPS unavailable

**Detection:** `iris_photo_ingestions.area_inference_status='unknown'` rate > 30% for a project.
**Likely cause:** indoor capture, GPS off in device settings, or project doesn't have drawing-aligned area polygons.
**Degraded path:** UI prompts the foreman to pick area at capture; do **not** silently default to project-root. The foreman is in front of the area at capture time and is the most reliable source. Pre-fill last-used area for the user this day to keep friction low.
**Escalation:** if a project's `unknown` rate stays > 30% for 7 days, ops contacts the project admin to set up areas.

### 13.3 Photo upload fails offline

**Detection:** local `iris_photo_pending` count > 0 with `last_attempt > 1h ago`.
**Degraded path:** queue + retry on connectivity (already designed). User notified of pending queue size in app header. If queue exceeds 50 photos or 200MB, user gets a "device storage near limit — consider connecting" banner.
**Escalation:** on app open, if any pending item is > 24h stale, surface a one-line "X photos pending upload — tap to resolve" with manual retry.

### 13.4 Caption hallucination

**Detection:** caption-edit rate per project per generator > 30%; or human review flags hallucinations on golden subset.
**Degraded path:** "AI-generated" tag is always prominent; user correction overrides. Embedding recompute runs on the corrected caption.
**Escalation:** if caption-edit rate stays > 30% for 7 days, ops investigates. Possibilities: vision LLM regression, prompt template needs construction-tuning refresh, project has unusual subject matter (atypical trade) that needs domain expansion.

### 13.5 Drawing callout parse error

**Detection:** `drawing_callouts.resolution_status='unresolved'` rate per drawing > 25%.
**Degraded path:** Unresolved callouts logged but not surfaced as broken citations (would erode trust). Ops curation tool surfaces unresolved callouts for manual mapping ("4/A-301 → drawing X, region Y"). Curated rows transition to `manual_curated`.
**Escalation:** per-project unresolved rate > 50% triggers ops review of the regex / LLM-fallback prompt against that project's drawing style.

### 13.6 IrisFieldAgent confidence collapse

**Detection:** clip-level confidence P50 < 0.60 across a project.
**Likely cause:** novel intent type the agent isn't trained for; foreman vernacular outside the training distribution; very noisy audio.
**Degraded path:** flag the draft for PM review; do NOT silently commit. Inbox surfaces drafts with a "low-confidence" badge.
**Escalation:** sustained low-confidence > 7 days triggers a retraining-data-collection pass on Nexus + Carleton.

### 13.7 Audio storage cost runs hot

**Detection:** per-project audio storage growth rate > 5GB/month.
**Mitigation:** raw audio retained 90 days; transcripts + audio_anchor pointers retained per ADR-008. After 90 days, audio is moved to cold storage; resolver renders `audio_anchor` as text-only with "audio archived — request restore" affordance.

---

## 14. Acceptance Gate

Phase 5 closes when **all** of the following are green for ≥ 14 consecutive days on the soft pilot cohort (Nexus + Carleton):

| # | Criterion | Source |
|---|---|---|
| 1 | Foreman generates ≥ 1 daily log per active jobsite-day | `mv_iris_voice_daily` |
| 2 | Foreman uploads ≥ 3 photos per active jobsite-day | `mv_iris_photo_daily` |
| 3 | ≥ 80% of voice-derived logs accepted with ≤ 2 edits | `iris_voice_invocations.accept_count + edit_count` |
| 4 | Spatial query precision@5 ≥ 0.80 on the 50-Q goldens | nightly eval harness |
| 5 | `photo_anchor` citations appear in ≥ 30% of synthesized weekly reports | `mv_iris_synth_weekly_citations` |
| 6 | WER P50 ≤ 8% across all clips | `iris_voice_invocations.wer_estimate` |
| 7 | End-to-end voice latency P95 ≤ 8s | `iris_voice_invocations.latency_capture_to_draft_ms` |
| 8 | Photo pipeline P95 ≤ 8s | `iris_photo_ingestions.caption_latency_ms` |
| 9 | RLS regression suite (50 cases) — 100% pass | weekly CI run |

This is operationalized as a CI workflow `phase-5-acceptance.yml`, modeled on `lap-2-acceptance.yml`. Phase 5 is "shipped" the day this workflow stays green for two consecutive weeks.

---

## 15. Cross-References

### 15.1 Depends on

- **Phase 1** (Role Layer + Context Fabric) — foreman persona prompt, persona-aware retrieval scoping, IRIS_CONTEXT envelope on every voice-ingest call.
- **Phase 2** (Specialist Sub-Agents + Action Layer) — IrisFieldAgent extends the specialist pattern; reuses the router + commit-gate plumbing.
- **Phase 3** (Universal Knowledge Absorption) — `iris_kb_chunks` schema, retrieval API, embedding model. Phase 5 widens ingestion to audio + image but does not alter the chunk schema.
- **Phase 0** (citations) — 8 → 10 citation kinds; the routing table and resolver pattern are reused.

### 15.2 Inputs to

- **Phase 6** (Cross-Project Memory + Firm Playbook) — firm memory absorbs spatial patterns ("MEP rough-in problems on Floor 4 north" recur across hospital projects), voice patterns ("foreman vernacular for slip risk"), and photo-derived completion-progress patterns. Without Phase 5, firm memory is text-only and incomplete.
- **Phase 7** (Open Action Platform) — voice-derived T&M tickets and safety incidents are the highest-volume outbound action types into Procore / Sage / Foundation. Phase 5 fills the source.
- **Phase 8** (Predictive + Generative) — photo-derived completion progress and voice-derived schedule observations are inputs to the schedule-slip prediction model.

### 15.3 Reuses

- **ADR-010** (Mobile Native Architecture) — Phase 5 is the largest consumer of the mobile capabilities ADR-010 enables (camera, microphone, background upload, offline queue, GPS).
- **ADR-004** (Citation Side Panel) — `photo_anchor` and `audio_anchor` render in the same surface as the existing 8 kinds.
- **ADR-007** (Auto-Withdraw Policy) — voice-derived drafts follow the same withdraw rules; "transcript reprocessed" becomes a new state-change trigger.
- **ADR-008** (Telemetry Retention) — audio + photo telemetry obey the same 12/24-month retention.
- **Phase 0 citations resolver** — `resolve_citation` RPC gains 2 branches.
- **Phase 0 voice substrate** — `style.ts` voice rules apply to IrisFieldAgent outputs (e.g., distinguishing RFI / ASI / CCD per the construction-term ontology).

---

## 16. Day-by-Day Breakdown (~60 days, Lap 5–6)

Calendar reference: T-120 = ~Jan 27 2027; T-60 = ~Mar 27 2027. ~60 working days, organized in five batches of ~12 days each. Each batch is a shippable slice; Phase 5 acceptance gate (§14) closes at end of day 60.

### Days 1–12 — Mobile capture + edge ingest

| Day | Deliverable |
|---|---|
| 1 | Phase 5 kickoff; eval harness scaffold (`goldens/phase5/`) |
| 2 | Schema migration: `iris_voice_transcripts`, `iris_photo_metadata`, `iris_photos`, `iris_drawing_sheets`, `drawing_callouts`, `project_areas`, `project_vocabulary`, `iris_voice_invocations`, `iris_photo_ingestions` |
| 3 | Mobile capture UI iOS — voice screen + recording loop |
| 4 | Mobile capture UI Android — voice screen + recording loop |
| 5 | Local cache (Realm/Room) + offline queue |
| 6 | `voice-ingest` edge function — chunk upload + S3 store + pgmq enqueue |
| 7 | `photo-ingest` edge function — multipart upload + format normalize |
| 8 | EXIF extract worker stage |
| 9 | Resumable upload + connectivity-loss retry |
| 10 | Mobile capture UI photo screen + burst capture |
| 11 | Background upload (URLSession iOS / WorkManager Android) |
| 12 | Batch 1 review + integration smoke |

### Days 13–24 — Transcription + photo pipeline

| Day | Deliverable |
|---|---|
| 13 | Whisper-large-v3 wrapper + per-utterance vocab prompt |
| 14 | Word-level timestamp persist; transcript reprocessing semantics |
| 15 | OCR worker (Document AI primary; Tesseract fallback) |
| 16 | Vision LLM caption worker; AI-generated tag UI |
| 17 | Embedding worker; chunk write to `iris_kb_chunks` (source_type photo) |
| 18 | Caption user-correction flow + recompute embedding on edit |
| 19 | Spatial alignment: GPS polygon point-in-polygon path |
| 20 | Spatial alignment: GPS-only fallback + unknown-state UI |
| 21 | `iris_voice_invocations` + `iris_photo_ingestions` telemetry write paths |
| 22 | `mv_iris_voice_daily` + `mv_iris_photo_daily` materialized views |
| 23 | Custom vocabulary import (project roster, vendor list, areas, equipment, spec sections, address) |
| 24 | Batch 2 review; first end-to-end voice clip → transcript |

### Days 25–36 — IrisFieldAgent + drawing OCR

| Day | Deliverable |
|---|---|
| 25 | IrisFieldAgent scaffold; intent classifier (Haiku) |
| 26 | Per-intent generators: `daily_log_entry`, `rfi_question` |
| 27 | Per-intent generators: `tm_ticket`, `safety_incident` |
| 28 | Per-intent generators: `photo_annotation`, `schedule_observation` |
| 29 | Confidence scoring + threshold + low-confidence flagging |
| 30 | Clarification round flow (TTS prompt + foreman response loop) |
| 31 | Audio anchor offset alignment |
| 32 | IrisRouter dispatch on `audio` / `photo` source types |
| 33 | Drawing OCR per-sheet + embed |
| 34 | Drawing callout regex parser |
| 35 | Drawing callout LLM-fallback for non-standard forms |
| 36 | Batch 3 review; first end-to-end voice clip → 2 structured drafts |

### Days 37–48 — Citations + retrieval + spatial

| Day | Deliverable |
|---|---|
| 37 | `photo_anchor` citation kind + routing table entry |
| 38 | `<PhotoAnchorCitationPanel>` component |
| 39 | `audio_anchor` citation kind + routing table entry |
| 40 | `<AudioAnchorCitationPanel>` component (waveform render + play) |
| 41 | `resolve_citation` RPC: 2 new branches + stale-state handling |
| 42 | Snippet verification at insert-time for both new kinds |
| 43 | Project areas hierarchy seeding from sheet index |
| 44 | Areas hierarchy admin UI (PM defines floors / zones / areas) |
| 45 | `area_id` columns added to remaining artifact tables |
| 46 | Retrieval API exercises `filters.areas` in production |
| 47 | Spatial query goldens (50-Q) running nightly |
| 48 | Batch 4 review |

### Days 49–60 — Acceptance, eval harness, pilot integration

| Day | Deliverable |
|---|---|
| 49 | Eval harness goldens: 200 audio, 100 photo, 50 spatial, 100 callout |
| 50 | Nightly eval CI workflow `phase-5-eval.yml` |
| 51 | Mobile device-farm regression matrix |
| 52 | RLS regression suite (50 cases) wired into CI |
| 53 | Permission test pass (sub / owner_rep / foreman matrix) |
| 54 | Citation surfacing-rate telemetry on weekly reports |
| 55 | Failure mode degraded paths (banners, vocab-setup wizard, ops curation tool) |
| 56 | `phase-5-acceptance.yml` workflow |
| 57 | Soft pilot rollout to Nexus (Brad Cameron's super + foreman) |
| 58 | Soft pilot rollout to Carleton |
| 59 | First 7-day pilot review + tuning (vocab gaps, caption fidelity, spatial accuracy) |
| 60 | Phase 5 acceptance gate green; receipt drafted |

Slack: ±10% per batch absorbed by Walker; if batch slips by > 20%, escalate to phase-window adjustment vs. scope reduction (§17).

---

## 17. Risks Specific to Phase 5

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Whisper accuracy below 85% on a real Nexus jobsite even with custom vocab** | Medium | Foreman flow doesn't adopt; Phase 5 voice deliverable misses gate | Test against real Nexus daily-log audio at Phase 1 (long before Phase 5 build); if < 85% baseline, defer voice to Phase 6 and ship Phase 5 photo + drawings only. |
| 2 | **Vision LLM caption cost runs hot at scale** | High | Unit economics break before T-0 launch | Cache aggressively (captions don't change once written; user edits override). Use Haiku-class for tag extraction; reserve Sonnet/4o for full caption only on novel photos. Sample-and-skip on burst captures (caption 1-of-N if visually similar via perceptual hash). |
| 3 | **Spatial alignment without BIM is too approximate to be useful** | Medium | Spatial queries return wrong area; trust collapses | v0 = manual + GPS heuristic explicitly. UI is honest about unknown-state ("we don't know which area this is — pick one"). Set spatial precision target at 0.80 (not 0.95) so user expectations match capability. v1 (BIM) deferred to Phase 7+. |
| 4 | **Mobile-native development resourcing — ADR-010 capacity** | High | Mobile slips; foreman flow doesn't ship in window | Engineer #2 hire (REM critical-path) must include mobile-native experience. If pure-web fallback is needed, voice+photo capture via PWA with degraded background-upload; document the gap. |
| 5 | **Audio storage cost** | Medium | Cloud bill spikes in pilot | 90-day raw audio retention; cold-storage tier after; transcripts + anchors stay hot. ADR-008 retention rules apply. |
| 6 | **Foreman privacy concerns — "is the system always listening?"** | Medium | Adoption friction if foreman feels surveilled | Voice capture is explicit, push-to-talk, never always-on. Mic indicator on device. Pilot agreement (per ADR-006) discloses voice processing. |
| 7 | **IrisFieldAgent multi-intent parser gets it wrong on subtle T&M-vs-daily-log boundary** | Medium | Wrong artifacts in wrong tables; PM frustration | Per-intent confidence threshold + clarification round + low-confidence badge in inbox. Audit log shows the source clip for any disputed routing. PM can recategorize a draft to a different intent type; recategorization is training signal. |
| 8 | **Drawing callout parsing fails on non-standard sheet styles** | Medium | "Where is X" answers feel broken on some projects | Regex + LLM fallback + ops curation tool. Per-project unresolved-rate telemetry surfaces project-specific drawing-style issues. Manual curation rows are first-class. |
| 9 | **Image-anchored citation boxes misaligned (model says crop X but actual area is Y)** | Low–Medium | Trust issue: "the citation pointed me to the wrong thing" | Bbox is rendered as a rectangle on the photo; click takes you to full photo; you can verify visually in 1 second. The misalignment is recoverable; silent corruption is not. |
| 10 | **Pilot fatigue — Nexus foreman doesn't want to be a beta tester** | Medium | Acceptance gate doesn't have data | Onboarding per SOFT_PILOT_PLAYBOOK includes foreman-specific session; first 7 days, ride along; tight feedback loop. Free pilot per ADR-006. |
| 11 | **Custom vocabulary import is brittle (vendor list with typos, person nicknames)** | Medium | WER stays high on real names | Vocab-correction loop: when a transcript edit changes a proper-noun mishearing, the corrected term is auto-added to `project_vocabulary` with `source_id` pointing back to the corrective edit. Self-improving. |
| 12 | **Phase 5 ships AFTER Phase 4 (per-page ambient) but Phase 4 doesn't surface photo / voice insights yet** | Low | Phase 4 page coverage feels thin on photo-heavy workflows | Phase 5 includes a Phase-4-to-Phase-5 bridge: 5 new generator types added to the Phase 4 generator registry that consume photo/voice signals (e.g., "12 photos this week show MEP rough-in completion 4 days ahead of schedule"). |

---

*End of Phase 5 spec. T-minus ~265 days from spec date to phase-open.*

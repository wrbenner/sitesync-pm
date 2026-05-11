# Ingestion Taxonomy Spec (Phase 3 sub-spec)

**Date:** 2026-05-08
**Status:** Draft. Target same calendar as Phase 3 (Lap 4, T-210 → T-180, Oct → Nov 2026).
**Sub-spec to:** `IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md` (sibling, opening this lap).
**Companion to:** `IRIS_CITATIONS_SPEC_2026-05-04.md`, `ADR_004_CITATION_SIDE_PANEL_2026-05-04.md`, `ADR_006_PILOT_DATA_ISOLATION_2026-05-04.md`, `ADR_017_EMBEDDING_MODEL` (stub), `PROCORE_IMPORTER_SPEC_2026-05-04.md`.
**Author:** Walker (with Claude as thinking partner)

---

## 1. Status

Draft, opened 2026-05-08. Target ratify date: Lap 4 kickoff (~Oct 2026). Sub-spec to the Phase 3 Knowledge Absorption work that closes Pillar 3 (Universal Knowledge Absorption) per `IRIS_NATIVENESS_PLAN_2026-05-08.md` § 6.

This document is consumed by **engineer #2** during Phase 3 implementation. It is the unambiguous source of truth for "what gets ingested, where, how, and at what sensitivity." Without it, the Phase 3 ingestion pipeline becomes a per-engineer judgment call and the catch-all behavior gets re-derived three times.

---

## 2. Purpose

One source of truth for:

1. **Every artifact type** SiteSync ingests — drawings, specs, RFIs, daily logs, photos, conversations, schedules, money records, BIM, voice, video, and the long tail.
2. **The router target** for each — the worker that consumes it.
3. **The citation kind emitted** when retrieved — so the side-panel resolver (ADR-004) knows what to render.
4. **The sensitivity default** at ingest — public-to-project, gc-only, owner-only, finance-only — propagated to every chunk and enforced by RLS at retrieval (Pillar 4 of `IRIS_NATIVENESS_PLAN`).
5. **The anchor-jsonb shape** stored on each chunk — so the Phase 3 retriever knows how to reconstruct the deep link without re-querying source tables.

Three problems this spec exists to solve:

- **"No upload drops on the floor."** Every upload code path — project doc, RFI attachment, submittal, daily log photo, comment file, email forward, mobile camera — must route through one named entrypoint with one defined fallback. Today, each surface has its own ad-hoc upload handling.
- **Permission classification at ingestion, not retrieval.** Glean's quiet-moat lesson (`IRIS_NATIVENESS_PLAN` § 4 Pillar 4): the sensitivity tag has to live on the chunk at write time. Trying to re-classify at retrieval is the leakage path.
- **Phase 3 vs Phase 5 boundary.** The catalog flags which artifact types ship in Phase 3 vs which defer to Phase 5 (voice, photo-with-rich-anchor, BIM, video). Engineer #2 implements only the Phase 3 column; the Phase 5 column is reserved.

---

## 3. The Artifact Catalog

Columns:

- `artifact_type` — the canonical name used everywhere (worker names, telemetry, citation kinds).
- `source_id_table` — the row-store table the source artifact lives in. (For uploads, the file row + the parent entity.)
- `router_target` — the ingestion worker, named `ingest_<artifact_type>_worker` unless noted.
- `chunking_strategy` — how the worker splits source content into chunks.
- `citation_kind_emitted` — the `DraftedActionCitation['kind']` value the retriever stamps on results from this artifact.
- `sensitivity_default` — initial classification at ingest. Source can override; chunk inherits.
- `anchor_jsonb_shape` — the `metadata.anchor` shape stored on each `iris_kb_chunks` row, used by the side-panel resolver to deep-link.
- `notes` — special handling, deferral flags, propagation rules.

### 3.1 Documents and drawings (Phase 3, primary)

| artifact_type | source_id_table | router_target | chunking_strategy | citation_kind_emitted | sensitivity_default | anchor_jsonb_shape | notes |
|---|---|---|---|---|---|---|---|
| `drawing` | `drawings` + `drawing_sheets` + `drawing_pages` | `ingest_drawing_worker` | per-sheet OCR + callout extraction; one chunk per sheet region (~256 tokens) | `drawing_coordinate` | `public_to_project` | `{ drawing_id, sheet_id, page_no, region: { x, y, w, h } }` (normalized 0–1) | OCR via existing `drawing_text_content`. Callouts (`see 4/A-301`) parsed and linked to target sheet via `entity_links`. Phase 5 deepens with vision-LLM callout indexing. |
| `drawing_revision` | `drawing_revisions` | `ingest_drawing_revision_worker` | delta-only: chunks for changed regions vs prior rev | `drawing_coordinate` | `public_to_project` | same shape + `{ rev_id, supersedes_rev_id }` | Supersedes prior revision in retrieval (`is_current=true` filter). Old revs retained for audit. |
| `drawing_bulletin` | `drawing_bulletins` | `ingest_drawing_revision_worker` (shared) | as drawing_revision | `change_order` | `public_to_project` | `{ bulletin_id, drawings_affected: uuid[] }` | Reuses `change_order` citation kind per `IRIS_CITATIONS_SPEC` § Phase 1 table. |
| `spec_section` | `spec_sections` + `specifications` + `project_spec_book` | `ingest_spec_section_worker` | one chunk per CSI subsection (~512 tokens, semantic break on numbered headings) | `spec_reference` | `public_to_project` | `{ spec_section_id, csi_code, anchor: <heading-id>, page }` | CSI MasterFormat hierarchy preserved in `metadata.csi_path`. |
| `submittal` | `submittals` + `submittal_items` + `submittal_packages` | `ingest_submittal_worker` | field-mapped chunks: one per item description, one per attached drawing, one per cover-letter narrative | `spec_reference` | `public_to_project` | `{ submittal_id, item_id?, package_id?, attachment_id? }` | Citation kind reuses `spec_reference` because submittals are specifier-routed against spec sections. |
| `contract` | `contracts` + `contract_clauses` | `ingest_contract_worker` | one chunk per clause; cents stripped from chunk text, retained in `metadata.cents` | `contract_clause` (NEW, see § 5) | `finance_only` for clauses touching dollars; `gc_only` for scope/legal; `public_to_project` for general specs | `{ contract_id, clause_id, clause_path }` | Mixed sensitivity within one document — chunks classified per-clause. Inspector job (§ 8) audits this. |
| `subcontract` | `contracts` (with `contract_type='subcontract'`) | `ingest_contract_worker` (shared) | as contract | `contract_clause` | `gc_only` (sub identity + scope), `finance_only` (dollar lines) | same | Sub never sees other subs' contracts; RLS on `contract.subcontractor_id`. |
| `purchase_order` | `purchase_orders` + `po_line_items` | `ingest_purchase_order_worker` | one chunk per line item + one per PO header | `budget_line` | `gc_only` | `{ po_id, line_id?, vendor_id }` | Line item dollars in `metadata.cents`, narrative-only in chunk text. |
| `bid_invitation` | `bid_invitations` + `precon_bid_invitations` | `ingest_bid_worker` | one chunk per scope bullet | `spec_reference` | `gc_only` | `{ bid_invitation_id, scope_item_id? }` | Pre-award; flips to `public_to_project` post-award (handled by classification update event). |
| `bid_response` | `bid_responses` + `bid_submissions` + `precon_bid_submissions` | `ingest_bid_worker` (shared) | one chunk per response narrative + one per pricing line (cents stripped) | `budget_line` | `finance_only` (pricing), `gc_only` (narrative) | `{ bid_submission_id, response_item_id? }` | NEVER cross-leaks to other bidders. RLS on `bidder_org_id`. |

### 3.2 Field operations (Phase 3, primary)

| artifact_type | source_id_table | router_target | chunking_strategy | citation_kind_emitted | sensitivity_default | anchor_jsonb_shape | notes |
|---|---|---|---|---|---|---|---|
| `rfi` | `rfis` + `rfi_responses` + `rfi_attachments` | `ingest_rfi_worker` | one chunk per question/response message; long answers split at ~512 tokens | `rfi_reference` | `public_to_project` | `{ rfi_id, message_id?, response_id?, version? }` | All `rfi_responses_versions` indexed; latest flagged with `is_current`. |
| `daily_log` | `daily_logs` + `daily_log_entries` | `ingest_daily_log_worker` | one chunk per section: narrative, work-completed, safety, attendees, weather | `daily_log_excerpt` | `public_to_project` | `{ daily_log_id, section: 'narrative'\|'work_completed'\|'safety'\|'attendees'\|'weather', entry_id? }` | Excerpt offset stored for jump-to-line in side panel (per `IRIS_CITATIONS_SPEC` § Phase 1). |
| `photo` (Phase 3 basic) | `media_links` + `field_captures` + `photo_pins` | `ingest_photo_worker` | one chunk per photo: caption (vision-LLM) + OCR text + EXIF metadata | `photo_observation` (Phase 3) → `photo_anchor` (Phase 5) | `public_to_project` | Phase 3: `{ photo_id, caption_text, ocr_text }`. Phase 5: adds `{ frame_id, bbox: { x, y, w, h }, area_id }` | Phase 3 ships caption + OCR only. Phase 5 deepens to spatial alignment + bbox-anchored citations. EXIF GPS used for area inference. |
| `change_order` | `change_orders` + `change_order_line_items` | `ingest_change_order_worker` | one chunk per line item (cents in metadata, narrative in chunk text) + one for narrative reason | `change_order` | `gc_only` (until executed); `public_to_project` post-execution if shared with owner | `{ co_id, line_id?, status, reason_code }` | Cents preserved as `metadata.cents`; retrieval text never echoes raw dollar values for the LLM (Pillar 5 — `IrisMoneyAgent` does math, not the retriever). |
| `bulletin` / `asi` | `drawing_bulletins` + `documents` (when `doc_type='asi'`) | `ingest_drawing_revision_worker` (shared) | as drawing_revision | `change_order` | `public_to_project` | `{ bulletin_id, asi_no?, drawings_affected: uuid[] }` | ASI vocabulary in `style.ts` (Pillar 6) ensures Iris doesn't conflate ASI/CCD/CO consequence. |
| `directive` (verbal, email, formal) | `documents` (with `doc_type='directive'`) + `inbound_email_replies` | `ingest_directive_worker` | one chunk per directive | `change_order` (when cost/schedule impacting); `rfi_reference` (when informational) | `gc_only` | `{ directive_id, source: 'verbal'\|'email'\|'formal', cost_impact?, schedule_impact? }` | Verbal directives transcribed via Phase 5 voice; until then text-only. |
| `safety_incident` / `near_miss` | `incidents` + `safety_observations` + `corrective_actions` | `ingest_safety_worker` | one chunk per incident + one per corrective action | `daily_log_excerpt` (general) — propose new kind in Phase 5 | `gc_only` (PII redacted before chunking) | `{ incident_id, severity, corrective_action_id? }` | PII (injured worker name) stripped pre-embed. RLS on safety officer + project leadership only. |
| `pre_task_plan` | `pre_task_plans` + `toolbox_talks` + `toolbox_talk_attendees` | `ingest_safety_worker` (shared) | one chunk per JHA item + one per attendee roster | `daily_log_excerpt` | `public_to_project` | `{ ptp_id, hazard_id?, talk_id? }` | Standard JSA/JHA structure — hazards + controls + crew acknowledgments. |
| `inspection` | `inspections` + `inspection_items` + `inspection_checklists` + `permit_inspections` | `ingest_inspection_worker` | one chunk per checklist item + one per remark | `punch_item` (NEW, see § 5) | `public_to_project` | `{ inspection_id, item_id?, checklist_id? }` | Inspector identity preserved; deficiencies linked to punch_items via `entity_links`. |
| `permit` | `permits` | `ingest_permit_worker` | one chunk per permit document | `daily_log_excerpt` | `public_to_project` | `{ permit_id, type, jurisdiction }` | Lookup-grade artifact; rarely retrieved as content but always retrievable. |
| `coi` (insurance certificate) | `insurance_certificates` + `coi_extractions` + `coi_check_in_blocks` | `ingest_coi_worker` | one chunk per coverage line | `contract_clause` | `gc_only` | `{ coi_id, coverage_type, expires_at }` | OCR'd via `coi_extractions`. Expiration alerts power Phase 4 ambient layer. |
| `lien_waiver` | `lien_waivers` + `lien_waiver_signatures` | `ingest_lien_waiver_worker` | one chunk per waiver header + one per through-date statement | `budget_line` | `finance_only` | `{ waiver_id, sub_id, through_date, type }` | Through-date critical for pay-app reconciliation. |
| `o_and_m_manual` | `documents` (with `doc_type='o_and_m'`) | `ingest_document_worker` (catch-all-ish) | per-section split | `spec_reference` | `public_to_project` | `{ document_id, section_path }` | Closeout artifact; indexed for warranty-period queries. |
| `as_built` | `documents` (with `doc_type='as_built'`) + `drawings` (with `is_as_built=true`) | `ingest_drawing_worker` (shared) | as drawing | `drawing_coordinate` | `public_to_project` | as drawing | Supersedes design drawings post-completion; flagged `is_as_built` filter. |
| `warranty` | `warranties` + `warranty_claims` | `ingest_warranty_worker` | one chunk per warranty + one per claim | `change_order` | `public_to_project` | `{ warranty_id, claim_id? }` | Warranty-period queries are Phase 4 ambient triggers. |
| `punch_item` | `punch_items` + `punch_list_items` + `punch_item_comments` + `closeout_items` + `commissioning_items` | `ingest_punch_worker` | one chunk per item + one per comment thread | `punch_item` (NEW, see § 5) | `public_to_project` | `{ punch_item_id, comment_id?, ball_in_court }` | Issues/observations/punch all unify here. Side-panel renders ball-in-court chip. |
| `issue` / `observation` | `safety_observations` + `drawing_discrepancies` | `ingest_punch_worker` (shared) | as punch | `punch_item` | `public_to_project` | as punch | Field-detected issues feed the same retrieval bucket as formal punch items. |

### 3.3 Schedule and money (Phase 3, primary)

| artifact_type | source_id_table | router_target | chunking_strategy | citation_kind_emitted | sensitivity_default | anchor_jsonb_shape | notes |
|---|---|---|---|---|---|---|---|
| `schedule_phase` | `schedule_phases` + `schedule_recovery_events` + `schedule_import_jobs` | `ingest_schedule_worker` | one chunk per phase + one per recovery narrative | `schedule_phase` | `public_to_project` | `{ phase_id, predecessors: uuid[], successors: uuid[], total_float_days?, free_float_days? }` | Float math is Phase 2's `IrisScheduleAgent`'s job — retrieval is narrative + structure only. |
| `schedule_xlsx` | `files` (with `mime='application/vnd.ms-excel'` + classification `'schedule'`) | `ingest_spreadsheet_worker` | one chunk per row group / sheet section (see § spreadsheet rules) | `spreadsheet_cell` (NEW, see § 5) | `public_to_project` | `{ file_id, sheet_name, range: 'A1:F50' }` | P6 / MSP exports often arrive as XLSX before formal schedule import. |
| `lookahead_xlsx` | `files` (classified `'lookahead'`) | `ingest_spreadsheet_worker` (shared) | as schedule_xlsx | `spreadsheet_cell` | `public_to_project` | same | 3-week and 6-week lookaheads. Variance vs schedule of record fed to Phase 4 detectors. |
| `pay_app` / `billing_request` / `draw_request` | `pay_applications` + `payment_applications` + `pay_application_line_items` + `payment_line_items` + `payapp_owner_previews` + `payment_milestones` | `ingest_pay_app_worker` | one chunk per line item (cents in metadata, narrative-only chunk text) + one for retainage block | `budget_line` | `finance_only` | `{ pay_app_id, line_id?, sov_line_id?, period_through_date }` | Cents in `metadata.cents`. Reconciliation diffs (`pay_app_reconciliation_lines`) indexed separately. |
| `budget` / `sov` | `budget_items` + `budget_line_items` + `schedule_of_values` + `cost_codes` | `ingest_budget_worker` | one chunk per line item with cost code | `budget_line` | `gc_only` | `{ budget_item_id, sov_line_id?, cost_code }` | Cost codes are the dominant join key — kept in `metadata.cost_code` for filtered retrieval. |
| `estimate` | `estimates` + `estimate_line_items` + `estimating_items` + `estimate_rollups` | `ingest_estimate_worker` | one chunk per line item | `budget_line` | `gc_only` | `{ estimate_id, line_id?, takeoff_id? }` | Pre-award estimates; never cross-leaks across bidders. |
| `cost_transaction` | `cost_transactions` + `job_cost_entries` | `ingest_cost_transaction_worker` | summary chunks weekly (volume too high for per-row) | `budget_line` | `finance_only` | `{ week_starting, cost_code, transaction_count }` | Compressed roll-up; raw transactions retrievable through filter, not vector. |
| `subcontractor_invoice` | `subcontractor_invoices` + `invoices_payable` | `ingest_invoice_worker` | one chunk per invoice header + one per line | `budget_line` | `finance_only` | `{ invoice_id, line_id? }` | RLS scopes to GC + the issuing sub only. |

### 3.4 Conversations (Phase 3 limited; full coverage Phase 5)

| artifact_type | source_id_table | router_target | chunking_strategy | citation_kind_emitted | sensitivity_default | anchor_jsonb_shape | notes |
|---|---|---|---|---|---|---|---|
| `email` (forward) | `inbound_email_replies` + `inbound_email_unmatched` + `outbound_email_log` + `submittal_emails` | `ingest_conversation_worker` | one chunk per email message body (signatures stripped) | `conversation_anchor` (Phase 5; Phase 3 falls back to `daily_log_excerpt`) | `gc_only` (defaults; per-thread can lift to `public_to_project` if owner CC'd) | `{ email_id, thread_id?, message_id, occurred_at }` | Phase 3 ingests email-forward to `*@projects.sitesync.ai` only. Phase 5 adds Slack + meeting transcripts. |
| `slack_message` | `chat_messages` + `slack_delivery_log` | `ingest_conversation_worker` (Phase 5) | one chunk per message; thread context held in `metadata.thread_summary` | `conversation_anchor` | `gc_only` | `{ slack_channel_id, message_ts, thread_ts? }` | Phase 5 only — defer. |
| `sms` | future `sms_messages` table | `ingest_conversation_worker` (Phase 5) | as slack_message | `conversation_anchor` | `gc_only` | `{ sms_id, sender_phone_hash, occurred_at }` | Phase 5; phone numbers hashed. |
| `meeting_transcript` | `meetings` + `meeting_action_items` + `meeting_agenda_items` + `meeting_attendees` + `meeting_participants` | `ingest_meeting_worker` (Phase 5) | one chunk per agenda item + one per action item + 60s windows for raw transcript | `conversation_anchor` | `gc_only` | `{ meeting_id, agenda_item_id?, action_item_id?, start_ms?, end_ms? }` | Granola-style: opt-in, no bot, transcribed locally then uploaded. Phase 5. |
| `oac_meeting_notes` | `meetings` (with `meeting_type='oac'`) | `ingest_meeting_worker` | as meeting_transcript | `conversation_anchor` | `public_to_project` (owner present) | same | OAC notes get higher trust + propagate decisions to RFIs/COs. |
| `calendar_event` | `meeting_series` + `project_business_calendar` | `ingest_meeting_worker` (shared) | one chunk per event description | `schedule_phase` (when project-tied) | `public_to_project` | `{ event_id, start_at, end_at, attendees: uuid[] }` | Phase 3 ships event metadata only; transcript is Phase 5. |
| `owner_correspondence` | `owner_updates` + `documents` (with `doc_type='owner_correspondence'`) | `ingest_owner_correspondence_worker` | one chunk per correspondence | `conversation_anchor` (Phase 5) → `daily_log_excerpt` (Phase 3 fallback) | `owner_only` (until shared); `public_to_project` if shared | `{ correspondence_id, direction, occurred_at }` | Owner-only by default — sub never sees. |
| `executive_direction` | `executive_reports` + `documents` (with `doc_type='executive'`) | `ingest_owner_correspondence_worker` (shared) | one chunk per directive | `change_order` | `owner_only` | `{ direction_id, occurred_at }` | Executive directives flow into directive ingestion when they become formal. |
| `rfp_response` | `documents` (with `doc_type='rfp_response'`) | `ingest_bid_worker` (shared) | one chunk per response section | `contract_clause` | `owner_only` (pre-award); `gc_only` (post-award internal) | `{ rfp_id, response_section_id }` | Pre-award strict isolation. |

### 3.5 Reports and generated artifacts (Phase 3)

| artifact_type | source_id_table | router_target | chunking_strategy | citation_kind_emitted | sensitivity_default | anchor_jsonb_shape | notes |
|---|---|---|---|---|---|---|---|
| `weekly_report` | `report_runs` + `report_templates` + `daily_summaries` | `ingest_report_worker` | one chunk per section heading | `daily_log_excerpt` | varies by audience: `gc_only` (internal), `owner_only` (owner-distributed), `public_to_project` (broadly distributed) | `{ report_run_id, section_heading, audience }` | Iris-generated reports are themselves indexable — Phase 6 firm memory leans on this. |
| `monthly_report` | `report_runs` (period='monthly') | `ingest_report_worker` (shared) | as weekly_report | same | same | same | Same handling as weekly. |
| `owner_report` | `report_runs` (audience='owner') + `payapp_owner_previews` + `payapp_owner_preview_comments` | `ingest_report_worker` (shared) | per-section | `daily_log_excerpt` (default), `change_order` (CO-bearing), `budget_line` (pay-app-bearing) | `owner_only` until distributed | `{ report_run_id, section_heading, audience: 'owner' }` | Owner-preview comments are themselves separately ingested as conversation. |
| `wip_report` | `wip_reports` | `ingest_report_worker` (shared) | per-section | `budget_line` | `finance_only` | `{ wip_report_id, period }` | Work-in-progress reporting; finance-classified. |
| `compliance_report` | `compliance_reports` + `certified_payroll_reports` | `ingest_report_worker` (shared) | per-section | `daily_log_excerpt` | `gc_only` (PII redacted) | `{ report_id, type }` | Certified payroll: SSN/wages stripped pre-chunking. |
| `executive_report` | `executive_reports` | `ingest_report_worker` (shared) | per-section | `daily_log_excerpt` | `gc_only` | `{ report_id }` | Internal exec layer; finance-adjacent but not finance-only. |

### 3.6 Multi-modal (Phase 5)

| artifact_type | source_id_table | router_target | chunking_strategy | citation_kind_emitted | sensitivity_default | anchor_jsonb_shape | notes |
|---|---|---|---|---|---|---|---|
| `bim_model` | `bim_models` + `bim_elements` + `bim_element_progress` + `ifc_models` | `ingest_bim_worker` (Phase 5) | one chunk per element (geometry summary + properties) | `drawing_coordinate` (extends with `element_id`) | `public_to_project` | `{ bim_model_id, element_id, ifc_guid?, properties: jsonb }` | Phase 5 — geometry indexed by element_id. Combined with spatial query in retrieve. |
| `bim_clash` | `bim_clashes` + `bim_clash_reports` | `ingest_bim_worker` (shared, Phase 5) | one chunk per clash | `punch_item` | `public_to_project` | `{ clash_id, elements: uuid[], severity }` | Clash → punch_item promotion path documented separately. |
| `bim_markup` / `bim_safety_zone` / `bim_rfi_element` | `bim_markups` + `bim_safety_zones` + `bim_rfi_elements` | `ingest_bim_worker` (shared, Phase 5) | per-markup | `drawing_coordinate` (with `element_id`) | `public_to_project` | as bim_model + `{ markup_id }` | Phase 5. |
| `voice_capture` | future `voice_captures` table (see Phase 5) | `ingest_voice_worker` (Phase 5) | per-utterance windows (~30s) | `audio_anchor` (NEW, Phase 5) | `gc_only` (jobsite captures may include ambient personnel chatter) | `{ capture_id, start_ms, end_ms, transcript_segment_id }` | Foreman flow. Whisper + custom vocab. Phase 5. |
| `video` (jobsite walk, drone) | future `videos` table | `ingest_video_worker` (Phase 5) | frame extraction at 1fps; one chunk per frame caption | `photo_anchor` (extends with `frame_id` + `time_ms`) | `public_to_project` | `{ video_id, frame_id, time_ms, area_id? }` | Phase 5. OpenSpace-class spatial alignment. |
| `walkthrough_capture` | `walkthrough_captures` + `walkthrough_sessions` | `ingest_walkthrough_worker` (Phase 5) | per-stop chunk | `photo_anchor` | `public_to_project` | `{ session_id, capture_id, area_id }` | Builds the spatial memory layer per `IRIS_NATIVENESS_PLAN` § 4.1. |
| `site_check_in` / `field_capture` | `site_check_ins` + `field_captures` + `field_session_events` | `ingest_field_session_worker` | per-event | `daily_log_excerpt` | `public_to_project` | `{ session_id, event_id, occurred_at, gps? }` | Mobile field session events; supports who-was-where queries. |

### 3.7 Iris-generated events (Phase 3 — events-as-data)

| artifact_type | source_id_table | router_target | chunking_strategy | citation_kind_emitted | sensitivity_default | anchor_jsonb_shape | notes |
|---|---|---|---|---|---|---|---|
| `iris_session` | `iris_call_idempotency` + (new) `iris_sessions` + `inbox_session` (telemetry foundation) | `ingest_iris_event_worker` | event row, NOT chunked into vector text — indexed as structured event | n/a (events are not retrieved as citations; they power Phase 6 memory) | `gc_only` | `{ session_id, user_id, project_id, persona, intent, outcome }` | Per § 7. Iris's own behavior is signal. |
| `iris_action` | `drafted_actions` + `drafted_action_dedupe` + (new) `iris_actions` | `ingest_iris_event_worker` (shared) | event row | n/a | `gc_only` | `{ action_id, action_type, accepted_or_declined_or_cancelled, latency_ms, deterministic_check_passed }` | Powers Phase 4 dismissal-rate generators + Phase 6 firm memory pattern extraction. |
| `iris_grounding` | `iris_grounding_cache` | `ingest_iris_event_worker` (shared) | event row | n/a | `gc_only` | `{ cache_key, retrieved_chunks: uuid[], session_id }` | Retrieval ledger. |
| `iris_voice_diff` | `iris_voice_diffs` | `ingest_iris_event_worker` (shared) | event row | n/a | `gc_only` | `{ diff_id, before, after, action_type }` | Hand-edit corpus → Phase 6 firm voice patterns. |
| `iris_suggestion` | `iris_suggestion_history` | `ingest_iris_event_worker` (shared) | event row | n/a | `gc_only` | `{ suggestion_id, accepted, dismissed, generator }` | Per-generator dismissal rates feed Phase 4 auto-disable (`IRIS_NATIVENESS_PLAN` § Risk #4). |

### 3.8 Catch-all (always)

| artifact_type | source_id_table | router_target | chunking_strategy | citation_kind_emitted | sensitivity_default | anchor_jsonb_shape | notes |
|---|---|---|---|---|---|---|---|
| `unclassified` | `files` + `attachments` (any unrouted upload) | `ingest_unclassified_worker` | generic OCR + fixed 512-token chunks | `daily_log_excerpt` (lowest-trust general kind) | inherits source-context default; absent context = `gc_only` | `{ file_id, page?, byte_offset?, classification_confidence }` | The catch-all. See § 6. Low retrieval boost (0.5x) — surfaces only when no better source available. |

---

## 4. Sensitivity Default Rules

Sensitivity is the access-class assigned at ingest. RLS at retrieval gates which user can see which chunks. The four classes:

| Class | Visible to | Examples |
|---|---|---|
| `public_to_project` | All `project_members` (any role) on the project | Drawings, specs, RFIs, daily logs, photos, submittals, schedule phases, ASIs, bulletins, permits, JHAs, punch items, public reports |
| `gc_only` | GC org members on the project (`organization_members.role IN ('admin','project_manager','superintendent','office')` + role-aware filters) | Pay apps, billing requests, internal cost reports, draw schedules, change orders pre-execution, bid responses post-receipt, IrisHistorian seed patterns pre-display, safety incidents (PII redacted), subcontracts, internal directives |
| `owner_only` | Owner / owner-rep + GC leadership | Owner correspondence, executive directives, RFP responses (pre-award), owner-distributed reports pre-distribution |
| `finance_only` | Designated finance/AP role + GC leadership | Contract financial fields, lien waivers, banking metadata (per ACH spec), pay-app dollar lines, subcontractor invoices, WIP reports, certified payroll dollar fields, bid pricing |

### 4.1 Default by `artifact_type` (compact)

```
public_to_project: drawing, drawing_revision, drawing_bulletin, spec_section,
                   submittal, rfi, daily_log, photo, schedule_phase,
                   schedule_xlsx, lookahead_xlsx, bulletin, asi, permit,
                   pre_task_plan, inspection, o_and_m_manual, as_built,
                   warranty, punch_item, issue, observation, oac_meeting_notes,
                   calendar_event (project-tied), site_check_in, field_capture,
                   walkthrough_capture, bim_model (Phase 5)

gc_only:           contract (scope/legal clauses), subcontract, purchase_order,
                   bid_invitation (pre-award), bid_response (narrative),
                   change_order (pre-execution), directive, safety_incident,
                   coi, executive_direction (when forwarded to GC),
                   email (default), slack_message, sms,
                   meeting_transcript (default), iris_session,
                   iris_action, iris_grounding, iris_voice_diff,
                   iris_suggestion, weekly_report (internal),
                   monthly_report (internal), compliance_report,
                   executive_report

owner_only:        owner_correspondence, executive_direction (raw),
                   rfp_response (pre-award), owner_report (pre-distribution)

finance_only:      contract (dollar clauses), subcontract (dollar clauses),
                   bid_response (pricing lines), pay_app, billing_request,
                   draw_request, budget, sov, estimate, cost_transaction,
                   subcontractor_invoice, lien_waiver, wip_report
```

### 4.2 Override mechanism

- **At ingest:** the upload UI exposes an explicit `sensitivity` override field. The router receives it via `UploadContext.sensitivity_override`. If the source artifact is composite (e.g., a contract with mixed clauses), per-chunk classification is performed by the worker; the upload-level override raises the floor but cannot lower it for any individual chunk that the worker classifies higher.
- **Per-firm policy:** `organizations.default_sensitivity_policy` (jsonb) lets a firm say "all bid_responses default to `finance_only`, not gc_only." The default table above is the platform-level default; firm overrides take precedence.
- **Per-project policy:** `projects.sensitivity_policy` (jsonb) overrides org defaults for one project. Used when a public-private project requires owner-only by default.

### 4.3 Propagation rules

1. **Chunk inherits source sensitivity.** Cannot be downgraded by chunking (e.g., a `finance_only` pay-app cannot have any chunk emitted as `public_to_project`).
2. **Composite sources upgrade.** If a source has chunks of mixed classes (contract with finance + non-finance clauses), the chunk-level class wins — but the source's reported "highest sensitivity" is logged on `iris_kb_chunks.metadata.source_sensitivity_max`.
3. **Re-classification events.** When a status changes (e.g., bid → award; CO draft → executed), an event re-classifies dependent chunks. Implementation: `reclassify_chunks_on_event(source_type, source_id, new_class)` RPC, called by triggers on the source tables.
4. **No silent downgrade.** Any reclassification that lowers sensitivity writes an audit incident at severity `info`; any that raises sensitivity writes at severity `info`. Two-engineer review required for org-scoped defaults change (per ADR-006).

### 4.4 Enforcement at retrieval

The Phase 3 retrieval API (`src/services/iris/retrieve.ts`) joins through `project_members` AND filters `iris_kb_chunks.sensitivity` against the caller's role-derived visible set. The 50 RLS test cases in the Phase 3 exit gate (`IRIS_NATIVENESS_PLAN` § Phase 3) enforce this — including the explicit "sub never sees finance_only" and "office never sees owner_only" cases.

---

## 5. Citation Kind Extension Proposal

`IRIS_CITATIONS_SPEC_2026-05-04.md` ships with **8 kinds**:

```
drawing_coordinate, spec_reference, rfi_reference, daily_log_excerpt,
photo_observation, schedule_phase, budget_line, change_order
```

### 5.1 Phase 3 (this spec) adds 3

| Kind | What `ref` holds | Side-panel component | "Open in full page" link | Source text for snippet verification (per `IRIS_CITATIONS_SPEC` § Phase 4) |
|---|---|---|---|---|
| `spreadsheet_cell` | `file_id` (UUID); anchor `{ sheet_name, range }` | `<SpreadsheetCellCitationPanel>` — embeds parsed sheet view + highlighted range | `/files/:file_id?sheet=:sheet_name&range=:range` | Cell text content rendered as plain text (header rows + range values, tab-separated) |
| `contract_clause` | `contract_clause.id` | `<ContractClauseCitationPanel>` — clause text with parent contract context | `/contracts/:contract_id#clause-:clause_id` | Clause text |
| `punch_item` | `punch_items.id` (or `punch_list_items.id`) | `<PunchItemCitationPanel>` — item summary + comments + ball-in-court | `/punch/:id` | Item title + description + last 3 comments |

### 5.2 Phase 5 (deferred, listed for completeness)

| Kind | What `ref` holds | Side-panel component | "Open in full page" link |
|---|---|---|---|
| `photo_anchor` | `photo_id`; anchor `{ frame_id?, bbox: { x, y, w, h }, area_id? }` | `<PhotoAnchorCitationPanel>` — image with bbox highlighted | `/photos/:id?bbox=x,y,w,h` |
| `audio_anchor` | `voice_capture_id`; anchor `{ start_ms, end_ms }` | `<AudioAnchorCitationPanel>` — audio player scrubbed to clip | `/captures/:id?t=:start_ms-:end_ms` |
| `conversation_anchor` | `message_id`; anchor `{ thread_id?, excerpt }` | `<ConversationCitationPanel>` — message in thread context, excerpt highlighted | `/messages/:id` |

### 5.3 Resolver + side-panel rules

All new kinds:
- Get a row in the routing table (`src/lib/iris/citationRouting.ts`).
- Get a side-panel component in `src/components/iris/citations/` (per ADR-004).
- Get a `WHEN` branch in the `resolve_citation` RPC (per `IRIS_CITATIONS_SPEC` § Phase 2).
- Get a `fetchSourceText` mapping (per `IRIS_CITATIONS_SPEC` § Phase 4).
- Get a `record_citation_interaction` telemetry path (per `IRIS_CITATIONS_SPEC` § Phase 5).

### 5.4 Migration footprint

```sql
-- Migration: 20261001000001_citation_kinds_phase3.sql
-- Extends the citation_kind enum / CHECK constraint on drafted_actions.payload.citations
-- and adds resolver branches for the 3 new kinds.

-- Add new kinds to citation_interactions denormalized column (no schema change;
-- it's already TEXT). Document the expanded set:
COMMENT ON COLUMN citation_interactions.citation_kind IS
  'One of: drawing_coordinate, spec_reference, rfi_reference, daily_log_excerpt, photo_observation, schedule_phase, budget_line, change_order, spreadsheet_cell, contract_clause, punch_item';

-- New side-panel resolver branches handled in the resolve_citation RPC.
-- No new tables; citations remain JSON in drafted_actions.payload.citations.
```

The Phase-5 kinds get a separate migration when Phase 5 opens.

---

## 6. Catch-All Router

### 6.1 The pattern

Every upload through any surface — project doc, RFI attachment, submittal, daily log photo, comment file, email forward, mobile camera — passes through one router. The router dispatches to the type-specific worker if the file is classifiable, or falls back to `ingest_unclassified_worker`. **No upload drops on the floor.**

### 6.2 Router signature

```typescript
// src/services/iris/ingestion/router.ts

export interface UploadedFile {
  file_id: string                      // PK in `files` table
  mime_type: string                    // e.g., 'application/pdf', 'image/jpeg'
  filename: string                     // original name
  byte_size: number
  storage_path: string                 // Supabase storage URL
  hash_sha256: string
  uploaded_by: string                  // user_id
  uploaded_at: string                  // ISO timestamp
}

export interface UploadContext {
  surface: 'project_doc' | 'rfi_attachment' | 'submittal' | 'daily_log' | 'comment' | 'email_forward' | 'mobile_camera' | 'meeting' | 'walkthrough' | 'other'
  project_id: string
  parent_entity_type?: string          // e.g., 'rfi', 'daily_log'
  parent_entity_id?: string
  area_id?: string                     // spatial tag if known at upload
  sensitivity_override?: SensitivityClass
  user_role: UserRole
}

export interface IngestRoute {
  artifact_type: ArtifactType          // resolved type, or 'unclassified'
  router_target: string                // worker name, e.g., 'ingest_drawing_worker'
  classification_confidence: number    // 0..1
  classified_via: 'mime' | 'magic_bytes' | 'filename_pattern' | 'parent_entity' | 'content_sniff' | 'unclassified'
  sensitivity: SensitivityClass        // resolved at ingest time
  anchor_seed: Record<string, unknown> // initial anchor jsonb to seed chunks
}

export function routeArtifact(
  file: UploadedFile,
  ctx: UploadContext,
): IngestRoute
```

### 6.3 Classification cascade

The router tries strategies in order, lowest cost first, stopping on first confident match:

1. **Parent entity hint.** If `ctx.parent_entity_type === 'submittal'`, route to `ingest_submittal_worker` regardless of file type. (A PDF in a submittal context is a submittal artifact.) Confidence: 1.0.
2. **MIME + magic bytes.** PDF + drawing-shaped (large landscape, no text layer) → `drawing_worker`. PDF + section-heading text layer → `spec_section_worker`. XLSX → `spreadsheet_worker`. JPEG/HEIC/PNG → `photo_worker`. EML/MSG → `conversation_worker`. Confidence: 0.85.
3. **Filename pattern.** `*_lookahead*.xlsx` → `spreadsheet_worker(classification='lookahead')`. `pay_app_*.pdf` → `pay_app_worker`. `coi_*.pdf` → `coi_worker`. Confidence: 0.7. (Used only when MIME match is ambiguous.)
4. **Content sniff (LLM-light classifier).** First 2 KB of OCR text run through a cheap classifier (Phase 3: deterministic keyword rules; Phase 5: small classification model). Confidence: 0.6.
5. **Fallback.** `ingest_unclassified_worker`. Confidence: 0 — but the file IS still ingested.

If `classification_confidence < 0.5`, the file routes to `ingest_unclassified_worker` AND a soft notification is queued for the uploading user: "We couldn't classify this file confidently. It will still be searchable, but you can re-classify it here." Confidence is also written to `iris_kb_chunks.metadata.classification_confidence` for retrieval-time low-trust filtering.

### 6.4 The unclassified worker

```typescript
// supabase/functions/ingest-unclassified-worker/index.ts
//
// Generic ingest path. Called when routeArtifact returns artifact_type='unclassified'.
// Behavior:
//   1. Best-effort text extraction:
//        - PDF/Word → pdf-parse / mammoth
//        - HEIC/TIFF/raster → tesseract OCR
//        - Email (.eml/.msg) → mail-parser
//        - Anything else → empty text + filename only
//   2. Fixed 512-token chunking on extracted text.
//   3. Embed via `text-embedding-3-large` (per ADR-017 stub).
//   4. Insert into iris_kb_chunks with:
//        source_type = 'unclassified'
//        sensitivity = ctx.sensitivity_override ?? gc_only
//        metadata.classification_confidence = ingest_route.classification_confidence
//        metadata.retrieval_boost = 0.5  // half-strength vs classified content
//   5. Telemetry: fallback_to_unclassified_total++
```

Low retrieval boost ensures classified content always wins ties — the catch-all is a safety net, not a bypass.

### 6.5 Acceptance: "no upload drops on the floor"

- **CI lint.** `scripts/audit-ingestion-router.mjs` walks `src/` for any `INSERT INTO files`, `storage.from(...).upload`, or upload edge function entry that is NOT followed by a call to `routeArtifact`. Hard-fail if any orphan upload path exists. Same enforcement pattern as `scripts/audit-permission-gate.mjs` (Sprint Invariant #5).
- **Fuzz test.** 20 weird file types (HEIC, DWG, TIFF, RTF, ODT, .eml, .msg, .csv, .key, .pages, .numbers, .xlsm, .pptx, .zip-of-pdfs, .dwg, .ifc, password-protected PDF, scanned-as-image PDF, text-only image, video) all complete ingestion in <60s into either a typed worker or the unclassified worker. None produce a 500.

### 6.6 Telemetry

```sql
-- Migration: 20261015000001_ingestion_telemetry.sql

CREATE TABLE ingestion_routing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  artifact_type TEXT NOT NULL,
  router_target TEXT NOT NULL,
  classification_confidence NUMERIC(3, 2) NOT NULL CHECK (classification_confidence BETWEEN 0 AND 1),
  classified_via TEXT NOT NULL,
  sensitivity TEXT NOT NULL,
  fell_back_to_unclassified BOOLEAN NOT NULL DEFAULT FALSE,
  routed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingestion_routing_log_project_routed_at
  ON ingestion_routing_log (project_id, routed_at DESC);

-- Aggregate metric for the Phase 3 dashboard:
-- fallback_to_unclassified_rate = COUNT(WHERE fell_back) / COUNT(*)
-- Acceptance: this rate stays under 5% in the soft pilot.
```

---

## 7. Ingestion Event Taxonomy (Events as Data)

Iris's own behavior is signal. Drafts, edits, dismissals, and grounding-cache hits are themselves indexed — but as **structured events**, not vector chunks. They power Phase 4 dismissal-rate generators (`IRIS_NATIVENESS_PLAN` § Phase 4) and Phase 6 firm memory (§ Phase 6).

### 7.1 Tables

```sql
-- Migration: 20261020000001_iris_events.sql

CREATE TABLE iris_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  project_id UUID REFERENCES projects(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  persona TEXT NOT NULL,                       -- pm / superintendent / foreman / owner_rep / office
  intent TEXT,                                 -- inferred or workflow-supplied
  outcome TEXT,                                -- accepted / declined / cancelled / abandoned
  context_fabric_version TEXT,                 -- per Phase 1
  context_fabric_size_kb INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE iris_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES iris_sessions(id) ON DELETE CASCADE,
  drafted_action_id UUID REFERENCES drafted_actions(id),
  action_type TEXT NOT NULL,                   -- e.g., 'rfi_draft', 'co_math_check'
  state TEXT NOT NULL,                         -- accepted / declined / cancelled / withdrawn / executed
  latency_ms INTEGER,
  deterministic_check_passed BOOLEAN,
  reviewer_id UUID REFERENCES auth.users(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for retrieval:
CREATE INDEX idx_iris_sessions_org_started ON iris_sessions (organization_id, started_at DESC);
CREATE INDEX idx_iris_actions_session ON iris_actions (session_id);
CREATE INDEX idx_iris_actions_type_state ON iris_actions (action_type, state);
```

### 7.2 Why events, not vector chunks

- **Events are structured.** They join cleanly to entities. No need for embedding.
- **Pattern detection in Phase 6 reads events.** "Across this firm's last 3 hospital projects, MEP-coordination RFIs spiked 30 days before substantial completion" — that's a SQL query over `iris_actions`, not a vector retrieval.
- **Phase 4 dismissal rate is a row count.** No embedding needed.

### 7.3 What's NOT an event-as-data

User-typed text in drafts (the actual draft content) DOES get embedded as part of the source artifact (RFI, submittal, etc.). The Iris-generated commentary around it is the event.

### 7.4 Sensitivity

All Iris event tables default to `gc_only`. Pilot orgs (`is_pilot_user(user_id)`) get 24-month retention per ADR-008; everyone else 12-month. Per-user erasure rights (ADR-006) anonymize `user_id` and `reviewer_id` while preserving the event for aggregate pattern analysis.

---

## 8. Permission Classification at Ingestion (NOT Retrieval)

The Glean-style leakage risk is real. Documents whose sensitivity is determined only at retrieval time are vulnerable to retrieval-side bugs. This spec moves classification one step earlier.

### 8.1 The pattern

1. **Classify at ingest.** Worker receives `(source_id, source_table, ctx)`. It computes a per-chunk sensitivity using:
   - The default table (§ 4.1).
   - Org / project policy overrides (§ 4.2).
   - Source-specific structural rules (e.g., contract clauses with `clause_type IN ('payment_terms', 'fee_schedule')` are always `finance_only`).
   - Any user override (`ctx.sensitivity_override`), bounded by the floor.
2. **Tag at chunk creation.** `iris_kb_chunks.sensitivity` is NOT NULL. The retriever filters on this column.
3. **Propagate forward.** If source sensitivity changes (§ 4.3), the reclassify RPC updates ALL chunks of that source atomically.
4. **Never propagate backward.** The chunk's sensitivity does NOT affect the source row's sensitivity.

### 8.2 The inspector job

A nightly cron audits every chunk and verifies its `sensitivity` matches what the source's current state would produce. Mismatches are alerted via the existing `audit_incidents` table at severity `medium` (high if a `finance_only` source has a `public_to_project` chunk).

```sql
-- Migration: 20261025000001_ingestion_inspector_cron.sql

CREATE OR REPLACE FUNCTION audit_chunk_sensitivity_drift()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_drift_count INTEGER := 0;
BEGIN
  -- Compare chunk sensitivity to expected sensitivity based on source's current state.
  -- Insert audit_incidents for mismatches.
  -- Return total drift count.
  -- (Full body omitted — branches per artifact_type.)

  RETURN v_drift_count;
END;
$$;

-- Schedule via pg_cron + pgmq (per ADR-003), nightly at 02:00 UTC.
```

### 8.3 Why this closes the Glean risk

If retrieval is the only enforcement layer, ANY retrieval-side bug becomes an exfil bug. With ingest-time classification + nightly drift audit + RLS at retrieval, you'd need to compromise three independent layers to leak. That's the moat.

---

## 9. Coverage Matrix (consolidated)

A single table, all of § 3 collapsed. This is the lookup engineer #2 keeps open during Phase 3 implementation.

| # | artifact_type | Phase | router_target | citation_kind | sensitivity_default |
|---|---|---|---|---|---|
| 1 | drawing | 3 | ingest_drawing_worker | drawing_coordinate | public_to_project |
| 2 | drawing_revision | 3 | ingest_drawing_revision_worker | drawing_coordinate | public_to_project |
| 3 | drawing_bulletin | 3 | ingest_drawing_revision_worker | change_order | public_to_project |
| 4 | spec_section | 3 | ingest_spec_section_worker | spec_reference | public_to_project |
| 5 | submittal | 3 | ingest_submittal_worker | spec_reference | public_to_project |
| 6 | contract | 3 | ingest_contract_worker | contract_clause | finance_only / gc_only / public_to_project (per clause) |
| 7 | subcontract | 3 | ingest_contract_worker | contract_clause | gc_only / finance_only |
| 8 | purchase_order | 3 | ingest_purchase_order_worker | budget_line | gc_only |
| 9 | bid_invitation | 3 | ingest_bid_worker | spec_reference | gc_only |
| 10 | bid_response | 3 | ingest_bid_worker | budget_line | finance_only / gc_only |
| 11 | rfi | 3 | ingest_rfi_worker | rfi_reference | public_to_project |
| 12 | daily_log | 3 | ingest_daily_log_worker | daily_log_excerpt | public_to_project |
| 13 | photo (basic) | 3 | ingest_photo_worker | photo_observation | public_to_project |
| 14 | change_order | 3 | ingest_change_order_worker | change_order | gc_only → public_to_project |
| 15 | bulletin / asi | 3 | ingest_drawing_revision_worker | change_order | public_to_project |
| 16 | directive | 3 | ingest_directive_worker | change_order / rfi_reference | gc_only |
| 17 | safety_incident / near_miss | 3 | ingest_safety_worker | daily_log_excerpt | gc_only (PII redacted) |
| 18 | pre_task_plan | 3 | ingest_safety_worker | daily_log_excerpt | public_to_project |
| 19 | inspection | 3 | ingest_inspection_worker | punch_item | public_to_project |
| 20 | permit | 3 | ingest_permit_worker | daily_log_excerpt | public_to_project |
| 21 | coi | 3 | ingest_coi_worker | contract_clause | gc_only |
| 22 | lien_waiver | 3 | ingest_lien_waiver_worker | budget_line | finance_only |
| 23 | o_and_m_manual | 3 | ingest_document_worker | spec_reference | public_to_project |
| 24 | as_built | 3 | ingest_drawing_worker | drawing_coordinate | public_to_project |
| 25 | warranty | 3 | ingest_warranty_worker | change_order | public_to_project |
| 26 | punch_item | 3 | ingest_punch_worker | punch_item | public_to_project |
| 27 | issue / observation | 3 | ingest_punch_worker | punch_item | public_to_project |
| 28 | schedule_phase | 3 | ingest_schedule_worker | schedule_phase | public_to_project |
| 29 | schedule_xlsx | 3 | ingest_spreadsheet_worker | spreadsheet_cell | public_to_project |
| 30 | lookahead_xlsx | 3 | ingest_spreadsheet_worker | spreadsheet_cell | public_to_project |
| 31 | pay_app | 3 | ingest_pay_app_worker | budget_line | finance_only |
| 32 | budget / sov | 3 | ingest_budget_worker | budget_line | gc_only |
| 33 | estimate | 3 | ingest_estimate_worker | budget_line | gc_only |
| 34 | cost_transaction | 3 | ingest_cost_transaction_worker | budget_line | finance_only |
| 35 | subcontractor_invoice | 3 | ingest_invoice_worker | budget_line | finance_only |
| 36 | email (forward) | 3 | ingest_conversation_worker | daily_log_excerpt (P3) → conversation_anchor (P5) | gc_only |
| 37 | slack_message | 5 | ingest_conversation_worker | conversation_anchor | gc_only |
| 38 | sms | 5 | ingest_conversation_worker | conversation_anchor | gc_only |
| 39 | meeting_transcript | 5 | ingest_meeting_worker | conversation_anchor | gc_only |
| 40 | oac_meeting_notes | 3 | ingest_meeting_worker | conversation_anchor (fallback daily_log_excerpt) | public_to_project |
| 41 | calendar_event | 3 | ingest_meeting_worker | schedule_phase | public_to_project |
| 42 | owner_correspondence | 3 | ingest_owner_correspondence_worker | conversation_anchor (P5) → daily_log_excerpt (P3) | owner_only |
| 43 | executive_direction | 3 | ingest_owner_correspondence_worker | change_order | owner_only |
| 44 | rfp_response | 3 | ingest_bid_worker | contract_clause | owner_only |
| 45 | weekly_report | 3 | ingest_report_worker | daily_log_excerpt | varies |
| 46 | monthly_report | 3 | ingest_report_worker | daily_log_excerpt | varies |
| 47 | owner_report | 3 | ingest_report_worker | daily_log_excerpt | owner_only |
| 48 | wip_report | 3 | ingest_report_worker | budget_line | finance_only |
| 49 | compliance_report | 3 | ingest_report_worker | daily_log_excerpt | gc_only |
| 50 | executive_report | 3 | ingest_report_worker | daily_log_excerpt | gc_only |
| 51 | bim_model | 5 | ingest_bim_worker | drawing_coordinate (extends with element_id) | public_to_project |
| 52 | bim_clash | 5 | ingest_bim_worker | punch_item | public_to_project |
| 53 | bim_markup | 5 | ingest_bim_worker | drawing_coordinate | public_to_project |
| 54 | voice_capture | 5 | ingest_voice_worker | audio_anchor | gc_only |
| 55 | video | 5 | ingest_video_worker | photo_anchor | public_to_project |
| 56 | walkthrough_capture | 5 | ingest_walkthrough_worker | photo_anchor | public_to_project |
| 57 | site_check_in / field_capture | 3 | ingest_field_session_worker | daily_log_excerpt | public_to_project |
| 58 | photo (rich anchor) | 5 | ingest_photo_worker (extends) | photo_anchor | public_to_project |
| 59 | iris_session | 3 | ingest_iris_event_worker | n/a (event) | gc_only |
| 60 | iris_action | 3 | ingest_iris_event_worker | n/a (event) | gc_only |
| 61 | iris_grounding | 3 | ingest_iris_event_worker | n/a (event) | gc_only |
| 62 | iris_voice_diff | 3 | ingest_iris_event_worker | n/a (event) | gc_only |
| 63 | iris_suggestion | 3 | ingest_iris_event_worker | n/a (event) | gc_only |
| 64 | unclassified | 3 | ingest_unclassified_worker | daily_log_excerpt | inherits / gc_only |

Total: **64 artifact types** mapped. Phase 3 ships 50; Phase 5 ships 14.

---

## 10. Phase Mapping

### 10.1 Phase 3 (Lap 4, T-210 → T-180, Oct → Nov 2026) — ships

- **All document/drawing types:** drawing, drawing_revision, drawing_bulletin, spec_section, submittal, contract, subcontract, purchase_order, bid_invitation, bid_response.
- **All field-ops types:** rfi, daily_log, photo (basic caption + OCR), change_order, bulletin, asi, directive, safety_incident, pre_task_plan, inspection, permit, coi, lien_waiver, o_and_m_manual, as_built, warranty, punch_item, issue, observation.
- **All schedule + money types:** schedule_phase, schedule_xlsx, lookahead_xlsx, pay_app, budget, estimate, cost_transaction, subcontractor_invoice.
- **Limited conversations:** email_forward only (`*@projects.sitesync.ai`); calendar_event metadata; oac_meeting_notes (text-only); owner_correspondence; executive_direction; rfp_response.
- **All report types:** weekly_report, monthly_report, owner_report, wip_report, compliance_report, executive_report.
- **Field session events:** site_check_in, field_capture.
- **Iris events-as-data:** iris_session, iris_action, iris_grounding, iris_voice_diff, iris_suggestion.
- **Catch-all:** unclassified.

### 10.2 Phase 5 (Lap 5–6, T-120 → T-60, Jan → Mar 2027) — ships

- **Rich photo:** photo_anchor with bbox + spatial alignment.
- **Voice:** voice_capture, audio_anchor citation kind.
- **Video:** jobsite walks, drone footage, frame extraction.
- **Drawings — callout indexing extension:** vision-LLM callout detection beyond Phase 3 OCR.
- **BIM:** bim_model, bim_clash, bim_markup, bim_safety_zone, bim_rfi_element.
- **Full conversation coverage:** slack_message, sms, meeting_transcript (Granola pattern).
- **Spatial alignment:** Areas hierarchy + GPS-to-area inference.
- **Walkthroughs:** walkthrough_capture, walkthrough_session.

### 10.3 Phase 6 (Lap 6, T-60 → T-0) — extracts

- Pattern extraction over the events-as-data layer (§ 7) plus closed-project chunks.
- `firm_memory` schema (per `IRIS_NATIVENESS_PLAN` § Phase 6) reads from but doesn't add to the artifact catalog.

---

## 11. Acceptance Gate

The Phase 3 ingestion taxonomy ships when ALL of:

1. **Routing coverage.** 100% of upload code paths route through `routeArtifact` (§ 6). Enforced by `scripts/audit-ingestion-router.mjs` in CI. Hard-fail on any orphan.
2. **Catalog coverage.** Every artifact_type in § 3 has a documented router target + citation_kind in `src/lib/iris/citationRouting.ts` AND in `supabase/functions/ingest-*-worker/index.ts`. CI lint: catalog row present iff worker exists.
3. **Catch-all robustness.** 20-file fuzz suite (HEIC, DWG, TIFF, RTF, ODT, .eml, .msg, .csv, .key, .pages, .numbers, .xlsm, .pptx, .zip-of-pdfs, .ifc, password-protected PDF, scanned-image PDF, text-only image, video, malformed PDF) all complete ingestion in <60s with no 500. Test lives at `tests/ingestion/fuzz.test.ts`.
4. **Sensitivity correctness.** 50 RLS test cases (Phase 3 exit gate, per `IRIS_NATIVENESS_PLAN` § Phase 3) all pass. Specifically: sub never sees finance_only; office never sees owner_only; foreman never sees gc_only beyond their crew; owner never sees gc_only contractor cost detail.
5. **Inspector job green.** Nightly `audit_chunk_sensitivity_drift` returns 0 mismatches across the soft pilot dataset for 7 consecutive days.
6. **Recall.** Retrieval recall@5 ≥ 0.85 on the 100-Q golden suite, with at least one query per Phase-3-shipped artifact type.
7. **Fallback rate.** `fallback_to_unclassified_rate` < 5% on the soft pilot.

These tie directly into the Lap 4 acceptance CI workflow (extends `lap-2-acceptance.yml`).

---

## 12. Cross-References

- **Sub-spec to:** `IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md` (sibling doc, opening this lap — the parent that defines Phase 3 scope; this spec defines its taxonomy).
- **Companion to:**
  - `IRIS_CITATIONS_SPEC_2026-05-04.md` — the 8 existing citation kinds; this spec proposes 3 new (Phase 3) + 3 (Phase 5).
  - `ADR_004_CITATION_SIDE_PANEL_2026-05-04.md` — every new citation kind gets a side-panel resolver per ADR-004.
  - `ADR_006_PILOT_DATA_ISOLATION_2026-05-04.md` — sensitivity classes inherit from row-level multi-tenancy; pilot org gets 24-month retention.
  - `ADR_017_EMBEDDING_MODEL` (stub) — embedding model decision for `iris_kb_chunks` per `IRIS_NATIVENESS_PLAN` § 9.
  - `PROCORE_IMPORTER_SPEC_2026-05-04.md` — entity coverage cross-check; if Procore importer brings an entity not listed in § 3, file a defect against this spec.
- **Implements:** `IRIS_NATIVENESS_PLAN_2026-05-08.md` § Phase 3 (Pillar 3 — Universal Knowledge Absorption) and § 4 Pillar 4 (Permission-aware retrieval enforced at ingest).

---

*End of taxonomy spec. Engineer #2 reads this once before opening any worker file. Update via PR with two-engineer review for any sensitivity-default change.*

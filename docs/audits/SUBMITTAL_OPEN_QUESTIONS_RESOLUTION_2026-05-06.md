# Submittals — Open Questions Resolved

**Date:** 2026-05-06
**Decided by:** Walker
**Resolves:** Part 12 of `SUBMITTALS_MODULE_BUILD_SPEC_2026-05-06.md`
**Unblocks:** P2 (D50–D56) — these decisions are inputs to the magic-link reviewer flow, the stamp PDF generator, and the pre-flight engine.

---

## Decisions

### 1. Default review-code set → **Let user pick at project setup. No default.**

- New-project wizard adds a "Submittal Review Codes" step.
- Three preset choices in the wizard: EJCDC 6-code, AIA 5-code, UFGS Approving-Authority. Plus "Custom" (admin builds their own).
- The wizard is **mandatory** — no project can have submittals without picking. Default codeset stored in `submittal_settings.codeset`; cannot be null.
- Implementation: build the wizard step in P0-D39 (log surface) so projects created during P0–P1 don't end up in a half-state.
- The spec's reference implementation suggests EJCDC for the project-templates dropdown's first position — engineer-preferred and legally cleanest, but no auto-default.

### 2. AI pre-flight default behavior on P0 findings → **Warn but don't block.**

- Iris surfaces findings with fix-it actions; PE can still forward.
- Track `iris_preflight_overridden` as a telemetry event on every override.
- After 60 days of pilot data, revisit whether to ship a hard-block opt-in per project.
- `submittal_settings.ai_preflight_block_threshold` ships set to `null` (= warn only); the column exists for the future opt-in.

### 3. License-seal cache scope → **Per architect, org-wide, with revocation.**

- Cache keyed on `architect_email_hash` × `gc_org_id`.
- Architect can revoke their seal from the reviewer portal (`review.sitesync.com/seal-management/:token`).
- Stored encrypted at rest in Supabase Vault.
- Each use logs a `seal_use` event with project_id + submittal_id for audit.
- 12-month TTL on the cache entry; refresh on next reviewer login.

### 4. Federal / UFGS mode → **Punt to Lap 3.**

- Pull task #17's federal-mode work (D68) out of P4 scope.
- Keep `submittals.is_federal` column and `submittal_settings.is_federal` toggle in the P0-D36 canonical migration so the schema is forward-compatible. Don't wire UI / codeset / WH-347 / DBE-MBE in Lap 2.
- New task created (will add): "P-Lap3 Federal/UFGS mode build-out" — scoped for whenever a federal-leaning customer becomes a real lead.
- Soft pilot at Nexus (Brad Cameron) + Carleton is commercial; no impact.

### 5. Iris memory scope → **Per-org for soft pilot. Industry-wide opt-in later.**

- During soft pilot: `iris_pattern_search.scope = 'org'` — Iris only sees the GC's own past submittals + the GC's own submittal-history vector index.
- Post-pilot: ship an `iris_industry_patterns` opt-in toggle in `submittal_settings`. When on, anonymized embeddings (sub name hash + product type + disposition) flow into a shared index.
- Anonymization layer: any industry-wide pattern Iris surfaces strips the source GC name; replaces sub name with a sub-type bucket; replaces project name with a project-size bracket.
- SOC 2 implication: schedule a privacy-review milestone before flipping the industry-wide opt-in on for the first non-soft-pilot customer.

---

## Spec deltas

The following edits were made to `SUBMITTALS_MODULE_BUILD_SPEC_2026-05-06.md` on 2026-05-06 reflecting these decisions:

- Part 3.2 — `submittal_settings.codeset` no longer has a default value (`not null` enforced via project-setup wizard, not column default).
- Part 6 — added project-setup wizard step for codeset picker.
- Part 10 — Phase P4 federal-mode scope (D68) moved to Lap 3.
- Part 12 — replaced "Open questions" section with "Resolved questions" pointer to this doc.

---

## Receipts

- Resolution captured here on 2026-05-06.
- Approving party: Walker.
- Source spec: `SUBMITTALS_MODULE_BUILD_SPEC_2026-05-06.md`.
- Task closed: TaskList #19.

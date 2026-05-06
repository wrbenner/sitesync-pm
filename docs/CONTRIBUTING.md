# Contributing to the SiteSync PM Documentation

These rules apply to every doc under `docs/`. They exist because the documentation is the contract between the codebase and the people running it. If a doc says a feature works a certain way, an on-call engineer or an auditor will treat that as fact.

## The cite-or-omit rule

Every functional or operational claim in a doc must cite the file that implements it. The forms accepted by [scripts/check-doc-links.ts](../scripts/check-doc-links.ts) are:

- A markdown link with a relative path: `[g702Audited.ts](../src/lib/payApp/g702Audited.ts)`
- An inline-code path: `` `src/lib/payApp/g702Audited.ts` ``
- An inline-code path with a line reference: `` `src/lib/payApp/g702Audited.ts:42` ``

If you cannot cite, omit the claim. Do not paraphrase what a feature "should do" — describe only what the cited file actually does.

## What counts as a citation

The cited file must exist on disk in this repo. The link checker resolves every cite and exits non-zero on the first miss. Acceptable roots are `src/`, `supabase/`, `scripts/`, `docs/`, `public/`, and `e2e/`.

External URLs (`https://`, `mailto:`, `#anchor`) are not validated and not required to exist.

## Distinguishing shipped from wiring-pending

Several earlier-wave docs (see [STATUS.md](STATUS.md)) ship pure libraries and edge functions but leave the route registration or call-site mount to a follow-up. When you describe such a feature, mark its state explicitly:

- **Shipped end-to-end** — the user-visible flow works in the deployed app
- **Shipped behind a wiring gate** — the implementation exists but a route registration in `src/App.tsx` or a service-layer call is still pending
- **Stubbed** — UI exists without wired backend; do not document as a feature

Cross-reference the originating wave's "Wiring Required" or "Failure modes deferred" section, e.g., [PLATINUM_WORKFLOWS.md](PLATINUM_WORKFLOWS.md).

## Tone and style

- Plain declarative prose. Marketing copy lives in [business/DEMO_SCRIPT.md](business/DEMO_SCRIPT.md) and [business/COMPETITIVE.md](business/COMPETITIVE.md).
- ATX headings (`# / ## / ###`). No setext underlines.
- Code blocks for command-line snippets and inline code samples.
- Tables for matrices (role × permission, tier × feature, control × evidence).
- Filename references in backticks. Cross-reference clickable links use the standard markdown form: a label in square brackets followed by a relative path in parentheses.

## Honesty gate

- Read [HONEST_STATE.md](../HONEST_STATE.md) before writing about any product capability. If a feature is flagged "not built" or "stub" there, it is not a feature in the user guide.
- Do not invent prices in [business/PRICING.md](business/PRICING.md). Tier names are fixed; SKU numbers are TBD.
- Do not claim certifications. The compliance docs describe controls and evidence aligned with audit frameworks; SOC 2 attestation requires an actual auditor visit.
- SLA targets in [business/SLA.md](business/SLA.md) are commitments-in-design, not contractual unless an organization has signed an enterprise agreement.

## Adding a new doc

1. Decide the home directory: `admin/`, `users/`, `business/`, `operations/`, `compliance/`, or top-level.
2. Add the file. Every claim must cite a real file in the repo.
3. Add the doc to the table of contents in [README.md](README.md).
4. Run `npx tsx scripts/check-doc-links.ts` locally — it must exit 0.
5. Open a PR. The [docs-check](../.github/workflows/docs-check.yml) workflow will re-run the link checker.

## Updating an existing doc

- Preserve the original "Wiring Required" and "Known Limitations" sections if the wiring is still incomplete. Removing a caveat without removing the underlying limitation creates a documentation lie.
- When you change a citation, run the link checker before committing.

## Regenerating the engineering reference

The auto-generated section in [README.md](README.md) is bounded by `<!-- AUTO:engineering-reference:start -->` and `<!-- AUTO:engineering-reference:end -->`. Regenerate it with:

```
npx tsx scripts/generate-doc-index.ts > /tmp/eng-ref.md
```

then paste the contents between the markers. The script walks `src/lib/`, `src/services/`, `supabase/functions/`, and `supabase/migrations/` and extracts the first comment block from each file.

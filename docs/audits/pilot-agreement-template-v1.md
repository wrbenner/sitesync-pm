# SiteSync Soft Pilot Agreement — TEMPLATE v1

**Template version:** v1 (2026-05-04)
**Authority:** `docs/audits/SOFT_PILOT_PLAYBOOK_2026-05-04.md` § Phase 2
**Companion:** `docs/audits/ADR_006_PILOT_DATA_ISOLATION_2026-05-04.md`, `docs/audits/ADR_008_TELEMETRY_RETENTION_2026-05-04.md`

---

## Important — how to use this template

Replace every `<<…>>` placeholder. Send the rendered version to the GC's signing party. Once countersigned:

1. Save the signed PDF to `docs/audits/pilot-agreements/<gc-slug>-<yyyy-mm-dd>.pdf`
2. Insert a row into `pilot_agreements` via `scripts/provision-pilot-org.ts` with `--agreement-text-version=v1`
3. Set `organizations.is_soft_pilot = TRUE`, `soft_pilot_started_at = NOW()`, `soft_pilot_agreement_signed_at = NOW()`
4. Provision the 4 named pilot users + their RBAC

**This is NOT a SaaS contract.** It's a one-page statement of what we're doing for two weeks. If the GC's general counsel marks it up into a 12-page MSA, treat that as a flag — escalate to backup GC per the playbook.

---

# SiteSync Soft Pilot Agreement — <<GC Name>>

**Pilot start:** <<date>>
**Pilot end:** <<date + 14 days>>
**Pilot users (the 4):**
1. <<Name>> — <<email>> — Project Manager
2. <<Name>> — <<email>> — Project Manager
3. <<Name>> — <<email>> — Superintendent
4. <<Name>> — <<email>> — Superintendent

**Pilot project:** <<project name + address>>
**Named decision-maker (Day 14 stay-or-go call):** <<Name + role>>

---

## What <<GC Name>> gets

1. **Free use of SiteSync + Iris** on the pilot project for 14 days. No charge during pilot. No charge afterward unless you choose to continue (separate conversation, separate paper).
2. **Walker on-site Day 1** in person, plus virtually available 24/7 during the pilot window via phone, text, and Slack (pilot-only channel).
3. **A daily 5:30 PM standup** call with the pilot team. 15 minutes. Bugs reported by 5:30 PM are fixed by 8 AM the next day OR Walker sends a written note before 7 AM explaining (a) what's blocking, (b) when it will ship, (c) what mitigation the user does in the meantime. Walker never goes silent on a reported issue.
4. **Full export of all pilot data** in CSV at pilot end (or any time on request). Includes drafted actions, decisions, citations, audit chain.
5. **Decision-grade audit chain** on every action — exportable as a PDF with a SHA-256 hash chain that's deposition-defensible.

## What <<GC Name>> commits

1. The 4 named users **use SiteSync for their day-to-day work** on the pilot project for 14 days. **Instead of** existing tools where SiteSync covers the same workflow — not in addition. The point of the pilot is to learn whether SiteSync can carry the load.
2. **Daily 5:30 PM standup attendance** (15 min, can be phone). Missing a single day is fine; missing 3 in a row triggers a check-in call.
3. **Honest feedback.** Including the moments where Iris is wrong. The pilot is pointless if the team rubber-stamps Iris's drafts to be polite.
4. **One named PM (above) makes the final stay-or-go call at Day 14.** The decision is binding for both parties.

## What we ask permission to record

- Every Iris draft created, edited, approved, or rejected — always attributed to the user, never anonymized within the audit chain.
- **Time-to-decide** telemetry per draft: when the draft first appeared on screen, when the user decided, how long that was.
- **Decision method** per draft: keyboard shortcut vs. mouse click vs. (later) voice.
- **Citation click-through**: which citations the user opened before deciding.
- **Inbox session identity**: a per-inbox-mount UUID that lets us answer "how many drafts did the user decide in one sitting" without joining to anything that could leak.

This data is retained for **24 months** from the decision date for pilot accounts (vs. 12 months default elsewhere). At the end of 24 months, your identity is removed and the underlying decision facts are kept anonymous. (See ADR-008 for the routine.) You may request erasure of your personal identifiers at any time by contacting Walker; we honor the request within 7 business days.

**One representative aggregate quote may appear in a future case study, with <<GC Name>>'s explicit written approval.** No quote, ever, without that approval. We will draft any potential quote, share it with you, and wait for written sign-off before any public use.

## What stays inside <<GC Name>>'s environment forever

- Your project documents (drawings, RFIs, daily logs, pay apps, photos, schedule, budget).
- Your contract details. Your pricing. Your sub list. Your rates.
- Anything you mark **confidential** in the UI (a redact action exists; redacted content is excluded from telemetry, citations, and audit-chain export bodies — only the redaction *event* is recorded for chain integrity).

These never leave your tenant. RLS enforces this at the database level. We can produce a copy of the RLS policies for your security review if your CISO asks.

## Right to walk

Either party may end the pilot at any time with **24-hour notice**. Data export delivered within 48 hours of termination. No refund or payment owed by either party for ending early.

If <<GC Name>> ends the pilot, all pilot user accounts are deactivated, the pilot org is locked from further writes, and the data export is delivered to <<signing party>> via secure link.

If SiteSync ends the pilot, we deliver the same export and write a Day-N receipt explaining what triggered the early end. We never end a pilot for "convenience" — only for the documented exit-criteria reasons in the playbook (audit-chain break, real-world harm, observed pilot-collapse signals).

## Limitation of liability

- During pilot, SiteSync's total liability is **capped at the cost of <<GC Name>>'s internal time spent on the pilot, not to exceed $10,000.**
- Iris drafts are drafts. Every action is approved by a human before any side effect happens. SiteSync is not liable for actions <<GC Name>> approved that turn out wrong. The audit chain shows who approved what; that's the line.
- SiteSync indemnifies <<GC Name>> against third-party IP claims arising from the SiteSync software itself (excluding <<GC Name>>'s data). Standard SaaS-style indemnification language; full text available on request.

## Governing law

Texas. Disputes resolved by good-faith conversation first; binding arbitration in Dallas County if conversation fails.

---

| | |
|---|---|
| Signed by: | _______________________ |
| Title:      | _______________________ |
| Date:       | _______________________ |
| For:        | <<GC Name>> |

| | |
|---|---|
| Signed by: | _______________________ |
| Title:      | Founder, SiteSync |
| Date:       | _______________________ |
| For:        | SiteSync, Inc. |

---

## Internal note (NOT included in the version sent to the GC)

After signing:

```sh
npx tsx scripts/provision-pilot-org.ts \
  --org-slug=<gc-slug> \
  --signed-by-name="<<Name>>" \
  --signed-by-email=<<email>> \
  --signed-at=<<iso ts>> \
  --agreement-text-version=v1 \
  --pdf-url=<<https://...>> \
  --pilot-user-ids=<<uuid>>,<<uuid>>,<<uuid>>,<<uuid>>
```

The script flips `is_soft_pilot=TRUE`, inserts the `pilot_agreements` row, and prints the next-step smoke commands.

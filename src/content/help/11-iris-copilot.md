# What is the AI Copilot?

Iris is the AI layer that drafts RFIs, submittals, daily logs, and follow-ups. The point isn't replacement — it's removing the blank page.

## What Iris drafts

- RFI bodies (from drawings, photos, prior RFIs)
- Submittal cover sheets
- Daily log sections
- Follow-up tasks when something slips

## What Iris does NOT do

- Approve anything on its own
- Send to anyone outside your team without your click
- Run on data outside your project
- Train on your data (LLM providers process per-call only; no fine-tuning)

## The audit chain

Every draft is hash-chained to the source data + the model fingerprint + the timestamp. You can reconstruct who saw what when, in deposition-grade detail. See [How does the audit chain work?](/help/audit-chain).

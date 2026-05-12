# How does the audit chain work?

Every action in SiteSync writes a row to the audit log. Each row hashes the previous row's hash plus its own content — so any tampering breaks the chain at that point and is detectable.

## What's captured

- Who took the action (user id + email at time of action)
- What they did (create, update, delete, approve, etc.)
- Before and after state (jsonb)
- For AI drafts: model fingerprint + provider + token counts + citations
- Wall-clock timestamp

## What you can prove

- That a draft was created at a specific moment
- That a specific person approved it
- That no one quietly edited it after approval
- That the underlying data hasn't been tampered with

## Export

Settings → Compliance → Export Audit Pack creates a sealed PDF with the full chain plus the verification key. Acceptable as evidence in arbitration and (per counsel review) in litigation.

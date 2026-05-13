# BRT — Pricing Decision

**Decision:** Monthly per-user seat price for the Starter plan.

| Source | Quoted price |
|---|---|
| `SiteSync_Board_Master_Brief.md` §9.2 | **$400** |
| Current `plans` seed (live DB) | **$499** |

The two are inconsistent. Pick one, then update the other to match.

**Recommendation: $400.** Brief §9.2 is the canonical pricing reference reviewed at the board level. The $499 in the seed was likely a placeholder from an earlier modeling pass that wasn't reconciled when the brief landed.

If $400 is correct: I'll update `supabase/migrations/<timestamp>_align_plans_pricing.sql` to set Starter at $400 and apply via MCP. Live `plans.starter.monthly_price_cents` becomes `40000`.

If $499 is correct: I'll update Brief §9.2 to match (a planning-doc edit, no migration).

---

## Walker decision

```
[ ] $400 (recommended — brief is canonical)
[ ] $499 (current seed)
[ ] Other: ____________

Initials:  __________   Date: 2026-05-__
```

When signed, Claude Code:
1. Updates the plans table on live (via MCP) to match.
2. Updates the on-disk seed migration to match.
3. Updates the discrepant source doc to match.
4. Files a one-line follow-up in this doc confirming the change.

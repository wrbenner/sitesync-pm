---
name: Loop-detected bug
about: Auto-opened by the functional-frog self-heal loop when it hits an unfixable failure
title: "[loop] <suite> · <test> failing — needs decision"
labels: ["loop-detected", "needs-triage"]
assignees: ["wrbenner"]
---

## Source

- **Loop iteration:** <N>
- **Discovered at:** <ISO 8601 timestamp>
- **CI run:** <link to gh actions run that surfaced this>
- **Failing test(s):** `<path/to/spec.ts:line>` × <count>

## Failure class

One of: `selector-aligner` / `migration-applier` / `platform-diagnoser` / `codegen-author` / `gate-tuner` / `unfixable`

If `unfixable`: a fix-agent tried for <M> attempts and failed. Quarantined in `.agent/loop-state.json.quarantined`.

## Repro

Minimum repro from the staging or prod session.

```
1. <step>
2. <step>
3. <observed result>
4. <expected result>
```

## Error signature

```
<stack trace or test output, redacted of secrets>
```

## Hypothesis

What the loop thinks is wrong:

- Root cause: …
- Why it can't be auto-fixed: …
- What the fix probably looks like: …

## Suggested next steps

1. <concrete action Walker can take>
2. <or, if loop should retry under different conditions:>
3. <e.g., "rerun after migration X is applied to prod">

## Decision needed from Walker

A specific question or choice — keep this section to 1–3 lines, no rambling.

## Auto-unquarantine condition

The loop will re-attempt this test class when:

- [ ] A new commit lands on main that touches `<files>`
- [ ] A new migration lands matching pattern `<>`
- [ ] Walker comments `/loop retry` on this issue

---

_This issue was opened automatically by the functional-frog self-heal loop. Full plan: `~/.claude/plans/fix-everything-and-keep-compiled-sky.md`._

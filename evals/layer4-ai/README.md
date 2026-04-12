# Layer 4 — AI Evaluation Tests

## Purpose

Layer 4 tests validate the AI policy layer: grounding (AI outputs reference real
data), citation accuracy, hallucination detection, and trust tagging compliance.

## Status: PLACEHOLDER

All Layer 4 tests are placeholders. They define expected behavior and will be
activated once the following prerequisites are met:

1. **AI policy layer** implemented (DOMAIN_KERNEL_SPEC.md §11)
2. **AI agent actions table** populated with test scenarios
3. **Trust tagging** implemented on AI-generated fields (§6.4)
4. **AI agents** configured with test project data
5. **Grounding infrastructure** — AI responses reference real project entities

## Gold-Standard Fixtures Covered

| Fixture | Test File | Description |
|---------|-----------|-------------|
| #17 — AI Agent Requires Approval | `test_trust_tagging.ts` | AI action stays pending until human approves |

## Test Files

| File | What it tests | Status |
|------|---------------|--------|
| `test_grounding.ts` | AI outputs reference real entities | Placeholder |
| `test_citation.ts` | AI citations are accurate and verifiable | Placeholder |
| `test_hallucination.ts` | AI does not fabricate entities/data | Placeholder |
| `test_trust_tagging.ts` | trust_level tags on AI-generated fields | Placeholder |

## Running

```bash
# Via the runner (reports as skipped):
../run-evals.sh --layer 4

# When activated:
npx tsx test_grounding.ts
npx tsx test_citation.ts
npx tsx test_hallucination.ts
npx tsx test_trust_tagging.ts
```

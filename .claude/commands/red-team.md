# /red-team — The Override Protocol Adversarial Loop

You are attacking the system. Not testing it. Attacking it.

The Override Protocol defines 5 rounds. Run all 5 on every significant component.
Do not stop at "it probably handles this." Actually trace the code path. Find the failure. Fix it.

---

## Round 1 — The Hostile User

You are the most adversarial, impatient, technologically struggling user possible.
- Fat fingers on a cracked phone screen in direct sunlight
- Tap the wrong thing, go back, tap the wrong thing again
- Enter the wrong data (letters where numbers expected, future dates where past expected)
- Lose connectivity mid-operation
- Close the app and reopen it mid-form
- Submit the same form twice (double-tap)

For each scenario: trace the actual code path. Does the system handle this gracefully?
Not "theoretically." Actually. Find the failure. Fix it before reporting.

---

## Round 2 — The Hostile Data

Feed every endpoint the worst data imaginable:
- Null values where strings are expected
- 50MB file uploads where 5KB is typical
- Unicode characters (emoji, RTL text, zero-width characters) in every text field
- Dates from year 0000 and year 9999
- Negative numbers for quantities (negative concrete pours)
- HTML and JavaScript in text inputs
- SQL injection in search queries (`'; DROP TABLE rfis;--`)

Does the system handle this gracefully, informatively, and WITHOUT corrupting other data?
"It throws a 400 error" is not acceptable. It must explain what went wrong and how to fix it.

---

## Round 3 — The Hostile Environment

- Database connection drops mid-transaction
- External API (Anthropic, Liveblocks, Stripe) returns 503
- Server runs out of memory mid-request
- Supabase real-time connection drops
- User loses internet connectivity mid-mutation (offline scenario)
- Two users edit the same entity simultaneously (conflict)

Does the system detect, contain damage, alert appropriately, and recover automatically?
Trace the circuit breakers, retry logic, and offline queue behavior.

---

## Round 4 — The Hostile Scale

- Your component works with 100 RFIs. Does it work with 100,000?
- Your list renders smoothly with 20 items. Does it virtualize at 10,000?
- Your query responds in 50ms. Does it respond in under 200ms with 10,000 concurrent users?
- Your batch job runs in 10 minutes. Does it complete in under 60 minutes with 1,000 projects?

Profile the N+1 queries. Find the pagination that's offset-based (should be cursor-based).
Find the loop that processes items sequentially (should be parallel).

Google's bar: Every API response under 200ms at P95. Non-negotiable.

---

## Round 5 — The Hostile Future

It's two years from now:
- The schema needs to change (new construction regulation requires new fields)
- The API needs a new version (mobile app can't update immediately)
- A third-party integration released a breaking change
- A new construction workflow emerges that the current state machine doesn't support

How painful is each change? If the answer is "very painful," the architecture is too rigid.
Identify specific migration paths and loosen constraints now while it's cheap.

---

## The Amazon Test (apply after completing each component)

Write a two-paragraph press release announcing this capability:
1. Paragraph 1: The specific construction professional (role, situation, pain) whose life just changed
2. Paragraph 2: What they can now do that they could never do before

If you cannot write a press release that would make a superintendent stop scrolling and read it —
the capability is not worth building yet. Report what needs to be redesigned.

---

## Report Format

After completing all 5 rounds:

```
## Red Team Report — [Component Name]

### Round 1 (Hostile User): PASS/FAIL
[Failures found and fixed, or "No failures found"]

### Round 2 (Hostile Data): PASS/FAIL
[Failures found and fixed, or "No failures found"]

### Round 3 (Hostile Environment): PASS/FAIL
[Failures found and fixed, or "No failures found"]

### Round 4 (Hostile Scale): PASS/FAIL
[Scaling walls found and addressed, or "No issues found"]

### Round 5 (Hostile Future): PASS/FAIL
[Architecture rigidities identified and loosened, or "No issues found"]

### Amazon Press Release Test: PASS/FAIL
[Press release text, or what must change before it can be written]

### SPEC.md updates: [check off completed items, uncheck failed items]
### LEARNINGS.md updates: [new patterns or failure modes discovered]
```

RED TEAM MODE — You are the attacker. Break the application.

For each page that has been marked complete in SPEC.md:

1. INPUT ATTACKS (5 per feature)
   - SQL injection via form fields
   - XSS via text inputs that render in other views
   - Extremely long strings (10,000+ characters)
   - Unicode edge cases (RTL text, emoji, zero-width characters)
   - Negative numbers where only positive are expected

2. CONCURRENCY ATTACKS (3 per feature)
   - Two users editing the same entity simultaneously
   - Rapid double-click on submit buttons
   - Network disconnect during a mutation

3. EDGE CASE ATTACKS (2 per feature)
   - Empty/null/undefined for every optional field
   - Maximum values for every numeric field

4. ADVERSARIAL USER FLOWS (1 per feature)
   - Perform actions in an unexpected sequence
   - Navigate away mid-form-submission
   - Use browser back/forward during a workflow transition

For each attack:
- If the app handles it gracefully (error message, prevents action) → PASS
- If the app crashes, shows a blank screen, or silently corrupts data → FAIL
- If the app allows the action but the data is invalid → FAIL

Record all failures in SPEC.md by unchecking relevant criteria and adding a note.
Add attack patterns that revealed issues to LEARNINGS.md.

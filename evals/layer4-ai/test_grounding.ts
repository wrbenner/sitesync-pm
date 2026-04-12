/**
 * =============================================================================
 * Layer 4 Test: AI Grounding
 * =============================================================================
 * PLACEHOLDER — Real tests deferred until AI policy layer is implemented.
 *
 * Grounding tests verify that AI-generated outputs reference real entities
 * that exist in the project database. An AI response that mentions an RFI,
 * drawing, or cost code must reference one that actually exists.
 *
 * DOMAIN_KERNEL_SPEC.md §11: AI Policy Layer
 *   "AI is advisory. AI may suggest, never commit."
 *   AI outputs must be grounded in real project data.
 *
 * PREREQUISITES:
 *   1. AI policy layer implemented with grounding checks
 *   2. AI agents configured to run against test project data
 *   3. Test fixtures with known entities that AI should reference
 *   4. Grounding validation function that checks entity references
 *
 * TEST PLAN (to be implemented):
 *   G.1 — AI summary references only existing RFIs
 *   G.2 — AI cost prediction references valid cost codes
 *   G.3 — AI schedule insight references valid schedule phases
 *   G.4 — AI response does not reference entities from other projects
 * =============================================================================
 */

const PLACEHOLDER_TESTS = [
  {
    id: "G.1",
    name: "AI summary references only existing RFIs",
    description:
      "Generate an AI daily summary for a test project. Verify every RFI number mentioned exists in the rfis table for that project.",
    blockedBy: "AI policy layer not implemented",
  },
  {
    id: "G.2",
    name: "AI cost prediction references valid cost codes",
    description:
      "Run AI cost prediction. Verify all cost codes in the output exist in budget_items for the project.",
    blockedBy: "AI policy layer not implemented",
  },
  {
    id: "G.3",
    name: "AI schedule insight references valid phases",
    description:
      "Generate AI schedule insight. Verify all phase references exist in schedule_phases.",
    blockedBy: "AI policy layer not implemented",
  },
  {
    id: "G.4",
    name: "AI response does not reference cross-project entities",
    description:
      "Run AI on Project A. Verify zero references to Project B entities (tenant isolation in AI layer).",
    blockedBy: "AI policy layer not implemented",
  },
];

console.log("--- AI Grounding (PLACEHOLDER) ---");
for (const test of PLACEHOLDER_TESTS) {
  console.log(`SKIP [${test.id}] ${test.name}`);
  console.log(`     Blocked by: ${test.blockedBy}`);
}
console.log(
  `\n--- AI Grounding: 0 passed, 0 failed, ${PLACEHOLDER_TESTS.length} skipped ---`
);

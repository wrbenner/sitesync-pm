/**
 * =============================================================================
 * Layer 4 Test: AI Hallucination Detection
 * =============================================================================
 * PLACEHOLDER — Real tests deferred until AI policy layer is implemented.
 *
 * Hallucination tests verify that AI does not fabricate:
 *   - Entity references that don't exist (phantom RFIs, fake drawings)
 *   - Financial figures not supported by data (made-up costs)
 *   - Status information that contradicts the database
 *   - User/role information that doesn't match project_members
 *
 * DOMAIN_KERNEL_SPEC.md §11: AI Policy Layer
 *   "AI is advisory. AI may suggest, never commit."
 *
 * PREREQUISITES:
 *   1. AI policy layer with hallucination detection hooks
 *   2. Entity existence validation on AI outputs
 *   3. Financial data cross-referencing
 *   4. Test project with known, complete data set
 *
 * TEST PLAN (to be implemented):
 *   H.1 — AI does not reference non-existent RFIs
 *   H.2 — AI does not fabricate financial figures
 *   H.3 — AI does not contradict entity status
 *   H.4 — AI does not mention non-existent users/roles
 * =============================================================================
 */

const PLACEHOLDER_TESTS = [
  {
    id: "H.1",
    name: "AI does not reference non-existent entities",
    description:
      "Run AI summary. Extract all entity references. Verify every referenced entity ID exists in the database.",
    blockedBy: "AI policy layer not implemented",
  },
  {
    id: "H.2",
    name: "AI does not fabricate financial figures",
    description:
      "AI reports '$X committed on cost code Y'. Verify the figure matches budget_items.committed_amount.",
    blockedBy: "AI policy layer not implemented",
  },
  {
    id: "H.3",
    name: "AI does not contradict entity status",
    description:
      "AI says 'RFI-001 is closed'. Verify rfis.status = 'closed' for that RFI.",
    blockedBy: "AI policy layer not implemented",
  },
  {
    id: "H.4",
    name: "AI does not mention non-existent users",
    description:
      "AI says 'assigned to John Smith'. Verify a project member with that name exists.",
    blockedBy: "AI policy layer not implemented",
  },
];

console.log("--- AI Hallucination Detection (PLACEHOLDER) ---");
for (const test of PLACEHOLDER_TESTS) {
  console.log(`SKIP [${test.id}] ${test.name}`);
  console.log(`     Blocked by: ${test.blockedBy}`);
}
console.log(
  `\n--- AI Hallucination: 0 passed, 0 failed, ${PLACEHOLDER_TESTS.length} skipped ---`
);

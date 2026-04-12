/**
 * =============================================================================
 * Layer 3 Test: Submittal Lifecycle (End-to-End)
 * =============================================================================
 * PLACEHOLDER — All tests use test.todo() until prerequisites are met.
 *
 * Gold-Standard Fixtures:
 *   #6  — Submittal Resubmission Flow
 *   #11 — Drawing Supersession
 *
 * PREREQUISITES:
 *   - Kernel hooks: useSubmittal, useDrawing
 *   - Status enums: submittal_status, drawing_status
 *   - Revision/supersession logic (parent_submittal_id, previous_revision_id)
 *   - State machine triggers
 *   - Audit log trigger on submittals, drawings
 *   - E2E test framework configured
 * =============================================================================
 */

const test = {
  todo: (name: string) => console.log(`SKIP [L3] test.todo: ${name}`),
};

// ── Fixture #6: Submittal Resubmission ───────────────────────────────────────

test.todo("Submittal resubmission: PM rejects submittal under review");
test.todo("Submittal resubmission: subcontractor creates new revision with parent_submittal_id");
test.todo("Submittal resubmission: new revision has incremented revision_number");
test.todo("Submittal resubmission: new revision transitions draft → submitted → under_review → approved");
test.todo("Submittal resubmission: approved_date set on final approval");
test.todo("Submittal resubmission: audit log captures full chain");

// ── Fixture #11: Drawing Supersession ────────────────────────────────────────

test.todo("Drawing supersession: Rev A has status = current");
test.todo("Drawing supersession: upload Rev B with previous_revision_id = Rev A");
test.todo("Drawing supersession: Rev A status → superseded");
test.todo("Drawing supersession: Rev B status = current");
test.todo("Drawing supersession: only one row with (sheet_number, status=current)");
test.todo("Drawing supersession: Rev A markups remain accessible");
test.todo("Drawing supersession: event drawing.superseded emitted");

console.log("\n--- Submittal Lifecycle E2E: 0 passed, 0 failed, 13 skipped (placeholder) ---");
